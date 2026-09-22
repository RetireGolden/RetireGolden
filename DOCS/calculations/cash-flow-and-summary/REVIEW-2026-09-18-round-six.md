# Independent review, 2026-09-18 (derive round six, eleven worksheets)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r6.md (the year-ledger types with the 2026-09-18 comment statements, the flexible-goal scheduler and phase, the income-stream modules, the expense summary and guardrail funding, the lifestyle layers, the snapshot and assembly, and the plan schema; built at 47ea1c24, bodies elided). Scope in this directory: flexible-goal-outcomes-annual, projection-result-ending-investable, projection-result-ending-net-worth, income-wages-annual, income-pension-annual, income-annuity-annual, income-recurring-annual, income-one-time-annual, spending-intended-annual. The report covers all eleven worksheets of the round across two directories; the verbatim output follows. Its two notes: the flexible-goal worksheet follows the scheduler where the plan schema's GoalFlexibility comment promises a movable/skippable distinction the engine does not make (queued for Nathan as D-GOAL-FLEXIBILITY); the shortfall worksheet leaves the depletion-year assertion to the fixture because the extract did not carry the tolerance constant's value (ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS is 0.005; the fixture asserts it).

---

# Independent Worksheet Review Report

Review scope: eleven worksheets on branch `codex/b1-p4-worksheets-r3`, recomputed from **Inputs** and **Justification** only (Arithmetic not trusted). Rule cross-check against `b1-p4-signatures-r6.md` (2026-09-18 comments). No engine bodies read; no commands run.

---

## 1. `flexible-goal-outcomes-annual`

**Recomputed (guardrail-active case, 2030)**

Nominal amounts (today × 1.10): $1,100; $1,100; $1,100; $550; $440.

Visiting order: required fixed → target movable → ideal movable → excess movable (pri 1) → excess skippable (pri 2).

| Step | Goal | Outcome | Budget before | Paid | Budget after |
|---|---|---|---:|---:|---:|
| 1 | Required fixed | Funded (no budget use) | $1,700 | $1,100 | $1,700 |
| 2 | Target movable | Fully funded | $1,700 | $1,100 | $600 |
| 3 | Ideal movable | Partial (min = $1,100×50% = $550; $600 ≥ $550) | $600 | $600 | $0 |
| 4 | Excess movable | Deferred (2030 < latest 2031) | $0 | — | $0 |
| 5 | Excess skippable | Skipped (at latest year) | $0 | — | $0 |

- Counts: funded = 2, partiallyFunded = 1, deferred = 1, skipped = 1  
- fundedAmount = $1,100 + $1,100 + $600 = **$2,800**  
- unfundedAmount = ($1,100 − $600) + $440 = $500 + $440 = **$940**

**Guardrail-off case:** all six fields = 0.

**Match:** yes (both cases).

**Rule alignment:** Matches `YearResult.flexibleGoals` and scheduler comments: classification → priority → plan order; fixed funds unconditionally in target year without consuming flexible budget; full fund when budget covers inflated amount; partial when allowed and budget ≥ inflated minimum; defer before `latestYear`; skip at `latestYear` with skipped amount in layer intended spending and in `unfundedAmount`. Worksheet correctly follows scheduler over `GoalFlexibility` schema text (noted under Limits).

**Tolerance:** Exact for counts; $0.005 for dollar amounts justified (nominal inflation products in binary float; extract defines `EPSILON = 0.005` in scheduler module).

**Wrong readings (3/3 verified):**
1. Fixed consumes budget → target defers, ideal partial $600 → counts 1/1/2/1, fundedAmount $1,700, unfunded $940 ✓  
2. Min tested on $1,000 today ($500) vs correct $550 — qualitative threshold error; with $520 remainder, wrong rule could misclassify ✓  
3. Drop skipped $440 → unfunded $500 ✓  

**Family:** `outputs` lists the six published flexible-goal fields; `feeds: spending-intended-annual` is correct (skipped goals feed layer summaries). Appropriate for year-row publication.

**Verdict:** approve with note (documented schema vs scheduler divergence on skippable at `latestYear`).

---

## 2. `projection-result-ending-investable`

**Recomputed**

Last ordered row = 2031 → endingInvestable = **$487,250.125**.  
Empty `years` → **$0**.

**Match:** yes.

**Rule alignment:** Matches `ProjectionResult.endingInvestable` comment: terminal copy of last row’s `investableTotal`, not a sum or first row.

