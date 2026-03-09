import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tickets/[id]/time — list time entries + total
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entries = await prisma.timeEntry.findMany({
    where: { ticketId: id },
    orderBy: { startedAt: "desc" },
  });

  // Total seconds
  let totalSeconds = 0;
  for (const e of entries) {
    const end = e.endedAt ?? new Date();
    totalSeconds += Math.floor((end.getTime() - e.startedAt.getTime()) / 1000);
  }

  const active = entries.find((e) => !e.endedAt) ?? null;

  return NextResponse.json({ entries, totalSeconds, active });
}

// POST /api/tickets/[id]/time — start or stop
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action: "start" | "stop" = body.action ?? "start";

  if (action === "start") {
    // Stop any existing open entry first
    const open = await prisma.timeEntry.findFirst({
      where: { ticketId: id, endedAt: null },
    });
    if (open) {
      await prisma.timeEntry.update({
        where: { id: open.id },
        data: { endedAt: new Date() },
      });
    }

    const entry = await prisma.timeEntry.create({
      data: { ticketId: id, note: body.note ?? null },
    });
    return NextResponse.json({ entry, running: true });
  }

  // Stop
  const open = await prisma.timeEntry.findFirst({
    where: { ticketId: id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!open) {
    return NextResponse.json({ error: "Kein aktiver Timer" }, { status: 400 });
  }
  const updated = await prisma.timeEntry.update({
    where: { id: open.id },
    data: { endedAt: new Date(), note: body.note ?? open.note },
  });
  return NextResponse.json({ entry: updated, running: false });
}

// DELETE /api/tickets/[id]/time?entryId=xxx — delete a time entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryId = req.nextUrl.searchParams.get("entryId");
  if (!entryId) {
    return NextResponse.json({ error: "entryId fehlt" }, { status: 400 });
  }
  const entry = await prisma.timeEntry.findFirst({ where: { id: entryId, ticketId: id } });
  if (!entry) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  await prisma.timeEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
