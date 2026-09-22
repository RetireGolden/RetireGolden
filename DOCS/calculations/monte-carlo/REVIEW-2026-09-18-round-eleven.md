# Review, 2026-09-18 (round eleven: the remaining hand-derivable engine families)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r11.md (the year-ledger types with the 2026-09-18 field statements, the Roth sizing, federal tax, ladder, Social Security, healthcare, ACA, snapshot, pension election, historical suite, annuitization, spending solver, insight and candidate-evaluation modules, tax/medicare.ts, the money tolerances and the 2026 pack; bodies elided). Scope in this directory: historical-stress-window-total-shortfall, annuitization-sweep-point. The report covers all thirteen worksheets of the round across nine directories. Verbatim output follows.

---

# Independent Worksheet Review — Round B1-P4 (13 worksheets)

Review method: independent recomputation from each worksheet’s **Inputs** and **Justification**, cross-checked against the signatures extract (`b1-p4-signatures-r11.md`). No engine execution; no reads under `packages/engine/src`.

---

## 1. `longevity-depletion-year`

**Recomputed values**

| Case | Steps | Result |
|---|---|---|
| Depletion | Gap = \$10{,}000 − \$0 = \$10{,}000. End 2026: \$25{,}000 − \$10{,}000 → \$15{,}000, shortfall \$0. End 2027: \$15{,}000 − \$10{,}000 → \$5{,}000, shortfall \$0. 2028: only \$5{,}000 available vs \$10{,}000 need → shortfall \$10{,}000 − \$5{,}000 = \$5{,}000 > \$0.005 | **2028** |
| No depletion | Spending \$5{,}000/yr → closes \$20{,}000, \$15{,}000, \$10{,}000; all shortfalls \$0 | **null** |

**Match:** yes

**Rule applied:** yes — first year post-HECM shortfall exceeds half-cent tolerance; null when none qualify.

**Constants vs extract:** `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005` ✓

**Tolerance justified:** yes — calendar year and null are discrete.

**Wrong readings (3):**
- Zero-balance-as-depletion → 2027 (not 2028) for \$30{,}000 opening: plausible misread ✓
- Pre-funding test → 2026: wrong ✓
- Null → 2028: wrong ✓

**Family:** outputs `longevity-depletion-year` only; feeds none ✓

**Verdict:** approve

---

## 2. `roth-conversion-annual`

**Recomputed values**

- Taxable before conversion: \$70{,}000 − \$16{,}100 = **\$53{,}900**
- 22% bracket upper bound (next bracket lower): **\$105{,}700**
- Headroom: \$105{,}700 − \$53{,}900 = **\$51{,}800**

**Match:** yes

**Rule applied:** yes — no-benefits `topOfBracket` = bracket bound − (ordinary − deduction); benefits branch correctly deferred to bisection.

**Constants vs extract:**
- `standardDeduction.single = 16_100` ✓
- 24% bracket starts at `105_700` (22% upper) ✓
- 22% lower `50_400` ✓ (cited only in wrong reading)

**Tolerance justified:** yes — \$0.005 for published dollars.

**Wrong readings (3):**
- Ignore deduction → \$35{,}700 ✓
- Use 22% lower as upper → \$50{,}400 − \$53{,}900 = −\$3{,}500 (clamp \$0) ✓
- No-benefits formula with benefits → overstatement (qualitative) ✓

**Family:** outputs `roth-conversion-annual` only; feeds none ✓

**Verdict:** approve

---

## 3. `year-result-ltcg-zero-headroom`

**Recomputed values**

| Case | Steps | Result |
|---|---|---|
| A (\$37{,}000) | \$49{,}450 − \$37{,}000 | **\$12{,}450** |
| B (\$50{,}000) | \$50{,}000 ≥ \$49{,}450 → zero branch | **\$0** |

**Match:** yes

**Rule applied:** yes — at-threshold floor to \$0; otherwise threshold − taxable income (no SS).

**Constants vs extract:**
- `rate15StartsAbove.single = 49_450` ✓
- `rate20StartsAbove.single = 545_500` ✓

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- Reverse subtract → −\$12{,}450 ✓
- No floor → −\$550 ✓
- 20% threshold → \$508{,}500 ✓

