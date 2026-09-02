import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  type Plan,
} from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  currentYearAca,
  noTax,
  testIds,
  traditional,
  validate,
  wages,
} from './simulate.test-support.js'

describe('healthcare and penalties', () => {
  // Independent worksheet: first-year RMD = 500,000 / 26.5; the qualified
  // annuity leaves 8,000 timely distributed, so the §4974 excise is
  // (500,000 / 26.5 - 8,000) × 25%. IRC 275(a)(6) leaves federal AGI at
  // 8,000; deducting the chapter 43 tax would instead reduce it by that excise.
  // Taxable income is zero after the standard and age/senior deductions — still
  // not 8,000 minus the excise.
  describeRule('irc-275-a-6-chapter-43-excise-taxes-nondeductible', {
    readings: {
      chapter43ExciseDoesNotReduceFederalBase: {
        agi: 8_000,
        taxableIncome: 0,
        magi: 8_000,
      },
      rejectedExciseDeductionReducesFederalBase: {
        agi: 8_000 - (500_000 / 26.5 - 8_000) * 0.25,
        taxableIncome: 0,
        magi: 8_000 - (500_000 / 26.5 - 8_000) * 0.25,
      },
    },
    accepted: 'chapter43ExciseDoesNotReduceFederalBase',
    note: 'RMD-shortfall excise remains outside AGI, taxable income, and MAGI',
  }, ({ accepted, readings }) => {
    it('keeps a chapter 43 RMD-shortfall excise out of the income-tax base', () => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1953-06-15'
      plan.household.people[0]!.retirementAge = null
      const sourceEmployerPlan = traditional(500_000)
      plan.accounts = [
        cash(1_000_000),
        sourceEmployerPlan,
        {
          type: 'annuity',
          id: testIds(),
          name: 'Qualified annuity',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          startAge: 74,
          monthlyAmount: 0,
          colaPct: 0,
          taxablePct: 100,
          purchase: {
            year: 2026,
            premium: 492_000,
            fundingAccountId: sourceEmployerPlan.id,
            taxQualification: 'qualified',
          },
        },
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }).years[0]!
      const excise = (500_000 / 26.5 - 8_000) * 0.25
      const observed = {
        agi: year.advisoryFederalTax!.detail.agi,
        taxableIncome: year.advisoryFederalTax!.detail.taxableIncome,
        magi: year.magi,
      }

      expect(year.rmd).toBeCloseTo(8_000, 8)
      expect(year.rmdShortfallExciseTax).toBeCloseTo(excise, 8)
      expect(year.penalties).toBeCloseTo(excise, 8)
      expect(observed).toEqual(accepted)
      expect(observed.agi).not.toBeCloseTo(
        readings.rejectedExciseDeductionReducesFederalBase.agi,
        8,
      )
      expect(observed.magi).not.toBeCloseTo(
        readings.rejectedExciseDeductionReducesFederalBase.magi,
        8,
      )
    })
  })

  it('fails closed for future years without sourced tax-year parameters', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1964-06-15'
    currentYearAca(plan)
    const future = structuredClone(plan.expenses.healthcare.acaYears![0]!)
    future.year = 2027
    plan.expenses.healthcare.acaYears!.push(future)
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Income', annualAmount: 30_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    })
    expect(result.years[0]!.aca?.readiness).toBe('actionable')
    expect(result.years[1]!.aca?.readiness).toBe('nonActionable')
    expect(result.years[1]!.aca?.supportCodes).toContain('tax-year-parameters-unsupported')
    expect(result.years[1]!.aca?.federalPovertyLine).toBeNull()
    expect(result.years[1]!.expenses.healthcare).toBe(12_000)
  })

  it('fails closed before reconciling ACA with an adaptive spending policy', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.supportCodes).toContain('guardrail-interaction-unsupported')
    expect(year.expenses.healthcare).toBe(12_000)
  })

  it('keeps an explicit fixed-target spending policy actionable with complete ACA evidence', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.spendingPolicy = { mode: 'fixedTarget' }
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('actionable')
    expect(year.aca?.supportCodes).toEqual(['actionable'])
    expect(year.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(year.aca?.economicNetPremium).toBeCloseTo(
      year.aca!.grossEnrollmentPremium - year.aca!.modeledAllowablePtc!,
      6,
    )
    expect(year.expenses.healthcare).toBeCloseTo(year.aca!.economicNetPremium, 6)
  })

  it('keeps valid pre-Medicare enrollment months actionable in the age-65 transition year', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15'
    currentYearAca(plan, { coveredMonths: 5 })
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('actionable')
    expect(year.aca?.supportCodes).toEqual(['actionable'])
    expect(year.aca?.grossEnrollmentPremium).toBe(5_000)
    expect(year.medicarePremiums).toBeGreaterThan(0)
  })

  it('fails closed when age-65 enrollment reaches the first Medicare month', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15'
    currentYearAca(plan, { coveredMonths: 6 })
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('medicare-overlap-unsupported')
    expect(year.aca?.grossEnrollmentPremium).toBe(6_000)
    expect(year.expenses.healthcare).toBeCloseTo(6_000 + year.medicarePremiums, 6)
  })

  it('fails closed for Marketplace enrollment in any fully post-65 month', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1960-06-15'
    currentYearAca(plan)
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('medicare-overlap-unsupported')
    expect(year.aca?.grossEnrollmentPremium).toBe(12_000)
    expect(year.expenses.healthcare).toBeCloseTo(12_000 + year.medicarePremiums, 6)
  })

  it('checks Medicare overlap against the covered spouse rather than the primary age', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1961-09-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 90, source: 'manual' },
    })
    currentYearAca(plan, { coveredPersonIds: ['p1', 'p2'] })
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 40_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const overlapping = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(overlapping.aca?.supportCodes).toContain('medicare-overlap-unsupported')

    const spouse = plan.expenses.healthcare.acaYears![0]!.coveredMembers.find(
      (member) => member.personId === 'p2',
    )!
    spouse.enrollmentPremiumByMonth.fill(0, 8)
    spouse.slcspBenchmarkPremiumByMonth.fill(0, 8)
    const valid = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(valid.aca?.readiness).toBe('actionable')
    expect(valid.aca?.supportCodes).toEqual(['actionable'])
  })

  it('preserves known gross premiums when same-year contracts conflict', () => {
    const plan = basePlan()
    currentYearAca(plan)
    const original = plan.expenses.healthcare.acaYears![0]!
    original.coveredMembers[0]!.enrollmentPremiumByMonth.fill(0, 6)
    const duplicate = structuredClone(plan.expenses.healthcare.acaYears![0]!)
    duplicate.coveredMembers[0]!.enrollmentPremiumByMonth.fill(0, 0, 6)
    duplicate.coveredMembers[0]!.enrollmentPremiumByMonth.fill(800, 6)
    plan.expenses.healthcare.acaYears!.push(duplicate)
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.supportCodes).toContain('duplicate-year-contract')
    expect(year.aca?.grossEnrollmentPremium).toBe(10_800)
    expect(year.expenses.healthcare).toBe(10_800)
    expect(year.aca?.coveredMembers).toEqual([])
  })

  it('treats benchmark-only months as unsupported and excludes them from coverage evidence', () => {
    const plan = basePlan()
    currentYearAca(plan, { coveredMonths: 1 })
    plan.expenses.healthcare.acaYears![0]!.coveredMembers[0]!.slcspBenchmarkPremiumByMonth.fill(1_000)
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.supportCodes).toContain('benchmark-only-coverage-unsupported')
    expect(year.aca?.coveredMembers[0]?.coveredMonths).toEqual([1])
    expect(year.aca?.coveredMembers[0]?.applicableSlcspPremium).toBe(1_000)
    expect(year.aca?.applicableSlcspPremium).toBe(1_000)
  })

  it('fails closed when a primary or spouse in the tax family is not alive in the modeled year', () => {
    const plan = basePlan()
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1965-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 60, source: 'manual' },
    })
    currentYearAca(plan, { coveredPersonIds: ['p1'] })
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('tax-family-member-unknown')
  })

  it('requires explicit dependent tax-family evidence in a qualifying-surviving-spouse ACA year', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.hasQualifyingDependent = true
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1965-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 60, source: 'manual' },
    })
    currentYearAca(plan, { coveredPersonIds: ['p1'] })
    const contract = plan.expenses.healthcare.acaYears![0]!
    contract.taxFamilyMembers = [contract.taxFamilyMembers[0]!]
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 40_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(200_000)]

    const unsupported = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(unsupported.filingStatus).toBe('qualifyingSurvivingSpouse')
    expect(unsupported.aca?.readiness).toBe('nonActionable')
    expect(unsupported.aca?.supportCodes).toContain('tax-family-structure-unsupported')

    contract.taxFamilyMembers.push({
      personId: 'qualifying-dependent',
      relationship: 'dependent',
      requiredToFile: 'notRequired',
      magi: 0,
    })
    const supported = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(supported.aca?.readiness).toBe('actionable')
    expect(supported.aca?.supportCodes).toEqual(['actionable'])
  })

  it('requires the ACA tax family to include every living modeled person whose income is aggregated', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1966-09-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 90, source: 'manual' },
    })
    currentYearAca(plan, { coveredPersonIds: ['p1'] })
    plan.incomes = [wages(20_000, 'p1'), wages(20_000, 'p2')]
    plan.accounts = [cash(200_000)]

    const joint = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(joint.aca?.readiness).toBe('actionable')
    expect(joint.aca?.supportCodes).toEqual(['actionable'])

    plan.household.filingStatus = 'single'
    plan.expenses.healthcare.acaYears![0]!.taxFamilyMembers =
      plan.expenses.healthcare.acaYears![0]!.taxFamilyMembers.filter(
        (member) => member.relationship === 'primary',
      )
    const incomplete = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(incomplete.aca?.readiness).toBe('nonActionable')
    expect(incomplete.aca?.supportCodes).toContain('tax-family-structure-unsupported')
    expect(incomplete.aca?.magiComponents.federalAgi).toBeCloseTo(40_000, 2)
  })

  it('fails closed when the annual primary does not exist in the modeled household', () => {
    const plan = basePlan()
    currentYearAca(plan)
    const contract = plan.expenses.healthcare.acaYears![0]!
    contract.taxFamilyMembers[0]!.personId = 'external-primary'
    contract.coveredMembers[0]!.personId = 'external-primary'
    plan.accounts = [cash(200_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('tax-family-member-unknown')
  })

  it('excludes ordinary Marketplace premiums from the HSA qualified-expense cap', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 0
    plan.accounts = [{
      type: 'hsa',
      id: 'hsa',
      name: 'HSA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 50_000,
      annualContribution: 0,
      withdrawalTreatment: 'capByMedicalExpenses',
    }]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(year.withdrawals.hsa).toBeGreaterThan(year.expenses.healthcare)
    expect(year.penalties).toBeGreaterThan(0)
    expect(year.expenses.healthcare).toBeGreaterThan(0)
  })

  it('excludes Marketplace premiums from the HSA cap when ACA credit modeling is disabled', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.accounts = [{
      type: 'hsa',
      id: 'hsa',
      name: 'HSA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 50_000,
      annualContribution: 0,
      withdrawalTreatment: 'capByMedicalExpenses',
    }]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(year.expenses.healthcare).toBe(12_000)
    expect(year.withdrawals.hsa).toBeGreaterThan(12_000)
    expect(year.penalties).toBeGreaterThan(0)
  })

  it('uses the default healthcare spread of inflation plus 3 percentage points', () => {
    const plan = basePlan()
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(plan.assumptions.healthcareExtraInflationPct).toBe(3)
    expect(y2028.expenses.healthcare).toBeCloseTo(12_000 * Math.pow(1.03, 2), 6)
  })

  it('applies the ACA credit against current-year household MAGI before 65', () => {
    const plan = basePlan() // born 1966 -> 60 in 2026
    currentYearAca(plan)
    plan.incomes = [{ type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' }]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // ~192% FPL -> expected contribution ≈ 6.2% of 30k; net premium = contribution.
    expect(y1.expenses.healthcare).toBeGreaterThan(1_500)
    expect(y1.expenses.healthcare).toBeLessThan(2_500)
  })

  it('subtracts the household ACA expected contribution once for a couple both under 65', () => {
    const plan = basePlan() // p1 born 1966 -> 60 in 2026
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1966-06-15',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 90, source: 'manual' },
    })
    plan.household.filingStatus = 'marriedFilingJointly'
    currentYearAca(plan, { coveredPersonIds: ['p1', 'p2'] })
    plan.incomes = [{ type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' }]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // Household of 2: 30k MAGI vs 21,150 FPL ≈ 142% -> applicable pct ≈ 3.7%,
    // expected contribution ≈ $1.1k. The net household premium equals that
    // contribution once; charging it per covered spouse would double it (≈ $2.2k).
    expect(y1.expenses.healthcare).toBeGreaterThan(900)
    expect(y1.expenses.healthcare).toBeLessThan(1_400)
  })

  it('charges the full premium over the 400% FPL cliff, with a warning', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.incomes = [{ type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 70_000, taxTreatment: 'ordinary' }]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.expenses.healthcare).toBeCloseTo(12_000, 6)
    expect(result.warnings.join(' ')).toContain('400%')
  })

  it('funds a same-year conversion cliff loss and feeds the induced withdrawal back into ACA MAGI', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 10_000
    plan.accounts = [
      traditional(1_000_000),
      {
        type: 'roth',
        id: testIds(),
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2026, amount: 60_000 }],
    }
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })
    const year = result.years[0]!

    expect(year.aca?.readiness).toBe('actionable')
    expect(year.aca?.cliffState).toBe('above-cliff')
    expect(year.aca?.modeledAllowablePtc).toBe(0)
    expect(year.expenses.healthcare).toBe(12_000)
    expect(year.withdrawals.traditional).toBeGreaterThan(12_000)
    expect(year.aca?.householdMagi).toBeCloseTo(year.magi, 6)
    expect(year.aca?.convergence.converged).toBe(true)
    expect(year.aca?.convergence.iterations).toBeLessThanOrEqual(
      year.aca?.convergence.maxIterations ?? 0,
    )
  })

  it('uses current-year realized gains in the reconciled ACA cliff state', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Gain', year: 2026, inflationAdjusted: false, amount: 70_000, taxTreatment: 'capitalGain' },
    ]
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(year.aca?.householdMagi).toBe(70_000)
    expect(year.aca?.cliffState).toBe('above-cliff')
    expect(year.expenses.healthcare).toBe(12_000)
  })

  it('records ACA addbacks without taxing them as ordinary income', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1964-01-01'
    currentYearAca(plan)
    const contract = plan.expenses.healthcare.acaYears![0]!
    contract.taxExemptInterest = { state: 'known', amount: 5_000 }
    contract.foreignExclusionAddback = { state: 'known', amount: 3_000 }
    contract.taxFamilyMembers.push({
      personId: 'dep',
      relationship: 'dependent',
      requiredToFile: 'required',
      magi: 2_000,
    })
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 20_000, taxTreatment: 'ordinary' },
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ]
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const components = year.aca!.magiComponents

    expect(year.aca?.readiness).toBe('actionable')
    expect(year.magi).toBe(components.federalAgi + 5_000)
    expect(components.taxExemptInterest).toBe(5_000)
    expect(components.foreignExclusionAddback).toBe(3_000)
    expect(components.requiredFilerDependentMagi).toBe(2_000)
    expect(year.aca?.householdMagi).toBeCloseTo(
      Object.values(components).reduce((sum, value) => sum + value, 0),
      6,
    )
  })

  it('preserves signed federal AGI until ACA household addbacks are assembled', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.household.capitalLossCarryforward = 10_000
    plan.expenses.healthcare.acaYears![0]!.foreignExclusionAddback = {
      state: 'known',
      amount: 20_000,
    }
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(year.tax).toBe(0)
    expect(year.aca?.readiness).toBe('actionable')
    expect(year.aca?.magiComponents.federalAgi).toBe(-3_000)
    expect(year.aca?.magiComponents.foreignExclusionAddback).toBe(20_000)
    expect(year.aca?.householdMagi).toBe(17_000)
  })

  it('uses known ACA non-taxable addbacks when floor-trimming a conversion tax torpedo', () => {
    const make = (taxExemptInterest: number, foreignExclusionAddback = 0): Plan => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1964-01-01'
      currentYearAca(plan)
      plan.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
        state: 'known',
        amount: taxExemptInterest,
      }
      plan.expenses.healthcare.acaYears![0]!.foreignExclusionAddback = {
        state: 'known',
        amount: foreignExclusionAddback,
      }
      plan.expenses.baseAnnual = 10_000
      plan.incomes = [
        {
          type: 'recurring',
          id: testIds(),
          label: 'Pension',
          annualAmount: 15_000,
          startYear: 2026,
          endYear: 2026,
          inflationAdjusted: false,
          taxTreatment: 'ordinary',
        },
        {
          type: 'socialSecurity',
          id: testIds(),
          personId: 'p1',
          piaMonthly: 1_500,
          earnings: null,
          claimAge: { years: 62, months: 0 },
        },
      ]
      plan.accounts = [
        cash(50_000),
        traditional(1_000_000),
        {
          type: 'roth',
          id: testIds(),
          name: 'Roth',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          kind: 'ira',
          balance: 0,
          annualContribution: 0,
        },
      ]
      plan.strategies.taxableSafetyNetFloor = 55_000
      plan.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: 12,
        startYear: 2026,
        endYear: 2026,
      }
      return plan
    }
    const project = (taxExemptInterest: number, foreignExclusionAddback = 0) =>
      simulatePlan(validate(make(taxExemptInterest, foreignExclusionAddback)), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }).years[0]!
    const withoutInterest = project(0)
    const withInterest = project(10_000)
    const withForeignExclusion = project(0, 10_000)
    const taxableSocialSecurity = (year: typeof withInterest) =>
      year.aca!.magiComponents.federalAgi - 15_000 - year.rothConversion

    expect(withInterest.aca?.readiness).toBe('actionable')
    expect(withInterest.magi).toBeCloseTo(
      withInterest.aca!.magiComponents.federalAgi + 10_000,
      6,
    )
    expect(taxableSocialSecurity(withInterest)).toBeGreaterThan(
      taxableSocialSecurity(withoutInterest) + 1_000,
    )
    expect(withInterest.tax).toBeGreaterThan(withoutInterest.tax)
    expect(withInterest.rothConversion).toBeLessThan(withoutInterest.rothConversion - 100)
    expect(taxableSocialSecurity(withForeignExclusion)).toBeGreaterThan(
      taxableSocialSecurity(withoutInterest) + 1_000,
    )
    expect(withForeignExclusion.tax).toBeCloseTo(withInterest.tax, 6)
    expect(withForeignExclusion.rothConversion).toBeCloseTo(withInterest.rothConversion, 6)
    expect(withForeignExclusion.magi).toBeCloseTo(
      withForeignExclusion.aca!.magiComponents.federalAgi,
      6,
    )
    expect(withForeignExclusion.aca?.magiComponents.foreignExclusionAddback).toBe(10_000)
    expect(withForeignExclusion.aca?.householdMagi).toBeCloseTo(
      Object.values(withForeignExclusion.aca!.magiComponents).reduce(
        (sum, value) => sum + value,
        0,
      ),
      6,
    )
  })

  it('separates required-filer dependent MAGI from covered members and months', () => {
    const requiredPlan = basePlan()
    currentYearAca(requiredPlan)
    requiredPlan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    requiredPlan.accounts = [cash(100_000)]
    requiredPlan.expenses.healthcare.acaYears![0]!.taxFamilyMembers.push({
      personId: 'dep',
      relationship: 'dependent',
      requiredToFile: 'required',
      magi: 10_000,
    })
    const notRequiredPlan = structuredClone(requiredPlan)
    notRequiredPlan.expenses.healthcare.acaYears![0]!.taxFamilyMembers[1]!.requiredToFile = 'notRequired'

    const required = simulatePlan(validate(requiredPlan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const notRequired = simulatePlan(validate(notRequiredPlan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(required.aca?.taxFamilySize).toBe(2)
    expect(required.aca?.coveredMembers).toEqual(notRequired.aca?.coveredMembers)
    expect(required.aca!.householdMagi! - notRequired.aca!.householdMagi!).toBe(10_000)
    expect(required.aca?.magiComponents.requiredFilerDependentMagi).toBe(10_000)
    expect(notRequired.aca?.magiComponents.requiredFilerDependentMagi).toBe(0)
  })

  it('fails closed when a dependent id overlaps a modeled household person', () => {
    const plan = basePlan()
    plan.household.people.push({
      id: 'p2',
      name: 'Robin',
      dob: '1968-01-01',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 90, source: 'manual' },
    })
    currentYearAca(plan, { coveredPersonIds: ['p1'] })
    const dependent = plan.expenses.healthcare.acaYears![0]!.taxFamilyMembers[1]!
    dependent.relationship = 'dependent'
    dependent.requiredToFile = 'required'
    dependent.magi = 30_000
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('dependent-modeled-person-overlap')
    expect(year.aca?.householdMagi).toBeNull()
    expect(year.aca?.modeledAllowablePtc).toBeNull()
    expect(year.expenses.healthcare).toBe(year.aca?.grossEnrollmentPremium)
  })

  it('funds gross premium and emits typed evidence when material ACA facts are unknown', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [
      cash(100_000),
      traditional(100_000),
      {
        type: 'roth',
        id: testIds(),
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: 2026,
      endYear: 2026,
    }
    const contract = plan.expenses.healthcare.acaYears![0]!
    contract.taxExemptInterest = { state: 'unknown', amount: null }
    contract.foreignExclusionAddback = { state: 'unknown', amount: null }
    contract.taxFamilyMembers.push({
      personId: 'dep',
      relationship: 'dependent',
      requiredToFile: 'unknown',
      magi: 5_000,
    })
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(year.expenses.healthcare).toBe(12_000)
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.modeledAllowablePtc).toBeNull()
    expect(year.aca?.householdMagi).toBeNull()
    expect(year.aca?.supportCodes).toEqual(
      expect.arrayContaining([
        'tax-exempt-interest-unknown',
        'foreign-exclusion-addback-unknown',
        'dependent-filing-status-unknown',
      ]),
    )
    expect(year.aca?.convergence.grossPremiumFallback).toBe(true)
    expect(year.rothConversion).toBe(0)
    expect(
      simulatePlan(validate(plan), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }).warnings.join(' '),
    ).toContain('ACA-cliff Roth-conversion target was skipped')
  })

  it('fails closed when a credit-enabled legacy plan lacks the per-year contract', () => {
    const plan = basePlan()
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.expenses.healthcare).toBe(12_000)
    expect(year.aca?.supportCodes).toContain('missing-year-contract')
    expect(year.aca?.modeledAllowablePtc).toBeNull()
  })

  it('treats below-100% FPL exception pathways as typed unsupported', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 10_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(100_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('below-100-fpl-exception-unsupported')
    expect(year.aca?.cliffState).toBe('below-eligibility-floor')
    expect(year.aca?.fplPct).toBeCloseTo((10_000 / 15_650) * 100, 6)
    expect(year.expenses.healthcare).toBe(12_000)
  })

  it('preserves byte-identical ledgers when ACA credit is disabled or no premium exists', () => {
    const disabled = basePlan()
    disabled.household.people[0]!.dob = '1964-06-15'
    disabled.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    disabled.accounts = [cash(100_000)]
    disabled.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 20_000, taxTreatment: 'ordinary' },
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ]
    const disabledWithContract = structuredClone(disabled)
    currentYearAca(disabledWithContract)
    disabledWithContract.expenses.healthcare.applyAcaCredit = false
    disabledWithContract.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
      state: 'known',
      amount: 5_000,
    }
    expect(
      simulatePlan(validate(disabledWithContract), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }),
    ).toEqual(
      simulatePlan(validate(disabled), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }),
    )

    const noPremium = basePlan()
    noPremium.accounts = [cash(100_000)]
    const noPremiumCreditEnabled = structuredClone(noPremium)
    noPremiumCreditEnabled.expenses.healthcare.applyAcaCredit = true
    expect(
      simulatePlan(validate(noPremiumCreditEnabled), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: noTax,
      }),
    ).toEqual(
      simulatePlan(validate(noPremium), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: noTax,
      }),
    )
  })

  it('prorates ACA and Medicare by birth month in the year a person turns 65', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15' // turns 65 in June 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 100 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // June birthday: 5 marketplace months (Jan–May), 7 Medicare months.
    // Base Part B is 202.90/mo with no IRMAA (MAGI lookback ≈ 0).
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.expenses.healthcare).toBeCloseTo(5 * 1_000 + 202.9 * 7 + 100 * 7, 4)
    // The year after is all Medicare — no marketplace months left.
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.expenses.healthcare).toBeCloseTo((202.9 * 12 + 100 * 12) * 1.03, 4)
  })

  it('prorates the ACA expected contribution to covered months in the transition year', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-06-15' // turns 65 in June 2026: 5 marketplace months
    plan.household.people[0]!.retirementAge = null
    currentYearAca(plan, { coveredMonths: 5 })
    plan.incomes = [{ type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' }]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 30k MAGI ≈ 192% FPL -> expected contribution ≈ $1.86k/yr ≈ $155/mo. The
    // PTC is monthly, so five covered months net ≈ 5 × $155 ≈ $775 — NOT the
    // full-year ≈ $1.86k contribution — plus seven Medicare months (≈ $1.42k).
    const y2026 = result.years[0]!
    expect(y2026.expenses.healthcare).toBeGreaterThan(2_100)
    expect(y2026.expenses.healthcare).toBeLessThan(2_300)
  })

  it('keeps a January-born 65th year entirely on Medicare', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1961-01-15' // turns 65 in January 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // January birth month -> 0 marketplace months; identical to the old
    // full-year Medicare switch.
    expect(result.years.find((y) => y.year === 2026)!.expenses.healthcare).toBeCloseTo(202.9 * 12, 4)
  })

  // 42 U.S.C. 1395r(i)(4)(B)(i) selects the last taxable year beginning in
  // the SECOND calendar year preceding the premium year. The tempting
  // same-year reading would price the 2027 windfall in 2027 and leave 2029 at
  // the standard tier; the statute requires the opposite timing.
  describeRule('usc-42-1395r-i-4-b-two-year-magi-lookback', {
    readings: {
      secondPrecedingYear: { spikeYearTier: 0, twoYearsLaterTier: 4 },
      sameYearIncome: { spikeYearTier: 4, twoYearsLaterTier: 0 },
    },
    accepted: 'secondPrecedingYear',
  }, ({ accepted, readings }) => {
    it('raises Medicare premiums two years after an income spike', () => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1960-06-15' // 66 in 2026, on Medicare
      plan.household.people[0]!.retirementAge = null
      plan.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Windfall', year: 2027, inflationAdjusted: false, amount: 300_000, taxTreatment: 'ordinary' },
      ]
      plan.accounts = [cash(3_000_000)]
      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

      expect(result.years.find((y) => y.year === 2027)!.magi).toBeGreaterThanOrEqual(300_000)
      const baselineYear = result.years.find((y) => y.year === 2028)! // looks back at 2026 MAGI ≈ 0
      const spikeYear = result.years.find((y) => y.year === 2027)!
      const twoYearsLater = result.years.find((y) => y.year === 2029)! // looks back at 2027 MAGI = 300k
      const observed = {
        spikeYearTier: spikeYear.irmaaTier,
        twoYearsLaterTier: twoYearsLater.irmaaTier,
      }
      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.sameYearIncome)
      const healthInfl = (y: number) => Math.pow(1.03, y - 2026) // inflation 0 + 3% healthcare extra
      expect(baselineYear.expenses.healthcare).toBeCloseTo(202.9 * 12 * healthInfl(2028), 4)
      // 300k (vs thresholds unscaled at 0% inflation) -> tier 4 = 3.2× Part B + $83.30/mo Part D.
      expect(twoYearsLater.expenses.healthcare).toBeCloseTo((202.9 * 3.2 + 83.3) * 12 * healthInfl(2029), 4)
    })
  })

  it('uses distinct historical MAGI tax years for the first two IRMAA lookbacks', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1960-06-15' // already on Medicare in 2026
    plan.household.people[0]!.retirementAge = null
    plan.assumptions.recentAnnualMagi = 0
    plan.assumptions.historicalAnnualMagiByYear = {
      '2024': 50_000,
      '2025': 150_000,
    }
    plan.accounts = [cash(3_000_000)]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!

    expect(y2026.irmaaTier).toBe(0)
    expect(y2027.irmaaTier).toBeGreaterThan(0)
    expect(y2027.expenses.healthcare).toBeGreaterThan(y2026.expenses.healthcare)
  })

  // 42 U.S.C. 1395r(i)(4)(A)(ii) adds interest exempt from tax to AGI for
  // IRMAA MAGI. The rejected AGI-only reading leaves this $5,000 municipal
  // interest out of the lookback and misses the first surcharge tier.
  describeRule('usc-42-1395r-i-4-a-magi-agi-plus-tax-exempt-interest', {
    readings: {
      agiPlusTaxExemptInterest: { withInterestTier: 1, withoutInterestTier: 0, magiDelta: 5_000 },
      agiOnly: { withInterestTier: 0, withoutInterestTier: 0, magiDelta: 0 },
    },
    accepted: 'agiPlusTaxExemptInterest',
  }, ({ accepted, readings }) => {
    it('carries known tax-exempt interest into later IRMAA MAGI without taxing it as ordinary income', () => {
      const withInterest = basePlan()
      withInterest.household.people[0]!.dob = '1961-06-15'
      withInterest.household.people[0]!.retirementAge = null
      currentYearAca(withInterest, { coveredMonths: 5 })
      withInterest.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
        state: 'known',
        amount: 5_000,
      }
      withInterest.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 105_000, taxTreatment: 'ordinary' },
      ]
      withInterest.accounts = [cash(500_000)]
      const withoutInterest = structuredClone(withInterest)
      withoutInterest.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
        state: 'notApplicable',
        amount: null,
      }

      const withResult = simulatePlan(validate(withInterest), {
        startYear: 2026,
        horizonEndYear: 2028,
        taxCalculator: createFederalTaxCalculator(),
      })
      const withoutResult = simulatePlan(validate(withoutInterest), {
        startYear: 2026,
        horizonEndYear: 2028,
        taxCalculator: createFederalTaxCalculator(),
      })
      expect(withResult.years[0]!.aca?.magiComponents.federalAgi).toBe(
        withoutResult.years[0]!.aca?.magiComponents.federalAgi,
      )
      expect(withResult.years[0]!.magi - withoutResult.years[0]!.magi).toBe(5_000)
      const observed = {
        withInterestTier: withResult.years[2]!.irmaaTier,
        withoutInterestTier: withoutResult.years[2]!.irmaaTier,
        magiDelta: withResult.years[0]!.magi - withoutResult.years[0]!.magi,
      }
      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.agiOnly)
    })
  })

  // 42 U.S.C. 1395r(i)(4)(A)(i) requires IRMAA MAGI without regard to
  // sections 135, 911, 931, and 933. The engine already adds the foreign-
  // exclusion amount into ACA household MAGI; the IRMAA magiHistory feed
  // does not. No Social Security in this fixture, so the §86 provisional-
  // income path cannot move IRMAA MAGI indirectly through taxable benefits.
  //
  // Pins are input-sized deltas (FOREIGN), not engine-derived absolutes.
  describeRule('usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback', {
    readings: {
      statuteAddsForeignExclusionToIrmaaMagi: { acaMagiDelta: 20_000, irmaaMagiDelta: 20_000 },
      engineAddsForeignExclusionToAcaOnly: { acaMagiDelta: 20_000, irmaaMagiDelta: 0 },
    },
    accepted: 'statuteAddsForeignExclusionToIrmaaMagi',
    produced: 'engineAddsForeignExclusionToAcaOnly',
    note: 'foreign-exclusion addback raises ACA MAGI but not IRMAA magiHistory',
  }, ({ accepted, produced }) => {
    it('raises ACA household MAGI by the known foreign-exclusion addback without moving IRMAA MAGI history', () => {
      const FOREIGN = 20_000
      const withAddback = basePlan()
      withAddback.expenses.baseAnnual = 0
      currentYearAca(withAddback)
      withAddback.expenses.healthcare.acaYears![0]!.foreignExclusionAddback = {
        state: 'known',
        amount: FOREIGN,
      }
      withAddback.accounts = [cash(500_000)]
      const withoutAddback = structuredClone(withAddback)
      withoutAddback.expenses.healthcare.acaYears![0]!.foreignExclusionAddback = {
        state: 'notApplicable',
        amount: null,
      }

      const withResult = simulatePlan(validate(withAddback), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      })
      const withoutResult = simulatePlan(validate(withoutAddback), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      })
      const withYear = withResult.years[0]!
      const withoutYear = withoutResult.years[0]!
      expect(withYear.aca?.magiComponents.foreignExclusionAddback).toBe(FOREIGN)
      expect(withoutYear.aca?.magiComponents.foreignExclusionAddback).toBe(0)
      const observed = {
        acaMagiDelta: (withYear.aca?.householdMagi ?? 0) - (withoutYear.aca?.householdMagi ?? 0),
        irmaaMagiDelta: withYear.magi - withoutYear.magi,
      }
      expect(observed).toEqual(produced)
      expect(observed).not.toEqual(accepted)
    })
  })

  it('grosses up the 10% early-withdrawal penalty on pre-59½ traditional draws', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1976-06-15' // 50 in 2026
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [traditional(1_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // w = 50,000 + 0.1w -> w = 55,555.56
    expect(y1.withdrawals.traditional).toBeCloseTo(55_555.56, 1)
    expect(y1.penalties).toBeCloseTo(5_555.56, 1)
    expect(y1.shortfall).toBe(0)
    expect(result.warnings.join(' ')).toContain('penalties')

    // Penalties stop once the owner reaches 60 (2036).
    expect(result.years.find((y) => y.year === 2036)!.penalties).toBe(0)
  })
})
