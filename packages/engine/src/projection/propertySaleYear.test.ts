/**
 * A property sale dated before the projection starts runs in the first year,
 * and the carrying costs stop from that same year (decision D-2027-ROLLOVER,
 * review H1, 2026-09-29).
 *
 * Before the rule the ledger read the date two ways: the sale ran only in a
 * year equal to `plannedSaleYear`, which a later start never reaches, while
 * the carrying costs stopped for every year at or after it, so the house was
 * held to the end of the plan with its tax and insurance dropped. The test
 * pins the one reading: a sale dated 2026 in a plan run from 2027 is the same
 * projection as the sale dated 2027, apart from the warning that names it, on
 * both sale paths (the legacy expected-proceeds deposit and the exact-basis
 * sale tax). A debt whose payoff year has passed is paid in the first year
 * the same way (review L4), which the ledger already did; the test pins that
 * it now matches a payoff dated in the first year apart from its warning.
 *
 * Authority: none governs how a planner reads a sale or payoff date that has
 * passed; the decision chose the first-year reading (propertySaleYear.ts).
 */

import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  productionTaxCalculator,
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { effectivePropertySaleYear } from './propertySaleYear.js'
import { simulatePlan } from './simulate.js'

function household(home: Partial<Extract<Account, { type: 'property' }>>, payoffYear: number | null = null): Plan {
  const plan = singlePersonPlan({ dob: '1961-05-01', planningAge: 90, retirementAge: 65 })
  plan.accounts = [
    { ...taxableAccount('brokerage', 700_000, 500_000), name: 'Joint brokerage' },
    {
      type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: null,
      value: 420_000, plannedSaleYear: null, expectedNetProceeds: null,
      propertyTaxAnnual: 6_000, insuranceAnnual: 1_800,
      ...home,
    },
    {
      type: 'debt', id: 'mortgage', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null,
      balance: 180_000, interestPct: 6, monthlyPayment: 1_500, payoffYear,
    },
  ]
  plan.expenses.baseAnnual = 60_000
  // One id for every build, so two builds compare byte for byte.
  plan.id = 'plan'
  return validatePlan(plan)
}

const taxCalculator = productionTaxCalculator()
const run = (plan: Plan, startYear: number) => simulatePlan(plan, { startYear, taxCalculator })
const withoutWarnings = (result: ReturnType<typeof run>) => JSON.stringify({ ...result, warnings: [] })

describe('the year the ledger sells a property', () => {
  it('is the planned year, or the start year when the planned year is earlier; null with no sale', () => {
    expect(effectivePropertySaleYear({ plannedSaleYear: 2030 }, 2027)).toBe(2030)
    expect(effectivePropertySaleYear({ plannedSaleYear: 2027 }, 2027)).toBe(2027)
    expect(effectivePropertySaleYear({ plannedSaleYear: 2026 }, 2027)).toBe(2027)
    expect(effectivePropertySaleYear({ plannedSaleYear: null }, 2027)).toBeNull()
  })

  it.each([
    ['the expected-proceeds deposit', {}],
    ['the exact-basis sale tax', { costBasis: 250_000, primaryResidence: true }],
  ] as const)('sells a home dated 2026 in a 2027 run as if it were dated 2027 (%s)', (_path, home) => {
    const dated2026 = run(household({ ...home, plannedSaleYear: 2026 }), 2027)
    const dated2027 = run(household({ ...home, plannedSaleYear: 2027 }), 2027)
    expect(withoutWarnings(dated2026)).toBe(withoutWarnings(dated2027))
    // Sold in the first year: nothing left of the home, and no carrying cost.
    const first = dated2026.years[0]!
    expect(first.year).toBe(2027)
    expect(first.balances['home']).toBe(0)
    expect(first.expenses.propertyCosts).toBe(0)
    expect(dated2026.warnings).toContain(
      'The Home sale is dated 2026, before this plan starts in 2027, so the plan sells it in 2027. If it has already been sold, remove the Home and add the proceeds to an account.',
    )
    expect(dated2027.warnings.some((warning) => warning.startsWith('The Home sale is dated'))).toBe(false)
  })

  it('keeps the home and its carrying costs in a 2026 run until its 2026 sale, as before', () => {
    const result = run(household({ plannedSaleYear: 2026 }), 2026)
    expect(result.years[0]!.year).toBe(2026)
    expect(result.years[0]!.balances['home']).toBe(0)
    expect(result.years[0]!.expenses.propertyCosts).toBe(0)
    expect(result.warnings.some((warning) => warning.startsWith('The Home sale is dated'))).toBe(false)
  })

  it('pays a debt dated to be paid off in 2026 in a 2027 run as if the payoff were dated 2027', () => {
    const dated2026 = run(household({}, 2026), 2027)
    const dated2027 = run(household({}, 2027), 2027)
    expect(withoutWarnings(dated2026)).toBe(withoutWarnings(dated2027))
    expect(dated2026.years[0]!.balances['mortgage']).toBe(0)
    expect(dated2026.years[0]!.expenses.debtService).toBeCloseTo(190_800, 6)
    expect(dated2026.warnings).toContain(
      'The Mortgage payoff is dated 2026, before this plan starts in 2027, so the plan pays it off in 2027: $190,800, its $180,000 balance with a year of interest. If it was paid, set its balance to $0.',
    )
  })
})