**Tolerance:** $0.005 for copied ledger dollars is standard and justified.

**Wrong readings (2/2):** First row $510,000 ✓; sum $997,250.125 ✓.

**Family:** Terminal projection result; `feeds: none` correct.

**Verdict:** approve.

---

## 3. `projection-result-ending-net-worth`

**Recomputed**

Last row 2031 → **$901,375.625**. Empty rows → **$0**.

**Match:** yes.

**Rule alignment:** Matches `ProjectionResult.endingNetWorth`: copy last row `netWorth`, no recomputation.

**Tolerance:** $0.005 justified.

**Wrong readings (2/2):** First row $925,000 ✓; substituting ending investable is a different field ✓.

**Family:** Terminal projection result; `feeds: none` correct.

**Verdict:** approve.

---

## 4. `income-wages-annual`

**Recomputed**

- Elapsed: 2030 − 2028 = 2  
- Real-growth factor: (1 + 2/100)² = 1.02000000² = **1.04040000**  
- Nominal: 80,000 × 1.04040000 × 1.08 = 83,232 × 1.08 = **$89,890.56**  
- Age 64 < stop age 65, owner alive → row pays.

**Match:** yes.

**Rule alignment:** Matches `wageIncomeStreams` comments: `Math.pow(1 + realGrowthPct/100, year − startYear)` then × `inflFactor`; skip when dead or stop age attained (`endAge ?? retirementAge`); pass 1 before Social Security.

**Tolerance:** $0.005 justified for float product.

**Wrong readings (3/3):** Inflation only $86,400 ✓; age 64 treated as stopped $0 ✓; re-bracketing can move last binary digit (qualitative) ✓.

**Family:** `outputs: income-wages-annual`; feeds `income-total-annual` and `social-security-benefit-annual` (earnings test) — correct.

**Verdict:** approve.

---

## 5. `income-pension-annual`

**Recomputed**

- COLA factor (2 years since start at 65, current would-be age 67): 1.03000000² = **1.06090000**  
- Full annual: 2,000 × 12 × 1.06090000 = **$25,461.60**  
- Survivor (owner dead, spouse alive, 50%): 25,461.60 × 0.50 = **$12,730.80**

**Match:** yes.

**Rule alignment:** Matches pension schema (`monthlyAmount`, annual `colaPct`, `survivorPct`); survivor continuation after owner death; lump-sum absent so pension pays.

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** Full $25,461.60 ✓; 50% before COLA $12,000 ✓; gate on deceased owner alone $0 ✓.

**Family:** `outputs: income-pension-annual`; `feeds: income-total-annual` — correct.

**Verdict:** approve.

---

## 6. `income-annuity-annual`

**Recomputed**

- COLA factor (1 year since start 65, age 66): **1.02000000**  
- Full annual: 1,500 × 12 × 1.02000000 = **$18,360.00**  
- Joint-survivor (owner dead, other alive, 60%): 18,360 × 0.60 = **$11,016.00**

**Match:** yes.

**Rule alignment:** Matches `jointSurvivor` payout form and `survivorPct` comment; life-only would stop at owner death.

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** Life-only $0 ✓; full $18,360 ✓; 60% of monthly without COLA $10,800 ✓.

**Family:** `outputs: income-annuity-annual`; `feeds: income-total-annual` — correct.

**Verdict:** approve.

---

## 7. `income-recurring-annual`

**Recomputed**

2030 ∈ [2029, 2032], `anyAlive` true, `inflationAdjusted` true:  
12,000 × 1.08 = **$12,960.00** (`taxTreatment: none` does not zero cash).

**Match:** yes.

**Rule alignment:** Matches `otherIncomeStreams`: inclusive year window, household `anyAlive` gate, inflation only when elected.

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** No inflation $12,000 ✓; tax-free exclusion $0 (wrong) ✓; post-death gate $0 vs $12,960 (wrong) ✓.

**Family:** `outputs: income-recurring-annual`; `feeds: income-total-annual` — correct.

**Verdict:** approve.

---

## 8. `income-one-time-annual`

**Recomputed**

2031 = payment year, `anyAlive` true, inflation adjusted:  
50,000 × 1.12 = **$56,000.00** (capital-gain tax character does not exclude cash).

**Match:** yes.

**Rule alignment:** Exact-year gate; household alive; inflation when elected — all per extract.

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** Already nominal $50,000 ✓; wrong year would pay $56,000 but gate gives $0 ✓; capital-gain exclusion $0 ✓.

