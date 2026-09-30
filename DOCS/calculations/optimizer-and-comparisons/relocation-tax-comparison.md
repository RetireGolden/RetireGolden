## Claim

Kind: composition. `engine/src/projection/relocation.ts#compareRelocationCandidates` (record `relocation-row-comparison`) publishes, on every relocation row, the lifetime tax-plus-penalties difference from the baseline row (`compareScalars(baseline, row).delta`, proposal minus baseline; null on the baseline row and on a row whose candidate failed) and the row's ending after-tax estate in the comparison's start-year dollars (divided by that row's own published inflation factor at its end year; null on a failed row). No decision changes a figure; the move is verbatim, bit for bit on the examples.

## What the UI computed before B2-P1 slice 3

`planner-ui/src/planner/RelocationComparePage.tsx` at RetireGolden `4a80669e`:

```tsx
const deflateEnd = (row, amount) =>                                                              // :268-271
  result === null || row.endYear < result.startYear ? null
    : toTodayDollars(planDollarBasis(plan.assumptions.inflationPct, result.startYear, row.endYear), row.endYear, amount)
const delta = row.error ? null : row.lifetimeTaxesAndPenalties - baseline.lifetimeTaxesAndPenalties  // :430
const estateToday = row.error ? null : deflateEnd(row, row.endingAfterTaxEstate)                     // :431
<td style={{ color: delta !== null && delta < 0 ? 'var(--good)' : undefined }}>                      // :451
  {row.id === 'baseline' || delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmtMoney(delta)}`}      // :452
