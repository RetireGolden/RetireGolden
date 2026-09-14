## Claim

Kind: formula. `actions/conversionTaxFundingEvidence.ts#reducedConversionTaxFundingExactCentAmount` reduces a nonnegative exact rational cent amount `N/D` by `gcd(N,D)` to a unique lowest-terms numerator and denominator, returning null for a negative numerator, nonpositive denominator, or reduced fields outside the safe-integer domain.

## Justification

Dividing numerator and denominator by their greatest common divisor preserves the rational value because the same nonzero factor cancels. The result is coprime and therefore a canonical representation needed for field equality. Domain: integer `N>=0`, integer `D>0`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Numerator `N` | 150 | cent-numerator |
| Denominator `D` | 100 | count |

## Arithmetic

Euclid: `150=1*100+50`, `100=2*50+0`, so `gcd=50`. Reduced pair is `(150/50)/(100/50)=3/2`, still `1.5` cents.

## Expected

Exact amount fields `numeratorMinorUnits=3`, `denominator=2`, with exact integer equality.

## Wrong readings

- Dividing only the numerator yields `3/100=0.03` cents.
- Stopping Euclid at common factor 10 yields `15/10`, numerically equal but not in lowest terms.

## Family

none yet — the census has no conversion-tax-funding evidence family.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
