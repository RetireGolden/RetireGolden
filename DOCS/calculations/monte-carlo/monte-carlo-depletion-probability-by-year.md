## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes one `depletionProbabilityByYear` row per depletion year, in `depletionYearCounts` order. Each row's probability is its count divided by all paths, including successful paths in the denominator, and cumulative probability is the running sum through that row.

## Justification

The `MonteCarloSummary` comments define `depletionYearCounts` as excluding successful paths, then explicitly retain successes in the total-path denominator for `depletionProbabilityByYear`. They also specify row order and the running-sum definition.

## Inputs

Six paths produce the following depletion outcomes and the stated `depletionYearCounts` order. A `null` depletion year is a success.

| Path | `depletionYear` |
|---:|---:|
| A | `null` |
| B | 2033 |
| C | 2031 |
| D | 2035 |
| E | `null` |
| F | 2033 |

`depletionYearCounts = [{ year: 2031, count: 1 }, { year: 2033, count: 2 }, { year: 2035, count: 1 }]`.

## Arithmetic

There are six total paths and four failures. For 2031, probability is `1 / 6 = 0.16666666666666666` and cumulative probability is `1 / 6 = 0.16666666666666666`. For 2033, probability is `2 / 6 = 0.3333333333333333` and cumulative probability is `(1 + 2) / 6 = 0.5`. For 2035, probability is `1 / 6 = 0.16666666666666666` and cumulative probability is `(1 + 2 + 1) / 6 = 0.6666666666666666`. The two successes add no row but remain in every probability's base.

## Expected

`depletionProbabilityByYear = [{ year: 2031, count: 1, probability: 1/6, cumulativeProbability: 1/6 }, { year: 2033, count: 2, probability: 1/3, cumulativeProbability: 1/2 }, { year: 2035, count: 1, probability: 1/6, cumulativeProbability: 2/3 }]`, in exactly that order. Fixture tolerance: exact for years and counts; absolute `1e-9` for probabilities and cumulative probabilities because they are ratios from short exact inputs.

## Wrong readings

- Dividing by only the four failing paths gives row probabilities `1/4, 1/2, 1/4` and cumulative probabilities `1/4, 3/4, 1`, rather than `1/6, 1/3, 1/6` and `1/6, 1/2, 2/3`.
- Adding a success row gives an extra `{ year: null, count: 2, probability: 1/3 }`; successes never form a row and only sit in the denominator.
- Reporting each row's probability as its cumulative value gives `1/6, 1/2, 2/3` instead of the individual probabilities `1/6, 1/3, 1/6`.

## Family

outputs: `monte-carlo-depletion-probability-by-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory (the follow-up review section).
