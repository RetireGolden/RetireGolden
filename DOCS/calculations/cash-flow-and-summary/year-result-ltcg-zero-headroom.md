## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.ltcgZeroHeadroom`, computed by `tax/federalTax.ts#zeroRateLtcgHeadroom`, is `0` when current taxable income already reaches the filing status's `year2026.capitalGains.rate15StartsAbove`; otherwise, without Social Security benefits, it is that threshold minus current taxable income. Both branches are stated by the field comment.

## Justification

The 2026 single-filer 15% threshold is `$49,450`. Preferential gains stack above ordinary taxable income, so only the unused layer below that threshold remains at 0%.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Tax year / filing status | 2026 / single | year / status |
| `rate15StartsAbove.single` | 49,450 | dollars taxable income |
| Case A taxable income, no benefits | 37,000 | dollars |
| Case B taxable income, no benefits | 50,000 | dollars |

## Arithmetic

Case A is below the threshold: headroom `= $49,450 - $37,000 = $12,450`. Case B already reaches the threshold because `$50,000 >= $49,450`, so headroom `= $0`.

## Expected

Exact values: Case A `$12,450`; Case B `$0`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Subtracting in the opposite direction in Case A gives `-$12,450`.
- Failing to floor the already-at-threshold branch gives `$49,450 - $50,000 = -$550` instead of `$0`.
- Using the 20% threshold, `$545,500`, would incorrectly give Case A `$508,500`.

## Family

outputs: `year-result-ltcg-zero-headroom`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
