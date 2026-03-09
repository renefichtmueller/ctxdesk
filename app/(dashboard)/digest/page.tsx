"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain, RefreshCw, Download, Loader2, Sparkles, Clock,
  CheckCircle2, Circle, Eye, AlertTriangle, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DigestData {
  digest: string;
  ticketCount: number;
  inProgress: number;
  inReview: number;
  todo: number;
  model: string;
  provider: string;
  generatedAt: string;
  error?: string;
}

interface StatusData {
  total: number;
  counts: Array<{ status: string; _count: number }>;
}

function StatBadge({
  label, count, color, icon: Icon,
}: {
  label: string; count: number; color: string; icon: React.ElementType;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}aa` }}>{label}</p>
        <p className="text-[18px] font-bold leading-tight" style={{ color }}>{count}</p>
      </div>
    </div>
  );
}

export default function DigestPage() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; provider: string; name: string }>>([]);

  // Load model list
  useEffect(() => {
    fetch("/api/llm/models")
      .then((r) => r.json())
      .then((d) => {
        if (d.all?.length) {
          setAvailableModels(d.all);
          setModel(d.all[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load ticket status
  const loadStatus = useCallback(() => {
    fetch("/api/digest")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function generateDigest() {
    setLoading(true);
    try {
      const selectedModel = availableModels.find((m) => m.id === model);
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model || undefined,
          provider: selectedModel?.provider || "ollama",
        }),
      });
      const data = await res.json();
      setDigest(data);
    } catch (err) {
      setDigest({ digest: "", error: String(err), ticketCount: 0, inProgress: 0, inReview: 0, todo: 0, model: "", provider: "", generatedAt: "" });
    } finally {
      setLoading(false);
    }
  }

  function downloadDigest() {
    if (!digest?.digest) return;
    const date = new Date().toISOString().slice(0, 10);
    const text = `# CtxDesk Daily Digest — ${date}\n\nModell: ${digest.model} (${digest.provider})\nTickets: ${digest.ticketCount} aktiv\n\n---\n\n${digest.digest}`;
    const blob = new Blob([text], { type: "text/plain; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ctxdesk-digest-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              <Brain className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-[#f1f5f9]">Daily Digest</h1>
              <p className="text-[11px] text-[#64748b]">{today}</p>
            </div>
          </div>
        </div>
        {digest && (
          <button
            onClick={downloadDigest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #334155" }}
          >
            <Download className="w-3.5 h-3.5" />
            .md
          </button>
        )}
      </div>

      {/* Stats */}
      {status && (
        <div className="grid grid-cols-3 gap-3">
          <StatBadge label="In Arbeit" count={status.counts.find((c) => c.status === "in_progress")?._count ?? 0} color="#f97316" icon={Zap} />
          <StatBadge label="In Review" count={status.counts.find((c) => c.status === "in_review")?._count ?? 0} color="#a855f7" icon={Eye} />
          <StatBadge label="Offen" count={status.counts.find((c) => c.status === "todo")?._count ?? 0} color="#6366f1" icon={Circle} />
        </div>
      )}

      {/* Model selector + Generate Button */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ background: "#1e293b", border: "1px solid #334155" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Modell für Briefing</p>
        <div className="flex gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-[12px] text-[#f1f5f9] bg-[#0f172a] border border-[#334155] focus:outline-none focus:border-indigo-500"
          >
            {availableModels.length === 0 && (
              <option value="">— Kein Modell verfügbar —</option>
            )}
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.provider === "ollama" ? "🦙" : "🎯"} {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={generateDigest}
            disabled={loading || availableModels.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 disabled:opacity-40"
            style={{
              background: loading ? "rgba(99,102,241,0.1)" : "linear-gradient(135deg, #4f46e5, #6366f1)",
              color: "#fff",
              border: "1px solid rgba(99,102,241,0.4)",
            }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generiere...</>
              : <><Sparkles className="w-3.5 h-3.5" /> Digest erstellen</>}
          </button>
        </div>
        {availableModels.length === 0 && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Ollama oder LM Studio starten für AI-Digest
          </p>
        )}
      </div>

      {/* Digest output */}
      {digest && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#1e293b", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          {/* Header bar */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(99,102,241,0.12)", background: "rgba(99,102,241,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] font-semibold text-indigo-300">KI-Briefing</span>
            </div>
            <div className="flex items-center gap-3">
              {digest.model && (
                <span className="text-[10px] text-[#475569] font-mono">{digest.model}</span>
              )}
              {digest.generatedAt && (
                <span className="text-[10px] text-[#475569] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(digest.generatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={generateDigest}
                disabled={loading}
                className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#94a3b8] transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Neu
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            {digest.error ? (
              <div className="flex items-start gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-[12px]">{digest.error}</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none text-[#94a3b8] text-[13px] leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-[#f1f5f9] text-[15px] font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-[#e2e8f0] text-[14px] font-semibold mt-3 mb-1.5">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[#cbd5e1] text-[13px] font-semibold mt-2 mb-1">{children}</h3>,
                    strong: ({ children }) => <strong className="text-[#f1f5f9] font-semibold">{children}</strong>,
                    ul: ({ children }) => <ul className="space-y-1 list-none pl-0">{children}</ul>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-[#94a3b8]">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                        <span>{children}</span>
                      </li>
                    ),
                    p: ({ children }) => <p className="text-[#94a3b8] leading-relaxed mb-2">{children}</p>,
                  }}
                >
                  {digest.digest}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Footer stats */}
          {!digest.error && digest.ticketCount > 0 && (
            <div
              className="px-4 py-2 flex items-center gap-4"
              style={{ borderTop: "1px solid rgba(99,102,241,0.08)" }}
            >
              <span className="text-[10px] text-[#475569]">
                Basis: {digest.ticketCount} Tickets · {digest.inProgress} aktiv · {digest.inReview} in Review · {digest.todo} offen
              </span>
            </div>
          )}
        </div>
      )}

      {!digest && !loading && (
        <div className="text-center py-12 text-[#475569]">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-[13px]">Klicke &quot;Digest erstellen&quot; für dein Morning-Briefing</p>
          <p className="text-[11px] mt-1 text-[#334155]">KI analysiert alle aktiven Tickets und erstellt eine Übersicht</p>
        </div>
      )}
    </div>
  );
}
