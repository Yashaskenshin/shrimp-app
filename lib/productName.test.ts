import {
  parsePackFromName,
  extractProductCategory,
  groupProductsByCategory,
} from "./productName";

function eq<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(actual)}`);
  }
}

eq(parsePackFromName("VA  PDTL Block TR Export 13/15  6x2.0KG"), "6x2.0KG", "pack 6x2.0KG");
eq(parsePackFromName("VA PDTO IQF T NB 16/20 5X2LB"), "5x2LB", "pack 5X2LB");
eq(parsePackFromName("VA HL EZ IQF T NB 13/15 10X2LB"), "10x2LB", "pack 10X2LB");
eq(parsePackFromName("VA HLSO IQF TREAFW/FC7% 31/35 1x10. KG"), "1x10KG", "pack 1x10. KG");
eq(
  parsePackFromName("dummy prefix 6x2.0KG trailer"),
  "6x2.0KG",
  "pack last-of-two wins",
);
eq(parsePackFromName("Bare product no pack"), null, "pack none");

eq(extractProductCategory("VA  PDTL Block TR Export 13/15  6x2.0KG"), "VA PDTL", "cat PDTL");
eq(extractProductCategory("VA PDTO IQF T NB 16/20 5X2LB"), "VA PDTO", "cat PDTO");
eq(extractProductCategory("VA HL EZ IQF T NB 13/15 10X2LB"), "VA HL EZ", "cat HL EZ");
eq(extractProductCategory("VA HLSO BLOCK AA TW 13/15 12X900G"), "VA HLSO", "cat HLSO");
eq(extractProductCategory("VA HLKSO BLOCK NB 8/12 6X1.8KG"), "VA HLKSO", "cat HLKSO");
eq(extractProductCategory(""), "Other", "cat empty");

const groups = groupProductsByCategory([
  { code: "A1", name: "VA PDTO IQF T NB 16/20 5X2LB" },
  { code: "B1", name: "VA PDTL Block TR Export 13/15 6x2.0KG" },
  { code: "A2", name: "VA PDTO IQF T NB 21/25 5X2LB" },
  { code: "C1", name: "VA HL EZ IQF T NB 13/15 10X2LB" },
]);
eq(
  groups.map((g) => `${g.category}:${g.items.length}`),
  ["VA HL EZ:1", "VA PDTL:1", "VA PDTO:2"],
  "grouping",
);

console.log("productName.test OK");
