import { prisma } from "@/lib/db";
import { ProductTable } from "./ProductTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { code: "asc" } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Products (Master)</h1>
        <p className="text-sm text-slate-500">
          Edit shrimp SKUs used in cost-sheet lookups. {products.length} entries.
        </p>
      </div>
      <ProductTable
        products={products.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          rmAvgSize: p.rmAvgSize,
          stdYieldPct: p.stdYieldPct,
          sizeBand: p.sizeBand,
          category: p.category,
          packDefault: p.packDefault,
          notes: p.notes,
          active: p.active,
        }))}
      />
    </div>
  );
}
