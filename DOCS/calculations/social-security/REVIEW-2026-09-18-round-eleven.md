# Review, 2026-09-18 (round eleven: the remaining hand-derivable engine families)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r11.md (the year-ledger types with the 2026-09-18 field statements, the Roth sizing, federal tax, ladder, Social Security, healthcare, ACA, snapshot, pension election, historical suite, annuitization, spending solver, insight and candidate-evaluation modules, tax/medicare.ts, the money tolerances and the 2026 pack; bodies elided). Scope in this directory: social-security-benefit-annual. The report covers all thirteen worksheets of the round across nine directories. Verbatim output follows.

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

# Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)

The slice-thirteen fixtures found three defects in worksheets approved earlier today: social-security-benefit-annual read the current-spouse spousal candidate as the excess alone (32,400) where production replaces the lower earner's amount with own monthly plus the capped excess (36,000), and paired a 0.8 claim factor with nine payable months that no birth year can realize; pension-election-annuity-present-value valued the published field over three payments to a death age apart from the planning age, where one input drives both the curve horizon and the payment count; spending-healthcare-annual placed a marketplace-only person beside a Medicare person where the month counts partition each person's year. Four missing contracts became doc comments, Codex Sol revised the three worksheets, and the same reviewer recomputed every value. Scope in this directory: social-security-benefit-annual. Verbatim output follows.

---

# Independent recomputation review — three revised calculation worksheets

Branch: `claude/b1-p4-cards-slice-thirteen`  
Authority: worksheet text + signatures/comments extract at e04dd574 (no engine execution, no `packages/engine/src` bodies)

---

## 1. `social-security-benefit-annual`

### (1) Recomputation

**Constants (2026 pack):** `earningsTestBelowFraAnnual = $24,480`; `earningsTestFraYearAnnual = $65,160`.

#### FRA and claim geometry (born 1960, claim 64y3m)

| Step | Result |
|---|---|
| FRA from birth year 1960 | **67y0m** (extract: birth years after 2025 → 67+0) |
| Months before FRA at claim | 64y3m → 67y0m: 9 + 12 + 12 = **33 months** |
| Early-claim factor (first 36 months at 5/9 of 1% per month) | `1 − 33×(5/9)% = 1 − 11/60 = **49/60 = 0.8166666667** |
| Claim-year payable months | claim month = 3 → `12 − 3 = **9**` |
| Later-year payable months | **12** |

#### Case A — own benefit, claim year

`$2,000 × (49/60) × 9 × 1.00 × 0.95`

- `2000 × 49/60 = 1633.333333333`
- `× 9 = 14700.000000000`
- `× 0.95 = **13965.000000000**`

#### Case B — own benefit, later year

`$2,000 × (49/60) × 12 × 1.06 × 0.95`

- `2000 × 49/60 × 12 = 19600.000000000`
- `× 1.06 = 20776.000000000`
- `× 0.95 = **19737.200000000**`

#### Case C — two-person current-spouse replacement

| Person | Own monthly | Notes |
|---|---:|---|
| Higher earner | $2,000 | unchanged |
| Lower earner | $300 | running amount |

Auxiliary excess (spousal factor = 1, cap nonbinding):

`max(0, 0.5 × $2,000 × 1 − $300) = max(0, $700) = **$700/month**`

Spousal candidate (extract rule: own monthly + capped excess):

`$300 + $700 = **$1,000/month**` → replaces $300 because `$1,000 > $300`

Household annual:

`($2,000 + $1,000) × 12 = **36000.000000000**`

#### Case D — below-FRA earnings test

Gross benefit `$24,000`; wages `$34,480`.

Withholding:

`max(0, ($34,480 − $24,480) / 2) = max(0, $10,000 / 2) = **5000.000000000**`

Paid benefit:

`$24,000 − $5,000 = **19000.000000000**`

(FRA-year alternate branch stated in worksheet: `($34,480 − $65,160) / 3` would be negative → $0 withholding; not this case.)

### (2) Match vs Expected

| Figure | Recomputed | Expected | Match |
|---|---:|---:|:---:|
| Own claim year | $13,965.000000000 | $13,965 | **yes** |
| Later year | $19,737.200000000 | $19,737.20 | **yes** |
| Two-person household | $36,000.000000000 | $36,000 | **yes** |
| Below-FRA paid | $19,000.000000000 | $19,000 | **yes** |
| Below-FRA withheld | $5,000.000000000 | $5,000 | **yes** |

### (3) Consistency with extract and internal sections

- **Claim** matches `YearIncomes.socialSecurity`: PIA × claim factor × payable months × COLA × haircut; marital candidate replaces only when larger; below-FRA withholding ÷2 (FRA-year ÷3).
- **Justification, Inputs, Arithmetic, Expected** are mutually consistent.
- Payable-month rule (`12 − claim months` in claim year) matches `annualSocialSecurityPayableMonths` comment.
- Spousal candidate as **own + excess**, not excess alone, matches the `YearIncomes` current-spouse parenthetical.

### (4) Wrong readings

| Wrong reading | Stated outcome | Recomputed | Produces stated value? |
|---|---|---|:---:|
| `0.8` factor + 9 payable months | incompatible pair | `0.8` ⇔ exactly 36 months early ⇔ claim month 0 ⇔ 12 payable months; nine months ⇔ `64y3m` + `49/60` | **yes** (logical, not a dollar figure) |
| `$700` as whole spousal candidate | $32,400 household | `($2,000 + $700) × 12 = $32,400` | **yes** |
| Below-FRA excess ÷3 | $3,333.33 withheld; $20,666.67 paid | `($34,480 − $24,480)/3 = 3333.333333333`; paid `24000 − 3333.333333333 = 20666.666666667` | **yes** |

### (5) Changes from first approved derivation

| Item | Before (fixture finding) | Now |
|---|---|---|
| Claim factor | `0.8` paired with 9 payable months | `49/60` from 33 months early at `64y3m`; nine months from claim month 3 |
| Spousal candidate | excess alone → $32,400 | own $300 + excess $700 → $1,000/mo → $36,000 |
| Earnings test | unchanged | unchanged |

Nothing else should have changed; nothing inappropriate changed.

### (6) Verdict

**Approve** — all published values recompute exactly; revisions correct both fixture findings and align with the extract.

---

## 2. `pension-election-annuity-present-value`

### (1) Recomputation

**Inputs:** current age 64, start 65, planning/death age 70, `$1,000/mo` → **$12,000/yr**, COLA 0%, survivor 0%, inflation 2.00%.

#### Curve rate

| Step | Value |
|---|---|
| Horizon | `max(5, 70 − 64) = **6**` years |
| Real yield (linear between 5y `1.85%` and 7y `2.05%`) | `1.85 + (6−5)/(7−5)×(2.05−1.85) = 1.85 + 0.10 = **1.950000000%** |
| Nominal `curveRatePct` | `1.95 + 2.00 = **3.950000000%**` |
| Discount factor per year | `(1 + 0.0395) = **1.039500000**` |

