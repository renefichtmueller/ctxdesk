"use client";

import { useState } from "react";
import { importInboxItem, dismissInboxItem } from "@/actions/inbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { PRIORITY_LABELS } from "@/lib/constants";

interface InboxItem {
  id: string;
  filename: string;
  rawContent: string;
  parsedTitle: string | null;
  parsedDescription: string | null;
  parsedProjectHint: string | null;
  parsedAgendaHint: string | null;
  parsedPriority: number | null;
  status: string;
}

interface Agenda {
  id: string;
  name: string;
  priority: number;
  project: { name: string };
}

interface InboxItemCardProps {
  item: InboxItem;
  agendas: Agenda[];
}

export function InboxItemCard({ item, agendas }: InboxItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<string>("");
  const [title, setTitle] = useState(item.parsedTitle || item.filename.replace(/\.md$/, ""));
  const [priority, setPriority] = useState(String(item.parsedPriority ?? 2));

  // Pre-select agenda based on hints
  const hintedAgenda = agendas.find(a =>
    (item.parsedProjectHint && a.project.name.toLowerCase().includes(item.parsedProjectHint.toLowerCase())) ||
    (item.parsedAgendaHint && a.name.toLowerCase().includes(item.parsedAgendaHint.toLowerCase()))
  );

  const effectiveAgenda = selectedAgenda || hintedAgenda?.id || "";

  async function handleImport() {
    if (!effectiveAgenda) { toast.error("Bitte eine Agenda wählen"); return; }
    setImporting(true);
    const result = await importInboxItem(
      item.id,
      effectiveAgenda,
      title,
      item.parsedDescription || "",
      parseInt(priority),
      "task"
    );
    setImporting(false);
    if (result.error) toast.error(result.error);
    else toast.success("Als Ticket importiert!");
  }

  async function handleDismiss() {
    setDismissing(true);
    await dismissInboxItem(item.id);
    toast.info("Abgelehnt");
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.15)" }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#6366f1" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{item.parsedTitle || item.filename}</span>
              {item.parsedProjectHint && (
                <Badge className="text-[9px]" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                  {item.parsedProjectHint}
                </Badge>
              )}
              {item.parsedPriority !== null && (
                <Badge className="text-[9px]" style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
                  P{item.parsedPriority}
                </Badge>
              )}
            </div>
            {item.parsedDescription && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.parsedDescription}</p>
            )}
            <p className="text-[10px] text-slate-600 mt-1 font-mono">{item.filename}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Import controls */}
        <div className="mt-3 flex gap-2 flex-wrap">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-xs text-white flex-1 min-w-[160px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}
            placeholder="Ticket-Titel"
          />
          <Select value={effectiveAgenda} onValueChange={setSelectedAgenda}>
            <SelectTrigger className="h-8 text-xs w-[180px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)", color: "#f8fafc" }}>
              <SelectValue placeholder="Agenda wählen..." />
            </SelectTrigger>
            <SelectContent style={{ background: "#0e1528", border: "1px solid rgba(99,102,241,0.2)" }}>
              {agendas.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.project.name} → {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-8 text-xs w-[100px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.2)", color: "#f8fafc" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "#0e1528", border: "1px solid rgba(99,102,241,0.2)" }}>
              <SelectItem value="0">🔴 P0</SelectItem>
              <SelectItem value="1">🟠 P1</SelectItem>
              <SelectItem value="2">🟡 P2</SelectItem>
              <SelectItem value="3">🔵 P3</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleImport} disabled={importing} size="sm" className="h-8 gap-1 text-xs text-white border-0"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}>
            {importing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Importieren
          </Button>
          <Button onClick={handleDismiss} disabled={dismissing} size="sm" variant="ghost" className="h-8 gap-1 text-xs text-red-400 hover:text-red-300">
            {dismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* Raw content */}
      {expanded && (
        <pre
          className="px-4 pb-4 text-[10px] font-mono text-slate-400 overflow-auto max-h-[200px] leading-relaxed"
          style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}
        >
          {item.rawContent}
        </pre>
      )}
    </div>
  );
}
