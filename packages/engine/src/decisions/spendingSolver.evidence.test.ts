import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { solveMaxSustainableSpending } from './spendingSolver.js'

const WORKSHEET = 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-bisection.md'
const expectedRows = worksheetExpectedRows(WORKSHEET)
/** One case's cell of a worksheet Expected row: index 0 is case 1, index 1 case 2. */
const cell = (label: string, index: 0 | 1): string => expectedRows.get(label)![index]!
const figure = (label: string, index: 0 | 1): number => worksheetNumber(cell(label, index))
const probesOf = (index: 0 | 1): number[] => cell('Probes after the initial bracket', index).split(';').map(worksheetNumber)
const caseOf = (index: 0 | 1) => ({
  feasibleBaseAnnual: figure('feasibleBaseAnnual', index),
  maxBaseAnnual: figure('maxBaseAnnual', index),
  spendingSlackDollars: figure('spendingSlackDollars', index),
  converged: cell('converged', index) === 'true',
  worksheetProbes: probesOf(index),
})

describeCalculation('sustainable-spending-bisection', {
  example: {
    inputs: {
      currentBaseAnnual: 40_000,
      feasibleThrough: 63_000,
      initialLower: 60_000,
      initialUpper: 70_000,
      resolutionDollars: 1000,
      fineResolutionDollars: 100,
    },
    expected: { coarse: caseOf(0), fine: caseOf(1) },
    tolerance: 'exact',
  },
  worksheet: WORKSHEET,
  mutation: 'DOCS/calculations/cash-flow-and-summary/sustainable-spending-bisection.mutation.md',
}, ({ example }) => {
  // Public API generates its own bracket. Seed 40000 -> 80000, then its
  // first two midpoints reach the worksheet's exact 60000/70000 bracket.
  // Only the worksheet's supplied feasibility predicate is doubled; the
  // pinned production solver performs every probe and bracket update.
  function solveAtResolution(resolutionDollars: number) {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = example.inputs.currentBaseAnnual as number
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
      return { actual: solveMaxSustainableSpending(ctx, { resolutionDollars }), probes }
    } finally {
      spy.mockRestore()
    }
  }

  function expectCase(name: 'coarse' | 'fine', resolutionDollars: number): void {
    const expected = example.expected[name] as ReturnType<typeof caseOf>
    const { actual, probes } = solveAtResolution(resolutionDollars)
    expect(withinTolerance(actual.feasibleBaseAnnual!, expected.feasibleBaseAnnual, example.tolerance), `feasibleBaseAnnual: actual ${actual.feasibleBaseAnnual}, worksheet ${expected.feasibleBaseAnnual}`).toBe(true)
    expect(withinTolerance(actual.maxBaseAnnual!, expected.maxBaseAnnual, example.tolerance), `maxBaseAnnual: actual ${actual.maxBaseAnnual}, worksheet ${expected.maxBaseAnnual}`).toBe(true)
    expect(withinTolerance(actual.spendingSlackDollars!, expected.spendingSlackDollars, example.tolerance), `spendingSlackDollars: actual ${actual.spendingSlackDollars}, worksheet ${expected.spendingSlackDollars}`).toBe(true)
    expect(actual.converged).toBe(expected.converged)
    expect(probes.slice(0, 2)).toEqual([example.inputs.currentBaseAnnual, 2 * (example.inputs.currentBaseAnnual as number)])
    expect(probes[2]).toBe(example.inputs.initialLower)
    expect(probes[3]).toBe(example.inputs.initialUpper)
    expect(probes.slice(4)).toEqual(expected.worksheetProbes)
  }

  it('bisects the 60000/70000 bracket to the feasible lower bound 62500', () => {
    expectCase('coarse', example.inputs.resolutionDollars as number)
  })

  it('at a $100 resolution passes 62969 and publishes it rounded down to 62900', () => {
    expectCase('fine', example.inputs.fineResolutionDollars as number)
  })
})
