/**
 * Proved-zero state worksheet relief: actual simulatePlan paths shed only the
 * immaterial CT/WI/IA relief-fact warnings while positive-income and unrelated
 * diagnostics stay incomplete.
 */
import { describe, expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { stateParamsFor } from '../params/state/index.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import {
  computeStateTaxableIncomeResult,
  createStateTaxCalculator,
} from '../tax/stateTax.js'
import type { StateRetirementDistributionFact } from '../tax/stateRetirementFacts.js'
import type { TaxYearInput } from './types.js'
import { simulatePlan } from './simulate.js'

const calc = createStateTaxCalculator()
const stateCalc = createStateTaxCalculator()
const taxCalculator = productionTaxCalculator()

function rothAccount(id: string, balance = 0, ownerPersonId = 'p1'): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    contributionBasis: 0,
  }
}

function cashFundedPlan(state: string, spending = 12_000) {
  const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90, state })
  plan.accounts = [cashAccount('cash', 200_000)]
  plan.expenses.baseAnnual = spending
  return plan
}

function fundedConversionPlan(state: string) {
  const plan = cashFundedPlan(state)
  plan.accounts.push(
    traditionalAccount('ira', 200_000, 'p1', 'ira'),
    rothAccount('roth'),
  )
  return plan
}

function simulateOneYear(plan: ReturnType<typeof singlePersonPlan>) {
  return simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator,
  }).years[0]!
}

function issueCodes(year: ReturnType<typeof simulateOneYear>): string[] {
  return year.taxComputation?.issues.map((issue) => issue.code) ?? []
}

function stateTaxOnly(year: ReturnType<typeof simulateOneYear>): number {
  const input = year.acceptedTaxInput
  if (input === undefined) throw new Error('acceptedTaxInput missing')
  return stateCalc.computeResult(input).amount
}

function directInput(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    state: 'CT',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

const ctExcludedIraDistribution: StateRetirementDistributionFact = {
  accountId: 'ira',
  ownerPersonId: 'p1',
  sourceKind: 'ira',
  federallyIncludedAmount: 5_000,
  recipientAgeYears: 70,
  cause: 'ordinary',
  earlyDistributionDisqualifier: 'false',
}

describe('simulate — Connecticut personal exemption zero materiality', () => {
  it('omits ct-personal-exemption-incomplete for cash-funded zero-taxable-income plans', () => {
    const year = simulateOneYear(cashFundedPlan('CT'))
    expect(year.tax).toBe(0)
    expect(stateTaxOnly(year)).toBe(0)
    expect(issueCodes(year)).not.toContain('ct-personal-exemption-incomplete')
    expect(year.taxComputation?.status).toBe('complete')
  })

  it('matches monetary results when Connecticut worksheet facts are later supplied', () => {
    const bare = simulateOneYear(cashFundedPlan('CT'))
    const plan = cashFundedPlan('CT')
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      connecticutAgi: 0,
    }]
    const withFacts = simulateOneYear(plan)
    expect(withFacts.tax).toBe(bare.tax)
    expect(withFacts.netWorth).toBeCloseTo(bare.netWorth, 6)
    expect(issueCodes(withFacts)).not.toContain('ct-personal-exemption-incomplete')
  })

  it('keeps ct-personal-exemption-incomplete when wage income is positive', () => {
    const plan = cashFundedPlan('CT', 0)
    plan.incomes = [recurringOrdinaryIncome('wages', 50_000)]
    const year = simulateOneYear(plan)
    expect(stateTaxOnly(year)).toBeGreaterThan(0)
    expect(issueCodes(year)).toContain('ct-personal-exemption-incomplete')
    expect(year.taxComputation?.status).toBe('incomplete')
  })

})

