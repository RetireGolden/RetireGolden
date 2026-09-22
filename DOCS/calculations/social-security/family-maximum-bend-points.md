## Claim

Kind: formula. `socialSecurity/familyMaximum.ts#familyMaximumMonthlyFromPia` computes the monthly retirement/survivor family maximum from PIA using 150% through the first family-maximum bend point, 272% between the first and second, 134% between the second and third, and 175% above the third, then floors the result to the next lower $0.10. The 2026 bend points are $1,643, $2,371, and $3,093.

## Justification

For monthly PIA \(P\) and bend points \(b_1,b_2,b_3\), the stated formula is `1.50 * min(P,b1) + 2.72 * min(max(P-b1,0),b2-b1) + 1.34 * min(max(P-b2,0),b3-b2) + 1.75 * max(P-b3,0)`, floored to a dime. One case crosses all three bend points; the other isolates the first band.

## Inputs

| Input | Cross-all-three case | Below-first case | Unit |
|---|---:|---:|---|
| Eligibility year | 2026 | 2026 | year |
| Worker PIA | 4,000 | 1,000 | dollars/month |
| First bend point | 1,643 | 1,643 | dollars/month |
| Second bend point | 2,371 | 2,371 | dollars/month |
| Third bend point | 3,093 | 3,093 | dollars/month |

The bend points are `FAMILY_MAXIMUM_BEND_POINTS[2026]` in `socialSecurity/ssaWageData.ts`.

## Arithmetic

Cross-all-three case: `1,643 * 1.50 = 2,464.50`; `(2,371 - 1,643) * 2.72 = 728 * 2.72 = 1,980.16`; `(3,093 - 2,371) * 1.34 = 722 * 1.34 = 967.48`; `(4,000 - 3,093) * 1.75 = 907 * 1.75 = 1,587.25`. Sum: `$6,999.39`; floor to dime: `$6,999.30`.

Below-first case: `1,000 * 1.50 = $1,500.00`; floor to dime remains `$1,500.00`.

## Expected

Exact derived monthly family maximums: cross-all-three `$6,999.30`; below-first `$1,500.00`. Fixture tolerance: exact equality on the dime-floored figure, because the contract quantizes to the dime before publication; the unrounded sums (`$6,999.39` and `$1,500.00`) are intermediates only.

## Wrong readings

- Omitting the amount above the third bend point produces `$5,412.10` after dime flooring.
- Applying the PIA formula's 90%/32%/15%/15% rates instead produces `$1,956.00` after dime flooring.
- Returning the unfloored cross-all-three sum produces `$6,999.39` instead of `$6,999.30`.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory (approved; the tolerance wording was made exact on the reviewer's note, applied below).

Revision: the tolerance statement was made exact on the reviewer's note; no value changed.
