import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import { annualHecmBackstopPlan } from './annualHecmBackstop.js'
import { simulatePlan } from '../simulate.js'
import type { ProjectionResult } from '../types.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'spending-shortfall-annual',
  {
    example: {
      inputs: {
        fundingNeedBeforePortfolioSources: 12_000,
        withdrawalsProduced: 10_000,
        hecmBackstopDraw: 1_500,
        earlierYearShortfalls: 0,
        currentYear: 2034,
      },
      expected: {
        shortfall: 500,
        preHecmGapWrongReading: 2_000,
        hecmAsExpenseWrongReading: 3_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-shortfall-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-shortfall-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const YEAR = inputs.currentYear!

    /**
     * The worksheet's four inputs as a real plan: a $10,000 cash account, a
     * $12,000 lifestyle need, and a last-resort HECM whose principal limit is
     * exactly $1,500 — a $30,000 primary residence at the schema's minimum 5%
     * limit, with a zero growth rate. The owner is 64 at the projection's only
     * year, so no Medicare premium and no pre-65 marketplace premium can
     * change the need, and "earlier-year shortfalls 0" holds by construction.
     */
    function shortfallRun(): ProjectionResult {
      const plan = singlePersonPlan({ dob: `${YEAR - 64}-06-15`, planningAge: 95 })
      plan.accounts = [
        {
          type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0,
          balance: inputs.withdrawalsProduced!, annualContribution: 0,
        },
        {
          type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
          value: inputs.hecmBackstopDraw! * 20, plannedSaleYear: null, expectedNetProceeds: null,
          primaryResidence: true,
          hecm: { openYear: YEAR, principalLimitPct: 5, growthRatePct: 0, drawPolicy: 'lastResort' },
        } as unknown as Account,
      ]
      plan.expenses.baseAnnual = inputs.fundingNeedBeforePortfolioSources!
      return simulatePlan(validated(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFederalTaxCalculator(),
      })
    }

    it('publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw', () => {
      const result = shortfallRun()
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      // The constructed year really is the worksheet's.
      expect(
        withinTolerance(row.expenses.total, inputs.fundingNeedBeforePortfolioSources!, example.tolerance),
        `expenses.total: actual ${row.expenses.total}, worksheet ${inputs.fundingNeedBeforePortfolioSources}`,
      ).toBe(true)
      expect(
        withinTolerance(row.withdrawals.total, inputs.withdrawalsProduced!, example.tolerance),
        `withdrawals.total: actual ${row.withdrawals.total}, worksheet ${inputs.withdrawalsProduced}`,
      ).toBe(true)
      expect(
        withinTolerance(row.hecmDraw, inputs.hecmBackstopDraw!, example.tolerance),
        `hecmDraw: actual ${row.hecmDraw}, worksheet ${inputs.hecmBackstopDraw}`,
      ).toBe(true)
      // The pre-HECM gap, asserted separately from the published figure.
      expect(
        withinTolerance(
          row.expenses.total - row.withdrawals.total,
          expected.preHecmGapWrongReading!,
          example.tolerance,
        ),
        `pre-HECM gap: actual ${row.expenses.total - row.withdrawals.total}, worksheet ${expected.preHecmGapWrongReading}`,
      ).toBe(true)

      expect(
        withinTolerance(row.shortfall, expected.shortfall!, example.tolerance),
        `shortfall: actual ${row.shortfall}, worksheet ${expected.shortfall}`,
      ).toBe(true)
      // The worksheet's first two wrong readings: the pre-HECM gap, and the
      // HECM draw counted as another expense.
      expect(withinTolerance(row.shortfall, expected.preHecmGapWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(row.shortfall, expected.hecmAsExpenseWrongReading!, example.tolerance)).toBe(false)
    })

    it('makes 2034 the depletion year only because 500 exceeds the ledger tolerance', () => {
      // The worksheet declines to invent the tolerance, so it is imported from
      // production and the relation is checked before the year is asserted.
      const result = shortfallRun()
      const row = result.years.find((entry) => entry.year === YEAR)!
      expect(row.shortfall).toBeGreaterThan(ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS)
      expect(result.depletionYear).toBe(YEAR)
    })
  },
)

describeCalculation(
  'hecm-draw-annual',
  {
    example: {
      inputs: {
        hecmLineOpen: true,
        drawPolicy: 'lastResort',
        acceptedCoordinatedDraw: 0,
        truePortfolioShortfallBeforeBackstop: 40_000,
        availableLine: 25_000,
      },
      expected: {
        hecmDraw: 25_000,
        remainingShortfall: 15_000,
        fullShortfallWrongReading: 40_000,
        policyRefusalWrongReading: 0,
        drawPlusRemainingWrongReading: 40_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/hecm-draw-annual.md',
    mutation: 'DOCS/calculations/accounts-and-growth/hecm-draw-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string | boolean>
    const expected = example.expected as Record<string, number>
    const YEAR = 2034
    const shortfall = inputs.truePortfolioShortfallBeforeBackstop as number
    const availableLine = inputs.availableLine as number

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${target}`,
      ).toBe(true)
    }

    const hecmProperty = {
      type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0,
      value: availableLine * 20, plannedSaleYear: null, expectedNetProceeds: null,
      primaryResidence: true,
      hecm: { openYear: YEAR, principalLimitPct: 5, growthRatePct: 0, drawPolicy: 'lastResort' },
    } as unknown as Account

    it('draws the whole 25000 available line against the 40000 shortfall and no more', () => {
      const plan = annualHecmBackstopPlan({
        accounts: [hecmProperty],
        hecmStates: new Map([['home', { principalLimit: availableLine, loanBalance: 0 }]]),
        portfolioShortfall: shortfall,
        anyAlive: true,
      })
      expectWithin(plan.draw, expected.hecmDraw!, 'backstop draw')
      expectWithin(plan.shortfallAfterHecm, expected.remainingShortfall!, 'shortfall after the backstop')
      expect(plan.allocations.map((row) => row.propertyAccountId)).toEqual(['home'])
      // The worksheet's first and third wrong readings.
      expect(withinTolerance(plan.draw, expected.fullShortfallWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(plan.draw + plan.shortfallAfterHecm, expected.hecmDraw!, example.tolerance),
      ).toBe(false)
    })

    it('publishes the same 25000 as hecmDraw on a real last-resort ledger year', () => {
      // A 40,000 lifestyle need, no portfolio at all, and a 500,000 primary
      // residence at the schema's minimum 5-percent principal limit with a
      // zero growth rate, so the available line is exactly 25,000. The owner
      // is 64, so no Medicare or marketplace premium can change the need.
      const plan = singlePersonPlan({ dob: `${YEAR - 64}-06-15`, planningAge: 95 })
      plan.accounts = [hecmProperty]
      plan.expenses.baseAnnual = shortfall
      const result: ProjectionResult = simulatePlan(validated(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      // The constructed year really is the worksheet's: a 40,000 need with no
      // portfolio withdrawal behind it.
      expectWithin(row.expenses.total, shortfall, 'expenses.total')
      expect(row.withdrawals.total).toBe(0)
      expectWithin(row.hecmDraw, expected.hecmDraw!, 'hecmDraw')
      expectWithin(row.shortfall, expected.remainingShortfall!, 'residual shortfall')
      // The worksheet's second wrong reading: refusing the backstop because
      // the policy is lastResort rather than coordinated.
      expect(withinTolerance(row.hecmDraw, expected.policyRefusalWrongReading!, example.tolerance)).toBe(false)
    })
  },
)
