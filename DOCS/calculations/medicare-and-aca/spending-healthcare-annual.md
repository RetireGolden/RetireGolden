## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.expenses.healthcare`, assembled by `projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses`, adds for each living person Medicare annual premium with IRMAA prorated by Medicare months plus monthly extras inflated for those months, and credit-off marketplace premium inflated for marketplace months. With the ACA credit on, a year is published actionable (`YearAcaResult.readiness`) only when its coverage year has published figures, no support code blocks pricing, and the funding fixed point converges; it then publishes healthcare excluding enrollment plus the economic net premium. Every other year budgets the gross premium, for one of two reasons: by design, when the credit cannot be priced at all (a coverage year with no published figures, 2028 and later today, or a blocking support code), or as a fallback, when the fixed point does not converge (the engine then adds `fixed-point-nonconvergent`, which blocks pricing). `YearAcaResult.convergence.converged` is true exactly when the year is actionable, so it reads false in a year whose credit cannot be priced even when the funding solve converged; only the `fixed-point-nonconvergent` code marks a failed solve. The composition is stated by the `YearExpenses.healthcare` comment.

## Justification

The tier-priced annual premium is CMS's published 2026 tier-one figures, read as `tax/medicare.ts#medicareAnnualPremiumPerPerson` reads them (worksheet `medicare-irmaa-first-tier-boundary`): tier 1 is MAGI over `$109,000` for single filers (`$218,000` joint), whose total monthly Part B premium CMS publishes as `$284.10` and whose Part D income-related monthly adjustment it publishes as `$14.50` ("2026 Medicare Parts A & B Premiums and Deductibles", cms.gov, read 2026-09-29). So the intermediate is `($284.10 + $14.50) × 12 = $298.60 × 12 = $3,583.20`. The standard Part B premium is `$202.90/month`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| First person marketplace / Medicare coverage | 0 / 12 | months |
| Filing status / lookback MAGI tier | single / tier 1 | status / tier |
| Tier-priced Part B + Part D annual premium, CMS 2026 tier 1 | 3,583.20 | dollars/year |
| Medicare extras | 50 | dollars/month |
| Second person marketplace / Medicare coverage | 4 / 8 | months |
| Credit enabled | false | Boolean |
| Pre-65 marketplace premium | 400 | dollars/month |
| Health inflation factor | 1.10 | nominal/base ratio |

## Arithmetic

First person: zero marketplace months and 12 Medicare months partition the year. Medicare `= $3,583.20 × 12/12 + $50 × 12 × 1.10 = $3,583.20 + $660 = $4,243.20`.

Second person: four marketplace months and `12 - 4 = 8` Medicare months partition the year. Marketplace with credit off `= $400 × 4 × 1.10 = $1,760`. Medicare `= $3,583.20 × 8/12 + $50 × 8 × 1.10 = $2,388.80 + $440 = $2,828.80`. The second person's total is `$1,760 + $2,828.80 = $4,588.80`.

Household healthcare `= $4,243.20 + $4,588.80 = $8,832.00`; its Medicare premiums are `$3,583.20 + $2,388.80 = $5,972.00`. The tier-priced annual premium is already the helper's premium-year amount; only Medicare extras and marketplace premium use the stated `1.10` health inflation factor here.

Credit-on branch: the marketplace component enters gross enrollment premium during the solve. In an actionable year, the converged fixed point then publishes healthcare excluding enrollment plus the economic net premium. In a year whose credit cannot be priced the gross premium stays, which is the intended figure and not a failure; in a year whose fixed point does not converge it stays as a fallback, and `fixed-point-nonconvergent` says so. No numeric result is asserted without fixed-point inputs.

## Expected

Exact value for the credit-off case: `$8,832.00`. Fixture tolerance: absolute `$0.005`, because proration and inflation multiplication use binary floating point. Credit-on branch: no numeric expectation without a complete ACA quote and fixed-point result.

