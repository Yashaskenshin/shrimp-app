import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeQuote, type Assumptions, DEFAULT_ASSUMPTIONS } from "@/lib/calc";
import { parseCustomCosts } from "@/lib/customCosts";
import { buildQuoteComputeInput } from "@/lib/quoteCompute";
import { DashboardCharts } from "@/app/components/DashboardCharts";

/** Avoid Prisma at static generation time — dashboard always reads live DB on request. */
export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-violet-100 text-violet-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  SENT: "bg-teal-100 text-teal-700",
};

function fmtCurrency(n: number, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: digits,
  }).format(n || 0);
}

async function getDashboard() {
  const [quotes, assumptions, productCount, pcRates] = await Promise.all([
    prisma.quote.findMany({
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assumption.findMany(),
    prisma.product.count({ where: { active: true } }),
    prisma.processingChargeRate.findMany(),
  ]);

  const processingTable = pcRates.map((r) => ({
    plant: r.plant,
    product: r.product,
    freezeType: r.freezeType,
    packSize: r.packSize,
    rsPerKg: r.rsPerKg,
  }));

  // Build assumptions object
  const aMap: Record<string, number> = {};
  for (const a of assumptions) aMap[a.key] = a.value;
  const a: Assumptions = {
    ...DEFAULT_ASSUMPTIONS,
    rmBufferPerKg: aMap.rm_buffer_per_kg ?? DEFAULT_ASSUMPTIONS.rmBufferPerKg,
    harvestingFactorPerKg: aMap.harvesting_factor_per_kg ?? DEFAULT_ASSUMPTIONS.harvestingFactorPerKg,
    packagingPerKg: aMap.packaging_per_kg ?? DEFAULT_ASSUMPTIONS.packagingPerKg,
    additivePerKg: aMap.additive_per_kg ?? DEFAULT_ASSUMPTIONS.additivePerKg,
    commissionPerKg: aMap.commission_per_kg ?? DEFAULT_ASSUMPTIONS.commissionPerKg,
    exportShipmentPerKg: aMap.export_shipment_per_kg ?? DEFAULT_ASSUMPTIONS.exportShipmentPerKg,
    ddpPerKg: aMap.ddp_per_kg ?? DEFAULT_ASSUMPTIONS.ddpPerKg,
    dbkPct: aMap.dbk_pct ?? DEFAULT_ASSUMPTIONS.dbkPct,
    meisPct: aMap.meis_pct ?? DEFAULT_ASSUMPTIONS.meisPct,
    dbkMeisBasisPct: aMap.dbk_meis_basis_pct ?? DEFAULT_ASSUMPTIONS.dbkMeisBasisPct,
    processingChargePerKg: aMap.processing_charge_per_kg ?? DEFAULT_ASSUMPTIONS.processingChargePerKg,
    wagesPerKg: aMap.wages_per_kg ?? DEFAULT_ASSUMPTIONS.wagesPerKg,
    rentalPerKg: aMap.rental_per_kg ?? DEFAULT_ASSUMPTIONS.rentalPerKg,
    depreciationPerKg: aMap.depreciation_per_kg ?? DEFAULT_ASSUMPTIONS.depreciationPerKg,
  };

  const byStatus: Record<string, number> = {
    DRAFT: 0, SUBMITTED: 0, VERIFIED: 0, APPROVED: 0, REJECTED: 0, SENT: 0,
  };
  let totalRevenueInr = 0;
  let totalProfitInr = 0;
  let totalKg = 0;
  const monthlyRevenue: Record<string, number> = {};
  const customerRevenue: Record<string, number> = {};

  for (const q of quotes) {
    byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
    const res = computeQuote(
      buildQuoteComputeInput({
        fxRate: q.fxRate,
        assumptions: a,
        customVariableCosts: parseCustomCosts(q.customVariableCosts),
        customFixedCosts: parseCustomCosts(q.customFixedCosts),
        lines: q.lines,
        plant: q.plant,
        freezeType: q.freezeType,
        commissionOverridePerKg: q.commissionOverridePerKg,
        processingChargeWithGst: q.processingChargeWithGst,
        processingTable,
      }),
    );
    const revInr = res.totals.revenueInr000 * 1000;
    totalRevenueInr += revInr;
    totalProfitInr += res.totals.profitBeforeAdmin000 * 1000;
    totalKg += res.totals.weightKg;

    const monthKey = q.createdAt.toISOString().slice(0, 7);
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] ?? 0) + revInr;

    const customer = q.customer ?? "(unknown)";
    customerRevenue[customer] = (customerRevenue[customer] ?? 0) + revInr;
  }

  return { quotes, byStatus, totalRevenueInr, totalProfitInr, totalKg, productCount, monthlyRevenue, customerRevenue };
}

export default async function Dashboard() {
  const d = await getDashboard();

  const monthlyData = Object.entries(d.monthlyRevenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, revenueInr]) => ({ month, revenueInr }));

  const topCustomers = Object.entries(d.customerRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([customer, revenueInr]) => ({ customer, revenueInr }));

  const STATUSES = ["DRAFT", "SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "SENT"];
  const statusData = STATUSES
    .map((status) => ({ status, count: d.byStatus[status] ?? 0 }))
    .filter((s) => s.count > 0);

  const stat = (label: string, value: string, sub?: string) => (
    <div className="card flex-1">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Quick view of the cost-sheet system.</p>
        </div>
        <Link href="/quotes/new" className="btn-primary">+ New Quote</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stat("Quotes", String(d.quotes.length))}
        {stat("Products in master", String(d.productCount))}
        {stat("Total Revenue (all quotes)", fmtCurrency(d.totalRevenueInr))}
        {stat(
          "Profit before Admin",
          fmtCurrency(d.totalProfitInr),
          d.totalRevenueInr > 0
            ? `${((d.totalProfitInr / d.totalRevenueInr) * 100).toFixed(1)}% of revenue`
            : undefined,
        )}
      </div>

      <DashboardCharts monthlyData={monthlyData} topCustomers={topCustomers} statusData={statusData} />

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent quotes</h2>
          <Link href="/quotes" className="text-sm font-medium text-emerald-700 hover:underline">
            View all →
          </Link>
        </div>
        {d.quotes.length === 0 ? (
          <p className="text-sm text-slate-500">
            No quotes yet. <Link className="text-emerald-700 underline" href="/quotes/new">Create your first one.</Link>
          </p>
        ) : (
          <table className="calc w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th>PO No</th>
                <th>Customer</th>
                <th>Country</th>
                <th>Status</th>
                <th>FX</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.quotes.slice(0, 10).map((q) => (
                <tr key={q.id}>
                  <td className="text-left">{q.poNo || <span className="text-slate-400">—</span>}</td>
                  <td className="text-left">{q.customer || "—"}</td>
                  <td className="text-left">{q.country || "—"}</td>
                  <td className="text-left">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[q.status] ?? "bg-slate-100 text-slate-700"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td>{q.fxRate.toFixed(4)}</td>
                  <td>{q.createdAt.toLocaleDateString("en-IN")}</td>
                  <td>
                    <Link href={`/quotes/${q.id}`} className="text-emerald-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
