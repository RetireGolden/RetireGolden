# Review, 2026-09-29 (codex-1-social-security: the Social Security records)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 17 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `aime-covered-earnings-cap`, `aime-zero-year-count`, `covered-work-credit-estimate`, `cpi-u-annual-average`, `dual-entitlement-composition`, `oasdi-tax-rate-history`, `pia-cost-of-living-since-eligibility`, `social-security-claim-age-monthly-refinement`, `social-security-claim-age-sweep`, `social-security-claim-already-made`, `social-security-pia-resolution`, `ssdi-payable-months`, `survivor-benefit-rib-lim`, `survivor-convert-early-lever`, `survivor-shortfall-year-count`, `survivor-ssa44-premium-difference`, `zero-year-replacement-gain`. Verdicts: 14 approve, 3 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/codex-1-social-security/` (recompute.py, refine.py, table_check.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: **Codex (GPT-6-Sol, high reasoning), headless, read-only**  
Date: **2026-09-29** (America/New_York)  
Repository commit: **6f668e06** (supplied snapshot identifier; this copy has no `.git`)  
Scope: the 17 specified Social Security calculation records, their worksheets, cited primary sources, and named evidence tests. The engine, its tests and its scripts were not run; no `packages/` code was imported or implementation-function body read. Independent arithmetic is in `DOCS/calculations/reviews/scripts/codex-1-social-security/recompute.py`, `DOCS/calculations/reviews/scripts/codex-1-social-security/refine.py`, and `DOCS/calculations/reviews/scripts/codex-1-social-security/table_check.py`.

## aime-covered-earnings-cap

### Recomputed

Using SSA's AWI and base tables in `DOCS/calculations/reviews/scripts/codex-1-social-security/recompute.py`: A's 1978 amount is min(50,000, 17,700) = 17,700; indexed = floor(17,700 × 48,642.15 / 10,556.03) = 81,561. The kept 35 sum to 3,123,363; AIME = floor(3,123,363/420) = 7,436; PIA = floor-to-dime(0.9×895 + 0.32×4,502 + 0.15×2,039) = **2,551.90**. B starts in 1951, has 31 computation years, indexed earnings 20,151 and 21,210, AIME floor(41,361/372) = **111**, PIA **99.90**.

### Match

All after values match. The former A treatment gives 3,272,201 / 420 → AIME 7,790 and PIA 2,605.00; former B treatment gives 138,349 / 420 → AIME 329 and PIA 285.00.

### Tolerance

Year, indexed-dollar and AIME results are exact integers; PIA flooring makes tenths exact, so $0.005 is adequate and looser than needed.

### Wrong readings checked

Uncapped pre-1979 A gives 7,790/2,605.00; B with a 1947 start but the new caps gives floor(41,361/420)=98 and 88.20; capping after indexing gives AIME 4,755. Each differs from the relevant target.

### Sources

[42 U.S.C. §415(e)(1)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:415%20edition:prelim)) puts the wage limit before indexing; §415(b)(2)(B) begins computation base years after 1950. [SSA's contribution bases](https://www.ssa.gov/OACT/cola/cbb.html) give 17,700 for 1978 and the earlier ranges; [SSA's AWI series](https://www.ssa.gov/oact/cola/awiseries.html) gives the indexes used. The old-start alternative is disclosed.

### Record consistency

Statement, formula, feeds and limits describe the worksheet, including dollar rather than penny indexing, the 1951 floor, old-start omission, future-table stand-ins and later COLA.

### Evidence binding

`piaFromEarnings.wageBase.evidence.test.ts` reads the worksheet's A/B expected AIME and PIA, 1978 counted/indexed amounts and B's start and year count; it also checks the SSA base table.

### Verdict

**approve**.

## aime-zero-year-count

### Recomputed

All three windows have 40 base years and 35 retained years. A has 30 earning years and 10 zero base years, of which 5 remain; B has 37 earning years and 0 retained zeros; C has 5 earning years and 30 retained zeros. Independent AWI sums give AIMEs **7,487, 10,028, 793**.

### Match

All worksheet counts and AIMEs match.

### Tolerance

Counts and floored AIMEs are exact integers.

### Wrong readings checked

Counting all zero base years gives A **10**, rather than 5. Counting dropped zeros as retained adds five. Counting rows without restricting and aggregating by base year fails with an out-of-window or duplicate row; those are qualitative counterexamples, not additional worksheet inputs.

### Sources

[42 U.S.C. §415(b)(1)–(2)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:415%20edition:prelim)) divides the selected years' indexed earnings by their months and selects the largest base years after the five-year dropout. Counting zeros in the selected set follows that rule.