**Family:** `outputs: income-one-time-annual`; `feeds: income-total-annual` — correct.

**Verdict:** approve.

---

## 9. `spending-intended-annual`

**Recomputed**

- Required summary: 20,000 + 30,000 + 2,000 + 1,000 = **$53,000**  
- Target summary: 53,000 + 15,000 + 3,000 + 2,000 = **$73,000**  
- Ideal increment: 6,000 + 1,000 + 500 = **$7,500**  
- Excess increment: 4,000 + 500 + 250 = **$4,750**  
- intendedSpending: 73,000 + 7,500 + 4,750 = **$85,250**

**Match:** yes.

**Rule alignment:** Matches `YearExpenses`: required/target are cumulative layer summaries including funded and skipped goals; ideal/excess are incremental; `intendedSpending` = target + ideal + excess (not required + target again).

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** Omit skipped $81,500 ✓; double-count $138,250 ✓; cumulative ideal/excess misread (qualitative) ✓.

**Family:** `outputs: spending-intended-annual`; `feeds: none` — correct for a published year-row total.

**Verdict:** approve.

---

## 10. `spending-base-annual`

**Recomputed**

- Target layer after guardrail: 24,000 × min(1, 0.75) = 24,000 × 0.75 = **$18,000**  
- baseSpending: 36,000 + 18,000 + 4,000 + 1,500 = **$59,500**  
- One-time goal $8,000 excluded.

**Match:** yes.

**Rule alignment:** Matches `YearExpenses.baseSpending` comment: required lifestyle full; target × min(1, guardrailFactor); ideal and excess **funded** lifestyle added; one-time goals excluded.

**Tolerance:** $0.005 justified.

**Wrong readings (3/3):** Factor on required $50,500 ✓; include one-time $67,500 ✓; omit ideal/excess $54,000 ✓.

**Family:** `outputs: spending-base-annual`; `feeds: spending-total-annual` — correct.

**Verdict:** approve.

---

## 11. `spending-shortfall-annual`

**Recomputed**

- After withdrawals: 12,000 − 10,000 = **$2,000**  
- After HECM backstop: 2,000 − 1,500 = **$500**  
- depletionYear = 2034 iff $500 > `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` and no earlier exceedance (tolerance not numerically stated in extract — worksheet correctly does not invent it).

**Match:** yes (shortfall dollar figure).

**Rule alignment:** Matches `YearResult.shortfall` comment: gap **after** withdrawals and HECM draw; `depletionYear` gated on named tolerance, not any positive residue.

**Tolerance:** $0.005 for shortfall dollar justified; depletion-year exactness correctly conditional on fixture supplying tolerance.

**Wrong readings (3/3):** Pre-HECM $2,000 ✓; add HECM as expense $3,500 ✓; any-positive-residue depletion (qualitative vs tolerance gate) ✓.

**Family:** `outputs: spending-shortfall-annual`; `feeds: none` — correct.

**Verdict:** approve with note (depletion-year assertion appropriately deferred to tolerance-supplying fixture).

---

## Summary Table

| id | match | verdict |
|---|---|---|
| flexible-goal-outcomes-annual | yes | approve with note |
| projection-result-ending-investable | yes | approve |
| projection-result-ending-net-worth | yes | approve |
| income-wages-annual | yes | approve |
| income-pension-annual | yes | approve |
| income-annuity-annual | yes | approve |
| income-recurring-annual | yes | approve |
| income-one-time-annual | yes | approve |
| spending-intended-annual | yes | approve |
| spending-base-annual | yes | approve |
| spending-shortfall-annual | yes | approve with note |

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.

---

## Re-check 2026-09-22: flexible-goal-outcomes-annual two cases

**Scope:** Re-derived worksheet `flexible-goal-outcomes-annual.md` (revision 2026-09-22). Recomputed from **Inputs** and **Justification** only (Arithmetic not trusted). No engine bodies read; no commands run.

**Shared inputs**

Planning year 2030; cumulative inflation factor `1.10`. Visiting order: required fixed → target movable → ideal movable → excess movable (priority 1) → excess skippable (priority 2).

Nominal amounts (today × 1.10): $1,100; $1,100; $1,100; $550; $440.

### Case A — non-cutting pull-forward year, remaining upside budget $1,700

