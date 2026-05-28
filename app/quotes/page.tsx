import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-violet-100 text-violet-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  SENT: "bg-teal-100 text-teal-700",
};

const STATUSES = ["DRAFT", "SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "SENT"];
const PAGE_SIZE = 25;

const SORT_FIELDS: Record<string, object> = {
  poNo:         { poNo: "asc" },
  poNoDesc:     { poNo: "desc" },
  customer:     { customer: "asc" },
  customerDesc: { customer: "desc" },
  status:       { status: "asc" },
  statusDesc:   { status: "desc" },
  updatedAt:    { updatedAt: "asc" },
  updatedAtDesc: { updatedAt: "desc" },
};

function buildSortHref(col: string, currentSort: string | undefined, currentDir: string | undefined, q?: string, status?: string) {
  const isActive = currentSort === col;
  const nextDir = isActive && currentDir !== "desc" ? "desc" : "asc";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  params.set("sort", col);
  params.set("dir", nextDir);
  return { href: `/quotes?${params.toString()}`, isActive, dir: isActive ? (currentDir !== "desc" ? "asc" : "desc") : null };
}

function SortTh({ col, label, sort, dir, q, status }: {
  col: string; label: string;
  sort?: string; dir?: string; q?: string; status?: string;
}) {
  const s = buildSortHref(col, sort, dir, q, status);
  return (
    <th>
      <Link
        href={s.href}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${s.isActive ? "font-semibold text-slate-900" : "text-slate-500"}`}
      >
        {label}
        {s.isActive && <span className="text-[10px]">{s.dir === "desc" ? "↓" : "↑"}</span>}
      </Link>
    </th>
  );
}

export default async function QuotesList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const { q, status, sort, dir, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const where = {
    ...(q?.trim()
      ? {
          OR: [
            { poNo: { contains: q.trim(), mode: "insensitive" as const } },
            { customer: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && STATUSES.includes(status) ? { status: status as never } : {}),
  };

  const sortKey = sort && dir ? `${sort}${dir === "desc" ? "Desc" : ""}` : "";
  const orderBy = SORT_FIELDS[sortKey] ?? { createdAt: "desc" };

  const [quotes, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { lines: true } },
        lines: { select: { weightKg: true, usdPerKg: true } },
      },
    }),
    prisma.quote.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    params.set("page", String(p));
    return `/quotes?${params.toString()}`;
  }

  function exportHref() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    return `/quotes/export?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <div className="flex gap-2">
          <Link href={exportHref()} className="btn-secondary text-sm">
            ↓ Export CSV
          </Link>
          <Link href="/quotes/new" className="btn-primary">+ New Quote</Link>
        </div>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search PO or customer…"
            className="input w-56"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className="btn-secondary">Search</button>
          {(q || status) && (
            <Link href="/quotes" className="btn-secondary">Clear</Link>
          )}
        </form>

        <div className="flex flex-wrap gap-1">
          <Link
            href={q ? `/quotes?q=${encodeURIComponent(q)}` : "/quotes"}
            className={`rounded px-2 py-1 text-xs font-medium ${!status ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/quotes?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded px-2 py-1 text-xs font-medium ${status === s ? `${STATUS_COLORS[s]} ring-1 ring-current ring-offset-1` : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {total === 0 ? "No quotes" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} quote${total === 1 ? "" : "s"}`}
          </span>
          {totalPages > 1 && (
            <span>{page} / {totalPages} pages</span>
          )}
        </div>

        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">No quotes found.</p>
        ) : (
          <table className="calc w-full text-sm">
            <thead>
              <tr className="text-left">
                <SortTh col="poNo" label="PO" sort={sort} dir={dir} q={q} status={status} />
                <SortTh col="customer" label="Customer" sort={sort} dir={dir} q={q} status={status} />
                <SortTh col="status" label="Status" sort={sort} dir={dir} q={q} status={status} />
                <th className="text-right text-slate-500">FX</th>
                <th className="text-right text-slate-500">Rev USD&apos;000</th>
                <th className="text-right text-slate-500">Lines</th>
                <SortTh col="updatedAt" label="Updated" sort={sort} dir={dir} q={q} status={status} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const revUsd = q.lines.reduce((s, l) => s + l.usdPerKg * l.weightKg, 0) / 1000;
                return (
                  <tr key={q.id}>
                    <td className="text-left font-medium">{q.poNo || <span className="text-slate-400">—</span>}</td>
                    <td className="text-left">{q.customer || "—"}</td>
                    <td className="text-left">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="tabular-nums text-right">{q.fxRate.toFixed(2)}</td>
                    <td className="tabular-nums text-right">
                      {revUsd > 0
                        ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(revUsd)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="text-right">{q._count.lines}</td>
                    <td className="text-slate-500">{q.updatedAt.toLocaleDateString("en-IN")}</td>
                    <td>
                      <Link href={`/quotes/${q.id}`} className="font-medium text-emerald-700 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <Link
              href={pageHref(page - 1)}
              className={`btn-secondary text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              ← Prev
            </Link>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7
                  ? i + 1
                  : page <= 4
                  ? i + 1
                  : page >= totalPages - 3
                  ? totalPages - 6 + i
                  : page - 3 + i;
                return (
                  <Link
                    key={p}
                    href={pageHref(p)}
                    className={`rounded px-2.5 py-1 text-xs font-medium ${p === page ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
            <Link
              href={pageHref(page + 1)}
              className={`btn-secondary text-sm ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
