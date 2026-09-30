## Claim

Kind: model. `socialSecurity/openClaims.ts#isClaimAlreadyMade` decides whether a Social Security claim was already made before the plan starts: a claim at a claim age is made when its claim year is before the plan's start year, and open otherwise. The claim year is `#claimYearOf`: the calendar year of the date of birth as entered plus the claim age's whole years, its months ignored. This is the ledger's annual convention, and the one test every claim-age search applies:

- `#openClaims`, for the Social Security page's sweep and its month refinement (`social-security-claim-age-sweep`);
- `socialSecurity/analysis/expectedValue.ts#benefitsOnlyRanking`;
- `decisions/generators.ts#socialSecurityClaimGenerator`, for a stream and for each canonical age it would offer, and so `projection/optimizePlan.ts#optimizePlanCoOptimizingClaimAge` (`claim-age-co-optimization`);
- the Scenarios page's claim-age lever.

A claim already made is held at its own claim age in every row; a claim age whose claim year is before the start year is not offered.

New 2026-09-28 (B2-P1 slice 5, the review's M4 and I2): the predicate was written inline twice, in `#openClaims` and in `#isClaimAlreadyMade`, and had no record of its own; `#openClaims` now calls it.

## Justification

- Entitlement to an old-age benefit follows the application (42 U.S.C. 402(a)(3)). A benefit reduced for age cannot be paid "for any month before the month in which your application is filed" (20 CFR 404.621(a)(3)), and another old-age benefit reaches back at most six months (404.621(a)(2)). So a claim age already passed is not a choice the plan can still make, and a claim already filed is history.
- An application can be withdrawn within 12 months of the first month of entitlement, repaying every benefit paid on it (20 CFR 404.640(b)(3), (b)(4)); a withdrawn application is then treated as never filed (404.640(d)). Benefits can be suspended from full retirement age to 70 (42 U.S.C. 402(z)). Neither is modeled, so the test treats a claim made as staying made.
- The year alone decides, because the ledger pays Social Security in annual rows: a claim in the start year starts inside the projection, and one in an earlier year started before it.

## Inputs

Start year 2026 unless a case names another. Each case is a person's date of birth and a claim age:

- S-A: born 1953-06-15, claiming at 67y0m.
- S-B: born 1964-11-30, claiming at 62y0m (the month, November 2026, is still ahead of a plan started in January; one started in December would be past it).
- S-C: born 1964-06-15, claiming at 62y6m, with start years 2026 and 2027.
- S-D: born 1962-06-15, the canonical 62y0m and a claim at 64y0m.
- S-E: a couple, High born 1963-06-15 claiming at 62y0m and Low born 1966-01-01 claiming at 70y0m, through `#openClaims`.

## Arithmetic

- S-A: 1953 + 67 = 2020 < 2026: made.
- S-B: 1964 + 62 = 2026, not before 2026: open, whatever the month.
- S-C: 1964 + 62 = 2026 (the 6 months do not move the year): open in 2026; 2026 < 2027: made in 2027.
- S-D: 1962 + 62 = 2024 < 2026: the canonical 62 is made (not offered); 1962 + 64 = 2026: open.
- S-E: High 1963 + 62 = 2025 < 2026, made and held; Low 1966 + 70 = 2036, open.

## Expected

| Case | Claim year | Made |
|---|---:|---|
| S-A 1953 at 67 | 2020 | yes |
| S-B 1964-11-30 at 62 | 2026 | no |
| S-C 1964 at 62y6m, start 2026 | 2026 | no |
| S-C 1964 at 62y6m, start 2027 | 2026 | yes |
| S-D 1962 canonical 62 | 2024 | yes |
| S-D 1962 at 64 | 2026 | no |
| S-E High, 1963 at 62 | 2025 | yes |
| S-E Low, 1966 at 70 | 2036 | no |

Exact: claim years are integers and the verdicts booleans.

## Wrong readings

- A claim in the start year counted as made (`claimYear <= startYear`): S-B and S-C would be held though the application can still be filed in the plan's first year, and S-D's claim at 64 would not be offered.
- Months rounding the claim year up: S-C at 62y6m would fall in 2027 and read as open in 2027, a claim made in 2026 offered again.
- The birth month applied (a claim year from the month the age is reached): changes no year here, but a start-year claim whose month has passed would read as made; the annual convention keeps it open, a stated limit.
- A claim made re-offered at another age: the review's plan born 1963-06-15 claiming at 62 in 2025 was offered at 67 and 70 by the Optimize page's generator when its skip was removed.

## Family

feeds: `social-security-claiming-sweep-objective`, `claim-age-co-optimization-combinations-evaluated`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-28, from the B2-P1 slice 5 derivation (evidence/b2p1-slice5-derivation.md, problem 4, the claim-already-made decision C10) and the review's law section, which checked each limit against the text. Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
