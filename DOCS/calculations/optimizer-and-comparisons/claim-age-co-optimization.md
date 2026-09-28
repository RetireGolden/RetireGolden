## Claim

Kind: model. `projection/optimizePlan.ts#ClaimAgeCoOptimization.combinationsEvaluated`, `#ClaimAgeCoOptimization.currentClaimExactEstate`, and `#ClaimAgeCoOptimization.jointExactEstate` are published by `#optimizePlanCoOptimizingClaimAge` as `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, and `claim-age-co-optimization-joint-exact-estate`. The count includes the current claim: `combinationsEvaluated = 1 + generated claim candidates`; the two estate fields are respectively the current-claim exact after-tax estate and the best evaluated `(claim, schedule)` pair's exact after-tax estate.

The middle canonical claim age is the person's own full retirement age from `socialSecurity/nra.ts#fraForBirthYear`, which depends on the birth year (decision `D-CLAIM-AGE-FRA-LABEL`, 2026-09-25).

The search first decides its `outcome` (B2-P1 slice 5, decided 2026-09-25): `already-claimed` when every one of the first two Social Security streams was claimed before the start year (`socialSecurity/openClaims.ts#isClaimAlreadyMade`: birth year plus claim years before the start year; the claims are published as `alreadyClaimed`); `aca-unpriced` when the plan as entered has a year whose premium tax credit cannot be priced (published as `unpricedAca`, each year with its blocking support codes); `no-claims` with no stream; `no-age-left` when a claim is open but the generator offers no candidate (every canonical age is the current claim or before the start year); `searched` otherwise. Only a searched outcome prices candidates; every other outcome evaluates the current claim alone, so `combinationsEvaluated = 1`. The generator skips a claim already made (`social-security-claim-already-made`), and a canonical age whose claim year is before the start year.

Revision 2026-09-28 (the review of slice 5, L7): an open claim with no canonical age left to try was `searched` with one combination, and the Optimize card read "1 claim combinations were each fully re-optimized; none beat your current claim ages"; it is `no-age-left` and the card says no claim age was left to try.

## Justification

`decisions/generators.ts#socialSecurityClaimGenerator` visits up to two Social Security streams and the three canonical claim ages that differ from the current claim. It builds `62y0m`, the person's FRA, and `70y0m`. `DEFAULT_CLAIM_SWITCH_MARGIN_DOLLARS = $1,000` says a claim candidate must beat the current-claim optimum by more than that amount to switch.

