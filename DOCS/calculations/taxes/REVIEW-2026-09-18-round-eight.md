# Independent review, 2026-09-18 (derive round eight, eighteen worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r8.md (the year-ledger types with the 2026-09-18 statements, the expense, contribution, insurance, snapshot and assembly phases, compare.ts, federalTax.ts, the 2026 pack and the plan schema; bodies elided). Scope in this directory: tax-realized-gains-annual, tax-total-annual, cash-flow-tax-character-amount. The report covers all eighteen worksheets across three directories; the verbatim output follows, then the orchestrator note on the four rule-source notes.

---

# Independent Worksheet Review Report

Branch `codex/b1-p4-worksheets-r3`, signatures extract `b1-p4-signatures-r8.md` (2026-09-18). All expected values were recomputed from each worksheet’s Inputs and Justification only; Arithmetic sections were not used as authority.

---

## 1. `spending-debt-service-annual`

**1. id:** `spending-debt-service-annual`

**2. Recomputed values**

| Debt | Step | Value |
|---|---|---|
| A | Grown balance: 10,000 × 1.12000000 | 11,200 |
| A | Level payment: min(12 × 500, 11,200) = min(6,000, 11,200) | 6,000 |
| B | Grown balance: 1,000 × 1.12000000 | 1,120 |
| B | Payoff year 2030 → pay full grown balance | 1,120 |
| **Total** | 6,000 + 1,120 | **7,120** |

**3. Match:** yes

**4. Rule:** yes — grow-then-pay, payoff replaces level payment, payment capped at grown balance (Claim/Justification). Extract documents `payoffYear` lump-sum payoff and `debtService` as principal & interest; grow-then-pay ordering is stated in the worksheet but not in the elided `annualDebtServiceRows` body.

**5. Constants:** none quoted from the pack; no mismatches.

**6. Tolerance:** $0.005 justified (12% growth and ordered fold).

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Pay before grow | 6,000 + 1,000 | 7,000 | yes |
| Debt B ordinary $1,200 | 6,000 + 1,200 | 7,200 | yes |
| Ignore payoff, cap ordinary | 6,000 + 1,120 | (rule failure) | yes |

**8. Family:** outputs `spending-debt-service-annual` only; feeds `spending-total-annual` only.

**9. Verdict:** approve with a note — arithmetic and stated rule are correct; grow-then-pay order is not explicit in the signatures extract (body elided).

---

## 2. `spending-property-costs-annual`

**1. id:** `spending-property-costs-annual`

**2. Recomputed values**

| Property | Step | Value |
|---|---|---|
| Home A (owned, not sale year) | (3,000 + 1,200) × 1.10000000 | 4,620 |
| Home B (sale year 2030) | stop in sale year | 0 |
| **Total** | | **4,620** |

**3. Match:** yes

**4. Rule:** yes — inflate (tax + insurance) × cumulative general-inflation factor; zero in sale year. Extract has `propertyTaxAnnual`, `insuranceAnnual`, `plannedSaleYear`; sale-year exclusion is worksheet-stated, not explicit in extract comments.

**5. Constants:** none from pack; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Charge Home B | 4,620 + (2,000+800)×1.10 | 7,700 | yes |
| Inflate tax only | 3,000×1.10 + 1,200 | 4,500 | yes |
| Stop Home A (mortgage paid) | 0 | 0 | yes |

**8. Family:** correct.

**9. Verdict:** approve with a note — sale-year stop not explicit in extract.

---

## 3. `spending-insurance-premiums-annual`

**1. id:** `spending-insurance-premiums-annual`

**2. Recomputed values**

| Policy | Rule | Premium |
|---|---|---:|
| LTC A | lifetime, alive | 1,200 |
| Life B | paidUp | 0 |
| Life C | untilAge, age 65 ≤ end 65 | 600 |
| LTC D | untilAge, age 66 > end 65 | 0 |
| **Total** | | **1,800** |

No inflation factor applied.

**3. Match:** yes

**4. Rule:** yes — level nominal premiums; `lifetime` / `paidUp` / `untilAge through premiumEndAge`. Matches schema comments (`premiumModeSchema`).

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| 3% inflation on all | 1,200×1.03 + 600×1.03 | 1,854 | yes |
| Stop before age 65 | 1,200 only | 1,200 | yes |
| Charge paid-up + post-end | 1,200+900+600+500 | 3,200 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 4. `spending-care-cost-gross-and-ltc-benefit-annual`

