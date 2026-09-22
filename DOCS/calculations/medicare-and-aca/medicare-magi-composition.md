## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.magi` publishes `max(0, ordinary income realized + realized gains + qualified dividends + taxable Social Security + tax-exempt interest)`.

## Justification

The field comment defines both the five-term composition and its zero floor. Untaxed Social Security is not a separate add-back, and foreign income enters only indirectly through taxable-Social-Security provisional income.

## Inputs

| Input | Positive case | Floor case | Unit |
|---|---:|---:|---|
| Ordinary income realized | 40,000 | -10,000 | dollars/year |
| Realized gains | 5,000 | 1,000 | dollars/year |
| Qualified dividends | 2,000 | 1,000 | dollars/year |
| Taxable Social Security | 3,000 | 1,000 | dollars/year |
| Tax-exempt interest | 1,000 | 1,000 | dollars/year |

All terms and the floor are stated in the `YearResult.magi` comment.

## Arithmetic

Positive case: `max(0, 40,000 + 5,000 + 2,000 + 3,000 + 1,000) = $51,000`.

Floor case: `max(0, -10,000 + 1,000 + 1,000 + 1,000 + 1,000) = max(0, -6,000) = $0`.

## Expected

Exact derived annual MAGI: positive case `$51,000`; floor case `$0`. Fixture tolerance: exact to the cent when inputs are exact currency values, because this composition adds terms and applies an exact zero floor.

## Wrong readings

- Omitting tax-exempt interest produces `$50,000` in the positive case.
- Adding gross rather than taxable Social Security changes the specified base.
- Publishing `-$6,000` in the second case ignores the explicit floor.

## Family

outputs: `magi-annual`.

feeds: `irmaa-surcharge-annual`; `medicare-premiums-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
