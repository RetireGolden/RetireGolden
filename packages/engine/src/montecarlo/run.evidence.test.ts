import { expect, it } from 'vitest'
import {
  describeCalculation,
  withinTolerance,
  type CalculationTolerance,
} from '../rules/describeCalculation.js'
import { aggregateMonteCarlo, type MonteCarloPath, type MonteCarloPathsResult } from './run.js'

/**
 * One worksheet row: only the per-path fields its worksheet states, with
 * `investableByYear` written as the worksheet's dollar list and widened to the
 * Float64Array the type requires by `resultOf`.
 */
type PathRow = Omit<Partial<MonteCarloPath>, 'investableByYear'> & {
  readonly investableByYear?: readonly number[]
}

/**
 * Every `MonteCarloPath` field at a neutral value: a path that never depletes,
 * never runs short, funds every floor and target, opens no goal or guardrail
 * activity, ends with nothing, and has no bequest target. Each fixture
 * overrides only the fields its worksheet states, so any statistic that reads
 * something else reads a neutral the record's limits name.
 */
function neutralPath(yearCount: number): MonteCarloPath {
  return {
    investableByYear: new Float64Array(yearCount),
    endingInvestable: 0,
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

/** The worksheet's path table as the exact `MonteCarloPathsResult` the statistics read. */
function resultOf(
  startYear: number,
  endYear: number,
  rows: Readonly<Record<string, PathRow>>,
): MonteCarloPathsResult {
  const yearCount = endYear - startYear + 1
  return {
    startYear,
    endYear,
    paths: Object.values(rows).map((row) => {
      const { investableByYear, ...fields } = row
      return {
        ...neutralPath(yearCount),
        ...fields,
        ...(investableByYear === undefined ? {} : { investableByYear: Float64Array.from(investableByYear) }),
      }
    }),
  }
}

function expectWithin(actual: number, expected: number, tolerance: CalculationTolerance, label: string): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'monte-carlo-success-and-failure-rates',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2032,
        paths: {
          A: { depletionYear: null, requiredFloorMet: true, targetLifestyleMet: true },
          B: { depletionYear: null, requiredFloorMet: true, targetLifestyleMet: false },
          C: { depletionYear: null, requiredFloorMet: false, targetLifestyleMet: false },
          D: { depletionYear: 2031, requiredFloorMet: true, targetLifestyleMet: false },
          E: { depletionYear: 2032, requiredFloorMet: false, targetLifestyleMet: false },
        },
      },
      expected: {
        successRate: 0.6,
        requiredFloorSuccessRate: 0.6,
        targetLifestyleSuccessRate: 0.2,
        failureRate: 0.4,
        failingPathCount: 2,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-success-and-failure-rates.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-success-and-failure-rates.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected as {
      successRate: number
      requiredFloorSuccessRate: number
      targetLifestyleSuccessRate: number
      failureRate: number
      failingPathCount: number
    }

    it('scores three non-depleting, three floor-funded and one target-funded path out of five', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expectWithin(summary.successRate, expected.successRate, example.tolerance, 'successRate')
      expectWithin(
        summary.requiredFloorSuccessRate,
        expected.requiredFloorSuccessRate,
        example.tolerance,
        'requiredFloorSuccessRate',
      )
      expectWithin(
        summary.targetLifestyleSuccessRate,
        expected.targetLifestyleSuccessRate,
        example.tolerance,
        'targetLifestyleSuccessRate',
      )
      expectWithin(summary.downsideRisk.failureRate, expected.failureRate, example.tolerance, 'downsideRisk.failureRate')
      expect(summary.downsideRisk.failingPathCount).toBe(expected.failingPathCount)
    })

    it('holds the three tests apart path by path, so the shared 0.6 is not a coincidence', () => {
      // The worksheet's crossed booleans only prove their point if the path
      // identities are asserted: aggregating each path alone turns every rate
      // into that one path's verdict.
      for (const [label, row] of Object.entries(rows)) {
        const summary = aggregateMonteCarlo(resultOf(startYear, endYear, { [label]: row }))
        expect(summary.successRate, `${label} success`).toBe(row.depletionYear === null ? 1 : 0)
        expect(summary.requiredFloorSuccessRate, `${label} required floor`).toBe(row.requiredFloorMet === true ? 1 : 0)
        expect(summary.targetLifestyleSuccessRate, `${label} target lifestyle`).toBe(
          row.targetLifestyleMet === true ? 1 : 0,
        )
      }
    })
  },
)

