# Review, 2026-09-29 (codex-3-longevity-ladders-taxes: the longevity, ladder and tax records)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 17 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `funded-ratio-household-start`, `ladder-income-yield`, `treasury-real-yield-curve-2026`, `display-years-before-plan-end`, `joint-survival-percentile-age`, `mortality-joint-last-survivor-expectancy`, `mortality-published-death-probability`, `mortality-sampled-death-age`, `ssa-period-life-table`, `survival-hazard-from-expectancy-multiplier`, `survival-percentile-age`, `survival-probability-product`, `display-loss-carryforward-used-annual`, `display-tax-free-gains-room-annual`, `display-tax-plus-penalties-annual`, `parameter-provenance-catalog`, `state-enacted-tax-year-figures`. Verdicts: 15 approve, 2 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/` (ladder.py, life.py, state.py, tax.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: Codex (GPT-6-Sol, high reasoning), headless, read-only  
Date: 2026-09-29 (America/New_York)  
Repository commit: `6f668e06` (the supplied read-only snapshot has no `.git` metadata)  
Scope: the 17 requested ladder, longevity, and tax calculation records and their worksheets. No engine function body, engine script, or engine test was executed. Independent arithmetic is in `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py`, `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/ladder.py`, `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/tax.py`, and `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/state.py`; the scripts import no repository package. Evidence tests were read only.

## funded-ratio-household-start

### Recomputed
Birth year plus retirement age gives cases 1–5 and 7: 2030 Pat, 2030 Alex (older tie), 2026 Lee (retired 2020, clamped to start), 2031 Kim, 2026 Jo, and 2028 Alex. Ann works through 2060, her last plan year, so case 6 has no counting year. Sam works through 2054 in case 7 and is excluded. Gus's wage end age 75 pays through 2040, so case 8 starts 2041. Reversing the list preserves each answer.

### Match
All eight counting years, named people, and case 3 retirement year match.

### Tolerance
Calendar-year integers and tie selection are exact.

### Wrong readings checked
First-listed: case 1 gives 2027/Robin and case 4 2026/Dana; earlier retirement gives case 3 Chris, although its counting year remains 2026. Missing age as 65 changes Jo to 2029. Last wage year gives 2060 for Ann or 2054 for Sam, where the proper answer is respectively null or 2028. Ignoring Gus's wages gives 2031 instead of 2041. The named-person checks discriminate ties where the year does not.

### Sources
This is a disclosed planning convention, with no claimed legal or published-table authority. Its stated first-year-without-wages premise supports the cases.

### Record consistency
Statement, formula, outputs/feeds, and limits describe the worksheet, including the null case, age tie, and wages beyond retirement age.

### Evidence binding
`packages/engine/src/ladder/fundedRatioStart.evidence.test.ts` reads the worksheet cases, asserts each counting year/person, case 3's retirement year, Gus's wage rule, the nonretiring list, and list reversal.

### Verdict
**approve**.

## ladder-income-yield

### Recomputed
In `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/ladder.py`, back substitution gives A cost 10,000 and yield 102%; B cost 19,803.92156862745098 and yield 51.5049504950495%; C cost 40,099.81281201245011 and yield 49.87554454121722%; D cost 475,626.77709488830 and yield 6.307466577731168%. D's anchor is 2025, with maturity years 2027–2046. Each coupon cash flow was discounted at the interpolated yield for its *payment year*; using its rung's maturity yield for every coupon would instead give 473,939.63826738448 and is a different method.

### Match
A–D match the stated costs, yields, and two-decimal strings (102.00, 51.50, 49.88, 6.31). The older five-point curve gives 474,975.27302773906 and 6.316118270486887% (6.32), also matching. A zero cost is outside the defined domain; the empty window and zero amount give no quote.

### Tolerance
A is exact; B–D differ only in the last binary digits. Absolute 1e-9 on yield is ample for the rational/interpolation arithmetic. The display uses two decimal places, separately from the unrounded value.

