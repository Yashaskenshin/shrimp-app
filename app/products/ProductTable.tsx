"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toaster";
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
  const toast = useToast();
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

  function handleToggleActive(p: P, checked: boolean) {
    start(async () => {
      await activateProduct(p.id, checked);
      toast.success(checked ? `${p.code} activated` : `${p.code} deactivated`);
      router.refresh();
    });
  }

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
        <button
          className="btn-primary"
          onClick={() => setEditing({ id: "", code: "", name: "", rmAvgSize: null, stdYieldPct: null, sizeBand: null, category: null, packDefault: null, notes: null, active: true })}
        >
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
                    disabled={busy}
                    onChange={(e) => handleToggleActive(p, e.target.checked)}
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
        {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No products match.</p>}
      </div>

      {editing && (
        <ProductDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); toast.success(msg); router.refresh(); }}
          onError={(msg) => toast.error(msg)}
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
  onError,
  busy,
  startSave,
}: {
  initial: P;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
  busy: boolean;
  startSave: (cb: () => Promise<void>) => void;
}) {
  const [p, setP] = useState<P>(initial);

  function handleSave() {
    startSave(async () => {
      try {
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
        onSaved(initial.id ? `${p.code} updated` : `${p.code} created`);
      } catch {
        onError("Save failed — please try again");
      }
    });
  }

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
            <input
              type="number"
              className="input input-num"
              value={p.rmAvgSize ?? ""}
              onChange={(e) => setP({ ...p, rmAvgSize: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <div>
            <label className="label">Std yield % (e.g. 63)</label>
            <input
              type="number"
              step={0.1}
              className="input input-num"
              placeholder="Enter 0–100"
              value={p.stdYieldPct != null ? p.stdYieldPct * 100 : ""}
              onChange={(e) => setP({ ...p, stdYieldPct: e.target.value ? Number(e.target.value) / 100 : null })}
            />
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
            onClick={handleSave}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
