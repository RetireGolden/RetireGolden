/**
 * Worksheet materiality for CT, WI, and IA.
 *
 * Connecticut and Wisconsin use one coherent household per jurisdiction: federal ordinary
 * income includes explicitly modeled U.S.-government interest (`TaxYearInput.usGovernmentInterest`),
 * which the state calculator subtracts from the pre-deduction base. The correct worksheet fact
 * equals that coherent state base; a deliberately wrong federal-AGI proxy substitutes
 * pre-subtraction ordinary income for the same household. Varying a worksheet field without
 * reconciling it to that state base is an invalid whole-return counterfactual, not a second
 * legal return. Expected amounts are hand-calculated from cited statutes/instructions, not
 * copied from helper output.
 *
 * Iowa fixtures are an isolated alternate/minimum-tax leaf contract: `standardDeductionAllowedOverride`
 * 0 observes pre-deduction income and is not a completed low-income return. They pin transport
 * and formula sensitivity only; they do not certify whole-return dollars.
 */
import { describe, expect, it } from 'vitest'

import type { TaxYearInput } from '../projection/types.js'
import { createStateTaxCalculator } from './stateTax.js'
import type { StateHouseholdTaxFacts } from './stateRetirementFacts.js'

const calc = createStateTaxCalculator()

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

function household(over: Partial<StateHouseholdTaxFacts> = {}): StateHouseholdTaxFacts {
  return {
    stateFilingStatus: 'single',
    federalAgi: 0,
    federallyIncludedSocialSecurity: 0,
    householdGrossSocialSecurity: 0,
    householdGrossRailroadBenefits: 0,
    exemptionTaxpayerCount: 0,
    exemptionDependentCount: 0,
    age65EligibleCount: 0,
    section63fQualificationCount: 0,
    federalExemptionCount: { known: true, value: 1 },
    claimedAsDependent: false,
    ...over,
  }
}

describe('state worksheet materiality — Connecticut AGI', () => {
  // Coherent household: $50,000 ordinary including $15,000 U.S.-government interest → $35,000 CT base.
  const ordinaryIncome = 50_000
  const usGovernmentInterest = 15_000
  const coherentStateBase = ordinaryIncome - usGovernmentInterest
  const federalAgiProxy = ordinaryIncome
  const ctFacts = household({ stateFilingStatus: 'single', federalAgi: federalAgiProxy })

  it('keeps Connecticut personal exemption incomplete without Connecticut AGI', () => {
    const result = calc.computeResult(input({
      state: 'CT',
      ordinaryIncome,
      usGovernmentInterest,
      stateHouseholdFacts: ctFacts,
    }))
    expect(result.issues.some((issue) => issue.code === 'ct-personal-exemption-incomplete')).toBe(true)
    expect(result.status).toBe('incomplete')
  })

  it('prices correct Connecticut AGI versus a wrong federal-AGI proxy on the same household', () => {
    // Correct worksheet fact = coherent state base ($35,000).
    // §12-702(a)(2)(I): CT AGI $35,000 → $10,000 single exemption; taxable $25,000.
    // Tax: $10,000×2% + $15,000×4.5% = $875.
    // Wrong proxy: Connecticut AGI $50,000 (federal ordinary before U.S.-gov subtraction).
    // CT AGI $50,000 → $0 exemption after phase-out; taxable $35,000.
    // Tax: $10,000×2% + $25,000×4.5% = $1,325.
    const base = {
      state: 'CT',
      ordinaryIncome,
      usGovernmentInterest,
      stateHouseholdFacts: ctFacts,
    }
    const correctAgi = calc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...ctFacts, connecticutAgi: coherentStateBase },
    }))
    const wrongFederalAgiProxy = calc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...ctFacts, connecticutAgi: federalAgiProxy },
    }))
    expect(correctAgi.issues.some((issue) => issue.code === 'ct-personal-exemption-incomplete')).toBe(false)
    expect(wrongFederalAgiProxy.issues.some((issue) => issue.code === 'ct-personal-exemption-incomplete')).toBe(false)
    expect(correctAgi.amount).toBeCloseTo(875, 6)
    expect(wrongFederalAgiProxy.amount).toBeCloseTo(1_325, 6)
    expect(wrongFederalAgiProxy.amount - correctAgi.amount).toBeCloseTo(450, 6)
    expect(correctAgi.status).toBe('complete')
    expect(wrongFederalAgiProxy.status).toBe('complete')
    expect(coherentStateBase - federalAgiProxy).toBeLessThan(0)
  })

  it('accepts Connecticut AGI at the phase-out start as sufficient for a complete result', () => {
    const result = calc.computeResult(input({
      state: 'CT',
      ordinaryIncome,
      usGovernmentInterest,
      stateHouseholdFacts: { ...ctFacts, connecticutAgi: 30_000 },
    }))
    expect(result.issues.some((issue) => issue.code === 'ct-personal-exemption-incomplete')).toBe(false)
    expect(result.status).toBe('complete')
    // Isolated exemption-boundary contract: $35,000 base − $15,000 exemption.
    // The public result exposes tax: $10,000×2% + $10,000×4.5% = $650.
    expect(result.amount).toBeCloseTo(650, 6)
  })
})