describeCalculation(
  'monte-carlo-investable-fan-percentiles',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2032,
        paths: {
          A: { investableByYear: [0, 100, 1000] },
          B: { investableByYear: [100, 300, 2000] },
          C: { investableByYear: [300, 700, 4000] },
          D: { investableByYear: [1000, 1500, 8000] },
        },
      },
      expected: {
        fan2030: { year: 2030, p10: 30, p25: 75, p50: 200, p75: 475, p90: 790 },
        p50By2031: 500,
        p50By2032: 3000,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-investable-fan-percentiles.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-investable-fan-percentiles.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected as {
      fan2030: { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }
      p50By2031: number
      p50By2032: number
    }

    it('interpolates the 2030 column at index (p/100)(n-1) to 30, 75, 200, 475 and 790', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      const year2030 = summary.fan[0]!
      expect(year2030.year).toBe(expected.fan2030.year)
      for (const level of ['p10', 'p25', 'p50', 'p75', 'p90'] as const) {
        expectWithin(year2030[level], expected.fan2030[level], example.tolerance, `fan 2030 ${level}`)
      }
    })

    it('takes the even-sample median as the mean of the two middle balances in 2031 and 2032', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expect(summary.fan[1]!.year).toBe(2031)
      expect(summary.fan[2]!.year).toBe(2032)
      expectWithin(summary.fan[1]!.p50, expected.p50By2031, example.tolerance, 'fan 2031 p50')
      expectWithin(summary.fan[2]!.p50, expected.p50By2032, example.tolerance, 'fan 2032 p50')
    })
  },
)

describeCalculation(
  'monte-carlo-ending-distributions',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2030,
        histogramBins: 4,
        paths: {
          A: { endingInvestable: 0, endingAfterTaxEstate: 0 },
          B: { endingInvestable: 20, endingAfterTaxEstate: 100 },
          C: { endingInvestable: 40, endingAfterTaxEstate: 300 },
          D: { endingInvestable: 80, endingAfterTaxEstate: 600 },
          E: { endingInvestable: 100, endingAfterTaxEstate: 1000 },
        },
      },
      expected: {
        histogram: { min: 0, binWidth: 25, counts: [2, 1, 0, 2] },
        percentiles: { p10: 40, p25: 100, p50: 300, p75: 600, p90: 840 },
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-ending-distributions.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-ending-distributions.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const histogramBins = example.inputs.histogramBins as number
    const expected = example.expected as {
      histogram: { min: number; binWidth: number; counts: number[] }
      percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
    }

    it('bins the ending investable balances into four equal widths, the maximum clamped into the last', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows), histogramBins)
      const histogram = summary.endingInvestable.histogram
      expectWithin(histogram.min, expected.histogram.min, example.tolerance, 'endingInvestable histogram min')
      expectWithin(
        histogram.binWidth,
        expected.histogram.binWidth,
        example.tolerance,
        'endingInvestable histogram binWidth',
      )
      expect(histogram.counts).toEqual(expected.histogram.counts)
    })

    it('interpolates the ending after-tax estate percentiles to 40, 100, 300, 600 and 840', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows), histogramBins)
      const percentiles = summary.endingAfterTaxEstate.percentiles
      for (const level of ['p10', 'p25', 'p50', 'p75', 'p90'] as const) {
        expectWithin(
          percentiles[level],
          expected.percentiles[level],
          example.tolerance,
          `endingAfterTaxEstate ${level}`,
        )
      }
    })
  },
)

describeCalculation(
  'monte-carlo-depletion-distribution',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2033,
        paths: {
          A: { depletionYear: null },
          B: { depletionYear: 2031 },
          C: { depletionYear: 2031 },
          D: { depletionYear: 2033 },
          E: { depletionYear: null },
        },
      },
      expected: {
        depletionYearCounts: [
          { year: 2031, count: 2 },
          { year: 2033, count: 1 },
        ],
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-depletion-distribution.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-depletion-distribution.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number

    it('groups the two 2031 depletions and the 2033 depletion, leaving the two successes out', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expect(summary.depletionYearCounts).toEqual(example.expected.depletionYearCounts)
    })
  },
)

