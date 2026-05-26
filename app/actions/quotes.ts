"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeQuote } from "@/lib/calc";
import { loadAssumptions } from "@/lib/assumptions";
import { parseCustomCosts, type CustomCostRow } from "@/lib/customCosts";
import { buildQuoteComputeInput } from "@/lib/quoteCompute";

export async function createQuote(formData: FormData) {
  const poNo = (formData.get("poNo") as string)?.trim() || null;
  const customer = (formData.get("customer") as string)?.trim() || null;
  const fxRate = Number(formData.get("fxRate") || 83);

  const q = await prisma.quote.create({
    data: {
      poNo,
      customer,
      fxRate,
    },
  });
  await prisma.quoteEvent.create({
    data: { quoteId: q.id, action: "CREATED" },
  });
  redirect(`/quotes/${q.id}`);
}

export interface SaveLine {
  lineNo: number;
  productCode?: string | null;
  productName?: string | null;
  sizeBand?: string | null;
  pack?: string | null;
  weightKg: number;
  usdPerKg: number;
  stockFgKg?: number | null;
  rmPriceRs?: number | null;
  yieldPctOverride?: number | null;
  avgSizeOverride?: number | null;
  packagingRs?: number | null;
  additiveRs?: number | null;
  processingChargeRs?: number | null;
  commissionRs?: number | null;
  exportShipmentRs?: number | null;
  ddpRs?: number | null;
  stockCostRs?: number | null;
}

export interface SaveQuotePayload {
  id: string;
  poNo?: string | null;
  contractDate?: string | null;
  revisedDate?: string | null;
  customer?: string | null;
  country?: string | null;
  incoterm?: string | null;
  payment?: string | null;
  plant?: string | null;
  freezeType?: string | null;
  commissionOverridePerKg?: number | null;
  processingChargeWithGst?: boolean | null;
  portLoading?: string | null;
  portLoadingDate?: string | null;
  portDestination?: string | null;
  portDestDate?: string | null;
  fxRate: number;
  notes?: string | null;
  preparedBy?: string | null;
  verifiedBy?: string | null;
  approvedBy?: string | null;
  lines: SaveLine[];
  customVariableCosts?: CustomCostRow[];
  customFixedCosts?: CustomCostRow[];
}

export async function saveQuote(payload: SaveQuotePayload) {
  const { id, lines, customVariableCosts, customFixedCosts, ...rest } = payload;

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id },
      data: {
        poNo: rest.poNo ?? null,
        contractDate: rest.contractDate ? new Date(rest.contractDate) : null,
        revisedDate: rest.revisedDate ? new Date(rest.revisedDate) : null,
        customer: rest.customer ?? null,
        country: rest.country ?? null,
        incoterm: rest.incoterm ?? null,
        payment: rest.payment ?? null,
        plant: rest.plant ?? null,
        freezeType: rest.freezeType ?? null,
        commissionOverridePerKg: rest.commissionOverridePerKg ?? null,
        processingChargeWithGst: rest.processingChargeWithGst ?? false,
        portLoading: rest.portLoading ?? null,
        portLoadingDate: rest.portLoadingDate ? new Date(rest.portLoadingDate) : null,
        portDestination: rest.portDestination ?? null,
        portDestDate: rest.portDestDate ? new Date(rest.portDestDate) : null,
        fxRate: rest.fxRate,
        notes: rest.notes ?? null,
        preparedBy: rest.preparedBy ?? null,
        verifiedBy: rest.verifiedBy ?? null,
        approvedBy: rest.approvedBy ?? null,
        customVariableCosts: (customVariableCosts ?? []) as unknown as Prisma.InputJsonValue,
        customFixedCosts: (customFixedCosts ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    // Replace all lines (simpler than diffing for now)
    await tx.quoteLine.deleteMany({ where: { quoteId: id } });
    for (const l of lines) {
      // Match product by code if present, snapshot name/sizeBand
      let productId: string | undefined;
      let productName = l.productName ?? "";
      let sizeBand = l.sizeBand ?? null;
      if (l.productCode) {
        const p = await tx.product.findUnique({ where: { code: l.productCode } });
        if (p) {
          productId = p.id;
          if (!productName) productName = p.name;
          if (!sizeBand) sizeBand = p.sizeBand;
        }
      }
      await tx.quoteLine.create({
        data: {
          quoteId: id,
          lineNo: l.lineNo,
          productCode: l.productCode ?? null,
          productId: productId ?? null,
          productName,
          sizeBand,
          pack: l.pack ?? null,
          weightKg: l.weightKg ?? 0,
          usdPerKg: l.usdPerKg ?? 0,
          stockFgKg: l.stockFgKg ?? 0,
          rmPriceRs: l.rmPriceRs ?? null,
          yieldPctOverride: l.yieldPctOverride ?? null,
          avgSizeOverride: l.avgSizeOverride ?? null,
          packagingRs: l.packagingRs ?? null,
          additiveRs: l.additiveRs ?? null,
          processingChargeRs: l.processingChargeRs ?? null,
          commissionRs: l.commissionRs ?? null,
          exportShipmentRs: l.exportShipmentRs ?? null,
          ddpRs: l.ddpRs ?? null,
          stockCostRs: l.stockCostRs ?? null,
        },
      });
    }

    await tx.quoteEvent.create({
      data: { quoteId: id, action: "EDITED" },
    });
  });

  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteQuote(id: string) {
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/quotes");
  redirect("/quotes");
}

