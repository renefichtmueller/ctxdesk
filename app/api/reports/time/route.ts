import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/reports/time?format=csv|json&from=ISO&to=ISO
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const format = searchParams.get("format") ?? "json";
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;

  const entries = await prisma.timeEntry.findMany({
    where: {
      ...(from || to
        ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      endedAt: { not: null },
    },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
          type: true,
          agenda: { select: { name: true, project: { select: { name: true } } } },
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  // Also include currently running entries
  const running = await prisma.timeEntry.findMany({
    where: { endedAt: null },
    include: {
      ticket: {
        select: {
          id: true, title: true, status: true, type: true,
          agenda: { select: { name: true, project: { select: { name: true } } } },
        },
      },
    },
  });

  const all = [
    ...entries.map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      ticketTitle: e.ticket.title,
      project: e.ticket.agenda?.project?.name ?? "",
      agenda: e.ticket.agenda?.name ?? "",
      status: e.ticket.status,
      type: e.ticket.type,
      startedAt: e.startedAt.toISOString(),
      endedAt: e.endedAt!.toISOString(),
      durationMinutes: Math.round((e.endedAt!.getTime() - e.startedAt.getTime()) / 60000),
      note: e.note ?? "",
    })),
    ...running.map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      ticketTitle: e.ticket.title,
      project: e.ticket.agenda?.project?.name ?? "",
      agenda: e.ticket.agenda?.name ?? "",
      status: e.ticket.status,
      type: e.ticket.type,
      startedAt: e.startedAt.toISOString(),
      endedAt: "— läuft —",
      durationMinutes: Math.round((Date.now() - e.startedAt.getTime()) / 60000),
      note: e.note ?? "",
    })),
  ];

  if (format === "csv") {
    const headers = ["ID", "Ticket-ID", "Ticket", "Projekt", "Agenda", "Status", "Typ", "Start", "Ende", "Dauer (Min)", "Notiz"];
    const rows = all.map((e) => [
      e.id, e.ticketId,
      `"${e.ticketTitle.replace(/"/g, '""')}"`,
      `"${e.project.replace(/"/g, '""')}"`,
      `"${e.agenda.replace(/"/g, '""')}"`,
      e.status, e.type, e.startedAt, e.endedAt, e.durationMinutes,
      `"${e.note.replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `ctxdesk-time-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // JSON: also aggregate per ticket
  const byTicket: Record<string, { title: string; project: string; totalMinutes: number; entries: number }> = {};
  for (const e of all) {
    if (!byTicket[e.ticketId]) {
      byTicket[e.ticketId] = { title: e.ticketTitle, project: e.project, totalMinutes: 0, entries: 0 };
    }
    byTicket[e.ticketId].totalMinutes += e.durationMinutes;
    byTicket[e.ticketId].entries += 1;
  }

  const totalMinutes = all.reduce((sum, e) => sum + e.durationMinutes, 0);

  return NextResponse.json({ entries: all, byTicket, totalMinutes, totalHours: (totalMinutes / 60).toFixed(1) });
}
