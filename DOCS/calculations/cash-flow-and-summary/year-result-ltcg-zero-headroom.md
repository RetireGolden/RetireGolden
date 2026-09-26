## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.ltcgZeroHeadroom`, computed by `tax/federalTax.ts#zeroRateLtcgHeadroom`, is `0` when current taxable income already reaches the filing status's `year2026.capitalGains.rate15StartsAbove`; otherwise, without Social Security benefits, it is the largest extra gain that keeps taxable income at or under that threshold. When income before the gain covers the deduction, that is the threshold minus current taxable income. When it does not, taxable income is floored at `0` and the first gain dollars only use up the unused deduction, so the room is the threshold plus the unused deduction. Both branches are stated by the field comment.

## Justification

The 2026 single-filer 15% threshold is `$49,450`. Preferential gains stack above ordinary taxable income, so only the unused layer below that threshold remains at 0%. Under IRC 1(h)(1)(B) the 0% amount is measured against taxable income, and IRC 63 subtracts the deduction before taxable income exists; with ordinary income below the deduction, the deduction also absorbs gain dollars before any of them reach taxable income.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Tax year / filing status | 2026 / single | year / status |
| `rate15StartsAbove.single` | 49,450 | dollars taxable income |
| `standardDeduction.single` (under 65, no age addition) | 16,100 | dollars |
| Case A taxable income, no benefits | 37,000 | dollars |
| Case B taxable income, no benefits | 50,000 | dollars |
| Case C ordinary income, no benefits | 10,000 | dollars |
| Case D ordinary income, no benefits | 0 | dollars |

## Arithmetic

Case A is below the threshold: headroom `= $49,450 - $37,000 = $12,450`. Case B already reaches the threshold because `$50,000 >= $49,450`, so headroom `= $0`.

Case C: taxable income with an extra gain `g` is `max(0, $10,000 + g - $16,100)`. It stays at or under `$49,450` while `g <= $49,450 + $16,100 - $10,000 = $55,550`.

Case D: taxable income is `max(0, g - $16,100)`, at or under `$49,450` while `g <= $49,450 + $16,100 = $65,550`.

## Expected

Exact values: Case A `$12,450`; Case B `$0`; Case C `$55,550`; Case D `$65,550`. Fixture tolerance: absolute `$0.005` for Cases A and B, because dollar figures are computed in binary floating point. Cases C and D are asserted within the search's `$0.01` stopping width and at or under the exact value: their search runs over a wider bracket (from the threshold to the threshold plus the unused deduction), so it stops further under the root than Case A's.

## Wrong readings

- Subtracting in the opposite direction in Case A gives `-$12,450`.
- Failing to floor the already-at-threshold branch gives `$49,450 - $50,000 = -$550` instead of `$0`.
- Using the 20% threshold, `$545,500`, would incorrectly give Case A `$508,500`.
- Stopping at the threshold when income is below the deduction (subtracting the floored taxable income of `$0` from `$49,450`) gives `$49,450` in Cases C and D instead of `$55,550` and `$65,550`.

## Family

outputs: `year-result-ltcg-zero-headroom`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.

Amended 2026-09-25 by claude, the implementer of decision D-ZERO-RATE-HEADROOM: the claim now covers income below the deduction, and Cases C and D, the standard-deduction input and the fourth wrong reading were added. The two values are the ones the B2-P1 independent check reported (single filer, 2026 parameters, no Social Security) and are recomputed above from the 2026 threshold and standard deduction. Cases A and B are unchanged. Cases C and D await an independent check.
