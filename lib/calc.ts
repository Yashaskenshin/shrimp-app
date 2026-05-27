import type { CustomCostRow } from "./customCosts";
import { amountForLine } from "./customCosts";

/**
 * Cost-sheet calculation kernel.
 *
 * One-to-one port of the formulas in `Maintain` sheet of
 * "Cost sheet format - Shrimps.xlsx" (rows 24-60), so results
 * match what the existing Excel-based team already trusts.
 *
 * All money values are in INR unless explicitly suffixed Usd.
 * All weights are in kg unless suffixed Tonnes.
 */

export interface Assumptions {
  /** Rs/kg added on top of the raw-material price before applying yield. */
  rmBufferPerKg: number;
  /** Harvesting cost factor (Excel: =1/yield * 9.9). */
  harvestingFactorPerKg: number;
  /** Default packaging Rs/kg, can be overridden per line. */
  packagingPerKg: number;
  /** Default additive Rs/kg, can be overridden per line. */
  additivePerKg: number;
  /** Default commission Rs/kg. */
  commissionPerKg: number;
  /** Default export-shipment Rs/kg. */
  exportShipmentPerKg: number;
  /** Default DDP Rs/kg. */
  ddpPerKg: number;
  /** Duty drawback % of selling price. Excel: 3% (0.03). */
  dbkPct: number;
  /** MEIS % of selling price. Excel: 2.5% (0.025). */
  meisPct: number;
  /** Selling-price multiplier used in DBK / MEIS basis. Excel: 98%. */
  dbkMeisBasisPct: number;
  /** Default processing charge Rs/kg (fixed-cost block). */
  processingChargePerKg: number;
  /** Wages & salaries Rs/kg. */
  wagesPerKg: number;
  /** Rental / insurance / other Rs/kg. */
  rentalPerKg: number;
  /** Depreciation Rs/kg. */
  depreciationPerKg: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  rmBufferPerKg: 2,
  harvestingFactorPerKg: 9.9,
  packagingPerKg: 8,
  additivePerKg: 6.5,
  commissionPerKg: 0,
  exportShipmentPerKg: 25,
  ddpPerKg: 0,
  dbkPct: 0.03,
  meisPct: 0.025,
  dbkMeisBasisPct: 0.98,
  processingChargePerKg: 70,
  wagesPerKg: 4.9632,
  rentalPerKg: 0,
  depreciationPerKg: 0.1141,
};

export interface LineInput {
  /** 1..12 — display order; passed through for sorting. */
  lineNo: number;
  productCode?: string;
  productName?: string;
  sizeBand?: string;
  pack?: string;

  /** Finished-goods weight to be sold, kg. (Sheet col J) */
  weightKg: number;
  /** Selling price in USD per kg. (Sheet col K) */
  usdPerKg: number;
  /** Optional stock FG kg field. (Sheet col O) */
  stockFgKg?: number;

  /** Std yield % from master, e.g. 0.63. (Sheet row 28) */
  yieldPct: number;
  /** Avg pieces / kg of raw shrimp. (Sheet row 29) */
  avgSize: number;
  /** Raw material price Rs/kg. (Sheet row 32) */
  rmPriceRs: number;

  /** Optional per-line overrides; fall back to global assumptions. */
  packagingRs?: number;
  additiveRs?: number;
  /** Override variable-block Rs/kg; null = use `processingChargeVarLookup` then 0. */
  processingChargeRs?: number;
  /** Filled server-side from **Processing charge** sheet when `processingChargeRs` is null. */
  processingChargeVarLookup?: number;
  commissionRs?: number;
  exportShipmentRs?: number;
  ddpRs?: number;
  /** Per-line "Stock cost" Rs (Sheet row 36). Informational. */
  stockCostRs?: number;
}

export interface LineResult {
  lineNo: number;

  // Sell info
  weightKg: number;
  usdPerKg: number;
  sellingPriceInrPerKg: number; // (sheet row 33)
  revenueUsd000: number;        // sheet col L
  revenueInr000: number;        // sheet col M

  // Volumes
  rmUsageKg: number;            // row 30
  pieces: number;               // row 31

  // Variable-cost lines (Rs/kg of finished goods)
  rmMeatRs: number;             // row 37
  packagingRs: number;          // row 38
  additiveRs: number;           // row 39
  harvestingRs: number;         // row 40
  processingChargeVar: number;  // row 41 (kept 0 by default)
  commissionRs: number;         // row 42
  exportShipmentRs: number;     // row 43
  ddpRs: number;                // row 44
  dbkRs: number;                // row 45 (negative)
  meisRs: number;               // row 46 (negative)

