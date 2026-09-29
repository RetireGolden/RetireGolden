import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { DEFAULT_LTC_SHOCK } from './ltcShock.js'
import { createMarketModel } from './marketModels.js'
import { runMonteCarloPaths } from './run.js'

/** A couple whose first-listed person is the younger, as survivor-years lists them. */
function couple(order: 'younger-first' | 'older-first'): Plan {
  const plan = createEmptyPlan({ newId: () => 'mc-order', now: () => new Date('2026-06-11T00:00:00.000Z') })
  const younger = { id: 'y', name: 'Lee', dob: '1966-04-10', sex: 'female' as const, retirementAge: 62, longevity: { planningAge: 92, source: 'manual' as const } }
  const older = { id: 'o', name: 'Ray', dob: '1959-09-02', sex: 'male' as const, retirementAge: 65, longevity: { planningAge: 88, source: 'manual' as const } }
  plan.household.people = order === 'younger-first' ? [younger, older] : [older, younger]
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.expenses.baseAnnual = 70_000
  plan.accounts = [{ type: 'taxable', id: 'brk', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1_100_000, costBasis: 900_000, annualContribution: 0 }]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function paths(plan: Plan, mode: { stochasticLongevity?: boolean; ltcShock?: typeof DEFAULT_LTC_SHOCK }) {
  return runMonteCarloPaths(plan, {
    startYear: 2026,
    taxCalculator: createFlatTaxCalculator(0.15),
    model: createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 }),
    seed: 20260928,
    pathCount: 40,
    ...mode,
  }).paths.map((p) => ({ ending: p.endingNetWorth, investable: Array.from(p.investableByYear) }))
}

describe('Monte Carlo death and care draws follow the canonical people order (D-PEOPLE-ORDER, R5)', () => {
  it('draws the same paths whichever person is listed first, with longevity and with care shocks', () => {
    for (const mode of [{ stochasticLongevity: true }, { ltcShock: DEFAULT_LTC_SHOCK }, { stochasticLongevity: true, ltcShock: DEFAULT_LTC_SHOCK }]) {
      expect(paths(couple('younger-first'), mode)).toEqual(paths(couple('older-first'), mode))
    }
  })
})
