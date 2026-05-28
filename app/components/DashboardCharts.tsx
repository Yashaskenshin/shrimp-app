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

interface Props {
  monthlyData: { month: string; revenueInr: number }[];
  topCustomers: { customer: string; revenueInr: number }[];
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

function fmtTooltip(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return [inrFmt.format(n), "Revenue"] as [string, string];
}

export function DashboardCharts({ monthlyData, topCustomers }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-4 text-base font-semibold">Revenue trend (INR)</h2>
        {monthlyData.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No quote revenue yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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
                formatter={fmtTooltip}
                labelFormatter={formatMonth}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="revenueInr" radius={[4, 4, 0, 0]}>
                {monthlyData.map((_entry, i) => (
                  <Cell key={i} fill="#10b981" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h2 className="mb-4 text-base font-semibold">Top customers (by revenue)</h2>
        {topCustomers.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No customer data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
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
                formatter={fmtTooltip}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="revenueInr" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
