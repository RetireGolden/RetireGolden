## Claim

Kind: formula. `projection/optimizePlan.ts#ExactLedgerValidation.traditionalDepletionYear`, through `decisions/evaluateCandidate.ts#findTraditionalDepletionYear`, is the first year in which the plan's own non-inherited traditional-account balances sum to at most the validation tolerance; it is `null` if no year qualifies. The summation-and-first-year formula is derived from the field comment's convention.

## Justification

The field comment explicitly excludes inherited traditional balances and states a one-dollar default tolerance. The extract also gives `DECISION_NEUTRAL_TOLERANCE_DOLLARS = 1`, which is the default validation tolerance used in this fixture. Years are tested in ascending order and the boundary is inclusive (`at most`).

## Inputs

Plan account classification: `own-a` and `own-b` are the plan's own traditional accounts; `inherited-c` is inherited traditional.

| Year | `own-a` balance | `own-b` balance | `inherited-c` balance | Unit |
|---:|---:|---:|---:|---|
| 2030 | 800.00 | 500.00 | 25,000.00 | nominal dollars at year end |
| 2031 | 0.40 | 0.50 | 24,000.00 | nominal dollars at year end |
| 2032 | 0.00 | 0.00 | 23,000.00 | nominal dollars at year end |

Validation tolerance: `$1.00`. Null-branch fixture: owned sums of `$2.00`, `$1.01`, and `$5.00` in 2030–2032, respectively.

## Arithmetic

2030 owned traditional sum `= $800.00 + $500.00 = $1,300.00`; `$1,300.00 ≤ $1.00` is false.

2031 owned traditional sum `= $0.40 + $0.50 = $0.90`; `$0.90 ≤ $1.00` is true, so the first qualifying year is `2031`. The inherited `$24,000` is not included.

The later 2032 owned sum is `$0`, but it cannot displace the earlier qualifying year.

Null branch: `min($2.00, $1.01, $5.00) = $1.01 > $1.00`, so no year qualifies and the result is `null`.

## Expected

Exact value: `2031`. Fixture tolerance: exact because the output is a calendar year. The never-depleted branch is exactly `null`.

## Wrong readings

- Including inherited balances gives 2031 a sum of `$24,000.90` and postpones the answer to `null` for these rows.
- Requiring a zero balance rather than at most `$1` returns `2032` instead of `2031`.
- Using a strict `< $1` test happens to pass the main row but fails at the boundary: an owned sum of exactly `$1.00` must qualify.

## Family

outputs: `exact-ledger-validation-traditional-depletion-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-nine.md in this directory (approved with a note, recorded in that file).
