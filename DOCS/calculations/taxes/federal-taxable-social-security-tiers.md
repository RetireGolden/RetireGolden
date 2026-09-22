## Claim

Kind: formula. `tax/federalTax.ts#taxableSocialSecurity` computes annual taxable Social Security from provisional income—AGI excluding Social Security plus tax-exempt interest, foreign-exclusion addback, and half of gross benefits—using the 2026 pack's unindexed single-filer 50% and 85% tier thresholds; the tier formulas below are the formulas implied by that convention.

## Justification

Let gross benefit be \(B\), provisional income \(P\), first threshold \(a\), and second threshold \(b\). The implied continuous tiering is: zero when \(P\le a\); \(\min(B/2,(P-a)/2)\) when \(a<P\le b\); and \(\min(0.85B,0.85(P-b)+\min(B/2,(b-a)/2))\) above \(b\). Domain: nonnegative annual benefit and dollar inputs.

## Inputs

| Input | Below base | 50% tier | 85% tier | Unit |
|---|---:|---:|---:|---|
| Filing status | single | single | single | status |
| AGI excluding SS | 10,000 | 20,000 | 30,000 | dollars/year |
| Gross SS benefits | 20,000 | 20,000 | 20,000 | dollars/year |
| Tax-exempt interest | 0 | 0 | 0 | dollars/year |
| Foreign-exclusion addback | 0 | 0 | 0 | dollars/year |
| Tier starts | 25,000 / 34,000 | 25,000 / 34,000 | 25,000 / 34,000 | provisional-income dollars |

Thresholds are `year2026.ssBenefitTaxation.tier50Start.single` and `.tier85Start.single`.

## Arithmetic

Provisional incomes are respectively `$10,000 + $10,000 = $20,000`, `$20,000 + $10,000 = $30,000`, and `$30,000 + $10,000 = $40,000`.

Below base: `$20,000 ≤ $25,000`, so taxable SS is `$0`.

50% tier: `min($10,000, 1/2 × ($30,000 - $25,000)) = $2,500`.

85% tier: lower-tier base `= min($10,000, 1/2 × ($34,000 - $25,000)) = $4,500`; upper increment `= 0.85 × ($40,000 - $34,000) = $5,100`; total `= min($17,000, $4,500 + $5,100) = $9,600`.

## Expected

Exact derived and published figures for the three cases: `$0`, `$2,500`, and `$9,600`; fixture tolerance: exact because all arithmetic resolves to whole dollars.

## Wrong readings

- Omitting half the benefits from provisional income produces `$0`, `$0`, and `$2,500`.
- Applying 85% to all provisional income above the first threshold in the third case produces `$12,750` instead of `$9,600`.

## Family

outputs: none.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
