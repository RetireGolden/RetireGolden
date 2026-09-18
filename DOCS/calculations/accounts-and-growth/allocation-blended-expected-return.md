## Claim

Kind: formula. `allocation/assetClasses.ts#blendedReturnPct` computes the weight-fraction arithmetic mean of asset-class expected annual nominal total returns in percent, without rounding.

## Justification

One dollar split into fractions `w_i` grows by `sum w_i(1+r_i)`; subtracting principal gives portfolio return `sum w_i r_i`. Domain: normalized finite weights and finite percent returns.

## Inputs

| Class | Weight | Return |
|---|---:|---:|
| US stocks | 0.6 | 7% nominal/year |
| Bonds | 0.4 | 4% nominal/year |

## Arithmetic

`0.6(7)+0.4(4)=4.2+1.6=5.8` percentage points.

## Expected

`5.8%` nominal/year, absolute tolerance `1e-12` percentage points.

## Wrong readings

- Dividing weights by 100 again gives `0.058%`.
- Using a geometric mean gives about `5.79%`, not the one-period portfolio blend.

## Family

`accounts-balance-per-account-annual`, `accounts-investable-total-annual` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
