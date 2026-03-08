"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTicketStatus } from "@/actions/tickets";
import { Badge } from "@/components/ui/badge";
import { KANBAN_COLUMNS, PRIORITY_COLORS, PRIORITY_EMOJIS, TICKET_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, ExternalLink, Play, Pause,
  Bot, Zap, MessageCircle, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  type: string;
  claudeContext: string | null;
  isActivated?: boolean;
  activatedAt?: string | null;
  progressLog?: string | null;
  aiAssignee?: string | null;
}

interface KanbanBoardProps {
  tickets: Ticket[];
  agendaId: string;
  projectId: string;
}

const AI_ICONS: Record<string, React.ReactNode> = {
  claude: <Bot className="w-3 h-3" style={{ color: "#a855f7" }} />,
  chatgpt: <MessageCircle className="w-3 h-3" style={{ color: "#10a37f" }} />,
  copilot: <Zap className="w-3 h-3" style={{ color: "#0078d4" }} />,
};

function ProgressLogPreview({ log }: { log: string }) {
  const [expanded, setExpanded] = useState(false);
  let entries: { ts: string; msg: string }[] = [];
  try {
    entries = JSON.parse(log);
  } catch {}

  if (!entries.length) return null;
  const latest = entries[entries.length - 1];

  return (
    <div className="mt-2 rounded-md overflow-hidden" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
      <div
        className="flex items-start gap-1.5 px-2 py-1.5 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <span className="text-[10px] text-[#a855f7] font-mono">→</span>
        <p className="text-[10px] text-[#94a3b8] flex-1 leading-tight line-clamp-1">{latest.msg}</p>
        {entries.length > 1 && (
          <ChevronDown
            className={cn("w-3 h-3 text-[#475569] shrink-0 transition-transform", expanded && "rotate-180")}
          />
        )}
      </div>
      {expanded && entries.length > 1 && (
        <div className="border-t border-[#1e293b] px-2 py-1.5 space-y-1">
          {entries.slice(0, -1).reverse().map((e, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[9px] text-[#475569] font-mono shrink-0 mt-0.5">{e.ts}</span>
              <p className="text-[10px] text-[#64748b] leading-tight">{e.msg}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ tickets: initialTickets, agendaId, projectId }: KanbanBoardProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const ticketsByStatus: Record<string, Ticket[]> = {};
  for (const col of KANBAN_COLUMNS) {
    ticketsByStatus[col.id] = tickets.filter(t => t.status === col.id);
  }

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDragging(ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(colId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOver(null);

    if (!dragging) return;
    const ticket = tickets.find(t => t.id === dragging);
    if (!ticket || ticket.status === newStatus) return;

    const oldStatus = ticket.status;
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === dragging ? { ...t, status: newStatus } : t));
    setDragging(null);

    startTransition(async () => {
      const result = await updateTicketStatus(dragging, newStatus);
      if ('error' in result) {
        toast.error(result.error as string);
        setTickets(prev => prev.map(t => t.id === dragging ? { ...t, status: oldStatus } : t));
      } else if (newStatus === "done") {
        toast.success("✅ Abgeschlossen — Changelog-Eintrag erstellt!");
      }
    });
  };

  const handleActivate = async (ticket: Ticket, activate: boolean) => {
    setLoadingId(ticket.id);

    // Optimistic update
    setTickets(prev => prev.map(t =>
      t.id === ticket.id
        ? { ...t, isActivated: activate, activatedAt: activate ? new Date().toISOString() : null }
        : t
    ));

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActivated: activate }),
      });
      if (!res.ok) throw new Error("Failed");

      if (activate) {
        toast.success(`🚀 Task aktiviert! Claude nimmt "${ticket.title}" als nächstes auf.`);
      } else {
        toast.info(`⏸ Task pausiert: "${ticket.title}"`);
      }
    } catch {
      toast.error("Fehler beim Aktivieren");
      setTickets(prev => prev.map(t =>
        t.id === ticket.id ? { ...t, isActivated: !activate } : t
      ));
    } finally {
      setLoadingId(null);
    }
  };

  const COLUMN_COLORS: Record<string, string> = {
    backlog: "#64748b",
    todo: "#6366f1",
    in_progress: "#f97316",
    in_review: "#a855f7",
    done: "#22c55e",
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = ticketsByStatus[col.id] || [];
        const isOver = dragOver === col.id;
        const color = COLUMN_COLORS[col.id];
        const activatedCount = col.id === "todo"
          ? colTickets.filter(t => t.isActivated).length
          : 0;

        return (
          <div
            key={col.id}
            className="flex flex-col shrink-0 w-[270px]"
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOver(null)}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 transition-all duration-150"
              style={{
                background: isOver ? `${color}12` : "#1e293b",
                border: `1px solid ${isOver ? color + "30" : "#334155"}`,
              }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[12px] font-semibold flex-1" style={{ color }}>{col.label}</span>
              {col.id === "todo" && activatedCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}
                >
                  {activatedCount} aktiv
                </span>
              )}
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "#0f172a", color: "#64748b" }}
              >
                {colTickets.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={cn(
                "flex-1 min-h-[320px] rounded-lg p-2 space-y-2 transition-all duration-150",
              )}
              style={{
                background: isOver ? `${color}06` : "transparent",
                outline: isOver ? `1px solid ${color}40` : "none",
              }}
            >
              {colTickets.map((ticket) => {
                const isActivated = ticket.isActivated || false;
                const isTodo = col.id === "todo";

                return (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ticket.id)}
                    className={cn(
                      "rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 group",
                      dragging === ticket.id && "opacity-30 scale-95",
                      isTodo && isActivated ? "ctx-activated" : isTodo ? "ctx-not-activated" : ""
                    )}
                    style={{
                      background: "#1e293b",
                      border: `1px solid ${isTodo && isActivated ? "rgba(99,102,241,0.3)" : "#334155"}`,
                      padding: "10px 12px",
                    }}
                  >
                    {/* Activated badge */}
                    {isTodo && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {isActivated ? (
                          <span className="ctx-badge ctx-badge-indigo">
                            <span className="w-1 h-1 rounded-full bg-indigo-400 live-pulse" />
                            Aktiv
                          </span>
                        ) : (
                          <span className="ctx-badge ctx-badge-slate">
                            Inaktiv
                          </span>
                        )}
                        {ticket.aiAssignee && AI_ICONS[ticket.aiAssignee] && (
                          <span className="ctx-badge ctx-badge-slate gap-1">
                            {AI_ICONS[ticket.aiAssignee]}
                            {ticket.aiAssignee}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Title row */}
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs shrink-0 mt-0.5">{PRIORITY_EMOJIS[ticket.priority]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-[#e2e8f0] line-clamp-2">
                          {ticket.title}
                        </p>
                        {ticket.description && (
                          <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-1 leading-tight">
                            {ticket.description}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#475569] hover:text-[#94a3b8]" />
                      </Link>
                    </div>

                    {/* Claude Context indicator */}
                    {ticket.claudeContext && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0 text-[#6366f1]" />
                        <span className="text-[10px] text-[#6366f1]">Claude Context vorhanden</span>
                      </div>
                    )}

                    {/* Progress log preview (only for activated tickets) */}
                    {isTodo && isActivated && ticket.progressLog && (
                      <ProgressLogPreview log={ticket.progressLog} />
                    )}

                    {/* Footer */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <Badge
                        className="text-[9px] px-1.5 py-0 h-4"
                        style={{
                          background: `${(TICKET_TYPES[ticket.type] || TICKET_TYPES.task).color}15`,
                          color: (TICKET_TYPES[ticket.type] || TICKET_TYPES.task).color,
                          border: `1px solid ${(TICKET_TYPES[ticket.type] || TICKET_TYPES.task).color}25`,
                        }}
                      >
                        {(TICKET_TYPES[ticket.type] || TICKET_TYPES.task).label}
                      </Badge>

                      {/* ACTIVATE BUTTON — only in todo column */}
                      {isTodo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(ticket, !isActivated);
                          }}
                          disabled={loadingId === ticket.id}
                          className={cn(
                            "ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150",
                            isActivated
                              ? "bg-[#1e293b] text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/10"
                              : "bg-[#6366f1]/15 text-[#a5b4fc] border border-[#6366f1]/30 hover:bg-[#6366f1]/25"
                          )}
                        >
                          {loadingId === ticket.id ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : isActivated ? (
                            <><Pause className="w-2.5 h-2.5" /> Pausieren</>
                          ) : (
                            <><Play className="w-2.5 h-2.5" /> Aktivieren</>
                          )}
                        </button>
                      )}

                      {ticket.status === "done" && (
                        <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-[#22c55e]" />
                      )}
                    </div>
                  </div>
                );
              })}

              {colTickets.length === 0 && (
                <div
                  className="flex items-center justify-center h-20 rounded-lg text-[11px] text-[#334155]"
                  style={{ border: `1px dashed ${color}25` }}
                >
                  Hierher ziehen
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
