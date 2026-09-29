## Claim

Kind: model. `projection/internal/annualLifestyleLayers.ts#annualLifestyleLayers` multiplies the base lifestyle by the multiplier of the last spending phase (phases stably sorted by `fromAge`) whose `fromAge` is at or below the attained age of the person `expenses.phasesAgeOf` names, the only person in a one-person plan (`annualExpenseAssemblyPhase` passes `phasesPersonId`). The phases keep that person's age after that person dies (decision D-PEOPLE-ORDER, rule R1).

## Justification

No law says whose age a household's spending shape follows: it is the household's choice, and the program used to make it by list order ("the primary (first) person"), which a reorder arriving by JSON changed without a word. The plan now stores the person and the Spending page shows the name. A plan saved before schema v7 is given the person it listed first, whose age its phases already followed, so no stored figure moves.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Alex (listed first): date of birth, planning age | 1962-04-15, 92 | ISO date, years |
| Sam (listed second): date of birth, planning age | 1964-09-02, 95 | ISO date, years |
| Base annual spending, inflation | 60,000; 0 | dollars; percent |
| Phases | from 75 x 0.9, from 85 x 0.8 | age, factor |
| `phasesAgeOf` | Sam | person |

## Arithmetic

Sam's attained age is the year minus 1964. Sam is 74 in 2038, so no phase applies and base spending is 60,000; 75 in 2039, so the 0.9 phase applies: 60,000 x 0.9 = 54,000; 85 in 2049, so the 0.8 phase applies: 60,000 x 0.8 = 48,000. Alex's age plays no part: Alex reaches 75 in 2037, and 2037 still spends 60,000.

## Expected

| Quantity | Value |
|---|---:|
| Base spending, 2037 | 60,000 |
| Base spending, 2038 | 60,000 |
| Base spending, 2039 | 54,000 |
| Base spending, 2049 | 48,000 |

Exact dollars at zero inflation: absolute tolerance 0.005.

## Wrong readings

- Reading the first-listed person's age (Alex): 54,000 in 2037 and 48,000 from 2047.
- Reading the older person's age, or the younger's, whatever the plan names: the plan names Sam, and Sam's is the age read.
- Stopping the phases when the named person dies: they keep that person's age.

## Family

outputs: none.

feeds: `spending-base-annual`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from decision D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R1 (evidence/people-order-check.md). Implemented by the same session. Reviewed by: unreviewed.
