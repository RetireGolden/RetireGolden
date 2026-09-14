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

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