## Wrong readings

- Inflating the tier-priced Medicare annual premium again applies the health factor twice (first person `$3,583.20 × 1.10 + $660 = $4,601.52`); the `$3,583.20` intermediate is already priced for the premium year.
- Omitting the health factor from marketplace premiums prices the second person's four marketplace months at `$1,600` instead of `$1,760`.
- Forgetting the second person's eight Medicare months gives only `$4,243.20 + $1,760 = $6,003.20` and violates the per-person 12-month partition.
- Pricing tier 1 as the standard premium times the applicable percentage over 25, the engine's rule until 2026-09-29, gives `(202.90 × 35/25 + 14.50) × 12 = $3,582.72` and a household of `$8,831.20`, 48 cents a year per Medicare person below CMS's published figures.
- In an actionable year, retaining the gross enrollment premium after the fixed point converges ignores the required economic-net-premium substitution. In a year whose credit cannot be priced the gross premium is the published figure by design (the credit is not modeled, so the full premium is budgeted), and reading it there as this wrong reading, or reading `convergence.converged: false` there as a failed solve, is itself a misreading: a failed solve is marked by the `fixed-point-nonconvergent` code.

## Family

outputs: `spending-healthcare-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)").

Revision: The first derivation gave the second person four marketplace months without the complementary eight Medicare months, an impossible annual partition that the implementation's fixture found.

Revision, 2026-09-26: the record gains a stated limit (decision D-ACA-2027-TABLE): a household funded just above 100% of the poverty line by need-driven withdrawals can have no self-consistent credit, because the credit lowers the withdrawal need and with it MAGI to below 100%. The fixed point then publishes fixed-point-nonconvergent and budgets the gross premium. The truer reason is that the engine does not model 26 CFR 1.36B-2(b)(6), under which a household whose income ends below 100% remains an applicable taxpayer when an Exchange estimated 100% to 400% at enrollment and advance credit was paid. No figure in this worksheet moves; the limit was unreviewed until the review below, so the record carried reviewedBy 'unreviewed'.

Revision, 2026-09-27 (decision D-WALKTHROUGH-WORKSHEET-WORDING): the claim, the credit-on paragraph and the fourth wrong reading are reworded. They read "gross premium on failure" and "retaining gross enrollment premium after convergence" as a wrong reading, while a year whose credit is not priced keeps the gross premium by design (the early-retiree walkthrough's 2027 and 2028 found this when those years were unpriced; since decision D-ACA-2027-TABLE, 2027 is priced and 2028 and later are not). No figure moves. The wording was unreviewed until the review below, and the record stayed reviewedBy 'unreviewed'.

Reworded again the same day after the branch review: the first rewording used "priced" in two senses (a year published actionable, and a year whose credit can be priced but whose fixed point does not converge, which the engine publishes non-actionable with `fixed-point-nonconvergent`). The claim, the credit-on paragraph and the wrong reading now say "actionable" for the first and "a year whose credit cannot be priced" for a year with no published figures or a blocking support code, and name the non-converging year as its own case. No figure moves.

Revision 2026-09-29 (the Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-5-medicare-spending.md`, and the decision to read CMS's table): the tier-one intermediate was the engine's `202.90 × 35/25 + 14.50` a month, $3,582.72 a year, where CMS publishes $284.10 + $14.50, $3,583.20. The engine now reads CMS's published tier totals, so the first person's healthcare is $4,243.20 (was $4,242.72), the second person's $4,588.80 (was $4,588.48, Medicare $2,828.80, was $2,828.48), the household's $8,832.00 (was $8,831.20) and its Medicare premiums $5,972.00 (was $5,971.20); the old figure is a wrong reading. The record's formula now states the credit-on substitution the code makes: in an actionable year, healthcare excluding enrollment plus the economic net premium, and the gross premium otherwise. Revised by claude (opus 5.5); unreviewed until the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
