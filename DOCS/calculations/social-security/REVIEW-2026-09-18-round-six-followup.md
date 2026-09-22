# Independent review, 2026-09-18 (round-six follow-up, seven worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r6b.md (bodies elided), with two defaults that sit in bodies given as a contract statement read from the engine by the orchestrator (the qualified-ratio fallback chain ending at 0.85; reinvestDividends absent means true). Scope in this directory: family-maximum-bend-points. The report covers all seven worksheets across two directories; the verbatim output follows, then the orchestrator note.

---

# Independent Worksheet Review Report

Branch: `codex/b1-p4-worksheets-r3`  
Authority: worksheet Inputs/Justification + `b1-p4-signatures-r6b.md` extract only (no engine bodies, no commands).

---

## 1. `family-maximum-bend-points`

### Recomputed values

**Cross-all-three** (PIA = $4,000/mo; \(b_1{=}1{,}643\), \(b_2{=}2{,}371\), \(b_3{=}3{,}093\)):

| Band | Slice | Rate | Product |
|------|-------|------|---------|
| 1 | \(\min(4{,}000,\,1{,}643)=1{,}643\) | 150% | \(1{,}643\times1.50=2{,}464.50\) |
| 2 | \(\min(4{,}000{-}1{,}643,\,2{,}371{-}1{,}643)=\min(2{,}357,\,728)=728\) | 272% | \(728\times2.72=1{,}980.16\) |
| 3 | \(\min(4{,}000{-}2{,}371,\,3{,}093{-}2{,}371)=\min(1{,}629,\,722)=722\) | 134% | \(722\times1.34=967.48\) |
| 4 | \(\max(4{,}000{-}3{,}093,\,0)=907\) | 175% | \(907\times1.75=1{,}587.25\) |

Sum (unfloored): \(2{,}464.50+1{,}980.16+967.48+1{,}587.25=6{,}999.39\)  
Dime floor (next lower $0.10): **$6,999.30**

**Below-first** (PIA = $1,000/mo):

- Band 1 only: \(1{,}000\times1.50=1{,}500.00\); dime floor: **$1,500.00**

### Match

**yes** — both cases match Expected exactly.

### Constants & rule

- Bend points \(1{,}643 / 2{,}371 / 3{,}093\) match `FAMILY_MAXIMUM_BEND_POINTS[2026]` in the extract.
- Rates 150% / 272% / 134% / 175% match `familyMaximumMonthlyFromPia` comments.
- Four-band slice formula and dime floor match the stated rule.

### Tolerance

Stated: “exact to $0.10” because the published scalar is dime-floored.  
**Justified.** Fixture should assert **exact equality on the floored dime value** (effective tolerance **$0.00** on the published result). Do **not** use `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` ($0.005); the contract quantizes before publication.

### Wrong readings (all three recomputed)

| Misread | Recomputed | Worksheet | Match |
|---------|------------|-----------|-------|
| Omit band 4 | \(2{,}464.50+1{,}980.16+967.48=5{,}412.14\to\) **$5,412.10** | $5,412.10 | yes |
| PIA rates 90/32/15/15 on FM slices | \(1{,}643{\times}0.90=1{,}478.70\); \(728{\times}0.32=232.96\); \(722{\times}0.15=108.30\); \(907{\times}0.15=136.05\); sum \(1{,}956.01\to\) **$1,956.00** | $1,956.00 | yes |
| Unfloored cross-all-three | **$6,999.39** | $6,999.39 | yes |

### Family

- **outputs:** `none` — appropriate (intermediate SS quantity, not a ledger income/expense output id).
- **feeds:** `social-security-benefit-annual` — reasonable downstream consumer.

### Verdict

**approve**

---

## 2. `income-taxable-interest-annual`

### Recomputed values

**Explicit:** \(100{,}000\times2.25/100=\) **$2,250**

**Defaults:** \(80{,}000\times1.25/100=\) **$1,000**  
(`reinvestDividends` absent → true: yield characterized; no cash-inflow credit per contract.)

### Match

**yes**

### Constants & rule

- Interest = prior-year-end balance × account `interestYieldPct` / 100; taxable accounts only; no row for non-positive start balance — consistent with extract comments and contract defaults.
- Account yield overrides blend (inputs supply explicit account rates).

### Tolerance

