import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tickets?status=X&agendaId=Y&projectId=Z
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const agendaId = searchParams.get("agendaId");
  const projectId = searchParams.get("projectId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (agendaId) where.agendaId = agendaId;
  if (projectId) where.projectId = projectId;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ priority: "desc" }, { order: "asc" }],
    include: {
      agenda: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  return NextResponse.json(tickets);
}

// POST /api/tickets — create a new ticket
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, claudeContext, agendaId, projectId, priority, status, type } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!agendaId) {
    return NextResponse.json({ error: "agendaId is required" }, { status: 400 });
  }

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId } });
  if (!agenda) {
    return NextResponse.json({ error: "Agenda not found" }, { status: 404 });
  }

  const resolvedProjectId = projectId || agenda.projectId;

  const maxOrder = await prisma.ticket.aggregate({
    where: { agendaId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const ticket = await prisma.ticket.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      claudeContext: claudeContext?.trim() || null,
      priority: priority ?? 2,
      type: type || "task",
      status: status || "todo",
      agendaId,
      projectId: resolvedProjectId,
      order,
    },
    include: {
      agenda: { include: { project: true } },
    },
  });

  // Trigger queue regeneration
  try {
    const { generateQueue } = await import("@/lib/queue-generator");
    await generateQueue();
  } catch { /* ignore */ }

  return NextResponse.json(ticket, { status: 201 });
}
