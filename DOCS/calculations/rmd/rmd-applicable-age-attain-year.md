## Claim

Kind: data. `rmd/applicableAge.ts#applicableAgeAttainYears` assigns an owner born in 1955 the settled applicable age 73, attained in 2028, with an IRA required beginning date in calendar 2029.

## Justification

The extract's statutory cohort table assigns births 1951–1958 age 73. For a whole-year age, attain year is birth year plus age; the RBD is April 1 of the following year. This case avoids the contested 1959 cohort and the date-sensitive 70½ cohort.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Owner birth year | 1955 | calendar year |
| Cohort applicable age | 73 | years |

The age comes from the settled cohort data stated in the `rmd/applicableAge.ts` header.

## Arithmetic

Attain year: `1955 + 73 = 2028`.

RBD calendar year: `2028 + 1 = 2029`, with date April 1.

## Expected

Exact derived applicable age `73`, attain years `[2028]`, and RBD date `2029-04-01`; fixture tolerance: exact for integer years and civil date.

## Wrong readings

- Applying age 72 produces attain year `2027` and RBD `2028-04-01`.
- Applying the age-75 cohort produces attain year `2030` and RBD `2031-04-01`.

## Family

outputs: none.

feeds: `rmd-required-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
