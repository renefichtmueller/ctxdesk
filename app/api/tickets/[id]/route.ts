import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      agenda: { include: { project: true } },
      changelogEntry: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "title", "description", "claudeContext", "status", "priority",
    "type", "order", "isActivated", "activatedAt", "progressLog",
    "aiAssignee", "completedAt",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      data[key] = body[key];
    }
  }

  // Auto-set activatedAt when activating
  if (data.isActivated === true && !("activatedAt" in body)) {
    data.activatedAt = new Date().toISOString();
  }
  if (data.isActivated === false) {
    data.activatedAt = null;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      agenda: { include: { project: true } },
    },
  });

  // Write to LiveLog
  if ("isActivated" in body) {
    try {
      await prisma.liveLog.create({
        data: {
          level: body.isActivated ? "info" : "warn",
          category: "activation",
          message: body.isActivated
            ? `✅ Aktiviert: "${ticket.title}"`
            : `⏸ Deaktiviert: "${ticket.title}"`,
          ticketId: id,
          projectId: ticket.projectId,
          metadata: JSON.stringify({ project: (ticket.agenda as { project?: { name: string } })?.project?.name }),
        },
      });
    } catch {}
  }

  // Regenerate queue when activation or status changes
  if ("isActivated" in body || "status" in body) {
    try {
      const { generateQueue } = await import("@/lib/queue-generator");
      await generateQueue();
    } catch {}
  }

  return NextResponse.json(ticket);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.ticket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
