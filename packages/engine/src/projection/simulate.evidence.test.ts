import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult } from './types.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(plan: Plan, startYear: number, horizonEndYear: number): ProjectionResult {
  return simulatePlan(validated(plan), {
    startYear,
    horizonEndYear,
    taxCalculator: createFederalTaxCalculator(),
  })
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
  'income-total-annual',
  {
    example: {
      inputs: {
        wages: 48_000,
        socialSecurity: 18_000,
        pension: 9_000,
        annuity: 3_000,
        tipsLadder: 2_000,
        recurring: 4_000,
        oneTime: 6_000,
        taxableInterest: 700,
        ordinaryDividends: 800,
        qualifiedDividends: 1_500,
        taxableYield: 3_000,
        taxExemptInterest: 500,
      },
      expected: {
        total: 93_500,
        withoutTaxExemptInterestWrongReading: 93_000,
        withoutTaxableYieldWrongReading: 90_500,
        withCharacterComponentsWrongReading: 96_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-total-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-total-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = 2026

    /**
     * The smallest real plan whose single 2026 row realizes all nine members
     * at the worksheet's amounts. Four separate taxable accounts carry one
     * yield figure each — a pure interest sleeve, a wholly qualified dividend
     * sleeve, a wholly ordinary dividend sleeve and a municipal sleeve — so
     * every published character field lands exactly. The Social Security
     * stream is claimed at this cohort's full retirement age (66 years 8
     * months for a 1958 birth), so the claim factor is exactly 1 and the
     * earnings test withholds nothing against the wage row.
     */
    function incomePlan(): Plan {
      const plan = singlePersonPlan({ dob: '1958-06-15', planningAge: 95 })
      plan.accounts = [
        {
          type: 'taxable', id: 'interest-sleeve', name: 'Interest sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 70_000, costBasis: 70_000, annualContribution: 0,
          interestYieldPct: 1, dividendYieldPct: 0, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'qualified-sleeve', name: 'Qualified sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 150_000, costBasis: 150_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 1, qualifiedRatio: 1, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'ordinary-sleeve', name: 'Ordinary sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 80_000, costBasis: 80_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 1, qualifiedRatio: 0, reinvestDividends: false,
        },
        {
          type: 'taxable', id: 'muni-sleeve', name: 'Municipal sleeve', ownerPersonId: 'p1',
          annualReturnPct: 0, balance: 50_000, costBasis: 50_000, annualContribution: 0,
          interestYieldPct: 0, dividendYieldPct: 0, taxExemptInterestYieldPct: 1, reinvestDividends: false,
        },
        {
          type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
          startAge: 65, monthlyAmount: inputs.pension! / 12, colaPct: 0, survivorPct: 0,
        } as unknown as Account,
        {
          type: 'annuity', id: 'ann', name: 'Annuity', ownerPersonId: 'p1', annualReturnPct: 0,
          startAge: 65, monthlyAmount: inputs.annuity! / 12, colaPct: 0, taxablePct: 100,
        } as unknown as Account,
      ]
      plan.incomes = [
        { type: 'wages', id: 'w', personId: 'p1', annualGross: inputs.wages!, realGrowthPct: 0, endAge: null },
        {
          type: 'socialSecurity', id: 'ss', personId: 'p1',
          piaMonthly: inputs.socialSecurity! / 12, earnings: null,
          claimAge: { years: 66, months: 8 },
        },
        {
          type: 'recurring', id: 'rec', label: 'Rental', annualAmount: inputs.recurring!,
          startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary',
        },
        {
          type: 'oneTime', id: 'one', label: 'Sale', year: YEAR, amount: inputs.oneTime!,
          inflationAdjusted: false, taxTreatment: 'ordinary',
        },
      ]
      plan.incomeFloor = {
        ladders: [
          {
            id: 'ladder', name: 'Bridge', purpose: 'bridge',
            startYear: YEAR, endYear: YEAR, annualRealAmount: inputs.tipsLadder!,
          },
        ],
      }
      return plan
    }

    it('sums the nine members to 93500 and counts the character fields once', () => {
      const result = run(incomePlan(), YEAR, YEAR)
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
      const incomes = row.incomes

      // The constructed year really does carry the worksheet's twelve
      // published components.
      for (const key of [
        'wages', 'socialSecurity', 'pension', 'annuity', 'tipsLadder', 'recurring', 'oneTime',
        'taxableInterest', 'ordinaryDividends', 'qualifiedDividends', 'taxableYield', 'taxExemptInterest',
      ] as const) {
        expectWithin(incomes[key], inputs[key]!, example.tolerance, `incomes.${key}`)
      }

      expectWithin(incomes.total, expected.total!, example.tolerance, 'incomes.total')
      // ... and the published total is that composition of its own members.
      expectWithin(
        incomes.total,
        incomes.wages + incomes.socialSecurity + incomes.pension + incomes.annuity +
          incomes.tipsLadder + incomes.recurring + incomes.oneTime + incomes.taxableYield +
          incomes.taxExemptInterest,
        example.tolerance,
        'incomes.total against its own published members',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.withoutTaxExemptInterestWrongReading!,
        expected.withoutTaxableYieldWrongReading!,
        expected.withCharacterComponentsWrongReading!,
      ]) {
        expect(withinTolerance(incomes.total, wrong, example.tolerance)).toBe(false)
      }
    })
  },
)

