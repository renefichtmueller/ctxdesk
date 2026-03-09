import { prisma } from "@/lib/prisma";
import { generateQueue } from "@/lib/queue-generator";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { PRIORITY_COLORS, PRIORITY_EMOJIS, PRIORITY_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Terminal, RefreshCw } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";

async function regenerateQueue() {
  "use server";
  const tickets = await prisma.ticket.findMany({
    where: { agenda: { status: "active" } },
    include: { agenda: { include: { project: true } } },
    orderBy: [{ priority: "asc" }, { order: "asc" }],
  });
  await generateQueue(tickets);
  revalidatePath("/queue");
}

export default async function QueuePage() {
  const tickets = await prisma.ticket.findMany({
    where: { status: { not: "done" } },
    orderBy: [{ priority: "asc" }, { order: "asc" }],
    include: { agenda: { include: { project: true } } },
  });

  // Group by priority
  const byPriority: Record<number, typeof tickets> = { 0: [], 1: [], 2: [], 3: [] };
  for (const t of tickets) {
    byPriority[t.priority]?.push(t);
  }

  // Read current CLAUDE_QUEUE.md
  let queueContent = "";
  const queuePath = join(process.cwd(), "CLAUDE_QUEUE.md");
  if (existsSync(queuePath)) {
    queueContent = readFileSync(queuePath, "utf-8");
  }

  const macStudioUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
  const macBookUrl   = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5" style={{ color: "#6366f1" }} />
          <h1 className="text-2xl font-bold text-white">Claude Queue</h1>
        </div>
        <form action={regenerateQueue}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Queue regenerieren
          </button>
        </form>
      </div>

      {/* Access info for Claude */}
      <div
        className="p-4 rounded-xl font-mono text-xs space-y-1"
        style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}
      >
        <p className="text-cyan-400 font-semibold text-[11px] uppercase tracking-wider mb-2">Claude Code Integration</p>
        <p className="text-slate-300">Datei: <span className="text-cyan-300">{queuePath}</span></p>
        <p className="text-slate-300">Mac Studio (Host): <span className="text-cyan-300">{macStudioUrl}</span></p>
        <p className="text-slate-300">MacBook (LAN-Zugang): <span className="text-cyan-300">{macBookUrl}</span></p>
        <p className="text-slate-500 mt-2">Füge in ~/.claude/CLAUDE.md ein: "Lies CLAUDE_QUEUE.md beim Start"</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live ticket list */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Live Tickets</h2>
          {Object.entries(byPriority).map(([pStr, items]) => {
            const p = parseInt(pStr);
            if (items.length === 0) return null;
            return (
              <div key={p} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{PRIORITY_EMOJIS[p]}</span>
                  <span className="text-xs font-semibold" style={{ color: PRIORITY_COLORS[p] }}>
                    {PRIORITY_LABELS[p]}
                  </span>
                  <div className="flex-1 h-[1px]" style={{ background: `${PRIORITY_COLORS[p]}20` }} />
                </div>
                {items.map((ticket) => (
                  <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
                    <div
                      className="p-3 rounded-lg cursor-pointer hover:scale-[1.01] transition-transform"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${PRIORITY_COLORS[p]}15` }}
                    >
                      <p className="text-sm font-medium text-slate-200">{ticket.title}</p>
                      {ticket.claudeContext && (
                        <p className="text-[10px] text-cyan-400 mt-1 font-mono truncate">{ticket.claudeContext.split("\n")[0]}</p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">
                        {ticket.agenda.project.name} → {ticket.agenda.name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
          {tickets.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm">Keine offenen Tickets!</p>
            </div>
          )}
        </div>

        {/* Raw CLAUDE_QUEUE.md preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">CLAUDE_QUEUE.md</h2>
          <pre
            className="p-4 rounded-xl text-[11px] font-mono text-slate-300 overflow-auto max-h-[600px] leading-relaxed whitespace-pre-wrap"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            {queueContent || "Noch keine Queue-Datei generiert. Erstelle ein Ticket!"}
          </pre>
        </div>
      </div>
    </div>
  );
}
