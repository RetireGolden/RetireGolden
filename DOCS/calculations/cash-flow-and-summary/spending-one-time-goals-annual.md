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

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
