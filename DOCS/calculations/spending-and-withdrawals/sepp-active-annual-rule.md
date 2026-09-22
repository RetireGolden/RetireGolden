## Claim

Kind: model. `strategies/sepp.ts#seppActive; projection/internal/annualSeppDistributions.ts#annualSeppDistributions` treats a SEPP as active in an attained-age year after it starts while at least one condition remains unsatisfied: age is below the engine's approximate age-60 penalty boundary, or fewer than five years have elapsed since the start age. The series becomes inactive only when both conditions are satisfied, implementing the stated “longer of five years or until 59½” convention at annual granularity.

## Justification

The annual model cannot represent half-year ages and explicitly approximates 59½ by its age-60 boundary. For start age \(s\) and attained integer age \(a\), continuation lasts until both five elapsed attained-age steps and the age-60 boundary are satisfied; the example shows the boundary behavior. This does not model a busted series or retroactive penalties.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| SEPP start age | 55 | attained years |
| First evaluated age | 59 | attained years |
| Second evaluated age | 60 | attained years |
| Minimum duration | 5 | years |
| Approximate penalty boundary | 60 | attained years |

The duration and boundary are stated in the `seppActive` comment.

## Arithmetic

At age 59: elapsed `59 - 55 = 4 < 5` and age is below 60, so the series is active.

At age 60: elapsed `60 - 55 = 5` and the age-60 boundary is reached, so both conditions are satisfied and the annual series is inactive.

## Expected

Exact published booleans: `seppActive(55,59) = true`; `seppActive(55,60) = false`; fixture tolerance: exact.

## Wrong readings

- Counting the start year as one completed year ends the series at age 59.
- Requiring only five years and ignoring the age boundary can end a series begun at age 50 at age 55.

## Family

outputs: none.

feeds: `sepp-distribution-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Revision note: The Claim's wording was aligned with the corrected comment's disjunction; no value changed.
