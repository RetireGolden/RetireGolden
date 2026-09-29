## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes the start-year amount that reaches the upstream FI number at retirement with no further contributions by discounting it over the whole years to the household's later retirement at the simple real return `defaultReturnPct/100-inflationPct/100`.

## Justification

With `retirementYear` the household's later retirement, the latest of each person's retirement year (a retirement age gives ISO birth year plus that age; a person with none retires in the first year without their wages, else in the start year; a person who never retires in the plan is left out; a tie to the older person, then the smaller id; `household-later-retirement`), and `n=max(0,retirementYear-startYear)`, the identity is `coastFireNumber=fiNumber/(1+defaultReturnPct/100-inflationPct/100)^n`. For one person `n=max(0,retirementAge-(startYear-birthYear))`, as before; for a couple the horizon is to the later retirement, never the first-listed person's (decision D-PEOPLE-ORDER, rule R4). This is discrete annual compounding with no rounding or floor. A person already at or past retirement has `n=0`, so Coast FIRE equals the FI number. An empty ledger adds no special behavior beyond the FI number already published. When nobody retires in the plan the FI number is null, and so is Coast FIRE (the independent review's N3).

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

One person: the retirement year is `1980+50=2030`, so the horizon is `max(0,2030-2026)=4` years, the same as `max(0,50-46)`. Simple real return is `0.07-0.03=0.04`; the discrete growth factor is `1.04^4=1.16985856`. Thus `coastFireNumber=$2,043,520.21020608/1.16985856=$1,746,809.64013811`.

## Expected

Coast FIRE number is `$1,746,809.64013811`, absolute tolerance `$0.000001`; that bound covers binary floating-point error from one integer power and one division while remaining far below one cent. With retirement age 46 or less and all other inputs unchanged, the exact expected value is the upstream FI number because the horizon is zero.

Couple case (the household of `projection-summary-fi-spending-base`): Pat, listed first, retires in 2030 and Robin in 2032, so the horizon is 6 years to Robin's, whichever is listed first: Coast FIRE is that record's FI number over `1.04^6=1.265319018496`, `$1,456,127.140880293`, not the 4-year `$1,574,947.115576125` of the first-listed person's retirement.

## Wrong readings

- Using the Fisher real return `(1.07/1.03)-1` instead of subtraction violates the stated simple-real-return convention.
- Discounting to the FI-number spending year rather than retirement age is wrong, including when a short ledger made FI number use its first row.
- Discounting to the first-listed person's retirement rather than the household's later one: the couple case would read 4 years instead of 6.
- Allowing a negative horizon for someone already retired grows rather than preserving the FI number; the horizon is floored at zero.
- Continuous compounding, healthcare extra inflation, intermediate rounding, or a final floor is not in the contract.
- Replacing an empty-ledger FI number with a new fallback changes the upstream quantity; Coast FIRE has no extra empty-ledger fallback.

## Family

outputs: `projection-summary-coast-fire-number`.

feeds: none. This quantity reads `projection-summary-fi-number` (its Inputs); it does not feed it.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract with the 2026-09-18 doc-comment contracts, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

Revision: The Family section had listed under feeds the families this quantity reads; corrected on the pull-request review's finding (#720) so feeds names only the families this quantity feeds, and the families it reads stay in Inputs.
