import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { solveMaxSustainableSpending } from './spendingSolver.js'

describeCalculation('sustainable-spending-bisection', {
  example: {
    inputs: { feasibleThrough: 63_000, initialLower: 60_000, initialUpper: 70_000, resolutionDollars: 1000 },
    expected: { maxBaseAnnual: 62_500, converged: true, worksheetProbes: [65_000, 62_500, 63_750, 63_125] },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-bisection.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-bisection.mutation.md',
}, ({ example }) => {
  it('bisects the 60000/70000 bracket to the feasible lower bound 62500', () => {
    // Public API generates its own bracket. Seed 40000 -> 80000, then its
    // first two midpoints reach the worksheet's exact 60000/70000 bracket.
    // Only the worksheet's supplied feasibility predicate is doubled; the
    // pinned production solver performs every probe and bracket update.
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = 40_000
    const ctx = evaluation.createDecisionContext(plan, simOptions())
    const reference = evaluation.evaluateCandidate(ctx, {
      id: 'worksheet-shape', source: 'search', category: 'spending', label: 'Fixture shape', explanation: 'Schema scaffolding only',
    })
    const probes: number[] = []
    const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
      const amount = (candidate.planPatch!['expenses'] as { baseAnnual: number }).baseAnnual
      probes.push(amount)
      return {
        ...reference,
        recommendationState: 'beneficial',
        candidateResult: { ...reference.candidateResult, depletionYear: amount <= (example.inputs.feasibleThrough as number) ? null : 2026 },
        candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: 0 },
      }
    })
    try {
      const actual = solveMaxSustainableSpending(ctx, { resolutionDollars: example.inputs.resolutionDollars as number })
      expect(withinTolerance(actual.maxBaseAnnual!, example.expected.maxBaseAnnual as number, example.tolerance), `maxBaseAnnual: actual ${actual.maxBaseAnnual}, worksheet ${example.expected.maxBaseAnnual}`).toBe(true)
      expect(actual.converged).toBe(example.expected.converged)
      expect(probes[2]).toBe(example.inputs.initialLower)
      expect(probes[3]).toBe(example.inputs.initialUpper)
      const worksheetProbes = example.expected.worksheetProbes as number[]
      expect(probes.length).toBe(4 + worksheetProbes.length)
      worksheetProbes.forEach((amount, index) => expect(probes[index + 4]).toBe(amount))
    } finally {
      spy.mockRestore()
    }
  })
})
