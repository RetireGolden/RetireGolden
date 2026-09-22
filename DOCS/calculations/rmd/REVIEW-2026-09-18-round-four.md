# Independent review, 2026-09-18 (derive round four, nine worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r4.md (built at 47ea1c24 with the 2026-09-18 doc-comment statements applied, and carrying socialSecurity/ssaWageData.ts for the bend points). Scope in this directory: qcd-income-offset-qualified-slice, qcd-limit-and-age-proxy. The report covers all nine worksheets of the round across three directories; the verbatim output follows, then the orchestrator note on the one wording fix.

---

# Independent Worksheet Review Report

Branch `codex/b1-p4-worksheets-r3`. All arithmetic recomputed from Inputs and Justification only; constants checked against `b1-p4-signatures-r4.md`.

---

## 1. `pia-from-aime-bend-points`

**Recomputed values**

| Case | Steps | Result |
|---|---|---|
| Cross-both | Band 1: `1,286 × 0.90 = 1,157.40`; Band 2: `(7,749 − 1,286) × 0.32 = 6,463 × 0.32 = 2,068.16`; Band 3: `(9,000 − 7,749) × 0.15 = 1,251 × 0.15 = 187.65`; Sum `3,413.21`; floor to dime → | **$3,413.20** |
| Below-first | `1,000 × 0.90 = 900.00`; floor to dime → | **$900.00** |

**Match:** yes

**Constants vs extract:** all match — `PIA_BEND_POINTS[2026] = { first: 1286, second: 7749 }`; percentages 90% / 32% / 15% per formula convention; rounding “down to next lower $0.10” matches `PiaFromEarningsResult.piaMonthly` comment.

**Tolerance:** justified — dime-floored currency; exact to $0.10.

**Wrong readings (≤3 recomputed):**
1. Nearest dime on `$3,413.21` → `$3,413.20` (accidental tie) ✓
2. Stated `$3,625.88`: recomputed as `1,157.40 + 2,068.16 + (1,251 × 0.32) = 3,625.88` — i.e. **32% in the third band**, not a flat 32% on all dollars above `b₁` (that gives `$3,305.88`). **Number correct; prose overspecifies the misread.**
3. 2026 tax pack vs `PIA_BEND_POINTS` — qualitative ✓

**Claim consistency:** formula, dime floor, eligibility-year bend points, and units align with extract.

**Family:** `feeds: social-security-benefit-annual` only; `outputs: none` — correct.