**Family:** outputs `year-result-ltcg-zero-headroom` only; feeds none ✓

**Verdict:** approve

---

## 4. `sustainable-spending-result-simulation-count`

**Recomputed values**

Feasible seed (bracket [\$20{,}000, \$40{,}000] after doubling):

| Probe | Amount | # |
|---|---:|---:|
| Seed | \$10{,}000 feasible | 1 |
| Double | \$20{,}000 feasible | 2 |
| Double | \$40{,}000 infeasible | 3 |
| Bisect | \$30{,}000 infeasible → [\$20k,\$30k], width \$10{,}000 | 4 |
| Bisect | \$25{,}000 infeasible → [\$20k,\$25k], width \$5{,}000 | 5 |
| Bisect | \$22{,}500 feasible → [\$22.5k,\$25k], width \$2{,}500 = resolution | 6 |

Infeasible seed: seed (1) + zero probe (2) = **2**

**Match:** yes — **6** and **2**

**Rule applied:** yes — seed; doubling while feasible; bisection per halving until width ≤ resolution or budget; infeasible seed adds zero probe.

**Constants vs extract:** comment sequence matches `SustainableSpendingResult.simulationCount` ✓

**Tolerance justified:** yes — integer count.

**Wrong readings (3):**
- Omit seed → 5 ✓
- Double-count endpoints → 8 ✓
- Continue at width = resolution → 7 ✓

**Family:** outputs `sustainable-spending-result-simulation-count` only; feeds none ✓

**Verdict:** approve

---

## 5. `income-tips-ladder-and-ladder-value-annual`

**Recomputed values** (scale = 0.80000000)

| Offset | Cash intermediate | Cash | Value intermediate | Value |
|---|---:|---:|---:|---:|
| 0 (purchase) | \$0 (contract) | **\$0** | (\$10{,}000+\$20{,}000)×0.8×1.00000000 | **\$24{,}000** |
| 1 | Coupons \$500 + principal \$10{,}000 = \$10{,}500; ×0.8×**1.05000000** | **\$8{,}820** | \$20{,}000×0.8×1.05000000 | **\$16{,}800** |
| 2 | Coupon \$400; ×0.8×**1.10000000** | **\$352** | \$20{,}000×0.8×1.10000000 | **\$17{,}600** |

Coupon detail offset 1: \$10{,}000×0.01 + \$20{,}000×0.02 = \$100 + \$400 = \$500 ✓

**Match:** yes

**Rule applied:** yes — purchase-year cash \$0; cash = (coupons + maturing principal)×scale×inflation factor; value = unmatured face (maturityOffset > offset)×scale×factor.

**Constants vs extract:** rule matches `YearIncomes.tipsLadder` and `YearResult.ladderValue` comments ✓ (fixture inputs, not pack constants)

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- Drop maturing coupon → \$8{,}736 ✓
- Keep matured face in value → \$25{,}200 ✓
- Purchase-year cash → \$400 ✓

**Family:** outputs `income-tips-ladder-annual` and `ladder-value-annual`; feeds none ✓

**Verdict:** approve

---

## 6. `social-security-benefit-annual`

**Recomputed values**

| Case | Steps | Result |
|---|---|---|
| Own claim year | \$2{,}000×0.8×9×1.00000000×0.95000000 = \$1{,}600×9×0.95 | **\$13{,}680** |
| Later year | \$2{,}000×0.8×12×1.06000000×0.95000000 = \$19{,}200×1.06×0.95 | **\$19{,}334.40** |
| Two-person | Spousal = max(0, 0.5×\$2{,}000×1 − \$300) = \$700 > \$300 replaces \$300; (\$2{,}000+\$700)×12 | **\$32{,}400** |
| Below-FRA earnings test | Withhold max(0,(\$34{,}480−\$24{,}480)/2) = \$5{,}000; paid \$24{,}000−\$5{,}000 | **paid \$19{,}000; withheld \$5{,}000** |

