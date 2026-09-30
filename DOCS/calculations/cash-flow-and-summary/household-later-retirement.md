## Claim

Kind: model. `projection/householdRetirement.ts#householdRetirement` gives the household's later retirement, the one rule the FI figures (`projection-summary-fi-spending-base`), Coast-FIRE, the pre-retirement savings rate and the funded ratio (`funded-ratio-household-start`) share (decision D-PEOPLE-ORDER; the independent review's M4 and N3). `personRetirement` gives each person's retirement year, the first year without their work, and the rule that gave it:

- `retirementAge`: the ISO birth year plus the retirement age;
- `wagesPastRetirementAge`, for a person with a retirement age whose wages the plan pays past it: the year after the last year a wage stream of theirs pays, when that is later than the retirement age's year;
- `wagesEnd`, for a person with no retirement age: the year after the last year a wage stream of theirs pays, when that last year is the start year or later;
- `startYear`, for a person with no retirement age and no wages in the plan from the start year on: the start year.

A wage stream (one with gross pay above 0) pays while the person is younger than its stop age, the stream's end age if it has one, else the retirement age, the rule `projection/internal/wageIncomeStreams.ts` pays by (`stopAge = endAge ?? retirementAge`): its last year is `birthYear + stopAge - 1`, else, with neither age, the person's last year alive (birth year plus planning age), and never after that year. So a person with a retirement age retires in the later of that age's year and the first year without wages.

A person retires in the plan only when they are alive in `max(year, startYear)`, the year a figure would be priced on that retirement (`retiresInPlan`). Someone whose wages run through their last year alive works through the plan; a retirement age past the planning age is never reached; a planning age that ended before the start year retires no one. Those people are left out (`notRetiring`, in the canonical people order). The household's later retirement is the latest year among the people who retire in the plan; a tie goes to the older person (the earlier date of birth), then the smaller id by ordinal comparison, so list order never decides it. When nobody retires in the plan there is none: no FI number, Coast-FIRE figure or funded ratio is priced, and nothing is ever priced in a year after the person's death. Every page that shows the year names the person, says which rule applied (`householdRetirementClause`) and names anyone who works through the plan (`notRetiringClause`).

## Justification

The FI figures and the funded ratio both need the year the household stops earning: FI prices that year's outflows, and the funded ratio counts the floor from it, since until then wages carry part of it. A retirement age is the plan's own statement of that year, and it names the first year without wages unless a wage stream's end age runs past it: the engine stops a wage stream at its end age, else at the retirement age, and at neither when both are null (`projection/internal/wageIncomeStreams.ts`), so wages with an end age after the retirement age are still paid, and a year paid wages is a working year. The person's first year without work is then the year after their last wage year, as it is for a person with no retirement age, whose wages the engine never stops at an age. The round-one review of #765 found the retirement age read alone, with such wages still paid in the year FI priced. Pricing the last wage year instead, as the rule did after the review's M4, priced a working year: its outflows include the income tax on that year's wages, a cost that stops the next year, capitalised at the withdrawal rate. The independent review measured two ledger-identical households 76% apart on it (aggressive-saver with wages ending at 45 and no retirement age, $2,660,002, against a retirement age of 45, $1,514,785) and an FI number of $38,930,249 priced in the death year of a person who works until death (N3). Someone who works through the plan never retires in it, so the household's retirement is the other person's, or there is none, and the pages say so instead of pricing a year that is not a retirement. With no wages at all a person has nothing to retire from, and the start year is the honest answer. No statute governs this; it is the program's convention, written once.

## Inputs

Start year 2026. Planning age 90 unless stated.

