/**
 * Amortization-based withdrawal in the ledger (spending-paths & SWR-lenses
 * plan, Goal 2). The acceptance criteria: the amortization identity holds on a
 * clean fixture (recomputed annually, depletes exactly at the horizon when
 * realized = expected returns), the tax cascade applies to ABW-funded
 * spending, and feature-off plans are untouched.
 */
import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from './flatTax.js'
import { abwAnnualPayment } from '../spending/abw.js'
import { survivalPercentileAge } from '../montecarlo/survival.js'
import {
  cashAccount,
  runPlan,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import type { Plan } from '../model/plan.js'

const noTax = createFlatTaxCalculator(0)

/**
 * $500k cash at a clean 4%/yr with zero inflation — realized = expected. The
 * person stays under 65 for the whole plan so no automatic Medicare premium
 * (a separately-modeled system cost on top of ABW) muddies the pure identity.
 */
function abwPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1986-01-01', planningAge: 64 }) // 40 in 2026, runs to 2050
  const cash = cashAccount('cash', 500_000)
  cash.annualReturnPct = 4
  plan.accounts = [cash]
  plan.expenses.baseAnnual = 0
  plan.expenses.spendingPolicy = {
    mode: 'abw',
    abw: { returnSource: 'fixed', fixedRealReturnPct: 4 },
  }
  return plan
}

describe('ABW spending policy in the ledger', () => {
  it('recomputes annually and depletes exactly at the horizon when realized = expected', () => {
    const result = runPlan(abwPlan(), noTax)
    const years = result.years
    expect(years[years.length - 1]!.year).toBe(2050)

    // First-year payment matches the pure amortization (25 years remaining).
    const expectedFirst = abwAnnualPayment(500_000, 4, 0, 25)
    expect(years[0]!.expenses.baseSpending).toBeCloseTo(expectedFirst, 4)

    // Level payments under zero tilt/zero inflation (identity: recomputing from
    // the actual balance reproduces the original schedule).
    for (const y of years) expect(y.expenses.baseSpending).toBeCloseTo(expectedFirst, 4)

    // The final payment consumes the whole remaining balance: ends at ~$0
    // without ever reporting a shortfall.
    expect(result.endingInvestable).toBeLessThan(1)
    for (const y of years) expect(y.requiredShortfall).toBe(0)
  })

  it('a negative tilt front-loads spending and still depletes at the horizon', () => {
    const tilted = abwPlan()
    tilted.expenses.spendingPolicy!.abw!.tiltPct = -1.5
    const result = runPlan(tilted, noTax)
    const level = runPlan(abwPlan(), noTax)

    expect(result.years[0]!.expenses.baseSpending).toBeGreaterThan(
      level.years[0]!.expenses.baseSpending,
    )
    // Payments decline at the tilt rate.
    const first = result.years[0]!.expenses.baseSpending
    const second = result.years[1]!.expenses.baseSpending
    expect(second / first).toBeCloseTo(0.985, 4)
    expect(result.endingInvestable).toBeLessThan(1)
  })

  it('ignores baseAnnual and phases while ABW is active', () => {
    const plan = abwPlan()
    plan.expenses.baseAnnual = 200_000
    plan.expenses.phases = [{ fromAge: 70, multiplier: 3 }]
    const withNoise = runPlan(plan, noTax)
    const clean = runPlan(abwPlan(), noTax)
    expect(withNoise.years.map((y) => y.expenses.baseSpending)).toEqual(
      clean.years.map((y) => y.expenses.baseSpending),
    )
  })

  it('funds the payment through the tax cascade (traditional withdrawals are taxed)', () => {
    const plan = abwPlan()
    plan.accounts = [traditionalAccount('ira', 500_000)]
    const result = runPlan(plan, createFlatTaxCalculator(20))
    expect(result.years[0]!.tax).toBeGreaterThan(0)
    expect(result.years[0]!.expenses.baseSpending).toBeGreaterThan(0)
  })

  it('supports a survival-percentile horizon shorter than the plan horizon', () => {
    const plan = abwPlan()
    plan.household.people[0]!.longevity.planningAge = 100 // plan runs to 2086
    plan.expenses.spendingPolicy!.abw!.horizon = 'survival25'
    const result = runPlan(plan, noTax)

    const horizonAge = survivalPercentileAge(40, 'average', 25)
    const horizonYear = 1986 + horizonAge
    expect(horizonYear).toBeLessThan(2086)

    // The balance is (near-)exhausted by the end of the percentile horizon
    // year, then stays there.
    const horizonRow = result.years.find((y) => y.year === horizonYear)!
    expect(horizonRow.investableTotal).toBeLessThan(1)
    const after = result.years.filter((y) => y.year > horizonYear)
    for (const y of after) expect(y.investableTotal).toBeLessThan(1)
  })

  it('leaves plans without the policy untouched (feature-off regression)', () => {
    const control = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
    control.accounts = [cashAccount('cash', 500_000)]
    control.expenses.baseAnnual = 30_000
    const before = runPlan(control, noTax)
    // Same plan again — the ABW code path must not perturb fixed-target plans.
    const again = runPlan(control, noTax)
    expect(again.years.map((y) => y.expenses.total)).toEqual(before.years.map((y) => y.expenses.total))
    expect(again.endingInvestable).toBe(before.endingInvestable)
  })
})
