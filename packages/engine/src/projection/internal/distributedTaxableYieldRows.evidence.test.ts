import { expect, it } from 'vitest'

import { parsePlan, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearIncomes, YearResult } from '../types.js'

const YEAR = 2026

/**
 * The two accounts the four yield worksheets share. In the projection's first
 * year the start-of-year balance IS the plan balance, so the worksheets'
 * "prior-year closing balance" arrives without a second year. Everything else
 * about the plan is inert: a 51-year-old filing single with a zero state rate,
 * zero inflation, zero account return, and cost basis equal to balance, so no
 * growth, gain or healthcare charge can move the year.
 */
const EXPLICIT = {
  balance: 100_000,
  interestYieldPct: 2.25,
  dividendYieldPct: 1.75,
  qualifiedRatio: 0.6,
  reinvestDividends: false,
} as const

const DEFAULTS = {
  balance: 80_000,
  interestYieldPct: 1.25,
  dividendYieldPct: 2.5,
} as const

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function rowOf(kind: 'explicit' | 'defaults'): YearResult {
  const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
  plan.accounts = [
    kind === 'explicit'
      ? {
          type: 'taxable',
          id: 'brokerage',
          name: 'Brokerage',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          balance: EXPLICIT.balance,
          costBasis: EXPLICIT.balance,
          annualContribution: 0,
          interestYieldPct: EXPLICIT.interestYieldPct,
          dividendYieldPct: EXPLICIT.dividendYieldPct,
          qualifiedRatio: EXPLICIT.qualifiedRatio,
          reinvestDividends: EXPLICIT.reinvestDividends,
        }
      : {
          // No qualifiedRatio and no reinvestDividends, and no allocation, so
          // the defaults case exercises the 0.85 fallback and reinvest-on.
          type: 'taxable',
          id: 'brokerage',
          name: 'Brokerage',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          balance: DEFAULTS.balance,
          costBasis: DEFAULTS.balance,
          annualContribution: 0,
          interestYieldPct: DEFAULTS.interestYieldPct,
          dividendYieldPct: DEFAULTS.dividendYieldPct,
        },
  ]
  const result = simulatePlan(validated(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFederalTaxCalculator(),
    captureAnnualCashFlow: true,
  })
  const row = result.years.find((entry) => entry.year === YEAR)
  if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
  return row
}

function incomesOf(kind: 'explicit' | 'defaults'): YearIncomes {
  return rowOf(kind).incomes
}

