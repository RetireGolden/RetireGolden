# Independent review, 2026-09-18 (slice seven follow-ups)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract at commit e5c84810 (the doc comments corrected after the #720 review). Scope: this directory's projection-summary-ending-after-tax-estate (the other worksheet in the report lives in optimizer-and-comparisons). The report covers both worksheets of this review; the verbatim output follows.

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
