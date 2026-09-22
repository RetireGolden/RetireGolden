import { expect, it } from 'vitest'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { buildRetirementAgeSuccessFrontier, buildSpendingSuccessFrontier } from './frontiers.js'
import type { SharedPathComparisonOptions } from './sharedPaths.js'

let counter = 0
const testIds = () => `b1p4-frontier-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

/** The worksheet's small real plan: one person retiring at 65 on $60,000 a year. */
function basePlan(baseAnnual: number): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 88, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.assumptions.heirTaxRatePct = 20
  plan.expenses.baseAnnual = baseAnnual
  plan.accounts = [taxable(650_000)]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * The smallest run the builders accept, on a fixed seed: the axis is the
 * caller's grid, so two paths are enough to produce the points and the run is
 * reproducible. Nothing else in the row participates in this record's claim.
 */
const frontierOptions: SharedPathComparisonOptions = {
  startYear: 2026,
  taxCalculator: createFlatTaxCalculator(0),
  model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 14 },
  pathCount: 2,
  seed: 123,
}

describeCalculation(
  'monte-carlo-stochastic-frontier-axis',
  {
    example: {
      inputs: {
        baseAnnual: 60_000,
        spendingMultipliers: [0.8, 1, 1.2],
        retirementAgeDeltas: [-2, 0, 3],
        retirementAge: 65,
        twoPersonAges: [65, 62],
        twoPersonDelta: 3,
        clampAge: 31,
        clampDelta: -2,
      },
      // The age axis is the lowest resulting retirement age (age + delta, clamped
      // to [30, 80]), not the delta: 63, 65, 68 for one person at 65.
      expected: {
        spendingX: [48_000, 60_000, 72_000],
        retirementAgeX: [63, 65, 68],
        twoPersonX: 65,
        clampX: 30,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-stochastic-frontier-axis.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-stochastic-frontier-axis.mutation.md',
  },
  ({ example }) => {
    const baseAnnual = example.inputs.baseAnnual as number
    const multipliers = example.inputs.spendingMultipliers as number[]
    const deltas = example.inputs.retirementAgeDeltas as number[]

    it('puts each spending variant\'s own base annual expense on the axis: 48,000, 60,000 and 72,000', () => {
      const points = buildSpendingSuccessFrontier(basePlan(baseAnnual), frontierOptions, multipliers)
      expect(points.map((point) => point.x)).toEqual(example.expected.spendingX)
    })

    const withRetirementAges = (ages: number[]): Plan => {
      const plan = basePlan(baseAnnual)
      const first = plan.household.people[0]!
      const people = ages.map((age, index) => ({ ...first, id: index === 0 ? first.id : `p${index + 1}`, name: index === 0 ? first.name : `Person ${index + 1}`, retirementAge: age }))
      const parsed = parsePlan({ ...plan, household: { ...plan.household, people } })
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      return parsed.plan
    }

    it('puts the resulting retirement age on the axis, not the delta: 63, 65 and 68 for one person at 65', () => {
      const points = buildRetirementAgeSuccessFrontier(withRetirementAges([example.inputs.retirementAge as number]), frontierOptions, deltas)
      expect(points.map((point) => point.x)).toEqual(example.expected.retirementAgeX)
    })

    it('takes the lowest resulting age across people: 65 for ages 65 and 62 moved by +3', () => {
      const points = buildRetirementAgeSuccessFrontier(withRetirementAges(example.inputs.twoPersonAges as number[]), frontierOptions, [example.inputs.twoPersonDelta as number])
      expect(points.map((point) => point.x)).toEqual([example.expected.twoPersonX])
    })

    it('clamps the resulting age to the floor of 30: 31 moved by -2 publishes 30', () => {
      const points = buildRetirementAgeSuccessFrontier(withRetirementAges([example.inputs.clampAge as number]), frontierOptions, [example.inputs.clampDelta as number])
      expect(points.map((point) => point.x)).toEqual([example.expected.clampX])
    })
  },
)
