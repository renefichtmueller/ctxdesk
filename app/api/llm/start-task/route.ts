import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat, getAllModels, DEFAULT_OLLAMA_URL, DEFAULT_LM_STUDIO_URL, SYSTEM_PROMPTS } from "@/lib/llm-client";

/**
 * POST /api/llm/start-task
 * 1. Moves ticket to "in_progress"
 * 2. Sets isActivated = true
 * 3. Gets LLM to analyze the task and generate a kickoff plan
 * 4. Saves the plan as progressLog + LiveLog
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    ticketId,
    ollamaUrl = DEFAULT_OLLAMA_URL,
    lmStudioUrl = DEFAULT_LM_STUDIO_URL,
  } = body;

  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  // Load ticket
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { agenda: { include: { project: true } } },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Move to in_progress + activate
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "in_progress",
      isActivated: true,
      activatedAt: new Date().toISOString(),
    },
  });

  // Log to LiveLog
  await prisma.liveLog.create({
    data: {
      level: "info",
      category: "activation",
      message: `Task gestartet: ${ticket.title}`,
      ticketId,
      projectId: ticket.agenda?.project?.id,
    },
  });

  // Try to get AI analysis (non-blocking if LLM offline)
  let aiAnalysis = "";
  let modelUsed = "";

  try {
    const models = await getAllModels(ollamaUrl, lmStudioUrl);
    if (models.all.length > 0) {
      // Pick best model for task analysis
      const preferred = ["ctxchat", "qwen2.5:7b-instruct", "qwen2.5:7b", "llama3.2:latest", "mistral:7b"];
      let bestModel = models.all[0];
      for (const id of preferred) {
        const found = models.all.find(m => m.id === id || m.id.startsWith(id.split(":")[0]));
        if (found) { bestModel = found; break; }
      }

      const context = [
        `Projekt: ${ticket.agenda?.project?.name || "Unbekannt"}`,
        `Agenda: ${ticket.agenda?.name || "Unbekannt"}`,
        `Typ: ${ticket.type}`,
        `Priorität: P${ticket.priority}`,
        `Status: Wird gestartet`,
        ticket.description ? `Beschreibung: ${ticket.description}` : "",
        ticket.claudeContext ? `Kontext: ${ticket.claudeContext}` : "",
      ].filter(Boolean).join("\n");

      const response = await chat({
        provider: bestModel.provider,
        model: bestModel.id,
        messages: [
          {
            role: "user" as const,
            content: `Task: "${ticket.title}"\n\n${context}\n\nBitte analysiere diesen Task kurz und schlage die nächsten konkreten Schritte vor.`,
          },
        ],
        temperature: 0.5,
        maxTokens: 512,
        ollamaUrl,
        lmStudioUrl,
        systemPrompt: SYSTEM_PROMPTS.taskAnalysis,
      } as Parameters<typeof chat>[0] & { systemPrompt?: string });

      aiAnalysis = response.content;
      modelUsed = bestModel.id;
    }
  } catch {
    // LLM offline — continue without analysis
    aiAnalysis = "Task gestartet. LLM-Analyse nicht verfügbar (Ollama/LM Studio offline).";
  }

  // Save AI analysis to progressLog
  const progressEntry = {
    ts: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    msg: aiAnalysis || "Task in Bearbeitung...",
    ai: modelUsed || "system",
  };

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      progressLog: JSON.stringify([progressEntry]),
      aiAssignee: modelUsed ? "ollama" : undefined,
    },
  });

  // Log AI analysis to LiveLog
  if (aiAnalysis) {
    await prisma.liveLog.create({
      data: {
        level: "info",
        category: "progress",
        message: `KI-Analyse: ${aiAnalysis.substring(0, 200)}...`,
        ticketId,
        projectId: ticket.agenda?.project?.id,
        metadata: JSON.stringify({ model: modelUsed, fullAnalysis: aiAnalysis }),
      },
    });
  }

  return NextResponse.json({
    success: true,
    status: "in_progress",
    isActivated: true,
    aiAnalysis,
    modelUsed,
    progressEntry,
  });
}
