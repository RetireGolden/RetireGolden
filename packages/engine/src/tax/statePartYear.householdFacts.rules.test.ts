/**
 * Household facts reach each slice of a split year. Until 2026-10-08 a slice
 * was priced without them, so it dropped every exemption and credit that
 * needs them, and the year was marked incomplete. Now a resident-period slice
 * (method (a)) takes the year's facts and prorates what they give by its
 * return's ratio, and an income-percentage slice (method (b)) takes the
 * full-year tax with them and prorates the whole by the income ratio.
 *
 * Each household is resident six months in the state and six in Texas, with
 * income spread evenly, so every ratio is one half. Each figure is worked by
 * hand from the pack's 2026 amounts; "before" is the months share without the
 * facts that the engine charged until this change.
 *
 *   state  before      after       what reaches the slice
 *   IL     2,475.00    2,402.606   the $2,925 exemption, by the income ratio
 *   MA     2,500.00    2,390.00    the $4,400 exemption, by the months
 *   CT       775.00      662.50    the personal exemption, through the ratio
 *   WI     2,232.3084  2,213.7584  the $700 exemption, through the ratio
 *   OR       588.1875    363.1875  the retirement income credit, after the ratio
 *   UT       445.00      220.00    the $450 retirement credit, through the ratio
 *   IA       188.10      100.00    the alternate tax, through the ratio
 */
import { describe, expect, it } from 'vitest'
import type { TaxYearInput } from '../projection/types.js'
import type { StateHouseholdTaxFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { computeStateTaxYearResult } from './stateTax.js'

function sixMonths(state: string, changes: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 100_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    agesAlive: [50],
    state,
    stateResidency: [{ state, months: 6 }, { state: 'TX', months: 6 }],
    ...changes,
  }
}

const pension = (amount: number, age: number): StateRetirementDistributionFact => ({
  accountId: 'pension', ownerPersonId: 'p1', sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: amount,
  recipientAgeYears: age, recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false',
})

const price = (input: TaxYearInput, householdFacts: StateHouseholdTaxFacts, rows?: StateRetirementDistributionFact[]) =>
  computeStateTaxYearResult(input, { householdFacts, ...(rows === undefined ? {} : { retirementDistributions: rows }) })

describe('household facts reach a resident-period slice, prorated by its return', () => {
  it('Illinois: the exemption allowance times Illinois base income over total base income', () => {
    // Schedule NR lines 48 and 50: $2,925 x (50,000 / 100,000) = 1,462.50.
    // (50,000 - 1,462.50) x 4.95% = 2,402.60625.
    const result = price(sixMonths('IL'), {
      stateFilingStatus: 'single', federalAgi: 100_000, exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
    })
    expect(result.totalTax).toBeCloseTo(2_402.60625, 6)
    expect(result.status).toBe('complete')
  })

  it('Massachusetts: the personal exemption by the months resident', () => {
    // Form 1-NR/PY: $4,400 x 6/12 = 2,200 (by days, here months).
    // (50,000 - 2,200) x 5% = 2,390.
    const result = price(sixMonths('MA'), { stateFilingStatus: 'single', age65EligibleCount: 0 })
    expect(result.totalTax).toBeCloseTo(2_390, 6)
    expect(result.status).toBe('complete')
  })
})

describe('household facts reach an income-percentage slice through the full-year tax', () => {
  it('Connecticut: the personal exemption on Connecticut AGI, then the ratio', () => {
    // $40,000 of income. Exemption: $15,000 less $1,000 for each $1,000 (or
    // part) of Connecticut AGI over $30,000: 15,000 - 10 x 1,000 = 5,000.
    // 35,000 taxable: 10,000 x 2% = 200; 25,000 x 4.5% = 1,125; 1,325. Half:
    // 662.50. Before, the slice had no exemption: half of 200 + 30,000 x 4.5%
    // = 1,550, 775.
    const result = price(sixMonths('CT', { ordinaryIncome: 40_000 }), { stateFilingStatus: 'single', connecticutAgi: 40_000 })
    expect(result.totalTax).toBeCloseTo(662.5, 6)
  })

  it('Wisconsin: the $700 exemption with the sliding deduction on the year, then the ratio', () => {
    // Deduction 13,960 - 0.12 x (100,000 - 20,120) = 4,374.40; exemption 700;
    // 94,925.60 taxable: 15,110 x 3.5% = 528.85; 36,840 x 4.4% = 1,620.96;
    // 42,975.60 x 5.3% = 2,277.7068; 4,427.5168. Half: 2,213.7584.
    const result = price(sixMonths('WI'), {
      stateFilingStatus: 'single', exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
      claimedAsDependent: false, wisconsinIncomeForStandardDeduction: 100_000,
    })
    expect(result.totalTax).toBeCloseTo(2_213.7584, 6)
    expect(result.status).toBe('complete')
  })

  it('Oregon: the ratio, then the retirement income credit on the Oregon-column pension', () => {
    // A single filer of 66: a $12,000 pension and $8,000 of interest, both
    // spread over the year. Tax: 20,000 - 2,910 = 17,090: 216.125 + 462.375 +
    // 5,690 x 8.75% = 497.875; 1,176.375. OR-40-P line 45: times the Oregon
    // percentage, 1/2: 588.1875. Lines 50 to 53 then subtract the standard
    // credits, the retirement income credit (OR-17, code 811) among them, on
    // the pension in the Oregon column, 6,000: 9% of the lesser of it and
    // $7,500 less Social Security (none) less household income over $15,000
    // (5,000), 9% x 2,500 = 225. 588.1875 - 225 = 363.1875. Before: 588.1875,
    // with the credit dropped.
    const result = price(sixMonths('OR', { ordinaryIncome: 20_000, agesAlive: [66], peopleAged65Plus: 1 }), {
      stateFilingStatus: 'single', oregonHouseholdIncome: 20_000, householdGrossSocialSecurity: 0, recipientSocialSecurity: [],
    }, [pension(12_000, 66)])
    expect(result.totalTax).toBeCloseTo(363.1875, 6)
    expect(result.status).toBe('complete')
  })

  it('Utah: the retirement credit for a claimant born before 1953, then the ratio', () => {
    // $20,000 of pension; 4.45% = 890. The $450 credit is not phased below
    // $25,000 of Utah MAGI: 890 - 450 = 440. Half: 220. Before: 445.
    const result = price(sixMonths('UT', { ordinaryIncome: 20_000, agesAlive: [73], peopleAged65Plus: 1 }), {
      stateFilingStatus: 'single', federalAgi: 20_000, interestExcludedFromFederalAgi: 0, utahSection59_10_114Additions: 0,
      socialSecurityIncludedInUtahTaxableIncome: 0, claimantDatesOfBirth: ['1952-06-01'], utahCreditElection: 'retirement',
    }, [pension(20_000, 73)])
    expect(result.totalTax).toBeCloseTo(220, 6)
  })

  it('Iowa: the alternate tax a single filer owes on test net income above $9,000, then the ratio', () => {
    // $26,000: (26,000 - 16,100) x 3.8% = 376.20. Test net income $9,200: the
    // lesser of 376.20 and 9,200 - 9,000 = 200. Half: 100. Before: 188.10.
    const result = price(sixMonths('IA', { ordinaryIncome: 26_000 }), {
      stateFilingStatus: 'single', iowaTestNetIncome: 9_200, iowaClaimedAsDependent: false,
    })
    expect(result.totalTax).toBeCloseTo(100, 6)
  })
})
