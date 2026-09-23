# Walkthrough reference: "Early retiree & the ACA cliff", year 2026 by hand

Independent hand derivation of the first projection year of the curated example `early-retiree-aca`
(`packages/planner-ui/src/planner/examples/buildEarlyRetireeAca.ts`), for the public walkthrough page and the test
that will hold the engine to it.

**Provenance.** Derived 2026-09-22 by Claude (Opus 5.5 subagent) against the repository checkout at `4fc7d7c7`
(branch `claude/ss-record-limit-wording`). That is two commits past `main` 119d3351. The two commits change only
Social Security spousal-benefit wording (`socialSecurity/currentSpouseBenefit.ts`, `rules/calculations/socialSecurity.ts`
and two coverage JSON files), and this plan reaches none of them. `git status` showed a clean working tree when I
read it, so every file cited is the committed version. I did not run the engine, run any test, or execute any
TypeScript or JavaScript. I did the arithmetic by hand and checked it with exact rational arithmetic (Python
`fractions`), not with engine code. I traced two bisections the same way. The rules come from the calculation
worksheets (`DOCS/calculations/**`), the engine's doc comments, the parameter pack, and
`DOCS/domain/domain-rules-reference/*`. In three places no contract says enough, and I read the function body: the
example's ACA-contract synthesis, the conversion bisection, and the fixed-point coordinator. The source column marks
those with "(body)". Disclosure: to confirm how examples are projected (start year and tax calculator), I read the
harness lines of `examples.golden.test.ts`. For this example that file holds only whole-run aggregates (ending
investable, lifetime tax, lifetime Roth) and a retune comment saying the old baseline "had its only actionable ACA
year above 400% FPL". No figure below comes from it. Section 4 uses the lifetime-Roth aggregate as a loose cross-check
only.

**Rounding convention.** The ACA contracts, tax, withdrawals and growth state no rounding step. The ledger carries
unrounded binary-floating-point dollars, and the worksheets for these families set the fixture tolerance at an
absolute $0.005 (`ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`, `projection/moneyTolerance.ts`). Each figure below is given
as its exact value and then rounded half-up to the cent for display. The one-person FPL is 15,650 = 50 × 313, so
every ACA-derived figure has a 313 in its denominator and does not terminate; those are given as fractions. **A test
should compare against the exact value with tolerance 0.005, not against the cent-rounded display.** Two figures are
sized by bisection "to $0.01" per their own contracts, `rothConversion` and `ltcgZeroHeadroom`. I traced both.
The conversion lands on exactly 10,500. The headroom lands at 37,049.996650218963623046875, which is 0.00335 below its
closed form. So a 0.005 comparison passes today, but the contract only promises $0.01 (section 3, A3).

---

## 1. Inputs, as built

The plan comes from `createExamplePlan` (in `buildContext.ts`). It calls `createEmptyPlan` with a fixed clock and
deterministic ids, then replaces `assumptions` and `strategies` with the example baselines merged with this builder's
overrides. `buildEarlyRetireeAca` then replaces `household`, `accounts`, `incomes` and `expenses`, and calls
`parseExamplePlan`.

**Where the ACA contract comes from.** Neither `createExamplePlan` nor the builder body writes `acaYears`.
`parseExamplePlan` does (`buildContext.ts` lines 75–154, body plus its doc comment). When `applyAcaCredit` is true,
`pre65MonthlyPremiumPerPerson` > 0 and `acaYears` is absent, it synthesizes one contract per year, from 2026 to the
end year, for every year with at least one covered month. Covered months are 12 under age 65, birth month − 1 in the
65 year, and 0 after that. Its doc comment says the SLCSP "equals the example's stated enrollment premium; both are
explicit example assumptions rather than Marketplace estimates". For Casey that gives contracts for **2026, 2027 and
2028 only**. In 2029 Casey reaches 65 with a January birth month, so 1 − 1 = 0 covered months and the year is skipped.
Without this helper, the plan would carry no contract. The engine would then fund the gross premium and report
`missing-year-contract` (domain rules §8; `annualHealthcareExpenses.ts` lines 292–294). The engine itself has **no
benchmark-premium rule**: it reads the SLCSP only from a contract.

### 1a. Projection call (how the year is run)

| Item | Value | Source |
|---|---|---|
| `SimulateOptions.startYear` | 2026 (`EXAMPLE_FIXED_YEAR`) | `buildContext.ts`; the harness passes `{ startYear: EXAMPLE_FIXED_YEAR, taxCalculator }` |
| Tax calculator | `combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 0, localPct: 0 }))` | example harness; `tax/federalTax.ts#combineTaxCalculators` |
| Market series | none (deterministic: plan assumptions every year) | `SimulateOptions.market` doc |
| Fixed "now" | `2026-06-29T12:00:00.000Z`. It only stamps `createdAtIso`/`updatedAtIso`; `simulatePlan` takes no date | `buildContext.ts#EXAMPLE_FIXED_NOW_ISO`; `projection/simulate.ts#SimulateOptions` |
| End year | 2056 = 1964 + 92 | `simulate.ts` (`endYear = horizonEndYear ?? max(dobYear + lifeAge)`) |
| `plan.exampleSourceId` | absent in the harness (set only by `loadExample.ts` when the app opens the example) | `loadExample.ts` line 34. It gates only the example-contract mismatch check, which passes in 2026 either way (row 44) |

### 1b. Plan facts