**Match:** yes

**Rule applied:** yes — own rows compose; spousal replaces when larger; below-FRA withhold ÷2 capped at benefit.

**Constants vs extract:**
- `earningsTestBelowFraAnnual = 24_480` ✓
- `earningsTestFraYearAnnual = 65_160` ✓

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- 12 claim months → \$18{,}240 ✓
- Add spousal to own → \$36{,}000 ✓
- Below-FRA ÷3 → withhold \$3{,}333.33…, paid \$20{,}666.67 ✓

**Family:** outputs `social-security-benefit-annual` only; feeds none ✓

**Verdict:** approve

---

## 7. `aca-enrollment-and-applicable-slcsp-premium-annual`

**Recomputed values**

- Gross enrollment: 3×\$500 + 9×\$0 = **\$1{,}500**
- Applicable SLCSP: Jan–Mar only (enrollment > 0): 3×\$600 = **\$1{,}800**; April excluded despite \$600 benchmark
- No contract: **null**

**Match:** yes

**Rule applied:** yes — benchmark counted only when enrollment premium > 0; null without contract.

**Constants vs extract:** field-comment identities match `YearAcaResult` ✓

**Tolerance justified:** yes — \$0.005 for dollars; exact for null.

**Wrong readings (3):**
- Count April benchmark → \$2{,}400 ✓
- Benchmark into gross → \$1{,}800 ✓
- \$0 instead of null → wrong distinction ✓

**Family:** outputs `aca-gross-enrollment-premium-annual` and `aca-applicable-slcsp-premium-annual`; feeds none ✓

**Verdict:** approve

---

## 8. `spending-healthcare-annual`

**Recomputed values**

- Medicare: \$3{,}582.72×(12/12) + \$50×12×**1.10000000** = \$3{,}582.72 + \$660.00 = **\$4{,}242.72**
- Marketplace (credit off): \$400×4×**1.10000000** = **\$1{,}760.00**
- Total: **\$6{,}002.72**

**Match:** yes

**Rule applied:** yes — Medicare premium × months/12 plus inflated extras; marketplace × months × health inflation with credit off.

**Constants vs extract:**
- Tier 1 `magiOver.single = 109_000` ✓
- `partDSurchargeMonthly = 14.5` ✓
- `partBStandardMonthly = 202.9` ✓
- Helper premium \$3{,}582.72 correctly taken as stated intermediate (not re-derived)

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- Inflate tier premium too → \$6{,}360.992 ✓
- Omit marketplace inflation → \$5{,}842.72 ✓
- Credit-on gross retention → qualitative ✓

**Family:** outputs `spending-healthcare-annual` only; feeds none ✓

**Verdict:** approve

---

## 9. `accounts-balance-per-account-annual`

**Recomputed values**

- `acct-1`: \$100{,}000 + \$10{,}000 − \$15{,}000 = **\$95{,}000**
- `home-1`: \$200{,}000 × **1.03000000** = **\$206{,}000**
- `debt-1`: \$30{,}000 − \$4{,}000 = **\$26{,}000**
- Collision overwrite order → **`shared: $8{,}000`** (insurance last)

**Match:** yes

**Rule applied:** yes — investable → property → debt → permanent-life; later overwrites.

**Constants vs extract:** overwrite order matches `annualSnapshot` comment ✓

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- Appreciation on account → \$97{,}850 ✓
- Negative debt → −\$26{,}000 ✓
- First-write-wins → \$95{,}000 ✓

**Family:** outputs `accounts-balance-per-account-annual` only; feeds none ✓

**Verdict:** approve

---

## 10. `pension-election-annuity-present-value`

**Recomputed values**

- Horizon: max(5, 70−64) = **6 years**
- Real yield interpolation: 1.85% + (6−5)/(7−5)×(2.05%−1.85%) = 1.85% + 0.10000000% = **1.95000000%**
- `curveRatePct`: 1.95% + 2.00% = **3.95000000%**
- Discount factor **1.03950000**:
  - Y1: \$12{,}000 / 1.03950000 = \$11{,}543.91534488
  - Y2: \$12{,}000 / 1.08056025 = \$11{,}105.10438960
  - Y3: \$12{,}000 / 1.12324234 = \$10{,}683.69960626
