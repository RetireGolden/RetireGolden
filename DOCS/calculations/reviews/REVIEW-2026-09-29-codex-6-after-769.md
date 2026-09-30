# Review, 2026-09-29 (codex-6-after-769: the records #769 changed, derived by Claude)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `38f6c739` (after #769). Scope: the 8 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `aca-coverage-year-parameters`, `benefits-to-contributions-ratio`, `oasdi-paid-in-today-dollars`, `social-security-claim-break-even`, `social-security-expected-value`, `survivor-reduction-entitlement-month`, `survivor-switching-expected-value`, `spending-phase-person`. Verdicts: 4 approve, 4 reject. The reviewer's script is in `DOCS/calculations/reviews/scripts/codex-6-after-769/` (recompute.py), and runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with that repository path. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: **Codex (GPT-6-Sol, high reasoning), headless, read-only**  
Date: **2026-09-29 (America/New_York)**  
Repository commit: **38f6c739** (copy supplied for this review; this directory has no `.git` metadata)  
Scope: the eight requested calculation records, in the stated order. The repository was not modified or executed. Independent arithmetic is in [DOCS/calculations/reviews/scripts/codex-6-after-769/recompute.py](scripts/codex-6-after-769/recompute.py); it imports no `packages/` file. Its CPI inputs are the saved BLS publisher response, and its mortality inputs are the companion worksheet's transcription of SSA Table 4C6, checked against the live table's operative header and selected rows. Evidence tests were read, never run.

## aca-coverage-year-parameters

### Recomputed

Using exact decimals: 2027 one-person contiguous FPL = 15,960; MAGI/FPL = 183.035714285714%; read at integer 183, so the 150–200 band gives 4.30 + 33/50 × 2.48 = 5.9368%, rounded to **5.94%**. Contribution = 29,212.50 × .0594 = **1,735.2225**; annual credit = 12 × 1,055 − that = **10,924.7775**, and net premium = 1,735.2225. Alaska two-person FPL 27,050 and 400% cliff 108,200; Hawaii 24,890 and 99,560; contiguous one-person 63,840 and four-person 132,000. The 2028 no-published-block stand-in and the two 2027 support codes are categorical expectations.

### Match

Every numeric expected value agrees. The resolver/support-code expectations are asserted in the named evidence test; they are not arithmetic outputs.

### Tolerance

FPL and cliffs are integer exact; the applicable percentage is decimal exact after the specified hundredth-percent rounding. Dollar comparison at $0.005 permits ordinary floating-point representation while distinguishing a cent. The `1e-9` percentage tolerance is much smaller than the wrong-reading differences.

### Wrong readings checked

Inflating the 2026 FPL gives 16,041.25, 182.108626%, 5.73% and credit **10,986.12375**. Inflating the 2027 FPL gives 16,359, 178.571429%, 5.69% and **10,997.80875**. The 2026 table with the 2027 FPL gives 5.78% and **10,971.5175**. Interpolating at untruncated 183.035714% gives 5.9385714286% and **10,925.1948214**. Refusing 2027 instead yields no credit and gross premium 12,660. Each differs.

### Sources

