## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearExpenses.total` is the net annual expense total implied by the non-summary expense members: `baseSpending + oneTimeGoals + debtService + propertyCosts + healthcare + insurancePremiums + careCost - ltcBenefit`. The `ltcBenefit` offsets care cost; `guardrailFactor` is descriptive and is not multiplied into this row identity; `requiredSpending`, `targetSpending`, `idealSpending`, `excessSpending`, and `intendedSpending` are overlapping layer summaries, not additional members. `intendedSpending` is the no-guardrail request and therefore need not equal actual `total`.

## Justification

The member list is inferred from the expense shape and its comments. The comments explicitly call care cost gross and the LTC benefit an offset that reduces net spending. They define the spending-layer fields as summaries, and define intended spending as the no-cut amount while the guardrail factor records the discretionary multiplier already applied to the year's spending outcome.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `expenses.baseSpending` | 54,000 | nominal dollars/year |
| `expenses.oneTimeGoals` | 6,000 | nominal dollars/year |
| `expenses.debtService` | 12,000 | nominal dollars/year |
| `expenses.propertyCosts` | 5,000 | nominal dollars/year |
| `expenses.healthcare` | 9,000 | nominal dollars/year |
| `expenses.insurancePremiums` | 2,000 | nominal dollars/year |
| `expenses.careCost` | 20,000 | nominal dollars/year |
| `expenses.ltcBenefit` | 14,000 | nominal dollars/year |
| `expenses.guardrailFactor` | 0.90 | dimensionless |
| `expenses.intendedSpending` | 100,000 | nominal dollars/year |

## Arithmetic

`$54,000 + $6,000 + $12,000 + $5,000 + $9,000 + $2,000 + $20,000 - $14,000 = $94,000`.

Neither `0.90` nor `$100,000` is added or multiplied in this composition.

## Expected

Exact value: `expenses.total = $94,000`. Fixture tolerance: absolute `$0.005`, because the ledger composes unrounded binary-floating-point dollar values.

## Wrong readings

- Adding rather than subtracting the LTC benefit produces `$122,000`.
- Omitting gross care cost while subtracting its benefit produces `$74,000`.
- Multiplying the composed total by `guardrailFactor` a second time produces `$84,600`.
- Substituting no-cut `intendedSpending` produces `$100,000`.

## Family

outputs: `spending-total-annual`.

feeds: `portfolio-need-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory (the member list was confirmed against the engine by the orchestrator before the review).
