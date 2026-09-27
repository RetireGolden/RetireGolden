## Claim

Kind: composition. `scenarios/scalarComparison.ts#compareScalars` (until B2-P1 slice 3 the private `scenarios/comparison.ts#scalar`) publishes a finite numeric metric's baseline, proposal and delta in that metric's own units, with `delta=proposal-baseline` and no stated rounding.

## Justification

The type comment fixes the exact signed identity `d=p-b`; baseline and proposal are preserved rather than reordered by magnitude. This applies to finite scalar money, year, count and probability values, with the unit inherited from the compared metric.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Baseline | 120,000.00 | nominal dollars |
| Proposal | 95,000.00 | nominal dollars |

## Arithmetic

`delta=$95,000.00-$120,000.00=-$25,000.00`.

## Expected

Comparison is baseline `$120,000.00`, proposal `$95,000.00`, delta `-$25,000.00`, with exact-cent tolerance because the example uses exact cent amounts and one subtraction.

## Wrong readings

- Baseline minus proposal gives `+$25,000.00`.
- Dividing the difference by baseline reports `-20.8333333333%`, a relative change rather than the required same-unit delta.

## Family

outputs: `scenario-comparison-cell`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

## Restated (B2-P1 slice 3, 2026-09-27)

The helper moved, unchanged in its arithmetic, from a private function of `scenarios/comparison.ts` to the exported leaf module `scenarios/scalarComparison.ts` as `compareScalars`, so the comparisons built on it (the scenario comparison, the Compare page's headlines and money-lasts comparison, the relocation rows' lifetime delta, the claim-change gain, the Monte Carlo success comparison and the stochastic metric deltas) publish their differences through one convention. Not every difference in the engine does: the candidate evaluation's estate, net-worth, lifetime-tax and money-lasts deltas (`decisions/evaluateCandidate.ts`, read by `InsightImpact` and `ExactLedgerValidation`) are plain subtractions, with no negative-zero normalisation and no non-finite refusal. Two details are now stated rather than implied: a negative zero is published as 0 on every member, and a non-finite operand or difference is refused with a `RangeError` whose message names the operand (the private helper threw a plain `Error` reading "scenario comparison produced a non-finite number"). The evidence (`scenarios/comparisonCells.evidence.test.ts`) asserts the worksheet's case directly on the exported helper as well as through `compareScenarioPlans`, and adds the negative-zero and non-finite cases. The record is `unreviewed` again because its statement and pins changed. Derivation and check: RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-derivation.md` and `b2p1-slice3-check.md` (open question 1 and correction 1).
