## Claim

Kind: formula. `engine/src/montecarlo/run.ts#aggregateMonteCarlo` publishes `MonteCarloSummary.lastingPathCount`, the number of simulated paths whose investable assets never run out (depletionYear null), counted in the same pass that counts `downsideRisk.failingPathCount`, the paths that do run out. Every path is one or the other, so lasting + failing = pathCount, successRate = lastingPathCount ÷ pathCount, and failingPathCount = the sum of `depletionYearCounts`. The Monte Carlo page prints the lasting count in "Why this number?" ("lasted to the end of the plan in N of the M simulated markets") and the failing count in the first-depletion chart's label ("for the N paths that ran out of money"), and computes neither.

## What the UI computed

At `f97cf418`:

```tsx
// planner-ui/src/planner/explainPanels.tsx#WhySuccessPanel
{(summary.pathCount - failing).toLocaleString()} of the {summary.pathCount.toLocaleString()} simulated markets
// planner-ui/src/planner/MonteCarloPage.tsx#MonteCarloPage, the "When depleting plans run out" chart
aria-label={`Histogram of first-depletion years for the ${summary.depletionYearCounts.reduce((a, r) => a + r.count, 0)} paths that ran out of money.`}
```

`aggregateMonteCarlo` already counted the lasting paths (`successes`) and published only their share (`successRate`); the page subtracted to get them back, and summed the year counts to get a count the engine already published as `failingPathCount`.

## Engine publication

- `MonteCarloSummary.lastingPathCount: number`, the aggregation's own `successes` counter; `downsideRisk.failingPathCount` unchanged.
- Domain: any aggregation, including an empty one (0 and 0). Units: counts of paths. Timing: once per aggregation. Rounding: none.
- After the move the panel prints `summary.lastingPathCount` and the chart label `summary.downsideRisk.failingPathCount`, with the same formatting as before (the panel's `toLocaleString`, the label's plain integer).

## Justification

A path "lasted to the end of the plan" when its investable assets never ran out, which is exactly the path the aggregation counts as a success (`depletionYear === null`), so the count is that counter, not a difference taken again on the page. A path that ran out has a first-depletion year, so the chart's paths are the failing paths, which the engine counts in the same branch that adds the year's count.

## Inputs

| Case | Paths |
|---|---|
| A | 5 failing (2040, 2041, 2042, 2043, 2060) and 5 lasting |
| C | 8 lasting |
| E | 150 failing (in 2047 to 2053) and 850 lasting |
| G | 3 lasting that meet their required floor, 2 lasting that fall short of it, 1 failing |

## Arithmetic

A. lasting 5, failing 5, 5 + 5 = 10 paths; successRate 5 ÷ 10 = 0.5; year counts 1 + 1 + 1 + 1 + 1 = 5.

C. lasting 8, failing 0; no year counts.

E. lasting 850, failing 150; 850 + 150 = 1,000; the Why panel prints "850 of the 1,000 simulated markets (150 depleted early)".

G. lasting 3 + 2 = 5, failing 1; the paths meeting the required floor number 3 (requiredFloorSuccessRate 0.5 × 6).

## Expected

| Case | lasting | failing | pathCount |
|---|---:|---:|---:|
| A | 5 | 5 | 10 |
| C | 8 | 0 | 8 |
| E | 850 | 150 | 1,000 |
| G | 5 | 1 | 6 |

Tolerance exact. An empty sample gives 0 and 0.

Example library at the Monte Carlo page's defaults (each example as the app opens it, a 2026 start, 1,000 paths on the default seed with the headline model, measured on this branch): on all 29 `lastingPathCount` equals the retired `pathCount − failingPathCount`, and `failingPathCount` equals the retired sum of the year counts. Lasting counts run from 0 (inherited-ira-beneficiary, survivor-years, ltc-shock) to 1,000 (five examples); example-couple lasts in 720 of 1,000 and runs out in 280.

## Wrong readings

- The paths that met their required spending floor read as the paths that lasted: case G 3 instead of 5 (a path can last and still fall short).
- pathCount × successRate rounded: the same number here, but a share recomputed into a count is the page's arithmetic again; the count is published.
- The number of rows of `depletionYearCounts` (years) read as the number of failing paths: case A 5 by coincidence, case E 7 instead of 150.

## Parity test for the switch-over

`planner-ui/src/planner/freezeAdditions.parity.test.ts`, "Monte Carlo": on the 29 examples (100 paths on the default seed with the headline model), `lastingPathCount` equals `pathCount − failingPathCount` and `failingPathCount` equals the sum of the year counts. `MonteCarloPage.fan.test.tsx` renders the page on a summary with 3 of 8 paths failing and reads "lasted to the end of the plan in 5 of the 8 simulated markets (3 depleted early)" and the label "Histogram of first-depletion years for the 3 paths that ran out of money."; `explainPanels.test.tsx` reads "850 of the 1,000 simulated markets". Acceptance grep: no `pathCount - failing` in `explainPanels.tsx`, no `depletionYearCounts.reduce` in `MonteCarloPage.tsx`.

## Calculation record

- id `monte-carlo-lasting-path-count`, group monte-carlo, kind `formula`, outputs `['monte-carlo-lasting-and-depleted-path-counts']`; implementedByFunctions `run.ts#aggregateMonteCarlo`, `run.ts#MonteCarloSummary.lastingPathCount`.
- Limits: lasting means the investable assets never ran out, not that spending was met.

## Census bookkeeping

- `monte-carlo-lasting-and-depleted-path-counts`: `relocation: { status: 'done', target: 'engine/src/montecarlo/run.ts#MonteCarloSummary.lastingPathCount' }`; `uiSources` unchanged (`explainPanels.tsx#WhySuccessPanel` and `MonteCarloPage.tsx#MonteCarloPage`, which now read the two counts); the transformations name the engine fields.
- Field coverage: a new row `MonteCarloSummary.lastingPathCount` (engine/src/montecarlo/run.ts) on the family.

## Family

outputs: `monte-carlo-lasting-and-depleted-path-counts`.

feeds: none. The failing count is also `monte-carlo-failing-path-count`'s figure, which the panel prints as "(F depleted early)".

## Provenance

Derived by: claude (opus 5.5), 2026-09-30; cases by hand, the library figures from a measurement run at the page's defaults. Implemented by: claude (opus 5.5), same day. Reviewed by: unreviewed; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