<td>{estateToday === null ? '—' : fmtMoney(estateToday)}</td>                                        // :454
```

Inputs: `RelocationCandidateRow.lifetimeTaxesAndPenalties` (the row's `ProjectionSummary` sum of nominal `tax + penalties`), `.endingAfterTaxEstate` (nominal at `row.endYear`), `.endYear`, `RelocationComparison.startYear`, and the plan's inflation rate. Slice 1 had already moved the conversion onto the engine's dollar basis (`planDollarBasis`, the ledger recurrence) and onto the comparison's own start year; what remained in the page was the subtraction and the call. Surfaces: the relocation page's "Δ vs staying" column and "Ending after-tax estate (today's $)" column; the header hint (`:390-392`) said "Deltas are vs. staying in {baseline.destinationState}. Dollar columns are nominal lifetime sums; the estate column is deflated to today's dollars."

## Engine publication

```ts
// engine/src/projection/relocation.ts
export interface RelocationCandidateRow {
  ...
  /** Nominal lifetime taxes and penalties minus the baseline row's (proposal minus baseline); null on the baseline row and on a row with an error. */
  lifetimeTaxesAndPenaltiesDeltaVsBaseline: number | null
  /** endingAfterTaxEstate in the comparison's start-year dollars: divided by this row's own published inflation factor at endYear (projectionDollarBasis); null on a row with an error, and on a projection with no years. */
  endingAfterTaxEstateTodayDollars: number | null
}
```

- Formula: `Δ_row = compareScalars(L_baseline, L_row).delta` with `L = summary.lifetimeTaxesAndPenalties`; `E_today = toTodayDollars(projectionDollarBasis(result_row), endYear_row, summary.endingAfterTaxEstate)`.
- `runRow` computes `E_today` from the `result` it already holds; `compareRelocationCandidates` fills `Δ` after the rows exist (the baseline row runs first). Domain: finite summaries (`compareScalars` refuses otherwise with a `RangeError`, where the page would have printed a non-number). Units: nominal USD (Δ, a difference of undiscounted nominal sums over the same years), start-year USD (E_today). Rounding: none.
- The page prints the two fields with its formatting and colour; `planDollarBasis`, `toTodayDollars` and the subtraction leave `RelocationComparePage.tsx`.
- The money fields' doc comments state their basis (lifetime sums nominal, ending figures nominal of `endYear`), one of the recon's missing engine-side contracts.

## Justification

Every row is the same household and horizon priced under a different residence: the candidate patch (`relocationScenarioPatch`) writes only residence, the flat state override, the local rate and base spending, none of which moves the plan's years or its inflation. So the rows' lifetime sums cover the same years in the same nominal dollars, and their difference is a like-for-like difference; the page says the columns are nominal lifetime sums. The estate is converted with the row's own published factor, which slice 1 showed is the ledger's recurrence at the plan's rate (`planDollarBasis` is documented as bit-identical to it), so reading it from the row's result is the one-source rule R19 asks for, not a new number. Proposal minus baseline is the convention every comparison in the engine publishes (`scenarios/scalarComparison.ts`), and a negative delta (lower tax) is the one the page colours green.

## Inputs

| Case | Baseline lifetime tax + penalties | Row | Row estate, end year, inflation, start |
|---|---:|---:|---|
| N | 433,212.40 | 363,292.60 (candidate) | — |
| O | any | the baseline row itself; a row whose candidate failed | — |
| P | — | — | 4,058,000 nominal, 2059, 2.5%, 2026 |
| Q | 163,853.10 | 163,853.10 (candidate identical to baseline) | — |

## Arithmetic

N: 363,292.60 − 433,212.40 = −69,919.80000000005 in binary (bits `c0f111fcccccccd0`); printed "-$69,920" (whole-dollar rounding, green). The two level cells print "$433,212" and "$363,293", whose difference is −69,919: the delta beside them differs from the visible gap by $1 (see Limits).

O: null (the page prints "—").

P: `f(2059)` by the ledger recurrence at 2.5% from 2026 = 2.2588508612171205; 4,058,000 / 2.2588508612171205 = 1,796,488.6791213197 (bits `413b6988addae512`), printed "$1,796,489".

Q: 0 (a positive zero), printed "$0", no colour.

## Expected

| Case | `lifetimeTaxesAndPenaltiesDeltaVsBaseline` | `endingAfterTaxEstateTodayDollars` | printed |
|---|---:|---:|---|
| N | −69,919.80000000005 | — | "-$69,920" (green) |
| O baseline row | null | its own E_today | "—" |
| O failed row | null | null | error text spans the row |
| P | — | 1,796,488.6791213197 | "$1,796,489" |
| Q | 0 | — | "$0" |

Tolerance exact (`{ abs: 0 }`; one subtraction; one division by the row's own factor, whose bits the ledger fixes). The engine evidence (`projection/relocation.comparison.evidence.test.ts`) supplies the rows' ledger years (year and inflation factor only) and the summaries' two figures at the row runner's seams, so everything between the seams and the published row is the real code.

Example library (scratch run at `4a80669e`, each example as the app opens it, start 2026, candidates FL (the page's default draft), TX ("Add state" default) and CA, deterministic only; re-measured at `cb72713e`, after main's #753 gave the bracket-fill household's second spouse a Roth IRA: only bracket-fill-roth's rows moved, CA from "+$37,629" to "+$80,806" and the estates today from $353,480 (CA $291,247) to $333,051 (CA $205,911), and every count below holds at both commits): 116 rows, no candidate failed. Every delta and every today's-dollar estate is bit-identical before and after (the row's own factor equals `planDollarBasis` on all 116 rows), so no printed number changes. Of the 87 candidate rows, 26 deltas are exactly 0 (the candidate is the plan's own state, or a no-income-tax state for a plan already in one), 37 negative and 24 positive. A sample of printed rows (unchanged): example-couple (KY) FL "-$69,920", CA "+$43,302", estate today $1,638,837 / $1,796,477 / $1,521,481 (re-measured 2026-09-29, after the change to CMS's published IRMAA amounts: $1,638,831 / $1,796,471 / $1,521,472, the deltas unchanged, as `RelocationComparePage.parity.test.tsx` pins); moving-state-tax "Your plan (FL → KY)" FL "-$145,118", CA "+$155,832"; early-career-match (CA) FL "-$927,678"; guardrails-flex-goals (KY) FL "-$7,903".

## Wrong readings

- Baseline minus row: N reads "+$69,920", a lower-tax state shown as costlier.
- Deflating the estate at the render-time clock year instead of the comparison's start year: equal within a calendar year, off by one year's inflation after a New Year rollover between run and render (the pre-slice-1 page).
- Deflating the lifetime delta to today's dollars with the end-year factor: N would read −69,919.80 / f(E), a smaller figure than any year's actual dollars; the column is a sum over years, not an end-of-plan value.

## Limits

- The delta is the difference of the unrounded sums, so it can differ by $1 from the difference of the two printed sums: 19 of the 87 candidate rows on the examples (for example example-couple FL, "-$69,920" beside $433,212 and $363,293). Unlike the solver's answer (R4, R5), these sums are not themselves published as rounded quantities, so the exact difference stays and the limit is stated.
- The deltas and sums are nominal and undiscounted: a dollar of tax in the last year counts the same as one in the first.

## Problem found: the hint named the wrong baseline (P7, fixed)

The page printed "Deltas are vs. staying in {baseline.destinationState}" and headed the column "Δ vs staying". For a plan with a planned move the baseline row is the plan's own path, labelled "Your plan (FL → KY)" by the engine, and `destinationState` is its final state, so the page told the reader the deltas were against staying in KY, which no row prices (moving-state-tax printed "Deltas are vs. staying in KY."). Rule 2 (a label wrong for the person reading it): the hint now reads "Deltas are against the first row ({baseline.label})." (the check's wording, which also reads well for the usual "Stay in KY") and the column is headed "Δ vs your plan". No number moves.

## Parity test for the switch-over

`planner-ui/src/planner/RelocationComparePage.parity.test.tsx` (jsdom, synchronous runner fallback): for example-couple and moving-state-tax with FL, TX and CA, the delta and estate cells equal the retired expressions (`fmtMoney` of the retired subtraction and of `toTodayDollars(planDollarBasis(...))`), the engine fields are `Object.is` the retired numbers, and the hint names the first row ("Your plan (FL → KY)" for moving-state-tax). Engine evidence: cases N, O, P and Q. Acceptance grep: no `toTodayDollars`, `planDollarBasis` or `- baseline.` in `RelocationComparePage.tsx`.

## Calculation record

`relocation-row-comparison` (`rules/calculations/optimizerAndComparisons.ts`), kind `composition`, outputs `['relocation-tax-comparison']`, pins `relocation.ts#compareRelocationCandidates`, `#runRow`, `scalarComparison.ts#compareScalars` and `dollarBasis.ts#toTodayDollars`; limits the two above.

