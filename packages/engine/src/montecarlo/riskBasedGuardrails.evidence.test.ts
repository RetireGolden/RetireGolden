import { expect, it } from 'vitest'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { solveRiskBasedGuardrails, startingInvestableOf } from './riskBasedGuardrails.js'

let counter = 0
const testIds = () => `b1p4-mc-${++counter}`
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

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function home(value: number): Account {
  return {
    type: 'property',
    id: testIds(),
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
  }
}

function planOf(accounts: Account[]): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.accounts = accounts
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'risk-based-starting-investable',
  {
    example: {
      inputs: { taxable: 100_000, cash: 20_000, home: 300_000 },
      expected: { startingInvestable: 120_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.md',
    mutation: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.mutation.md',
  },
  ({ example }) => {
    it('sums taxable $100,000 and cash $20,000; the $300,000 home is excluded', () => {
      const plan = planOf([
        taxable(example.inputs.taxable as number),
        cash(example.inputs.cash as number),
        home(example.inputs.home as number),
      ])
      expect(startingInvestableOf(plan)).toBe(example.expected.startingInvestable)
    })
  },
)

describeCalculation(
  'risk-based-guardrail-threshold-solver',
  {
    example: {
      inputs: {
        startingInvestable: 500_000,
        pathCount: 1,
        seed: 1,
        lowerBandPct: 70,
        upperBandPct: 95,
        bracketLo: 0.02,
        bracketHi: 4,
        bisections: 10,
      },
      expected: {
        latticeKMin: 1,
        latticeKMax: 1023,
        successAtThresholdMembers: [0, 1],
        nonSolvedOutcomes: ['always-above-band', 'never-reaches-band'],
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/risk-based-guardrail-threshold-solver.md',
    mutation: 'DOCS/calculations/monte-carlo/risk-based-guardrail-threshold-solver.mutation.md',
  },
  ({ example }) => {
    it('one-path 70/95 edges sit on the 10-step lattice or share a named non-solved outcome', () => {
      const startingInvestable = example.inputs.startingInvestable as number
      const plan = planOf([taxable(startingInvestable)])
      const solution = solveRiskBasedGuardrails(plan, {
        startYear: 2026,
        taxCalculator: createFlatTaxCalculator(0),
        model: { type: 'lognormal', inflationMeanPct: 0, returnVolPct: 0, inflationVolPct: 0 },
        pathCount: example.inputs.pathCount as number,
        seed: example.inputs.seed as number,
        lowerBandPct: example.inputs.lowerBandPct as number,
        upperBandPct: example.inputs.upperBandPct as number,
      })
      const bracketLo = example.inputs.bracketLo as number
      const bracketHi = example.inputs.bracketHi as number
      const steps = 2 ** (example.inputs.bisections as number)
      const span = bracketHi - bracketLo
      const kMin = example.expected.latticeKMin as number
      const kMax = example.expected.latticeKMax as number
      const successMembers = example.expected.successAtThresholdMembers as number[]
      const nonSolved = example.expected.nonSolvedOutcomes as string[]

      const assertEdge = (
        label: string,
        outcome: string,
        threshold: { balanceFrac: number; balanceDollars: number; successAtThreshold: number } | null,
      ): number | null => {
        if (outcome !== 'solved') {
          expect(
            nonSolved.includes(outcome),
            `${label} outcome ${outcome} is not one of ${nonSolved.join(', ')}`,
          ).toBe(true)
          expect(threshold, `${label} returned a threshold with non-solved outcome ${outcome}`).toBeNull()
          return null
        }
        expect(threshold, `${label} outcome is solved but no threshold was returned`).not.toBeNull()
        const edge = threshold!
        const recovered = ((edge.balanceFrac - bracketLo) * steps) / span
        const k = Math.round(recovered)
        expect(
          withinTolerance(recovered, k, example.tolerance),
          `${label} (balanceFrac - ${bracketLo}) * ${steps} / ${span} = ${recovered} is not an integer within ${JSON.stringify(example.tolerance)}`,
        ).toBe(true)
        expect(k >= kMin && k <= kMax, `${label} lattice k ${k} is not in ${kMin}..${kMax}`).toBe(true)
        expect(edge.balanceDollars, `${label} balanceDollars ${edge.balanceDollars} !== balanceFrac ${edge.balanceFrac} * ${startingInvestable}`).toBe(
          edge.balanceFrac * startingInvestable,
        )
        expect(
          successMembers.includes(edge.successAtThreshold),
          `${label} successAtThreshold ${edge.successAtThreshold} is not 0 or 1`,
        ).toBe(true)
        return edge.balanceFrac
      }

      const lowerFrac = assertEdge('lower', solution.lowerOutcome, solution.lower)
      const upperFrac = assertEdge('upper', solution.upperOutcome, solution.upper)
      expect(solution.lowerOutcome, 'one-path lower and upper outcomes differ').toBe(solution.upperOutcome)
      if (lowerFrac !== null && upperFrac !== null) {
        expect(upperFrac, 'one-path solved lower and upper balanceFrac differ').toBe(lowerFrac)
      }
    })
  },
)