**1. id:** `spending-care-cost-gross-and-ltc-benefit-annual`

**2. Recomputed values**

| Step | Calculation | Value |
|---|---|---:|
| Gross care cost | 60,000 × 1.21000000 | 72,600 |
| Annual cap (pre-elimination) | 5,000 × 12 × 1.05000000² = 60,000 × 1.10250000 | 66,150 |
| Elimination fraction | (365 − 90) / 365 = 275/365 = 0.75342466 | — |
| First-year eligible cap | 66,150 × 0.75342466 | 49,839.0410958904 |
| Benefit | min(72,600, 49,839.0410958904) | 49,839.0410958904 |
| Second policy (2/2 years used) | exhausted | 0 |

**3. Match:** yes (both fields)

**4. Rule:** yes — health-inflation gross cost; rider-grown cap; first-year elimination haircut on cap; benefit-years gate blocks second policy. Schema has `eliminationPeriodDays`, `inflationRiderPct`, `benefitPeriodYears`, `benefitYearsUsed`; elimination haircut and same-owner gate are worksheet-stated, not in visible extract comments.

**5. Constants:** none from pack; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings:**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Nominal gross | 60,000 | 60,000 | yes |
| Skip elimination haircut | min(72,600, 66,150) | 66,150 | yes |
| Haircut on gross | 72,600 × 275/365 | 54,698.6301369863 | yes |
| Exhausted second policy | (qualitative) | — | yes |

**8. Family:** outputs `spending-care-cost-gross-annual` and `long-term-care-benefit-annual`; feeds `spending-total-annual`.

**9. Verdict:** approve with a note — elimination-period and benefit-years logic not documented in extract comments.

---

## 5. `spending-one-time-goals-annual`

**1. id:** `spending-one-time-goals-annual`

**2. Recomputed values**

| Goal | Target | Inflated (×1.10000000) | In 2030 |
|---|---:|---:|---:|
| Roof | 2030 | 11,000 | ✓ |
| Trip | 2030 | 5,500 | ✓ |
| Car | 2031 | — | 0 |
| **Total** | | | **16,500** |

**3. Match:** yes

**4. Rule:** yes — no guardrails → fund in target year at `amount × inflFactor`; skipped goals excluded. Matches `annualOneTimeGoalFundingPhase` comments.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Add 2031 Car | 16,500 + 20,000×1.10 | 38,500 | yes |
| No inflation | 10,000 + 5,000 | 15,000 | yes |
| Guardrail skipped in funded field | +7,000 overstatement | qualitative | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 6. `year-result-contributions`

**1. id:** `year-result-contributions`

**2. Recomputed values**

| Owner | min(desired, IRA limit, wages) |
|---|---:|
| A | min(6,000, 7,500, 50,000) = 6,000 |
| B | min(9,000, 7,500, 50,000) = 7,500 |
| **Total** | **13,500** |

**3. Match:** yes

**4. Rule:** yes — per-owner IRA limit trim (not household-wide); no catch-up for under-50 owners.

**5. Constants:**

| Quoted | Extract (`year2026.contributionLimits`) | Match |
|---|---|---|
| IRA limit 7,500 | `ira: 7_500` | yes |
| Catch-up 1,100 (wrong reading) | `iraCatchUp50: 1_100` | yes |

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Both desired | 15,000 | 15,000 | yes |
| Household-wide limit | 7,500 | 7,500 | yes |
| Under-50 catch-up | 14,600 | 14,600 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 7. `year-result-employer-match`

**1. id:** `year-result-employer-match`

**2. Recomputed values**

| Step | Calculation | Value |
|---|---|---:|
| Pay cap | 50% × 75,000 | 37,500 |
| Matched elective base | min(24,500, 37,500) | 24,500 |
| Raw match | 24,500 × 200% | 49,000 |
| Remaining §415(c) room | 72,000 − 24,500 | 47,500 |
| Credited match | min(49,000, 47,500) | **47,500** |

**3. Match:** yes

