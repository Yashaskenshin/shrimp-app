"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toaster";
import { addPlant, renamePlant, togglePlantActive, deletePlant } from "@/app/actions/plants";

interface Plant {
  id: string;
  name: string;
  active: boolean;
}

export function PlantsCard({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, start] = useTransition();

  function handleAdd() {
    if (!newName.trim()) return;
    start(async () => {
      const res = await addPlant(newName);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Plant added");
      setNewName("");
      router.refresh();
    });
  }

  function startEdit(p: Plant) {
    setEditingId(p.id);
    setEditName(p.name);
  }

  function saveEdit(id: string) {
    start(async () => {
      const res = await renamePlant(id, editName);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Renamed");
      setEditingId(null);
      router.refresh();
    });
  }

  function handleToggle(id: string, active: boolean) {
    start(async () => {
      await togglePlantActive(id, active);
      router.refresh();
    });
  }

  function handleDelete(p: Plant) {
    if (!confirm(`Delete plant "${p.name}"? Existing quotes that reference it by name will keep their text but the dropdown will no longer offer it.`)) return;
    start(async () => {
      await deletePlant(p.id);
      toast.success("Deleted");
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Processing plants</h2>
        <span className="text-xs text-slate-500">{plants.filter((p) => p.active).length} active · {plants.length} total</span>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Active plants appear in the quote editor&apos;s <strong>Plant</strong> dropdown and feed the processing-charge lookup. Inactive plants stay in old quotes but are hidden from the dropdown.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          className="input max-w-xs"
          placeholder="New plant name (e.g. NELO)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button className="btn-primary" disabled={busy || !newName.trim()} onClick={handleAdd}>
          + Add plant
        </button>
      </div>

      {plants.length === 0 ? (
        <p className="text-sm text-slate-500">No plants yet — add one above or run the seed.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {plants.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={p.active}
                    onChange={(e) => handleToggle(p.id, e.target.checked)}
                  />
                  <span className="sr-only">Active</span>
                </label>
                {editingId === p.id ? (
                  <input
                    autoFocus
                    className="input max-w-xs"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className={`font-medium ${p.active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                    {p.name}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-2 text-sm">
                {editingId === p.id ? (
                  <>
                    <button className="text-emerald-700 hover:underline" disabled={busy} onClick={() => saveEdit(p.id)}>Save</button>
                    <button className="text-slate-500 hover:underline" onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="text-slate-600 hover:underline" onClick={() => startEdit(p)}>Rename</button>
                    <button className="text-rose-700 hover:underline" onClick={() => handleDelete(p)}>Delete</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
