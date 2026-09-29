/**
 * Premium-credit contracts through the whole ledger (decisions
 * D-EXAMPLE-SOURCE-SWITCH and D-ACA-CONTRACT-PATHS, 2026-09-28).
 *
 * 1. A plan's provenance changes nothing: `exampleSourceId` is never read, on
 *    the deterministic projection or on a Monte Carlo path. Before the
 *    decision the engine dropped a contract whose premiums differed from the
 *    premium field grown at the run's inflation, whenever the field was set.
 * 2. A 'premiumField' contract prices each run's own healthcare inflation.
 * 3. A 'stated' contract stops charging a covered member who has died, from 1
 *    January of the year after the death, and its stale tax family leaves the
 *    year's credit unpriced.
 * Expected dollars are hand arithmetic from those rules.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { createMarketModel } from '../montecarlo/marketModels.js'
import { runMonteCarloPaths } from '../montecarlo/run.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'

const FACTS = {
  taxExemptInterest: { state: 'notApplicable' as const, amount: null },
  foreignExclusionAddback: { state: 'notApplicable' as const, amount: null },
  assertions: {
    coverageEligibility: 'supported' as const,
    form8814: 'notApplicable' as const,
    specialAllocation: 'notApplicable' as const,
    marriedFilingSeparatelyException: 'notApplicable' as const,
    selfEmployedHealthInsuranceDeduction: 'notApplicable' as const,
    otherMaterialFacts: 'none' as const,
  },
}

function run(plan: Plan, extra: Partial<SimulateOptions> = {}) {
  return simulatePlan(validatePlan(plan), { startYear: 2026, taxCalculator: productionTaxCalculator(), ...extra })
}

function yearOf(result: ReturnType<typeof run>, year: number) {
  const row = result.years.find((entry) => entry.year === year)
  if (row === undefined) throw new Error(`no year ${year}`)
  return row
}

/** A 60-year-old single filer with $1,000 premium-field contracts for 2026 and 2027. */
function premiumFieldPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
  plan.accounts = [cashAccount('cash', 500_000)]
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.healthcareExtraInflationPct = 2
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 1_000,
    applyAcaCredit: true,
    medicareExtrasMonthlyPerPerson: 0,
    acaYears: [
      { year: 2026, premiumBasis: 'premiumField', ...FACTS },
      { year: 2027, premiumBasis: 'premiumField', ...FACTS },
    ],
  }
  return plan
}

describe('exampleSourceId is provenance only', () => {
  // A stated contract at $1,000 a month while the premium field says $500:
  // the old switch refused exactly this contract when the field was present.
  function statedPlan(): Plan {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
    plan.accounts = [cashAccount('cash', 500_000)]
    setAcaYearContract(plan, { year: 2026, monthlyEnrollment: 1_000 })
    setAcaYearContract(plan, { year: 2027, monthlyEnrollment: 1_000 })
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 500
    return plan
  }

  it('gives the same projection with and without the field, on either basis and on an inflation path', () => {
    for (const build of [statedPlan, premiumFieldPlan]) {
      for (const extra of [{}, { market: { inflationPct: [4, 1, 3, 2] } }]) {
        const without = build()
        const withField = structuredClone(without)
        withField.exampleSourceId = 'early-retiree-aca'
        expect(run(withField, extra)).toStrictEqual(run(without, extra))
      }
    }
    // The stated contract is priced as stated: 12 x 1,000 in 2027.
    const stated = statedPlan()
    stated.exampleSourceId = 'early-retiree-aca'
    expect(yearOf(run(stated, { market: { inflationPct: [4, 1] } }), 2027).aca?.grossEnrollmentPremium).toBe(12_000)
  })

  it('gives the same Monte Carlo paths with and without the field', () => {
    const paths = (plan: Plan) =>
      runMonteCarloPaths(validatePlan(plan), {
        startYear: 2026,
        taxCalculator: productionTaxCalculator(),
        model: createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 }),
        seed: 0x5eeded,
        pathCount: 6,
        stochasticLongevity: true,
      })
    const without = statedPlan()
    const withField = structuredClone(without)
    withField.exampleSourceId = 'all-401k-no-bridge'
    expect(paths(withField)).toStrictEqual(paths(without))
  })
})

