"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProject(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const color = (formData.get("color") as string) || "#6366f1";
  const icon = (formData.get("icon") as string) || "folder";

  if (!name) return { error: "Name erforderlich" };

  const maxOrder = await prisma.project.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const project = await prisma.project.create({
    data: { name, description: description || null, color, icon, order },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  return { success: true, projectId: project.id };
}

export async function updateProject(id: string, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const color = formData.get("color") as string;
  const icon = formData.get("icon") as string;

  if (!name) return { error: "Name erforderlich" };

  await prisma.project.update({
    where: { id },
    data: { name, description: description || null, color, icon },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true };
}

export async function archiveProject(id: string) {
  await prisma.project.update({
    where: { id },
    data: { status: "archived" },
  });
  revalidatePath("/");
  revalidatePath("/projects");
  return { success: true };
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/projects");
  return { success: true };
}
