"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  computeQuote,
  type Assumptions,
  type LineResult,
} from "@/lib/calc";
import {
  saveQuote,
  transitionQuote,
  deleteQuote,
  type QuoteAction,
  type SaveLine,
  type SaveQuotePayload,
} from "@/app/actions/quotes";
import {
  amountForLine,
  parseCustomCosts,
  serializeCustomCosts,
  type CustomCostRow,
} from "@/lib/customCosts";
import { buildQuoteComputeInput } from "@/lib/quoteCompute";
import type { ProcessingChargeRow } from "@/lib/processingLookup";
import {
  parsePackFromName,
  groupProductsByCategory,
} from "@/lib/productName";
import { ExcelCostFlowTable } from "./ExcelCostFlowTable";

interface QuoteHeader {
  id: string;
  poNo: string | null;
  contractDate: string | null;
  revisedDate: string | null;
  customer: string | null;
  country: string | null;
  incoterm: string | null;
  payment: string | null;
  plant: string | null;
  /** Matches Excel Processing charge sheet (optional). */
  freezeType: string | null;
  /** Overrides global commission Rs/kg for this quote when set. */
  commissionOverridePerKg: number | null;
  /** Use Excel "Processing charge/KG +GST" (M column = L × 1.18) instead of ex-GST. */
  processingChargeWithGst: boolean;
  portLoading: string | null;
  portLoadingDate: string | null;
  portDestination: string | null;
  portDestDate: string | null;
  fxRate: number;
  status: string;
  notes: string | null;
  preparedBy: string | null;
  verifiedBy: string | null;
  approvedBy: string | null;
}

interface LineRow {
  id?: string;
  lineNo: number;
  productCode: string | null;
  productName: string | null;
  sizeBand: string | null;
  pack: string | null;
  weightKg: number;
  usdPerKg: number;
  stockFgKg: number;
  stockCostRs: number | null;
  rmPriceRs: number | null;
  yieldPctOverride: number | null;
  avgSizeOverride: number | null;
  packagingRs: number | null;
  additiveRs: number | null;
  processingChargeRs: number | null;
  commissionRs: number | null;
  exportShipmentRs: number | null;
  ddpRs: number | null;
}

interface ProductOpt {
  code: string;
  name: string;
  rmAvgSize: number | null;
  stdYieldPct: number | null;
  sizeBand: string | null;
  packDefault: string | null;
}

interface EventRow {
  id: string;
  action: string;
  actor: string | null;
  comment: string | null;
  createdAt: string;
}

/** Editable custom cost row — `values` parallel to `rows` array order. */
interface CustomCostUI {
  id: string;
  label: string;
  values: number[];
}

interface Props {
  quote: QuoteHeader;
  lines: LineRow[];
  products: ProductOpt[];
  assumptions: Assumptions;
  events: EventRow[];
  customVariableCosts: CustomCostRow[];
  customFixedCosts: CustomCostRow[];
  /** From DB / seed — used to auto-fill variable processing Rs/kg (Excel connector). */
  processingRates: ProcessingChargeRow[];
}

const MAX_LINES = 12;
const DEFAULT_LINES = 4;
const MIN_LINES = 1;

const inr = (n: number, digits = 2) =>
  isFinite(n)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(n)
    : "—";

function blankRow(lineNo: number): LineRow {
  return {
    lineNo,
    productCode: null,
    productName: null,
    sizeBand: null,
    pack: null,
    weightKg: 0,
    usdPerKg: 0,
    stockFgKg: 0,
    stockCostRs: null,
    rmPriceRs: null,
    yieldPctOverride: null,
    avgSizeOverride: null,
    packagingRs: null,
    additiveRs: null,
    processingChargeRs: null,
    commissionRs: null,
    exportShipmentRs: null,
    ddpRs: null,
  };
}

