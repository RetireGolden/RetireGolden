/**
 * Virginia's age deduction (Va. Code 58.1-322.03(5)) through actual
 * simulatePlan years.
 *
 * The projection always hands the state calculator characterized retirement
 * rows, and from #710 (2026-09-13) Virginia's branch for those rows had no age
 * deduction, while the pack's $12,000 retirement cap sat on the coarse path the
 * projection no longer took: every projected Virginia year lost the deduction.
 * These fixtures run real plans and price the year the plan produced.
 *
 * Hand worksheet shared by every case (tax year 2026, married filing jointly,
 * both spouses born 1956-01-01 and so 70 at the end of the year):
 *   standard deduction 17,500 + exemptions 2 × 930 + 2 × 800 = 20,960
 *   (58.1-322.03(1)(b) and (2)); Virginia never adds Social Security.
 *   Age deduction, Form 760 Age 65 and Older Deduction Worksheet:
 *   AFAGI = federal AGI − taxable Social Security; excess over $75,000 comes
 *   once off the couple's 2 × 12,000.
 *   Brackets: 2% to 3,000, 3% to 5,000, 5% to 17,000, 5.75% above
 *   (3,000 × 2% + 2,000 × 3% + 12,000 × 5% = 720 through 17,000).
 */
import { describe, expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { createStateTaxCalculator, type StateTaxComputationResult } from '../tax/stateTax.js'
import {
  couplePlan,
  recurringOrdinaryIncome,
  socialSecurityIncome,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput } from './types.js'

const stateCalc = createStateTaxCalculator()
/** The same calculator, typed for the state detail its results carry. */
const stateDetail: { computeResult(input: TaxYearInput): StateTaxComputationResult } = stateCalc

function privatePension(id: string, ownerPersonId: string, annualAmount: number): Account {
  return {
    type: 'pension',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: annualAmount / 12,
    colaPct: 0,
    survivorPct: 0,
    source: 'private',
  } satisfies Extract<Account, { type: 'pension' }>
}

function virginiaCoupleBoth70() {
  return couplePlan({
    p1Dob: '1956-01-01',
    p2Dob: '1956-01-01',
    p1PlanningAge: 95,
    p2PlanningAge: 95,
    state: 'VA',
  })
}

function stateYear(plan: ReturnType<typeof couplePlan>) {
  const year = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: stateCalc,
  }).years[0]!
  const input = year.acceptedTaxInput
  if (input === undefined) throw new Error('acceptedTaxInput missing')
  return { year, input, result: stateDetail.computeResult(input) }
}

describe('simulate — Virginia age deduction (Va. Code 58.1-322.03(5))', () => {
  it('deducts $12,000 for each spouse of a couple both 70 under the $75,000 limit', () => {
    // Two private pensions of $30,000: federal AGI 60,000, no Social Security,
    // AFAGI 60,000, no excess, deduction 24,000.
    // Taxable 60,000 − 24,000 − 20,960 = 15,040.
    // Tax 3,000 × 2% + 2,000 × 3% + 10,040 × 5% = 60 + 60 + 502 = 622.00.
    // With no age deduction, as every projected year was from #710 to this
    // fix: taxable 39,040, tax 720 + 22,040 × 5.75% = 1,987.30.
    const plan = virginiaCoupleBoth70()
    plan.accounts = [privatePension('pension-a', 'p1', 30_000), privatePension('pension-b', 'p2', 30_000)]
    const { input, result } = stateYear(plan)
    expect(input.ordinaryIncome).toBe(60_000)
    expect(input.stateRetirementDistributions?.length).toBe(2)
    expect(result.taxableIncome).toBe(15_040)
    expect(result.amount).toBeCloseTo(622, 6)
    expect(result.status).toBe('complete')
  })

  it('deducts it from income that is not retirement income', () => {
    // $60,000 of other ordinary income and no retirement account at all:
    // the same 15,040 and 622.00. The pack's old retirement-income cap gave
    // this couple nothing (39,040 and 1,987.30).
    const plan = virginiaCoupleBoth70()
    plan.incomes = [recurringOrdinaryIncome('consulting', 60_000)]
    const { input, result } = stateYear(plan)
    expect(input.ordinaryIncome).toBe(60_000)
    expect(input.stateRetirementDistributions ?? []).toEqual([])
    expect(result.taxableIncome).toBe(15_040)
    expect(result.amount).toBeCloseTo(622, 6)
  })

  it('tests the joint AFAGI without the Social Security, whatever the benefits are', () => {
    // Pensions of $40,000 each: AFAGI is the $80,000 of non-Social-Security
    // income whatever the benefits, because line 7 takes the taxable benefits
    // back out of federal AGI. Excess 5,000, deduction 24,000 − 5,000 =
    // 19,000; taxable 80,000 − 19,000 − 20,960 = 40,040; tax 720 + 23,040 ×
    // 5.75% = 2,044.80. Testing federal AGI with the taxable benefits left in
    // would cut the deduction by every taxable dollar, and taking out the gross
    // benefits would raise it by the untaxed share: the preconditions below
    // make both of those differ from 40,040.
    const plan = virginiaCoupleBoth70()
    plan.accounts = [privatePension('pension-a', 'p1', 40_000), privatePension('pension-b', 'p2', 40_000)]
    plan.incomes = [socialSecurityIncome('ss-a', 2_000, 67, 'p1'), socialSecurityIncome('ss-b', 1_500, 67, 'p2')]
    const { input, result } = stateYear(plan)
    const facts = input.stateHouseholdFacts
    expect(input.ordinaryIncome).toBe(80_000)
    expect(input.ssBenefits).toBeGreaterThan(0)
    expect(facts?.federallyIncludedSocialSecurity).toBeGreaterThan(0)
    expect(facts?.federallyIncludedSocialSecurity).toBeLessThan(input.ssBenefits)
    expect(facts?.federalAgi).toBeCloseTo(80_000 + (facts?.federallyIncludedSocialSecurity ?? 0), 6)
    expect(result.taxableIncome).toBe(40_040)
    expect(result.amount).toBeCloseTo(2_044.8, 6)
  })
})
