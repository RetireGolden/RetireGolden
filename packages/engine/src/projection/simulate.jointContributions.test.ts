/**
 * A jointly owned account belongs to the household, not to whoever is listed
 * first (decision D-PEOPLE-ORDER, rule R3): it takes contributions while
 * anyone is alive, its plain annual contribution while the household has
 * wages, and its schedule by the age of the person it names
 * (`contributionScheduleAgeOf`). Until schema v7 it read the first person's
 * wages, life and age, so listing the same household the other way round
 * moved its contributions.
 *
 * Hand-derived: no inflation, no returns, no tax, a cash buffer that funds
 * spending. Pat (p1, born 1966) retires at 60 (wages end after 2025, so no
 * wages from 2026) and plans to 62 (alive through 2028); Robin (p2, born 1970)
 * earns $80,000 to age 64 (wages through 2033) and plans to 90.
 */
import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { couplePlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const noTax = createFlatTaxCalculator(0)

function household(joint: Account, order: 'app' | 'reversed' = 'app'): Plan {
  const plan = couplePlan({ p1Dob: '1966-01-01', p2Dob: '1970-01-01', p1PlanningAge: 62, p2PlanningAge: 90, p1RetirementAge: 60, p2RetirementAge: 64 })
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 20_000
  plan.incomes = [
    { type: 'wages', id: 'w-robin', personId: 'p2', annualGross: 80_000, endAge: 64, realGrowthPct: 0 },
  ]
  plan.accounts = [
    { type: 'cash', id: 'buffer', name: 'Buffer', ownerPersonId: 'p2', annualReturnPct: 0, balance: 2_000_000, annualContribution: 0 },
    joint,
  ]
  if (order === 'reversed') plan.household.people = [...plan.household.people].reverse()
  return validatePlan(plan)
}

const jointCash: Account = { type: 'cash', id: 'joint', name: 'Joint savings', ownerPersonId: null, annualReturnPct: 0, balance: 0, annualContribution: 6_000 }

function contributionsByYear(plan: Plan): Record<number, number> {
  const result = simulatePlan(plan, { startYear: 2026, taxCalculator: noTax })
  return Object.fromEntries(result.years.map((y) => [y.year, y.balances['joint'] ?? 0]))
}

describe('joint contributions (D-PEOPLE-ORDER, R3)', () => {
  it('keeps contributing while the household has wages, after the first-listed person has stopped earning and died', () => {
    const balances = contributionsByYear(household(jointCash))
    // Robin earns 2026 through 2033 (ages 56 to 63): eight years of $6,000.
    expect(balances[2026]).toBe(6_000)
    expect(balances[2033]).toBe(48_000)
    // No household wages from 2034 (Robin 64): the plain contribution stops.
    expect(balances[2034]).toBe(48_000)
  })

  it('gives the same contributions whichever person is listed first', () => {
    expect(contributionsByYear(household(jointCash, 'reversed'))).toEqual(contributionsByYear(household(jointCash)))
  })

  it('covers joint equity compensation too', () => {
    const rsu: Account = { type: 'equityComp', id: 'joint', name: 'Joint RSUs', ownerPersonId: null, annualReturnPct: 0, balance: 0, costBasis: 0, annualContribution: 5_000, vestingMode: 'final', vestDate: null }
    const app = contributionsByYear(household(rsu))
    expect(app[2033]).toBe(40_000)
    expect(contributionsByYear(household(rsu, 'reversed'))).toEqual(app)
  })

  it('runs a joint schedule on the named person’s age while anyone is alive, with no wage test', () => {
    // $10,000 a year from Robin's 60 to 70: 2030 through 2040. Robin has no
    // wages from 2034, and the schedule keeps contributing (a schedule has no
    // wage test); Pat died after 2028, and it keeps contributing.
    const scheduled = (ageOf: string): Account => ({
      type: 'taxable', id: 'joint', name: 'Joint brokerage', ownerPersonId: null, annualReturnPct: 0, balance: 0, costBasis: 0, annualContribution: 0,
      contributionSchedule: [{ annualAmount: 10_000, fromAge: 60, toAge: 70, escalationPct: 0 }],
      contributionScheduleAgeOf: ageOf,
    })
    const robin = contributionsByYear(household(scheduled('p2')))
    expect(robin[2029]).toBe(0)
    expect(robin[2030]).toBe(10_000)
    expect(robin[2040]).toBe(110_000)
    expect(robin[2041]).toBe(110_000)
    expect(contributionsByYear(household(scheduled('p2'), 'reversed'))).toEqual(robin)
    // On Pat's age (60 in 2026 to 70 in 2036): the schedule keeps Pat's clock
    // after Pat dies (after 2028), because Robin is alive, like the spending
    // phases do.
    const pat = contributionsByYear(household(scheduled('p1')))
    expect(pat[2028]).toBe(30_000)
    expect(pat[2029]).toBe(40_000)
    expect(pat[2036]).toBe(110_000)
    expect(pat[2037]).toBe(110_000)
  })
})
