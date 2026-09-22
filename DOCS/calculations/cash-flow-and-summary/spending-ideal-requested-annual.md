## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearExpenses.idealSpending` is the incremental ideal layer above `targetSpending`; because `intendedSpending` is the full required/target/ideal/excess amount, the words imply `idealSpending = intendedSpending - targetSpending - excessSpending`.

## Justification

The comments define `targetSpending` as required spending plus the full target layer, `idealSpending` as incremental above target, `excessSpending` as incremental above ideal, and `intendedSpending` as the full four-layer request. Rearranging that stated composition isolates the ideal increment.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `expenses.requiredSpending` | 50,000 | nominal dollars/year |
| `expenses.targetSpending` | 70,000 | nominal dollars/year |
| `expenses.excessSpending` | 5,000 | nominal dollars/year |
| `expenses.intendedSpending` | 85,000 | nominal dollars/year |

## Arithmetic

`$85,000 - $70,000 - $5,000 = $10,000` ideal spending. The target increment is `$70,000 - $50,000 = $20,000`, confirming that the four layers are `$50,000 + $20,000 + $10,000 + $5,000 = $85,000`.

## Expected

Exact value: `expenses.idealSpending = $10,000`. Fixture tolerance: absolute `$0.005`, because this is a composition of unrounded binary-floating-point dollar fields.

## Wrong readings

- Treating ideal as the full amount through the ideal layer gives `$80,000` (`$85,000 - $5,000`).
- Subtracting required rather than target spending gives `$30,000` (`$85,000 - $50,000 - $5,000`).

## Family

outputs: `spending-ideal-requested-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
