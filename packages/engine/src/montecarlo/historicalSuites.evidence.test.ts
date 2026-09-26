import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import type { Account } from '../model/plan.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { runHistoricalStressSuites } from './historicalSuites.js'

const START_YEAR = 2026

describeCalculation(
  'historical-stress-window-total-shortfall',
  {
    example: {
      inputs: {
        historicalWindow: '2000-2002',
        replayedAnnualReturnsPct: [0, 0, 0],
        openingBalance: 100_000,
        annualSpending: 60_000,
        incomeTaxPenaltiesHecm: 0,
        windowLengthYears: 3,
        annualShortfallsByYear: [0, 20_000, 60_000],
      },
      expected: {
        totalShortfall: 80_000,
        cumulativeMissWrongReading: 100_000,
        stopAfterFirstEmptyWrongReading: 20_000,
        openingAsIncomeWrongReading: 0,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/historical-stress-window-total-shortfall.md',
    mutation: 'DOCS/calculations/monte-carlo/historical-stress-window-total-shortfall.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>
    const spending = inputs.annualSpending as number

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    it('sums 0, 20000 and 60000 to 80000 over the replayed 2000-2002 window', () => {
      // A plan the replay cannot move on either axis. Returns: one CASH
      // account, which the growth phase exempts from the market return shock,
      // so the replayed returns really are 0, 0, 0. Inflation: spending is an
      // interest-free note amortizing $60,000 a year, and debt service is a
      // NOMINAL scheduled payment — base spending and one-time goals are both
      // inflated to the year, so the window's own 3.4% and 1.6% CPI prints
      // would have rescaled them. Three projection years (2026-2028) from the
      // planning age, no income, no tax, no HECM.
      const plan = singlePersonPlan({ dob: '1968-06-15', planningAge: 60 })
      plan.accounts = [cashAccount('cash', inputs.openingBalance as number)]
      plan.accounts.push({
        type: 'debt', id: 'note', name: 'Interest-free note', ownerPersonId: null, annualReturnPct: 0,
        balance: spending * (inputs.windowLengthYears as number), interestPct: 0, monthlyPayment: spending / 12,
      } as unknown as Account)

      const suites = runHistoricalStressSuites(validatePlan(plan), {
        startYear: START_YEAR,
        taxCalculator: createFlatTaxCalculator(0),
        windowLengthYears: inputs.windowLengthYears as number,
        suites: ['rolling'],
      })
      const rolling = suites.suites[0]!
      const window = rolling.windows.find((entry) => entry.label === inputs.historicalWindow)
      if (window === undefined) throw new Error(`missing historical window ${String(inputs.historicalWindow)}`)

      // The constructed window really does carry the worksheet's per-year
      // shortfalls, and its replay really is return-neutral on this plan.
      expect(window.projection.years.map((row) => row.year)).toEqual([START_YEAR, START_YEAR + 1, START_YEAR + 2])
      const shortfalls = inputs.annualShortfallsByYear as number[]
      window.projection.years.forEach((row, index) => {
        expectWithin(row.shortfall, shortfalls[index]!, `${row.year} shortfall`)
      })

      expectWithin(window.totalShortfall, expected.totalShortfall!, 'totalShortfall')
      // ... and it is the plain sum of those rows.
      expectWithin(
        window.totalShortfall,
        window.projection.years.reduce((sum, row) => sum + row.shortfall, 0),
        'totalShortfall against its own rows',
      )
      // The worksheet's three wrong readings: cumulative unmet spending,
      // stopping once the account first empties, and treating opening assets
      // as income so nothing ever falls short.
      expect(withinTolerance(window.totalShortfall, expected.cumulativeMissWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(window.totalShortfall, expected.stopAfterFirstEmptyWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(window.totalShortfall, expected.openingAsIncomeWrongReading!, example.tolerance)).toBe(false)
      expect(window.success).toBe(false)
    })

    it('refuses an explicit window that is not a whole number of years from 1 to 96, before simulating', () => {
      // It used to be clamped into [1, 96] without a word, and a fractional window read past the series.
      const plan = singlePersonPlan({ dob: '1968-06-15', planningAge: 60 })
      plan.accounts = [cashAccount('cash', inputs.openingBalance as number)]
      const valid = validatePlan(plan)
      for (const windowLengthYears of [0, 97, 2.5, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          runHistoricalStressSuites(valid, { startYear: START_YEAR, taxCalculator: createFlatTaxCalculator(0), windowLengthYears }),
        ).toThrow(
          new RangeError(
            `Historical stress windowLengthYears must be a whole number of years from 1 to 96 (the length of the historical series); got ${windowLengthYears}.`,
          ),
        )
      }
      for (const windowLengthYears of [1, 96]) {
        const result = runHistoricalStressSuites(valid, {
          startYear: START_YEAR,
          taxCalculator: createFlatTaxCalculator(0),
          windowLengthYears,
          suites: ['rolling'],
        })
        expect(result.windowLengthYears).toBe(windowLengthYears)
        expect(result.suites[0]!.windows).toHaveLength(96 - windowLengthYears + 1)
      }
    })

    it('refuses a worst-window count that is not a whole number of at least 1, before simulating', () => {
      // It used to be raised to 1 without a word.
      const plan = singlePersonPlan({ dob: '1968-06-15', planningAge: 60 })
      plan.accounts = [cashAccount('cash', inputs.openingBalance as number)]
      const valid = validatePlan(plan)
      for (const worstWindowCount of [0, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          runHistoricalStressSuites(valid, { startYear: START_YEAR, taxCalculator: createFlatTaxCalculator(0), worstWindowCount }),
        ).toThrow(new RangeError(`Historical stress worstWindowCount must be a whole number of at least 1; got ${worstWindowCount}.`))
      }
      const result = runHistoricalStressSuites(valid, {
        startYear: START_YEAR,
        taxCalculator: createFlatTaxCalculator(0),
        windowLengthYears: 90,
        suites: ['rolling'],
        worstWindowCount: 1,
      })
      expect(result.suites[0]!.worstByTotalShortfall).toHaveLength(1)
      expect(result.suites[0]!.worstByEndingAfterTaxEstate).toHaveLength(1)
    })
  },
)
