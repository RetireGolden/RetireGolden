## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.incomes.annuity`, produced by `projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome`, starts an annuity at its start age, applies its annual COLA, and applies the selected payout form. For `jointSurvivor`, payments continue to the surviving joint annuitant at `survivorPct`; the annualization and COLA formula are derived from the plan comments' monthly amount and annual-COLA convention.

## Justification

The extract states the joint-survivor fraction explicitly, so no unstated payout fraction is needed. A life-only contract would stop at owner death; a period-certain contract would continue only inside its guarantee window.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Start age | 65 | attained age |
| Current owner's would-be age | 66 | attained age |
| Owner alive / other household member alive | false / true | Boolean |
| Monthly amount at start | 1,500 | nominal dollars/month |
| COLA | 2 | percent/year |
| Payout form | joint survivor | form |
| Joint-survivor percentage | 60 | percent |

## Arithmetic

One post-start COLA gives full annual payment `= 1,500 × 12 × 1.02 = $18,360`. Survivor payment `= 18,360 × 60/100 = $11,016`.

## Expected

Exact value: `$11,016`. Fixture tolerance: absolute `$0.005`, because COLA multiplication uses binary floating point.

## Wrong readings

- Applying life-only behavior to the joint-survivor form produces `$0`.
- Paying the full amount after owner death produces `$18,360`.
- Applying 60% to the monthly amount but omitting the COLA produces `$10,800` annually.

## Family

outputs: `income-annuity-annual`.

feeds: `income-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
