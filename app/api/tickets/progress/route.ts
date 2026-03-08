import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/tickets/progress
// Body: { ticketId, message, level?, aiAssignee? }
// Used by Claude Code (via inbox or direct API) to post progress updates

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticketId, message, level = "info", aiAssignee } = body;

  if (!ticketId || !message) {
    return NextResponse.json({ error: "ticketId and message required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Parse existing log
  let entries: { ts: string; msg: string }[] = [];
  try {
    if (ticket.progressLog) entries = JSON.parse(ticket.progressLog);
  } catch {}

  // Add new entry
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  entries.push({ ts, msg: message });

  // Keep last 20 entries
  if (entries.length > 20) entries = entries.slice(-20);

  // Update ticket
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      progressLog: JSON.stringify(entries),
      ...(aiAssignee ? { aiAssignee } : {}),
    },
  });

  // Write to LiveLog
  await prisma.liveLog.create({
    data: {
      level,
      category: "progress",
      message: `[${aiAssignee || "claude"}] ${ticket.title}: ${message}`,
      ticketId,
      projectId: ticket.projectId,
    },
  });

  return NextResponse.json({ ok: true, entries: JSON.parse(updated.progressLog || "[]") });
}
