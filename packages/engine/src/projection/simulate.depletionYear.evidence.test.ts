import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { cashAccount, productionTaxCalculator, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

/**
 * The smallest plan the worksheet's identity can be read off: one cash account
 * (no market shock, no yield, no tax), a 51-year-old single filer (no Medicare
 * month and no distribution rule to interfere), zero return and zero
 * inflation, base spending as the only expense, and an explicit horizon so the
 * three rows are exactly 2026-2028.
 */
function depletionRun(openingBalance: number, annualSpending: number): ProjectionResult {
  const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
  plan.accounts = [cashAccount('only-account', openingBalance)]
  plan.expenses.baseAnnual = annualSpending
  return simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2028,
    taxCalculator: productionTaxCalculator(),
  })
}

describeCalculation(
  'longevity-depletion-year',
  {
    example: {
      inputs: {
        projectionYears: [2026, 2027, 2028],
        openingBalance: 25_000,
        annualSpending: 10_000,
        annualIncome: 0,
        returnPct: 0,
        inflationPct: 0,
        hecmDraw: 0,
        fundingTolerancePlanDollars: 0.005,
        noDepletionAnnualSpending: 5_000,
        zeroCloseOpeningBalance: 30_000,
        realizedShortfallsByYear: [0, 0, 5_000],
        dollarTolerance: { abs: 0.005 },
      },
      expected: {
        depletionYear: 2028,
        noDepletionYear: null,
        zeroCloseDepletionYear: null,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/longevity/longevity-depletion-year.md',
    mutation: 'DOCS/calculations/longevity/longevity-depletion-year.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number | null>
    const years = inputs.projectionYears as number[]
    const dollarTolerance = inputs.dollarTolerance as { abs: number }

    function expectShortfalls(result: ProjectionResult, target: number[]): void {
      result.years.forEach((row, index) => {
        expect(
          withinTolerance(row.shortfall, target[index]!, dollarTolerance),
          `${row.year} shortfall ${row.shortfall} is not within ${JSON.stringify(dollarTolerance)} of ${target[index]}`,
        ).toBe(true)
      })
    }

    it('reports 2028, the first year whose shortfall exceeds the half-cent tolerance', () => {
      const result = depletionRun(inputs.openingBalance as number, inputs.annualSpending as number)
      expect(result.years.map((row) => row.year)).toEqual(years)
      // The constructed rows really do carry the worksheet's shortfalls.
      expectShortfalls(result, inputs.realizedShortfallsByYear as number[])
      expect(result.depletionYear).toBe(expected.depletionYear)
      // The worksheet's second wrong reading: 2026 funds itself in full.
      expect(result.depletionYear).not.toBe(years[0])
    })

    it('reports null when every year is funded', () => {
      const result = depletionRun(
        inputs.openingBalance as number,
        inputs.noDepletionAnnualSpending as number,
      )
      expectShortfalls(result, [0, 0, 0])
      expect(result.depletionYear).toBe(expected.noDepletionYear)
      // The worksheet's third wrong reading: the horizon year is not a default.
      expect(result.depletionYear).not.toBe(years[2])
    })

    it('does not call a year that closes at exactly zero depletion', () => {
      // The worksheet's first wrong reading: $30,000 against the same $10,000
      // gap closes 2028 at zero with every dollar funded, so no shortfall ever
      // exceeds $0.005 and no year qualifies.
      const result = depletionRun(
        inputs.zeroCloseOpeningBalance as number,
        inputs.annualSpending as number,
      )
      expect(
        withinTolerance(result.years[2]!.investableTotal, 0, dollarTolerance),
        `2028 closes at ${result.years[2]!.investableTotal}, not zero`,
      ).toBe(true)
      expectShortfalls(result, [0, 0, 0])
      expect(result.depletionYear).toBe(expected.zeroCloseDepletionYear)
    })
  },
)
