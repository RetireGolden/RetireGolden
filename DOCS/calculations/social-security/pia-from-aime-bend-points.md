## Claim

Kind: formula. `socialSecurity/piaFromEarnings.ts#piaMonthlyFromAime` computes monthly PIA from AIME by applying 90% through the first eligibility-year bend point, 32% between the two bend points, and 15% above the second, then rounding the result down to the next lower $0.10. The percentages are the formula convention specified for this worksheet; the 2026 bend points come from `socialSecurity/ssaWageData.ts#PIA_BEND_POINTS[2026]`.

## Justification

For AIME \(A\), first bend point \(b_1\), and second bend point \(b_2\), the convention implies `0.90 × min(A,b1) + 0.32 × min(max(A-b1,0),b2-b1) + 0.15 × max(A-b2,0)`, floored to a dime. One case crosses both bends; the other isolates the first band.

## Inputs

| Input | Cross-both case | Below-first case | Unit |
|---|---:|---:|---|
| Eligibility year | 2026 | 2026 | year |
| AIME | 9,000 | 1,000 | dollars/month |
| First bend point | 1,286 | 1,286 | dollars/month |
| Second bend point | 7,749 | 7,749 | dollars/month |

The bend points are `PIA_BEND_POINTS[2026].first = 1_286` and `.second = 7_749`.

## Arithmetic

Cross-both case: `1,286 × 0.90 = 1,157.40`; `(7,749 - 1,286) × 0.32 = 6,463 × 0.32 = 2,068.16`; `(9,000 - 7,749) × 0.15 = 1,251 × 0.15 = 187.65`. Sum: `$3,413.21`; floor to dime: `$3,413.20`.

Below-first case: `1,000 × 0.90 = $900.00`; floor to dime remains `$900.00`.

## Expected

Exact derived monthly PIAs: cross-both `$3,413.20`; below-first `$900.00`. Fixture tolerance: exact to `$0.10`, because the contract publishes a dime-floored currency value.

## Wrong readings

- Rounding `$3,413.21` to the nearest dime produces `$3,413.20` here accidentally; a fixture suite must retain a separate rounding discriminator even though this case does not distinguish it.
- Applying 32% instead of 15% to the AIME above the second bend point produces `$3,625.88` before dime flooring (a flat 32% on everything above the first bend point gives `$3,305.88`).
- Using the 2026 tax pack for bend points fails because those constants live in `PIA_BEND_POINTS`, not `year2026`.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory (approved with a note on a wrong reading's wording, applied below).

Revision: the second wrong reading's wording was corrected on the reviewer's note to describe the misread that produces its figure; no value changed.
