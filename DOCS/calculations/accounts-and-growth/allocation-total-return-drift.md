## Claim

Kind: formula. `allocation/assetClasses.ts#driftWeights` updates unrebalanced class weights after one year by multiplying each beginning fraction by `1+r_i/100` and renormalizing; distributions are treated as reinvested.

## Justification

If total initial wealth is one, class ending wealth is `w_i(1+r_i)` and its share is that amount divided by total ending wealth. This is a total-return planning convention.

## Inputs

| Class | Starting weight | Return |
|---|---:|---:|
| Stocks | 0.6 | 10% |
| Bonds | 0.4 | -5% |

## Arithmetic

Ending amounts are `0.66` and `0.38`; total `1.04`. Weights are `0.66/1.04=33/52=0.634615384615385` and `0.38/1.04=19/52=0.365384615384615`.

## Expected

`[33/52,19/52]`, absolute tolerance `1e-12` per weight.

## Wrong readings

- Adding returns directly to weights gives `[0.7,0.35]`, which sums to 1.05.
- Failing to renormalize returns `[0.66,0.38]` as weights, summing to 1.04.

## Family

`accounts-balance-per-account-annual`, `bucket-lens-allocation` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision, 2026-09-27 (B2-P1 slice 2, after the review of RetireGolden #752): the record's limit about `bucket-lens-allocation` was restated because the code moved. It said the bucket lens reads only the published investable total; the lens now lives in the engine (`projection/bucketLens.ts#bucketLens`, its own record `bucket-lens-allocation`) and reads the published investable total and the published net portfolio need, refusing a year whose need is not a finite number. The family above is still reached only through the balances, and this record still does not list it. The record's text changed after the review above, so its `reviewedBy` was `unreviewed` again.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.
