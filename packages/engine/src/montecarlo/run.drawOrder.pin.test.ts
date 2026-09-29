/**
 * The documented draw order is older first (model/peopleOrder.ts), not merely
 * some order that ignores the list: younger-first would also survive every
 * reversal test, and survivor-years' published figures depend on which
 * person takes the path's first death draw and its first care draw (the
 * independent review's L4, mutant A10). The spies pass every call through, so
 * the paths are unchanged; they only record who was drawn for, in what order.
 */
import { describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { DEFAULT_LTC_SHOCK } from './ltcShock.js'
import { createMarketModel } from './marketModels.js'
import { runMonteCarloPaths } from './run.js'

const calls = vi.hoisted(() => ({ deathAges: [] as number[], careOrders: [] as string[][] }))

vi.mock('./mortality.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./mortality.js')>()
  return {
    ...original,
    sampleDeathAge: (...args: Parameters<typeof original.sampleDeathAge>) => {
      calls.deathAges.push(args[1])
      return original.sampleDeathAge(...args)
    },
  }
})

vi.mock('./ltcShock.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./ltcShock.js')>()
  return {
    ...original,
    sampleCareEvents: (...args: Parameters<typeof original.sampleCareEvents>) => {
      calls.careOrders.push(args[1].map((person) => person.id))
      return original.sampleCareEvents(...args)
    },
  }
})

function couple(order: 'younger-first' | 'older-first'): Plan {
  const plan = createEmptyPlan({ newId: () => 'draw-pin', now: () => new Date('2026-09-28T12:00:00.000Z') })
  // Lee (born 1966, the younger) is female, so the sex tie-break cannot stand
  // in for age: were the order by sex, Lee would still come first.
  const younger = { id: 'a-lee', name: 'Lee', dob: '1966-04-10', sex: 'female' as const, retirementAge: 62, longevity: { planningAge: 92, source: 'manual' as const } }
  const older = { id: 'z-ray', name: 'Ray', dob: '1959-09-02', sex: 'male' as const, retirementAge: 65, longevity: { planningAge: 88, source: 'manual' as const } }
  plan.household.people = order === 'younger-first' ? [younger, older] : [older, younger]
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.expenses.baseAnnual = 70_000
  plan.accounts = [{ type: 'taxable', id: 'brk', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1_100_000, costBasis: 900_000, annualContribution: 0 }]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(plan: Plan): void {
  runMonteCarloPaths(plan, {
    startYear: 2026,
    taxCalculator: createFlatTaxCalculator(0.15),
    model: createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 }),
    seed: 20260928,
    pathCount: 3,
    stochasticLongevity: true,
    ltcShock: DEFAULT_LTC_SHOCK,
  })
}

describe('the Monte Carlo draws go to the older person first (review L4, A10)', () => {
  for (const order of ['younger-first', 'older-first'] as const) {
    it(`listed ${order}: each path draws Ray's death (age 67 in 2026), then Lee's (60), and care for Ray, then Lee`, () => {
      calls.deathAges.length = 0
      calls.careOrders.length = 0
      run(couple(order))
      expect(calls.deathAges).toEqual([67, 60, 67, 60, 67, 60])
      expect(calls.careOrders).toEqual([['z-ray', 'a-lee'], ['z-ray', 'a-lee'], ['z-ray', 'a-lee']])
    })
  }
})
