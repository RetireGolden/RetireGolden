import { expect, it, vi } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { maximizeAfterTaxEstate } from './objectives.js'
import { refineConversionSchedule } from './search.js'

describeCalculation('conversion-coordinate-descent-search', {
  example: {
    inputs: { seed: [{ year: 2026, amount: 0 }], coarseStepDollars: 10_000, fineStepDollars: 2500, minimumImprovement: 1, scores: { 0: 100, 10000: 130, 20000: 125, 12500: 135 } },
    expected: { bestConversion: 12_500, improved: true },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/optimizer-and-comparisons/conversion-coordinate-descent-search.md',
  mutation: 'DOCS/calculations/optimizer-and-comparisons/conversion-coordinate-descent-search.mutation.md',
}, ({ example }) => {
  it('retains the coarse 10000 move then the fine 12500 conversion', () => {
    const original = evaluation.createDecisionContext(noTraditionalPlan(), simOptions())
    // One coordinate, as in the worksheet. The ledger result supplies type
    // scaffolding only; all search scores come from the independent table.
    const ctx = { ...original, baselineResult: { ...original.baselineResult, years: original.baselineResult.years.slice(0, 1) } }
    const reference = evaluation.evaluateCandidate(ctx, {
      id: 'worksheet-shape', source: 'search', category: 'roth', label: 'Fixture shape', explanation: 'Schema scaffolding only',
    })
    const scores = example.inputs.scores as Record<number, number>
    const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
      const amount = candidate.conversions?.[0]?.amount ?? 0
      // Four evaluations cover exactly the supplied table; no score is invented.
      const score = scores[amount]
      if (score === undefined) throw new Error('Probe outside worksheet score table: ' + amount)
      return { ...reference, candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: score } }
    })
    try {
      const actual = refineConversionSchedule(ctx, example.inputs.seed as Array<{ year: number; amount: number }>, {
        maxSimulations: 4,
        coarseStepDollars: example.inputs.coarseStepDollars as number,
        fineStepDollars: example.inputs.fineStepDollars as number,
        minimumImprovement: example.inputs.minimumImprovement as number,
        policy: { ...maximizeAfterTaxEstate, label: 'Worksheet score oracle', primaryMetric: (candidate) => candidate.candidateSummary.endingAfterTaxEstate, constraintViolations: () => [] },
      })
      expect(actual.bestConversions.length).toBe(1)
      expect(actual.bestConversions[0]!.year).toBe(2026)
      expect(actual.bestConversions[0]!.amount).toBe(example.expected.bestConversion)
      expect(actual.improved).toBe(example.expected.improved)
    } finally {
      spy.mockRestore()
    }
  })
})
