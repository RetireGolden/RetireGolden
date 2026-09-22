## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.surplusInvested` is `max(0, cash inflows - expenses.total - contributions - tax - penalties)` at the accepted funding fixed point. The credited surplus goes to the lowest-id cash account, otherwise the lowest-id taxable account with equal cost-basis growth, otherwise unassigned cash with a warning; the amount has no cap.

## Justification

Surplus is residual cash after every stated use, not a negative portfolio need and not an extra income line.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Accepted cash inflows | 100,000 | nominal dollars/year |
| `expenses.total` | 50,000 | nominal dollars/year |
| `contributions` | 10,000 | nominal dollars/year |
| `tax` | 8,000 | nominal dollars/year |
| `penalties` | 2,000 | nominal dollars/year |
| Cash account IDs | `cash-b`, `cash-a` | identifiers |

## Arithmetic

Residual `= $100,000 - $50,000 - $10,000 - $8,000 - $2,000 = $30,000`. Floor `= max(0, $30,000) = $30,000`. The destination is `cash-a`, the lowest-id cash account.

## Expected

Exact value: `surplusInvested = $30,000`, credited to `cash-a`. Fixture tolerance: absolute `$0.005`, because the accepted fixed-point values and subtraction use binary floating point.

## Wrong readings

- Omitting contributions produces `$40,000`.
- Treating penalties as part of tax and then subtracting them again produces `$28,000`.
- With a `$5,000` negative residual, publishing `-$5,000` ignores the floor; the correct value is `$0`.

## Family

outputs: `surplus-invested-annual`.

feeds: `accounts-balance-per-account-annual`; `cash-flow-reconciliation-totals`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
