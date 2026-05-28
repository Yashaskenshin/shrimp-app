"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "#94a3b8",
  SUBMITTED: "#60a5fa",
  VERIFIED:  "#a78bfa",
  APPROVED:  "#34d399",
  REJECTED:  "#f87171",
  SENT:      "#2dd4bf",
};

interface Props {
  monthlyData: { month: string; revenueInr: number }[];
  topCustomers: { customer: string; revenueInr: number }[];
  statusData: { status: string; count: number }[];
}

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatMonth(ym: unknown) {
  if (typeof ym !== "string") return String(ym ?? "");
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function fmtInrTooltip(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return [inrFmt.format(n), "Revenue"] as [string, string];
}

function fmtCountTooltip(v: unknown) {
  return [String(v), "Quotes"] as [string, string];
}

export function DashboardCharts({ monthlyData, topCustomers, statusData }: Props) {
  const totalQuotes = statusData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue trend */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold">Revenue trend (INR)</h2>
          {monthlyData.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No quote revenue yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={fmtInrTooltip}
                  labelFormatter={formatMonth}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="revenueInr" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_e, i) => <Cell key={i} fill="#10b981" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top customers */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold">Top customers (by revenue)</h2>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No customer data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={topCustomers}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="customer"
                  width={130}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={fmtInrTooltip}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="revenueInr" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pipeline status */}
      {totalQuotes > 0 && (
        <div className="card">
          <h2 className="mb-4 text-base font-semibold">Quote pipeline</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  formatter={fmtCountTooltip}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-col justify-center gap-2">
              {statusData.map((d) => (
                <div key={d.status} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ background: STATUS_COLORS[d.status] ?? "#94a3b8" }}
                  />
                  <span className="flex-1 text-slate-600">{d.status}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{d.count}</span>
                  <span className="w-10 text-right text-xs text-slate-400">
                    {totalQuotes > 0 ? `${Math.round((d.count / totalQuotes) * 100)}%` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
