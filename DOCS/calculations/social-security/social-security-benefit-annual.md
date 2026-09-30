## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.incomes.socialSecurity / socialSecurityStreams`, composed by `socialSecurity/householdYear.ts#socialSecurityYear` (which `projection/internal/annualSocialSecurity.ts#annualSocialSecurity` calls, and the Social Security analysis models share), sums each living person's own benefit `PIA × claim-age factor × payable months × COLA factor × haircut factor`; a larger marital candidate replaces the running amount. The earnings test then charges each working person's excess earnings month by month from January to months before the person's full-retirement-age month: a worker's first against the family benefit on his record (his benefit and the spouse benefit on it, a partial month shared two to one on the benefits before any reduction), then each person's own against what is left of that person's benefits. Each month withheld in a benefit's reduction period raises that benefit from its full-retirement-age month. This formula is stated by the `YearIncomes.socialSecurity` comment.

## Justification

The cases isolate own-benefit timing, current-spouse replacement, and the earnings test: below full retirement age for one person; the family charge, a worker's excess against his spouse's benefit on his record (42 U.S.C. 403(b)(1); 20 CFR 404.434(b), 404.439, 404.440); her own excess against what is left of her benefits after his (403(b)(1); POMS RS 02501.150 A.1); and the adjustment at full retirement age, which counts only months of the reduction period and takes effect in the full-retirement-age month (42 U.S.C. 402(q)(7); 20 CFR 404.412(b)). The published 2026 constants are `earningsTestBelowFraAnnual = $24,480` and `earningsTestFraYearAnnual = $65,160`.

Rounding: the excess earnings are reduced to the next lower dollar (42 U.S.C. 403(f)(3)). Benefits and the partial-month shares are not rounded: 20 CFR 404.304(f) reduces each monthly benefit, after all deductions, "to the next lower multiple of $1", and the ledger does not, so a month can be up to a dollar above SSA's.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Own-benefit birth year / FRA | 1960 / 67y0m | year / age |
| Own-benefit claim age / months before FRA | 64y3m / 33 | age / months |
| Own-benefit PIA / derived claim factor | 2,000 / 49/60 | dollars/month / ratio |
| Claim-year payable months (`12 - 3`) | 9 | months |
| Claim-year COLA / haircut factors | 1 / 0.95 | ratios |
| Later-year payable months | 12 | months |
| Later-year COLA / haircut factors | 1.06 / 0.95 | ratios |
| Higher/lower PIA in spouse case | 2,000 / 300 | dollars/month |
| Both spouse-case claim and spousal factors | 1 | ratios |
| Family-maximum cap | nonbinding | condition |
| Earnings-test gross benefit / wages | 24,000 / 34,480 | dollars/year |
| Family charge (E5): W born / PIA / claim | 1964-01-15 / 2,000 / 62y0m | date / dollars/month / age |
| Family charge (E5): S born / PIA / claim | 1964-01-20 / 400 / 62y0m | date / dollars/month / age |
| E5: W's wages | 60,000 in 2026 | dollars/year |
| E7b: E5 with S's wages too | 36,000 in 2026 | dollars/year |
| E1: born / PIA / claim / wages | 1964-03-10 / 2,000 / 62y0m / 40,000 in 2026 | date / dollars/month / age / dollars/year |
| E5, E7b and E1: plan start / inflation | 2026 / 0 | year / percent |

## Arithmetic

For a person born in 1960, the FRA rule gives `67y0m`. Claiming at `64y3m` is `33` months early, all within the first 36 months, so the early-claim factor is `1 - 33 × (5/9 of 1%) = 1 - 11/60 = 49/60`. The claim age has three months, so the claim year pays `12 - 3 = 9` months. Own claim year: `$2,000 × 49/60 × 9 × 1 × 0.95 = $13,965`. Later year: `$2,000 × 49/60 × 12 × 1.06 × 0.95 = $19,737.20`.

