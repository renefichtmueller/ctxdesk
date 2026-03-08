"use server";

import { prisma } from "@/lib/prisma";
import { moveToProcessed } from "@/lib/inbox-watcher";
import { generateQueue } from "@/lib/queue-generator";
import { revalidatePath } from "next/cache";

async function refreshQueue() {
  const tickets = await prisma.ticket.findMany({
    where: { agenda: { status: "active" } },
    include: { agenda: { include: { project: true } } },
    orderBy: [{ priority: "asc" }, { order: "asc" }],
  });
  generateQueue(tickets).catch(console.error);
}

export async function importInboxItem(
  inboxItemId: string,
  agendaId: string,
  title: string,
  description: string,
  priority: number,
  type: string
) {
  const inboxItem = await prisma.inboxItem.findUnique({ where: { id: inboxItemId } });
  if (!inboxItem) return { error: "Inbox-Item nicht gefunden" };

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId } });
  if (!agenda) return { error: "Agenda nicht gefunden" };

  const maxOrder = await prisma.ticket.aggregate({
    where: { agendaId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description: description || null,
      priority,
      type,
      agendaId,
      projectId: agenda.projectId,
      order,
      status: "todo",
      inboxItemId,
    },
  });

  await prisma.inboxItem.update({
    where: { id: inboxItemId },
    data: { status: "imported" },
  });

  // Move file to processed/
  await moveToProcessed(inboxItem.filename);

  // Queue neu generieren (fire & forget)
  refreshQueue();

  revalidatePath("/inbox");
  revalidatePath(`/projects/${agenda.projectId}/agendas/${agendaId}`);
  return { success: true, ticketId: ticket.id };
}

export async function dismissInboxItem(id: string) {
  const item = await prisma.inboxItem.findUnique({ where: { id } });
  if (!item) return { error: "Nicht gefunden" };

  await prisma.inboxItem.update({
    where: { id },
    data: { status: "dismissed" },
  });

  await moveToProcessed(item.filename);
  revalidatePath("/inbox");
  return { success: true };
}
