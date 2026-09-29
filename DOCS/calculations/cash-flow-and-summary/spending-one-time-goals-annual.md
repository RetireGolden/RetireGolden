## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.expenses.oneTimeGoals`, produced by `projection/internal/annualOneTimeGoalFundingPhase.ts#annualOneTimeGoalFundingPhase`, equals the funded nominal amount of goals in the current year. With no guardrail scheduler, every goal funds exactly in its target year at `amount × cumulative inflation factor`; skipped amounts are intended-but-unfunded misses and are not included in this field.

## Justification

The phase comments distinguish actual goal cost from skipped intended spending. The plan schema states goal amounts in today's dollars.

## Inputs

| Goal | Target year | Amount | Current year | Inflation factor | Unit |
|---|---:|---:|---:|---:|---|
| Roof | 2030 | 10,000 | 2030 | 1.10 | today dollars |
| Trip | 2030 | 5,000 | 2030 | 1.10 | today dollars |
| Car | 2031 | 20,000 | 2030 | 1.10 | today dollars |
| Guardrail scheduler | null |  |  |  | no guardrails |
| Any household member alive | true |  |  |  | Boolean |

## Arithmetic

Roof funds `$10,000 × 1.10 = $11,000`; Trip funds `$5,000 × 1.10 = $5,500`; Car contributes `$0` in 2030. Total `= $16,500`.

## Expected

Exact value: `expenses.oneTimeGoals = $16,500`. Fixture tolerance: absolute `$0.005`, because inflation multiplication uses binary floating point.

## Wrong readings

- Adding the 2031 Car goal produces `$38,500`.
- Failing to inflate the two 2030 goals produces `$15,000`.
- In a guardrail case, adding a skipped `$7,000` to this funded field would overstate it by `$7,000`; skipped dollars belong to miss summaries, not actual one-time-goal expense.

## Family

outputs: `spending-one-time-goals-annual`.

feeds: `spending-total-annual`.

## Dated before the start year (D-2027-ROLLOVER)

A goal whose target year, or for a movable or skippable goal whose whole window, is before the projection start year funds nothing. The projection now adds one warning naming it (`projection/preStartEvents.ts#preStartEvents`):

> The New car goal is dated 2026, before this plan starts in 2027, so it is not counted. If it has not happened, move it to 2027 or later.

Worked case (the derivation's U1 car): $30,000 dated 2026, zero inflation. From a 2026 start the 2026 row funds `$30,000` and no warning is added; from a 2027 start every row funds `$0` and the warning above is added. The evidence file asserts both.

Restated 2026-09-28 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), from the derivation and the independent check (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-derivation.md` and `rollover-2027-check.md`). Not yet reviewed: the record is `reviewedBy: 'unreviewed'`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
