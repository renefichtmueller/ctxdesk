import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects — list all projects
export async function GET(_req: NextRequest) {
  const projects = await prisma.project.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { agendas: true, tickets: true } },
    },
  });
  return NextResponse.json(projects);
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, color, icon } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const maxOrder = await prisma.project.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#6366f1",
      icon: icon || "folder",
      order,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