**$0.005** — justified; aligns with `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` for binary-float dollar scalars.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| Use dividend rate 1.75% | \(100{,}000\times1.75/100=\) **$1,750** | $1,750 | yes |
| Treat 2.25 as fraction | \(100{,}000\times2.25=\) **$225,000** | $225,000 | yes |
| Reinvest suppresses characterization | Correct value remains **$1,000** (not $0) | $0 wrong | yes |

### Family

- **outputs:** `income-taxable-interest-annual` — correct.
- **feeds:** `tax-total-annual`; `magi-annual` — consistent with `YearIncomes.taxableInterest` tax characterization.

### Verdict

**approve**

---

## 3. `income-ordinary-dividends-annual`

### Recomputed values

**Explicit:**

- Dividends: \(100{,}000\times1.75/100=1{,}750\)
- Qualified: \(1{,}750\times0.60=1{,}050\)
- Ordinary: \(1{,}750-1{,}050=\) **$700**

**Defaults:**

- Dividends: \(80{,}000\times2.50/100=2{,}000\)
- Qualified: \(2{,}000\times0.85=1{,}700\)
- Ordinary: \(2{,}000-1{,}700=\) **$300**

### Match

**yes**

### Constants & rule

- `DEFAULT_QUALIFIED_DIVIDEND_RATIO = 0.85` matches extract.
- Ordinary = dividends − qualified; ratio chain (account → blend → 0.85) matches contract statement.

### Tolerance

**$0.005** — justified.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| All dividends ordinary | **$1,750** | $1,750 | yes |
| Force 0.85 ratio | Qualified \(1{,}487.50\); ordinary **$262.50** | $262.50 | yes |
| `reinvestDividends` false → cash inflow | Gross yield \(1{,}000+2{,}000=\) **$3,000** to inflows vs $0 | $3,000 | yes |

### Family

- **outputs:** `income-ordinary-dividends-annual` — correct.
- **feeds:** `tax-total-annual`; `magi-annual` — correct.

### Verdict

**approve**

---

## 4. `income-qualified-dividends-annual`

### Recomputed values

**Explicit:** \(1{,}750\times0.60=\) **$1,050**

**Defaults:** \(2{,}000\times0.85=\) **$1,700**

### Match

**yes**

### Constants & rule

- Default ratio **0.85** matches `DEFAULT_QUALIFIED_DIVIDEND_RATIO`.
- Qualified = dividends × resolved ratio — matches stated rule.

### Tolerance

**$0.005** — justified.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| Force 0.85 on explicit case | \(1{,}750\times0.85=\) **$1,487.50** | $1,487.50 | yes |
| Use 85 instead of 0.85 | \(2{,}000\times85=\) **$170,000** | $170,000 | yes |
| Reinvest suppresses characterization | Correct **$1,700** (not $0) | $0 wrong | yes |

### Family

- **outputs:** `income-qualified-dividends-annual` — correct.
- **feeds:** `tax-total-annual`; `magi-annual` — correct.

### Verdict

**approve**

---

## 5. `income-taxable-yield-annual`

### Recomputed values

**Explicit:**

- Interest: \(100{,}000\times2.25/100=2{,}250\)
- Dividends: \(100{,}000\times1.75/100=1{,}750\)
- Taxable yield: \(2{,}250+1{,}750=\) **$4,000**

**Defaults:**

- Interest: **$1,000**; dividends: **$2,000**
- Taxable yield: \(1{,}000+2{,}000=\) **$3,000**

Tax-exempt yield 0% → excluded. ✓

### Match

**yes**

### Constants & rule

- Taxable yield = interest + dividends (partition does not double-count).
- Tax-exempt interest separate — matches `YearIncomes` commentary.

### Tolerance

**$0.005** — justified.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| Add interest + dividends + qualified + ordinary | \(2{,}250+1{,}750+1{,}050+700=\) **$5,750** | $5,750 | yes |
| Add 0.50% tax-exempt to taxable yield | Exempt \(100{,}000\times0.50/100=500\); wrong total **$4,500** | $4,500 | yes |
| `reinvestDividends` false → $3,000 cash inflow | vs $0 with default true | $3,000 | yes |

### Family

- **outputs:** `income-taxable-yield-annual` — correct.
- **feeds:** `income-total-annual` — correct (`taxableYield` enters `incomes.total` once; components do not re-sum).

### Verdict

**approve**

---

## 6. `spending-required-requested-annual`

### Recomputed values

**Every-term:**

- System-required: \(6{,}000+4{,}000+5{,}000+1{,}000+3{,}000-1{,}000=18{,}000\)
- `requiredSpending`: \(18{,}000+24{,}000+2{,}500+1{,}500=\) **$46,000**