  /** User-defined variable cost rows (Rs/kg) summed for this line. */
  extraVariableRs: number;
  /** User-defined fixed cost rows (Rs/kg) summed for this line. */
  extraFixedRs: number;

  variableCostRs: number;       // row 47 (includes extraVariableRs)

  contributionMarginRs: number; // row 48 = selling - variable
  contributionProfit000: number;// row 49
  contributionMarginPct: number;// row 50

  // Fixed-cost lines (Rs/kg)
  processingChargeFix: number;  // row 52
  wagesRs: number;              // row 53
  rentalRs: number;             // row 54
  depreciationRs: number;       // row 55
  fixedCostRs: number;          // row 56

  totalCostRs: number;          // row 57
  profitBeforeAdminRs: number;  // row 58
  profitBeforeAdmin000: number; // row 59
  profitPct: number;            // row 60
}

export interface QuoteInput {
  fxRate: number; // INR per USD
  assumptions: Assumptions;
  lines: LineInput[];
  /** Optional extra variable-cost rows (Rs/kg per line). */
  customVariableCosts?: CustomCostRow[];
  /** Optional extra fixed-cost rows (Rs/kg per line). */
  customFixedCosts?: CustomCostRow[];
}

export interface QuoteResult {
  lines: LineResult[];
  totals: {
    weightKg: number;
    revenueUsd000: number;
    revenueInr000: number;
    avgUsdPerKg: number;
    avgInrPerKg: number;

    rmUsageKg: number;
    pieces: number;

    variableCostRs: number;          // weighted avg Rs/kg
    contributionMarginRs: number;    // weighted avg Rs/kg
    contributionProfit000: number;   // sum '000 Rs
    contributionMarginPct: number;

    fixedCostRs: number;             // weighted avg
    totalCostRs: number;             // weighted avg
    profitBeforeAdminRs: number;     // weighted avg
    profitBeforeAdmin000: number;    // sum
    profitPct: number;
  };
}

function safeDiv(a: number, b: number, fallback = 0): number {
  if (!b || !isFinite(b)) return fallback;
  const r = a / b;
  return isFinite(r) ? r : fallback;
}

export function computeLine(
  line: LineInput,
  fxRate: number,
  a: Assumptions,
  extraVariableRs = 0,
  extraFixedRs = 0,
): LineResult {
  const {
    weightKg,
    usdPerKg,
    yieldPct,
    avgSize,
    rmPriceRs,
  } = line;

  // Sell information
  const revenueUsd000 = (usdPerKg * weightKg) / 1000;
  const revenueInr000 = fxRate * revenueUsd000;
  const sellingPriceInrPerKg = safeDiv(revenueInr000, weightKg) * 1000; // row N

  // Volumes
  const rmUsageKg = safeDiv(weightKg, yieldPct, 0);
  const pieces = avgSize * rmUsageKg;

  // Variable costs (Rs/kg of finished good)
  const rmMeatRs = yieldPct > 0 ? (rmPriceRs + a.rmBufferPerKg) / yieldPct : 0;
  const packagingRs = line.packagingRs ?? a.packagingPerKg;
  const additiveRs = line.additiveRs ?? a.additivePerKg;
  const harvestingRs = weightKg > 0 && yieldPct > 0
    ? (1 / yieldPct) * a.harvestingFactorPerKg
    : 0;
  const processingChargeVar =
    line.processingChargeRs != null
      ? line.processingChargeRs
      : (line.processingChargeVarLookup ?? 0);
  const commissionRs = line.commissionRs ?? a.commissionPerKg;
  const exportShipmentRs = line.exportShipmentRs ?? a.exportShipmentPerKg;
  const ddpRs = line.ddpRs ?? a.ddpPerKg;

  const dbkRs = -sellingPriceInrPerKg * a.dbkMeisBasisPct * a.dbkPct;
  const meisRs = -sellingPriceInrPerKg * a.dbkMeisBasisPct * a.meisPct;

  const variableCostRs =
    rmMeatRs +
    packagingRs +
    additiveRs +
    harvestingRs +
    processingChargeVar +
    commissionRs +
    exportShipmentRs +
    ddpRs +
    dbkRs +
    meisRs +
    extraVariableRs;

  const contributionMarginRs = sellingPriceInrPerKg - variableCostRs;
  const contributionProfit000 = (contributionMarginRs * weightKg) / 1000;
  const contributionMarginPct = safeDiv(contributionMarginRs, sellingPriceInrPerKg);

  // Fixed costs
  /** Fixed-cost block: global assumption only (Excel row 52 vs variable row 41). */
  const processingChargeFix = a.processingChargePerKg;
  const wagesRs = a.wagesPerKg;
  const rentalRs = a.rentalPerKg;
  const depreciationRs = a.depreciationPerKg;
  const fixedCostRs = processingChargeFix + wagesRs + rentalRs + depreciationRs + extraFixedRs;

  const totalCostRs = variableCostRs + fixedCostRs;
  const profitBeforeAdminRs = sellingPriceInrPerKg - totalCostRs;
  const profitBeforeAdmin000 = (profitBeforeAdminRs * weightKg) / 1000;
  const profitPct = safeDiv(profitBeforeAdminRs, sellingPriceInrPerKg);

  return {
    lineNo: line.lineNo,

    weightKg,
    usdPerKg,
    sellingPriceInrPerKg,
    revenueUsd000,
    revenueInr000,

    rmUsageKg,
    pieces,

    rmMeatRs,
    packagingRs,
    additiveRs,
    harvestingRs,
    processingChargeVar,
    commissionRs,
    exportShipmentRs,
    ddpRs,
    dbkRs,
    meisRs,

    extraVariableRs,
    extraFixedRs,

    variableCostRs,

    contributionMarginRs,
    contributionProfit000,
    contributionMarginPct,

    processingChargeFix,
    wagesRs,
    rentalRs,
    depreciationRs,
    fixedCostRs,

    totalCostRs,
    profitBeforeAdminRs,
    profitBeforeAdmin000,
    profitPct,
  };
}

