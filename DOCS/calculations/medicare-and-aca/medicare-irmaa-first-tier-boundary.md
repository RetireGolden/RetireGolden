## Claim

Kind: formula. `tax/medicare.ts#medicareAnnualPremiumPerPerson` applies the 2026 single-filer first IRMAA tier only when two-year-lookback MAGI is strictly greater than `$109,000`, then prices Part B at CMS's published total monthly premium for the tier and adds the published monthly Part D surcharge. Every tier is priced the same way, from CMS's published table (`year2026.medicare.irmaaTiers[i].partBTotalMonthly` and `.partDSurchargeMonthly`); a year after the latest CMS publication grows the published figures by the Medicare component's projection factor, as it grows the standard premium.

Restated 2026-09-29 (after the Codex review of `spending-healthcare-annual`, the decision to read CMS's table): the tier total was the standard premium times the applicable percentage over 25, which misses CMS's published total by cents in four of the five tiers. The claim now covers the whole table, one case per tier.

## Justification

The `IrmaaTier` contract states that a tier applies when MAGI exceeds `magiOver` (the top tier when it equals or exceeds it). Under 42 U.S.C. 1395r(i)(3) a high-income beneficiary pays the applicable percentage of program cost, 35, 50, 65, 80 or 85 percent against the standard premium's 25, but CMS applies the percentages to the unrounded monthly actuarial rate and publishes each tier's total premium, so the table is read as published, not re-derived. CMS, "2026 Medicare Parts A & B Premiums and Deductibles" (https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles, read 2026-09-29), with full Part B coverage, prints per tier an income-related monthly adjustment amount and a total monthly premium amount: $0.00 and $202.90 at or below $109,000 single ($218,000 joint), then $81.20 and $284.10, $202.90 and $405.80, $324.60 and $527.50, $446.30 and $649.20, and $487.00 and $689.90. Its Part D table prints $14.50, $37.50, $60.40, $83.30 and $91.00. The rule record `usc-42-1395r-i-irmaa-applicable-percentage` quotes the tier-one rows of both tables. The cliff also requires cases on both sides of the same boundary.

## Inputs

| Input | At boundary | Above boundary | Unit |
|---|---:|---:|---|
| Filing status | single | single | status |
| Lookback MAGI | 109,000 | 109,001 | dollars/year |
| First-tier `magiOver` | 109,000 | 109,000 | dollars/year |
| Standard Part B | 202.90 | 202.90 | dollars/month |
| First-tier Part B total (CMS) | 284.10 | 284.10 | dollars/month |
| First-tier Part D surcharge | 14.50 | 14.50 | dollars/month |

Values are `year2026.medicare.partBStandardMonthly` and the first entry of `year2026.medicare.irmaaTiers`. The per-tier cases use a single filer one dollar over each lower floor (137,001, 171,001 and 205,001) and exactly at the top floor (500,000, where the top tier is inclusive).

## Arithmetic

At `$109,000`, the strict `>` test is false: tier 0, Part B annual `$202.90 × 12 = $2,434.80`, Part D surcharge `$0`.

At `$109,001`, tier 1 applies. Part B monthly `= $284.10`, CMS's published total; Part B annual `= $3,409.20`. Part D annual surcharge `= $14.50 × 12 = $174.00`. IRMAA-only annual surcharge `= ($284.10 - $202.90) × 12 + $174 = $974.40 + $174 = $1,148.40`. Total Part B plus Part D surcharge `= $3,583.20`.

Each tier, per person per year: Part B annual `= total × 12`; Part D annual `= surcharge × 12`; IRMAA-only `= (total − 202.90) × 12 + Part D annual`.

- Tier 2: `405.80 × 12 = 4,869.60`; `37.50 × 12 = 450.00`; `202.90 × 12 + 450.00 = 2,434.80 + 450.00 = 2,884.80`.
- Tier 3: `527.50 × 12 = 6,330.00`; `60.40 × 12 = 724.80`; `324.60 × 12 + 724.80 = 3,895.20 + 724.80 = 4,620.00`.
- Tier 4: `649.20 × 12 = 7,790.40`; `83.30 × 12 = 999.60`; `446.30 × 12 + 999.60 = 5,355.60 + 999.60 = 6,355.20`.
- Tier 5: `689.90 × 12 = 8,278.80`; `91.00 × 12 = 1,092.00`; `487.00 × 12 + 1,092.00 = 5,844.00 + 1,092.00 = 6,936.00`.

## Expected

| Tier | Lookback MAGI, single | Part B total, monthly | Part B annual | Part D annual | IRMAA surcharge annual |
|---|---:|---:|---:|---:|---:|
| Tier 1 | 109,001 | 284.10 | 3,409.20 | 174.00 | 1,148.40 |
| Tier 2 | 137,001 | 405.80 | 4,869.60 | 450.00 | 2,884.80 |
| Tier 3 | 171,001 | 527.50 | 6,330.00 | 724.80 | 4,620.00 |
| Tier 4 | 205,001 | 649.20 | 7,790.40 | 999.60 | 6,355.20 |
| Tier 5 | 500,000 | 689.90 | 8,278.80 | 1,092.00 | 6,936.00 |

At boundary: tier `0`, `partBAnnual = $2,434.80`, `partDSurchargeAnnual = $0`, `irmaaSurchargeAnnual = $0`. Above: tier `1`, `partBAnnual = $3,409.20`, `partDSurchargeAnnual = $174.00`, `irmaaSurchargeAnnual = $1,148.40`. Fixture tolerance: absolute `$0.005` for dollar floats and exact for tiers.

## Wrong readings

- Using `>=` puts `$109,000` in tier 1 and produces `$3,583.20` total instead of `$2,434.80`.
- Treating 35% as a 35% surcharge gives Part B monthly `$273.915`, not `$284.10`.
- Deriving the total as the standard premium times the applicable percentage over 25 (the engine's rule until 2026-09-29) gives `$284.06`, `$405.80`, `$527.54`, `$649.28` and `$689.86`: four of the five tiers miss CMS's published totals, tier 1 by `$0.48` a year and tier 4 by `$0.96` a year.

## Family

outputs: `medicare-premiums-annual`; `irmaa-surcharge-annual`.

feeds: `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Restated 2026-09-29 by claude (opus 5.5): the engine now reads CMS's published Part B tier totals, so the first tier prices at $284.10 a month, not $284.06 (Part B annual $3,409.20, was $3,408.72; IRMAA-only $1,148.40, was $1,147.92), and the worksheet adds one case per tier from CMS's 2026 table, read on cms.gov on 2026-09-29. The restated claim is Claude's, and the record is unreviewed until a Codex or Grok review.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
