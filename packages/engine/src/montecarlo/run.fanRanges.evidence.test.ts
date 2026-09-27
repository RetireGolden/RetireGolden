import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { aggregateMonteCarlo, type MonteCarloPath, type MonteCarloPathsResult } from './run.js'

/** A one-year path at every neutral value, whose investable balance that year is `investable`. */
function pathWith(investable: number): MonteCarloPath {
  return {
    investableByYear: Float64Array.from([investable]),
    endingInvestable: investable,
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

describeCalculation(
  'monte-carlo-fan-chart-ranges',
  {
    example: {
      inputs: {
        year: 2050,
        balances: [0, 400_000, 600_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_000_000, 1_300_000, 2_000_000],
      },
      expected: {
        outer: [400_000, 1_300_000],
        inner: [600_000, 1_000_000],
        median: 800_000,
        retiredWidths: [900_000, 400_000],
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/display-fan-band-widths.md',
    mutation: 'DOCS/calculations/monte-carlo/display-fan-band-widths.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as { year: number; balances: number[] }
    const expected = example.expected as { outer: number[]; inner: number[]; median: number; retiredWidths: number[] }

    it('draws the outer band from p10 to p90 and the inner from p25 to p75 of the fan row, not their widths', () => {
      const result: MonteCarloPathsResult = { startYear: inputs.year, endYear: inputs.year, paths: inputs.balances.map(pathWith) }
      const row = aggregateMonteCarlo(result).fan[0]!
      expect(row.year).toBe(inputs.year)
      expect([row.p10, row.p90]).toEqual(expected.outer)
      expect([row.p25, row.p75]).toEqual(expected.inner)
      expect(row.p50).toBe(expected.median)
      // The retired chart stacked these widths on transparent bases and printed them as levels.
      expect([row.p90 - row.p10, row.p75 - row.p25]).toEqual(expected.retiredWidths)
      expect(expected.retiredWidths).not.toContain(row.p90)
    })
  },
)
