/** User-defined cost lines (Rs/kg) keyed by quote line number. */
export interface CustomCostRow {
  id: string;
  label: string;
  /** INR per kg for that product column (same meaning as Excel rows). */
  byLineNo: Record<string, number>;
}

export function parseCustomCosts(raw: unknown): CustomCostRow[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: CustomCostRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : randomId();
    const label = typeof o.label === "string" ? o.label : "Custom";
    const byLineNo =
      typeof o.byLineNo === "object" && o.byLineNo !== null && !Array.isArray(o.byLineNo)
        ? Object.fromEntries(
            Object.entries(o.byLineNo as Record<string, unknown>).map(([k, v]) => [
              k,
              Number(v) || 0,
            ]),
          )
        : {};
    out.push({ id, label, byLineNo });
  }
  return out;
}

function randomId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function amountForLine(row: CustomCostRow, lineNo: number): number {
  return row.byLineNo[String(lineNo)] ?? 0;
}

export function serializeCustomCosts(rows: CustomCostRow[]): CustomCostRow[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.label.trim() || "Custom",
    byLineNo: { ...r.byLineNo },
  }));
}
