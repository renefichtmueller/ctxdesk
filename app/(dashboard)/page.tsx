import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_EMOJIS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FolderOpen, Inbox, Terminal, CheckCircle2,
  Clock, Activity, Layers, Zap, TrendingUp,
  AlertTriangle, Circle, ArrowRight, GitCommit,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ─── Helper: Status dot ──────────────────────────────────────────────────────

function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color, boxShadow: `0 0 5px ${color}` }}
    />
  );
}

// ─── Helper: Panel ───────────────────────────────────────────────────────────

function Panel({
  children,
  accent = "#6366f1",
  className = "",
  label,
  labelRight,
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: "rgba(8, 12, 28, 0.85)",
        border: `1px solid ${accent}22`,
        boxShadow: `0 0 24px ${accent}0a`,
      }}
    >
      {(label || labelRight) && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderBottom: `1px solid ${accent}18`,
            background: `linear-gradient(90deg, ${accent}0e 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
            {label}
          </div>
          {labelRight && (
            <div className="text-[10px]" style={{ color: `${accent}80` }}>
              {labelRight}
            </div>
          )}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [projects, inboxCount, openTickets, recentDone, totalTickets] = await Promise.all([
    prisma.project.findMany({
      where: { status: "active" },
      orderBy: { order: "asc" },
      include: {
        agendas: {
          where: { status: "active" },
          include: { _count: { select: { tickets: true } } },
        },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.inboxItem.count({ where: { status: "unread" } }),
    prisma.ticket.findMany({
      where: { status: { not: "done" } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 12,
      include: { agenda: { include: { project: true } } },
    }),
    prisma.ticket.findMany({
      where: { status: "done" },
      orderBy: { completedAt: "desc" },
      take: 5,
      include: { agenda: { include: { project: true } } },
    }),
    prisma.ticket.count(),
  ]);

  const criticalCount = openTickets.filter((t) => t.priority === 0).length;
  const highCount = openTickets.filter((t) => t.priority === 1).length;
  const doneRatio = totalTickets > 0 ? Math.round((recentDone.length / totalTickets) * 100) : 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-4">

      {/* ── COMMAND HEADER ─────────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-5 py-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(6,11,25,0.9) 50%, rgba(34,211,238,0.06) 100%)",
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "0 0 40px rgba(79,70,229,0.08)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              boxShadow: "0 0 20px rgba(99,102,241,0.5)",
            }}
          >
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1
              className="text-xl font-black tracking-tight"
              style={{
                background: "linear-gradient(90deg, #fff 60%, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MISSION CONTROL
            </h1>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: "#6366f180" }}>
              CtxDesk · Mac Studio Node · 192.0.2.10:3002
            </p>
          </div>
        </div>

        {/* Quick-action */}
        <Link href="/projects/new">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              boxShadow: "0 0 18px rgba(79,70,229,0.4)",
            }}
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white tracking-wide">NEUES PROJEKT</span>
          </div>
        </Link>
      </div>

      {/* ── STAT ROW ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: "PROJEKTE",
            value: projects.length,
            icon: FolderOpen,
            color: "#6366f1",
            sub: "aktiv",
            href: "/projects",
          },
          {
            label: "OFFEN",
            value: openTickets.length,
            icon: Clock,
            color: "#f97316",
            sub: `${criticalCount} kritisch`,
            href: "/queue",
          },
          {
            label: "KRITISCH",
            value: criticalCount,
            icon: AlertTriangle,
            color: criticalCount > 0 ? "#ef4444" : "#334155",
            sub: criticalCount > 0 ? "⚠ sofort" : "alles OK",
            href: "/queue",
            glow: criticalCount > 0,
          },
          {
            label: "ERLEDIGT",
            value: recentDone.length,
            icon: CheckCircle2,
            color: "#10b981",
            sub: "kürzlich",
            href: "/changelog",
          },
          {
            label: "INBOX",
            value: inboxCount,
            icon: Inbox,
            color: inboxCount > 0 ? "#ef4444" : "#22d3ee",
            sub: inboxCount > 0 ? "ungelesen" : "leer",
            href: "/inbox",
          },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="block">
            <div
              className="p-3.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.03] group h-full"
              style={{
                background: `linear-gradient(135deg, ${stat.color}0e 0%, rgba(8,12,28,0.9) 100%)`,
                border: `1px solid ${stat.color}${stat.glow ? "40" : "20"}`,
                boxShadow: stat.glow ? `0 0 20px ${stat.color}20` : "none",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-3.5 h-3.5 shrink-0" style={{ color: stat.color }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{stat.label}</span>
              </div>
              <div className="text-3xl font-black text-white tabular-nums leading-none mb-1">{stat.value}</div>
              <div className="text-[10px] font-mono" style={{ color: `${stat.color}90` }}>{stat.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT: Project Matrix */}
        <div className="lg:col-span-3 space-y-4">
          <Panel
            accent="#6366f1"
            label={<><Layers className="w-3.5 h-3.5" />PROJEKT MATRIX</>}
            labelRight={<Link href="/projects" className="hover:text-indigo-300 transition-colors">Alle →</Link>}
          >
            <div className="space-y-1.5">
              {projects.length === 0 && (
                <div className="text-center py-6 text-slate-600 text-xs">
                  Noch keine Projekte —{" "}
                  <Link href="/projects/new" className="text-indigo-400">erstelle dein erstes</Link>
                </div>
              )}
              {projects.map((project) => {
                const openCount = project.agendas.reduce((sum, a) => sum + a._count.tickets, 0);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div
                      className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:scale-[1.02] group"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: `1px solid ${project.color}18`,
                      }}
                    >
                      {/* Color indicator */}
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ background: project.color, boxShadow: `0 0 6px ${project.color}60` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                          {project.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">{project.agendas.length} Agenden</span>
                          <span className="text-[10px]" style={{ color: project.color + "80" }}>·</span>
                          <span className="text-[10px] text-slate-500">{project._count.tickets} Tickets</span>
                        </div>
                      </div>
                      {openCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{
                            background: `${project.color}18`,
                            color: project.color,
                            border: `1px solid ${project.color}30`,
                          }}
                        >
                          {openCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>

          {/* Progress bar panel */}
          <Panel accent="#10b981" label={<><TrendingUp className="w-3.5 h-3.5" />FORTSCHRITT</>}>
            <div className="space-y-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-mono">Abschlussrate</span>
                <span className="font-bold text-white">{doneRatio}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(doneRatio, 100)}%`,
                    background: "linear-gradient(90deg, #10b981, #34d399)",
                    boxShadow: "0 0 8px rgba(16,185,129,0.5)",
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: "Total", value: totalTickets, color: "#64748b" },
                  { label: "Offen", value: openTickets.length, color: "#f97316" },
                  { label: "Done", value: recentDone.length, color: "#10b981" },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-lg font-black" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* CENTER: Active Queue */}
        <div className="lg:col-span-6">
          <Panel
            accent="#f97316"
            label={<><Terminal className="w-3.5 h-3.5" />AKTIVE QUEUE</>}
            labelRight={<Link href="/queue" className="hover:text-orange-300 transition-colors flex items-center gap-1">Claude Queue <ArrowRight className="w-3 h-3 inline" /></Link>}
          >
            {openTickets.length === 0 ? (
              <div
                className="py-10 text-center rounded-xl"
                style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}
              >
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#10b981" }} />
                <p className="text-sm font-bold" style={{ color: "#10b981" }}>QUEUE LEER — ALLES ERLEDIGT</p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">Keine offenen Tickets</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {openTickets.map((ticket) => {
                  const pColor = PRIORITY_COLORS[ticket.priority] ?? "#64748b";
                  const isCritical = ticket.priority === 0;
                  return (
                    <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                      <div
                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 hover:scale-[1.005] group"
                        style={{
                          background: `linear-gradient(90deg, ${pColor}08 0%, rgba(255,255,255,0.02) 100%)`,
                          border: `1px solid ${pColor}${isCritical ? "35" : "15"}`,
                          boxShadow: isCritical ? `0 0 12px ${pColor}15` : "none",
                        }}
                      >
                        {/* Priority indicator */}
                        <div
                          className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                          style={{ background: pColor, boxShadow: `0 0 4px ${pColor}` }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-white flex-1">
                              {isCritical && <span className="mr-1">🔴</span>}
                              {ticket.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono" style={{ color: ticket.agenda.project.color ?? pColor, opacity: 0.8 }}>
                              {ticket.agenda.project.name}
                            </span>
                            <span className="text-[10px] text-slate-600">›</span>
                            <span className="text-[10px] text-slate-500">{ticket.agenda.name}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                            style={{
                              background: `${pColor}18`,
                              color: pColor,
                              border: `1px solid ${pColor}30`,
                            }}
                          >
                            P{ticket.priority}
                          </span>
                          <span className="text-[9px] text-slate-600 font-mono">
                            {formatDistanceToNow(new Date(ticket.createdAt), { locale: de, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT: Activity Feed */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recent completions */}
          <Panel
            accent="#22d3ee"
            label={<><Activity className="w-3.5 h-3.5" />ACTIVITY FEED</>}
            labelRight={<Link href="/changelog" className="hover:text-cyan-300 transition-colors">Log →</Link>}
          >
            {recentDone.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center font-mono">KEINE AKTIVITÄT</p>
            ) : (
              <div className="space-y-2">
                {recentDone.map((ticket) => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <div
                      className="flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-all hover:scale-[1.02] group"
                      style={{
                        background: "rgba(16,185,129,0.05)",
                        border: "1px solid rgba(16,185,129,0.12)",
                      }}
                    >
                      <GitCommit className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#10b981" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate group-hover:text-white">{ticket.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {ticket.completedAt
                            ? formatDistanceToNow(new Date(ticket.completedAt), { locale: de, addSuffix: true })
                            : "—"}
                        </p>
                      </div>
                      <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#10b98180" }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* Inbox */}
          <Panel
            accent={inboxCount > 0 ? "#ef4444" : "#334155"}
            label={<><Inbox className="w-3.5 h-3.5" />INBOX</>}
            labelRight={<Link href="/inbox" className="hover:text-red-300 transition-colors">Öffnen →</Link>}
          >
            {inboxCount === 0 ? (
              <div className="flex items-center gap-2 py-2">
                <StatusDot color="#10b981" />
                <span className="text-xs text-slate-500 font-mono">INBOX LEER</span>
              </div>
            ) : (
              <Link href="/inbox">
                <div
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    boxShadow: "0 0 14px rgba(239,68,68,0.1)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot color="#ef4444" pulse />
                    <span className="text-sm font-bold text-white">{inboxCount}</span>
                    <span className="text-xs text-slate-400">ungelesen</span>
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: "#ef4444" }} />
                </div>
              </Link>
            )}
          </Panel>

          {/* Quick nav */}
          <Panel accent="#a855f7" label={<><Circle className="w-3.5 h-3.5" />NAVIGATION</>}>
            <div className="space-y-1.5">
              {[
                { label: "Projekte", href: "/projects", color: "#6366f1" },
                { label: "Claude Queue", href: "/queue", color: "#22d3ee" },
                { label: "Kontext Editor", href: "/context", color: "#a855f7" },
                { label: "Changelog", href: "/changelog", color: "#10b981" },
              ].map((nav) => (
                <Link key={nav.href} href={nav.href}>
                  <div
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02] group"
                    style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${nav.color}15` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: nav.color }} />
                      <span className="text-xs font-medium text-slate-300 group-hover:text-white">{nav.label}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: nav.color }} />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
