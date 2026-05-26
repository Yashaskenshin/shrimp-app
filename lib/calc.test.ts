/**
 * Sanity test: replicate line 1 (Maintain!E column) from the original Excel
 * and check our kernel matches the values stored in the workbook.
 *
 * Excel reference for line 1 (col E):
 *   Weight  = 50000 kg          (J10)
 *   USD/kg  = 10.2              (K10)
 *   FX      = 81.6395           (J4)
 *   Yield   = 0.63              (E28)
 *   AvgSize = 27                (E29)
 *   RMPrice = 465.5             (E32 = 490*0.95)
 *   Packaging = 8, Additive = 6.5, Exp shipment = 25, DDP = 0
 *   DBK 3%, MEIS 2.5%, basis 98%
 *   Processing(fixed) = 70, Wages = 4.9632, Rental = 0, Depreciation = 0.1141
 *
 * Expected (from the workbook computed values):
 *   sellingPriceInrPerKg ~ 832.7229         (N10)
 *   variableCostRs       ~ 752.394          (E47)
 *   contributionMarginRs ~ 80.329           (E48)
 *   totalCostRs          ~ 827.471          (E57)
 *   profitBeforeAdminRs  ~ 5.2516           (E58)
 */

import { computeLine, DEFAULT_ASSUMPTIONS } from "./calc";

function approx(actual: number, expected: number, tol = 0.5) {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(
      `FAIL: expected ${expected.toFixed(4)} got ${actual.toFixed(4)} (diff ${diff.toFixed(4)} > ${tol})`,
    );
  }
}

const r = computeLine(
  {
    lineNo: 1,
    weightKg: 50000,
    usdPerKg: 10.2,
    yieldPct: 0.63,
    avgSize: 27,
    rmPriceRs: 465.5,
  },
  81.6395,
  DEFAULT_ASSUMPTIONS,
);

console.log("sellingPriceInrPerKg", r.sellingPriceInrPerKg.toFixed(4));
console.log("variableCostRs      ", r.variableCostRs.toFixed(4));
console.log("contributionMarginRs", r.contributionMarginRs.toFixed(4));
console.log("totalCostRs         ", r.totalCostRs.toFixed(4));
console.log("profitBeforeAdminRs ", r.profitBeforeAdminRs.toFixed(4));

approx(r.sellingPriceInrPerKg, 832.7229);
approx(r.variableCostRs, 752.394);
approx(r.contributionMarginRs, 80.329);
approx(r.totalCostRs, 827.471);
approx(r.profitBeforeAdminRs, 5.2516, 1);

console.log("\nALL OK — calc kernel matches the Excel for line 1.");
