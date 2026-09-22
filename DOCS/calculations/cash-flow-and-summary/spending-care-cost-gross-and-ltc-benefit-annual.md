## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.expenses.careCost` and `#YearResult.expenses.ltcBenefit`, planned by `projection/internal/annualDebtAndLongTermCare.ts#annualLongTermCarePlan`, publish the two sides of one LTC rule. An active episode contributes `annualCost × health-inflation factor` to gross care cost. An eligible policy contributes no more than gross cost or its rider-grown annual cap; in the episode's first year that cap is multiplied by `(365 - eliminationPeriodDays) / 365`, and no benefit is available after `benefitPeriodYears` has been used. These formulas are derived from the comments' episode, rider, elimination-period, and benefit-years conventions.

## Justification

Care cost is a gross additive spending spike. The policy reimbursement is separately published and reduces spending only in the expense total.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start / current year | 2028 / 2030 | year |
| Care episode start age / current age | 80 / 80 | attained years |
| Episode duration | 3 | years |
| Episode annual cost | 60,000 | today dollars/year |
| Health-inflation factor | 1.21 | nominal/today ratio |
| Policy monthly benefit | 5,000 | nominal base dollars/month |
| Inflation rider | 5 | percent/year |
| Elimination period | 90 | days |
| Benefit period / years already used | 2 / 0 | years |
| Second same-owner policy years allowed / used | 2 / 2 | years |

## Arithmetic

The episode is active, so gross care cost `= $60,000 × 1.21 = $72,600`. The first policy's 2030 annual cap before elimination is `$5,000 × 12 × 1.05^(2030-2028) = $66,150`. First-year eligible cap `= $66,150 × 275 / 365 = $49,839.0410958904`. Benefit `= min($72,600, $49,839.0410958904) = $49,839.0410958904`. The second policy is exhausted and adds `$0`.

## Expected

Exact values: `expenses.careCost = $72,600` and `expenses.ltcBenefit = $49,839.0410958904`. Fixture tolerance: absolute `$0.005` for each, because inflation, rider compounding, and the day fraction use binary floating point.

## Wrong readings

- Treating the episode's today-dollar cost as nominal produces gross care cost `$60,000`.
- Ignoring the first-year elimination haircut produces benefit `$66,150`.
- Applying the 90-day haircut to gross cost instead of the policy cap produces benefit `$54,698.6301369863`.
- Letting the exhausted second policy pay adds a benefit not permitted by the benefit-years gate.

## Family

outputs: `spending-care-cost-gross-annual`; `long-term-care-benefit-annual`.

feeds: `spending-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (approved with a note that the rule was stated to the deriver rather than by a doc comment; the comment patch closes it).
