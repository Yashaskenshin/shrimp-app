"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertProduct, activateProduct } from "@/app/actions/products";

interface P {
  id: string;
  code: string;
  name: string;
  rmAvgSize: number | null;
  stdYieldPct: number | null;
  sizeBand: string | null;
  category: string | null;
  packDefault: string | null;
  notes: string | null;
  active: boolean;
}

export function ProductTable({ products }: { products: P[] }) {
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<P | null>(null);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return products.filter((p) => {
      if (!showInactive && !p.active) return false;
      if (!needle) return true;
      return p.code.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle);
    });
  }, [products, q, showInactive]);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3">
        <input
          className="input md:w-80"
          placeholder="Search code / name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setEditing({ id: "", code: "", name: "", rmAvgSize: null, stdYieldPct: 0.63, sizeBand: null, category: null, packDefault: null, notes: null, active: true })}>
          + New Product
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="calc w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Code</th>
              <th>Name</th>
              <th>Size</th>
              <th>Yield %</th>
              <th>Avg pcs/kg</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 500).map((p) => (
              <tr key={p.id}>
                <td className="text-left font-medium">{p.code}</td>
                <td className="text-left">{p.name}</td>
                <td className="text-left">{p.sizeBand || ""}</td>
                <td>{p.stdYieldPct !== null ? (p.stdYieldPct * 100).toFixed(1) : ""}</td>
                <td>{p.rmAvgSize ?? ""}</td>
                <td className="text-left">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) => start(async () => { await activateProduct(p.id, e.target.checked); router.refresh(); })}
                  />
                </td>
                <td>
                  <button className="text-emerald-700 hover:underline" onClick={() => setEditing(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 500 && <p className="mt-2 text-xs text-slate-500">Showing first 500 of {filtered.length}.</p>}
      </div>

      {editing && (
        <ProductDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
          busy={busy}
          startSave={start}
        />
      )}
    </div>
  );
}

function ProductDialog({
  initial,
  onClose,
  onSaved,
  busy,
  startSave,
}: {
  initial: P;
  onClose: () => void;
  onSaved: () => void;
  busy: boolean;
  startSave: (cb: () => void) => void;
}) {
  const [p, setP] = useState<P>(initial);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{initial.id ? "Edit product" : "New product"}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Code</label>
            <input className="input" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Name</label>
            <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Size band (e.g. 21/25)</label>
            <input className="input" value={p.sizeBand ?? ""} onChange={(e) => setP({ ...p, sizeBand: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Default pack</label>
            <input className="input" value={p.packDefault ?? ""} onChange={(e) => setP({ ...p, packDefault: e.target.value || null })} />
          </div>
          <div>
            <label className="label">RM avg pcs/kg</label>
            <input type="number" className="input input-num" value={p.rmAvgSize ?? 0} onChange={(e) => setP({ ...p, rmAvgSize: Number(e.target.value) || null })} />
          </div>
          <div>
            <label className="label">Std yield (0–1)</label>
            <input type="number" step={0.01} className="input input-num" value={p.stdYieldPct ?? 0} onChange={(e) => setP({ ...p, stdYieldPct: Number(e.target.value) || null })} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={p.notes ?? ""} onChange={(e) => setP({ ...p, notes: e.target.value || null })} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={busy || !p.code || !p.name}
            onClick={() =>
              startSave(async () => {
                await upsertProduct({
                  id: p.id || undefined,
                  code: p.code,
                  name: p.name,
                  rmAvgSize: p.rmAvgSize,
                  stdYieldPct: p.stdYieldPct,
                  sizeBand: p.sizeBand,
                  packDefault: p.packDefault,
                  notes: p.notes,
                  active: p.active,
                });
                onSaved();
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
