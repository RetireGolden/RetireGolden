## Claim

Kind: formula. `engine/src/projection/candidateTrailingEstate.ts#candidateTrailingEstateAmount` returns benchmark − the candidate's `afterTaxEstateDelta` when the benchmark is larger, and null otherwise. The benchmark (`#tournamentEstateBenchmark`) is the `afterTaxEstateDelta` of the validation of the selected winner (`winnerValidation`), or, when the calculated winner was withheld pending account allocation, of the withheld winner's validation (`retirementActionReadinessVeto.vetoedValidation`); with neither it is the largest of 0 and every candidate's `afterTaxEstateDelta`. The downloadable report prints the gap in its conversion-candidate table as "Trailed the selected recommendation by $X." or, with a withheld winner, "Trailed the calculated winner by $X; that winner was withheld pending account allocation.", and computes nothing.

## What the UI computed

`planner-ui/src/report/reportHtml.ts#lossReasonForCandidate` at `f97cf418` (lines 562 to 566):

```ts
const benchmark = validation?.afterTaxEstateDelta ?? Math.max(0, ...tournament.candidates.map((row) => row.afterTaxEstateDelta))
if (benchmark > candidate.afterTaxEstateDelta) {
  return readinessVeto
    ? `Trailed the calculated winner by ${fmtMoney(benchmark - candidate.afterTaxEstateDelta)}; that winner was withheld pending account allocation.`
    : `Trailed the selected recommendation by ${fmtMoney(benchmark - candidate.afterTaxEstateDelta)}.`
}
```

with `validation = tournament.winnerValidation ?? tournament.retirementActionReadinessVeto?.vetoedValidation ?? null` (`reportEvidenceFromOptimizeResult`). The branch is reached only by a candidate that is not the winner, not the vetoed winner, improved the estate by more than $1, and is not held back by the ACA actionability veto; those earlier sentences are unchanged.

## Engine publication

```ts
// engine/src/projection/candidateTrailingEstate.ts
export function tournamentEstateBenchmark(tournament: TrailingEstateTournament): number
export function candidateTrailingEstateAmount(tournament: TrailingEstateTournament, candidate: Pick<SimpleCandidateEvaluation, 'afterTaxEstateDelta'>): number | null
```

- `TrailingEstateTournament` is the part of a tournament the gap reads (its candidates' deltas, the winner's validation, the withheld winner's validation), so both `ExactLedgerTournament` and its UI summary satisfy it.
- The benchmark and the subtraction as the report had them: `Math.max(0, …)` over the candidates is a running maximum from 0, the same value; `benchmark − delta` in that order.
- Domain: any tournament. Units: nominal dollars at the plan's last year, the unit of every estate delta. Rounding: none; the report prints `fmtMoney` whole dollars.
- A leaf module (its one import is a type), so the report does not load the optimizer.
- After the move: `const trailingAmount = candidateTrailingEstateAmount(tournament, candidate)` and the sentence prints `fmtMoney(trailingAmount)` when it is not null; `lossReasonForCandidate` no longer takes the validation.

## Justification

The table explains why each candidate lost. Measured against the chosen schedule's own validated improvement (or the withheld winner's, which the report names as such), a candidate trails by the difference of their after-tax estate improvements over the same baseline; both deltas are the candidate minus the same current plan, so their difference is the estate one schedule leaves compared with the other. With no validated winner there is no chosen schedule to measure against, so the best candidate stands in, floored at 0 (the current plan itself).

## Inputs

| Case | Candidate deltas | Winner's validation | Withheld winner's validation |
|---|---|---:|---:|
| A | 48,700; 42,500; 10,000 | 48,000 | none |
| B | 25,000; 12,000 | none | 30,000 |
| C | 900; 600; −200 | none | none |
| D | −200; −50 | none | none |
| E | 0.1 | 0.3 | none |

## Arithmetic

A. B = 48,000. 48,700 is not below it: none. 48,000 − 42,500 = 5,500. 48,000 − 10,000 = 38,000.