### Record consistency

Statement, formula, output and limit refer to the selected computation years, not all base years.

### Evidence binding

`piaFromEarnings.zeroYearCount.evidence.test.ts` asserts all three worksheet triples and A's ten zero base years separately.

### Verdict

**approve**.

## covered-work-credit-estimate

### Recomputed

A: floor(1,200/290)+floor(1,500/520)+floor(5,000/1,810)+floor(7,000/1,890) = 4+2+2+3 = **11**. B adds four from 1975 = **15**. C earns 4×10 = **40**; D retains the entered **12**; E ignores 1936 and aggregates two 2025 rows to 2,000/1,810 → **1**. `DOCS/calculations/reviews/scripts/codex-1-social-security/table_check.py` compares all **49** worksheet QC amounts with the saved SSA table; zero differences.

### Match

All case values, eligibility flags and 49 table entries match.

### Tolerance

Integer floors and counts justify exact comparison.

### Wrong readings checked

One 2025 divisor gives A/B **5/5**. Rounding partial credits upward under that divisor gives A **9**. Without the annual four-credit cap, $20,000 in 2016 would yield floor(20,000/1,260)=15, and two $7,240 rows in one year give 8 if capped per row instead of 4 per year. Adding to D's entered 12 is distinct from the override.

### Sources

