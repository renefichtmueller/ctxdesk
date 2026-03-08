"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateQueue } from "@/lib/queue-generator";

async function refreshQueue() {
  const tickets = await prisma.ticket.findMany({
    where: { agenda: { status: "active" } },
    include: { agenda: { include: { project: true } } },
    orderBy: [{ priority: "asc" }, { order: "asc" }],
  });
  // Fire and forget
  generateQueue(tickets).catch(console.error);
}

export async function createTicket(agendaId: string, formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const claudeContext = (formData.get("claudeContext") as string)?.trim();
  const priority = parseInt(formData.get("priority") as string) || 2;
  const type = (formData.get("type") as string) || "task";

  if (!title) return { error: "Titel erforderlich" };

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
      claudeContext: claudeContext || null,
      priority,
      type,
      agendaId,
      projectId: agenda.projectId,
      order,
      status: "todo",
    },
  });

  revalidatePath(`/projects/${agenda.projectId}/agendas/${agendaId}`);
  revalidatePath("/queue");
  await refreshQueue();
  return { success: true, ticketId: ticket.id };
}

export async function updateTicket(id: string, formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const claudeContext = (formData.get("claudeContext") as string)?.trim();
  const priority = parseInt(formData.get("priority") as string);
  const type = formData.get("type") as string;

  if (!title) return { error: "Titel erforderlich" };

  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      title,
      description: description || null,
      claudeContext: claudeContext || null,
      priority: isNaN(priority) ? 2 : priority,
      type: type || "task",
    },
    include: { agenda: true },
  });

  revalidatePath(`/tickets/${id}`);
  revalidatePath(`/projects/${ticket.agenda.projectId}/agendas/${ticket.agendaId}`);
  revalidatePath("/queue");
  await refreshQueue();
  return { success: true };
}

export async function updateTicketStatus(id: string, newStatus: string): Promise<{ error: string } | { success: boolean }> {
  let ticket;
  try {
    ticket = await prisma.ticket.update({
    where: { id },
    data: {
      status: newStatus,
      completedAt: newStatus === "done" ? new Date() : null,
    },
      include: { agenda: { include: { project: true } } },
    });
  } catch {
    return { error: "Status konnte nicht aktualisiert werden" };
  }

  // Auto changelog when done
  if (newStatus === "done") {
    const existing = await prisma.changelogEntry.findUnique({
      where: { ticketId: id },
    });
    if (!existing) {
      await prisma.changelogEntry.create({
        data: {
          agendaId: ticket.agendaId,
          ticketId: id,
          content: `## ✅ ${ticket.title}\n\n**Typ:** ${ticket.type} · **Priorität:** P${ticket.priority}\n\n${ticket.description ? ticket.description + "\n\n" : ""}*Abgeschlossen in: ${ticket.agenda.name} (${ticket.agenda.project.name})*`,
          type: "ticket_completed",
        },
      });
    }
  }

  revalidatePath(`/projects/${ticket.agenda.projectId}/agendas/${ticket.agendaId}`);
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/changelog");
  revalidatePath("/queue");
  await refreshQueue();
  return { success: true };
}

export async function deleteTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { agenda: true },
  });
  if (!ticket) return { error: "Ticket nicht gefunden" };

  await prisma.ticket.delete({ where: { id } });
  revalidatePath(`/projects/${ticket.agenda.projectId}/agendas/${ticket.agendaId}`);
  revalidatePath("/queue");
  await refreshQueue();
  return { success: true };
}
