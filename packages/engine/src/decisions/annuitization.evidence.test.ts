import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { cashAccount, singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { buildAnnuitizationSweep } from './annuitization.js'
import { spiaPayoutRate } from './spiaQuotes.js'

const START_YEAR = 2026

describeCalculation(
  'annuitization-sweep-point',
  {
    example: {
      inputs: {
        totalInvestable: 200_000,
        largestLiquidFundingAccount: 100_000,
        requestedGridAllocationPct: 60,
        currentAndStartAge: 72,
        userQuotePresent: false,
        smallPointGridAllocationPct: 2,
        age70PayoutRate: 0.084,
        age75PayoutRate: 0.103,
        fundingCapFraction: 0.95,
        minimumPremium: 5_000,
        pctTolerance: { abs: 1e-9 },
        pathCount: 2,
        seed: 20260918,
      },
      expected: {
        premium: 95_000,
        annualIncome: 8_702,
        effectiveAllocationPct: 47.5,
        payoutRatePct: 9.16,
        uncappedPremiumWrongReading: 120_000,
        uncappedAnnualIncomeWrongReading: 10_992,
        uninterpolatedIncomeWrongReading: 7_980,
        smallPointPremiumWrongReading: 4_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/annuitization-sweep-point.md',
    mutation: 'DOCS/calculations/monte-carlo/annuitization-sweep-point.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>
    const total = inputs.totalInvestable as number
    const funding = inputs.largestLiquidFundingAccount as number
    const gridPct = inputs.requestedGridAllocationPct as number
    const smallPct = inputs.smallPointGridAllocationPct as number
    const pctTolerance = inputs.pctTolerance as { abs: number }

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    /**
     * Born 1954, so the sweep's current age at the 2026 start is 72. The
     * $100,000 cash account is the funding account (largest cash-or-taxable)
     * and the $100,000 traditional account brings the investable total to
     * $200,000 without being fundable. A point is only published when the
     * shared-path comparison returns a row for its variant, so the sweep runs
     * a two-path Monte Carlo over a two-year horizon.
     */
    function sweep() {
      const plan = singlePersonPlan({ dob: '1954-06-15', planningAge: 73 })
      plan.accounts = [cashAccount('cash', funding), traditionalAccount('trad', total - funding)]
      return buildAnnuitizationSweep(
        validatePlan(plan),
        {
          startYear: START_YEAR,
          taxCalculator: createFlatTaxCalculator(0),
          model: { type: 'lognormal', inflationMeanPct: 0, returnVolPct: 10 },
          pathCount: inputs.pathCount as number,
          seed: inputs.seed as number,
        },
        { allocationPcts: [smallPct, gridPct] },
      )
    }

    it('caps the 60% point at the funding account and prices it at the interpolated rate', () => {
      const result = sweep()
      expect(result.startAge).toBe(inputs.currentAndStartAge)
      expect(result.rateSource).toBe('default-table')
      expect(
        withinTolerance(result.payoutRatePct, expected.payoutRatePct!, pctTolerance),
        `payoutRatePct ${result.payoutRatePct} is not within ${JSON.stringify(pctTolerance)} of ${expected.payoutRatePct}`,
      ).toBe(true)

      const point = result.points.find((entry) => entry.allocationPct === gridPct)
      if (point === undefined) throw new Error(`missing the ${gridPct}% sweep point`)
      expectWithin(point.premium, expected.premium!, 'premium')
      // ... and the premium is the funding cap, not the requested share.
      expectWithin(point.premium, (inputs.fundingCapFraction as number) * funding, 'premium against the funding cap')
      expectWithin(point.annualIncome, expected.annualIncome!, 'annualIncome')
      expect(
        withinTolerance(point.effectiveAllocationPct, expected.effectiveAllocationPct!, pctTolerance),
        `effectiveAllocationPct ${point.effectiveAllocationPct} is not within ${JSON.stringify(pctTolerance)} of ${expected.effectiveAllocationPct}`,
      ).toBe(true)

      // The worksheet's first two wrong readings: ignoring the 95% cap, and
      // using the age-70 anchor without interpolating to 72.
      expect(withinTolerance(point.premium, expected.uncappedPremiumWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(point.annualIncome, expected.uncappedAnnualIncomeWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(point.annualIncome, expected.uninterpolatedIncomeWrongReading!, example.tolerance)).toBe(false)
      expect(spiaPayoutRate(70)).toBe(inputs.age70PayoutRate)
      expect(spiaPayoutRate(75)).toBe(inputs.age75PayoutRate)
    })

    it('skips the 2% point because its premium is under 5000', () => {
      const result = sweep()
      // The worksheet's third wrong reading: keeping the $4,000 point. A
      // skipped point is never pushed, so it is absent rather than zeroed.
      expect((smallPct / 100) * total).toBe(expected.smallPointPremiumWrongReading)
      expect((smallPct / 100) * total).toBeLessThan(inputs.minimumPremium as number)
      expect(result.points.map((entry) => entry.allocationPct)).toEqual([0, gridPct])
    })
  },
)
