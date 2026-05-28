/**
 * Seed assumptions with defaults from the original Excel and import the
 * master product list directly out of "Cost sheet format - Shrimps.xlsx".
 *
 * Run with:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import * as XLSX from "xlsx";
/** Full DB row for the Processing charge sheet — distinct from the runtime lookup type. */
interface ProcessingChargeDbRow {
  plant: string;
  productG: string;
  product: string;
  freezeType: string;
  packSize: string;
  countSize: string;
  rsPerKg: number;
}

const prisma = new PrismaClient();

const ASSUMPTIONS = [
  { key: "rm_buffer_per_kg",         label: "RM buffer (added to RM price)", value: 2,      unit: "Rs/kg", group: "cost" },
  { key: "harvesting_factor_per_kg", label: "Harvesting factor (Rs/kg @ yield 1)", value: 9.9, unit: "factor", group: "cost" },
  { key: "packaging_per_kg",         label: "Packaging (incl. re-pack)", value: 8,        unit: "Rs/kg", group: "cost" },
  { key: "additive_per_kg",          label: "Additive",                   value: 6.5,      unit: "Rs/kg", group: "cost" },
  { key: "commission_per_kg",        label: "Commission",                 value: 0,        unit: "Rs/kg", group: "cost" },
  { key: "export_shipment_per_kg",   label: "Export shipment",            value: 25,       unit: "Rs/kg", group: "cost" },
  { key: "ddp_per_kg",               label: "Clearance at destination (DDP)", value: 0,    unit: "Rs/kg", group: "cost" },
  { key: "dbk_pct",                  label: "DBK %",                      value: 0.03,     unit: "%",     group: "duty" },
  { key: "meis_pct",                 label: "MEIS %",                     value: 0.025,    unit: "%",     group: "duty" },
  { key: "dbk_meis_basis_pct",       label: "DBK/MEIS basis % of selling", value: 0.98,    unit: "%",     group: "duty" },
  { key: "processing_charge_per_kg", label: "Processing charge",          value: 70,       unit: "Rs/kg", group: "fixed" },
  { key: "wages_per_kg",             label: "Wages & salaries",           value: 4.9632,   unit: "Rs/kg", group: "fixed" },
  { key: "rental_per_kg",            label: "Rental / Insurance / Other", value: 0,        unit: "Rs/kg", group: "fixed" },
  { key: "depreciation_per_kg",      label: "Depreciation",               value: 0.1141,   unit: "Rs/kg", group: "fixed" },
];

// Look for the workbook — checks project root first (committed to repo),
// then one level above (legacy local dev layout).
function findWorkbook(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "Cost sheet format - Shrimps.xlsx"),
    path.resolve(__dirname, "../../Cost sheet format - Shrimps.xlsx"),
    path.resolve(process.cwd(), "../Cost sheet format - Shrimps.xlsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

interface MasterRow {
  code: string;
  name: string;
  rmAvgSize?: number;
  stdYieldPct?: number;
  sizeBand?: string;
}

function importMaster(file: string): MasterRow[] {
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets["master"];
  if (!sheet) throw new Error("'master' sheet not found");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  // Header row is index 0. Columns:
  //   0 Product code | 1 len | 2 Product description | 3 len<40
  //   4 RM avg.size  | 5 STD.Yield % | 6 size | 7 Check
  const out: MasterRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const code = r[0];
    if (!code || typeof code !== "string") continue;
    const trimmed = code.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push({
      code: trimmed,
      name: typeof r[2] === "string" ? r[2].trim() : trimmed,
      rmAvgSize: typeof r[4] === "number" ? r[4] : undefined,
      stdYieldPct: typeof r[5] === "number" ? r[5] : undefined,
      sizeBand: r[6] != null ? String(r[6]).trim() : undefined,
    });
  }
  return out;
}

/** Rows from sheet "Processing charge" (cols Plant … Rs/kg). */
function importProcessingChargeRates(file: string): ProcessingChargeDbRow[] {
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets["Processing charge"];
  if (!sheet) {
    console.log("  No 'Processing charge' sheet — skip.");
    return [];
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const out: ProcessingChargeDbRow[] = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const plant = r[1];
    if (plant == null || String(plant).trim() === "") continue;
    const productG = r[2] != null ? String(r[2]).trim() : "";
    const product = r[3] != null ? String(r[3]).trim() : "";
    const freezeType = r[4] != null ? String(r[4]).trim() : "";
    const packSize = r[5] != null ? String(r[5]).trim() : "";
    const countSize = r[6] != null ? String(r[6]).trim() : "";
    const charge = r[10];
    const rsPerKg = typeof charge === "number" ? charge : Number(charge);
    if (!Number.isFinite(rsPerKg)) continue;
    out.push({
      plant: String(plant).trim(),
      productG,
      product,
      freezeType,
      packSize,
      countSize,
      rsPerKg,
    });
  }
  return out;
}

async function main() {
  console.log("Seeding assumptions...");
  for (const a of ASSUMPTIONS) {
    await prisma.assumption.upsert({
      where: { key: a.key },
      create: a,
      // Never overwrite value — user may have edited it via the UI.
      // Only sync display metadata so label/unit/group stay current.
      update: { label: a.label, unit: a.unit, group: a.group },
    });
  }
  console.log(`  ${ASSUMPTIONS.length} assumptions OK`);

  const file = findWorkbook();
  if (!file) {
    console.log("Master Excel not found, skipping product import.");
    return;
  }
  console.log(`Importing master from: ${file}`);
  const master = importMaster(file);
  const pcRows = importProcessingChargeRates(file);
  if (pcRows.length) {
    await prisma.processingChargeRate.deleteMany();
    await prisma.processingChargeRate.createMany({
      data: pcRows.map((p) => ({
        plant: p.plant,
        productG: p.productG,
        product: p.product,
        freezeType: p.freezeType,
        packSize: p.packSize,
        countSize: p.countSize,
        rsPerKg: p.rsPerKg,
      })),
    });
    console.log(`  ${pcRows.length} processing-charge rates imported.`);

    // Seed Plant master from the distinct plant values on the processing sheet.
    const plantNames = Array.from(
      new Set(pcRows.map((p) => p.plant.trim()).filter(Boolean)),
    );
    for (const name of plantNames) {
      await prisma.plant.upsert({
        where: { name },
        create: { name },
        update: {}, // preserve user-toggled active flag
      });
    }
    console.log(`  ${plantNames.length} plants OK.`);
  }
  let imported = 0;
  for (const m of master) {
    await prisma.product.upsert({
      where: { code: m.code },
      create: m,
      update: m,
    });
    imported++;
  }
  console.log(`  ${imported} products imported.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
