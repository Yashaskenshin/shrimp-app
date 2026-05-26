"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateAssumptions(values: Record<string, number>) {
  const entries = Object.entries(values);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.assumption.update({ where: { key }, data: { value } }),
    ),
  );
  revalidatePath("/assumptions");
  revalidatePath("/");
}
