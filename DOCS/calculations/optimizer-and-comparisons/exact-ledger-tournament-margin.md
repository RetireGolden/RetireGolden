## Claim

Kind: model. `projection/optimizePlan.ts#ExactLedgerTournament.marginOverMilpDollars` is published by `#runExactLedgerTournament` as `exact-ledger-tournament-margin-over-milp-dollars`. The field comment says it is the candidate's exact estate delta over the displaced MILP schedule and is `0` when no MILP comparison was made. Thus the convention implies `marginOverMilpDollars = candidate exact after-tax estate − displaced MILP exact after-tax estate` only on the candidate-over-MILP branch; otherwise it is `0`.

## Justification

The `ExactLedgerTournament` comments define `none` as an empty schedule and `incumbent` as the plan's current executed conversions. `runExactLedgerTournament` says that a candidate must beat a recommendable MILP by the material margin, and `DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS = $1,000` says it must win by more than that value. The two no-MILP fixtures therefore exercise the field's explicit zero convention, without pricing an estate.

## Inputs

None fixture: a plan with no traditional balance and no applied conversions; no MILP result is supplied to `runExactLedgerTournament`.

Incumbent fixture: a plan with an owned traditional balance of at least `$20,000`, one applied conversion of `$20,000` in year `Y1`, and no MILP result. The ledger executes the applied amount of `$20,000`.

Solver-run limit: a recommendable MILP schedule and a candidate whose exact estate exceeds that MILP schedule's exact estate by more than `DEFAULT_TOURNAMENT_SWITCH_MARGIN_DOLLARS = $1,000`. The extract does not provide their estate inputs, so this branch is run-pinned rather than assigned a dollar value.

## Arithmetic

None fixture: no traditional balance `→` every conversion candidate executes `$0` `→` no candidate converts anything `→ winnerSource = none` and `winnerConversions = []`.

No MILP comparison was made, so `marginOverMilpDollars = $0`.

Incumbent fixture: executed incumbent conversion in `Y1 = min($20,000, traditional balance at least $20,000) = $20,000`.

Nothing evaluated beats the installed plan `→ winnerSource = incumbent` and `winnerConversions = [{ year: Y1, amount: $20,000 }]`.

No MILP comparison was made, so `marginOverMilpDollars = $0`.

Solver-run limit: candidate replacement requires `candidate estate − MILP estate > $1,000`; only then is the published margin that exact difference. No number can be derived without the solver-produced schedule and its exact-ledger valuations.

## Expected

- `exact-ledger-tournament-margin-over-milp-dollars`: exact value `$0` in both no-MILP fixtures; fixture tolerance absolute `$0.005`, because it is a dollar figure. The candidate-over-MILP branch is run-pinned with no number.
- The none fixture's `winnerSource` is exactly `none` and `winnerConversions` exactly `[]`; the incumbent fixture's source is exactly `incumbent` and its list exactly `[{ year: Y1, amount: 20000 }]`. Tolerance is exact because these are an enum and lists.

## Wrong readings

- Publishing a margin on the incumbent path can report a nonzero candidate-versus-incumbent difference; the required value is `$0` because no MILP comparison was made.
- Treating a no-traditional plan as an incumbent makes `winnerConversions` contain a requested conversion; it must be `[]` and source `none`.
- Treating the switch threshold as inclusive permits a candidate exactly `$1,000` ahead; the comment requires more than `$1,000`, so that candidate does not replace the MILP.

## Family

outputs: `exact-ledger-tournament-margin-over-milp-dollars`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-terra), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-twelve.md in this directory.