**4. Rule:** yes — `min(elective, capPct×wages) × matchPct`, then §415(c) cap after deferrals land. Matches `YearResult.employerMatch` comment.

**5. Constants:**

| Quoted | Extract | Match |
|---|---|---|
| §415(c) 72,000 | `section415cLimit: 72_000` | yes |

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Ignore §415 cap | 49,000 | 49,000 | yes |
| matchPct on all wages | 75,000 × 200% | 150,000 | yes |
| Pay cap after multiply | min(49,000, 37,500) | 37,500 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 8. `surplus-invested-annual`

**1. id:** `surplus-invested-annual`

**2. Recomputed values**

Residual = 100,000 − 50,000 − 10,000 − 8,000 − 2,000 = 30,000  
Floor: max(0, 30,000) = **30,000** → lowest-id cash account `cash-a`.

**3. Match:** yes

**4. Rule:** yes — `max(0, inflows − expenses.total − contributions − tax − penalties)`; destination priority cash then taxable. Matches `YearResult.surplusInvested` comment.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Omit contributions | 40,000 | 40,000 | yes |
| Double-count penalties | 28,000 | 28,000 | yes |
| −5,000 residual | max(0, −5,000) = 0 | 0 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 9. `insurance-cash-value-and-death-benefit-annual`

**1. id:** `insurance-cash-value-and-death-benefit-annual`

**2. Recomputed values**

| Policy | Calculation | Value |
|---|---|---:|
| Living (schedule) | weight = (65−60)/(70−60) = 0.50000000; 20,000 + 0.5×20,000 | 30,000 |
| Settling (death year) | max(face 50,000, cash 60,000); ending CV → 0 | death benefit 60,000 |
| **Totals** | insuranceCashValue; deathBenefit | **30,000; 60,000** |

**3. Match:** yes (both fields)

**4. Rule:** yes — schedule interpolation with endpoint clamping; flat-rate 0% growth; death payout max(face, cash value); settled policy drops from CV. `interpolateByAge` and `cashValueMode` in extract; `max(face, cash)` is worksheet-stated, not explicit in extract.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Lower endpoint only | 20,000 | 20,000 | yes |
| Face only | 50,000 | 50,000 | yes |
| Retain settled CV | 30,000 + 60,000 | 90,000 | yes |

**8. Family:** outputs `insurance-cash-value-annual` and `insurance-death-benefit-annual`; feeds `accounts-net-worth-annual`.

**9. Verdict:** approve with a note — death-year `max(face, cash value)` not explicit in extract.

---

## 10. `year-result-tax-exempt-interest`

**1. id:** `year-result-tax-exempt-interest`

**2. Recomputed values**

Generated = 200,000 × 0.02000000 = 4,000

| Case | Rule | Value |
|---|---|---:|
| A (no ACA contract) | generated only | 4,000 |
| B (known ACA contract) | max(6,000, 4,000) | 6,000 |

**3. Match:** yes (both cases)

**4. Rule:** yes — `balance × taxExemptInterestYieldPct/100`; ACA year takes max(attested, generated). Matches `YearResult.taxExemptInterest` comment and `acaCharacterizedAmountSchema`.

**5. Constants:** none from pack; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Sum attested + generated | 10,000 | 10,000 | yes |
| Generated only in B | 4,000 | 4,000 | yes |
| Non-cash in A | 0 | 0 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 11. `projection-summary-fi-year`

**1. id:** `projection-summary-fi-year`

**2. Recomputed values**

Deflator with 0% inflation = 1.00000000 for all years; FI number = 500,000.

| Case | 2026 | 2027 | 2028 | fiYear |
|---|---:|---:|---:|---|
| Crossing | 490,000 < 500,000 | 500,000 ≥ 500,000 → **first** | 520,000 | **2027** |
| Null | 490,000 | 499,999 | 499,999 | **null** |

**3. Match:** yes (both cases)

**4. Rule:** yes — walk ledger in order; deflate investableTotal; first year with deflated ≥ fiNumber (inclusive); null when none cross. Matches `compare.ts` fiYear/fiAge comments.

**5. Constants:** none; no mismatches.

**6. Tolerance:** exact (year or null) — justified.