## Census bookkeeping

- `relocation: { status: 'done', target: 'engine/src/projection/relocation.ts#compareRelocationCandidates' }`; `uiSources` `[RelocationComparePage.tsx#RelocationComparePage]` (now the reader); notes "Computed in planner-ui/src/planner/RelocationComparePage.tsx#RelocationComparePage (row minus baseline lifetime taxes and penalties; the estate deflated through planDollarBasis) until B2-P1 slice 3; now engine engine/src/projection/relocation.ts#compareRelocationCandidates, published as RelocationCandidateRow.lifetimeTaxesAndPenaltiesDeltaVsBaseline and .endingAfterTaxEstateTodayDollars, which RelocationComparePage reads."
- `display-dollar-basis-conversion`: `uiSources` drops `RelocationComparePage.tsx#RelocationComparePage` (the page no longer converts); its relocation-page surface reads the engine row.
- Field coverage: rows `RelocationCandidateRow.lifetimeTaxesAndPenaltiesDeltaVsBaseline` and `.endingAfterTaxEstateTodayDollars` (family `relocation-tax-comparison`); the planner-ui row `RelocationComparePage.amount` goes with the code.

## Family

outputs: `relocation-tax-comparison`.

feeds: none. Reads `projection-summary-lifetime-taxes-and-penalties`, `projection-summary-ending-after-tax-estate` and `display-dollar-basis-conversion`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27; cases N to Q by hand and `scripts/independent.mjs`; the example rows from the scratch run. Checked by: a separate Claude (Opus 5.5) instance that did not derive it (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-check.md`): N and P reproduce bit for bit, the 116 example rows are bit-identical, and P7 is real (its hint wording is the one used). Reviewed by: pending; the catalog asks for a reviewer of a different agent family, so the record is `unreviewed`.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-4-monte-carlo-optimizer.md`.

## Implementation (B2-P1 slice 3, 2026-09-27)

- P7's copy uses the check's hint wording; the column header is the derivation's.
- No displayed number changes (staging `b2p1-s3/addendum.md`).

## PR #754 review fixes (2026-09-27)

The compare runs in the planner's worker, where an engine refusal loses its class, so the page printed the engine's message ("Compare error: A compared figure must be a finite number; the proposal is NaN"). The worker now posts a typed refusal as plain data beside the message (`workers/refusal.ts`: the error's kind and its operand role or reason), the runner rebuilds it as a `WorkerRefusalError`, and the page says it in plain words with a next step (`planner/engineRefusalCopy.ts#relocationErrorSentence`): "The states couldn't be compared: one of a candidate state's figures could not be computed. Check that state's details, then compare again." (and the same for your plan's figure or the difference). An error nothing recognises reads "The states couldn't be compared. Compare again." with its own text kept as a labelled detail, so a crash can still be reported. `RelocationComparePage.refusal.test.tsx` pins the sentences.
