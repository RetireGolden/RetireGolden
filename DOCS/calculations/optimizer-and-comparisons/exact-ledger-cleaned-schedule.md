## Claim

Kind: model. `projection/optimizePlan.ts#ExactLedgerPostProcessing.cleanedSchedule` is published by `#postProcessExactLedgerSchedule` as `optimizer-recommended-conversion-annual`. The `ExactLedgerScheduleAdjustment` comments state that cleaned is `min(requested, executed)` when execution exceeds neutral tolerance, otherwise zero; therefore the convention implies the cleaned executable schedule is the per-year minimum of the raw request and ledger execution (subject to that zero branch).

## Justification

The post-processor comment says it trims raw requested conversions to exact execution and reruns the ledger. The adjustment comment gives its reasons: `ledger-capped`, `dropped-zero`, and `estate-pruned`, the only three members of the reason union. (A fourth member, `rounding`, was declared and never assigned until decision `D-ADJUSTMENT-ROUNDING-REASON` removed it on 2026-09-25.)

## Inputs

One-person plan: zero returns, zero inflation, zero state tax, zero heir tax, zero base spending, and an owned traditional balance of `$20,000`.

Raw schedule: `$15,000` in first year `Y1`, and `$15,000` in second year `Y2`. The stated ledger executions are `$15,000` in `Y1` and the remaining `$5,000` in `Y2`.

## Arithmetic

`Y1` cleaned amount `= min(requested $15,000, executed $15,000) = $15,000`.

After `Y1`, traditional balance `= $20,000 − $15,000 = $5,000`.

`Y2` cleaned amount `= min(requested $15,000, executed $5,000) = $5,000`.

`Y2` adjustment `= { requested: $15,000, executed: $5,000, cleaned: $5,000, reason: ledger-capped }`.

Cleaned requested total `= $15,000 + $5,000 = $20,000`.

Cleaned executed total `= $15,000 + $5,000 = $20,000`.

Cleaned executed ratio `= $20,000 / $20,000 = 1`.

## Expected

- `optimizer-recommended-conversion-annual`: exact cleaned list `[{ year: Y1, amount: 15000 }, { year: Y2, amount: 5000 }]`; fixture tolerance exact because it is a schedule list.
- Cleaned requested and executed totals are each `$20,000`; fixture tolerance absolute `$0.005`, because they are dollar figures. Its executed ratio is exactly `1`; fixture tolerance exact because this ratio is exactly one.
- The `Y2` adjustment is exactly `{ requested: 15000, executed: 5000, cleaned: 5000, reason: ledger-capped }`; fixture tolerance exact because it is a structured row and reason.
- Reasons are exactly `ledger-capped`, `dropped-zero`, and `estate-pruned`; `rounding` is not a reason. Tolerance exact.
- The related tournament `winnerConversions` incumbent case is the executed list, not the raw list; a MILP-sourced winning schedule is a solver-run limit with no number in this worksheet.

## Wrong readings

- Setting cleaned equal to requested produces `$15,000` in `Y2`, rather than the ledger-capped `$5,000`.
- Summing the raw requests produces `$30,000`, rather than the cleaned requested and executed totals of `$20,000`.
- Calling the `Y2` reason `rounding` names a value that is not a reason, rather than `ledger-capped`.

## Family

outputs: `optimizer-recommended-conversion-annual`.

feeds: `exact-ledger-tournament-margin-over-milp-dollars` through the tournament's executed `winnerConversions` incumbent branch.

## Provenance

Derived by: codex (gpt-5.6-terra), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-twelve.md in this directory.

Amended 2026-09-25 by claude (the implementer of decision D-ADJUSTMENT-ROUNDING-REASON): the three sentences that described `rounding` as declared but never assigned now say it is not a reason, because the decision removed it from the union. No input, arithmetic or expected value changed.
