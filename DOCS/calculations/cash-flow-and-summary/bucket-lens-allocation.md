## Claim

Kind: formula. `engine/src/projection/bucketLens.ts#bucketLens(result, spans)` (new; moved verbatim from planner-ui) reads each projection year's investable total as time-segmented buckets: bucket `k` claims the published net portfolio need of the next `spans[k]` years (starting with the current year, cumulatively after earlier buckets), capped by what is left; the last bucket is the remainder. The span presets move with it as `BUCKET_LENS_SPANS`; the labels stay in the UI. No owner decision applies; nothing displayed changes.

## What the UI computes today

`planner-ui/src/planner/bucketLens.ts` at `a7f62f1e` (unchanged by #747):

```ts
const needs = years.map((y) => (typeof y.netPortfolioNeed === 'number' ? y.netPortfolioNeed : 0))   // :47
return years.map((y, i) => {
  let remaining = y.investableTotal                                                                 // :49
  let cursor = i
  for (const span of spans) {
    let bucketNeed = 0
    for (let k = 0; k < span; k++) { if (cursor + k >= needs.length) break; bucketNeed += needs[cursor + k]! }   // :54-57
    cursor += span
    const claimed = Math.min(remaining, bucketNeed)                                                 // :59
    buckets.push(claimed); remaining -= claimed
  }
  buckets.push(remaining)                                                                           // :63
  return { year: y.year, need: needs[i]!, buckets, investableTotal: y.investableTotal }
})
BUCKET_PRESETS = [{ id: 'three', spans: [2, 8], ... }, { id: 'two', spans: [3], ... }]                // :77-90
```

`BucketLensCard.tsx:42-48` maps each bucket through the Results page's dollar adapter (`adj`, slice 1's `nominalForDisplay` after #747) into a stacked area chart. Inputs: `YearResult.netPortfolioNeed` (`max(0, expenses.total + tax + penalties − incomes.total)`, engine-published) and `YearResult.investableTotal`, both nominal dollars of their own year.

## Engine publication

```ts
// engine/src/projection/bucketLens.ts
export const BUCKET_LENS_SPANS = { three: [2, 8], two: [3] } as const
export interface BucketYearRow {
  year: number
  /** This year's published netPortfolioNeed (nominal, >= 0). */
  need: number
  /** One balance per bucket, spans.length + 1 of them; they add to investableTotal to within one unit in the last place. */
  buckets: number[]
  investableTotal: number
}
export function bucketLens(result: Pick<ProjectionResult, 'years'>, spans: readonly number[]): BucketYearRow[]
```

- Formula, for year `i` with investable `T_i` and needs `n_j`: with cursor `c_0 = i` and `c_{k+1} = c_k + s_k`, `need_k = Σ_{j = c_k}^{min(c_k + s_k, N) − 1} n_j` (years past the horizon count 0), `b_k = min(R_k, need_k)`, `R_0 = T_i`, `R_{k+1} = R_k − b_k`; the growth bucket is `R_K`. Summation in the code's order (verbatim).
- Domain and refusals (Rule 4, new in the engine): every span a positive whole number; every row's `netPortfolioNeed` a finite number (a row without it is refused with its year, rather than read as 0, which the UI did for results deserialized from engines before 0.3.0; every live projection carries it: 1,210 of 1,210 example rows do).
- Units: nominal dollars of year `i` for `T_i` and the buckets; the need sums add future years' nominal needs undiscounted. Timing: annual. Rounding: none.
- `BucketLensCard.tsx` imports `bucketLens` and `BUCKET_LENS_SPANS` from the engine; `planner-ui/src/planner/bucketLens.ts` keeps only `BucketPreset` (id, label, bucket labels, and `spans: BUCKET_LENS_SPANS[id]`) or is deleted.

## Justification

The lens is a reporting convention (the card's own caveat: bucket management adds no systematic benefit over total-return investing, Estrada; Kitces). No law governs it, so the record states exactly what it does, including its two conventions: needs are nominal and undiscounted, and needs past the horizon are 0, so the leading buckets drain near the end of the plan.

## Inputs

Five-year projection: needs `[10,000, 20,000, 30,000, 40,000, 50,000]`, investable totals `[200,000, 150,000, 100,000, 60,000, 20,000]`. Presets `[2, 8]` and `[3]`.

Floating-point case: one year with `T = 100,000.01`, needs `[1,028.55, 2,057.21, 0]` (years 0 to 2), spans `[1, 1]`.

## Arithmetic

Spans `[2, 8]`:
- Year 0: bucket 1 needs `10,000 + 20,000 = 30,000` → 30,000 (170,000 left); bucket 2 needs years 2 to 9, of which 2 to 4 exist: `30,000 + 40,000 + 50,000 = 120,000` → 120,000 (50,000 left); growth 50,000.
- Year 1: `20,000 + 30,000 = 50,000` → 50,000 (100,000 left); `40,000 + 50,000 = 90,000` → 90,000; growth 10,000.
- Year 2: `30,000 + 40,000 = 70,000` → 70,000 (30,000 left); `50,000` capped at 30,000; growth 0.
- Year 3: `40,000 + 50,000 = 90,000` capped at 60,000; 0; 0.
- Year 4: `50,000` capped at 20,000; 0; 0.

Spans `[3]`: year 0 `60,000` → 60,000, growth 140,000; year 1 `90,000` → 90,000, growth 60,000; year 2 `120,000` capped at 100,000, growth 0; year 3 `90,000` capped at 60,000; year 4 `50,000` capped at 20,000.

Floating-point case: bucket 1 = 1,028.55, bucket 2 = 2,057.21, growth `(100,000.01 − 1,028.55) − 2,057.21 = 96,914.24999999999`; their sum is `100,000.00999999998`, not `100,000.01` (difference `−1.4551915228366852e−11`).

## Expected

| Year | `[2, 8]` buckets | `[3]` buckets |
|---:|---|---|
| 0 | 30,000 / 120,000 / 50,000 | 60,000 / 140,000 |
| 1 | 50,000 / 90,000 / 10,000 | 90,000 / 60,000 |
| 2 | 70,000 / 30,000 / 0 | 100,000 / 0 |
| 3 | 60,000 / 0 / 0 | 60,000 / 0 |
| 4 | 20,000 / 0 / 0 | 20,000 / 0 |

Tolerance `exact`. `need` in each row equals that year's need. The floating-point case returns `[1028.55, 2057.21, 96914.24999999999]` exactly. `bucketLens(result, [0])`, `[2.5]` and `[-1]` throw; a row with `netPortfolioNeed` undefined throws naming its year.

Example library (scratch-copy run, 29 examples, both presets, 2,420 year-rows): the engine function is the UI's code, so every bucket is bit-identical. The buckets add to `investableTotal` exactly in 2,297 rows and differ by one unit in the last place in 123 (largest relative difference `2.2e−16`); the census meaning and the card copy ("The buckets sum exactly to the investable total every year") overstate this by that residue.

## Wrong readings

- Starting bucket 1 with next year (`cursor = i + 1`): year 0's bucket 1 would be 50,000.
- No cap (`b_k = need_k`): year 2's `[2, 8]` buckets would be 70,000 / 50,000 with growth −20,000.
- Growth as `T − Σ need_k` without the cap: negative in years 2 to 4.
- Discounting or deflating the future needs: not what the lens states; the buckets are nominal sums.
- Reading a missing need as 0 (the retired UI fallback): hides a malformed result.

## Parity test for the switch-over

`planner-ui/src/planner/bucketLens.parity.test.ts`: for the 29 examples and both presets, the engine rows equal the retired UI function (kept in the test) element by element with `Object.is` (2,420 rows), and `BucketLensCard`'s chart data equal `adj(year, engineBucket)`. Plus the five-year case above through `simulatePlan`-free synthetic rows. The validator's `REQUIRED_UI` pin moves with the census change (below).

## Proposed calculation record

- id `bucket-lens-allocation`, group `cash-flow-and-summary`, kind `formula`, outputs `['bucket-lens-allocation']`. Statement as the formula above, with "Units: nominal dollars of each row's year; needs summed undiscounted across future years. Rounding: none; the buckets add to investableTotal to within one unit in the last place." Justification: derivation, `DOCS/calculations/cash-flow-and-summary/bucket-lens-allocation.md`. Limits: "A reporting lens: nothing feeds back into the projection. Needs past the horizon count 0, so the leading buckets drain near the end of the plan. Future needs are nominal and undiscounted, so bucket 2 in today's-dollar view overstates its real size by the inflation between the row's year and each need's year." implementedByFunctions `packages/engine/src/projection/bucketLens.ts#bucketLens`.
- Restate the three limits in `rules/calculations/accountsAndGrowth.ts` (`:89`, `:133`, `:301` at `a7f62f1e`, with their comments at `:60`, `:104`, `:277`), which say the bucket lens "reads only the published investable total and is not listed here": it reads `investableTotal` and `netPortfolioNeed`, and after this slice it is an engine function with its own record, so the limits say "the bucket lens (projection/bucketLens.ts) reads the published investable total and net portfolio need; it has its own record and is not listed here".
- The record `portfolio-need-annual` (`rules/calculations/spendingAndWithdrawals.ts:526` at `a7f62f1e`, feeds `['spending-shortfall-annual']`) adds `bucket-lens-allocation` to `feeds`, and `accounts-investable-total-annual` (`accountsAndGrowth.ts:374`) likewise.

## Census bookkeeping

Convention (RetireGolden #747 at `093ae4b6`, Docs `3b5f835`): a relocated family's `uiSources` name the UI symbols that now read the engine value, the retired computing symbol moves to `notes` as history, and a conformance test fails on a `uiSources` entry that names a missing file or symbol.

- `relocation: { status: 'done', target: 'engine/src/projection/bucketLens.ts#bucketLens' }`; `uiSources` `[planner-ui/src/planner/BucketLensCard.tsx#BucketLensCard]` (the reader); notes "Computed in planner-ui/src/planner/bucketLens.ts#bucketLens until B2-P1 slice 2; now engine engine/src/projection/bucketLens.ts#bucketLens, which BucketLensCard reads."; the Docs validator's `REQUIRED_UI` pin `['planner-ui/src/planner/bucketLens.ts', 'bucketLens', ...]` follows the reader, `['planner-ui/src/planner/BucketLensCard.tsx', 'BucketLensCard', 'buckets read from the engine (was cumulative bucket allocation of investable, until B2-P1 slice 2)']`; transformations end "…; the buckets add to investableTotal to within one unit in the last place." instead of "sum exactly".
- Field coverage: the planner-ui rows for `bucketLens.ts` (`BucketYearRow.*`, `bucketLens.spans/buckets`, `BucketPreset.spans`) move to `engine/src/projection/bucketLens.ts` with the same dispositions; `BUCKET_LENS_SPANS` is `excluded`, `input-parameter`.

## Family

outputs: `bucket-lens-allocation`.

feeds: none. Reads `portfolio-need-annual` and `accounts-investable-total-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26; the five-year and floating-point cases by hand and `scripts/independent.mjs`; example counts from the scratch-copy run (`scripts/engine-cashflow-buckets.json`). Checked by: a separate Claude (Opus 5.5) instance that did not derive it, which recomputed every value with its own scripts and ran the engine where a claim was numeric (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice2-check.md`): every expected value reproduces; its corrections are applied in the implementation section. Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

## Implementation (B2-P1 slice 2, 2026-09-27)

Moved verbatim with the refusals (open question 10); the planner module keeps only the preset labels and its tests moved to the engine. Re-measured after #748 and #750 (2,420 rows, both presets): the engine rows equal the retired function's bit for bit; the buckets add to the investable total exactly in 2,293 rows and differ by one unit in the last place in 127 (the derivation's 123 was measured on #747; the premium-credit pricing has moved the ledger since). The card's whole-dollar copy stays (open question 11).