**7. Wrong readings (3):** strict `>` → 2028; largest year → 2028; horizon when never → 2028 instead of null — all consistent with stated logic.

**8. Family:** correct (`feeds: none yet`).

**9. Verdict:** approve

---

## 12. `cash-flow-line-plan-dollars`

**1. id:** `cash-flow-line-plan-dollars`

**2. Recomputed values**

Sources = 40,000 + 30,000 + 10,000 = **80,000**  
Destinations = 50,000 + 10,000 + 2,000 + 8,000 + 10,000 = **80,000**  
Difference = **0**  
Post-solve deposit $5,000 excluded from both sides.

**3. Match:** yes

**4. Rule:** yes — household-cash conservation identity; post-solve deposits and tax-character outside. Matches `YearCashFlowCashIdentityTotals`.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Add post-solve to sources | 85,000; diff 5,000 | yes | yes |
| Omit loan proceeds | 70,000; diff −10,000 | yes | yes |
| Double-count contribution transfer | destinations 88,000 | yes | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 13. `accounts-ending-balance-by-category`

**1. id:** `accounts-ending-balance-by-category`

**2. Recomputed values**

| Category | Sum |
|---|---:|
| cash | 10,000 |
| taxable | 20,000 + 5,000 = 25,000 |
| traditional | 30,000 |
| roth | 40,000 |
| hsa | 6,000 |

**3. Match:** yes

**4. Rule:** yes — last ledger year; sum by logical account type; five categories only (no equity comp). Matches `ProjectionSummary.endingByCategory`.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 per member — justified.

**7. Wrong readings (3):** penultimate year, separate taxable accounts, adding property/insurance — qualitative; consistent.

**8. Family:** correct.

**9. Verdict:** approve

---

## 14. `estate-to-charity`

**1. id:** `estate-to-charity`

**2. Recomputed values**

| Account | gross × min(1, charityPct/100) |
|---|---:|
| Traditional A | 100,000 × 0.25000000 = 25,000 |
| Taxable B | 50,000 × 1.00000000 = 50,000 |
| Roth C (spouse) | 0 |
| **Total** | **75,000** |

**3. Match:** yes

**4. Rule:** yes — charity destination only; `gross × min(1, charityPct/100)`. Matches `estateBeneficiarySchema` and `endingEstateToCharity`.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| 25% on every account | 25,000+12,500+10,000 | 47,500 | yes |
| Include Roth at 100% | 75,000+40,000 | 115,000 | yes |
| 25 as decimal | 100,000×25 | 2,500,000 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 15. `hecm-draw-annual`

**1. id:** `hecm-draw-annual`

**2. Recomputed values**

Backstop = min(40,000, 25,000) = 25,000  
hecmDraw = coordinated 0 + backstop = **25,000**  
Remaining shortfall = 40,000 − 25,000 = 15,000 (not in published field).

**3. Match:** yes

**4. Rule:** yes — backstop `min(true shortfall, available line)` regardless of draw policy; coordinated draw 0. Matches `YearResult.hecmDraw` comment.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Full shortfall | 40,000 | 40,000 | yes |
| No backstop (lastResort) | 0 | 0 | yes |
| Add unfunded shortfall | 40,000 | 40,000 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 16. `tax-realized-gains-annual`

**1. id:** `tax-realized-gains-annual`

**2. Recomputed values**

2,500 + 750 + (−200) = **3,050** (signed sum, stated order).

**3. Match:** yes

**4. Rule:** yes — three signed sources summed in order; losses offset gains. Matches `YearResult.realizedGains` comment.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Drop retirement loss | 3,250 | 3,250 | yes |
| Absolute values | 3,450 | 3,450 | yes |
| Withdrawals only | 2,500 | 2,500 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 17. `tax-total-annual`

**1. id:** `tax-total-annual`

**2. Recomputed values**

tax = 12,000 + 3,000 + 0 = **15,000**  
Penalties $500 excluded.

**3. Match:** yes

**4. Rule:** yes — composed federal (regular + AMT + NIIT as pre-aggregated $12,000) + state + further calculators; penalties excluded. Matches `YearResult.tax` / `combineTaxCalculators` boundary.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Add penalties | 15,500 | 15,500 | yes |
| Double-count AMT/NIIT | (qualitative) | — | yes |
| Omit state | 12,000 | 12,000 | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## 18. `cash-flow-tax-character-amount`

