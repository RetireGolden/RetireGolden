import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { aggregateMonteCarlo, type MonteCarloPath, type MonteCarloPathsResult } from './run.js'

/** A one-year path at every neutral value, ending with `endingInvestable`. */
function pathEnding(endingInvestable: number): MonteCarloPath {
  return {
    investableByYear: Float64Array.from([endingInvestable]),
    endingInvestable,
    endingNetWorth: 0,
    endingAfterTaxEstate: 0,
    depletionYear: null,
    totalShortfall: 0,
    totalRequiredShortfall: 0,
    totalTargetShortfall: 0,
    requiredFloorMet: true,
    targetLifestyleMet: true,
    targetAttainmentPct: 1,
    averageAnnualTargetShortfall: 0,
    yearsBelowTarget: 0,
    idealIntended: 0,
    idealFunded: 0,
    excessIntended: 0,
    excessFunded: 0,
    flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
    guardrailActionCounts: { cut: 0, raise: 0, hold: 0 },
    guardrailCutYears: 0,
    longestGuardrailCutSpellYears: 0,
    maxGuardrailCutDepth: 0,
    endingAboveBequestTarget: null,
  }
}

function endingsResult(endings: readonly number[]): MonteCarloPathsResult {
  return { startYear: 2030, endYear: 2030, paths: endings.map(pathEnding) }
}

describeCalculation(
  'monte-carlo-histogram-bin-centres',
  {
    example: {
      inputs: {
        caseA: { endings: [100_000, 1_600_000], bins: 30 },
        caseB: { endings: [0, 0, 250_000, 1_200_000, 3_000_000], bins: 30 },
        caseC: { endings: [0, 0, 0, 0], bins: 30 },
        caseD: { endings: [], bins: 30 },
        caseE: { endings: [0, 20, 40, 80, 100], bins: 4 },
      },
      expected: {
        caseA: { min: 100_000, binWidth: 50_000, first: [125_000, 175_000, 225_000], last: 1_575_000 },
        caseB: { binWidth: 100_000, occupied: { '0': 50_000, '2': 250_000, '12': 1_250_000, '29': 2_950_000 } },
        caseC: { centre: 0, count: 4, retiredLabels: [0.5, 1.5, 29.5] },
        caseD: { centre: 0 },
        caseE: { centres: [12.5, 37.5, 62.5, 87.5], counts: [2, 1, 0, 2] },
        leftEdgeWrongReadingA: 100_000,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/display-histogram-bin-label.md',
    mutation: 'DOCS/calculations/monte-carlo/display-histogram-bin-label.mutation.md',
  },
  ({ example }) => {
    type Case = { endings: number[]; bins: number }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, Record<string, unknown>>
    const histogramOf = (c: Case) => aggregateMonteCarlo(endingsResult(c.endings), c.bins).endingInvestable.histogram

    it('case A: centres at min + (i + 0.5) × binWidth, 125,000 to 1,575,000', () => {
      const h = histogramOf(inputs.caseA!)
      const e = expected.caseA!
      expect(h.min).toBe(e.min)
      expect(h.binWidth).toBe(e.binWidth)
      expect(h.binCenters).toHaveLength(30)
      expect(h.binCenters.slice(0, 3)).toEqual(e.first)
      expect(h.binCenters[29]).toBe(e.last)
      h.binCenters.forEach((centre, i) => expect(centre).toBe(h.min + (i + 0.5) * h.binWidth))
      expect(h.binCenters[0]).not.toBe(expected.leftEdgeWrongReadingA)
    })

    it('case B: the occupied bins centre on 50,000, 250,000, 1,250,000 and 2,950,000', () => {
      const h = histogramOf(inputs.caseB!)
      expect(h.binWidth).toBe(expected.caseB!.binWidth)
      for (const [index, centre] of Object.entries(expected.caseB!.occupied as Record<string, number>)) {
        expect(h.counts[Number(index)]).toBeGreaterThan(0)
        expect(h.binCenters[Number(index)]).toBe(centre)
      }
    })

    it('case C: every path ends at $0, so every centre is $0, not a made-up scale of $1 to $30', () => {
      const h = histogramOf(inputs.caseC!)
      const e = expected.caseC!
      expect(h.counts[0]).toBe(e.count)
      expect(new Set(h.binCenters)).toEqual(new Set([e.centre]))
      // The page used to label bar i with min + (i + 0.5) × the placeholder width 1.
      const retired = h.counts.map((_, i) => h.min + (i + 0.5) * h.binWidth)
      expect([retired[0], retired[1], retired[29]]).toEqual(e.retiredLabels)
    })

    it('case D: an empty sample has every centre 0', () => {
      const h = histogramOf(inputs.caseD!)
      expect(new Set(h.binCenters)).toEqual(new Set([expected.caseD!.centre]))
    })

    it('case E: the ending-distributions record case centres on 12.5, 37.5, 62.5 and 87.5', () => {
      const h = histogramOf(inputs.caseE!)
      expect(h.counts).toEqual(expected.caseE!.counts)
      expect(h.binCenters).toEqual(expected.caseE!.centres)
    })

    it('publishes centres on all three histograms the aggregation builds', () => {
      const summary = aggregateMonteCarlo(endingsResult(inputs.caseB!.endings), 30)
      for (const histogram of [summary.endingInvestable.histogram, summary.endingNetWorth.histogram, summary.endingAfterTaxEstate.histogram]) {
        expect(histogram.binCenters).toHaveLength(histogram.counts.length)
      }
    })
  },
)
