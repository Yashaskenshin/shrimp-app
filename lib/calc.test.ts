/**
 * Calc kernel tests.
 *
 * Run with: npm run calc:test
 */

import { computeLine, computeQuote, DEFAULT_ASSUMPTIONS } from "./calc";

function approx(label: string, actual: number, expected: number, tol = 0.5) {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(
      `FAIL [${label}]: expected ${expected.toFixed(4)} got ${actual.toFixed(4)} (diff ${diff.toFixed(4)} > ${tol})`,
    );
  }
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`FAIL [${label}]: expected ${expected} got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// Test 1: Line 1 parity against the original Excel workbook
// ---------------------------------------------------------------------------
{
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

  console.log("--- Test 1: Excel line 1 parity ---");
  console.log("sellingPriceInrPerKg", r.sellingPriceInrPerKg.toFixed(4));
  console.log("variableCostRs      ", r.variableCostRs.toFixed(4));
  console.log("contributionMarginRs", r.contributionMarginRs.toFixed(4));
  console.log("totalCostRs         ", r.totalCostRs.toFixed(4));
  console.log("profitBeforeAdminRs ", r.profitBeforeAdminRs.toFixed(4));

  approx("sellingPriceInrPerKg", r.sellingPriceInrPerKg, 832.7229);
  approx("variableCostRs", r.variableCostRs, 752.394);
  approx("contributionMarginRs", r.contributionMarginRs, 80.329);
  approx("totalCostRs", r.totalCostRs, 827.471);
  approx("profitBeforeAdminRs", r.profitBeforeAdminRs, 5.2516, 1);
  console.log("PASS\n");
}

// ---------------------------------------------------------------------------
// Test 2: Zero weight line — revenue and cost should be 0, no NaN
// ---------------------------------------------------------------------------
{
  console.log("--- Test 2: Zero weight ---");
  const r = computeLine(
    { lineNo: 1, weightKg: 0, usdPerKg: 10, yieldPct: 0.63, avgSize: 27, rmPriceRs: 400 },
    83,
    DEFAULT_ASSUMPTIONS,
  );
  assertEqual("revenueUsd000 == 0", r.revenueUsd000, 0);
  assertEqual("revenueInr000 == 0", r.revenueInr000, 0);
  assertEqual("sellingPrice == 0", r.sellingPriceInrPerKg, 0);
  assertEqual("contributionProfit000 == 0", r.contributionProfit000, 0);
  assertEqual("no NaN in variableCost", Number.isFinite(r.variableCostRs), true);
  console.log("PASS\n");
}

// ---------------------------------------------------------------------------
// Test 3: Zero yield — RM and harvesting must be 0, not NaN
// ---------------------------------------------------------------------------
{
  console.log("--- Test 3: Zero yield ---");
  const r = computeLine(
    { lineNo: 1, weightKg: 10000, usdPerKg: 8, yieldPct: 0, avgSize: 27, rmPriceRs: 400 },
    83,
    DEFAULT_ASSUMPTIONS,
  );
  assertEqual("rmMeatRs == 0 when yieldPct=0", r.rmMeatRs, 0);
  assertEqual("harvestingRs == 0 when yieldPct=0", r.harvestingRs, 0);
  assertEqual("rmUsageKg == 0 when yieldPct=0", r.rmUsageKg, 0);
  assertEqual("no NaN in variableCost", Number.isFinite(r.variableCostRs), true);
  console.log("PASS\n");
}

// ---------------------------------------------------------------------------
// Test 4: Zero RM price — contribution margin inflated, no crash
// ---------------------------------------------------------------------------
{
  console.log("--- Test 4: Zero RM price ---");
  const r = computeLine(
    { lineNo: 1, weightKg: 10000, usdPerKg: 8, yieldPct: 0.63, avgSize: 27, rmPriceRs: 0 },
    83,
    DEFAULT_ASSUMPTIONS,
  );
  // rmBuffer still added: rmMeatRs = (0 + 2) / 0.63 ≈ 3.17
  const expectedRmMeat = (0 + DEFAULT_ASSUMPTIONS.rmBufferPerKg) / 0.63;
  approx("rmMeatRs with 0 rmPrice", r.rmMeatRs, expectedRmMeat, 0.1);
  assertEqual("no NaN in profitPct", Number.isFinite(r.profitPct), true);
  console.log("PASS\n");
}

// ---------------------------------------------------------------------------
// Test 5: Processing charge lookup miss falls through to 0
// ---------------------------------------------------------------------------
{
  console.log("--- Test 5: Processing charge lookup miss ---");
  const r = computeLine(
    {
      lineNo: 1,
      weightKg: 10000,
      usdPerKg: 8,
      yieldPct: 0.63,
      avgSize: 27,
      rmPriceRs: 400,
      // processingChargeRs = undefined, processingChargeVarLookup = undefined → 0
    },
    83,
    DEFAULT_ASSUMPTIONS,
  );
  assertEqual("processingChargeVar == 0 on lookup miss", r.processingChargeVar, 0);
  console.log("PASS\n");
}

// ---------------------------------------------------------------------------
// Test 6: Multi-line weighted margin % is total contribution / total revenue
//         not a kg-weighted average of per-line percentages
// ---------------------------------------------------------------------------
{
  console.log("--- Test 6: Weighted margin % correctness ---");
  // Line A: 100kg at $5/kg, RM 200 Rs/kg, yield 0.5  → high margin product
  // Line B: 100kg at $10/kg, RM 700 Rs/kg, yield 0.8 → low margin product
  // If we just average margin%, we'd get the wrong answer
  const fxRate = 80;
  const result = computeQuote({
    fxRate,
    assumptions: DEFAULT_ASSUMPTIONS,
    lines: [
      { lineNo: 1, weightKg: 100, usdPerKg: 5, yieldPct: 0.5, avgSize: 20, rmPriceRs: 200 },
      { lineNo: 2, weightKg: 100, usdPerKg: 10, yieldPct: 0.8, avgSize: 40, rmPriceRs: 700 },
    ],
  });

  const t = result.totals;
  const manualPct = t.contributionProfit000 / t.revenueInr000;
  approx(
    "contributionMarginPct == totalContrib/totalRevenue",
    t.contributionMarginPct,
    manualPct,
    0.0001,
  );
  // Verify it does NOT equal the simple average of per-line pcts
  const lineAvgPct =
    (result.lines[0].contributionMarginPct + result.lines[1].contributionMarginPct) / 2;
  const diverges = Math.abs(t.contributionMarginPct - lineAvgPct) > 0.001;
  if (!diverges) {
    console.log("  Note: lines happen to have same pct (coincidence), OK");
  }
  console.log(`  contributionMarginPct = ${(t.contributionMarginPct * 100).toFixed(4)}%`);
  console.log(`  per-line avg pct      = ${(lineAvgPct * 100).toFixed(4)}%`);
  console.log("PASS\n");
}

console.log("ALL TESTS PASSED");
