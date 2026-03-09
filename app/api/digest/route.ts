import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat, getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL } from "@/lib/llm-client";

// GET /api/digest — get latest digest or generate new one
// POST /api/digest — generate digest (with optional model override)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Fetch all active tickets
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["todo", "in_progress", "in_review"] },
      agenda: { status: "active" },
    },
    include: {
      agenda: { include: { project: true } },
      timeEntries: {
        where: { endedAt: { not: null } },
        orderBy: { startedAt: "desc" as const },
        take: 3,
      },
    },
    orderBy: [{ priority: "asc" }, { status: "asc" }],
  });

  if (tickets.length === 0) {
    return NextResponse.json({ digest: "Keine aktiven Tickets vorhanden.", ticketCount: 0, model: null });
  }

  // Group by project
  const byProject: Record<string, { projectName: string; tickets: typeof tickets }> = {};
  for (const t of tickets) {
    const pName = t.agenda?.project?.name ?? "Unbekannt";
    if (!byProject[pName]) byProject[pName] = { projectName: pName, tickets: [] };
    byProject[pName].tickets.push(t);
  }

  // Build prompt
  const statusEmoji: Record<string, string> = {
    todo: "📋", in_progress: "🔄", in_review: "👁️",
  };
  const prioEmoji = ["🔴", "🟠", "🟡", "🔵"];

  let ticketList = "";
  for (const [, { projectName, tickets: pts }] of Object.entries(byProject)) {
    ticketList += `\n### Projekt: ${projectName}\n`;
    for (const t of pts) {
      const totalMin = t.timeEntries.reduce((s: number, e: { endedAt: Date | null; startedAt: Date }) => s + Math.floor((e.endedAt!.getTime() - e.startedAt.getTime()) / 60000), 0);
      ticketList += `- ${statusEmoji[t.status] ?? "❓"} ${prioEmoji[t.priority] ?? "⚪"} [${t.agenda?.name}] ${t.title}`;
      if (totalMin > 0) ticketList += ` (⏱ ${totalMin}min heute)`;
      if (t.progressLog) {
        const lastLine = t.progressLog.split("\n").filter(Boolean).slice(-1)[0];
        if (lastLine) ticketList += `\n  → ${lastLine.replace(/^\[.*?\]\s*/, "").slice(0, 120)}`;
      }
      ticketList += "\n";
    }
  }

  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const inReviewCount = tickets.filter((t) => t.status === "in_review").length;
  const todoCount = tickets.filter((t) => t.status === "todo").length;
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const prompt = `Du bist der KI-Assistent von CtxDesk (Projektmanagement-Tool).
Erstelle einen knappen Morning-Briefing-Digest für ${today}.

Ticket-Übersicht (${tickets.length} aktive Tickets: ${inProgressCount} in Bearbeitung, ${inReviewCount} in Review, ${todoCount} offen):
${ticketList}

Erstelle einen strukturierten Briefing-Text mit:
1. **Zusammenfassung** (2-3 Sätze): Was läuft aktuell, wo stehen wir?
2. **Prioritäten heute** (max. 3 Punkte): Was sollte heute unbedingt erledigt werden?
3. **Blocker / Risiken** (falls vorhanden): Was könnte den Fortschritt behindern?
4. **Empfehlung**: Womit anfangen?

Stil: Direkt, professionell, auf Deutsch. Maximal 250 Wörter.`;

  // Pick model
  let provider: "ollama" | "lmstudio" = body.provider ?? "ollama";
  let model: string = body.model ?? "";

  if (!model) {
    const models = await getAllModels(DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL);
    const all = models.all;
    // Prefer a known chat model
    const preferred = ["ctxchat", "qwen2.5:7b", "llama3.2:latest", "mistral:7b"];
    for (const pref of preferred) {
      const found = all.find((m) => m.id.includes(pref.split(":")[0]));
      if (found) { model = found.id; provider = found.provider; break; }
    }
    if (!model && all.length > 0) {
      model = all[0].id;
      provider = all[0].provider;
    }
  }

  if (!model) {
    return NextResponse.json(
      { error: "Kein LLM verfügbar. Ollama oder LM Studio starten.", ticketCount: tickets.length },
      { status: 503 }
    );
  }

  try {
    const response = await chat({
      provider,
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      maxTokens: 600,
    });

    return NextResponse.json({
      digest: response.content,
      ticketCount: tickets.length,
      inProgress: inProgressCount,
      inReview: inReviewCount,
      todo: todoCount,
      model,
      provider,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `LLM-Fehler: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

// GET — status check (no generation)
export async function GET() {
  const counts = await prisma.ticket.groupBy({
    by: ["status"],
    where: { status: { in: ["todo", "in_progress", "in_review"] }, agenda: { status: "active" } },
    _count: true,
  });
  const total = counts.reduce((s, c) => s + c._count, 0);
  return NextResponse.json({ total, counts });
}
