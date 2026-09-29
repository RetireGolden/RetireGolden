import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { canonicalPeopleOrder } from '../model/peopleOrder.js'
import { describeCalculation, worksheetExpectedRows } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { DEFAULT_LTC_SHOCK } from './ltcShock.js'
import { createMarketModel } from './marketModels.js'
import { runMonteCarloPaths } from './run.js'

const WORKSHEET = 'DOCS/calculations/monte-carlo/monte-carlo-people-draw-order.md'
const MUTATION = 'DOCS/calculations/monte-carlo/monte-carlo-people-draw-order.mutation.md'
const rows = worksheetExpectedRows(WORKSHEET)
const expectedOrder = (label: string): string[] => rows.get(label)![0]!.split(',').map((name) => name.trim())

const person = (id: string, name: string, dob: string, sex: 'female' | 'male' | 'average') =>
  ({ id, name, dob, sex, retirementAge: 65, longevity: { planningAge: 92, source: 'manual' as const } })

const HOUSEHOLDS = {
  'Household A draw order': [person('lee', 'Lee', '1966-04-10', 'female'), person('ray', 'Ray', '1959-09-02', 'male')],
  'Household B draw order': [person('a', 'a', '1960-01-01', 'male'), person('z', 'z', '1960-01-01', 'female')],
  'Household C draw order': [person('a', 'a', '1960-01-01', 'male'), person('B', 'B', '1960-01-01', 'male')],
} as const

function planOf(people: readonly ReturnType<typeof person>[]): Plan {
  const plan = createEmptyPlan({ newId: () => 'draw-order', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [...people]
  plan.expenses.baseAnnual = 70_000
  plan.accounts = [{ type: 'taxable', id: 'brk', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1_100_000, costBasis: 900_000, annualContribution: 0 }]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function paths(plan: Plan, mode: 'longevity' | 'care') {
  return runMonteCarloPaths(plan, {
    startYear: 2026,
    taxCalculator: createFlatTaxCalculator(0.15),
    model: createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 }),
    seed: 20260928,
    pathCount: 25,
    stochasticLongevity: mode === 'longevity',
    ltcShock: mode === 'care' ? DEFAULT_LTC_SHOCK : null,
  }).paths.map((p) => [p.endingNetWorth, p.depletionYear])
}

describeCalculation(
  'monte-carlo-people-draw-order',
  {
    example: {
      inputs: {
        householdA: ['Lee 1966-04-10 female', 'Ray 1959-09-02 male'],
        householdB: ['a 1960-01-01 male', 'z 1960-01-01 female'],
        householdC: ['a 1960-01-01 male', 'B 1960-01-01 male'],
      },
      expected: Object.fromEntries([...rows].map(([label, cells]) => [label, cells[0]])),
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('orders by birth date, then the written sex order, then id by code unit', () => {
      for (const [label, people] of Object.entries(HOUSEHOLDS)) {
        expect(canonicalPeopleOrder(people).map((p) => p.name), label).toEqual(expectedOrder(label))
        expect(canonicalPeopleOrder([...people].reverse()).map((p) => p.name), label).toEqual(expectedOrder(label))
      }
    })

    it('draws the same deaths and care events whichever person is listed first', () => {
      const listed = planOf(HOUSEHOLDS['Household A draw order'])
      const reversed = planOf([...HOUSEHOLDS['Household A draw order']].reverse())
      for (const mode of ['longevity', 'care'] as const) {
        expect(paths(reversed, mode), mode).toEqual(paths(listed, mode))
      }
    })
  },
)
