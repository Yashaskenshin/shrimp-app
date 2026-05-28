"use client";

import { useState, useMemo } from "react";

interface RateRow {
  plant: string;
  product: string;
  freezeType: string;
  packSize: string;
  rsPerKg: number;
}

export function ProcessingRatesCard({ rates }: { rates: RateRow[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filterPlant, setFilterPlant] = useState("");

  const plants = useMemo(() => Array.from(new Set(rates.map((r) => r.plant))).sort(), [rates]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return rates.filter((r) => {
      if (filterPlant && r.plant !== filterPlant) return false;
      if (!needle) return true;
      return (
        r.product.toLowerCase().includes(needle) ||
        r.packSize.toLowerCase().includes(needle) ||
        r.freezeType.toLowerCase().includes(needle)
      );
    });
  }, [rates, q, filterPlant]);

  return (
    <div className="card">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <h2 className="text-base font-semibold">Processing charge rates</h2>
          <p className="mt-0.5 text-xs text-slate-500">{rates.length} rates loaded from Excel seed · read-only</p>
        </div>
        <span className="text-xs text-slate-400">{open ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-56"
              placeholder="Search product / pack / freeze…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="input w-40"
              value={filterPlant}
              onChange={(e) => setFilterPlant(e.target.value)}
            >
              <option value="">All plants</option>
              {plants.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {(q || filterPlant) && (
              <button className="btn-secondary text-xs" onClick={() => { setQ(""); setFilterPlant(""); }}>
                Clear
              </button>
            )}
            <span className="self-center text-xs text-slate-500">{filtered.length} of {rates.length} rates</span>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="calc w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th>Plant</th>
                  <th>Product</th>
                  <th>Freeze type</th>
                  <th>Pack size</th>
                  <th className="text-right">Rs/kg</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((r, i) => (
                  <tr key={i}>
                    <td className="text-left font-medium">{r.plant}</td>
                    <td className="text-left">{r.product}</td>
                    <td className="text-left text-slate-500">{r.freezeType || "—"}</td>
                    <td className="text-left text-slate-500">{r.packSize}</td>
                    <td className="font-semibold tabular-nums">{r.rsPerKg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <p className="px-3 py-2 text-xs text-slate-500">Showing first 300 — refine the search to see more.</p>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-slate-500">No rates match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
