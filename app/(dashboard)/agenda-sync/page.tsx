"use client";

import { useState } from "react";
import {
  RefreshCw, CheckCircle2, AlertCircle, FolderOpen,
  TicketIcon, Play, Eye, ChevronDown, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface SyncResult {
  ok?: boolean;
  error?: string;
  created?: number;
  updated?: number;
  itemsFound?: number;
  projects?: string[];
  errors?: string[];
  log?: string[];
  dryRun?: boolean;
  items?: PreviewItem[];
}

interface PreviewItem {
  title: string;
  project: string;
  agenda: string;
  status: string;
  priority: number;
  type: string;
  rawNumber?: string;
}

const PRIORITY_LABELS = ["P0 Kritisch", "P1 Hoch", "P2 Normal", "P3 Niedrig"];
const PRIORITY_COLORS = ["#ef4444", "#f97316", "#6366f1", "#64748b"];
const PROJECT_COLORS: Record<string, string> = {
  "CtxEvent": "#6366f1",
  "Infrastruktur": "#f97316",
  "Example Org Website": "#06b6d4",
  "AI & LLM": "#a855f7",
  "Security": "#ef4444",
  "CtxPost": "#10b981",
  "Persönlich": "#f59e0b",
};

export default function AgendaSyncPage() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const runSync = async (dryRun = false) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/agenda-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      setResult(data);
      if (!dryRun && data.ok) setSyncedAt(new Date());
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  // Group preview items by project
  const itemsByProject = result?.items?.reduce((acc, item) => {
    if (!acc[item.project]) acc[item.project] = [];
    acc[item.project].push(item);
    return acc;
  }, {} as Record<string, PreviewItem[]>);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-[#f1f5f9] tracking-tight flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#06b6d4]" />
          Agenda Sync
        </h1>
        <p className="text-[13px] text-[#64748b] mt-1">
          Liest <code className="text-[#a5b4fc] text-[11px] bg-[#1e293b] px-1 rounded">agenda.md</code> und erstellt automatisch Projekte, Agendas und Tickets in CtxDesk.
          Keine Duplikate — bestehende werden nur aktualisiert.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => runSync(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#1e293b] text-[#94a3b8] border border-[#334155] hover:text-[#cbd5e1] hover:border-[#475569] transition-all duration-150 disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          Vorschau (Dry Run)
        </button>

        <button
          onClick={() => runSync(false)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white border-0 transition-all duration-150 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading ? "Sync läuft..." : "Jetzt synchronisieren"}
        </button>

        {syncedAt && (
          <span className="text-[11px] text-[#64748b]">
            Zuletzt: {formatDistanceToNow(syncedAt, { locale: de, addSuffix: true })}
          </span>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Error */}
          {result.error && (
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-red-400">Fehler</p>
                <p className="text-[12px] text-red-300 mt-0.5 font-mono">{result.error}</p>
              </div>
            </div>
          )}

          {/* Success summary */}
          {result.ok && (
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-400">Sync erfolgreich</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">
                  {result.itemsFound} Items gefunden · {result.created} erstellt · {result.updated} aktualisiert
                </p>
              </div>
            </div>
          )}

          {/* Dry run header */}
          {result.dryRun && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
              <Eye className="w-4 h-4 text-cyan-400" />
              <p className="text-[12px] text-cyan-300 font-medium">
                Vorschau — {result.items?.length || 0} offene Items gefunden. Nichts wurde gespeichert.
              </p>
            </div>
          )}

          {/* Stats grid */}
          {(result.projects?.length || 0) > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                <div className="ctx-section-title mb-1">Projekte</div>
                <div className="text-[22px] font-bold text-[#f1f5f9]">{result.projects?.length}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: "#1e293b", border: "1px solid #334155" }}>
                <div className="ctx-section-title mb-1">Items gesamt</div>
                <div className="text-[22px] font-bold text-[#f1f5f9]">{result.itemsFound || result.items?.length}</div>
              </div>
              {!result.dryRun && (
                <>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <div className="ctx-section-title mb-1 text-emerald-400">Erstellt</div>
                    <div className="text-[22px] font-bold text-emerald-400">{result.created}</div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                    <div className="ctx-section-title mb-1 text-[#a5b4fc]">Aktualisiert</div>
                    <div className="text-[22px] font-bold text-[#a5b4fc]">{result.updated}</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Preview by project */}
          {itemsByProject && Object.keys(itemsByProject).length > 0 && (
            <div>
              <h3 className="ctx-section-title mb-3">Items nach Projekt</h3>
              <div className="space-y-3">
                {Object.entries(itemsByProject).map(([project, items]) => (
                  <ProjectSection key={project} project={project} items={items} />
                ))}
              </div>
            </div>
          )}

          {/* Log */}
          {result.log && result.log.length > 0 && (
            <div>
              <button
                onClick={() => setShowLog(!showLog)}
                className="flex items-center gap-2 text-[12px] text-[#64748b] hover:text-[#94a3b8] transition-colors mb-2"
              >
                {showLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Sync Log ({result.log.length} Einträge)
              </button>
              {showLog && (
                <div
                  className="rounded-lg p-3 font-mono space-y-1 max-h-64 overflow-y-auto"
                  style={{ background: "#0b1221", border: "1px solid #1e293b" }}
                >
                  {result.log.map((line, i) => (
                    <div key={i} className="text-[11px] leading-relaxed" style={{
                      color: line.startsWith("[+]") ? "#22c55e"
                        : line.startsWith("[~]") ? "#6366f1"
                        : line.startsWith("[ERROR]") ? "#ef4444"
                        : "#64748b"
                    }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Parse errors */}
          {result.errors && result.errors.length > 0 && (
            <div className="text-[11px] text-[#ef4444]/70 space-y-0.5">
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      {!result && !loading && (
        <div className="p-5 rounded-xl" style={{ background: "#1e293b", border: "1px solid #334155" }}>
          <h3 className="text-[13px] font-semibold text-[#e2e8f0] mb-3">Wie funktioniert das?</h3>
          <div className="space-y-2.5">
            {[
              { icon: <FolderOpen className="w-3.5 h-3.5" />, text: "Liest deine agenda.md aus dem Claude Memory Ordner" },
              { icon: <FolderOpen className="w-3.5 h-3.5" />, text: "Erkennt Projekte: CtxEvent, Infrastruktur, Website, AI & LLM, Security, CtxPost, Persönlich" },
              { icon: <TicketIcon className="w-3.5 h-3.5" />, text: "Erstellt Tickets für alle offenen Items — blockierte Items werden als Todo mit Hinweis angelegt" },
              { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: "Keine Duplikate: Bestehende Tickets werden nur aktualisiert, nicht doppelt erstellt" },
              { icon: <RefreshCw className="w-3.5 h-3.5" />, text: "Kann jederzeit erneut ausgeführt werden — sicher und idempotent" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12px] text-[#94a3b8]">
                <span className="text-[#6366f1] shrink-0 mt-0.5">{step.icon}</span>
                {step.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSection({ project, items }: { project: string; items: PreviewItem[] }) {
  const [expanded, setExpanded] = useState(true);
  const color = PROJECT_COLORS[project] || "#6366f1";

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#1e293b", border: "1px solid #334155" }}>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#263245] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[13px] font-semibold text-[#e2e8f0] flex-1 text-left">{project}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${color}15`, color }}>
          {items.length}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#475569]" />}
      </button>

      {expanded && (
        <div className="border-t border-[#334155] divide-y divide-[#1e293b]">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2">
              <div
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: ["#ef4444","#f97316","#6366f1","#64748b"][item.priority] || "#6366f1" }}
              />
              <span className="text-[12px] text-[#cbd5e1] flex-1 truncate">{item.title}</span>
              {item.rawNumber && (
                <span className="text-[9px] font-mono text-[#475569] shrink-0">{item.rawNumber}</span>
              )}
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{
                  background: item.status === "blocked" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                  color: item.status === "blocked" ? "#fca5a5" : "#a5b4fc",
                }}
              >
                {item.status === "blocked" ? "blockiert" : "offen"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
