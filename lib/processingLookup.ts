import type { LineInput } from "./calc";

/**
 * Mirrors the Excel **Processing charge** sheet lookup for variable processing Rs/kg.
 * Used when `QuoteLine.processingChargeRs` is null — user can still override per line.
 *
 * Excel stores **two** rates per row:
 *   - **L column** = base Rs/kg, ex-GST (e.g. 45)                  → `rsPerKg` (what we seed)
 *   - **M column** = `L × 1.18`, incl. 18% GST (e.g. 53.10)        → computed on the fly
 *
 * The web app honours this via `Quote.processingChargeWithGst`:
 *   - `false` (default) → return `rsPerKg` (matches Excel L column)
 *   - `true`            → return `rsPerKg × 1.18` (matches Excel M column)
 */

export type ProcessingChargeRow = {
  plant: string;
  product: string;
  freezeType: string;
  packSize: string;
  rsPerKg: number;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "").replace(/,/g, "");
}

function hay(name: string | null | undefined, code: string | null | undefined): string {
  return `${name ?? ""} ${code ?? ""}`.toUpperCase();
}

function packMatches(rowPack: string, linePack: string | null | undefined): boolean {
  const lp = norm(linePack);
  const rp = norm(rowPack);
  if (!lp) return true;
  if (!rp) return false;
  return rp.includes(lp) || lp.includes(rp);
}

function freezeMatches(rowFreeze: string, quoteFreeze: string | null | undefined): boolean {
  const qf = (quoteFreeze ?? "").trim();
  if (!qf) return true;
  return norm(rowFreeze) === norm(qf);
}

function plantMatches(rowPlant: string, quotePlant: string | null | undefined): boolean {
  const qp = (quotePlant ?? "").trim();
  if (!qp) return false;
  return norm(rowPlant) === norm(qp);
}

/**
 * Pick Rs/kg from the rate table. Returns `undefined` if nothing matches (caller uses 0).
 *
 * Matching strategy (pragmatic for messy pack strings):
 * - Require plant match.
 * - Optional freeze filter when quote has `freezeType`.
 * - Pack: substring match either direction when line pack is non-empty.
 * - Product: `productName`/`productCode` must contain the sheet **Product** token;
 *   prefer the **longest** matching token to avoid "PD" swallowing "PDTO".
 */
/** Excel "Processing charge/KG +GST" applies a flat 18% on top of the base rate. */
export const PROCESSING_GST_RATE = 0.18;

export function lookupProcessingChargeVar(
  table: ProcessingChargeRow[],
  input: {
    plant: string | null | undefined;
    freezeType: string | null | undefined;
    productName: string | null | undefined;
    productCode: string | null | undefined;
    pack: string | null | undefined;
    withGst?: boolean;
  },
): number | undefined {
  const h = hay(input.productName, input.productCode);
  if (!h.trim()) return undefined;

  const plantOk = (r: ProcessingChargeRow) => plantMatches(r.plant, input.plant);
  const freezeOk = (r: ProcessingChargeRow) => freezeMatches(r.freezeType, input.freezeType);
  const packOk = (r: ProcessingChargeRow) => packMatches(r.packSize, input.pack);

  const candidates = table.filter((r) => plantOk(r) && freezeOk(r) && packOk(r));
  if (!candidates.length) return undefined;

  const withProduct = candidates.filter((r) => {
    const p = r.product.trim().toUpperCase();
    return p.length > 0 && h.includes(p);
  });
  const pool = withProduct.length ? withProduct : candidates;

  pool.sort((a, b) => {
    const lp = b.product.trim().length - a.product.trim().length;
    if (lp !== 0) return lp;
    const lpack = b.packSize.trim().length - a.packSize.trim().length;
    if (lpack !== 0) return lpack;
    return b.rsPerKg - a.rsPerKg;
  });

  const best = pool[0];
  if (!Number.isFinite(best.rsPerKg)) return undefined;
  return input.withGst ? best.rsPerKg * (1 + PROCESSING_GST_RATE) : best.rsPerKg;
}

export function attachProcessingChargeLookups(
  lines: LineInput[],
  ctx: {
    plant: string | null | undefined;
    freezeType: string | null | undefined;
    withGst?: boolean;
  },
  table: ProcessingChargeRow[],
): LineInput[] {
  return lines.map((line) => ({
    ...line,
    processingChargeVarLookup: lookupProcessingChargeVar(table, {
      plant: ctx.plant,
      freezeType: ctx.freezeType,
      productName: line.productName ?? null,
      productCode: line.productCode ?? null,
      pack: line.pack ?? null,
      withGst: ctx.withGst,
    }),
  }));
}