/** Normalise DB lines → 1..n, pad to at least DEFAULT_LINES (up to MAX). */
function normalizeRows(saved: LineRow[]): LineRow[] {
  const sorted = [...saved].sort((a, b) => a.lineNo - b.lineNo);
  if (sorted.length === 0) {
    return Array.from({ length: DEFAULT_LINES }, (_, i) => blankRow(i + 1));
  }
  const renumbered = sorted.map((r, i) => {
    const trimmedPack = r.pack?.trim();
    const pack = trimmedPack || parsePackFromName(r.productName) || null;
    return { ...r, lineNo: i + 1, pack };
  });
  const out = [...renumbered];
  while (out.length < DEFAULT_LINES && out.length < MAX_LINES) {
    out.push(blankRow(out.length + 1));
  }
  return out.slice(0, MAX_LINES);
}

function renumberRows(arr: LineRow[]): LineRow[] {
  return arr.map((r, i) => ({ ...r, lineNo: i + 1 }));
}

function resizeCustomValues(ui: CustomCostUI[], len: number): CustomCostUI[] {
  return ui.map((r) => {
    const v = [...r.values];
    while (v.length < len) v.push(0);
    return { ...r, values: v.slice(0, len) };
  });
}

function hydrateCustom(
  db: CustomCostRow[],
  sellRows: LineRow[],
): CustomCostUI[] {
  return db.map((r) => ({
    id: r.id,
    label: r.label,
    values: sellRows.map((l) => amountForLine(r, l.lineNo)),
  }));
}

function persistCustom(ui: CustomCostUI[], sellRows: LineRow[]): CustomCostRow[] {
  return serializeCustomCosts(
    ui.map((r) => ({
      id: r.id,
      label: r.label,
      byLineNo: Object.fromEntries(
        sellRows.map((row, i) => [String(row.lineNo), Number(r.values[i]) || 0]),
      ),
    })),
  );
}

