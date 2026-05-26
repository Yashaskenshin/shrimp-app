import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function QuotesList() {
  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <Link href="/quotes/new" className="btn-primary">+ New Quote</Link>
      </div>

      <div className="card overflow-x-auto">
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">No quotes yet.</p>
        ) : (
          <table className="calc w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th>PO</th>
                <th>Customer</th>
                <th>Country</th>
                <th>Status</th>
                <th>FX</th>
                <th>Lines</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td className="text-left">{q.poNo || <span className="text-slate-400">—</span>}</td>
                  <td className="text-left">{q.customer || "—"}</td>
                  <td className="text-left">{q.country || "—"}</td>
                  <td className="text-left">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {q.status}
                    </span>
                  </td>
                  <td>{q.fxRate.toFixed(4)}</td>
                  <td>{q._count.lines}</td>
                  <td>{q.updatedAt.toLocaleDateString("en-IN")}</td>
                  <td>
                    <Link href={`/quotes/${q.id}`} className="font-medium text-emerald-700 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
