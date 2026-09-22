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

---

Appended 2026-09-22 (pull-request review of #730): the re-check below was recorded in the cash-flow-and-summary copy of this report and supersedes the `inherited-distribution-required-annual` values approved above (the post-RBD case is the greater divisor, 6.6, not the greater amount at 10.8).

# Re-check, 2026-09-18 (three worksheets after the slice-eleven comment completion)

The slice-eleven fixtures found three defects in worksheets approved earlier today: spending-insurance-premiums-annual charged a policy in the year its subject attains premiumEndAge, following a schema comment that said "through" where the field comment and the code stop at that age (decision D-PREMIUM-END-AGE; the mode comment now states the code); inherited-distribution-required-annual stated the post-RBD comparison as the greater required amount, where the code selects the greater divisor, and used an owner divisor no table entry can produce; insurance-cash-value-and-death-benefit-annual placed its settling policy at the year after death. Six missing or contradicted contracts became doc comments, Codex Sol revised the three worksheets, and the same reviewer recomputed every value and approved all three (one note: the post-RBD rows were labelled "second year after death" while their divisors are those of the first year after the death year; the label was corrected by the orchestrator, the numbers unchanged). Verbatim output follows.

---

# Independent recomputation review — cash-flow-and-summary worksheets (revision pass)

Sources: the three revised worksheets under `DOCS/calculations/cash-flow-and-summary/`, and the signatures-and-comments extract (`b1-p4-signatures-s11-followups.md`, commit `1b6a0ba9`). No engine bodies were read or executed.

---

## 1. `spending-insurance-premiums-annual.md`

### (1) Recomputation

**Rule applied:** charge `annualPremium` when mode is `lifetime` (subject alive), zero for `paidUp`, and for `untilAge` only when `subjectAge < premiumEndAge` (strict; nothing at or after end age).

**Primary case**

| Policy | Mode | Premium | Subject age | End age | Charge? | Amount |
|--------|------|--------:|------------:|--------:|---------|-------:|
| LTC A | lifetime | 1,200 | 64 | n/a | yes (lifetime, alive) | 1,200 |
| Life B | paidUp | 900 | 70 | n/a | no (paid up) | 0 |
| Life C | untilAge | 600 | 65 | 65 | no (`65 < 65` is false) | 0 |
| LTC D | untilAge | 500 | 66 | 65 | no (`66 < 65` is false) | 0 |

**Sum:** `$1,200 + $0 + $0 + $0 = $1,200`

**Boundary case (Life E)**

- Mode `untilAge`, age 64, end age 65, alive.
- `64 < 65` → charge `$600`.

**Published figures:** primary `$1,200`; boundary `$600`; tolerance `$0.005`.

### (2) Match vs Expected

| Figure | Recomputed | Expected | Match |
|--------|----------:|---------:|:-----:|
| Primary `expenses.insurancePremiums` | $1,200 | $1,200 | **yes** |
| Boundary `expenses.insurancePremiums` | $600 | $600 | **yes** |

### (3) Extract alignment and internal consistency

| Check | Result |
|-------|--------|
| Strict stop at attained `premiumEndAge` | **Matches** extract: `untilAge` charges only while attained age is **below** `premiumEndAge`; subject who has attained that age is skipped (`annualInsurancePremiumRows` comment; `premiumModeSchema` comment). |
| Claim ↔ Justification ↔ Inputs ↔ Arithmetic ↔ Expected | **Agree** on strict `<` comparison and fixed-nominal premiums. |

### (4) Wrong readings

| Wrong reading | Stated value | Recomputed wrong value | Match |
|---------------|-------------:|-----------------------:|:-----:|
| Inclusive through end age (Life C charged) | $1,800 | $1,200 + $600 = $1,800 | **yes** |
| Stop one year early at age 64 | $0 | $0 | **yes** |
| Inflate primary 3% | $1,236 | $1,200 × 1.03 = $1,236 | **yes** |
| Charge paid-up + post-end-age policies | $2,600 | $1,200 + $900 (Life B) + $500 (LTC D) = $2,600 | **yes** |

### (5) Changes from first approved derivation

- **Intended:** Life C at age 65 with end age 65 no longer charged; primary total **$1,800 → $1,200**.
- **Intended:** Claim/Justification now document strict stop-age contract and D-PREMIUM-END-AGE.
- **Should not have changed:** lifetime, paidUp, boundary Life E logic — unchanged and still correct.

### (6) Verdict

**Approve.** All figures recomputed; rule matches extract comments.

---

## 2. `inherited-distribution-required-annual.md`

### (1) Recomputation

**Table anchors (2026 pack `singleLifeTable`):** age 75 → **14.8**; age 76 → 14.1; age 86 → **7.6**; age 88 → 6.6 (current-age lookup only); age 90 → **5.7**.

**Fixed beneficiary continuation:** read once at age 75 → 14.8; next year → `14.8 − 1 = 13.8` (not age-76 entry 14.1).

**Owner fixed arm:** death-year age 86 → entry **7.6**; extract states in `deathYear+1` the arm is already `entry − 1` → **6.6** (one calendar year elapsed after death year).

**Post-RBD rule:** `divisor = max(beneficiaryDivisor, ownerDivisor)` → required amount = `priorYearEndBalance / divisor` (smaller quotient).

---

**Case A — Fixed beneficiary, first year (2027), B = $148,000, divisor 14.8**

1. Table: age 75 → 14.8  
2. Quotient: `$148,000 ÷ 14.8 = $10,000.00`

---

**Case B — Fixed beneficiary, next year (2028), B = $148,000**

1. Fixed continuation: `14.8 − 1 = 13.8`  
2. Quotient: `$148,000 ÷ 13.8 = $10,724.637681159420…`

---

**Case C — Post-RBD, beneficiary divisor greater, B = $148,000**

| Arm | Divisor source | Divisor | Amount |
|-----|----------------|--------:|-------:|
| Beneficiary | stated fixed | 14.8 | $148,000 ÷ 14.8 = **$10,000.00** |
| Owner | age 86 death-year 7.6, −1 elapsed → 6.6 | 6.6 | $148,000 ÷ 6.6 = **$22,424.242424242…** |

- `max(14.8, 6.6) = 14.8` → beneficiary arm wins → **$10,000**

---

**Case D — Post-RBD, owner divisor greater, B = $148,000**

| Arm | Divisor source | Divisor | Amount |
|-----|----------------|--------:|-------:|
| Beneficiary | table age 90 | 5.7 | $148,000 ÷ 5.7 = **$25,964.912280701…** |
| Owner | 7.6 − 1 = 6.6 | 6.6 | $148,000 ÷ 6.6 = **$22,424.242424242…** |

- `max(5.7, 6.6) = 6.6` → owner arm wins → **$22,424.242424242…**

---

**Case E — Pre-RBD ten-year window:** **$0**

**Case F — Final-sweep year (2036), B = $83,000:** full prior-year-end balance → **$83,000**

### (2) Match vs Expected

| Case | Recomputed | Expected | Match |
|------|----------:|---------:|:-----:|
| 2027 beneficiary | $10,000 | $10,000 | **yes** |
| 2028 beneficiary | $10,724.637681… | $10,724.637681… | **yes** |
| Post-RBD, beneficiary divisor greater | $10,000 | $10,000 | **yes** |
| Post-RBD, owner divisor greater | $22,424.242424… | $22,424.242424… | **yes** |
| Pre-RBD window | $0 | $0 | **yes** |
| Final sweep | $83,000 | $83,000 | **yes** |

### (3) Extract alignment and internal consistency

| Check | Result |
|-------|--------|
| Greater **divisor** (not greater amount) | **Matches** “greater-of life-expectancy arm” / at-least-as-rapidly framing; `max(divisors)` yields `min(amounts)`. |
| Owner 7.6 → 6.6 | **Matches** `ownerFixedDivisor` comment (death-year age-86 entry, `entry−1` in `deathYear+1`). |
| Beneficiary 14.8 → 13.8 | **Matches** fixed subtract-one convention; not age-76 re-read (14.1). |
| Claim ↔ Justification ↔ Inputs ↔ Arithmetic ↔ Expected | **Agree** on divisor comparison and all six published amounts. |

**Note:** Inputs label the post-RBD rows “second year after death” while owner divisor **6.6** is the extract value for **one** calendar year elapsed after the death year (`deathYear+1`). Under ordinary “second year after death” = `deathYear+2`, owner divisor would be **5.6** (`7.6 − 2`). The **6.6** figure is arithmetically correct for the extract’s `deathYear+1` rule; only the row label is ambiguous.

### (4) Wrong readings

| Wrong reading | Stated | Recomputed | Match |
|---------------|-------:|-----------:|:-----:|
| Live balance $120,000 | $8,108.108108… | $120,000 ÷ 14.8 = $8,108.108108… | **yes** |
| Re-read beneficiary at age 76 | $10,496.453901… | $148,000 ÷ 14.1 = $10,496.453900… | **yes** |
| Owner double-advance from age-88 table 6.6 | (qualitative) | Table age 88 = 6.6; fixed arm must start at death-year 7.6 | **yes** |
| Greater **amount** in beneficiary-greater case | $22,424.242424… | owner quotient | **yes** |
| Choose by amount in owner-greater case | $25,964.912280… | beneficiary quotient | **yes** |
| Annual quotient in no-annual window | $10,000 | $0 required | **yes** |

### (5) Changes from first approved derivation

- **Intended:** comparison is `max(divisors)`, not `max(amounts)`; beneficiary-greater case **$10,000** (not ~$22,424).
- **Intended:** owner arm uses table **7.6** at death-year age 86 → **6.6** (replacing impossible **10.8**).
- **Intended:** added owner-greater discriminator with beneficiary divisor **5.7** (table age 90).
- **Should not have changed:** $148,000 base, $83,000 final sweep, pre-RBD $0, beneficiary fixed 14.8/13.8 arms — preserved.

### (6) Verdict

**Approve with a note:** all six amounts match; greater-divisor rule and table derivations align with the extract. Note the post-RBD row timing label (“second year after death” vs `deathYear+1` / divisor 6.6) for fixture authors; arithmetic is not affected.

---

## 3. `insurance-cash-value-and-death-benefit-annual.md`

### (1) Recomputation

**Living policy (schedule mode, age 65, death age 90)**

1. Weight: `(65 − 60) / (70 − 60) = 5/10 = 0.5`  
2. Cash value: `$20,000 + 0.5 × ($40,000 − $20,000) = $20,000 + $10,000 = $30,000`

**Settling policy (flatRate, age 65→**revised: attained **70** = death age 70**)**

1. Entry cash value: $60,000; growth 0% → pre-settlement CV = **$60,000**  
2. Death-year payout: `max(face $50,000, CV $60,000) = $60,000`  
3. Post-settlement ending CV for that policy: **$0**

**Totals (death-age year)**

- `insuranceCashValue` = living only = **$30,000**  
- `deathBenefit` = settlement payout = **$60,000**

### (2) Match vs Expected

| Output | Recomputed | Expected | Match |
|--------|----------:|---------:|:-----:|
| `insuranceCashValue` | $30,000 | $30,000 | **yes** |
| `deathBenefit` | $60,000 | $60,000 | **yes** |

### (3) Extract alignment and internal consistency

| Check | Result |
|-------|--------|
| Settlement in death-age year only | **Matches** `annualPermanentLifeTransitions` comment: in death-age year pay `max(deathBenefit, cash value)`, CV → 0; afterwards 0. |
| Settling row at attained age 70 = death age 70 | **Matches** “settlement exactly in the death-age year, not in a later year.” |
| Claim ↔ Justification ↔ Inputs ↔ Arithmetic ↔ Expected | **Agree**; revised input row now matches the death-year narrative. |

### (4) Wrong readings

| Wrong reading | Stated | Recomputed | Match |
|---------------|-------:|-----------:|:-----:|
| Lower endpoint, no interpolation | $20,000 | $20,000 | **yes** |
| Face only | $50,000 | $50,000 | **yes** |
| Retain settled CV | $90,000 year-end CV | $30,000 + $60,000 = $90,000 | **yes** |
| Settling row at age 71 | payout null, CV $0 | year after death — no settlement | **yes** |

### (5) Changes from first approved derivation

- **Intended:** settling policy attained age **71 → 70** (death age); fixes input/death-year mismatch.
- **Preserved (correctly):** $30,000 living CV, $60,000 payout, $0 settled ending CV — amounts unchanged because settlement math was always at death age 70.

### (6) Verdict

**Approve.** All figures match; settlement timing now consistent with extract and arithmetic.

---

## Summary table

| Worksheet id | All figures match Expected? | Verdict |
|--------------|:---------------------------:|---------|
| `spending-insurance-premiums-annual` | yes | **approve** |
| `inherited-distribution-required-annual` | yes | **approve with a note** (post-RBD row timing label vs `deathYear+1` / divisor 6.6) |
| `insurance-cash-value-and-death-benefit-annual` | yes | **approve** |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
