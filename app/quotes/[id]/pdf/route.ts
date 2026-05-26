import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeQuote, type Assumptions } from "@/lib/calc";
import { loadAssumptions } from "@/lib/assumptions";
import { parseCustomCosts } from "@/lib/customCosts";
import { buildQuoteComputeInput } from "@/lib/quoteCompute";

function inr(n: number, d = 2) {
  return isFinite(n)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: d }).format(n)
    : "—";
}

function esc(s: string | null | undefined) {
  if (s == null) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = await prisma.quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineNo: "asc" } }, snapshot: true },
  });
  if (!q) return new NextResponse("Not found", { status: 404 });

  let result: ReturnType<typeof computeQuote>;
  let assumptions: Assumptions;
  if (q.snapshot) {
    const payload = JSON.parse(q.snapshot.payload);
    result = payload.computed;
    assumptions = payload.assumptions;
  } else {
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
    const quoteInput = buildQuoteComputeInput({
      fxRate: q.fxRate,
      assumptions: baseAssumptions,
      customVariableCosts: parseCustomCosts(q.customVariableCosts),
      customFixedCosts: parseCustomCosts(q.customFixedCosts),
      lines: q.lines,
      plant: q.plant,
      freezeType: q.freezeType,
      commissionOverridePerKg: q.commissionOverridePerKg,
      processingChargeWithGst: q.processingChargeWithGst,
      processingTable,
    });
    result = computeQuote(quoteInput);
    assumptions = quoteInput.assumptions;
  }

  const linesHtml = q.lines.map((l) => {
    const r = result.lines.find((x) => x.lineNo === l.lineNo);
    return `<tr>
      <td>${l.lineNo}</td>
      <td>${esc(l.productCode)}</td>
      <td>${esc(l.productName)}</td>
      <td>${esc(l.sizeBand)}</td>
      <td>${esc(l.pack)}</td>
      <td>${inr(l.weightKg, 0)}</td>
      <td>${inr(l.usdPerKg, 2)}</td>
      <td>${r ? inr(r.revenueUsd000) : ""}</td>
      <td>${r ? inr(r.revenueInr000) : ""}</td>
      <td>${r ? inr(r.sellingPriceInrPerKg) : ""}</td>
    </tr>`;
  }).join("");

  const t = result.totals;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<title>Cost Sheet - ${esc(q.poNo ?? q.id)}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; }
h1 { font-size: 18px; margin: 0 0 4px 0; }
h2 { font-size: 13px; margin: 14px 0 6px 0; }
.small { font-size: 11px; color: #555; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: right; }
th:first-child, td:first-child { text-align: left; }
th { background: #f3f4f6; }
.head-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 11px; margin: 8px 0 14px; }
.head-grid div { border: 1px solid #eee; padding: 4px 6px; }
.head-grid label { display:block; font-size: 9px; text-transform: uppercase; color:#888; }
.total { font-weight: 700; }
.footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10px; color:#666; }
@media screen { body { background: #fff; padding: 20px; } }
</style></head><body>

<h1>Shrimp Cost Sheet</h1>
<div class="small">${esc(q.poNo)} \u00b7 ${esc(q.customer)} \u00b7 ${esc(q.country)} \u00b7 ${q.status}${q.snapshot ? " \u00b7 APPROVED SNAPSHOT" : ""}</div>

<div class="head-grid">
  <div><label>PO No</label>${esc(q.poNo)}</div>
  <div><label>Customer</label>${esc(q.customer)}</div>
  <div><label>Country</label>${esc(q.country)}</div>
  <div><label>Plant</label>${esc(q.plant)}</div>
  <div><label>Incoterm</label>${esc(q.incoterm)}</div>
  <div><label>Payment</label>${esc(q.payment)}</div>
  <div><label>FX (USD/INR)</label>${q.fxRate.toFixed(4)}</div>
  <div><label>Contract date</label>${q.contractDate ? new Date(q.contractDate).toLocaleDateString("en-IN") : "—"}</div>
  <div><label>Port of loading</label>${esc(q.portLoading)}</div>
  <div><label>Port of destination</label>${esc(q.portDestination)}</div>
  <div><label>Prepared by</label>${esc(q.preparedBy)}</div>
  <div><label>Approved by</label>${esc(q.approvedBy)}</div>
</div>

<h2>Sell information</h2>
<table>
<thead><tr>
<th>#</th><th>Code</th><th>Name</th><th>Size</th><th>Pack</th>
<th>Weight (kg)</th><th>USD/kg</th><th>'000 USD</th><th>'000 INR</th><th>INR/kg</th>
</tr></thead>
<tbody>
${linesHtml}
<tr class="total">
<td colspan="5">Total</td>
<td>${inr(t.weightKg, 0)}</td><td>${inr(t.avgUsdPerKg)}</td>
<td>${inr(t.revenueUsd000)}</td><td>${inr(t.revenueInr000)}</td><td>${inr(t.avgInrPerKg)}</td>
</tr>
</tbody></table>

<h2>Cost build-up (weighted average, Rs/kg)</h2>
<table><tbody>
<tr><td>Variable cost</td><td>${inr(t.variableCostRs)}</td></tr>
<tr><td>Fixed cost</td><td>${inr(t.fixedCostRs)}</td></tr>
<tr class="total"><td>Total cost</td><td>${inr(t.totalCostRs)}</td></tr>
<tr><td>Contribution margin</td><td>${inr(t.contributionMarginRs)}</td></tr>
<tr><td>Contribution margin %</td><td>${(t.contributionMarginPct * 100).toFixed(2)}%</td></tr>
<tr class="total"><td>Profit Rs/kg (before Admin)</td><td>${inr(t.profitBeforeAdminRs)}</td></tr>
<tr class="total"><td>Profit '000 INR</td><td>${inr(t.profitBeforeAdmin000)}</td></tr>
<tr><td>Profit %</td><td>${(t.profitPct * 100).toFixed(2)}%</td></tr>
</tbody></table>

<div class="footer">
  <span>Generated on ${new Date().toLocaleString("en-IN")}</span>
  <span>${q.snapshot ? "Snapshot taken " + new Date(q.snapshot.takenAt).toLocaleString("en-IN") : "Live preview"}</span>
</div>

<script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
