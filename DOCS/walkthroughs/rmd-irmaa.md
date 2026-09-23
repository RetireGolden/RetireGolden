# Walkthrough reference: "High balances: RMDs & IRMAA", year 2026 by hand

Independent hand derivation of the first projection year of the curated example `rmd-irmaa`
(`packages/planner-ui/src/planner/examples/buildRmdIrmaa.ts`), for the public walkthrough page and the test
that will hold the engine to it.

**Provenance.** Derived 2026-09-22 by Claude (Opus 5.5 subagent) against the repository checkout at
4fc7d7c7 (two commits past `main` 119d3351 that change one catalog record string, one helper doc comment and two
coverage JSON files; nothing a single filer's year computes differs). I did not run the engine, run any test, or execute any TypeScript or JavaScript. I did the arithmetic by
hand and checked it with exact rational arithmetic (Python `fractions`), not with engine code. The rules come from
the calculation worksheets (`DOCS/calculations/**`), the engine's doc comments, the parameter data files, and
`DOCS/domain/domain-rules-reference/*`. Where a rule appears only in a code comment inside a function body, the
source column says so. Disclosure: to confirm how examples are projected (start year and tax calculator), I read the
harness lines of `examples.golden.test.ts`. That file holds only whole-run aggregates for this example (ending
investable, lifetime tax, lifetime Roth). No figure below comes from it.

**Rounding convention.** None of the contracts used here states a rounding step for the RMD, taxable Social
Security, the senior deduction, tax, the withdrawals or the growth. The ledger carries unrounded binary-floating-point
dollars. Of the 37 worksheets cited here, 21 set an absolute $0.005 fixture tolerance (every dollar composition, for
example `portfolio-need-annual`, `tax-total-annual` and `accounts-investable-total-annual`), which is
`ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` (`projection/moneyTolerance.ts`); 14 state exact equality because their
chosen inputs are whole dollars, whole years or enumerations; 2, the COLA-factor and delayed-credit-factor
worksheets, state 1e-12 for exact ratio arithmetic. This plan's figures are not whole dollars, so each figure below is given as its exact value (a fraction, or a
terminating decimal where one exists) and then rounded half-up to the cent for display. **A test should compare
against the exact value with tolerance 0.005, not against the cent-rounded display value summed downstream.** Real
IRS forms round to whole dollars; the engine does not, and neither does this document.

---

## 1. Inputs, as built

The plan comes from `createExamplePlan` (in `buildContext.ts`), which calls `createEmptyPlan` with a fixed clock
and deterministic ids, then replaces `assumptions` and `strategies` with the example baselines merged with this
builder's overrides. `buildRmdIrmaa` then replaces `household`, `accounts`, `incomes` and `expenses`, and
`parseExamplePlan` validates the result. It adds no `acaYears`, because `applyAcaCredit` is false.

### 1a. Projection call (how the year is run)

| Item | Value | Source |
|---|---|---|
| `SimulateOptions.startYear` | 2026 (`EXAMPLE_FIXED_YEAR`) | `buildContext.ts`; the example harness passes `{ startYear: EXAMPLE_FIXED_YEAR, taxCalculator }` |
| Tax calculator | `combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 0, localPct: 0 }))` | example harness; `tax/federalTax.ts#combineTaxCalculators` doc ("Sums every calculator's amount … Penalties are never a member of the sum") |
| Market series | none (deterministic: plan assumptions every year) | `SimulateOptions.market` doc |
| Fixed "now" | `2026-06-29T12:00:00.000Z`. It only stamps `createdAtIso`/`updatedAtIso`; `simulatePlan` takes no date, only `startYear` | `buildContext.ts#EXAMPLE_FIXED_NOW_ISO`; `model/plan.ts#createEmptyPlan`; `projection/simulate.ts#SimulateOptions` |
| End year | 2048 = max over people of (birth year + planning age) = 1953 + 95 | `simulate.ts` (`endYear = horizonEndYear ?? max(dobYear + lifeAge)`); `PersonYearState.alive` doc ("Alive while `ageAttained` ≤ … `longevity.planningAge`") |
| First-year RMD deferral elections | none; the default takes the first RMD in the attainment year | `SimulateOptions.rmdFirstYearDeferrals` doc |

### 1b. Plan facts

