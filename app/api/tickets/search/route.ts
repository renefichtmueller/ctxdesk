import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tickets/search?q=...&exclude=ticketId
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";

  if (q.length < 2) {
    return NextResponse.json({ tickets: [] });
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      title: { contains: q },
      status: { not: "done" },
      ...(exclude ? { id: { not: exclude } } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      agenda: { select: { name: true, project: { select: { name: true } } } },
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 10,
  });

  return NextResponse.json({ tickets });
}
