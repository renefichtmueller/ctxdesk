import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/tickets/progress
// Body: { ticketId, message, level?, aiAssignee?, status? }
// status: "done"        → marks ticket completed + deactivates (isActivated=false)
// status: "in_progress" → sets in_progress flag
// (omit status)         → only logs progress message, no status change
// Used by Claude Code (scheduled task) to post progress updates

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ticketId, message, level = "info", aiAssignee, status } = body;

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
  } catch { /* ignore */ }

  // Add new entry
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  entries.push({ ts, msg: message });

  // Keep last 20 entries
  if (entries.length > 20) entries = entries.slice(-20);

  // Build update payload — status "done" completes + deactivates ticket
  const isDone = status === "done";
  const updateData: Record<string, unknown> = {
    progressLog: JSON.stringify(entries),
    ...(aiAssignee ? { aiAssignee } : {}),
  };
  if (isDone) {
    updateData.status = "done";
    updateData.isActivated = false;
    updateData.completedAt = now;
  } else if (status === "in_progress") {
    updateData.status = "in_progress";
  }

  // Update ticket
  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
  });

  // Write to LiveLog
  await prisma.liveLog.create({
    data: {
      level: isDone ? "success" : level,
      category: "progress",
      message: `[${aiAssignee ?? "claude"}] ${ticket.title}: ${message}${isDone ? " ✅" : ""}`,
      ticketId,
      projectId: ticket.projectId,
    },
  });

  return NextResponse.json({
    ok: true,
    entries: JSON.parse(updated.progressLog ?? "[]"),
    ...(isDone ? { completed: true, deactivated: true } : {}),
  });
}
