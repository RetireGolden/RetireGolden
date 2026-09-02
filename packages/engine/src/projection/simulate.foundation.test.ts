import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { compareOptimizerExactLedgerResults } from './optimizerExactLedgerComparison.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  noTax,
  taxable,
  testIds,
  traditional,
  validate,
  wages,
} from './simulate.test-support.js'

describe('horizon and wages', () => {
  it('runs from startYear through the planning-age year', () => {
    const plan = basePlan()
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.startYear).toBe(2026)
    expect(result.endYear).toBe(1966 + 90)
    expect(result.years).toHaveLength(2056 - 2026 + 1)
  })

  it('publishes reserved Plan account IDs as own balance keys for exact comparison', () => {
    const plan = basePlan()
    plan.accounts = [{
      type: 'cash',
      id: '__proto__',
      name: 'Reserved ID cash',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 123,
      annualContribution: 0,
    }]
    const validatedPlan = validate(plan)
    const result = simulatePlan(validatedPlan, {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(Object.hasOwn(result.years[0]!.balances, '__proto__')).toBe(true)
    expect(result.years[0]!.balances.__proto__).toBe(123)
    expect(compareOptimizerExactLedgerResults(result, result, validatedPlan)
      ?.evaluatedAccountIds).toContain('__proto__')
  })

  it('pays wages until the retirement-age year, then stops', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.accounts = [cash(10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2032 = result.years.find((y) => y.year === 2032)! // age 66
    const y2033 = result.years.find((y) => y.year === 2033)! // age 67 = retirement
    expect(y2032.incomes.wages).toBe(100_000)
    expect(y2033.incomes.wages).toBe(0)
  })

  it('applies real salary growth on top of inflation', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 2
    const wageStream = wages(100_000)
    if (wageStream.type !== 'wages') throw new Error('expected wages stream')
    plan.incomes = [{ ...wageStream, realGrowthPct: 3 }]
    plan.accounts = [cash(10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2026)!.incomes.wages).toBeCloseTo(100_000, 6)
    expect(result.years.find((y) => y.year === 2027)!.incomes.wages).toBeCloseTo(100_000 * 1.03 * 1.02, 6)
  })
})

/**
 * Income survivorship: which income stops when, and at whose death.
 *
 * WHERE THE AUTHORITY COMES FROM, because it matters that it is not this PR.
 * The rule these tests pin was already shipped and already tested on the
 * SPENDING side: `expenses.oneTimeGoals` is skipped once nobody is alive, in
 * `describe('RMDs')`'s `skips one-time goals once everyone has died on an
 * extended horizon`, which predates any of this. `incomeFloor.test.ts` pins the
 * matching income-side reading for TIPS ladder cash, also pre-existing. Domain
 * rules reference §19 states the same thing in prose and accepts a cost to hold
 * it, declining to pay a period-certain annuity's remaining guaranteed years to
 * an estate. Those are the independent anchors; §19's wording was BROADENED in
 * the same PR as these tests, so it is codification rather than the source, and
 * the mirrored one-time-goal rule is what makes the income side non-arbitrary.
 */
describe('income survivorship', () => {
  it('skips one-time income once everyone has died on an extended horizon', () => {
    const plan = basePlan() // single person p1, born 1966
    plan.expenses.baseAnnual = 0
    plan.incomes = [
      { type: 'oneTime', id: 'alive', label: 'Sale while living', year: 2040, inflationAdjusted: false, amount: 100_000, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'dead', label: 'Sale after death', year: 2056, inflationAdjusted: false, amount: 100_000, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
      deathAgeByPersonId: { p1: 80 }, // dies at 80 (2046)
      horizonEndYear: 2066, // run to age 100, as a stochastic-longevity grid does
    })
    const yearOf = (year: number) => result.years.find((y) => y.year === year)!
    expect(yearOf(2040).incomes.oneTime).toBe(100_000) // alive: paid in full
    expect(yearOf(2056).incomes.oneTime).toBe(0) // post-death: not paid
    // …and it does not reach the estate by another route either: with no
    // spending, no return and no other flow after death, net worth is flat
    // across the year the ungated stream used to pay in.
    expect(yearOf(2066).netWorth).toBe(yearOf(2055).netWorth)
  })

  // THE GATE IS THE HOUSEHOLD'S, NOT ANY ONE PERSON'S, and a single-person
  // fixture cannot say that: with one person, "nobody is alive", "the primary
  // is dead" and "this person is dead" are the same predicate. A couple with a
  // survivor separates them. Recurring and one-time streams carry no
  // `personId` at all (DOCS/features/household-map.md), so there would be no
  // person to gate them against even if someone tried.
  it('keeps paying household income through survivor years, and stops at the last death', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      // Pat dies at 74 (end of 2040); Sam survives to 84 (end of 2050).
      { id: 'p1', name: 'Pat', dob: '1966-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 74, source: 'manual' } },
      { id: 'p2', name: 'Sam', dob: '1966-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 84, source: 'manual' } },
    ]
    plan.expenses.baseAnnual = 0
    // The regime markers, and deliberately not read off the ages. A one-time
    // GOAL is skipped once nobody is alive, and that rule shipped and was
    // tested before any of this work, so these two lines establish "someone is
    // alive in 2045" and "nobody is in 2055" from an INDEPENDENT behaviour
    // rather than from the assertion under test.
    plan.expenses.oneTimeGoals = [
      { id: 'survivor-marker', label: 'Survivor-year marker', year: 2045, amount: 1_000 },
      { id: 'nobody-marker', label: 'Post-death marker', year: 2055, amount: 1_000 },
    ]
    plan.incomes = [
      { type: 'oneTime', id: 'both-alive', label: 'Sale, both alive', year: 2035, inflationAdjusted: false, amount: 100_000, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'survivor', label: 'Sale, survivor only', year: 2045, inflationAdjusted: false, amount: 100_000, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'nobody', label: 'Sale, nobody left', year: 2055, inflationAdjusted: false, amount: 100_000, taxTreatment: 'ordinary' },
      { type: 'recurring', id: 'rent', label: 'Rental', annualAmount: 12_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax, horizonEndYear: 2060 })
    const yearOf = (year: number) => result.years.find((y) => y.year === year)!

    // Both alive, and the middle reading is the one that discriminates: 2045 is
    // AFTER Pat's death and BEFORE Sam's, so a gate keyed to the first death or
    // to the primary person would zero it.
    expect(yearOf(2035).incomes.oneTime).toBe(100_000)
    expect(yearOf(2045).incomes.oneTime).toBe(100_000)
    expect(yearOf(2055).incomes.oneTime).toBe(0)

    // The recurring leg reads the same gate, so both arms are pinned against
    // the same three regimes rather than only the arm this change touched.
    expect(yearOf(2035).incomes.recurring).toBe(12_000)
    expect(yearOf(2045).incomes.recurring).toBe(12_000)
    expect(yearOf(2055).incomes.recurring).toBe(0)

    // The regimes, from the independent marker rule: the survivor-year goal is
    // charged and the post-death one is not.
    expect(yearOf(2045).expenses.oneTimeGoals).toBe(1_000)
    expect(yearOf(2055).expenses.oneTimeGoals).toBe(0)
  })
})

describe('determinism', () => {
  it('produces identical results on repeated runs', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 2.5
    plan.assumptions.defaultReturnPct = 6
    plan.incomes = [
      wages(120_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2500, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.expenses.baseAnnual = 70_000
    plan.accounts = [cash(50_000), taxable(300_000, 200_000), traditional(800_000, 15_000)]
    const validated = validate(plan)
    const tax = createFlatTaxCalculator(18)

    const a = simulatePlan(validated, { startYear: 2026, taxCalculator: tax })
    const b = simulatePlan(validated, { startYear: 2026, taxCalculator: tax })
    expect(a).toEqual(b)
    expect(a.years.length).toBeGreaterThan(25)
  })
})
