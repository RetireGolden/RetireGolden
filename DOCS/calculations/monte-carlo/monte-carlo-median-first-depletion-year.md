## Claim

Kind: formula. `engine/src/montecarlo/run.ts#aggregateMonteCarlo` publishes `MonteCarloSummary.medianFirstDepletionYear`: walking `depletionYearCounts` in year order and adding each year's count, the first year whose running count reaches half of `downsideRisk.failingPathCount`. With an odd failing count that is the middle failing path's year; with an even count it is the lower of the two middle years; with no failing path it is null. Paths that last are not counted. The Monte Carlo page's "Why this number?" panel prints it as "(median YEAR)" and computes nothing.

## What the UI computed

`planner-ui/src/planner/explainPanels.tsx#WhySuccessPanel` at `f97cf418`:

```tsx
const medianDepletion = (() => {
  if (failing === 0) return null
  let seen = 0
  for (const row of depletions) {
    seen += row.count
    if (seen >= failing / 2) return row.year
  }
  return depletions[depletions.length - 1]?.year ?? null
})()
```

with `failing = summary.downsideRisk.failingPathCount` and `depletions = summary.depletionYearCounts`. The last line is never reached: `aggregateMonteCarlo` adds a path to a year's count exactly when it adds it to `failingPathCount`, so the counts add up to the failing count and the running total reaches half of it by the last row.

## Engine publication

- `MonteCarloSummary.medianFirstDepletionYear: number | null`, set in `aggregateMonteCarlo` from its own `depletionYearCounts` and `failingPathCount` by the module function `medianFirstDepletionYear`, the page's walk moved as it was. With no failing path there is no row to walk and the result is null, the same as the page's early return.
- Domain: any aggregation, including an empty one (null). Units: a calendar year, always one some path first ran out in. Timing: once per aggregation. Rounding: none.
- After the move the panel reads `summary.medianFirstDepletionYear`.

## Justification

"Median first-depletion year" answers when the typical failure happens among the markets that fail. It is a median of the failing paths' first-depletion years, so the lasting paths are left out; a calendar year is printed, so the even case takes one of the two middle years rather than their average (2042.5 is not a year), and the lower one is the year by which half of the failing paths have run out, the reading the panel's sentence "Failing paths first run out between EARLIEST and LATEST (median YEAR)" supports.

## Inputs

| Case | First-depletion years of the failing paths | Lasting paths |
|---|---|---:|
| A | 2040, 2041, 2042, 2043, 2060 | 5 |
| B | 2035, 2040, 2045, 2050 | 0 |
| C | none | 8 |
| D | 2040, 2040, 2040, 2050, 2060 | 1 |
| E | 40 in 2047, 60 in 2050, 50 in 2053 | 850 |

## Arithmetic

A. Failing 5, half 2.5: running 1 (2040), 2 (2041), 3 (2042) ≥ 2.5, so 2042, the third of five.

B. Failing 4, half 2: running 1 (2035), 2 (2040) ≥ 2, so 2040; the two middle years are 2040 and 2045.

C. Failing 0: no rows, null.

D. Failing 5, half 2.5: running 3 at 2040, so 2040.

E. Failing 150, half 75: running 40 (2047), 100 (2050) ≥ 75, so 2050. This is the summary the panel's own rendering test uses ("median 2050").

## Expected

| Case | Median year |
|---|---|
| A | 2042 |
| B | 2040 |
| C | none |
| D | 2040 |
| E | 2050 |

Tolerance exact. An empty sample gives null.

Example library at the Monte Carlo page's defaults (each example as the app opens it, a 2026 start, 1,000 paths on the default seed with the headline model, measured on this branch): on all 29 the engine's median equals the retired walk. 24 examples have failing paths (13 of them an even number); the 5 with none (moving-state-tax, early-career-match, annuity-purchases-estate, no-head-start-grad, trump-account-head-start) print the no-depletion sentence and no median. Some medians: example-couple 2051 (280 failing, first 2038, last 2059), rmd-irmaa 2045, inherited-ira-beneficiary 2032 (every path fails).

## Wrong readings

- The median over every path with the lasting ones read as never running out: case A 2060 (the fifth of ten).
- The upper middle year for an even count (`>` instead of `≥`): case B 2045.
- The average of the two middle years: case B 2042.5, not a calendar year.
- The middle of the distinct years, unweighted by their counts: case D 2050.

## Parity test for the switch-over

`planner-ui/src/planner/freezeAdditions.parity.test.ts`, "Monte Carlo": on the 29 examples (100 paths on the default seed with the headline model; the walk does not depend on the path count), `summary.medianFirstDepletionYear` equals the retired walk (kept in the test). `MonteCarloPage.fan.test.tsx` renders the page on a summary with three failing paths and reads "between 2040 and 2045 (median 2045)"; `explainPanels.test.tsx` renders the panel on case E. Acceptance grep: no `seen >= failing / 2` in `explainPanels.tsx`.

## Calculation record

- id `monte-carlo-median-depletion-year`, group monte-carlo, kind `formula`, outputs `['monte-carlo-median-first-depletion-year']`; implementedByFunctions `run.ts#aggregateMonteCarlo`, `run.ts#medianFirstDepletionYear`, `run.ts#MonteCarloSummary.medianFirstDepletionYear`.
- Limits: a median of the failing paths only; the even case is the lower middle year.

## Census bookkeeping

- `monte-carlo-median-first-depletion-year`: `relocation: { status: 'done', target: 'engine/src/montecarlo/run.ts#MonteCarloSummary.medianFirstDepletionYear' }`; `uiSources` unchanged (`explainPanels.tsx#WhySuccessPanel`, which now reads it); the retired walk moves to notes.
- Field coverage: a new row `MonteCarloSummary.medianFirstDepletionYear` (engine/src/montecarlo/run.ts) on the family; the planner-ui row `WhySuccessPanel.medianDepletion` stays on it (the panel's name for the value it now reads).

## Family

outputs: `monte-carlo-median-first-depletion-year`.

feeds: none. Reads `monte-carlo-depletion-year-histogram` and `monte-carlo-failing-path-count`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30; cases by hand, the library figures from a measurement run of the parity test's retired walk at the page's defaults. Implemented by: claude (opus 5.5), same day. Reviewed by: unreviewed; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