- **PV = \$33{,}332.71934074**

**Match:** yes

**Rule applied:** yes — curve at max(5, planning age − current age) + inflation; discounted sum at offsets 1–3.

**Constants vs extract:** `REAL_YIELD_CURVE_2026` anchors 5y 1.85, 7y 2.05, 10y 2.25, 20y 2.55, 30y 2.70 ✓

**Tolerance justified:** yes — 1e-9 pp for rate; \$0.005 for PV.

**Wrong readings (3):**
- 5y endpoint only (3.85%): recomputed PV ≈ **\$33{,}401.12** vs worksheet **\$33{,}396.12** (~\$5 gap) — directionally correct, not exact
- Omit inflation (1.95%): recomputed PV ≈ **\$34{,}643.02** vs worksheet **\$34{,}640.33** (~\$3 gap) — directionally correct, not exact
- No discount → \$36{,}000 ✓

**Family:** outputs `pension-election-annuity-present-value` only; feeds none ✓

**Verdict:** approve with a note — Expected values exact; two of three wrong-reading dollar figures differ by a few dollars from independent discount arithmetic.

---

## 11. `historical-stress-window-total-shortfall`

**Recomputed values**

| Year | Balance start | Need | Shortfall |
|---|---:|---:|---:|
| 1 | \$100{,}000 | \$60{,}000 | \$0 (close \$40{,}000) |
| 2 | \$40{,}000 | \$60{,}000 | **\$20{,}000** |
| 3 | \$0 | \$60{,}000 | **\$60{,}000** |

**Total = \$80{,}000**

**Match:** yes

**Rule applied:** yes — sum of yearly shortfalls after HECM backstop.

**Constants vs extract:** `HistoricalStressWindow.totalShortfall` comment ✓

**Tolerance justified:** yes — \$0.005.

**Wrong readings (3):**
- Cumulative unmet spending → \$100{,}000 ✓
- Stop at first empty year → \$20{,}000 ✓
- Opening assets as income → \$0 ✓

**Family:** outputs `historical-stress-window-total-shortfall` only; feeds none ✓

**Verdict:** approve

---

## 12. `annuitization-sweep-point`

**Recomputed values**

- Requested: 60%×\$200{,}000 = \$120{,}000
- Cap: 0.95×\$100{,}000 = \$95{,}000
- **Premium = \$95{,}000**
- Payout rate at age 72: 0.08400000 + (72−70)/(75−70)×(0.10300000−0.08400000) = 0.084 + 0.00760000 = **0.09160000**
- **Annual income = \$95{,}000 × 0.0916 = \$8{,}702**
- **Effective allocation = \$95{,}000/\$200{,}000×100 = 47.5%**
- Small point: 2%×\$200{,}000 = \$4{,}000 < \$5{,}000 → skipped

**Match:** yes

**Rule applied:** yes — min(grid×investable, 0.95×funding); skip <\$5{,}000; income = premium×interpolated rate at min(95,max(age,65)); effective = premium/investable×100.

**Constants vs extract:** SPIA table 60→0.06, 65→0.07, 70→0.084, 75→0.103, 80→0.129, 85→0.153 ✓

**Tolerance justified:** yes — \$0.005 dollars; 1e-9 pp for allocation.

**Wrong readings (3):**
- Ignore cap → \$120{,}000 / \$10{,}992 / 60% ✓
- Age-70 anchor → \$7{,}980 ✓
- Keep \$4{,}000 point → violates skip rule ✓

**Family:** outputs `annuitization-sweep-premium`, `annuitization-sweep-annual-income`, `annuitization-sweep-effective-allocation-pct`; feeds none ✓

**Verdict:** approve

---

## 13. `insight-impact-estate-and-lifetime-tax-deltas`

**Recomputed values**

- `endingAfterTaxEstateDelta` = \$530{,}000 − \$500{,}000 = **+\$30{,}000**
- `lifetimeTaxDelta` = \$185{,}000 − \$200{,}000 = **−\$15{,}000** (negative = savings)

