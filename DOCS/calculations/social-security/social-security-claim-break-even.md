## Claim

Kind: model. `socialSecurity/analysis/breakEven.ts#claimBreakEven` accumulates, for each compared whole-year claim age, the person's own retirement benefit year by year in the plan's own dollars (the start-year PIA × the claim factor × 12 × the ledger's cost-of-living factor for that calendar year × its trust-fund haircut), optionally compounding each year's total at a chosen return, and reports for each pair of claim ages the age at which the later claim's cumulative total first reaches the earlier one's, by linear interpolation between the unrounded annual totals. `#breakEvenClaimAges` gives the page's comparison set: 62, the full-retirement-age year and 70, each no earlier than the age reached in the start year. The COLA factor and the haircut are `socialSecurity/colaFactor.ts#socialSecurityColaFactor` and `#socialSecurityHaircutFactor`, the two functions `projection/simulate.ts#simulatePlan` multiplies every benefit by, so the chart's dollars are the plan's. The Social Security analysis page's Break-even tab prints each crossing rounded to a tenth of a year and each cumulative value to whole dollars.

Each year's benefit is priced by the ledger's own year function (`socialSecurity/householdYear.ts#socialSecurityYear`) for the person's own benefit alone, with the person's wage rows (decision D-SS-ANALYSIS-EARNINGS-TEST, 2026-09-29). Before full retirement age the retirement earnings test withholds part of it, and the months withheld raise it from the full-retirement-age month, counting only months from the claim's first month; `withheldClaimAges` names the claim ages at which anything is withheld, and the page names the person there. Nothing else paid on the person's record is charged. Until that decision the chart paid every benefit in full.

New 2026-09-27 (B2-P1 slice 4, owner decision R6). Until then planner-ui's `socialSecurity/breakEven.ts#computeBreakEven` compounded the cost-of-living adjustment from age 62 on a benefit stated in today's dollars, so its dollars were neither today's nor the plan's, ignored the haircut, and interpolated the crossing on whole-dollar-rounded totals.

## Justification

No statute defines a break-even age; it is a model, so the rule applied is that the model does what its name says, with the dollar basis decided by R6: "re-base on the ledger's convention, so the chart's dollars match the plan's". Two facts bear on it.

- 42 U.S.C. 415(i)(2)(A)(iii) raises a worker's primary insurance amount "(without regard to the time of entitlement to that benefit)" by each cost-of-living increase from the year of eligibility. The ledger already applies every increase through the year before the start to the PIA it pays from (`pia-cost-of-living-since-eligibility`, `social-security-pia-resolution`), and from the start year multiplies by its own factor, 1 in the start year: the plan's inflation factor when the COLA matches inflation, or the fixed COLA compounded from the start year (`social-security-cola-factor`), then the haircut from its year. A benefit computed that way is in each year's own dollars. Compounding a start-year PIA from age 62 instead is too high by (1 + c)^(current age − 62) for someone past 62 and too low by (1 + c)^(62 − current age) for someone younger.
- A whole-year claim age pays twelve months in its first year (`social-security-payable-months`), as the chart does.

Crossings are found on the unrounded totals: a break-even age is where the cumulative benefits cross, not where their displayed roundings do. The crossing ages do not depend on the dollar anchor when every year's benefits share one factor, since a common factor per calendar year multiplies every claim age's benefit; a haircut, which scales later years only, does move them.

## Inputs

| Case | Date of birth | PIA | Claim ages | Plan's dollars | Start | Return | Through age |
|---|---|---:|---|---|---:|---:|---:|
| A | 1964-09-02 (FRA 67) | 1,950 | 62, 67, 70 | COLA matches 2.5% inflation | 2026 (age 62) | 0 and 5% | 95 |
| B | 1996-01-01 (effective birth year 1995, FRA 67) | 2,500 | 62, 67, 70 | COLA matches 2.5% inflation | 2026 (age 30) | 0 | 90 |
| C | as A, haircut 17% from 2034 | | | | | 0 | 95 |
| D | 1962-04-15 (FRA 67) | 2,900 | 67, 70 | fixed COLA 2%, inflation 2.5% | 2026 (age 64) | 0 | 92 |
| E | 1964-01-15 (FRA 67, January 2031), $50,000 of wages in 2026 and 2027 | 2,000 | 62, 67, 70 | no inflation | 2026 (age 62) | 0 | 95 |

Case A is the example-couple plan's second person, B the coast-fire plan's person.

## Arithmetic

Claim factors (20 CFR 404.410(a), 404.313): 62 is 60 months early, 1 − (36 × 5/9 + 24 × 5/12)/100 = 0.70; 70 is 36 months late, 1 + 36 × (2/3)/100 = 1.24.

**A.** With c = 1.025 and year − 2026 = age − 62, the ledger's factor equals (1.025)^(age − 62). B_62(62) = 1,950 × 0.70 × 12 = 16,380; claim 67 pays 23,400 × 1.025^(age − 62) from 67; claim 70 pays 29,016 × 1.025^(age − 62) from 70. For 62 against 67 the difference is D(n) = [7,020 c^(n+1) − 23,400 c^5 + 16,380]/0.025 with n = age − 62 and 23,400 c^5 − 16,380 = 10,094.95218. At 75 (n = 13), 7,020 × 1.412973 = 9,919.07, so D = −7,035; at 76, 7,020 × 1.448298 = 10,167.05, so D = +2,884. The crossing is 75 + 7,035/(7,035 + 2,884) = 75.709 ("75.7"). Likewise 62 against 70 at 77.458 ("77.5") and 67 against 70 at 79.544 ("79.5"); at a 5% return, 80.721, 82.372 and 84.532.

**B (the anchor).** The ledger's factor for 2058 (age 62) is 1.025^32 = 2.2037569377728006, so B_62(62) = 21,000 × 2.2037569 = 46,278.90, where the retired chart showed 21,000. Every value scales by 1.025^32 against the retired chart, so the crossings stay 75.7, 77.5 and 79.5.

**C (haircut from 2034, age 70).** From 2034 every benefit is × 0.83. The crossings move to 76.959, 78.996 and 81.403 ("77.0", "79.0", "81.4"): the years before the cut favour the early claim.

**D (fixed COLA, current age 64).** The ledger compounds 2% from 2026 (age 64); the retired chart compounded from 62, a ratio of 1.02^−2 = 0.961169: age 67, claim 67, 36,930.04 against 38,422. The crossing, 79.875 ("79.9"), is the same in both.

**E (the earnings test).** The claim at 62 pays 0.70 × 2,000 = 1,400 a month, 16,800 a year, and her entitlement month is January 2026, so every month of 2026 is in the reduction period. The 2026 excess is floor((50,000 − 24,480)/2) = 12,760: January to September take 9 × 1,400 = 12,600 and October 160, so 10 months are withheld and 16,800 − 12,760 = 4,040 is paid. 2027 is the same, 20 months in all. 2028 to 2030 pay 16,800. From January 2031, her full-retirement-age month, she is paid 60 − 20 = 40 months early: 1 − 36 × 5/9% − 4 × 5/12% = 0.783333, 1,566.67 a month, 18,800 a year. The claims at 67 (24,000 a year from 2031) and 70 (1.24 × 24,000 = 29,760 from 2034) have no wages in their years. From 66, B_62(a) = 2 × 4,040 + 3 × 16,800 + 18,800 × (a − 66) = 58,480 + 18,800 × (a − 66). For 62 against 70, D(79) = 297,600 − 302,880 = −5,280 and D(80) = 327,360 − 321,680 = +5,680, so the crossing is 79 + 5,280/10,960 = 79.482. For 62 against 67, D(77) = 264,000 − 265,280 = −1,280 and D(78) = 288,000 − 284,080 = +3,920: 77 + 1,280/5,200 = 77.246. 67 against 70 is 81.5, as with no wages. Paid in full, the chart crossed at 79.370 and 77.667; with the test but no adjustment (18,800 never reached), at 77.401 and 74.122.

## Expected

| Quantity | Value |
|---|---:|
| A crossing 62 vs 67 | 75.70924329825304 |
| A crossing 62 vs 70 | 77.45839217460883 |
| A crossing 67 vs 70 | 79.54427374765703 |
| A age 67 claim 62 | 104,631.12761308592 |
| A age 67 claim 67 | 26,474.952181640616 |
| A age 80 claim 62 | 392,235.6016373345 |
| A age 80 claim 67 | 437,338.4865019958 |
| A age 80 claim 70 | 441,330.21250593825 |
| A5 crossing 62 vs 67 | 80.72148494594006 |
| A5 crossing 62 vs 70 | 82.3716113754923 |
| A5 crossing 67 vs 70 | 84.53231983858629 |
| B age 62 claim 62 | 46,278.89569322881 |
| B age 80 claim 62 | 1,108,194.7799355956 |
| B age 80 claim 67 | 1,235,625.286902346 |
| B age 80 claim 70 | 1,246,903.227767572 |
| C crossing 62 vs 67 | 76.95871244163575 |
| C crossing 62 vs 70 | 78.99596296571238 |
| C crossing 67 vs 70 | 81.40294387697752 |
| C age 80 claim 62 | 349,882.1376952324 |
| C age 80 claim 67 | 376,833.53801327845 |
| C age 80 claim 70 | 366,304.0763799288 |
| D crossing 67 vs 70 | 79.87486807607027 |
| D age 67 claim 67 | 36,930.038400000005 |
| D age 80 claim 67 | 589,918.1493948186 |
| D age 80 claim 70 | 591,352.8502455687 |
| E crossing 62 vs 67 | 77.24615384615385 |
| E crossing 62 vs 70 | 79.48175182481752 |
| E crossing 67 vs 70 | 81.5 |
| E age 63 claim 62 | 8,080 |
| E age 67 claim 62 | 77,280 |
| E age 80 claim 62 | 321,680 |

Tolerance: 1e−9 relative on the dollar values, 1e−9 absolute on the crossing ages. Each case's printed crossings (a tenth of a year) are A 75.7, 77.5, 79.5; A at 5% 80.7, 82.4, 84.5; B as A; C 77.0, 79.0, 81.4; D 79.9; E 77.2, 79.5, 81.5. The yearly increments of case A's series equal the Social Security `simulatePlan` publishes for the same person claiming at each age, which is what makes the dollars the plan's.

## Wrong readings

- The cost-of-living adjustment compounded from 62 on the start-year PIA (the retired chart): B's age-80 values 502,866, 560,690 and 565,808, 2.2 times too small; D's 4.0% too large.
- Ignoring the haircut: C prints the crossings without it, 1.2 to 1.9 years early.
- Crossings on whole-dollar totals: the same to a tenth of a year on every example plan measured, and wrong in principle (a display rounding inside the model).
- The full retirement age in months as a claim age (66 years 10 months for 1959): not what the chart compares; it offers the whole year.
- Every benefit paid in full while the person works before full retirement age (the chart until D-SS-ANALYSIS-EARNINGS-TEST): E's crossings 79.370 and 77.667.
- The earnings test without the adjustment at full retirement age: E's 62 against 70 at 77.401, against 67 at 74.122, nearly two years early.
- The adjustment from January of the full-retirement-age year, or every month withheld credited including months before the claim's first month: the same as E here (her full-retirement-age month is January and her claim starts in January), different for a later birth month.

## Family

outputs: `social-security-break-even`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-break-even.md`; independently checked (the check's C1: cases A to D reproduced to float error; its correction that the COLA helper must take the ledger's own inflation path, which `socialSecurityColaFactor` does by taking the ledger's inflation-factor function). Expected values are the derivation's independent model (no engine import) and equal the engine's output bit for bit. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Case E and the Claim's second paragraph are new with decision D-SS-ANALYSIS-EARNINGS-TEST (2026-09-29): derived by claude (opus 5.5) as that derivation's case E4, by hand as above, and reproduced by a second claude (opus 5.5) instance's independent model (same model family, so not the catalog's review). Implemented by: claude (opus 5.5), 2026-09-29. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-6-after-769.md`.
