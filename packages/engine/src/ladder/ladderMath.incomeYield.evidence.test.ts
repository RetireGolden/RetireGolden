import { expect, it, vi } from 'vitest'

import type { TipsLadder } from '../model/plan.js'
import type { RealYieldCurve } from '../params/types.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, runPlan, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import * as ladderMath from './ladderMath.js'
import { buildLadder, ladderIncomeYieldPct, planLadderWindow, quotePlanLadder } from './ladderMath.js'

/** A flat real curve: one point, held flat at both ends. */
function flatCurve(realYieldPct: number): RealYieldCurve {
  return { ...EMBEDDED_REAL_YIELD_CURVE, points: [{ maturityYears: 5, realYieldPct }] }
}

function ownedLadder(startYear: number, endYear: number, annualRealAmount: number): TipsLadder {
  return { id: 'floor', name: 'Floor', purpose: 'floor', startYear, endYear, annualRealAmount }
}

describeCalculation(
  'ladder-income-yield',
  {
    example: {
      inputs: {
        caseA: { curvePct: 2, income: 10_200, firstOffset: 1, payoutYears: 1 },
        caseB: { curvePct: 2, income: 10_200, firstOffset: 1, payoutYears: 2 },
        caseC: { curvePct: 0, income: 20_000, firstOffset: 3, payoutYears: 2 },
        caseD: { curve: 'embedded (1.85, 2.05, 2.25, 2.55, 2.70 at 5, 7, 10, 20, 30 years)', income: 30_000, ladderStart: 2027, ladderEnd: 2046, projectionStart: 2026 },
      },
      expected: {
        caseA: { totalCost: 10_000, yieldPct: 102, printed: '102.00' },
        caseB: { totalCost: 19_803.92156862745, yieldPct: 51.504950495049506, printed: '51.50', annuityRatePct: 51.50495049504951 },
        caseC: { totalCost: 40_099.81281201245, yieldPct: 49.875544541217224, printed: '49.88', facesOnlyPct: 50.09 },
        caseD: { totalCost: 474_975.27302773914, yieldPct: 6.316118270486886, printed: '6.32', anchorYear: 2025, firstMaturity: 2027, lastMaturity: 2046, rungs: 20 },
        costOverIncomeB: 194.16,
        caseCExact: 49.875544541217224,
        caseCOtherAssociation: 49.87554454121722,
        purchasedAtStart: { anchorYear: 2026, effectiveStartYear: 2027, firstPayoutOffset: 1, payoutYears: 9 },
        ownedFromBefore: { anchorYear: 2025, effectiveStartYear: 2026, firstPayoutOffset: 1, payoutYears: 10 },
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/income-floor-ladder-yield-pct.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/income-floor-ladder-yield-pct.mutation.md',
  },
  ({ example }) => {
    type Case = { curvePct: number; income: number; firstOffset: number; payoutYears: number }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, Record<string, number | string>>
    const near = (actual: number, target: number, label: string) =>
      expect(withinTolerance(actual, target, example.tolerance), `${label}: ${actual} against the worksheet's ${target}`).toBe(true)

    it('cases A to C: income over cost, × 100, on synthetic curves', () => {
      for (const key of ['caseA', 'caseB', 'caseC'] as const) {
        const c = inputs[key]!
        const e = expected[key]!
        const build = buildLadder({ annualRealIncome: c.income, firstPayoutOffset: c.firstOffset, payoutYears: c.payoutYears, curve: flatCurve(c.curvePct) })
        near(build.totalCost, e.totalCost as number, `${key} cost`)
        const yieldPct = ladderIncomeYieldPct(build)
        near(yieldPct, e.yieldPct as number, `${key} yield`)
        expect(yieldPct.toFixed(2), key).toBe(e.printed)
      }
      // Case B is the level annuity rate on a flat par curve, 1.0404 / 2.02.
      near((1.0404 / 2.02) * 100, expected.caseB!.annuityRatePct as number, 'caseB annuity')
    })

    it('rejects the worksheet wrong readings: cost over income, and income over total face', () => {
      const b = inputs.caseB!
      const buildB = buildLadder({ annualRealIncome: b.income, firstPayoutOffset: b.firstOffset, payoutYears: b.payoutYears, curve: flatCurve(b.curvePct) })
      expect(Math.round((buildB.totalCost / b.income) * 100 * 100) / 100).toBe(expected.costOverIncomeB)
      const c = inputs.caseC!
      const buildC = buildLadder({ annualRealIncome: c.income, firstPayoutOffset: c.firstOffset, payoutYears: c.payoutYears, curve: flatCurve(c.curvePct) })
      const faces = buildC.rungs.reduce((sum, rung) => sum + rung.face, 0)
      expect(Math.round((c.income / faces) * 100 * 100) / 100).toBe(expected.caseC!.facesOnlyPct)
      expect(ladderIncomeYieldPct(buildC).toFixed(2)).not.toBe(String(expected.caseC!.facesOnlyPct))
    })

    it('case D: a plan ladder already owned is quoted on the ledger window, anchored the year before the projection', () => {
      const d = example.inputs.caseD as { income: number; ladderStart: number; ladderEnd: number; projectionStart: number }
      const e = expected.caseD!
      const quote = quotePlanLadder(ownedLadder(d.ladderStart, d.ladderEnd, d.income), d.projectionStart)!
      expect(quote.anchorYear).toBe(e.anchorYear)
      expect(quote.maturityYears).toHaveLength(e.rungs as number)
      expect(quote.maturityYears[0]).toBe(e.firstMaturity)
      expect(quote.maturityYears.at(-1)).toBe(e.lastMaturity)
      near(quote.build.totalCost, e.totalCost as number, 'caseD cost')
      near(quote.incomeYieldPct, e.yieldPct as number, 'caseD yield')
      expect(quote.incomeYieldPct).toBe(ladderIncomeYieldPct(quote.build))
      expect(quote.incomeYieldPct.toFixed(2)).toBe(e.printed)
    })

    it('computes income over cost, then × 100: the other order misses case C in the last digit', () => {
      const c = expected.caseC!
      const yieldPct = ladderIncomeYieldPct({ targetAnnualRealIncome: 20_000, totalCost: c.totalCost as number })
      expect(yieldPct).toBe(expected.caseCExact)
      expect((20_000 * 100) / (c.totalCost as number)).toBe(expected.caseCOtherAssociation)
      expect(yieldPct).not.toBe(expected.caseCOtherAssociation)
    })

    it('never pays out in the anchor year: a ladder bought or starting at the anchor pays from the year after', () => {
      // Bought in the projection's first year and starting then: payouts 2027 to 2035.
      const bought: TipsLadder = { ...ownedLadder(2026, 2035, 30_000), purchase: { year: 2026, fundingAccountId: 'cash' } }
      expect(planLadderWindow(bought, 2026)).toEqual(expected.purchasedAtStart)
      // Owned, with a start before the projection: anchored the year before it, paying from 2026.
      expect(planLadderWindow(ownedLadder(2020, 2035, 30_000), 2026)).toEqual(expected.ownedFromBefore)
    })

    it('publishes no quote for an empty window or a zero amount, and refuses a cost that is not positive', () => {
      expect(quotePlanLadder(ownedLadder(2027, 2026, 30_000), 2028)).toBeNull()
      expect(quotePlanLadder(ownedLadder(2027, 2046, 0), 2026)).toBeNull()
      expect(planLadderWindow(ownedLadder(2027, 2046, 0), 2026)).toBeNull()
      expect(() => ladderIncomeYieldPct({ targetAnnualRealIncome: 1, totalCost: 0 })).toThrow(RangeError)
    })

    it('is the window the ledger prices: simulatePlan calls planLadderWindow for each ladder', () => {
      const plan = singlePersonPlan({ dob: '1961-06-15', planningAge: 90 })
      plan.accounts = [cashAccount('cash', 2_000_000)]
      plan.incomeFloor = {
        ladders: [
          ownedLadder(2027, 2046, 30_000),
          { ...ownedLadder(2030, 2040, 20_000), id: 'bought', purchase: { year: 2028, fundingAccountId: 'cash' } },
        ],
      }
      const spy = vi.spyOn(ladderMath, 'planLadderWindow')
      try {
        const result = runPlan(validatePlan(plan), createFlatTaxCalculator(0))
        expect(spy.mock.calls.map(([ladder, startYear]) => [ladder.id, startYear])).toEqual([
          ['floor', 2026],
          ['bought', 2026],
        ])
        // The owned ladder's first year pays the coupons of offset 1 from its 2025 anchor,
        // at an inflation factor of 1, exactly as the quote's income by offset says.
        const quote = quotePlanLadder(plan.incomeFloor.ladders[0]!, 2026)!
        near(result.years[0]!.incomes.tipsLadder, quote.build.annualRealIncomeByOffset[0]!, 'first-year ladder income')
      } finally {
        spy.mockRestore()
      }
    })
  },
)