### Wrong readings checked
B cost/income times 100 is 194.16, not 51.50. C income/total face is about 50.09%, not 49.88%; C's pre-payout coupons total about $49.9064 per year and cannot be added to the $20,000 target. Anchoring the owned D ladder at 2026 shifts its first offset from 2 to 1 and its maturity labels by a year.

### Sources
The five embedded inputs match the [Treasury par real-yield row](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=202606&type=daily_treasury_real_yield_curve). Annual coupons, using par yields as spot rates, and the 0.125% coupon floor are identified as construction conventions, not Treasury requirements.

### Record consistency
The ratio and window rules match; limits name annual coupons, par-as-spot discounting, curve date, and deferred pre-payout coupons.

### Evidence binding
`packages/engine/src/ladder/ladderMath.incomeYield.evidence.test.ts` checks A–D costs/yields and printed strings, the face-only counterexample, maturity endpoints, anchor, null windows, and zero-cost refusal.

### Verdict
**approve**.

## treasury-real-yield-curve-2026

### Recomputed
The [Treasury table's 2026-06-30 row](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=202606&type=daily_treasury_real_yield_curve) reads 1.93, 2.06, 2.20, 2.54, 2.73 percent at 5, 7, 10, 20, 30 years, digit for digit.

### Match
All five worksheet values match the source row.

### Tolerance
Exact printed hundredths of a percentage point; no rounding is justified or needed.

### Wrong readings checked
The old row differs by -8, -1, +5, +1, -3 basis points; nearest-5bp rounding gives 1.95, 2.05, 2.20, 2.55, 2.75. Treasury's 06/29 row is 1.90/2.02/2.16/2.49/2.68 and 07/01 is 1.98/2.11/2.25/2.58/2.78, both different.

### Sources
The operative Treasury heading is “Daily Treasury Par Real Yield Curve Rates”; its dated row supports the five data points. The par-to-spot use is a separately disclosed modeling choice.

### Record consistency
The date, units, maturity order, no-rounding claim, flat endpoint treatment, and par-as-spot approximation are stated in the record and limits.

### Evidence binding
`packages/engine/src/params/data/realYieldCurve2026.evidence.test.ts` asserts the date, maturity order, all five exact values, and record statement.

### Verdict
**approve**.

## display-years-before-plan-end

### Recomputed
For depletion D and end E, L=D−1 and N=E−L. A: (2027,1); B: (2027,3); C with no depletion: (2028,0); D: (2025,35). A depletion year 2031 for a projection ending 2030 is outside its domain.

### Match
All four worked tuples and the refusal case match. Differences in L are invariant to shifting both former decision counts by one.

### Tolerance
Exact integer years.

### Wrong readings checked
E−D gives A 0, B 2, D 34; calling D the last funded year gives 2028 in A; E+1 gives 2029 in C. One listed “wrong reading,” counting actual shortfall years, is *not distinguished by A–D*: all their post-depletion years remain short. A recovery example with only 2026 short and end 2028 would give distance 3 but actual shortfall count 1. The worksheet admits this distinction; an additional discriminating fixture would strengthen it.

### Sources
This is a definition on the ledger's first underfunded year, not a statutory rule. Inclusive year counting supports E−D+1.

### Record consistency
The record accurately calls N a distance and explicitly limits it from being interpreted as a count of actual shortfall years after possible recovery. Outputs and comparison feed agree.

### Evidence binding
`packages/engine/src/projection/moneyLasts.evidence.test.ts` asserts A–D, ledger A–C, invalid years, and difference invariance. It does not assert a recovery case.

### Verdict
**approve**, with the nondiscriminating recovery-fixture note above.

## joint-survival-percentile-age

### Recomputed
From `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py`, single male survival at primary ages 69/70/71 is 0.929212164769243/0.9093586176567833/0.88853157723659; complements of two deaths are 0.9949890823833432/0.9917841398069108/0.9875747907266377. Thus 99% last qualifies at 70. For male 70/female 35, female survival remains at least 25% at elapsed 56 and fails at 57, giving primary age 126 and calendar year 2082 from either order. With female 63 hazard 1.5, the primary male 65's 50/25/10% ages are 89/93/96; at hazard 1 they are 91/95/99.

### Match
All intermediate probabilities, ages, and order-invariant calendar years match.

### Tolerance
Integer picks are exact; intermediate binary products agree well inside 1e-9 absolute.

### Wrong readings checked
Both-alive at male age 66 is below 99%, so multiplication returns 65 for the first case. Single-life 99% also returns 65. Ignoring partner hazard shifts picks to 91/95/99. Stopping at the older primary's table end gives 120/2076, six years early.

### Sources
The [SSA 2023 period table](https://www.ssa.gov/oact/STATS/table4c6.html) supplies each q(x). The independent-lives complement is a model assumption, correctly named as such.

### Record consistency
Statement and formula express either-alive probability; limits disclose independence, separate hazard powers, and the primary clock. The >120 primary-age case is not overbounded.

### Evidence binding
`packages/engine/src/montecarlo/survival.evidence.test.ts` asserts the 69–71 intermediates, boundary 70, hazard alternative, age 126, year 2082, and reversal.

### Verdict
**approve**.

## mortality-joint-last-survivor-expectancy

### Recomputed
At 118, one-year survival is 0.11752; either alive is 1−0.88248²=0.2212290496; expectancy is 0.7212290496. `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py` gives male70/female67 21.806558679309312 and two independent average lives 21.527057555000496. Two ages 118.7/118.2 floor to 118. For age −2 paired with 118, limiting the worksheet's sum to t=1..120 gives 77.7922910558519; clipping −2 to zero instead gives 75.79299793872566. The tiny survival at t=121 is outside this record's stated finite sum.

### Match
All six expected cases match their stated tolerance.

### Tolerance
The 118 case is terminating arithmetic. 1e-12 absolute/relative elsewhere accommodates binary summation; the negative-age figure is evaluated with the record's finite 120-term horizon.

### Wrong readings checked
Single-life gives 0.61752 at 118; adding survivals without overlap subtraction gives 0.73504. Restricting “average couple” to opposite-sex pairings gives 21.573215393942213, not 21.52705755500049. Clipping negative age gives 75.79299793872566.

### Sources
SSA's [q(x) table](https://www.ssa.gov/oact/STATS/table4c6.html) has q118=0.882480 and q119=0.926604. Closing q119 at 1 and adding a half year are explicit conventions; the regulation's 70/67 ages serve only as an example, not authority for the independence model.

### Record consistency
The record states the finite t=1..120 sum, half-year adjustment, closed endpoint, independent lives, and four-pair mixture. Limits name shared-risk and age approximations.

### Evidence binding
`packages/engine/src/montecarlo/mortality.evidence.test.ts` asserts the 118, 70/67, average-pair, fractional, and negative cases and distinguishes the mixed-only alternative.

### Verdict
**approve**.

## mortality-published-death-probability

### Recomputed
Flooring 65.9 selects male q65=0.016455; female q65=0.010188; male q118=0.882480. At 119 and 130 the model returns 1; at −1 it returns 0. SSA itself prints q119=0.926604, which is carried but deliberately not used.

### Match
All seven expected values match.

### Tolerance
Exact six-decimal table entries and exact boundary constants.

### Wrong readings checked
The old printed-e half-year identity gives about 0.0161921 (male65), 0.0103093 (female65), and zero at male10/female9 due e rounding. Reading q119 as printed gives 0.926604, leaving 7.3396% of a life alive at 120. Rounding 65.9 to 66 would use male q66=0.017574.

### Sources
The [SSA column note](https://www.ssa.gov/oact/STATS/table4c6.html) calls q the probability of dying within one year; the cited rows agree. The last-row closure departs from SSA's q119 and is clearly disclosed.

### Record consistency
Formula and limits state the exact source range 0–118, the closed last row, fractional-age floor, period-table use, and refusal of an “average” single q.

### Evidence binding
`packages/engine/src/montecarlo/mortality.evidence.test.ts` checks the row values, boundaries, and source-table relation, including the printed-versus-read last row.

### Verdict
**approve**.

## mortality-sampled-death-age

### Recomputed
Male draws 0.5 then 0.01 survive 65 and die at 66, consuming two draws. Average survival from 65 is 0.9866785, 0.972651512805, 0.957892740299765; conditional deaths are 0.0133215, 0.014216370575623164, 0.015173751658158204. Draws 0.5/0.01422/0 therefore return 67 after three draws. Death masses at 66/67 are 0.014026987195 and 0.014758772505235. From 119, return 119 with zero draws; a male 117 surviving two draws reaches 119 with two draws. Male 65.9 follows the 65 path.

### Match
Every age, draw count, and probability matches.

### Tolerance
Ages/draw counts exact. Ratio/difference probabilities agree within 1e-13 relative; cancellation explains the looser tolerance.

### Wrong readings checked
Next-birthday labeling returns 67 for the male case; reversed death comparison returns 65. Mean q66=0.014227 would kill the average case at 66. Drawing again at 119 consumes three rather than two draws from 117. Rounding 65.9 up returns 67 under the same draws.

### Sources
SSA's [q65–q67](https://www.ssa.gov/oact/STATS/table4c6.html) support the male hazards. The mixture draw and Bernoulli telescoping are modeling and probability rules, not SSA claims; period mortality is disclosed.

### Record consistency
The statement identifies the last full age, the closed endpoint, one draw per year below 119, and no questionnaire hazard adjustment. Outputs/feeds and limits match.

### Evidence binding
`packages/engine/src/montecarlo/mortality.evidence.test.ts` asserts both draw sequences, distribution masses, table-end consumption, and fractional start.

### Verdict
**approve**.

## ssa-period-life-table

### Recomputed
I compared all 120 age rows and all four printed q/e cells per row against the live [SSA Table 4C6](https://www.ssa.gov/oact/STATS/table4c6.html): zero mismatches. Separately, canonicalizing the worksheet's 120 rows as `age,qM,eM,qF,eF` gives SHA-256 `32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c`. At 65 the cells are 0.016455/18.12 and 0.010188/20.66; at 119 they are 0.926604/0.58 for both sexes. The displayed 65.5 male baseline is (18.12+17.41)/2=17.765; the average at 65 is (18.12+20.66)/2=19.39.

### Match
The complete worksheet table, 120-row count, digest, samples, and interpolated baselines match.

### Tolerance
Printed q to six decimals and e to two are transcribed exactly; interpolation arithmetic has ordinary binary tolerance.

### Wrong readings checked
Using the 2022 edition changes q/e (for example the 119 row was closed there); an invented unisex q is absent from the published columns. Hashing seven columns instead of the four carried columns gives a distinct digest; neither can stand for the specified canonical text.

### Sources
SSA explicitly calls this the 2023 *period* life table used in the 2026 Trustees Report and labels q as the one-year death probability. Its period interpretation, not a cohort improvement forecast, is correctly stated. The live table was read in full for the cell comparison.

### Record consistency
Statement and limits distinguish printed q119 from the engine's closed last row, and identify interpolation of e only as an engine view. The edition and period limitations are named.

### Evidence binding
`packages/engine/src/longevity/ssaPeriodLifeTable.evidence.test.ts` asserts row count, every q/e cell, canonical digest, representative rows, interpolation, and edition labels. It was not run.

### Verdict
**approve**.

## survival-hazard-from-expectancy-multiplier

### Recomputed
For age 65, `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py` gives E(1)=18.116335599472606 male, 20.6635926681499 female, 19.38996413381125 average. Forty-step bisection for m=0.8 gives h=1.6380679198085089, 1.7644201878877537, 1.7001583225654944. At m=1, h=1 by identity; a woman 25 then has a 10% pick at 95. The near-one male case m=0.9991 gives about 1.002138227. **Counterexample:** at starting age 119, q119 is closed at 1, so S_h(t)=0 for every t≥1 and every positive h; E(h)=0.5 for all h. At m=0.8 the target is 0.4 and the stated clamped algorithm returns h=8 while E(8)=0.5; at m=1.2 it returns h=0.2 while E(0.2)=0.5, not 0.6.

### Match
The worked age-65 and age-25 values match. The unrestricted record claim does not.

### Tolerance
The listed age-65 h values meet 1e-9 absolute. No numerical tolerance can make 0.5 equal 0.4 or 0.6.

### Wrong readings checked
Targeting printed e65 instead gives male h=1.637384881102935 at m=0.8 and h≈0.9995201649 at m=1. Treating m=0.8 as h worsens the direction. Snapping 0.9991 to 1 misses h≈1.002138227. The additional age-119 counterexample is independent of these alternatives.

### Sources
[SSA Table 4C6](https://www.ssa.gov/oact/STATS/table4c6.html) prints q119=0.926604; this model expressly overrides it to 1. The hazard power and half-year sum are model choices, and the closed endpoint makes the asserted strict monotonicity false at 119 and later.

### Record consistency
The statement says E is strictly decreasing in h and that adjusted expectancy equals m times E(1) for a given age. Neither holds at 119 for m≠1. Limits name clamping and truncation but do not name this degenerate endpoint or exclude it from the input domain. Correct by limiting the claim to reachable interior targets and saying clamped endpoints need not attain the target; at age 119, E remains 0.5 for every h.

### Evidence binding
`packages/engine/src/montecarlo/survival.evidence.test.ts` asserts the worksheet's age-65 roots, 279 m=1 identity points at ages 18–110, and age-25 pick. It does not test age 119 or an unattainable target.

### Verdict
**reject** — the record overclaims strict decrease and exact multiplier calibration at the closed table endpoint.

## survival-percentile-age

### Recomputed
Male from 65 has S66=0.983545 and S67=0.96626018017, so the 97% pick is 66. `DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py` gives 50/25/10% picks male 83/89/94, female 86/92/96, and 50/50 mixture 85/91/95. From 125 the already-reached age 125 is returned.

### Match
Every expected age matches.

### Tolerance
Integer age picks are exact; the source probabilities are far from the decision threshold in the worked 97% case.

### Wrong readings checked
First failing age is 67. Reading 97 as a probability instead of 97% leaves only age 65. Mean male/female picks would be 84.5/90.5/95, not the mixture's 85/91/95 for the first two thresholds.

### Sources
The q products come from [SSA's printed one-year probabilities](https://www.ssa.gov/oact/STATS/table4c6.html). Clamping the threshold and mixing sexes are stated model conventions.

### Record consistency
Statement and limits describe the 0.1–100% clamp, monotone stopping, closed endpoint, and mixture distinction, including an already-past-table current age.

### Evidence binding
`packages/engine/src/montecarlo/survival.evidence.test.ts` asserts threshold bracketing, all nine sex/mixture picks, and age 125.

### Verdict
**approve**.

## survival-probability-product

### Recomputed
`DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/life.py` gives male S1–S4 0.983545/0.96626018017/0.948157295694515/0.929212164769243; female 0.989812/0.97904284544/0.967628184905015/0.9554912245817514; average 0.9866785/0.972651512805/0.957892740299765/0.9423516946754972. Average conditional death at 66 is 0.014216370575623164. Male from 117 has S1=0.159543, S2=0.01874949336, S3=0. The target 67.9 floors to S2; average from 118 dies in year 2 with conditional probability 1.

### Match
All expected products, mixtures, conditional deaths, and endpoint cases match.

### Tolerance
Products from six-decimal source cells are rational; 1e-15 relative for short products and 1e-13 for a one-minus-ratio are justified by binary cancellation. Exact 0 and 1 cases need no tolerance.

### Wrong readings checked
Multiplying through age 67 gives 0.948157295694515 rather than S(67)=0.96626018017. Subtracting q65+q66 gives 0.965971. Rounding 67.9 up gives 0.948157295694515. Mean annual q gives average S2=0.9726410249805, below the proper 0.972651512805.

### Sources
[SSA Table 4C6](https://www.ssa.gov/oact/STATS/table4c6.html) supplies q65–q68 and q117–q119. Conditional survival multiplication is probability arithmetic; hazard power, sex mixture, and last-row closure are disclosed model choices.

### Record consistency
Formula, no-interpolation limits, mean-of-curves construction, and the distinction between `survivalCurve` validation and its view are stated. Feeds cover the downstream analyses.

### Evidence binding
`packages/engine/src/montecarlo/survival.evidence.test.ts` asserts the worksheet's products, mixture death, endpoint, target floor, and broad view/curve parity.

### Verdict
**approve**.

## display-loss-carryforward-used-annual

### Recomputed
With the stated one-pool netting: A uses 4,000 against gains plus 3,000 against ordinary = 7,000 and leaves 3,000; B uses 3,000 and leaves 7,000; C adds its 2,000 current loss to the pool, uses 3,000, and leaves 9,000; D uses 2,000 against gains and leaves zero.

### Match
A/B/C/D are 7,000/3,000/3,000/2,000 exactly.

### Tolerance
Integer-dollar inputs and minimum operations require exact equality.

### Wrong readings checked
Remaining balance gives 3,000 rather than 7,000 in A and 7,000 rather than 3,000 in B. Opening minus ending pool in C is 1,000, not 3,000. Ordinary-only use gives A 3,000; opening pool gives A–C 10,000.

### Sources
[IRC 1211(b)](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section1211) allows noncorporate losses against gains plus up to $3,000 of excess (with the separate-return exception); [IRC 1212(b)](https://uscode.house.gov/view.xhtml?req=%28title%3A26+section%3A1212+edition%3Aprelim%29) carries the excess. The record discloses its simplified single pool and filing-status treatment.

### Record consistency
The formula and limits distinguish use from the pool's decrease, and refer to the carryforward model's separate approximations.

### Evidence binding
`packages/engine/src/projection/yearFigures.evidence.test.ts` asserts all four worksheet figures and the case-C wrong pool-decrease alternative.

### Verdict
**approve**.

## display-tax-free-gains-room-annual

### Recomputed
`DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/tax.py` independently nets the opening pool and solves the zero-tax segments: A 7,000; B 8,500; C 65,550; E 25,550; G 3,000; H 9,000. For D, the pension/benefit equation is 10,000+4,500+0.85(g−9,000)=24,150, so g=20,352.94117647 and the published cent bracket is 20,352.94. NIIT binds at 200,000 rather than the indexed 0% band endpoint 202,800. The 2027 senior phase-out equation 1.06g+4,541.7418=50,686.25 gives 43,532.55490566. Rebuilding P in G/H gives 10,000 in each case.

### Match
All nine roots, segment checks, and headline retired-figure taxes match the worksheet. The 0.01 bisection can return a value below the analytic root by less than one cent.

### Tolerance
The interval [R−0.01,R+0.0001] covers the bisection bracket and $1e-6 tax comparison; its upper allowance exceeds 1e-6 divided by the smallest 8.5% marginal rate in these examples. It is not a claim of exact cent rounding.

### Wrong readings checked
A's retired 35,550 costs 360 extra and D's 38,100 costs 1,135. B's 7,000 carryforward-only shortcut misses 1,500 free displacement; C's 10,000 shortcut misses the 0% gain band. NIIT at the 202,800 band edge costs 106.40. Ignoring senior phase-out uses 43,548.97 and costs 2.61. Adding a new gain to already-netted gains taxes the first dollar of A despite 7,000 of remaining carryforward.

### Sources
[IRC 1211(b)](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section1211) and [1212(b)](https://uscode.house.gov/view.xhtml?req=%28title%3A26+section%3A1212+edition%3Aprelim%29) govern netting; [IRC 86](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section86) and [IRS Publication 915](https://www.irs.gov/publications/p915) support the 50/85% benefit inclusion and $25,000/$34,000 single thresholds. [IRC 1411](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title26-section1411) imposes 3.8% NIIT above the $200,000 single threshold. [IRS 2026 adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) and [IRS senior-deduction guidance](https://www.irs.gov/pub/irs-pdf/p6142.pdf) support the federal thresholds and phase-out. The calculator's single-pool and fixed-year recomputation are disclosed approximations.

### Record consistency
The mathematical formula defines a no-higher-tax prefix, while the record states the $1e-6 search tolerance. Limits name ACA-credit, state-tax, Medicare, future carryforward, itemized-charity monotonicity, and advisory-input qualifications; the title must be read with these limits.

### Evidence binding
`packages/engine/src/projection/yearFigures.taxFreeGainsRoom.evidence.test.ts` reads the worksheet, brackets A–E/G/H and NIIT/senior roots, checks old readings and tax increases, and checks null and ACA markers.

### Verdict
**approve**.

## display-tax-plus-penalties-annual

### Recomputed
A 18,742+2,000=20,742; B 8,412.35+1,250.10=9,662.45; C 31,000+0=31,000, with its 1,400 AMT already included in tax.

### Match
All three values match.

### Tolerance
A/C exact integer arithmetic; B's $1e-6 tolerance comfortably contains one binary64 addition of two cent amounts.

### Wrong readings checked
Tax-only gives A 18,742; subtraction gives A 16,742; double-counting AMT gives C 32,400.

### Sources
This is composition of defined ledger fields, not a claim about a new tax rule. The worksheet explicitly identifies the early-withdrawal and IRC 4974 channels within `penalties`.

### Record consistency
Statement/formula/limits keep AMT inside tax and add penalties once, in nominal annual dollars.

### Evidence binding
`packages/engine/src/projection/yearFigures.evidence.test.ts` checks A/C exactly, B within tolerance, and all three wrong alternatives.

### Verdict
**approve**.

## parameter-provenance-catalog

### Recomputed
I extracted the worksheet's ordered ID list: 40 entries, 40 distinct IDs, zero duplicates. Compact UTF-8 JSON of that array hashes to `dbdde92c238740111785a4efedbfac7ab6f92f788c7cdc91f5dadefb4133e2bd`.

### Match
Count, uniqueness, order digest, and record metadata match.

### Tolerance
Exact integer counts and exact SHA-256 bytes.

### Wrong readings checked
Omitting one entry yields 39; omitting the three distinct Social Security tax/credit/CPI entries yields 37; replacing the 18 state rows by one yields 23; retaining only the initial five state rows yields 27. Treating jurisdictions named in a summary as extra top-level entries exceeds 40. These counts differ as stated.

### Sources
The claimed source here is the project's provenance catalog and worksheet, not the 40 underlying authorities. Its limit explicitly says the structure check does not establish every linked summary's truth or freshness; each authority needs separate review on refresh.

### Record consistency
The record claims source metadata, not tax or benefit calculation. Its scope and limit agree with what the worksheet demonstrates.

### Evidence binding
`packages/engine/src/params/provenance.evidence.test.ts` asserts 40, zero duplicates, and each ordered worksheet ID against the catalog.

### Verdict
**approve**.

## state-enacted-tax-year-figures

### Recomputed
`DOCS/calculations/reviews/scripts/codex-3-longevity-ladders-taxes/state.py` recomputes all 24 expected tax amounts using the worksheet's schedules and bases: IN27 2,900; MS27/28/29/30 3,375/3,150/2,925/2,700; NE27 3,665.631; NC27/30/33 3,490/3,240/2,990; MT27 7,190; HI27/29/31 4,579/3,650/3,258; NY27/33 224,615.725/217,605.13; RI27/29 126,667.52/146,667.52; VA27/30 5,385.55/6,098.55; ME27 6,228.925; GA27 1,497; CA30/31 89,532.276/85,877.276; WA28 49,500. For example, NE is 8,250×2.46% + 41,280×3.51% + 50,470×3.99%=3,665.631. **Legal boundary counterexample:** D.C. Act 26-416 expressly lasts no longer than 90 days from its August 2026 effective date, so by itself it does not enact the worksheet's D.C. deduction for tax years 2027–2029. A 2027 D.C. dollar result has no unconditional corrected value from that emergency act alone.

### Match
All 24 arithmetic results match within $0.005. The broad “already enacted, no condition attached” claim does not match the D.C. source for future tax years.

### Tolerance
Decimal rate applications are exact to the printed mill; $0.005 is appropriate for comparing unrounded tax amounts to cents, though the script's Decimal results match the worksheet's printed values exactly.

### Wrong readings checked
Keeping 2026 rates gives, among others, IN 2,950 versus 2,900, MS 3,600 versus 3,375, MT 7,572.50 versus 7,190, RI 116,667.52 versus 126,667.52, and WA zero versus 49,500. Hawaii's repealed Act 46 schedule gives 4,694 versus 4,579. Holding MS 2027 rate to 2030 gives 3,375 versus 2,700; holding NC 2027 rate to 2033 gives 3,490 versus 2,990. California's 2030 three-band computation remains 89,532.276 if carried into 2031, versus 85,877.276. The D.C. emergency/permanent-law distinction is not settled by any of the 24 tax cases.

### Sources
Operative state provisions checked include [Nebraska §77-2715.03](https://nebraskalegislature.gov/laws/statutes.php?statute=77-2715.03) (3.99% from 2027), [Montana §15-30-2103](https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0030/0150-0300-0210-0030.html) (130,000 joint break and 4.7/5.4%), [North Carolina S.L. 2026-41 §44.1](https://www.ncleg.gov/EnactedLegislation/SessionLaws/HTML/2025-2026/SL2026-41.html) (3.49/3.24/2.99%), [Virginia §58.1-322.03](https://law.lis.virginia.gov/vacodefull/title58.1/chapter3/article2/) (2027/2028/2030 deduction steps), [Delaware §1106](https://delcode.delaware.gov/title30/c011/sc02/index.html) (military-pension steps), [Illinois §204](https://www.ilga.gov/legislation/ilcs/fulltext?DocName=003500050K204) (base exemption after 2028), [Maine's enacted §5124-C amendment](https://mainelegislature.org/bills/getPDF.asp?item=37&paper=HP1491&snum=132) (federal deduction from 2027), [Maryland Ch. 686](https://mgaleg.maryland.gov/2026rs/Chapters_noln/CH_686_sb0607t.pdf) (public-safety subtraction steps), [Oregon ORS 316.157 sunset note](https://www.oregonlegislature.gov/bills_laws/ors/ors316.html) (2032), [California Constitution art. XIII §36(f)](https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/2023-24_Constitution_Final_wCover.pdf) (before 2031), and [Washington RCW 82A.04.360/.367](https://app.leg.wa.gov/RCW/default.aspx?cite=82A.04.367) (million-dollar deduction and October 2029 indexing). The decisive contrary source is [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416): its operative duration clause says it remains effective no longer than 90 days. The worksheet itself says the permanent act is still under congressional review, so this is a known future-law dependency rather than a numerical rate error.

### Record consistency
The record's statement and purpose group D.C. with unconditional enacted-year figures and say the 2026–2029 deduction is loaded under the emergency act. Its limit discloses the 90-day sunset and pending permanent act, but that does not cure the categorical “already enacted without conditions” claim. Reclassify D.C. future deductions as provisional or defer them until durable enactment; preserve the 2026 emergency rule separately. The other named approximations (indexed thresholds held nominally, Washington gain add-back, conditional rates, votes pending, filing-status limitations) are disclosed.

### Evidence binding
`packages/engine/src/params/state/enacted2027.evidence.test.ts` reads the worksheet and asserts all 24 tax values and several year boundaries. It has no D.C. 2027–2029 case and cannot prove the legal-duration premise.

### Verdict
**reject** — the emergency act is not authority for an unconditional D.C. 2027–2029 enacted-year deduction.
