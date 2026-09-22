import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import type { Plan } from '../model/plan.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { createDecisionContext } from './evaluateCandidate.js'
import { solveMaxSustainableSpending } from './spendingSolver.js'

/**
 * A plan whose feasibility frontier is arithmetic: four projection years
 * (2026-2029), one zero-return cash account, no income, no tax and no other
 * expense, so a base spending level S is feasible exactly when 4S is at most
 * the opening balance. At $95,000 the frontier is $23,750 — above the
 * worksheet's $22,500 probe and below its $25,000 one.
 */
function fourYearPlan(openingBalance: number, baseAnnual: number): Plan {
  const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
  plan.accounts = [cashAccount('cash', openingBalance)]
  plan.expenses.baseAnnual = baseAnnual
  return validatePlan(plan)
}

function solve(plan: Plan, maxSimulations: number, resolutionDollars: number) {
  const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
  return solveMaxSustainableSpending(ctx, { maxSimulations, resolutionDollars })
}

describeCalculation(
  'sustainable-spending-result-simulation-count',
  {
    example: {
      inputs: {
        feasibleSeed: 10_000,
        firstDoublingProbe: 20_000,
        secondDoublingProbe: 40_000,
        bisectionProbes: [30_000, 25_000, 22_500],
        resolutionDollars: 2_500,
        maximumSimulations: 25,
        infeasibleSeed: 10_000,
        openingBalance: 95_000,
        projectionYears: 4,
        infeasibleOpeningBalance: 5_000,
        infeasibleOneTimeGoal: 60_000,
      },
      expected: {
        feasibleSeedSimulationCount: 6,
        infeasibleSeedSimulationCount: 2,
        maxBaseAnnual: 22_500,
        notCountingSeedWrongReading: 5,
        recountingEndpointsWrongReading: 8,
        oneProbePastResolutionWrongReading: 7,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-result-simulation-count.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-result-simulation-count.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number>
    const resolution = inputs.resolutionDollars as number
    const budget = inputs.maximumSimulations as number

    it('counts six probes: the seed, two doublings and three halvings', () => {
      const result = solve(
        fourYearPlan(inputs.openingBalance as number, inputs.feasibleSeed as number),
        budget,
        resolution,
      )
      // The solve really did land on the worksheet's bracket: the last
      // feasible probe is $22,500 and the bracket closed at the resolution.
      expect(result.maxBaseAnnual).toBe(expected.maxBaseAnnual)
      expect(result.converged).toBe(true)
      expect(result.simulationCount).toBe(expected.feasibleSeedSimulationCount)
      expect(result.simulationCount).toBeLessThan(budget)
      // The worksheet's three wrong readings.
      expect(result.simulationCount).not.toBe(expected.notCountingSeedWrongReading)
      expect(result.simulationCount).not.toBe(expected.recountingEndpointsWrongReading)
      expect(result.simulationCount).not.toBe(expected.oneProbePastResolutionWrongReading)
    })

    it('counts two probes when the seed and zero both fail', () => {
      const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
      plan.accounts = [cashAccount('cash', inputs.infeasibleOpeningBalance as number)]
      plan.expenses.baseAnnual = inputs.infeasibleSeed as number
      // An uninflated one-time goal the portfolio cannot fund at ANY base
      // spending, so the required zero probe fails too and no bisection opens.
      plan.expenses.oneTimeGoals = [
        { id: 'goal', label: 'Unfundable', year: 2026, amount: inputs.infeasibleOneTimeGoal as number },
      ]
      const result = solve(validatePlan(plan), budget, resolution)
      expect(result.maxBaseAnnual).toBe(null)
      expect(result.simulationCount).toBe(expected.infeasibleSeedSimulationCount)
    })
  },
)
