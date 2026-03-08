import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — download/view attachment
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const attachment = await prisma.ticketAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(attachment.data, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.originalName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

// DELETE — remove attachment
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { attachmentId } = await params;
  await prisma.ticketAttachment.delete({ where: { id: attachmentId } });
  return NextResponse.json({ success: true });
}
