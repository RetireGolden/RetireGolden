## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `idealFundingRate` and `excessFundingRate` as ratios of totals across paths, and publishes each of the six `flexibleGoals` figures as a sum across every path. A funding rate is `1` when its total intended amount is zero.

## Justification

The `MonteCarloSummary` comments specify `sum(idealFunded) / sum(idealIntended)` and `sum(excessFunded) / sum(excessIntended)`, with `1` when nothing was intended. They separately specify that every flexible-goal count and amount is summed across paths.

## Inputs

This four-path fixture supplies every field read by the three output families. Path D has zero intended dollars, so averaging per-path rates under the documented zero-intended convention disagrees with the required ratios of totals.

| Path | `idealIntended` | `idealFunded` | `excessIntended` | `excessFunded` | `flexibleGoals` (`funded`,`partiallyFunded`,`deferred`,`skipped`,`fundedAmount`,`unfundedAmount`) |
|---:|---:|---:|---:|---:|---|
| A | $100 | $100 | $100 | $0 | `1,0,0,0,$100,$0` |
| B | $300 | $0 | $300 | $300 | `0,1,0,0,$150,$150` |
| C | $100 | $50 | $100 | $50 | `0,0,1,1,$50,$50` |
| D | $0 | $0 | $0 | $0 | `2,1,1,0,$200,$100` |

A second case has any nonempty path set in which every path has `idealIntended = 0`, `idealFunded = 0`, `excessIntended = 0`, and `excessFunded = 0`.

## Arithmetic

Ideal totals are funded `$100 + $0 + $50 + $0 = $150` and intended `$100 + $300 + $100 + $0 = $500`, so `idealFundingRate = 150 / 500 = 0.3`. Excess totals are funded `$0 + $300 + $50 + $0 = $350` and intended `$500`, so `excessFundingRate = 350 / 500 = 0.7`.

The flexible-goal sums are funded `1 + 0 + 0 + 2 = 3`, partially funded `0 + 1 + 0 + 1 = 2`, deferred `0 + 0 + 1 + 1 = 2`, skipped `0 + 0 + 1 + 0 = 1`, funded amount `$100 + $150 + $50 + $200 = $500`, and unfunded amount `$0 + $150 + $50 + $100 = $300`. In the all-zero-intended second case, both rate denominators are zero, so the documented convention gives both rates as `1`.

## Expected

For the four-path case, `idealFundingRate = 0.3`, `excessFundingRate = 0.7`, and `flexibleGoals = { funded: 3, partiallyFunded: 2, deferred: 2, skipped: 1, fundedAmount: 500, unfundedAmount: 300 }`. For the all-zero-intended case, `idealFundingRate = 1` and `excessFundingRate = 1`. Fixture tolerance: absolute `1e-9` for each rate because it is a ratio from short exact inputs; exact for every flexible-goal count and amount because each is a sum of integers.

## Wrong readings

- Averaging per-path rates while assigning the documented zero-intended convention to path D gives ideal `(1 + 0 + 0.5 + 1) / 4 = 0.625` instead of `0.3`, and excess `(0 + 1 + 0.5 + 1) / 4 = 0.625` instead of `0.7`.
- Averaging rather than summing the flexible-goal figures gives `{ funded: 0.75, partiallyFunded: 0.5, deferred: 0.5, skipped: 0.25, fundedAmount: 125, unfundedAmount: 75 }` instead of `{ 3, 2, 2, 1, 500, 300 }` in field order.
- Treating a zero total intended amount as a zero rate gives `0` for each rate in the second case; the required value is `1`.

## Family

outputs: `monte-carlo-ideal-funding-rate`; `monte-carlo-excess-funding-rate`; `monte-carlo-flexible-goal-outcome-counts`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory (the follow-up review section).
