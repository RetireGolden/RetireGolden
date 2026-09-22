## Claim

Kind: formula. `montecarlo/run.ts#aggregateMonteCarlo` publishes `adjustments.pathsWithCut`, `pathsWithRaise`, `averageCutYears`, `p90CutYears`, `medianMaxCutDepth`, `p90MaxCutDepth`, `averageLongestCutSpellYears`, `probEndingSurplus`, and `probEndingAboveBequestTarget`. The extract does not document how `guardrailActionCounts` aggregates path records, so that requested family is not published here.

## Justification

The comments define the two path shares, make cut magnitude/duration statistics conditional on paths that cut at least once, and define the two ending probabilities. “Among cut paths” excludes every path with zero cut years. The bequest result is `null` when no target is set.

## Inputs

These are every per-path field read by the documented statistics:

| Path | `guardrailActionCounts` (`cut`,`raise`,`hold`) | `guardrailCutYears` | `longestGuardrailCutSpellYears` | `maxGuardrailCutDepth` | `endingAfterTaxEstate` | `endingAboveBequestTarget` |
|---:|---|---:|---:|---:|---:|---|
| A | `0,0,3` | 0 | 0 | 0.00 | $0 | false |
| B | `2,0,1` | 2 | 1 | 0.10 | $100 | true |
| C | `1,1,1` | 4 | 3 | 0.30 | $200 | false |
| D | `4,2,0` | 8 | 5 | 0.60 | $0 | true |
| E | `0,1,2` | 0 | 0 | 0.00 | $50 | true |

## Arithmetic

Cut paths are B, C, D, so `pathsWithCut = 3 / 5 = 0.6`. Paths with at least one raise action are C, D, E, so `pathsWithRaise = 3 / 5 = 0.6`.

Among cut paths only, cut years are `[2,4,8]`: average `14 / 3 = 4.666666666666667`; p90 index `0.9 × 2 = 1.8`, so `4 × 0.2 + 8 × 0.8 = 7.2`. Maximum depths `[0.10,0.30,0.60]` give median `0.30` and p90 `0.30 × 0.2 + 0.60 × 0.8 = 0.54`. Longest spells `[1,3,5]` average to `3` years.

Positive ending estates occur on B, C, E: `3 / 5 = 0.6`. Three of five explicit bequest comparisons are true: `3 / 5 = 0.6`. If the plan has no target, all five inputs would be `null` and the documented summary result is `null`.

Although summing the displayed action records would give `{ cut: 7, raise: 4, hold: 7 }`, no summary comment states that summation rule, so it is not asserted.

## Expected

`pathsWithCut = 0.6`, `pathsWithRaise = 0.6`, `averageCutYears = 14/3`, `p90CutYears = 7.2`, `medianMaxCutDepth = 0.3`, `p90MaxCutDepth = 0.54`, `averageLongestCutSpellYears = 3`, `probEndingSurplus = 0.6`, and `probEndingAboveBequestTarget = 0.6`. With no bequest target, the last field is exactly `null`. Fixture tolerance: absolute `1e-9` for shares, averages, and interpolated percentiles; exact for `null` and integer-year results.

## Wrong readings

- Dividing conditional cut-year totals by all five paths gives average cut years `14 / 5 = 2.8` and average longest spell `9 / 5 = 1.8`, instead of `14/3` and `3`.
- Nearest-rank p90 gives `8` cut years and depth `0.60`, rather than interpolated `7.2` and `0.54`.
- Treating zero estate as a surplus counts A and D and produces `5 / 5 = 1`, rather than `3 / 5 = 0.6`.
- Treating `null` bequest comparisons as false would produce `0` when no target exists, rather than the documented `null`.

## Family

outputs: `monte-carlo-paths-with-cut-share`; `monte-carlo-paths-with-raise-share`; `monte-carlo-cut-years`; `monte-carlo-max-cut-depth-percentiles`; `monte-carlo-average-longest-cut-spell-years`; `monte-carlo-prob-ending-surplus`; `monte-carlo-prob-ending-above-bequest-target`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-seven.md in this directory.
