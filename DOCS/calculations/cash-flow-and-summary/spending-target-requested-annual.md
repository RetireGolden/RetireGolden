## Claim

Kind: composition. `projection/internal/annualExpenseSummary.ts#annualExpenseSummary` publishes `YearExpenses.targetSpending` as the required-spending base (system-computed costs plus required lifestyle plus required funded goals), the full target lifestyle layer, target-classified funded goals, and the nominal amounts of skipped required- and target-classified goals.

## Justification

The required-spending base excludes skipped amounts; both skipped required and skipped target amounts are then included once as intended spending. Equivalently, start with published `requiredSpending`, which already contains skipped required, and add full target lifestyle, target funded goals, and skipped target only.

## Inputs

| Input | Every-term case | No-skips case | Unit |
|---|---:|---:|---|
| System-computed required costs | 18,000 | 12,000 | dollars/year |
| Required lifestyle | 24,000 | 18,000 | dollars/year |
| Required funded goals | 2,500 | 2,000 | dollars/year |
| Full target lifestyle layer | 12,000 | 9,000 | dollars/year |
| Target funded goals | 3,500 | 2,500 | dollars/year |
| Skipped required goals, nominal | 1,500 | 0 | dollars/year |
| Skipped target goals, nominal | 1,000 | 0 | dollars/year |

In the every-term case, the system amount is `6,000 debt + 4,000 property + 5,000 healthcare + 1,000 insurance + 3,000 care - 1,000 LTC benefit = $18,000`. In the no-skips case it is `3,000 + 2,000 + 4,000 + 1,000 + 3,000 - 1,000 = $12,000`.

## Arithmetic

Every-term case: required base `= 18,000 + 24,000 + 2,500 = $44,500`. Target spending `= 44,500 + 12,000 + 3,500 + 1,500 + 1,000 = $62,500`. Equivalently, published required spending is `$46,000`, so `46,000 + 12,000 + 3,500 + 1,000 = $62,500`.

No-skips case: required base `= 12,000 + 18,000 + 2,000 = $32,000`. Target spending `= 32,000 + 9,000 + 2,500 + 0 + 0 = $43,500`.

## Expected

Exact `YearExpenses.targetSpending`: every-term case `$62,500`; no-skips case `$43,500`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Starting with published required spending and then adding skipped required again produces `$64,000` in the every-term case.
- Omitting both skipped amounts produces `$60,000` in the every-term case.
- Using a guardrail-cut target lifestyle of `$7,200` instead of the full `$12,000` produces `$57,700` in the every-term case.

## Family

outputs: `spending-target-requested-annual`.

feeds: `spending-target-shortfall-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory (approved with a note on the doc comment's wording, which the comment patch now states the way this worksheet does).
