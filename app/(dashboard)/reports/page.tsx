"use client";

import { useState, useEffect } from "react";
import { BarChart2, Download, Clock, TrendingUp, Loader2 } from "lucide-react";

interface TimeReport {
  entries: Array<{
    id: string; ticketId: string; ticketTitle: string;
    project: string; agenda: string; startedAt: string;
    endedAt: string; durationMinutes: number; note: string;
  }>;
  byTicket: Record<string, { title: string; project: string; totalMinutes: number; entries: number }>;
  totalMinutes: number;
  totalHours: string;
}

export default function ReportsPage() {
  const [report, setReport] = useState<TimeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadReport();
  }, [from, to]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/time?from=${from}&to=${to}T23:59:59`);
      const data = await res.json();
      setReport(data);
    } catch {} finally { setLoading(false); }
  }

  function downloadCsv() {
    window.open(`/api/reports/time?format=csv&from=${from}&to=${to}T23:59:59`, "_blank");
  }

  const topTickets = report
    ? Object.entries(report.byTicket)
        .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes)
        .slice(0, 10)
    : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
            <BarChart2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[#f1f5f9]">Time Report</h1>
            <p className="text-[11px] text-[#64748b]">Zeiterfassung & Abrechnung</p>
          </div>
        </div>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      {/* Date range */}
      <div className="flex gap-3 p-4 rounded-xl" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Von</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none"
            style={{ background: "#0f172a", border: "1px solid #334155" }} />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Bis</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none"
            style={{ background: "#0f172a", border: "1px solid #334155" }} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : report ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Gesamtstunden", value: `${report.totalHours}h`, icon: Clock, color: "#6366f1" },
              { label: "Einträge", value: String(report.entries.length), icon: TrendingUp, color: "#22c55e" },
              { label: "Tickets", value: String(Object.keys(report.byTicket).length), icon: BarChart2, color: "#a855f7" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-4 rounded-xl" style={{ background: "#1e293b", border: `1px solid ${color}22` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</span>
                </div>
                <p className="text-[24px] font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Top tickets by time */}
          {topTickets.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: "1px solid #334155" }}>
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #334155", background: "rgba(99,102,241,0.06)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-indigo-400">Top Tickets nach Zeit</p>
              </div>
              <div className="divide-y divide-[#1e293b]">
                {topTickets.map(([id, { title, project, totalMinutes, entries: cnt }]) => {
                  const pct = Math.round((totalMinutes / Math.max(report.totalMinutes, 1)) * 100);
                  const h = Math.floor(totalMinutes / 60);
                  const m = totalMinutes % 60;
                  return (
                    <div key={id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#f1f5f9] truncate">{title}</p>
                          <p className="text-[10px] text-[#475569]">{project}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-mono font-bold text-[#94a3b8]">
                            {h > 0 ? `${h}h ` : ""}{m}m
                          </p>
                          <p className="text-[10px] text-[#475569]">{cnt} Einträge</p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#0f172a" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #4f46e5, #6366f1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {report.entries.length === 0 && (
            <div className="text-center py-12 text-[#475569]">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[13px]">Keine Zeiteinträge im gewählten Zeitraum</p>
              <p className="text-[11px] mt-1">Timer in Ticket-Detailseiten starten</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
