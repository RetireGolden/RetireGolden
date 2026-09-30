# Review, 2026-09-29 (codex-2-cash-flow: the cash-flow, summary and Roth records)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 15 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `display-balance-by-category-annual`, `pension-election-annuity-present-value`, `bucket-lens-allocation`, `cash-flow-drilldown-amounts`, `display-dollar-basis-conversion`, `guaranteed-income-owner`, `household-later-retirement`, `hsa-contribution-limit-years`, `joint-account-contributions`, `projection-summary-fi-spending-base`, `sustainable-spending-result-simulation-count`, `year-result-ltcg-zero-headroom`, `monte-carlo-success-rate-comparison`, `conversion-schedule-total`, `roth-conversion-annual`. Verdicts: 11 approve, 4 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/codex-2-cash-flow/` (decimal_check.py, recompute.mjs, ulp_check.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Left out of that folder: normalize_json.py, reorder.py, validate.py and verdicts_write.py, because they format and check the review's own output files (the verdict list and this report) and recompute nothing. Verbatim output follows.

---

# Independent calculation review

Reviewer: Codex (GPT-6-Sol, high reasoning), headless, read-only. Date: 2026-09-29. Repository commit supplied for this read-only tree: `6f668e06` (the copy has no `.git` directory to verify it). Scope: the 15 records named in the request, their worksheets, cited operative source passages, and named evidence tests. I did not run or import the engine or read any `implementedByFunctions` body. Independent arithmetic is in `DOCS/calculations/reviews/scripts/codex-2-cash-flow/decimal_check.py`, `DOCS/calculations/reviews/scripts/codex-2-cash-flow/recompute.mjs`, and `DOCS/calculations/reviews/scripts/codex-2-cash-flow/ulp_check.py`; the latter two use only language runtimes. Example-library census numbers require a full simulation and are identified below as measurements rather than independently reproduced fixtures.

## display-balance-by-category-annual

### Recomputed
A: cash 1,000 plus the logical IRA's 50,000 + 50,000 = 100,000, total 101,000. B: 10,000 + 25,000 + 7,500 + 30,000 + 40,000 + 6,000 = 118,500. C's `home` key is ambiguous (10,000 cash versus 300,000 property), so refusal is the specified result. D: 30,000 pension − 20,000 spending = 10,000 unassigned; 50,000 IRA + 10,000 = 60,000 investable.

### Match
All four stated results match. B's six categories sum to 118,500; property, debt and policy are outside them.

### Tolerance
The integer examples are exact; zero tolerance is justified. The general category/total identity can have binary association residue, as the record says.

### Wrong readings checked
Per-row aggregation gives A's IRA 200,000 and B's taxable 50,000; taking one IRA row gives 50,000. Dropping equity compensation removes 7,500. Including B's property/debt/policy adds 300,000/120,000/15,000 respectively. Treating C's overwritten key as cash displays 300,000; adding D's unassigned amount to cash displays a false 10,000 cash category.

### Sources
This is a ledger reporting convention, not a statutory claim. The worksheet's published-row inputs support the roll-up and the explicit refusal; no external primary source is cited.

### Record consistency
Statement, formula and limits describe one logical ID and an unassigned amount beside the categories. The equality with `investableTotal` is appropriately qualified for floating association.

### Evidence binding
`yearFigures.evidence.test.ts` reads the worksheet and asserts A/B categories, A's total and wrong per-row amount, C's refusal, and D's unassigned/total/null cases.

### Verdict
**approve**.

## pension-election-annuity-present-value

### Recomputed
The six-year real yield is 1.93 + (2.06 − 1.93)/2 = 1.995%; adding 2% gives 3.995%. Exact-decimal discounting gives Σ₁⁶ 12,000/1.03995^k = 62,915.88302169883495 and Σ₁³ = 33,304.25282719482094.

### Match
Rate and both PVs match the worksheet's displayed precision.

### Tolerance
`1e-9` percentage point and $0.005 comfortably cover binary evaluation; the independent decimal values differ by less than $0.000000001.

