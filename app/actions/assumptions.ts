"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateAssumptions(values: Record<string, number>) {
  const entries = Object.entries(values).filter(([, v]) => Number.isFinite(v));
  if (entries.length === 0) return;
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.assumption.update({ where: { key }, data: { value } }),
    ),
  );
  revalidatePath("/assumptions");
  revalidatePath("/");
}
