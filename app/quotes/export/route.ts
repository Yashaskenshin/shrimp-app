import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const STATUSES = ["DRAFT", "SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "SENT"];

function esc(v: string | null | undefined) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";

  const where = {
    ...(q.trim()
      ? {
          OR: [
            { poNo: { contains: q.trim(), mode: "insensitive" as const } },
            { customer: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && STATUSES.includes(status) ? { status: status as never } : {}),
  };

  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { lines: { select: { weightKg: true, usdPerKg: true } } },
  });

  const header = [
    "PO No", "Customer", "Country", "Status", "Plant", "Freeze Type",
    "Incoterm", "Payment", "USD/INR", "Revenue USD",
    "Port Loading", "Port Destination", "Contract Date", "Created",
  ];

  const rows = quotes.map((q) => {
    const revUsd = q.lines.reduce((s, l) => s + l.usdPerKg * l.weightKg, 0);
    return [
      esc(q.poNo),
      esc(q.customer),
      esc(q.country),
      esc(q.status),
      esc(q.plant),
      esc(q.freezeType),
      esc(q.incoterm),
      esc(q.payment),
      String(q.fxRate),
      revUsd.toFixed(2),
      esc(q.portLoading),
      esc(q.portDestination),
      q.contractDate ? q.contractDate.toISOString().slice(0, 10) : "",
      q.createdAt.toISOString().slice(0, 10),
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `quotes-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
