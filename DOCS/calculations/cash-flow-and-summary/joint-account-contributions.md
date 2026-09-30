## Claim

Kind: model. `projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch` gives a jointly owned (`ownerPersonId: null`) cash, taxable or equity-compensation account its desired contribution while anyone in the household is alive: its plain `annualContribution` while the household has wages (the living people's wages sum to more than 0), and its `contributionSchedule` by the attained age of the person `contributionScheduleAgeOf` names (the only person in a one-person plan), with no wage test (decision D-PEOPLE-ORDER, rule R3). An owned account follows its owner.

## Justification

The schema has always said a joint account contributes "while the owner still has wages", and for a joint account the engine read "the owner" as the first-listed person: its wages, its life and its age. No statute governs contributions to a taxable or cash account, so this is the program's own rule, and the only facts it has are who is alive and whether the household earns. Reading those makes the rule the same whichever person is listed first. A schedule's ages must be someone's age, so the plan names the person; a schedule never had a wage test outside an employer plan, and keeps none.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start, inflation, returns | 2026; 0; 0 | year; percent; percent |
| Pat (listed first): born 1966, planning age 62 (alive through 2028), no wages | 1966-01-01 | ISO date |
| Robin (listed second): born 1970, planning age 90, wages 80,000 a year to age 64 | 1970-01-01 | ISO date |
| Joint cash account: opening balance, annual contribution | 0; 6,000 | nominal dollars |

Robin's wages end at age 64, so Robin earns from 2026 (age 56) through 2033 (age 63).

Case B, a scheduled contribution with no household wages (added 2026-09-29 for the Codex review): the same Pat and Robin, but neither has wages. The joint cash account (opening balance 0, plain annual contribution 0) has the schedule 5,000 a year from age 60 through age 64, escalation 0, by Pat's age (`contributionScheduleAgeOf: pat`). Spending of 20,000 a year is drawn from a 2,000,000 cash buffer of Robin's.

## Arithmetic

The household has wages from 2026 through 2033, eight years, and someone is alive in all of them, so the joint account takes 6,000 in each: 6,000 by the end of 2026, 18,000 by 2028, 24,000 by 2029 (after Pat has died), and 8 x 6,000 = 48,000 by 2033. From 2034 nobody earns and the balance stays 48,000.

Case B. Pat's attained age is the year minus 1966, so the schedule covers 2026 (60) through 2030 (64). The schedule has no wage test, so the household's lack of wages does not stop it; someone is alive in every one of those years (Pat through 2028, Robin throughout), and the schedule keeps Pat's age after Pat dies. The account takes 5,000 in each of the five years: 5,000 by the end of 2026, 15,000 by 2028, 20,000 by 2029 (after Pat has died), 5 x 5,000 = 25,000 by 2030, and from 2031, past age 64, it stays 25,000.

## Expected

| Quantity | Value |
|---|---:|
| Joint balance, end of 2026 | 6,000 |
| Joint balance, end of 2028 | 18,000 |
| Joint balance, end of 2029 | 24,000 |
| Joint balance, end of 2033 | 48,000 |
| Joint balance, end of 2034 | 48,000 |
| Scheduled, joint balance, end of 2026 | 5,000 |
| Scheduled, joint balance, end of 2028 | 15,000 |
| Scheduled, joint balance, end of 2029 | 20,000 |
| Scheduled, joint balance, end of 2030 | 25,000 |
| Scheduled, joint balance, end of 2031 | 25,000 |

Exact dollars at zero inflation and returns: absolute tolerance 0.005.

## Wrong readings

- Reading the first-listed person's wages: Pat earns nothing, so the account would take nothing at all, 0 in every year.
- Reading the first-listed person's life: contributions would stop after 2028, leaving 18,000 at the end of 2033.
- Adding a wage test to a joint schedule: a schedule has none outside an employer plan, and in case B the household has no wages, so the account would take nothing, 0 in every year, where it takes 25,000 by 2030.
- Stopping the schedule when the person it names dies: case B would stop after 2028, leaving 15,000 at the end of 2030.

## Family

outputs: none.

feeds: `year-result-contributions`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from decision D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R3 (evidence/people-order-check.md). Implemented by the same session. Reviewed by: unreviewed.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`): the worksheet had no scheduled case, so it could not derive the record's schedule branch or tell it from a schedule with a wage test. Case B adds one, with no household wages and the named person's death inside the schedule, and the evidence test pins it. Case A is unchanged. Revised by claude (opus 5.5), who checked the engine agrees after deriving the case; unreviewed until the reviewer checks the revision.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
