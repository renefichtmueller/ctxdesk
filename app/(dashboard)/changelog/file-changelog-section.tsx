"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, FileText, Clock } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  d: string;
  t: "FEAT" | "UI" | "FIX" | "DATA" | "AI" | "INT";
  m: string;
  source?: "pending" | "main";
}

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  FEAT: { bg: "rgba(168,85,247,0.1)", text: "#a855f7", border: "rgba(168,85,247,0.2)", label: "Feature" },
  UI: { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", border: "rgba(59,130,246,0.2)", label: "UI" },
  FIX: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.2)", label: "Fix" },
  DATA: { bg: "rgba(16,185,129,0.1)", text: "#10b981", border: "rgba(16,185,129,0.2)", label: "Data" },
  AI: { bg: "rgba(99,102,241,0.1)", text: "#818cf8", border: "rgba(99,102,241,0.2)", label: "AI" },
  INT: { bg: "rgba(14,165,233,0.1)", text: "#0ea5e9", border: "rgba(14,165,233,0.2)", label: "Infra" },
};

const TYPES = ["FEAT", "UI", "FIX", "DATA", "AI", "INT"] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function FileChangelogSection() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flushing, setFlushing] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<typeof TYPES[number]>("FEAT");
  const [formMsg, setFormMsg] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/changelog-file");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries);
      setPendingCount(data.pendingCount);
    } catch {
      toast.error("Changelog konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMsg.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/changelog-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ d: formDate, t: formType, m: formMsg.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add entry");
      toast.success("Eintrag hinzugefügt");
      setFormMsg("");
      setShowForm(false);
      await loadEntries();
    } catch {
      toast.error("Fehler beim Hinzufügen");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlush = async () => {
    if (pendingCount === 0) {
      toast.info("Keine ausstehenden Einträge zum Übertragen");
      return;
    }
    setFlushing(true);
    try {
      const res = await fetch("/api/changelog-file?flush=true", { method: "DELETE" });
      if (!res.ok) throw new Error("Flush failed");
      const data = await res.json();
      toast.success(`${data.flushed} Einträge in CHANGELOG.md übertragen`);
      await loadEntries();
    } catch {
      toast.error("Flush fehlgeschlagen");
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: "#6366f1" }} />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Changelog-Dateien
          </h2>
          {pendingCount > 0 && (
            <Badge
              className="text-[10px]"
              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              {pendingCount} ausstehend
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadEntries}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors text-slate-500 hover:text-white hover:bg-white/5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {pendingCount > 0 && (
            <button
              onClick={handleFlush}
              disabled={flushing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
            >
              <Trash2 className="w-3 h-3" />
              {flushing ? "Übertrage..." : "Flush → CHANGELOG.md"}
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
            style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
          >
            <Plus className="w-3 h-3" />
            Eintrag
          </button>
        </div>
      </div>

      {/* Add entry form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl space-y-3"
          style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Datum</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e293b" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">Typ</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as typeof TYPES[number])}
                className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid #1e293b" }}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t} — {TYPE_COLORS[t]?.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Beschreibung</label>
            <input
              type="text"
              value={formMsg}
              onChange={(e) => setFormMsg(e.target.value)}
              placeholder="Was wurde implementiert/geändert/behoben?"
              required
              className="w-full px-3 py-1.5 rounded-lg text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e293b" }}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              disabled={submitting || !formMsg.trim()}
              size="sm"
              className="text-xs font-semibold"
              style={{ background: "#6366f1", color: "white" }}
            >
              {submitting ? "Speichere..." : "Speichern"}
            </Button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-white transition-colors px-2"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-xs">Keine Einträge in CHANGELOG_PENDING.md oder CHANGELOG.md</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const typeConfig = TYPE_COLORS[entry.t] ?? TYPE_COLORS.FEAT;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{
                  background: entry.source === "pending"
                    ? "rgba(245,158,11,0.04)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${entry.source === "pending" ? "rgba(245,158,11,0.15)" : "#1e293b"}`,
                }}
              >
                {/* Type badge */}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ background: typeConfig.bg, color: typeConfig.text, border: `1px solid ${typeConfig.border}` }}
                >
                  {entry.t}
                </span>

                {/* Message */}
                <span className="text-xs text-slate-300 flex-1 leading-relaxed">{entry.m}</span>

                {/* Date + source */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span className="text-[10px] text-slate-500">{entry.d}</span>
                  {entry.source === "pending" && (
                    <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      PENDING
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
