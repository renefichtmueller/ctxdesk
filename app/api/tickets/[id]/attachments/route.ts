import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown",
];

// GET /api/tickets/[id]/attachments — list all attachments (without data)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attachments = await prisma.ticketAttachment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, originalName: true, mimeType: true, size: true, createdAt: true },
  });
  return NextResponse.json(attachments);
}

// POST /api/tickets/[id]/attachments — upload file (multipart or base64)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify ticket exists
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  let filename = "";
  let originalName = "";
  let mimeType = "";
  let size = 0;
  let base64Data = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max 10MB)` }, { status: 413 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 415 });
    }

    originalName = file.name;
    mimeType = file.type;
    size = file.size;
    filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const buffer = await file.arrayBuffer();
    base64Data = Buffer.from(buffer).toString("base64");

  } else {
    // JSON with base64
    const body = await req.json();
    if (!body.data || !body.mimeType || !body.originalName) {
      return NextResponse.json({ error: "data, mimeType, originalName required" }, { status: 400 });
    }

    const rawData = body.data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(rawData, "base64");
    size = buffer.length;

    if (size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    mimeType = body.mimeType;
    originalName = body.originalName;
    filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    base64Data = rawData;
  }

  const attachment = await prisma.ticketAttachment.create({
    data: { ticketId: id, filename, originalName, mimeType, size, data: base64Data },
    select: { id: true, filename: true, originalName: true, mimeType: true, size: true, createdAt: true },
  });

  return NextResponse.json(attachment);
}