describe('a premiumField contract prices the run\'s own healthcare inflation', () => {
  it('grows the premium field by the plan\'s rates on the projection and by the path\'s on a Monte Carlo path', () => {
    // Plan rates: 2.5% inflation + 2% healthcare extra, so 2027 is 1,000 x
    // 1.045 = 1,045 a month, 12,540 a year. A path with 3% inflation in 2026:
    // 1,000 x 1.05 = 1,050 a month, 12,600 a year. The benchmark equals the
    // premium. 2026 is the start year: 12,000 on both.
    const deterministic = run(premiumFieldPlan())
    const path = run(premiumFieldPlan(), { market: { inflationPct: [3, 3, 3] } })
    for (const [result, expected2027] of [[deterministic, 12_540], [path, 12_600]] as const) {
      expect(yearOf(result, 2026).aca?.grossEnrollmentPremium).toBeCloseTo(12_000, 9)
      const aca = yearOf(result, 2027).aca!
      expect(aca.premiumBasis).toBe('premiumField')
      expect(aca.grossEnrollmentPremium).toBeCloseTo(expected2027, 9)
      expect(aca.applicableSlcspPremium).toBeCloseTo(expected2027, 9)
      expect(aca.taxFamilySize).toBe(1)
      expect(aca.supportCodes).not.toContain('missing-year-contract')
    }
  })
})

describe('a premiumField contract keeps the facts it stores', () => {
  // Review finding M3 (F15, F16): the assertions, tax-exempt interest and
  // foreign exclusion are the only facts a premium-field contract stores, and
  // the year is refused or priced on them as for any contract.
  it('refuses a year whose stored assertion is unsupported, and adds stored tax-exempt interest to the credit income', () => {
    const unsupported = premiumFieldPlan()
    unsupported.expenses.healthcare.acaYears![1] = {
      year: 2027,
      premiumBasis: 'premiumField',
      ...FACTS,
      assertions: { ...FACTS.assertions, coverageEligibility: 'unsupported' },
    }
    const refused = yearOf(run(unsupported), 2027).aca!
    expect(refused.supportCodes).toContain('coverage-eligibility-unsupported')
    expect(refused.readiness).toBe('nonActionable')
    expect(yearOf(run(unsupported), 2026).aca!.supportCodes).not.toContain('coverage-eligibility-unsupported')

    const interest = premiumFieldPlan()
    interest.incomes = [recurringOrdinaryIncome('pension', 30_000)]
    const withoutInterest = yearOf(run(interest), 2026).aca!
    interest.expenses.healthcare.acaYears![0] = {
      year: 2026,
      premiumBasis: 'premiumField',
      ...FACTS,
      taxExemptInterest: { state: 'known', amount: 4_000 },
    }
    const withInterest = yearOf(run(interest), 2026).aca!
    expect(withInterest.magiComponents.taxExemptInterest).toBe(4_000)
    expect(withoutInterest.magiComponents.taxExemptInterest).toBe(0)
    expect(withInterest.householdMagi! - withoutInterest.householdMagi!).toBeCloseTo(4_000, 6)
    expect(withInterest.modeledAllowablePtc!).toBeLessThan(withoutInterest.modeledAllowablePtc!)
  })
})

describe('a stated contract stops charging a member who has died', () => {
  // Pat and Robin are 60 in 2026, both covered at $700 a month in 2026 and
  // 2027 by a stated contract. Robin's death age is 60, so Robin is alive
  // through 2026 and not in 2027.
  function couple(): Plan {
    const plan = couplePlan({ p1Dob: '1966-01-01', p2Dob: '1966-01-01', p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.accounts = [cashAccount('cash', 500_000)]
    setAcaYearContract(plan, { year: 2026, monthlyEnrollment: 700 })
    setAcaYearContract(plan, { year: 2027, monthlyEnrollment: 700 })
    return plan
  }

  it('charges both in the death year and only the survivor after it, and leaves that year unpriced', () => {
    const result = run(couple(), { deathAgeByPersonId: { p2: 60 } })
    // 2026: both alive, 2 x 12 x 700 = 16,800.
    expect(yearOf(result, 2026).aca?.grossEnrollmentPremium).toBe(16_800)
    // 2027: Robin is charged nothing, 12 x 700 = 8,400 (not 16,800).
    const aca2027 = yearOf(result, 2027).aca!
    expect(aca2027.grossEnrollmentPremium).toBe(8_400)
    expect(aca2027.premiumBasis).toBe('stated')
    // The stated family still names Robin: the year is not priced.
    expect(aca2027.supportCodes).toContain('tax-family-member-unknown')
    expect(aca2027.readiness).toBe('nonActionable')
    expect(yearOf(result, 2027).expenses.healthcare).toBe(8_400)
    expect(aca2027.coveredMembers.find((member) => member.personId === 'p2')).toMatchObject({
      coveredMonths: [],
      grossEnrollmentPremium: 0,
    })
  })

  it('charges both in every year when nobody dies', () => {
    const result = run(couple())
    expect(yearOf(result, 2027).aca?.grossEnrollmentPremium).toBe(16_800)
  })
})