| Case | People, in list order (birth date; retirement age; wages) |
|---|---|
| 1 | Robin 1962-05-01; 65; none. Pat 1966-02-01; 64; none |
| 2 | Sam 1964-03-01; 66; none. Alex 1960-03-01; 70; none |
| 3 | Sam 1964-09-02, planning age 95; none; wages, no end age. Alex 1962-04-15; 66; none |
| 4 | Lee 1970-01-01; none; wages to end age 60. Chris 1960-01-01; 68; none |
| 5 | Dana 1961-01-01; none; none. Kim 1970-01-01; 61; none |
| 6 | Jo 1964-01-01; none; none (one person) |
| 7 | Max 1950-01-01; none; wages to end age 70 (one person) |
| 8 | Ann 1970-01-01, planning age 80; none; wages to end age 90 (one person) |
| 9 | Bo 1970-01-01, planning age 80; 85; none. Cy 1972-01-01; 63; none |
| 10 | Ed 1966-01-01; none; wages, no end age. Flo 1968-01-01; none; wages, no end age |
| 11 | Gus 1966-01-01; 65; wages to end age 75. Hal 1964-01-01; 68; none |
| 12 | Ivy 1970-01-01; 62; wages to end age 55 (one person) |
| 13 | Jay 1960-01-01, planning age 85; 67; wages to end age 90. Kay 1962-01-01; 66; none |

## Arithmetic

1. Robin 1962 + 65 = 2027; Pat 1966 + 64 = 2030. Later: Pat, 2030, `retirementAge`.
2. Sam 1964 + 66 = 2030; Alex 1960 + 70 = 2030. Tie to the older: Alex, 2030.
3. Sam's wages have no end age, so they pay through Sam's last year alive, 1964 + 95 = 2059; the first year without them, 2060, is after that year, so Sam works through the plan and is left out. Alex 1962 + 66 = 2028. Later: Alex, 2028, `retirementAge`.
4. Lee's wages pay while the attained age is under 60, so the last wage year is 1970 + 60 - 1 = 2029 and the first year without them 2030: `wagesEnd`. Chris 1960 + 68 = 2028. Later: Lee, 2030.
5. Dana has no retirement age and no wages: 2026, `startYear`. Kim 1970 + 61 = 2031. Later: Kim, 2031.
6. Jo: no retirement age, no wages: 2026, `startYear`.
7. Max's last wage year is 1950 + 70 - 1 = 2019, before the start year, so there are no wages from 2026 on: 2026, `startYear`.
8. Ann's wage stream would run to 1970 + 90 - 1 = 2059, but Ann's last year alive is 1970 + 80 = 2050, so the wages run through it: Ann works through the plan, and nobody retires. None.
9. Bo would retire in 1970 + 85 = 2055, after Bo's last year alive, 2050: left out. Cy 1972 + 63 = 2035. Later: Cy, 2035.
10. Ed's wages run through 1966 + 90 = 2056 and Flo's through 2058, each their last year alive: both work through the plan, and nobody retires. None.
11. Gus's retirement age gives 1966 + 65 = 2031, but his wages pay while he is under 75, through 1966 + 75 - 1 = 2040, so the first year without them is 2041, later than 2031: 2041, `wagesPastRetirementAge`. Hal 1964 + 68 = 2032. Later: Gus, 2041.
12. Ivy's wages stop before her retirement age: the last wage year is 1970 + 55 - 1 = 2024, so the first year without them is 2025, earlier than 1970 + 62 = 2032: 2032, `retirementAge`.
13. Jay's retirement age gives 1960 + 67 = 2027, but his wages would pay while he is under 90, to 2049, and his last year alive is 1960 + 85 = 2045, so they run through it: the first year without them, 2046, is after it, and Jay works through the plan (`wagesPastRetirementAge`, left out). Kay 1962 + 66 = 2028. Later: Kay, 2028.

Each case gives the same answer with the people listed the other way round.

## Expected

| Quantity | Value |
|---|---:|
| Case 1 year | 2030 |
| Case 2 year | 2030 |
| Case 3 year | 2028 |
| Case 4 year | 2030 |
| Case 5 year | 2031 |
| Case 6 year | 2026 |
| Case 7 year | 2026 |
| Case 8 year | none |
| Case 9 year | 2035 |
| Case 10 year | none |
| Case 11 year | 2041 |
| Case 12 year | 2032 |
| Case 13 year | 2028 |

