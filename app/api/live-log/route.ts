import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const category = searchParams.get("category") || undefined;
  const since = searchParams.get("since") || undefined;

  const logs = await prisma.liveLog.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(logs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { level = "info", category = "system", message, ticketId, projectId, metadata } = body;

  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const log = await prisma.liveLog.create({
    data: {
      level,
      category,
      message,
      ticketId: ticketId || null,
      projectId: projectId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return NextResponse.json(log);
}
