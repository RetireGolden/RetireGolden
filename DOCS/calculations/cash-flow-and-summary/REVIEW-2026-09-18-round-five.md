# Independent review, 2026-09-18 (derive round five, ten ledger identities)

Reviewer: cursor (composer-2.5), by independent recomputation without executing the engine, from the worksheets and the signatures-and-comments extract b1-p4-signatures-r5.md (the year-ledger types, the simulate.ts header notes, annualCashFlowCapture.ts and moneyTolerance.ts at 47ea1c24, bodies elided). Two member lists (the income total and the expense total) were inferred by the deriver because no comment enumerates them; the orchestrator confirmed both against the engine before this review (incomes.total in simulate.ts; expenses.total in annualExpenseSummary.ts) and the reviewer was told to take them as given. Scope in this directory: income-total-annual, cash-flow-reconciliation-totals, spending-ideal-requested-annual, spending-excess-requested-annual. The report covers all ten worksheets of the round across three directories; the verbatim output follows.

---

# Independent Worksheet Review Report

Branch: `codex/b1-p4-worksheets-r3`  
Authority: worksheet Inputs/Justification/Expected only; engine extract `b1-p4-signatures-r5.md` for types and comments (no `packages/engine/src`).

---

## 1. `accounts-investable-total-annual`

**Recomputation**

| Step | Amount |
|---|---:|
| Cash | 15,000 |
| Taxable | 120,000 |
| Traditional | 300,000 |
| Roth | 90,000 |
| HSA | 25,000 |
| Unassigned cash | 2,000 |
| **Sum** | **552,000** |

Excluded from sum: equity compensation (40,000), insurance cash value (12,000), ladder value (30,000) → $0 contribution each.

**Match:** yes — `investableTotal = $552,000`.

**Members vs extract:** yes. Extract comment: “Cash + taxable + traditional + roth + hsa (+ unassigned).” Equity compensation, property, insurance cash value, and ladder value are correctly excluded (ladder and insurance called out separately on `YearResult`).

**Tolerance:** justified — absolute $0.005 for summing unrounded binary-floating-point balances.

