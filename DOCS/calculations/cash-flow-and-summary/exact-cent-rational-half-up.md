## Claim

Kind: formula. `actions/exactCentProRata.ts#exactCentNearestHalfUp` rounds a nonnegative exact rational count of minor units `N/D` once to a whole minor unit, with exact halves upward.

## Justification

Euclidean division `N=qD+r` identifies the fractional minor unit exactly; `2r>=D` is the integer test for at least one half. Domain: `N>=0`, `D>0`, both integers.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Numerator | 5 | cent-numerator |
| Denominator | 2 | count |

## Arithmetic

`5=2*2+1`; `2r=D`, so `5/2=2.5` rounds to `3` cents.

## Expected

`3n` cents, exact integer.

## Wrong readings

- Banker's rounding produces `2` cents.
- Treating denominator as a monetary weight and multiplying again can produce `5` cents.

## Family

none yet — this quantization convention feeds conversion-tax-funding evidence.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