**Match:** yes

**Rule applied:** yes — candidate minus baseline on both fields.

**Constants vs extract:** `InsightImpact` and `evaluateCandidate` comments ✓

**Tolerance justified:** yes — \$0.005.

**Wrong readings:** reversal → −\$30{,}000 / +\$15{,}000; totals-not-deltas; IRMAA-tier-edge exception — all correctly described (no numeric recompute required beyond the two reversal cases).

**Family:** outputs `insight-impact-ending-after-tax-estate-delta` and `insight-impact-lifetime-tax-delta`; feeds none ✓

**Verdict:** approve

---

## Family coverage (18 families, round B1-P4)

All eighteen families appear on exactly one worksheet; every worksheet lists only its published families under **outputs**; all **feeds: none**. No missing or duplicate families detected.

| Family | Worksheet |
|---|---|
| `longevity-depletion-year` | longevity-depletion-year |
| `roth-conversion-annual` | roth-conversion-annual |
| `year-result-ltcg-zero-headroom` | year-result-ltcg-zero-headroom |
| `sustainable-spending-result-simulation-count` | sustainable-spending-result-simulation-count |
| `income-tips-ladder-annual` | income-tips-ladder-and-ladder-value-annual |
| `ladder-value-annual` | income-tips-ladder-and-ladder-value-annual |
| `social-security-benefit-annual` | social-security-benefit-annual |
| `aca-gross-enrollment-premium-annual` | aca-enrollment-and-applicable-slcsp-premium-annual |
| `aca-applicable-slcsp-premium-annual` | aca-enrollment-and-applicable-slcsp-premium-annual |
| `spending-healthcare-annual` | spending-healthcare-annual |
| `accounts-balance-per-account-annual` | accounts-balance-per-account-annual |
| `pension-election-annuity-present-value` | pension-election-annuity-present-value |
| `historical-stress-window-total-shortfall` | historical-stress-window-total-shortfall |
| `annuitization-sweep-premium` | annuitization-sweep-point |
| `annuitization-sweep-annual-income` | annuitization-sweep-point |
| `annuitization-sweep-effective-allocation-pct` | annuitization-sweep-point |
| `insight-impact-ending-after-tax-estate-delta` | insight-impact-estate-and-lifetime-tax-deltas |
| `insight-impact-lifetime-tax-delta` | insight-impact-estate-and-lifetime-tax-deltas |

---

## Summary table

| id | match | verdict |
|---|---|---|
| longevity-depletion-year | yes | approve |
| roth-conversion-annual | yes | approve |
| year-result-ltcg-zero-headroom | yes | approve |
| sustainable-spending-result-simulation-count | yes | approve |
| income-tips-ladder-and-ladder-value-annual | yes | approve |
| social-security-benefit-annual | yes | approve |
| aca-enrollment-and-applicable-slcsp-premium-annual | yes | approve |
| spending-healthcare-annual | yes | approve |
| accounts-balance-per-account-annual | yes | approve |
| pension-election-annuity-present-value | yes (wrong-reading PVs ~\$3–\$5 off) | approve with a note |
| historical-stress-window-total-shortfall | yes | approve |
| annuitization-sweep-point | yes | approve |
| insight-impact-estate-and-lifetime-tax-deltas | yes | approve |

**Round result:** 12 approve, 1 approve with a note, 0 reject. All Expected values match independent recomputation. The only material caveat is `pension-election-annuity-present-value` wrong-reading illustrative PVs for the 3.85% and 1.95% misreads, which differ by a few dollars from strict discount arithmetic while the primary Expected PV is exact to the stated precision.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

Orchestrator note, 2026-09-22 (pull-request review of #730): the zero-balance misread in the `longevity-depletion-year` section reads "2027 (not 2028)"; on the worksheet's `$30,000` opening balance against a `$10,000` gap the balance closes at exactly `$0` in 2028, so that misread reports 2028 while the contract reports `null`. The worksheet's wrong reading was corrected; the approved cases and their arithmetic are unaffected.
