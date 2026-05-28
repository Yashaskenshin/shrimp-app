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

function pct(n: number, d = 2) {
  return isFinite(n) ? `${(n * 100).toFixed(d)}%` : "—";
}

function esc(s: string | null | undefined) {
  if (s == null) return "—";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
      product: r.product,
      freezeType: r.freezeType,
      packSize: r.packSize,
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

  const t = result.totals;

  const profitAccent =
    t.profitBeforeAdmin000 >= 0 ? "color:#047857" : "color:#be123c";

  // ------------------------------------------------------------------
  // Page 1 — Executive Summary
  // ------------------------------------------------------------------
  const summaryHtml = `
<section class="page">
  <header class="masthead">
    <div>
      <h1>Cost Sheet — Executive Summary</h1>
      <div class="sub">PO ${esc(q.poNo)} · ${esc(q.customer)} · ${esc(q.country)}</div>
    </div>
    <div class="status">
      <span class="badge badge-${q.status.toLowerCase()}">${q.status}</span>
      ${q.snapshot ? '<div class="snap">Approved snapshot</div>' : '<div class="snap">Live preview</div>'}
    </div>
  </header>

  <div class="header-grid">
    <div><label>PO No</label>${esc(q.poNo)}</div>
    <div><label>Customer</label>${esc(q.customer)}</div>
    <div><label>Country</label>${esc(q.country)}</div>
    <div><label>Plant</label>${esc(q.plant)}</div>
    <div><label>Incoterm</label>${esc(q.incoterm)}</div>
    <div><label>Payment</label>${esc(q.payment)}</div>
    <div><label>FX (USD/INR)</label>${q.fxRate.toFixed(4)}</div>
    <div><label>Contract date</label>${fmtDate(q.contractDate)}</div>
    <div><label>Port of loading</label>${esc(q.portLoading)}</div>
    <div><label>Port destination</label>${esc(q.portDestination)}</div>
    <div><label>Prepared by</label>${esc(q.preparedBy)}</div>
    <div><label>Approved by</label>${esc(q.approvedBy)}</div>
  </div>

  <h2>Key figures</h2>
  <div class="kpis">
    <div class="kpi">
      <label>Total volume</label>
      <div class="value">${inr(t.weightKg, 0)} <span class="unit">kg</span></div>
    </div>
    <div class="kpi">
      <label>Revenue</label>
      <div class="value">${inr(t.revenueUsd000)} <span class="unit">'000 USD</span></div>
      <div class="sub2">${inr(t.revenueInr000)} '000 INR</div>
    </div>
    <div class="kpi">
      <label>Avg selling price</label>
      <div class="value">${inr(t.avgUsdPerKg, 2)} <span class="unit">USD/kg</span></div>
      <div class="sub2">${inr(t.avgInrPerKg)} INR/kg</div>
    </div>
    <div class="kpi">
      <label>Total cost / kg</label>
      <div class="value">${inr(t.totalCostRs)} <span class="unit">Rs</span></div>
    </div>
    <div class="kpi accent">
      <label>Contribution margin</label>
      <div class="value">${pct(t.contributionMarginPct)}</div>
      <div class="sub2">${inr(t.contributionProfit000)} '000 INR</div>
    </div>
    <div class="kpi accent">
      <label>Profit before Admin</label>
      <div class="value" style="${profitAccent}">${pct(t.profitPct)}</div>
      <div class="sub2" style="${profitAccent}">${inr(t.profitBeforeAdmin000)} '000 INR</div>
    </div>
  </div>

  <h2>Line summary</h2>
  <table class="line-summary">
    <thead><tr>
      <th>#</th><th class="left">Product</th><th class="left">Pack</th>
      <th>Weight (kg)</th><th>USD/kg</th><th>Margin Rs/kg</th><th>Margin %</th><th>'000 USD</th>
    </tr></thead>
    <tbody>
      ${q.lines.map((l) => {
        const r = result.lines.find((x) => x.lineNo === l.lineNo);
        if (!l.weightKg) return "";
        return `<tr>
          <td>${l.lineNo}</td>
          <td class="left">${esc(l.productName)}</td>
          <td class="left">${esc(l.pack)}</td>
          <td>${inr(l.weightKg, 0)}</td>
          <td>${inr(l.usdPerKg, 2)}</td>
          <td>${r ? inr(r.contributionMarginRs) : "—"}</td>
          <td>${r ? pct(r.contributionMarginPct) : "—"}</td>
          <td>${r ? inr(r.revenueUsd000) : "—"}</td>
        </tr>`;
      }).join("")}
      <tr class="total">
        <td colspan="3" class="left">Total</td>
        <td>${inr(t.weightKg, 0)}</td>
        <td>${inr(t.avgUsdPerKg, 2)}</td>
        <td>${inr(t.contributionMarginRs)}</td>
        <td>${pct(t.contributionMarginPct)}</td>
        <td>${inr(t.revenueUsd000)}</td>
      </tr>
    </tbody>
  </table>

  ${q.notes ? `<div class="notes"><label>Notes</label><div>${esc(q.notes)}</div></div>` : ""}

  <footer class="page-footer">
    <span>Generated ${new Date().toLocaleString("en-IN")}</span>
    <span>Page 1 of 2 — Executive Summary</span>
  </footer>
</section>`;

  // ------------------------------------------------------------------
  // Page 2 — Full Cost Breakdown
  // ------------------------------------------------------------------
  const activeLines = q.lines.filter((l) => l.weightKg > 0);

  const lineHeaders = activeLines.map((l) => `<th>L${l.lineNo}</th>`).join("");

  function lineRow(label: string, get: (r: NonNullable<ReturnType<typeof result.lines.find>>) => number, totalCol: string = "", opts: { bold?: boolean; tone?: string } = {}) {
    const cells = activeLines.map((l) => {
      const r = result.lines.find((x) => x.lineNo === l.lineNo);
      return `<td>${r ? inr(get(r)) : "—"}</td>`;
    }).join("");
    const cls = [opts.bold ? "bold" : "", opts.tone ?? ""].filter(Boolean).join(" ");
    return `<tr class="${cls}"><td class="left">${label}</td>${cells}<td class="total-col">${totalCol}</td></tr>`;
  }

  const detailHtml = `
<section class="page">
  <header class="masthead">
    <div>
      <h1>Full Cost Breakdown</h1>
      <div class="sub">PO ${esc(q.poNo)} · ${esc(q.customer)}</div>
    </div>
    <div class="status">
      <span class="badge badge-${q.status.toLowerCase()}">${q.status}</span>
    </div>
  </header>

  <h2>Sell information</h2>
  <table class="detail-table">
    <thead>
      <tr>
        <th class="left">Description</th>
        ${lineHeaders}
        <th class="total-col">Total / avg</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="left">Product</td>${activeLines.map((l) => `<td class="left small">${esc(l.productName)}</td>`).join("")}<td class="total-col">—</td></tr>
      <tr><td class="left">Code</td>${activeLines.map((l) => `<td class="mono small">${esc(l.productCode)}</td>`).join("")}<td class="total-col">—</td></tr>
      <tr><td class="left">Pack</td>${activeLines.map((l) => `<td>${esc(l.pack)}</td>`).join("")}<td class="total-col">—</td></tr>
      <tr><td class="left">Weight (kg)</td>${activeLines.map((l) => `<td>${inr(l.weightKg, 0)}</td>`).join("")}<td class="total-col">${inr(t.weightKg, 0)}</td></tr>
      <tr><td class="left">USD / kg</td>${activeLines.map((l) => `<td>${inr(l.usdPerKg, 2)}</td>`).join("")}<td class="total-col">${inr(t.avgUsdPerKg, 2)}</td></tr>
      <tr><td class="left">Yield %</td>${activeLines.map((l) => `<td>${l.yieldPctOverride != null ? (l.yieldPctOverride * 100).toFixed(1) + "%" : "—"}</td>`).join("")}<td class="total-col">—</td></tr>
      <tr><td class="left">RM price Rs/kg</td>${activeLines.map((l) => `<td>${l.rmPriceRs != null ? inr(l.rmPriceRs, 2) : "—"}</td>`).join("")}<td class="total-col">—</td></tr>
      ${lineRow("Selling price Rs/kg", (r) => r.sellingPriceInrPerKg, inr(t.avgInrPerKg), { bold: true })}
    </tbody>
  </table>

  <h2>Variable costs (Rs/kg)</h2>
  <table class="detail-table">
    <thead>
      <tr><th class="left">Description</th>${lineHeaders}<th class="total-col">Weighted</th></tr>
    </thead>
    <tbody>
      ${lineRow("Raw material meat", (r) => r.rmMeatRs)}
      ${lineRow("Packaging", (r) => r.packagingRs)}
      ${lineRow("Additive", (r) => r.additiveRs)}
      ${lineRow("Harvesting", (r) => r.harvestingRs)}
      ${lineRow("Processing (variable)", (r) => r.processingChargeVar)}
      ${lineRow("Commission", (r) => r.commissionRs)}
      ${lineRow("Export shipment", (r) => r.exportShipmentRs)}
      ${lineRow("DDP", (r) => r.ddpRs)}
      ${lineRow(`DBK (${pct(assumptions.dbkPct, 1)})`, (r) => r.dbkRs)}
      ${lineRow(`MEIS (${pct(assumptions.meisPct, 1)})`, (r) => r.meisRs)}
      ${lineRow("Variable cost total", (r) => r.variableCostRs, inr(t.variableCostRs), { bold: true, tone: "subtotal" })}
      ${lineRow("Contribution margin", (r) => r.contributionMarginRs, inr(t.contributionMarginRs), { bold: true, tone: "contrib" })}
      ${lineRow("Contribution margin %", (r) => r.contributionMarginPct * 100, pct(t.contributionMarginPct), { bold: true, tone: "contrib" })}
    </tbody>
  </table>

  <h2>Fixed costs &amp; profit (Rs/kg)</h2>
  <table class="detail-table">
    <thead>
      <tr><th class="left">Description</th>${lineHeaders}<th class="total-col">Weighted</th></tr>
    </thead>
    <tbody>
      ${lineRow("Processing (fixed)", (r) => r.processingChargeFix)}
      ${lineRow("Wages &amp; salaries", (r) => r.wagesRs)}
      ${lineRow("Rental / insurance", (r) => r.rentalRs)}
      ${lineRow("Depreciation", (r) => r.depreciationRs)}
      ${lineRow("Fixed cost total", (r) => r.fixedCostRs, inr(t.fixedCostRs), { bold: true, tone: "subtotal" })}
      ${lineRow("Total cost", (r) => r.totalCostRs, inr(t.totalCostRs), { bold: true, tone: "subtotal" })}
      ${lineRow("Profit Rs/kg", (r) => r.profitBeforeAdminRs, inr(t.profitBeforeAdminRs), { bold: true, tone: "profit" })}
      ${lineRow("Profit '000 INR", (r) => r.profitBeforeAdmin000, inr(t.profitBeforeAdmin000), { bold: true, tone: "profit" })}
      ${lineRow("Profit %", (r) => r.profitPct * 100, pct(t.profitPct), { bold: true, tone: "profit" })}
    </tbody>
  </table>

  <footer class="page-footer">
    <span>Generated ${new Date().toLocaleString("en-IN")}</span>
    <span>Page 2 of 2 — Full Cost Breakdown</span>
  </footer>
</section>`;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<title>Cost Sheet — ${esc(q.poNo ?? q.id)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; }
.page { page-break-after: always; min-height: calc(210mm - 24mm); display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; }

.masthead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
.masthead h1 { font-size: 18px; margin: 0; }
.masthead .sub { font-size: 11px; color: #475569; margin-top: 2px; }
.masthead .status { text-align: right; }
.masthead .snap { font-size: 10px; color: #64748b; margin-top: 4px; }

.badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-draft     { background: #f1f5f9; color: #475569; }
.badge-submitted { background: #dbeafe; color: #1d4ed8; }
.badge-verified  { background: #ede9fe; color: #6d28d9; }
.badge-approved  { background: #d1fae5; color: #047857; }
.badge-rejected  { background: #ffe4e6; color: #be123c; }
.badge-sent      { background: #ccfbf1; color: #0f766e; }

.header-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; font-size: 11px; margin-bottom: 14px; }
.header-grid div { border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 4px; }
.header-grid label { display:block; font-size: 8.5px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.04em; margin-bottom: 1px; }

h2 { font-size: 13px; margin: 14px 0 6px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }

.kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 14px; }
.kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
.kpi.accent { background: #f0fdf4; border-color: #bbf7d0; }
.kpi label { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; }
.kpi .value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px; font-variant-numeric: tabular-nums; }
.kpi .unit { font-size: 10px; font-weight: 500; color: #64748b; }
.kpi .sub2 { font-size: 10px; color: #64748b; margin-top: 2px; font-variant-numeric: tabular-nums; }

table { width: 100%; border-collapse: collapse; font-size: 10.5px; font-variant-numeric: tabular-nums; }
table th, table td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: right; }
table th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; }
table .left { text-align: left; }
table .mono { font-family: 'SF Mono', Menlo, monospace; font-size: 9.5px; color: #64748b; }
table .small { font-size: 9.5px; }
table .bold td { font-weight: 700; }
table .total td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #94a3b8; }
table .total-col { background: #fafafa; font-weight: 700; }

.detail-table tr.subtotal td { background: #f1f5f9; }
.detail-table tr.contrib  td { background: #fff7ed; color: #9a3412; }
.detail-table tr.profit   td { background: #ecfdf5; color: #047857; }

.line-summary { margin-top: 6px; }

.notes { margin-top: 14px; padding: 8px 12px; border-left: 3px solid #94a3b8; background: #f8fafc; font-size: 10.5px; }
.notes label { display: block; font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; margin-bottom: 2px; }

.page-footer { margin-top: auto; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; }

@media screen { body { background: #e2e8f0; padding: 20px; } .page { background: #fff; padding: 12mm; max-width: 297mm; min-height: 210mm; margin: 0 auto 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); } }
</style></head><body>
${summaryHtml}
${detailHtml}
<script>setTimeout(function(){ window.print(); }, 400);</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
