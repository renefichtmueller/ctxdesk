import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/agendas?projectId=X — list agendas for a project
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const agendas = await prisma.agenda.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return NextResponse.json(agendas);
}

// POST /api/agendas — create a new agenda
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, name, description, priority } = body;

  if (!projectId || !name?.trim()) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const maxOrder = await prisma.agenda.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const agenda = await prisma.agenda.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      priority: priority ?? 2,
      projectId,
      order,
    },
  });

  return NextResponse.json(agenda, { status: 201 });
}
