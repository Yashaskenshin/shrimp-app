"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function upsertProduct(payload: {
  id?: string;
  code: string;
  name: string;
  rmAvgSize?: number | null;
  stdYieldPct?: number | null;
  sizeBand?: string | null;
  category?: string | null;
  packDefault?: string | null;
  notes?: string | null;
  active?: boolean;
}) {
  const data = {
    code: payload.code.trim(),
    name: payload.name.trim(),
    rmAvgSize: payload.rmAvgSize ?? null,
    stdYieldPct: payload.stdYieldPct ?? null,
    sizeBand: payload.sizeBand ?? null,
    category: payload.category ?? null,
    packDefault: payload.packDefault ?? null,
    notes: payload.notes ?? null,
    active: payload.active ?? true,
  };
  if (payload.id) {
    await prisma.product.update({ where: { id: payload.id }, data });
  } else {
    await prisma.product.upsert({
      where: { code: data.code },
      create: data,
      update: data,
    });
  }
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await prisma.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/products");
}

export async function activateProduct(id: string, active: boolean) {
  await prisma.product.update({ where: { id }, data: { active } });
  revalidatePath("/products");
}