A claim already made is not a choice (42 U.S.C. 402(a); 20 CFR 404.621(a)(3): an early claim cannot be paid "for any month before the month in which your application is filed"; (a)(2) limits a later one to six months), and a canonical age in the past would be such a claim; the sources and limits are on `social-security-claim-age-sweep`, whose test this search shares. A claim age moves the income the premium tax credit depends on (26 U.S.C. 36B(d)(2)(B)(iii)); where the ledger cannot price the credit, a claim change cannot be priced in either direction, so the search refuses (the claim-age refusal decided 2026-09-25; before it, all five of the example plans' recommendations rested on unpriced years).

## Inputs

All fixtures: one person, $200,000 cash, no traditional balance, zero returns, inflation, state tax and spending, a PIA of $2,600, start year 2026, the federal calculator.

- Open fixture: born 1966-01-01 (60 in 2026, full retirement age 67), claiming at `70y0m`.
- Past-ages fixture: born 1956-01-01 (70 in 2026, full retirement age 66y2m), claiming at `70y0m`.
- January-1 fixture: born 1960-01-01 (full retirement age 66y10m: born on January 1, a person counts as born the year before, 1959), claiming at `67y0m`.
- Already-claimed fixture: born 1950-01-01, claiming at `70y0m` (2020).
- Already-claimed unpriced fixture: the already-claimed fixture with Marketplace coverage contracts for 2026, 2027 and 2028.
- Partly-claimed couple fixture: Pat born 1963-06-15 claiming at `62y0m` (2025) and Sam born 1966-01-01 claiming at `70y0m`, both with PIAs ($2,600 and $1,400), married filing jointly, planning ages 90.
- Unpriced-credit fixture: born 1966-01-01, claiming at `67y0m`, Marketplace coverage with contracts for 2026, 2027 and 2028.
- No-stream fixture: no Social Security streams.
- Current-claim-wins fixture: the open fixture with planning age 95.

## Arithmetic

Open fixture: canonical ages `{62y0m (2028), 67y0m (FRA, 2033), 70y0m}`; remove the current `70y0m`: generated candidates `= 3 − 1 = 2`; `combinationsEvaluated = 1 + 2 = 3`.

Past-ages fixture: canonical ages `{62y0m (2018), 66y2m (FRA, 2022), 70y0m}`; 62 and 66y2m fall before 2026 and the current `70y0m` is skipped: 0 candidates, `combinationsEvaluated = 1`, outcome no-age-left.

January-1 fixture: canonical ages `{62y0m (2022), 66y10m (FRA, 2026), 70y0m (2030)}`; 62 falls before 2026 and the current claim is `67y0m`: 2 candidates, "at 66 and 10 months (FRA)" and "at 70".

Already-claimed unpriced fixture: the claim was made in 2020, so the outcome is already-claimed before the credit is asked about, and `unpricedAca` is empty (it is published only with aca-unpriced).

Partly-claimed couple fixture: Pat's claim is made (1963 + 62 = 2025 < 2026) and held; Sam's canonical ages `{62y0m (2028), 67y0m (FRA, 2033), 70y0m}` less the current 70: 2 candidates, outcome searched, `combinationsEvaluated = 3`, `alreadyClaimed` Pat 2025.

Already-claimed fixture: 1950 + 70 = 2020, before 2026: outcome already-claimed, claim year 2020, `combinationsEvaluated = 1`, no winner.

Unpriced-credit fixture: 2028's figures are not published, so 2028 is unpriced for `tax-year-parameters-unsupported`: outcome aca-unpriced, `combinationsEvaluated = 1`, no winner.

No-stream fixture: generated candidates `= 0`; `combinationsEvaluated = 1 + 0 = 1`.

Current-claim-wins fixture: two candidates, `62y0m` and `67y0m (FRA)`, each with an empty conversion schedule (no traditional balance). A candidate replaces the current claim only when its `jointExactEstate − currentClaimExactEstate > $1,000`. With zero returns and a planning age of 95, claiming at 70 pays 1.24 × 25 = 31 PIA-years, at 67 1.00 × 28 = 28 and at 62 0.70 × 33 = 23.1, so neither candidate clears the margin: `winningClaimLabel = null`, `winningClaimPatch = null`, and `jointExactEstate = currentClaimExactEstate`. The shared dollar value is run-pinned.

## Expected

- `claim-age-co-optimization-combinations-evaluated`: exactly `3` for the open, current-claim-wins and partly-claimed couple fixtures, `1` for the past-ages, already-claimed, unpriced-credit and no-stream fixtures; counts, exact.
- Outcomes: no-age-left for the past-ages fixture, already-claimed with no unpriced year for the already-claimed unpriced fixture, searched for the partly-claimed couple; the January-1 fixture's candidates are "Pat claims Social Security at 66 and 10 months (FRA)" and "Pat claims Social Security at 70".
- `claim-age-co-optimization-current-claim-exact-estate`: run-pinned, no number. Fixture tolerance absolute `$0.005`.
- `claim-age-co-optimization-joint-exact-estate`: run-pinned, and exactly equal to the current-claim estate in the current-claim-wins fixture. Fixture tolerance absolute `$0.005`.
- In the current-claim-wins, already-claimed and unpriced-credit fixtures, `winningClaimLabel` and `winningClaimPatch` are exactly `null`.

## Wrong readings

- Counting the stream's own current `70y0m` age as a generated candidate yields `1 + 3 = 4`, rather than `3`.
- Omitting the current claim from the count yields `2`, rather than `3`; with no stream it yields `0`, rather than `1`.
- Offering a canonical age already passed: the past-ages fixture would price 62 (2018) and 66y2m (2022), claims backdated years before the plan, and count `3`.
- Searching a plan whose every claim is made, or pricing a claim change against an unpriced credit: the example plans' five recommendations were all of this kind (the aggressive saver's "claim at 62", +$193,083.87, started benefits inside its unpriced years).
- Using `67y0m` as the FRA point for every birth year gives a `67y0m (FRA)` candidate for a 1956 birth, whose FRA is `66y2m`.
- Reading the full retirement age from the calendar birth year: the January-1 fixture's FRA would be 67, the current claim, and the "66 and 10 months (FRA)" candidate would be lost; dropping the months from the label names it "66 (FRA)".
- Refusing a couple because one claim is made: the partly-claimed couple's open claim would not be searched (1 combination, not 3).
- Moving a claim already made: the partly-claimed couple's Pat would be offered 67 (FRA) and 70, a claim re-made.
- Switching at a `$1,000` estate advantage treats the threshold as inclusive; the required comparison is more than `$1,000`.

## Family

outputs: `claim-age-co-optimization-combinations-evaluated`, `claim-age-co-optimization-current-claim-exact-estate`, `claim-age-co-optimization-joint-exact-estate`.

feeds: `optimizer-recommended-conversion-annual` through each claim candidate's co-optimized conversion schedule.

## Provenance

Derived by: codex (gpt-5.6-terra), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-twelve.md in this directory. Revision 2026-09-22: the current-claim-wins case was re-derived on the schema fact that planningAge is a whole number of years; the null winner follows from the $1,000 switch margin over two evaluated candidates, not from a planning age past the current claim. Re-derived by codex without executing the engine. Revision 2026-09-25: the middle claim age became the person’s own FRA (decision D-CLAIM-AGE-FRA-LABEL), so the one-stream and current-claim-wins cases name 66y2m for the 1956-01-01 birth; edited by Claude to match the code, with the counts, the null winner and the run-pinned estates unchanged. Revision 2026-09-28 (B2-P1 slice 5): the refusals (a claim already made, an unpriced credit year) and the dropped past canonical ages are the slice 5 derivation's (evidence/b2p1-slice5-derivation.md, problems 4 and 7, with the independent check's C3 and C4); the fixtures were restated by claude (opus 5.5) so the open one has candidates in the future, the old 1956 fixture is now the past-ages case, and the current-claim-wins estate was re-pinned by one run. Reviewed by: not yet reviewed after this revision.
