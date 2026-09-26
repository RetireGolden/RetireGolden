## Claim

Kind: data. `socialSecurity/nra.ts#fraForBirthYear; #fraTotalMonths` assigns effective birth years 1960 and later a normal retirement age of 67 years 0 months, or 804 total month slots; the 1959 cohort is the last ramp step at 66 years 10 months.

## Justification

The extract states the endpoint convention: birth years 1960 and later use 67+0 under current law (the module header had said "after 2025", naming the last enumerated year rather than the boundary; the function enumerates 1938 to 1959 and falls through to 67+0 from 1960). Total month slots are twelve times completed years plus extra months.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Effective birth year | 2026 | calendar year |
| FRA endpoint | 67 years, 0 months | age |

The endpoint is the dataset stated in the `fraForBirthYear` comment.

## Arithmetic

FRA total months: `67 × 12 + 0 = 804`.

## Expected

Exact derived and published FRA: `{years: 67, extraMonths: 0}` and `804` total months; fixture tolerance: exact integers.

## Wrong readings

- Using the survivor schedule, which is keyed to age 60 and runs two birth years behind, produces 66 years 8 months, or `800` months, at 1960, the first year past the ramp (revised 2026-09-25: the survivor table used to stop at that value for every later year).
- Treating `extraMonths` as years produces an invalid interpretation even though this endpoint happens to use zero.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Revision note (2026-09-22, pull-request review of #728): the Claim and Justification had copied the module header's "after 2025" for the 67-year endpoint; the boundary is birth year 1960, as the record's formula and the fixture's 1960 check already stated. No value changed.
