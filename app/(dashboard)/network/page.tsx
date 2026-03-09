"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Globe, Play, Loader2, Wifi, Server, Route,
  Search, MapPin, Clock, CheckCircle2, XCircle,
  ArrowRight, Network, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProbeLocation {
  continent: string;
  region?: string;
  country: string;
  city?: string;
  asn?: number;
  network?: string;
}

interface PingStats {
  min?: number;
  max?: number;
  avg?: number;
  loss?: number;
  rcv?: number;
  drop?: number;
}

interface MeasurementResult {
  probe: ProbeLocation;
  result: {
    status: "finished" | "failed";
    rawOutput?: string;
    stats?: PingStats;
    resolvedAddress?: string;
    timings?: Array<{ rtt: number }>;
    answers?: Array<{ value: string; type: string; ttl?: number }>;
    hops?: Array<{ resolvedAddress?: string; resolvedHostname?: string; timings: Array<{ rtt?: number }> }>;
  };
}

interface Measurement {
  id: string;
  type: string;
  status: "in-progress" | "finished";
  target: string;
  results: MeasurementResult[];
  createdAt: string;
}

// ─── Preset targets ───────────────────────────────────────────────────────────
const PRESET_TARGETS = [
  { label: "example.com", value: "example.com" },
  { label: "example.com", value: "example.com" },
  { label: "1.1.1.1 (Cloudflare)", value: "1.1.1.1" },
  { label: "8.8.8.8 (Google DNS)", value: "8.8.8.8" },
  { label: "ripe.net", value: "ripe.net" },
  { label: "nanog.org", value: "nanog.org" },
];

// ─── Preset locations ─────────────────────────────────────────────────────────
const PRESET_LOCATIONS = [
  { label: "🌍 Weltweit (5 Probes)", value: [{ magic: "world" }], limit: 5 },
  { label: "🇩🇪 Deutschland", value: [{ country: "DE" }], limit: 3 },
  { label: "🇺🇸 USA", value: [{ country: "US" }], limit: 3 },
  { label: "🌏 Asien-Pazifik", value: [{ continent: "OC" }, { continent: "AS" }], limit: 4 },
  { label: "🌍 Europa", value: [{ continent: "EU" }], limit: 5 },
  { label: "🌐 Global (15 Probes)", value: [{ magic: "world" }], limit: 15 },
];

const PROBE_TYPES = [
  { label: "Ping", value: "ping", icon: Wifi, desc: "ICMP Echo" },
  { label: "Traceroute", value: "traceroute", icon: Route, desc: "Hop-by-hop" },
  { label: "DNS", value: "dns", icon: Search, desc: "DNS Lookup" },
  { label: "MTR", value: "mtr", icon: Network, desc: "Ping + Trace" },
  { label: "HTTP", value: "http", icon: Globe, desc: "HTTP GET" },
];

// ─── Helper: format RTT ───────────────────────────────────────────────────────
function rttColor(rtt?: number) {
  if (!rtt) return "#64748b";
  if (rtt < 20) return "#22c55e";
  if (rtt < 100) return "#f97316";
  return "#ef4444";
}

function formatRtt(rtt?: number) {
  if (!rtt && rtt !== 0) return "—";
  return `${rtt.toFixed(1)}ms`;
}

