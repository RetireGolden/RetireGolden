# Independent review, 2026-09-18 (slice seven follow-ups)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract at commit e5c84810 (the doc comments corrected after the #720 review). Scope: this directory's swr-rule-depletion-year (the other worksheet in the report lives in accounts-and-growth). The report covers both worksheets of this review; the verbatim output follows.

---

# Independent Worksheet Review Report

Review constraints observed: no files edited, no commands run, no engine implementation bodies read. Signatures and doc comments taken from the extract at commit e5c84810 only.

---

## Worksheet 1: `projection-summary-ending-after-tax-estate`

**Source:** `DOCS/calculations/accounts-and-growth/projection-summary-ending-after-tax-estate.md`

### 1. id

`projection-summary-ending-after-tax-estate`

### 2. Recomputed values (all cases)

**Identity (from Justification):**  
`endingAfterTaxEstate = endingNetWorth − endingEstateToCharity − endingEstateHeirTax`

**Case A — inputs from the worksheet table**

| Step | Operation | Result |
|---|---:|---:|
| Start | `endingNetWorth` | 812,345.67 |
| − charity | 812,345.67 − 25,000.00 | 787,345.67 |
| − heir tax | 787,345.67 − 73,210.11 | **714,135.56** |

**Case B — no charity destination (`endingEstateToCharity = 0`)**

| Step | Operation | Result |
|---|---:|---:|
| Start | `endingNetWorth` | 812,345.67 |
| − charity | 812,345.67 − 0.00 | 812,345.67 |
| − heir tax | 812,345.67 − 73,210.11 | **739,135.56** |

### 3. Match

| Case | Worksheet Expected | Recomputed | Match |
|---|---:|---:|---|
| A (with charity) | 714,135.56 | 714,135.56 | **yes** |
| B (no charity) | 739,135.56 | 739,135.56 | **yes** |

Difference: none.

### 4. Tolerance justification

Stated tolerance: absolute **$0.005**.

Both cases use inputs stated to the cent and produce exact cent results under ordinary decimal subtraction. An exact cent outcome does not *require* a tolerance band for correctness, but **$0.005 is justified** as a reporting bound when values may be represented in binary floating point (per the worksheet rationale and the half-cent ledger convention in the extract). No conflict.

### 5. Wrong readings — independent recomputation

| Wrong reading | Stated wrong value | Recomputed | Produces stated value? |
|---|---:|---:|---|
| Ignore charity ($25,000) | 739,135.56 | 812,345.67 − 73,210.11 = **739,135.56** | **yes** |
| Add heir tax instead of subtract (after charity subtraction) | 860,555.78 | (812,345.67 − 25,000.00) + 73,210.11 = 787,345.67 + 73,210.11 = **860,555.78** | **yes** |
| Subtract charity a second time (via heir-tax path) | 689,135.56 | 812,345.67 − 25,000.00 − 73,210.11 − 25,000.00 = **689,135.56** | **yes** |

All three wrong-reading values check.

### 6. Claim consistency with corrected doc comments

| Aspect | Worksheet | Extract (`ProjectionSummary.endingAfterTaxEstate`, `summarizeProjection` claim) | Consistent? |
|---|---|---|---|
| Identity | `endingNetWorth − endingEstateToCharity − endingEstateHeirTax` | Same formula in `ProjectionSummary` doc comment | **yes** |
| Charity handling | Charity carve-out subtracted even though reported separately | Comment: charity subtracted from figure and reported in `endingEstateToCharity` | **yes** |
| Collapsed case | No charity → net worth minus heir tax only | Comment: “With no charity destination this is net worth minus heir tax” | **yes** |
| Units | Nominal dollars | Nominal plan dollars throughout projection types | **yes** |
| Timing / domain | Completed horizon summary; finite components | Horizon summary fields on `ProjectionSummary` | **yes** |
| Depletion gate (N/A here) | — | — | — |

Estate identity correctly subtracts **both** charity and heir tax.

### 7. Verdict

**approve**

---

## Worksheet 2: `swr-rule-depletion-year`

**Source:** `DOCS/calculations/optimizer-and-comparisons/swr-rule-depletion-year.md`

### 1. id

`swr-rule-depletion-year`

### 2. Recomputed values (all cases)

**Gate (from Justification):**  
`depletionYear = min{ y : shortfall_y > 0.005 }` if nonempty, else `null`  
Constant: `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005` (extract: `projection/moneyTolerance.ts`)

