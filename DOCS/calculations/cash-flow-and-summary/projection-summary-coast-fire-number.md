## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes the start-year amount that reaches the upstream FI number at retirement with no further contributions by discounting it for a whole-age horizon at the simple real return `defaultReturnPct/100-inflationPct/100`.

## Justification

With the first person's ISO `birthYear` (or 1980), retirement age (or 65), current calendar-year age `startYear-birthYear`, and `n=max(0,retirementAge-(startYear-birthYear))`, the identity is `coastFireNumber=fiNumber/(1+defaultReturnPct/100-inflationPct/100)^n`. This is discrete annual compounding with no rounding or floor. A person already at or past retirement has `n=0`, so Coast FIRE equals the FI number. An empty ledger adds no special behavior beyond the FI number already published.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | calendar year |
| First person's date of birth | 1980-12-31 | ISO date |
| First person's retirement age | 50 | years |
| Upstream FI number | 2,043,520.21020608 | 2026 dollars |
| Default nominal return | 7 | percent/year |
| General inflation rate | 3 | percent/year |

The month and day are ignored, healthcare extra inflation is not used, and current calendar-year age is `2026-1980=46`.

## Arithmetic

The whole-age horizon is `max(0,50-46)=4` years. Simple real return is `0.07-0.03=0.04`; the discrete growth factor is `1.04^4=1.16985856`. Thus `coastFireNumber=$2,043,520.21020608/1.16985856=$1,746,809.64013811`.

## Expected

Coast FIRE number is `$1,746,809.64013811`, absolute tolerance `$0.000001`; that bound covers binary floating-point error from one integer power and one division while remaining far below one cent. With retirement age 46 or less and all other inputs unchanged, the exact expected value is the upstream FI number because the horizon is zero.

## Wrong readings

- Using the Fisher real return `(1.07/1.03)-1` instead of subtraction violates the stated simple-real-return convention.
- Discounting to the FI-number spending year rather than retirement age is wrong, including when a short ledger made FI number use its first row.
- Allowing a negative horizon for someone already retired grows rather than preserving the FI number; the horizon is floored at zero.
- Continuous compounding, healthcare extra inflation, intermediate rounding, or a final floor is not in the contract.
- Replacing an empty-ledger FI number with a new fallback changes the upstream quantity; Coast FIRE has no extra empty-ledger fallback.

## Family

outputs: `projection-summary-coast-fire-number`.

feeds: `projection-summary-fi-number`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract with the 2026-09-18 doc-comment contracts, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
