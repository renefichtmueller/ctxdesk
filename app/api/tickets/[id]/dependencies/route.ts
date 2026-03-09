import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tickets/[id]/dependencies — list blockers and dependents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [blockers, blocking] = await Promise.all([
    // Tickets this ticket depends on (= is blocked by)
    prisma.ticketDependency.findMany({
      where: { ticketId: id },
      include: {
        dependsOn: {
          select: {
            id: true, title: true, status: true, priority: true,
            agenda: { select: { name: true, project: { select: { name: true } } } },
          },
        },
      },
    }),
    // Tickets that depend on this ticket (= this ticket blocks them)
    prisma.ticketDependency.findMany({
      where: { dependsOnId: id },
      include: {
        ticket: {
          select: {
            id: true, title: true, status: true, priority: true,
            agenda: { select: { name: true, project: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    blockers: blockers.map((d) => ({ depId: d.id, ...d.dependsOn })),
    blocking: blocking.map((d) => ({ depId: d.id, ...d.ticket })),
  });
}

// POST /api/tickets/[id]/dependencies — add dependency (this ticket depends on dependsOnId)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { dependsOnId } = body;

  if (!dependsOnId) {
    return NextResponse.json({ error: "dependsOnId fehlt" }, { status: 400 });
  }
  if (dependsOnId === id) {
    return NextResponse.json({ error: "Ein Ticket kann nicht von sich selbst abhängen" }, { status: 400 });
  }

  // Check for circular dependency (A→B and B→A)
  const reverse = await prisma.ticketDependency.findFirst({
    where: { ticketId: dependsOnId, dependsOnId: id },
  });
  if (reverse) {
    return NextResponse.json({ error: "Zirkuläre Abhängigkeit: dieses Ticket wird bereits von dem anderen blockiert" }, { status: 400 });
  }

  try {
    const dep = await prisma.ticketDependency.create({
      data: { ticketId: id, dependsOnId },
    });
    return NextResponse.json({ dep });
  } catch {
    return NextResponse.json({ error: "Abhängigkeit existiert bereits" }, { status: 409 });
  }
}

// DELETE /api/tickets/[id]/dependencies?depId=xxx — remove dependency
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const depId = req.nextUrl.searchParams.get("depId");
  if (!depId) {
    return NextResponse.json({ error: "depId fehlt" }, { status: 400 });
  }

  const dep = await prisma.ticketDependency.findFirst({
    where: { id: depId, ticketId: id },
  });
  if (!dep) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.ticketDependency.delete({ where: { id: depId } });
  return NextResponse.json({ ok: true });
}