describeCalculation(
  'projection-result-ending-investable',
  {
    example: {
      inputs: {
        firstRowInvestableTotal: 510_000,
        lastRowInvestableTotal: 487_250.125,
        yearRowOrder: [2030, 2031],
      },
      expected: { endingInvestable: 487_250.125 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-investable.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-investable.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number>
    const first = inputs.firstRowInvestableTotal as number
    const last = inputs.lastRowInvestableTotal as number

    it('republishes the 2031 row and not the 2030 one', () => {
      // One cash account that closes 2030 at 510,000 and spends the difference
      // down to 487,250.125 through an uninflated 2031 one-time goal.
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: first, annualContribution: 0 },
      ]
      plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend-down', year: 2031, amount: first - last }]
      const result = run(plan, 2030, 2031)
      expect(result.years.map((row) => row.year)).toEqual(inputs.yearRowOrder)
      expectWithin(result.years[0]!.investableTotal, first, example.tolerance, '2030 investableTotal')
      expectWithin(result.years[1]!.investableTotal, last, example.tolerance, '2031 investableTotal')

      expectWithin(result.endingInvestable, expected.endingInvestable!, example.tolerance, 'endingInvestable')
      // The worksheet's wrong readings: the first row, and the rows summed.
      expect(withinTolerance(result.endingInvestable, first, example.tolerance)).toBe(false)
      expect(withinTolerance(result.endingInvestable, first + last, example.tolerance)).toBe(false)
    })

  },
)

describeCalculation(
  'projection-result-ending-net-worth',
  {
    example: {
      inputs: {
        firstRowNetWorth: 925_000,
        lastRowNetWorth: 901_375.625,
        yearRowOrder: [2030, 2031],
      },
      expected: { endingNetWorth: 901_375.625 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-net-worth.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/projection-result-ending-net-worth.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number>
    const first = inputs.firstRowNetWorth as number
    const last = inputs.lastRowNetWorth as number
    const propertyValue = 415_000

    it('republishes the 2031 row and never substitutes ending investable', () => {
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: first - propertyValue, annualContribution: 0 },
        {
          type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
          value: propertyValue, plannedSaleYear: null, expectedNetProceeds: null,
        } as unknown as Account,
      ]
      plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend-down', year: 2031, amount: first - last }]
      const result = run(plan, 2030, 2031)
      expect(result.years.map((row) => row.year)).toEqual(inputs.yearRowOrder)
      expectWithin(result.years[0]!.netWorth, first, example.tolerance, '2030 netWorth')
      expectWithin(result.years[1]!.netWorth, last, example.tolerance, '2031 netWorth')

      expectWithin(result.endingNetWorth, expected.endingNetWorth!, example.tolerance, 'endingNetWorth')
      // The worksheet's wrong readings: the first row, and ending investable,
      // which on this run differs by the whole property value.
      expect(withinTolerance(result.endingNetWorth, first, example.tolerance)).toBe(false)
      expect(withinTolerance(result.endingNetWorth, result.endingInvestable, example.tolerance)).toBe(false)
      expectWithin(
        result.endingNetWorth - result.endingInvestable,
        propertyValue,
        example.tolerance,
        'net worth above ending investable',
      )
    })

  },
)
