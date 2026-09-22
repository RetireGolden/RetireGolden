import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * The smallest plan whose 2026 row lands on a chosen taxable income with no
 * Social Security and no preferential income: a 63-year-old single filer
 * (over 59.5 and under 65, so the deduction is the base 2026 standard
 * deduction with no age addition), one uninflated recurring ordinary stream,
 * and one zero-return cash account to pay the tax and hold the surplus.
 */
function headroomRow(ordinaryIncome: number): YearResult {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.accounts = [cashAccount('cash', 1_000)]
  plan.incomes = [recurringOrdinaryIncome('ordinary', ordinaryIncome)]
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: productionTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === 2026)
  if (row === undefined) throw new Error('missing projection year 2026')
  return row
}

describeCalculation(
  'year-result-ltcg-zero-headroom',
  {
    example: {
      inputs: {
        taxYear: 2026,
        filingStatus: 'single',
        rate15StartsAboveSingle: 49_450,
        standardDeductionSingle: 16_100,
        caseATaxableIncome: 37_000,
        caseBTaxableIncome: 50_000,
        ssBenefits: 0,
        rate20StartsAboveSingle: 545_500,
      },
      expected: { caseAHeadroom: 12_450, caseBHeadroom: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/year-result-ltcg-zero-headroom.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/year-result-ltcg-zero-headroom.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number>
    const deduction = inputs.standardDeductionSingle as number
    const threshold = inputs.rate15StartsAboveSingle as number

    it('publishes 12450 of 0% headroom for a 37000 taxable income', () => {
      const taxableIncome = inputs.caseATaxableIncome as number
      const row = headroomRow(taxableIncome + deduction)
      // The constructed row really does carry the worksheet's taxable income.
      expect(row.incomes.total).toBe(taxableIncome + deduction)
      expect(row.incomes.socialSecurity).toBe(inputs.ssBenefits)
      expect(
        withinTolerance(row.ltcgZeroHeadroom, expected.caseAHeadroom!, example.tolerance),
        `ltcgZeroHeadroom ${row.ltcgZeroHeadroom} is not within ${JSON.stringify(example.tolerance)} of ${expected.caseAHeadroom}`,
      ).toBe(true)
      // ... and the published figure is that threshold minus taxable income.
      expect(
        withinTolerance(row.ltcgZeroHeadroom, threshold - taxableIncome, example.tolerance),
      ).toBe(true)
      // The worksheet's three wrong readings: the reversed subtraction, and
      // the 20% threshold read as the 0% ceiling.
      expect(withinTolerance(row.ltcgZeroHeadroom, -(expected.caseAHeadroom!), example.tolerance)).toBe(false)
      expect(
        withinTolerance(
          row.ltcgZeroHeadroom,
          (inputs.rate20StartsAboveSingle as number) - taxableIncome,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('publishes exactly 0 once taxable income reaches the 15% threshold', () => {
      const taxableIncome = inputs.caseBTaxableIncome as number
      const row = headroomRow(taxableIncome + deduction)
      expect(row.incomes.total).toBe(taxableIncome + deduction)
      // The at-threshold branch returns before any bisection, so this is an
      // exact zero rather than a tolerance.
      expect(row.ltcgZeroHeadroom).toBe(expected.caseBHeadroom)
      // The worksheet's second wrong reading: an unfloored subtraction.
      expect(row.ltcgZeroHeadroom).not.toBe(threshold - taxableIncome)
    })
  },
)
