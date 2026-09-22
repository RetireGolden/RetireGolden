## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearExpenses.excessSpending` is the incremental excess/opportunistic layer above ideal; because `intendedSpending` is the full required/target/ideal/excess amount, the words imply `excessSpending = intendedSpending - targetSpending - idealSpending`.

## Justification

The comments define target as the full request through the target layer, ideal as the next increment, excess as the increment above ideal, and intended as the full four-layer request. Rearranging that composition isolates excess.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `expenses.requiredSpending` | 50,000 | nominal dollars/year |
| `expenses.targetSpending` | 70,000 | nominal dollars/year |
| `expenses.idealSpending` | 10,000 | nominal dollars/year |
| `expenses.intendedSpending` | 85,000 | nominal dollars/year |

## Arithmetic

`$85,000 - $70,000 - $10,000 = $5,000` excess spending. The target increment is `$70,000 - $50,000 = $20,000`, confirming `$50,000 + $20,000 + $10,000 + $5,000 = $85,000`.

## Expected

Exact value: `expenses.excessSpending = $5,000`. Fixture tolerance: absolute `$0.005`, because this is a composition of unrounded binary-floating-point dollar fields.

## Wrong readings

- Treating excess as the full amount above required gives `$35,000` (`$85,000 - $50,000`).
- Failing to remove the ideal increment gives `$15,000` (`$85,000 - $70,000`).

## Family

outputs: `spending-excess-requested-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
