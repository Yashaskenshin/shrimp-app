import { prisma } from "@/lib/db";
import { AssumptionsForm } from "./AssumptionsForm";

export const dynamic = "force-dynamic";

export default async function AssumptionsPage() {
  const rows = await prisma.assumption.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cost Assumptions</h1>
        <p className="text-sm text-slate-500">
          These defaults apply to every new quote. Existing draft quotes pick them up live;
          approved quotes are snapshotted and unaffected.
        </p>
      </div>
      <AssumptionsForm rows={rows.map((r) => ({ id: r.id, key: r.key, label: r.label, value: r.value, unit: r.unit, group: r.group, notes: r.notes }))} />
    </div>
  );
}