| Field | Value | Set by | Note |
|---|---|---|---|
| `name` | High balances: RMDs & IRMAA | builder | |
| plan `id` / person `id` | `rmd-irmaa--seq-1` / `rmd-irmaa--p1` | `exampleIdFactory` / builder | the default `seq-0` person is replaced |
| `origin` | `user` | `createEmptyPlan` | |
| `household.filingStatus` | `single` | builder | |
| `household.hasQualifyingDependent` | false | builder | |
| `household.state` / `stateMoves` | `FL` / [] | builder | |
| `household.capitalLossCarryforward` | 0 | builder | |
| Person | Dana, dob `1953-01-01`, sex `female`, retirementAge 65, longevity `{ planningAge: 95, source: 'manual' }` | builder | sex has no effect on a deterministic run; RMD Table II is not sex-specific |
| Cash `rmd-irmaa--cash` | balance 50,000; `annualReturnPct` 2; owner null; contribution 0 | builder | a cash account has no yield fields |
| Traditional `rmd-irmaa--ira` | kind `ira`; balance 1,850,000; `annualReturnPct` null (so 5); owner Dana; contribution 0; no nondeductible basis | builder | |
| Taxable `rmd-irmaa--brokerage` | balance 400,000; `costBasis` 280,000; `annualReturnPct` null (so 5); owner null; contribution 0; no `interestYieldPct`, `dividendYieldPct`, `qualifiedRatio`, `taxExemptInterestYieldPct` or `allocation`; `reinvestDividends` absent (true) | builder | basis ratio 0.70: 30% of each dollar sold is gain |
| Social Security `rmd-irmaa--ss` | person Dana; `piaMonthly` 3,200; `earnings` null; `claimAge` 70y0m; no disability; no former spouses | builder | |
| `expenses.baseAnnual` | 110,000 (today's dollars; excludes healthcare and debt) | builder | `expensePlanSchema.baseAnnual` doc |
| `expenses.requiredAnnual` / `idealAnnual` / `excessAnnual` | absent. Required therefore equals `baseAnnual`; ideal and excess are 0 | (absent) | `expensePlanSchema.requiredAnnual` doc ("Absent ⇒ equals baseAnnual") |
| `expenses.phases` / `oneTimeGoals` | [] / [] | builder | |
| `expenses.healthcare` | `pre65MonthlyPremiumPerPerson` 0; `applyAcaCredit` false; `medicareExtrasMonthlyPerPerson` 350; no `ssa44`; no `acaYears` | builder | with no `ssa44` the plain two-year lookback applies (`simulate.ts` SSA-44 comment: "Off/absent = the plain two-year lookback") |
| Spending policy | absent (fixed target; no guardrails) | (absent) | |
| `insurance`, `careEvents`, `scenarios`, `inheritedRothTaxCharacterPools`, `employerElectiveDeferralHistory` | [] | `createEmptyPlan` | |
| `annualFederalTaxFacts` | `{ foreignIncomeAdjustments: [] }` | `createEmptyPlan` | foreign addback 0 |
| `stateTaxFacts` | empty arrays | `createEmptyPlan` | |

### 1c. Assumptions (baseline `EXAMPLE_BASELINE_ASSUMPTIONS` merged with this builder's overrides)

| Assumption | Value | Origin |
|---|---|---|
| `inflationPct` | 2.5 | baseline |
| `healthcareExtraInflationPct` | **3** | override (baseline 2) |
| `defaultReturnPct` | **5** | override (baseline 6) |
| `ssCola` | `{ mode: 'matchInflation' }` | baseline |
| `ssHaircut` | null | baseline |
| `stateEffectiveTaxPct` | 0 | baseline |
| `localIncomeTaxPct` | 0 | baseline |
| `recentAnnualMagi` | 0 | baseline |
| `historicalAnnualMagiByYear` | absent | (neither sets it) |
| `heirTaxRatePct` | **28** | override (baseline 25); estate metric only, unused in any year row |
| `heirTaxByClass`, `assetClassParams` | absent | |
| `safeWithdrawalRatePct` | 4 | baseline; FI-number metric only, unused in any year row |

### 1d. Strategies (baseline `EXAMPLE_BASELINE_STRATEGIES` merged with this builder's overrides)

| Strategy | Value | Origin |
|---|---|---|
| `withdrawalOrder` | `{ mode: 'sequential' }`: cash, then taxable, then vested equity comp, then traditional, then Roth, then HSA | baseline; `withdrawalStrategySchema` doc; `annualWithdrawalPlanning.ts#SEQUENTIAL_ORDER` |
| `rothConversion` | `{ mode: 'none' }` | baseline |
| `qcdAnnual` | **15,000** (today's dollars, routed from RMDs when age-eligible) | override (baseline 0); `strategiesSchema.qcdAnnual` doc |
| `retirementActions` | [] | baseline |
| `itemizedDeductions`, `taxableSafetyNetFloor`, `survivorReserveTarget` | absent (no itemizing, no liquid-reserve floor) | |

---

## 2. Year 2026 by hand

Order of the year (`projection/simulate.ts` header): ages, then income, then expenses, then contributions, then the
fixed-point tax and withdrawal iteration, then applying flows, then property events, then growth, then the
snapshot. `DOCS/architecture.md` ("Simulation core") lists the steps in a different order (contributions and the
spending need swapped, RMDs as their own step); the two agree on the one point this walkthrough needs, that growth
follows the year's withdrawals. `DOCS/domain/domain-rules-reference/11` adds "RMDs always first".

Inflation factors for 2026: general `inflFactorFrom(2026, 2026) = 1`, health `= 1`, and the pack-year scale
`inflFactorFrom(2026, 2026) = 1`. 2026 has its own published pack (`params/data/year2026.ts`), so nothing is
indexed and there is no stand-in. The published `YearResult.inflationScale` is 1.

### 2a. Timeline and person

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 1 | Dana's `ageAttained` | **73** | 2026 − 1953 | `yearLedger.ts#PersonYearState.ageAttained` ("year − birth year") |
| 2 | `alive` / `lifeAge` | true / 95 | 73 ≤ 95 | `PersonYearState.alive`, `.lifeAge` docs |
| 3 | Full or partial year | **Full calendar year**: 12 months of spending, Social Security and Medicare | `SimulateOptions` carries only `startYear`, never a date. No year-row contract has a proration term for the start year: `YearExpenses.baseSpending` has none; payable months are 12 after the claim year; Medicare months are 12 at age ≥ 66. The 2026-06-29 "now" does not reach the ledger. | `simulate.ts#SimulateOptions`; `DOCS/architecture.md` ("annual ledger from the current year"); see section 3, item A1 |
| 4 | Filing status | `single` | household filing status, no death | `YearResult.filingStatus` doc |
| 5 | People counted 65+ (standard-deduction addition and senior deduction) | 1 | Dana alive, 73 ≥ 65 | worksheet `federal-standard-deduction-age-65` ("People aged 65+") |

### 2b. Social Security

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 6 | Effective birth year for FRA | 1952 | A January 1 date of birth uses the prior calendar year | `socialSecurity/nra.ts` header ("Jan 1 DOB uses prior calendar year"), `#effectiveBirthYear` |
| 7 | FRA | 66y0m (792 months) | Cohort 1943–1954 gives 66+0. Born-1953 is the same, so the Jan 1 rule changes nothing here. | `nra.ts#fraForBirthYear` body ("`if (y >= 1943 && y <= 1954) return { years: 66, extraMonths: 0 }`") and header ("Jan 1 DOB uses prior calendar year"). The `normal-retirement-age` worksheet derives only the 1960-and-later endpoint and does not support this cohort. |
| 8 | Months claimed after FRA / DRC cap | 48 / 48 | 70×12 − 66×12 = 48; cap = 70×12 − 792 = 48 | `socialSecurity/claimFactor.ts#claimFactor` doc; `benefitFactor.ts#delayedRetirementFactor` |
| 9 | Claim-age factor | **1.32** (33/25) | 1 + 48 × (2/3)/100 = 1 + 0.32 | worksheet `delayed-retirement-credit-factor`; `benefitFactor.ts` ("DRC: 2/3% of PIA per month after FRA, up to age 70") |
| 10 | Payable months in 2026 | **12** | The claim year is the year `ageAttained` = 70, i.e. 2023. 2026 is after it, so 12. | worksheet `social-security-payable-months`; `annualSocialSecurity.ts#annualSocialSecurityPayableMonths` |
| 11 | COLA factor in 2026 | **1** | Under `matchInflation` the factor is the general-inflation factor from the start year, which is 1 in the start year. The pack's `socialSecurity.colaPct` 2.8 is read by the projection in **no** mode: the `fixed` mode compounds the plan's own `ssCola.annualPct` from the start year (`simulate.ts`, `YearIncomes.socialSecurity` doc), and the worksheet only borrows the pack figure as its example rate. | `yearLedger.ts#YearIncomes.socialSecurity` ("COLA factor: the inflation factor from the start year under matchInflation"); worksheet `social-security-cola-factor` ("factor 1 in the first year"); `simulate.ts` header ("SS COLA compounds from the projection start") |
| 12 | Haircut factor | 1 | `ssHaircut` null | `YearIncomes.socialSecurity` doc |
| 13 | Monthly benefit in 2026 | 4,224.00 | 3,200 × 1.32 | same |
| 14 | **`incomes.socialSecurity`** (gross, year) | **50,688.00** | 3,200 × 1.32 × 12 × 1 × 1 | worksheet `social-security-benefit-annual`; `YearIncomes.socialSecurity` doc |
| 15 | `ssEarningsTestWithheld` / `ssdiPaid` | 0 / 0 | no wages; past FRA; no disability | `YearResult` docs |

**The Social Security rule, stated plainly.** Own benefit for a year = `piaMonthly` × claim-age factor (from the
effective birth year's FRA, monthly DRC capped at 70) × payable months (0 before the claim year, 12 − claim months
in it, 12 after) × COLA factor × haircut factor. The COLA factor compounds **from the projection start year**, and
is exactly 1 in 2026, whatever the claim year. So a claim made in 2023, before the projection, earns no COLA for
2024–2026. The entered PIA is effectively read as a 2026-dollar PIA, and the full 32% DRC is applied to it. See
section 3, item A2.

### 2c. RMD and QCD

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 16 | RMD applicable age / first RMD year | 73 / **2026** | birth year 1953 falls in 1951–1959, giving 73; 1953 + 73 = 2026. RBD 2027-04-01, not elected. | `params/index.ts#rmdStartAgeForBirthYear` ("`if (birthYear <= 1959) return 73`"), which the owner path calls through `requiredMinimumDistribution`; domain rules §6 ("Owner living RMD start age … 1951–1959 → 73"); `rmd/rmd.ts` header ("the RMD is taken in the age-attained year"). The `rmd-applicable-age-attain-year` worksheet derives the inherited-IRA function `rmd/applicableAge.ts#applicableAgeAttainYears`, which gives 73 for 1953 as well but is not the owner path's contract. |
| 17 | Table | Uniform Lifetime Table (no spouse, so no Joint Life Table II) | single, no beneficiary spouse | `rmd/rmd.ts#requiredMinimumDistribution` |
| 18 | Divisor | **26.5** | `year2026.rmd.uniformLifetimeTable[73]` | `params/data/year2026.ts` line 103; worksheet `rmd-uniform-lifetime-divisor` |
| 19 | Balance used, and as of when | **1,850,000**. The plan's entered IRA balance serves as the **prior December 31 (2025-12-31) balance**, captured before any 2026 flow | first year: the opening balance *is* the prior year-end | `rmd.ts` ("`priorYearEndBalance` is the Dec 31 balance of the previous year"); `annualOwnerRmdPlan.ts#AnnualOwnerRmdPlanInput.startOfYearBalance` ("Aggregate prior-Dec-31 balance"); `simulate.ts` in-body comment "Prior Dec 31 balances (RMD base) — captured before this year's flows". See section 3, item A1. |
| 20 | **`rmd`** (gross, forced) | **69,811.32** (exact 3,700,000/53 = 69,811.320754716981…) | 1,850,000 ÷ 26.5 | worksheet `rmd-uniform-lifetime-divisor`; `YearResult.rmd` doc |
| 21 | QCD age gate | eligible | ageAttained 73 ≥ 71 | worksheet `qcd-limit-and-age-proxy`; `YearResult.qcd` doc |
| 22 | QCD requested / per-donor cap | 15,000 / 111,000 | 15,000 × inflFactor 1 (today's dollars); cap `year2026.rmd.qcdAnnualLimit` × limit growth 1 | `strategiesSchema.qcdAnnual` doc; `params/data/year2026.ts` line 137 |
| 23 | QCD taken from the RMD (`qcdFromRmd`) / beyond the RMD | 15,000 / 0 | min(15,000, 69,811.32) = 15,000, so no extra IRA debit | `YearResult.qcd` doc ("the from-RMD portion"); `strategiesSchema.qcdAnnual` ("routed from RMDs") |
| 24 | **`qcd`** (gross gift) | **15,000.00** | | `YearResult.qcd` doc; worksheet `qcd-income-offset-qualified-slice` |
| 25 | QCD income offset (`qcdIncomeOffset` channel) | **15,000.00** | qualified = min(15,000, aggregate includible IRA amount 1,850,000, since there is no basis) = 15,000; non-qualified remainder 0, so qualifiedFromRmd = 15,000 − min(15,000, 0) = 15,000; §408(d)(8)(A) second-sentence offset 0 (no post-70½ deductible contributions); offset = min(15,000, 15,000 − 0) = 15,000 | worksheet `qcd-income-offset-qualified-slice`; `YearResult.qcd` doc |
| 26 | `rmd` stays gross | 69,811.32 | The gift does **not** shrink `rmd`. Only the year's cash inflow is reduced by it. | `YearResult.qcd` doc ("`rmd` stays gross; only the year's cash inflow is reduced by the from-RMD gift") |
| 27 | Traditional distribution total, `withdrawals.traditional` | **69,811.32** | need-based traditional 0 + RMD 69,811.32 (gross, QCD included) | `yearLedger.ts#YearWithdrawals.total` ("traditional adds RMDs"); `YearResult.rmd` ("included in withdrawals.traditional"); worksheet `withdrawals-by-category-annual` |
| 28 | Cash reaching Dana from the RMD | **54,811.32** (exact 2,905,000/53 = 54,811.320754716981…) | 69,811.32 − 15,000 | `YearResult.qcd` doc (cash inflow reduced by the from-RMD gift) |
| 29 | **Taxable part** of the traditional distribution (ordinary income) | **54,811.32** | 69,811.32 − 15,000 offset; no IRA basis, so the rest is fully ordinary | worksheet `qcd-income-offset-qualified-slice` (ordinary inclusion = RMD − offset) |
| 30 | `penalties` (incl. `rmdShortfallExciseTax`) | 0 | RMD fully distributed; Dana is past 59½ | worksheet `tax-penalties-annual`; `YearResult.penalties` doc |

### 2d. Income, AGI, deductions, federal tax

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 31 | `taxableYield` (and interest, ordinary and qualified dividends) | 0 | The brokerage has no yield fields and no allocation, and "absent both, the rate is 0". A cash account produces no yield row, since yield rows are taxable-account only. | worksheets `income-taxable-yield-annual`, `income-taxable-interest-annual`; `distributedTaxableYieldRows.ts` header ("Annual taxable-account distributed-yield calculation"); see section 3, item A4 |
| 32 | `taxExemptInterest` | 0 | no `taxExemptInterestYieldPct` | `YearResult.taxExemptInterest` doc |
| 33 | **`incomes.total`** | **50,688.00** | wages 0 + SS 50,688 + pension 0 + annuity 0 + tipsLadder 0 + recurring 0 + oneTime 0 + taxableYield 0 + taxExemptInterest 0 | worksheet `income-total-annual`; `YearIncomes.total` doc |
| 34 | `realizedGains` | 0 | no taxable-account sale (cash covers the need, row 80), no rebalancing, no actions | worksheet `tax-realized-gains-annual`; `YearResult.realizedGains` doc |
| 35 | AGI excluding Social Security | 54,811.32 | ordinary 54,811.32 + gains 0 + qualified dividends 0 | `tax/federalTax.ts` header, step 2 |
| 36 | Provisional income | **80,155.32** (80,155.320754716981…) | 54,811.32 + tax-exempt 0 + foreign addback 0 + ½ × 50,688 (= 25,344) | `federalTax.ts#taxableSocialSecurity` doc; worksheet `federal-taxable-social-security-tiers`; domain rules §3 |
| 37 | Taxable SS, lower-tier base | 4,500 | min(½ × 50,688 = 25,344, ½ × (34,000 − 25,000)) | same; thresholds `year2026.ssBenefitTaxation.tier50Start.single` 25,000 and `.tier85Start.single` 34,000 (lines 76–77), unindexed |
| 38 | Taxable SS, 85% formula before the cap | 43,732.02 (43,732.022641509…) | 0.85 × (80,155.32 − 34,000) + 4,500 | same |
| 39 | **Taxable Social Security** | **43,084.80** | min(0.85 × 50,688 = 43,084.80, 43,732.02). **The 85% cap binds.** It binds once AGI excluding SS exceeds 54,049.88; Dana is 761.44 past that point. | same |
| 40 | **Ordinary income** (tax input) | **54,811.32** | IRA distribution net of the QCD offset; nothing else ordinary | rows 29, 31 |
| 41 | **AGI** | **97,896.12** (97,896.120754716981…) | 54,811.32 + 43,084.80 | `federalTax.ts` header, step 2 |
| 42 | **`magi`** (published) | **97,896.12** | max(0, ordinary 54,811.32 + gains 0 + qualified dividends 0 + taxable SS 43,084.80 + tax-exempt interest 0) | worksheet `medicare-magi-composition`; `YearResult.magi` doc |
| 43 | Standard deduction (single, one person 65+) | **18,150** | 16,100 + 1 × 2,050 | worksheet `federal-standard-deduction-age-65`; `year2026.federalTax.standardDeduction.single` (line 40), `.age65Addition.single` (line 41) |
| 44 | Senior-deduction MAGI | 97,896.12 | AGI + broad foreign addback 0 | `federalTax.ts` header, step 2; domain rules §1 ("MAGI here is AGI plus amounts excluded under §§911/931/933") |
| 45 | Senior-deduction phase-out | 1,373.77 (1,373.767245283…) | 6% × (97,896.12 − 75,000) = 0.06 × 22,896.12 | `federalTax.ts#seniorDeductionAmount` doc; `year2026.federalTax.seniorDeduction` (lines 49–54: 6,000 per person, phase-out start 75,000 single, 6%, last year 2028); domain rules §1 |
| 46 | **Senior deduction** (OBBBA, 2026 applies) | **4,626.23** (4,626.232754716981…) | max(0, 6,000 − 1,373.77) × 1 person | same |
| 47 | Total deduction | **22,776.23** (22,776.232754716981…) | max(standard 18,150, itemized 0) + senior 4,626.23 | `federalTax.ts` header, step 3 ("rides on top of whichever base wins") |
| 48 | **Taxable income** | **75,119.89** (exactly 75,119.888) | 97,896.12 − 22,776.23. It terminates exactly because 1.06 × the RMD = 74,000 exactly: TI = 1.06 × AGI − 28,650. | `federalTax.ts` header |
| 49 | Preferential income / ordinary taxable | 0 / 75,119.888 | no gains or qualified dividends | `FederalTaxDetail.preferentialIncome` doc |
| 50 | Ordinary tax, 10% band | 1,240.00 | 12,400 × 10% | worksheet `federal-ordinary-bracket-tax`; `year2026.federalTax.brackets.single` (lines 21–29) |
| 51 | Ordinary tax, 12% band | 4,560.00 | (50,400 − 12,400) × 12% | same |
| 52 | Ordinary tax, 22% band | 5,438.38 (exactly 5,438.37536) | (75,119.888 − 50,400) × 22% = 24,719.888 × 0.22 | same |
| 53 | **Federal regular income tax** | **11,238.38** (exactly 11,238.37536) | 1,240 + 4,560 + 5,438.37536. Marginal bracket 22%, and each extra IRA dollar costs 22% × 1.06 = **23.32%** because of the senior phase-out (taxable SS is already capped). | same |
| 54 | LTCG tax / NIIT | 0 / 0 | no preferential income; MAGI 97,896 is under the NIIT threshold of 200,000 and there is no investment income | worksheet `federal-ltcg-stacking`; `year2026.niit` (lines 70–73) |
| 55 | AMT screen, **`amt`** | **0** | AMTI = TI 75,119.888 + standard 18,150 + senior 4,626.23 = 97,896.12; exemption 90,100 (the 500,000 phase-out start is not reached); TMT = 26% × 7,796.12 = 2,026.99; AMT = max(0, 2,026.99 − 11,238.38) = 0 | worksheet `federal-amt-screen`; `federalTax.ts` header, step 7; `year2026.federalTax.amt` (lines 55–62) |
| 56 | Florida state tax (and local) | **0** | FL `hasIncomeTax: false`, so state taxable income is 0. The override `stateEffectiveTaxPct` 0 does not apply ("takes precedence when set above zero"). Local tax is gated on `hasIncomeTax`, and is 0% anyway. | `params/state/data/year2026.ts` FL entry (lines 337–343); `tax/stateTax.ts` header |
| 57 | **`tax`** (composed; how Florida is recorded) | **11,238.38** (exactly 11,238.37536) | federal 11,238.37536 + state 0 + local 0. **There is no separate state field on `YearResult`**: the state amount exists only inside the composed `tax` (and `taxComputation.amount`, equal to it). | worksheet `tax-total-annual`; `YearResult.tax`, `.taxComputation` docs; see section 3, item A6 |
| 58 | `ltcgZeroHeadroom` | 0 | TI with no extra gains (75,119.89) already exceeds `year2026.capitalGains.rate15StartsAbove.single` 49,450 | worksheet `year-result-ltcg-zero-headroom`; `YearResult.ltcgZeroHeadroom` doc |
| 59 | `rothConversion` | 0 | mode `none` | `YearResult.rothConversion` doc |

### 2e. IRMAA and healthcare

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 60 | IRMAA lookback year | **2024** | premium year 2026 − 2; no SSA-44 (`healthcare.ssa44` absent) | worksheets `medicare-irmaa-two-year-lookback`, `irmaa-lookback-selection`; `tax/medicare.ts` header |
| 61 | **`irmaaLookbackMagi`** / **`irmaaLookbackMagiSource`** / **`irmaaLookbackMagiYear`** | **0 / `planFallback` / 2024** | 2024 is before the ledger, and `historicalAnnualMagiByYear` is absent, so the plan's `recentAnnualMagi` = 0 is used (the baseline seed from `EXAMPLE_BASELINE_ASSUMPTIONS`) | `YearResult.magi` doc ("the first two projection years fall back to … `historicalAnnualMagiByYear[year]` or its `recentAnnualMagi`"); `YearResult.irmaaLookbackMagiSource` doc; worksheet `irmaa-lookback-selection`; `assumptionsSchema.recentAnnualMagi` doc |
| 62 | Tier-1 floor (single, 2026) | 109,000 | `year2026.medicare.irmaaTiers[0].magiOver.single` × inflation 1 | `params/data/year2026.ts` line 193; `params/index.ts#irmaaTierThreshold` |
| 63 | **`irmaaTier`** | **0** | 0 is not > 109,000 (strict "greater than" for the lower tiers) | worksheet `medicare-irmaa-first-tier-boundary`; `params/index.ts#irmaaTierForMagi` |
| 64 | Medicare months / marketplace months | 12 / 0 | age 73 (Medicare from the birth month of the 65 year; at 66 or older, all 12) | `YearExpenses.healthcare` doc |
| 65 | **Part B** (annual, per person) | **2,434.80** | 202.90 × (25/25) × 12 × premium scale 1 | worksheet `medicare-base-part-b-premium`; `tax/medicare.ts#medicareAnnualPremiumPerPerson`; `year2026.medicare.partBStandardMonthly` 202.9 (line 187) |
| 66 | **Part D surcharge** | **0** | tier 0 | same |
| 67 | **`medicarePremiums`** | **2,434.80** | (2,434.80 + 0) × 12/12 | `YearResult.medicarePremiums` doc |
| 68 | **`irmaaSurcharge`** | **0** | tier 0 | `YearResult.irmaaSurcharge` doc |
| 69 | `irmaaNextTierThreshold` | 109,000 | Medicare active; tier 0, so the next is tier 1 at 109,000 × 1 | `YearResult.irmaaNextTierThreshold` doc |
| 70 | Current-year MAGI vs. the floor (context only) | 97,896.12 vs. 109,000 | Not what 2026 reads. It is the figure the **2028** premium will read (source `projected`). | `YearResult.magi` doc ("the IRMAA base two years later") |
| 71 | Medicare extras | **4,200.00** | 350 × 12 Medicare months × health inflation factor 1 | worksheet `spending-healthcare-annual`; `YearExpenses.healthcare` doc |
| 72 | **`expenses.healthcare`** (total healthcare) | **6,634.80** | 2,434.80 + 0 + 4,200.00 (no marketplace months) | same |

### 2f. Spending and cash flow

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 73 | **`expenses.baseSpending`** | **110,000.00** | `baseAnnual` 110,000 × inflation factor 1. Required lifestyle 110,000 + target layer 0 × min(1, 1) + ideal 0 + excess 0 | worksheet `spending-base-annual`; `YearExpenses.baseSpending` doc; `simulate.ts` header (base spending inflates at the general rate) |
| 74 | `oneTimeGoals`, `debtService`, `propertyCosts`, `insurancePremiums`, `careCost`, `ltcBenefit` | 0 each | none in the plan | `YearExpenses` docs |
| 75 | **`expenses.total`** (total spending) | **116,634.80** | 110,000 + 0 + 0 + 0 + 6,634.80 + 0 + 0 − 0 | worksheet `spending-total-annual`; `YearExpenses.total` doc |
| 76 | `requiredSpending` / `targetSpending` / `intendedSpending` / `idealSpending` / `excessSpending` / `guardrailFactor` | 116,634.80 / 116,634.80 / 116,634.80 / 0 / 0 / 1 | The system-computed costs (healthcare) count as required. `requiredAnnual` absent gives required lifestyle 110,000. No policy is active. | `YearExpenses` layer docs; `expensePlanSchema.requiredAnnual` doc |
| 77 | **`netPortfolioNeed`** (gap after Social Security) | **77,185.18** (exactly 77,185.17536) | max(0, 116,634.80 + tax 11,238.37536 + penalties 0 − incomes 50,688) | worksheet `portfolio-need-annual`; `YearResult.netPortfolioNeed` doc |
| 78 | Net RMD cash applied first | 54,811.32 | row 28 (RMDs first; the cash inflow is reduced by the from-RMD QCD) | domain rules §11 ("RMDs always first"); `YearResult.qcd` doc |
| 79 | **Gap after SS and the net distribution** (need-based withdrawal) | **22,373.85** (22,373.854605283019…) | 77,185.17536 − 54,811.320754717. Equivalently: pre-tax gap 116,634.80 − 50,688 − 54,811.32 = 11,135.48, plus tax 11,238.38. | same; `YearWithdrawals` doc |
| 80 | Which account funds it | **Cash**: 22,373.85 of its 50,000 | sequential order: cash first. Cash covers the need entirely, so the taxable brokerage and the traditional IRA (beyond its RMD) are not touched. No safety-net floor is set. | `withdrawalStrategySchema` sequential doc; `annualWithdrawalPlanning.ts#SEQUENTIAL_ORDER`; domain rules §11 |
| 81 | Taxable-account gain rule (stated; not exercised in 2026) | a sale of P realizes P × (1 − basis/FMV); recovered basis = basis × P/FMV. For this account 30% of proceeds (1 − 280/400) would be long-term gain, stacked at 0/15/20%. | aggregate basis-ratio model, no lots | `taxableAccountSchema.costBasis` doc ("single basis-ratio model in v1; no lots"); `tax/aggregateBasisSale.ts` body (`soldFraction = saleProceeds / openingFairMarketValue; recoveredCostBasis = openingCostBasis × soldFraction`; its doc comment says only that it does not round to cents); domain rules §11 ("taxable (basis-ratio gains)"); worksheet `federal-ltcg-stacking` |
| 82 | Fixed point | converges on the **second** evaluation | The root is seeded with the pre-tax need, 116,634.80 − 105,499.32 = 11,135.48 (`spendingUsesBeforeTax` − `baseCashInflows`); the first evaluation returns the post-tax need 22,373.85, which the second reproduces, because a cash draw adds no income and the tax does not depend on the draw size. The evaluation count is published only in ACA-active years, so a test must not assert it. | `annualFundingFixedPoint.ts` header ("WHAT IT TAKES: the pre-tax cash need …") and the `spendingUsesBeforeTax` doc ("Expenses plus contributions, before tax and penalties"); convergence at `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` |
| 83 | Cash inflows vs. outflows | 127,873.18 = 127,873.18 | inflows: SS 50,688 + RMD cash 54,811.32 + cash draw 22,373.85 = 127,873.17536; outflows: expenses 116,634.80 + tax 11,238.37536 = 127,873.17536 | identity |
| 84 | `surplusInvested` | **0** | max(0, 105,499.320754716981 − 116,634.80 − 0 − 11,238.37536 − 0) = max(0, −22,373.854605283019) = 0. The cash inflows here are the accepted inflows of the fixed point, incomes plus the net RMD cash; the need-based draw is not an inflow, so the surplus is 0 by a 22,373.85 margin, not by cancellation (see section 3, item B2). | worksheet `surplus-invested-annual`; `YearResult.surplusInvested` doc; `annualFundingApplicationAndClosePhase.ts` (`cashInflows = fundingFixedPoint.acceptedCashInflows`) |
| 85 | `shortfall` / `requiredShortfall` / `targetShortfall` | 0 / 0 / 0 | fully funded | worksheet `spending-shortfall-annual` |

### 2g. Withdrawals (published)

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 86 | `withdrawals.cash` | **22,373.85** (22,373.854605283019…) | row 79 | worksheet `withdrawals-by-category-annual` |
| 87 | `withdrawals.taxable` / `.roth` / `.hsa` | 0 / 0 / 0 | | same |
| 88 | `withdrawals.traditional` | **69,811.32** | the gross RMD, **including** the 15,000 QCD | same; `YearWithdrawals.total` doc |
| 89 | **`withdrawals.total`** | **92,185.18** (exactly 92,185.17536) | 22,373.854605 + 69,811.320755. Check: equals need 77,185.17536 + QCD 15,000. | worksheet `withdrawals-total-annual` |

### 2h. Year-end balances

**Growth timing.** End-of-year growth on the **post-flow** balance: all of the year's withdrawals (RMD, QCD, need
draws) come out first, then each account grows by its full annual rate. It is neither mid-year nor beginning-of-year
growth. Sources: `simulate.ts` header ("apply flows → property events → growth → snapshot"); `DOCS/architecture.md`
("→ growth → end-of-year balances"); `annualPostSolveAccountGrowth.ts` header ("the closing pre-growth balance
states" … "the price-growth closing balance"); `YearResult.balances` doc ("End-of-year balance per id (after flows and
growth)"). Rates: cash 2% (its own `annualReturnPct`); IRA and brokerage 5% (`annualReturnPct` null, so
`defaultReturnPct` 5 per the `accountBase.annualReturnPct` doc). Cash ignores the market shock, and there is none on
a deterministic run anyway. Distributed yield is 0, so the price return equals the total return.

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 90 | Cash, pre-growth | 27,626.15 (27,626.145394716981…) | 50,000 − 22,373.854605 | worksheet `accounts-balance-per-account-annual` |
| 91 | Cash growth | 552.52 (552.522907894340…) | 27,626.145395 × 2% | `annualPostSolveAccountGrowth.ts` header |
| 92 | **`balances['rmd-irmaa--cash']`** | **28,178.67** (28,178.668302611321…) | 27,626.145395 × 1.02 | `YearResult.balances` doc |
| 93 | IRA, pre-growth | 1,780,188.68 (exact 94,350,000/53 = 1,780,188.679245283…) | 1,850,000 − 69,811.320755 (the RMD, QCD included; no other IRA debit) | same |
| 94 | IRA growth | 89,009.43 (89,009.433962264151…) | × 5% | same |
| 95 | **`balances['rmd-irmaa--ira']`** | **1,869,198.11** (exact 99,067,500/53 = 1,869,198.113207547…) | 1,780,188.679245 × 1.05. This is also the prior-Dec-31 base for 2027's RMD. | same |
| 96 | Brokerage, pre-growth / growth | 400,000 / 20,000 | no sale, no yield, no surplus deposit | same |
| 97 | **`balances['rmd-irmaa--brokerage']`** | **420,000.00** (basis stays 280,000) | 400,000 × 1.05 | same |
| 98 | Unassigned cash | 0 | a cash account exists | `YearResult.investableTotal` doc |
| 99 | **`investableTotal`** | **2,317,376.78** (2,317,376.781510158491…) | 28,178.668303 + 1,869,198.113208 + 420,000 | worksheet `accounts-investable-total-annual` |
| 100 | `netWorth` | 2,317,376.78 | investable; no property, debt, insurance, ladder or HECM | worksheet `accounts-net-worth-annual`; `YearResult.netWorth` doc |
| 101 | Other published zeros | `contributions` 0, `employerMatch` 0, `sepp` 0, `inheritedDistribution` 0, `hecmDraw` 0, `ladderValue` 0, `insuranceCashValue` 0, `deathBenefit` 0, `capitalLoss*` 0, `guardrailAction` `hold` | none in the plan | `YearResult` docs |

### 2i. Wrong readings a test should reject (all exact, computed from the same inputs)

| Wrong reading | What it produces | Correct |
|---|---|---|
| Apply the pack's 2.8% COLA in the start year | SS 52,107.264; taxable SS 44,291.1744; tax 11,519.70187 | SS 50,688; tax 11,238.37536 |
| Use FRA 67 (ignore the 1943–1954 cohort) | factor 1.24; SS 47,616; tax 10,629.44352 | factor 1.32; SS 50,688 |
| Divide by the age-74 divisor 25.5 (or 27.4 for age 72) | RMD 72,549.019608 (or 67,518.248175) | 69,811.320755 |
| Do not exclude the QCD from income | ordinary 69,811.32; AGI 112,896.12; senior 3,726.23; TI 91,019.888; tax **14,736.37536**. The QCD saves exactly 3,498.00 = 15,000 × 23.32%. | ordinary 54,811.32; tax 11,238.37536 |
| Reduce `rmd` or `withdrawals.traditional` by the QCD | `rmd` 54,811.32 | both 69,811.32 (gross) |
| Omit the senior deduction | TI 79,746.12; tax 12,256.146566 | TI 75,119.888 |
| Take the senior deduction unreduced (no MAGI phase-out) | TI 73,746.12; tax 10,936.146566 | senior 4,626.232755 |
| Price 2026 IRMAA on 2026's own MAGI | tier still 0 (97,896.12 ≤ 109,000). **Premiums cannot tell these readings apart**; only `irmaaLookbackMagi` = 0, `…Source` = `planFallback`, `…Year` = 2024 can. | lookback 2024 |
| Grow before withdrawing (beginning-of-year growth) | IRA year-end 1,872,688.679245; cash 28,626.145395 | 1,869,198.113208; 28,178.668303 |
| Treat the entered balance as mid-2026 and grow or discount it to Dec 31, 2025 | any RMD other than 69,811.32 | entered balance = prior Dec 31 |
| Pro-rate 2026 to the half-year left after the fixed "now" | roughly half the spending, SS and Medicare | full year |

---

## 3. Contracts I could not find or found ambiguous

Each item says what the engine's contracts support, what the alternatives are, and which reading this document uses.
None of them changes a 2026 figure *under the engine's own contracts*. They matter because a reader, or a future
contract change, could reasonably expect otherwise.

**A1. The start year is a full year, and the entered balances are the prior Dec 31 balances.** No catalog worksheet
or type comment says in words "the first projection year is a full calendar year, and the plan's entered balances
are its January 1 opening and prior-December-31 RMD base." The reading rests on four things. First,
`SimulateOptions` takes only `startYear`, never a date. Second, no year-row contract carries a proration term. Third,
the in-function comment in `simulate.ts` says "Prior Dec 31 balances (RMD base) — captured before this year's flows"
over the plan's opening balances. Fourth, `DOCS/architecture.md` says "from the current year to end of plan". The
example's "now" is 2026-06-29, so candidate readings are:
(a) full-year 2026 with the entered balance as the 2025-12-31 value (**used here**; the engine's documented
mechanics support nothing else);
(b) half a year of spending, income and growth remaining, with the June balance rolled to year-end.
The walkthrough page should say (a) out loud.

**A2. What dollars `piaMonthly` is in, for a benefit already being paid.** For the own-benefit stream, the
`socialSecurityIncomeSchema.piaMonthly` comment says only "Quick mode: PIA entered directly". It does **not** say
"today's dollars", although the former-spouse PIA comment does. The annual formula (the `YearIncomes.socialSecurity`
comment and the `social-security-cola-factor` worksheet) makes the COLA factor 1 in the start year and applies the
full claim-age factor to the entered PIA. So the engine treats 3,200 as a 2026-dollar PIA, even though Dana claimed
in 2023. Candidate readings:
(a) 3,200 is her 2026 PIA, so 4,224.00 a month and 50,688 a year (**the engine's rule, used here**);
(b) 3,200 is the PIA as of her 2023 claim, so the actual COLAs for 2024, 2025 and 2026 should compound onto 4,224.
The engine has no path for (b). The page should tell users to enter the PIA restated in current dollars (or the
current payment ÷ 1.32).

**A3. The senior deduction and the first-RMD-year choice have no worksheet.** The senior deduction's formula is
documented: the `federalTax.ts` header, the `seniorDeductionAmount` doc comment, the pack's `seniorDeduction` block
and domain rules §1. But no `DOCS/calculations` worksheet derives it; `federal-standard-deduction-age-65` only warns
not to confuse it with the age-65 addition. The rule is unambiguous (per person, 6% of AGI-plus-foreign-addback over
75,000, through 2028), so rows 44–46 rest on doc comments, not on a reviewed worksheet. Likewise, "the first RMD is
taken in the attainment year unless a deferral election is passed" is documented on
`SimulateOptions.rmdFirstYearDeferrals`, in the `rmd.ts` header and in domain rules §6 ("First-year April 1 split"),
with no worksheet. Neither is ambiguous; both lack catalog coverage.

**A4. Cash-account growth is untaxed.** The yield worksheets (`income-taxable-yield-annual`,
`income-taxable-interest-annual`) and the `distributedTaxableYieldRows.ts` header speak only of *taxable* accounts.
Nothing states in words that a `cash` account's `annualReturnPct` growth is never taxable interest; it is inferred
from the yield rows being taxable-account only and from the cash schema having no yield fields. Candidate readings:
(a) the 552.52 of cash growth is untaxed and never enters income (**used here**; consistent with every contract
found);
(b) cash growth is 1099-INT interest. Under (b), ordinary income would rise by the interest. That is circular with
the cash draw, and would lift tax by about 23.32% of the interest.
The same point applies to the brokerage: it earns 5% as pure price growth with **no** dividends, because no yield
fields are set and "absent both, the rate is 0".

**A5. Is the growth rate the whole-year rate on the post-flow balance?** It is well documented (section 2h), but
the timing is stated in phase headers and `YearResult.balances`, not in a worksheet that exercises a non-zero
return with a withdrawal. The `accounts-balance-per-account-annual` worksheet uses a 0% return, so it cannot tell
the timings apart. A worksheet or fixture with a non-zero return and a withdrawal would pin rows 92 and 95. Until
then they rest on the phase comments.

**A6. How Florida's zero is recorded.** `YearResult` has no state-tax field. The state amount is folded into `tax`,
and `taxComputation` carries only the composed `amount`. The only published federal-only figure is
`advisoryFederalTax.detail.totalTax`, and its doc says it "is NOT the year's settled liability". So "state tax = $0"
cannot be read off the row; it can only be inferred as `tax` − the federal amount, or from the FL pack's
`hasIncomeTax: false`. Candidate test strategies:
(a) assert `tax` = 11,238.37536, and separately assert that a direct `createStateTaxCalculator` call on
`acceptedTaxInput` returns 0;
(b) assert `tax` − `advisoryFederalTax.detail.totalTax` = 0. This relies on the advisory probe input equalling the
accepted input, which is not a documented guarantee.
Prefer (a).

**A7. Rounding.** No contract used here states cent rounding for the RMD, taxable SS, the senior deduction, taxes,
withdrawals or growth. `aggregateBasisSale` says outright that it "does not round to cents". I have assumed
unrounded floating point throughout, with display half-up to the cent and a test tolerance of 0.005. If the page shows
cent-rounded components, their sums can differ from the published totals by a cent. The rounded components do happen
to sum exactly here: 28,178.67 + 1,869,198.11 + 420,000.00 = 2,317,376.78.

**A8. The QCD "aggregate includible IRA amount" is read at a moment the contract does not state.** The `YearResult.qcd`
comment caps the qualified slice at the aggregate includible amount without saying whether that is the opening
balance, the post-RMD balance or the year-end balance; an in-function comment in
`annualForcedDistributionQcdAndRetirementActionsPhase.ts` (the IRC 408(d)(8)(D) block) says it is the pre-distribution
aggregated owned-IRA balance minus aggregate basis, 1,850,000 here. Every candidate (1,850,000; 1,780,188.68; 1,869,198.11) far exceeds 15,000,
so the reading does not matter for this plan.

**B1. The fixed-point seed and evaluation count.** They are stated only in `annualFundingFixedPoint.ts` (the header and
the `spendingUsesBeforeTax` doc), not in any `YearResult` contract, and in a year without ACA they cannot be observed
from the row. Row 82 records the mechanism; no test should pin it.

**B2. What "cash inflows" means in `surplusInvested`.** The `YearResult.surplusInvested` doc and the
`surplus-invested-annual` worksheet both say max(0, cash inflows − expenses.total − contributions − tax − penalties)
without saying whether need-based withdrawals are inflows. The code excludes them (the accepted inflows are incomes
plus the net RMD cash plus any coordinated reverse-mortgage draw), which is the reading row 84 uses: the surplus is 0
by a 22,373.85 margin. Under the other reading it is 0 only up to the fixed point's floating residue.

**B3. Medicare start for a first-of-the-month birthday.** `annualHealthcareExpenses` says the prior-month eligibility
rule for people born on the first is not modeled. Dana is born on January 1; at 73 this has no effect, and the page
should not present the birth-month rule as exact for her 65 year.

**B4. Two birth-year conventions.** FRA uses the January-1 effective birth year 1952 (`nra.ts`); `ageAttained`, the
RMD start, the QCD age proxy and the Medicare months use the calendar birth year 1953. No contract states the pair.
No 2026 figure depends on it: FRA is 66y0m for either year and the RMD age is 73 either way.

**B5. The claim factor is a float.** 1 + 48 × (2/3)/100 is computed in binary floating point, so
`incomes.socialSecurity` need not be bit-equal to 50,688; the 0.005 tolerance covers it, as for every figure.

**B6. Twelve Medicare months at 66 or older is stated only in code.** `YearExpenses.healthcare` says the year splits
at the Medicare birth month; the rule that a person aged 66 or older has twelve Medicare months and no marketplace
months is in the `annualHealthcareExpenses` body. It is unambiguous, but only code states it.

**B7. Section 4 is an estimate, not a derivation.** Its two indexing steps (109,000 × 1.025² = 114,518.125 and the
QCD 15,000 × 1.050625 = 15,759.375) were checked; its rough 2028 figures were not, and are not to be pinned.

**Revision 1 (2026-09-22, after the independent check).** Row 82 corrected (the fixed point converges on the second
evaluation, seeded with the pre-tax need); row 84 restated on the code's reading of cash inflows; citations corrected
in the rounding paragraph, the order-of-steps sentence, rows 7, 11, 16 and 81, item A3 and the provenance commit;
item A8 amended and items B1 to B7 added from the check. Revision 2 (2026-09-22, after the re-check): the rounding
paragraph states the worksheet tolerances as counted (21 at $0.005, 14 exact, 2 at 1e-12), row 84 prints its exact
margin, and the provenance describes the two commits past main. No figure changed.

---

## 4. Suggested later year: **2028**

2028 is the most instructive later year for this plan. Four mechanisms that are dormant or trivial in 2026 all
change at once, and none of them is a knife-edge.

1. **The IRMAA lookback switches from the seed to the ledger.** 2026 and 2027 read `recentAnnualMagi` = 0
   (source `planFallback`, years 2024 and 2025). 2028 is the first premium year to read a *projected* MAGI: 2026's
   published `magi` of 97,896.12 (source `projected`, year 2026). The tier-1 floor is indexed at general inflation
   from the pack year: 109,000 × 1.025² = 114,518.125. So 2028 stays at tier 0 with about 16,622 of headroom. A
   reader can see exactly which year's number drives which year's premium, and that year one's MAGI (row 42) was
   the input.
2. **The cash buffer runs out and the brokerage is sold for the first time.** Cash covers about 22,374 in 2026 and
   about 21,852 in 2027, leaving roughly 6,450 at the start of 2028. Under the sequential order, 2028's need drains
   the rest of cash, then sells the brokerage. The first realized gains appear under the basis-ratio rule: about
   1 − 280,000/441,000 ≈ 36.5% of each dollar sold. They stack as long-term gains at 15%, because ordinary income
   already fills the 0% band. They also raise AGI, which shaves the senior deduction by 6% of each gain dollar and
   lifts 2028's MAGI, the input to 2030's IRMAA.
3. **Last year of the senior deduction.** `seniorDeduction.lastApplicableYear` is 2028, so 2028 still shows the
   phase-out interacting with gains, and 2029 shows the deduction gone.
4. **Stand-in pack indexing.** Brackets, the standard deduction with its age-65 addition, and the LTCG breakpoints
   are indexed by 1.025² from the 2026 pack. The §86 SS thresholds, the NIIT threshold and the senior-deduction
   threshold are *not* indexed (`indexFederalTaxPack` doc; domain rules §1). The RMD divisor is 24.6 at age 75, and
   the QCD is 15,000 × 1.050625 = 15,759.375 because it is in today's dollars.

**Rough 2028 figures.** These come from my own forward application of the same contracts. They are an *estimate to
orient the next derivation*, not a derivation, and a test must not pin them from this note:
- RMD ≈ 1,885,691 / 24.6 ≈ 76,654; QCD 15,759.38; SS ≈ 50,688 × 1.050625 ≈ 53,254.08 (taxable SS still at the 85% cap).
- Healthcare ≈ (2,434.80 + 4,200) × 1.055² ≈ 7,384.70 (Part B at tier 0, scaled at health inflation from the pack
  year; extras at health inflation from the start year).
- Spending 115,568.75.
- Cash draw ≈ 6,453 (cash exhausted), then brokerage sale ≈ 16,000 with gain ≈ 5,841.
- AGI/MAGI ≈ 112,002; senior deduction ≈ 3,780; federal tax ≈ 13,649.

**Why not other years.**
- **2027** only rolls the arithmetic forward: same IRMAA seed, cash still covers the need.
- **2029** is a good second choice: the senior deduction disappears and the lookback reads 2027's MAGI (about
  102,089).
- **The first IRMAA surcharge year** is roughly 2034 in my estimate (2032 MAGI of about 134,300 against a 2034
  tier-1 floor of about 132,800). That is too close a margin for a walkthrough: small modeling differences move it by
  a year.

**Loose whole-run cross-check (not evidence for any year-one figure).** Carrying my estimate to 2048 gives an ending
investable total within about 0.2% of the example's published whole-run golden. The residual is expected from my
simplified forward loop. It suggests the reading of the contracts above is not systematically off.

---

# Part II: year 2028 by hand (2027 as the bridge)

Independent hand derivation of a later projection year of the curated example `rmd-irmaa`
(`packages/planner-ui/src/planner/examples/buildRmdIrmaa.ts`): 2027 in compact form as the bridge, then 2028 in
full. It continues part I above (year 2026, approved in `DOCS/walkthroughs/REVIEW-2026-09-22.md`, re-check 2), and
its rows are the second `tables[]` entry of
`packages/planner-ui/src/planner/examples/walkthroughs/rmdIrmaa.walkthrough.ts`. Section numbers below are part II's
own; "the 2026 document" and "part I" both mean the sections above.

**Provenance.** Derived 2026-09-22 by Claude (Opus 5.5 subagent) against the committed tree at `e814bd02`
(`e814bd02946c2f196e103311a8e873937b514ddb`, the content of RetireGolden #732 as merged), every source read with
`git show HEAD:<path>`. I did not run the engine, run any test,
or execute any TypeScript or JavaScript, and I modified no repository file. I did the arithmetic by hand and
checked it with exact rational arithmetic (Python `fractions`) written from the contracts cited below, not from
engine code. The only 2026 figures used are the approved table's closing balances (rows 92, 95, 97) and its
published `magi` (row 42). I did not open `examples.golden.test.ts`, any walkthrough test, or any other
derivation's check file. Section 4 of the 2026 document chose this year and gave rough figures. None of them is used
here; §8 compares them after the fact.

**Revision 1 (2026-09-23).** Revised after the independent check (`REVIEW-2026-09-22.md`, the "2027 bridge and year
2028" section), which approved every figure: nine citations relocated or completed as its §3 lists, the half-cent list
(C7) completed to five values, the rounded-parts list (C8) completed, the seed and evaluation-count sentence in §4j
corrected (the count is published in ACA years; the seed never), and the rule record for the unrounded lower IRMAA
floors added. No figure changed.

**Rounding and tolerance.** These follow the 2026 document:
- No contract used here states a rounding step. The ledger carries unrounded binary-floating-point dollars.
- Every value below is the exact value, then its half-up cent display. The exact value is a fraction, a terminating
  decimal where one exists, or else 12 decimals with "…".
- **A test compares against the exact value**:
  - dollar rows within `ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS` = 0.005 (`projection/moneyTolerance.ts`);
  - integers and enumerations exactly;
  - inflation factors within 1e-12.

2028 adds one case the 2026 year did not have: figures sized by the funding fixed point while the tax changes with
the candidate. Those rows are marked **(†)**. The note under §4k says why 0.005 still holds for them, and what bound
the contract alone gives.

The only bisection-sized field, `ltcgZeroHeadroom`, returns 0 before it bisects in both years (rows 80 and B25). No
row here is therefore sized by bisection, and no one-sided $0.01 tolerance applies.

---

## 1. Starting point

The plan inputs are unchanged from the 2026 document §1:
- **Household:** Dana, single, Florida, born 1953-01-01.
- **Accounts:** cash 50,000 at 2%. Traditional IRA 1,850,000 and brokerage 400,000 (basis 280,000), both at the
  plan default of 5%.
- **Income and giving:** PIA 3,200, claimed at 70y0m. `qcdAnnual` 15,000.
- **Spending:** `baseAnnual` 110,000. Medicare extras 350 a month.
- **Assumptions:** `inflationPct` 2.5, `healthcareExtraInflationPct` 3, `recentAnnualMagi` 0.
- **Strategy:** sequential withdrawals, no conversions, no SSA-44, no market series.

| Carried from the approved 2026 table | Exact value | Becomes |
|---|---|---|
| Cash close (row 92) | 28,178.668302611321… | 2027 cash opening |
| IRA close (row 95) | 99,067,500/53 = 1,869,198.113207547170… | 2027 opening **and** the prior-Dec-31 base for the 2027 RMD |
| Brokerage close (row 97), basis | 420,000; basis 280,000 | 2027 opening |
| `magi` (row 42) | 25,942,472/265 = 97,896.120754716981… | the MAGI the **2028** premium reads (`magiHistory[2026]`) |

---

## 2. Indexing rules applied (2027 and 2028)

2026 is the only published pack (`params/index.ts`, `const packs = [year2026]`). For 2027 and 2028, `packForYear`
returns the 2026 pack with `isStandIn: true`. Its header reads "Future years resolve to the latest published pack
with `isStandIn: true`". Every rule below uses factors measured from 2026. That is both the pack year and the start
year, so "from the pack year" and "from the start year" give the same number in this plan (see §7, C2).

| Rule | Factor 2027 / 2028 | Applies to | Source |
|---|---|---|---|
| General inflation factor, `inflFactorFrom(2026, y)` | 1.025 / 1.050625 (41/40, 1,681/1,600) | cumulative product of (1 + 2.5%) per year from the start year; deterministic run, so no series | `simulate.ts` l.531 (`inflFactorFrom`, "Cumulative general-inflation factor between two years"); published as `YearResult.inflationScale` ("Exact cumulative general-inflation factor used by this simulation year"; `annualFundingApplicationAndClosePhase.ts` l.2102 passes `inflFactor`) |
| Health inflation factor, `healthInflFactorFrom(2026, y)` | 1.055 / 1.113025 (211/200, 44,521/40,000) | **additive** rate 2.5% + 3% = 5.5% per year, compounded | `assumptionsSchema.healthcareExtraInflationPct` doc ("Healthcare costs grow at inflationPct + this"); `simulate.ts` l.520 (`cumHealthInfl … * (1 + r + healthExtra)`) and the l.532 doc comment ("Same for healthcare (general inflation + the healthcare premium)") |
| Statutory-limit and tax scale, `limitGrowth` = `indexingScaleFor(2026, y, inflFactorFrom)` | 1.025 / 1.050625 | passed as `TaxYearInput.inflationScale` (`annualFundingApplicationAndClosePhase.ts` l.965) and as the QCD per-donor limit growth | `params/indexingScale.ts` module header, l.15–17 ("above it the scale is the cumulative inflation factor from the pack year"; the in-body comment of `indexingScaleFor`, l.55–61, says the factor above the latest pack "is the whole inflation path"); `simulate.ts` l.542; `TaxYearInput.inflationScale` doc (`projection/internal/types/tax.ts`) |
| **Indexed** federal figures (`indexFederalTaxPack`) | × 1.025 / × 1.050625 | bracket lower bounds; standard deduction; age-65 addition; 15% and 20% capital-gain breakpoints; AMT exemption, its phase-out start, and the 26/28% breakpoint | `params/index.ts#indexFederalTaxPack` doc (IRC 1(j)(3)(B), 63(c)(7)(B)(ii), 63(c)(4), 1(j)(5)(C), 55(d)(4)(B), 55(d)(3)(B)(i)); applied in `tax/federalTax.ts#computeFederalTax` l.512; domain rules §1, "Indexing in projected years" |
| **Not indexed** | 1 | §86 provisional-income tiers 25,000 / 34,000; §1411 NIIT threshold 200,000; the senior deduction's 6,000 per person, 75,000 MAGI threshold and 6% rate; §1211(b) 3,000; §121; SALT cap (own schedule) | `indexFederalTaxPack` doc, "Figures deliberately left alone, because no provision indexes them" (l.81–87); `federalTax.ts` header ("The unindexed ones are not"); `TaxYearInput.inflationScale` doc ("Unindexed figures (sections 86, 1411, 121, 1211(b), 151(d)(5)(C) …) ignore it by construction"); domain rules §1 (record `irc-151-d-5-C-senior-deduction-not-indexed`) |
| Senior deduction sunset | — | applies while `year ≤ lastApplicableYear` = 2028, so **2028 is its last year** | `year2026.ts` l.49–54 (`lastApplicableYear: 2028`); `federalTax.ts#seniorDeductionAmount` ("expiring after `lastApplicableYear`"; body: `year > rule.lastApplicableYear` returns 0) |
| IRMAA tier floors (lower four rows) | `magiOver × inflFactorFrom(pack.year, premiumYear)`: tier 1 = 111,725 / 114,518.125 | general inflation, not health; unrounded | `params/index.ts#irmaaTierThreshold`, in-body comment l.285–288 ("Every row but the last indexes under (i)(5)(A) without interruption … and the engine does not [round]"); rule record `usc-42-1395r-i-5-C-top-irmaa-threshold-frozen` (`rules/records/medicareAndHealthCoverage.ts`, whose `conventionRationale` says the (i)(5)(B) rounding of the four lower rows "is not reproduced … and is named here rather than left as a silent asymmetry"), so the unrounded floor rests on a registered rule record, not code alone; `tax/medicare.ts` header ("bracket thresholds at general inflation"); `annualHealthcareExpenses.ts` l.166–167; domain rules §7 |
| IRMAA top row | frozen at 500,000 through premium year 2027; 2028 = nearest 1,000 of 500,000 × 1.025 | not reached by this plan (see §7, C9) | `irmaaTierThreshold` doc; `IRMAA_TOP_TIER_FROZEN_THROUGH_YEAR = 2027` (l.248) |
| Part B premium (and any Part D surcharge) | `premiumScale = healthInflFactorFrom(pack.year, y)` = 1.055 / 1.113025 | **health** rate, from the **pack** year | `tax/medicare.ts` header ("premiums are indexed at the healthcare inflation rate"); `medicareAnnualPremiumPerPerson(…, premiumScale)`; `annualHealthcareExpenses.ts` l.169; `YearExpenses.healthcare` doc ("the tier premium with IRMAA is inflated from the pack year"); calculation records `medicare-base-part-b-premium` (`premiumScale`: "Healthcare-inflation scale to the premium year") and `spending-healthcare-annual` ("scaled by the healthcare factor from the pack year to this year") |
| Medicare extras | `healthInflFactorFrom(startYear, y)` = 1.055 / 1.113025 | **health** rate, from the **start** year | `YearExpenses.healthcare` doc ("the extras … use the health inflation factor from the start year"); `annualHealthcareExpenses.ts` l.185; calculation record `spending-healthcare-annual` |
| Base spending | `inflFactor` = 1.025 / 1.050625 | general rate from the start year | `expensePlanSchema.baseAnnual` doc ("today's dollars"); `simulate.ts` header ("base spending … inflate at the general rate"); `annualLifestyleLayers.ts` (`lifestyleScale = inflFactor × phase × survivor`) |
| QCD requested | 15,000 × `inflFactor` = 15,375 / 15,759.375 | general rate from the start year | `strategiesSchema.qcdAnnual` doc ("today's dollars"); `annualLegacyQcdGiftPlan` (`qcdAnnual * inflFactor`) |
| QCD per-donor cap | 111,000 × `limitGrowth` = 113,775 / 116,619.375 | not binding | `YearResult.qcd` doc ("the pack's `rmd.qcdAnnualLimit` indexed with the limit growth"); `annualForcedDistributionQcdAndRetirementActionsPhase.ts` l.1243; worksheet `qcd-limit-and-age-proxy` |
| Social Security COLA (`matchInflation`) | `inflFactorFrom(startYear, y)` = 1.025 / 1.050625 | no mode reads the pack's `colaPct` of 2.8 | `YearIncomes.socialSecurity` doc ("COLA factor: the inflation factor from the start year under matchInflation"); `simulate.ts` l.1653–1656; worksheet `social-security-cola-factor` |
| RMD divisor | Uniform Lifetime Table, not indexed: age 74 → **25.5**, age 75 → **24.6** | divides the **prior-Dec-31** balance, i.e. the previous year's published close | `year2026.ts` l.103; `rmd/rmd.ts#requiredMinimumDistribution` ("`priorYearEndBalance` is the Dec 31 balance of the previous year"); `annualOwnerRmdPlan.ts` (`startOfYearBalance`: "Aggregate prior-Dec-31 balance"); `simulate.ts` l.1354; worksheet `rmd-uniform-lifetime-divisor` (its own example is age 75, divisor 24.6) |
| Account returns | cash 2%, IRA and brokerage 5% | not inflation-linked; applied after the year's flows | 2026 document §2h; `annualPostSolveAccountGrowth.ts` |

---

## 3. Year 2027, the bridge

In 2027 Dana is 74. The IRMAA premium still reads the plan fallback, the cash buffer still covers the need, and
nothing is sold. Every row is a figure 2028 depends on, or, for B26, one 2029 will.

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| B1 | Age / factors | 74; general 1.025; health 1.055; tax scale 1.025 | 2027 − 1953; §2 | `PersonYearState.ageAttained`; §2 | exact / 1e-12 |
| B2 | `incomes.socialSecurity` (= `incomes.total`) | **51,955.20** (259,776/5) | 3,200 × 1.32 × 12 × 1.025; monthly 4,329.60 | `YearIncomes.socialSecurity`; worksheets `social-security-benefit-annual`, `social-security-cola-factor` | 0.005 |
| B3 | RMD base | 1,869,198.11 (99,067,500/53) | 2026 IRA close | `rmd.ts`; `annualOwnerRmdPlan.ts` `startOfYearBalance` | 0.005 |
| B4 | **`rmd`** | **73,301.89** (3,885,000/53 = 73,301.886792452830…) | 1,869,198.113208 ÷ 25.5 (age 74) | worksheet `rmd-uniform-lifetime-divisor`; `year2026.ts` l.103 | 0.005 |
| B5 | **`qcd`** (from the RMD) / income offset | **15,375.00** / 15,375.00 | 15,000 × 1.025, under the 113,775 cap and within the RMD | `YearResult.qcd`; worksheets `qcd-limit-and-age-proxy`, `qcd-income-offset-qualified-slice` | 0.005 |
| B6 | Ordinary income = net RMD cash | 57,926.89 (3,070,125/53) | 73,301.886792 − 15,375 | `YearResult.qcd` ("`rmd` stays gross; only the year's cash inflow is reduced") | 0.005 |
| B7 | Taxable Social Security | **44,161.92** | Provisional income 83,904.486792 = 57,926.886792 + 25,977.60. The 85% formula gives 0.85 × 49,904.486792 + 4,500 = 46,918.813774, above the cap 0.85 × 51,955.20 = 44,161.92. **The cap binds**: break-even ordinary income is 54,683.482353, and Dana is 3,243.404440 past it. | `federalTax.ts#taxableSocialSecurity`; worksheet `federal-taxable-social-security-tiers`; thresholds unindexed | 0.005 |
| B8 | **AGI = `magi`** | **102,088.81** (135,267,669/1,325) | 57,926.886792 + 44,161.92 | worksheet `medicare-magi-composition`; `YearResult.magi` | 0.005 |
| B9 | Standard deduction | 18,603.75 | (16,100 + 2,050) × 1.025 = 16,502.50 + 2,101.25 | `indexFederalTaxPack`; worksheet `federal-standard-deduction-age-65` | 0.005 |
| B10 | Senior deduction | 4,374.67 (4,374.671592452830…) | 6,000 − 0.06 × (102,088.806792 − 75,000) = 6,000 − 1,625.328408. The threshold and the amount are **not** indexed. | `federalTax.ts#seniorDeductionAmount`; `year2026.ts` l.49–54 | 0.005 |
| B11 | Taxable income | **79,110.3852** exactly | 102,088.806792 − 18,603.75 − 4,374.671592. It is exact because 1.06 × RMD = 77,700, so TI = 1.06·AGI − 29,103.75. | `federalTax.ts` header steps 2–3 | 0.005 |
| B12 | **`tax`** (federal regular tax; FL 0) | **11,984.08** (11,984.084744 exactly) | Brackets × 1.025: 10% × 12,710 = 1,271; 12% × (51,660 − 12,710) = 4,674; 22% × (79,110.3852 − 51,660) = 6,039.084744. No gains; NIIT 0. AMT: AMTI 102,088.806792 less the 92,352.50 exemption gives TMT 2,531.439766, below the regular tax, so 0. | worksheets `federal-ordinary-bracket-tax`, `federal-amt-screen`, `tax-total-annual`; `indexFederalTaxPack` | 0.005 |
| B13 | IRMAA lookback | year **2025**, source **`planFallback`**, MAGI **0**, tier **0** | 2025 is before the ledger, so the plan's `recentAnnualMagi` of 0 applies. Tier-1 floor 109,000 × 1.025 = 111,725 (`irmaaNextTierThreshold`). | `YearResult.magi` ("the first two projection years fall back"); worksheet `irmaa-lookback-selection` (its own second-year case) | exact |
| B14 | `medicarePremiums` / extras / **`expenses.healthcare`** | 2,568.71 (2,568.714) / 4,431.00 / **6,999.71** (6,999.714) | 202.90 × 1.055 × 12 (214.0595 a month); 350 × 12 × 1.055; sum | worksheet `spending-healthcare-annual`; `tax/medicare.ts` | 0.005 |
| B15 | `baseSpending` / **`expenses.total`** | 112,750.00 / **119,749.71** (119,749.714) | 110,000 × 1.025; + 6,999.714 | worksheets `spending-base-annual`, `spending-total-annual` | 0.005 |
| B16 | **`netPortfolioNeed`** | **79,778.60** (79,778.598744 exactly) | 119,749.714 + 11,984.084744 − 51,955.20 | worksheet `portfolio-need-annual` | 0.005 |
| B17 | **Cash draw** = `withdrawals.cash` | **21,851.71** (21,851.711951547170…) | 79,778.598744 − 57,926.886792 of net RMD cash. That is less than the 28,178.67 in cash, so nothing is sold. | `SEQUENTIAL_ORDER`; `annualWithdrawalPlanning.ts` | 0.005 |
| B18 | Fixed point | second evaluation | The seed is the pre-tax gap, 119,749.714 − 109,882.086792 = 9,867.627208. Evaluation 1 returns 21,851.711952; evaluation 2 reproduces it, because a cash draw adds no income. The count is not published, so do not assert it. | `annualFundingFixedPoint.ts` header and body | — |
| B19 | `withdrawals.taxable` / `.traditional` / **`.total`** | 0 / 73,301.89 / **95,153.60** (95,153.598744 exactly) | total = need + QCD = 79,778.598744 + 15,375 | worksheets `withdrawals-by-category-annual`, `withdrawals-total-annual` | 0.005 |
| B20 | `surplusInvested` / `shortfall` / `realizedGains` | 0 / 0 / 0 | surplus: max(0, inflows 109,882.086792 − 119,749.714 − 11,984.084744) = max(0, −21,851.711952) | worksheet `surplus-invested-annual`; 2026 document B2 | exact |
| B21 | **Cash close** | **6,453.50** (6,453.495478085434…) | (28,178.668303 − 21,851.711952) × 1.02 = 6,326.956351 + 126.539127 of growth | `YearResult.balances`; `annualPostSolveAccountGrowth.ts` | 0.005 |
| B22 | **IRA close** (the 2028 RMD base) | **1,885,691.04** (99,941,625/53 = 1,885,691.037735849057…) | (1,869,198.113208 − 73,301.886792) × 1.05 = 95,182,500/53 + 4,759,125/53 | same | 0.005 |
| B23 | **Brokerage close** / basis | **441,000.00** / 280,000 | 420,000 × 1.05; no sale, no yield | same | 0.005 |
| B24 | `investableTotal` = `netWorth` | 2,333,144.53 (2,333,144.533213934491…) | 6,453.495478 + 1,885,691.037736 + 441,000. **Display drift:** the rounded components sum to 2,333,144.54. | worksheets `accounts-investable-total-annual`, `accounts-net-worth-annual` | 0.005 |
| B25 | `ltcgZeroHeadroom` | 0 | TI of 79,110.39 is already at or above the 15% breakpoint, 49,450 × 1.025 = 50,686.25, so the field returns 0 before any bisection. | worksheet `year-result-ltcg-zero-headroom` | exact |
| B26 | (2029 input) 2027 `magi` | 102,088.806792452830… | the MAGI the 2029 premium will read | `YearResult.magi` | 0.005 |

---

## 4. Year 2028 by hand

The year runs in the same order as the 2026 document §2 (`simulate.ts` header). The brokerage sale is sized inside
the funding fixed point, so the figures that do not depend on it come first (§4a–4e). Then come the fixed point
(§4f), the tax at the root (§4g), the cash flow (§4h) and the balances (§4i).

### 4a. Timeline, person and factors

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 1 | Dana's `ageAttained` | **75** | 2028 − 1953 | `PersonYearState.ageAttained` | exact |
| 2 | `alive` / `lifeAge` | true / 95 | 75 ≤ 95 | `PersonYearState.alive`, `.lifeAge` | exact |
| 3 | Filing status / people 65+ | `single` / 1 | no death; Dana ≥ 65 | `YearResult.filingStatus`; worksheet `federal-standard-deduction-age-65` | exact |
| 4 | Parameter pack | the 2026 pack, standing in (`isStandIn` true; `advisoryFederalTax.detail.usesStandInPack` true) | no 2028 pack is published | `params/index.ts#packForYear`; `FederalTaxDetail.usesStandInPack` | exact |
| 5 | **`inflationScale`** (published) | **1.050625** (1,681/1,600) | 1.025 × 1.025 | `YearResult.inflationScale` | 1e-12 |
| 6 | Health factor / tax scale | 1.113025 / 1.050625 | §2 | §2 | 1e-12 |

### 4b. Social Security

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 7 | Claim-age factor / payable months | 1.32 / 12 | unchanged from 2026 rows 9–10 (claimed 2023; every later year has 12 months) | worksheets `delayed-retirement-credit-factor`, `social-security-payable-months` | 1e-12 / exact |
| 8 | COLA factor | **1.050625** | `matchInflation`: `inflFactorFrom(2026, 2028)`. Not 1.028², because the pack's 2.8% is never read. | `YearIncomes.socialSecurity` doc; `simulate.ts` l.1653–1656 | 1e-12 |
| 9 | Monthly benefit | 4,437.84 | 3,200 × 1.32 × 1.050625 | same | 0.005 |
| 10 | **`incomes.socialSecurity`** | **53,254.08** (1,331,352/25) | 4,437.84 × 12 | worksheet `social-security-benefit-annual` | 0.005 |
| 11 | `taxableYield` / `taxExemptInterest` | 0 / 0 | The brokerage has no yield fields and no allocation, and the cash account produces no yield row. | 2026 document row 31, item A4 | exact |
| 12 | **`incomes.total`** | **53,254.08** | Social Security only | worksheet `income-total-annual` | 0.005 |

### 4c. RMD and QCD

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 13 | RMD base (prior Dec 31) | 1,885,691.04 (99,941,625/53) | the 2027 IRA close, row B22, captured before any 2028 flow | `rmd.ts`; `annualOwnerRmdPlan.ts` `startOfYearBalance`; `simulate.ts` l.1354 | 0.005 |
| 14 | Divisor | **24.6** | Uniform Lifetime Table at 75 (no spouse) | `year2026.ts` l.103; worksheet `rmd-uniform-lifetime-divisor` | exact |
| 15 | **`rmd`** (gross) | **76,654.11** (166,569,375/2,173 = 76,654.107225034514…) | 1,885,691.037736 ÷ 24.6 | same; `YearResult.rmd` | 0.005 |
| 16 | QCD age gate / cap | eligible (75 ≥ 71) / 116,619.375 | 111,000 × 1.050625 | worksheet `qcd-limit-and-age-proxy`; `YearResult.qcd` | exact / 0.005 |
| 17 | **`qcd`** (all from the RMD) | **15,759.38** (126,075/8 = 15,759.375 exactly) | 15,000 × 1.050625. It is below the 76,654.11 RMD, so nothing is taken beyond the RMD. See §7 C7 on the half cent. | `strategiesSchema.qcdAnnual`; `annualLegacyQcdGiftPlan` | 0.005 |
| 18 | QCD income offset | 15,759.375 | qualified = min(15,759.375, aggregate includible amount ≈ 1.886M, with no basis); §219 offset 0 | worksheet `qcd-income-offset-qualified-slice` | 0.005 |
| 19 | Net RMD cash = taxable part of the distribution | **60,894.73** (1,058,594,025/17,384 = 60,894.732225034514…) | 76,654.107225 − 15,759.375; fully ordinary | `YearResult.qcd` doc | 0.005 |
| 20 | `penalties` | 0 | RMD fully taken; Dana is past 59½ | worksheet `tax-penalties-annual` | exact |

### 4d. IRMAA and healthcare

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 21 | IRMAA lookback year | **2026** | 2028 − 2; no SSA-44 | worksheets `medicare-irmaa-two-year-lookback`, `irmaa-lookback-selection`; `annualHealthcareExpenses.ts` l.93 | exact |
| 22 | **`irmaaLookbackMagiSource`** | **`projected`** | 2026 is in `magiHistory`, written at the close of 2026. This is the **first** year this plan's premium reads the ledger. | `YearResult.irmaaLookbackMagiSource` doc (chain `magiHistory` → `historicalAnnualMagiByYear` → `recentAnnualMagi`); `simulate.ts#resolveMagiFor` | exact |
| 23 | **`irmaaLookbackMagi`** / `…Year` | **97,896.12** (25,942,472/265) / **2026** | 2026 row 42 | `YearResult.irmaaLookbackMagi`, `.irmaaLookbackMagiYear` | 0.005 / exact |
| 24 | Tier-1 floor (single, 2028) | 114,518.13 (114,518.125 exactly) | 109,000 × 1.050625 (general rate from the pack year, unrounded) | `params/index.ts#irmaaTierThreshold`; `year2026.ts` l.193 | 0.005 |
| 25 | **`irmaaTier`** | **0** | 97,896.12 is not > 114,518.125; headroom 16,622.004245 (35,238,649/2,120) | worksheet `medicare-irmaa-first-tier-boundary`; `params/index.ts#irmaaTierForMagi` | exact |
| 26 | Medicare months | 12 | age ≥ 66 | `annualHealthcareExpenses.ts` body; 2026 document B6 | exact |
| 27 | Part B, monthly / annual | 225.8327725 / **2,709.99** (2,709.99327 exactly) | 202.90 × (25/25) × 1.113025 × 12, at the health rate from the pack year | worksheet `medicare-base-part-b-premium`; calculation record `medicare-base-part-b-premium`; `tax/medicare.ts#medicareAnnualPremiumPerPerson` | 0.005 |
| 28 | Part D surcharge / **`irmaaSurcharge`** | 0 / **0** | tier 0 | `YearResult.irmaaSurcharge` | exact |
| 29 | **`medicarePremiums`** | **2,709.99** (2,709.99327) | (2,709.99327 + 0) × 12/12 | `YearResult.medicarePremiums` | 0.005 |
| 30 | `irmaaNextTierThreshold` | 114,518.13 (114,518.125) | Medicare is active and the tier is 0, so this is tier 1's floor | `YearResult.irmaaNextTierThreshold` | 0.005 |
| 31 | Medicare extras | 4,674.71 (4,674.705 exactly) | 350 × 12 × 1.113025, at the health rate from the start year | worksheet `spending-healthcare-annual`; `YearExpenses.healthcare` doc | 0.005 |
| 32 | **`expenses.healthcare`** | **7,384.70** (7,384.69827 exactly) | 2,709.99327 + 4,674.705, which equals 6,634.80 × 1.113025 | same; calculation record `spending-healthcare-annual` | 0.005 |
| 33 | (context) 2028's own MAGI vs the floor 2030 will use | 112,002.07 vs 120,315.61 | row 60 against 109,000 × 1.025⁴ = 120,315.605078125. 2028 does not read this figure. | `YearResult.magi` ("the IRMAA base two years later") | — |

### 4e. Spending

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 34 | **`expenses.baseSpending`** | **115,568.75** (462,275/4) | 110,000 × 1.050625; no phases, no policy | worksheet `spending-base-annual`; `YearExpenses.baseSpending` | 0.005 |
| 35 | `oneTimeGoals`, `debtService`, `propertyCosts`, `insurancePremiums`, `careCost`, `ltcBenefit` | 0 each | none in the plan | `YearExpenses` docs | exact |
| 36 | **`expenses.total`** | **122,953.45** (122,953.44827 exactly) | 115,568.75 + 7,384.69827 | worksheet `spending-total-annual` | 0.005 |
| 37 | `requiredSpending` / `targetSpending` / `intendedSpending` / `idealSpending` / `excessSpending` / `guardrailFactor` | 122,953.44827 for each of the first three / 0 / 0 / 1 | as 2026 row 76 | `YearExpenses` layer docs | 0.005 |

### 4f. The funding fixed point and the brokerage sale

The gap left after Social Security and the net RMD cash is drawn in the sequential order: all of the cash first,
then the brokerage. The sale sets off a loop:
- a brokerage sale realizes a gain;
- the gain raises the tax;
- the higher tax widens the gap;
- the wider gap needs a larger sale.

The ledger resolves that loop in `annualFundingFixedPoint` (§4j). The exact root follows.

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 38 | Accepted cash inflows (`baseCashInflows`) | 114,148.81 (114,148.812225034514…) | incomes 53,254.08 − reinvested yield 0 + `rmd` 76,654.107225 − `qcdFromRmd` 15,759.375 | `annualFundingApplicationAndClosePhase.ts` l.709; 2026 document B2 | 0.005 |
| 39 | Pre-tax gap (the fixed point's seed) | 8,804.64 (8,804.636044965486…) | 122,953.44827 − 114,148.812225 (contributions 0) | `annualFundingFixedPoint.ts` header ("the pre-tax cash need"), `spendingUsesBeforeTax` doc | 0.005 |
| 40 | Cash available (to the last dollar) | **6,453.50** (6,453.495478085434…) | the 2027 cash close, row B21; no safety-net floor | `SEQUENTIAL_ORDER` (cash first); `annualWithdrawalPlanning.ts`, the local `takeFrom` closure at l.182–187 (`take = min(available, wanted, remaining)`); `withdrawalStrategySchema` sequential doc | 0.005 |
| 41 | Brokerage opening FMV / basis | 441,000 / 280,000 | row B23. The sale is priced at the opening value, before 2028's growth. | `annualWithdrawalPlanning.ts` l.296–298 (the `aggregateBasisSale` call: `openingFairMarketValue: state.balance`, `openingCostBasis: state.costBasis`) | exact |
| 42 | **Basis-ratio rule** | recovered basis = basis × proceeds / FMV; gain = proceeds − recovered basis. Here gain = proceeds × (1 − 280,000/441,000) = proceeds × **23/63** (0.365079…) | aggregate basis, no lots | `tax/aggregateBasisSale.ts` body l.72–73 (`soldFraction = saleProceeds / openingFairMarketValue; recoveredCostBasis = openingCostBasis * soldFraction`); `taxableAccountSchema.costBasis` doc ("single basis-ratio model in v1; no lots"); domain rules §11 ("taxable (basis-ratio gains)") | exact |
| 43 | Tax with no gain, T₀ | 12,695.82 (12,695.824667478049…) | AGI₀ = 60,894.732225 + 45,265.968 = 106,160.700225. Senior₀ = 6,000 − 0.06 × 31,160.700225 = 4,130.357986. TI₀ = 106,160.700225 − 19,068.84375 − 4,130.357986 = 82,961.498489. Tax = 1,302.775 + 4,790.85 + 0.22 × (82,961.498489 − 52,951.50). | rows 56–79 with a gain of 0 | 0.005 |
| 44 | Marginal tax per gain dollar | **0.1632** (102/625) | Each gain dollar adds 1 to AGI and removes 0.06 of senior deduction, so TI rises 1.06. Of that, 1.00 is preferential at 15% and 0.06 is ordinary at 22%: 0.15 + 0.0132. The slope holds over the whole range: taxable SS is capped (row 57), the 22% band has room (row 71), the 15% LTCG band is in force (row 73), and the senior deduction stays positive. | rows 57, 64, 71, 73 | exact |
| 45 | Marginal tax per **sold** dollar | 0.059580952… (782/13,125) | 0.1632 × 23/63 | — | exact |
| 46 | **Fixed point, closed form** | P* = (seed + T₀ − cash) / (1 − 782/13,125) | The need after the net RMD cash, cash + P, must equal seed + tax(P), where tax(P) = T₀ + 0.1632 × 23/63 × P. | `annualFundingCandidateEvaluation.ts` (`requiredNeed` at l.468–475: spending + (candidate healthcare − current healthcare) + tax + penalties − cash inflows; the healthcare term is exactly 0 here, since the ACA is inactive and candidate healthcare equals healthcare excluding enrollment) | — |
| 47 | **Brokerage sale proceeds** = `withdrawals.taxable` | **16,000.28** (16,000.276974880504…) (†) | (8,804.636045 + 12,695.824667 − 6,453.495478) × 13,125/12,343 = 15,046.965234 × 1.063355748… | rows 39–46 | 0.005 (†) |
| 48 | Sold fraction | 0.0362818… | 16,000.276975 / 441,000 | row 42 | — |
| 49 | **Recovered basis** | **10,158.91** (10,158.906015797146…) (†) | 280,000 × 16,000.276975 / 441,000 | row 42 | 0.005 |
| 50 | **Realized gain** = **`realizedGains`** | **5,841.37** (5,841.370959083359…) (†) | 16,000.276975 − 10,158.906016 = 16,000.276975 × 23/63 | worksheet `tax-realized-gains-annual`; `YearResult.realizedGains` ("the gain embedded in taxable withdrawals") | 0.005 |
| 51 | Basis remaining (not published) | 269,841.09 (269,841.093984202854…) | 280,000 − 10,158.906016 | `aggregateBasisSale` `remainingCostBasis` | — |
| 52 | Need after the net RMD cash (cash + sale) | 22,453.77 (22,453.772452965938…) (†) | 6,453.495478 + 16,000.276975 | — | 0.005 (†) |
| 53 | The sale's own tax | **953.31** (953.311740522404…) | Tax 13,649.136408 − T₀ 12,695.824667. This equals the sale's excess over the no-own-tax sizing, 16,000.276975 − 15,046.965234: sale dollars are taxed only through their gain, so the sale grows by exactly its own tax. | rows 43, 47, 79 | 0.005 |

### 4g. Income, AGI, deductions and federal tax at the root

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 54 | Ordinary income (tax input) | 60,894.73 (60,894.732225034514…) | row 19; no need-based IRA draw | `annualFundingCandidateEvaluation.ts` (ordinary = base + need-based traditional − nontaxable) | 0.005 |
| 55 | Capital gains (tax input, all long-term) | 5,841.37 (†) | row 50; carryforward pool 0 | `federalTax.ts#applyCapitalLossCarryforward` doc ("Single pool, no short-/long-term split"); `computeFederalTax` (`preferentialIncome = min(gains + qualifiedDividends, taxableIncome)`) | 0.005 |
| 56 | Provisional income | 93,363.14 (93,363.143184117873…) | 60,894.732225 + 5,841.370959 + ½ × 53,254.08 | `federalTax.ts#taxableSocialSecurity`; worksheet `federal-taxable-social-security-tiers` | 0.005 |
| 57 | **Taxable Social Security** | **45,265.97** (45,265.968 exactly; 5,658,246/125) | The tier-1 base is min(26,627.04, 4,500) = 4,500. The 85% formula gives 0.85 × (93,363.143184 − 34,000) + 4,500 = 54,958.671707, above the cap of 0.85 × 53,254.08. **The cap binds**: break-even ordinary income is 55,332.922353, and AGI excluding SS, 66,736.103184, is 11,403.180831 past it. The gain therefore adds **nothing** to taxable SS. Thresholds unindexed. | same; `indexFederalTaxPack` doc | 0.005 |
| 58 | AGI excluding Social Security | 66,736.10 (66,736.103184117873…) (†) | 60,894.732225 + 5,841.370959 | `federalTax.ts` header step 2 | 0.005 |
| 59 | **AGI** | **112,002.07** (112,002.071184117873…) (†) | 66,736.103184 + 45,265.968 | same | 0.005 |
| 60 | **`magi`** (published; the 2030 IRMAA input) | **112,002.07** (†) | max(0, 60,894.732225 + 5,841.370959 + 0 + 45,265.968 + 0) | worksheet `medicare-magi-composition`; `YearResult.magi`; `annualFundingApplicationAndClosePhase.ts` l.1321 | 0.005 |
| 61 | Standard deduction, age-65 addition included | **19,068.84** (19,068.84375 exactly) | (16,100 + 2,050) × 1.050625 = 16,915.0625 + 2,153.78125 | `indexFederalTaxPack` (standard deduction and age-65 addition); worksheet `federal-standard-deduction-age-65`; `year2026.ts` l.40–41 | 0.005 |
| 62 | Senior-deduction MAGI | 112,002.07 (†) | AGI + foreign addback 0 | `federalTax.ts` header step 2; domain rules §1 | 0.005 |
| 63 | Senior phase-out | 2,220.12 (2,220.124271047072…) (†) | 0.06 × (112,002.071184 − 75,000); the 75,000 is **not** indexed | `federalTax.ts#seniorDeductionAmount`; `year2026.ts` l.49–54 | 0.005 |
| 64 | **Senior deduction (last year)** | **3,779.88** (3,779.875728952928…) (†) | max(0, 6,000 − 2,220.124271) × 1 person. The gain alone costs 0.06 × 5,841.370959 = 350.482258 of it; without the sale it would be 4,130.357986. 2028 is `lastApplicableYear`, so 2029 has none. | same; domain rules §1 ("tax years 2025–2028") | 0.005 |
| 65 | Total deduction | 22,848.72 (22,848.719478952928…) (†) | 19,068.84375 + 3,779.875729 | `federalTax.ts` header step 3 | 0.005 |
| 66 | **Taxable income** | **89,153.35** (89,153.351705164946…) (†) | 112,002.071184 − 22,848.719479 | `federalTax.ts` header | 0.005 |
| 67 | Preferential / ordinary taxable | 5,841.37 / 83,311.98 (83,311.980746081587…) (†) | preferential = min(5,841.370959, TI); ordinary taxable = TI − preferential | `FederalTaxDetail.preferentialIncome`, `.ordinaryTaxable` | 0.005 |
| 68 | Indexed bracket bounds (single, 2028) | 13,027.75 / 52,951.50 / 111,051.0625 | 12,400 / 50,400 / 105,700 × 1.050625 | `indexFederalTaxPack`; `year2026.ts` l.21–29 | 0.005 |
| 69 | Ordinary tax, 10% band | 1,302.78 (1,302.775 exactly) | 13,027.75 × 10% | worksheet `federal-ordinary-bracket-tax` | 0.005 |
| 70 | Ordinary tax, 12% band | 4,790.85 | (52,951.50 − 13,027.75) × 12% | same | 0.005 |
| 71 | Ordinary tax, 22% band | 6,679.31 (6,679.305764137949…) (†) | (83,311.980746 − 52,951.50) × 22%; the 24% bound of 111,051.0625 is not reached | same | 0.005 |
| 72 | Ordinary tax | 12,772.93 (12,772.930764137949…) (†) | 1,302.775 + 4,790.85 + 6,679.305764 | same | 0.005 |
| 73 | **LTCG stack** | 0% band: **empty**; 15%: **5,841.37**; 20%: none | The 15% breakpoint is 49,450 × 1.050625 = 51,953.40625. The gain stacks on 83,311.98 of ordinary taxable income, which is already above it, so every gain dollar is taxed at 15%. The 20% breakpoint, 573,115.9375, is far off. | worksheet `federal-ltcg-stacking`; `federalTax.ts#capitalGainsTaxStacked`; `indexFederalTaxPack` (breakpoints); `year2026.ts` l.66–67 | 0.005 |
| 74 | Capital-gains tax | 876.21 (876.205643862504…) (†) | 5,841.370959 × 15% | same | 0.005 |
| 75 | Federal regular tax | 13,649.14 (13,649.136408000453…) (†) | 12,772.930764 + 876.205644 | worksheet `tax-total-annual` | 0.005 |
| 76 | NIIT | 0 | Investment income is 5,841.37, but MAGI of 112,002 is under the **unindexed** 200,000 threshold. | `year2026.ts` l.72; `indexFederalTaxPack` doc | exact |
| 77 | **AMT screen**, **`amt`** | **0** | AMTI = TI + standard 19,068.84375 + senior 3,779.875729 = 112,002.071184. Exemption 90,100 × 1.050625 = 94,661.3125 (phase-out start 525,312.50, not reached); excess 17,340.758684. The preferential 5,841.370959 stacks inside the 0% band, since the top of the stack, 17,340.76, is below 51,953.41. The ordinary 11,499.387725 × 26% gives TMT 2,989.840809, below the regular tax of 13,649.14. | worksheet `federal-amt-screen`; `federalTax.ts` header step 7; `indexFederalTaxPack` (AMT figures) | exact |
| 78 | Florida state and local tax | 0 | FL `hasIncomeTax: false`; the stand-in state pack for 2028 is the 2026 pack | `params/state/index.ts` header; `params/state/data/year2026.ts` FL; 2026 document row 56, A6 | exact |
| 79 | **`tax`** | **13,649.14** (13,649.136408000453…) (†) | federal 13,649.136408 + 0 | `YearResult.tax` ("at the accepted funding fixed point") | 0.005 |
| 80 | `ltcgZeroHeadroom` | 0 | TI with no extra gain, 89,153.35, is already at or above 51,953.40625, so the field returns 0 before any bisection | worksheet `year-result-ltcg-zero-headroom` | exact |
| 81 | `rothConversion` | 0 | mode `none` | `YearResult.rothConversion` | exact |

### 4h. Cash flow, withdrawals, surplus

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 82 | **`netPortfolioNeed`** | **83,348.50** (83,348.504678000453…) (†) | max(0, 122,953.44827 + 13,649.136408 + 0 − 53,254.08) | worksheet `portfolio-need-annual` | 0.005 |
| 83 | Net RMD cash applied first | 60,894.73 | row 19 | domain rules §11 ("RMDs always first") | 0.005 |
| 84 | **Cash draw** = **`withdrawals.cash`** | **6,453.50** (6,453.495478085434…), **all of the cash** | min(cash 6,453.495478, need 22,453.772453) | row 40 | 0.005 |
| 85 | **Brokerage sale** = **`withdrawals.taxable`** | **16,000.28** (†) | row 47 | worksheet `withdrawals-by-category-annual` | 0.005 (†) |
| 86 | `withdrawals.traditional` | **76,654.11** | the gross RMD, QCD included; no need-based IRA draw | same; `YearResult.rmd` | 0.005 |
| 87 | `withdrawals.roth` / `.hsa` | 0 / 0 | | same | exact |
| 88 | **`withdrawals.total`** | **99,107.88** (99,107.879678000453…) (†) | 6,453.495478 + 16,000.276975 + 76,654.107225, which equals need 83,348.504678 + QCD 15,759.375 | worksheet `withdrawals-total-annual` | 0.005 (†) |
| 89 | Inflows = outflows | 136,602.584678… = 136,602.584678… (†) | Inflows: SS 53,254.08 + net RMD cash 60,894.732225 + cash 6,453.495478 + sale 16,000.276975. Outflows: spending 122,953.44827 + tax 13,649.136408. | identity at the root | — |
| 90 | **`surplusInvested`** | **0** | max(0, 114,148.812225 − 122,953.44827 − 0 − 13,649.136408 − 0) = max(0, −22,453.772453) | worksheet `surplus-invested-annual`; `YearResult.surplusInvested`; `annualFundingApplicationAndClosePhase.ts` l.1190 (draws are not inflows; 2026 document B2) | exact |
| 91 | `shortfall` / `requiredShortfall` / `targetShortfall` | 0 / 0 / 0 | the brokerage covers the rest | worksheet `spending-shortfall-annual` | exact |

### 4i. Year-end balances

Each account grows after the year's flows, at its full annual rate (2026 document §2h). The cash account is empty,
so it earns nothing.

| # | Figure | Value | Derivation | Contract source | Tol. |
|---|---|---|---|---|---|
| 92 | Cash pre-growth / **`balances['rmd-irmaa--cash']`** | 0 / **0.00** | 6,453.495478 − 6,453.495478; × 1.02 | worksheet `accounts-balance-per-account-annual`; `YearResult.balances` | 0.005 |
| 93 | IRA pre-growth | 1,809,036.93 (3,931,037,250/2,173 = 1,809,036.930510814542…) | 1,885,691.037736 − 76,654.107225 (the RMD, QCD included) | same | 0.005 |
| 94 | IRA growth | 90,451.85 (393,103,725/4,346 = 90,451.846525540727…) | × 5% | `annualPostSolveAccountGrowth.ts` | 0.005 |
| 95 | **`balances['rmd-irmaa--ira']`** | **1,899,488.78** (8,255,178,225/4,346 = 1,899,488.777036355269…) | × 1.05; this is also the 2029 RMD base | `YearResult.balances` | 0.005 |
| 96 | Brokerage pre-growth / growth | 424,999.72 (424,999.723025119496…) / 21,249.99 (21,249.986151255975…) (†) | 441,000 − 16,000.276975; × 5%. Basis after the sale: 269,841.093984. | same; `aggregateBasisSale` `remainingFairMarketValue` | 0.005 |
| 97 | **`balances['rmd-irmaa--brokerage']`** | **446,249.71** (446,249.709176375470…) (†) | 424,999.723025 × 1.05 | same | 0.005 (†) |
| 98 | Unassigned cash | 0 | a cash account exists | `YearResult.investableTotal` | exact |
| 99 | **`investableTotal`** | **2,345,738.49** (2,345,738.486212730740…) (†) | 0 + 1,899,488.777036 + 446,249.709176 | worksheet `accounts-investable-total-annual` | 0.005 (†) |
| 100 | **`netWorth`** | **2,345,738.49** (†) | investable only | worksheet `accounts-net-worth-annual` | 0.005 (†) |
| 101 | Other published zeros | `contributions`, `employerMatch`, `sepp`, `inheritedDistribution`, `hecmDraw`, `ladderValue`, `insuranceCashValue`, `deathBenefit`, `capitalLoss*` 0; `guardrailAction` `hold` | none in the plan | `YearResult` docs | exact |

### 4j. How the ledger reaches the root (not published; for the reader and the tolerance)

`annualFundingFixedPoint` seeds the root with the pre-tax gap (row 39) and iterates directly (`annualFundingFixedPoint.ts`
l.19, l.115–123, l.208):
1. Each evaluation plans the withdrawal for the candidate need, prices its tax, and returns `requiredNeed`.
2. It stops when |`requiredNeed` − candidate| ≤ 0.005, within `DEFAULT_DIRECT_ITERATION_LIMIT` = 8 evaluations and
   before any bisection.

The error shrinks each step by the factor in row 45 (0.0596):

| Eval | Candidate need | Cash | Sale P | Gain | Tax at candidate | Returned need | Residual |
|---|---|---|---|---|---|---|---|
| 1 | 8,804.636045 | 6,453.495478 | 2,351.140567 | 858.352905 | 12,835.907862 | 21,640.543907 | 12,835.907862 |
| 2 | 21,640.543907 | 6,453.495478 | 15,187.048429 | 5,544.477998 | 13,600.683477 | 22,405.319522 | 764.775615 |
| 3 | 22,405.319522 | 6,453.495478 | 15,951.824044 | 5,823.681794 | 13,646.249536 | 22,450.885581 | 45.566060 |
| 4 | 22,450.885581 | 6,453.495478 | 15,997.390103 | 5,840.317022 | 13,648.964405 | 22,453.600450 | 2.714869 |
| 5 | 22,453.600450 | 6,453.495478 | 16,000.104972 | 5,841.308164 | 13,649.126160 | 22,453.762205 | 0.161754 |
| 6 | 22,453.762205 | 6,453.495478 | 16,000.266727 | 5,841.367218 | 13,649.135797 | 22,453.771842 | 0.009637 |
| **7** | **22,453.771842** | 6,453.495478 | **16,000.276364** | **5,841.370736** | **13,649.136372** | 22,453.772417 | **0.000574 ≤ 0.005: accepted** |

The ledger accepts the seventh evaluation. Its candidate need is 0.000610590 **below** the exact root. The published
values at that evaluation, against the exact root:

| Figure | Published (evaluation 7) | Exact root |
|---|---|---|
| Sale | 16,000.276364290318 | 16,000.276974880504 |
| Gain | 5,841.370736169481 | 5,841.370959083359 |
| Tax | 13,649.136371620908 | 13,649.136408000453 |
| `netPortfolioNeed` | 83,348.504641620908 | 83,348.504678000453 |
| `withdrawals.total` | 99,107.879067410266 | 99,107.879678000453 |
| Brokerage close | 446,249.709817495166 | 446,249.709176375470 |
| `investableTotal` | 2,345,738.486853850435 | 2,345,738.486212730740 |

Every published value is within 0.00065 of the exact value. The evaluation count and a residual are published only in
ACA-active years (`YearAcaResult.convergence.iterations` and `.residualDollars`); the seed is never published. No test
should assert either.

### 4k. Tolerance note for the (†) rows

- **Against the exact root, 0.005 holds on every (†) row, with room to spare.** The largest gap between the ledger's
  accepted evaluation and the root is 0.00064, on the brokerage close and the investable total.
- **That margin comes from the iteration path** (seed, direct iteration, acceptance at evaluation 7). The path is
  documented only inside `annualFundingFixedPoint.ts`.
- **The published contract alone gives a looser bound.** `YearResult.tax` is "at the accepted funding fixed point",
  with a residual of at most 0.005. That bounds the candidate's distance from the root by
  0.005 / (1 − 782/13,125) = 0.005317:
  - on the rows linear in the sale (rows 47, 52, 85, 88): 0.0053;
  - times 1.05 on rows 97, 99 and 100: 0.0056;
  - on the gain, AGI, deductions and tax: under 0.0021.
- **Which tolerance to use:**
  - A test that must not depend on the iteration path uses **0.006** on rows 47, 52, 85, 88, 97, 99 and 100, and
    0.005 everywhere else.
  - A test content to rest on the path, as the 2026 table's tests do, uses 0.005 throughout.

---

## 5. What the sale does, in one place

Compared with the same year without a sale (tax T₀, row 43), selling 16,000.28 of brokerage:
- **Realized gain:** 5,841.37 = 16,000.28 × 23/63. The other 10,158.91 is basis, returned tax-free.
- **AGI and MAGI** rise by exactly the gain, from 106,160.70 to 112,002.07. 2028's MAGI is the 2030 IRMAA input.
- **Taxable Social Security** does not move. It was already at the 85% cap (row 57).
- **The senior deduction** loses 6% of the gain, 350.48, falling from 4,130.36 to 3,779.88 in its last year.
- **Taxable income** rises by 1.06 × the gain, 6,191.85. The extra 0.06 is ordinary income taxed at 22%; the gain
  itself is taxed at 15%. The 0% LTCG band is already filled by ordinary income.
- **Tax** rises by 953.31, which is 16.32% of the gain and 5.96% of the proceeds. The sale is 953.31 larger than it
  would be if it ignored its own tax.
- **IRMAA for 2028** is unaffected: it reads 2026's projected MAGI. The 2030 premium will read the 2028 figure,
  against a floor of about 120,316, a margin of about 8,314 before anything else changes.

---

## 6. Wrong readings a test should reject (2028, exact)

Each row changes only the rule named and re-solves the fixed point exactly. Where a reading applies to every
projected year, it is applied to 2027 as well, as a mis-implemented engine would. The last column gives the correct
values.

| Wrong reading | What it produces in 2028 | Correct |
|---|---|---|
| **Index an unindexed figure: the senior deduction** (6,000 and 75,000 × 1.025ⁿ) | senior 4,315.534195; tax 13,521.051628; sale 15,813.287195; gain 5,773.104849; cash drawn 6,512.400478 (2027 changes too); investable 2,345,934.825480 | senior 3,779.875729; tax 13,649.136408 |
| … the senior threshold only (75,000 × 1.025ⁿ) | senior 4,009.443643; tax 13,594.242931; sale 15,920.138498 | same |
| … the §86 thresholds (25,000 / 34,000 × 1.025ⁿ) | **no change**: the 85% cap binds either way (row 57). 2028's figures cannot tell these readings apart; testing §86 indexing needs a plan below the cap | — |
| **Do not index an indexed figure** (brackets, the standard deduction with its age-65 addition, the LTCG breakpoints and the AMT figures held at 2026 values) | standard deduction 18,150; tax 14,163.748890; sale 16,751.554957; gain 6,115.647048; cash drawn 6,216.829978; investable 2,344,949.644330 | 19,068.84375; 13,649.136408; 16,000.276975 |
| **Grow before withdrawing** (every year) | RMD 76,946.517946; cash drawn 7,600.958119; sale 14,618.390321; gain 5,778.849688; tax 13,707.123116; IRA close 1,910,582.040600; brokerage close 448,431.609678; investable 2,359,013.650278 | 76,654.107225; 6,453.495478; 16,000.276975; 13,649.136408; 1,899,488.777036; 446,249.709176; 2,345,738.486213 |
| … in 2028 only, from the correct openings | cash available 6,582.565388; sale 15,946.699732 at a gain ratio of 1 − 280,000/463,050 (gain 6,303.948571); tax 13,724.629074; IRA close 1,903,321.482398; brokerage close 447,103.300268 | as above |
| **Price 2028 IRMAA on 2027 instead of 2026** | `irmaaLookbackMagi` 102,088.806792, `…Year` 2027, source `projected`; tier still 0. **Premiums cannot tell these readings apart.** Neither can pricing on 2028's own MAGI (112,002.07 < 114,518.125) or keeping the plan fallback (0). Only the three lookback fields can. | 97,896.120755 / 2026 / `projected` |
| **Treat the whole sale as gain** | sale 17,981.555012; gain 17,981.555012; AGI and MAGI 124,142.255237; senior 3,051.464685; tax 15,630.414445; investable 2,343,658.144273 | sale 16,000.276975; gain 5,841.370959 |
| **Size the sale without its own tax** (need = seed + T₀, in one pass) | Sale 15,046.965234, which is 953.311741 short; gain 5,493.336514. That sale actually incurs 13,592.337186 of tax, against the 12,695.824667 it was sized for, so 896.512519 goes unfunded. That residual is far above 0.005, so the ledger would not accept it. | sale 16,000.276975; tax 13,649.136408 |
| Apply the pack's 2.8% COLA | Social Security 53,566.267392; taxable SS 45,531.327283; tax 13,687.280953; sale 15,601.873816 | 53,254.08; 45,265.968 |
| Part B at the general rate (202.90 × 12 × 1.050625) | Part B 2,558.06175; healthcare 7,232.76675; tax 13,634.790360; sale 15,759.494527 | 2,709.99327; 7,384.69827 |
| Compound the health factor multiplicatively (1.025 × 1.03 = 1.05575 a year) | Part B 2,713.847710; healthcare 7,395.201573; sale 16,016.842914 | 1.055 a year (additive) |
| Drop the senior deduction in 2028 (off by one on `lastApplicableYear`) | senior 0; tax 14,528.885821; sale 16,880.026388 | 3,779.875729; 13,649.136408 |
| RMD divisor for age 74 (25.5) in 2028 | RMD 73,948.668146; tax 13,149.661458; sale 18,206.241104; IRA close 1,902,329.488068 | 76,654.107225 at 24.6 |
| QCD not inflated (15,000 flat in every year) | QCD 15,000; tax 13,770.749014; cash drawn 6,746.796478; sale 15,069.213581 | 15,759.375 |
| IRMAA floor unindexed (109,000) | tier still 0; only `irmaaNextTierThreshold` shows it (109,000) | 114,518.125 |

---

## 7. Contracts I could not find or found ambiguous

Some items of the 2026 document carry over unchanged:
- **A1:** a full calendar year, with the entered balances read as the prior Dec 31 balances.
- **A2:** the PIA read in start-year dollars.
- **A4:** cash growth is untaxed, including 2027's 126.54 of cash growth.
- **B2:** need-based draws are not "cash inflows".
- **B3–B5:** unchanged.

The items below are new, or matter more, in 2027–2028.

**C1. The health factor is additive, and it is stated only in prose.** The schema comment is "Healthcare costs grow at
inflationPct + this" (`assumptionsSchema.healthcareExtraInflationPct`); the `simulate.ts` l.532 doc comment ("general
inflation + the healthcare premium") and the `spending-healthcare-annual` calculation record's variable `h`
("Cumulative healthcare inflation factor from the start year (general inflation plus the healthcare extra)") say the
same. None writes 1 + g + h. The code compounds `1 + r + healthExtra` at `simulate.ts` l.520. No worksheet exercises a multi-year health factor with both parts non-zero:
`spending-healthcare-annual` takes a factor of 1.10 as an input, and its evidence plan uses 0% general inflation.
Candidate readings:
- (a) (1 + 0.025 + 0.03)ⁿ (**used**);
- (b) ((1.025)(1.03))ⁿ.

Only (a) matches both the code and the comment. Reading (b) moves 2028 healthcare by 10.50 (§6).

**C2. This plan cannot tell "from the pack year" apart from "from the start year".** The Part B premium scales from
the pack year and the extras from the start year (`YearExpenses.healthcare` doc; calculation record
`spending-healthcare-annual`). Both years are 2026 here, so a test on this plan cannot catch a swap. The
`YearExpenses.healthcare` doc says the tier premium is "inflated from the pack year" without naming the rate; the
health rate comes from the `tax/medicare.ts` header and the `medicare-base-part-b-premium` record's `premiumScale`.

**C3. Only `annualFundingFixedPoint.ts` documents the fixed point's path.** The `YearResult` contract says only "at
the accepted funding fixed point". The seed (the pre-tax gap), the direct iteration, the 8-evaluation limit and the
fall-back to bisection are in the module's header and body. This is why §4k gives two tolerances. In this plan the
ledger accepts evaluation 7 and never bisects.

**C4. No contract says when in the year the sale happens, or at what price.** The phase order puts flows before
growth, and the planner prices the sale on the account's balance at planning time (`openingFairMarketValue:
state.balance`, `annualWithdrawalPlanning.ts` l.296). That is the Jan 1 value, 441,000; 2028's growth applies only
to what remains. Candidate readings:
- (a) sold at the opening value (**used**; the only reading the mechanics support);
- (b) sold mid-year or at year-end, after some 2028 growth. That would raise the FMV, lower the gain ratio and
  shrink the sale.

The page should say (a) plainly.

**C5. Every realized gain is long-term, by construction.** The model has no holding period. The
`applyCapitalLossCarryforward` doc says "no short-/long-term split", and `computeFederalTax` sends every gain to the
preferential stack. For Dana's long-held brokerage that is also the right answer, but the page should not imply that
the engine checks holding periods.

**C6. The basis-ratio rule lives in a function body.** `aggregateBasisSale`'s doc comment states no formula; it
says only "planning-dollar aggregate-basis sale math … does not round to cents". The pro-rata recovery is at
l.72–73. The supporting comments are `taxableAccountSchema.costBasis` ("single basis-ratio model in v1; no lots")
and domain rules §11. The 2026 review raised this as its item C6. It matters now because 2028 exercises the rule.

**C7. Five exact values sit on a half cent.** They are the QCD, 15,759.375; the IRMAA tier-1 floor and
`irmaaNextTierThreshold`, 114,518.125; the Medicare extras, 4,674.705; the 10% band tax, 1,302.775; and the QCD
per-donor cap, 116,619.375. Binary floating point computes every one a hair low: 15000 × 1.050625 gives
15,759.374999999998, 109000 × 1.050625 gives 114,518.12499999999, and so on (and `1.025 * 1.025` is the same double as
the literal `1.050625`, so a hand constant written either way carries the same low float). A cent formatter applied to
the engine's number therefore shows .37, .12, .70 and .77, while the exact values round half-up to .38, .13, .71 and .78. Tests compare within tolerance, so
both pass. The page should print the exact value (15,759.375) or its half-up rounding, not a formatter's output on
the float.

**C8. Cent-rounded components do not always sum to the rounded total** (the 2026 document's A7). In this derivation
it happens at:
- the 2027 investable total: 6,453.50 + 1,885,691.04 + 441,000.00 = 2,333,144.54, against 2,333,144.53;
- the 2027 need: 119,749.71 + 11,984.08 − 51,955.20 = 79,778.59, against 79,778.60;
- the 2028 ordinary tax: 1,302.78 + 4,790.85 + 6,679.31 = 12,772.94, against 12,772.93;
- the 2028 need: 122,953.45 + 13,649.14 − 53,254.08 = 83,348.51, against 83,348.50;
- the 2028 withdrawals total: 6,453.50 + 16,000.28 + 76,654.11 = 99,107.89, against 99,107.88;
- row 25: 114,518.13 − 97,896.12 = 16,622.01, against 16,622.00;
- row 52: 6,453.50 + 16,000.28 = 22,453.78, against 22,453.77;
- row 53: 13,649.14 − 12,695.82 = 953.32, against 953.31;
- rows 89–90: each side of the identity sums to 136,602.59 in rounded parts, against 136,602.58, and the surplus
  margin to 22,453.78, against 22,453.77;
- row 47's closed form: 8,804.64 + 12,695.82 − 6,453.50 = 15,046.96, against 15,046.97;
- B12's 22% band: 0.22 × (79,110.39 − 51,660) = 6,039.09, against 6,039.08.

In those derivations the page should either show exact values or say that the parts are rounded.

**C9. The 2028 IRMAA top-tier floor sits on a floating-point knife edge.** This does not affect this plan.
`irmaaTierThreshold` resumes the top row for 2028 at
`roundToNearestThousand(500,000 × inflFactorFrom(2026, 2027))`:
- In exact arithmetic the product is 512,500, which rounds half-up to 513,000.
- In floating point it is 512,499.99999999994, so `Math.round` gives 512,000.

The statute's (i)(5)(B) does not say which way a tie goes, and the engine's answer here depends on how 1.025 is
stored in binary. Dana is at tier 0 and `irmaaNextTierThreshold` reads tier 1, so no figure here depends on it. It
deserves one line on the rule record, or a fixture at a 2.5% inflation assumption.

**C10. The senior deduction still has no worksheet** (the 2026 document's A3). That it is not indexed, and that it
ends after 2028, rests on:
- the `indexFederalTaxPack` doc;
- the pack's `lastApplicableYear`;
- the `seniorDeductionAmount` guard;
- domain rules §1.

Rows 63–64 and the "last year" claim therefore rest on comment and data contracts, not on a reviewed worksheet.

**C11. The QCD request and the per-donor QCD cap grow from different base years.** The cap uses `limitGrowth`,
measured from the pack year. The request uses `inflFactor`, measured from the start year. The two coincide here. This
is the same kind of issue as C2; it is harmless for this plan, where the cap (116,619.375) is far from binding.

**C12. No contract says a stand-in pack's RMD table is used as published.** 2027 and 2028 use the 2026 pack's Uniform
Lifetime Table unchanged. That is correct: regulation fixes the table and nothing indexes it. The reading rests on
`packForYear` returning the 2026 pack, and on `indexFederalTaxPack` touching only the federal-tax and capital-gains
blocks.

---

## 8. Cross-check against the 2026 document's §4 estimate (after the derivation, not an input)

Every estimate in §4 of the 2026 document agrees with the exact figure to the precision it states.

| Figure | §4 estimate | Exact |
|---|---|---|
| RMD | ≈ 76,654 | 76,654.107225 |
| QCD | 15,759.38 | 15,759.375 |
| Social Security | ≈ 53,254.08 | 53,254.08 |
| Healthcare | ≈ 7,384.70 | 7,384.69827 |
| Spending | 115,568.75 | 115,568.75 |
| Cash draw | ≈ 6,453 | 6,453.495478 |
| Sale | ≈ 16,000 | 16,000.276975 |
| Gain | ≈ 5,841 | 5,841.370959 |
| AGI / MAGI | ≈ 112,002 | 112,002.071184 |
| Senior deduction | ≈ 3,780 | 3,779.875729 |
| Federal tax | ≈ 13,649 | 13,649.136408 |
| 2027 cash draw | about 21,852 | 21,851.711952 |
| 2027 cash left | roughly 6,450 | 6,453.495478 |
| 2027 MAGI | about 102,089 | 102,088.806792 |