describe('simulate — Wisconsin standard deduction and personal exemption zero materiality', () => {
  it('keeps the Wisconsin worksheet warning off the zero baseline but on a conversion candidate', () => {
    const baselinePlan = fundedConversionPlan('WI')
    const baseline = simulateOneYear(baselinePlan)
    const candidatePlan = fundedConversionPlan('WI')
    candidatePlan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2026, amount: 100_000 }],
    }
    const candidate = simulateOneYear(candidatePlan)
    expect(candidate.rothConversion).toBeGreaterThan(0)
    expect(candidate.acceptedTaxInput?.stateRetirementDistributions?.some(
      (row) => row.sourceKind === 'ira' && row.federallyIncludedAmount > 0,
    )).toBe(true)
    expect(stateTaxOnly(candidate)).toBeGreaterThan(0)
    expect(baseline.tax).toBe(0)
    expect(issueCodes(baseline)).not.toContain('wi-standard-deduction-income-unknown')
    expect(baseline.taxComputation?.status).toBe('complete')
    expect(issueCodes(candidate)).toContain('wi-standard-deduction-income-unknown')
    expect(candidate.taxComputation?.status).toBe('incomplete')
  })

  it('omits wi-standard-deduction-income-unknown and exemption count warnings at zero taxable income', () => {
    const year = simulateOneYear(cashFundedPlan('WI'))
    expect(year.tax).toBe(0)
    expect(issueCodes(year)).not.toContain('wi-standard-deduction-income-unknown')
    expect(issueCodes(year)).not.toContain('wi-exemption-counts-unknown')
    expect(issueCodes(year)).not.toContain('wi-exemption-facts-unknown')
    expect(year.taxComputation?.status).toBe('complete')
  })

  it('matches monetary results when Wisconsin worksheet facts are later supplied', () => {
    const bare = simulateOneYear(cashFundedPlan('WI'))
    const plan = cashFundedPlan('WI')
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      wisconsinIncomeForStandardDeduction: 0,
      exemptionTaxpayerCount: 1,
      exemptionDependentCount: 0,
      claimedAsDependent: false,
    }]
    const withFacts = simulateOneYear(plan)
    expect(withFacts.tax).toBe(bare.tax)
    expect(withFacts.netWorth).toBeCloseTo(bare.netWorth, 6)
    expect(issueCodes(withFacts)).not.toContain('wi-standard-deduction-income-unknown')
  })

  it('keeps wi-standard-deduction-income-unknown when counts are supplied and wage income is positive', () => {
    const plan = cashFundedPlan('WI', 0)
    plan.incomes = [recurringOrdinaryIncome('wages', 50_000)]
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      exemptionTaxpayerCount: 1,
      exemptionDependentCount: 0,
      claimedAsDependent: false,
    }]
    const year = simulateOneYear(plan)
    expect(year.tax).toBeGreaterThan(0)
    expect(issueCodes(year)).toContain('wi-standard-deduction-income-unknown')
    expect(issueCodes(year)).not.toContain('wi-exemption-counts-unknown')
    expect(year.taxComputation?.status).toBe('incomplete')
  })

  it('keeps wi-exemption-counts-unknown when only the personal-exemption counts are absent at positive income', () => {
    const plan = cashFundedPlan('WI', 0)
    plan.incomes = [recurringOrdinaryIncome('wages', 50_000)]
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      wisconsinIncomeForStandardDeduction: 50_000,
      claimedAsDependent: false,
    }]
    const year = simulateOneYear(plan)
    expect(issueCodes(year)).toContain('wi-exemption-counts-unknown')
    expect(issueCodes(year)).not.toContain('wi-standard-deduction-income-unknown')
    expect(year.taxComputation?.status).toBe('incomplete')
  })
})

describe('simulate — Iowa alternate/minimum tax zero materiality', () => {
  it('omits ia-alternate-tax-incomplete for cash-funded zero-ordinary-tax plans', () => {
    const year = simulateOneYear(cashFundedPlan('IA'))
    expect(year.tax).toBe(0)
    expect(stateTaxOnly(year)).toBe(0)
    expect(issueCodes(year)).not.toContain('ia-alternate-tax-incomplete')
    expect(year.taxComputation?.status).toBe('complete')
  })

  it('matches monetary results when Iowa worksheet facts are later supplied', () => {
    const bare = simulateOneYear(cashFundedPlan('IA'))
    const plan = cashFundedPlan('IA')
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026,
      iowaTestNetIncome: 0,
      iowaClaimedAsDependent: false,
      iowaSeniorForThreshold: true,
      iowaSpouseNolCarryElection: false,
    }]
    const withFacts = simulateOneYear(plan)
    expect(withFacts.tax).toBe(bare.tax)
    expect(withFacts.netWorth).toBeCloseTo(bare.netWorth, 6)
    expect(issueCodes(withFacts)).not.toContain('ia-alternate-tax-incomplete')
  })

  it('keeps ia-alternate-tax-incomplete when ordinary tax is positive and test net income is missing', () => {
    const plan = cashFundedPlan('IA', 0)
    plan.incomes = [recurringOrdinaryIncome('wages', 50_000)]
    const year = simulateOneYear(plan)
    expect(stateTaxOnly(year)).toBeGreaterThan(0)
    expect(issueCodes(year)).toContain('ia-alternate-tax-incomplete')
    expect(year.taxComputation?.status).toBe('incomplete')
  })

})

