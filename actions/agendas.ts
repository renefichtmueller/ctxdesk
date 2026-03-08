"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createAgenda(projectId: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = parseInt(formData.get("priority") as string) || 2;

  if (!name) return { error: "Name erforderlich" };

  const maxOrder = await prisma.agenda.aggregate({
    where: { projectId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const agenda = await prisma.agenda.create({
    data: { name, description: description || null, priority, projectId, order },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, agendaId: agenda.id };
}

export async function updateAgenda(id: string, projectId: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priority = parseInt(formData.get("priority") as string);

  if (!name) return { error: "Name erforderlich" };

  await prisma.agenda.update({
    where: { id },
    data: { name, description: description || null, priority },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function completeAgenda(id: string, projectId: string) {
  const agenda = await prisma.agenda.update({
    where: { id },
    data: { status: "completed" },
    include: { tickets: true },
  });

  // Auto changelog entry for agenda completion
  await prisma.changelogEntry.create({
    data: {
      agendaId: id,
      content: `## Agenda abgeschlossen: ${agenda.name}\n\n${agenda.tickets.length} Ticket(s) bearbeitet.`,
      type: "agenda_completed",
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/changelog");
  return { success: true };
}

export async function deleteAgenda(id: string, projectId: string) {
  await prisma.agenda.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