// ─── Result Card ──────────────────────────────────────────────────────────────
function ResultCard({ result, type }: { result: MeasurementResult; type: string }) {
  const loc = result.probe;
  const r = result.result;
  const isOk = r.status === "finished";

  const avgRtt = r.stats?.avg || r.timings?.[0]?.rtt;

  return (
    <div className="rounded-lg p-3" style={{ background: "#0f172a", border: `1px solid ${isOk ? "#1e293b" : "#7f1d1d"}` }}>
      {/* Location header */}
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-3 h-3 shrink-0" style={{ color: "#a855f7" }} />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] font-semibold text-[#f1f5f9] truncate block">
            {loc.city ? `${loc.city}, ` : ""}{loc.country}
          </span>
          {loc.network && (
            <span className="text-[10px] text-[#475569] truncate block">
              AS{loc.asn} · {loc.network}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isOk
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : <XCircle className="w-3.5 h-3.5 text-red-400" />
          }
          {avgRtt !== undefined && (
            <span className="text-[11px] font-mono font-bold" style={{ color: rttColor(avgRtt) }}>
              {formatRtt(avgRtt)}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {type === "ping" && r.stats && (
        <div className="grid grid-cols-4 gap-1 mt-1">
          {[
            { label: "Min", val: formatRtt(r.stats.min) },
            { label: "Avg", val: formatRtt(r.stats.avg) },
            { label: "Max", val: formatRtt(r.stats.max) },
            { label: "Loss", val: r.stats.loss !== undefined ? `${r.stats.loss}%` : "—" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-[9px] text-[#475569] uppercase">{stat.label}</div>
              <div className="text-[11px] font-mono text-[#94a3b8]">{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* DNS answers */}
      {type === "dns" && r.answers && r.answers.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {r.answers.slice(0, 3).map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="text-[#475569] font-mono">{a.type}</span>
              <ArrowRight className="w-2.5 h-2.5 text-[#334155] shrink-0" />
              <span className="text-[#94a3b8] font-mono truncate">{a.value}</span>
              {a.ttl && <span className="text-[#334155] shrink-0">TTL {a.ttl}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Traceroute / MTR hops */}
      {(type === "traceroute" || type === "mtr") && r.hops && r.hops.length > 0 && (
        <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
          {r.hops.slice(0, 6).map((hop, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]">
              <span className="text-[#334155] w-4 text-right shrink-0">{i + 1}</span>
              <span className="text-[#64748b] font-mono truncate flex-1">
                {hop.resolvedHostname || hop.resolvedAddress || "*"}
              </span>
              <span className="font-mono shrink-0" style={{ color: rttColor(hop.timings[0]?.rtt) }}>
                {formatRtt(hop.timings[0]?.rtt)}
              </span>
            </div>
          ))}
          {r.hops.length > 6 && (
            <div className="text-[10px] text-[#334155]">... +{r.hops.length - 6} mehr</div>
          )}
        </div>
      )}

      {/* HTTP */}
      {type === "http" && r.rawOutput && (
        <div className="mt-1 text-[10px] font-mono text-[#64748b] line-clamp-2 leading-relaxed">
          {r.rawOutput.split("\n").slice(0, 2).join(" ")}
        </div>
      )}

      {/* Resolved address */}
      {r.resolvedAddress && type !== "dns" && (
        <div className="mt-1 text-[10px] text-[#475569] font-mono">→ {r.resolvedAddress}</div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const [target, setTarget] = useState("example.com");
  const [probeType, setProbeType] = useState("ping");
  const [locationIdx, setLocationIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function runProbe() {
    if (!target.trim() || running) return;
    setRunning(true);
    setMeasurement(null);

    const loc = PRESET_LOCATIONS[locationIdx];

    try {
      const res = await fetch("/api/network/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: probeType,
          target: target.trim(),
          limit: loc.limit,
          locations: loc.value,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const id = data.id;
      // Poll for results
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/network/probe?id=${id}`);
        const m: Measurement = await r.json();
        setMeasurement(m);
        if (m.status === "finished") {
          if (pollRef.current) clearInterval(pollRef.current);
          setRunning(false);
          setHistory(prev => [m, ...prev].slice(0, 10));
          toast.success(`✅ ${m.results.length} Probes abgeschlossen`);
        }
      }, 1500);

    } catch (err) {
      toast.error(String(err));
      setRunning(false);
    }
  }

  const successCount = measurement?.results.filter(r => r.result.status === "finished").length ?? 0;
  const totalCount = measurement?.results.length ?? 0;

  const avgRtts = measurement?.results
    .filter(r => r.result.status === "finished" && (r.result.stats?.avg || r.result.timings?.[0]?.rtt))
    .map(r => r.result.stats?.avg || r.result.timings?.[0]?.rtt || 0);
  const globalAvg = avgRtts && avgRtts.length > 0
    ? avgRtts.reduce((a, b) => a + b, 0) / avgRtts.length
    : null;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: "#a855f7" }} />
          <h1 className="text-[20px] font-bold text-[#f1f5f9]">Netzwerk-Diagnostik</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>
            via globalping.io
          </span>
        </div>
        <p className="text-[12px] text-[#475569] mt-1">
          Ping · Traceroute · DNS · MTR · HTTP — 500+ globale Probes · kostenlos
        </p>
      </div>

      {/* Config Panel */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "#1e293b", border: "1px solid #334155" }}>

        {/* Target */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Ziel</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_TARGETS.map(p => (
              <button
                key={p.value}
                onClick={() => setTarget(p.value)}
                className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                style={{
                  background: target === p.value ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${target === p.value ? "rgba(99,102,241,0.4)" : "#334155"}`,
                  color: target === p.value ? "#a5b4fc" : "#64748b",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runProbe()}
            placeholder="Domain oder IP-Adresse..."
            className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none font-mono"
            style={{ background: "#0f172a", border: "1px solid #334155" }}
          />
        </div>

        {/* Probe type + location */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Typ</label>
            <div className="flex flex-wrap gap-1.5">
              {PROBE_TYPES.map(pt => (
                <button
                  key={pt.value}
                  onClick={() => setProbeType(pt.value)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all"
                  style={{
                    background: probeType === pt.value ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${probeType === pt.value ? "rgba(168,85,247,0.4)" : "#334155"}`,
                    color: probeType === pt.value ? "#d8b4fe" : "#64748b",
                  }}
                >
                  <pt.icon className="w-3 h-3" />
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Standorte</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LOCATIONS.map((l, i) => (
                <button
                  key={i}
                  onClick={() => setLocationIdx(i)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] transition-all"
                  style={{
                    background: locationIdx === i ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${locationIdx === i ? "rgba(6,182,212,0.35)" : "#334155"}`,
                    color: locationIdx === i ? "#22d3ee" : "#64748b",
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runProbe}
          disabled={running || !target.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
          style={{
            background: running ? "#1e293b" : "linear-gradient(135deg, #6d28d9, #a855f7)",
            color: running ? "#475569" : "white",
            border: running ? "1px solid #334155" : "none",
          }}
        >
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Messe {target}...</>
            : <><Play className="w-4 h-4" /> Messung starten</>}
        </button>
      </div>

      {/* Results */}
      {measurement && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: "#1e293b", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span className="text-[12px] font-mono text-[#f1f5f9]">{measurement.target}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                {measurement.type}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {globalAvg !== null && (
                <div className="text-right">
                  <div className="text-[10px] text-[#475569]">Ø Latenz</div>
                  <div className="text-[14px] font-bold font-mono" style={{ color: rttColor(globalAvg) }}>
                    {formatRtt(globalAvg)}
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="text-[10px] text-[#475569]">Probes</div>
                <div className="text-[14px] font-bold text-[#f1f5f9]">{successCount}/{totalCount}</div>
              </div>
              {measurement.status === "in-progress" && (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              )}
              {measurement.status === "finished" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Result grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {measurement.results.map((r, i) => (
              <ResultCard key={i} result={r} type={measurement.type} />
            ))}
            {/* Placeholder skeletons while loading */}
            {measurement.status === "in-progress" && measurement.results.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg p-3 animate-pulse" style={{ background: "#0f172a", border: "1px solid #1e293b", height: "80px" }} />
              ))
            )}
          </div>

          {/* Globalping link */}
          <div className="text-center">
            <a
              href={`https://www.jsdelivr.com/globalping?measurement_id=${measurement.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#475569] hover:text-[#94a3b8] transition-colors"
            >
              Vollständige Ergebnisse auf globalping.io →
            </a>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#64748b]" />
            <span className="text-[11px] text-[#64748b]">Letzte Messungen</span>
          </div>
          <div className="space-y-1">
            {history.slice(1).map((m, i) => {
              const rtts = m.results
                .filter(r => r.result.stats?.avg || r.result.timings?.[0]?.rtt)
                .map(r => r.result.stats?.avg || r.result.timings?.[0]?.rtt || 0);
              const avg = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null;
              return (
                <button
                  key={i}
                  onClick={() => setMeasurement(m)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-[#1e293b]"
                  style={{ border: "1px solid #1e293b" }}
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>{m.type}</span>
                  <span className="text-[12px] text-[#94a3b8] font-mono flex-1 truncate">{m.target}</span>
                  <span className="text-[11px] text-[#475569]">{m.results.length} Probes</span>
                  {avg !== null && (
                    <span className="text-[11px] font-mono font-bold" style={{ color: rttColor(avg) }}>{formatRtt(avg)}</span>
                  )}
                  <RefreshCw className="w-3 h-3 text-[#334155]" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!measurement && (
        <div className="text-center py-12 rounded-xl" style={{ background: "#1e293b", border: "1px dashed #334155" }}>
          <Globe className="w-8 h-8 mx-auto mb-3 text-[#334155]" />
          <p className="text-[13px] text-[#475569]">Ziel auswählen + Messung starten</p>
          <p className="text-[11px] text-[#334155] mt-1">Nutzt globalping.io — 500+ Probes weltweit, kostenlos</p>
        </div>
      )}
    </div>
  );
}