**1. id:** `cash-flow-tax-character-amount`

**2. Recomputed values**

Cash sources = 100,000 + 20,000 = **120,000**  
Capital-gain character $30,000 annotates the $100,000 line; contributes $0 to cash totals.

**3. Match:** yes (character 30,000; source total 120,000)

**4. Rule:** yes — tax character is non-cash metadata outside conservation identity; capital gain may be negative. Matches `YearCashFlowTaxCharacter` comment.

**5. Constants:** none; no mismatches.

**6. Tolerance:** $0.005 justified.

**7. Wrong readings (3):**

| Reading | Recomputed | Stated | OK |
|---|---|---:|---|
| Add character as cash | 150,000 | 150,000 | yes |
| Replace gross with gain | 30,000+20,000 | 50,000 | yes |
| Require nonnegative | (rejects valid loss) | qualitative | yes |

**8. Family:** correct.

**9. Verdict:** approve

---

## Summary Table

| id | match | verdict |
|---|---|---|
| spending-debt-service-annual | yes | approve with a note |
| spending-property-costs-annual | yes | approve with a note |
| spending-insurance-premiums-annual | yes | approve |
| spending-care-cost-gross-and-ltc-benefit-annual | yes | approve with a note |
| spending-one-time-goals-annual | yes | approve |
| year-result-contributions | yes | approve |
| year-result-employer-match | yes | approve |
| surplus-invested-annual | yes | approve |
| insurance-cash-value-and-death-benefit-annual | yes | approve with a note |
| year-result-tax-exempt-interest | yes | approve |
| projection-summary-fi-year | yes | approve |
| cash-flow-line-plan-dollars | yes | approve |
| accounts-ending-balance-by-category | yes | approve |
| estate-to-charity | yes | approve |
| hecm-draw-annual | yes | approve |
| tax-realized-gains-annual | yes | approve |
| tax-total-annual | yes | approve |
| cash-flow-tax-character-amount | yes | approve |

**Cross-cutting notes:** All 18 expected values match independent recomputation. All quoted 2026 pack constants (IRA 7,500, catch-up 1,100, §415(c) 72,000) match the extract. Four worksheets rely on behavioral rules stated in the worksheet but not fully documented in the signatures extract (debt grow-then-pay order, property sale-year exclusion, LTC elimination haircut on cap, death payout `max(face, cash value)`); arithmetic and internal consistency are sound for each.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Orchestrator note, 2026-09-18

Four approvals carry the same note: the rule the worksheet applies (the debt's grow-then-pay order with its payoff year; the property costs' sale-year stop; the LTC elimination-period haircut and benefit-years gate; the death-year payout of the larger of face and cash value) is right but was given to the deriver as a contract statement read from the phase bodies, not from a doc comment the extract could show. Those four rules are stated in the next comment patch on the phase functions, so the chain reads comment, worksheet, fixture; no worksheet value changes.

---

# Follow-up review, 2026-09-18 (the inherited-account rows and the penalties composition)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r8b.md (the year-ledger types, strategies/inheritedIra.ts with its regimes, deadlines, divisors and notice waivers, the inherited-distribution and withdrawal-apply-flow phases, rmdShortfallExcise.ts, the funding candidate evaluation and the 2026 pack; bodies elided). Scope in this directory: tax-penalties-annual. The report covers all six worksheets across three directories; all six approved, one with a note that only restates the queued decision D-INHERITED-ROTH-SLICE. Verbatim output follows.

---

# Independent Worksheet Review Report

Branch: `codex/b1-p4-worksheets-r3`  
Authority: Inputs + Justification recomputed independently; divisors/rates checked against `b1-p4-signatures-r8b.md` extract only (no engine bodies).

---

## 1. `inherited-account-final-deadline-year`

### Recomputed values

| Case | Steps | Result |
|---|---|---|
| Non-eligible designated beneficiary | 2026 + 10 | **2036** |
| Minor-child EDB | Majority: 2010 + 21 = 2031; deadline: 2031 + 10 | **2041** |
| Spouse ten-year election | 2026 + 10 | **2036** |
| Single-life regime | No fixed-deadline formula applies | **`finalDeadlineYear` absent** |