**Verdict:** approve with a note (wrong-reading #2 wording does not literally produce `$3,625.88`; the figure matches “32% instead of 15% above `b₂`”).

---

## 2. `current-spouse-excess-poms-order`

**Recomputed values**

- Unreduced excess: `max(0, 0.5 × 3,000 − 1,000) = 500`
- Auxiliary: `500 × 5/6 = 1,250/3 = $416.666666…`
- Own: `1,000 × 13/15 = 2,600/3 = $866.666666…`
- Combined: `3,850/3 = $1,283.333333…`

Spousal factor check: `24 × (25/36 × 1%) = 1/6` reduction → factor `5/6` ✓

**Match:** yes

**Constants vs extract:** 25/36-of-1%-per-month rate and POMS order (`0.5 × worker PIA − own PIA` on raw PIAs, then spousal factor on excess only) match `currentSpouseBenefit.ts` header.

**Tolerance:** `1e-9` justified for rational chain without currency rounding.

**Wrong readings (all 3 recomputed):**
1. Reduce-then-subtract: auxiliary `1,150/3 = $383.333333…`, combined `$1,250` ✓
2. Raw own PIA after reduced spousal: `$250` auxiliary ✓
3. Retirement factor on excess: `500 × 13/15 = $433.333333…` ✓

**Claim consistency:** POMS order, unreduced excess on raw PIAs, own uses `ownActualMonthly` (retirement-reduced), spousal factor only on excess — consistent.

**Family:** correct.

**Verdict:** approve

---

## 3. `current-spouse-excess-fallback`

**Recomputed values**

- Reduced spousal shell: `0.5 × 3,000 × 5/6 = $1,250`
- Reduced own: `2,600/3 = $866.666666…`
- Auxiliary: `max(0, 1,250 − 2,600/3) = 1,150/3 = $383.333333…`
- Combined: `$1,250`

**Match:** yes

**Constants vs extract:** same inputs as POMS worksheet; fallback “reduce-then-subtract” matches `currentSpouseBenefit.ts` header and `annualSocialSecurity` fallback note.

**Tolerance:** `1e-9` for auxiliary; combined `$1,250` exact integer — justified.

**Wrong readings (both recomputed):**
1. POMS-order paired figures: auxiliary `1,250/3`, combined `3,850/3` ✓
2. Raw own PIA subtraction: `$250` auxiliary ✓

**Claim consistency:** reduce `0.5 × worker PIA` by spousal factor first, subtract retirement-reduced own benefit; differs from POMS only by order — confirmed.

**Family:** correct.

**Verdict:** approve

---

## 4. `social-security-payable-months`

**Recomputed values**

| Case | Logic | Months |
|---|---|---:|
| Before claim year | `64 < 65` | **0** |
| Claim year | `max(0, 12 − 4) = 8` | **8** |
| After claim year | `66 > 65` | **12** |

**Match:** yes

**Constants vs extract:** three-branch rule and no-lag convention match `annualSocialSecurityPayableMonths` comment (`max(0, 12 − claim months)` in claim year).

**Tolerance:** exact integers — justified.

**Wrong readings:** qualitative (9 months if claim month included; anniversary fraction; payment lag) — consistent with stated formula.

**Claim consistency:** age-year coordinates, claim month excluded, no calendar lag — consistent.

**Family:** correct.

**Verdict:** approve

---

## 5. `social-security-cola-factor`

**Recomputed values** (`rate = 2.8%` → multiplier `1.028`)

| Year | Exponent | Factor (≥8 sig. fig.) | $2,000 monthly |
|---|---:|---|---:|
| 2026 | `1.028^0` | `1.00000000` | $2,000 |
| 2027 | `1.028^1` | `1.02800000` | $2,056 |
| 2028 | `1.028^2` | `1.05678400` | $2,113.568 |

`1.028^2 = 1,028 × 1,028 / 1,000,000 = 1.056784` exactly.

**Match:** yes

**Constants vs extract:** `year2026.socialSecurity.colaPct = 2.8`; “factor 1 in the first year” / compounds from projection start — matches payable-months comment block.

**Tolerance:** `1e-12` for two multiplications of exact decimal — justified.

**Wrong readings (all 3 recomputed):**
1. COLA in year 1: `1.028`, `1.056784`, `1.086373952` (`1.028^3`) ✓
2. Simple addition, year-3 offset 2: `1 + 2 × 0.028 = 1.056` ✓
3. Dual-rate combination — qualitative ✓

**Claim consistency:** exponent 0 at start year; `(1 + rate)^n` model — consistent.

**Family:** correct.

**Verdict:** approve

---

## 6. `medicare-magi-composition`

**Recomputed values**

- Positive: `max(0, 40,000 + 5,000 + 2,000 + 3,000 + 1,000) = $51,000`
- Floor: `max(0, −10,000 + 4,000) = $0`

**Match:** yes

**Constants vs extract:** five-term sum and `max(0, …)` floor match `YearResult.magi` comment verbatim.

**Tolerance:** exact to cent on exact inputs — justified.

**Wrong readings (all 3 recomputed):**
1. Omit tax-exempt interest: `$50,000` ✓
2. Gross SS — qualitative ✓
3. No floor: `−$6,000` ✓

**Claim consistency:** composition, zero floor, no separate untaxed-SS add-back — consistent.

**Family:** `outputs: magi-annual`; `feeds: irmaa-surcharge-annual`, `medicare-premiums-annual` — correct.

**Verdict:** approve

---

## 7. `irmaa-lookback-selection`

**Recomputed values**

| Case | Selected year | MAGI | Source |
|---|---:|---:|---|
| Ordinary | 2026 (`2028 − 2`) | $120,000 | projected |
| SSA-44 lower | 2027 (`$90,000 < $120,000`) | $90,000 | projected |
| SSA-44 tie | 2026 (not strictly lower) | $100,000 | projected |
| First-year fallback | 2024 | $125,000 | historicalInput |
| Second-year fallback | 2025 | $80,000 | planFallback |

**Match:** yes

**Constants vs extract:** two-year default; SSA-44 selects lower of year−2 and year−1; ties keep year−2 (`irmaaLookbackMagiYear` comment); fallback chain `historicalAnnualMagiByYear` → `recentAnnualMagi` — all consistent.

**Tolerance:** exact year/source enums and cent-exact MAGI — justified.

**Wrong readings:** qualitative; tie-case behavior correctly distinguished from “always year−1.”

**Claim consistency:** selection logic, sources, and timing align with `annualHealthcareExpenses` / `medicare.ts` comments.

**Family:** `outputs: none`; feeds IRMAA and Medicare premium worksheets — correct.

**Verdict:** approve

---

## 8. `qcd-income-offset-qualified-slice`

**Recomputed values**

- Qualified before §408(d)(8)(A) offset: `min(50,000, 40,000) = $40,000`
- `qcdIncomeOffset`: `max(0, 40,000 − 5,000) = $35,000`
- Gift beyond RMD: `$10,000` (no offset)
- Non-qualified gift: `$20,000` (`$10,000` inside gross RMD, `$10,000` beyond RMD)
- Ordinary inclusion: `50,000 − 35,000 + 10,000 = $25,000`
- Published: `qcd = $60,000`, `rmd = $50,000` (gross)

**Match:** yes

**Constants vs extract:** cap order `min(gift from RMD, aggregate includible) − §408(d)(8)(A) offset`; beyond-RMD dollars carry no offset; `rmd` stays gross — matches `YearResult.qcd` and owner-character comments.

**Tolerance:** exact currency subtraction — justified.

**Wrong readings (numeric one recomputed):**
1. `min(60,000, 50,000) − 5,000 = $45,000` ✓
2–4. qualitative — logically sound

**Claim consistency:** offset cap order, gross publications, beyond-RMD ordinary delta — consistent.

**Family:** `outputs: qcd-annual`; `feeds: tax-total-annual`, `magi-annual` — correct.

**Verdict:** approve

---

## 9. `qcd-limit-and-age-proxy`

**Recomputed values**

| Case | Cap | Age gate | Qualified gift |
|---|---|---:|---:|
| At cap | `111,000 × 1` | 71 (any month) | **$111,000** |
| Age 70 / June | `111,000` | eligible (June ≤ June) | **$1,000** |
| Age 70 / July | `111,000` | ineligible (July > June) | **$0** |

**Match:** yes

**Constants vs extract:** `year2026.rmd.qcdAnnualLimit = 111_000`; age proxy “attained 71, or 70 with birth month June or earlier”; limit growth 1 for 2026 pack — all match.

**Tolerance:** exact cents and discrete age comparison — justified.

**Wrong readings:** qualitative (household cap, double growth, age-71-only) — consistent with per-donor, single-growth conventions.

**Claim consistency:** limit source, growth factor, annual 70½ proxy — consistent.

**Family:** `outputs: qcd-annual`; `feeds: tax-total-annual`, `magi-annual` — correct.

**Verdict:** approve

---

## Summary Table

| id | match | verdict |
|---|---|---|
| `pia-from-aime-bend-points` | yes | approve with a note |
| `current-spouse-excess-poms-order` | yes | approve |
| `current-spouse-excess-fallback` | yes | approve |
| `social-security-payable-months` | yes | approve |
| `social-security-cola-factor` | yes | approve |
| `medicare-magi-composition` | yes | approve |
| `irmaa-lookback-selection` | yes | approve |
| `qcd-income-offset-qualified-slice` | yes | approve |
| `qcd-limit-and-age-proxy` | yes | approve |

**Note:** Only finding is on `pia-from-aime-bend-points` wrong-reading #2: the dollar figure `$3,625.88` is arithmetically correct for using 32% in the third band, but the phrase “32% on all AIME above the first bend” would yield `$3,305.88` instead.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

# Orchestrator note, 2026-09-18

The one note, on pia-from-aime-bend-points, was applied: the second wrong reading's figure `$3,625.88` is what applying 32% instead of 15% to the AIME above the second bend point produces, while its wording said "32% to all AIME above the first bend" (which gives `$3,305.88`). The wording now matches the figure and names the other reading beside it; no value changed.

---

# Re-check, 2026-09-18 (QCD offset after the allocation-order correction)

The implementation's fixture found that the engine charges the non-qualified remainder of a gift against the from-RMD portion first and turns the unabsorbed section 219 offset into non-qualified ordinary income, where the first derivation (and the qcd comment written earlier that day) put the qualified slice first: on the worksheet's inputs production publishes an offset of 30,000 and a delta of 5,000, not 35,000 and 10,000. The comment was corrected, Codex Sol re-derived the worksheet on it, the fixture and its receipt follow it, and the same reviewer recomputed every figure and approved. Verbatim output follows.

---

# Independent recomputation report — `qcd-income-offset-qualified-slice.md`

**Scope:** Worksheet at `DOCS/calculations/rmd/qcd-income-offset-qualified-slice.md`, allocation order from the corrected `YearResult.qcd` comment in the signatures extract (f4fc9196). No engine execution; no reads under `packages/engine/src`.

---

## 1. Recomputation from Inputs and stated order

**Inputs**

| Input | Value |
|---|---:|
| Gross gift | 60,000 |
| Gift from RMD | 50,000 |
| Gross RMD | 50,000 |
| Aggregate includible IRA amount | 40,000 |
| Remaining §408(d)(8)(A) offset | 5,000 |

**Order applied (per Claim and comment):** qualified cap → charge non-qualified remainder against from-RMD first → qualified from RMD → income offset with §219 reduction → unabsorbed §219 (+ beyond-RMD non-qualified) as ordinary income → gross RMD unchanged → ordinary inclusion.

| Step | Calculation | Result |
|---|---|---:|
| Qualified slice | `min(60,000, 40,000)` | **40,000** |
| Non-qualified remainder | `60,000 − 40,000` | **20,000** |
| Non-qualified charged to from-RMD first | `min(50,000, 20,000)` | **20,000** |
| Qualified from RMD | `50,000 − 20,000` | **30,000** |
| Post-§219 qualified ceiling | `40,000 − 5,000` | **35,000** |
| Income offset | `min(30,000, 35,000)` | **30,000** |
| Non-qualified beyond RMD | All 20,000 non-qualified absorbed within 50,000 from-RMD | **0** |
| Unabsorbed §219 / ordinary-income delta | From-RMD qualified slice has `30,000 − 30,000 = 0` capacity left to absorb §219; delta `5,000 + 0` | **5,000** |
| Gross RMD | unchanged | **50,000** |
| Gross QCD | unchanged | **60,000** |
| Ordinary inclusion | `50,000 − 30,000 + 5,000` | **25,000** |

---

## 2. Match vs Expected (yes/no)

| Published figure | Worksheet Expected | Recomputed | Match |
|---|---:|---:|---|
| `qcd` | 60,000 | 60,000 | **yes** |
| `rmd` | 50,000 | 50,000 | **yes** |
| Qualified gift | 40,000 | 40,000 | **yes** |
| Total non-qualified gift | 20,000 | 20,000 | **yes** |
| `qualifiedFromRmd` | 30,000 | 30,000 | **yes** |
| `qcdIncomeOffset` | 30,000 | 30,000 | **yes** |
| Unabsorbed §219 / non-qualified ordinary-income delta | 5,000 | 5,000 | **yes** |
| Non-qualified dollars beyond the RMD | 0 | 0 | **yes** |
| Resulting ordinary inclusion | 25,000 | 25,000 | **yes** |

**All nine figures match.**

---

## 3. Wrong readings — do they produce their stated values?

| Wrong reading | Stated wrong values | Independent check | Produces stated values? |
|---|---|---|---|
| Qualified slice allocated before charging non-qualified against from-RMD | Offset **35,000**; beyond-RMD ordinary delta **10,000** | `qualifiedFromRmd = min(50,000, 40,000) = 40,000` (no 20,000 non-qualified charge first); offset `min(40,000, 35,000) = 35,000`; gift beyond from-RMD `60,000 − 50,000 = 10,000` remains ordinary | **yes** |
| Forgetting the §219 offset | Offset **30,000**; ordinary delta **0** | `min(30,000, 40,000) = 30,000`; no unabsorbed §219 term | **yes** |
| Reducing `rmd` by gift taken against it | `rmd = 10,000` | `50,000 − 40,000 = 10,000` | **yes** |

---

## 4. Claim order and tolerance vs comment and arithmetic

**Claim order:** Matches the corrected `YearResult.qcd` comment verbatim in sequence:

1. `qualified = min(gift, aggregate includible amount)`
2. Non-qualified remainder charged against from-RMD first
3. `qualifiedFromRmd = fromRmd − min(fromRmd, gift − qualified)`
4. Offset `min(qualifiedFromRmd, qualified − §408(d)(8)(A) offset)`
5. Unabsorbed §219 plus beyond-RMD non-qualified → ordinary income
6. `rmd` gross

**Tolerance:** “Exact” is correct — every expected value is a whole-dollar result of integer `min`, addition, and subtraction only; no rounding layer is needed.

**Ordinary-inclusion bridge:** `rmd − qcdIncomeOffset + ordinary-income delta` is consistent with gross RMD publication and the comment’s separation of exclusion from gross gift/RMD totals.

---

## 5. Verdict

**Approve.** The re-derived worksheet recomputes cleanly from its inputs under the corrected allocation order; every Expected figure matches; each Wrong reading correctly isolates a distinct misread; the Claim and exact tolerance align with the corrected comment and the arithmetic.

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
