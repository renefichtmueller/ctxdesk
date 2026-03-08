"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, Bot, RotateCcw, AlertTriangle, CheckCircle2, Info, Zap, MessageCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface LogEntry {
  id: string;
  level: string;
  category: string;
  message: string;
  ticketId?: string | null;
  projectId?: string | null;
  metadata?: string | null;
  createdAt: string;
}

const LEVEL_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  info: { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", icon: <Info className="w-3 h-3" /> },
  warn: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: <AlertTriangle className="w-3 h-3" /> },
  error: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", icon: <AlertTriangle className="w-3 h-3" /> },
  success: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", icon: <CheckCircle2 className="w-3 h-3" /> },
};

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  activation: { label: "Aktivierung", color: "#6366f1" },
  progress: { label: "Fortschritt", color: "#a855f7" },
  system: { label: "System", color: "#64748b" },
  agenda_sync: { label: "Agenda Sync", color: "#06b6d4" },
  completion: { label: "Abgeschlossen", color: "#22c55e" },
};

const AI_ICONS: Record<string, React.ReactNode> = {
  claude: <Bot className="w-3 h-3 text-[#a855f7]" />,
  chatgpt: <MessageCircle className="w-3 h-3 text-[#10a37f]" />,
  copilot: <Zap className="w-3 h-3 text-[#0078d4]" />,
};

function detectAI(message: string): string | null {
  if (message.includes("[chatgpt]") || message.includes("[gpt]")) return "chatgpt";
  if (message.includes("[copilot]")) return "copilot";
  if (message.includes("[claude]")) return "claude";
  return null;
}

export default function LiveLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<LogEntry[]>([]);

  const fetchLogs = async (since?: string) => {
    try {
      const url = `/api/live-log?limit=100${filter ? `&category=${filter}` : ""}${since ? `&since=${since}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data: LogEntry[] = await res.json();
      return data;
    } catch {
      return [];
    }
  };

  const loadInitial = async () => {
    setLoading(true);
    const data = await fetchLogs();
    if (data) {
      const sorted = [...data].reverse();
      setLogs(sorted);
      logsRef.current = sorted;
    }
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadInitial();
  }, [filter]);

  // Polling for new entries
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      const newest = logsRef.current[logsRef.current.length - 1];
      const since = newest ? newest.createdAt : undefined;
      const newData = await fetchLogs(since);
      if (newData && newData.length > 0) {
        const reversed = [...newData].reverse();
        setLogs(prev => {
          const updated = [...prev, ...reversed];
          logsRef.current = updated;
          return updated;
        });
        setLastUpdate(new Date());
        // Auto-scroll to bottom when new entries arrive
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, filter]);

  const categories = Array.from(new Set(logs.map(l => l.category)));

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-bold text-[#f1f5f9] tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#6366f1]" />
            Live Log
          </h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">
            Echtzeit-Aktivitätsfeed aller KI-Aktionen und Task-Updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[11px] text-[#475569]">
              Aktualisiert vor {formatDistanceToNow(lastUpdate, { locale: de })}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 border",
              autoRefresh
                ? "bg-[#6366f1]/15 text-[#a5b4fc] border-[#6366f1]/30"
                : "bg-[#1e293b] text-[#64748b] border-[#334155]"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-[#6366f1] live-pulse" : "bg-[#475569]")} />
            {autoRefresh ? "Live" : "Pausiert"}
          </button>
          <button
            onClick={loadInitial}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[#1e293b] text-[#64748b] border border-[#334155] hover:text-[#cbd5e1] hover:border-[#475569] transition-all duration-150"
          >
            <RotateCcw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[#475569]" />
          <button
            onClick={() => setFilter(null)}
            className={cn(
              "ctx-badge transition-all",
              filter === null ? "ctx-badge-indigo" : "ctx-badge-slate"
            )}
          >
            Alle
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? null : cat)}
              className={cn(
                "ctx-badge transition-all",
                filter === cat ? "ctx-badge-indigo" : "ctx-badge-slate"
              )}
            >
              {CATEGORY_STYLES[cat]?.label || cat}
            </button>
          ))}
        </div>
      )}

      {/* Log container */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#0b1221", border: "1px solid #1e293b" }}
      >
        {/* Terminal header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderBottom: "1px solid #1e293b", background: "#0f172a" }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/60" />
          </div>
          <span className="text-[11px] text-[#475569] font-mono flex-1 text-center">
            ctxdesk · live-log · {logs.length} Einträge
          </span>
          {autoRefresh && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse" />
              <span className="text-[10px] text-emerald-400 font-mono">LIVE</span>
            </div>
          )}
        </div>

        {/* Log entries */}
        <div className="p-3 space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto font-mono">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#475569] text-[13px]">
              Lade Logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Activity className="w-8 h-8 text-[#1e293b]" />
              <p className="text-[13px] text-[#334155]">Noch keine Einträge</p>
              <p className="text-[11px] text-[#1e293b]">Aktiviere Tasks oder führe einen Agenda Sync durch</p>
            </div>
          ) : (
            logs.map((log) => {
              const levelStyle = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
              const catStyle = CATEGORY_STYLES[log.category];
              const ai = detectAI(log.message);
              const ts = new Date(log.createdAt);
              const pad = (n: number) => String(n).padStart(2, "0");
              const timeStr = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md group log-entry-new hover:bg-[#1e293b] transition-colors"
                >
                  {/* Timestamp */}
                  <span className="text-[10px] text-[#334155] shrink-0 mt-0.5 w-16">{timeStr}</span>

                  {/* Level icon */}
                  <span style={{ color: levelStyle.color }} className="shrink-0 mt-0.5">
                    {levelStyle.icon}
                  </span>

                  {/* Category badge */}
                  {catStyle && (
                    <span
                      className="text-[9px] font-semibold px-1 py-0.5 rounded shrink-0"
                      style={{ color: catStyle.color, background: `${catStyle.color}15` }}
                    >
                      {catStyle.label}
                    </span>
                  )}

                  {/* AI icon */}
                  {ai && <span className="shrink-0 mt-0.5">{AI_ICONS[ai]}</span>}

                  {/* Message */}
                  <span
                    className="text-[12px] leading-snug flex-1"
                    style={{ color: levelStyle.color }}
                  >
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* AI Integration Info */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          {
            name: "Claude Code",
            icon: <Bot className="w-4 h-4 text-[#a855f7]" />,
            desc: "Vollautomatisch via CLAUDE_QUEUE.md + inbox/",
            status: "aktiv",
            color: "#a855f7",
          },
          {
            name: "ChatGPT Desktop",
            icon: <MessageCircle className="w-4 h-4 text-[#10a37f]" />,
            desc: "Liest CHATGPT_QUEUE.md via Work with Apps",
            status: "bereit",
            color: "#10a37f",
          },
          {
            name: "Microsoft Copilot",
            icon: <Zap className="w-4 h-4 text-[#0078d4]" />,
            desc: "Liest COPILOT_QUEUE.md, Status via inbox/",
            status: "bereit",
            color: "#0078d4",
          },
        ].map(ai => (
          <div
            key={ai.name}
            className="flex flex-col gap-2 p-3 rounded-lg"
            style={{ background: "#1e293b", border: "1px solid #334155" }}
          >
            <div className="flex items-center gap-2">
              {ai.icon}
              <span className="text-[12px] font-semibold text-[#e2e8f0]">{ai.name}</span>
              <span
                className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: `${ai.color}15`, color: ai.color }}
              >
                {ai.status}
              </span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-snug">{ai.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
