## Claim

Kind: formula. `projection/survivorTransition.ts#survivorShortfallYearCount` counts, in a death timing's base run, the years after the death year in which someone is alive and the ledger's required-spending shortfall (`YearResult.requiredShortfall`) exceeds `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`, $0.005 (`projection/moneyTolerance.ts`). The survivor page prints "required spending covered" for 0 and "N shortfall yrs" otherwise. The degenerate-timing test (`#isDegenerateTiming`) reads required spending on both sides of the death: a survivor shortfall is a transition signal only when the last joint year had none.

New 2026-09-28 (B2-P1 slice 5, owner decision R16's second part). Until then the count was the same but written with the literal 0.005, and the transition facts beside it read the total shortfall (`YearResult.shortfall`) while their documentation said required spending.

## Justification

No statute governs the count; rule 2 decides it: the record and the page say what it counts, required spending, and the tolerance is the ledger's own named budget, so a change to the constant cannot split the two.

## Inputs

C-A (synthetic, death year 2040):

| Year | Someone alive | Required shortfall |
|---|---|---:|
| 2040 | yes (both) | 900 |
| 2041 | yes | 0 |
| 2042 | yes | 0.004 |
| 2043 | yes | 0.006 |
| 2044 | yes | 1,200 |
| 2045 | no | 5,000 |

## Arithmetic

2040 is the death year, not counted. 2041: 0. 2042: 0.004 ≤ 0.005, not counted. 2043: 0.006, counted. 2044: 1,200, counted. 2045: nobody alive, not counted. Count = 2.

## Expected

| Case | Expected |
|---|---|
| C-A count | 2 |

Tolerance: exact.

## Wrong readings

- Counting the death year (3).
- Counting years after both deaths (3).
- Counting a sub-cent rounding remainder (3).
- Counting target, ideal or excess shortfalls, or the total.

## Family

outputs: `survivor-scenario-row-survivor-shortfall-years`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `survivor-scenario-row-survivor-shortfall-years.md`, case C-A by hand); independently checked (evidence/b2p1-slice5-check.md, item 4). Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.