[IRC 36B(d)(3)(B)](https://uscode.house.gov/view.xhtml?edition=2023&num=0&req=granuleid%3AUSC-2023-title26-section36B) selects the most recently published poverty line on the first regular-enrollment day. [26 CFR 1.36B-1(h)](https://www.ecfr.gov/current/title-26/section-1.36B-1) states the same timing and the higher-guideline rule for a move/separate-state marriage. [45 CFR 155.410(e)(5)(i)](https://www.ecfr.gov/current/title-45/section-155.410) requires the 2027 enrollment period to begin no later than November 1, 2026 and end no later than December 31. [HHS 2026 guidelines, 91 FR 1797](https://www.federalregister.gov/documents/2026/01/15/2026-00755/annual-update-of-the-hhs-poverty-guidelines) print 15,960/5,680, 19,950/7,100 and 18,360/6,530. [Rev. Proc. 2026-26 §3.01](https://www.irs.gov/pub/irs-drop/rp-26-26.pdf) prints the 2027 bands; [Rev. Proc. 2025-25 §3.01](https://www.irs.gov/pub/irs-drop/rp-25-25.pdf) prints the comparison bands. [Form 8962 instructions, Worksheet 2 line 4](https://www.irs.gov/instructions/i8962) say to drop digits after the decimal in the FPL percentage; [26 CFR 1.36B-3(g)](https://www.ecfr.gov/current/title-26/section-1.36B-3) supplies the interpolation/rounding rule. The published 2026 guideline was already effective in January 2026.

### Record consistency

Statement, formula, feeds and limits agree with the worksheet. The single-region limitation expressly discloses the higher-guideline exception, and the projected income-tax support code is informational rather than a claim that 2027 tax figures are final.

### Evidence binding

`packages/engine/src/params/acaCoverageYears.evidence.test.ts` parses the worksheet and asserts FPL, percentage, contribution, credit, net premium, support codes, regional cliffs and 2028 stand-in.

### Verdict

**approve**.

## benefits-to-contributions-ratio

### Recomputed

The independent survival sum gives A future PV **553,781.6126949862** / paid-in **225,418.2398526663** = **2.4566850183**. B future PV **546,898.0953318523** plus 36 × 3,559.424 = **128,139.264**; independent 1978–2017 OASDI tax restatement = **230,464.3163580016**, giving **2.9290320081**. P's average-sex future PV is (male + female)/2 = **286,306.7570113273**; history tax 116,507.46237712375 plus 17 × 3,720 = 179,747.46237712375, giving **1.5928278109**. Z has denominator zero and no ratio. These PVs use the worksheet's stated PIAs (3,364.40, 3,379.20, 2,859.40); I independently checked the cited COLA chain and tax totals, but did not independently rebuild the earnings-indexed PIAs from all historical AWI rows.

### Match

All recomputed ratio, PV, tax, pre-start and projected-work values match the expected table within floating-point noise, conditional on those PIAs.

### Tolerance

The `1e-12` relative tolerance is adequate for floating-point survival sums and division; exact PIA dimes, projected 63,240 and 36 × monthly benefit do not need it. It is not a substitute for an independent PIA fixture.

### Wrong readings checked

A's nominal one-rate denominator 119,306.60 gives the retired roughly 3.80 ratio when paired with its old PV. Using eligibility-year PIA gives the worksheet's 2.08 scale. Leaving B's pre-start receipts out gives **2.3730**. Adding A's employer tax to the denominator gives about **1.2195**, rather than 2.4567. Excluding P's projected 63,240 gives **2.4574**. **The last two claimed alternatives cannot be discriminated by any numeric worked case:** A, B and P have no wages in a benefit-paid year and no former-spouse record; pricing benefits in full during work or omitting a living ex's post-widowhood benefit therefore gives the *same* A/B/P values. The worksheet itself says this about wages. A qualitative ex comparison exists in the test, but no independently derived expected number or wage-withholding ratio exists in the worksheet.

### Sources

No statute defines this illustrative ratio. Its tax denominator follows [SSA's historical effective rates](https://www.ssa.gov/OACT/ProgData/taxRates.html), [SSA's contribution bases](https://www.ssa.gov/OACT/cola/cbb.html) and the saved [BLS CPI-U annual-average series](https://data.bls.gov/timeseries/CUUR0000SA0). [SSA Table 4C6](https://www.ssa.gov/OACT/STATS/table4c6.html) supplies survival probabilities. [Social Security Act §203(f)](https://www.ssa.gov/OP_Home/ssact/title02/0203.htm) establishes withholding before full retirement age, but the numeric ratio cases do not exercise it.

### Record consistency

The record says the get-back carries the earnings test and former-spouse timing. The worksheet's numeric derivation establishes neither. The stated limits disclose the pre-start-withholding omission and the unequal interest treatment, but they do not cure the absent discriminating cases.

### Evidence binding

`packages/engine/src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts` asserts A, B and P headline values from the worksheet and zero-denominator behavior. Its ex test compares relative values without a worksheet number; it has no wage-withholding ratio assertion.

### Verdict

**reject** — the worksheet cannot rule out the full-payment-during-work and former-spouse omissions claimed by the record; add independently computed numeric cases before marking this calculation reviewed.

## oasdi-paid-in-today-dollars

### Recomputed

From SSA rates/bases and BLS annual averages, the independent script obtains A nominal/today **115,702.20 / 225,418.2398526663** and employer **117,815.60 / 228,682.7139457432**; A-SE **231,758.45 / 448,161.5495308154** with zero employer share. B's four pre-1979 bases give 697.95 + 757.35 + 816.75 + 893.85 = **3,165.90**, or **17,644.7551948052** today, for both employee and employer. X excludes 1936 and self-employment 1950; 2030 adds **1,240** projected. P has 21 × 3,720 + 2 × 2,520 = **83,160** nominal, **116,507.46237712375** today; employer **85,560 / 119,992.6344310105**. Projected 2026–2042 tax = 17 × 3,720 = **63,240** per side.

### Match

Every Expected cell matches. The exclusions and projected-year lists match the method.

### Tolerance

Nominal/product totals are exact cents; `1e-6` absolute is harmless floating-point allowance. CPI division makes today's-dollar floats, for which `1e-12` relative is appropriate.

### Wrong readings checked

Applying 6.2% to every A year gives **119,306.60**, not 115,702.20; using trust-fund rather than effective employee rates gives **117,815.60**. Calling nominal A “today” misses **109,716.04**. B with an uncapped 20,000 each year at 6.2% gives **4,960**, not 3,165.90. Omitting P's projection loses **63,240**. Deflating its 17 future taxes from 2026 gives **52,284.6099**, not 63,240. Wage-indexing would use a different index than the specified BLS price index; it is a different economic question, not an alternative CPI arithmetic result.

### Sources

[SSA's tax-rate table and footnotes](https://www.ssa.gov/OACT/ProgData/taxRates.html) expressly distinguish effective 1984 employee 5.4%, 2011–12 employee 4.2%/self-employed 10.4%, and the unallocated 1984–89 self-employment credits. [SSA's base table](https://www.ssa.gov/OACT/cola/cbb.html) prints the four 1975–78 caps and 184,500 in 2026. Saved BLS response files in `DOCS/calculations/social-security/sources/bls-cpiu/` give 2025 CPI-U annual 321.943, 1982 96.5 and the rest of the years used here. The method follows those published values, while future indexing is an explicitly stated model convention.

### Record consistency

Statement/formula/feeds and limits match the worksheet. The limits name the 1984–89 self-employed-credit uncertainty, 2010 employer exception, price-only restatement, projected face-value work and post-2025 inflation stand-in.

### Evidence binding

`packages/engine/src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts` reads every expected table cell and asserts A, A-SE, B, X and P, including projected years and exclusions.

### Verdict

**approve**.

## social-security-claim-break-even

### Recomputed

With `B_c(a)=1.0B_c(a−1)+paid_c(a)` and 1.025 annual COLA, A's crossings are **75.7092432983, 77.4583921746, 79.5442737477**; cumulative values at 67 are 104,631.1276131/26,474.9521816 and at 80 are 392,235.6016373/437,338.4865020/441,330.2125059. At 5% reinvestment the three crossings are **80.7214849459, 82.3716113755, 84.5323198386**. B's age-62 amount is 21,000 × 1.025^32 = **46,278.8956932** and its age-80 amounts 1,108,194.7799356/1,235,625.2869023/1,246,903.2277676. C's cut moves crossings to **76.9587124416, 78.9959629657, 81.4029438770**, with age-80 amounts 349,882.1376952/376,833.5380133/366,304.0763799. D's first payment is 2,900 × 12 × 1.02^3 = **36,930.0384**, age-80 totals 589,918.1493948/591,352.8502456 and crossing **79.8748680761**. E: 2026–27 each pay 16,800 − 12,760 = **4,040**; 20 withheld months leave 40 early months from January 2031, so $18,800 annually afterward. Its age-63/67/80 claim-62 totals are **8,080/77,280/321,680** and crossings **77.2461538462, 79.4817518248, 81.5**.

### Match

All listed values match the independent recurrence script.

### Tolerance

`1e-9` relative dollars and `1e-9` absolute years are compatible with binary floating-point powers, sums and interpolation; the E integers and rational crossings need less allowance.

### Wrong readings checked

B's retired age-62 21,000 is a factor **2.20375694** too small; D's old 62 anchor is 1.02² too large. C without cut reverts to A's earlier crossings. Rounding cumulative dollars before interpolation changes A's 62/67 crossing from 75.7092432983 to **75.7092448836**, despite the same displayed tenth. E paid in full crosses at 77.667/79.370, and withholding without the FRA increase at 74.122/77.401. E's January FRA/entitlement dates make a non-January-month error deliberately nondiscriminating here; the record declares whole-year claims and month-level adjustment as its limit.

### Sources

[20 CFR 404.410(a)](https://www.ssa.gov/OP_Home/cfr20/404/404-0410.htm) prints 5/9% then 5/12% old-age reductions; [20 CFR 404.313](https://www.ssa.gov/OP_Home/cfr20/404/404-0313.htm) prints 2/3% delayed credits for post-1943 births; [SSA's 2026 earnings-test table](https://www.ssa.gov/OACT/COLA/rtea.html) prints $24,480 and $1 withheld per $2 excess. [20 CFR 404.412](https://www.ssa.gov/OP_Home/cfr20/404/404-0412.htm) supports later crediting of deduction months. Reinvestment return, haircut and whole-year claim payment are disclosed model choices, not statutory amounts.

### Record consistency

The record's recurrence, linear crossing, outputs and limits match the worksheet's model, including nominal year-by-year dollars, family-charge simplification and no grace year.

### Evidence binding

`packages/engine/src/socialSecurity/analysis/breakEven.evidence.test.ts` reads the worksheet rows and asserts the A–E crossings and headline cumulative values, including E's withheld-claim marker.

### Verdict

**approve**.

## social-security-expected-value

### Recomputed

The independent SSA-q survival sum gives S-A **313,555.14132604166**, S-B **315,847.1674443147**, S-C **153,219.49809342565**, S-D **255,722.3415744081** and S-E **14,797.895282906575**. Its independent death-year enumeration gives C-A **484,818.6638262612**, C-B **617,229.7407658283**, C-C **871,543.6107016269**, and C-E **249,094.7174424435**. C-A 2026 is 12 × (1,400 + 560 + 200×.65) = **25,080**; its 2026-death widow is **1,640.357142857**, S-C's 2028 monthly is **707.50**, C-B lower-earner monthly **960**, C-C's 2028-death survivor base **3,360**, and C-D's 2026-death widow **1,650**. C-G 67/67 is **831,489.0170119519**; 70/62 is H PV 333,274.5033112 + J ex-widow PV 529,224.3477764 + expected later switch to current-H widow 15,732.5738019 = **878,231.4248894264**.

For C-F, the independent month-and-death-path script reproduces 70/63 **860,375.9742084526**, 70/64 **859,491.0830312939**, 70/62 **856,075.9277281812**, all 64/66–70 and 65/66–70 rows, and both 4% rows to the stated tolerance. It does **not** reproduce 64/62–65 or 65/62–65: for example 64/62 gives **811,037.8511**, versus worksheet **811,011.8019**, and 65/63 gives **818,341.4906**, versus **818,338.1266**. These small path differences need reconciliation before an exact-head independent match can be claimed; I do not treat my provisional C-F figures as corrected authoritative values.

C-D has a clearer separate defect. The worksheet's **494,907.4355301572** is exactly reproduced if W's 1959 birth is treated as FRA **67** for her own claim at 67. [20 CFR 404.409(a)](https://www.ssa.gov/OP_Home/cfr20/404/404-0409.htm) instead gives birth in 1959 an old-age FRA of **66 years 10 months**, and [20 CFR 404.313](https://www.ssa.gov/OP_Home/cfr20/404/404-0313.htm) gives two monthly delayed credits, totaling 1⅓%, for a claim at 67. Under the worksheet's immediate claim-factor convention this yields W's own monthly **506.6667**, rather than 500, and C-D PV **495,924.4808189984**. Actual SSA credit-posting timing and dime rounding would need their own explicitly modeled treatment, but permanent factor 1 is unsupported.

### Match

S-A–E, C-A–C, C-E and C-G match. C-D differs by **1,017.0453** under the record's stated claim-factor convention; several C-F early-claim rows also fail the `1e-12` relative tolerance in an independent path model. This record cannot be approved.

### Tolerance

The accepted rows differ only in floating-point last places, for which `1e-12` relative and `1e-9` absolute are reasonable. The C-D gap and C-F $3–$60 path gaps are orders of magnitude larger.

### Wrong readings checked

The wrong reduced-half spouse benefit is C-A **650** rather than 690, and C-B **780** rather than 960; reducing C-A's widow at her own 62 age gives **1,592.86** after the properly ordered limit, rather than 1,640.36. Before-claim death gives C-D widow **2,000** rather than 1,650. Using the deceased's unearned age-70 credit in C-C gives **3,720** rather than 3,360. Withholding absent from C-F gives the cited higher 70/62 ranking; pre-entitlement month charging conflicts with the cited statute. For C-E, netting family room against 1,240 instead of the worker's 1,000 PIA leaves **260** rather than 400 spouse excess. The ratio-of-products survival reading agrees at integer ages, as the worksheet itself acknowledges, so it is not a discriminating wrong reading for these fixtures.

### Sources

[SSA Table 4C6](https://www.ssa.gov/OACT/STATS/table4c6.html) labels q(x) as the one-year death probability; the operative 2023 entries, including q(117)=.840457, q(118)=.882480 and q(119)=.926604, were checked. [20 CFR 404.410](https://www.ssa.gov/OP_Home/cfr20/404/404-0410.htm) gives old-age/spouse/widow reductions; [20 CFR 404.338](https://www.ssa.gov/OP_Home/cfr20/404/404-0338.htm) gives the 82.5% widow floor after the age reduction; [20 CFR 404.404](https://www.ssa.gov/OP_Home/cfr20/404/404-0404.htm) counts a worker's PIA toward the family maximum. [Social Security Act §203(f)(1)(A)](https://www.ssa.gov/OP_Home/ssact/title02/0203.htm) says excess earnings cannot be charged to a month before entitlement. [20 CFR 404.409/.313](https://www.ssa.gov/OP_Home/cfr20/404/404-0409.htm) establish the C-D FRA/credit discrepancy.

### Record consistency

The record's limits say a whole-year claim's months before its first entitlement month **“can be charged, but are not credited.”** Its worksheet's C-F example says those months **cannot be charged**, and §203(f)(1)(A) agrees with the worksheet. This is a direct source-facing contradiction that changes C-F numbers. The record also presents C-D as a source-grounded result without disclosing a 1959-born claimant's missing two-month delayed credit.

### Evidence binding

`packages/engine/src/socialSecurity/analysis/expectedValue.evidence.test.ts` reads and asserts the worksheet's S and C values, C-F rows, C-G rows and monthly headline values. Binding is strong, but it binds to the disputed values/limit.

### Verdict

**reject** — correct the pre-entitlement-month limit, adjudicate the 1959 DRC in C-D (model-convention recomputation **495,924.48**) and reconcile the C-F early-claim path differences.

## survivor-reduction-entitlement-month

### Recomputed

January 2029 minus June 1964 yields **775 months**; January 2027 minus September 1962 yields **772**; a configured 66y claim gives **792**. With survivor FRA 804 months, A's reduction is 1−.285×29/84, but the widow cap holds 2,000 at 1,650/month = **19,800**. B's 1−.285×32/84 on 2,600 exceeds the 2,145/month cap = **25,740**. C's e=792 also caps at **25,740**. D's uncapped e=772 gives 2,317.7142857/month = **27,812.5714286** annually; ten withheld *own* months do not raise it. E's four 2027 widow-withholding months raise e to 776 at her September 2029 survivor FRA, giving 2,353/month and **28,236** in 2030; 2029 is 8×2,317.7142857 + 4×2,353 = **27,953.7142857**.

### Match

All after-values, entitlement ages and the intermediate 2029 amount match. The historical before-values are alternate-old-order figures, not current expected values.

### Tolerance

Integer ages are exact; $0.005 dollars is appropriate for the displayed cents and rational 0.285×months/84 arithmetic.

### Wrong readings checked

Reducing A at own claim 744 with correct cap gives **19,114.29**, and with old cap order **15,769.29**; B analogous figures are **24,848.57** and **20,500.07**. Crediting D's ten own months gives **28,871.14** instead of 27,812.57. Crediting only three E widow months from January of FRA year gives **28,130.14**, instead of the September adjustment and 2030 28,236. December-of-death e=771 gives D **27,706.71**. For the day-before-birthday reading, a 1962-10-01 birth is **771** months in December 2026, versus **770** for 1962-10-02; the worksheet cases themselves have no first-day birthday, but the evidence test includes this discriminator.

### Sources

[Social Security Act §202(q)(6)(A)(iii), (7)(A)](https://www.ssa.gov/OP_Home/ssact/title02/0202.htm) starts the widow reduction period at widow entitlement (or 60, if later) and excludes deduction months of *that* benefit. [20 CFR 404.410(c)(1)](https://www.ssa.gov/OP_Home/cfr20/404/404-0410.htm) supplies the 28.5%/month formula; [20 CFR 404.412(b)](https://www.ssa.gov/OP_Home/cfr20/404/404-0412.htm) places the adjustment in the age-62 and survivor-FRA months. [20 CFR 404.621(a)(4)(ii)](https://www.ssa.gov/OP_Home/cfr20/404/404-0621.htm) permits choosing the death month, which the record explicitly excludes under its December-death/next-January ledger convention.

### Record consistency

Statement, `max(own claim, January-after-death age)` formula, feeds and limits accurately disclose the one-claim-age, year-end-death and former-spouse-date approximations.

### Evidence binding

`packages/engine/src/projection/internal/annualSocialSecurity.survivorEntitlement.evidence.test.ts` parses and asserts the A–E after-values and entitlement ages, and separately checks first-day age attainment.

### Verdict

**approve**.

## survivor-switching-expected-value

### Recomputed

Independent month-by-month benefit streams plus SSA-q survival sums reproduce **every** A, B, C, D and E ranking row in the worksheet's Expected table to floating-point noise; see `switch` lines in the scratch script. For example A survivor at 62: 2,400×(1−.285×60/84) = 1,911.428571/month, PV **423,379.4782211081**; A own62→survivor67 **385,837.9868067318**. B's drift/cut puts survivor60→own70 first at **281,757.0127928421** versus own62→survivor67 **278,144.5787973238**. C own65→survivor66 gives **535,281.9217035525**. D survivor60 stream is **9,400, 9,400, 10,350**, then 18,300 through 2032, 18,571.4286 in 2033 and 18,625.7143 later; PV **335,199.5745986541**. E survivor60 stream is **8,690, 8,690, 22,807.142857**, then 23,078.571429; PV **519,503.5943487089**. The independent A/B/C and D/E rows agree with all worksheet values.

### Match

The worksheet's numeric rows match the independent dynamic calculation. The *catalog formula* does not match the D/E method or values.

### Tolerance

`1e-12` relative accommodates only binary summation noise; D/E's month counts, 62/FRA adjustments and whole-year PV shifts are far larger. The A monthly amount meets `1e-9` absolute.

### Wrong readings checked

Cap-before-reduction gives A 62 **1,576.93/month**, versus 1,911.43; no cap gives A 67 **2,400**, versus 1,980. B without drift/cut instead ranks own62→survivor67 first at **357,348.57**. A duplicate “survivor62 then own” pays exactly the survivor-only stream, so a separate row is false differentiation. D paying full benefits produces the worksheet's seven-row ranking; the static no-withholding formula gives survivor60-only **333,919.2464**, versus 335,199.5746 after credits. E charging the pre-entitlement January/February months gives **515,104.70** rather than 519,503.59; omitting the age-62 adjustment as well gives **508,288.15**. For C, using worker FRA 67 instead of survivor FRA 66y10m changes the survivor-at-65 factor from 0.9235366 to 0.9185714. The first-day/January adjustment is a month-specific distinction, covered by D/E.

### Sources

[20 CFR 404.338(c)](https://www.ssa.gov/OP_Home/cfr20/404/404-0338.htm) applies the larger of the deceased's benefit and 82.5% of PIA as the widow limit; [20 CFR 404.409(b)](https://www.ssa.gov/OP_Home/cfr20/404/404-0409.htm) gives survivor FRA by birth cohort; [20 CFR 404.410(c)(1)](https://www.ssa.gov/OP_Home/cfr20/404/404-0410.htm) supplies the widow reduction. [20 CFR 404.412(b)](https://www.ssa.gov/OP_Home/cfr20/404/404-0412.htm) explicitly adjusts widow reductions at age 62 as well as FRA; [Social Security Act §203(f)(1)(A)](https://www.ssa.gov/OP_Home/ssact/title02/0203.htm) protects pre-entitlement months from the earnings test. [POMS GN 00204.035](https://secure.ssa.gov/poms.nsf/lnx/0200204035) says deemed filing does not apply to survivor benefits, so sequencing is a real choice.

### Record consistency

The statement describes the dynamic earnings-test and crediting method, but `formula.expression` is still `Σ S × max(W(s), P f(o)) × 12 × scale / discount` with constant **W(s)** and **P f(o)**. It contains no withholding, partial-month payment, age-62 adjustment or FRA adjustment. Applied to D survivor60-only it yields **333,919.25**, not **335,199.57**; applied to E it also cannot produce the worksheet stream. The formula is materially false for two of five worked cases, and the limits do not label it a no-wages special case.

### Evidence binding

`packages/engine/src/socialSecurity/analysis/survivorSwitching.evidence.test.ts` parses and asserts all ranking rows and separately checks D/E withholding, age-62 adjustment and duplicate collapse. It tests the dynamic statement while the catalog formula remains stale.

### Verdict

**reject** — replace or qualify the static catalog expression with the month-level paid-benefit recurrence used by D/E; its D survivor60 PV is **335,199.57**, not the formula's **333,919.25**.

## spending-phase-person

### Recomputed

Sam, born 1964, is 73 in 2037, 74 in 2038, 75 in 2039 and 85 in 2049. Thus 60,000×1 = **60,000** in 2037 and 2038; 60,000×.9 = **54,000** in 2039; 60,000×.8 = **48,000** in 2049. Alex reaches 75 in 2037, so a first-listed/older-person rule would instead give **54,000** in 2037 and **48,000** from 2047.

### Match

The four expected amounts match exactly.

### Tolerance

At zero inflation these are exact integer-dollar products; the stated $0.005 is a harmless float allowance.

### Wrong readings checked

First-listed/older-person selection is discriminated by 2037's 54,000 versus 60,000. **The younger-person wrong reading is not discriminated:** Sam is the younger person, so it gives the *same four numbers* as the correct named-person rule. **Stopping phases when the named person dies is also not discriminated:** Sam's planning death year is 2059, after Alex's 2054, and the four expected years all precede it; the plan has no surviving partner to generate a post-Sam year. The worksheet provides no alternate numeric case that distinguishes either mistake.

### Sources

This is a household modeling choice, not a tax or benefit law. The cited project decision D-PEOPLE-ORDER/R1 supplies the convention; no primary statute or published table is claimed. The worksheet's arithmetic supports the choice of Sam in its four pre-death years, but cannot establish its after-death sentence.

### Record consistency

The statement and formula claim that phases keep following the named person's age after death and that the named person, rather than an automatically chosen younger person, controls. The worksheet's inputs/Expected table establish neither distinction. The limits note legacy migration, but do not close the evidence gap.

### Evidence binding

`packages/engine/src/projection/peopleNamed.evidence.test.ts` asserts the four expected amounts and invariance to list reversal. It contains no post-named-death fixture; reversal still leaves Sam the younger person.

### Verdict

**reject** — add a case naming the older person and another where the named person dies before a surviving partner; the current wrong readings produce the same worked numbers as the intended rule.
