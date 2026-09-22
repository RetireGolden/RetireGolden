import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import type { IncomeStream } from '../../model/plan.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

/**
 * The smallest plan whose 2026 row runs one fill-to-bracket conversion: a
 * 63-year-old single filer (over 59.5 so no early-distribution rule applies,
 * under 65 so the deduction is the base standard deduction with no age
 * addition), one uninflated recurring ordinary stream, a traditional account
 * to convert from, and a cash account to settle the tax. Zero return and zero
 * inflation keep the 2026 bracket ladder unindexed.
 */
function conversionRow(ordinaryIncome: number, traditionalBalance: number, ss?: IncomeStream): YearResult {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.accounts = [
    cashAccount('cash', 50_000),
    traditionalAccount('trad', traditionalBalance),
    // A conversion needs a destination: an owner with no Roth account of
    // their own converts nothing, whatever the sizing says.
    { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
  ]
  plan.incomes = ss ? [recurringOrdinaryIncome('ordinary', ordinaryIncome), ss] : [recurringOrdinaryIncome('ordinary', ordinaryIncome)]
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'topOfBracket',
    targetValue: 22,
    startYear: 2026,
    endYear: 2026,
  }
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
  'roth-conversion-annual',
  {
    example: {
      inputs: {
        taxYear: 2026,
        filingStatus: 'single',
        selectedBracketPct: 22,
        selectedBracketUpperBound: 105_700,
        ordinaryIncomeBeforeConversion: 70_000,
        standardDeduction: 16_100,
        socialSecurityBenefits: 0,
        availableTraditionalBalance: 100_000,
        selectedBracketLowerBound: 50_400,
        benefitsBranchMonthlyPia: 2_000,
      },
      expected: { conversion: 51_800, ignoringDeductionWrongReading: 35_700 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/roth/roth-conversion-annual.md',
    mutation: 'DOCS/calculations/roth/roth-conversion-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number>
    const ordinary = inputs.ordinaryIncomeBeforeConversion as number
    const deduction = inputs.standardDeduction as number
    const upperBound = inputs.selectedBracketUpperBound as number

    it('converts 51800, the 22% bracket headroom above taxable income', () => {
      const row = conversionRow(ordinary, inputs.availableTraditionalBalance as number)
      // The constructed row really does carry the worksheet's inputs.
      expect(row.incomes.total).toBe(ordinary)
      expect(row.incomes.socialSecurity).toBe(inputs.socialSecurityBenefits)
      expect(
        withinTolerance(row.rothConversion, expected.conversion!, example.tolerance),
        `rothConversion ${row.rothConversion} is not within ${JSON.stringify(example.tolerance)} of ${expected.conversion}`,
      ).toBe(true)
      // ... and the published figure is the bound minus taxable income.
      expect(
        withinTolerance(row.rothConversion, upperBound - (ordinary - deduction), example.tolerance),
      ).toBe(true)
      // The worksheet's first two wrong readings: ignoring the deduction, and
      // reading the bracket's own lower bound as its ceiling (clamped to 0).
      expect(withinTolerance(row.rothConversion, expected.ignoringDeductionWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(row.rothConversion, 0, example.tolerance)).toBe(false)
    })

    it('sizes the conversion below the no-benefit headroom once benefits are present', () => {
      // The worksheet asserts no number for this branch: it states only that
      // the subtraction no longer holds, because taxable Social Security
      // phases in with the conversion. The evidence pins that direction.
      const row = conversionRow(ordinary, inputs.availableTraditionalBalance as number, {
        type: 'socialSecurity',
        id: 'ss',
        personId: 'p1',
        piaMonthly: inputs.benefitsBranchMonthlyPia as number,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      })
      expect(row.incomes.socialSecurity).toBeGreaterThan(0)
      expect(row.rothConversion).toBeGreaterThan(0)
      expect(row.rothConversion).toBeLessThan(expected.conversion!)
    })
  },
)
