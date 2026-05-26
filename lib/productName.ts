/**
 * Helpers for parsing the master product names used across the cost sheet.
 *
 * Real samples (from the seeded master table):
 *   "VA  PDTL Block TR Export 13/15  6x2.0KG"
 *   "VA PDTO IQF T NB 16/20 5X2LB"
 *   "VA HL EZ IQF T NB 13/15 10X2LB"
 *   "VA HLSO BLOCK AA TW 13/15 12X900G"
 *   "VA HLKSO BLOCK NB 8/12 6X1.8KG"
 *
 * Three pieces matter to the UI:
 *  - **Category** — short prefix used to group the product picker (e.g. "VA PDTL").
 *  - **Size band** — e.g. "13/15" (already stored in `Product.sizeBand`).
 *  - **Pack**     — last pack-like token, e.g. `6x2.0KG` / `10X2LB` / `1x10. KG`.
 */

/** Matches the size band token "<n>/<n>" appearing inside the product name. */
const SIZE_BAND_RE = /\b(\d{1,3})\/(\d{1,3})\b/;

/**
 * Matches typical pack tokens, e.g. `6x2.0KG`, `10X2LB`, `12X900G`, `1x10. KG`
 * (Excel / master sometimes puts a full stop before the unit).
 *
 * We intentionally allow either:
 *   - weight glued to unit: `2.0KG`
 *   - weight then optional `.` and spaces then unit: `10. KG`
 */
const PACK_RE =
  /\b(\d{1,3})\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)(?:\s*\.\s*|\s*)(KG|LBS|LB|G)\b/gi;

/**
 * Parse the pack-size descriptor from a product name.
 *
 * If several pack-like tokens exist (rare), the **last** match wins — that is
 * usually the true pack at the end of the description (after the count size).
 */
export function parsePackFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  let last: RegExpExecArray | null = null;
  PACK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PACK_RE.exec(name)) !== null) {
    last = m;
  }
  if (!last) return null;
  const count = last[1];
  const weight = last[2];
  const unit = last[3];
  return `${count}x${weight}${unit.toUpperCase()}`;
}

/**
 * Extract a short grouping label for the product picker.
 *
 * Rule: take everything BEFORE the size band, keep the first two tokens.
 * Special case: when the second token is "HL", keep a third token so we can
 * distinguish e.g. "VA HL EZ" from a generic "VA HL".
 */
export function extractProductCategory(
  name: string | null | undefined,
): string {
  if (!name || !name.trim()) return "Other";
  const sizeIdx = name.search(SIZE_BAND_RE);
  const prefix = (sizeIdx > 0 ? name.slice(0, sizeIdx) : name).trim();
  const tokens = prefix.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "Other";
  if (tokens.length === 1) return tokens[0];
  const take = tokens[1]?.toUpperCase() === "HL" ? 3 : 2;
  return tokens.slice(0, take).join(" ");
}

export interface NamedProduct {
  code: string;
  name: string;
}

/**
 * Group products by `extractProductCategory(name)` and return entries sorted by
 * category then name. Stable order makes the picker deterministic.
 */
export function groupProductsByCategory<P extends NamedProduct>(
  products: P[],
): { category: string; items: P[] }[] {
  const map = new Map<string, P[]>();
  for (const p of products) {
    const cat = extractProductCategory(p.name);
    const arr = map.get(cat) ?? [];
    arr.push(p);
    map.set(cat, arr);
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({
      category,
      items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