### Match
**Yes** — all four cases match Expected exactly.

### Rule applied vs extract
**Yes.** Extract: `finalDeadlineYear` is `deathYear+10` for ten-year rows and `majority+10` for a minor child; `minorMajorityYear = birthYear + 21`; optional/absent when no fixed deadline (single-life / life-expectancy regimes).

###Divisors, rates, limits vs extract
No divisors or rates quoted. Deadline conventions align with `InheritedRegimeClassification` comments (`deathYear+10`; `majority+10` with `minorMajorityYear = birthYear + 21`).

### Tolerance
**Justified.** Integer year arithmetic and absence; exact is correct.

### Wrong readings (3 listed — all verified)

| Wrong reading | Recomputed wrong value | Stated | OK? |
|---|---|---:|---|
| Minor child: death + 10 | 2026 + 10 = 2036 | 2036 (5 yr early vs 2041) | ✓ |
| Minor child: birth + 10 only | 2010 + 10 = 2020 | 2020 | ✓ |
| Single-life: death + 10 | 2036 | 2036 (field should be absent) | ✓ |

### Family
- **outputs:** `inherited-account-final-deadline-year` only — correct.
- **feeds:** `inherited-distribution-required-annual` only — correct.

### Verdict
**Approve**

---

## 2. `inherited-distribution-required-annual`

### Recomputed values

| Case | Steps | Result |
|---|---|---|
| 2027 beneficiary fixed (age-75 lookup) | 148,000 ÷ 14.8 | **$10,000.00** |
| 2028 beneficiary fixed (−1 continuation) | 148,000 ÷ 13.8 = 148,000 ÷ (14.8 − 1) | **$10,724.637681…** |
| Post-RBD greater-required | Beneficiary: 148,000 ÷ 14.8 = $10,000; Owner: 148,000 ÷ 10.8 = $13,703.703703…; max(·,·) | **$13,703.703703…** |
| Pre-RBD ten-year / no annual | Statutory none window | **$0** |
| Final-sweep year | Full prior-year-end balance | **$83,000** |

### Match
**Yes** — all five cases match Expected (quotient cases within stated float tolerance).

### Rule applied vs extract
**Yes.** Prior-Dec-31 balance ÷ divisor; beneficiary fixed divisor read once then −1 per later year (not re-tabled at age 76); post-RBD uses **greater required amount** `max(B/d_ben, B/d_owner)`; no-annual window → 0; final sweep → full prior-year-end balance (execution reconciles to live balance separately).

###Divisors, rates, limits vs extract

| Quoted | Extract | Match? |
|---|---|---|
| Age-75 Single Life **14.8** | `year2026.rmd.singleLifeTable[75] = 14.8` | ✓ |
| Next fixed **13.8** (14.8 − 1) | Fixed-minus-one convention in `beneficiaryFixedDivisor` / comments | ✓ |
| Age-76 table entry **14.1** (wrong-reading reference) | `singleLifeTable[76] = 14.1` | ✓ |
| Owner divisor **10.8** | Fixture input (not table-derived in worksheet) | N/A — given, not asserted from pack |

### Tolerance
**Justified.** Exact for $0 and $83,000; absolute $0.005 appropriate for binary-float quotients (including the mathematically exact $10,000 quotient).

### Wrong readings (4 listed — key ones verified)

| Wrong reading | Recomputed | Stated | OK? |
|---|---|---:|---|
| Live balance $120,000 | 120,000 ÷ 14.8 = 8,108.108108… | 8,108.108108… | ✓ |
| Re-read table at 76 | 148,000 ÷ 14.1 = 10,496.453900… | 10,496.453901… | ✓ (rounding) |
| Greater **divisor** not greater **required** | 148,000 ÷ 14.8 = $10,000 | $10,000 | ✓ |
| Annual quotient in no-annual window | $10,000 vs correct $0 | — | ✓ (qualitative) |

### Family
- **outputs:** `inherited-distribution-required-annual` only — correct.
- **feeds:** `inherited-distribution-required-executed-annual`; `tax-penalties-annual` — correct.

### Verdict
**Approve**

---

## 3. `inherited-distribution-required-executed-annual`

### Recomputed values