export function computeQuote(q: QuoteInput): QuoteResult {
  const varRows = q.customVariableCosts ?? [];
  const fixRows = q.customFixedCosts ?? [];

  const lines = q.lines.map((l) => {
    let ev = 0;
    for (const r of varRows) ev += amountForLine(r, l.lineNo);
    let ef = 0;
    for (const r of fixRows) ef += amountForLine(r, l.lineNo);
    return computeLine(l, q.fxRate, q.assumptions, ev, ef);
  });

  const totalKg = lines.reduce((s, l) => s + l.weightKg, 0);
  const totalUsd000 = lines.reduce((s, l) => s + l.revenueUsd000, 0);
  const totalInr000 = lines.reduce((s, l) => s + l.revenueInr000, 0);

  const weighted = (key: keyof LineResult) =>
    safeDiv(
      lines.reduce((s, l) => s + (l[key] as number) * l.weightKg, 0),
      totalKg,
    );

  const totalContrib000 = lines.reduce((s, l) => s + l.contributionProfit000, 0);
  const totalProfit000 = lines.reduce((s, l) => s + l.profitBeforeAdmin000, 0);

  return {
    lines,
    totals: {
      weightKg: totalKg,
      revenueUsd000: totalUsd000,
      revenueInr000: totalInr000,
      avgUsdPerKg: safeDiv(totalUsd000 * 1000, totalKg),
      avgInrPerKg: safeDiv(totalInr000 * 1000, totalKg),

      rmUsageKg: lines.reduce((s, l) => s + l.rmUsageKg, 0),
      pieces: lines.reduce((s, l) => s + l.pieces, 0),

      variableCostRs: weighted("variableCostRs"),
      contributionMarginRs: weighted("contributionMarginRs"),
      contributionProfit000: totalContrib000,
      contributionMarginPct: safeDiv(totalContrib000, totalInr000),

      fixedCostRs: weighted("fixedCostRs"),
      totalCostRs: weighted("totalCostRs"),
      profitBeforeAdminRs: weighted("profitBeforeAdminRs"),
      profitBeforeAdmin000: totalProfit000,
      profitPct: safeDiv(totalProfit000, totalInr000),
    },
  };
}

export function emptyLine(lineNo: number): LineInput {
  return {
    lineNo,
    weightKg: 0,
    usdPerKg: 0,
    yieldPct: 0.63,
    avgSize: 0,
    rmPriceRs: 0,
  };
}
