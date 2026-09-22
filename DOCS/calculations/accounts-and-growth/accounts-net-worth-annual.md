## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.netWorth` equals `investableTotal + property + insuranceCashValue + ladderValue - debt - capped HECM loans`, with each HECM loan deduction capped at its home's value by the non-recourse rule.

## Justification

The field comment states this composition. Property and ordinary debt are totals represented by the corresponding published year-end account balances; the other terms are named year-row fields. The HECM deduction uses `min(loan balance, home value)` per home, not the uncapped loan total.

## Inputs

| Published year-end component | Value | Unit |
|---|---:|---|
| `investableTotal` | 552,000 | nominal dollars |
| Property: home A | 350,000 | nominal dollars |
| Property: home B | 200,000 | nominal dollars |
| `insuranceCashValue` | 12,000 | nominal dollars |
| `ladderValue` | 30,000 | nominal dollars |
| Ordinary debt | 80,000 | nominal dollars |
| HECM loan on home A | 420,000 | nominal dollars |
| HECM loan on home B | 50,000 | nominal dollars |

## Arithmetic

Property total: `$350,000 + $200,000 = $550,000`.

Capped HECM deduction: `min($420,000, $350,000) + min($50,000, $200,000) = $400,000`.

Net worth: `$552,000 + $550,000 + $12,000 + $30,000 - $80,000 - $400,000 = $664,000`.

## Expected

Exact value: `netWorth = $664,000`. Fixture tolerance: absolute `$0.005`, because the ledger composes unrounded binary-floating-point dollar balances.

## Wrong readings

- Deducting the uncapped `$470,000` HECM balance produces `$594,000`.
- Omitting insurance cash value and ladder value produces `$622,000`.
- Adding ordinary debt produces `$824,000`.

## Family

outputs: `accounts-net-worth-annual`.

feeds: `projection-result-ending-net-worth`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