B. B = 30,000. 30,000 − 25,000 = 5,000; 30,000 − 12,000 = 18,000.

C. B = max(0, 900, 600, −200) = 900. 900: none; 900 − 600 = 300; 900 − (−200) = 1,100 (the report prints "Did not improve" for this row, which never reaches the gap).

D. B = max(0, −200, −50) = 0. 0 − (−200) = 200; 0 − (−50) = 50 (again rows the report does not print as trailing).

E. 0.3 − 0.1 = 0.19999999999999998.

## Expected

| Case | Benchmark | Gaps |
|---|---:|---|
| A | 48,000 | none, 5,500, 38,000 |
| B | 30,000 | 5,000, 18,000 |
| C | 900 | none, 300, 1,100 |
| D | 0 | 200, 50 |

E: 0.19999999999999998. Tolerance exact.

Example library, each example as the app opens it (2026 start, the Optimize run the page makes, measured on this branch): on all 29 every candidate row's sentence equals the retired function's. 44 rows on 5 examples print a gap, every one "Trailed the calculated winner by $X; that winner was withheld pending account allocation." (bracket-fill-roth 1 row, annuity-purchases-estate 15, glidepath-allocation 6, no-annuity-brokerage 15, static-allocation-control 7); no example prints "Trailed the selected recommendation". The other rows print the winner, the withheld-winner explanation, "Did not improve", or the ACA sentence.

## Wrong readings

- The best candidate as the benchmark even when a winner was validated: case A's second candidate 6,200 (48,700 − 42,500), measured against a schedule that was not chosen.
- The withheld winner ignored: case B none and 13,000, in candidate order, where the report names that winner.
- The candidate minus the benchmark: a negative "trailed by".
- The gap in the objective's own metric under a non-estate objective: the report's sentence and this family are in after-tax estate.

## Parity test for the switch-over

`planner-ui/src/planner/freezeAdditions.parity.test.ts`, "downloadable report": on the 29 examples the Optimize run is made, and every candidate row of `reportEvidenceFromOptimizeResult` reads the sentence the retired `lossReasonForCandidate` (kept in the test) printed. The report goldens (`report/reportGoldens.test.ts`) are unchanged. Acceptance grep: no `benchmark - candidate.afterTaxEstateDelta` in `reportHtml.ts`.

## Finding, not changed here

With no validated winner (the plan's own strategy kept, or no winner) the benchmark is the best candidate, which was not selected, while the sentence says "the selected recommendation". No example reaches it (above). The words are the report's; recorded as a limit of the record.

## Calculation record

- id `optimizer-candidate-trailing-estate-gap`, group optimizer-and-comparisons, kind `formula`, outputs `['optimizer-candidate-trailing-estate-amount']`; implementedByFunctions `candidateTrailingEstate.ts#candidateTrailingEstateAmount` and `#tournamentEstateBenchmark`.

## Census bookkeeping

- `optimizer-candidate-trailing-estate-amount`: `relocation: { status: 'done', target: 'engine/src/projection/candidateTrailingEstate.ts#candidateTrailingEstateAmount' }`; `uiSources` unchanged (`reportHtml.ts#lossReasonForCandidate`, which now reads it); the retired benchmark and subtraction move to notes.
- Field coverage: the planner-ui row `lossReasonForCandidate.benchmark` becomes `lossReasonForCandidate.trailingAmount` on the same family (the value the sentence now prints).

## Family

outputs: `optimizer-candidate-trailing-estate-amount`.

feeds: none. Reads `simple-candidate-evaluation-after-tax-estate-delta` and the validation's delta.

## Provenance

Derived by: claude (opus 5.5), 2026-09-30; cases by hand, the library figures from a measurement run of the report evidence on the 29 examples. Implemented by: claude (opus 5.5), same day. Reviewed by: unreviewed; the catalog asks for a reviewer of a different agent family.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, `DOCS/calculations/reviews/REVIEW-2026-09-30-round3-codex.md`.
