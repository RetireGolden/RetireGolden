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