**No-skips:**

- System-required: \(3{,}000+2{,}000+4{,}000+1{,}000+3{,}000-1{,}000=12{,}000\)
- `requiredSpending`: \(12{,}000+18{,}000+2{,}000+0=\) **$32,000**

### Match

**yes**

### Constants & rule

- Members: debt, property, healthcare, insurance, net LTC (`careCost − ltcBenefit`), required lifestyle, required funded goals, **skipped required goals (nominal)** — matches `YearExpenses.requiredSpending` comment (lines 724–731 in extract).
- Skipped required goals included as intended spending — correctly stated.

### Tolerance

**$0.005** — justified for integer inputs here; appropriate fixture convention.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| Omit skipped required | \(46{,}000-1{,}500=\) **$44,500** | $44,500 | yes |
| Gross LTC (no benefit offset) | System \(19{,}000\); total **$47,000** | $47,000 | yes |
| Lifestyle + goals only | \(24{,}000+2{,}500+1{,}500=\) **$28,000** | $28,000 | yes |

### Family

- **outputs:** `spending-required-requested-annual` — correct.
- **feeds:** `spending-required-shortfall-annual` — correct (`requiredShortfall` attribution uses `requiredSpending`).

### Verdict

**approve**

---

## 7. `spending-target-requested-annual`

### Recomputed values

**Every-term:**

- Required base (excludes skips): \(18{,}000+24{,}000+2{,}500=44{,}500\)
- `targetSpending`: \(44{,}500+12{,}000+3{,}500+1{,}500+1{,}000=\) **$62,500**
- Equivalence check: published `requiredSpending` \(46{,}000+12{,}000+3{,}500+1{,}000=\) **$62,500** ✓

**No-skips:**

- Required base: \(12{,}000+18{,}000+2{,}000=32{,}000\)
- `targetSpending`: \(32{,}000+9{,}000+2{,}500+0+0=\) **$43,500**

### Match

**yes**

### Constants & rule

- Composition matches worksheet and extract: required base without skips, then full target lifestyle, target funded goals, skipped required + skipped target (once each).
- Equivalence via published `requiredSpending` avoids double-counting skipped required — algebraically sound.
- `YearExpenses.targetSpending` comment wording is slightly ambiguous on “(or required-classified)” skipped goals, but the worksheet’s explicit decomposition and arithmetic are internally consistent and align with `requiredSpending` already carrying skipped required.

### Tolerance

**$0.005** — justified.

### Wrong readings

| Misread | Recomputed | Stated | Match |
|---------|------------|--------|-------|
| `requiredSpending` + skipped required again | \(46{,}000+1{,}500+12{,}000+3{,}500+1{,}000=\) **$64,000** | $64,000 | yes |
| Omit both skips | \(44{,}500+12{,}000+3{,}500=\) **$60,000** | $60,000 | yes |
| Guardrail-cut target $7,200 vs full $12,000 | \(62{,}500-4{,}800=\) **$57,700** | $57,700 | yes |

### Family

- **outputs:** `spending-target-requested-annual` — correct.
- **feeds:** `spending-target-shortfall-annual` — correct.

### Verdict

**approve with a note** — arithmetic and wrong readings are correct; the extract’s `targetSpending` comment could be read as double-counting skipped required, but this worksheet’s stated formula and equivalence path are the right reading.

---

## Summary Table

| id | match | verdict |
|----|-------|---------|
| `family-maximum-bend-points` | yes | approve |
| `income-taxable-interest-annual` | yes | approve |
| `income-ordinary-dividends-annual` | yes | approve |
| `income-qualified-dividends-annual` | yes | approve |
| `income-taxable-yield-annual` | yes | approve |
| `spending-required-requested-annual` | yes | approve |
| `spending-target-requested-annual` | yes | approve with a note |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Orchestrator note, 2026-09-18

Two notes applied. The family-maximum worksheet said "exact to $0.10"; the fixture asserts exact equality on the dime-floored figure, since the contract quantizes before publication, and the worksheet now says so (its values are unchanged). The reviewer read the targetSpending doc comment added in the day's comment patch as possibly double-counting a skipped required goal (the comment said "requiredSpending + ..." where requiredSpending already carries the skipped amount); the worksheet's formula was right (the required base before skipped amounts, then each skipped amount once), and the comment patch now says exactly that. No worksheet value changed.
