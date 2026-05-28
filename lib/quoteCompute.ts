import type { Assumptions, LineInput, QuoteInput } from "./calc";
import { attachProcessingChargeLookups, type ProcessingChargeRow } from "./processingLookup";
import type { CustomCostRow } from "./customCosts";

/** Merge quote-level commission override (Excel: one value fans to all lines). */
export function mergeCommissionFromQuote(
  a: Assumptions,
  commissionOverridePerKg: number | null | undefined,
): Assumptions {
  if (commissionOverridePerKg == null || !Number.isFinite(commissionOverridePerKg)) return a;
  return { ...a, commissionPerKg: commissionOverridePerKg };
}

export type QuoteLineComputeLike = {
  lineNo: number;
  productCode?: string | null;
  productName?: string | null;
  sizeBand?: string | null;
  pack?: string | null;
  weightKg: number;
  usdPerKg: number;
  stockFgKg?: number | null;
  yieldPctOverride?: number | null;
  avgSizeOverride?: number | null;
  rmPriceRs?: number | null;
  packagingRs?: number | null;
  additiveRs?: number | null;
  processingChargeRs?: number | null;
  commissionRs?: number | null;
  exportShipmentRs?: number | null;
  ddpRs?: number | null;
  stockCostRs?: number | null;
};

/** Map a DB quote line (or equivalent) into the calc kernel line input (no lookup yet). */
export function mapQuoteLineToLineInput(l: QuoteLineComputeLike): LineInput {
  return {
    lineNo: l.lineNo,
    productCode: l.productCode ?? undefined,
    productName: l.productName ?? undefined,
    sizeBand: l.sizeBand ?? undefined,
    pack: l.pack ?? undefined,
    weightKg: l.weightKg,
    usdPerKg: l.usdPerKg,
    stockFgKg: l.stockFgKg ?? undefined,
    // null/missing yield → 0 so kernel skips RM/harvesting (safeDiv) and
    // numbers don't silently calculate against a guessed 63%.
    yieldPct: l.yieldPctOverride ?? 0,
    avgSize: l.avgSizeOverride ?? 0,
    rmPriceRs: l.rmPriceRs ?? 0,
    packagingRs: l.packagingRs ?? undefined,
    additiveRs: l.additiveRs ?? undefined,
    processingChargeRs: l.processingChargeRs ?? undefined,
    commissionRs: l.commissionRs ?? undefined,
    exportShipmentRs: l.exportShipmentRs ?? undefined,
    ddpRs: l.ddpRs ?? undefined,
    stockCostRs: l.stockCostRs ?? undefined,
  };
}

export function buildQuoteComputeInput(opts: {
  fxRate: number;
  assumptions: Assumptions;
  customVariableCosts?: CustomCostRow[];
  customFixedCosts?: CustomCostRow[];
  lines: QuoteLineComputeLike[];
  plant: string | null | undefined;
  freezeType: string | null | undefined;
  commissionOverridePerKg: number | null | undefined;
  processingChargeWithGst?: boolean | null;
  processingTable: ProcessingChargeRow[];
}): QuoteInput {
  const assumptions = mergeCommissionFromQuote(opts.assumptions, opts.commissionOverridePerKg);
  const base = opts.lines.map((l) => mapQuoteLineToLineInput(l));
  const lines = attachProcessingChargeLookups(
    base,
    {
      plant: opts.plant,
      freezeType: opts.freezeType,
      withGst: !!opts.processingChargeWithGst,
    },
    opts.processingTable,
  );
  return {
    fxRate: opts.fxRate,
    assumptions,
    lines,
    customVariableCosts: opts.customVariableCosts,
    customFixedCosts: opts.customFixedCosts,
  };
}