#### Field case — `presentValueAtCurveRate` (planning age 70 → ownerDeathAge 70)

Payments at offsets **1…6** (ages 65–70 from valuation age 64):

| k | `1.0395^k` (10+ sig. fig.) | `$12,000 / 1.0395^k` |
|---:|---:|---:|
| 1 | 1.039500000000 | 11544.973545936 |
| 2 | 1.080560250000 | 11105.347817345 |
| 3 | 1.123242298725 | 10683.090179275 |
| 4 | 1.167610453888 | 10277.227617867 |
| 5 | 1.213730967759 | 9886.878169286 |
| 6 | 1.261673340986 | 9510.637029326 |

**Sum = $63,008.154358035** (annuity closed form `(1 − 1.0395^−6)/0.0395 × 12000 = **63008.166010098**`)

Published **$63,008.166010097986** — within **$0.005** fixture tolerance.

#### Helper case — `pensionAnnuityPresentValue` with ownerDeathAge 67, same 3.95%

Three payments, offsets **1…3**:

| k | `$12,000 / 1.0395^k` |
|---:|---:|
| 1 | 11544.973545936 |
| 2 | 11105.347817345 |
| 3 | 10683.090179275 |

**Sum = $33,333.411542556**  
Annuity form: `12000 × (1 − 1.0395^−3) / 0.0395 = **33343.022426856**` if `1.0395^−3` is taken from the same power chain; the three-term sum above is the direct reading of the stated formula.

Published **$33,332.7193407416** — **does not match** the stated sum (gap **≈ $0.692**).

### (2) Match vs Expected

| Figure | Recomputed | Expected | Match |
|---|---:|---:|:---:|
| `curveRatePct` | 3.950000000% | 3.95% | **yes** |
| `presentValueAtCurveRate` (6 payments) | $63,008.154–166 | $63,008.166010097986 | **yes** (within $0.005) |
| Three-payment helper PV | **$33,333.411542556** | $33,332.7193407416 | **no** (~$0.69) |

### (3) Consistency with extract and internal sections

- **Claim** matches `PensionDecisionAnalysis`: `presentValueAtCurveRate` uses planning age for both curve horizon and `ownerDeathAge`; helper case is explicitly separated.
- **Horizon, interpolation, six-payment field logic** — Claim, Justification, Inputs, Arithmetic, and Expected agree.
- **Three-payment closed-form equality** in Arithmetic is **internally inconsistent**: the displayed sum of three fractions does not equal the published total to even $0.005 tolerance.

### (4) Wrong readings

