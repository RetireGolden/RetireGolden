## Claim

Kind: model. `ladder/fundedRatio.ts#fundedRatioStart` gives the first year the funded ratio counts: the household's later retirement, never before the projection's start year, and names the person whose retirement that is (decision D-PEOPLE-ORDER). The year is the household's later retirement, the one rule the FI figures use (`household-later-retirement`): a retirement age gives ISO birth year plus that age, or the first year without that person's wages when a wage stream's end age keeps paying past it; a person with no retirement age retires in the first year without their wages, else in the start year; a person who never retires in the plan (wages through their last year alive) is left out; on a tie the older person is named, then the smaller id by ordinal comparison. When nobody retires in the plan there is no counting year: wages carry the floor throughout, no ratio is counted, the card says so and the insight does not fire. The funded-ratio card (Income floor and Results) and the `income-floor-funded` insight pass this year to `computeFundedRatio` (record `funded-ratio-hand-present-value`) and, for a couple, name the person and call the ratio the household's. Listing the people the other way round changes nothing.

## Justification

The funded ratio values the essential floor the portfolio must carry once wages stop, against guaranteed income. In a couple, wages carry part of the floor until the last person's wages stop, so the household's floor becomes the ratio's from the later retirement. No statute governs this; it is the program's convention, and it reads the facts (each person's retirement year) rather than list position. Before the decision the card and the insight counted from the retirement of whoever was listed first. For one person the year is that person's retirement year, as before.

## Inputs

| Case | People, in list order (birth date, retirement age) | Start year |
|---|---|---:|
| 1 | Robin 1962-05-01, 65; Pat 1966-02-01, 64 | 2026 |
| 2 | Sam 1964-03-01, 66; Alex 1960-03-01, 70 | 2026 |
| 3 | Chris 1958-01-01, 60; Lee 1955-01-01, 65 | 2026 |
| 4 | Dana 1961-01-01, no retirement age; Kim 1970-01-01, 61 | 2026 |
| 5 | Jo 1964-01-01, no retirement age (one person) | 2026 |
| 6 | Ann 1970-01-01, no retirement age, wages with no end age (one person) | 2026 |
| 7 | Sam 1964-09-02, no retirement age, wages with no end age; Alex 1962-04-15, 66 | 2026 |
| 8 | Gus 1966-01-01, 65, wages to end age 75 (one person) | 2026 |

Planning age 90 for everyone.

## Arithmetic

1. Robin retires in 1962 + 65 = 2027 and Pat in 1966 + 64 = 2030. The later is Pat's 2030, after the start year: count from 2030, Pat.
2. Sam 1964 + 66 = 2030 and Alex 1960 + 70 = 2030 tie; the older is Alex (1960): count from 2030, Alex.
3. Chris 1958 + 60 = 2018 and Lee 1955 + 65 = 2020. The later is Lee's 2020, before the start year: count from max(2020, 2026) = 2026; the person is Lee, retirement year 2020.
4. Dana has no retirement age, so counts as retired at 2026; Kim 1970 + 61 = 2031. Count from 2031, Kim.
5. Jo has no retirement age: 2026, Jo, as before the decision.
6. Ann's wages run through Ann's last year alive, 1970 + 90 = 2060, so Ann works through the plan and nobody retires: no counting year.
7. Sam's wages run through Sam's last year alive, 1964 + 90 = 2054: Sam works through the plan and is left out. Alex 1962 + 66 = 2028: count from 2028, Alex.
8. Gus's retirement age gives 1966 + 65 = 2031, but his wages pay while he is under 75, through 1966 + 75 - 1 = 2040, and carry the floor until then: count from 2041, the first year without them, Gus.

Each case gives the same answer with the people listed the other way round.

## Expected

| Quantity | Value |
|---|---:|
| Case 1 counting year | 2030 |
| Case 2 counting year | 2030 |
| Case 3 counting year | 2026 |
| Case 3 retirement year | 2020 |
| Case 4 counting year | 2031 |
| Case 5 counting year | 2026 |
| Case 6 counting year | none |
| Case 7 counting year | 2028 |
| Case 8 counting year | 2041 |

Named person: case 1 Pat, case 2 Alex, case 3 Lee, case 4 Kim, case 5 Jo, case 6 none, case 7 Alex, case 8 Gus. Exact integers.

## Wrong readings

- The first-listed person's retirement, the rule before the decision: case 1 counts from 2027 (Robin), case 2 from 2030 but names Sam, case 4 from 2026 (Dana).
- The earlier retirement: case 1 2027, case 3 still 2026 but names Chris, case 4 2026.
- Reading a missing retirement age as 65, the FI figures' rule before the review: case 4 still 2031, but case 5 would count from 1964 + 65 = 2029 for a person with nothing to retire from.
- The last wage year, the rule after the review's M4: case 6 counts from 2060, Ann's death year, while Ann's wages still carry the floor; case 7 counts from 2054 on Sam.
- The retirement age read alone, the rule until the round-one review of #765: case 8 counts from 2031 while Gus's wages carry the floor to 2040.

## Limits

- A convention, not a statute: the floor is counted from the first year without the last earner's wages, so a couple with one person retired and one working shows the ratio from the later retirement. A wage stream's end age past a retirement age counts as wages until it ends.
- A missing retirement age means the first year without that person's wages, else the start year, and a person who works through the plan is left out, the rule the FI figures use (`household-later-retirement`, the independent review's M4 and N3). Until the review the card and the insight counted such a person from the start year even while their wages ran on, and the FI figures read them as retiring at 65; on one plan the two named different people as "the later of your two retirements".

## Family

outputs: none. feeds: `funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, for decision D-PEOPLE-ORDER on the coordinator's review of the implementation (the funded-ratio card must not read the first-listed person). Reviewed by: unreviewed at the time; see the review below.

Revision later on 2026-09-28 (the independent review's N3): cases 6 and 7 added for a person who works through the plan; cases 1 to 5 are unchanged. Revised by claude (Opus 5.5). Reviewed by: unreviewed at the time; see the review below.

Revision 2026-09-28 (independent review M4): the null retirement age follows the shared rule; the claim, a wrong reading and a limit are restated. The five cases are unchanged.

Revision 2026-09-29 (round-one review of #765, issues 1 and 3): a retirement age with wages paid past it counts from the first year without those wages (`household-later-retirement`, rule `wagesPastRetirementAge`); case 8 added, cases 1 to 7 unchanged. Revised by claude (Opus 5.5). Reviewed by: unreviewed at the time; see the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
