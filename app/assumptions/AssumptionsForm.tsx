"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAssumptions } from "@/app/actions/assumptions";

interface Row {
  id: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  group: string;
  notes: string | null;
}

const GROUP_LABELS: Record<string, string> = {
  cost: "Variable costs",
  duty: "Duties / drawback",
  fixed: "Fixed costs",
  factor: "Calculation factors",
};

export function AssumptionsForm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const r of rows) init[r.key] = r.value;
    return init;
  });
  const [busy, start] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const groups = Array.from(new Set(rows.map((r) => r.group)));

  function handleSave() {
    start(async () => {
      await updateAssumptions(state);
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g} className="card">
          <h2 className="mb-3 text-base font-semibold">{GROUP_LABELS[g] || g}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {rows.filter((r) => r.group === g).map((r) => (
              <div key={r.key}>
                <label className="label">{r.label} <span className="ml-1 font-normal text-slate-400">({r.unit})</span></label>
                <input
                  type="number"
                  step={r.unit === "%" ? 0.001 : 0.0001}
                  className="input input-num"
                  value={state[r.key] ?? r.value}
                  onChange={(e) => setState({ ...state, [r.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3">
        {savedAt && <span className="text-sm text-emerald-700">Saved at {savedAt}</span>}
        <button className="btn-primary" disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save assumptions"}
        </button>
      </div>
    </div>
  );
}