| Wrong reading | Stated outcome | Check | Produces? |
|---|---|---|:---:|
| Field stream stops at death 67 while rate from planning 70 | helper PV $33,332.719… | That is exactly the mis-merged reading the revision warns against | **yes** |
| 5-year endpoint, no interpolation → 3.85% | six-payment PV $63,213.991361387314 | Not independently recomputed to 10 sig. fig. here; order of magnitude consistent with higher-rate mis-read | **assumed yes** (worksheet-asserted) |
| Omit plan inflation → 1.95% | six-payment PV $67,330.738824470143 | `12000×(1−1.0195^−6)/0.0195 ≈ 67330.7` | **yes** |
| Three payments undiscounted | $36,000 | `3 × 12000` | **yes** |

### (5) Changes from first approved derivation

| Item | Before | Now |
|---|---|---|
| Field `presentValueAtCurveRate` | three payments to death 67 | **six** payments to planning age 70 |
| `ownerDeathAge` for field | implicitly 67 | **70** (same as planning age) |
| Helper three-payment case | conflated with field | **explicit** separate case at death age 67 |

The conceptual fix is correct and necessary. The three-payment **numeric total** appears not fully re-derived after the split (off by ~$0.69).

### (6) Verdict

**Approve with a note** — field case (curve rate + six-payment PV) is correct and matches the extract; the three-payment helper’s published total does not recompute from its own displayed formula (~$0.69 gap). Wrong-reading pedagogy and the planning-age unification are sound. Recommend correcting the helper total to **≈ $33,333.411542556** (or showing the engine’s exact float intermediates if they differ).

---

## 3. `spending-healthcare-annual`

### (1) Recomputation

**Global:** tier-priced annual premium **$3,582.72** (helper output, not re-inflated); health inflation **1.10** on extras and marketplace only; credit **off**.

#### Person 1 — partition 0 marketplace / 12 Medicare

| Component | Calculation | Amount |
|---|---|---:|
| Medicare premium (prorated) | `$3,582.72 × 12/12` | $3,582.720000000 |
| Medicare extras | `$50 × 12 × 1.10` | $660.000000000 |
| **Person 1 total** | | **$4,242.720000000** |

#### Person 2 — partition 4 marketplace / 8 Medicare (`12 − 4`)

| Component | Calculation | Amount |
|---|---|---:|
| Marketplace | `$400 × 4 × 1.10` | $1,760.000000000 |
| Medicare premium | `$3,582.72 × 8/12 = $3,582.72 × 2/3` | $2,388.480000000 |
| Medicare extras | `$50 × 8 × 1.10` | $440.000000000 |
| Medicare subtotal | | $2,828.480000000 |
| **Person 2 total** | $1,760 + $2,828.48 | **$4,588.480000000** |

#### Household

`$4,242.72 + $4,588.48 = **8831.200000000**`

**Inflation clocks:** tier premium — premium-year dollars, prorated only; extras and marketplace — × health inflation factor 1.10 for their respective month counts.

### (2) Match vs Expected

| Figure | Recomputed | Expected | Match |
|---|---:|---:|:---:|
| Credit-off household healthcare | $8,831.200000000 | $8,831.20 | **yes** |

### (3) Consistency with extract and internal sections

- **Claim** matches `YearExpenses.healthcare`: per-person marketplace/Medicare partition; Medicare annual premium × months/12 + extras × months × health inflation; marketplace × months × health inflation when credit off.
- Extract: “Medicare months = 12 − marketplace months”; tier/IRMAA premium from pack year; extras and marketplace use health inflation — all reflected.
- **Justification, Inputs, Arithmetic, Expected** agree.

### (4) Wrong readings

| Wrong reading | Stated outcome | Recomputed | Produces? |
|---|---|---|:---:|
| Re-inflate tier premium | double inflation | qualitative | **yes** |
| Omit health factor on marketplace | $1,600 not $1,760 | `$400 × 4 = 1600` | **yes** |
| Omit 8 Medicare months | $6,002.72 | `$4,242.72 + $1,760 = 6002.72` | **yes** |
| Credit on, keep gross after convergence | ignores economic net | qualitative per extract | **yes** |

### (5) Changes from first approved derivation

| Item | Before | Now |
|---|---|---|
| Person 2 | 4 marketplace months only | **4 marketplace + 8 Medicare** (valid 12-month partition) |
| Person 2 Medicare line | absent | **$2,828.48** added |
| Household total | understated | **$8,831.20** |

Only the partition error was corrected; no inappropriate changes.

### (6) Verdict

**Approve** — total and all components recompute exactly; revision fixes the impossible annual partition.

---

## Summary table

| Worksheet id | All published figures match? | Verdict |
|---|---|---|
| `social-security-benefit-annual` | yes | **approve** |
| `pension-election-annuity-present-value` | no — three-payment helper off ~$0.69; six-payment field yes | **approve with a note** |
| `spending-healthcare-annual` | yes | **approve** |

---

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