export function QuoteEditor(props: Props) {
  const router = useRouter();

  const [header, setHeader] = useState<QuoteHeader>(props.quote);
  const [rows, setRows] = useState<LineRow[]>(() => normalizeRows(props.lines));

  const [customVarUI, setCustomVarUI] = useState<CustomCostUI[]>(() => {
    const r = normalizeRows(props.lines);
    return resizeCustomValues(hydrateCustom(props.customVariableCosts, r), r.length);
  });
  const [customFixUI, setCustomFixUI] = useState<CustomCostUI[]>(() => {
    const r = normalizeRows(props.lines);
    return resizeCustomValues(hydrateCustom(props.customFixedCosts, r), r.length);
  });

  const [whatIfUsd, setWhatIfUsd] = useState(1);
  const [whatIfRm, setWhatIfRm] = useState(1);
  const [whatIfFx, setWhatIfFx] = useState(1);

  const [saving, startSave] = useTransition();
  const [statusBusy, startStatus] = useTransition();

  const prevLineCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLineCountRef.current === rows.length) return;
    prevLineCountRef.current = rows.length;
    setCustomVarUI((cv) => resizeCustomValues(cv, rows.length));
    setCustomFixUI((cf) => resizeCustomValues(cf, rows.length));
  }, [rows.length]);

  const calcInput = useMemo(() => {
    const customVariableCosts = persistCustom(customVarUI, rows);
    const customFixedCosts = persistCustom(customFixUI, rows);
    const lineLike = rows
      .filter((r) => r.weightKg > 0 || r.usdPerKg > 0 || r.productCode)
      .map((r) => ({
        lineNo: r.lineNo,
        productCode: r.productCode,
        productName: r.productName,
        sizeBand: r.sizeBand,
        pack: r.pack,
        weightKg: r.weightKg,
        usdPerKg: r.usdPerKg * whatIfUsd,
        stockFgKg: r.stockFgKg,
        yieldPctOverride: r.yieldPctOverride,
        avgSizeOverride: r.avgSizeOverride,
        rmPriceRs: (r.rmPriceRs ?? 0) * whatIfRm,
        packagingRs: r.packagingRs,
        additiveRs: r.additiveRs,
        processingChargeRs: r.processingChargeRs,
        commissionRs: r.commissionRs,
        exportShipmentRs: r.exportShipmentRs,
        ddpRs: r.ddpRs,
        stockCostRs: r.stockCostRs,
      }));
    return buildQuoteComputeInput({
      fxRate: header.fxRate * whatIfFx,
      assumptions: props.assumptions,
      customVariableCosts,
      customFixedCosts,
      lines: lineLike,
      plant: header.plant,
      freezeType: header.freezeType,
      commissionOverridePerKg: header.commissionOverridePerKg,
      processingChargeWithGst: header.processingChargeWithGst,
      processingTable: props.processingRates,
    });
  }, [
    rows,
    header.fxRate,
    header.plant,
    header.freezeType,
    header.commissionOverridePerKg,
    header.processingChargeWithGst,
    whatIfUsd,
    whatIfRm,
    whatIfFx,
    props.assumptions,
    props.processingRates,
    customVarUI,
    customFixUI,
  ]);

  const result = useMemo(() => computeQuote(calcInput), [calcInput]);

  const resultByLine: Record<number, LineResult | undefined> = {};
  for (const lr of result.lines) resultByLine[lr.lineNo] = lr;

  // Product picker is grouped by short category prefix (VA PDTO, VA PDTL, VA HL EZ, …).
  const productGroups = useMemo(
    () => groupProductsByCategory(props.products),
    [props.products],
  );

  function updateRow(i: number, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function pickProduct(i: number, code: string) {
    setRows((prev) => {
      const row = prev[i];
      if (!code) {
        return prev.map((r, idx) =>
          idx === i
            ? {
                ...r,
                productCode: null,
                productName: null,
                sizeBand: null,
                pack: null,
              }
            : r,
        );
      }
      const p = props.products.find((x) => x.code === code);
      if (!p) {
        return prev.map((r, idx) => (idx === i ? { ...r, productCode: code } : r));
      }
      const derivedPack = p.packDefault || parsePackFromName(p.name);
      return prev.map((r, idx) =>
        idx === i
          ? {
              ...r,
              productCode: p.code,
              productName: p.name,
              sizeBand: p.sizeBand,
              pack: r.pack || derivedPack || null,
              yieldPctOverride: row.yieldPctOverride ?? p.stdYieldPct ?? 0.63,
              avgSizeOverride: row.avgSizeOverride ?? p.rmAvgSize ?? 0,
            }
          : r,
      );
    });
  }

  function addSellLine() {
    setRows((prev) => {
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, blankRow(prev.length + 1)];
    });
  }

  function deleteSellLine(index: number) {
    setRows((prev) => {
      if (prev.length <= MIN_LINES) return prev;
      return renumberRows(prev.filter((_, idx) => idx !== index));
    });
  }

  function addCustomVariableRow() {
    setCustomVarUI((prev) => [
      ...prev,
      { id: `cv_${Date.now()}`, label: "New variable cost", values: Array(rows.length).fill(0) },
    ]);
  }
  function deleteCustomVariableRow(id: string) {
    setCustomVarUI((prev) => prev.filter((r) => r.id !== id));
  }
  function addCustomFixedRow() {
    setCustomFixUI((prev) => [
      ...prev,
      { id: `cf_${Date.now()}`, label: "New fixed cost", values: Array(rows.length).fill(0) },
    ]);
  }
  function deleteCustomFixedRow(id: string) {
    setCustomFixUI((prev) => prev.filter((r) => r.id !== id));
  }

  function updateCustomValue(
    kind: "var" | "fix",
    rowId: string,
    colIndex: number,
    val: number,
  ) {
    const setter = kind === "var" ? setCustomVarUI : setCustomFixUI;
    setter((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              values: r.values.map((v, j) => (j === colIndex ? val : v)),
            }
          : r,
      ),
    );
  }

  function handleSave() {
    startSave(async () => {
      const cv = persistCustom(customVarUI, rows);
      const cf = persistCustom(customFixUI, rows);
      const payload: SaveQuotePayload = {
        id: header.id,
        poNo: header.poNo,
        contractDate: header.contractDate,
        revisedDate: header.revisedDate,
        customer: header.customer,
        country: header.country,
        incoterm: header.incoterm,
        payment: header.payment,
        plant: header.plant,
        freezeType: header.freezeType,
        commissionOverridePerKg: header.commissionOverridePerKg,
        processingChargeWithGst: header.processingChargeWithGst,
        portLoading: header.portLoading,
        portLoadingDate: header.portLoadingDate,
        portDestination: header.portDestination,
        portDestDate: header.portDestDate,
        fxRate: header.fxRate,
        notes: header.notes,
        preparedBy: header.preparedBy,
        verifiedBy: header.verifiedBy,
        approvedBy: header.approvedBy,
        customVariableCosts: cv,
        customFixedCosts: cf,
        lines: rows.map<SaveLine>((r) => ({
          lineNo: r.lineNo,
          productCode: r.productCode,
          productName: r.productName,
          sizeBand: r.sizeBand,
          pack: r.pack,
          weightKg: r.weightKg,
          usdPerKg: r.usdPerKg,
          // Excel keeps a separate "Stock FG" cell but it always equals the
          // line weight in this workflow, so we mirror it on save and never
          // expose it as its own input.
          stockFgKg: r.weightKg,
          // "Stock cost Rs/kg" was a free cell in the legacy sheet that wasn't
          // wired into the cost build-up — keep it null so old rows clear.
          stockCostRs: null,
          rmPriceRs: r.rmPriceRs,
          yieldPctOverride: r.yieldPctOverride,
          avgSizeOverride: r.avgSizeOverride,
          packagingRs: r.packagingRs,
          additiveRs: r.additiveRs,
          processingChargeRs: r.processingChargeRs,
          commissionRs: r.commissionRs,
          exportShipmentRs: r.exportShipmentRs,
          ddpRs: r.ddpRs,
        })),
      };
      await saveQuote(payload);
      router.refresh();
    });
  }

  function handleAction(action: QuoteAction) {
    startStatus(async () => {
      await transitionQuote(header.id, action);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Quote</div>
          <h1 className="text-2xl font-semibold">
            {header.poNo || <span className="text-slate-400">Unsaved PO</span>}
            <span className="ml-3 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {header.status}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
          {header.status === "DRAFT" && (
            <button onClick={() => handleAction("SUBMIT")} disabled={statusBusy} className="btn-secondary">
              Submit
            </button>
          )}
          {header.status === "SUBMITTED" && (
            <button onClick={() => handleAction("VERIFY")} disabled={statusBusy} className="btn-secondary">
              Verify
            </button>
          )}
          {(header.status === "VERIFIED" || header.status === "SUBMITTED") && (
            <button onClick={() => handleAction("APPROVE")} disabled={statusBusy} className="btn-primary">
              Approve & Snapshot
            </button>
          )}
          {header.status !== "DRAFT" && header.status !== "APPROVED" && (
            <button onClick={() => handleAction("REVERT_DRAFT")} disabled={statusBusy} className="btn-secondary">
              Revert to Draft
            </button>
          )}
          {header.status !== "REJECTED" && (
            <button onClick={() => handleAction("REJECT")} disabled={statusBusy} className="btn-danger">
              Reject
            </button>
          )}
          <Link href={`/quotes/${header.id}/pdf`} target="_blank" className="btn-secondary">
            PDF / Print
          </Link>
          <form
            action={async () => {
              await deleteQuote(header.id);
            }}
            onSubmit={(e) => {
              if (!confirm("Delete this quote?")) e.preventDefault();
            }}
          >
            <button type="submit" className="btn-danger">
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Field label="PO No">
          <input
            className="input"
            value={header.poNo ?? ""}
            onChange={(e) => setHeader({ ...header, poNo: e.target.value || null })}
          />
        </Field>
        <Field label="Customer">
          <input
            className="input"
            value={header.customer ?? ""}
            onChange={(e) => setHeader({ ...header, customer: e.target.value || null })}
          />
        </Field>
        <Field label="Country">
          <input
            className="input"
            value={header.country ?? ""}
            onChange={(e) => setHeader({ ...header, country: e.target.value || null })}
          />
        </Field>
        <Field label="Plant">
          <input
            className="input"
            value={header.plant ?? ""}
            onChange={(e) => setHeader({ ...header, plant: e.target.value || null })}
          />
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Same value as the Excel &quot;Processing charge&quot; sheet (e.g.{" "}
            <span className="font-medium text-slate-600">NELO</span>) — needed for variable
            processing Rs/kg to auto-fill.
          </p>
        </Field>
        <Field label="Freeze type (processing sheet)">
          <select
            className="input"
            value={header.freezeType ?? ""}
            onChange={(e) =>
              setHeader({ ...header, freezeType: e.target.value ? e.target.value : null })
            }
          >
            <option value="">Any (match pack + product only)</option>
            <option value="Block">Block</option>
            <option value="Semi IQF">Semi IQF</option>
            <option value="IQF">IQF</option>
          </select>
        </Field>
        <Field label="Commission Rs/kg (this quote)">
          <input
            type="number"
            step={0.01}
            className="input input-num"
            placeholder="Global default if empty"
            value={header.commissionOverridePerKg ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") setHeader({ ...header, commissionOverridePerKg: null });
              else {
                const n = Number(v);
                setHeader({
                  ...header,
                  commissionOverridePerKg: Number.isFinite(n) ? n : null,
                });
              }
            }}
          />
        </Field>
        <Field label="Processing charge basis">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={header.processingChargeWithGst}
              onChange={(e) =>
                setHeader({ ...header, processingChargeWithGst: e.target.checked })
              }
            />
            <span>Include 18% GST (Excel M col)</span>
          </label>
          <div className="mt-1 text-[11px] text-slate-500">
            Off = ex-GST (Excel L col). On = ex-GST × 1.18.
          </div>
        </Field>
        <Field label="Incoterm">
          <select
            className="input"
            value={header.incoterm ?? ""}
            onChange={(e) => setHeader({ ...header, incoterm: e.target.value || null })}
          >
            <option value="">—</option>
            {["FOB", "CIF", "CFR", "DDP", "EXW"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment">
          <input
            className="input"
            value={header.payment ?? ""}
            onChange={(e) => setHeader({ ...header, payment: e.target.value || null })}
          />
        </Field>
        <Field label="USD / INR">
          <input
            type="number"
            step="0.0001"
            className="input input-num"
            value={header.fxRate}
            onChange={(e) => setHeader({ ...header, fxRate: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Contract date">
          <input
            type="date"
            className="input"
            value={header.contractDate ? header.contractDate.slice(0, 10) : ""}
            onChange={(e) => setHeader({ ...header, contractDate: e.target.value || null })}
          />
        </Field>
        <Field label="Port of loading">
          <input
            className="input"
            value={header.portLoading ?? ""}
            onChange={(e) => setHeader({ ...header, portLoading: e.target.value || null })}
          />
        </Field>
        <Field label="Port of destination">
          <input
            className="input"
            value={header.portDestination ?? ""}
            onChange={(e) => setHeader({ ...header, portDestination: e.target.value || null })}
          />
        </Field>
        <Field label="Prepared by">
          <input
            className="input"
            value={header.preparedBy ?? ""}
            onChange={(e) => setHeader({ ...header, preparedBy: e.target.value || null })}
          />
        </Field>
        <Field label="Approved by">
          <input
            className="input"
            value={header.approvedBy ?? ""}
            onChange={(e) => setHeader({ ...header, approvedBy: e.target.value || null })}
          />
        </Field>
      </div>

      <div className="card">
        <h2 className="mb-4 text-base font-semibold">What-if (live, not saved)</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Slider label="Selling USD/kg" value={whatIfUsd} setValue={setWhatIfUsd} />
          <Slider label="RM Price (Rs/kg)" value={whatIfRm} setValue={setWhatIfRm} />
          <Slider label="USD/INR Rate" value={whatIfFx} setValue={setWhatIfFx} />
        </div>
      </div>

      {/* Sell information */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sell information</h2>
            <p className="text-sm text-slate-500">
              Pick the product code — name, size, pack, RM size and yield auto-fill from master.
              Enter the quoted <strong>USD/kg</strong>, the order <strong>weight</strong>, and your
              <strong> RM price</strong>. Adjust yield if this order needs a different value addition.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={addSellLine} disabled={rows.length >= MAX_LINES}>
              + Add line
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="calc-wide w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="w-10">#</th>
                <th className="min-w-[220px]">Code</th>
                <th className="min-w-[220px]">Product name</th>
                <th className="min-w-[110px]">Pack</th>
                <th className="min-w-[8.5rem]">Weight (kg)</th>
                <th className="min-w-[7.5rem]">USD / kg</th>
                <th className="min-w-[7rem]" title="From master (avg pieces per kg of raw material). Editable per line.">
                  RM size (avg pcs/kg)
                </th>
                <th className="min-w-[8.5rem]">RM price Rs/kg</th>
                <th className="min-w-[6.5rem]">Yield (%)</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const yPct = (r.yieldPctOverride ?? 0.63) * 100;
                return (
                  <tr key={`${r.lineNo}-${i}`}>
                    <td className="text-left text-slate-400">{r.lineNo}</td>
                    <td className="text-left">
                      <select
                        className="input"
                        value={r.productCode ?? ""}
                        onChange={(e) => pickProduct(i, e.target.value)}
                      >
                        <option value="">Select code…</option>
                        {productGroups.map((g) => (
                          <optgroup key={g.category} label={g.category}>
                            {g.items.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.code} — {p.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="text-left text-slate-700">{r.productName || ""}</td>
                    <td className="text-left text-slate-700">{r.pack || ""}</td>
                    <td>
                      <NumInput value={r.weightKg} onChange={(v) => updateRow(i, { weightKg: v })} />
                    </td>
                    <td>
                      <NumInput step={0.01} value={r.usdPerKg} onChange={(v) => updateRow(i, { usdPerKg: v })} />
                    </td>
                    <td>
                      <NumInput
                        value={r.avgSizeOverride ?? 0}
                        onChange={(v) => updateRow(i, { avgSizeOverride: v })}
                      />
                    </td>
                    <td>
                      <NumInput value={r.rmPriceRs ?? 0} onChange={(v) => updateRow(i, { rmPriceRs: v })} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <NumInput
                          step={0.1}
                          className="!min-w-[4.25rem]"
                          value={Math.round(yPct * 1000) / 1000}
                          onChange={(v) => updateRow(i, { yieldPctOverride: v / 100 })}
                        />
                        <span className="shrink-0 select-none text-xs text-slate-500">%</span>
                      </div>
                    </td>
                    <td className="text-left">
                      <button
                        type="button"
                        className="text-sm text-rose-700 hover:underline disabled:text-slate-400"
                        disabled={rows.length <= MIN_LINES}
                        onClick={() => deleteSellLine(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="text-left" colSpan={4}>
                  Total
                </td>
                <td>{inr(result.totals.weightKg)}</td>
                <td>{inr(result.totals.avgUsdPerKg, 2)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Computed totals — Excel rows 32/33 collapsed into a quick at-a-glance strip. */}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Total weight (kg)" value={inr(result.totals.weightKg, 0)} />
          <Tile label="Revenue (USD '000)" value={inr(result.totals.revenueUsd000)} />
          <Tile label="Revenue (INR '000)" value={inr(result.totals.revenueInr000)} />
          <Tile label="Weighted INR / kg" value={inr(result.totals.avgInrPerKg)} />
        </div>
      </div>

      {/* Cost build-up — Excel vertical flow (Description column + one column per line) */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Cost build-up (Excel flow)</h2>
          <p className="text-sm text-slate-500">
            Same top-to-bottom order as <strong>Cost sheet format - Shrimps.xlsx</strong>: selling block → variable cost → contribution (highlight) → fixed cost → profit (highlight). Scroll horizontally to compare lines. Use <strong>+ Add variable / fixed cost row</strong> for extra cost lines.
          </p>
        </div>
        <ExcelCostFlowTable
          rows={rows}
          resultByLine={resultByLine}
          totals={result.totals}
          assumptions={props.assumptions}
          contractDate={header.contractDate}
          customVarUI={customVarUI}
          customFixUI={customFixUI}
          onVarLabelChange={(id, label) =>
            setCustomVarUI((prev) => prev.map((x) => (x.id === id ? { ...x, label } : x)))
          }
          onVarValueChange={(id, colIdx, v) => updateCustomValue("var", id, colIdx, v)}
          onVarDelete={deleteCustomVariableRow}
          onAddVarRow={addCustomVariableRow}
          onFixLabelChange={(id, label) =>
            setCustomFixUI((prev) => prev.map((x) => (x.id === id ? { ...x, label } : x)))
          }
          onFixValueChange={(id, colIdx, v) => updateCustomValue("fix", id, colIdx, v)}
          onFixDelete={deleteCustomFixedRow}
          onAddFixRow={addCustomFixedRow}
        />

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">Excel parity notes</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
            <li>
              <strong>Variable processing Rs/kg</strong> needs a <strong>Plant</strong> in the header
              (Excel sheet column). It then matches the seeded <em>Processing charge</em> grid using{" "}
              plant + <strong>Freeze type</strong> (optional) + <strong>Pack</strong> + product text. Tick{" "}
              <em>Include 18% GST</em> to use Excel&apos;s <em>M</em> column (<code>L × 1.18</code>).
            </li>
            <li>
              <strong>Fixed processing Rs/kg</strong> (Excel row 52) always comes from global assumptions.
            </li>
            <li>
              <strong>Commission</strong>: use <em>Commission Rs/kg (this quote)</em> to fan one value for the whole PO (overrides global assumptions).
            </li>
            <li>
              <strong>USD/INR</strong> is entered manually (no GOOGLEFINANCE).
            </li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Revenue ('000 INR)" value={inr(result.totals.revenueInr000)} />
        <SummaryCard label="Total cost / kg" value={inr(result.totals.totalCostRs, 2)} suffix=" Rs" />
        <SummaryCard
          label="Profit ('000 INR)"
          value={inr(result.totals.profitBeforeAdmin000)}
          accent={result.totals.profitBeforeAdmin000 >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          label="Profit %"
          value={`${(result.totals.profitPct * 100).toFixed(2)}%`}
          accent={result.totals.profitPct >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="card">
        <h2 className="mb-2 text-base font-semibold">Audit log</h2>
        {props.events.length === 0 ? (
          <p className="text-sm text-slate-500">No events.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {props.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between border-b border-slate-100 py-2">
                <span className="font-medium text-slate-700">{e.action}</span>
                <span className="text-slate-500">{new Date(e.createdAt).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step = 1,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  className?: string;
}) {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      className={`input input-num min-w-[6.5rem] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
      value={safe}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

function Slider({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
}) {
  const pct = ((value - 1) * 100).toFixed(0);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span
          className={`tabular-nums ${value === 1 ? "text-slate-500" : Number(pct) > 0 ? "text-emerald-700" : "text-rose-700"}`}
        >
          {Number(pct) > 0 ? "+" : ""}
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={0.7}
        max={1.3}
        step={0.005}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
      <button type="button" onClick={() => setValue(1)} className="mt-1 text-xs text-slate-500 hover:text-slate-800">
        reset
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: "good" | "bad";
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${accent === "good" ? "text-emerald-700" : accent === "bad" ? "text-rose-700" : "text-slate-900"}`}
      >
        {value}
        {suffix}
      </div>
    </div>
  );
}