describeCalculation(
  'monte-carlo-shortfall-statistics',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2034,
        paths: {
          A: {
            depletionYear: null,
            totalShortfall: 0,
            yearsBelowTarget: 0,
            averageAnnualTargetShortfall: 0,
            targetAttainmentPct: 1,
          },
          B: {
            depletionYear: null,
            totalShortfall: 10,
            yearsBelowTarget: 1,
            averageAnnualTargetShortfall: 5,
            targetAttainmentPct: 0.9,
          },
          C: {
            depletionYear: 2031,
            totalShortfall: 20,
            yearsBelowTarget: 2,
            averageAnnualTargetShortfall: 10,
            targetAttainmentPct: 0.8,
          },
          D: {
            depletionYear: 2032,
            totalShortfall: 50,
            yearsBelowTarget: 4,
            averageAnnualTargetShortfall: 20,
            targetAttainmentPct: 0.6,
          },
          E: {
            depletionYear: null,
            totalShortfall: 100,
            yearsBelowTarget: 8,
            averageAnnualTargetShortfall: 40,
            targetAttainmentPct: 0.2,
          },
        },
      },
      expected: {
        averageTotalShortfallDollars: 36,
        p90TotalShortfallDollars: 80,
        expectedShortfallDollars: 35,
        averageYearsBelowTarget: 3,
        p90AverageAnnualTargetShortfall: 32,
        targetAttainmentMedian: 0.8,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-shortfall-statistics.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-shortfall-statistics.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected as {
      averageTotalShortfallDollars: number
      p90TotalShortfallDollars: number
      expectedShortfallDollars: number
      averageYearsBelowTarget: number
      p90AverageAnnualTargetShortfall: number
      targetAttainmentMedian: number
    }

    it('averages and interpolates the all-path shortfall statistics to $36, $80, 3 years and $32', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expectWithin(
        summary.spendingShortfall.averageTotalShortfallDollars,
        expected.averageTotalShortfallDollars,
        example.tolerance,
        'spendingShortfall.averageTotalShortfallDollars',
      )
      expectWithin(
        summary.spendingShortfall.p90TotalShortfallDollars,
        expected.p90TotalShortfallDollars,
        example.tolerance,
        'spendingShortfall.p90TotalShortfallDollars',
      )
      expectWithin(
        summary.averageYearsBelowTarget,
        expected.averageYearsBelowTarget,
        example.tolerance,
        'averageYearsBelowTarget',
      )
      expectWithin(
        summary.p90AverageAnnualTargetShortfall,
        expected.p90AverageAnnualTargetShortfall,
        example.tolerance,
        'p90AverageAnnualTargetShortfall',
      )
      expectWithin(
        summary.targetAttainmentPct.p50,
        expected.targetAttainmentMedian,
        example.tolerance,
        'targetAttainmentPct.p50',
      )
    })

    it('conditions expected shortfall on the two depleted paths, at $35 rather than the all-path $36', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      // The conditional average is only the worksheet's $35 if it ran over C
      // and D alone; path E carries the largest shortfall and never depleted.
      expect(summary.downsideRisk.failingPathCount).toBe(2)
      expectWithin(
        summary.downsideRisk.expectedShortfallDollars,
        expected.expectedShortfallDollars,
        example.tolerance,
        'downsideRisk.expectedShortfallDollars',
      )
    })
  },
)