| Case | Steps | Result |
|---|---|---|
| Ordinary, sufficient balance | min(8,000, 20,000) | **$8,000** |
| Ordinary, insufficient balance | min(8,000, 5,000) | **$5,000** |
| Final sweep | Full live balance (not evidence amount) | **$61,000** |
| No annual requirement | none → no forced debit | **$0** |
| Notice-waived | waived → no forced debit | **$0** |

### Match
**Yes** — all five match Expected in table order.

### Rule applied vs extract
**Yes.** `min(required, live balance)` in ordinary years; sweep empties live balance (`finalSweepEvidence` required amount is prior-year-end base, execution reconciles to live balance); `none` and `noticeWaived` → executed 0.

###Divisors, rates, limits vs extract
None quoted — N/A.

### Tolerance
**Justified.** Whole-dollar min/select operations; exact is correct.

### Wrong readings (3 listed — all verified)

| Wrong reading | Recomputed | Stated | OK? |
|---|---|---:|---|
| Uncapped $8,000 vs $5,000 balance | Overdraw $3,000; executed $5,000 | $5,000 | ✓ |
| Sweep evidence $83,000 vs live $61,000 | Overdraw $22,000; executed $61,000 | $61,000 | ✓ |
| Force notice-waived $8,000 | Would be $8,000; correct $0 | $0 | ✓ |

### Family
- **outputs:** `inherited-distribution-required-executed-annual` only — correct.
- **feeds:** `inherited-distribution-forced-annual`; `withdrawals-by-category-annual` — correct.

### Verdict
**Approve**

---

## 4. `inherited-distribution-voluntary-annual`

### Recomputed values

Single fixture case (`treat-as-own = false`):

- Forced take (already executed): **$5,000** (classified separately)
- Ordinary plan draw from account: **$12,000**
- **`voluntaryAmount` = $12,000**
- Total cash from account: $5,000 + $12,000 = **$17,000** (only $12,000 is voluntary)

### Match
**Yes**

### Rule applied vs extract
**Yes.** Apply-flow phase writes `voluntaryAmount` from the ordinary withdrawal plan after forced distributions; treat-as-own routes to owner treatment (no inherited voluntary write).

###Divisors, rates, limits vs extract
None quoted — N/A.

### Tolerance
**Justified.** Whole-dollar ledger amounts; exact is correct.

### Wrong readings (3 listed — all verified)

| Wrong reading | Recomputed | Stated | OK? |
|---|---|---:|---|
| Publish total $17,000 as voluntary | Double-counts $5,000 forced | voluntary = $12,000 | ✓ |
| Subtract forced again: $12,000 − $5,000 | **$7,000** | $7,000 | ✓ |
| Treat-as-own effective | Inherited voluntary write suppressed | $0 / no write | ✓ (per extract routing; not in primary Inputs row) |

### Family
- **outputs:** `inherited-distribution-voluntary-annual` only — correct.
- **feeds:** `withdrawals-by-category-annual`; `withdrawals-total-annual` — correct.

### Verdict
**Approve**

---

## 5. `inherited-distribution-forced-annual`

### Recomputed values

| Row | Executed required | Voluntary | Forced contribution |
|---|---:|---:|---:|
| Traditional annual RMD | 8,000 | 4,000 | **8,000** |
| Roth final sweep | 3,000 | 0 | **3,000** |
| Traditional no-requirement | 0 | 2,000 | **0** |

**Gross forced total (`inheritedDistribution`):** 8,000 + 3,000 + 0 = **$11,000**

**Current-code traditional/ordinary-income share (`inheritedTraditionalDistribution`):** traditional forced 8,000 + Roth characterized taxable slice 600 = **$8,600**  
(Roth gross forced $3,000; slice $600 is part of that $3,000, not additional cash)

Voluntary excluded from forced total: 4,000 + 2,000 = $6,000 → contributes $0 to forced sum.

### Match
**Yes** — `inheritedDistribution = $11,000`; `inheritedTraditionalDistribution = $8,600`; discriminating Roth evidence ($3,000 gross, $600 slice) consistent.

