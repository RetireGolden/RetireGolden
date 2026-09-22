## Claim

Kind: formula. `projection/optimizePlan.ts#ExactLedgerValidation.requestedConversionTotal`, `#ExactLedgerValidation.executedConversionRatio`, and `#ExactLedgerValidation.firstMateriallyUnexecutedYear` use the field comments' stated conventions: sum the requested schedule, sum candidate `YearResult.rothConversion`, set the ratio to `min(1, executed / requested)` (exactly `1` when requested is zero), and select the first ascending year whose per-year shortfall is greater than `max(DECISION_MATERIAL_SHORTFALL_DOLLARS, requested × DECISION_MATERIAL_SHORTFALL_PCT)`. These formulas are derived directly from those conventions.

## Justification

The relevant field comments identify the requested schedule and the candidate result's rows as distinct sources. `decisions/evaluateCandidate.ts` supplies `DECISION_MATERIAL_SHORTFALL_DOLLARS = $1,000` and `DECISION_MATERIAL_SHORTFALL_PCT = 0.05`. The comparison is strictly “more than,” not greater than or equal, and its margin is resolved separately for each year.

## Inputs

| Year | Requested conversion | Candidate `rothConversion` | Unit |
|---:|---:|---:|---|
| 2030 | 40,000 | 30,000 | nominal dollars |
| 2031 | 20,000 | 19,000 | nominal dollars |
| 2032 | 10,000 | 10,000 | nominal dollars |

Constants: absolute material margin `$1,000`; proportional material margin `5%`.

Null-margin branch fixture: one requested row for 2040 of `$20,000` and candidate execution of `$19,000`. Zero-request branch fixture: empty requested schedule and `$0` executed.

## Arithmetic

Requested total `= $40,000 + $20,000 + $10,000 = $70,000`.

Executed total `= $30,000 + $19,000 + $10,000 = $59,000`.

Execution ratio `= min(1, 59,000 / 70,000) = 0.8428571428571429`.

For 2030, shortfall `= $40,000 − $30,000 = $10,000`; margin `= max($1,000, $40,000 × 0.05) = max($1,000, $2,000) = $2,000`; `$10,000 > $2,000`, so 2030 qualifies and is first.

For 2031, shortfall `= $1,000`; margin `= max($1,000, $1,000) = $1,000`; `$1,000 > $1,000` is false. For 2032, shortfall and materiality are `$0` and `$1,000`, so it does not qualify.

Null-margin branch: 2040 shortfall `= $20,000 − $19,000 = $1,000`; margin `= max($1,000, $20,000 × 0.05) = $1,000`; strict comparison is false, so the first materially unexecuted year is `null`.

Zero-request branch: the stated special case sets the ratio to exactly `1`; it does not divide `0 / 0`.

## Expected

- `exact-ledger-validation-requested-conversion-total`: exact value `$70,000`; fixture tolerance absolute `$0.005`, because the dollar sum uses binary floating point.
- `exact-ledger-validation-executed-conversion-ratio`: exact value `0.8428571428571429`; fixture tolerance absolute `1e-9`, because this is not a short binary fraction. The zero-request branch is exactly `1`.
- `exact-ledger-validation-first-materially-unexecuted-year`: exact value `2030`; fixture tolerance exact because it is a year. The inside-margin branch is exactly `null`.

## Wrong readings

- Leaving the ratio uncapped can exceed `1` when execution is greater than requested; for requested `$10,000` and executed `$12,000`, it gives `1.2` instead of `1`.
- Applying the margin to the `$70,000` total gives `max($1,000, $3,500) = $3,500` for every year, rather than 2030's `$2,000` and 2031's `$1,000` per-year margins.
- Treating “more than” as inclusive makes the 2040 `$1,000` shortfall qualify and returns `2040` instead of `null`.
- Dividing in the zero-request branch produces `NaN` instead of the required exact ratio `1`.

## Family

outputs: `exact-ledger-validation-requested-conversion-total`, `exact-ledger-validation-executed-conversion-ratio`, `exact-ledger-validation-first-materially-unexecuted-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-nine.md in this directory.