describeCalculation(
  'monte-carlo-guardrail-adjustments',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2030,
        paths: {
          A: {
            guardrailActionCounts: { cut: 0, raise: 0, hold: 3 },
            guardrailCutYears: 0,
            longestGuardrailCutSpellYears: 0,
            maxGuardrailCutDepth: 0,
            endingAfterTaxEstate: 0,
            endingAboveBequestTarget: false,
          },
          B: {
            guardrailActionCounts: { cut: 2, raise: 0, hold: 1 },
            guardrailCutYears: 2,
            longestGuardrailCutSpellYears: 1,
            maxGuardrailCutDepth: 0.1,
            endingAfterTaxEstate: 100,
            endingAboveBequestTarget: true,
          },
          C: {
            guardrailActionCounts: { cut: 1, raise: 1, hold: 1 },
            guardrailCutYears: 4,
            longestGuardrailCutSpellYears: 3,
            maxGuardrailCutDepth: 0.3,
            endingAfterTaxEstate: 200,
            endingAboveBequestTarget: false,
          },
          D: {
            guardrailActionCounts: { cut: 4, raise: 2, hold: 0 },
            guardrailCutYears: 8,
            longestGuardrailCutSpellYears: 5,
            maxGuardrailCutDepth: 0.6,
            endingAfterTaxEstate: 0,
            endingAboveBequestTarget: true,
          },
          E: {
            guardrailActionCounts: { cut: 0, raise: 1, hold: 2 },
            guardrailCutYears: 0,
            longestGuardrailCutSpellYears: 0,
            maxGuardrailCutDepth: 0,
            endingAfterTaxEstate: 50,
            endingAboveBequestTarget: true,
          },
        },
      },
      expected: {
        pathsWithCut: 0.6,
        pathsWithRaise: 0.6,
        averageCutYears: 14 / 3,
        p90CutYears: 7.2,
        medianMaxCutDepth: 0.3,
        p90MaxCutDepth: 0.54,
        averageLongestCutSpellYears: 3,
        probEndingSurplus: 0.6,
        probEndingAboveBequestTarget: 0.6,
        probEndingAboveBequestTargetWithNoTarget: null,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-guardrail-adjustments.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-guardrail-adjustments.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected as Readonly<Record<string, number | null>>

    it('conditions the cut statistics on the three cut paths and shares the rest over all five', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      for (const field of [
        'pathsWithCut',
        'pathsWithRaise',
        'averageCutYears',
        'p90CutYears',
        'medianMaxCutDepth',
        'p90MaxCutDepth',
        'averageLongestCutSpellYears',
        'probEndingSurplus',
      ] as const) {
        expectWithin(summary.adjustments[field], expected[field] as number, example.tolerance, `adjustments.${field}`)
      }
    })

    it('reports the bequest share over the paths that carry a target, and null when none does', () => {
      const withTarget = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expectWithin(
        withTarget.adjustments.probEndingAboveBequestTarget!,
        expected.probEndingAboveBequestTarget as number,
        example.tolerance,
        'adjustments.probEndingAboveBequestTarget',
      )
      const noTarget = aggregateMonteCarlo(
        resultOf(
          startYear,
          endYear,
          Object.fromEntries(
            Object.entries(rows).map(([label, row]) => [label, { ...row, endingAboveBequestTarget: null }]),
          ),
        ),
      )
      expect(noTarget.adjustments.probEndingAboveBequestTarget).toBe(
        expected.probEndingAboveBequestTargetWithNoTarget,
      )
    })
  },
)

describeCalculation(
  'monte-carlo-funding-rates',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2030,
        paths: {
          A: {
            idealIntended: 100,
            idealFunded: 100,
            excessIntended: 100,
            excessFunded: 0,
            flexibleGoals: { funded: 1, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 100, unfundedAmount: 0 },
          },
          B: {
            idealIntended: 300,
            idealFunded: 0,
            excessIntended: 300,
            excessFunded: 300,
            flexibleGoals: { funded: 0, partiallyFunded: 1, deferred: 0, skipped: 0, fundedAmount: 150, unfundedAmount: 150 },
          },
          C: {
            idealIntended: 100,
            idealFunded: 50,
            excessIntended: 100,
            excessFunded: 50,
            flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 1, skipped: 1, fundedAmount: 50, unfundedAmount: 50 },
          },
          D: {
            idealIntended: 0,
            idealFunded: 0,
            excessIntended: 0,
            excessFunded: 0,
            flexibleGoals: { funded: 2, partiallyFunded: 1, deferred: 1, skipped: 0, fundedAmount: 200, unfundedAmount: 100 },
          },
        },
        nothingIntendedPaths: {
          A: { idealIntended: 0, idealFunded: 0, excessIntended: 0, excessFunded: 0 },
          B: { idealIntended: 0, idealFunded: 0, excessIntended: 0, excessFunded: 0 },
        },
      },
      expected: {
        idealFundingRate: 0.3,
        excessFundingRate: 0.7,
        flexibleGoals: { funded: 3, partiallyFunded: 2, deferred: 2, skipped: 1, fundedAmount: 500, unfundedAmount: 300 },
        idealFundingRateWithNothingIntended: 1,
        excessFundingRateWithNothingIntended: 1,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-funding-rates.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-funding-rates.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const nothingIntended = example.inputs.nothingIntendedPaths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected as {
      idealFundingRate: number
      excessFundingRate: number
      flexibleGoals: Record<string, number>
      idealFundingRateWithNothingIntended: number
      excessFundingRateWithNothingIntended: number
    }

    it('divides summed funded by summed intended, not the average of the per-path rates', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expectWithin(summary.idealFundingRate, expected.idealFundingRate, example.tolerance, 'idealFundingRate')
      expectWithin(summary.excessFundingRate, expected.excessFundingRate, example.tolerance, 'excessFundingRate')
    })

    it('sums every flexible-goal count and amount across the four paths', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      for (const field of [
        'funded',
        'partiallyFunded',
        'deferred',
        'skipped',
        'fundedAmount',
        'unfundedAmount',
      ] as const) {
        expect(summary.flexibleGoals[field], `flexibleGoals.${field}`).toBe(expected.flexibleGoals[field])
      }
    })

    it('reports both rates as 1 when every path intended nothing', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, nothingIntended))
      expectWithin(
        summary.idealFundingRate,
        expected.idealFundingRateWithNothingIntended,
        example.tolerance,
        'idealFundingRate with nothing intended',
      )
      expectWithin(
        summary.excessFundingRate,
        expected.excessFundingRateWithNothingIntended,
        example.tolerance,
        'excessFundingRate with nothing intended',
      )
    })
  },
)