### Rule applied vs extract
**Yes.** `inheritedDistribution` = sum of executed required amounts across rows, voluntary excluded. Worksheet correctly documents D-INHERITED-ROTH-SLICE tension: field comment says Roth forced excluded from `inheritedTraditionalDistribution`, but `AnnualInheritedIraDistributionsResult.totals.ordinaryIncome` path adds characterized Roth taxable slice — worksheet reports current-code $8,600, not comment-only $8,000.

###Divisors, rates, limits vs extract
No divisors/rates; D-INHERITED-ROTH-SLICE limit naming matches extract commentary on Roth characterization (`distributionAmount` vs `ordinaryIncome`).

### Tolerance
**Justified.** Whole-dollar sums; exact is correct.

### Wrong readings (4 listed — all verified)

| Wrong reading | Recomputed | Stated | OK? |
|---|---|---:|---|
| Include voluntary | 11,000 + 6,000 = **17,000** | $17,000 | ✓ |
| Exclude Roth sweep | **8,000** | $8,000 | ✓ |
| Add slice to gross again | 11,000 + 600 = **11,600** | $11,600 | ✓ |
| Comment-only traditional share | **8,000** vs current-code **8,600** | $8,000 / $8,600 | ✓ |

### Family
- **outputs:** `inherited-distribution-forced-annual` only — correct.
- **feeds:** `withdrawals-by-category-annual`; `withdrawals-total-annual` — correct.

### Verdict
**Approve with a note** — arithmetic and current-code composition are correct; worksheet appropriately flags the `inheritedTraditionalDistribution` comment vs `ordinaryIncome` composition tension (D-INHERITED-ROTH-SLICE).

---

## 6. `tax-penalties-annual`

### Recomputed values

| Component | Steps | Result |
|---|---|---|
| Early-withdrawal penalty | 20,000 × 10% = 20,000 × 0.10 | **$2,000** |
| RMD shortfall | max(0, 12,000 − 4,000) | **$8,000** |
| §4974 excise | 8,000 × 25% = 8,000 × 0.25 | **$2,000** |
| **Total `penalties`** | 2,000 + 2,000 | **$4,000** |

### Match
**Yes** — all components and total match Expected.

### Rule applied vs extract
**Yes.** `YearResult.penalties` composes early-withdrawal penalty plus §4974 excise on `max(0, required − distributedByDeadline)`; penalties stay outside `tax`/AGI/MAGI. Inherited distributions explicitly excluded from 10% early penalty (separate wrong-reading case).

###Divisors, rates, limits vs extract

| Quoted | Extract | Match? |
|---|---|---|
| §4974 default **25%** | `RMD_SHORTFALL_DEFAULT_RATE = 0.25` | ✓ |
| Corrected **10%** (wrong-reading reference) | `RMD_SHORTFALL_CORRECTED_RATE = 0.10` | ✓ |
| Early-withdrawal **10%** | Cited in `inheritedIra.ts` comment prose (“10% early-withdrawal penalty”); **no named standalone constant in this extract slice** | Consistent with comment; fixture-stated as input |

### Tolerance
**Justified.** Integer dollars × 10% and 25% yield exact whole dollars here.

### Wrong readings (4 listed — monetary ones verified)

| Wrong reading | Recomputed | Stated | OK? |
|---|---|---:|---|
| 25% on full $12,000 requirement | Excise $3,000; total $5,000 | $3,000 / $5,000 | ✓ |
| 10% §4974 on $8,000 shortfall | Excise $800; total $2,800 | $800 / $2,800 | ✓ |
| Omit early-withdrawal | Total **$2,000** | $2,000 | ✓ |
| Early penalty on inherited distribution | Qualitative exclusion | — | ✓ (per extract) |

### Family
- **outputs:** `tax-penalties-annual` only — correct.
- **feeds:** `portfolio-need-annual`; `display-total-spending-annual`; `scenario-lifetime-penalties` — correct.

### Verdict
**Approve**

---

## Summary Table

| id | match | verdict |
|---|---|---|
| `inherited-account-final-deadline-year` | yes | approve |
| `inherited-distribution-required-annual` | yes | approve |
| `inherited-distribution-required-executed-annual` | yes | approve |
| `inherited-distribution-voluntary-annual` | yes | approve |
| `inherited-distribution-forced-annual` | yes | approve with a note |
| `tax-penalties-annual` | yes | approve |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
