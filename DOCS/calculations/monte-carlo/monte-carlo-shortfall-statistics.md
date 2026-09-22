## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `spendingShortfall.averageTotalShortfallDollars`, `spendingShortfall.p90TotalShortfallDollars`, `downsideRisk.expectedShortfallDollars`, `averageYearsBelowTarget`, `p90AverageAnnualTargetShortfall`, and the median (`p50`) of `targetAttainmentPct`.

## Justification

`totalShortfall` is each path's sum of unfunded spending; expected shortfall is explicitly the average of that value across failing paths. The other field names specify the all-path average or p90, while `percentile` supplies linear interpolation. A failing path has a non-null `depletionYear` under the documented success definition.

## Inputs

`startYear = 2030`, `endYear = 2034`. These are every per-path field read:

| Path | `depletionYear` | `totalShortfall` | `yearsBelowTarget` | `averageAnnualTargetShortfall` | `targetAttainmentPct` |
|---:|---:|---:|---:|---:|---:|
| A | `null` | $0 | 0 | $0 | 1.00 |
| B | `null` | $10 | 1 | $5 | 0.90 |
| C | 2031 | $20 | 2 | $10 | 0.80 |
| D | 2032 | $50 | 4 | $20 | 0.60 |
| E | `null` | $100 | 8 | $40 | 0.20 |

## Arithmetic

Average total shortfall is `(0 + 10 + 20 + 50 + 100) / 5 = $36`. Its ascending sample is `[0,10,20,50,100]`; p90 index is `0.9 × 4 = 3.6`, so p90 is `50 × 0.4 + 100 × 0.6 = $80`.

Failing paths are C and D, hence expected shortfall on failures is `(20 + 50) / 2 = $35`; E's larger shortfall is not included because it did not deplete.

Average years below target is `(0 + 1 + 2 + 4 + 8) / 5 = 3`. For average annual target shortfall `[0,5,10,20,40]`, p90 is `20 × 0.4 + 40 × 0.6 = $32`. Sorted attainment is `[0.20,0.60,0.80,0.90,1.00]`, whose p50 is `0.80`.

## Expected

`spendingShortfall.averageTotalShortfallDollars = $36`, `spendingShortfall.p90TotalShortfallDollars = $80`, `downsideRisk.expectedShortfallDollars = $35`, `averageYearsBelowTarget = 3`, `p90AverageAnnualTargetShortfall = $32`, and `targetAttainmentPct.p50 = 0.8`. Fixture tolerance: absolute `1e-9` for interpolated percentiles, rates, and the years average; absolute `$0.005` for dollar averages if division is inexact (these chosen dollar results are exact).

## Wrong readings

- Nearest-rank p90 selects `$100` total and `$40` average annual, rather than interpolated `$80` and `$32`.
- Averaging expected shortfall over all paths gives `$36`, not the conditional failing-path value `$35`.
- Defining failure as any positive shortfall includes B and E and gives `(10 + 20 + 50 + 100) / 4 = $45` expected shortfall.
- Averaging attainment gives `0.70`; the requested median is `0.80`.

## Family

outputs: `monte-carlo-average-total-shortfall`; `monte-carlo-p90-total-shortfall`; `monte-carlo-expected-shortfall-on-failing-paths`; `monte-carlo-average-years-below-target`; `monte-carlo-p90-average-annual-target-shortfall`; `monte-carlo-target-attainment-median`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
