## Claim

Kind: formula. `projection/optimizePlan.ts#ExactLedgerValidation.baseline`, `#ExactLedgerValidation.candidate`, and `#ExactLedgerValidation.endingNetWorthDelta` use `summarizeProjection` of the shared baseline result and the candidate schedule's own result; the two `endingAfterTaxEstate` fields are therefore those two summary values, and the net-worth delta is candidate minus baseline. The subtraction formula is derived from the field comment's candidate-minus-baseline convention.

## Justification

The `baseline` field comment says it is “summarizeProjection of the plan's shared baseline result”; the `candidate` comment says it is “summarizeProjection of the candidate schedule's own simulated result”; and the delta comment states `candidate.endingNetWorth − baseline.endingNetWorth`. No value from one result may be paired with the other result's label. `recommendationState` has no census family in this round and is not published here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Shared baseline result summary: ending after-tax estate | 500,000.00 | nominal dollars at horizon |
| Shared baseline result summary: ending net worth | 620,000.25 | nominal dollars at horizon |
| Candidate schedule's own result summary: ending after-tax estate | 535,500.25 | nominal dollars at horizon |
| Candidate schedule's own result summary: ending net worth | 648,250.75 | nominal dollars at horizon |

These are the relevant published outputs of `summarizeProjection` for two small `ProjectionResult` fixtures; their other summary fields and year rows do not enter these three fields.

## Arithmetic

Baseline estate `= $500,000.00` from the baseline summary.

Candidate estate `= $535,500.25` from the candidate summary.

Ending-net-worth delta `= $648,250.75 − $620,000.25 = $28,250.50`.

## Expected

- `optimization-baseline-after-tax-estate`: exact value `$500,000.00`; fixture tolerance absolute `$0.005`, because the summarized dollar figure may be computed in binary floating point.
- `optimization-candidate-after-tax-estate`: exact value `$535,500.25`; fixture tolerance absolute `$0.005`, for the same reason.
- `exact-ledger-validation-ending-net-worth-delta`: exact value `$28,250.50`; fixture tolerance absolute `$0.005`, because dollar subtraction uses binary floating point.

## Wrong readings

- Reversing the subtraction to baseline minus candidate produces `−$28,250.50`.
- Subtracting after-tax estates instead of ending net worth produces `$535,500.25 − $500,000.00 = $35,500.25`.
- Treating the shared baseline as if it were recomputed from the candidate result publishes `$535,500.25` for both estate families and a false `$0` comparison.

## Family

outputs: `optimization-baseline-after-tax-estate`, `optimization-candidate-after-tax-estate`, `exact-ledger-validation-ending-net-worth-delta`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-nine.md in this directory.
