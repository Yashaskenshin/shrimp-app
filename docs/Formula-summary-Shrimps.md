# Excel formula summary (companion to the web app)

This note reflects the workbook **`Cost sheet format - Shrimps.xlsx`** (committed to the repo root). It is the source workbook for the web app's calculation kernel and seed data.

---

## Workbook sheet roles

| Sheet | Role in the web app |
|--------|------|
| **Maintain** | Main cost-sheet. Rows 24–60 map directly to `lib/calc.ts` (`computeLine` / `computeQuote`). |
| **master** | Product master (code, name, yield %, avg pcs/kg, size band). Imported on seed into the `Product` table via `prisma/seed.ts`. |
| **Processing charge** | Plant × product × pack × freeze-type → Rs/kg grid. Imported on seed into `ProcessingChargeRate`. Matched at runtime by `lib/processingLookup.ts`. |
| **Sheet1** | Summary totals referencing `master`. Not imported; informational only. |

---

## Formula counts (for reference)

| Sheet | Approx. formula count | Key formula types |
|--------|---------------------|----------------------------|
| **Maintain** | 436 | Arithmetic, IF, IFERROR, SUM/SUMPRODUCT, VLOOKUP |
| **Processing charge** | 61 | Arithmetic |
| **master** | 234 | VLOOKUP |
| **Sheet1** | 27 | Arithmetic, VLOOKUP |

---

## Key formula patterns and their web-app equivalents

### 1. USD/INR — `GOOGLEFINANCE`
Excel: `=IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(K4)"), …)` on cells **Maintain K3 / J4**.  
**Web app:** manual **FX rate** field on the quote header (no live feed). The `default_fx_rate` assumption sets the default for new quotes and can be changed in Assumptions.

### 2. Product master — `VLOOKUP` + `IFERROR`
Excel: `=IFERROR(VLOOKUP(E10, master!$B:$H, 3, FALSE), 0)` and similar.  
**Web app:** selecting a product in the combobox auto-fills name, yield %, avg pcs/kg, size band, and default pack from the seeded `Product` table — the same role as `master`.

### 3. Weighted averages — `SUMPRODUCT` / `SUM`
Excel: `=SUMPRODUCT(E27:P27, E37:P37) / Q27` (weights × row / total kg).  
**Web app:** `computeQuote` totals use the same kg-weighted logic for per-kg averages (e.g. avg INR/kg). **Margin %** uses `Σ contribution / Σ revenue` — not a kg-weighted average of per-line percentages — to match the correct financial definition.

### 4. Processing charge sheet
The sheet has a two-column rate pattern per row:
- **K** = base Rs/kg (manual entry, e.g. `45`)
- **L** = `=K` (ex-GST, identical to K)
- **M** = `=L × 1.18` (incl. 18% GST, e.g. `53.10`)

**Web app:**  
- Seed imports the **L** (ex-GST) value into `ProcessingChargeRate.rsPerKg`.
- At runtime `lib/processingLookup.ts` matches **plant + freeze type (optional) + pack size + product name** to find the rate.
- A per-quote toggle **Processing charge + GST** (`Quote.processingChargeWithGst`) multiplies the lookup result by 1.18 to use Excel's **M** column.
- **Fixed** processing (`processing_charge_per_kg`) always comes from global assumptions; it is not from this sheet.

### 5. Commission
One cell fans across all product columns (one Rs/kg → all lines).  
**Web app:** global `commission_per_kg` assumption, optional **Commission Rs/kg override** on the quote header (fans to all lines), optional per-line override in the cost-flow table.

### 6. DBK / MEIS drawbacks
Excel: percentage applied to a % of the selling price (`dbk_meis_basis_pct × usd_inr × price`).  
**Web app:** `dbkPct`, `meisPct`, `dbkMeisBasisPct` in assumptions; subtracted in `computeLine` as negative variable costs.

### 7. Harvesting factor
Excel: `harvestingFactor × (1 / yieldPct)` — increases as yield decreases (more raw material needed).  
**Web app:** `harvestingFactorPerKg / yieldPct` in `computeLine`. If yield is null / 0 the result is `0` and a warning fires.

---

## Code → Excel mapping

| Excel area | Code location |
|------------|-----------|
| Maintain rows 24–60 | `lib/calc.ts` — `computeLine` and `computeQuote` |
| master VLOOKUP | `prisma/seed.ts` import + product combobox in `QuoteEditor` |
| SUMPRODUCT-style totals | `QuoteResult.totals` in `lib/calc.ts` |
| GOOGLEFINANCE | Quote header FX field; `default_fx_rate` assumption |
| Processing charge sheet | `ProcessingChargeRate` table + `lib/processingLookup.ts` |
| Commission fan | `Quote.commissionOverridePerKg` or `assumptions.commissionPerKg` |

---

## Seeded assumption keys

| DB key | Label | Default | Unit | Group |
|--------|-------|---------|------|-------|
| `rm_buffer_per_kg` | RM buffer | 2 | Rs/kg | cost |
| `harvesting_factor_per_kg` | Harvesting factor (@ yield 1) | 9.9 | factor | cost |
| `packaging_per_kg` | Packaging | 8 | Rs/kg | cost |
| `additive_per_kg` | Additive | 6.5 | Rs/kg | cost |
| `commission_per_kg` | Commission | 0 | Rs/kg | cost |
| `export_shipment_per_kg` | Export shipment | 25 | Rs/kg | cost |
| `ddp_per_kg` | Clearance at destination (DDP) | 0 | Rs/kg | cost |
| `dbk_pct` | DBK % | 0.03 | % | duty |
| `meis_pct` | MEIS % | 0.025 | % | duty |
| `dbk_meis_basis_pct` | DBK/MEIS basis % of selling | 0.98 | % | duty |
| `processing_charge_per_kg` | Processing charge (fixed) | 70 | Rs/kg | fixed |
| `wages_per_kg` | Wages & salaries | 4.9632 | Rs/kg | fixed |
| `rental_per_kg` | Rental / Insurance / Other | 0 | Rs/kg | fixed |
| `depreciation_per_kg` | Depreciation | 0.1141 | Rs/kg | fixed |
| `default_fx_rate` | Default USD/INR rate (new quotes) | 83 | Rs/$ | factor |

All assumptions are editable live at `/assumptions`. Approved quotes snapshot the values in use at approval time.

---

## Notes on stock cost

Excel row 36 ("Stock cost Rs/kg") is stored in `QuoteLine.stockCostRs` for legacy compatibility but is not exposed as an editable field and is excluded from all cost totals — matching Excel's own `SUM(E37:E46)` which skips row 36.

---

*Last reviewed May 2026.*