Two-person case: higher earner own amount `= $2,000/month`. Lower earner own amount `= $300/month`, her PIA, since she claims at FRA. The auxiliary excess is half the higher PIA less her own PIA, reduced by the spousal factor (the `dual-entitlement-composition` record): `max(0, 0.5 × $2,000 - $300) × 1 = $700/month`, and the family-maximum cap is nonbinding. The lower earner's spousal candidate is her own benefit, held at her PIA, plus the excess, `min($300, $300) + $700 = $1,000/month`; because `$1,000 > $300`, it replaces the lower running amount. Annual household benefit `= ($2,000 + $1,000) × 12 = $36,000`.

Below-FRA earnings-test case: withholding `= max(0, ($34,480 - $24,480) / 2) = $5,000`, below the `$24,000` benefit cap; paid benefit `= $24,000 - $5,000 = $19,000`. In an FRA year the stated alternate calculation uses the `$65,160` limit and divides excess wages by 3.

**Family charge (E5).** Both are born in January 1964: full retirement age 67, in January 2031, and a claim at 62 is 60 months early and entitled from January 2026, so every month of 2026 is in both reduction periods. W's own benefit is 0.70 × 2,000 = 1,400 a month. S's own is 0.70 × 400 = 280, and her spouse part is (1,000 − 400) × 0.65 = 390 (the spouse factor at 60 months early), 670 in all; the family maximum does not bind. W's excess is floor((60,000 − 24,480)/2) = 17,760. It is charged against the family benefit on his record, 1,400 + 390 = 1,790 a month; S's own 280 is on her record and is not. January to September take 9 × 1,790 = 16,110; October takes the last 1,650, leaving 140 to be paid, shared in proportion to the benefits before any reduction, his PIA 2,000 to half of it 1,000: W 93.33 and S 46.67, each within the month's benefit. W is paid 93.33 + 2 × 1,400 = 2,893.33 and S 12 × 280 + 46.67 + 2 × 390 = 4,186.67. January to October are crediting months on W's own benefit and S's spouse benefit, 10 each. From January 2031 W is paid 50 months early, 1 − 36 × 5/9% − 14 × 5/12% = 0.741667, 1,483.33 a month, 17,800 a year; S is paid 280 + 600 × 0.691667 = 695, 8,340.

**Her own excess after his (E7b).** E5 with S's wages of 36,000 too. W's charge is as in E5. Her excess, floor((36,000 − 24,480)/2) = 5,760, is then charged against what is left of her benefits: her own 280 in January to September (2,520), 326.67 in October, 670 in November and December; that is 4,186.67, less than 5,760, so she is paid nothing. Every month withheld her own benefit and her spouse benefit, 12 crediting months on each: from January 2031 she is paid 400 × 0.75 + 600 × 0.70 = 720 a month, 8,640. W is paid 2,893.33, as in E5.

**The adjustment from the full-retirement-age month (E1).** Born 1964-03-10: full retirement age 67 in March 2031; the claim at 62 is entitled from March 2026, but the claim-year convention pays all of 2026 (`social-security-payable-months`), 1,400 a month. January and February are paid before the first month of entitlement, so no excess can be charged to them (42 U.S.C. 403(f)(1)(A)). Her excess, floor((40,000 − 24,480)/2) = 7,760, takes March to July (7,000) and 760 of August, so she is paid 16,800 − 7,760 = 9,040, and the six months charged are all in the reduction period: 6 crediting months. From March 2031 she is paid 54 months early, 1 − 36 × 5/9% − 18 × 5/12% = 0.725, 1,450 a month: 2031 pays 2 × 1,400 + 10 × 1,450 = 17,300, and 2032 pays 17,400.

## Expected

