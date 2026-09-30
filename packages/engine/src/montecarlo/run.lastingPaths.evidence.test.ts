import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { aggregateMonteCarlo, type MonteCarloPath, type MonteCarloPathsResult } from './run.js'

/** A one-year path that first depletes in `depletionYear` (null: it lasts), meeting its required floor or not. */
function path(depletionYear: number | null, requiredFloorMet = true): MonteCarloPath {
  return {
    investableByYear: Float64Array.from([0]),
    endingInvestable: 0,
    endingNetWorth: 0,
    endingAfterTaxEstate: 0,
    depletionYear,
    totalShortfall: 0,
    totalRequiredShortfall: 0,
    totalTargetShortfall: 0,
    requiredFloorMet,
    targetLifestyleMet: requiredFloorMet,
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

function result(paths: MonteCarloPath[]): MonteCarloPathsResult {
  return { startYear: 2026, endYear: 2026, paths }
}

function lastingPaths(count: number): MonteCarloPath[] {
  return Array.from({ length: count }, () => path(null))
}

function depletedSum(counts: readonly { count: number }[]): number {
  return counts.reduce((sum, row) => sum + row.count, 0)
}

describeCalculation(
  'monte-carlo-lasting-path-count',
  {
    example: {
      inputs: {
        caseA: { depletionYears: [2040, 2041, 2042, 2043, 2060], lasting: 5 },
        caseC: { depletionYears: [], lasting: 8 },
        caseE: { failingByYear: '150 paths failing in 2047 to 2053', lasting: 850 },
        caseG: { lastingMeetingFloor: 3, lastingShortOfFloor: 2, failingShortOfFloor: 1 },
      },
      expected: {
        caseA: { lasting: 5, depleted: 5, pathCount: 10 },
        caseC: { lasting: 8, depleted: 0, pathCount: 8 },
        caseE: { lasting: 850, depleted: 150, pathCount: 1_000 },
        caseG: { lasting: 5, depleted: 1, wrongFloorMet: 3 },
        empty: { lasting: 0, depleted: 0 },
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-lasting-and-depleted-path-counts.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-lasting-and-depleted-path-counts.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, Record<string, number>>

    it('case A: 5 of 10 paths lasted and 5 ran out, and the year counts add up to the 5', () => {
      const failing = [2040, 2041, 2042, 2043, 2060].map((year) => path(year))
      const summary = aggregateMonteCarlo(result([...failing, ...lastingPaths(5)]))
      const e = expected.caseA!
      expect(summary.pathCount).toBe(e.pathCount)
      expect(summary.lastingPathCount).toBe(e.lasting)
      expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
      expect(depletedSum(summary.depletionYearCounts)).toBe(e.depleted)
      expect(summary.successRate).toBe(summary.lastingPathCount / summary.pathCount)
    })

    it('case C: when no path runs out every path lasted', () => {
      const summary = aggregateMonteCarlo(result(lastingPaths(8)))
      expect(summary.lastingPathCount).toBe(expected.caseC!.lasting)
      expect(summary.downsideRisk.failingPathCount).toBe(expected.caseC!.depleted)
      expect(summary.depletionYearCounts).toEqual([])
    })

    it('case E: 850 of 1,000 paths lasted and 150 ran out, as the Why panel prints them', () => {
      const failing = Array.from({ length: 150 }, (_, i) => path(2047 + (i % 7)))
      const summary = aggregateMonteCarlo(result([...failing, ...lastingPaths(850)]))
      const e = expected.caseE!
      expect(summary.lastingPathCount).toBe(e.lasting)
      expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
      expect(depletedSum(summary.depletionYearCounts)).toBe(e.depleted)
      expect(summary.lastingPathCount + summary.downsideRisk.failingPathCount).toBe(e.pathCount)
    })

    it('case G: a path that never runs out lasted even when it fell short of its required floor', () => {
      const paths = [...lastingPaths(3), path(null, false), path(null, false), path(2050, false)]
      const summary = aggregateMonteCarlo(result(paths))
      const e = expected.caseG!
      expect(summary.lastingPathCount).toBe(e.lasting)
      expect(summary.downsideRisk.failingPathCount).toBe(e.depleted)
      expect(summary.lastingPathCount).not.toBe(e.wrongFloorMet)
      expect(summary.requiredFloorSuccessRate * summary.pathCount).toBe(e.wrongFloorMet)
    })

    it('an empty sample has no lasting and no depleted path', () => {
      const summary = aggregateMonteCarlo(result([]))
      expect(summary.lastingPathCount).toBe(expected.empty!.lasting)
      expect(summary.downsideRisk.failingPathCount).toBe(expected.empty!.depleted)
    })
  },
)