describe('direct-call zero-materiality controls', () => {
  it('uses taxable plus accumulated adjustments, not raw wages alone, for the Connecticut bound', () => {
    const params = stateParamsFor('CT', 2026)!
    const wagesOffsetByExcludedRetirement = computeStateTaxableIncomeResult(
      params,
      directInput({ state: 'CT', ordinaryIncome: 5_000, agesAlive: [70] }),
      { retirementDistributions: [ctExcludedIraDistribution] },
    )
    const wagesOnly = computeStateTaxableIncomeResult(
      params,
      directInput({ state: 'CT', ordinaryIncome: 5_000, agesAlive: [70] }),
    )
    expect(wagesOffsetByExcludedRetirement.warnings.some((warning) => warning.code === 'ct-personal-exemption-incomplete')).toBe(false)
    expect(wagesOnly.warnings.some((warning) => warning.code === 'ct-personal-exemption-incomplete')).toBe(true)
  })

  it('retains Connecticut and Wisconsin relief warnings under a negative standardDeductionAllowedOverride', () => {
    const ct = computeStateTaxableIncomeResult(stateParamsFor('CT', 2026)!, directInput({ state: 'CT' }), {
      standardDeductionAllowedOverride: -1,
    })
    expect(ct.warnings.some((warning) => warning.code === 'ct-personal-exemption-incomplete')).toBe(true)

    const wi = computeStateTaxableIncomeResult(stateParamsFor('WI', 2026)!, directInput({ state: 'WI' }), {
      standardDeductionAllowedOverride: -1,
    })
    expect(wi.warnings.some((warning) => warning.code === 'wi-exemption-facts-unknown')).toBe(true)
  })

  it('contract: drops ia-alternate-tax-incomplete but stays incomplete when unknown source and military exclusion net to zero bracket tax', () => {
    const distributions: StateRetirementDistributionFact[] = [{
      accountId: 'p',
      ownerPersonId: 'p1',
      sourceKind: 'unknownPrivate',
      federallyIncludedAmount: 5_000,
      recipientAgeYears: 70,
      cause: 'ordinary',
      earlyDistributionDisqualifier: 'false',
    }, {
      accountId: 'm',
      ownerPersonId: 'p1',
      sourceKind: 'militaryRetirement',
      federallyIncludedAmount: 5_000,
      recipientAgeYears: 70,
      cause: 'ordinary',
      earlyDistributionDisqualifier: 'false',
    }]
    const result = calc.computeResult(directInput({
      state: 'IA',
      ordinaryIncome: 10_000,
      agesAlive: [70],
      stateRetirementDistributions: distributions,
    }))
    expect(result.amount).toBe(0)
    expect(result.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'ia-retirement-incomplete')).toBe(true)
    expect(result.status).toBe('incomplete')
  })

  it('contract: keeps ia-alternate-tax-incomplete when retirement distributions would zero tax but ordinary wages remain positive', () => {
    const distributions: StateRetirementDistributionFact[] = [{
      accountId: 'ira',
      ownerPersonId: 'p1',
      sourceKind: 'ira',
      federallyIncludedAmount: 50_000,
      recipientAgeYears: 70,
      cause: 'ordinary',
      earlyDistributionDisqualifier: 'false',
    }]
    const offsetOnly = calc.computeResult(directInput({
      state: 'IA',
      ordinaryIncome: 50_000,
      agesAlive: [70],
      stateRetirementDistributions: distributions,
    }))
    const wagesOnly = calc.computeResult(directInput({
      state: 'IA',
      ordinaryIncome: 50_000,
      agesAlive: [70],
    }))
    expect(offsetOnly.amount).toBe(0)
    expect(offsetOnly.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(false)
    expect(wagesOnly.amount).toBeGreaterThan(0)
    expect(wagesOnly.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(true)
  })
})
