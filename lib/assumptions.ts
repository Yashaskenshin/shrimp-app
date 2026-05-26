import { prisma } from "@/lib/db";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/calc";

export const ASSUMPTION_KEYS: Record<string, keyof Assumptions> = {
  rm_buffer_per_kg: "rmBufferPerKg",
  harvesting_factor_per_kg: "harvestingFactorPerKg",
  packaging_per_kg: "packagingPerKg",
  additive_per_kg: "additivePerKg",
  commission_per_kg: "commissionPerKg",
  export_shipment_per_kg: "exportShipmentPerKg",
  ddp_per_kg: "ddpPerKg",
  dbk_pct: "dbkPct",
  meis_pct: "meisPct",
  dbk_meis_basis_pct: "dbkMeisBasisPct",
  processing_charge_per_kg: "processingChargePerKg",
  wages_per_kg: "wagesPerKg",
  rental_per_kg: "rentalPerKg",
  depreciation_per_kg: "depreciationPerKg",
};

export async function loadAssumptions(): Promise<Assumptions> {
  const rows = await prisma.assumption.findMany();
  const a: Assumptions = { ...DEFAULT_ASSUMPTIONS };
  for (const r of rows) {
    const k = ASSUMPTION_KEYS[r.key];
    if (k) (a as unknown as Record<string, number>)[k] = r.value;
  }
  return a;
}