**Wrong readings (all recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Omit unassigned | 550,000 | 550,000 | yes |
| Include equity comp | 592,000 | 592,000 | yes |
| Include insurance + ladder | 594,000 | 594,000 | yes |

**Claim consistency:** identity, units (nominal dollars), sign conventions, and exclusions match `YearResult.investableTotal` comment.

**Family:** `outputs: accounts-investable-total-annual` is appropriate for a published year-row field. `feeds: accounts-net-worth-annual; projection-result-ending-investable` is structurally correct (`netWorth` composes `investableTotal`; `ProjectionResult.endingInvestable` is the horizon investable figure).

**Verdict:** approve

---

## 2. `accounts-net-worth-annual`

**Recomputation**

| Step | Amount |
|---|---:|
| `investableTotal` | 552,000 |
| Property (350,000 + 200,000) | 550,000 |
| `insuranceCashValue` | 12,000 |
| `ladderValue` | 30,000 |
| Ordinary debt | −80,000 |
| Capped HECM: min(420,000, 350,000) + min(50,000, 200,000) | −400,000 |
| **Net worth** | **664,000** |

**Match:** yes — `netWorth = $664,000`.

**Members vs extract:** yes. Matches `investableTotal + property + insuranceCashValue + ladderValue − debt − HECM loans (each capped at its home's value)`.

**Tolerance:** justified — $0.005 for composed float balances.

**Wrong readings (all recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Uncapped HECM (−470,000) | 594,000 | 594,000 | yes |
| Omit insurance + ladder | 622,000 | 622,000 | yes |
| Add debt instead of subtract (+80,000 vs −80,000) | 824,000 | 824,000 | yes |

**Claim consistency:** non-recourse cap logic, composition terms, and nominal-dollar units match the extract comment.

**Family:** `outputs` and `feeds: projection-result-ending-net-worth` are appropriate.

**Verdict:** approve

---

## 3. `income-total-annual`

**Recomputation**

```
48,000 + 18,000 +  9,000 +  3,000 +  2,000
+  4,000 +  6,000 +  3,000 +    500 = 93,500
```

Character fields (`taxableInterest` 700, `ordinaryDividends` 800, `qualifiedDividends` 1,500) → $0 beyond `taxableYield`.

**Match:** yes — `incomes.total = $93,500`.

**Members vs given list:** yes — wages + socialSecurity + pension + annuity + tipsLadder + recurring + oneTime + taxableYield + taxExemptInterest. Interest/dividend fields correctly excluded as character components of `taxableYield` (consistent with cash-flow source-kind comments mapping to `incomes.*`).

**Tolerance:** justified — $0.005 for float dollar sums.

**Wrong readings (all recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Exclude tax-exempt interest | 93,000 | 93,000 | yes |
| Exclude taxable yield | 90,500 | 90,500 | yes |
| Double-count character fields | 96,500 | 96,500 | yes |

**Claim consistency:** composition, no double-count rule, and nominal annual units are consistent with `YearIncomes` shape and cash-flow source vocabulary.

**Family:** `feeds: portfolio-need-annual` is correct (`netPortfolioNeed` subtracts `incomes.total`).

**Verdict:** approve

---

## 4. `cash-flow-reconciliation-totals`

**Recomputation**

**Cash identity**

| Component | Amount |
|---|---:|
| Spendable sources | 65,000.000 |
| Portfolio funding | 25,000.004 |
| Loan proceeds | 10,000.000 |
| **Source total** | **100,000.004** |
| Funded household uses | 70,000.000 |
| Settled tax | 12,000.000 |
| Penalties | 1,000.000 |
| Contributions | 7,000.000 |
| Surplus investment | 10,000.000 |
| **Destination total** | **100,000.000** |
| **Difference** | **0.004** |

**Use identity:** disposition = 90,000 + 3,000 = 93,000; difference = 0.

**Transfer identity:** 22,500 − 22,500 = 0.

**Match:** yes — all three totals and differences match Expected.

**Members vs extract:** yes.

- Cash: `sourceTotal = spendable + portfolioFunding + loanProceeds`; `destinationTotal = fundedHouseholdUses + settledTax + penalties + contributions + surplusInvestment`.
- Uses: `dispositionTotal = fundedUses + unfundedUses`.
- Transfers: debits vs credits paired.

**Tolerance:** justified.

- Cash: `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005`; |0.004| ≤ 0.005, and checker fails only when strictly greater than tolerance.
- Use/transfer: `CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS = 1e-6`; zero differences pass.

**Wrong readings:**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Apply 1e-6 to cash (reject 0.004) | would reject | stated | yes (conceptual) |
| Omit surplus investment | dest 90,000; diff 10,000.004 | 10,000.004 | yes |
| funded − unfunded disposition | 87,000; use diff 6,000 | 6,000 | yes |
| Add debits + credits | 45,000 (not an identity) | conceptual | N/A (4th item; no numeric claim to recompute) |

**Claim consistency:** three identities, difference definitions (left − right), and tolerance split (funding vs structural) match `YearCashFlow*IdentityTotals` comments and `annualCashFlowCapture.ts` constants.

**Family:** `feeds: none` is appropriate for internal reconciliation totals on an optional `YearResult.cashFlow` capture.

**Verdict:** approve

---

## 5. `spending-ideal-requested-annual`

**Recomputation**

```
idealSpending = intendedSpending − targetSpending − excessSpending
              = 85,000 − 70,000 − 5,000
              = 10,000
```

Layer check: target increment = 70,000 − 50,000 = 20,000 → 50,000 + 20,000 + 10,000 + 5,000 = 85,000 ✓

**Match:** yes — `idealSpending = $10,000`.

**Members vs extract:** yes. Comments define `idealSpending` as incremental above target; `intendedSpending` as full four-layer request; rearrangement is consistent.

**Tolerance:** justified — $0.005 for float field composition.

**Wrong readings (both recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Full amount through ideal layer (85,000 − 5,000) | 80,000 | 80,000 | yes |
| Subtract required instead of target | 30,000 | 30,000 | yes |

**Claim consistency:** incremental (not cumulative-through-ideal) interpretation matches `YearExpenses` comments.

**Family:** `feeds: none` — reasonable for a derived layer field with no downstream worksheet named here.

**Verdict:** approve

---

## 6. `spending-excess-requested-annual`

**Recomputation**

```
excessSpending = intendedSpending − targetSpending − idealSpending
               = 85,000 − 70,000 − 10,000
               = 5,000
```

Layer check: 50,000 + 20,000 + 10,000 + 5,000 = 85,000 ✓

**Match:** yes — `excessSpending = $5,000`.

**Members vs extract:** yes — symmetric to ideal worksheet; consistent with “incremental above ideal.”

**Tolerance:** justified — $0.005.

**Wrong readings (both recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Full amount above required | 35,000 | 35,000 | yes |
| Fail to remove ideal increment | 15,000 | 15,000 | yes |

**Claim consistency:** yes.

**Family:** `feeds: none` — appropriate.

**Verdict:** approve

---

## 7. `spending-total-annual`

**Recomputation**

```
54,000 +  6,000 + 12,000 +  5,000 +  9,000
+  2,000 + 20,000 − 14,000 = 94,000
```

`guardrailFactor` (0.90) and `intendedSpending` (100,000) not in composition.

**Match:** yes — `expenses.total = $94,000`.

**Members vs given list:** yes — baseSpending + oneTimeGoals + debtService + propertyCosts + healthcare + insurancePremiums + careCost − ltcBenefit. Layer summaries and guardrail factor correctly excluded; LTC benefit correctly subtracted per “reduces net spending” comment.

**Tolerance:** justified — $0.005.

**Wrong readings (all recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Add LTC benefit | 122,000 | 122,000 | yes |
| Omit careCost, still subtract benefit | 74,000 | 74,000 | yes |
| Multiply composed total by guardrailFactor | 84,600 | 84,600 | yes |
| Substitute intendedSpending | 100,000 | 100,000 | yes |

**Claim consistency:** gross care cost with benefit offset; `intendedSpending` ≠ actual `total` under guardrail — consistent with comments.

**Family:** `feeds: portfolio-need-annual` — correct (`netPortfolioNeed` uses `expenses.total`).

**Verdict:** approve

---

## 8. `withdrawals-total-annual`

**Recomputation**

```
4,000 + 11,000 + 18,000 + 7,000 + 2,000 = 42,000
```

**Match:** yes — `withdrawals.total = $42,000`.

**Members vs extract:** yes — five `YearWithdrawals` categories compose `total`; comment gives sequential order cash → taxable → traditional → roth → hsa.

**Tolerance:** justified — $0.005.

**Wrong readings (both recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Omit HSA | 40,000 | 40,000 | yes |
| Subtract Roth twice (tax-offset misread) | 28,000 | 28,000 | yes |

**Claim consistency:** yes.

**Family:** `feeds: none` — acceptable (category worksheet feeds the total worksheet separately).

**Verdict:** approve

---

## 9. `withdrawals-by-category-annual`

**Recomputation**

Published vector: {cash 4,000; taxable 11,000; traditional 18,000; roth 7,000; hsa 2,000}.

Subsets within categories (consistency check, not separate expected total):

- Traditional residual = 18,000 − 8,000 − 3,000 − 2,000 = **5,000**
- Roth residual = 7,000 − 1,000 = **6,000**

**Match:** yes — all five category values match Expected.

**Members vs extract:** yes. RMD and SEPP included in `traditional` per `YearResult` comments; forced inherited traditional ⊆ `traditional`; forced inherited Roth in `roth`, not `traditional`. Subsets are not additive on top of category totals.

**Tolerance:** justified — $0.005 per category.

**Wrong readings:**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Double-add RMD+SEPP+forced trad on top of traditional | 31,000 | 31,000 | yes |
| Force inherited Roth into traditional | trad 19,000; roth 6,000 | stated | yes |
| Omit HSA bucket | omits 2,000 from publication | conceptual | N/A (3rd item is structural, not a single wrong scalar) |

**Claim consistency:** partition semantics and inclusion rules match `YearWithdrawals` and related `YearResult` distribution comments.

**Family:** `feeds: withdrawals-total-annual` — correct (categories sum to total).

**Verdict:** approve

---

## 10. `portfolio-need-annual`

**Recomputation**

```
Unfloored = 94,000 + 12,000 + 1,000 − 90,000 = 17,000
Floored   = max(0, 17,000) = 17,000
```

Surplus case (wrong-reading #3): 94,000 + 12,000 + 1,000 − 120,000 = −13,000 → floor → **0**.

**Match:** yes — `netPortfolioNeed = $17,000`.

**Members vs extract:** yes — `max(0, expenses.total + tax + penalties − incomes.total)` verbatim in `YearResult.netPortfolioNeed` comment. Outflows: expenses, tax, penalties. Inflow offset: `incomes.total` only. Floor at zero; surplus routes to `surplusInvested`, not negative need.

**Tolerance:** justified — $0.005 aligns with `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` for composed nominal dollar fields.

**Wrong readings (all recomputed):**

| Reading | Recomputed | Stated | OK |
|---|---:|---:|:---:|
| Omit penalties | 16,000 | 16,000 | yes |
| Add income instead of subtract | 197,000 | 197,000 | yes |
| Omit floor with 120,000 income | −13,000 → must be 0 | 0 | yes |

**Claim consistency:** need (not funded amount), nominal dollars, floor, and sign conventions match extract.

**Family:** `feeds: spending-shortfall-annual` — plausible related family (shortfall vs need); cannot fully enumerate the family registry without leaving the allowed read set, but no structural inconsistency observed.

**Verdict:** approve

---

## Summary Table

| id | match | verdict |
|---|---|---|
| accounts-investable-total-annual | yes | approve |
| accounts-net-worth-annual | yes | approve |
| income-total-annual | yes | approve |
| cash-flow-reconciliation-totals | yes | approve |
| spending-ideal-requested-annual | yes | approve |
| spending-excess-requested-annual | yes | approve |
| spending-total-annual | yes | approve |
| withdrawals-total-annual | yes | approve |
| withdrawals-by-category-annual | yes | approve |
| portfolio-need-annual | yes | approve |

---

Reviewed by: cursor (composer), 2026-09-18, by independent recomputation without executing the engine.
