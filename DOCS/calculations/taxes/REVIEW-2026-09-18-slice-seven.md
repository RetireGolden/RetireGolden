# Independent review, 2026-09-18 (slice seven, sixteen worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and a signatures-and-comments extract built from the doc-gap branch d516c15d (PR #718, not yet on main) with the 2026-09-18 corrections applied (the after-tax estate identity, the depletion-year gate). Scope in this directory: projection-summary-estate-heir-tax, projection-summary-lifetime-taxes-and-penalties, relocation-lifetime-state-local-tax, relocation-state-tax-driver-savings, scenario-lifetime-tax-and-penalties. The report covers all sixteen worksheets of the review across three directories; the verbatim output follows. The one note (the savings-rate worksheet's pin had no averaging contract) was closed by a doc comment on ProjectionSummary.savingsRates and averagePreRetirementSavingsRatePct stating the rule the worksheet uses; the worksheet's wording was then revised on that comment with its values unchanged.

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

---

# Re-check, 2026-09-18 (estate-heir-tax worksheet after its re-derivation)

The implementation's fixture found that production charges heir tax on the non-charity slice of the taxable pre-tax base (47,520 on the traditional row, not 52,800), a rule the EstateAccountBreakdown.heirTax field did not state. The comment was added (08e6f2f0), Codex Sol re-derived the worksheet on it (56,320 with the 10% bequest; 61,600 without a charity destination), and the same reviewer recomputed every row and both cases and approved. Verbatim output follows.

---

# Independent review: projection-summary-estate-heir-tax

## Rule applied

From the Claim and `EstateAccountBreakdown.heirTax` doc comment:

**Per account (non-spouse):**  
`heirTax = taxablePretaxBase × (1 − charityFraction) × heirRate`

**Per account (spouse destination):** `heirTax = 0`

**Total:** `endingEstateHeirTax = Σ heirTax` (nominal dollars, no stated rounding)

Charity fraction = share of **gross balance** passing to charity; it scales the taxable pre-tax base, not only gross/heir receipts.

---

## (1) Recomputation

### Charity case (inputs as given)

| Account | Computation | Heir tax |
|---|---|---:|
| Traditional IRA | $240,000.00 × (1 − 0.10) × 0.22 = $240,000.00 × 0.90 × 0.22 = $216,000.00 × 0.22 | **$47,520.00** |
| Non-spouse HSA | $40,000.00 × (1 − 0) × 0.22 = $40,000.00 × 0.22 | **$8,800.00** |
| Roth IRA | $0.00 × (1 − 0) × 0.22 | **$0.00** |
| **Sum** | $47,520.00 + $8,800.00 + $0.00 | **$56,320.00** |

### No-charity case (charity fraction 0% on all accounts)

| Account | Computation | Heir tax |
|---|---|---:|
| Traditional IRA | $240,000.00 × 1.00 × 0.22 | **$52,800.00** |
| Non-spouse HSA | $40,000.00 × 1.00 × 0.22 | **$8,800.00** |
| Roth IRA | $0.00 × 1.00 × 0.22 | **$0.00** |
| **Sum** | $52,800.00 + $8,800.00 + $0.00 | **$61,600.00** |

---

## (2) Match vs worksheet Expected

| Case | Worksheet | Recomputed | Match |
|---|---|---:|:---:|
| Charity case | $56,320.00 | $56,320.00 | **yes** |
| No-charity case | $61,600.00 | $61,600.00 | **yes** |

---

## (3) Wrong readings — stated values reproduced?

| Wrong reading | Stated wrong value | Independent check | Reproduces? |
|---|---|---:|:---:|
| Tax full taxable pre-tax base; ignore charity fraction on base | $52,800.00 + $8,800.00 = **$61,600.00** | $240,000 × 0.22 = $52,800; $40,000 × 0.22 = $8,800; Roth $0 | **yes** |
| Subtract charity **dollar** amount from summed tax | $56,320.00 − $30,000.00 = **$26,320.00** | Charity = 10% × $300,000 gross = $30,000; $56,320 − $30,000 | **yes** |
| Tax Roth gross despite zero taxable pre-tax base | **$83,820.00** | $56,320 + ($125,000 × 0.22) = $56,320 + $27,500 | **yes** |

---

## (4) Consistency with extract doc comments

| Element | Claim / worksheet | Extract (`EstateAccountBreakdown.heirTax`, `ProjectionSummary.endingEstateHeirTax`) | Consistent? |
|---|---|---|:---:|
| Per-account rule | `taxablePretaxBase × (1 − charity fraction) × heir rate` | Same formula in `heirTax` comment; charity fraction reduces taxable base, not gross alone | **yes** |
| Spouse exception | Spouse destination → zero heir tax | “…and 0 for a spouse destination” | **yes** |
| Aggregation | Sum of breakdown `heirTax` | `endingEstateHeirTax`: “sum of the breakdown's heirTax” | **yes** |
| Units | Nominal horizon dollars | Estate breakdown and summary fields are nominal dollar amounts in the projection summary | **yes** |
| Tolerance | Absolute **$0.005** (binary float products) | No conflicting rounding rule in the cited comments; $0.005 is appropriate for these products | **yes** |

The re-derived charity-case rule aligns with the 2026-09-18 `heirTax` comment and corrects the first derivation’s error (taxing the full $240,000 base despite a 10% charity fraction).

---

## (5) Verdict

**Approve.** Both case totals, every account row, all three wrong-reading counterexamples, and Claim/units/tolerance are consistent with the signatures-and-comments extract; the charity-fraction-on-taxable-pre-tax-base rule is stated and applied correctly throughout.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
