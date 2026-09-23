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

---

# Part II: year 2027 by hand

Independent hand derivation of the second projection year of the curated example `early-retiree-aca`
(`packages/planner-ui/src/planner/examples/buildEarlyRetireeAca.ts`), for the public walkthrough page and the test
that holds the engine to it. It continues part I above (year 2026, approved in
`DOCS/walkthroughs/REVIEW-2026-09-22.md`), whose section 4 recommends 2027 as the second year. Section numbers below
are part II's own; "the 2026 document" and "part I" both mean the sections above.

**Provenance.** Derived 2026-09-22 by Claude (Opus 5.5 subagent) against the committed tree at `e814bd02` (the
content of RetireGolden #732 as merged; the three files that differ at engine main `faa68edc` are not cited here).
I did not run the engine, run any test, or execute any TypeScript or JavaScript, and I modified no repository file.
I did the arithmetic by hand and checked it with exact rationals (Python `fractions`). I replayed the two bisections
(`sizeRothConversion`, `zeroRateLtcgHeadroom`), the year-2026 float chain and the fixed-point coordinator in plain
IEEE-754 doubles (Python floats), written from the loop text. That replay is my own arithmetic, not engine code. The
rules come from the calculation worksheets (`DOCS/calculations/**`), the calculation records
(`packages/engine/src/rules/calculations/*.ts`), the engine's doc comments, the parameter pack, and
`DOCS/domain/domain-rules-reference/*`. Where no contract says enough I read the function body; the source column
marks those "(body)". The 2027 openings are the approved 2026 closing balances (rows 87, 89 and 91 of the 2026 table).

**Rounding, tolerance, and the one finding that changes the test.** As in 2026, no contract on this path states a
rounding step. The ledger carries binary64 dollars, and the default fixture tolerance is an absolute $0.005
(`ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`, `projection/moneyTolerance.ts` line 11). Each figure is given as its exact
value (a rational where it does not terminate) and rounded half-up to the cent for display.

The 2026 recipe does **not** carry to 2027. That recipe is closed-form hand values, $0.005 everywhere, and $0.01
one-sided below for the two bisection-sized fields. The problem is that the conversion does not land on 10,762.50.
The indexed ceiling 12,400 × 1.025 evaluates in binary64 to 12,710 − 2⁻³⁹, one unit in the last place below 12,710.
The metric at the exact root, however, rounds to exactly 12,710.0, so the root itself tests "over the ceiling". The
bisection therefore never doubles its starting bound, and it returns 10,762.494868040083, **0.00513 below** the
closed form (Appendix B1). Every figure that is affine in the conversion inherits that error bar, scaled by its slope:

| Figure | Closed form | Traced engine landing | Gap | Passes $0.005? |
|---|---|---|---|---|
| `rothConversion` | 10,762.50 | 10,762.494868040083 | −0.005132 | yes, under the contract's one-sided $0.01 |
| `magi`; `aca.magiComponents.federalAgi` | 29,212.50 | 29,212.494868040085 | −0.005132 | **no** |
| `advisoryFederalTax.detail.taxableIncome` | 12,710.00 | 12,709.994868040085 | −0.005132 | **no** |
| `balances[ira]` | 473,248.125 | 473,248.1303885579 | +0.005389 | **no** |
| `balances[roth]` | 155,176.875 | 155,176.8696114421 | −0.005389 | **no** |
| `ltcgZeroHeadroom` | 37,976.25 | 37,976.25260874628 | **+0.002609** | yes two-sided; **fails a one-sided `bound: 'below'`** |
| `tax`, `netPortfolioNeed`, `withdrawals.cash`, `withdrawals.total` | 1,271.00; 36,481.00 | 1,270.99948680; 36,480.99948680 | −0.000513 | yes |
| `balances[cash]`, `investableTotal`, `netWorth` | 144,989.19; 773,414.19 | 144,989.19518697; 773,414.19518697 | +0.000523 | yes |

The headroom lands **above** its closed form because the taxable income it subtracts from is itself 0.00513 low; its
own bisection then pulls it back down by 0.00252. Section 3 gives the per-row tolerance that follows from the
contracts' own error bars, and section 5, B1, states the gap in the contracts. The displayed cents also differ in six
rows (section 6).

---

**Revision 1 (2026-09-23).** Revised after the independent check (`REVIEW-2026-09-22.md`, the "year 2027" section
for this example), which approved every figure: two citations corrected as its §3 lists (the indexing-scale rule's
lines; the order of the two fragments quoted from the `rothConversion` doc), and the single-owner clause of the
allocation module added beside that doc, since a literal reading of "exact cents" would quantize a single owner's
conversion and move four rows outside their bands. No figure changed.

## 1. What carries over, and every indexing rule applied

The inputs are exactly those of the 2026 document, section 1. The plan is built by `createExamplePlan`,
`buildEarlyRetireeAca` and `parseExamplePlan`, with start year 2026. The walkthrough harness calls
`projectPlan(plan, { startYear: 2026 })`, which calls `simulatePlan` with `taxCalculatorFor(plan)` =
`combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator({ overridePct: 0, localPct: 0 }))`
(`packages/planner-ui/src/projection.ts`, `planTaxCalculator.ts`). There is no market series, and `exampleSourceId`
is absent. The 2027 openings (2026 closing, approved):

| Account | Opening 2027 | Exact | Source |
|---|---|---|---|
| Cash `early-retiree-aca--cash` | 178,627.27 | 13,977,583,821/78,250 = 178,627.269277955271… | 2026 table row 87 |
| Traditional IRA `early-retiree-aca--ira` | 461,475.00 | 461,475 | 2026 row 89 |
| Roth IRA `early-retiree-aca--roth` | 137,025.00 | 137,025 | 2026 row 91 |

My binary64 replay of 2026 reproduces all three to within 1e-9 (178,627.26927795526; 461,475.0; 137,025.0).

### 1a. Indexing rules applied in 2027

| # | Figure | Rule applied in 2027 | Factor | Source |
|---|---|---|---|---|
| I1 | Which pack prices 2027 | `packForYear(2027)`: no 2027 pack is published, so the latest (2026) pack stands in, with `isStandIn: true` | n/a | `params/index.ts` header ("Future years resolve to the latest published pack with `isStandIn: true`") and lines 17, 48–53 |
| I2 | General inflation factor | `inflFactorFrom(2026, 2027)` = cum[1]/cum[0] = 1 × (1 + 0.025) = **1.025** (binary64 1.0249999999999999111…) | 1.025 | `simulate.ts` lines 515–531 (body). Published as `YearResult.inflationScale` ("Exact cumulative general-inflation factor used by this simulation year"), set from `inflFactor` (`annualFundingApplicationAndClosePhase.ts` line 2102, body) |
| I3 | Consulting income | general inflation **from the projection start year**: 18,000 × `inflFactorFrom(2026, 2027)` = **18,450** | 1.025 | worksheet `income-recurring-annual` ("multiplying by the supplied cumulative general-inflation factor only when `inflationAdjusted` is true"); `otherIncomeStreams.ts` (`inflFactor` doc: "`inflFactorFrom(startYear, year)`"; amount = `annualAmount × inflFactor`, body) |
| I4 | Base spending | 40,000 × `lifestyleScale` = 40,000 × (1.025 × phase 1 × survivor 1) = **41,000** | 1.025 | `simulate.ts` header ("base spending … inflate at the general rate"); worksheet `spending-base-annual`; `annualLifestyleLayers.ts` lines 70–78 (body) |
| I5 | Federal indexing scale | `limitScale(pack, isStandIn, 2027)` = `indexingScaleFor(2026, 2027, inflFactorFrom)` = `inflFactorFrom(2026, 2027)` = **1.025**. A year with its own pack gets exactly 1 | 1.025 | `params/indexingScale.ts` lines 15–17 (the header's rule: "at or below the latest pack year the scale is exactly 1, and above it the scale is the cumulative inflation factor from the pack year") and 49–63 (`indexingScaleFor`, whose line 62 returns `year <= latestPackYear ? 1 : inflationPath(packYear, year)`); `simulate.ts` lines 542–543 |
| I6 | Rate-bracket lower bounds | × 1.025. The 12% bracket (the top of the 10% band) starts at 12,400 × 1.025 = **12,710** (binary64 12,710 − 2⁻³⁹) | 1.025 | `indexFederalTaxPack` doc ("rate-bracket lower bounds -- IRC 1(j)(3)(B)"), `params/index.ts` lines 55–134; domain rules §1, "Indexing in projected years"; `federalTax.ts` header; record `roth-conversion-annual` ("the NEXT bracket's lowerBound, indexed to the projected year", `rules/calculations/roth.ts` line 47); `rothConversion.ts` header ("the federal rate-bracket bounds all index at general inflation beyond the published pack") |
| I7 | Standard deduction (single) | × 1.025: 16,100 × 1.025 = **16,502.50** (binary64 exactly 16,502.5) | 1.025 | same `indexFederalTaxPack` doc ("basic standard deduction -- IRC 63(c)(7)(B)(ii)"); domain rules §1 |
| I8 | 15% capital-gain breakpoint (single) | × 1.025: 49,450 × 1.025 = **50,686.25** (binary64 50,686.24999999999) | 1.025 | same doc ("15% and 20% capital-gain breakpoints -- IRC 1(j)(5)(C)"); domain rules §1 |
| I9 | AMT exemption (single) | × 1.025: 90,100 × 1.025 = **92,352.50** | 1.025 | same doc ("AMT exemption and its phase-out threshold -- IRC 55(d)(4)(B)") |
| I10 | Left flat (no indexing provision) | the §86 tiers, the NIIT threshold, the §1211(b) offset, and the senior deduction with its MAGI threshold. None reaches this plan in 2027: no Social Security, no investment income, nobody 65 | 1 | `indexFederalTaxPack` doc ("Figures deliberately left alone"); domain rules §1 |
| I11 | Health inflation factor | **additive**: 1 + 0.025 + 0.03 = **1.055**, from the start year | 1.055 | `simulate.ts` lines 516–520, 532–534 (`cumHealthInfl`, "general inflation + the healthcare premium"); `YearExpenses.healthcare` doc ("the marketplace premium use[s] the health inflation factor from the start year") |
| I12 | 2027 Marketplace premium | The synthesized contract carries 1,000 × (1 + (2.5 + 3)/100)^(2027 − 2026) = **1,055** a month, for enrollment and SLCSP alike. The gross premium is read from the contract: 12 × 1,055 = **12,660** | 1.055 | `buildContext.ts#parseExamplePlan` lines 93–95 and 118–137 (body; doc: "The SLCSP equals the example's stated enrollment premium"); `YearAcaResult.grossEnrollmentPremium` doc; `annualHealthcareExpenses.ts` lines 231–240, 264–277 (body). Both routes give exactly 1,055.0 in binary64: `1000 × Math.pow(1 + 0.055, 1)` and `1000 × ((1 + 0.025) + 0.03)` |
| I13 | Poverty line and ACA schedule | **Not indexed and not published.** A stand-in year "exposes no inflation-scaled FPL as actionable evidence". The engine never prices the credit, so its would-be pricing scale (`pricingInflationScale` = `inflFactorFrom(2026, 2027)`) is never applied | none | domain rules §8 ("Only years with sourced tax-year parameters can be actionable; a stand-in future pack reports `tax-year-parameters-unsupported`, exposes no inflation-scaled FPL as actionable evidence, and funds gross premium"); `annualAcaResultPublication.ts` lines 181–191 (body: `!input.isStandIn`) |
| I14 | Florida | the 2026 state pack stands in, with no marker; FL has `hasIncomeTax: false` | n/a | `params/state/index.ts` header ("the latest pack for future years … no supported-year guard and no validity marker"); `params/state/data/year2026.ts` lines 337–343 |
| I15 | IRMAA thresholds | not reached: no Medicare months | n/a | `annualHealthcareExpenses.ts` lines 155–199 (body) |
| I16 | Growth | cash 2% (its own `annualReturnPct`); IRA and Roth 5% (`defaultReturnPct`). Applied at year end to post-flow balances | 1.02 / 1.05 | as in 2026 section 2k; `annualPostSolveAccountGrowth.ts` header and lines 128–139 (body) |

---

## 2. Year 2027 by hand

The year runs in the same order as 2026 (`simulate.ts` header): ages, income, expenses (healthcare entered at gross),
RMDs, the Roth conversion, and the fixed-point tax/withdrawal iteration, which would price the ACA credit if the year
were actionable. Then come flows, growth and the snapshot.

### 2a. Timeline, person, and the pack

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 1 | Casey's `ageAttained` | **63** | 2027 − 1964 | `PersonYearState.ageAttained` | exact |
| 2 | `alive` / life age | true / 92 | 63 ≤ 92 | `PersonYearState.alive` | exact |
| 3 | Full calendar year | yes | the second projection year; nothing prorates it | 2026 document A1 | n/a |
| 4 | `filingStatus` | `single` | household | `YearResult.filingStatus` | exact |
| 5 | People 65+ | 0 | 63 < 65: no age-65 addition, no senior deduction | `federalTax.ts` header, step 3 | exact |
| 6 | Marketplace / Medicare months | **12 / 0** | attained age < 65 | `YearExpenses.healthcare` doc; `annualHealthcareExpenses.ts` lines 116–128 (body) | exact |
| 7 | `rmd` | 0 (first RMD year 2039) | the 1964 cohort starts at 75 | `params/index.ts#rmdStartAgeForBirthYear` | exact |
| 8 | Wages | 0 | no wage stream | | exact |
| 9 | Pack pricing 2027 | the **2026** pack, `isStandIn: true`. Published as `advisoryFederalTax.detail.usesStandInPack` = **true** | I1 | `FederalTaxDetail.usesStandInPack` doc ("True when this year's figures use a stand-in parameter pack"); `YearResult.advisoryFederalTax` doc ("`simulatePlan` always publishes it") | exact |
| 10 | `inflationScale` | **1.025** | I2 | `YearResult.inflationScale` doc | 1e-12 (a factor, not dollars) |
| 11 | Health inflation factor | 1.055 | I11 | `simulate.ts` lines 516–534 | not published |

### 2b. Income

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 12 | **`incomes.recurring`** | **18,450.00** | 18,000 × 1.025 (binary64 exactly 18,450.0) | I3 | 0.005 |
| 13 | Ordinary income from it | 18,450 | `taxTreatment: 'ordinary'`; no self-employment tax is modeled (2026 A7) | `recurringIncomeSchema`; `DOCS/features/taxes.md` | not published |
| 14 | `socialSecurity` / `taxableYield` / `taxExemptInterest` | 0 / 0 / 0 | as 2026 row 11 | | exact |
| 15 | **`incomes.total`** | **18,450.00** | recurring only | worksheet `income-total-annual` | 0.005 |
| 16 | `realizedGains` | 0 | no taxable account | worksheet `tax-realized-gains-annual` | exact |

### 2c. Roth conversion (fill to the top of the 10% bracket, indexed)

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 17 | Strategy active | yes | `fillToTarget`, 2027 ∈ [2026, 2030], no named conversion action | `annualAggregateRothConversionTargetPlan.ts` lines 252–254 (body) | |
| 18 | What counts toward the bracket top | **18,450** | `incomeBeforeConversion` is the consulting income alone. Need-based withdrawals cannot enter, because the conversion is sized before the withdrawal solve | `ConversionSizingInput.ordinaryIncomeBase` doc; `annualAggregateRothConversionPhase.ts` lines 310–325 (body) | not published |
| 19 | Metric | federal taxable income after the deduction | `metricFor('topOfBracket')` returns `detail.taxableIncome` | `YearResult.rothConversion` doc; `rothConversion.ts` line 98 | |
| 20 | Sizing scale | **1.025** | `inflationScale: inflFactorFrom(pack.year, year)` = `inflFactorFrom(2026, 2027)` | `annualAggregateRothConversionPhase.ts` line 494 (body); `ConversionSizingInput.inflationScale` doc ("Scale applied to … the indexed federal tax figures for years beyond the pack") | |
| 21 | Deduction used in sizing | **16,502.50** | 16,100 × 1.025 (I7); nobody 65+; no itemized deductions; senior deduction 0 | `standardDeduction(indexFederalTaxPack(pack, 1.025), 'single', 0)`, reached through `computeFederalTax` line 512 | published at row 32 |
| 22 | Taxable income before the conversion | **1,947.50** | 18,450 − 16,502.50 | | not published |
| 23 | Ceiling (top of the 10% bracket) | **12,710** (binary64 **12,709.999999999998** = 12,710 − 2⁻³⁹) | 12,400 × 1.025: the next bracket's `lowerBound` in the indexed pack (I6) | `rothConversion.ts#ceilingFor` lines 117–124 ("the bracket bound as the tax engine will apply it in `input.year`") | not published |
| 24 | **`rothConversion`** (exact rule) | **10,762.50** (exact 21,525/2) | 12,710 − (18,450 − 16,502.50) | `YearResult.rothConversion` doc, result.ts 245–248 ("A fill-to-target strategy sizes ONE household amount by bisection (to $0.01, the lower bound) as the largest that keeps its metric at or under the ceiling: topOfBracket holds federal taxable income at the bracket's upper bound"); `aggregateRothConversionOwnerAllocation.ts` 374–381 (one owner's slice is the raw sized amount, not quantized to cents, although the doc's "exact cents" reads as if it were); record `roth-conversion-annual` | **one-sided: (10,762.49, 10,762.50]** |
| 25 | Bisection landing (traced) | **10,762.494868040083** = 5,916,744,125,644,799/2³⁹. That is **0.005131959917 below** 10,762.50, and it displays as **10,762.49** | The loop starts with `hi` = max(12,709.999999999998 − 1,947.5, 1,000) = 10,762.499999999998. For `metricAt(hi)`, the sum 18,450 + 10,762.499999999998 is a round-half-to-even tie and rounds to 29,212.5, so the metric is 29,212.5 − 16,502.5 = 12,710.0, which is **above** the ceiling. The doubling loop never runs. 21 halvings of [0, hi] follow, and every midpoint tests at or under the ceiling, so `lo` ends at hi × (1 − 2⁻²¹). **It does not land on 10,762.50.** | `rothConversion.ts#sizeRothConversion` lines 173–186 (body); Appendix B1 | |
| 26 | Gross conversion | equals the taxable amount | No nondeductible basis, so the taxable fraction is 1. One owner, so the raw sized amount is used with no cent split | `grossAmountForTaxable` (TargetPlan lines 161–184, body); `aggregateRothConversionOwnerAllocation.ts` lines 374–388 ("A household with one convertible owner has nothing to split, and its slice is the sized amount itself") | |
| 27 | Safety-net trim | none | the floor is 0 | TargetPlan lines 299–303 (body) | |
| 28 | Does the ACA enter sizing? | **No** | `topOfBracket` reads only taxable income. In 2027 there is no credit to price anyway | `rothConversion.ts#metricFor` | |
| 29 | Execution | IRA −10,762.50; Roth +10,762.50 | a pre-growth flow; not a withdrawal, and never penalized | 2026 rows 25 and 79 | |

### 2d. Federal tax and Florida (indexed stand-in figures)

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 30 | Ordinary income (tax input) | **29,212.50** (exact 58,425/2); traced 29,212.494868040085 | 18,450 + 10,762.50 | `annualFundingApplicationAndClosePhase.ts` line 682 (body). The tax input carries `inflationScale: limitGrowth` = 1.025 (line 965, body) | one-sided 0.01 below |
| 31 | AGI (= `agiBeforeFloor`) | **29,212.50** | ordinary income + 0 gains + 0 taxable Social Security | `federalTax.ts` header, step 2 | one-sided 0.01 below |
| 32 | Standard deduction | **16,502.50**; published as `advisoryFederalTax.detail.deduction` | 16,100 × 1.025 (I7) | `indexFederalTaxPack` doc; `computeFederalTax` line 512 | 0.005 |
| 33 | Senior deduction | 0 | nobody 65+ | `seniorDeductionAmount` | exact |
| 34 | **Taxable income** | **12,710.00**; published as `advisoryFederalTax.detail.taxableIncome`; traced 12,709.994868040085 (displays 12,709.99) | 29,212.50 − 16,502.50. It sits exactly on the indexed 12% lower bound | `federalTax.ts` header, step 3 | one-sided 0.01 below |
| 35 | 10% band / 12% band | 1,271.00 / 0 | 12,710 × 10%. Nothing lies above the bound (the landing is below it) | worksheet `federal-ordinary-bracket-tax`; `bracketTax` (body) | |
| 36 | Federal regular income tax | **1,271.00**; traced 1,270.9994868040085 | | same | 0.005 |
| 37 | LTCG tax / NIIT | 0 / 0 | no preferential or investment income | worksheet `federal-ltcg-stacking` | exact |
| 38 | **`amt`** | **0** | AMTI = TI 12,710 + the disallowed standard deduction 16,502.50 = 29,212.50, which is under the 92,352.50 exemption (I9) | worksheet `federal-amt-screen` | exact |
| 39 | Florida state and local tax | **0** | FL `hasIncomeTax: false` (I14) | `tax/stateTax.ts` header | exact |
| 40 | **`tax`** | **1,271.00**; traced 1,270.9994868040085 | federal 1,271 + state 0 | worksheet `tax-total-annual`; `YearResult.tax` doc | 0.005 |
| 41 | **`ltcgZeroHeadroom`** | closed form **37,976.25** (exact 151,905/4); traced **37,976.25260874628** = 5,219,416,415,334,399/2³⁷, **0.002609 above** the closed form | The closed form is the indexed breakpoint 50,686.25 (I8) − TI 12,710. The engine's TI is 12,709.994868 (row 34), so its own root is 37,976.255132. The bisection over [0, 50,686.24999999999] runs 23 halvings (final width 0.006042) and returns the lower bound, 0.002523 under that root | `YearResult.ltcgZeroHeadroom` doc; record `year-result-ltcg-zero-headroom` (`rules/calculations/cashFlowAndSummary.ts` line 1779: "bisection to $0.01, so the published figure sits at or just under the exact root"); `federalTax.ts#zeroRateLtcgHeadroom` lines 285–321 (body); the advisory input at FundingClose lines 1337–1355, with `inflationScale: limitGrowth` (body) | **two-sided 0.01**, not `below` (section 3) |

### 2e. MAGI: which one is which

| # | Figure | Value | Rule | Contract source | Tolerance |
|---|---|---|---|---|---|
| 42 | **`magi`** (published) | **29,212.50**; traced 29,212.494868040085 (displays 29,212.49) | max(0, ordinary realized 29,212.50 + 0 + 0 + 0 + 0) | `YearResult.magi` doc; worksheet `medicare-magi-composition` | one-sided 0.01 below |
| 43 | ACA household MAGI, as computed | 29,212.50 (the probe) | The candidate evaluation still builds the MAGI probe, because the year is ACA-active and has a contract: signed AGI 29,212.50 + 0 + 0 + 0 + 0 | `annualFundingCandidateEvaluation.ts` lines 366–400 (body); worksheet `aca-household-magi-composition` | not published as `householdMagi` (row 52) |
| 44 | `aca.magiComponents.federalAgi` | **29,212.50**; traced 29,212.494868040085 | Published from the probe even in a non-actionable year. The other four components are 0 | `annualAcaResultPublication.ts` lines 212–221 (body); `YearAcaResult.magiComponents` (no doc comment) | one-sided 0.01 below |
| 45 | **`irmaaLookbackMagi` / source / year** | **50,000 / `planFallback` / 2025** | 2027 − 2 = 2025 is before the ledger and `historicalAnnualMagiByYear` is absent, so the seed `recentAnnualMagi` answers. Casey has no Medicare months, so it prices nothing. It is not an ACA input | `YearResult.irmaaLookbackMagi`, `…Source` and `…Year` docs; `simulate.ts#resolveMagiFor` lines 867–878; worksheet and record `irmaa-lookback-selection` | exact |
| 46 | Federal-detail `magi` (senior-deduction MAGI) | 29,212.50 | AGI + 0; unused, because nobody is 65 | `FederalTaxDetail.magi` doc | not asserted |

### 2f. The ACA year: contract present, credit not priced

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 47 | The 2027 contract | one contract: `year` 2027, `fplRegion` contiguous, tax family [p1, primary, required, `magi` 0], covered member p1 with enrollment **12 × 1,055** and SLCSP **12 × 1,055**, both addbacks `notApplicable`, every assertion supported or ruled out | I12. Casey is 63, so all 12 months are covered | `parseExamplePlan` lines 103–150 (body) | |
| 48 | **The gate** | the initial support codes are **['tax-year-parameters-unsupported']** and nothing else | The year is ACA-active (credit on, gross 12,660 > 0) and `isStandIn`, which pushes the code. Every other gate passes, as in 2026: no spending policy; one contract; one primary and 0 spouses (single); no omitted living person; unique ids; 12 marketplace months with no enrolled month at or past month 12, so no Medicare overlap; the primary is modeled, alive and `required`; no dependents; tax-exempt and foreign items `notApplicable`; SLCSP > 0 in every enrolled month; no benchmark-only month; no example mismatch (`exampleSourceId` is absent, and 1,055.0 = 1,055.0 in any case); all six assertions pass | `annualHealthcareExpenses.ts` line 269 and **lines 284–287** (body); domain rules §8 | |
| 49 | **Pricing refused** | no quote | The candidate evaluation drops the two informational tax-exempt codes, then prices only when no code is left (`blockingAcaCodes.length === 0 && acaMagiProbe.magi !== null && !request.forceGrossAca`). The list holds `tax-year-parameters-unsupported`, so `acaEconomicPremiumByMonth` is never called, `acaQuote` stays null, and candidate healthcare stays at healthcare excluding enrollment (0) + gross (12,660) | `annualFundingCandidateEvaluation.ts` lines 363–364 and **401–409** (body) | |
| 50 | **`aca.readiness`** | **`nonActionable`** | actionable needs no blocking code **and** a non-null quote | `annualAcaResultPublication.ts` lines 114–121 and 205 (body); domain rules §8 | exact |
| 51 | **`aca.supportCodes`** | **['tax-year-parameters-unsupported']** | the evaluation's codes. `fixed-point-nonconvergent` is not added, because the funding root converged (row 77). `conflicting-cliff-fixed-points` is not added, because no basin probe ran (row 78) | publication lines 101–108 and 206–208 (body) | exact |
| 52 | **`aca.householdMagi`** | **null** | published only when the year is actionable | `YearAcaResult.householdMagi` doc ("null when material facts are unsupported"); publication lines 209–211 (body) | null |
| 53 | `aca.magiComponents` | {federalAgi **29,212.50**, nontaxableSocialSecurity 0, taxExemptInterest 0, foreignExclusionAddback 0, requiredFilerDependentMagi 0} | row 44 | publication lines 212–221 (body) | as row 44 |
| 54 | `aca.fplRegion` / `taxFamilySize` / `taxFamilyMembers` | `contiguous` / **1** / [{p1, primary, required, magi 0, includedMagi 0}] | from the contract | publication lines 135–142 and 222–226 (body) | exact |
| 55 | **`aca.federalPovertyLine`** | **null** | The contract is present, but the year is a stand-in, so no inflation-scaled line is exposed | domain rules §8 ("exposes no inflation-scaled FPL as actionable evidence"); publication lines 181–191 (body: `!input.isStandIn`) | null |
| 56 | **`aca.fplPct`** | **null** | taken from the priced quote, and there is none | publication line 192 (body) | null |
| 57 | **`aca.cliffState`** | **`unsupported`** | the year is not actionable. It is **not** `above-cliff`: no cliff test is run | publication lines 193–202 (body) | exact |
| 58 | `aca.coveredMembers` | [{p1, `coveredMonths` [1…12], `grossEnrollmentPremium` 12,660, `applicableSlcspPremium` 12,660}] | contract present, no mismatch | publication lines 143–158 (body) | 0.005 on the dollars |
| 59 | **`aca.grossEnrollmentPremium`** | **12,660.00** | 12 × 1,055 (I12) | `YearAcaResult.grossEnrollmentPremium` doc; worksheet `aca-enrollment-and-applicable-slcsp-premium-annual` | 0.005 |
| 60 | **`aca.applicableSlcspPremium`** | **12,660.00** | 12 × 1,055. Each month counts because its enrollment is > 0. The contract is present, so the field is not null | `YearAcaResult.applicableSlcspPremium` doc ("null without an ACA contract or when the example contract's inputs mismatch") | 0.005 |
| 61 | **`aca.modeledAllowablePtc`** (the credit) | **null** | no quote | publication line 236 (body); `YearAcaResult.modeledAllowablePtc` doc | null |
| 62 | **`aca.economicNetPremium`** | **12,660.00**, equal to the gross premium | published as `healthcare − healthcareExcludingAcaEnrollment` = 12,660 − 0 | publication lines 237–238 (body). No doc comment; the 2026 review's C13 says "On a gross fallback the field shows the gross premium" | 0.005 |
| 63 | `aca.aptcModeled` / `form8962ReconciliationSupported` | false / false | constants | `YearAcaResult` | exact |
| 64 | **`aca.convergence`** | **`grossPremiumFallback: true`**; `converged: false`; `maxIterations` 160; `residualDollars` 0; `iterations` 2 by my trace (**do not pin**) | `grossPremiumFallback` = `!actionable`. `converged` = `actionable && converged && !fixedPointFailed`, so it is false **although the funding solve converged** (row 77). Residual = \|36,481 − (36,481 + 0)\| = 0 | publication lines 242–253 (body); `ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS` 160; section 5, B3 | fallback exact; residual ≤ 0.005 |
| 65 | Run-level warning | "Some Marketplace years use gross enrollment premium because required ACA reconciliation facts are missing or unsupported." | pushed for every non-actionable ACA year. It lives on `ProjectionResult.warnings`, not on the year row | publication lines 255–259 (body) | |
| 66 | Does the ACA feed the 2027 fixed point? | **No** | Healthcare is fixed at gross, and neither MAGI nor the cash draw can move it | row 49 | |

### 2g. Healthcare and total spending

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 67 | `medicarePremiums` / `irmaaSurcharge` / `irmaaTier` / `irmaaNextTierThreshold` | 0 / 0 / 0 / **null** | no Medicare months | `YearResult` docs | exact |
| 68 | Healthcare before the solve | 12,660 | the gross enrollment premium | `YearExpenses.healthcare` doc | not published |
| 69 | **`expenses.healthcare`** | **12,660.00** | The solve leaves it at gross. `healthcareDelta` = 12,660 − 12,660 = 0, so nothing moves | worksheet `spending-healthcare-annual`; `YearExpenses.healthcare` doc ("… else + the gross premium"); FundingClose lines 1094–1106 (body) | 0.005 |
| 70 | **`expenses.baseSpending`** | **41,000.00** | 40,000 × 1.025 (I4) | worksheet `spending-base-annual` | 0.005 |
| 71 | Goals, debt, property, insurance, care, LTC | 0 each | | `YearExpenses` docs | exact |
| 72 | **`expenses.total`** | **53,660.00** | 41,000 + 12,660 | worksheet `spending-total-annual`; `YearExpenses.total` doc | 0.005 |
| 73 | required / target / intended; `guardrailFactor` | 53,660 each; 1 | healthcare counts as required; no spending policy | `YearExpenses` docs | 0.005 |

### 2h. The fixed point and the cash flow

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 74 | Cash inflows before withdrawals | **18,450** | consulting only. The conversion brings in no cash | FundingClose lines 709–718 (body) | not published |
| 75 | First guess | 35,210 | 53,660 − 18,450 | `annualFundingFixedPoint.ts` lines 206–211 (body) | not published |
| 76 | Eval 1 | required need **36,481** | 53,660 + (12,660 − 12,660) + tax 1,271 + 0 − 18,450. It differs from 35,210 by 1,271 | candidate evaluation lines 468–475 (body) | |
| 77 | Eval 2 (need 36,481) | the same tax, healthcare and MAGI, so **converged** | a cash draw adds no income | fixed point lines 115–126 (body) | |
| 78 | Gross restart / opposite-basin probe | **neither runs** | There is no restart, because the solve converged. The basin probe needs `acaInitialSupportCodeCount === 0` and a quote; here the count is 1 and the quote is null. So `evaluationCount` = 2 | fixed point lines 267–289 (body) | |
| 79 | **`netPortfolioNeed`** | **36,481.00**; traced 36,480.99948680401 | max(0, 53,660 + 1,271 + 0 − 18,450) | `YearResult.netPortfolioNeed` doc; worksheet `portfolio-need-annual` | 0.005 |
| 80 | How the conversion's tax is paid | from cash, inside the need | Without the conversion, TI would be 1,947.50 and the tax 194.75. The conversion adds **1,076.25**, exactly 10% of 10,762.50. In 2027 there is no credit to forfeit, so the conversion costs only its tax (in 2026 it cost 21.97% of the amount converted) | `simulate.ts` header; domain rules §10 | not published |
| 81 | Funding account | cash: 36,481 of 178,627.27 | sequential order, cash first | `withdrawalStrategySchema`; `annualWithdrawalPlanning.ts` lines 67–74 | |
| 82 | Cash identity | 54,931 = 54,931 | inflows 18,450 + 36,481; outflows 53,660 + 1,271 | identity | |
| 83 | `surplusInvested` / `shortfall` / `requiredShortfall` / `targetShortfall` | 0 / 0 / 0 / 0 | fully funded | worksheets `surplus-invested-annual`, `spending-shortfall-annual` | exact |
| 84 | Need versus 2026 | **+11,605.77** (exact 18,163,036/1,565) | 36,481 − 24,875.226198. Base spending +1,000; premium growth +660 (12,000 to 12,660); **the 2026 credit not repeated, +10,364.77**; tax +31; consulting −450 | | counterfactual |

### 2i. Withdrawals (published)

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 85 | **`withdrawals.cash`** | **36,481.00**; traced 36,480.99948680401 | row 79 | worksheet `withdrawals-by-category-annual` | 0.005 |
| 86 | `withdrawals.taxable` / `.traditional` / `.roth` / `.hsa` | 0 / **0** / **0** / 0 | the conversion is not a withdrawal | `YearWithdrawals.total` doc | exact |
| 87 | **`withdrawals.total`** | **36,481.00** | cash only | worksheet `withdrawals-total-annual` | 0.005 |
| 88 | `rothConversion` | 10,762.50 | a separate field (row 24) | | as row 24 |

### 2j. What the missing credit costs (counterfactuals; no published field)

| # | Figure | Value | Derivation |
|---|---|---|---|
| 89 | 2027 priced with the 2026 schedule and the poverty line scaled by the engine's own would-be factor | FPL 16,041.25 (64,165/4). fplPct 57,000/313 = **182.11%**, identical to 2026, because MAGI and the line both scale by 1.025. Rate 44,897/7,825 = 5.7376%. Contribution 104,924,289/62,600 = **1,676.11**. Monthly credit 1,055 − 139.68 = 915.32. Credit 687,591,711/62,600 = **10,983.89**. Net premium 1,676.11; need 25,497.11; cash year-end 156,192.77 | the formulas of 2026 rows 50–56, with 1,055 a month and `pricingInflationScale` 1.025 |
| 90 | Cost of the missing credit in 2027 | **10,983.89** of extra need and cash draw | 36,481 − 25,497.106853 |
| 91 | The conversion's cost in 2027 | **1,076.25**, all of it tax | row 80 |

### 2k. Year-end balances

Growth is applied at year end to post-flow balances, as in 2026 section 2k.

| # | Figure | Value | Derivation | Contract source | Tolerance |
|---|---|---|---|---|---|
| 92 | Cash, pre-growth / growth | 142,146.27 (exact 11,122,945,571/78,250 = 142,146.269277955271…) / 2,842.93 (2,842.925385559105…) | 178,627.269278 − 36,481; × 2%. The growth is untaxed and outside MAGI (2026 A8) | worksheet `accounts-balance-per-account-annual` | not published |
| 93 | **`balances['early-retiree-aca--cash']`** | **144,989.19** (exact 567,270,224,121/3,912,500 = 144,989.194663514376…); traced 144,989.19518697428, which displays as **144,989.20** | × 1.02 | `YearResult.balances` doc | 0.005 |
| 94 | IRA, pre-growth / growth | 450,712.50 / 22,535.625 | 461,475 − 10,762.50; × 5% | same | not published |
| 95 | **`balances['early-retiree-aca--ira']`** | **473,248.125** (exact 3,785,985/8; displays 473,248.13); traced 473,248.1303885579 (+0.005389) | 450,712.50 × 1.05 | same | **two-sided 0.0105** (section 3) |
| 96 | Roth, pre-growth / growth | 147,787.50 / 7,389.375 | 137,025 + 10,762.50; × 5% | same | not published |
| 97 | **`balances['early-retiree-aca--roth']`** | **155,176.875** (exact 1,241,415/8; displays 155,176.88); traced 155,176.8696114421 (−0.005389), which displays as **155,176.87** | 147,787.50 × 1.05 | same | **one-sided 0.0105 below** |
| 98 | Unassigned cash | 0 | | `YearResult.investableTotal` doc | exact |
| 99 | **`investableTotal`** | **773,414.19** (exact 3,025,983,036,621/3,912,500 = 773,414.194663514376…); traced 773,414.1951869742, which displays as **773,414.20** | 144,989.194664 + 473,248.125 + 155,176.875. The IRA and Roth offsets from the bisection cancel, and only cash's +0.000523 remains. The cent-rounded parts (144,989.19 + 473,248.13 + 155,176.88 = 773,414.20) do **not** sum to the rounded total | worksheet `accounts-investable-total-annual` | 0.005 |
| 100 | `netWorth` | 773,414.19 | investable only | worksheet `accounts-net-worth-annual` | 0.005 |
| 101 | Other published zeros | `qcd`, `sepp`, `inheritedDistribution`, `contributions`, `employerMatch`, `hecmDraw`, `ladderValue`, `insuranceCashValue`, `deathBenefit` and the capital-loss fields are 0; `guardrailAction` is `hold` | none in the plan | `YearResult` docs | exact |

### 2l. Penalties

| # | Figure | Value | Rule | Contract source | Tolerance |
|---|---|---|---|---|---|
| 102 | **`penalties`** | **0** | No need-based traditional withdrawal. Casey is 63 (the < 60 proxy cleared in 2024). The conversion is never penalized | `simulate.ts` header; worksheet `tax-penalties-annual` | exact |

---

## 3. The rows as data (for the 2027 table in `earlyRetireeAca.walkthrough.ts`)

Keys follow the 2026 table where the figure is the same; new keys are marked (new). "Hand" is written as the
derivation states it. The conversion's contract returns a lower bound, and that error bar carries into every row
that is affine in the conversion, scaled by the row's slope:
- MAGI, AGI, taxable income and `magiComponents.federalAgi` have slope 1, so they are one-sided below, 0.01.
- The IRA has slope −1.05, so it is one-sided **above**, 0.0105.
- The Roth has slope +1.05, so it is one-sided below, 0.0105.
- Tax, need, withdrawals and cash have slopes of at most 0.102, so they stay inside 0.005.
- Investable total: the IRA and Roth terms cancel, so it stays inside 0.005.
- The headroom's root moves up with the conversion's shortfall (slope −1), and its own bisection moves it down, so
  its band is two-sided 0.01.

| key | select (sketch) | hand | exact | display | tolerance / bound | traced engine | margin used |
|---|---|---|---|---|---|---|---|
| age | person `ageAttained` | 63 (count) | 63 | 63 | exact | 63 | 0 |
| filing-status | `filingStatus` | 'single' | | | exact | | |
| consulting | `incomes.recurring` | `18_000 * 1.025` | 18,450 | 18,450.00 | 0.005 | 18,450.0 | 0 |
| income-total | `incomes.total` | `18_000 * 1.025` | 18,450 | 18,450.00 | 0.005 | 18,450.0 | 0 |
| rmd | `rmd` | 0 | | | 0.005 | 0 | 0 |
| roth-conversion | `rothConversion` | `12_400 * 1.025 - (18_000 * 1.025 - 16_100 * 1.025)` | 21,525/2 | 10,762.50 | 0.01, `bound: 'below'` | 10,762.494868040083 | −0.005132 |
| standard-deduction (new) | `advisoryFederalTax?.detail.deduction` | `16_100 * 1.025` | 33,005/2 | 16,502.50 | 0.005 | 16,502.5 | 0 |
| taxable-income (new) | `advisoryFederalTax?.detail.taxableIncome` | `12_400 * 1.025` | 12,710 | 12,710.00 | 0.01, `bound: 'below'` | 12,709.994868040085 | −0.005132 |
| stand-in-pack (new) | `String(advisoryFederalTax?.detail.usesStandInPack)` | 'true' | | | exact | 'true' | |
| magi | `magi` | `CONSULTING + ROTH_CONVERSION` | 58,425/2 | 29,212.50 | **0.01, `bound: 'below'`** | 29,212.494868040085 | −0.005132 |
| tax | `tax` | `TAXABLE_INCOME * 0.1` | 1,271 | 1,271.00 | 0.005 | 1,270.9994868040085 | −0.000513 |
| amt | `amt` | 0 | | | 0.005 | 0 | 0 |
| ltcg-zero-headroom | `ltcgZeroHeadroom` | `49_450 * 1.025 - TAXABLE_INCOME` | 151,905/4 | 37,976.25 | **0.01, two-sided (no `bound`)** | 37,976.25260874628 | **+0.002609** |
| penalties | `penalties` | 0 | | | 0.005 | 0 | 0 |
| realized-gains | `realizedGains` | 0 | | | 0.005 | 0 | 0 |
| aca-readiness | `aca?.readiness` | 'nonActionable' | | | exact | | |
| aca-support-codes (new) | `aca?.supportCodes.join(',')` | 'tax-year-parameters-unsupported' | | | exact | | |
| aca-household-magi | see B2 | null | | | null | null | |
| aca-magi-federal-agi (new) | `aca?.magiComponents.federalAgi` | `CONSULTING + ROTH_CONVERSION` | 58,425/2 | 29,212.50 | 0.01, `bound: 'below'` | 29,212.494868040085 | −0.005132 |
| aca-poverty-line | see B2 | null | | | null | null | |
| aca-fpl-pct | see B2 | null | | | null | null | |
| aca-cliff-state | `aca?.cliffState` | 'unsupported' | | | exact | | |
| aca-gross-premium | `aca?.grossEnrollmentPremium` | `12 * 1_000 * 1.055` | 12,660 | 12,660.00 | 0.005 | 12,660.0 | 0 |
| aca-benchmark-premium | `aca?.applicableSlcspPremium` | `12 * 1_000 * 1.055` | 12,660 | 12,660.00 | 0.005 | 12,660.0 | 0 |
| aca-credit | see B2 | null | | | null | null | |
| aca-net-premium | `aca?.economicNetPremium` | `GROSS_PREMIUM` | 12,660 | 12,660.00 | 0.005 | 12,660.0 | 0 |
| aca-gross-fallback (new) | `String(aca?.convergence.grossPremiumFallback)` | 'true' | | | exact | 'true' | |
| irmaa-lookback-magi | `irmaaLookbackMagi` | 50_000 | | 50,000.00 | 0.005 | 50,000 | 0 |
| irmaa-lookback-source | `irmaaLookbackMagiSource` | 'planFallback' | | | exact | | |
| irmaa-lookback-year (new) | `irmaaLookbackMagiYear` | 2025 (unit 'year') | | | exact | 2025 | |
| medicare-premiums | `medicarePremiums` | 0 | | | 0.005 | 0 | 0 |
| base-spending | `expenses.baseSpending` | `40_000 * 1.025` | 41,000 | 41,000.00 | 0.005 | 41,000.0 | 0 |
| healthcare | `expenses.healthcare` | `GROSS_PREMIUM` | 12,660 | 12,660.00 | 0.005 | 12,660.0 | 0 |
| spending-total | `expenses.total` | `BASE_SPENDING + HEALTHCARE` | 53,660 | 53,660.00 | 0.005 | 53,660.0 | 0 |
| portfolio-need | `netPortfolioNeed` | `TOTAL_SPENDING + TAX - CONSULTING` | 36,481 | 36,481.00 | 0.005 | 36,480.99948680401 | −0.000513 |
| withdrawal-cash | `withdrawals.cash` | `NET_PORTFOLIO_NEED` | 36,481 | 36,481.00 | 0.005 | 36,480.99948680401 | −0.000513 |
| withdrawal-traditional | `withdrawals.traditional` | 0 | | | 0.005 | 0 | 0 |
| withdrawal-roth | `withdrawals.roth` | 0 | | | 0.005 | 0 | 0 |
| withdrawal-total | `withdrawals.total` | `NET_PORTFOLIO_NEED` | 36,481 | 36,481.00 | 0.005 | 36,480.99948680401 | −0.000513 |
| surplus | `surplusInvested` | 0 | | | 0.005 | 0 | 0 |
| shortfall | `shortfall` | 0 | | | 0.005 | 0 | 0 |
| balance-cash | `balances[cash]` | `(CASH_END_2026 - CASH_DRAW) * 1.02` | 567,270,224,121/3,912,500 | 144,989.19 | 0.005 | 144,989.19518697428 | +0.000523 |
| balance-ira | `balances[ira]` | `(IRA_END_2026 - ROTH_CONVERSION) * 1.05` | 3,785,985/8 | 473,248.13 | **0.0105 two-sided** (or a new `bound: 'above'`) | 473,248.1303885579 | +0.005389 |
| balance-roth | `balances[roth]` | `(ROTH_END_2026 + ROTH_CONVERSION) * 1.05` | 1,241,415/8 | 155,176.88 | **0.0105, `bound: 'below'`** | 155,176.8696114421 | −0.005389 |
| investable | `investableTotal` | `CASH_END + IRA_END + ROTH_END` | 3,025,983,036,621/3,912,500 | 773,414.19 | 0.005 | 773,414.1951869742 | +0.000523 |
| net-worth | `netWorth` | `INVESTABLE` | same | 773,414.19 | 0.005 | same | +0.000523 |

Optional rows, if the page wants them: `inflationScale` 1.025 (the format has no factor unit), `aca.taxFamilySize` 1
(count), `aca.fplRegion` 'contiguous', `aca.coveredMembers[0].coveredMonths.length` 12 (count), and
`aca.convergence.residualDollars` 0 (≤ 0.005). Do **not** pin `aca.convergence.iterations` (2 by my trace, with no
contract), and do not assert `aca.convergence.converged` without the explanation in B3.

A test that computes hand values from JS expressions (`16_100 * 1.025` and so on) gets binary64 results. These differ
from the exact rationals by about 1e-12, and every tolerance above absorbs that. For `CASH_END_2026`, use the 2026
table's own constant, which has the same binary64 value my replay produced.

---

## 4. Wrong readings a test should reject (all exact, from the same inputs)

| Wrong reading | What it produces | Correct |
|---|---|---|
| **Price a credit from the 2026 percentages on the 2026 pack as published** (the 2026 applicable-percentage table, the 2026 poverty line 15,650, and the stand-in treated as actionable) | readiness `actionable`; FPL 15,650; fplPct 58,425/313 = 186.66%; rate 372,913/62,600 = 5.9571%; contribution **1,740.21**; credit **10,919.79**; healthcare 1,740.21; need 25,561.21; cash year-end 156,127.38 | `nonActionable`; FPL null; credit null; healthcare 12,660; need 36,481; cash 144,989.19 |
| **Index the poverty line by 1.025 and price anyway** (the engine's would-be `pricingInflationScale`) | FPL **16,041.25** published; fplPct 182.11% (identical to 2026); contribution 1,676.11; credit **10,983.89**; net premium 1,676.11; need 25,497.11; cash 156,192.77 | as above: the stand-in year exposes no scaled poverty line and prices nothing |
| Carry 2026's credit forward (10,364.77 against the 12,660 premium) | healthcare 2,295.23; need 26,116.23; cash 155,561.26 | healthcare 12,660 |
| Read the lost credit as the cliff | `cliffState` `above-cliff`; the 400% warning | `cliffState` `unsupported`. MAGI 29,212.50 is 182% of any line scaled like the brackets, and a cliff scaled the same way (64,165) would sit 34,952.50 away |
| Expect `householdMagi` because `magiComponents` is published | `householdMagi` 29,212.50 | null; only the components are published (B4) |
| Read `convergence.converged: false` as a failed funding solve | expect `fixed-point-nonconvergent`, or the "could not reconcile within half a cent" warning | the solve converged in 2 evaluations; the only code is `tax-year-parameters-unsupported` (B3) |
| **Forget the stand-in indexing of the bracket and the deduction** (2026 figures frozen) | conversion **10,050**; MAGI 28,500; taxable income 12,400; tax 1,240; deduction 16,100; need 36,450; IRA 473,996.25; Roth 154,428.75; cash 145,020.81; headroom 37,050 (breakpoint also frozen) or 38,286.25 (breakpoint indexed) | conversion 10,762.50; MAGI 29,212.50; tax 1,271; deduction 16,502.50; headroom 37,976.25 |
| Index the bracket but not the deduction | conversion 10,360; MAGI 28,810; tax 1,271 | 10,762.50 |
| Index the deduction but not the bracket | conversion 10,452.50; MAGI 28,902.50; TI 12,400; tax 1,240 | 10,762.50 |
| **Index the premium at general inflation** (1.025) | gross **12,300**; healthcare 12,300; total spending 53,300; need 36,121; cash 145,356.39 | gross 12,660 at 1 + 0.025 + 0.03 |
| Compound the health rate multiplicatively (1.025 × 1.03 = 1.05575) | gross **12,669.00**; need 36,490; cash 144,980.01 | additive 1.055: 12,660 |
| Hold the premium at the 2026 level | gross 12,000; need 35,821; cash 145,662.39 | 12,660 |
| **Grow before withdrawing** (beginning-of-year growth) | cash **145,718.81**; IRA **473,786.25**; Roth **154,638.75** | 144,989.19; 473,248.125; 155,176.875 |
| Leave consulting at 18,000 (no inflation adjustment) | conversion **11,212.50**; need 36,931; income 18,000; cash 144,530.19. MAGI (29,212.50) and tax (1,271) do **not** move: filling the bracket pins AGI at ceiling + deduction whatever the other ordinary income is. Only the conversion, income and need rows catch this | 10,762.50; 36,481 |
| Read the IRMAA lookback as the prior year | 28,500, `projected`, 2026 | 50,000, `planFallback`, 2025 |
| Treat 10,762.50 as the engine's exact landing, and hold MAGI, IRA and Roth to half a cent, or the headroom to `bound: 'below'` | four false failures: MAGI −0.005132, `magiComponents.federalAgi` −0.005132, IRA +0.005389, Roth −0.005389; and the headroom lands +0.002609 above its hand value | the propagated tolerances of section 3 |

---

## 5. Contracts I could not find or found ambiguous

Each item says what the contracts support, what the alternatives are, and which reading this document uses.

**B1. The conversion's error bar propagates, and no contract says so.** `YearResult.rothConversion` promises "by
bisection (to $0.01, the lower bound)", and the `roth-conversion-annual` record says "the bisection stops at a bracket
width of $0.01". In 2026 the landing was exact. In 2027 it is 0.005131959917 below the closed form, for a reason no
document anticipates. The indexed ceiling 12,400 × 1.025 is 12,710 − 2⁻³⁹ in binary64, while the metric at the exact
root rounds (a tie, to even) to 12,710.0. So the root fails its own test, and the search converges from below onto a
bound it never reaches (Appendix B1). No worksheet, record or doc comment says that figures computed from the
conversion inherit the bar. Those figures are MAGI, AGI, taxable income, the ACA MAGI components, the IRA and Roth
balances, and, through taxable income, the headroom. Candidate readings:
- (a) closed-form hand values with propagated tolerances (**used**, section 3);
- (b) pin the traced landings (10,762.494868040083 and 37,976.25260874628). These are reproducible, because the loops
  are plain IEEE-754, but brittle against harmless changes;
- (c) the 2026 recipe unchanged, which fails four rows and the headroom bound.

This bears out the 2026 review's remark: "In stand-in years the pack scale is 1.025^n in binary floating point, so the
closed forms (for example 10,762.50) are not guaranteed to be reproduced bit-exactly, and the $0.01 bracket applies".
The 2026 document's section-4 estimate, "10,762.50 (to $0.01)", is right only in that sense. The loose whole-run
cross-check in 2026 section 4 also fits: the published lifetime Roth total is 59,661.87 against 59,661.8916 of closed
forms, a gap of 0.0166 to 0.0266 once the cent rounding is allowed for, and this year supplies 0.0051 of it.

**B2. The walkthrough format cannot state a null, a boolean or a list.** *Resolved in the change that added this
part: option (a) was implemented (`hand` may be null, held exactly; the evidence format moved to version 2); the text
below records the state it was derived against.* `WalkthroughRow.hand` was `number | string`.
`runWalkthrough` maps a null `select` result to `undefined` (`row.select(year, plan) ?? undefined`), and
`walkthroughRowProblem` reports that as "not a number" for a numeric hand and as a mismatch for a string hand. Four
published 2027 figures are null by contract (`householdMagi`, `federalPovertyLine`, `fplPct` and
`modeledAllowablePtc`), and they are the point of this year. Options:
- (a) let `hand` be `null`, and compare with `=== null` before the `?? undefined` (cleanest);
- (b) produce a string sentinel inside `select`, for example `(year) => year.aca === undefined ? undefined :
  year.aca.householdMagi === null ? 'null' : year.aca.householdMagi` with `hand: 'null'`. This still fails when `aca`
  is absent, which is what the test wants.

Booleans need `String(...)`, and the support-code list needs `join(',')`.

**B3. `aca.convergence.converged` is false in a year whose funding solve converged.** *Resolved in the same change:
`YearAcaResult.convergence` now carries a doc comment stating reading (a).* The publication sets
`converged: actionable && input.converged && !input.fixedPointFailed`, and `YearAcaResult.convergence` has no doc
comment. In 2027 the solve converged in 2 evaluations, no `fixed-point-nonconvergent` code is published, and the year
carries no "could not reconcile" warning. Readings: (a) `converged` means "a priced fixed point is certified"
(**consistent with the body**); (b) it means "the solve converged", which is what the name suggests. The page must not
say the 2027 solve failed. Reading (a) is also the only one under which the `YearExpenses.healthcare` wording holds
("publishes healthcare excluding enrollment + the economic net premium when it converges, else + the gross premium").
The `spending-healthcare-annual` worksheet says "gross premium on failure", but a stand-in year is not a failure.

**B4. `magiComponents` is published while `householdMagi` is null.** *Resolved in the same change: the field's doc
comment states the reading used (and that the parts fall back to the year's federal figures when there is no probe).*
The components come from the MAGI probe. The
probe is built whenever the year is ACA-active with a contract (candidate evaluation line 366), before pricing is
refused. No doc comment says whether the components are evidence in a non-actionable year. Reading used: they are the
inputs the credit would have been priced on, not an ACA MAGI the engine vouches for. The page may show 29,212.50 as
"the MAGI a 2027 credit would be based on", but should not call it the household MAGI.

**B5. `federalPovertyLine` and `fplPct` have no doc comments.** *Resolved in the same change: both carry doc
comments stating their gates.* Their nulls rest on domain rules §8 and on the body.
The line is withheld on `isStandIn` alone (lines 181–191); `fplPct` is null because no quote exists (line 192). The
statutory figure for 2027 coverage would come from the HHS 2026 poverty guidelines, which the pack does not carry.
Scaling 15,650 by 1.025 (to 16,041.25) is exactly the "inflation-scaled FPL" that §8 refuses to expose.

**B6. The headroom threshold in a stand-in year.** `YearResult.ltcgZeroHeadroom` and the
`year-result-ltcg-zero-headroom` record name the threshold as `pack.capitalGains.rate15StartsAbove`, without saying
that a stand-in year indexes it. The `indexFederalTaxPack` doc, domain rules §1 and the `federalTax.ts` header all list
the 15% breakpoint as indexed, and `computeFederalTax` passes the indexed pack to `zeroRateLtcgHeadroom` (line 512,
body). The record's own limits note that its evidence plan used "zero inflation … so the 2026 threshold is
unindexed". Readings: (a) 49,450 × 1.025 = 50,686.25 (**used**; headroom 37,976.25); (b) 49,450 (headroom 36,740).

**B7. The stand-in figures are not the IRS's 2027 figures.** 12,710, 16,502.50, 50,686.25 and 92,352.50 are the 2026
figures times the plan's 2.5% assumption. They carry no statutory rounding step, and they are not indexed by the
C-CPI-U. The `indexFederalTaxPack` doc says so: "What is NOT reproduced is the statutory rounding, and the index is
the plan's assumed general inflation rather than the C-CPI-U". The IRS's published 2027 figures will be rounded
amounts on a different index, so they will not match these. The page should call them projected figures.

**B8. The worksheets never cover a stand-in year.** `roth-conversion-annual`, `federal-ordinary-bracket-tax`,
`federal-amt-screen` and the ACA worksheets cite only the 2026 pack. The indexing rule lives in the
`indexFederalTaxPack` doc, in domain rules §1 and §8, in the `roth-conversion-annual` record ("indexed to the
projected year") and in the `ConversionSizingInput.inflationScale` doc. `DOCS/features/taxes.md` (lines 177–179) lists
the non-actionable triggers without the stand-in pack: "Below 100%, missing/unknown material facts, unsupported
filing/eligibility mechanics, and non-convergence". Domain rules §8 does include it.

**B9. Additive health inflation is stated only in prose.** `simulate.ts` says "general inflation + the healthcare
premium", and the `YearExpenses.healthcare` doc says "the health inflation factor from the start year"; neither
writes 1 + g + h. `parseExamplePlan` uses (inflationPct + healthcareExtraInflationPct)/100. Both give 1.055, and
exactly 1,055.0 in binary64. The multiplicative reading gives 12,669 (section 4).

**B10. Carried from 2026, unchanged:**
- the full calendar year (A1);
- consulting as plain ordinary income, with no self-employment tax (A7);
- cash growth is untaxed and outside MAGI; it is 2,842.93 in 2027 (A8);
- Florida's zero exists only inside `tax` (A9);
- `aca.convergence.iterations` has no contract (A10);
- growth comes after the conversion and the draw (A11).

The Medicare start (A6) first matters in 2028 and 2029, not in 2027.

**B11. The recurring-income inflation base.** The `income-recurring-annual` worksheet says "the supplied cumulative
general-inflation factor". The body supplies `inflFactorFrom(startYear, year)`, measured from the projection start
and not from the stream's own `startYear`. The stream starts in 2026, the projection start, so both readings give
18,450.

---

## 6. What the page should tell a reader

**Why the credit is gone in 2027.** Say it plainly, in words close to these:

> In 2027 the plan pays the full Marketplace premium, 12,660, with no premium tax credit. That is not the cliff.
> Casey's 2027 income is about the same distance below the 400% line as in 2026: about 182% of the poverty line,
> carried forward the same way. The example also still has a complete 2027 Marketplace contract. The credit is gone
> because RetireGolden has published tax-year figures only for 2026. Pricing a 2027 credit needs the 2027
> applicable-percentage table and the poverty guidelines for 2027 coverage, and neither is published yet. Rather than
> guess by carrying 2026 figures forward, the engine marks 2027 "not actionable" (support code
> `tax-year-parameters-unsupported`). It publishes no poverty line, percentage or credit, and it budgets the gross
> premium. 2028 works the same way. When a 2027 parameter pack is published, 2027 will be priced the way 2026 is.

Add the scale, labelled as illustration only. Priced on the 2026 schedule, with the poverty line carried forward at
2.5%, the credit would be about 10,984 and the net premium about 1,676. So this cautious default adds about 10,984 to
the 2027 cash draw (36,481 instead of about 25,497), and it lowers every later balance.

Say also that the tax brackets and the standard deduction are projected at the plan's 2.5% inflation (12,710 and
16,502.50). That is why the conversion grows to about 10,762.50. These are projections, not the IRS's 2027 figures.

Two more consequences are worth one sentence each:
- with no credit to lose, the 2027 conversion costs exactly its 10% tax (1,076.25);
- the example's "look for a positive premium credit" holds only in 2026.

**Why the engine column differs by a cent.** The page renders the engine's figures beside these, and the conversion
lands half a cent under the bracket top (10,762.494868…, within the promised $0.01). So six engine figures display
one cent away from the hand value:

| Figure | Hand | Engine |
|---|---|---|
| Conversion | 10,762.50 | **10,762.49** |
| MAGI and the ACA AGI component | 29,212.50 | **29,212.49** |
| Taxable income | 12,710.00 | **12,709.99** |
| Roth year-end | 155,176.88 | **155,176.87** |
| Cash year-end | 144,989.19 | **144,989.20** |
| Investable total and net worth | 773,414.19 | **773,414.20** |

One sentence under the table should say that the conversion is found by a search that stops within a cent below the
bracket top, and that these differences follow from it.

---

## Appendix A. Exact arithmetic (rationals)

- s = 41/40. Consulting O = 18,450. Deduction D = 33,005/2. Ceiling C = 12,710. Breakpoint T = 202,745/4. AMT exemption 184,705/2.
- Conversion = C − (O − D) = 12,710 − 3,895/2 = 21,525/2. MAGI = O + 21,525/2 = 58,425/2. TI = 58,425/2 − 33,005/2 = 12,710. Tax = 1,271.
- Headroom = 202,745/4 − 12,710 = 151,905/4. AMTI = 12,710 + 33,005/2 = 58,425/2.
- Gross premium = 12 × 1,055 = 12,660. Base = 41,000. Total = 53,660. Need = 53,660 + 1,271 − 18,450 = 36,481.
- Cash: 13,977,583,821/78,250 − 36,481 = 11,122,945,571/78,250; × 51/50 = 567,270,224,121/3,912,500.
- IRA: (461,475 − 21,525/2) × 21/20 = 901,425/2 × 21/20 = 3,785,985/8. Roth: (137,025 + 21,525/2) × 21/20 = 1,241,415/8.
- Investable = 567,270,224,121/3,912,500 + 5,027,400/8 = 3,025,983,036,621/3,912,500.
- Need change versus 2026: 36,481 − 38,929,729/1,565 = 18,163,036/1,565.
- Priced counterfactual: F = 64,165/4; fplPct = (58,425/2) ÷ (64,165/4) × 100 = 57,000/313; rate = 44,897/7,825 %; contribution = 58,425/2 × 44,897/782,500 = 104,924,289/62,600; credit = 12,660 − 104,924,289/62,600 = 687,591,711/62,600; need = 41,000 + 104,924,289/62,600 + 1,271 − 18,450 = 1,596,118,889/62,600.
- Pricing on the 2026 pack as published: fplPct = 58,425/313; rate = 372,913/62,600 %; contribution = 871,497,681/500,800; credit = 5,468,630,319/500,800.

## Appendix B. Bisection replays (IEEE-754 doubles, written from the loop text)

**B1. `sizeRothConversion`, topOfBracket, `rothConversion.ts` lines 173–186.**
- s = 1.0249999999999999111821580299874767661094665527343750. O = 18,000 × s = 18,450.0 exactly. D = 16,100 × s = 16,502.5 exactly. C = 12,400 × s = 12,709.999999999998181… = 12,710 − 2⁻³⁹: the exact product, 12,710 − 1.10e-12, is 0.61 ulp below 12,710 and rounds down.
- `metricAt(c)` = max(0, max(0, (O + c) + 0 + 0 + 0) − (max(D + 0, 0) + 0)). The base is 1,947.5, below C.
- `hi` = max(C − 1,947.5, 1,000) = 10,762.499999999998 = 10,762.5 − 2⁻³⁹. For `metricAt(hi)`: O + hi = 29,212.5 − 2⁻³⁹ is exactly half an ulp (2⁻³⁸) below 29,212.5, a tie that rounds to even, 29,212.5. Minus D, that is 12,710.0 > C. The doubling loop does not run.
- The halving loop runs while `hi − lo > 0.01`: 21 iterations (10,762.5/2²⁰ = 0.01026; /2²¹ = 0.00513). Every midpoint tests ≤ C, so each one sets `lo`. The final `lo` = hi × (1 − 2⁻²¹) = 5,916,744,125,644,799/2³⁹ = **10,762.494868040083**, and `hi − lo` = 0.005131959915.
- Downstream (binary64): ordinary income = 29,212.494868040085; TI = 12,709.994868040085; tax = 1,270.9994868040085, all in the 10% band.

**B2. `zeroRateLtcgHeadroom`, `federalTax.ts` lines 285–321**, fed from the advisory input (ordinary 29,212.494868040085, deduction 16,502.5, T = 50,686.24999999999).
- `taxableIncomeAt(0)` = 12,709.994868040085 < T. `lo` = 0, `hi` = T.
- 23 iterations (T/2²³ = 0.006042 ≤ 0.01). The final `lo` = 5,219,416,415,334,399/2³⁷ = **37,976.25260874628**. Its own root in binary64 terms is T − TI = 37,976.25513195991, 0.002523 above `lo`. The closed form 37,976.25 is 0.002609 below `lo`.

**B3. The year-2026 float chain** (to confirm the openings): credit 10,364.773801916934; need 24,875.226198083066; cash
178,627.26927795526; IRA 461,475.0; Roth 137,025.0. All match the approved exact values to within 1e-9.

## Appendix C. Fixed-point trace for 2027 (`annualFundingFixedPoint.ts`)

Inputs: `spendingUsesBeforeTax` 53,660; `baseCashInflows` 18,450; `currentHealthcare` 12,660; HECM capacity 0 (so the
coordinated loop is skipped); `acaActive` true; `acaInitialSupportCodeCount` 1.
1. Eval 1, need 35,210: tax 1,270.9994868. The MAGI probe is built (29,212.494868), but pricing is refused. Healthcare 12,660; `requiredNeed` 36,480.99948680401. |Δ| = 1,270.9995, more than 0.005.
2. Eval 2, need 36,480.99948680401: identical, so converged.
3. No gross restart (converged). No opposite-basin probe (support-code count 1, quote null).

The accepted evaluation is Eval 2. `evaluationCount` = 2 and `residualDollars` = 0. By the publication rule (row 64),
`aca.convergence.converged` is false and `grossPremiumFallback` is true.
