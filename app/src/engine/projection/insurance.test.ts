import { describe, expect, it } from 'vitest'

import {
  createEmptyPlan,
  parsePlan,
  type CareEvent,
  type InsurancePolicy,
  type Person,
  type Plan,
} from '../model/plan'
import { compareLtcStress } from './compare'
import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'

let counter = 0
const testIds = () => `ins-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function person(id: string, planningAge: number): Person {
  return { id, name: id, dob: '1966-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge, source: 'manual' } }
}

/** Single person, age 60 in 2026, planning to 90 (endYear 2056); flat dollars. */
function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = person('p1', 90)
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0 // so care costs stay in flat dollars
  plan.assumptions.defaultReturnPct = 0
  plan.accounts = [
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 1_000_000, annualContribution: 0 },
  ]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

function permLife(overrides: Partial<Extract<InsurancePolicy, { kind: 'permanentLife' }>> = {}): InsurancePolicy {
  return {
    kind: 'permanentLife',
    id: testIds(),
    name: 'Whole life',
    insured: 'p1',
    beneficiary: 'estate',
    annualPremium: 0,
    premiumMode: 'lifetime',
    deathBenefit: 0,
    cashValue: 0,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 0,
    ...overrides,
  }
}

function ltc(overrides: Partial<Extract<InsurancePolicy, { kind: 'ltc' }>> = {}): InsurancePolicy {
  return {
    kind: 'ltc',
    id: testIds(),
    name: 'LTC',
    owner: 'p1',
    annualPremium: 0,
    premiumMode: 'lifetime',
    benefitMonthly: 4_000,
    benefitPeriodYears: 'lifetime',
    eliminationPeriodDays: 0,
    ...overrides,
  }
}

function careEvent(overrides: Partial<CareEvent> = {}): CareEvent {
  return { id: testIds(), personId: 'p1', startAge: 85, durationYears: 3, annualCost: 60_000, ...overrides }
}

const yearOf = (result: ReturnType<typeof simulatePlan>, y: number) => result.years.find((r) => r.year === y)!

describe('insurance premiums', () => {
  it('charges level premiums every year while alive (not inflation-adjusted)', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 10 // premiums must stay level despite inflation
    plan.insurance = [permLife({ annualPremium: 5_000, premiumMode: 'lifetime' })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2026).expenses.insurancePremiums).toBe(5_000)
    expect(yearOf(result, 2050).expenses.insurancePremiums).toBe(5_000)
    // premiums are part of total spending
    expect(yearOf(result, 2026).expenses.total).toBeCloseTo(yearOf(result, 2026).expenses.baseSpending + 5_000, 2)
  })

  it("stops premiums at premiumEndAge for mode 'untilAge'", () => {
    const plan = basePlan()
    plan.insurance = [permLife({ annualPremium: 5_000, premiumMode: 'untilAge', premiumEndAge: 65 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2030).expenses.insurancePremiums).toBe(5_000) // age 64
    expect(yearOf(result, 2031).expenses.insurancePremiums).toBe(0) // age 65 — stopped
    expect(yearOf(result, 2040).expenses.insurancePremiums).toBe(0)
  })

  it("charges nothing for mode 'paidUp'", () => {
    const plan = basePlan()
    plan.insurance = [permLife({ annualPremium: 5_000, premiumMode: 'paidUp' })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2026).expenses.insurancePremiums).toBe(0)
  })
})

describe('permanent-life cash value', () => {
  it('compounds at the flat rate and counts toward net worth', () => {
    const plan = basePlan()
    plan.accounts = [] // isolate cash value in net worth
    plan.insurance = [permLife({ cashValue: 10_000, cashValueMode: 'flatRate', cashValueGrowthPct: 5 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2026).insuranceCashValue).toBeCloseTo(10_500, 2)
    expect(yearOf(result, 2027).insuranceCashValue).toBeCloseTo(11_025, 2)
    expect(yearOf(result, 2026).netWorth).toBeCloseTo(10_500, 2)
  })

  it('interpolates an illustration schedule by age', () => {
    const plan = basePlan()
    plan.accounts = []
    plan.insurance = [
      permLife({
        cashValue: 10_000,
        cashValueMode: 'schedule',
        cashValueGrowthPct: undefined,
        cashValueSchedule: [
          { age: 60, value: 10_000 },
          { age: 70, value: 30_000 },
        ],
      }),
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2026).insuranceCashValue).toBeCloseTo(10_000, 2) // age 60
    expect(yearOf(result, 2031).insuranceCashValue).toBeCloseTo(20_000, 2) // age 65, halfway
    expect(yearOf(result, 2036).insuranceCashValue).toBeCloseTo(30_000, 2) // age 70
    expect(yearOf(result, 2046).insuranceCashValue).toBeCloseTo(30_000, 2) // age 80, clamped
  })
})

describe('death benefit', () => {
  function couplePlan(): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [person('p1', 80), person('p2', 90)] // p1 dies first; p2 is the last survivor
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 500_000, annualContribution: 0 },
    ]
    return plan
  }

  it('pays the face amount on the insured death, income-tax-free', () => {
    const plan = couplePlan()
    plan.insurance = [permLife({ insured: 'p1', beneficiary: 'estate', deathBenefit: 100_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFlatTaxCalculator(25) })
    // p1's final alive year is 2046 (age 80); the benefit settles that year.
    expect(yearOf(result, 2045).deathBenefit).toBe(0)
    expect(yearOf(result, 2046).deathBenefit).toBe(100_000)

    // Income-tax-free: the only difference from a no-benefit run is the full
    // $100k (with 0% growth it persists), not $75k as a 25%-taxed receipt would.
    // Other costs (Medicare, etc.) are identical and cancel.
    const withoutBenefit = simulatePlan(
      validate({ ...plan, insurance: [permLife({ insured: 'p1', deathBenefit: 0 })] }),
      { startYear: 2026, taxCalculator: createFlatTaxCalculator(25) },
    )
    expect(result.endingNetWorth - withoutBenefit.endingNetWorth).toBeCloseTo(100_000, 2)
  })

  it('pays a single-person plan its benefit in the final year, into the estate', () => {
    // Regression: the benefit must land for the last survivor. A single person's
    // planning-age year is endYear, so paying at planningAge + 1 would lose it.
    const plan = basePlan() // p1 planningAge 90, endYear 2056
    plan.accounts = []
    plan.insurance = [permLife({ insured: 'p1', deathBenefit: 100_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2056).deathBenefit).toBe(100_000)
    expect(result.endingNetWorth).toBeCloseTo(100_000, 2)
  })

  it('pays the benefit on a policy held by the last survivor', () => {
    const plan = couplePlan() // p2 is the last survivor (planningAge 90 = endYear 2056)
    plan.insurance = [permLife({ insured: 'p2', deathBenefit: 100_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2056).deathBenefit).toBe(100_000)
  })

  it('never pays less than the accumulated cash value', () => {
    const plan = couplePlan()
    // Cash value ($100k, flat) exceeds the face amount ($50k): the beneficiary
    // should receive the cash value, not the smaller face.
    plan.insurance = [permLife({ insured: 'p1', deathBenefit: 50_000, cashValue: 100_000, cashValueGrowthPct: 0 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2046).deathBenefit).toBeCloseTo(100_000, 2)
  })

  it('pays the benefit exactly once', () => {
    const plan = couplePlan()
    plan.insurance = [permLife({ insured: 'p1', deathBenefit: 100_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const paid = result.years.filter((y) => y.deathBenefit > 0)
    expect(paid).toHaveLength(1)
    expect(paid[0]!.year).toBe(2046)
  })
})

describe('LTC care episode', () => {
  // basePlan: p1 age 85 in 2051; a startAge-85 episode spans 2051–2053.
  it('adds the care cost to spending during the episode (self-funded)', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ startAge: 85, durationYears: 3, annualCost: 60_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2050).expenses.careCost).toBe(0)
    expect(yearOf(result, 2051).expenses.careCost).toBe(60_000)
    expect(yearOf(result, 2053).expenses.careCost).toBe(60_000)
    expect(yearOf(result, 2054).expenses.careCost).toBe(0)
    expect(yearOf(result, 2051).expenses.ltcBenefit).toBe(0) // no policy
    expect(yearOf(result, 2051).expenses.total).toBeCloseTo(yearOf(result, 2050).expenses.total + 60_000, 2)
  })

  it('offsets the care cost up to the monthly benefit cap', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ annualCost: 60_000 })]
    plan.insurance = [ltc({ benefitMonthly: 4_000 })] // $48k/yr cap
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2051).expenses.careCost).toBe(60_000)
    expect(yearOf(result, 2051).expenses.ltcBenefit).toBe(48_000)
    // net out-of-pocket = 12k above the prior year
    expect(yearOf(result, 2051).expenses.total).toBeCloseTo(yearOf(result, 2050).expenses.total + 12_000, 2)
  })

  it('prorates the first episode year by the elimination period', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ annualCost: 60_000 })]
    plan.insurance = [ltc({ benefitMonthly: 4_000, eliminationPeriodDays: 90 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2051).expenses.ltcBenefit).toBeCloseTo(48_000 * (1 - 90 / 365), 2)
    expect(yearOf(result, 2052).expenses.ltcBenefit).toBe(48_000) // full thereafter
  })

  it('stops paying after the benefit period is exhausted', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ durationYears: 3, annualCost: 60_000 })]
    plan.insurance = [ltc({ benefitMonthly: 4_000, benefitPeriodYears: 2 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2051).expenses.ltcBenefit).toBe(48_000)
    expect(yearOf(result, 2052).expenses.ltcBenefit).toBe(48_000)
    expect(yearOf(result, 2053).expenses.ltcBenefit).toBe(0) // period used up
    expect(yearOf(result, 2053).expenses.careCost).toBe(60_000) // cost still hits
  })

  it('grows the benefit cap by the inflation rider', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ annualCost: 500_000 })] // large, so the cap binds
    plan.insurance = [ltc({ benefitMonthly: 4_000, inflationRiderPct: 5 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const expectedCap = 48_000 * Math.pow(1.05, 2051 - 2026)
    expect(yearOf(result, 2051).expenses.ltcBenefit).toBeCloseTo(expectedCap, 0)
  })

  it('charges no care cost once the person has died', () => {
    const plan = basePlan()
    // p1 dies after 2052 (age 86); p2 lives on so the projection continues.
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [person('p1', 86), person('p2', 95)]
    plan.careEvents = [careEvent({ personId: 'p1', startAge: 85, durationYears: 5, annualCost: 60_000 })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(yearOf(result, 2051).expenses.careCost).toBe(60_000) // age 85, alive
    expect(yearOf(result, 2052).expenses.careCost).toBe(60_000) // age 86, alive
    expect(yearOf(result, 2053).expenses.careCost).toBe(0) // p1 dead, episode would continue but doesn't
  })

  it('compares the de-risking value of the policy', () => {
    const plan = basePlan()
    plan.careEvents = [careEvent({ annualCost: 80_000, durationYears: 4 })]
    plan.insurance = [ltc({ benefitMonthly: 5_000, premiumMode: 'paidUp' })]
    const cmp = compareLtcStress(plan, { startYear: 2026, taxCalculator: noTax })
    expect(cmp.hasCareEvents).toBe(true)
    expect(cmp.hasLtcPolicy).toBe(true)
    // Care hurts the estate; the policy recovers part of it.
    expect(cmp.noCare.endingNetWorth).toBeGreaterThan(cmp.careUninsured.endingNetWorth)
    expect(cmp.careInsured.endingNetWorth).toBeGreaterThan(cmp.careUninsured.endingNetWorth)
    expect(cmp.careInsured.endingNetWorth).toBeLessThanOrEqual(cmp.noCare.endingNetWorth)
  })

  it('keeps the raw care shock premium-neutral and reports net-of-premiums value', () => {
    const withPremium = (annualPremium: number) => {
      const p = basePlan()
      p.careEvents = [careEvent({ annualCost: 60_000, durationYears: 3 })]
      p.insurance = [ltc({ benefitMonthly: 2_000, annualPremium, premiumMode: 'lifetime' })]
      return p
    }
    const opts = { startYear: 2026, taxCalculator: noTax }
    const cheap = compareLtcStress(withPremium(1_000), opts)
    const pricey = compareLtcStress(withPremium(40_000), opts)
    // noCare and careUninsured both strip LTC, so the premium difference can't
    // move the raw shock.
    const shock = (c: typeof cheap) => c.noCare.endingNetWorth - c.careUninsured.endingNetWorth
    expect(shock(cheap)).toBeCloseTo(shock(pricey), 2)
    // Premiums drag careInsured down, and can make the net policy value negative.
    expect(pricey.careInsured.endingNetWorth).toBeLessThan(cheap.careInsured.endingNetWorth)
    expect(pricey.careInsured.endingNetWorth - pricey.careUninsured.endingNetWorth).toBeLessThan(0)
  })
})

describe('insurance schema', () => {
  it('defaults insurance to [] when absent (no migration)', () => {
    const plan = basePlan() as Record<string, unknown>
    delete plan.insurance
    const r = parsePlan(plan)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.plan.insurance).toEqual([])
  })

  it("rejects premiumMode 'untilAge' without premiumEndAge", () => {
    const plan = basePlan()
    plan.insurance = [permLife({ premiumMode: 'untilAge' })] // no premiumEndAge
    expect(parsePlan(plan).ok).toBe(false)
  })

  it("rejects cashValueMode 'schedule' without a schedule", () => {
    const plan = basePlan()
    plan.insurance = [permLife({ cashValueMode: 'schedule', cashValueSchedule: undefined })]
    expect(parsePlan(plan).ok).toBe(false)
  })

  it('rejects an unknown insured person id', () => {
    const plan = basePlan()
    plan.insurance = [permLife({ insured: 'ghost' })]
    expect(parsePlan(plan).ok).toBe(false)
  })
})
