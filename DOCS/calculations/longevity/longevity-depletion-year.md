## Claim

Kind: model. `projection/internal/types/result.ts#ProjectionResult.depletionYear` is the first projection year whose funding shortfall, after any HECM backstop draw, exceeds `projection/moneyTolerance.ts#ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = $0.005`; it is `null` when no year does. The year-selection identity is stated directly by the type comment.

## Justification

With zero returns, zero inflation, no HECM, no tax, and one spendable account, the annual net spending gap drains the account dollar for dollar. Depletion begins in the first year in which the remaining balance cannot cover that gap by more than half a cent.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection years | 2026–2028 | calendar years |
| Opening account balance | 25,000 | dollars |
| Annual spending | 10,000 | dollars/year |
| Annual income | 0 | dollars/year |
| Return / inflation | 0 / 0 | percent/year |
| HECM draw | 0 | dollars/year |
| Funding tolerance, `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` | 0.005 | dollars |

## Arithmetic

Annual gap `= $10,000 - $0 = $10,000`. End 2026: `$25,000 - $10,000 = $15,000`, shortfall `$0`. End 2027: `$15,000 - $10,000 = $5,000`, shortfall `$0`. In 2028 only `$5,000` remains, so shortfall `= $10,000 - $5,000 = $5,000`. Because `$5,000 > $0.005`, the first qualifying year is 2028.

Null case: with annual spending `$5,000` over the same three years, closes are `$20,000`, `$15,000`, and `$10,000`; every shortfall is `$0`, so no year qualifies.

## Expected

Exact values: depletion case `2028`; no-depletion case `null`. Fixture tolerance: exact, because a calendar year and `null` are discrete outputs.

## Wrong readings

- Treating a zero closing balance as depletion would report `2027` for a `$30,000` opening balance and the same gap; the contract tests shortfall above `$0.005`, not balance alone.
- Testing before the account funds the year would report `2026`; the actual first positive shortfall is in `2028`.
- Returning the horizon year for the null case would produce `2028` instead of `null`.

## Family

outputs: `longevity-depletion-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