**Case A — inputs from the worksheet table**

| Year | Shortfall | `shortfall > 0.005`? |
|---:|---:|---|
| 2039 | 0.004 | no (0.004 ≤ 0.005) |
| 2040 | 0.00 | no |
| 2041 | 125.00 | **yes** |
| 2042 | 2,400.00 | yes |

Qualifying set: `{2041, 2042}` → minimum = **2041**

**Case B — every shortfall zero**

Qualifying set: `{}` → **null**

**Case C — sole nonzero shortfall exactly 0.005 in one year**

For that year: `0.005 > 0.005` is **false** (strict inequality)  
Qualifying set: `{}` → **null**

### 3. Match

| Case | Worksheet Expected | Recomputed | Match |
|---|---|---:|---|
| A (table inputs) | 2041 | 2041 | **yes** |
| B (all zero) | null | null | **yes** |
| C (only 0.005) | null | null | **yes** |

Difference: none.

### 4. Tolerance justification

Depletion year is an **integer calendar year** (or `null`). No dollar tolerance is stated for the year itself, which is appropriate: integers should match exactly.

The **$0.005** gate is the ledger’s annual residual budget (`ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`), not a tolerance on the year output. Using it as a strict depletion threshold is **justified** by the extract and worksheet justification.

### 5. Wrong readings — independent recomputation

| Wrong reading | Stated wrong value | Recomputed | Produces stated value? |
|---|---|---:|---|
| Any shortfall > 0 is depletion | 2039 | First year with shortfall > 0 is 2039 (0.004 > 0) → **2039** | **yes** |
| Select largest-shortfall year | 2042 | max shortfall among rows = 2,400 in **2042** | **yes** |
| Use `>=` instead of `>` | flips exact-0.005 case from null to that year | With `>=`: 0.005 ≥ 0.005 → year qualifies; sole 0.005 shortfall → depletion year = that year (not null) | **yes** |

All three wrong-reading behaviors check.

### 6. Claim consistency with corrected doc comments

| Aspect | Worksheet | Extract (`ProjectionResult.depletionYear`, `ProjectionSummary.depletionYear`, `SwrRuleResult.depletionYear`, `compareSwrRules`) | Consistent? |
|---|---|---|---|
| Gate | First year shortfall **after HECM backstop** exceeds tolerance | Same wording on all three surfaces | **yes** |
| Threshold | `0.005` nominal dollars | `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005` | **yes** |
| Comparison | Strict `>`; at or below budget is not depletion | “exceeds … else null”; “A residual at or below that budget is not depletion” | **yes** |
| Empty / no crossing | `null` | “else null when no year crosses that budget” | **yes** |
| Units | Nominal dollars for shortfall; calendar year for result | Shortfall on `YearResult`; year is `number \| null` | **yes** |
| Timing / domain | Ordered finite rule-run ledger; projection end prevents shorter-run misread | Finite `years[]` on `ProjectionResult`; explicit horizon | **yes** |

Depletion gate is a **strict** comparison against **0.005**, not “any positive shortfall.”

### 7. Verdict

**approve**

---

## Summary