describe('state worksheet materiality — Wisconsin standard-deduction income', () => {
  // Coherent household: $50,000 ordinary including $30,000 U.S.-government interest → $20,000 WI base.
  const ordinaryIncome = 50_000
  const usGovernmentInterest = 30_000
  const coherentStateBase = ordinaryIncome - usGovernmentInterest
  const federalAgiProxy = ordinaryIncome
  // Form 1-ES: claimed-as-dependent status suppresses the $700 personal exemption.
  const wiFacts = household({
    stateFilingStatus: 'single',
    federalAgi: federalAgiProxy,
    exemptionTaxpayerCount: 0,
    claimedAsDependent: true,
  })

  it('keeps Wisconsin standard deduction incomplete without the worksheet income line', () => {
    const result = calc.computeResult(input({
      state: 'WI',
      ordinaryIncome,
      usGovernmentInterest,
      stateHouseholdFacts: wiFacts,
    }))
    expect(result.issues.some((issue) => issue.code === 'wi-standard-deduction-income-unknown')).toBe(true)
    expect(result.status).toBe('incomplete')
  })

  it('prices correct Wisconsin income versus a wrong federal-AGI proxy on the same household', () => {
    // Correct worksheet line = coherent state base ($20,000) → $13,960 maximum SD.
    // Taxable $6,040: $6,040×3.5% = $211.40.
    // Wrong proxy: Wisconsin income $50,000 (federal ordinary before U.S.-gov subtraction).
    // SD $13,960 − 12%×($50,000 − $20,120) = $10,374.40; taxable $9,625.60.
    // Tax: $9,625.60×3.5% = $336.90.
    const base = { state: 'WI', ordinaryIncome, usGovernmentInterest, stateHouseholdFacts: wiFacts }
    const correctWorksheet = calc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...wiFacts, wisconsinIncomeForStandardDeduction: coherentStateBase },
    }))
    const wrongFederalAgiProxy = calc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...wiFacts, wisconsinIncomeForStandardDeduction: federalAgiProxy },
    }))
    expect(correctWorksheet.issues.some((issue) => issue.code === 'wi-standard-deduction-income-unknown')).toBe(false)
    expect(wrongFederalAgiProxy.issues.some((issue) => issue.code === 'wi-standard-deduction-income-unknown')).toBe(false)
    expect(correctWorksheet.amount).toBeCloseTo(211.4, 2)
    expect(wrongFederalAgiProxy.amount).toBeCloseTo(336.9, 2)
    expect(wrongFederalAgiProxy.amount - correctWorksheet.amount).toBeCloseTo(125.5, 2)
    expect(correctWorksheet.status).toBe('complete')
    expect(wrongFederalAgiProxy.status).toBe('complete')
  })

  it('accepts Wisconsin income through the full-deduction band as sufficient for a complete result', () => {
    const result = calc.computeResult(input({
      state: 'WI',
      ordinaryIncome,
      usGovernmentInterest,
      stateHouseholdFacts: { ...wiFacts, wisconsinIncomeForStandardDeduction: 20_119 },
    }))
    expect(result.issues.some((issue) => issue.code === 'wi-standard-deduction-income-unknown')).toBe(false)
    expect(result.status).toBe('complete')
    // $20,000 base − $13,960 maximum deduction = $6,040 at 3.5%.
    expect(result.amount).toBeCloseTo(211.4, 6)
  })
})

describe('state worksheet materiality — Iowa alternate/minimum tax (isolated leaf contract)', () => {
  // `standardDeductionAllowedOverride: 0` is not a legal claim for a completed MFJ return; production
  // federal-conforming SD would zero tax at this income. Pins alternate/minimum comparison only.
  const iowaCalc = createStateTaxCalculator({ standardDeductionAllowedOverride: 0 })
  const ordinaryIncome = 14_000
  const iowaFacts = household({
    stateFilingStatus: 'marriedFilingJointly',
    federalAgi: ordinaryIncome,
    iowaClaimedAsDependent: false,
    iowaSeniorForThreshold: false,
    iowaSpouseNolCarryElection: false,
  })

  it('keeps Iowa alternate/minimum tax incomplete without test net income', () => {
    const result = iowaCalc.computeResult(input({
      state: 'IA',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome,
      stateHouseholdFacts: iowaFacts,
    }))
    expect(result.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(true)
    expect(result.status).toBe('incomplete')
    // Ordinary 3.8% tax retained while worksheet facts are unknown.
    expect(result.amount).toBeCloseTo(532, 6)
  })

  it('prices different Iowa test net income at the same ordinary income (leaf contract)', () => {
    // Iowa Code §422.5(2)–(3): MFJ ordinary tax $14,000×3.8% = $532 (override isolates pre-SD base).
    // Test net $13,500 (joint threshold) → alternate tax $0 → zero tax at threshold.
    // Test net $14,000 → 4.3%×$500 excess = $21.50 alternate tax due.
    const base = {
      state: 'IA',
      filingStatus: 'marriedFilingJointly' as const,
      ordinaryIncome,
      stateHouseholdFacts: iowaFacts,
    }
    const atThreshold = iowaCalc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...iowaFacts, iowaTestNetIncome: 13_500 },
    }))
    const aboveThreshold = iowaCalc.computeResult(input({
      ...base,
      stateHouseholdFacts: { ...iowaFacts, iowaTestNetIncome: 14_000 },
    }))
    expect(atThreshold.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(false)
    expect(aboveThreshold.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(false)
    expect(atThreshold.amount).toBe(0)
    expect(aboveThreshold.amount).toBeCloseTo(21.5, 6)
    expect(atThreshold.status).toBe('complete')
    expect(aboveThreshold.status).toBe('complete')
  })

  it('accepts Iowa test net income at the joint threshold as sufficient for a complete zero-tax result', () => {
    const result = iowaCalc.computeResult(input({
      state: 'IA',
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome,
      stateHouseholdFacts: { ...iowaFacts, iowaTestNetIncome: 13_500 },
    }))
    expect(result.issues.some((issue) => issue.code === 'ia-alternate-tax-incomplete')).toBe(false)
    expect(result.status).toBe('complete')
    expect(result.amount).toBe(0)
  })
})