Named person and rule: 1 Pat, `retirementAge`; 2 Alex, `retirementAge`; 3 Alex, `retirementAge`, with Sam working through the plan; 4 Lee, `wagesEnd`; 5 Kim, `retirementAge`; 6 Jo, `startYear`; 7 Max, `startYear`; 8 none, Ann working through the plan; 9 Cy, `retirementAge`, with Bo's retirement age after Bo's planning age; 10 none, Ed and Flo working through the plan; 11 Gus, `wagesPastRetirementAge`; 12 Ivy, `retirementAge`; 13 Kay, `retirementAge`, with Jay working through the plan. Exact integers.

## Wrong readings

- A missing retirement age read as 65, the FI figures' rule before the review: case 3 names Sam in 1964 + 65 = 2029, a year Sam still works; case 6 prices 2029 for a person with nothing to retire from.
- A missing retirement age read as the start year, the funded ratio's rule before the review: case 3 names Alex in 2028 but says nothing of Sam's wages.
- The last wage year, the rule after the review's M4: case 4 gives 2029, a year Lee is still paid, and case 3 names Sam in 2059, Sam's death year, with that year's wages and their income tax in the priced outflows; case 8 prices 2050.
- The year after the last wage kept for a person who works until death: case 3 gives 2060, after Sam's death.
- The first-listed person's retirement: case 1 gives 2027 (Robin).
- A retirement age read alone, whatever the wages, the rule until the round-one review of #765: case 11 gives Hal's 2032, a year Gus is still paid wages, and case 13 says Jay retires in 2027 though his wages run until his death.
- The first year without wages alone, ignoring the retirement age: case 12 gives 2025, seven years before Ivy's retirement age.

## Limits

- A convention, not a statute. A retirement age is the first year without wages unless a wage stream's end age runs past it, and then the wages decide; wages that stop before the retirement age leave the retirement age's year. A person who never stops earning is said to work through the plan rather than given a year.
- A person who retires after the other person's planning age has ended still sets the household's retirement: the priced year is one they are alive in, whether or not their partner is.
- Wages are the plan's only earned income; the rule reads the plan's wage streams and planning ages, not a Monte Carlo path's sampled death.

## Family

outputs: none. feeds: `projection-summary-fi-number`, `projection-summary-fi-age`, `projection-summary-coast-fire-number`, `projection-summary-fi-year`, `projection-summary-average-pre-retirement-savings-rate-pct`, and the four `funded-ratio-result-*` families.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, for the independent review's finding M4 and the coordinator's rule for a missing retirement age. Reviewed by: unreviewed.

Revision later on 2026-09-28 (the independent review's N3, with the coordinator's rule): a person with no retirement age retires in the first year without wages, not the last year with them; a person who works through the plan is left out, and with nobody retiring nothing is priced. Cases 3, 4 and 8 change; cases 9 and 10 are added. Revised by claude (Opus 5.5). Reviewed by: unreviewed.

Revision 2026-09-29 (round-one review of #765, issues 1 and 3, with the coordinator's rule): a person with a retirement age retires in the later of that age's year and the first year without wages, since a wage stream with an end age past the retirement age is still paid; new rule `wagesPastRetirementAge`; cases 11 to 13 added, cases 1 to 10 unchanged. Revised by claude (Opus 5.5). Reviewed by: unreviewed.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`): the record's formula gave a person with no paying wage stream the retirement age's year as their last wage year, so its `max` added a year (case 1 would read 2028 and 2031). It now says what `projection/householdRetirement.ts#personRetirement` does: with no paying wage stream there is no last wage year, a retirement age gives birth year plus that age (case 1: Robin 1962 + 65 = 2027, Pat 1966 + 64 = 2030, the household 2030, as above), and without one the start year. No figure here changes. Revised by claude (opus 5.5); unreviewed until the reviewer checks the revision.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