export type QuoteAction = "SUBMIT" | "VERIFY" | "APPROVE" | "REJECT" | "REVERT_DRAFT";

export async function transitionQuote(id: string, action: QuoteAction, comment?: string) {
  const q = await prisma.quote.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });

  let nextStatus = q.status;
  let event = action;
  if (action === "SUBMIT") nextStatus = "SUBMITTED";
  if (action === "VERIFY") nextStatus = "VERIFIED";
  if (action === "APPROVE") nextStatus = "APPROVED";
  if (action === "REJECT") nextStatus = "REJECTED";
  if (action === "REVERT_DRAFT") nextStatus = "DRAFT";

  await prisma.quote.update({
    where: { id },
    data: { status: nextStatus },
  });

  await prisma.quoteEvent.create({
    data: { quoteId: id, action: event, comment: comment ?? null },
  });

  // On APPROVE: snapshot everything so future config changes don't drift the quote.
  if (action === "APPROVE") {
    const [baseAssumptions, pcRates] = await Promise.all([
      loadAssumptions(),
      prisma.processingChargeRate.findMany(),
    ]);
    const processingTable = pcRates.map((r) => ({
      plant: r.plant,
      productG: r.productG,
      product: r.product,
      freezeType: r.freezeType,
      packSize: r.packSize,
      countSize: r.countSize,
      rsPerKg: r.rsPerKg,
    }));
    const customVariableCosts = parseCustomCosts(q.customVariableCosts);
    const customFixedCosts = parseCustomCosts(q.customFixedCosts);
    const quoteInput = buildQuoteComputeInput({
      fxRate: q.fxRate,
      assumptions: baseAssumptions,
      customVariableCosts,
      customFixedCosts,
      lines: q.lines,
      plant: q.plant,
      freezeType: q.freezeType,
      commissionOverridePerKg: q.commissionOverridePerKg,
      processingChargeWithGst: q.processingChargeWithGst,
      processingTable,
    });
    const computed = computeQuote(quoteInput);
    const payload = {
      quote: q,
      assumptions: quoteInput.assumptions,
      computed,
      takenAt: new Date().toISOString(),
    };
    await prisma.quoteSnapshot.upsert({
      where: { quoteId: id },
      create: { quoteId: id, payload: JSON.stringify(payload) },
      update: { payload: JSON.stringify(payload), takenAt: new Date() },
    });
  }

  revalidatePath(`/quotes/${id}`);
  revalidatePath("/quotes");
  revalidatePath("/");
  return { ok: true, status: nextStatus };
}
