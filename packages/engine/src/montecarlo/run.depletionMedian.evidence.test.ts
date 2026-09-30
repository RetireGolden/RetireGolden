import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { aggregateMonteCarlo, type MonteCarloPath, type MonteCarloPathsResult } from './run.js'

/** A one-year path at every neutral value that first depletes in `depletionYear` (null: it lasts). */
function path(depletionYear: number | null): MonteCarloPath {
  return {
    investableByYear: Float64Array.from([0]),
    endingInvestable: 0,
    endingNetWorth: 0,
    endingAfterTaxEstate: 0,
    depletionYear,
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

/** Paths that deplete in the years given, then `lasting` paths that never do. */
function sample(depletionYears: readonly number[], lasting: number): MonteCarloPathsResult {
  return {
    startYear: 2026,
    endYear: 2026,
    paths: [...depletionYears.map((year) => path(year)), ...Array.from({ length: lasting }, () => path(null))],
  }
}

function repeat(year: number, count: number): number[] {
  return Array.from({ length: count }, () => year)
}

describeCalculation(
  'monte-carlo-median-depletion-year',
  {
    example: {
      inputs: {
        caseA: { depletionYears: [2040, 2041, 2042, 2043, 2060], lasting: 5 },
        caseB: { depletionYears: [2035, 2040, 2045, 2050], lasting: 0 },
        caseC: { depletionYears: [], lasting: 8 },
        caseD: { depletionYears: [2040, 2040, 2040, 2050, 2060], lasting: 1 },
        caseE: { depletionYearCounts: { '2047': 40, '2050': 60, '2053': 50 }, lasting: 850 },
      },
      expected: {
        caseA: 2042,
        caseB: 2040,
        caseC: null,
        caseD: 2040,
        caseE: 2050,
        wrongAllPathsA: 2060,
        wrongUpperMedianB: 2045,
        wrongDistinctYearsD: 2050,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-median-first-depletion-year.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-median-first-depletion-year.mutation.md',
  },
  ({ example }) => {
    type Case = { depletionYears: number[]; lasting: number }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, number | null>
    const medianOf = (c: Case) => aggregateMonteCarlo(sample(c.depletionYears, c.lasting)).medianFirstDepletionYear

    it('case A: the median of the five failing paths is 2042; the five lasting paths do not count', () => {
      expect(medianOf(inputs.caseA!)).toBe(expected.caseA)
      expect(medianOf(inputs.caseA!)).not.toBe(expected.wrongAllPathsA)
    })

    it('case B: with four failing paths the median is the lower middle year, 2040', () => {
      const median = medianOf(inputs.caseB!)
      expect(median).toBe(expected.caseB)
      expect(median).not.toBe(expected.wrongUpperMedianB)
      expect(Number.isInteger(median)).toBe(true)
    })

    it('case C: with no failing path there is no median year', () => {
      expect(medianOf(inputs.caseC!)).toBeNull()
    })

    it('case D: three of five paths failing in 2040 put the median at 2040, not at the middle distinct year', () => {
      expect(medianOf(inputs.caseD!)).toBe(expected.caseD)
      expect(medianOf(inputs.caseD!)).not.toBe(expected.wrongDistinctYearsD)
    })

    it('case E: 40, 60 and 50 paths failing in 2047, 2050 and 2053 put the median at 2050', () => {
      const years = [...repeat(2047, 40), ...repeat(2050, 60), ...repeat(2053, 50)]
      const summary = aggregateMonteCarlo(sample(years, 850))
      expect(summary.depletionYearCounts).toEqual([
        { year: 2047, count: 40 },
        { year: 2050, count: 60 },
        { year: 2053, count: 50 },
      ])
      expect(summary.medianFirstDepletionYear).toBe(expected.caseE)
    })

    it('an empty sample has no median year', () => {
      expect(aggregateMonteCarlo(sample([], 0)).medianFirstDepletionYear).toBeNull()
    })
  },
)
