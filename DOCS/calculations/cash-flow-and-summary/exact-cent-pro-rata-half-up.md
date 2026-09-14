## Claim

Kind: formula. `actions/exactCentProRata.ts#exactCentProRataNearestHalfUp` computes `amount*numerator/denominator` in exact nonnegative integer minor units and rounds the single rational result to the nearest minor unit with exact halves upward.

## Justification

Write the exact product as `N/D`, divide `N=qD+r`, and return `q+1` exactly when `2r>=D`. Integer arithmetic avoids binary-float error. Domain: nonnegative integer amount and numerator, positive integer denominator.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Amount | 101 | cents |
| Ratio numerator/denominator | 1/2 | exact ratio |

## Arithmetic

`N=101*1=101`; `101=50*2+1`; because `2r=2>=2`, the exact `50.5` cents rounds upward to `51` cents.

## Expected

`51n` cents, exact integer.

## Wrong readings

- Ties-to-even gives `50` cents.
- Flooring every rational share gives `50` cents.

## Family

none yet — this is an upstream exact-money convention used by action evidence.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