/** Distributed yield that entered household cash, and yield credited back to its account. */
function yieldFlowsOf(kind: 'explicit' | 'defaults'): { toCash: number; reinvested: number } {
  const row = rowOf(kind)
  if (row.cashFlow === undefined) throw new Error('the year published no cash flow')
  const toCash = row.cashFlow.sourceLines
    .filter((line) => line.kind === 'taxableAccountYield')
    .reduce((sum, line) => sum + line.amountPlanDollars, 0)
  const reinvested = row.cashFlow.transferLines
    .filter((line) => line.kind === 'reinvestedYield')
    .reduce((sum, line) => sum + line.creditPlanDollars, 0)
  return { toCash, reinvested }
}

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'income-taxable-interest-annual',
  {
    example: {
      inputs: {
        explicit: { startOfYearBalance: 100_000, interestYieldPct: 2.25, dividendYieldPct: 1.75, qualifiedRatio: 0.6, reinvestDividends: false },
        defaults: { startOfYearBalance: 80_000, interestYieldPct: 1.25, dividendYieldPct: 2.5 },
      },
      expected: { explicit: 2_250, defaults: 1_000 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-taxable-interest-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-taxable-interest-annual.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('takes 2.25 percent of a 100000 start balance as 2250 of interest', () => {
      const incomes = incomesOf('explicit')
      expectWithin(incomes.taxableInterest, expected.explicit!, example.tolerance, 'taxableInterest')
      // The worksheet's first two wrong readings: the dividend rate instead of
      // the interest rate, and reading 2.25 as a fraction.
      expect(withinTolerance(incomes.taxableInterest, 1_750, example.tolerance)).toBe(false)
      expect(withinTolerance(incomes.taxableInterest, 225_000, example.tolerance)).toBe(false)
    })

    it('still characterizes 1000 of interest when the yield is reinvested by default', () => {
      const incomes = incomesOf('defaults')
      expectWithin(incomes.taxableInterest, expected.defaults!, example.tolerance, 'taxableInterest')
      // The worksheet's third wrong reading: reinvestment suppressing the
      // characterization entirely.
      expect(incomes.taxableInterest).toBeGreaterThan(0)
    })
  },
)

describeCalculation(
  'income-qualified-dividends-annual',
  {
    example: {
      inputs: {
        explicit: { startOfYearBalance: 100_000, dividendYieldPct: 1.75, qualifiedRatio: 0.6 },
        defaults: { startOfYearBalance: 80_000, dividendYieldPct: 2.5, defaultQualifiedRatio: 0.85 },
      },
      expected: { explicit: 1_050, defaults: 1_700 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-qualified-dividends-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-qualified-dividends-annual.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('applies the explicit 0.60 ratio to 1750 of dividends: 1050', () => {
      const incomes = incomesOf('explicit')
      expectWithin(incomes.qualifiedDividends, expected.explicit!, example.tolerance, 'qualifiedDividends')
      // The worksheet's first wrong reading: the 0.85 fallback despite the
      // explicit ratio.
      expect(withinTolerance(incomes.qualifiedDividends, 1_487.5, example.tolerance)).toBe(false)
    })

    it('falls back to the 0.85 fraction, not 85, on 2000 of dividends: 1700', () => {
      const incomes = incomesOf('defaults')
      expectWithin(incomes.qualifiedDividends, expected.defaults!, example.tolerance, 'qualifiedDividends')
      // The worksheet's second and third wrong readings: the default as 85
      // rather than 0.85, and reinvestment suppressing characterization.
      expect(withinTolerance(incomes.qualifiedDividends, 170_000, example.tolerance)).toBe(false)
      expect(incomes.qualifiedDividends).toBeGreaterThan(0)
    })
  },
)

describeCalculation(
  'income-ordinary-dividends-annual',
  {
    example: {
      inputs: {
        explicit: { startOfYearBalance: 100_000, dividendYieldPct: 1.75, qualifiedRatio: 0.6 },
        defaults: { startOfYearBalance: 80_000, dividendYieldPct: 2.5, defaultQualifiedRatio: 0.85 },
      },
      expected: { explicit: 700, defaults: 300 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-ordinary-dividends-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-ordinary-dividends-annual.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('leaves 700 of 1750 dividends ordinary at an explicit 0.60 ratio', () => {
      const incomes = incomesOf('explicit')
      expectWithin(incomes.ordinaryDividends, expected.explicit!, example.tolerance, 'ordinaryDividends')
      // The partition, asserted on the same row: ordinary plus qualified is
      // the dividend total, not an addition on top of it.
      expectWithin(
        incomes.ordinaryDividends + incomes.qualifiedDividends,
        1_750,
        example.tolerance,
        'ordinary plus qualified dividends',
      )
      // The worksheet's first two wrong readings: all dividends ordinary, and
      // the 0.85 fallback despite the explicit ratio.
      expect(withinTolerance(incomes.ordinaryDividends, 1_750, example.tolerance)).toBe(false)
      expect(withinTolerance(incomes.ordinaryDividends, 262.5, example.tolerance)).toBe(false)
    })

    it('leaves 300 of 2000 dividends ordinary under the 0.85 fallback', () => {
      const incomes = incomesOf('defaults')
      expectWithin(incomes.ordinaryDividends, expected.defaults!, example.tolerance, 'ordinaryDividends')
      expectWithin(
        incomes.ordinaryDividends + incomes.qualifiedDividends,
        2_000,
        example.tolerance,
        'ordinary plus qualified dividends',
      )
    })
  },
)

describeCalculation(
  'income-taxable-yield-annual',
  {
    example: {
      inputs: {
        explicit: { startOfYearBalance: 100_000, interestYieldPct: 2.25, dividendYieldPct: 1.75, taxExemptInterestYieldPct: 0, qualifiedRatio: 0.6 },
        defaults: { startOfYearBalance: 80_000, interestYieldPct: 1.25, dividendYieldPct: 2.5, taxExemptInterestYieldPct: 0 },
      },
      expected: { explicit: 4_000, defaults: 3_000 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-taxable-yield-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-taxable-yield-annual.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('adds 2250 of interest and 1750 of dividends to 4000 of taxable yield', () => {
      const incomes = incomesOf('explicit')
      expectWithin(incomes.taxableYield, expected.explicit!, example.tolerance, 'taxableYield')
      expectWithin(
        incomes.taxableInterest + incomes.ordinaryDividends + incomes.qualifiedDividends,
        expected.explicit!,
        example.tolerance,
        'interest plus the dividend partition',
      )
      // The worksheet's first wrong reading: adding the dividend partition on
      // top of the dividends it partitions. The second: a municipal sleeve
      // joining taxable yield, when the account carries none and the exempt
      // member is separately published as 0.
      expect(withinTolerance(incomes.taxableYield, 5_750, example.tolerance)).toBe(false)
      expect(incomes.taxExemptInterest).toBe(0)
    })

    it('adds 1000 of interest and 2000 of dividends to 3000 under the defaults', () => {
      const incomes = incomesOf('defaults')
      expectWithin(incomes.taxableYield, expected.defaults!, example.tolerance, 'taxableYield')
      expect(incomes.taxExemptInterest).toBe(0)
    })

    it('credits the reinvested 3000 back to the account and adds 0 to the year cash inflows', () => {
      // The four yield worksheets' third wrong reading: an absent
      // reinvestDividends means true, so the yield is characterized but never
      // reaches household cash; the explicit account, with the flag false,
      // pays its 4000 to cash and reinvests nothing.
      const defaults = yieldFlowsOf('defaults')
      expectWithin(defaults.toCash, 0, example.tolerance, 'defaults yield paid to cash')
      expectWithin(defaults.reinvested, expected.defaults!, example.tolerance, 'defaults yield reinvested')
      const explicit = yieldFlowsOf('explicit')
      expectWithin(explicit.toCash, expected.explicit!, example.tolerance, 'explicit yield paid to cash')
      expectWithin(explicit.reinvested, 0, example.tolerance, 'explicit yield reinvested')
    })
  },
)
