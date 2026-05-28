"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addPlant(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name required" };
  try {
    await prisma.plant.create({ data: { name: trimmed } });
  } catch {
    return { ok: false as const, error: "Plant already exists" };
  }
  revalidatePath("/assumptions");
  revalidatePath("/quotes");
  return { ok: true as const };
}

export async function renamePlant(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "Name required" };
  try {
    await prisma.plant.update({ where: { id }, data: { name: trimmed } });
  } catch {
    return { ok: false as const, error: "Name conflicts with another plant" };
  }
  revalidatePath("/assumptions");
  revalidatePath("/quotes");
  return { ok: true as const };
}

export async function togglePlantActive(id: string, active: boolean) {
  await prisma.plant.update({ where: { id }, data: { active } });
  revalidatePath("/assumptions");
  revalidatePath("/quotes");
}

export async function deletePlant(id: string) {
  await prisma.plant.delete({ where: { id } });
  revalidatePath("/assumptions");
  revalidatePath("/quotes");
}