### Wrong readings checked
Three instead of six payments gives 33,304.25. The 5-year endpoint rate 3.93% gives six-payment PV 63,049.24798059; omitting inflation (1.995%) gives 67,228.51425331; the old 3.95% rate gives 63,008.16601010 and its three-payment PV 33,332.71934074. Undiscounted three payments give 36,000. Each changes the answer.

### Sources
The [Treasury's 2026-06-30 real-yield row](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026) publishes 1.93, 2.06, 2.20, 2.54 and 2.73 at the cited tenors. Interpolation, inflation addition and annual payment timing are explicitly planning conventions, not Treasury-prescribed valuations.

### Record consistency
The record ties planning age to both the six-year curve horizon and the six-payment field, and separates the three-payment helper case. Its limits disclose the embedded snapshot and annual payment convention.

### Evidence binding
`pensionElection.evidence.test.ts` asserts the 3.995% rate, both PVs and the principal wrong readings at worksheet tolerances.

### Verdict
**approve**.

## bucket-lens-allocation

### Recomputed
For spans [2,8], years 0–4 give `[30000,120000,50000]`, `[50000,90000,10000]`, `[70000,30000,0]`, `[60000,0,0]`, `[20000,0,0]`. For [3], they give `[60000,140000]`, `[90000,60000]`, `[100000,0]`, `[60000,0]`, `[20000,0]`. The float case gives `[1028.55,2057.21,96914.24999999999]`, whose left-to-right sum misses 100000.01 by −1.4551915228366852e−11. These were independently evaluated in `DOCS/calculations/reviews/scripts/codex-2-cash-flow/recompute.mjs`.

### Match
The worksheet's fixtures match. The record's unrestricted claim that buckets always sum to within **one** unit in the last place does not. A valid three-span `[1,1,1]` case with total 822,519.53 and needs `[1,251.79, 84,015.57, 138,302.07]` yields buckets `[1251.79,84015.57,138302.07,598950.0999999999]`; their left-to-right sum is 822,519.5299999998, **two** ULPs below total. One ULP there is 1.1641532182693481e−10.

### Tolerance
Exact array assertions are valid for the stated fixtures. A universal one-ULP conservation tolerance is unjustified for arbitrary positive spans; rounding errors accumulate as bucket count grows.

### Wrong readings checked
Starting next year gives year-0 first bucket 20,000 + 30,000 = 50,000. Omitting the cap gives year-2 `[70000,50000,-20000]`; direct total minus needs likewise gives −20,000. Deflation changes any positive later need (for example 20,000/1.025 = 19,512.1951 instead of 20,000). Missing need as zero changes a malformed row's behavior from refusal to a numeric bucket.

### Sources
This is a reporting convention; no statute or numeric external table governs the formula. The literature mentioned in the limit is background, not an arithmetic source.

### Record consistency
The statement and last limit overclaim one-ULP conservation for all allowed `spans`. The measured 127/2,420 example rows cannot establish a bound over the function's declared domain.

### Evidence binding
`bucketLens.evidence.test.ts` pins both presets, the float fixture and refusals; it has no three-span conservation counterexample. The example-library parity test checks equality to the retired function, not a general ULP bound.

### Verdict
**reject** — narrow the conservation claim to the measured presets/fixtures or give a justified bound for arbitrary span count; the counterexample is two ULPs, not one.

## cash-flow-drilldown-amounts

### Recomputed
Line-order sum is 62,136.68. Grouped spendable sum is (41,234.11 + 3,000.30) + 12.07 = 44,246.48000000001 in binary; plus 17,890.20 and zero loans gives 62,136.68000000001, a 7.275957614183426e−12 difference. Unfunded 1,500.25 + 300.50 + 0.10 = 1,800.85. `DOCS/calculations/reviews/scripts/codex-2-cash-flow/recompute.mjs` reproduces these doubles.

### Match
Both totals and $62,137 rounded hub label match.

### Tolerance
Object equality is justified for the prescribed grouping and order; `1e−9` safely covers the old line-order comparison for the fixture. It is not a universal absolute bound for arbitrarily large lines.

### Wrong readings checked
Adding any excluded positive source role raises the 62,136.68 hub by that role's amount (the input contains none, so it supplies no fixed alternate total). Requested/funded-plus-unfunded uses exceed the 1,800.85 unfunded portion. Endpoint `max(in,out)` is a layout size, not either reconciliation total.

### Sources
An internal reconciliation identity and chart convention govern this record; no external primary source is cited.

### Record consistency
The statement and limits correctly distinguish engine totals from chart aggregation. Its example-library 32-year count is a measured observation, not a numeric property derivable from these five input lines.

### Evidence binding
`annualCashFlowReconciliation.drilldown.evidence.test.ts` asserts hub 62,136.68000000001, old sum 62,136.68, their printed amount, and 1,800.85 unfunded. `slice2Figures.parity.test.ts` covers library parity rather than independently proving its count.

### Verdict
**approve**.

## display-dollar-basis-conversion

### Recomputed
At 2.5%, exact factors are `(41/40)^5 = 1.131408212890625`, `(41/40)^10 = 1.280084544196357822418…`, `(41/40)^40 = 2.685063838389972731518…`. Left-to-right binary multiplication gives 1.1314082128906247, 1.2800845441963566 and 2.685063838389963. Exact-decimal 2036 and 2031 deflations are 781,198.401725726627 and 883,854.287609516904; the nominal 2036 FI target is 1,580,351.274750109223.

### Match
All worked factors and conversions match to the stated precision. A 41-row ledger would require engine execution to check bitwise ledger/plan factor identity, but the stated recurrence itself independently gives the displayed factors.

### Tolerance
Relative `1e−12` and $0.000001 are wider than the observed double error and much smaller than a cent. Exact start-year and pass-through assertions require no arithmetic.

### Wrong readings checked
Healthcare 4.5% gives factor 1.5529694217; the off-by-one 2036 deflation is 762,144.78217. Wrong-direction FI conversion gives 964,442.46249. `Math.pow` changes final bits; extrapolating to 2067 and using a fractional year contradict the specified domain.

### Sources
The basis is an internal ledger convention, with no external rate or statute cited. The exact power follows the worksheet's 2.5% input.

### Record consistency
Statement, formula and limits cover deterministic versus sampled inflation, start-year timing, and the whole-year approximation. The worksheet's later spending-page note is correctly in limits.

### Evidence binding
`dollarBasis.evidence.test.ts` checks every row's ledger/plan equality, exact-power tolerance, conversion values, FI target, wrong readings and refusals.

### Verdict
**approve**.

## guaranteed-income-owner

### Recomputed
Sam's pension starts 1964 + 65 = 2029, at 2,000 × 12 = 24,000 through 2034 (Sam's planning-age year). In 2035 Alex receives 24,000 × 0.5 = 12,000. Sam's life-only annuity starts 1964 + 66 = 2030, pays 12,000 through 2034, then zero. Thus the seven expected cells are 0, 24,000, 12,000, 0, 12,000, 12,000, 0 in table order.

