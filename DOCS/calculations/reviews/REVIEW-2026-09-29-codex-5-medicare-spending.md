# Review, 2026-09-29 (codex-5-medicare-spending: the Medicare, ACA and spending records)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 11 records below, derived by claude, so the reviewer is of a different agent family from the deriver (catalog gate 7): `aca-contract-premium-basis`, `aca-expected-contribution`, `display-net-care-cost-annual`, `spending-healthcare-annual`, `display-total-spending-annual`, `display-upside-shortfall-annual`, `display-upside-spending-annual`, `guardrail-threshold-dollars`, `solved-initial-withdrawal-rate`, `solved-spending-rounding`, `spending-shape-comparison`. Verdicts: 9 approve, 2 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/codex-5-medicare-spending/` (recompute.mjs), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Verbatim output follows.

---

# Independent calculation-record review

Reviewer: **Codex (GPT-6-Sol, high reasoning), headless, read-only**  
Date: **2026-09-29**  
Repository commit: **`6f668e06`** (supplied with the review scope; this copy has no `.git` directory to verify it)  
Scope: the eleven specified Medicare/ACA and spending/withdrawal records, their worksheets, named evidence tests, and cited primary sources. The repository was not changed. Arithmetic below was independently computed by hand and with [`DOCS/calculations/reviews/scripts/codex-5-medicare-spending/recompute.mjs`](scripts/codex-5-medicare-spending/recompute.mjs), which imports nothing. No engine, repository script, or test was run, and no listed implementation-function body was read.

## 1. `aca-contract-premium-basis`

### Recomputed

A has 12 + 6 covered months in 2026: `18 × 800 = 14,400` for enrollment and benchmark, with two living tax-family members and contiguous-region FPL; Alaska gives `alaska`. In 2027 Alex alone gives `12 × 800 × 1.045 = 10,032` on plan rates and `12 × 800 × 1.05 = 10,080` on the path. B-stated gives `24 × 700 = 16,800` in 2026 and `12 × 700 = 8,400` in 2027 after Drew's death year; its unchanged two-person stated family then raises `tax-family-member-unknown`. B-derived gives `12 × 700 × 1.045 = 8,778`, family size one. The year of death remains charged under the stated annual convention.

### Match

All nine numeric expected entries and the stated region, basis, and support-code outcomes match.

### Tolerance

The quoted `$0.005` accommodates binary64 multiplication of decimal rates; the family sizes and categories are exact. It is wider than these examples need, but below a cent.

### Wrong readings checked

No growth yields **9,600** instead of 10,032; plan-rate growth on the 3% path yields **10,032** instead of 10,080; growing B's stated 2027 quote yields **8,778** instead of 8,400; charging deceased Drew yields **16,800** instead of 8,400; retaining Drew in the derived family gives **2** instead of 1. `exampleSourceId` is an invariance claim, not an alternative number; the named test compares otherwise identical results with and without it.

### Sources