| Field | Value | Set by | Note |
|---|---|---|---|
| `name` | Early retiree & the ACA cliff | builder | |
| plan `id` / person `id` | `early-retiree-aca--seq-1` / `early-retiree-aca--p1` | `exampleIdFactory` / builder | the default `seq-0` person is replaced |
| `household.filingStatus` / `hasQualifyingDependent` | `single` / false | builder | |
| `household.state` / `stateMoves` / `capitalLossCarryforward` | `FL` / [] / 0 | builder | |
| Person | Casey, dob `1964-01-01`, sex `female`, retirementAge 58, longevity `{ planningAge: 92, source: 'manual' }` | builder | sex has no effect on a deterministic run |
| Cash `early-retiree-aca--cash` | balance 200,000; `annualReturnPct` 2; owner null; contribution 0 | builder | |
| Traditional `early-retiree-aca--ira` | kind `ira`; balance 450,000; `annualReturnPct` null (so 5); owner Casey; contribution 0; no nondeductible basis | builder | taxable fraction of a conversion = 1 |
| Roth `early-retiree-aca--roth` | kind `ira`; balance 120,000; `annualReturnPct` null (so 5); owner Casey; contribution 0 | builder | Casey's first Roth IRA, so it is the conversion destination |
| Income `early-retiree-aca--consulting` | `recurring`, "Consulting", 18,000/yr, 2026 to open-ended, `inflationAdjusted` true, `taxTreatment` `ordinary` | builder | modeled as ordinary income only: no self-employment tax (section 3, A7) |
| `expenses.baseAnnual` | 40,000 (today's dollars; excludes healthcare) | builder | `requiredAnnual` absent, so required = base |
| `expenses.phases` / `oneTimeGoals` / spending policy | [] / [] / absent | builder | |
| `expenses.healthcare` | `pre65MonthlyPremiumPerPerson` 1,000; `applyAcaCredit` true; `medicareExtrasMonthlyPerPerson` 0; no `ssa44`; `acaYears` synthesized (1c) | builder + `parseExamplePlan` | |
| `insurance`, `careEvents`, `scenarios`, etc. | [] | `createEmptyPlan` | |

### 1c. The 2026 ACA contract (as `parseExamplePlan` writes it)

| Field | Value |
|---|---|
| `year` / `fplRegion` | 2026 / `contiguous` (FL is neither AK nor HI) |
| `taxFamilyMembers` | `[{ personId: 'early-retiree-aca--p1', relationship: 'primary', requiredToFile: 'required', magi: 0 }]` |
| `coveredMembers` | `[{ personId: 'early-retiree-aca--p1', enrollmentPremiumByMonth: 12 × 1,000, slcspBenchmarkPremiumByMonth: 12 × 1,000 }]`. The monthly premium is 1,000 × (1 + (2.5 + 3)/100)^(2026 − 2026) = 1,000 |
| `taxExemptInterest` / `foreignExclusionAddback` | `{ state: 'notApplicable', amount: null }` each |
| `assertions` | coverageEligibility `supported`; form8814, specialAllocation, marriedFilingSeparatelyException and selfEmployedHealthInsuranceDeduction all `notApplicable`; otherMaterialFacts `none` |

The 2027 and 2028 contracts have the same shape, with premiums of 1,000 × 1.055 and 1,000 × 1.055².

### 1d. Assumptions (baseline `EXAMPLE_BASELINE_ASSUMPTIONS` merged with this builder's overrides)

| Assumption | Value | Origin |
|---|---|---|
| `inflationPct` | 2.5 | baseline |
| `healthcareExtraInflationPct` | **3** | override (baseline 2). Health inflation is **additive**: each year's factor is 1 + 0.025 + 0.03 = 1.055 (`simulate.ts` `cumHealthInfl`, "general inflation + the healthcare premium") |
| `defaultReturnPct` | **5** | override (baseline 6) |
| `ssCola` / `ssHaircut` | `matchInflation` / null | baseline; no Social Security in this plan |
| `stateEffectiveTaxPct` / `localIncomeTaxPct` | 0 / 0 | baseline |
| `recentAnnualMagi` | **50,000** | override (baseline 0). Its schema doc: "used for IRMAA's 2-year lookback in the first projection years". It is **not** an ACA input (rows 41, 2m) |
| `historicalAnnualMagiByYear` | absent | |
| `heirTaxRatePct` | **22** | override (baseline 25); estate metric only |
| `safeWithdrawalRatePct` | 4 | baseline; FI metric only |

### 1e. Strategies (baseline `EXAMPLE_BASELINE_STRATEGIES` merged with this builder's overrides)

| Strategy | Value | Origin |
|---|---|---|
| `withdrawalOrder` | `sequential`: cash, then taxable, then vested equity comp, then traditional, then Roth, then HSA | baseline; `withdrawalStrategySchema` doc; `annualWithdrawalPlanning.ts#SEQUENTIAL_ORDER` |
| `rothConversion` | `{ mode: 'fillToTarget', target: 'topOfBracket', targetValue: 10, startYear: 2026, endYear: 2030 }` | override. `targetValue` is the bracket **rate** ("Bracket rate (e.g. 24) when target=topOfBracket", `rothConversionStrategySchema` doc) |
| `qcdAnnual` / `retirementActions` | 0 / [] | baseline |
| `itemizedDeductions` / `taxableSafetyNetFloor` / `survivorReserveTarget` | absent (standard deduction; safety-net floor 0, `simulate.ts` line 854) | |

---

## 2. Year 2026 by hand

Order of the year (`projection/simulate.ts` header): ages, then income, then expenses (with the healthcare premium
entered at **gross**), then contributions. Then Roth conversions run "after RMDs". Then comes the fixed-point
tax/withdrawal iteration, which also prices the ACA credit. Then flows are applied, then growth, then the snapshot.
Domain rules §8: "Premium, tax, withdrawals, and ACA MAGI are solved together on the current-year ledger."

Every factor is 1 in 2026. General inflation is `inflFactorFrom(2026, 2026) = 1`, and health inflation is
`healthInflFactorFrom(2026, 2026) = 1`. The pack-year scale, the FPL scale and the conversion-sizing scale are all
`inflFactorFrom(pack.year 2026, 2026) = 1`. 2026 has its own published pack (`params/data/year2026.ts`), so it is not a
stand-in.

### 2a. Timeline and person

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 1 | Casey's `ageAttained` | **62** | 2026 − 1964 | `yearLedger.ts#PersonYearState.ageAttained` |
| 2 | `alive` / life age | true / 92 | 62 ≤ 92 | `PersonYearState.alive` doc |
| 3 | Full or partial year | **Full calendar year**: 12 months of spending, consulting and Marketplace coverage | `SimulateOptions` carries only `startYear`, never a date, and no year-row contract has a start-year proration term. The 2026-06-29 "now" does not reach the ledger. | `simulate.ts#SimulateOptions`; section 3, A1 |
| 4 | Filing status | `single` | household filing status | `YearResult.filingStatus` doc |
| 5 | People 65+ | **0** | 62 < 65. So there is no age-65 standard-deduction addition and no OBBBA senior deduction. | `federalTax.ts` header, step 3; worksheet `federal-standard-deduction-age-65` |
| 6 | Marketplace months / Medicare months | **12 / 0** | attained age < 65 gives 12 marketplace months; the two counts partition the year | `YearExpenses.healthcare` doc ("the year splits at the Medicare birth month into marketplace months and Medicare months"); `annualHealthcareExpenses.ts` lines 116–128 (body) |
| 7 | RMD | 0; first RMD year 2039 | birth year 1964 is ≥ 1960, so the start age is 75 | `params/index.ts#rmdStartAgeForBirthYear` |
| 8 | Wages | 0 | the plan has no wages stream (retirementAge 58 < 62 in any case) | `simulate.ts` header (wages paid while age < retirement age) |

### 2b. Income

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 9 | **`incomes.recurring`** | **18,000.00** | 18,000 × `inflFactorFrom(2026, 2026)` = 1. 2026 is inside the window 2026–open, and the household is alive. | worksheet `income-recurring-annual`; `otherIncomeStreams.ts` (`inflFactor` = `inflFactorFrom(startYear, year)`) |
| 10 | Ordinary income from it | 18,000 | `taxTreatment: 'ordinary'` routes the row to ordinary income. No self-employment or payroll tax is modeled: "the Plan has no pass-through or self-employment facts". | `recurringIncomeSchema`; `DOCS/features/taxes.md` lines 70–74; section 3, A7 |
| 11 | `socialSecurity` / `taxableYield` / `taxExemptInterest` | 0 / 0 / 0 | no Social Security stream; no taxable account, so no yield rows (they are taxable-account only); the cash account's growth is not income | worksheets `income-taxable-yield-annual`, `year-result-tax-exempt-interest`; `distributedTaxableYieldRows.ts` header; section 3, A8 |
| 12 | **`incomes.total`** | **18,000.00** | recurring only | worksheet `income-total-annual` |
| 13 | `realizedGains` | 0 | no taxable account, so nothing to sell | worksheet `tax-realized-gains-annual` |

### 2c. Roth conversion (fill to the top of the 10% bracket)

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 14 | Strategy active in 2026 | yes | `fillToTarget`, 2026 ∈ [2026, 2030], no named conversion action | `annualAggregateRothConversionTargetPlan.ts` lines 252–254 (body) |
| 15 | **What counts toward the bracket top** | ordinary income before the conversion = **18,000** | `incomeBeforeConversion` = ordinary income − pre-tax contributions + taxable RMD/SEPP/inherited − QCD offsets + retirement-action ordinary income. Here that is the consulting income alone. Pre-withdrawal capital gains (0), qualified dividends (0) and Social Security (0, for its taxable share) also enter. **Need-based withdrawals do not**: the conversion is sized before the withdrawal solve. | `ConversionSizingInput.ordinaryIncomeBase` doc ("Ordinary income before any conversion (wages − pre-tax contributions + RMD − QCD + pensions etc.)"); `annualAggregateRothConversionPhase.ts` (body) |
| 16 | Metric the conversion fills | **federal taxable income after the deduction** | `topOfBracket` "holds federal taxable income at the chosen bracket's upper bound". Taxable income = max(0, AGI − (max(standard, itemized) + senior)). | `YearResult.rothConversion` doc; `strategies/rothConversion.ts` header and `metricFor` |
| 17 | Deduction used in sizing | 16,100 | single standard deduction; nobody 65+; no itemized deductions; senior deduction 0; sizing scale 1 | `year2026.federalTax.standardDeduction.single` (line 40) |
| 18 | Taxable income before the conversion | 1,900 | 18,000 − 16,100 | |
| 19 | Ceiling (top of the 10% bracket) | **12,400** | the `lowerBound` of the bracket after the 10% one (12%), × indexing scale 1 | `rothConversion.ts#ceilingFor`; `year2026.federalTax.brackets.single` (lines 21–29) |
| 20 | **`rothConversion`** (exact rule) | **10,500.00** | 12,400 − (18,000 − 16,100). The contract's closed form: "without benefits the topOfBracket amount is the bracket bound − (ordinary income − deduction)". | `YearResult.rothConversion` doc; worksheet `roth-conversion-annual` |
| 21 | Bisection result (to $0.01) | **10,500 exactly** | Starting upper bound = max(12,400 − 1,900, 1,000) = 10,500. Its metric is 12,400, which is ≤ the ceiling, so the upper bound doubles to 21,000. The first midpoint is 10,500; its metric is not above the ceiling, so the lower bound becomes 10,500. Every later midpoint lies above 10,500 and only lowers the upper bound. After 22 halvings the upper bound is 10,500.005006790161, and the function returns the lower bound: 10,500. | `rothConversion.ts#sizeRothConversion` (body); section 3, A3 |
| 22 | Gross conversion | 10,500 | no nondeductible basis, so the taxable fraction is 1 and gross = taxable / 1 | `annualAggregateRothConversionTargetPlan.ts#grossAmountForTaxable` (body) |
| 23 | Safety-net trim | none | `taxableSafetyNetFloor` absent, so the floor is 0 and the trim is skipped | same, lines 299–303 (body) |
| 24 | **Does the ACA credit enter the sizing?** | **No** | `topOfBracket` reads only taxable income. The ACA metric enters sizing only for `target: 'acaCliff'`. The credit's MAGI dependence is priced afterwards, inside the fixed point (2f, 2h). | `rothConversion.ts#metricFor`; domain rules §8 ("A same-year conversion … can reduce or eliminate the modeled credit") |
| 25 | Execution | IRA −10,500; Roth +10,500 | Single owner, so the raw sized amount is used without a cent split. The conversion is taxable in full as ordinary income. It is not a withdrawal and never penalized. It opens a 2026 layer on the Roth's 5-year clock, which nothing in 2026 exercises. | `aggregateRothConversionOwnerAllocation.ts` (single-owner shortcut); domain rules §10; `simulate.ts` header ("conversion taxes … are never penalized") |

### 2d. Federal tax and Florida

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 26 | **Ordinary income** (tax input) | **28,500.00** | ordinary base = income before the conversion + the taxable conversion = 18,000 + 10,500. Need-based traditional withdrawals are 0. | `annualFundingApplicationAndClosePhase.ts` line 682 (body) |
| 27 | Taxable Social Security | 0 | no benefits | `federalTax.ts` header, step 1 |
| 28 | **AGI** | **28,500.00** | ordinary 28,500 + gains 0 + taxable SS 0; `agiBeforeFloor` = `agi` = 28,500 | `federalTax.ts` header, step 2 |
| 29 | Standard deduction | **16,100** | single; nobody 65+ | `year2026.federalTax.standardDeduction.single` (line 40) |
| 30 | Senior deduction | 0 | nobody 65+ | `federalTax.ts#seniorDeductionAmount` doc |
| 31 | **Taxable income** | **12,400.00** | 28,500 − 16,100. It sits exactly on the 12% band's lower bound. | `federalTax.ts` header, step 3 |
| 32 | Ordinary tax, 10% band / 12% band | 1,240.00 / 0 | 12,400 × 10%; (12,400 − 12,400) × 12% | worksheet `federal-ordinary-bracket-tax`; pack lines 21–29 |
| 33 | **Federal regular income tax** | **1,240.00** | The next dollar of ordinary income would be taxed at 12%. | same |
| 34 | LTCG tax / NIIT | 0 / 0 | no preferential or investment income | worksheet `federal-ltcg-stacking`; `year2026.niit` |
| 35 | **`amt`** | **0** | AMTI = TI 12,400 + standard deduction 16,100 = 28,500, which is under the 90,100 exemption | worksheet `federal-amt-screen`; `year2026.federalTax.amt` (lines 55–62) |
| 36 | Florida state and local tax | **0** | FL `hasIncomeTax: false`; the 0 override does not apply ("takes precedence when set above zero") | `params/state/data/year2026.ts` FL entry (lines 337–343); `tax/stateTax.ts` header |
| 37 | **`tax`** (composed) | **1,240.00** | federal 1,240 + state 0 + local 0. `YearResult` has no separate state field. | worksheet `tax-total-annual`; `YearResult.tax` doc; section 3, A9 |
| 38 | `ltcgZeroHeadroom` | **37,050.00** display; exact published value **37,049.996650218963623046875** | Closed form: 49,450 − 12,400 = 37,050. The bisection runs over [0, 49,450] in 23 halvings (step 49,450/2²³) and returns the lower bound, 0.00335 below 37,050. | worksheet `year-result-ltcg-zero-headroom`; `federalTax.ts#zeroRateLtcgHeadroom` (body); section 3, A3 |

### 2e. MAGI: which one is which

| # | Figure | Value | Rule | Contract source |
|---|---|---|---|---|
| 39 | **`magi`** (published) | **28,500.00** | max(0, ordinary realized 28,500 + realized gains 0 + qualified dividends 0 + taxable SS 0 + tax-exempt interest 0). "It is the IRMAA base two years later … and the ACA credit base in its own year." | `YearResult.magi` doc; worksheet `medicare-magi-composition`; `annualFundingApplicationAndClosePhase.ts` lines 1305–1331 (body) |
| 40 | **ACA household MAGI** (`aca.householdMagi`) | **28,500.00** | **Signed** AGI before the zero floor 28,500 + nontaxable SS max(0, 0 − 0) = 0 + tax-exempt interest 0 (contract `notApplicable`, and no plan-generated interest) + foreign-exclusion addback 0 (`notApplicable`) + MAGI of dependents required to file 0 (no dependents), then floored at 0. The primary's `magi: 0` on the contract is not added: "the return's primary/spouse income is already in federal AGI". | worksheet `aca-household-magi-composition`; `tax/aca.ts#buildAcaHouseholdMagi`; `acaYearContractSchema.taxFamilyMembers` doc; domain rules §8 |
| 41 | `irmaaLookbackMagi` / source / year | **50,000 / `planFallback` / 2024** | 2026 − 2 = 2024 is before the ledger, and `historicalAnnualMagiByYear` is absent, so the seed `recentAnnualMagi` is used. It is read **only** by IRMAA. Casey has no Medicare months, so it prices nothing. It is **not** the ACA base. | `YearResult.magi` doc (lookback fallback); `YearResult.irmaaLookbackMagi` doc; `simulate.ts#resolveMagiFor` (lines 867–878); worksheet `irmaa-lookback-selection` |
| 42 | Federal-detail `magi` (senior-deduction MAGI) | 28,500 | AGI + broad foreign addback 0; unused, because nobody is 65+ | `FederalTaxDetail.magi` doc |
| 43 | When the published MAGI and the ACA MAGI differ | not in this year | The ACA base adds untaxed Social Security, the foreign-exclusion addback and required-filer dependents' MAGI, and it starts from signed pre-floor AGI. The published `magi` excludes untaxed SS ("Untaxed Social Security and foreign income are not added back separately") and floors the ordinary-income term and the total, while realized gains stay signed. Casey has none of these, so rows 39, 40 and 42 agree. | `YearResult.magi` doc; `aca.ts#buildAcaHouseholdMagi` |

### 2f. The ACA premium tax credit

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 44 | Contract and support gates | one 2026 contract; **no initial support codes** | The 2026 pack is published (not a stand-in); no spending policy; exactly one contract; one primary and 0 spouses (single); every living person is in the tax family; covered members are in the tax family; 12 marketplace months with 0 Medicare months, so no overlap; tax-exempt and foreign items are `notApplicable`; SLCSP > 0 in every enrolled month and no benchmark-only month; every assertion is supported or ruled out. The example-mismatch check: the contract's 1,000 equals 1,000 × health factor 1, and in the harness the check is not even reached (`exampleSourceId` absent). | domain rules §8 (gate list); `annualHealthcareExpenses.ts` lines 200–229, 284–441 (body) |
| 45 | Tax-family size / region | 1 / contiguous | | `AcaResult` inputs; contract |
| 46 | **FPL** (`aca.federalPovertyLine`) | **15,650** | first person 15,650 + 5,500 × 0 additional people, × FPL scale 1. These are the HHS **2025** guidelines, which apply to 2026 coverage. | `year2026.federalPovertyLine.contiguous` (value on line 237; the comment "HHS 2025 poverty guidelines used for 2026 Marketplace coverage" on line 236); `aca.ts#acaFederalPovertyLine` |
| 47 | Months on the Marketplace / monthly enrollment premium | **12** (`coveredMonths` [1…12]) / 1,000.00 | 1,000 × health factor 1; the premium is per person, not age-rated | row 6; `healthcareConfigSchema.pre65MonthlyPremiumPerPerson` doc |
| 48 | **`aca.grossEnrollmentPremium`** | **12,000.00** | 12 × 1,000 | worksheet `aca-enrollment-and-applicable-slcsp-premium-annual` |
| 49 | **`aca.applicableSlcspPremium`** (benchmark) | **12,000.00** | 12 × 1,000; each month counts because its enrollment is > 0. Benchmark = enrollment by the example's assumption. | same; `parseExamplePlan` doc |
| 50 | **`aca.fplPct`** | **182.11%** (exact 57,000/313 = 182.108626198083067…) | 28,500 / 15,650 × 100 | worksheet `aca-expected-contribution` |
| 51 | Cliff and floor tests | below the cliff; above the floor | 182.11 ≤ 400 and ≥ 100. The cliff MAGI is 4 × 15,650 = 62,600, so Casey has **34,100** of headroom. The worksheet states that a household at exactly 400% of the poverty line keeps the credit and one strictly above loses it (paraphrase; see the worksheet for the wording). | worksheet `aca-400-percent-cliff`; `year2026.aca.maxFplPctForCredit` 400, `.minFplPctForCredit` 100 |
| 52 | Applicable percentage | **5.7376%** (exact 44,897/7,825 = 5.737635782747603…%) | Band 150–200% runs linearly from 4.19 to 6.60. t = (57,000/313 − 150)/50 = 201/313. Rate = 4.19 + (201/313) × 2.41. | `aca.ts#acaApplicablePct` ("Piecewise-linear applicable percentage with the statutory step at 133%"); `year2026.aca.applicablePctBreakpoints` (lines 250–259, Rev. Proc. 2025-25) |
| 53 | **Expected contribution** | **1,635.23** (exact 2,559,129/1,565 = 1,635.226198083067092…) | 5.737635…% × 28,500 | worksheet `aca-expected-contribution` ("household MAGI times the piecewise-linear applicable percentage") |
| 54 | Monthly credit | 863.73 (exact 5,406,957/6,260 = 863.731150159744408…) | min(enrollment 1,000, max(0, benchmark 1,000 − 1,635.226198/12)). The monthly share of the contribution is 136.268849840255591. | `aca.ts#acaEconomicPremiumByMonth` doc ("`min(enrollment, max(0, benchmark − contribution / 12))`, summed over the months with enrollment") |
| 55 | **`aca.modeledAllowablePtc`** (the credit) | **10,364.77** (exact 16,220,871/1,565 = 10,364.773801916932907…) | 12 × 863.731150…, which is 12,000 − 1,635.226198. The enrollment cap does not bind. | worksheet `aca-allowable-premium-tax-credit` |
| 56 | **`aca.economicNetPremium`** (net premium) | **1,635.23** (exact 2,559,129/1,565) | 12,000 − 10,364.773802. Because benchmark = enrollment, **the net premium equals the expected contribution** for any premium level at which the monthly share of the contribution (136.27) does not exceed the premium, with twelve covered months (see 2m). | worksheet `aca-economic-net-premium`; `YearAcaResult.economicNetPremium` = healthcare − healthcare excluding enrollment |
| 57 | Published evidence | `readiness: 'actionable'`, `supportCodes: ['actionable']`, `cliffState: 'below-cliff'`, `householdMagi` 28,500, `magiComponents` {federalAgi 28,500, all others 0}, `taxFamilySize` 1, `taxFamilyMembers` [{p1, primary, required, magi 0, includedMagi 0}], `aptcModeled: false`, `form8962ReconciliationSupported: false` | | `projection/internal/types/aca.ts#YearAcaResult`; `annualAcaResultPublication.ts` (body) |
| 58 | `aca.convergence` | `converged: true`, `grossPremiumFallback: false`, `maxIterations` 160, `residualDollars` 0 (at most 0.005) | Iterations: **5** by my trace of the coordinator (2 for the subsidized root, 2 for the gross root, and 1 re-pricing in the opposite-basin probe). **Do not pin this**: no contract states it (section 3, A10). | `annualFundingFixedPoint.ts` (body) |
| 59 | Does the credit feed the fixed point? | **Yes, one way.** | The credit lowers the year's healthcare, and so the cash the portfolio must supply (row 70). The need cannot feed back into the credit this year, because the need is drawn from cash, which adds nothing to MAGI. The conversion's effect on MAGI is fixed before the solve. | domain rules §8; `annualFundingCandidateEvaluation.ts` (body) |

### 2g. Healthcare and total spending

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 60 | `medicarePremiums` / `irmaaSurcharge` / `irmaaTier` / `irmaaNextTierThreshold` | 0 / 0 / 0 / **null** | no Medicare months; the next-tier threshold is null "without Medicare activity" | `YearResult` docs; `annualHealthcareExpenses.ts` lines 191–199 (body) |
| 61 | Medicare extras | 0 | 0 Medicare months × 0 per month | `YearExpenses.healthcare` doc |
| 62 | Healthcare before the solve | 12,000 | the gross enrollment premium ("with the credit on enter the gross enrollment premium") | `YearExpenses.healthcare` doc |
| 63 | **`expenses.healthcare`** (total healthcare) | **1,635.23** (exact 2,559,129/1,565) | healthcare excluding enrollment 0 + the economic net premium 1,635.23 ("publishes healthcare excluding enrollment + the economic net premium when it converges") | worksheet `spending-healthcare-annual`; `YearExpenses.healthcare` doc |
| 64 | **`expenses.baseSpending`** | **40,000.00** | 40,000 × 1; the required layer is 40,000 because `requiredAnnual` is absent | worksheet `spending-base-annual` |
| 65 | `oneTimeGoals`, `debtService`, `propertyCosts`, `insurancePremiums`, `careCost`, `ltcBenefit` | 0 each | none in the plan | `YearExpenses` docs |
| 66 | **`expenses.total`** (total spending) | **41,635.23** (exact 65,159,129/1,565 = 41,635.226198083067…) | 40,000 + 1,635.226198. The pre-credit total was 52,000, and "a later healthcare adjustment moves healthcare and this total together" (−10,364.77). | worksheet `spending-total-annual`; `YearExpenses.total` doc |
| 67 | `requiredSpending` / `targetSpending` / `intendedSpending` / ideal / excess / `guardrailFactor` | 41,635.23 / 41,635.23 / 41,635.23 / 0 / 0 / 1 | healthcare counts as required; the healthcare delta moves all three | `YearExpenses` docs; `annualFundingApplicationAndClosePhase.ts` lines 1094–1106 (body) |

### 2h. The fixed point and the cash flow

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 68 | Cash inflows before withdrawals | **18,000** | consulting only. **The conversion brings in no spendable cash**: it moves 10,500 from the IRA to the Roth and adds 10,500 of ordinary income. | `annualFundingApplicationAndClosePhase.ts` lines 709–718 (body; no conversion term) |
| 69 | Pre-credit need (the solve's first guess) | 34,000 | 52,000 − 18,000 | `annualFundingFixedPoint.ts` lines 208–211 (body) |
| 70 | First evaluation (need 34,000, drawn from cash) | required need = **24,875.23** | 52,000 + (1,635.23 − 12,000) + tax 1,240 + penalties 0 − 18,000. This differs from 34,000 by more than 0.005, so the solve iterates. | `AnnualFundingCandidateEvaluationResult.requiredNeed` (body) |
| 71 | Second evaluation (need 24,875.23) | same MAGI, tax and healthcare, so the same required need: **converged** | a cash draw adds no income | `annualFundingFixedPoint.ts#solveFundingRoot` (body) |
| 72 | Opposite-basin probe | no conflict | The gross-premium root is 52,000 + 1,240 − 18,000 = 35,240. Re-priced with the credit at that need, the required need is 24,875.23 ≠ 35,240, so the gross root is not self-consistent. The subsidized result stands. | domain rules §8 ("a conflicting subsidized/gross root … funds gross premium"); `annualFundingFixedPoint.ts` lines 280–338 (body) |
| 73 | **`netPortfolioNeed`** (gap after consulting) | **24,875.23** (exact 38,929,729/1,565 = 24,875.226198083067…) | max(0, 41,635.226198 + 1,240 + 0 − 18,000) | worksheet `portfolio-need-annual`; `YearResult.netPortfolioNeed` doc |
| 74 | How the conversion's tax is paid | from **cash**, inside the need | The whole 1,240 of tax rides the need, and 1,050 of it exists only because of the conversion (row 83). "Conversion taxes ride the normal withdrawal flow, so they come from cash/taxable first." Nothing is withheld from the IRA. | `simulate.ts` header; domain rules §10 |
| 75 | Which account funds the need | **Cash**: 24,875.23 of its 200,000 | sequential order, cash first; cash covers the whole need | `withdrawalStrategySchema` doc; `SEQUENTIAL_ORDER` |
| 76 | Cash identity | 42,875.23 = 42,875.23 | inflows 18,000 + 24,875.226198; outflows 41,635.226198 + 1,240 | identity |
| 77 | `surplusInvested` / `shortfall` / `requiredShortfall` / `targetShortfall` | 0 / 0 / 0 / 0 | fully funded; no surplus | worksheets `surplus-invested-annual`, `spending-shortfall-annual` |

### 2i. Withdrawals (published)

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 78 | `withdrawals.cash` | **24,875.23** (exact 38,929,729/1,565) | row 73 | worksheet `withdrawals-by-category-annual` |
| 79 | `withdrawals.taxable` / `.traditional` / `.roth` / `.hsa` | 0 / **0** / **0** / 0 | The conversion is **not** a withdrawal. The `YearWithdrawals.total` composition lists need-based draws, RMDs, SEPP, inherited forced distributions and action proceeds, and no conversion. | `YearWithdrawals.total` doc |
| 80 | **`withdrawals.total`** | **24,875.23** | cash only | worksheet `withdrawals-total-annual` |
| 81 | **`rothConversion`** | **10,500.00** | a separate field (row 20) | `YearResult.rothConversion` doc |

### 2j. What the conversion cost this year (a counterfactual; no published field)

The example's own copy says it teaches "why a Roth conversion can cost more than the tax bill". These rows show that
with the same contracts, holding everything else fixed.

| # | Figure | Value | Derivation |
|---|---|---|---|
| 82 | Without the conversion | tax 190; MAGI 18,000; fplPct 36,000/313 = 115.02%, **below the 133% step**, so the rate is 2.10%; contribution 378; credit 11,622; net premium 378; cash need 22,568 | TI 1,900 × 10%; 18,000 × 2.10%; 12,000 − 378 |
| 83 | The conversion's added cost | **2,307.23** (exact 3,610,809/1,565) = tax 1,050 + lost credit 1,257.23 | 24,875.226198 − 22,568. That is **21.97%** of the 10,500 converted, against a 10% bracket. |
| 84 | The 133% step | at MAGI 20,814.50 (133% × 15,650) the contribution jumps from 437.10 (2.10%) to 653.58 (3.14%) | Rev. Proc. 2025-25 step, `year2026.aca` comment |
| 85 | Marginal ACA cost at MAGI 28,500 | 14.515% of each extra MAGI dollar (exact 56,791/391,250) | d(M × rate(M))/dM = rate/100 + M × 2.41/(50 × 15,650). The last converted dollar cost 10% + 14.52% = 24.52%; the next one would cost 12% + 14.52% = 26.52%. |

### 2k. Year-end balances

**Growth timing.** Growth is applied at year end, on the post-flow balance. The conversion (IRA out, Roth in) and the
cash draw happen first, then each account grows by its full annual rate. Sources: the `simulate.ts` header ("apply
flows → property events → growth → snapshot"); the `annualPostSolveAccountGrowth.ts` header ("the closing pre-growth
balance states"); the `YearResult.balances` doc ("after flows and growth"). Rates: cash 2% (its own
`annualReturnPct`); IRA and Roth 5% (`annualReturnPct` null, so `defaultReturnPct` 5, per the
`accountBase.annualReturnPct` doc).

| # | Figure | Value | Derivation | Contract source |
|---|---|---|---|---|
| 86 | Cash, pre-growth / growth | 175,124.77 (exact 274,070,271/1,565) / 3,502.50 (3,502.495476038…) | 200,000 − 24,875.226198; × 2% | worksheet `accounts-balance-per-account-annual` |
| 87 | **`balances['early-retiree-aca--cash']`** | **178,627.27** (exact 13,977,583,821/78,250 = 178,627.269277955271…) | × 1.02 | `YearResult.balances` doc |
| 88 | IRA, pre-growth / growth | 439,500 / 21,975 | 450,000 − 10,500 conversion | same |
| 89 | **`balances['early-retiree-aca--ira']`** | **461,475.00** | 439,500 × 1.05 | same |
| 90 | Roth, pre-growth / growth | 130,500 / 6,525 | 120,000 + 10,500 conversion | same |
| 91 | **`balances['early-retiree-aca--roth']`** | **137,025.00** | 130,500 × 1.05 | same |
| 92 | Unassigned cash | 0 | | `YearResult.investableTotal` doc |
| 93 | **`investableTotal`** | **777,127.27** (exact 60,810,208,821/78,250 = 777,127.269277955271…) | 178,627.269278 + 461,475 + 137,025. The rounded parts sum exactly: 178,627.27 + 461,475.00 + 137,025.00 = 777,127.27. | worksheet `accounts-investable-total-annual` |
| 94 | `netWorth` | 777,127.27 | no property, debt, insurance, ladder or HECM | worksheet `accounts-net-worth-annual` |
| 95 | Other published zeros | `rmd`, `qcd`, `sepp`, `inheritedDistribution`, `contributions`, `employerMatch`, `hecmDraw`, `ladderValue`, `insuranceCashValue`, `deathBenefit`, `capitalLoss*` all 0; `guardrailAction` `hold` | none in the plan | `YearResult` docs |

### 2l. Penalties

| # | Figure | Value | Rule | Contract source |
|---|---|---|---|---|
| 96 | **`penalties`** | **0** | The early-withdrawal rule: 10% on **taxable need-based traditional withdrawals** while attained age < 60, the engine's annual proxy for 59½. Casey reached 59½ on 2023-07-01, and the proxy clears from 2024; she is 62 in 2026. She takes no need-based traditional withdrawal anyway. **The conversion itself is never penalized** at any age. There is no Roth withdrawal, so §408A(d)(3)(F) recapture does not arise. There is no HSA, and no RMD before 2039. | `simulate.ts` header ("10% traditional pre-59½ (≈ age < 60)"; "never penalized"); worksheet `tax-penalties-annual`; domain rules §10 |

### 2m. Wrong readings a test should reject (all exact, from the same inputs)

| Wrong reading | What it produces | Correct |
|---|---|---|
| Price the credit on `recentAnnualMagi` 50,000, or on "prior-year MAGI" (the `simulate.ts` header's former wording, corrected in the change that ships this walkthrough; for 2026 that resolves to the same 50,000 seed) | fplPct 319.49; rate 9.96%; contribution 4,980; credit **7,020**; healthcare 4,980; need 28,220 | current-year MAGI 28,500; credit 10,364.773802; need 24,875.226198 |
| Size the conversion without the standard deduction (fill AGI to 12,400) | 12,400 − 18,000 < 0, so conversion **0**; MAGI 18,000; rate 2.10%; credit 11,622; tax 190; need 22,568 | conversion 10,500 |
| Read `targetValue: 10` as "fill through the 12% bracket" (the next bracket's top) | conversion 48,500; AGI 66,500; fplPct 424.92, **over the cliff**; credit **0**; healthcare 12,000; tax 5,800; need 39,800. This is the example's intended demo of a one-bracket raise, not its baseline. | 10,500; credit 10,364.77 |
| Size to the ACA cliff instead of the bracket (`acaCliff`) | conversion 44,600; MAGI 62,600 (exactly 400%, `at-cliff`); tax 5,332; contribution 6,234.96; credit 5,765.04; need 33,566.96 | `topOfBracket` sizing ignores the ACA |
| Use the band's starting rate (4.19%) or ending rate (6.60%) without interpolating | contribution 1,194.15 or 1,881.00; credit 10,805.85 or 10,119.00 | rate 5.737636%; contribution 1,635.226198 |
| Apply the credit as a reduction of `tax` (a refundable credit on the return) rather than of healthcare | `tax` −9,124.77 (or floored to 0); healthcare 12,000 | `tax` 1,240; healthcare 1,635.226198 |
| Treat the conversion as spendable cash, or count it in `withdrawals` | cash draw 14,375.23; or `withdrawals.traditional` 10,500 and total 35,375.23 | cash 24,875.226198; traditional 0; total 24,875.226198 |
| Pay the conversion's tax by withholding from the IRA | IRA year-end 460,173.00; cash draw 23,635.23 | IRA 461,475; tax from cash |
| Charge the 10% early-withdrawal penalty on the conversion | `penalties` 1,050 | 0 |
| Keep the gross premium (the credit ignored, or what the engine does when `acaYears` is absent) | healthcare 12,000; need 35,240; cash year-end 168,055.20 | healthcare 1,635.23; cash 178,627.27 |
| Get the premium level wrong (for example, inflate the start year by 1.055) | gross 12,660; credit 11,024.77; **healthcare still 1,635.23**. Because benchmark = enrollment, `expenses.healthcare` cannot catch a premium-level error; only `aca.grossEnrollmentPremium` and `aca.modeledAllowablePtc` can. | gross 12,000; credit 10,364.77 |
| Grow before withdrawing (beginning-of-year growth) | cash 179,124.77; IRA 462,000; Roth 136,500 | 178,627.27; 461,475; 137,025 |
| Pro-rate 2026 to the half year after the fixed "now" | roughly half the spending, consulting and premium | full year |

---

## 3. Contracts I could not find or found ambiguous

Each item says what the engine's contracts support, what the alternatives are, and which reading this document uses.
None of them changes a 2026 figure under the engine's own contracts.

**A1. The start year is a full year, and the entered balances are January 1 balances.** This is the same finding as
the sibling derivation. No worksheet says it in words. It rests on `SimulateOptions` taking only `startYear`, on no
year-row contract carrying a proration term, and on `DOCS/architecture.md` ("from the current year"). The example's
"now" is 2026-06-29. Candidate readings: (a) full-year 2026 on the entered balances (**used**); (b) the half year
remaining. The page should state (a) out loud.

**A2. Current-year MAGI, not prior-year.** The `simulate.ts` header (line 41) said, when this was derived, that the
ACA credit is priced "vs prior-year MAGI"; the change that ships this walkthrough corrects it to "the year's own
household MAGI". Every other source already said current year: domain rules §8 ("current-year ACA household MAGI";
"solved together on the current-year ledger"), the `YearResult.magi` doc ("the ACA credit base in its own year"), the
`aca-household-magi-composition` worksheet, and the evaluator, which prices the quote from the candidate's own AGI.
The `recentAnnualMagi` schema doc names IRMAA only. Candidate readings: (a) current-year MAGI 28,500, credit
10,364.77 (**used**); (b) prior-year MAGI, which resolves to the 50,000 seed in 2026 and gives a credit of 7,020. The
header line was stale and is now corrected. The `recentAnnualMagi` 50,000 in this plan still looks like an ACA input
when it is not; its schema doc names IRMAA only.

**A3. Bisection-sized figures versus worksheet tolerances.** The `YearResult.rothConversion` doc says "by bisection
(to $0.01)", but the `roth-conversion-annual` worksheet asserts tolerance $0.005. Likewise, `ltcgZeroHeadroom` is "by
bisection to $0.01", but `year-result-ltcg-zero-headroom` asserts the closed form at $0.005. Both functions return the
bisection's **lower** bound, which can sit up to $0.01 below the closed form.
- In 2026 the conversion lands exactly on 10,500. With no benefits and a slope-1 metric, the first midpoint after
  doubling is the exact root. That holds whenever the root is at least 1,000 and floating point reproduces the root
  exactly.
- The headroom lands 0.00335 below 37,050, inside 0.005 by luck of the grid.
- In later years it can go either way. In 2029 the pre-conversion taxable income is negative (section 4), so the
  shortcut does not apply. There the conversion is only guaranteed to be within $0.01 below 13,514.97734375.

Recommendation: tests use 0.01 on these two fields (or pin the traced value), and the two worksheets say "within
$0.01 below".

**A4. The benchmark premium is an example assumption, not an engine rule.** The engine computes no SLCSP. It reads
one from `acaYears` or, lacking a contract, funds the gross premium (`missing-year-contract`). The contract here comes
from `parseExamplePlan`, a planner-ui helper, and it sets SLCSP = enrollment = the flat per-person
`pre65MonthlyPremiumPerPerson`, which is not age-rated. Two consequences for the page:
- The net premium always equals the expected contribution (row 56), so the page is really showing
  "contribution = 5.74% of MAGI". It should say that the benchmark was set equal to the premium by assumption.
- In the app (`exampleSourceId` set), editing the premium so that it no longer matches the synthesized contract
  trips `example-contract-input-mismatch` and falls back to the gross premium. A user who "tries a different premium"
  sees the credit vanish for a reason unrelated to the cliff.

The standard UI "does not yet author `acaYears`" (domain rules §8), so a user-built copy of this plan would show no
credit at all.

**A5. Only 2026 is an actionable ACA year.** 2027 and 2028 have contracts, but no published pack. A stand-in year
"reports `tax-year-parameters-unsupported`, exposes no inflation-scaled FPL as actionable evidence, and funds gross
premium" (domain rules §8; `annualHealthcareExpenses.ts` lines 285–287). So the credit exists in exactly one year of
this example. The golden-test retune comment ("its only actionable ACA year") says the same. The public copy is
looser than the mechanics in two places:
- `lookFor` says "A positive premium credit in the current-year ACA ledger", which is right, but only for 2026.
- The learn article says the conversions are "sized to stay below the subsidy cliff". The mechanism is `topOfBracket`,
  not `acaCliff`: the sizing reads only the bracket, and the builder comment says the 10% target was chosen so the
  baseline stays under the cliff (filling the 12% bracket would cross it). The copy is right about the intent and
  loose about the mechanism; the conversion lands 34,100 below the cliff because of the chosen target.

The page should say both plainly.

**A6. Medicare start for someone born on the 1st.** The `YearExpenses.healthcare` doc splits the year "at the
Medicare birth month". Only an in-body comment (`annualHealthcareExpenses.ts` lines 120–121) says "the prior-month
eligibility rule for people born on the first is not modeled". Casey is born on January 1, so the engine gives 2029
0 marketplace months and 12 Medicare months, and gives 2028 12 marketplace months. Under the real rule, Casey attains
65 on December 31, 2028 and Medicare starts December 1, 2028. Candidate readings: (a) the engine's rule, Medicare from
January 2029 (**used for section 4**); (b) the statutory one, with 11 marketplace months and 1 Medicare month in 2028.
This does not touch 2026.

**A7. "Consulting" is ordinary income with no self-employment facts.** The plan has no way to say that income is
self-employment income (`DOCS/features/taxes.md`: "the Plan has no pass-through or self-employment facts"). So there
is no SE tax, no half-SE-tax deduction and no §162(l) deduction. The synthesized contract also asserts
`selfEmployedHealthInsuranceDeduction: 'notApplicable'`. A real consultant with 18,000 of net earnings would owe SE tax
and would take the half-SE-tax deduction, which lowers AGI and so ACA MAGI. The §162(l) and PTC interaction is also
real and circular. Candidate readings: (a) as modeled (**used**); (b) as SE income. The page should call it "ordinary
income; payroll and self-employment tax not modeled".

**A8. Cash-account growth is untaxed.** This is the same finding as the sibling's A4, verified again:
`distributedTaxableYieldRows.ts` produces yield only for `taxable` accounts (line 91), and a cash account has no yield
fields. So the 3,502.50 of cash growth is not income and not ACA MAGI. Under the other reading (1099-INT interest),
MAGI would rise by about 3,502.50. That would add about 508 of lost credit (at 14.5%) plus 12% tax, and it would be
circular with the cash draw.

**A9. How Florida's zero is recorded.** This is the same finding as the sibling's A6. `YearResult` has no state
field, so the zero exists only inside `tax` (1,240). Prefer asserting `tax` = 1,240 and a direct state-calculator call
on `acceptedTaxInput` returning 0.

**A10. `aca.convergence.iterations` has no contract.** The publication passes the coordinator's whole evaluation
count, which includes the opposite-basin probe. My trace gives 5 (row 58). Neither `YearAcaResult` nor any worksheet
defines what is counted, so a test should assert `converged: true` and `grossPremiumFallback: false`, not the count.

**A11. Growth timing with a conversion.** The Roth grows on 130,500 and the IRA on 439,500 because the conversion is a
pre-growth flow. That rests on the phase comments, not on a worksheet with a non-zero return. This is the sibling's A5
again, and rows 89 and 91 are its test.

**Revision 1 (2026-09-22, after the independent check, which approved every figure).** Five wording corrections
from the check: row 43 (the published MAGI floors the ordinary term and the total, not each part), row 46 (the
poverty-line comment sits on the line above the value), row 51 (the cliff rule is paraphrased, not quoted), row 56
(the net-premium identity holds for any premium at which the monthly contribution share does not exceed the premium,
with twelve covered months), and A5 (the 10% target was chosen to stay under the cliff; the copy is right about the
intent and loose about the mechanism). No figure changed. Revision 2 (2026-09-23, pull-request review of #732): A2
and the first wrong reading now say the header was corrected in this change rather than that it is still stale. No
figure changed.

---

## 4. Suggested later year: **2027** first, **2029** second

**The brief's premise about 2029 does not hold for this plan.** Casey does not turn 65 mid-year. Born January 1,
1964, Casey attains 65 in 2029 with birth month 1. The engine gives 1 − 1 = 0 marketplace months and 12 Medicare
months: there is no split year. `parseExamplePlan` writes no 2029 contract, and `YearResult.aca` is absent ("Present
only in years with a credit-enabled Marketplace premium"). 2029 is not a numeric knife-edge inside the engine; every
threshold is far away. It does sit on the boundary described in A6: the real Medicare start would be December 2028.

**2027 is the better second year for this example**, because it shows what happens to the example's headline
mechanism, and nothing in it is a knife-edge.
1. **The credit disappears, and not because of the cliff.** 2027 has no published pack. The year reports
   `readiness: 'nonActionable'`, `supportCodes: ['tax-year-parameters-unsupported']` and `cliffState: 'unsupported'`.
   `householdMagi`, `federalPovertyLine`, `fplPct` and `modeledAllowablePtc` are all null, and
   `convergence.grossPremiumFallback` is true. The year funds the **gross** premium, 12 × 1,000 × 1.055 = 12,660.00,
   and carries the warning "Some Marketplace years use gross enrollment premium because required ACA reconciliation
   facts are missing or unsupported." A reader who expects about 10,984 of credit (the 2026 arithmetic indexed by
   1.025) needs this year explained.
2. **Stand-in indexing.** Brackets and the standard deduction are carried forward by 1.025. Consulting becomes
   18,450, the deduction 16,502.50 and the bracket top 12,710, so the conversion is 10,762.50 (to $0.01) and the tax
   1,271.00.
3. **The IRMAA lookback still reads the seed** (2025, `planFallback`, 50,000), with no Medicare to price.

**2029 is a good third year** for Medicare and the deduction mechanics:
- Healthcare drops from about 13,356.30 gross in 2028 to Part B alone: 202.90 × 12 × 1.055³ = 2,859.04.
- IRMAA reads **2027's projected MAGI** (about 29,212.50, source `projected`) against a tier-1 floor of
  109,000 × 1.025³ = 117,381.08, so the tier is 0.
- The age-65 standard-deduction addition enlarges the conversion by 2,050 × 1.025³ = 2,207.63.
- The OBBBA senior deduction has already expired (its last year is 2028), so Casey never gets it.
- The conversion is sized from a negative pre-conversion taxable income, which exercises the bisection's $0.01
  tolerance (A3).
- The page must say that the engine starts Medicare in January 2029, where the real rule starts it in December 2028.

**Rough figures.** These come from my own forward application of the same contracts. They are an estimate to orient
the next derivation, not a derivation, and a test must not pin them from this note.
- **2027:** conversion ≈ 10,762.50; AGI/MAGI ≈ 29,212.50; TI 12,710.00; tax ≈ 1,271.00; healthcare 12,660.00
  (gross, non-actionable); spending 41,000.00; need ≈ 36,481.00; year-end cash ≈ 144,989.19, IRA ≈ 473,248.13,
  Roth ≈ 155,176.88.
- **2028:** conversion ≈ 11,031.56; healthcare 13,356.30 (gross, non-actionable); `irmaaLookbackMagi` = 2026's
  published 28,500 (source `projected`). This is the first year that row 39 is re-read.
- **2029:** consulting 19,384.03; deduction (16,100 + 2,050) × 1.076890625 = 19,545.56; conversion ≈ 13,514.98
  (up to $0.01 below 13,514.97734375); AGI ≈ 32,899.01; TI ≈ 13,353.44; tax ≈ 1,335.34; healthcare 2,859.04;
  spending 43,075.63; need ≈ 27,885.98.

**Loose whole-run cross-check (not evidence for any 2026 figure other than the conversion).** Summing my five
conversions gives 10,500 + 10,762.50 + 11,031.5625 + 13,514.97734375 + 13,852.85177734375 = 59,661.89162109375. The
example's published lifetime Roth total is 59,661.87. The 0.0216 gap fits four bisection-sized years each landing up
to $0.01 low, with 2026 landing exactly. It supports three readings together: the conversion is sized on taxable
income after the standard deduction; the age-65 addition applies from 2029; and no senior deduction applies.
