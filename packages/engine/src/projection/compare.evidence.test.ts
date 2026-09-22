import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import type { ProjectionResult } from './types.js'
import { summarizeProjection } from './compare.js'

/**
 * Constructed ProjectionResult: the worksheet's three years and their
 * rothConversion fields only (plus the zeros summarizeProjection reads).
 * No simulation is run.
 */
function resultOf(rows: ReadonlyArray<{ year: number; rothConversion: number }>): ProjectionResult {
  return {
    startYear: rows[0]!.year,
    endYear: rows[rows.length - 1]!.year,
    years: rows.map((row) => ({
      year: row.year,
      tax: 0,
      penalties: 0,
      rothConversion: row.rothConversion,
      contributions: 0,
      employerMatch: 0,
      surplusInvested: 0,
      incomes: { total: 0 },
      expenses: { total: 0 },
      investableTotal: 0,
      balances: {},
    })),
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
  } as unknown as ProjectionResult
}

describeCalculation(
  'projection-summary-lifetime-roth-conversions',
  {
    example: {
      inputs: {
        years: [
          { year: 2026, rothConversion: 40_000 },
          { year: 2027, rothConversion: 0 },
          { year: 2028, rothConversion: 55_500.25 },
        ],
      },
      expected: { lifetimeRothConversions: 95_500.25 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/roth/projection-summary-lifetime-roth-conversions.md',
    mutation: 'DOCS/calculations/roth/projection-summary-lifetime-roth-conversions.mutation.md',
  },
  ({ example }) => {
    it('sums $40,000 + $0 + $55,500.25 to $95,500.25 over all three projection rows', () => {
      const plan = singlePersonPlan({ dob: '1961-01-01' })
      const summary = summarizeProjection(
        plan,
        resultOf(example.inputs.years as Array<{ year: number; rothConversion: number }>),
      )
      const expected = example.expected.lifetimeRothConversions as number
      expect(
        withinTolerance(summary.lifetimeRothConversions, expected, example.tolerance),
        `lifetimeRothConversions ${summary.lifetimeRothConversions} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)
