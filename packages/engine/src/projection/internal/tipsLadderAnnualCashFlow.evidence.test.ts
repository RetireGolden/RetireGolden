import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import type { LadderRung } from '../../ladder/ladderMath.js'
import {
  cashAccount,
  productionTaxCalculator,
  singlePersonPlan,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import { tipsLadderAnnualCashFlows, type TipsLadderState, type TipsLadderYearRow } from './tipsLadderAnnualCashFlow.js'

const ANCHOR_YEAR = 2026

/**
 * The worksheet's rung set is not plan-constructible: ladderMath.buildLadder
 * derives faces by back-substitution from a level real income and prices every
 * coupon off the embedded real-yield curve, over CONSECUTIVE offsets — it
 * cannot produce a 1% rung at offset 1 and a 2% rung at offset 3 with nothing
 * between them. The rungs are therefore handed to the phase directly, the way
 * the other annual-phase evidence files hand it their year-scoped state.
 */
function worksheetLadder(scale: number, rungs: readonly LadderRung[]): TipsLadderState {
  return {
    id: 'worksheet-ladder',
    anchorYear: ANCHOR_YEAR,
    rungs,
    costReal: 0,
    purchase: { year: ANCHOR_YEAR, fundingAccountId: 'cash' },
    scale,
  }
}

function rowAtOffset(
  state: TipsLadderState,
  offset: number,
  factorByOffset: readonly number[],
): TipsLadderYearRow {
  const inflFactorFrom = (_from: number, to: number): number =>
    factorByOffset[Math.max(0, to - ANCHOR_YEAR)] ?? 1
  const rows = tipsLadderAnnualCashFlows({
    ladderStates: [state],
    year: ANCHOR_YEAR + offset,
    startYear: ANCHOR_YEAR,
    anyAlive: true,
    inflFactor: factorByOffset[offset]!,
    inflFactorFrom,
    ladderLastAliveYear: ANCHOR_YEAR + 30,
  })
  return rows[0]!
}

describeCalculation(
  'income-tips-ladder-and-ladder-value-annual',
  {
    example: {
      inputs: {
        anchorYear: ANCHOR_YEAR,
        rungAFaceCouponMaturity: [10_000, 1, 1],
        rungBFaceCouponMaturity: [20_000, 2, 3],
        fundingScale: 0.8,
        cumulativeInflationFactorByOffset: [1, 1.05, 1.1],
        householdAlive: true,
        plannedLadderAnnualRealAmount: 10_000,
      },
      expected: {
        purchaseYearCash: 0,
        purchaseYearValue: 24_000,
        offsetOneCash: 8_820,
        offsetOneValue: 16_800,
        offsetTwoCash: 352,
        offsetTwoValue: 17_600,
        droppedMaturingCouponWrongReading: 8_736,
        maturedFaceRetainedWrongReading: 25_200,
        purchaseYearCashPaidWrongReading: 400,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/income-tips-ladder-and-ladder-value-annual.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/income-tips-ladder-and-ladder-value-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[] | boolean>
    const expected = example.expected as Record<string, number>
    const [faceA, couponA, maturityA] = inputs.rungAFaceCouponMaturity as number[]
    const [faceB, couponB, maturityB] = inputs.rungBFaceCouponMaturity as number[]
    const factors = inputs.cumulativeInflationFactorByOffset as number[]
    const rungs: LadderRung[] = [
      { maturityOffset: maturityA!, face: faceA!, couponRatePct: couponA!, cost: 0 },
      { maturityOffset: maturityB!, face: faceB!, couponRatePct: couponB!, cost: 0 },
    ]

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    it('pays no cash in the purchase year and carries the whole face as value', () => {
      const row = rowAtOffset(worksheetLadder(inputs.fundingScale as number, rungs), 0, factors)
      expect(row.kind).toBe('preFlow')
      if (row.kind !== 'preFlow') throw new Error('expected the purchase-year branch')
      expectWithin(row.ladderValue, expected.purchaseYearValue!, 'purchase-year ladderValue')
      // The worksheet's third wrong reading: paying the first coupons in the
      // purchase year. The branch carries no cash field at all.
      expect(Object.hasOwn(row, 'cash')).toBe(false)
    })

    it('pays 8820 at offset 1 and leaves 16800 of unmatured face', () => {
      const row = rowAtOffset(worksheetLadder(inputs.fundingScale as number, rungs), 1, factors)
      expect(row.kind).toBe('flow')
      if (row.kind !== 'flow') throw new Error('expected the flow branch')
      expectWithin(row.cash, expected.offsetOneCash!, 'offset-1 cash')
      expectWithin(row.ladderValue, expected.offsetOneValue!, 'offset-1 ladderValue')
      // The worksheet's first two wrong readings: dropping the maturing
      // rung's own coupon, and keeping its matured face in year-end value.
      expect(withinTolerance(row.cash, expected.droppedMaturingCouponWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(row.ladderValue, expected.maturedFaceRetainedWrongReading!, example.tolerance)).toBe(false)
    })

    it('pays only the surviving rung coupon at offset 2 and holds its face', () => {
      const row = rowAtOffset(worksheetLadder(inputs.fundingScale as number, rungs), 2, factors)
      expect(row.kind).toBe('flow')
      if (row.kind !== 'flow') throw new Error('expected the flow branch')
      expectWithin(row.cash, expected.offsetTwoCash!, 'offset-2 cash')
      expectWithin(row.ladderValue, expected.offsetTwoValue!, 'offset-2 ladderValue')
    })

    it('publishes the same purchase-year branch on a real projection', () => {
      // The branch the worksheet states IS plan-constructible even though its
      // rung set is not: a ladder bought in the projection's first year pays
      // no cash that year, carries its face in ladderValue, and pays the rung
      // out at offset 1, after which nothing is left.
      const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
      plan.accounts = [cashAccount('cash', 200_000)]
      plan.incomeFloor = {
        ladders: [
          {
            id: 'ladder',
            name: 'Bridge',
            purpose: 'bridge',
            startYear: ANCHOR_YEAR + 1,
            endYear: ANCHOR_YEAR + 1,
            annualRealAmount: inputs.plannedLadderAnnualRealAmount as number,
            purchase: { year: ANCHOR_YEAR, fundingAccountId: 'cash' },
          },
        ],
      }
      const result = simulatePlan(validatePlan(plan), {
        startYear: ANCHOR_YEAR,
        horizonEndYear: ANCHOR_YEAR + 1,
        taxCalculator: productionTaxCalculator(),
      })
      const purchaseYear = result.years[0]!
      const payoutYear = result.years[1]!
      expect(purchaseYear.incomes.tipsLadder).toBe(expected.purchaseYearCash)
      expect(purchaseYear.ladderValue).toBeGreaterThan(0)
      expectWithin(
        payoutYear.incomes.tipsLadder,
        inputs.plannedLadderAnnualRealAmount as number,
        'offset-1 published tipsLadder',
      )
      expectWithin(payoutYear.ladderValue, 0, 'offset-1 published ladderValue')
    })
  },
)
