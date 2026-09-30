## Claim

Kind: formula. `socialSecurity/piaFromEarnings.ts#computePiaFromEarnings` publishes `zeroYearsInAime`, the number of the benefit computation years it averaged into the AIME (`yearsUsedInAime`) whose indexed earnings are $0, beside the `computationYearCount` it already publishes. The Social Security step's AIME explainer prints both: "Averages your top N earning years" and "M of those N years are $0".

New 2026-09-27 (B2-P1 slice 4). Until then planner-ui's `socialSecurity/explain.ts#summarizeComputation` counted the zeros itself, with the same result, and computed a divisor it never displayed (deleted).

## Justification

42 U.S.C. 415(b)(1)-(2): the AIME is "the quotient obtained by dividing- (A) the total ... of his wages paid in and self-employment income credited to his benefit computation years ... by (B) the number of months in those years"; the number of benefit computation years "equals the number of elapsed years reduced ... by 5 years", and they are the computation base years "for which the total of such individual's wages and self-employment income, after adjustment under paragraph (3), is the largest". A $0 year is a benefit computation year exactly when fewer than that many base years have earnings. The count reads the years the engine averaged, so it follows the engine's own computation-year window and its registered limits (`usc-42-415-b-2-a-i-computation-years-five-year-dropout`, `usc-42-415-b-2-b-ii-iii-initial-computation-base-window`).

## Inputs

A worker born 1966-07-20: eligibility year 2028, base years 1988-2027.

| Case | History |
|---|---|
| A | $60,000 each year 1995-2024 |
| B | $60,000 each year 1988-2024 |
| C | $60,000 each year 2020-2024 |

## Arithmetic

The five lowest of the 40 base-year values are dropped and the 35 largest kept; with at least five zeros to drop, the kept zeros are max(0, 35 − years with earnings).

- A: 30 years with earnings, 10 zeros (1988-1994 and 2025-2027): 40 − 30 − 5 = 5 zeros kept. AIME 7,487.
- B: 37 years with earnings, 3 zeros, all dropped: 0. AIME 10,028.
- C: 5 years with earnings: 35 − 5 = 30 zeros kept. AIME 793.

## Expected

| Case | computationYearCount | zeroYearsInAime | AIME |
|---|---:|---:|---:|
| A | 35 | 5 | 7,487 |
| B | 35 | 0 | 10,028 |
| C | 35 | 30 | 793 |

Tolerance: exact (integers).

## Wrong readings

- Every $0 base year (A: 10) instead of the $0 computation years (5).
- The five dropped years counted as "$0 years in the average".
- 35 less the rows entered: a history with rows outside the base window, or two rows for one year, would miscount.

## Family

outputs: `social-security-computation-summary-counts`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-computation-summary-counts.md` (by hand; case A cross-checked on the engine); independently checked (C7: 5, 0 and 30 with AIMEs 7,487, 10,028 and 793). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
