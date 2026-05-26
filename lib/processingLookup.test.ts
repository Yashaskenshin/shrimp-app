import { lookupProcessingChargeVar, type ProcessingChargeRow } from "./processingLookup";

const table: ProcessingChargeRow[] = [
  {
    plant: "NELO",
    productG: "HO",
    product: "HOSO",
    freezeType: "Block",
    packSize: "1.8Kg/2.0Kg",
    countSize: "All size",
    rsPerKg: 45,
  },
  {
    plant: "NELO",
    productG: "PD",
    product: "PDTO",
    freezeType: "Block",
    packSize: "1.8Kg/2.0Kg/4Lbs",
    countSize: "All size",
    rsPerKg: 53,
  },
];

const v = lookupProcessingChargeVar(table, {
  plant: "NELO",
  freezeType: "Block",
  productName: "HOSO BLOCK 16/20",
  productCode: "X1",
  pack: "1.8Kg/2.0Kg",
});
if (v !== 45) throw new Error(`expected 45 got ${v}`);

const v2 = lookupProcessingChargeVar(table, {
  plant: "NELO",
  freezeType: null,
  productName: "Frozen PDTO something",
  productCode: "Y",
  pack: "4Lbs",
});
if (v2 !== 53) throw new Error(`expected 53 got ${v2}`);

const vGst = lookupProcessingChargeVar(table, {
  plant: "NELO",
  freezeType: "Block",
  productName: "HOSO BLOCK 16/20",
  productCode: "X1",
  pack: "1.8Kg/2.0Kg",
  withGst: true,
});
const expected = 45 * 1.18;
if (Math.abs((vGst ?? 0) - expected) > 1e-9) {
  throw new Error(`expected ${expected} (45 × 1.18) got ${vGst}`);
}

const vNoMatch = lookupProcessingChargeVar(table, {
  plant: "OTHER_PLANT",
  freezeType: "Block",
  productName: "HOSO",
  productCode: "X1",
  pack: "1.8Kg/2.0Kg",
});
if (vNoMatch !== undefined) {
  throw new Error(`expected undefined for no-plant-match, got ${vNoMatch}`);
}

console.log("processingLookup.test OK");