describeCalculation(
  'monte-carlo-guardrail-action-counts',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2030,
        paths: {
          A: { guardrailActionCounts: { cut: 2, raise: 1, hold: 3 } },
          B: { guardrailActionCounts: { cut: 0, raise: 2, hold: 1 } },
          C: { guardrailActionCounts: { cut: 4, raise: 0, hold: 2 } },
          D: { guardrailActionCounts: { cut: 0, raise: 0, hold: 0 } },
        },
      },
      expected: { guardrailActionCounts: { cut: 6, raise: 3, hold: 6 } },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-guardrail-action-counts.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-guardrail-action-counts.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = (example.expected as { guardrailActionCounts: Record<string, number> }).guardrailActionCounts

    it('sums cut, raise and hold across the four paths to 6, 3 and 6, the idle path included', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      for (const action of ['cut', 'raise', 'hold'] as const) {
        expect(summary.guardrailActionCounts[action], `guardrailActionCounts.${action}`).toBe(expected[action])
      }
    })
  },
)

describeCalculation(
  'monte-carlo-depletion-probability-by-year',
  {
    example: {
      inputs: {
        startYear: 2030,
        endYear: 2035,
        paths: {
          A: { depletionYear: null },
          B: { depletionYear: 2033 },
          C: { depletionYear: 2031 },
          D: { depletionYear: 2035 },
          E: { depletionYear: null },
          F: { depletionYear: 2033 },
        },
      },
      expected: {
        depletionProbabilityByYear: [
          { year: 2031, count: 1, probability: 1 / 6, cumulativeProbability: 1 / 6 },
          { year: 2033, count: 2, probability: 1 / 3, cumulativeProbability: 1 / 2 },
          { year: 2035, count: 1, probability: 1 / 6, cumulativeProbability: 2 / 3 },
        ],
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/monte-carlo-depletion-probability-by-year.md',
    mutation: 'DOCS/calculations/monte-carlo/monte-carlo-depletion-probability-by-year.mutation.md',
  },
  ({ example }) => {
    const rows = example.inputs.paths as Readonly<Record<string, PathRow>>
    const startYear = example.inputs.startYear as number
    const endYear = example.inputs.endYear as number
    const expected = example.expected.depletionProbabilityByYear as readonly {
      year: number
      count: number
      probability: number
      cumulativeProbability: number
    }[]

    it('divides each depletion year by all six paths and runs the cumulative sum to 2/3', () => {
      const summary = aggregateMonteCarlo(resultOf(startYear, endYear, rows))
      expect(summary.depletionProbabilityByYear).toHaveLength(expected.length)
      expected.forEach((row, index) => {
        const actual = summary.depletionProbabilityByYear[index]!
        expect(actual.year, `row ${index} year`).toBe(row.year)
        expect(actual.count, `row ${index} count`).toBe(row.count)
        expectWithin(actual.probability, row.probability, example.tolerance, `row ${index} probability`)
        expectWithin(
          actual.cumulativeProbability,
          row.cumulativeProbability,
          example.tolerance,
          `row ${index} cumulativeProbability`,
        )
      })
    })
  },
)
