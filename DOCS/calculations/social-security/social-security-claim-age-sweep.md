## Claim

Kind: model. `decisions/claimAgeSweep.ts#sweepClaimAges` is the Social Security page's whole-plan claim-age sweep (the In your plan tab). For a plan whose Social Security claims are still choices, it runs every whole-year combination of claim ages through the full ledger, ranks the rows by the chosen objective policy, and publishes the signed change in ending after-tax estate of the winning claim against the plan as entered.

- **Open claims.** `socialSecurity/openClaims.ts#openClaims` takes the first two Social Security streams with a positive entered PIA or an earnings history, and splits them by `#isClaimAlreadyMade` (`social-security-claim-already-made`): a claim whose claim year, the birth year plus the claim age's whole years, is before the start year is already made. An already-made claim keeps its own claim age in every row. An open claim paid as a disability benefit from its onset (`socialSecurity/analysis/expectedValue.ts#disabilityReplacesClaimAge`) is held the same way, as the ledger pays it, since a claim age does not start it (`decisions/generators.ts#claimAgeGridClaims`); the other open claims are swept.
- **Grid.** Each open claim's person gets `#gridClaimAges`: 62 to 70, none below the age reached in the start year (`decisions/generators.ts#socialSecurityClaimGridGenerator` builds one candidate per combination, 9 for one open claim, up to 81 for two).
- **Ranking.** Each row is priced by `decisions/evaluateCandidate.ts#evaluateCandidate` against the plan as entered and ranked by `decisions/tournament.ts#rankEvaluations` under the objective policy with a margin of 0: eligible rows first, by the policy's primary metric, then its tie-breaker. The winner is the first eligible row whose primary metric is above 0.
- **Verdict** (`#claimAgeSweepVerdict`, after the refusals). `empty` with no claim stream; `already-claimed` when every claim is already made; `disability` when every open claim is paid as a disability benefit from its onset, so none is left to sweep (the held ones are published as `disabilityPersonIds` in every verdict); `winner` when there is a winner; otherwise `aca-unpriced` when no row is eligible and the plan as entered has a year whose premium tax credit cannot be priced (`#unpricedAcaYears`: each such year with its blocking support codes), `ineligible` when no row is eligible and there is no such year, `flat` when at least two eligible rows all lie within 0.5 of the first eligible row, and `current-best` otherwise.
- **The figure.** `winnerEstateChangeVsCurrent` is the winner's ending after-tax estate minus the plan as entered's (the decision context's baseline run, claim months included), signed and unrounded, in nominal dollars of the plan's last year (published as `estateYear`). Each row carries the same change (`estateChangeVsCurrent`), and is `isCurrent` only when every open claim of the plan is a whole year equal to the row's.
- **What each row was ranked on.** Bridge durability and survivor liquidity rank on the change in the lowest investable balance over the bridge or survivor years and fall back to the estate change when the row or the plan as entered has none; `rankedOn` says which, and which side lacked the years (`decisions/objectives.ts#rankedMetricBasis`): `objective`, `estate-fallback-plan` when the plan as entered has none (then every row falls back), `estate-fallback-row` when the plan has them and the row does not.

Revision 2026-09-28 (the review of slice 5): a disability benefit is held and the other claim ranked, where the first cut refused the couple and gave a reason ("the couple's benefits are priced together") that does not stop the ledger (L5); and `rankedOn` names the side that lacked the years, where the first cut's single `estate-fallback` let the page say "this claim age leaves no bridge years" when the plan as entered had none (L1).

New 2026-09-28 (B2-P1 slice 5, owner decision R12 and the 2026-09-25 rule). Until then planner-ui's `ssAnalysis.ts#sweepClaimingStrategies` ran the same grid with no already-claimed test, the page subtracted the whole-year row with the plan's claim years from the winner and printed a "+" before any result ("+−$68k"), and every refusal read "No claim age meets this ranking's constraints".

## Justification

- The grid's bounds are the registered claim window, `usc-42-402-worker-claim-window-62-to-70`: 42 U.S.C. 402(a), an individual who "(2) has attained age 62, and (3) has filed application for old-age insurance benefits ... shall be entitled", and 402(w)(2)(A), increment months only "prior to the month in which such individual attained age 70".
- A claim already made is not a choice. Entitlement follows the application (402(a)), and 20 CFR 404.621(a)(3): "If the effect of the payment of benefits for a month before the month you file would be to reduce your benefits because of your age, you cannot be entitled to old-age ... benefits for any month before the month in which your application is filed"; (a)(2) limits other retroactivity to six months. Undoing a claim takes a withdrawal of the application "within 12 months of the first month of entitlement" with every benefit repaid (20 CFR 404.640(b)(3), (b)(4)), or a voluntary suspension by an individual who "has attained retirement age ... and is entitled" (42 U.S.C. 402(z)(1)(A)); the ledger models neither. The test is the ledger's own annual convention: `projection/internal/annualSocialSecurity.ts#annualSocialSecurityPayableMonths` pays 12 months in every year whose attained age exceeds the claim years, so a claim year before the start year is already being paid in the plan's first year. Claim year before the start year is the same as claim years below the age reached in the start year.
- The refusal on an unpriced credit: a claim age changes the income the premium tax credit depends on, since 26 U.S.C. 36B(d)(2)(B)(iii) adds to modified adjusted gross income "the portion of the taxpayer's social security benefits (as defined in section 86(d)) which is not included in gross income". Where the ledger cannot price the credit (a year with `aca.readiness` 'nonActionable'), `evaluateCandidate` makes every row diagnostic. Ranking only the rows that leave that income unchanged was measured on the example plans and is not safe in either direction: an equal $10,000-a-year stand-in credit changed three of eleven such winners and turned two refusals into winners (evidence/b2p1-slice5-derivation.md, open question 2; the independent check reproduced it). The decision of 2026-09-25 is to refuse and to name each year with its own reason. The page says why in those terms: all Social Security counts in that income in the years it is paid, so an unpriced credit could change which claim age comes out ahead, in either direction (not "a claim age changes the income", which is untrue of the rows that pay nothing in those years).
- No statute governs the objective or the search: rule 2 (the record says what the code does) and rule 3 (a model does what its name says). A change is a signed number (R12); "current" is the plan as entered, which the ranking itself compares with.

## Inputs

Ranking cases (S-F), each a set of rows under the after-tax-estate objective, margin 0, with the estate change against the plan as entered as the primary metric; "diagnostic" marks a row the evaluator refused:

| Case | Rows (claim age: estate change) |
|---|---|
| S-F1 | 62: −40,000; 67: 0; 70: +25,000; 69: +30,000, diagnostic |
| S-F2 | 62: +0.2; 67: 0; 70: −0.1 |
| S-F3 | 67: −0.4; 70: 0 |
| S-F4 | 67: 0, diagnostic; 70: +12,000, diagnostic; the plan has one unpriced credit year |
| S-F5 | as S-F4 with no unpriced credit year |
| S-F6 | 67: 0; 70: −3 |

Claim years (S-G), start year 2026: births in 1953 claiming at 67 and 70, 1955 claiming at 67, 1962 claiming at 70, 1964 claiming at 62, and the co-optimization's canonical 62 for a 1962 birth.

Constructed plans (start year 2026, the federal calculator):

- S-E: one person born 1964-06-15, planning age 92, $900,000 in a taxable account, $45,000 of spending, 2% inflation, 5% returns, a PIA of $2,500 claimed at 67y6m.
- S-H: one person born 1966-06-15 (65 in June 2031), planning age 90, $300,000 cash, $40,000 a year of ordinary income, a PIA of $2,500 claimed at 67, Marketplace coverage before Medicare with a premium tax credit contract for 2026, 2027 and 2028 only.
- S-I: as S-E born 1953-06-15 claiming at 67 (2020); S-J: as S-E with a disability onset at 55.

## Arithmetic

**S-F1.** Eligible rows first, by estate change: 70 (+25,000), 67 (0), 62 (−40,000), then the diagnostic 69 (+30,000). The winner is the first eligible row above 0: 70.

**S-F2.** Margin 0: 62's +0.2 is above 0, so 62 wins, though the plan's own 67 is within a dollar; flatness is read only when there is no winner.

**S-F3.** No row is above 0 (70's 0 is not). Two eligible rows, both within 0.5 of the first (0 and −0.4): flat.

**S-F4, S-F5.** No eligible row: with an unpriced credit year the verdict is aca-unpriced, without one ineligible.

**S-F6.** No winner, two eligible rows 3 apart: current-best.

**S-G.** 1953 + 67 = 2020 and 1953 + 70 = 2023, 1955 + 67 = 2022: before 2026, already made. 1962 + 70 = 2032 and 1964 + 62 = 2026: open (a claim in the start year is open, whatever its month). The canonical 62 for a 1962 birth is 2024: not offered.

**S-E (the plan's own months).** The plan claims at 67y6m. No grid row is 67y6m, so no row is current, and the change is measured from the plan as entered: winner estate minus the baseline estate, exactly the row's `estateChangeVsCurrent`.

**S-H (unpriced credit, each year with its own reasons).** The 2026 and 2027 coverage years have published figures and a contract, and $40,000 of income keeps the household above the poverty line in both, so they are priced. 2028's applicable-percentage table is not published: unpriced, for that one reason, `tax-year-parameters-unsupported`. 2029, 2030 and 2031 (Marketplace months until the Medicare month) have neither published figures nor a contract: two reasons each, `tax-year-parameters-unsupported` and `missing-year-contract`. Every row is diagnostic, and the verdict is aca-unpriced with the rows still published.

**S-I, S-J.** Every claim made in 2020: already-claimed, no row. A disability benefit from onset 55 (before full retirement age): disability, no row.

## Expected

| Case | Expected |
|---|---|
| S-F1 ranked order | 70, 67, 62, 69 |
| S-F1 winner | 70 |
| S-F2 winner | 62 |
| S-F3 verdict | flat |
| S-F4 verdict | aca-unpriced |
| S-F5 verdict | ineligible |
| S-F6 verdict | current-best |
| S-G 1953 at 67 | 2020 |
| S-G 1953 at 70 | 2023 |
| S-G 1955 at 67 | 2022 |
| S-G 1962 at 70 | 2032 |
| S-G 1964 at 62 | 2026 |
| S-G 1962 canonical 62 | 2024 |
| S-E current rows | 0 |
| S-H unpriced years | 2028, 2029, 2030, 2031 |
| S-H 2028 reasons | tax-year-parameters-unsupported |
| S-H 2029 reasons | tax-year-parameters-unsupported, missing-year-contract |
| S-I verdict | already-claimed |
| S-I claim year | 2020 |
| S-J verdict | disability |

Tolerance: exact. The change on S-E is `Object.is` the subtraction of the two published estates.

## Wrong readings

- Prefixing "+" to a formatted change (the retired page's "+−$68k" in the positive colour, and "+$0").
- Taking "current" to be the whole-year row with the plan's claim years: a plan claiming at 67y6m was compared with 67y0m, and a 67y0m winner was called "your current choice".
- Treating a claim year before the start year as a choice (the bracket-fill couple, who claimed in 2020 and 2022, was told to "claim at 70 / 70"), or a claim in the start year as made (S-G's 1964 birth at 62).
- Reading an all-diagnostic sweep as "no claim age meets this ranking's constraints", or naming every unpriced year as not yet published (four example plans have 2026 or 2027 years refused for a guardrail interaction, income below the poverty line or a non-converging fixed point).
- Ranking only the rows whose credit income is unchanged, as if that were safe.
- Refusing a couple because one claim is a disability benefit: the ledger holds that benefit whatever the other claim, so the other claim can be ranked.
- Blaming a claim age for the fallback when the plan as entered has no bridge years: born 1964-06-15 claiming at 62y0m from 2026, every row falls back because the plan has none, though claiming at 63 to 70 would leave 1 to 8.
- Reading the change as today's dollars: it is nominal at the plan's last year.

## Family

outputs: `social-security-claiming-sweep-objective`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (evidence/b2p1-slice5-derivation.md, worksheet `social-security-claiming-sweep-objective.md`: cases S-F, S-G and S-E by hand), with the independent check's corrections C2 (each unpriced year with its reason), C5 (one test for every search), C7 (the ranked metric per row) and C10 (the limits). Cases S-H, S-I and S-J are the implementation's, the S-H year by the published-figures fact. Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
