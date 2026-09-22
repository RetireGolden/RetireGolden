## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.insuranceCashValue` and `#YearResult.deathBenefit`, transitioned by `projection/internal/annualPermanentLifeTransitions.ts#annualPermanentLifeTransitions`, publish the year-end cash-value asset and the death-year settlement. Schedule mode linearly interpolates by attained age with endpoint clamping; flat-rate mode compounds the prior cash value by `cashValueGrowthPct`. In the year the insured attains the death age, payout is `max(deathBenefit face amount, cash value)` and the settled policy no longer contributes cash value. After that year the cash value remains zero and no payout is published.

## Justification

Cash value is an asset held outside withdrawals. A death settlement is a separate tax-free receipt, and the same policy cannot remain both settled and an ending cash-value asset. The completed transition comment places settlement exactly in the death-age year, not in a later year.

## Inputs

| Policy input | Living policy | Settling policy | Unit |
|---|---:|---:|---|
| Attained age | 65 | 70 | years |
| Death age | 90 | 70 | years |
| Cash-value mode | schedule | flatRate | mode |
| Schedule points | age 60: 20,000; age 70: 40,000 | n/a | dollars |
| Entry cash value | n/a | 60,000 | nominal dollars |
| Flat growth rate | n/a | 0 | percent/year |
| Face death benefit | 100,000 | 50,000 | nominal dollars |

## Arithmetic

Living-policy interpolation weight `= (65 - 60) / (70 - 60) = 0.5`; cash value `= $20,000 + 0.5 × ($40,000 - $20,000) = $30,000`. The settling policy is at attained age 70, equal to its death age; its cash value remains `$60,000` for the settlement calculation. Death-year payout `= max($50,000, $60,000) = $60,000`, after which its ending cash value is `$0`. Totals: cash value `$30,000`; death benefit `$60,000`.

## Expected

Exact values in the death-age year: `insuranceCashValue = $30,000` and `deathBenefit = $60,000`. Fixture tolerance: absolute `$0.005` for each, because interpolation and growth are binary-floating-point operations.

## Wrong readings

- Taking the lower schedule endpoint without interpolation produces cash value `$20,000`.
- Paying only the settling policy's `$50,000` face amount ignores the `max` rule.
- Retaining the settled `$60,000` cash value produces year-end insurance cash value `$90,000` and double-counts the same policy.
- Moving the settling-policy row to attained age 71 describes the year after death: that policy then has `payout = null` and cash value `$0`, rather than the death-year `$60,000` payout.

## Family

outputs: `insurance-cash-value-annual`; `insurance-death-benefit-annual`.

feeds: `accounts-net-worth-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-eleven comment completion)").

Revision note: The first derivation put the settling policy at attained age 71 while describing and calculating the death-age-70 year; the implementation's fixture found that mismatch. This revision places the settlement at attained age 70 and preserves the original amounts.
