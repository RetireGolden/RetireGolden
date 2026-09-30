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

Two more households, with the same base spending and phases, tell apart the readings the first cannot (the different-family review of #769 found that Sam, the named person, is also the younger one, and outlives Alex):

| Case | People | `phasesAgeOf` |
|---|---|---|
| Older | Alex and Sam as above | Alex |
| Death | Alex (planning age 76, so he dies in December 2038) and Sam as above | Alex |

## Arithmetic

Sam's attained age is the year minus 1964. Sam is 74 in 2038, so no phase applies and base spending is 60,000; 75 in 2039, so the 0.9 phase applies: 60,000 x 0.9 = 54,000; 85 in 2049, so the 0.8 phase applies: 60,000 x 0.8 = 48,000. Alex's age plays no part: Alex reaches 75 in 2037, and 2037 still spends 60,000.

**Older.** The plan names Alex, the older person: Alex is 74 in 2036 (60,000), 75 in 2037 (54,000) and 85 in 2047 (48,000). Reading the younger person's age, Sam's, would spend 60,000 in 2037 and 54,000 in 2047.

**Death.** The plan names Alex, who dies in December 2038; Sam lives on, and a survivor's spending is left at 100% of the couple's (`survivorSpendingPct` unset). The phases keep Alex's age after his death: Alex is 76 in 2038 (54,000), would be 84 in 2046 (54,000) and 85 in 2047 (48,000). Stopping the phases at his death would spend 60,000 from 2039, and following the survivor's age from then, Sam's, 54,000 in 2047 (Sam is 83).

## Expected

| Quantity | Value |
|---|---:|
| Base spending, 2037 | 60,000 |
| Base spending, 2038 | 60,000 |
| Base spending, 2039 | 54,000 |
| Base spending, 2049 | 48,000 |
| Older: base spending, 2036 | 60,000 |
| Older: base spending, 2037 | 54,000 |
| Older: base spending, 2047 | 48,000 |
| Death: base spending, 2038 | 54,000 |
| Death: base spending, 2046 | 54,000 |
| Death: base spending, 2047 | 48,000 |

Exact dollars at zero inflation: absolute tolerance 0.005.

## Wrong readings

- Reading the first-listed person's age (Alex): 54,000 in 2037 and 48,000 from 2047.
- Reading the younger person's age whatever the plan names: in case Older, 60,000 in 2037 and 54,000 in 2047, against 54,000 and 48,000. (Reading the older person's is the first-listed reading above: Alex is both.)
- Stopping the phases when the named person dies: in case Death, 60,000 from 2039, against 54,000 in 2046 and 48,000 in 2047.
- Following the survivor's age after the named person's death: in case Death, 54,000 in 2047 (Sam is 83), against 48,000.

## Family

outputs: none.

feeds: `spending-base-annual`.

## Provenance

Cases Older and Death: added by claude (Opus 5.5), 2026-09-29, after the different-family review of #769 found that the first case could not tell the younger-person and stop-at-death readings from the rule; hand arithmetic at zero inflation.

Derived by: claude (Opus 5.5), 2026-09-28, from decision D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R1 (evidence/people-order-check.md). Implemented by the same session. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
