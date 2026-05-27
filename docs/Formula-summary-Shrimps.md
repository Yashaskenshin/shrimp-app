# Excel formula summary (companion to the web app)

This note reflects the workbook **`Formula_Summary_Shrimps.xlsx`** in the project root (next to `Cost sheet format - Shrimps.xlsx`). That file is a **formula inventory**, not a second calculator—it lists every formula, its type, and cross-sheet references so we can track parity with `lib/calc.ts` and the quote UI.

## Workbook structure

| Sheet | Role |
|--------|------|
| **Summary** | Per-sheet counts: how many formulas, which function families, and a high-level “cross-sheet” hint. |
| **Cross-Sheet Links** | Explicit **From → To** dependencies with counts. |
| **All Formulas** | One row per formula: sheet, cell, formula text, classified type, optional cross-sheet name. |

## Counts (from Summary)

| Sheet | Formulas (approx.) | Formula types (as tagged) | Cross-sheet (summary column) |
|--------|---------------------|----------------------------|--------------------------------|
| **Maintain** | 436 | Arithmetic, IF, IFERROR, SUM/SUMPRODUCT, VLOOKUP | **master** |
| **Processing charge** | 61 | Arithmetic | None (self-contained grid) |
| **master** | 234 | VLOOKUP | None |
| **Sheet1** | 27 | Arithmetic, VLOOKUP | **master** |
| **TOTAL** | 758 | — | — |

## Cross-sheet connectors (from Cross-Sheet Links)

| Dependency | Formula count |
|------------|---------------|
| **Maintain → master** | 48 |
| **Sheet1 → master** | 7 |

So the **live cost block** on **Maintain** depends on **master** for product attributes (via `VLOOKUP` into `master!$B:$H`, with `IFERROR`). **Sheet1** also reads **master** (seven formulas). The **Processing charge** sheet is largely **arithmetic** on its own grid; **Maintain**’s variable processing line is the bridge the summary workbook does *not* classify as a cross-sheet link (it is still a **logical** connector in the business model).

## Important formula patterns (from All Formulas)

1. **USD/INR — `GOOGLEFINANCE`**  
   Exported as `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(K4)"), …)` on cells such as **Maintain `K3`**, **`J4`**.  
   **Web app:** manual **FX rate** on the quote (no live Google Finance).

2. **Product master — `VLOOKUP` + `IFERROR`**  
   Examples: `=IFERROR(VLOOKUP(E10,master!$B:$H,3,FALSE),0)` and column **7** for other fields.  
   **Web app:** product pick loads name, yield, pcs/kg, pack, etc. from the seeded **Product** table (same role as `master`).

3. **Weighted averages — `SUMPRODUCT` / `SUM`**  
   Pattern like `=SUMPRODUCT(E27:P27,E37:P37)/Q27` (weights × row / total kg).  
   **Web app:** `computeQuote` totals use the same **kg-weighted** logic for per-kg averages (e.g. avg INR/kg). However, **margin %** uses `Σ contribution / Σ revenue` (not a kg-weighted average of per-line percentages) to match the correct financial definition.

4. **Processing charge sheet**  
   Formulas are tagged **Arithmetic** — every row has the same two-column pattern:  
   - **K** = base Rs/kg (manual entry, e.g. `45`)  
   - **L** = `=K` (ex-GST rate, identical to K)  
   - **M** = `=L × 1.18` (incl. 18% GST, e.g. `53.10`)  
   Columns **I / J** (`1st step: HO→HL`, `2nd step: HL→Peel`) are placeholders — all 30 rows in this workbook leave them blank.  
   **Web app:** rates are **imported on seed** into `ProcessingChargeRate.rsPerKg` (the L value).
   The quote editor resolves **variable** processing Rs/kg from **plant + freeze (optional) + pack + product name/code** (`lib/processingLookup.ts`). The DB schema also stores `productG` and `countSize` from the sheet but the lookup does not use them — only `plant`, `freezeType`, `packSize`, and `product` are matched.
   A quote-level toggle **`Quote.processingChargeWithGst`** ("Include 18% GST") multiplies the lookup result by 1.18 to match Excel's **M** column.
   **Fixed** processing still comes from global assumptions only.

5. **Commission / fan from one cell**  
   Not always visible as a separate “connector” row in the summary export; behaviour in the full workbook can fan one input across columns.  
   **Web app:** global **commission Rs/kg** (assumptions), optional **Commission Rs/kg (this quote)** on the quote header (fans to all lines), and optional **per-line** override.

## Where this maps in code

| Excel area | Code / UI |
|------------|-----------|
| Maintain rows ~24–60 | `lib/calc.ts` (`computeLine` / `computeQuote`) |
| master VLOOKUPs | `prisma/seed.ts` + product pick in `QuoteEditor` |
| SUMPRODUCT-style totals | Totals object on `QuoteResult` in `calc.ts` |
| GOOGLEFINANCE | Quote header **FX** field |
| Processing charge sheet | `ProcessingChargeRate` (L col, ex-GST) + `lib/processingLookup.ts` (auto-lookup w/ optional `× 1.18` to match M col); fixed block = assumptions |

## Regenerating a dump (optional)

If you update the Excel file and want a fresh text listing:

```bash
cd "…/Praful trades"
py -3 inspect_xlsx.py   # currently points at Cost sheet; adjust WB_PATH or duplicate script for Formula_Summary_Shrimps.xlsx
```

---

**Note on Stock cost:** Excel row 36 ("Stock cost Rs/kg") is stored in the DB (`QuoteLine.stockCostRs`) for legacy compatibility but is not exposed as an editable field in the UI and is excluded from all cost totals — matching Excel's own `SUM(E37:E46)` which skips row 36.

---

*Last reviewed May 2026.*
