## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.expenses.healthcare`, assembled by `projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses`, adds for each living person Medicare annual premium with IRMAA prorated by Medicare months plus monthly extras inflated for those months, and credit-off marketplace premium inflated for marketplace months. With the ACA credit on, the fixed point substitutes economic net premium when converged (gross premium on failure). The composition is stated by the `YearExpenses.healthcare` comment.

## Justification

The extract does not state the internal Part B IRMAA pricing formula, so this worksheet takes the tier-priced annual premium returned by `tax/medicare.ts#medicareAnnualPremiumPerPerson` as an explicit intermediate rather than inventing it. The 2026 pack identifies tier 1 as MAGI over `$109,000` for single filers, names its `partDSurchargeMonthly = $14.50`, and names the standard Part B premium `$202.90/month`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| First person marketplace / Medicare coverage | 0 / 12 | months |
| Filing status / lookback MAGI tier | single / tier 1 | status / tier |
| Tier-priced Part B + Part D annual premium from helper | 3,582.72 | dollars/year |
| Medicare extras | 50 | dollars/month |
| Second person marketplace / Medicare coverage | 4 / 8 | months |
| Credit enabled | false | Boolean |
| Pre-65 marketplace premium | 400 | dollars/month |
| Health inflation factor | 1.10 | nominal/base ratio |

## Arithmetic

First person: zero marketplace months and 12 Medicare months partition the year. Medicare `= $3,582.72 × 12/12 + $50 × 12 × 1.10 = $3,582.72 + $660 = $4,242.72`.

Second person: four marketplace months and `12 - 4 = 8` Medicare months partition the year. Marketplace with credit off `= $400 × 4 × 1.10 = $1,760`. Medicare `= $3,582.72 × 8/12 + $50 × 8 × 1.10 = $2,388.48 + $440 = $2,828.48`. The second person's total is `$1,760 + $2,828.48 = $4,588.48`.

Household healthcare `= $4,242.72 + $4,588.48 = $8,831.20`. The tier-priced annual premium is already the helper's premium-year amount; only Medicare extras and marketplace premium use the stated `1.10` health inflation factor here.

Credit-on branch: the marketplace component enters gross enrollment premium during the solve, then a converged ACA fixed point publishes healthcare excluding enrollment plus the economic net premium; no numeric result is asserted without fixed-point inputs.

## Expected

Exact value for the credit-off case: `$8,831.20`. Fixture tolerance: absolute `$0.005`, because proration and inflation multiplication use binary floating point. Credit-on branch: no numeric expectation without a complete ACA quote and fixed-point result.

## Wrong readings

- Inflating the tier-priced Medicare annual premium again applies the health factor twice; the `$3,582.72` intermediate is already priced for the premium year.
- Omitting the health factor from marketplace premiums prices the second person's four marketplace months at `$1,600` instead of `$1,760`.
- Forgetting the second person's eight Medicare months gives only `$4,242.72 + $1,760 = $6,002.72` and violates the per-person 12-month partition.
- With the credit on, retaining gross enrollment premium after convergence ignores the required economic-net-premium substitution.

## Family

outputs: `spending-healthcare-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)").

Revision: The first derivation gave the second person four marketplace months without the complementary eight Medicare months, an impossible annual partition that the implementation's fixture found.
