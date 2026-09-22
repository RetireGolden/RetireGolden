## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `successRate`, `requiredFloorSuccessRate`, `targetLifestyleSuccessRate`, `downsideRisk.failureRate`, and `downsideRisk.failingPathCount`. A path succeeds when `depletionYear` is `null`; a failing path is therefore one whose investable assets deplete and whose `depletionYear` is non-null.

## Justification

The summary comments define success as the share of paths whose investable assets never deplete, required-floor success as the share funding that floor every year, and target-lifestyle success as the share funding the full target every year. Failure is the complement of success, with the count taken over failing paths.

## Inputs

`startYear = 2030`, `endYear = 2032`. These are every per-path field read by the five statistics.

| Path | `depletionYear` | `requiredFloorMet` | `targetLifestyleMet` |
|---:|---:|---|---|
| A | `null` | true | true |
| B | `null` | true | false |
| C | `null` | false | false |
| D | 2031 | true | false |
| E | 2032 | false | false |

## Arithmetic

Successes are A, B, C: `3 / 5 = 0.6`. Required-floor successes are A, B, D: `3 / 5 = 0.6`. Target-lifestyle success is A: `1 / 5 = 0.2`. Failures are D and E: count `2`, rate `2 / 5 = 0.4` (also `1 - 0.6`). The deliberately crossed booleans show that depletion, essential-floor funding, and full-target funding are distinct tests.

## Expected

`successRate = 0.6`, `requiredFloorSuccessRate = 0.6`, `targetLifestyleSuccessRate = 0.2`, `downsideRisk.failureRate = 0.4`, and `downsideRisk.failingPathCount = 2`. Fixture tolerance: absolute `1e-9` for rates; exact for the count.

## Wrong readings

- Treating `requiredFloorMet` as the success test gives successes A, B, D and happens to produce `0.6`, but misclassifies C and D; the path identities must be asserted, not just this coincidental rate.
- Treating any target miss as depletion makes B, C, D, E fail: failure rate `4 / 5 = 0.8` and failing count `4`.
- Counting only paths that both deplete and miss the required floor leaves E alone: failure rate `1 / 5 = 0.2` and failing count `1`.

## Family

outputs: `monte-carlo-success-rate`; `monte-carlo-required-floor-success-rate`; `monte-carlo-target-lifestyle-success-rate`; `monte-carlo-failure-rate`; `monte-carlo-failing-path-count`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