| Step | Goal | Nominal | Budget constrains? | Outcome | Budget before | Paid | Budget after |
|---:|---|---:|---|---|---:|---:|---:|
| 1 | Required fixed | $1,100 | No (fixed in target year; does not draw flexible budget) | Funded | $1,700 | $1,100 | $1,700 |
| 2 | Target movable | $1,100 | Yes (2030 < target 2031) | Fully funded | $1,700 | $1,100 | $600 |
| 3 | Ideal movable | $1,100 | Yes (2030 < target 2031) | Partial: inflated minimum = $1,100 × 50% = $550; $600 ≥ $550 → pay min($1,100, $600) = $600; unfunded $500 | $600 | $600 | $0 |
| 4 | Excess movable | $550 | Yes (2030 < target 2031) | Deferred (2030 < latest 2032; no partial rule; budget $0) | $0 | — | $0 |
| 5 | Excess skippable | $440 | No (in target year in a non-cutting year → funds in full regardless of exhausted budget) | Funded | $0 | $440 | $0 |

- Counts: funded = **3**, partiallyFunded = **1**, deferred = **1**, skipped = **0**
- fundedAmount = $1,100 + $1,100 + $600 + $440 = **$3,240**
- unfundedAmount = $1,100 − $600 = **$500**

**Match worksheet Expected:** yes.

### Case B — cutting year, flexible budget 0

| Step | Goal | Nominal | Budget constrains? | Outcome | Budget before | Paid | Budget after |
|---:|---|---:|---|---|---:|---:|---:|
| 1 | Required fixed | $1,100 | No (fixed in target year) | Funded | $0 | $1,100 | $0 |
| 2 | Target movable | $1,100 | Yes (cutting year) | Deferred (2030 < latest 2032) | $0 | — | $0 |
| 3 | Ideal movable | $1,100 | Yes (cutting year) | Deferred (2030 < latest 2032) | $0 | — | $0 |
| 4 | Excess movable | $550 | Yes (cutting year) | Deferred (2030 < latest 2032) | $0 | — | $0 |
| 5 | Excess skippable | $440 | Yes (cutting year; at latestYear 2030) | Skipped; $440 unfunded (intended spending in excess layer) | $0 | — | $0 |

- Counts: funded = **1**, partiallyFunded = **0**, deferred = **3**, skipped = **1**
- fundedAmount = **$1,100**
- unfundedAmount = **$440**

**Match worksheet Expected:** yes.

**Guardrail-off case:** all six published fields = 0 (per Justification).

**Rule alignment (Justification vs quoted contract):** Matches the worksheet's stated contract: classification → priority → plan order; fixed goal funds unconditionally in target year without consuming flexible budget; flexible budget constrains movable/skippable goals only when funded before target year or in a cutting year; in a non-cutting year a goal in or at its target year funds in full; full fund when budget covers inflated amount; partial when allowed and budget ≥ inflated minimum; defer before `latestYear`; skip at `latestYear` in a cutting year with skipped amount in layer intended spending and `unfundedAmount`. The revision correctly splits the prior unreachable single case (cutting year with $1,700 budget) into pull-forward (Case A) and cutting (Case B).

**Wrong readings (3/3 verified):**
1. Fixed consumes flexible budget → remainder $600; goal 2 defers; goal 3 partial $600; goal 4 defers; goal 5 still funds $440 in full → counts **2/1/2/0**, fundedAmount **$2,140**, unfundedAmount **$500** ✓
2. Goal 3 minimum tested on $1,000 today ($500) vs correct inflated $550 — qualitative threshold error; with $600 remainder both rules agree (coincidental match 3/1/1/0, $3,240 / $500); with $520 remainder wrong rule would partial where correct rule defers ✓
3. Case B: drop terminal skipped $440 → unfunded **$0** instead of **$440** ✓

**Verdict:** approve.

Reviewed by: cursor (composer-2.5), 2026-09-22 (re-check), by independent recomputation without executing the engine.

---

## Re-check 2026-09-22 (correction): flexible-goal-outcomes-annual cutting case

**Scope:** Corrected worksheet `flexible-goal-outcomes-annual.md` (revision 2026-09-22, same-day correction). Recomputed from **Inputs** and **Justification** only (Arithmetic not trusted). No engine bodies read; no commands run.

**Contract applied (correction):** A movable or skippable goal enters the schedule in its target year, or from its earliest year when goals may be pulled forward, and leaves it after `latestYear`; a goal not in the schedule has no outcome that year.

**Shared inputs**