[45 CFR 155.430(d)(7)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-155/subpart-E/section-155.430) sets the last enrollment day on death at the date of death. [26 U.S.C. 36B(c)(2)(A)](https://uscode.house.gov/view.xhtml?edition=prelim&f=treesort&num=0&req=%28title%3A26+section%3A36B+edition%3Aprelim%29+OR+%28granuleid%3AUSC-prelim-title26-section36B%29) requires coverage on the first day of a credit month. The modeled full death year departs from actual dates, and both worksheet and record disclose that annual approximation. Premium-field inflation, equal SLCSP, and tax-family construction are product assumptions, not claims prescribed by either source.

### Record consistency

Statement, formula, outputs `[]`, and feeds describe the worksheet. The limits expressly name the death-year overcharge, stated-quote behavior, equal-SLCSP assumption, and family-structure refusals. The formula's `m < M_i` presumes zero-based month indices; the prose and examples remove the possible one-based ambiguity.

### Evidence binding

`effectiveAcaYearContract.evidence.test.ts` reads the worksheet expected rows and asserts the A/B premium totals, family sizes, Alaska region, basis, support code, path-specific inflation, and `exampleSourceId` invariance.

### Verdict

**Approve.**

## 2. `aca-expected-contribution`

### Recomputed

For two people, FPL is `15,650 + 5,500 = 21,150`; `42,300 / 21,150 × 100 = 200%`; `42,300 × 6.60 / 100 = $2,791.80`. For one person, `28,500 / 15,650 × 100 = 182.10862619808307…%` (exactly `57,000/313%`), so the table is read at 182. Its interpolated rate is `4.19 + 32/50 × 2.41 = 5.7324%`, rounded to **5.73%**, and the contribution is **$1,633.05**.

### Match

The money and applicable-rate results match. The second case's written `182.1086%` differs from the independently computed FPL percentage by about **0.0000261981 percentage point**. The worksheet calls this a “published unrounded” value and then specifies **exact** tolerance for FPL percentage. Those cannot both hold.

### Tolerance

Exact is justified for FPL and the first case's 200%, but **not** for a four-decimal rendering of the second case. The corrected expectation is `57,000/313%` as a rational, or `182.10862619808307%` with a stated numeric tolerance such as `1e-9`. The evidence test actually uses `182.1086261981` with `1e-9`, so its tolerance and value are sound. `$0.005` for contribution and `1e-9` for the rounded applicable percent are adequate.

### Wrong readings checked

First-person FPL alone yields `270.2875399361…%`, read at 270, an interpolated **9.05%** and **$3,828.15** rather than $2,791.80. Treating 6.60 as a fraction gives **$279,180**. On the second case, reading the untruncated FPL percentage yields rate `5.7376357827…%` and **$1,635.23** unrounded; rounding that rate first gives **$1,635.90**. Truncating FPL percentage but failing to round the rate gives **$1,633.734**, or $1,633.73 to cents. Each numerical alternative differs from the expected contribution.

### Sources

The [2025 HHS poverty table](https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf) lists $15,650 for one person and $21,150 for two. [Rev. Proc. 2025-25](https://www.irs.gov/pub/irs-drop/rp-25-25.pdf) lists 4.19% to 6.60% over 150%–200% FPL and 6.60% at 200%. [IRS Form 8962 instructions, Worksheet 2 line 4](https://www.irs.gov/instructions/i8962) direct dropping digits after the decimal in the FPL percentage; [26 CFR 1.36B-3(g)(1)](https://www.govinfo.gov/content/pkg/CFR-2025-title26-vol1/pdf/CFR-2025-title26-vol1-sec1-36B-3.pdf) directs linear interpolation and rounding the rate to 0.01 percentage point. The IRS instructions for lines 8a and 8b also direct whole-dollar rounding, which the model openly omits. The record's cited [Rev. Proc. 2026-26](https://www.irs.gov/pub/irs-drop/rp-26-26.pdf) and [2026 HHS poverty table](https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf) support its separate 2027 parameter attribution; this worksheet has no 2027 example.

### Record consistency

The statement, formula, outputs `[]`, feeds, and limits correctly describe truncation, interpolation, rate rounding, and the omitted Form 8962 dollar rounding. The numeric defect is in the worksheet's second expected percentage and tolerance, not the record's formula.

### Evidence binding

`aca.evidence.test.ts` asserts 21,150, 200%, $2,791.80, the 5.73% rate, $1,633.05, and rejection of the three second-case wrong dollar readings. It uses the more precise FPL percentage rather than the worksheet's `182.1086`.

### Verdict

**Reject.** Amend the worksheet's second FPL percentage and its tolerance as above; the current “exact” expected value fails its own criterion.

## 3. `display-net-care-cost-annual`

### Recomputed

A: `72,000 − 54,000 = 18,000`; B: `60,000 − 0 = 60,000`. In C, binary64 evaluates `53,932.241304 − 10,756.3` as `43,175.94130400001` and the summed benefit as `53,932.24130400001`; the difference is `−7.275957614183426e−12`, floored to **+0**. The refused row has difference about `−0.01`, below `−0.005`. The ledger construction's first cap is `501.68 × 12 = 6,020.16`; adding its remainder gives benefit `53,932.240000000005`, difference `−7.275957614183426e−12`, and net 0.

### Match

All four direct outcomes and the ledger residue match.

### Tolerance

The displayed outputs are exactly 18,000, 60,000, and +0 in binary64; the half-cent refusal threshold easily separates the one-ULP residue from a real one-cent overpayment. No output tolerance is needed.

### Wrong readings checked

Without the floor C is negative by `7.28e−12`; gross-only A is **72,000**; benefit-only A is **54,000**; adding cost and benefit gives **126,000**; reverse subtraction floored gives **0** instead of 18,000. A silent clamp would turn the refused row into 0 rather than an error.

### Sources

This is ledger conservation and a floating-point display rule; the worksheet cites no external law or published table. The arithmetic of capping each policy by remaining episode cost supports the nonnegative exact-value claim.

### Record consistency

The statement, formula, output, and limits name the floor, half-cent refusal, and possible residue difference from `expenses.total` without promising more than the worksheet establishes.

### Evidence binding

`yearFigures.evidence.test.ts` asserts A/B, the exact C residue and +0, the refusal, and a constructed two-policy ledger year.

### Verdict

**Approve.**

## 4. `spending-healthcare-annual`

### Recomputed

Using the worksheet's stipulated $3,582.72 annual Medicare intermediate, person one is `3,582.72 + 50 × 12 × 1.10 = 4,242.72`; person two is `400 × 4 × 1.10 + 3,582.72 × 8/12 + 50 × 8 × 1.10 = 1,760 + 2,388.48 + 440 = 4,588.48`. The household is **$8,831.20**. This verifies the composition *conditional on that intermediate*.

### Match

The arithmetic matches the worksheet within tolerance, but the intermediate does **not** match the cited 2026 published tier. CMS lists a tier-one Part B total premium of **$284.10/month** and Part D IRMAA **$14.50/month**. Thus the annual Part B-plus-Part D-surcharge intermediate is `(284.10 + 14.50) × 12 = $3,583.20`, **$0.48 higher**. With that published value, person one is **$4,243.20**, person two **$4,588.80**, and the household **$8,832.00**, **$0.80 higher** for 20 Medicare months.

### Tolerance

`$0.005` is reasonable for binary64 proration and inflation, but cannot cover the **$0.80** source discrepancy. The published monthly premiums are to cents; their 12-month sum is exact to cents in decimal arithmetic.

### Wrong readings checked

Omitting marketplace inflation gives **$1,600** for its component and **$8,671.20** for the worksheet-based household. Forgetting the second person's eight Medicare months gives **$6,002.72**. Inflating the already priced Medicare intermediate again gives first-person **$4,600.992** and household **$9,428.32**. For the credit-on branch there is no complete quote or funding input from which to compute a rival number; the worksheet correctly treats gross retention as wrong only in an actionable year.

### Sources

The [CMS 2026 Part B and Part D tables](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles) put a single MAGI above $109,000 through $137,000, or joint MAGI above $218,000 through $274,000, in the tier with **$284.10** total Part B and **$14.50** Part D adjustment per month. The worksheet's `$3,582.72` corresponds to `$284.06 + $14.50` per month, using `202.90 × 35/25` for Part B, which departs from the published premium. For its separate below-100%-FPL limit, [26 CFR 1.36B-2(b)(6)](https://www.govinfo.gov/content/pkg/CFR-2025-title26-vol1/pdf/CFR-2025-title26-vol1-sec1-36B-2.pdf) expressly preserves applicable-taxpayer status when the Exchange estimated 100%–400% FPL at enrollment and advance credit was paid; the record discloses that its model does not handle this exception.

### Record consistency

The statement describes the worksheet's credit-off composition and the conditional credit-on substitution. Its displayed `formula.expression`, however, is an unconditional sum containing **gross marketplace premium**; it omits the actionable year's economic-net-premium substitution and is therefore not a general formula for its output. The limits disclose the omitted below-100% exception and fixed-point fallback, but not the CMS tier-premium discrepancy.

### Evidence binding

`annualHealthcareExpenses.spendingHealthcare.evidence.test.ts` constructs the two people, asserts the **$3,582.72** intermediate and **$8,831.20** household total, and distinguishes the three numeric wrong readings. It binds the worksheet's number, including the source error.

### Verdict

**Reject.** Correct the 2026 tier-one intermediate to **$3,583.20** and the worked household total to **$8,832.00** (with corresponding evidence), and make the record formula conditional on credit actionability.

## 5. `display-total-spending-annual`

### Recomputed

A: `(64,321.50 + 7,000.25) + 500 = 71,821.75`. B's decimal total is 59,370.51; binary64 left association prints `59370.51`, while `40,477.35 + (18,353.95 + 539.21)` prints `59370.509999999995`.

### Match

Both expected outputs and the one-ULP association distinction match.

### Tolerance

A is exact binary64. `$0.000001` comfortably covers B's last-bit alternative, while the evidence pins the intended association bit for bit.

### Wrong readings checked

Without penalties A is **71,321.75**; without tax it is **64,821.50**. Right association differs by about `7.28e−12` in B. Intended spending, net portfolio need, and care cost added again need separate ledger inputs to yield a rival number; they are distinct definitions rather than numeric alternatives for these two rows.

### Sources

The worksheet cites a product ledger convention, no statute or published table. It expressly says the figure is gross outflow, with taxes and penalties included.

### Record consistency

Statement, formula, output, and limits agree, including the significant left-to-right association and the distinction from portfolio need.

### Evidence binding

`yearFigures.evidence.test.ts` asserts A and B, rejects omitted tax/penalty and the alternate binary64 association, and checks the formula on a constructed ledger year.

### Verdict

**Approve.**

## 6. `display-upside-shortfall-annual`

### Recomputed

A is `4,200 + 3,000.35 = 7,200.35`; B is `0.20 + 0.25 = 0.45`; C is 0. B's old four-way outer sum is `0.30 + 0 + 0.20 + 0.25 = 0.75`, but all displayed pieces remain at or below 0.50, so both old and new cells appear empty. C's target-only cell is **Target $1,250**, with upside still 0.

### Match

All expected values and display-gate outcomes match.

### Tolerance

`$0.000001` for A and `1e−12` for B are justified by decimal fractions in binary64; C is exact.

### Wrong readings checked

Including lower-layer shortfalls changes C's upside from **0** to **1,250**. Reading the entire portfolio shortfall or upside intent requires inputs not provided for these cases; neither is numerically established by this worksheet.

### Sources

This is the product's layer-attribution convention; the worksheet cites no external legal or published table.

### Record consistency

Statement, formula, output, and limits define the same two-layer sum. The display-cell note correctly distinguishes the sum from its show-or-blank gate.

### Evidence binding

`yearFigures.evidence.test.ts` asserts 7,200.35, 0.45, and 0, plus B's old 0.75 sum and false new gate.

### Verdict

**Approve.**

## 7. `display-upside-spending-annual`

### Recomputed

A: `12,000.40 + 3,000.35 = 15,000.75`; B: `0.30 + 0.10 = 0.4`, below the 0.50 display gate; C: `8,000 + 0 = 8,000`.

### Match

All expected values and the blank B cell match.

### Tolerance

`$0.000001` for A and `1e−12` for B cover binary64; C is exact.

### Wrong readings checked

Ideal-only A gives **12,000.40**, missing $3,000.35. Intended total, target-only, and funded upside are different concepts, but the worksheet supplies neither target nor shortfall amounts for a numeric comparison.

### Sources

This is a product definition of the two layers above target; no statute or external table is cited.

### Record consistency

The statement, formula, output, and limits agree that this is intended, not necessarily funded, spending.

### Evidence binding

`yearFigures.evidence.test.ts` asserts A/B/C and distinguishes A from ideal-only.

### Verdict

**Approve.**

## 8. `guardrail-threshold-dollars`

### Recomputed

A's persisted percentages are `round(1.4036718749999997 × 10,000)/100 = 140.37` and similarly **190.12**; their $500,000 products are **$701,850** and **$950,600**. B's plan-order base is `812,345.67 + 422,222.22 = 1,234,567.8900000001` in binary64; the products are `783,580.2397830001` and `1,827,777.7611450003`. C has zero base and percentage-only status; D has B's lower dollar threshold and null upper; E is unsolved; F is 300,000/300,000 with `acts: false`; G is null outside risk-based mode. H's association produces `250149.99999999997` and `750100.0000000001`, whereas multiplying first produces 250150 and 750100. An independent ten-step bisection from 0.02 to 4 gives the worksheet's k=192 float `0.7662499999999999 → 76.62` and k=64 `0.26875 → 26.88`; k=448/704 similarly give 176.12/275.62. The 100.01% versus 99.99% first-year cut/hold pin is consistent with a $500,000 anchor.

### Match

All seven primary cases, H, the listed lattice ties, and the formula's categories match. The later implementation addendum supplies H; it does not conflict with A–G.

### Tolerance

“Exact” is justified for these specified binary64 expression orders and statuses; the H and lattice cases show why changing order or replacing floating-point rounding with rational rounding would fail bit equality.

### Wrong readings checked

Using A's unrounded fraction yields **$701,835.9375** and **$950,585.9375** (printed $701,836/$950,586); omitting `/100` gives **$70,185,000** lower; H distinguishes multiplication order by one ULP. A zero-dollar display in C falsely claims a known anchor; no dollar threshold exists from its stated inputs. Nominal future-year or ending-balance variants require a specified later path and cannot be assigned one worksheet number.

### Sources

These are persisted product percentages and the ledger's first-positive-real-portfolio rule; the worksheet cites no external law or table. Its explicit zero-start and edited-balance limits prevent the dollar publication from overclaiming.

### Record consistency

Statement, formula, output, and limits agree with the final worksheet, including zero balance, inverted thresholds, and the floating-point half-tie approximation.

### Evidence binding

`riskBasedGuardrails.thresholdDollars.evidence.test.ts` asserts A–H, both named ties, exact H association, and the first-year cut/hold actions.

### Verdict

**Approve.**

## 9. `solved-initial-withdrawal-rate`

### Recomputed

`(M/B) × 100` gives A **4.186666666666667%** (`4.19%` printed), B **4%** (`4.00%`), C **5.1499999999999995%** (`5.15%`), D **null** at zero balance, E **0%**, and F **5.438104918746302%** (`5.44%`). The example-library rates are consistent with the given published amounts and starting balances where those are supplied; they are observational solver results, not independently reproducible ledger cases from this worksheet alone.

### Match

All six fixture values and their displayed strings match.

### Tolerance

The exact binary64 A/C bits and printed rounding match the specified division-then-multiplication order. No numeric tolerance is needed for this fixed expression and inputs.

### Wrong readings checked

`(62,800 × 100)/1,500,000` gives **4.1866666666666665**, one ULP below A, and the alternate order in C gives **5.15** instead of `5.1499999999999995`; their two-decimal displays coincide. The worksheet's rmd-irmaa example gives `131,485/2,300,000 × 100 = 5.7167…%` (`5.72%`) on the passing probe, versus `131,400/2,300,000 × 100 = 5.7130…%` (`5.71%`) on the published amount. Ending portfolio, non-investable holdings, and stale-plan balances have no worksheet values to recompute.

### Sources

This is a product comparison to its own withdrawal-rule table, not a legal or externally published rate. The worksheet acknowledges that the solver's spending shape and the comparison rules have different assumptions.

### Record consistency

Statement, formula, output, and limits specify the published amount over the *solved plan's* starting investable base, and disclose the alternative floating-point association and comparison limit.

### Evidence binding

`spendingSolver.withdrawalRate.evidence.test.ts` asserts A–F, the A/C bit patterns and strings, rejects the A alternate association, and asserts the rate on the published solver answer rather than its passing probe.

### Verdict

**Approve.**

## 10. `solved-spending-rounding`

### Recomputed

Independent whole-dollar bisection with seed 40,000, passing through 62,850 and $500 resolution gives probes `40,000, 80,000, 60,000, 70,000, 65,000, 62,500, 63,750, 63,125, 62,813`: nine evaluations, highest passing 62,813. A publishes **62,800**, slack **22,800**; A′ with current 40,000.40 has slack **22,799.6**. B through G respectively give `(published, slack)` **(62,800, 2,800), (45,000, −3,500.5), (0, −12,000), (0, 0), (null, null), (61,000, 950)**. Under guardrails H adds a passing 62,800 probe: ten runs and 62,800 published. I's 62,800 probe fails: ten runs and exact **62,813** published, slack 22,813. J's 40,060 seed passes, but its $100 floor is 40,000 below required 40,050, so **40,060** is published exactly. K's probes are `41,000, 40,000, 40,500, 40,250, 40,125, 40,063, 40,032`; the already-passing 40,000 floor is published in seven runs. L's passing 72,030 publishes **72,000**, slack **−30**, while `sustainsCurrentBase` is true. A $1 million patched starting balance makes H's published rate **6.28%**. The cited lean-fat-fire observation is a separate real-ledger assertion, not derivable from the worksheet's threshold-only inputs.

### Match

All formula cases A–L, probe sequences, conditional publication outcomes, and the patched-base rate match the worksheet's final implementation addendum. The early “always floor” proposal is superseded there.

### Tolerance

Whole-dollar probes, $100 floors, counts, nulls, and modes are exact. A′'s `1e−9` slack tolerance accommodates representation of 40,000.40; the actual computed result prints 22,799.6.

### Wrong readings checked

Nearest $100 would turn a passing **62,850** into **62,900**, which was not checked feasible. $500 flooring gives **62,500** in A. Slack on the passing probe is **22,813** instead of 22,800. Flooring C's slack directly gives **−3,500**, rather than the amount-derived **−3,500.5**. Publishing an untested floor under I would publish the failing 62,800; publishing J's floor would violate its 40,050 required minimum.

### Sources

The $100 step and solver-feasibility policy are owner/product decisions, not law. The record discloses the material fixed-target approximation: feasibility of a lower rounded amount is measured but unproven, particularly near 100% FPL where a modeled ACA credit can disappear. [26 CFR 1.36B-2(b)(6)](https://www.govinfo.gov/content/pkg/CFR-2025-title26-vol1/pdf/CFR-2025-title26-vol1-sec1-36B-2.pdf) supplies the separately disclosed below-100% exception in the motivating ACA scenario; the solver worksheet does not numerically exercise that law.

### Record consistency

Statement, formula, outputs, feeds, and limits match the final conditional rule. The formula's phrase “when that level is known to pass” must be read with the statement's further required-spending floor guard; the worksheet's J/K cases and statement supply it. The limits identify the unproved fixed-target assumption and the fact that evidence describes `feasibleBaseAnnual`.

### Evidence binding

`spendingSolver.rounding.evidence.test.ts` asserts A–E and G, the A/J/K probe sequences, H/I conditional extra run, J required floor, and L's positive sustain verdict despite negative slack. The named example parity observations are secondary evidence, not substituted for these numeric assertions.

### Verdict

**Approve.**

## 11. `spending-shape-comparison`

### Recomputed

Floored flat/shape pairs and deltas for A–G are **50,000/50,100 → +100**, **50,000/50,100 → +100**, **50,000/50,000 → 0**, **50,100/50,000 → −100**, **62,800/67,100 → +4,300**, **null/55,000 → null**, and **48,000/48,000 → 0**; each flat-row delta is null. The old exact-probe deltas are **99, 1, 99, −99, 4,296, null, 0**. In H, flat has no phases, smile has `(75, 0.9), (85, 0.8)`, and the smirk's `0.99^5` through `0.99^35` round to **0.95, 0.90, 0.86, 0.82, 0.78, 0.74, 0.70** at ages 70–100; ABW is removed. The later guardrail case I takes the displayed exact 50,149 minus displayed flat 50,000 = **+149**. The maximum difference between exact-probe and shown-amount gaps is 99, since each whole-dollar residue is 0–99.

### Match

All worked A–I arithmetic and H preset values match, including the later exact-answer exception. The example-library old/new deltas are arithmetically consistent with their stated shown amounts and old differences, but their underlying solver answers cannot be recomputed independently from this worksheet's abbreviated example data.

### Tolerance

Exact is justified for whole-dollar differences and $100 floors. The smirk multiplier rounding is to 0.01 by the stated preset compilation, not a comparison tolerance.

### Wrong readings checked

Exact-minus-exact gives A **+99**, B **+1**, C **+99** instead of +100/+100/0. Flooring A's exact 99 delta gives **0**, not the shown +100. On the cited bracket-fill example, comparing smile's exact 105,118 with the plan's own 100,899 gives **+4,219** rather than comparison with flat exact 91,056 (**+14,062** old; **+14,100** between shown values). Retaining ABW yields no feasible shape row under the worksheet's solver contract, rather than a numeric alternative.

### Sources

The displayed-gap rule and the shapes are product decisions, not legal or published table claims. The worksheet explicitly says separate solves have about $500 resolution and a smaller delta should not be treated as meaningful.

### Record consistency

Statement, formula, output, and limits match the final worksheet: the delta uses *published* amounts, which can be exact rather than $100 multiples when guardrail rounding fails. The early worksheet sentence saying all row amounts are multiples of $100 is superseded by its implementation addendum and by the record's explicit guardrail limit.

### Evidence binding

`spendingShapes.evidence.test.ts` asserts A–G values and old readings, the 99 maximum residue difference, H phase replacements and ABW removal, exact guardrail case I, and input refusals.

### Verdict

**Approve.**

## Summary

**9 approve; 2 reject.** Rejections concern the second ACA FPL-percentage tolerance and the 2026 Medicare tier premium/source discrepancy (plus the healthcare record's unconditional formula). These are findings from read-only recomputation; no source or test was executed.
