## Claim

Kind: formula. `engine/src/montecarlo/run.ts#histogramFor` publishes each bin's centre on the histogram it builds: `Histogram.binCenters[i] = min + (i + 0.5) × binWidth`, except when every value is equal, where every centre is `min` (the value every path ended at). The Monte Carlo page labels the ending-balance histogram's bars with `fmtMoneyCompact(binCenters[i])` and computes nothing.

## What the UI computes today

`planner-ui/src/planner/MonteCarloPage.tsx` at `a7f62f1e` (unchanged by #747):

```tsx
const histRows = useMemo(() => {                                                                   // :263
  if (!summary) return []
  const { min, binWidth, counts } = summary.endingInvestable.histogram
  return counts.map((count, i) => ({ label: fmtMoneyCompact(min + (i + 0.5) * binWidth), count }))    // :266
}, [summary])
```

Inputs: `MonteCarloSummary.endingInvestable.histogram` from `histogramFor` (`engine/src/montecarlo/run.ts:406-415`): `min` the smallest ending value, `binWidth = (max − min) / bins`, or 1 when every value is equal (`:409`), each value counted in `min(bins − 1, floor((v − min) / binWidth))`; 30 bins by default (`aggregateMonteCarlo`, `:417`).

When every path ends at the same value, `binWidth` is 1 only so the loop can divide; the page then labels the bars `min + 0.5, min + 1.5, …, min + 29.5`. For a plan where every path runs out, that is "$1", "$2", …, "$30" (`fmtMoneyCompact` rounds `0.5` to `$1`), a dollar scale no path produced, with all the paths in the bar labelled "$1". At the page's defaults as they were when this was derived (1,000 paths, the headline lognormal model at 12%, and the plan-id seed, which decision D-MC-DEFAULT-SEED replaced on 2026-09-28 with the engine's default seed) this happened on 4 of the 29 examples: inherited-ira-beneficiary, survivor-years, ltc-shock and brokerage-no-hsa, each with 1,000 of 1,000 paths ending at $0 (scratch-copy run). On the default seed it happens on 3: inherited-ira-beneficiary, survivor-years and ltc-shock (the re-measurement at the end of this worksheet).

## Engine publication

```ts
// engine/src/montecarlo/run.ts
export interface Histogram {
  min: number
  /** (max − min) / bins; 1 when every value is equal (a placeholder that lets every value land in bin 0). */
  binWidth: number
  /** counts[i] covers [min + i·binWidth, min + (i+1)·binWidth); the last bin also holds the maximum. */
  counts: number[]
  /** NEW. The centre of each bin, min + (i + 0.5) · binWidth; every entry is min when every value is equal. */
  binCenters: number[]
}
```

- In `histogramFor`: `binCenters = counts.map((_, i) => max > min ? min + (i + 0.5) * binWidth : min)`, in this association (the UI's; bit-identical).
- Domain: any sample, including an empty one (`min = max = 0`: every centre 0). Units: nominal dollars, the same as the histogram's values (ending investable at the path's last year). Timing: once per aggregation. Rounding: none; the page's `fmtMoneyCompact` formats.
- All three histograms `aggregateMonteCarlo` builds (ending investable, net worth, after-tax estate) carry the field; the page reads only the first.
- The doc comments are corrected in passing (recon "contracts missing" item 8): the last bin is closed and holds the maximum; `binWidth` is 1 in the degenerate case.
- After the move: `histRows = counts.map((count, i) => ({ label: fmtMoneyCompact(histogram.binCenters[i]!), count }))`.

Degenerate case, old versus corrected: every path ends at $0; old labels "$1", "$2", …, "$30"; corrected, every label "$0", with all the paths in the first bar. (Whether the page then draws a single bar is presentation; the recommendation in the README is to draw one bar when `binWidth` is the placeholder, which the page can tell from `binCenters[0] === binCenters[1]`.)

## Justification

A bin's centre is the midpoint of the interval it covers, `[min + i·w, min + (i+1)·w)`. When every value is equal no interval exists; the one value is the only coordinate the data has, so the centre is that value. The label is an axis coordinate, but a wrong one misleads (Rule 2), and publishing it in the engine removes the last dollar arithmetic from this chart (D-UI-SS).

## Inputs

