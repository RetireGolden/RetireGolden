# Follow-up review, 2026-09-18 (the inherited-account rows and the penalties composition)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the extract b1-p4-signatures-r8b.md (the year-ledger types, strategies/inheritedIra.ts with its regimes, deadlines, divisors and notice waivers, the inherited-distribution and withdrawal-apply-flow phases, rmdShortfallExcise.ts, the funding candidate evaluation and the 2026 pack; bodies elided). Scope in this directory: inherited-distribution-forced-annual. The report covers all six worksheets across three directories; all six approved, one with a note that only restates the queued decision D-INHERITED-ROTH-SLICE. Verbatim output follows.

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
