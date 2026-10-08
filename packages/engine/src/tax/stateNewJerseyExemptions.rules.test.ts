/**
 * New Jersey's personal exemptions, N.J.S.A. 54A:3-1 as amended by P.L.2019,
 * c.146: $1,000 for the taxpayer and a joint spouse, $1,000 for each 65 or
 * older at the close of the year, $1,000 for each blind or disabled, $6,000 for
 * each veteran. Expected amounts are hand calculations on the 2026 New Jersey
 * rate schedules the pack carries (single: 1.4% to 20,000, 1.75% to 35,000,
 * 3.5% to 40,000, 5.525% to 75,000; joint: 1.4% to 20,000, 1.75% to 50,000).
 */
import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import type { Account } from '../model/plan.js'
import type { TaxYearInput } from '../projection/types.js'
import { cashAccount, couplePlan, recurringOrdinaryIncome, runPlan, singlePersonPlan } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, createStateTaxCalculator } from './stateTax.js'
import type { StateHouseholdTaxFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'

const single = (ordinaryIncome: number, dob: string, facts: Partial<StateHouseholdTaxFacts> = {}, rows: StateRetirementDistributionFact[] = []) => {
  const input: TaxYearInput = { year: 2026, state: 'NJ', filingStatus: 'single', ordinaryIncome, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60] }
  return computeStateTaxYearResult(input, {
    retirementDistributions: rows, hsaAccounts: [], qcdEvents: [],
    householdFacts: { stateFilingStatus: 'single', federalAgi: ordinaryIncome, claimantDatesOfBirth: [dob], ...facts },
  })
}
const military = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  ownerPersonId: 'p1', sourceKind: 'militaryRetirement', federallyIncludedAmount: 30_000, recipientAgeYears: 66,
  cause: 'ordinary', earlyDistributionDisqualifier: 'false', ...change,
})

describeRule('nj-stat-54a-3-1-personal-exemptions', {
  readings: { withTheExemption: 1_214.75, noExemption: 1_270 },
  accepted: 'withTheExemption',
}, ({ accepted, readings }) => {
  it('takes $1,000 off a single filer at 60', () => {
    // 50,000 - 1,000 = 49,000: 1.4% x 20,000 = 280; 1.75% x 15,000 = 262.50;
    // 3.5% x 5,000 = 175; 5.525% x 9,000 = 497.25; total 1,214.75. With no
    // exemption, 50,000: 1,270.00.
    const year = single(50_000, '1966-01-01')
    expect(year.taxableIncome).toBe(49_000)
    expect(year.amount).toBeCloseTo(accepted, 6)
    expect(accepted).not.toBe(readings.noExemption)
  })
  it('adds $1,000 at 65 or older and $1,000 blind', () => {
    // 48,000: 280 + 262.50 + 175 + 5.525% x 8,000 = 442; 1,159.50.
    expect(single(50_000, '1960-01-01').amount).toBeCloseTo(1_159.5, 6)
    expect(single(50_000, '1966-01-01', { taxpayerEligibility: [{ personId: 'p1', blind: true }] }).amount).toBeCloseTo(1_159.5, 6)
    // Disability from a pension marked for a disabled recipient: the same
    // ,000, beside the 54A:6-10 exclusion of that recipient's 1,000 pension:
    // 50,000 - 1,000 - 1,000 - 1,000 = 47,000.
    const disabled: StateRetirementDistributionFact = { ownerPersonId: 'p1', sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: 1_000, recipientAgeYears: 60, recipientDisabled: true, cause: 'disability', earlyDistributionDisqualifier: 'false' }
    expect(single(50_000, '1966-01-01', {}, [disabled]).taxableIncome).toBe(47_000)
  })
  it('adds $6,000 for the owner of a military retirement pension, not for its survivor', () => {
    // At 66 with 30,000 of exempt military pay and 50,000 of other income:
    // 50,000 - 1,000 - 1,000 - 6,000 = 42,000; 280 + 262.50 + 175 + 5.525% x
    // 2,000 = 110.50; 828.00.
    const veteran = single(80_000, '1960-01-01', {}, [military()])
    expect(veteran.taxableIncome).toBe(42_000)
    expect(veteran.amount).toBeCloseTo(828, 6)
    expect(single(80_000, '1960-01-01', {}, [military({ cause: 'death' })]).taxableIncome).toBe(48_000)
    expect(single(80_000, '1960-01-01', {}, [military({ sourceKind: 'militarySurvivor' })]).taxableIncome).toBe(48_000)
  })
  it('takes two regular and two age exemptions for a joint couple both 66, through the projection', () => {
    // 50,000 - 4,000 = 46,000: 1.4% x 20,000 = 280; 1.75% x 26,000 = 455;
    // 735.00.
    const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1960-01-01', p1PlanningAge: 70, p2PlanningAge: 70, state: 'NJ' })
    plan.accounts = [cashAccount('cash', 50_000)]
    plan.incomes = [recurringOrdinaryIncome('income', 50_000, 2026)]
    const year = runPlan(plan, createStateTaxCalculator(), 2026).years[0]!
    expect(year.tax).toBeCloseTo(735, 6)
  })
  it('reads the veteran from a projected military pension', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 70, state: 'NJ' })
    plan.accounts = [cashAccount('cash', 50_000), {
      type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
      startAge: 60, monthlyAmount: 2_500, colaPct: 0, survivorPct: 0, source: 'militaryRetirement',
    } as Account]
    plan.incomes = [recurringOrdinaryIncome('income', 50_000, 2026)]
    expect(runPlan(plan, createStateTaxCalculator(), 2026).years[0]!.tax).toBeCloseTo(828, 6)
  })
})
