import { prisma } from "@/lib/db";
import { AssumptionsForm } from "./AssumptionsForm";
import { PlantsCard } from "./PlantsCard";

export const dynamic = "force-dynamic";

export default async function AssumptionsPage() {
  const [rows, plants] = await Promise.all([
    prisma.assumption.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] }),
    prisma.plant.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Assumptions & Masters</h1>
        <p className="text-sm text-slate-500">
          These defaults apply to every new quote. Existing draft quotes pick them up live;
          approved quotes are snapshotted and unaffected.
        </p>
      </div>
      <PlantsCard
        plants={plants.map((p) => ({ id: p.id, name: p.name, active: p.active }))}
      />
      <AssumptionsForm rows={rows.map((r) => ({ id: r.id, key: r.key, label: r.label, value: r.value, unit: r.unit, group: r.group, notes: r.notes }))} />
    </div>
  );
}
