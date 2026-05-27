"use client";

import type { ReactNode } from "react";
import type { Assumptions, LineResult, QuoteResult } from "@/lib/calc";

const inr = (n: number, digits = 2) =>
  isFinite(n)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n)
    : "—";

/** Minimal sell-line fields for the Excel-style flow column. */
export interface ExcelFlowSellLine {
  lineNo: number;
  productCode: string | null;
  productName: string | null;
  weightKg: number;
  rmPriceRs: number | null;
  yieldPctOverride: number | null;
  avgSizeOverride: number | null;
}

export interface ExcelFlowCustomRow {
  id: string;
  label: string;
  values: number[];
}

const stickyLabel =
  "sticky left-0 z-10 min-w-[14rem] max-w-[16rem] border-r border-slate-200 px-3 py-1.5 text-left align-top text-sm shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)]";

function FlowNumInput({
  value,
  onChange,
  step = 0.01,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      className="input input-num w-full min-w-[4.5rem] text-sm"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

function moneyOrDash(
  res: LineResult | undefined,
  value: number | undefined,
  opts?: { digits?: number; suffix?: string; vol?: boolean },
) {
  if (!res) return "—";
  const d = opts?.vol ? 0 : (opts?.digits ?? 2);
  return `${inr(value ?? 0, d)}${opts?.suffix ?? ""}`;
}

function weightedCustomAvg(rows: ExcelFlowSellLine[], values: number[]): string {
  const w = rows.reduce((s, row) => s + (row.weightKg || 0), 0);
  if (w <= 0) return "—";
  const sum = rows.reduce((s, row, j) => s + (row.weightKg || 0) * (values[j] ?? 0), 0);
  return inr(sum / w, 2);
}

export function ExcelCostFlowTable({
  rows,
  resultByLine,
  totals,
  assumptions,
  contractDate,
  customVarUI,
  customFixUI,
  onVarLabelChange,
  onVarValueChange,
  onVarDelete,
  onAddVarRow,
  onFixLabelChange,
  onFixValueChange,
  onFixDelete,
  onAddFixRow,
}: {
  rows: ExcelFlowSellLine[];
  resultByLine: Record<number, LineResult | undefined>;
  totals: QuoteResult["totals"];
  assumptions: Assumptions;
  contractDate: string | null;
  customVarUI: ExcelFlowCustomRow[];
  customFixUI: ExcelFlowCustomRow[];
  onVarLabelChange: (id: string, label: string) => void;
  onVarValueChange: (id: string, colIdx: number, v: number) => void;
  onVarDelete: (id: string) => void;
  onAddVarRow: () => void;
  onFixLabelChange: (id: string, label: string) => void;
  onFixValueChange: (id: string, colIdx: number, v: number) => void;
  onFixDelete: (id: string) => void;
  onAddFixRow: () => void;
}) {
  const colCount = rows.length + 2;

  function flowMoneyRow(
    label: ReactNode,
    labelCellBg: string,
    rowCellBg: string,
    get: (lr: LineResult) => number,
    totalCell: ReactNode,
    opts?: { digits?: number; suffix?: string; vol?: boolean; bold?: boolean; good?: boolean },
  ) {
    const tone = opts?.good ? "text-emerald-800" : "text-slate-800";
    const fw = opts?.bold ? "font-semibold" : "";
    const d = opts?.vol ? 0 : (opts?.digits ?? 2);
    return (
      <tr>
        <td className={`${stickyLabel} ${labelCellBg} font-medium ${tone}`}>{label}</td>
        {rows.map((r) => {
          const res = resultByLine[r.lineNo];
          const v = res ? get(res) : undefined;
          return (
            <td key={r.lineNo} className={`${rowCellBg} px-2 py-1.5 text-right tabular-nums text-sm ${tone} ${fw}`}>
              {moneyOrDash(res, v, { ...opts, digits: d })}
            </td>
          );
        })}
        <td className={`bg-slate-50 px-2 py-1.5 text-right tabular-nums text-sm font-semibold ${tone}`}>
          {totalCell}
        </td>
      </tr>
    );
  }

  const dbkPctLabel = `${(assumptions.dbkPct * 100).toFixed(1)}%`;
  const meisPctLabel = `${(assumptions.meisPct * 100).toFixed(1)}%`;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="calc-wide excel-flow w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-amber-100">
            <th
              className={`${stickyLabel} bg-amber-100 text-left text-xs font-bold uppercase tracking-wide text-slate-800`}
            >
              Description
            </th>
            {rows.map((r) => (
              <th key={r.lineNo} className="min-w-[5.5rem] px-2 py-2 text-center text-xs font-semibold text-slate-700">
                Line {r.lineNo}
              </th>
            ))}
            <th className="min-w-[5.5rem] px-2 py-2 text-right text-xs font-semibold text-slate-700">Total / avg</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>Product Name</td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 text-sm">
                {r.productName || "—"}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right text-slate-400">—</td>
          </tr>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>Product code</td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 font-mono text-xs">
                {r.productCode || "—"}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right text-slate-400">—</td>
          </tr>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>KG</td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 text-right tabular-nums">
                {r.weightKg ? inr(r.weightKg, 2) : "—"}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right font-medium tabular-nums">{inr(totals.weightKg, 2)}</td>
          </tr>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>Yield</td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 text-right tabular-nums">
                {`${((r.yieldPctOverride ?? 0.63) * 100).toFixed(1)}%`}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right text-slate-400">—</td>
          </tr>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>AVG size</td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 text-right tabular-nums">
                {r.avgSizeOverride != null ? inr(r.avgSizeOverride, 2) : "—"}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right text-slate-400">—</td>
          </tr>
          <tr className="bg-slate-100/90">
            <td className={`${stickyLabel} bg-slate-100/90 font-medium`}>RM Usage KG</td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              return (
                <td key={r.lineNo} className="bg-slate-100/90 px-2 py-1.5 text-right tabular-nums">
                  {moneyOrDash(res, res?.rmUsageKg, { vol: true })}
                </td>
              );
            })}
            <td className="bg-slate-200/80 px-2 py-1.5 text-right font-semibold tabular-nums">{inr(totals.rmUsageKg, 0)}</td>
          </tr>
          <tr className="bg-slate-100/90">
            <td className={`${stickyLabel} bg-slate-100/90 font-medium`}>PCs</td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              return (
                <td key={r.lineNo} className="bg-slate-100/90 px-2 py-1.5 text-right tabular-nums">
                  {moneyOrDash(res, res?.pieces, { vol: true })}
                </td>
              );
            })}
            <td className="bg-slate-200/80 px-2 py-1.5 text-right font-semibold tabular-nums">{inr(totals.pieces, 0)}</td>
          </tr>
          <tr>
            <td className={`${stickyLabel} bg-white font-medium`}>
              RM Price Rs/kg
              {contractDate ? (
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">Contract: {contractDate}</span>
              ) : null}
            </td>
            {rows.map((r) => (
              <td key={r.lineNo} className="bg-white px-2 py-1.5 text-right tabular-nums">
                {r.rmPriceRs != null && r.rmPriceRs !== 0 ? inr(r.rmPriceRs, 2) : "—"}
              </td>
            ))}
            <td className="bg-slate-50 px-2 py-1.5 text-right text-slate-400">—</td>
          </tr>
          {flowMoneyRow(
            "Selling price Rs/kg",
            "bg-white",
            "bg-white",
            (lr) => lr.sellingPriceInrPerKg,
            inr(totals.avgInrPerKg, 2),
            { bold: true },
          )}
          <tr className="border-b border-transparent">
            <td
              colSpan={colCount}
              className="bg-white px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-700 underline decoration-slate-400 underline-offset-4"
            >
              Variable cost
            </td>
          </tr>
          {flowMoneyRow("Raw material meat", "bg-white", "bg-white", (lr) => lr.rmMeatRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow(
            "Packaging (incl. re-pack)",
            "bg-white",
            "bg-white",
            (lr) => lr.packagingRs,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow("Additive", "bg-white", "bg-white", (lr) => lr.additiveRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow("Harvesting", "bg-white", "bg-white", (lr) => lr.harvestingRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow(
            <>
              Processing charge <span className="text-slate-500">(variable block)</span>
            </>,
            "bg-slate-100/90",
            "bg-slate-100/90",
            (lr) => lr.processingChargeVar,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow("Commission", "bg-white", "bg-white", (lr) => lr.commissionRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow("Export shipment", "bg-white", "bg-white", (lr) => lr.exportShipmentRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow(
            "Clearance at destination port (DDP)",
            "bg-white",
            "bg-white",
            (lr) => lr.ddpRs,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow(
            <span className="inline-flex flex-wrap items-center gap-2">
              DBK
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900">{dbkPctLabel}</span>
            </span>,
            "bg-white",
            "bg-white",
            (lr) => lr.dbkRs,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow(
            <span className="inline-flex flex-wrap items-center gap-2">
              MEIS
              <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900">{meisPctLabel}</span>
            </span>,
            "bg-white",
            "bg-white",
            (lr) => lr.meisRs,
            <span className="text-slate-400">—</span>,
          )}

          {customVarUI.map((cr) => (
            <tr key={cr.id}>
              <td className={`${stickyLabel} bg-white align-top`}>
                <input
                  className="input mb-1 text-sm"
                  value={cr.label}
                  onChange={(e) => onVarLabelChange(cr.id, e.target.value)}
                />
                <button type="button" className="text-[10px] text-rose-700 hover:underline" onClick={() => onVarDelete(cr.id)}>
                  Remove row
                </button>
              </td>
              {rows.map((_, colIdx) => (
                <td key={colIdx} className="bg-white px-1 py-1 align-top">
                  <FlowNumInput value={cr.values[colIdx] ?? 0} onChange={(v) => onVarValueChange(cr.id, colIdx, v)} />
                </td>
              ))}
              <td className="bg-slate-50 px-2 py-1.5 text-right text-xs font-medium text-slate-700">
                {weightedCustomAvg(rows, cr.values)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={colCount} className="bg-slate-50/90 px-3 py-2">
              <button type="button" className="btn-secondary text-xs" onClick={onAddVarRow}>
                + Add variable cost row
              </button>
            </td>
          </tr>

          {flowMoneyRow(
            "Variable cost total",
            "bg-slate-100",
            "bg-slate-100",
            (lr) => lr.variableCostRs,
            inr(totals.variableCostRs, 2),
            { bold: true },
          )}

          <tr className="bg-orange-100/95">
            <td className={`${stickyLabel} bg-orange-100/95 font-semibold text-orange-950`}>Contribution margin Rs/kg</td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              const v = res?.contributionMarginRs;
              return (
                <td key={r.lineNo} className="bg-orange-100/95 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-orange-950">
                  {moneyOrDash(res, v)}
                </td>
              );
            })}
            <td className="bg-orange-200/90 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-orange-950">
              {inr(totals.contributionMarginRs, 2)}
            </td>
          </tr>
          <tr className="bg-orange-100/95">
            <td className={`${stickyLabel} bg-orange-100/95 font-semibold text-orange-950`}>Contribution profit (loss) &apos;000 Rs</td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              const v = res?.contributionProfit000;
              return (
                <td key={r.lineNo} className="bg-orange-100/95 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-orange-950">
                  {moneyOrDash(res, v)}
                </td>
              );
            })}
            <td className="bg-orange-200/90 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-orange-950">
              {inr(totals.contributionProfit000, 2)}
            </td>
          </tr>
          <tr className="border-b-2 border-orange-200 bg-orange-100/95">
            <td className={`${stickyLabel} bg-orange-100/95 font-semibold text-orange-950`}>Contribution margin %</td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              const v = res != null ? res.contributionMarginPct * 100 : undefined;
              return (
                <td key={r.lineNo} className="bg-orange-100/95 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-orange-950">
                  {moneyOrDash(res, v, { suffix: "%" })}
                </td>
              );
            })}
            <td className="bg-orange-200/90 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-orange-950">
              {inr(totals.contributionMarginPct * 100, 2)}%
            </td>
          </tr>

          <tr>
            <td
              colSpan={colCount}
              className="bg-white px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-700 underline decoration-slate-400 underline-offset-4"
            >
              Fixed cost
            </td>
          </tr>
          {flowMoneyRow(
            "Processing charge",
            "bg-white",
            "bg-white",
            (lr) => lr.processingChargeFix,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow("Wage & salaries", "bg-white", "bg-white", (lr) => lr.wagesRs, <span className="text-slate-400">—</span>)}
          {flowMoneyRow(
            "Rental & insurance & other",
            "bg-white",
            "bg-white",
            (lr) => lr.rentalRs,
            <span className="text-slate-400">—</span>,
          )}
          {flowMoneyRow("Depreciation", "bg-white", "bg-white", (lr) => lr.depreciationRs, <span className="text-slate-400">—</span>)}

          {customFixUI.map((cr) => (
            <tr key={cr.id}>
              <td className={`${stickyLabel} bg-white align-top`}>
                <input
                  className="input mb-1 text-sm"
                  value={cr.label}
                  onChange={(e) => onFixLabelChange(cr.id, e.target.value)}
                />
                <button type="button" className="text-[10px] text-rose-700 hover:underline" onClick={() => onFixDelete(cr.id)}>
                  Remove row
                </button>
              </td>
              {rows.map((_, colIdx) => (
                <td key={colIdx} className="bg-white px-1 py-1 align-top">
                  <FlowNumInput value={cr.values[colIdx] ?? 0} onChange={(v) => onFixValueChange(cr.id, colIdx, v)} />
                </td>
              ))}
              <td className="bg-slate-50 px-2 py-1.5 text-right text-xs font-medium text-slate-700">
                {weightedCustomAvg(rows, cr.values)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={colCount} className="bg-slate-50/90 px-3 py-2">
              <button type="button" className="btn-secondary text-xs" onClick={onAddFixRow}>
                + Add fixed cost row
              </button>
            </td>
          </tr>

          {flowMoneyRow(
            "Fixed cost total",
            "bg-slate-100",
            "bg-slate-100",
            (lr) => lr.fixedCostRs,
            inr(totals.fixedCostRs, 2),
            { bold: true },
          )}
          {flowMoneyRow(
            "Total cost",
            "bg-slate-100",
            "bg-slate-100",
            (lr) => lr.totalCostRs,
            inr(totals.totalCostRs, 2),
            { bold: true },
          )}

          <tr className="bg-emerald-100/90">
            <td className={`${stickyLabel} bg-emerald-100/90 font-semibold text-emerald-950`}>
              Profit (loss) before Admin &amp; selling exp — Rs/kg
            </td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              const v = res?.profitBeforeAdminRs;
              return (
                <td key={r.lineNo} className="bg-emerald-100/90 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-emerald-950">
                  {moneyOrDash(res, v)}
                </td>
              );
            })}
            <td className="bg-emerald-200/85 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-emerald-950">
              {inr(totals.profitBeforeAdminRs, 2)}
            </td>
          </tr>
          <tr className="bg-emerald-100/90">
            <td className={`${stickyLabel} bg-emerald-100/90 font-semibold text-emerald-950`}>
              Profit (loss) before Admin &amp; selling exp — &apos;000 Rs
            </td>
            {rows.map((r) => {
              const res = resultByLine[r.lineNo];
              const v = res?.profitBeforeAdmin000;
              return (
                <td key={r.lineNo} className="bg-emerald-100/90 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-emerald-950">
                  {moneyOrDash(res, v)}
                </td>
              );
            })}
            <td className="bg-emerald-200/85 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-emerald-950">
              {inr(totals.profitBeforeAdmin000, 2)}
            </td>
          </tr>
          {flowMoneyRow(
            "Profit % (on selling price)",
            "bg-emerald-50",
            "bg-emerald-50",
            (lr) => lr.profitPct * 100,
            `${inr(totals.profitPct * 100, 2)}%`,
            { suffix: "%", good: true },
          )}
        </tbody>
      </table>
    </div>
  );
}
