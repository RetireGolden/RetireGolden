## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.netPortfolioNeed` equals `max(0, expenses.total + tax + penalties - incomes.total)` in nominal dollars for the same published year row.

## Justification

The field comment states the formula verbatim. It is the year's required portfolio supply, not the amount actually funded; the floor prevents a negative need when income exceeds outflows.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `expenses.total` | 94,000 | nominal dollars/year |
| `tax` | 12,000 | nominal dollars/year |
| `penalties` | 1,000 | nominal dollars/year |
| `incomes.total` | 90,000 | nominal dollars/year |

## Arithmetic

Unfloored need: `$94,000 + $12,000 + $1,000 - $90,000 = $17,000`.

Floor: `max($0, $17,000) = $17,000`.

## Expected

Exact value: `netPortfolioNeed = $17,000`. Fixture tolerance: absolute `$0.005`, the ledger's own annual funding tolerance, because the identity is guaranteed only within that accepted annual residual.

## Wrong readings

- Omitting penalties produces `$16,000`.
- Adding income rather than subtracting it produces `$197,000`.
- With the same outflows but `$120,000` income, omitting the zero floor produces `-$13,000`; the published need must be `$0`.

## Family

outputs: `portfolio-need-annual`.

feeds: `spending-shortfall-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.
