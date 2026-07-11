import { describe, expect, it } from 'vitest'

import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import type { RealYieldCurve } from '../params/types.js'
import {
  MIN_TIPS_COUPON_PCT,
  buildLadder,
  ladderRealFlowsAtOffset,
  ladderRemainingFace,
  realPresentValue,
  realYieldAt,
} from './ladderMath.js'

const flatCurve = (pct: number): RealYieldCurve => ({
  asOfIso: '2026-01-01',
  source: 'test',
  points: [
    { maturityYears: 5, realYieldPct: pct },
    { maturityYears: 30, realYieldPct: pct },
  ],
})

/** Level-payment real annuity factor: PV of $1/yr for n years at real rate y. */
const annuityFactor = (n: number, yPct: number) => {
  const y = yPct / 100
  return (1 - Math.pow(1 + y, -n)) / y
}

describe('realYieldAt', () => {
  it('interpolates linearly between curve points', () => {
    const y15 = realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 15)
    const y10 = realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 10)
    const y20 = realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 20)
    expect(y15).toBeCloseTo((y10 + y20) / 2, 10)
  })

  it('holds the endpoints flat outside the curve', () => {
    expect(realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 1)).toBe(EMBEDDED_REAL_YIELD_CURVE.points[0]!.realYieldPct)
    expect(realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 40)).toBe(
      EMBEDDED_REAL_YIELD_CURVE.points[EMBEDDED_REAL_YIELD_CURVE.points.length - 1]!.realYieldPct,
    )
  })
})

describe('buildLadder', () => {
  it('delivers exactly the target real income in every payout year', () => {
    const build = buildLadder({
      annualRealIncome: 40_000,
      firstPayoutOffset: 1,
      payoutYears: 30,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    expect(build.rungs).toHaveLength(30)
    for (const income of build.annualRealIncomeByOffset) {
      expect(income).toBeCloseTo(40_000, 6)
    }
  })

  it('a single-rung ladder is one discounted payment', () => {
    const build = buildLadder({ annualRealIncome: 10_000, firstPayoutOffset: 1, payoutYears: 1, curve: flatCurve(2) })
    expect(build.rungs).toHaveLength(1)
    const face = build.rungs[0]!.face
    expect(face * (1 + 0.02)).toBeCloseTo(10_000, 6)
    // Par bond on a flat curve prices at face.
    expect(build.totalCost).toBeCloseTo(face, 6)
  })

  it('golden: on a flat curve the total cost is the level-annuity PV', () => {
    // Par TIPS on a flat curve price at face and the aggregate cash flows are a
    // level $X/yr, so the whole ladder must cost X × annuity-factor exactly.
    const build = buildLadder({ annualRealIncome: 40_000, firstPayoutOffset: 1, payoutYears: 30, curve: flatCurve(2.7) })
    expect(build.totalCost).toBeCloseTo(40_000 * annuityFactor(30, 2.7), 4)
  })

  it('golden: mid-2026 curve supports a ~4.8% real safe withdrawal rate over 30 years', () => {
    // The July 2026 market research (§ TIPS ladder floor): at mid-2026 real
    // yields (~2.7% long end) a 30-year TIPS ladder supports ~4.8% real SWR —
    // above Morningstar's 3.9% portfolio SWR. tipsladder.com quotes the same
    // regime. Tolerance is loose because the embedded curve is sloped.
    const build = buildLadder({
      annualRealIncome: 48_000,
      firstPayoutOffset: 1,
      payoutYears: 30,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    const swrPct = (build.targetAnnualRealIncome / build.totalCost) * 100
    expect(swrPct).toBeGreaterThan(4.5)
    expect(swrPct).toBeLessThan(5.1)
  })

  it('a deferred ladder pays only coupons during the deferral window', () => {
    const build = buildLadder({ annualRealIncome: 30_000, firstPayoutOffset: 5, payoutYears: 3, curve: flatCurve(2.5) })
    expect(build.rungs.map((r) => r.maturityOffset)).toEqual([5, 6, 7])
    for (let offset = 1; offset <= 4; offset++) {
      const income = build.annualRealIncomeByOffset[offset - 1]!
      expect(income).toBeGreaterThan(0)
      expect(income).toBeLessThan(30_000 * 0.1)
    }
    for (let offset = 5; offset <= 7; offset++) {
      expect(build.annualRealIncomeByOffset[offset - 1]!).toBeCloseTo(30_000, 6)
    }
    // Par rungs on a flat curve price at face whatever their maturity (the
    // deferral-window coupons carry the time value), so cost = total face.
    const totalFace = build.rungs.reduce((s, r) => s + r.face, 0)
    expect(build.totalCost).toBeCloseTo(totalFace, 6)
  })

  it('floors coupons at the statutory minimum when yields are negative', () => {
    const build = buildLadder({ annualRealIncome: 10_000, firstPayoutOffset: 1, payoutYears: 5, curve: flatCurve(-0.5) })
    for (const rung of build.rungs) {
      expect(rung.couponRatePct).toBe(MIN_TIPS_COUPON_PCT)
      // Coupon above the (negative) yield ⇒ the rung prices above face.
      expect(rung.cost).toBeGreaterThan(rung.face)
    }
    // Negative real yields make guaranteed real income cost more than face value.
    expect(build.totalCost).toBeGreaterThan(10_000 * 5 * 0.98)
  })
})

describe('ladder flows', () => {
  it('tracks outstanding face and maturing principal per year', () => {
    const build = buildLadder({ annualRealIncome: 20_000, firstPayoutOffset: 1, payoutYears: 3, curve: flatCurve(2) })
    const totalFace = build.rungs.reduce((s, r) => s + r.face, 0)
    const y1 = ladderRealFlowsAtOffset(build.rungs, 1)
    expect(y1.outstandingFace).toBeCloseTo(totalFace, 9)
    expect(y1.maturingPrincipal).toBeCloseTo(build.rungs[0]!.face, 9)
    const y3 = ladderRealFlowsAtOffset(build.rungs, 3)
    expect(y3.outstandingFace).toBeCloseTo(build.rungs[2]!.face, 9)
    expect(ladderRemainingFace(build.rungs, 1)).toBeCloseTo(totalFace - build.rungs[0]!.face, 9)
    expect(ladderRemainingFace(build.rungs, 3)).toBe(0)
    const afterEnd = ladderRealFlowsAtOffset(build.rungs, 4)
    expect(afterEnd.outstandingFace).toBe(0)
    expect(afterEnd.coupons).toBe(0)
  })
})

describe('realPresentValue', () => {
  it('matches the direct discount formula on a flat curve', () => {
    const flows = [
      { yearsFromNow: 1, realAmount: 1_000 },
      { yearsFromNow: 10, realAmount: 5_000 },
    ]
    const pv = realPresentValue(flows, flatCurve(3))
    expect(pv).toBeCloseTo(1_000 / 1.03 + 5_000 / Math.pow(1.03, 10), 6)
  })

  it('counts year-0 flows at face and ignores negative offsets', () => {
    const pv = realPresentValue(
      [
        { yearsFromNow: 0, realAmount: 500 },
        { yearsFromNow: -2, realAmount: 9_999 },
      ],
      flatCurve(3),
    )
    expect(pv).toBe(500)
  })
})