| Case | Sample | bins |
|---|---|---:|
| A | a histogram with `min` 100,000, `binWidth` 50,000 | 30 |
| B | endings `[0, 0, 250,000, 1,200,000, 3,000,000]` | 30 |
| C | endings `[0, 0, 0, 0]` | 30 |
| D | endings `[]` | 30 |
| E | endings `[0, 20, 40, 80, 100]` (the record `monte-carlo-ending-distributions`'s own case) | 4 |

## Arithmetic

A. `100,000 + 0.5 × 50,000 = 125,000`; `+ 1.5 × 50,000 = 175,000`; `+ 2.5 × 50,000 = 225,000`; last `100,000 + 29.5 × 50,000 = 1,575,000`. Labels "$125k", "$175k", "$225k", "$1.58M".

B. `min 0`, `max 3,000,000`, `binWidth 100,000`. Counts: two values in bin 0, 250,000 in bin 2, 1,200,000 in bin 12, 3,000,000 in bin 29 (clamped from 30). Centres of the occupied bins: 50,000 ("$50k"), 250,000 ("$250k"), 1,250,000 ("$1.25M"), 2,950,000 ("$2.95M").

C. `min = max = 0`, `binWidth 1`, `counts[0] = 4`. Centres all 0; labels "$0" (retired: "$1", "$2", "$3", "$4", …, "$30").

D. `min = max = 0`, `binWidth 1`, all counts 0; centres all 0.

E. `min 0`, `binWidth 25`, counts `[2, 1, 0, 2]`; centres 12.5, 37.5, 62.5, 87.5.

## Expected

A `[125000, 175000, 225000, …, 1575000]` (30 entries; entry `i` = `100000 + (i + 0.5) * 50000`, Object.is); B entries 0, 2, 12, 29 are `50000, 250000, 1250000, 2950000`; C and D thirty zeros; E `[12.5, 37.5, 62.5, 87.5]`. Tolerance `exact`. For every non-degenerate histogram, `binCenters[i]` is `Object.is` the retired `min + (i + 0.5) * binWidth`.

Example library at the page's defaults as they were when this was derived (scratch-copy run, all 29 examples at 1,000 paths, the headline lognormal model at 12%, the plan-id seed that the default seed replaced on 2026-09-28; on the default seed three examples are degenerate, see the re-measurement at the end): 25 have non-degenerate histograms and their labels do not change; the 4 degenerate ones (inherited-ira-beneficiary, survivor-years, ltc-shock, brokerage-no-hsa) change from "$1" … "$30" to "$0". Two more come close without being degenerate (hsa-property-depth 998 of 1,000 paths at $0, first label "$5,862"; fixed-target-spending 999 of 1,000, "$517"); their labels are true bin centres and do not change.

## Wrong readings

- The bin's left edge (`min + i·w`): "$100k" for case A's first bar.
- The degenerate placeholder read as a width: "$1" … "$30" (today).
- `(max − min) / (bins − 1)` spacing: with `w' = (max − min) / (bins − 1)` the centres `min + (i + 0.5) · w'` all shift, and the last one (`i = bins − 1`) is `min + (bins − 0.5) · w' = max + w'/2`, half a width above the maximum. (It is the edges `min + i · w'` that would put the last one at the maximum.)
- Centres of the estate histogram under the investable chart (the aria label at `:956` already pairs the investable histogram with the estate median; a copy mismatch the recon noted, left for the copy pass; fixed on 2026-09-30, when the label came to say only what the chart shows).

## Parity test for the switch-over

`planner-ui/src/planner/MonteCarloPage.histogram.test.ts`: for the 29 examples' summaries (100 paths is enough), `histRows[i].label === fmtMoneyCompact(summary.endingInvestable.histogram.binCenters[i])`, and for the non-degenerate ones the retired `min + (i + 0.5) * binWidth` is `Object.is` the published centre; for a degenerate summary (inherited-ira-beneficiary) every label is "$0". An engine evidence case covers A to E. Acceptance grep: no `(i + 0.5) * binWidth` in `MonteCarloPage.tsx`.

## Proposed calculation record

- id `monte-carlo-histogram-bin-centres`, group `monte-carlo`, kind `formula`, outputs `['display-histogram-bin-label']`. Statement: "montecarlo/run.ts#histogramFor publishes binCenters[i] = min + (i + 0.5) × binWidth for each bin, or min for every bin when every value is equal. Units: the histogram's dollars (nominal ending values). Rounding: none." Justification: derivation, `DOCS/calculations/monte-carlo/display-histogram-bin-label.md`. Limits: "The last bin is closed (it holds the maximum), so its centre is the midpoint of a closed interval; with every value equal the other bins are empty and their centres carry no information." implementedByFunctions `packages/engine/src/montecarlo/run.ts#histogramFor`.
- `monte-carlo-ending-distributions` (`monteCarlo.ts:707` at `a7f62f1e`): its limit "binWidth is 1, not 0, when every ending value is equal, so a degenerate sample still bins" gains "and every bin centre is that value".

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `display-histogram-bin-label`: `relocation: { status: 'done', target: 'engine/src/montecarlo/run.ts#Histogram.binCenters' }`; `uiSources` unchanged (`MonteCarloPage.tsx#MonteCarloPage`); notes "Computed in planner-ui/src/planner/MonteCarloPage.tsx#MonteCarloPage (min + (i + 0.5) × binWidth) until B2-P1 slice 2; now engine Histogram.binCenters, which MonteCarloPage reads."; transformations "The engine's histogram publishes binCenters (min + (i + 0.5) × binWidth, or min when every value is equal); the page formats it compactly."; meaning unchanged.
- Field coverage: new row `Histogram.binCenters` → family `display-histogram-bin-label`; the planner-ui row `MonteCarloPage.histRows.label` stays on the same family.
- The chart label path count (`MonteCarloPage.tsx:977`, `depletionYearCounts.reduce`) is the separate D-CENSUS-FREEZE addition and is not part of this family; the engine already publishes `downsideRisk.failingPathCount` for it.

## Family

outputs: `display-histogram-bin-label`.

feeds: none. Reads `monte-carlo-ending-investable-histogram`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; cases A to E by hand and `scripts/independent.mjs`; example frequencies from the scratch-copy runs (`scripts/engine-histogram-1000-all.json`; `engine-mc-swr.json` at 100 paths). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending at the time; the catalog asks for a reviewer of a different agent family, so the record was `unreviewed` until the review below.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`): the record's limit said 5 of the 29 examples are degenerate at the page's defaults; on the default seed the re-measurement below finds 3 (inherited-ira-beneficiary, survivor-years, ltc-shock), and 5 was the plan-id seed's count. The limit now says 3. No figure here changes. Revised by claude (opus 5.5); unreviewed until the review below.

## Implementation (B2-P1 slice 2, 2026-09-27)

- **Correction 5:** at the app's own seeds (`seedFromPlanId('example:<id>')`, 1,000 paths, the headline lognormal model at 12 percent, start 2026) 5 of the 29 examples are all one value: inherited-ira-beneficiary, survivor-years, ltc-shock, brokerage-no-hsa and fixed-target-spending (every path ends at $0). Re-measured after #748 and #750 with the same seeds: the same five, and their labels change from "$1" to "$30" to "$0"; no other label changes.
- **One bar for one value (after the review of #752):** when the engine's centres are all one value the page draws a single bar at that value holding every path, as the Engine publication section recommended, instead of thirty bars that repeat its label (`planner-ui/src/planner/format.ts#histogramBars`). `MonteCarloPage.fan.test.tsx` renders the page's histogram both ways (one bar labelled "$0" for eight paths at $0; three bars labelled "$125k", "$175k", "$225k" for case A's first three bins), and `slice2Figures.parity.test.ts` pins the five examples of correction 5 at the page's own run (`seedFromPlanId('example:<id>')`, 1,000 paths, the headline model, no stochastic longevity or care shock): every path ends at $0, every centre is 0, and the page draws one bar, "$0", holding 1,000 paths.
- **Re-measured on the default seed (decision D-MC-DEFAULT-SEED, 2026-09-28):** every plan now draws from the engine's default seed, 0x5eeded, not a hash of its id. At the page's defaults on that seed three of the five are still all one value (inherited-ira-beneficiary, survivor-years, ltc-shock: 1,000 of 1,000 paths at $0, one bar "$0"); brokerage-no-hsa and fixed-target-spending each have one surviving path, so 999 paths sit in the first bin and the histogram has two bars, both true bin centres. `slice2Figures.parity.test.ts` now pins the three at one bar and the two at 999 and 1, as the independent check of the diagnosis measured (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/mc-example-source-check.md`, section 4.4) and as the implementation's measurement run: each of the 29 examples as the app opens it, a 2026 start, 1,000 paths on the default seed 0x5eeded with the headline model, on the branch's engine at commit `5223cb68` of `claude/mc-provenance-and-seed` (before the squash; no later commit of this change moves a figure, re-measured after the merges of origin/main at 4d2d9d67 and 5224c5d0). The diagnosis, its independent check and the implementation's review, whose figures this run reproduces, are recorded with their scripts in RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/mc-example-source-{diagnosis,check,review}.md`.
- **Correction 6:** `Histogram.binCenters` is required; the two typed literals the check named (planner-ui `explainPanels.test.tsx`, engine `run.evidence.test.ts`'s local type) were updated or are unaffected.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