[42 U.S.C. §413(a)(2)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:413%20edition:prelim)) distinguishes pre-1978 quarterly wages from annual portions after 1977. [SSA's QC page](https://www.ssa.gov/oact/cola/QC.html) states the four-per-year limit, pre-1978 $50 quarterly wages, and the historical amounts including 2026's $1,890. The annual pre-1978 count is explicitly an upper-bound estimate.

### Record consistency

The statement and limits disclose the quarterly-information and self-employment approximations, future stand-in and lack of insured-status determination.

### Evidence binding

`credits.evidence.test.ts` asserts A–E, duplicate-year aggregation and all 49 SSA table amounts.

### Verdict

**approve**.

## cpi-u-annual-average

### Recomputed

This is transcription, not a formula. `DOCS/calculations/reviews/scripts/codex-1-social-security/table_check.py` compares every worksheet year **1937–2025 (89 rows)** with the saved BLS data-viewer Annual column; no difference.

### Match

All 89 published annual averages match, including 1948 24.1, 1952 26.5, 1953 26.7, 1959 29.1, 1962 30.2, 1966 32.4, and 2025 321.943.

### Tolerance

Published decimal values are exact transcriptions; no computational tolerance is needed.

### Wrong readings checked

The worksheet's six monthly-mean alternatives differ by 0.1 from the published Annual column. A seasonally adjusted series or SSA wage index is a different series, not a competing value of CUUR0000SA0.

### Sources

The saved extract of the [BLS CUUR0000SA0 Annual column](https://data.bls.gov/timeseries/CUUR0000SA0?years_option=specific_years&from_year=1937&to_year=2025&include_graphs=false&output_view=data&annualAveragesRequested=true) supplies all 89 values; the committed BLS API M13 copies independently supply 69 of the years. The source labels it all-items, U.S.-city, not-seasonally-adjusted CPI-U.

### Record consistency

The record describes the annual published series, range, decimal precision, the missing October 2025 observation and post-2025 modeled inflation.

### Evidence binding

`cpiU.evidence.test.ts` compares every year with source extracts, checks the six mean discriminators, and verifies source digests.

### Verdict

**approve**.

## dual-entitlement-composition

### Recomputed

A: 560 + (1,200−800) = 960/month, claimant **11,520**, household 11,520+2,400×1.24×12 = **47,232**. B: 560+200×0.7375 = 707.50/month → **8,490**. C: 490+400×(1−(25+5×5/12)/100) = 781⅔/month → claimant **9,380**, household **32,260**. D: 630+300×(1−30×25/36/100) = 867.50 → **10,410**. E: 560+1,200×0.65 = 1,340 → **16,080**. F/G/H: **1,283⅓ / 1,500 / 1,240** monthly. I: **6,720** own-only in 2026; 560+1,200×0.679166… = 1,375/month → **16,500** in 2027.

### Match

Every expected after amount matches; the worksheet's former annual amounts 45,072, 7,800, 31,460, 9,360, 15,600 and monthly F 1,250 also recompute.

### Tolerance

Month ages are exact. Factors yield recurring thirds in C/F; $0.005 accepts their cent displays without concealing a material difference.

### Wrong readings checked

Old fallback gives claimant A/B/C/D **780/650/715/780** monthly. Using age 62 instead of spouse-start age gives A/B **820/690**. E with the own 0.70 on excess gives **1,400**. Adding delayed credits to G's excess gives **1,740**; omitting the outer max in H gives **1,100**. Moving B/D divorced entitlement one month earlier gives **706⅔/865 5⁄12** monthly. Starting I's spouse stream in 2026 gives **16,500**, not 6,720.

### Sources

[42 U.S.C. §402(q)(3), (k)(3), (r)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:402%20edition:prelim)) separates reduced own and spouse excess. [POMS RS 00615.250](https://secure.ssa.gov/poms.nsf/lnx/0300615250) says reduce the RIB then the excess; [RS 00615.694](https://secure.ssa.gov/poms.nsf/lnx/0300615694) covers DRC ordering. [RS 00615.015](https://secure.ssa.gov/poms.nsf/lnx/0300615015) confirms the first-or-second-day throughout-month rule.

### Record consistency

The record's formula and limits express the delayed-credit maximum, later spouse start, current/divorced yearly conventions, family maximum and disability restrictions.

### Evidence binding

`dualEntitlement.evidence.test.ts` asserts the start ages, A–I headline payments and wrong-reading contrasts.

### Verdict

**approve**.

## oasdi-tax-rate-history

### Recomputed

`DOCS/calculations/reviews/scripts/codex-1-social-security/table_check.py` expands the saved SSA source's historical ranges and its 1984 and 2011–2012 rate footnotes. All **90** worksheet rows for employee, employer and self-employed columns match that transcription. Examples: 1984 employee/employer/self-employed = **5.4/5.7/11.4%**; 2011–12 = **4.2/6.2/10.4%**.

### Match

The rows match the table, but the worksheet's claim that the column gives what **each payer actually paid** does not match the source for all payers.

### Tolerance

Rates are exact published decimal percentages; tolerance is not involved in the defect.

### Wrong readings checked

Using today's 6.2% for 1951 replaces 1.5%; trust-fund rather than effective employee rate gives 1984 **5.7%** and 2011 **6.2%** instead of 5.4% and 4.2%; doubling 1951's employee rate gives self-employed **3%** instead of 2.25%. A missing wrong reading is 2010 qualified-hire employer tax: the worksheet says **6.2%**, while the employer share was **0%** for covered qualifying wages.

### Sources

[SSA's Social Security Tax Rates, footnotes a–c](https://www.ssa.gov/oact/progdata/oasdiRates.html) states that 1984–89 self-employed credits offset **combined OASDI and HI** taxes; an OASDI-only effective amount cannot be assigned from this table. Footnote c also says most employers were exempt from the employer OASDI share on wages of certain qualified individuals hired after February 3, 2010. For $10,000 of such wages, worksheet 6.2% implies $620, versus **$0 employer OASDI tax** under the exemption. The source's general table is a trust-fund rate, not each payer's universal effective payment.

### Record consistency

The record does disclose the 1984–89 self-employed credits, but omits the 2010 employer exemption and gives one 6.2% employer rate as if it covered every 2010 payer. The worksheet's “actually paid” claim overreaches the source. Qualify the claim as general schedule rates and add the employer exception (or model employer-specific relief).

### Evidence binding

`oasdiTaxRates.evidence.test.ts` asserts all 90 table rows and rate adjustments, but its source parser/expectations do not test the source's 2010 employer-exemption sentence.

### Verdict

**reject** — the 2010 employer rate is not universally 6.2% actually paid; qualifying wages had a 0% employer share, and the limit omits it.

## pia-cost-of-living-since-eligibility

### Recomputed

`DOCS/calculations/reviews/scripts/codex-1-social-security/recompute.py` floors after each increase. A: **3,094.0 → 3,193.0 → 3,272.8 → 3,364.4**, annual 2027 **40,372.80**. B: **2,623.3, 2,665.2, 2,699.8, 2,859.0, 3,107.7, 3,207.1, 3,287.2, 3,379.2**. C: 3,364.4×1.02 floors to **3,431.6**, then **3,500.2**, annual **42,002.40**.

### Match

All chain, PIA and annual values match.

### Tolerance

Exact decimal annual percentage products followed by dime floors justify exact tenths; $0.005 permits binary-float evaluation.

### Wrong readings checked

No raises gives A **34,156.80/year**; no intermediate floor gives 3,364.512546… and **40,374.15/year**; skipping the eligibility-year 8.7% gives **3,095.10**, **37,141.20/year**. Applying a first-year increase as well would double count it against the ledger's year factor.

### Sources

[42 U.S.C. §415(i)(2)(A)(ii)–(iii)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:415%20edition:prelim)) requires dime flooring and includes an increase in the year of eligibility regardless of entitlement. [SSA's COLA series](https://www.ssa.gov/oact/cola/colaseries.html) confirms all cited percentages and the December effective convention from 1983.

### Record consistency

Statement, formula, feeds and limits distinguish derived from entered PIA, disclosed future assumptions, first-year handoff and no later-earnings recomputation.

### Evidence binding

`piaFromEarnings.costOfLiving.evidence.test.ts` asserts A/B chains, A/C annual payments and C's unannounced-year warning.

### Verdict

**approve**.

## social-security-claim-age-monthly-refinement

### Recomputed

R-A's 25 candidates are ages 68y0m–69y11m and 70y0m. The best eligible primary is **120** at 68y9m: **+20** primary, **−100** estate, one better-but-ineligible candidate. Independent coordinate search in `DOCS/calculations/reviews/scripts/codex-1-social-security/refine.py` gives R-B **(67y11m, 67y11m), +46, 335 distinct combinations, 6 passes**; R-C **(67y11m, 67y11m), +46, 455 combinations, 8 passes**.

### Match

All picks, changes, counts and passes match.

### Tolerance

Synthetic metrics and search counts are integers; exact comparison is justified.

### Wrong readings checked

Estate ranking in R-A chooses ineligible 68y5m (estate 900); one R-B pass stops at 66y3m/66y6m (primary 33), two at 66y9m/67y0m (45). Five passes in R-C leave 67y6m/67y8m, primary 62 (**+38**), short of 70. “Global monthly optimum” is unsupported by the fixed windows.

### Sources

The search is a product objective, not statutory math. [42 U.S.C. §402(a), (w)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:402%20edition:prelim)) supports the 62–70 worker claim window; it does not prescribe the coordinate search.

### Record consistency

The record states the canonical order, fixed windows, strict improvement, eligibility gate, cache and fixed-point bound, with the local-search limitation disclosed. **Its `formula.timing` nevertheless says “up to 25 per claim per pass.”** R-B and R-C start at 66y0m, so a single claim's window is 65y0m–67y11m: **3×12 = 36** candidate months. Twenty-five is only the count near a 69y0m winner (68y0m–69y11m plus 70y0m). The timing bound should be 36 per claim per pass.

### Evidence binding

`claimAgeSweep.refine.evidence.test.ts` asserts R-A's six headline cells and R-B/R-C picks, counts, changes and pass counts in both visit orders.

### Verdict

**reject** — the record's “up to 25 per claim per pass” timing bound is false; the worksheet's own R-B/R-C windows have 36 per claim.

## social-security-claim-age-sweep

### Recomputed

F1 sorts **70,67,62,69** with diagnostic 69 last; winner 70. F2's +0.2 wins at margin zero. F3's two eligible values 0 and −0.4 are flat; F4/F5 are aca-unpriced/ineligible; F6 is current-best. G claim years are **2020, 2023, 2022, 2032, 2026, 2024** in worksheet order. E's 67y6m baseline has **zero** exact whole-year current rows. H's unpriced years are **2028–2031**; I/J have already-claimed/disability verdicts.

### Match

All constructed ranking, date, current-row and verdict cells match the stated annual model. The S-E estate difference is defined from the plan as entered; no numeric estate result is supplied to recompute without the ledger.

### Tolerance

Synthetic rankings, dates, counts and labels are exact; `Object.is` of the reported subtraction is a structural assertion rather than a numerical tolerance.

### Wrong readings checked

Ranking F1's diagnostic 69 by its +30,000 would beat eligible 70's +25,000; treating F2 as flat would suppress a positive +0.2 winner. S-E's own 67y6m cannot equal a whole-year row. Treating 2026 as made excludes G's 1964-at-62 claim. The other wrong readings are UI/refusal-policy categories, not additional numerical worksheets.

### Sources

[42 U.S.C. §402(a), (w)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:402%20edition:prelim)) supports the claim window; [20 CFR 404.621](https://www.govinfo.gov/content/pkg/CFR-2025-title20-vol2/pdf/CFR-2025-title20-vol2-sec404-621.pdf) limits retroactivity; [26 U.S.C. §36B(d)(2)](https://uscode.house.gov/view.xhtml?req=(title:26%20section:36B%20edition:prelim)) includes nontaxable Social Security in Marketplace MAGI. The objective and refusal policy are explicitly model choices.

### Record consistency

The statement and limits track the sweep's exact annual convention, objective ranking, baseline, diagnostic refusal and two-stream scope.

### Evidence binding

`claimAgeSweep.evidence.test.ts` asserts S-F, S-G, S-E, S-H, S-I and S-J worksheet results, including the baseline subtraction.

### Verdict

**approve**.

## social-security-claim-already-made

### Recomputed

The model formula `birthYear + whole claim years < startYear` gives A **2020/made**, B **2026/open**, C **2026/open in 2026 and made in 2027**, D **2024/made and 2026/open**, E **2025/made and 2036/open**. These expected rows match.

### Match

All expected model rows match. C's literal 62y6m attainment date is December 15, 2026; the worksheet's wrong reading instead **rounds the age upward to 63 whole years**, giving a modeled claim year of 2027, which is different.

### Tolerance

Calendar years and booleans are exact.

### Wrong readings checked

`claimYear <= startYear` incorrectly holds B/C-in-2026 and D-at-64. Rounding C's 62y6m age **up to 63** gives 1964+63 = **2027**, rather than the record's 2026. That is a distinct, deliberately simplistic alternative, not C's actual calendar date. A birth near year-end would additionally test the disclosed birth-month approximation.

### Sources

[42 U.S.C. §402(a)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:402%20edition:prelim)) ties entitlement to application; [20 CFR 404.621](https://www.govinfo.gov/content/pkg/CFR-2025-title20-vol2/pdf/CFR-2025-title20-vol2-sec404-621.pdf) limits reduced-benefit retroactivity. The annual claim-year predicate is a disclosed modeling choice, not a legal date calculation.

### Record consistency

The record calls the year-only test an annual convention and discloses its birth-month limit. Its statement and formula match the worksheet's model.

### Evidence binding

`openClaims.evidence.test.ts` asserts A–E's expected model years and booleans. It distinguishes age-month ceiling in C from the record's whole-year rule; it does not separately test a calendar-crossing birth month.

### Verdict

**approve**, with a note that a birth near year-end would test the disclosed calendar approximation.

## social-security-pia-resolution

### Recomputed

E returns entered **2,500**. H's independent indexed 35-year sum is 3,369,438 → AIME **8,022**, 2022 PIA **2,846.40**; 2022–25 COLAs yield start PIA **3,364.40**, annual **40,372.80**. N has no input; R's eligibility year is **1977**, before the modeled formula's 1979 floor.

### Match

All statuses and monthly PIA values match.

### Tolerance

PIA values are floored tenths; the exact-to-dime criterion is appropriate.

### Wrong readings checked

Skipping COLA leaves H at **2,846.40**, $518/month below the resolved result. The example-couple 70-claim amount **43,152/year** is a claimed benefit, distinct from the primer's PIA×12 figure of about $35k.

### Sources

[42 U.S.C. §415(a), (i)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:415%20edition:prelim)) defines PIA and increases it after eligibility regardless of entitlement. [20 CFR 404.409](https://www.govinfo.gov/content/pkg/CFR-2025-title20-vol2/pdf/CFR-2025-title20-vol2-sec404-409.pdf) identifies full retirement age as the unreduced old-age age.

### Record consistency

Entered PIA, earnings-derived PIA, error cases, annualized primer and start-year units are described. Inherited AIME and future-COLA approximations are referenced by the component records.

### Evidence binding

`piaFromEarnings.resolution.evidence.test.ts` asserts E/H/N/R, H's eligibility PIA, and the $40,372.80 ledger headline.

### Verdict

**approve**.

## ssdi-payable-months

### Recomputed

For 2030 onsets blank/January/March/June/July, payable months are **7/6/4/1/0**, yielding **14,000/12,000/8,000/2,000/0**. October/December onsets start April/June 2031, **18,000/14,000** that year. November 2036 yields May 2037 SSDI **2,000** and June–December retirement **14,000**, total **16,000**. December 2036 has first payable June 2037 = FRA, so no SSDI; the model's 2040 claim-year amount is **29,760**. March 2030 onset gives five SSDI months in 2037 = **10,000**, then none in 2038.

### Match

Every expected modeled value matches. Seven actual June–December 2040 months would be **17,360** under month-level entitlement; the worksheet labels its 29,760 as an annual-engine convention.

### Tolerance

Whole months × $2,000 are exact. $0.005 is harmless but unnecessary in these cases.

### Wrong readings checked

No wait gives 24,000 in 2030; treating March as a first-day onset gives five months **10,000** in 2030; blank as a full year gives 24,000; all 2037 as SSDI gives **24,000** SSDI instead of 10,000 or 2,000. Statutory 2040 17,360 differs from the modeled 29,760.

### Sources

[42 U.S.C. §423(a)(1), (c)(2)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:423%20edition:prelim)) requires five full disabled months and ends disability payment before FRA; [20 CFR 404.316](https://www.govinfo.gov/content/pkg/CFR-2025-title20-vol2/pdf/CFR-2025-title20-vol2-sec404-316.pdf) confirms automatic old-age conversion. The SSA disability waiting-period guidance requires disability for the entire first waiting month.

### Record consistency

The record names day ambiguity, blank-month upper bound, timely filing, no-wait exceptions, annual SGA and claim-year overpayment in the no-schedule branch.

### Evidence binding

`disability.payableMonths.evidence.test.ts` asserts the onset table, both FRA edges, 2040 model/statute contrast, 2037 SSDI split and warnings.

### Verdict

**approve**.

## survivor-benefit-rib-lim

### Recomputed

A's factor is 1−0.285×60/84 = **0.796428571…**; min(2,400×factor, max(1,680,1,980)) = **1,911.428571…**, displayed 1,911.43; at FRA **1,980**. B: min(2,000×0.8575,1,650) = **1,650**. C: min(2,000×0.715,1,650) = **1,430**. D has no limit: 2,480×0.8575 = **2,126.60**.

### Match

All displayed after values and former values **1,576.93, 1,980, 1,414.875, 1,179.75, 2,126.60** match.

### Tolerance

The one repeating factor and cent displays justify $0.005 and 1e−12 for the factor.

### Wrong readings checked

Applying the cap first gives A/B/C **1,576.928571…/1,414.875/1,179.75**; no cap gives A-at-FRA **2,400** and B **1,715**. Limiting unreduced B inputs would wrongly give **1,650** instead of **1,715**. Replacing B's survivor FRA 66 with worker FRA 67 gives pre-limit **1,674.285714…** instead of 1,715, though **both final payments remain 1,650** because the cap binds. That last worksheet example distinguishes the factor, not the payable benefit; an uncapped case would make the payment distinction clearer.

### Sources

[42 U.S.C. §402(e)(2)(A), (C), (D)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:402%20edition:prelim)) supplies the deceased benefit base and the 82.5%/actual cap after age reduction. [POMS RS 00615.320](https://secure.ssa.gov/poms.nsf/lnx/0300615320) explicitly says the limit applies only when the reduced widow benefit exceeds both thresholds.

### Record consistency

The formula, ever-reduced flag and limits agree with the worksheet. The disclosed unmodeled disability variant and family maximum prevent a broader statutory claim.

### Evidence binding

`survivorBenefit.evidence.test.ts` asserts A–D, A's factor and an unreduced version of B. It does not separately assert the alternative FRA factor for B; the existing final B payment would not detect that error.

### Verdict

**approve**, with a note to add an uncapped survivor-FRA discriminator.

## survivor-convert-early-lever

### Recomputed

2026 taxable income before conversion is 92,200−32,200 = **60,000**; 12% top 100,800 leaves **40,800**. Own conversions 0/30,000/55,000 give lever conversions **40,800/40,800/55,000**. Tax at 100,800 is 2,480+0.12×76,000 = **11,600**; at 115,000 it is 11,600+0.22×14,200 = **14,724**. The retired replacement cuts 55,000 to 40,800. B's year reasons follow the stated order: raised, covered, no-balance, short, short, no-room, fill-limited, named-conversions.

### Match

All conversion, federal-tax, raised/covered count and reason cells match. The worksheet defines estate and lifetime-tax differences, but supplies no numeric full-projection values for those outputs. The record's written formula conflicts with a worked case even though the prose distinguishes target from execution.

### Tolerance

Given whole-dollar inputs, the worked conversions and federal tax are exact; $0.005 is a ledger-funding allowance. Reason and year counts are exact.

### Wrong readings checked

Replacement instead of addition loses **14,200** of the own 55,000 conversion and **3,124** of that year's tax. Without capping to convertible balance, cash-only would falsely request 40,800. A target-based “covered” label fails when actual conversion is 0 against 40,800; the Roth-owner and no-Roth cases are distinct short results.

### Sources

[IRS Rev. Proc. 2025-32, Table 1 and §4.14](https://www.eitc.irs.gov/pub/irs-drop/rp-25-32.pdf) gives the 2026 $100,800 12% top, $11,600 tax there and $32,200 joint standard deduction. [26 U.S.C. §6013(a)(2)](https://uscode.house.gov/view.xhtml?req=(title:26%20section:6013%20edition:prelim)) permits a joint return in the death year. Adding rather than replacing conversions is the named owner decision.

### Record consistency

The statement describes an **aggregate conversion target**. The formula instead says `conversion(y) = max(own(y), min(fill12(y), convertible(y)))`, which reads as executed conversion. L-B “Roth IRA is Sam's” has own 0, fill 40,800, convertible 500,000, so that formula gives **40,800**, while the worksheet's executed conversion is **0** because Pat has no Roth account. The same contradiction occurs with no Roth account. Rename the left side `target(y)` and describe the execution shortfall separately.

### Evidence binding

`survivorTransition.lever.evidence.test.ts` asserts L-A conversion/tax values and L-B year reasons and messages, including the replaced-strategy counterexample.

### Verdict

**reject** — the record formula overclaims 40,800 executed conversion in L-B's Roth-owner case, whose expected execution is 0.

## survivor-shortfall-year-count

### Recomputed

2040 is excluded; 2041=0 and 2042=0.004 do not exceed 0.005; 2043=0.006 and 2044=1,200 count; 2045 has nobody alive. Total **2**.

### Match

The worksheet's count matches.

### Tolerance

Strict comparison with the stated $0.005 threshold produces an exact integer count.

### Wrong readings checked

Including 2040, 2045, or the 2042 subthreshold remainder separately yields **3** in each case. Total/discretionary shortfall is a different input field, not this worksheet's required-shortfall series.

### Sources

This is a product count, with no claimed statutory formula. The worksheet's named funding tolerance and `requiredShortfall` definition are the operative authority.

### Record consistency

The record's statement, formula and limits identify base run, years after death, alive condition, strict threshold and required spending only.

### Evidence binding

`survivorTransition.shortfall.evidence.test.ts` asserts the C-A count from the worksheet.

### Verdict

**approve**.

## survivor-ssa44-premium-difference

### Recomputed

2040 savings **2,000**, 2041 **1,900**, 2042 **−10**. Relief-year subtotal = **3,900**; whole-run sum = **3,890**.

### Match

Both worksheet amounts match.

### Tolerance

Whole-dollar synthetic premiums make the sums exact.

### Wrong readings checked

Using only relief years as the displayed total would give **3,900**, $10 too high; including the death year is not supported by the supplied rows. A present-value interpretation would require discounting inputs absent from this worksheet.

### Sources

[20 CFR 418.1205(a)](https://www.govinfo.gov/content/pkg/CFR-2025-title20-vol2/pdf/CFR-2025-title20-vol2-sec418-1205.pdf) lists a spouse's death as a life-changing event. The two-year relief window and whole-run difference are disclosed engine conventions, not statutory premium formulas.

### Record consistency

The statement and formula distinguish whole-run savings from two relief years; limits name later knock-ons and mixed-year nominal dollars.

### Evidence binding

`survivorTransition.ssa44.evidence.test.ts` asserts both **3,890** and **3,900** and a truncated common-year case.

### Verdict

**approve**.

## zero-year-replacement-gain

### Recomputed

`DOCS/calculations/reviews/scripts/codex-1-social-security/recompute.py` gives A base sum **3,144,650**, AIME 7,487, PIA **3,141.70**; adding 60,000 in 2027 gives AIME 7,630 and PIA **3,187.40**, gain **45.70**. B caps 300,000 at 184,500: AIME 7,926, PIA **3,252.10**, gain **110.40**. C's AIME **12,252→12,692**, PIA **3,901→3,967**, gain **66**. N has no retained zero. O's AIME **6,534→6,653**, PIA **2,520.30→2,538.20**, gain **17.90** in eligibility dollars; separate 2020–25 COLA chains give **3,195.60→3,218.10**, gain **22.50** in 2026 dollars.

### Match

All supplied years, PIAs and gains match.

### Tolerance

Dollar and dime floors with decimal inputs produce exact tenth-dollar results; 1e−9 accommodates floating-point representation.

### Wrong readings checked

Raw-tier estimate B is 300,000/420×0.32 = **228.5714…**, versus 110.40; C's raw-tier estimate is 300,000/420×0.15 = **107.1428…**, versus 66. An 1988 replacement would be capped to 45,000 and indexed by 69,846.57/19,334.04, unlike the unindexed 2027 sample. O's eligibility gain **17.90** is distinct from its start-year **22.50**.

### Sources

[42 U.S.C. §415(a)(1), (b)(1)–(3)](https://uscode.house.gov/view.xhtml?req=(title:42%20section:415%20edition:prelim)) specifies bend rates, dime floor, indexed earnings and the AIME divisor; [SSA AWI](https://www.ssa.gov/oact/cola/awiseries.html) and [SSA contribution bases](https://www.ssa.gov/OACT/cola/cbb.html) supply the source data. The stand-in for 2026 AWI and future base is disclosed.

### Record consistency

Statement, formula, output and limits describe a rerun on the latest zero base year, the existing computation's approximations and the start-year COLA difference.

### Evidence binding

`piaFromEarnings.zeroYear.evidence.test.ts` asserts A/B/C/O worksheet amounts and N's no-gain case. Its O check without `asOf2026` expects the 17.90 eligibility gain, while `expectGain('O', ..., asOf2026)` separately asserts 22.50; those are consistent.

### Verdict

**approve**.

## Result

**14 approve, 3 reject.** The rejects concern an undisclosed actual-tax exception, a false month-search bound, and a conversion formula that describes a target as executed dollars. No source or arithmetic mismatch was found in the other worked expected values.