### Match
All seven cells match.

### Tolerance
Amounts are whole dollars with zero COLA and inflation; $0.005 is conservative.

### Wrong readings checked
Using first-listed Alex's birth year starts the pension in 2027 and the annuity in 2028: 2028 pension/annuity would be 24,000/12,000 instead of 0/0. Treating life-only as joint pays 12,000 in 2035 instead of zero. In this listed order, the first-listed person **is** the pension survivor, so the last wrong reading agrees in 2035; reversing the list while preserving owners makes that wrong rule pay zero while the correct survivor payment remains 12,000.

### Sources
[26 CFR 1.72-5(b)(1)](https://www.ecfr.gov/current/title-26/section-1.72-5) expressly distinguishes first and second annuitants. [IRC 408(a), (b), (d)(3)(C)](https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm) covers IRA exclusive benefit, individual retirement annuity ownership and the surviving-spouse inherited-account exception; [IRC 402(c)(9)](https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec402.htm) covers spouse rollovers after death. These support named ownership and the spouse exception; the annual whole-year death/payment convention is the planner's model.

### Record consistency
The record names the owner and disclosures for repairs and the no-purchase-after-death refusal. Its source claim is a model-level reading of the cited provisions, with tax qualification limits outside the seven-cell income example.

### Evidence binding
`peopleNamed.evidence.test.ts` reads and asserts all seven worksheet cells and reverses the people while retaining ownership, which discriminates the last wrong reading. Cross-field tests separately check owner refusals.

### Verdict
**approve**, with the note that the last wrong reading is distinguished by the test's reversed-order case, rather than by the worksheet's listed-order values alone.

## household-later-retirement

### Recomputed
The stated person rule gives cases 1–13 respectively: 2030 Pat; 2030 Alex; 2028 Alex; 2030 Lee; 2031 Kim; 2026 Jo; 2026 Max; none; 2035 Cy; none; 2041 Gus; 2032 Ivy; 2028 Kay. The wage-end arithmetic (for example Lee 1970 + 60 − 1 = 2029, Gus 1966 + 75 − 1 = 2040) supports these results.

### Match
The worksheet table matches the prose rule, but **not the record's formula**. It says `year(p) = max(birthYear + retirementAge, lastWage(p) + 1)` and specifies that, with no paying wage stream, `lastWage(p)` takes the retirement age's year. In case 1 this gives Robin max(2027,2027+1) = **2028** and Pat max(2030,2030+1) = **2031**, instead of 2027/2030. The same shift affects cases 2, 5, 9 and other no-wage people with a retirement age.

### Tolerance
Years are exact integers; this is a one-year semantic defect, not rounding.

### Wrong readings checked
Defaulting absent age to 65 makes Sam 2029 and Jo 2029; last wage year gives Lee 2029 and death-year Sam 2059; year after death gives Sam 2060; first-listed choice gives Robin 2027 in case 1; ignoring Gus's wages gives Hal 2032; ignoring Ivy's retirement age gives 2025. Each differs from the appropriate stated answer.

### Sources
No statute governs the household retirement convention. The worksheet derives it from the stated wage payment window and planning-age model.

### Record consistency
The formula must use the retirement-age year directly when no wage stream pays, or use an absent `lastWage` sentinel that cannot win the `max`. As written it contradicts the statement, worksheet and evidence. Its limits otherwise describe the model's approximations.

### Evidence binding
`householdRetirement.evidence.test.ts` parses the worksheet table and asserts all 13 years/person/rules, reversed order, FI/funded-ratio linkage and no-retirement cases; no test checks the catalog formula as written.

### Verdict
**reject** — correct the no-wage branch of the record formula; case 1's formula currently yields 2028/2031, while the derived years are 2027/2030.

## hsa-contribution-limit-years

### Recomputed
2027 published self/family values are 4,500/9,000 at either plan inflation rate; two spouses' default halves are 4,500 each. Projecting 2028 one year at 2.5% gives 4,500 × 1.025 = 4,612.50, 9,000 × 1.025 = 9,225 (4,612.50 each), and age-55 self-only 4,612.50 + 1,000 = 5,612.50.

### Match
Every expected amount matches.

### Tolerance
The arithmetic lands on exact cents; $0.005 covers binary representation without accepting a wrong whole-cent result.

### Wrong readings checked
Growing 2026 bases into 2027 at 2.5% gives 4,510/8,968.75; at 4% it gives 4,576/9,100. Continuing the 2026 base to 2028 at 2.5% gives 4,622.75/9,192.96875 (9,192.97 rounded). Indexing the catch-up gives 5,637.50. All differ from the published-year method.

### Sources
[Rev. Proc. 2025-19 §2.01(1)](https://www.irs.gov/pub/irs-drop/rp-25-19.pdf) publishes 4,400/8,750 for 2026; [Rev. Proc. 2026-24 §§3.01(1), 4](https://www.irs.gov/pub/irs-drop/rp-26-24.pdf) publishes 4,500/9,000 effective for 2027. [IRC 223(b)(3)(B), (b)(5), (g)(1)](https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm) supplies flat $1,000 catch-up, indexing of base amounts, and equal marital division **unless the spouses agree on a different division**. The worksheet and record omit that operative exception. The 2028 plan-inflation figure is a disclosed projection, not a statutory limit.

### Record consistency
The record expressly discloses different inflation and statutory rounding after the latest published year, plus omitted coverage and Medicare eligibility modeling. It does not present 2028 as IRS-published. But it presents equal division as the owner limit without disclosing the statutory option for spouses to agree otherwise: with a 9,000 family base, a permissible 9,000/0 agreed division differs from the record's 4,500/4,500. The household total is unchanged, but owner-level credited contributions and balances can change.

### Evidence binding
`hsaLimitYears.evidence.test.ts` checks the 2027 year selection and all five worksheet amounts through contribution rows.

### Verdict
**reject** — the record and worksheet must identify equal spousal division as a model default and the limits must disclose the IRC 223(b)(5)(B)(ii) agreed-division exception; a permitted 9,000/0 allocation contradicts the asserted 4,500/4,500 owner amounts.

## joint-account-contributions

### Recomputed
Robin is paid ages 56–63, in 2026–2033 inclusive: eight 6,000 deposits yield balances 6,000 (2026), 18,000 (2028), 24,000 (2029), 48,000 (2033 and 2034).

### Match
The five numerical cells match the plain annual-contribution branch.

### Tolerance
Whole-dollar deposits and zero returns/inflation make $0.005 conservative.

### Wrong readings checked
Pat's wages alone give zero throughout; Pat's life alone stops after 2028 and leaves 18,000 in 2033. The claimed wrong reading “adding a wage test to a joint schedule” **cannot be recomputed from this worksheet**: it supplies no schedule, named schedule-age person or schedule amount. The 2026–2033 plain-contribution results are identical whether the schedule branch has a wage test or not.

### Sources
The rule is an explicit product convention, with no statute for cash or brokerage contributions.

### Record consistency
The record states a separate scheduled-contribution branch, including the named person's age after death, but the worksheet's single plain-contribution case does not derive or distinguish that branch. This is a material unproved branch, not wording.

### Evidence binding
`peopleNamed.evidence.test.ts` asserts the five plain-contribution balances and reversed people. `planCrossFieldChecks.test.ts` checks that a two-person joint schedule names an age person, but the named evidence test does not assert a numeric scheduled contribution without wages.

### Verdict
**reject** — add a worked schedule case with no household wages and assert its nonzero amount; the present worksheet cannot distinguish the schedule wage-test wrong reading or verify that part of the record.

## projection-summary-fi-spending-base

### Recomputed
Pat's retirement is 1980 + 50 = 2030 and Robin's is 1983 + 49 = 2032. In 2032 the conversion-free outflows are 80,000 + 8,000 + 0 = 88,000. With `1.03^6 = 1.194052296529`, FI is 88,000 / 1.194052296529 / 0.04 = 1,842,465.36470403958. Coast-FIRE divides this by `1.04^6 = 1.265319018496`, giving 1,456,127.14088029341. Robin's last year alive at 95 is 2078.

### Match
All expected year, person, rule, source and dollar values match to the displayed digits.

### Tolerance
$0.000001 is adequate for two divisions and integer powers and far below one cent.

### Wrong readings checked
Including the conversion tax gives 110,000 / 1.194052296529 / 0.04 = 2,303,081.70588004948, $460,616.34 higher. First-listed retirement gives 2030 rather than 2032. Four-year Coast discount gives 1,574,947.11557612536. The earlier-conversion/IRMAA example is an empirical ledger comparison; it cannot be recomputed from the 2032 row alone.

### Sources
The FI and conversion-free baseline are disclosed planner conventions; IRC 6013's joint-return rule does not itself prescribe an FI year. The method is therefore assessed against the worksheet's model, not asserted as law.

### Record consistency
Statement, formula and limits describe the later year, the single conversion-free projection, and the `conversionTaxIncluded` fallback when no such run is supplied. They disclose where no FI figure is priced.

### Evidence binding
`compareSummary.evidence.test.ts` reads the worksheet, asserts the FI basis, FI and Coast values, reverse-order parity and the 2,303,081.705880049 wrong reading. Separate named-request tests check conversion-free selection.

### Verdict
**approve**.

## sustainable-spending-result-simulation-count

### Recomputed
Seed 10,000 is probe 1; 20,000 and 40,000 are 2–3; 30,000, 25,000 and 22,500 are 4–6. The final bracket width is 2,500, so count is 6. In the infeasible case, seed and zero floor fail: count 2.

### Match
Both integer counts match.

### Tolerance
Exact integer equality is required; no rounding affects a count.

### Wrong readings checked
Omitting seed gives 5; recounting the two bracket endpoints gives 8; halving once at equality with the resolution gives 7. If the zero floor were feasible, the second case would continue, as the worksheet says.

### Sources
This is an internal deterministic search convention, with no legal source. The worksheet supplies probe feasibility; its $95,000/4-year evidence frontier is 23,750, which makes 22,500 feasible and 25,000 infeasible.

### Record consistency
The statement and limits include required-spending floor, no-probe and guardrail post-search exceptions; the worked cases are fixed-target and do not purport to test the guardrail exception.

### Evidence binding
`spendingSolver.simulationCount.evidence.test.ts` asserts six and two and the wrong counts; `spendingSolver.rounding.evidence.test.ts` separately asserts a guardrail count of ten.

### Verdict
**approve**.

## year-result-ltcg-zero-headroom

### Recomputed
With the 2026 single zero-rate threshold 49,450 and deduction 16,100: A = 49,450 − 37,000 = 12,450; B = 0 since 50,000 exceeds threshold. C solves 10,000 + g − 16,100 = 49,450, so g = 55,550. D solves g − 16,100 = 49,450, so g = 65,550. The projected 2027 threshold at 2.5% is 50,686.25.

### Match
All four exact roots and the projected threshold match.

### Tolerance
A/B's $0.005 and C/D's one-sided $0.01 bands are justified by the stated bisection widths; the exact analytical roots themselves are integers.

### Wrong readings checked
Opposite subtraction gives −12,450; no zero floor gives B −550. The 20% threshold would give A 545,500 − 37,000 = 508,500. Unindexed 2027 threshold is 1,236.25 too low. Ending C/D at the threshold gives 49,450, missing unused deduction by 6,100/16,100.

### Sources
The [IRS 2026 rate table](https://www.irs.gov/irb/2025-45_IRB) publishes 49,450 and 545,500 for single filers. [IRC 63](https://www.govinfo.gov/content/pkg/USCODE-2024-title26/pdf/USCODE-2024-title26-subtitleA-chap1-subchapB-partI-sec63.pdf) defines taxable income after deductions. The no-benefit derivation follows those provisions; future-year plan inflation is disclosed projection, not an IRS-published threshold.

### Record consistency
The record explicitly includes gains, dividends and benefit-responsive taxable income in the general search, while confining the closed-form examples to no benefits. Limits identify the search error and indexed-year approximation.

### Evidence binding
`simulate.ltcgZeroHeadroom.evidence.test.ts` checks A/B and one-sided C/D root bands, with wrong-reading checks; the 2027 index is a record/worksheet extension rather than a new numeric ledger assertion in that file.

### Verdict
**approve**.

## monte-carlo-success-rate-comparison

### Recomputed
Y: 948/1,000 − 912/1,000 = binary64 0.03599999999999992, or +3.6 points. Z and AC are zero. AA: 229/250 − 228/250 = 0.0040000000000000036, or +0.4 points. AB: 500/1,000 − 501/1,000 = −0.0010000000000000009, or −0.1 points. AD mismatches 1,000 versus 250 paths; AF mismatches 2026 versus 2027 starts, so both must be refused. `DOCS/calculations/reviews/scripts/codex-2-cash-flow/recompute.mjs` independently reproduces the doubles.

### Match
All synthetic expected values, signs and formatted points match. Case AE and the 29-example rates are empirical simulation results rather than numbers derivable from the worksheet's success counts; I did not independently rerun a market or tax simulation.

### Tolerance
Zero tolerance is justified for the stated binary64 quotient/subtraction order. Printed one-decimal points are a separate presentation rounding rule.

### Wrong readings checked
Reversing Y's subtraction gives −0.03599999999999992. Using 250 paths makes one path worth 0.4 rather than 0.1 point. Comparing 1,000 to 250 paths or different start years violates the inputs' shared-path premise. The earlier plan-id-seed example's +30.8 versus +25.1 points and the default-seed +25.2 versus +22.5 points are archived measurements, not independently reconstructed market runs. A constant +12 is not a difference of the displayed success rates.

### Sources
This is a stochastic comparison and product display convention, not a statutory formula; no external primary numeric source is cited. Common model, seed, count and start year are necessary to interpret the subtraction causally, while the comparison helper itself checks only count and start year.

### Record consistency
The statement makes the common model/seed a property of the Insight preview, not a guarantee of arbitrary calls to the comparison helper; this scope is important and is preserved. Limits disclose path granularity and omitted shortfall depth.

### Evidence binding
`stochastic.evidence.test.ts` asserts Y–AF including refusals and the per-plan tax-stack comparison. The UI parity test pins the headline/default-seed bracket-fill printed delta and the 10,000-path reuse. It does not pin every empirical example-library cell.

### Verdict
**approve**, with the empirical library rates treated as measurements and the exact worked-rate cases as the independent arithmetic fixtures.

## conversion-schedule-total

### Recomputed
U: 10,000.25 + 20,000.50 + 30,000.75 = 60,001.50. V left-to-right is 0.6000000000000001; W empty is zero. X is 48,123.46 + 51,234.57 + 0.51 = 99,358.54. Y empty is zero. Z's raw 15,000 + 15,000 = 30,000 and cleaned 15,000 + 5,000 = 20,000. Whole-dollar presentation gives $60,002, $1, $0 and $99,359 for U/V/W/X.

### Match
All supplied schedule-entry totals match. The example-library table supplies rounded totals without its underlying annual entries, so its exact underlying sums are not independently derivable from that table.

### Tolerance
Exact binary64 equality is appropriate for the specified left-to-right order, especially V. The displayed whole dollars use a separate rounding operation.

### Wrong readings checked
V's right-associated 0.1 + (0.2 + 0.3) is 0.6, a different final bit. Copying Z's raw total into its cleaned schedule leaves 30,000 rather than 20,000. A displayed empty schedule can be $0 even when a withheld cleaned schedule is nonzero, so it cannot label the cleaned total.

### Sources
This is a deterministic sum and a reporting convention. No statute or numeric outside source is cited.

### Record consistency
The record identifies raw, cleaned, winner and requested sums and discloses that nominal amounts from different years are added undiscounted. It does not call a withheld display list the cleaned executable schedule.

### Evidence binding
`optimizer.conversionTotal.evidence.test.ts` asserts U–Z, V's bit pattern, non-finite refusal, raw/cleaned publication and winner total. `OptimizePage.conversionTotals.parity.test.tsx` checks page labels and example parity.

### Verdict
**approve**.

## roth-conversion-annual

### Recomputed
Before conversion, taxable income is 70,000 − 16,100 = 53,900. The 22% bracket ceiling is the next bracket's start, 105,700, so headroom is 105,700 − 53,900 = 51,800, below the 100,000 traditional balance. Ignoring deduction gives 35,700; substituting the bracket's lower edge 50,400 gives −3,500, hence zero after a nonnegative clamp.

### Match
The no-benefit root matches. The worksheet provides no numeric benefit-phase-in fixture; it limits that branch to a monotonic bisection requirement.

### Tolerance
The analytical no-benefit root is exact; the stated bisection returns its lower bound within $0.01. A cent-rounded multi-owner split may be up to half a cent above the exact root; the record correctly avoids a one-sided bound on the executed multi-owner total.

### Wrong readings checked
The two numeric wrong readings are 35,700 and zero, both distinct from 51,800. With positive benefits, taxable benefits can rise as conversion raises provisional income, reducing room; a missing owner Roth destination can reduce the executed total below the sized household amount. A universal $0.005 tolerance is unsupported by a $0.01 bisection stop.

### Sources
The [IRS 2026 tax brackets and standard deduction](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) give 50,400, 105,700 and 16,100 for the stated single filer. The conversion sizing and owner allocation are planner models; the worksheet does not purport to derive their search algorithm from statute.

### Record consistency
Statement and limits distinguish the bisection-sized household target from the actually executed, owner-specific movement and disclose the owner-without-Roth drop. They confine the 51,800 shortcut to no benefits.

### Evidence binding
`annualAggregateRothConversionTargetPlan.evidence.test.ts` asserts 51,800 and the two numerical wrong readings; its benefit fixture asserts a smaller positive conversion, rather than an unsourced exact benefit amount.

### Verdict
**approve**.