Planning year 2030; cumulative inflation factor `1.10`. Visiting order: required fixed → target movable → ideal movable → excess movable (priority 1) → excess skippable (priority 2).

Nominal amounts (today × 1.10): $1,100; $1,100; $1,100; $550; $440.

### Case A — non-cutting pull-forward year, remaining upside budget $1,700

| Step | Goal | In schedule? | Budget constrains? | Outcome | Budget before | Paid | Budget after |
|---:|---|---|---|---|---:|---:|---:|
| 1 | Required fixed | Yes (target 2030) | No (fixed in target year; does not draw flexible budget) | Funded | $1,700 | $1,100 | $1,700 |
| 2 | Target movable | Yes (earliest 2030; pull-forward allowed) | Yes (2030 < target 2031) | Fully funded | $1,700 | $1,100 | $600 |
| 3 | Ideal movable | Yes (earliest 2030; pull-forward allowed) | Yes (2030 < target 2031) | Partial: inflated minimum = $1,100 × 50% = $550; $600 ≥ $550 → pay min($1,100, $600) = $600; unfunded $500 | $600 | $600 | $0 |
| 4 | Excess movable | Yes (earliest 2030; pull-forward allowed) | Yes (2030 < target 2031) | Deferred (2030 < latest 2032; no partial rule; budget $0) | $0 | — | $0 |
| 5 | Excess skippable | Yes (target 2030) | No (in target year in a non-cutting year → funds in full regardless of exhausted budget) | Funded | $0 | $440 | $0 |

- Counts: funded = **3**, partiallyFunded = **1**, deferred = **1**, skipped = **0**
- fundedAmount = $1,100 + $1,100 + $600 + $440 = **$3,240**
- unfundedAmount = $1,100 − $600 = **$500**

**Match worksheet Expected:** yes.

### Case B — cutting year, flexible budget 0, no pull-forward

| Step | Goal | In schedule? | Budget constrains? | Outcome | Budget before | Paid | Budget after |
|---:|---|---|---|---|---:|---:|---:|
| 1 | Required fixed | Yes (target 2030) | No (fixed in target year) | Funded | $0 | $1,100 | $0 |
| 2 | Target movable | **No** (target 2031; pull-forward disallowed in cutting year) | — | **No outcome** (not deferred; not in schedule) | — | — | — |
| 3 | Ideal movable | **No** (target 2031; pull-forward disallowed) | — | **No outcome** | — | — | — |
| 4 | Excess movable | **No** (target 2031; pull-forward disallowed) | — | **No outcome** | — | — | — |
| 5 | Excess skippable | Yes (target and latest 2030) | Yes (cutting year; at `latestYear`) | Skipped; $440 unfunded (intended spending in excess layer) | $0 | — | $0 |

- Counts: funded = **1**, partiallyFunded = **0**, deferred = **0**, skipped = **1**
- fundedAmount = **$1,100**
- unfundedAmount = **$440**

**Match worksheet Expected:** yes.

**Guardrail-off case:** all six published fields = 0 (per Justification).

**Rule alignment (corrected contract):** Goals 2–4 in Case B are outside the 2030 schedule because their target year is 2031 and pull-forward is disallowed in a cutting year; they therefore publish no outcome and do not increment `deferred`. Only goal 5, which is in the schedule at its `latestYear` in a cutting year, skips. Case A is unchanged: pull-forward brings goals 2–4 into the schedule from earliest year 2030, and goal 5 funds in full in a non-cutting target year regardless of exhausted budget.

**Wrong readings (4/4 verified):**
1. Case A: fixed consumes flexible budget → remainder $600; goal 2 defers; goal 3 partial $600; goal 4 defers; goal 5 still funds $440 in full → counts **2/1/2/0**, fundedAmount **$2,140**, unfundedAmount **$500** ✓
2. Case A: goal 3 minimum tested on $1,000 today ($500) vs correct inflated $550 — qualitative threshold error; with $600 remainder both rules agree (coincidental match 3/1/1/0, $3,240 / $500); with $520 remainder wrong rule would partial where correct rule defers ✓
3. Case B: drop terminal skipped $440 → unfunded **$0** instead of **$440** ✓
4. Case B: treat goals 2–4 as deferred though not in schedule → **deferred = 3** instead of **deferred = 0** ✓

**Verdict:** approve.

Reviewed by: cursor (composer-2.5), 2026-09-22 (re-check), by independent recomputation without executing the engine.
