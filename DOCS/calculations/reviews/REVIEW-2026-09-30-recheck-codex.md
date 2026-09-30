# Targeted re-check, 2026-09-30 (recheck-codex)

Reviewer: Codex (GPT-6-Sol, high reasoning), headless and read-only, on a snapshot of branch `claude/scrub-local-paths` at `b251c178`. Scope: 22 records rejected in the 2026-09-29 reviews, or approved there and then touched by a later fix, each checked only for whether its fix resolves the original finding and introduces no error. Verdicts: 22 approve, 0 reject. The reviewer's arithmetic script is `DOCS/calculations/reviews/scripts/recheck-codex/recompute.py`, run from the repository root; two helper scripts that only extracted the brief and formatted this report are left out. The only edits to the report below replace local paths with repository paths. Verbatim output follows.

---

# Targeted re-check of fixed calculation records

Reviewer: Codex (GPT-6-Sol, high reasoning)
Date: 2026-09-30
Commit: `b251c178`
Scope: targeted re-check of original findings and changes made to resolve them. No engine execution or package imports.

## oasdi-tax-rate-history

**Original finding:** 2010 employer exemption was omitted from a payer-specific claim.
**Fix:** Claim and limit now distinguish the 6.2% schedule from 0% on qualifying wages; 2011–12 employee/self-employed rates remain 4.2%/10.4%.
**Rechecked:** SSA footnote c confirms both exceptions; the rate evidence test checks the table and footnotes. [SSA rates](https://www.ssa.gov/oact/progdata/oasdiRates.html).
**Verdict:** approve.

## social-security-claim-age-monthly-refinement

**Original finding:** The 25-month upper bound excluded 36-month windows.
**Fix:** Timing now gives 36 generally, 24 at 62, 25 at 69, and 13 at 70.
**Rechecked:** Counting the inclusive 12-month age bands gives 36 for interior ages, 24 for 62, 25 for 69, and 13 for 70; R-B/R-C windows are 36. Existing evidence cases pin the window counts.
**Verdict:** approve.

## survivor-convert-early-lever

**Original finding:** The formula equated a requested target with executed conversion.
**Fix:** The formula separates target(y) from ledger rothConversion(y).
**Rechecked:** The 12% fill is 100,800 − (92,200 − 32,200) = $40,800; with only Sam owning a Roth, Pat’s requested $40,800 executes as $0. The L-B evidence row asserts zero.
**Verdict:** approve.

## bucket-lens-allocation

**Original finding:** One ULP was falsely claimed as a universal conservation bound.
**Fix:** Bound changed to 2 × number of spans ULPs; the three-span counterexample was added.
**Rechecked:** Independent binary64 subtraction/addition gives $822,519.5299999998, two ULPs below $822,519.53; the evidence test asserts the four buckets, sum, two-ULP difference, and bound.
**Verdict:** approve.

## household-later-retirement

**Original finding:** No-wage people were assigned a fictitious last wage year.
**Fix:** lastWage is null without a paying stream.
**Rechecked:** Robin: 1962+65=2027; Pat: 1966+64=2030, so the household year is 2030. The worksheet and evidence case agree.
**Verdict:** approve.

## hsa-contribution-limit-years

**Original finding:** The equal $4,500/$4,500 spouse split was stated without its legal exception.
**Fix:** It is named a model default; an agreed different division is disclosed.
**Rechecked:** Half of the published $9,000 family limit is $4,500; the statutory equal-split-unless-agreed rule supports the limitation. [26 U.S.C. §223(b)(5)(B)(ii)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim).
**Verdict:** approve.

## joint-account-contributions

**Original finding:** No scheduled worked case distinguished a schedule from a wage test.
**Fix:** Case B adds a $5,000 schedule for Pat’s ages 60–64 with no wages.
**Rechecked:** 2026–2030 are five contributions, hence $25,000; through death in 2028 gives $15,000, and a wage test gives $0. The evidence test asserts 2026/2028/2029/2030/2031 balances and both wrong readings.
**Verdict:** approve.

## survival-hazard-from-expectancy-multiplier

**Original finding:** Strict decrease and exact calibration falsely included the closed age 119.
**Fix:** Claims are limited below 119 and to reachable targets; the age-119 clamp is disclosed.
**Rechecked:** At 119 the modeled q is 1, so every positive power has E=0.5. Targets 0.4/0.6 therefore clamp to 8/0.2; the cited mortality worksheet establishes closure. No worked value was changed.
**Verdict:** approve.

## state-enacted-tax-year-figures

**Original finding:** An emergency D.C. act was treated as unconditional 2027–29 enactment.
**Fix:** The D.C. deduction is provisional pending the permanent act’s review.
**Rechecked:** Act 26-416 states both the deduction schedule and its 90-day lifetime; the record now discloses the contingency and revisit date. No tax figure changed. [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416).
**Verdict:** approve.

## market-model-garch-variance

**Original finding:** The five-standard-error band was too narrow, and the operative citation unread.
**Fix:** Band is 0.0714; Federal Reserve GMS is cited, Engle–Mezrich marked unread.
**Rechecked:** 5 × 0.0142836 = 0.071418, or 0.0714 at four significant figures; the evidence test uses 0.0714. Federal Reserve p.75 explicitly gives omega = unconditional variance × (1−psi−phi). [GMS documentation](https://www.federalreserve.gov/supervisionreg/files/gms-model.pdf).
**Verdict:** approve.

## market-model-student-t-draw

**Original finding:** Exact moments/correlation were overclaimed under the capped normal; zero-volatility correlation was undefined.
**Fix:** Exact claims are restricted to ideal chi-square mixing; implemented claims are approximate.
**Rechecked:** For ideal V, E[1/V]=1/(df−2), yielding unit variance; the private normal’s floor alters that law. Correlation needs both positive volatilities. The deterministic evidence case remains 7.00415461319636.
**Verdict:** approve.

## monte-carlo-histogram-bin-centres

**Original finding:** The default-seed degenerate count was 3, not 5.
**Fix:** The record now says 3 and identifies the separate former plan-id-seed count.
**Rechecked:** The worksheet’s default-seed remeasurement names inherited-ira-beneficiary, survivor-years and ltc-shock; parity evidence asserts these have one zero bar and the other two formerly degenerate examples each split 999/1.
**Verdict:** approve.

## claim-age-co-optimization

**Original finding:** The final benefit year was omitted and estate amounts lacked independent derivation.
**Fix:** PIA-years corrected and estate amounts labeled run-pinned.
**Rechecked:** 2061 inclusive gives 26×1.24=32.24, 29×1=29, 34×0.70=23.8; the evidence test asserts all three and the 2061 end year. The estate limit plainly discloses its weaker provenance.
**Verdict:** approve.

## plan-headline-money-comparison

**Original finding:** Two table cells retained stale +$330k/−$331k values.
**Fix:** Cells now say +$329k/−$332k after the 2027 HSA update.
**Rechecked:** The worksheet identifies the $240.41 change in the affected plan; the UI parity tests assert both displayed deltas. These example-library amounts are run-pinned, and no formula changed.
**Verdict:** approve.

## aca-expected-contribution

**Original finding:** 182.1086% could not meet an exact tolerance.
**Fix:** The fraction 57,000/313 and a 1e−9 tolerance replace it.
**Rechecked:** Independent decimal division gives 182.108626198083067…%; $28,500×5.73%=$1,633.05. The ACA evidence test asserts the precise percentage and tolerance.
**Verdict:** approve.

## spending-healthcare-annual

**Original finding:** CMS tier-one premium and household total were low; credit-on formula omitted its substitution.
**Fix:** CMS tier totals now feed the engine and worksheet; formula covers actionable net versus other-year gross.
**Rechecked:** ($284.10+$14.50)×12=$3,583.20; $4,243.20+$4,588.80=$8,832.00. Evidence asserts the components and household total. [CMS 2026 premiums](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles).
**Verdict:** approve.

## medicare-irmaa-first-tier-boundary

**Original finding:** Previously approved record was touched by the CMS tier-price change.
**Fix:** Part B and Part D use published amounts, with one worksheet case per tier.
**Rechecked:** Part B annual tiers recompute to $3,409.20/$4,869.60/$6,330.00/$7,790.40/$8,278.80; tier-one surcharge is $1,148.40. The evidence test loops through and asserts all five rows. [CMS 2026 premiums](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles).
**Verdict:** approve.

## medicare-base-part-b-premium

**Original finding:** Previously approved tier-zero record was touched by the formula restatement.
**Fix:** Formula now uses the published monthly tier amount, with standard premium at tier zero.
**Rechecked:** At tier zero $202.90×12=$2,434.80, still asserted by the evidence test; higher-tier amounts are checked in the adjacent IRMAA evidence test. [CMS 2026 premiums](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles).
**Verdict:** approve.

## benefits-to-contributions-ratio

**Original finding:** No numeric cases separated the earnings-test and living-ex readings.
**Fix:** W and X worked cases and wrong-reading comparators were added.
**Rechecked:** Independent SSA-2023-table sums give W $556,896.90 versus $554,544.12, ratios 2.4705/2.4601; X $240,848.22 versus $223,082.93 or $329,200.82, ratios 5.0449/4.6728/6.8956. The ratio evidence test asserts all cases.
**Verdict:** approve.

## social-security-expected-value

**Original finding:** Pre-entitlement months were chargeable; C-D and C-F were disputed by the first reviewer.
**Fix:** The pre-entitlement limit is corrected; C-D and C-F are retained with POMS support and both readings disclosed.
**Rechecked:** [42 U.S.C. §403(f)(1)(A)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim) bars charging a non-entitled month. [RS 00615.694 A](https://secure.ssa.gov/poms.nsf/links/0300615694) gives C-D $1,000 combined, rather than $1,006.67; [RS 00615.598 A](https://secure.ssa.gov/poms.nsf/links/0300615598) delays the deceased worker’s ARF until hypothetical FRA. The C-D and 23 C-F evidence rows remain asserted.
**Verdict:** approve.

## survivor-switching-expected-value

**Original finding:** A static formula missed withholding and later adjustment in case D.
**Fix:** The formula now sums monthly payments with deductions and the age-62/FRA adjustments.
**Rechecked:** Hand stream 2026–28 = $9,400/$9,400/$10,350, then $18,300 until the FRA year; independent SSA-2023 survival weighting yields $335,199.57459865406, exactly the worksheet/evidence value. [20 CFR §404.412(b)](https://www.ssa.gov/OP_Home/cfr20/404/404-0412.htm) and [RS 02501.145 B.2](https://secure.ssa.gov/poms.nsf/lnx/0302501145) support the adjustments and partial split.
**Verdict:** approve.

## spending-phase-person

**Original finding:** The original fixture could not separate named-person behavior from younger-person or death-stop readings.
**Fix:** Older and Death households naming Alex were added.
**Rechecked:** Alex turns 75 in 2037 and 85 in 2047: $54,000/$48,000. After his 2038 death, the 2046/2047 amounts remain $54,000/$48,000; younger-person and stop-at-death values differ. The evidence test asserts all new rows.
**Verdict:** approve.
