# State income tax for 2027 and later: survey of 2026-09-28

On 2026-09-28 every jurisdiction's enacted law for 2027 and later, and its 2026 figures, were read against the
state's own statutes, session laws and revenue department publications (decision D-2027-PUBLISHED-FIGURES).
This page records the outcome for all 50 states and the District of Columbia, one row each.

- **Loaded** means the engine applies it: a 2026 correction in `params/state/data/year2026.ts`, a later
  year in `params/state/data/enacted<year>.ts`. Each loaded item has its own rule record, named in the
  `state-enacted-tax-year-figures` calculation and its worksheet
  ([state-enacted-tax-year-figures.md](../../calculations/taxes/state-enacted-tax-year-figures.md)).
- **Stated** means it is named with its trigger and date but not applied. The dates are in the
  [maintenance schedule](../../maintenance-schedule.md#dated-state-tax-decisions).
- **Held** means a figure the statute indexes; the engine carries the latest published amount
  forward nominally in every later year, which overstates tax more the further the projection runs
  (the registered approximation `neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal`). Washington's
  deduction is the one indexed figure the engine projects.
- **Outside the model** means an enacted change to something the engine does not compute (a credit, or a
  subtraction for income the plan does not carry).

The plan models single and married filing jointly. Head of household needs a dependent, which the plan does not
collect, so head-of-household figures below are listed for completeness; the ones the engine loads (Montana's and
Hawaii's) are used only on a state return whose filing status is set to head of household (in the planner, the
state filing status under Assumptions, State tax worksheet facts).

| State | Result |
|---|---|
| AK | No individual income tax (AS 43.20.012(a)). Nothing enacted. |
| AL | No change to a figure the engine uses. Outside the model: HB 341 (2026) excludes the first $5,000 of Alabama National Guard inactive-duty pay for 2027 to 2029, and HB 527 (2026) adds an overtime deduction of up to $1,000 for 2026 to 2028. |
| AR | **2026 corrected:** the top rate is 3.7% from $26,400 (Acts 1 and 2 of the 2026 First Extraordinary Session, for tax years from January 1, 2026); the engine had 3.9%. No statutory change for 2027 or later. **Held:** the indexed brackets and deduction, which DFA publishes each autumn. |
| AZ | **2026 corrected:** the federal senior deduction is subtracted for 2025 to 2028 (A.R.S. 43-1022(35), Laws 2026, ch. 140). No rate change. **Held:** the standard deduction, re-based at $15,750 / $31,500 and indexed, until AZDOR publishes 2026's. |
| CA | **2026 corrected:** the military retirement and Survivor Benefit Plan exclusions of $20,000 each, tested on AGI, for 2025 to 2029 (RTC 17132.9, 17132.10); **loaded:** they end from 2030. **Loaded with a vote pending:** the 10.3%, 11.3% and 12.3% bands end from 2031 (Cal. Const. art. XIII, sec. 36(f)(2)); Proposition 3 on the November 3, 2026 ballot would keep them. **Held:** the 2026 indexed brackets and deduction, not yet published by FTB. |
| CO | **2026 corrected:** the federal senior deduction flows through federal taxable income for 2025 to 2028. **Stated:** the TABOR temporary rate cut (C.R.S. 39-22-627), decided for 2026 by October 1, 2026 and for each later year through 2034 by October 1. Outside the model: the under-55 military retirement subtraction ($15,000) ends from 2029. |
| CT | No change to a figure the engine uses. PA 26-68, sec. 277, adds the Public Health Service commissioned corps to the military pension subtraction; the first-time homebuyer subtraction from 2027 is outside the model. The AGI-tested pension, IRA and Social Security subtractions are already registered as an approximation. |
| DC | **2026 corrected, loaded with an approval pending:** D.C. Act 26-416, an emergency act in force from August 13, 2026 for no more than 90 days, sets a basic standard deduction of $15,000 / $22,500 head of household / $30,000 joint plus the IRC 63(c)(3) amount for 2026 to 2029, indexed from 2025, and the federal deduction from 2030; the engine loads it (it carried the federal $16,100 / $32,200). The permanent act, D.C. Act 26-418, is under congressional review with a projected law date of November 20, 2026, when this is revisited (`dc-code-47-1801-04-3a-standard-deduction-2026-2029`). Rates unchanged. |
| DE | **Loaded:** the military pension subtraction is $15,000 for 2027, $20,000 for 2028 and $25,000 from 2029, under 60 and as a greater-of limb at 60 and over (S.B. 219, 85 Del. Laws c. 426). **Stated:** the act's new domicile test for the subtraction at 60 and over is assumed met, because the plan holds no domicile history. |
| FL | No individual income tax (Fla. Const. art. VII, sec. 5(a)). Nothing enacted. |
| GA | **Loaded:** the retirement exclusion at 65 or older is $70,000 from 2027 (HB 463). **Stated:** HB 463's rate cut, standard deduction and dependent exemption steps, each decided by the Office of Planning and Budget's determination as of December 1 (first December 1, 2026); 2027 stays at the 2026 rate until then. |
| HI | **Loaded:** the Act 24 (SLH 2026) rate tables for 2027 and 2029, which replaced Act 46's before they took effect: 2.5% and 5% in the second and third bands and 13% above $500,000 single, $1,000,000 joint and $750,000 head of household. The standard deduction steps to $9,000 / $18,000 in 2028, $10,000 / $20,000 in 2030 and $12,000 / $24,000 in 2031 (HRS 235-2.4(a)(2)(G) to (I)). |
| IA | Nothing enacted for 2027 or later. The standard deduction is already the federal one. |
| ID | **2026 corrected:** the federal senior deduction applies in Idaho for 2025 to 2028 by conformity (H 559, 2026). **Held:** the 2026 zero-rate threshold at 2025's $4,811 / $9,622 until published. |
| IL | **Loaded:** the basic exemption falls to $1,000 from 2029 (35 ILCS 5/204(b)). **Held:** the indexed 2027 and 2028 exemption at 2026's $2,925. |
| IN | **Loaded:** 2.9% for 2027 to 2029 (IC 6-3-2-1(b)(8)). **Stated:** 0.05-point cuts from 2030 on a budget agency determination. The 2026 session's tips, overtime and car-loan interest deductions lapse after 2026 and are outside the model. |
| KS | **Stated:** rate cuts on the director of the budget's August 15 determination (K.S.A. 79-32,110c); the 2027 determination is not yet published. Outside the model: new subtractions from 2027 for portable-benefit-plan and health-care-sharing-ministry contributions. |
| KY | Nothing enacted: 3.5% is fixed for 2027 and 2028, because both reduction reviews came back not met. **Held:** the indexed standard deduction. |
| LA | Nothing enacted. **Held:** the indexed standard deduction and retirement exemption. |
| MA | Nothing enacted. **Held:** the indexed surtax threshold. |
| MD | **2026 corrected:** the indexed standard deduction, $3,400 single (the Comptroller's withholding guide) and $6,850 joint (computed by the same Tax-General 10-217(c) rule), approximated because the Comptroller's April 2026 estimated-tax worksheet prints $3,350 and $6,700 and the statute leaves the adjustment to the Comptroller; the 2% tax on capital gain for federal AGI above $350,000 (10-105(a)(3)); and the public-safety retirement subtraction of $16,000 at 55 or older (10-207(mm), 2026 Md. Laws ch. 686). **Loaded:** that subtraction rises to $17,000 for 2027, $18,000 for 2028, $19,000 for 2029 and $20,000 from 2030. It applies to a pension the plan marks as public-safety service, a marker the planner's pension editor does not yet offer. **Held:** the standard deduction from 2027. Outside the model: the 9-1-1 specialist retirement credit for 2026 to 2028. |
| ME | **Loaded:** from 2027 the standard deduction equals the federal standard deduction, subject to Maine's phase-out (P.L. 2025, c. 650, Part K), read as including the federal age-65 amount. **Held:** the brackets, the surcharge threshold and the phase-out, indexed from 2027. |
| MI | **Stated:** a one-year cut below 4.25%, decided at the January 2027 revenue conference (MCL 206.51). **Held:** the indexed retirement ceiling. Outside the model: from 2029 a filer taking the (9)(e) deduction loses the Social Security subtraction (the path the engine models is unaffected), and a tips and overtime deduction for 2026 to 2028. |
| MN | **Stated:** a one-year cut in the first-tier rate, determined by the commissioner by December 15 each year from December 15, 2026 (Minn. Stat. 290.036). **Held:** the indexed brackets and standard deduction. |
| MO | **Stated:** two more 0.1-point top-rate cuts on revenue triggers (RSMo 143.011.4); no determination published. **Held:** the indexed brackets and the public-pension Social Security figure. |
| MS | **Loaded:** 3.75% for 2027, 3.5% for 2028, 3.25% for 2029 and 3% from 2030 (2025 H.B. 1, section 1). **Stated:** further cuts from 2031 when the reserve fund is full (section 2). |
| MT | **Loaded:** the 2027 schedule, 4.7% and 5.4% at $65,000 single, $97,500 head of household and $130,000 joint, and the same capital-gain breaks (MCA 15-30-2103). **Held:** the breaks from 2028, which the Department indexes by November 1, 2027. |
| NC | **Loaded:** 3.49% for 2027 to 2029, 3.24% for 2030 to 2032 and 2.99% from 2033 (Session Law 2026-41). **Stated:** cuts to 2.49% from 2035 if General Fund revenue exceeds its trigger (G.S. 105-153.7(a1)). |
| ND | Nothing enacted. **Held:** the brackets the commissioner re-publishes each year. |
| NE | **Loaded:** 3.99% for rates three and four from 2027. **Held:** the indexed 2027 thresholds and standard deduction; the Department's draft 2027 figures (September 25, 2026) are not final. |
| NH | No tax on wages or pensions; the interest and dividends tax is repealed from 2025. Nothing enacted. |
| NJ | Nothing enacted for a figure the engine uses. The FY 2027 budget changed only the ABC adjustment and the child tax credit; S3689, a larger pension exclusion, is in committee. |
| NM | Nothing enacted. The 7-2-7 schedule has applied since 2025 with no later step. |
| NV | No income tax (Nev. Const. art. 10, sec. 1(9)). Nothing enacted. |
| NY | **Loaded:** the five lowest rates each fall 0.1 point for 2027 to 2032, and the top rate is 8.82% from 2033 (Tax Law 601, paragraphs (viii) and (ix)). The 10.3% and 10.9% bands above $5,000,000 and $25,000,000, which the engine does not carry for any year, end from 2033. |
| OH | **Held:** indexing of the $26,050 threshold resumes in 2027 after the 2025 and 2026 suspension; the Tax Commissioner sets it each August. The 2.75% rate stays. |
| OK | **Stated:** 0.25-point cuts when the State Board of Equalization certifies the revenue test, preliminary in December 2026 and final in February 2027, for 2028 at the earliest (68 O.S. 2355). Nothing is possible for 2027. |
| OR | **Loaded:** the ORS 316.157 retirement income credit cannot be claimed from 2032 (Oregon Laws 2009, chapter 913, section 36, as amended in 2025). **Held:** the indexed brackets and standard deduction. |
| PA | Nothing enacted. The rate has been 3.07% since 2004. |
| RI | **2026 corrected:** the pension and annuity modification is capped at $50,000 from 2025 (R.I. Gen. Laws 44-30-12(c)(9)); the engine had $20,000. The Social Security modification at full retirement age below $107,000 / $133,750 of federal AGI (the 2025 limits, the latest published) is now modeled. **Loaded:** a surtax of 1% for 2027, 2% for 2028 and 3% from 2029 on taxable income over $1,000,000, and the Social Security modification without its age test from 2027 (2026 H 7127 Sub A, Article 6). **Held:** the surtax threshold from 2028, the Social Security limits, the brackets and the standard deduction. The pension modification applies the Social Security modification's AGI limits and leaves IRA distributions out (round-three review). Outside the model: the $330 refundable child tax credit from 2027. |
| SC | **Stated:** the top-rate cut, decided by the Board of Economic Advisors forecast in effect on February 15, 2027 (S.C. Code 12-6-510(C)(2)); 2027 stays at the 2026 rate until then. **Held:** the $30,000 bracket, which SCDOR indexes on December 15, 2026. |
| SD | No income tax. Nothing enacted. |
| TN | No income tax. Nothing enacted. |
| TX | No income tax. Nothing enacted. |
| UT | Nothing enacted after 2026. |
| VA | **2026 corrected:** personal exemptions of $930 each, plus $800 for each taxpayer 65 or older (Va. Code 58.1-322.03(2)). **Loaded:** the standard deduction is $9,200 / $18,400 for 2027, $9,300 / $18,600 for 2028 and 2029, and $3,000 / $6,000 from 2030 (58.1-322.03(1)(b)). Outside the model: the refundable earned income credit, extended through 2029. |
| VT | Nothing enacted after 2026. **Held:** the indexed figures. |
| WA | **Loaded with a vote pending:** a 9.9% tax on federal AGI less long-term capital gains less a $1,000,000 deduction per individual or couple, from 2028 (ESSB 6346, chapter 238, Laws of 2026); Initiative 645 on the November 3, 2026 ballot would repeal it. **Loaded:** the deduction's indexing (section 316), every second year from 2029 by one year's inflation, rounded to $1,000, projected at the plan's inflation (read as the tax year of each October adjustment; the contrary reading starts in 2030). The capital gains excise (RCW 82.87) is outside the model. |
| WI | Nothing enacted after 2026. **Held:** the indexed figures. |
| WV | **Stated:** a cut in every rate on the Secretary of Revenue's August 15 determination (W. Va. Code 11-21-4h); none certified for 2027 yet. |
| WY | No income tax. Nothing enacted. |

Each state's own page in this folder holds its 2026 research. Where a row above corrects or extends that page,
the row and the rule records it names are the current statement.