| id | match | verdict |
|---|---|---|
| `projection-summary-ending-after-tax-estate` | yes (both cases) | approve |
| `swr-rule-depletion-year` | yes (all three cases) | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Independent review, 2026-09-18 (slice seven, sixteen worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and a signatures-and-comments extract built from the doc-gap branch d516c15d (PR #718, not yet on main) with the 2026-09-18 corrections applied (the after-tax estate identity, the depletion-year gate). Scope in this directory: scenario-nullable-scalar-comparison, scenario-scalar-comparison, swr-rule-end-year, swr-rule-ending-after-tax-estate, swr-rule-lifetime-taxes-and-penalties. The report covers all sixteen worksheets of the review across three directories; the verbatim output follows. The one note (the savings-rate worksheet's pin had no averaging contract) was closed by a doc comment on ProjectionSummary.savingsRates and averagePreRetirementSavingsRatePct stating the rule the worksheet uses; the worksheet's wording was then revised on that comment with its values unchanged.

---

# Independent Worksheet Review Report

Branch: `claude/b1-p4-cards-slice-seven`  
Signature extract: `b1-p4-signatures-s7.md` (bodies elided)  
Method: independent recomputation from Inputs and Justification only; Arithmetic sections not trusted.

---

## 1. `projection-summary-average-pre-retirement-savings-rate`

**Recomputed**

- `sum r_i = 10 + 20 + 35 = 65` percentage points  
- `n = 3`  
- `r̄ = 65/3 = 21.666666666666666…` → **21.6666666666667%**

**Match:** yes

**Tolerance (`1e-12` pp):** justified — one floating-point division, no rounding stated.

**Wrong readings verified**

- `65/4 = 16.25%` ✓  
- Terminal rate `35%` ✓

**Claim vs signature:** The extract lists `averagePreRetirementSavingsRatePct` and `savingsRates[]` but gives no doc comment for the averaging rule or which years qualify as pre-retirement. The worksheet’s ordinary mean over the three supplied working-year rates is internally consistent; the “implied by comment” wording overstates what the extract actually documents.

**Family:** `feeds: none` — correct (outputs family only).

**Verdict:** approve with a note — arithmetic and wrong readings are sound; pin lacks an explicit averaging contract.

---

## 2. `projection-summary-coast-fire-number`

**Recomputed**

- `birthYear = 1980` (month/day ignored)  
- Current age `= 2026 − 1980 = 46`  
- Horizon `n = max(0, 50 − 46) = 4`  
- Simple real return `= 0.07 − 0.03 = 0.04`  
- Growth factor `= 1.04^4 = 1.16985856`  
- `coastFireNumber = 2,043,520.21020608 / 1.16985856 = 1,746,809.640138106…` → **$1,746,809.64013811**

**Match:** yes

**Tolerance (`$0.000001`):** justified — one integer power and one division in binary float.

**Wrong readings verified**

- Fisher `(1.07/1.03)−1 ≈ 0.038835…` would yield ≈ `$1,748,456.58`, not the stated value ✓  
- Other listed misreadings align with the pin’s simple-real-return, retirement-age horizon, and `max(0,·)` floor ✓

**Claim vs signature:** Consistent with `coastFireNumber = fiNumber / (1 + defaultReturnPct/100 − inflationPct/100)^max(0, retirementAge − (startYear − birthYear))`; start-year dollars; reads upstream `fiNumber`.

**Family:** `feeds: none`; upstream read documented in Inputs — correct.

**Verdict:** approve

---

## 3. `projection-summary-ending-investable`

**Recomputed**

- Identity copy: **$438,765.43**

**Match:** yes

**Tolerance (exact cent):** justified — passthrough of a cent-valued input.

**Wrong readings verified**

- Penultimate annual `$472,000.00` ✓  
- Sum `$438,765.43 + $472,000.00 = $910,765.43` ✓

**Claim vs signature:** Consistent with republishing `ProjectionResult.endingInvestable`.

**Family:** `feeds: scenario-comparison-cell` — correct.

**Verdict:** approve

---

## 4. `projection-summary-ending-net-worth`

**Recomputed**

- Identity copy: **$812,345.67**

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Substituting investable `$438,765.43` ✓  
- Double-count `$812,345.67 + $438,765.43 = $1,251,111.10` ✓

**Claim vs signature:** Consistent with republishing `ProjectionResult.endingNetWorth`.

**Family:** `feeds: projection-summary-ending-after-tax-estate, scenario-comparison-cell` — correct.

**Verdict:** approve

---

## 5. `projection-summary-fi-age`

**Case A — nonempty ledger**

| Year | Nominal investable | Deflator `1.03^(y−2026)` | Real investable | vs `$1,000,000` |
|------|-------------------:|-------------------------:|----------------:|----------------:|
| 2026 | 900,000 | 1 | 900,000 | below |
| 2027 | 1,030,000 | 1.03 | **1,000,000** | **≥ threshold (inclusive)** |
| 2028 | 1,166,990 | 1.03² | 1,100,000 | later sentinel |

- First crossing: **`fiYear = 2027`**, **`fiAge = 2027 − 1980 = 47`**

**Case B — empty ledger**

- **`fiYear = null`**, **`fiAge = null`**

**Match:** yes (both cases)

**Tolerance:** exact integers / exact null — appropriate.

**Wrong readings verified**

- Strict `>` would skip 2027 despite equality ✓  
- Nominal `$1,030,000` vs start-year target mixes bases ✓  
- Empty ledger ≠ age 0 ✓

**Claim vs signature:** Consistent — inclusive `≥`, calendar-year attained age `year − birthYear`, published `investableTotal`, discrete deflation to `startYear`, reads upstream `fiNumber`.

**Family:** `feeds: none` — correct.

**Verdict:** approve

---

## 6. `projection-summary-fi-number`

**Case A — nonempty ledger**

- Spending year `s = max(2026, 1980 + 50) = 2030`  
- Nominal outflows `= 80,000 + 10,000 + 2,000 = $92,000`  
- Deflator `= 1.03^(2030−2026) = 1.03^4 = 1.12550881`  
- Start-year outflows `= 92,000 / 1.12550881 = $81,740.8084082434…`  
- **`fiNumber = 81,740.8084082434… / 0.04 = $2,043,520.210206085…` → $2,043,520.21020608**

**Case B — empty ledger**

- **`fiNumber = 60,000 / 0.04 = $1,500,000.00`** (no tax, penalties, or deflation)

**Match:** yes (both cases)

**Tolerance (`$0.000001`):** justified for the floating power-and-division path; empty-ledger case is exact at cents.

**Wrong readings verified**

- Gross outflows vs net-portfolio-need / income subtraction ✓  
- Empty-ledger path is baseAnnual only ✓

**Claim vs signature:** Consistent — funded `expenses.total + tax + penalties`, general inflation only, start-year dollars, SWR as percent/100, empty-ledger fallback.

**Family:** `feeds: projection-summary-fi-age, projection-summary-coast-fire-number` — correct; inputs named in Inputs, not feeds.

**Verdict:** approve

---

## 7. `scenario-nullable-scalar-comparison`

**Recomputed**

- Both present: `delta = 2044 − 2041 = 3` years  
- Baseline absent: **`delta = null`**

**Match:** yes

**Tolerance:** exact integer / exact null — appropriate.

**Wrong readings verified**

- Reversed sign `−3` ✓  
- Null coerced to 0 → `2044` ✓

**Claim vs signature:** Consistent with `NullableScalarComparison` — conjunctive comparability, `proposal − baseline`.

**Family:** correct.

**Verdict:** approve

---

## 8. `scenario-scalar-comparison`

**Recomputed**

- `delta = 95,000.00 − 120,000.00 = −$25,000.00`

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Reversed `+$25,000.00` ✓  
- Relative `−25,000/120,000 = −20.8333333333%` is not the scalar delta ✓

**Claim vs signature:** Consistent with `ScalarComparison` and `deltaConvention: 'proposal-minus-baseline'`.

**Family:** correct.

**Verdict:** approve

---

## 9. `swr-rule-end-year`

**Recomputed**

- **`endYear = 2055`** (ledger horizon, not depletion year 2041)

**Match:** yes

**Tolerance:** exact integer — appropriate.

**Wrong readings verified**

- Depletion substitution `2041` ✓  
- Inclusive 30-year count `2026 + 30 = 2056` ✓

**Claim vs signature:** Consistent — `SwrRuleResult.endYear` from `result.endYear`; depletion is a separate field with half-cent gate elsewhere in pin.

**Family:** correct.

**Verdict:** approve

---

## 10. `swr-rule-ending-after-tax-estate`

**Recomputed**

- Passthrough: **$640,000.00**

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Net worth `$700,000.00` ✓  
- Double discount `$640,000 − $60,000 = $580,000` ✓

**Claim vs signature:** Consistent — republishes `summary.endingAfterTaxEstate` (`endingNetWorth − charity − heirTax` already applied upstream).

**Family:** correct.

**Verdict:** approve

---

## 11. `swr-rule-lifetime-taxes-and-penalties`

**Recomputed**

- Passthrough of combined summary: **$115,250.25**  
- Sanity: `$112,500.00 + $2,750.25 = $115,250.25` ✓

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Tax alone `$112,500.00` ✓  
- Double-add `$115,250.25 + $2,750.25 = $118,000.50` ✓

**Claim vs signature:** Consistent — republishes `summary.lifetimeTaxesAndPenalties` (tax + penalties already aggregated).

**Family:** correct.

**Verdict:** approve

---

## 12. `projection-summary-estate-heir-tax`

**Recomputed**

- `$52,800.00 + $8,800.00 + $0.00 = $61,600.00`

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- `0.22 × ($300,000 + $40,000) = $74,800.00` ✓  
- `$61,600 − $30,000 = $31,600` (charity subtracted again) ✓

**Claim vs signature:** Consistent — sum of `estateBreakdown[].heirTax` after per-account resolution.

**Family:** `feeds: projection-summary-ending-after-tax-estate` — correct.

**Verdict:** approve

---

## 13. `projection-summary-lifetime-taxes-and-penalties`

**Recomputed**

- Taxes: `$12,000.00 + $9,500.25 + $8,000.00 = $29,500.25`  
- Penalties: `$300.00 + $0.00 + $1,200.50 = $1,500.50`  
- **Combined: $31,000.75**

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Taxes only `$29,500.25` ✓  
- Penalties only in final year `$29,500.25 + $1,200.50 = $30,700.75` ✓

**Claim vs signature:** Consistent — `sum_y (tax_y + penalties_y)`; penalties excluded from `tax` per `YearResult`.

**Family:** correct.

**Verdict:** approve

---

## 14. `relocation-lifetime-state-local-tax`

**Recomputed**

- `$4,250.00 + $5,100.25 + $3,900.00 = $13,250.25`

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Post-move years only `$5,100.25 + $3,900.00 = $9,000.25` ✓  
- Extra deflation: `$4,250/1.03 + $5,100.25/1.03² + $3,900/1.03³ ≈ $12,502.74` ✓

**Claim vs signature:** Consistent — sum of `stateTaxByYear[].tax` nominal lines; income tax scope only.

**Family:** correct.

**Verdict:** approve

---

## 15. `relocation-state-tax-driver-savings`

**Recomputed** (`savings = Σ (tax_neutralized − tax_actual)`)

| Driver | 2026 | 2027 | Total |
|--------|-----:|-----:|------:|
| SS treatment | 600 | 700 | **$1,300.00** |
| Retirement exclusions | 900 | 900 | **$1,800.00** |
| Separate public pension | 250 | 300 | **$550.00** |
| Capital-gains treatment | −100 | −50 | **−$150.00** |

**Match:** yes

**Tolerance (exact cent):** justified — exact-dollar inputs.

**Wrong readings verified**

- Reversed signs `−$1,300`, `−$1,800`, `−$550`, `+$150` ✓  
- Additive partition `$1,300 + $1,800 + $550 − $150 = $3,500` is not claimed as total tax ✓

**Claim vs signature:** Consistent with `computeDrivers` / `RelocationDrivers` — neutralized-minus-actual direction; overlapping one-at-a-time attributions; public-pension bucket noted separately.

**Family:** correct.

**Verdict:** approve

---

## 16. `scenario-lifetime-tax-and-penalties`

**Recomputed**

| Side | Tax sum | Penalties sum |
|------|--------:|--------------:|
| Baseline | `$12,000 + $9,500 + $8,000 = $29,500.00` | `$300 + $0 + $1,200 = $1,500.00` |
| Proposal | `$11,000 + $9,000 + $7,750 = $27,750.00` | `$0 + $0 + $250 = $250.00` |

**Match:** yes

**Tolerance (exact cent):** justified.

**Wrong readings verified**

- Folded channels: baseline `$31,000.00`, proposal `$28,000.00` ✓  
- Row-wise deltas misreported as totals: tax `$1,750.00`, penalties `$1,250.00` ✓

**Claim vs signature:** Consistent with `compareScenarioPlans` headline fields — separate `lifetimeTax` and `lifetimePenalties` sums per side; deltas delegated to scalar helpers.

**Family:** correct.

**Verdict:** approve

---

## Summary Table

| id | match | verdict |
|----|-------|---------|
| `projection-summary-average-pre-retirement-savings-rate` | yes | approve with a note |
| `projection-summary-coast-fire-number` | yes | approve |
| `projection-summary-ending-investable` | yes | approve |
| `projection-summary-ending-net-worth` | yes | approve |
| `projection-summary-fi-age` | yes | approve |
| `projection-summary-fi-number` | yes | approve |
| `scenario-nullable-scalar-comparison` | yes | approve |
| `scenario-scalar-comparison` | yes | approve |
| `swr-rule-end-year` | yes | approve |
| `swr-rule-ending-after-tax-estate` | yes | approve |
| `swr-rule-lifetime-taxes-and-penalties` | yes | approve |
| `projection-summary-estate-heir-tax` | yes | approve |
| `projection-summary-lifetime-taxes-and-penalties` | yes | approve |
| `relocation-lifetime-state-local-tax` | yes | approve |
| `relocation-state-tax-driver-savings` | yes | approve |
| `scenario-lifetime-tax-and-penalties` | yes | approve |

**Overall:** 15/16 approve outright; 1 approve with a note (average savings rate lacks an explicit averaging contract in the signature extract, though the worked example is arithmetically correct). All Family sections correctly name downstream feeds, not upstream reads. No Expected values failed independent recomputation.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