| Case | Expected |
|---|---:|
| Own claim year, 2024 | 13,965.00 |
| Later year, 2025 | 19,737.20 |
| Two-person case, 2027 | 36,000.00 |
| Below-FRA paid, 2026 | 19,000.00 |
| Below-FRA withheld, 2026 | 5,000.00 |
| E5 W paid, 2026 | 2,893.33 |
| E5 S paid, 2026 | 4,186.67 |
| E5 W paid, 2031 | 17,800.00 |
| E5 S paid, 2031 | 8,340.00 |
| E7b W paid, 2026 | 2,893.33 |
| E7b S paid, 2026 | 0.00 |
| E7b S paid, 2031 | 8,640.00 |
| E1 paid, 2026 | 9,040.00 |
| E1 paid, 2031 | 17,300.00 |
| E1 paid, 2032 | 17,400.00 |

Each E-case figure is a person's published Social Security for the year, the sum of the person's stream rows, to the cent.

Exact values: own claim year `$13,965`; later year `$19,737.20`; two-person case `$36,000`; below-FRA case `$19,000` paid and `$5,000` withheld. Fixture tolerance: absolute `$0.005`, because dollar figures use binary floating point.

## Wrong readings

- Holding the old `0.8` factor beside nine payable months combines incompatible claim ages: `0.8` is exactly 36 months early, whose claim-age month is zero and therefore pays 12 months in the claim year, while nine payable months here come from `64y3m` and its `49/60` factor.
- Treating the `$700` auxiliary excess as the whole spousal candidate gives `($2,000 + $700) × 12 = $32,400`; the candidate includes the lower earner's `$300` own benefit and is `$1,000/month`, producing `$36,000`.
- Dividing below-FRA excess wages by 3 gives withholding `$3,333.33` and paid benefit `$20,666.67`; `/3` belongs to the FRA-year branch, not the below-FRA branch.
- Charging a worker's excess against his own benefit only (the ledger until D-SS-ANALYSIS-EARNINGS-TEST): E5's W is paid 0 and S 8,040 in 2026, and from 2031 W 18,000 and S 8,040.
- Sparing her own old-age benefit in the months his excess took her spouse benefit: E7b's S is paid 2,520 in 2026. POMS RS 02501.150 A.1 charges her excess against her own benefit "without regard to the other NH's excess earnings".
- Leaving his charge out when hers is made (the ledger until D-SS-ANALYSIS-EARNINGS-TEST): E7b's S is paid 8,040 − 5,760 = 2,280.
- The adjustment from January of the full-retirement-age year: E1 pays 17,400 in 2031, not 17,300.
- Charging the months of the claim year that the convention pays before the entitlement month, and crediting none of them (the engine from the first restatement until the implementation review): E1's excess takes January to May and 760 of June, only March to June are credited, and 2031 pays 17,133.33, 17,200 after. 42 U.S.C. 403(f)(1)(A) charges no month "for which such individual was not entitled to a benefit".

## Family

outputs: `social-security-benefit-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Originally reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)"). Restated by: claude (opus 5.5), 2026-09-27, under decision D-SS-LAW-2: the two-person case's excess is now the dual-entitlement composition's (half the higher PIA less the claimant's own PIA, times the spousal factor, where it was the spousal amount less the own monthly benefit); at an FRA claim the two agree, so no figure changed. Reviewed by: not yet reviewed since the restatement.

Restated by: claude (opus 5.5), 2026-09-29, under decision D-SS-ANALYSIS-EARNINGS-TEST: the year is composed month by month and the earnings test is charged month by month, so the family-charge cases E5 and E7b and the adjustment case E1 are added, each the decision derivation's case of that name, by hand as above (E1 with the independent check's correction that only months of the reduction period are credited). A second claude (opus 5.5) instance reproduced them with its own model; that is the same model family, so not the catalog's review. The first five figures do not change. Revised the same day after the implementation review (a third claude instance, same family; its finding F1): no month before the first month of entitlement is charged (403(f)(1)(A)), so E1 is 17,300 in 2031 and 17,400 after, the derivation's figures, where the first restatement had 17,133.33 and 17,200. Reviewed by: not yet reviewed since the restatement.

Revision: The first derivation treated the spousal excess as the whole candidate and paired a `0.8` claim factor with an incompatible nine-month claim year; the implementation's fixture found both errors.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-3-after-769.md`.
