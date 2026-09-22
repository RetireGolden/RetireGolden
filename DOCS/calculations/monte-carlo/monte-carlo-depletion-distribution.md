## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `depletionYearCounts`, a histogram of first-depletion years that excludes successful paths. The extract also names `depletionProbabilityByYear`, but does not state the denominator of its per-year probability, so this worksheet does not publish that family.

## Justification

The summary comment explicitly says successes are excluded from `depletionYearCounts`; `depletionYear = null` denotes a path whose investable assets never deplete. The cumulative probability is formed by accumulating the ordered per-year probabilities, but the comments do not say whether each probability divides by all paths or only failing paths.

## Inputs

`startYear = 2030`, `endYear = 2033`. The sole per-path field read is:

| Path | `depletionYear` |
|---:|---:|
| A | `null` |
| B | 2031 |
| C | 2031 |
| D | 2033 |
| E | `null` |

## Arithmetic

A and E are successes and do not appear. Sorting and grouping the failures gives 2031 count `2` and 2033 count `1`, hence `[{ year: 2031, count: 2 }, { year: 2033, count: 1 }]`.

For the omitted probability field, an all-path denominator would give probabilities `2/5`, `1/5` and cumulative values `2/5`, `3/5`; a failing-path denominator would give `2/3`, `1/3` and cumulative values `2/3`, `1`. The extract cannot choose between them.

## Expected

`depletionYearCounts = [{ year: 2031, count: 2 }, { year: 2033, count: 1 }]`, exact for years and counts. No expected `depletionProbabilityByYear` is asserted because its probability base is unstated.

## Wrong readings

- Counting successes in a `null` bucket produces `[{ year: null, count: 2 }, { year: 2031, count: 2 }, { year: 2033, count: 1 }]`; successes must be absent.
- Emitting one row per failing path produces duplicate 2031 rows of count `1`, instead of its grouped count `2`.
- Dividing by all paths yields final cumulative probability `0.6`, while dividing by failures yields `1`; selecting either would invent the missing denominator rule.

## Family

outputs: `monte-carlo-depletion-year-histogram`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
