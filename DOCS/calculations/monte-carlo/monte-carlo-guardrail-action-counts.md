## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `guardrailActionCounts.cut`, `.raise`, and `.hold` by summing each action count across every path.

## Justification

The `MonteCarloSummary.guardrailActionCounts` comment says that each action count is summed across every path, not averaged.

## Inputs

This four-path fixture supplies every field read by the output. Path D deliberately has no actions.

| Path | `cut` | `raise` | `hold` |
|---:|---:|---:|---:|
| A | 2 | 1 | 3 |
| B | 0 | 2 | 1 |
| C | 4 | 0 | 2 |
| D | 0 | 0 | 0 |

## Arithmetic

Cuts total `2 + 0 + 4 + 0 = 6`. Raises total `1 + 2 + 0 + 0 = 3`. Holds total `3 + 1 + 2 + 0 = 6`.

## Expected

`guardrailActionCounts = { cut: 6, raise: 3, hold: 6 }`. Fixture tolerance: exact for all three figures because they are sums of integer action counts.

## Wrong readings

- Averaging the counts across four paths gives `{ cut: 1.5, raise: 0.75, hold: 1.5 }` rather than `{ cut: 6, raise: 3, hold: 6 }`.
- Counting paths with at least one action of each kind gives `{ cut: 2, raise: 2, hold: 3 }`, which measures path incidence rather than action totals.
- Dropping the zero-action path and averaging the remaining three gives `{ cut: 2, raise: 1, hold: 2 }`; zero-action paths remain part of the set and the output is a sum in any event.

## Family

outputs: `monte-carlo-guardrail-action-counts`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory (the follow-up review section).
