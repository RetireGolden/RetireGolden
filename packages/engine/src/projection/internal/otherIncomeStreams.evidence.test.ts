import { expect, it } from 'vitest'

import { parsePlan, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

const START_YEAR = 2028

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function rowAt(years: YearResult[], year: number): YearResult {
  const row = years.find((entry) => entry.year === year)
  if (row === undefined) throw new Error(`missing projection year ${year}`)
  return row
}

describeCalculation(
  'income-recurring-annual',
  {
    example: {
      inputs: {
        annualAmount: 12_000,
        startYear: 2029,
        endYear: 2032,
        currentYear: 2030,
        inflationAdjusted: true,
        cumulativeInflationFactor: 1.08,
        anyHouseholdMemberAlive: true,
        taxTreatment: 'none',
      },
      expected: { recurring: 12_960, noInflationWrongReading: 12_000, beforeWindow: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-recurring-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-recurring-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string | boolean>
    const expected = example.expected as Record<string, number>

    /**
     * One household stream inside a 2029..2032 window, no accounts, and the
     * worksheet's 1.08 cumulative factor supplied as a per-year inflation path
     * of 8% in the first projection year and 0 after it, so every year from
     * 2029 carries exactly that factor.
     */
    function recurringYears(): YearResult[] {
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.incomes = [
        {
          type: 'recurring',
          id: 'rec-1',
          label: 'Rental',
          annualAmount: inputs.annualAmount as number,
          startYear: inputs.startYear as number,
          endYear: inputs.endYear as number,
          inflationAdjusted: inputs.inflationAdjusted as boolean,
          taxTreatment: inputs.taxTreatment as 'none',
        },
      ]
      return simulatePlan(validated(plan), {
        startYear: START_YEAR,
        horizonEndYear: 2030,
        taxCalculator: createFederalTaxCalculator(),
        market: { inflationPct: [8, 0, 0] },
      }).years
    }

    it('inflates a 12000 tax-free stream to 12960 inside its window', () => {
      const years = recurringYears()
      const year = rowAt(years, inputs.currentYear as number)
      expect(year.people[0]?.alive).toBe(inputs.anyHouseholdMemberAlive)
      expect(
        withinTolerance(year.incomes.recurring, expected.recurring!, example.tolerance),
        `recurring: actual ${year.incomes.recurring}, worksheet ${expected.recurring}`,
      ).toBe(true)
      // The worksheet's first wrong reading: ignoring the inflation election.
      // The second: dropping a tax-free row from cash income entirely.
      expect(withinTolerance(year.incomes.recurring, expected.noInflationWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(year.incomes.total, expected.recurring!, example.tolerance),
        `income total: actual ${year.incomes.total}, worksheet ${expected.recurring}`,
      ).toBe(true)
    })

    it('pays nothing in the year before the window opens', () => {
      const year = rowAt(recurringYears(), START_YEAR)
      expect(
        withinTolerance(year.incomes.recurring, expected.beforeWindow!, example.tolerance),
        `pre-window recurring: actual ${year.incomes.recurring}, worksheet ${expected.beforeWindow}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'income-one-time-annual',
  {
    example: {
      inputs: {
        paymentYear: 2031,
        currentYear: 2031,
        amount: 50_000,
        inflationAdjusted: true,
        cumulativeInflationFactor: 1.12,
        anyHouseholdMemberAlive: true,
        taxTreatment: 'capitalGain',
      },
      expected: { oneTime: 56_000, alreadyNominalWrongReading: 50_000, neighbouringYear: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-one-time-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-one-time-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string | boolean>
    const expected = example.expected as Record<string, number>

    /**
     * One 2031 payment, no accounts, and the worksheet's 1.12 cumulative
     * factor supplied as a per-year inflation path of 12% in the first
     * projection year and 0 after it, so 2029 onward all carry exactly 1.12.
     */
    function oneTimeYears(): YearResult[] {
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.incomes = [
        {
          type: 'oneTime',
          id: 'one-1',
          label: 'Sale',
          year: inputs.paymentYear as number,
          amount: inputs.amount as number,
          inflationAdjusted: inputs.inflationAdjusted as boolean,
          taxTreatment: inputs.taxTreatment as 'capitalGain',
        },
      ]
      return simulatePlan(validated(plan), {
        startYear: START_YEAR,
        horizonEndYear: 2032,
        taxCalculator: createFederalTaxCalculator(),
        market: { inflationPct: [12, 0, 0, 0, 0] },
      }).years
    }

    it('inflates a 50000 capital-gain payment to 56000 in its named year', () => {
      const years = oneTimeYears()
      const year = rowAt(years, inputs.currentYear as number)
      expect(year.people[0]?.alive).toBe(inputs.anyHouseholdMemberAlive)
      expect(
        withinTolerance(year.incomes.oneTime, expected.oneTime!, example.tolerance),
        `oneTime: actual ${year.incomes.oneTime}, worksheet ${expected.oneTime}`,
      ).toBe(true)
      // The worksheet's first wrong reading: treating the amount as already
      // nominal. The third: treating capital-gain character as exclusion from
      // cash income.
      expect(withinTolerance(year.incomes.oneTime, expected.alreadyNominalWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(year.incomes.total, expected.oneTime!, example.tolerance),
        `income total: actual ${year.incomes.total}, worksheet ${expected.oneTime}`,
      ).toBe(true)
    })

    it('pays nothing in the neighbouring years', () => {
      const years = oneTimeYears()
      for (const neighbour of [2030, 2032]) {
        const year = rowAt(years, neighbour)
        expect(
          withinTolerance(year.incomes.oneTime, expected.neighbouringYear!, example.tolerance),
          `${neighbour} oneTime: actual ${year.incomes.oneTime}, worksheet ${expected.neighbouringYear}`,
        ).toBe(true)
      }
    })
  },
)
