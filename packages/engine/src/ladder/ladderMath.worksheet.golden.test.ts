import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { buildLadder } from './ladderMath.js'

/**
 * Independent hand-priced spot check of the TIPS-ladder construction on the
 * dated embedded curve (closes the "identities only, no independently derived
 * dollar figures" gap in DOCS/external-oracles.md).
 *
 * Oracle: a hand worksheet on the U.S. Treasury par real yield curve snapshot
 * of 2026-06-30 (params/data/realYieldCurve2026.ts; source
 * https://home.treasury.gov/resource-center/data-chart-center/interest-rates).
 * Every figure below is derived from the published construction rules by
 * decimal arithmetic outside the engine — never by running buildLadder.
 *
 * Case: level real income T = $12,000 for offsets 5..7 (firstPayoutOffset 5,
 * payoutYears 3). Curve mechanics under test: endpoint hold (yields at
 * offsets 1..5 are all the 5y point, 1.85%), interpolation (offset 6 is the
 * 5y/7y midpoint, 1.95%), and par-as-spot discounting.
 *
 * Worksheet (all real dollars):
 *   coupon rates: c5 = 1.85%, c6 = 1.95%, c7 = 2.05% (curve yields at maturity)
 *   Back-to-front faces (maturing principal + coupons of outstanding rungs = T):
 *     f7 = 12,000 / 1.0205                          = 11,758.94169
 *     f6 = (12,000 - f7*0.0205) / 1.0195            = 11,534.02814
 *     f5 = (12,000 - f7*0.0205 - f6*0.0195) / 1.0185 = 11,324.52444
 *   Coupon dollars: f5*c5 = 209.50370, f6*c6 = 224.91355, f7*c7 = 241.05831
 *   Prices (discount year k at the curve yield for maturity k):
 *     p5: all five cash-flow years discount at 1.85% = the coupon rate, so the
 *         rung prices exactly at par: p5 = f5 = 11,324.52444
 *     p6 = 224.91355 * A(5, 1.85%) + (224.91355 + 11,534.02814) / 1.0195^6
 *        = 224.91355 * 4.73404985 + 11,758.94169 / 1.12285423 = 11,537.11902
 *     p7 = 241.05831 * A(5, 1.85%) + 241.05831 / 1.0195^6 + 12,000 / 1.0205^7
 *        = 1,141.18205 + 214.68354 + 10,410.94570           = 11,766.81129
 *     (A(5, 1.85%) = sum of 1/1.0185^k for k = 1..5 = 4.73404985)
 *   Total cost = 34,628.45475
 *   Deferral income (offsets 1-4, coupons only) = 675.47556
 *
 * Tolerance: 1 cent (expectMoney default); the worksheet was carried at 8+
 * decimal places.
 */
describe('TIPS ladder worksheet: hand-priced 3-rung ladder on the 2026-06-30 Treasury curve', () => {
  const build = buildLadder({
    annualRealIncome: 12_000,
    firstPayoutOffset: 5,
    payoutYears: 3,
    curve: EMBEDDED_REAL_YIELD_CURVE,
  })

  it('solves the worksheet faces back-to-front', () => {
    expect(build.rungs).toHaveLength(3)
    const [r5, r6, r7] = build.rungs
    expect(r5!.maturityOffset).toBe(5)
    expect(r6!.maturityOffset).toBe(6)
    expect(r7!.maturityOffset).toBe(7)
    expectMoney(r5!.face, 11_324.52444)
    expectMoney(r6!.face, 11_534.02814)
    expectMoney(r7!.face, 11_758.94169)
  })

  it('uses the curve yield at each maturity as the coupon rate', () => {
    const [r5, r6, r7] = build.rungs
    expect(r5!.couponRatePct).toBeCloseTo(1.85, 10)
    expect(r6!.couponRatePct).toBeCloseTo(1.95, 10)
    expect(r7!.couponRatePct).toBeCloseTo(2.05, 10)
  })

  it('prices each rung to the hand-discounted value (rung 5 exactly at par)', () => {
    const [r5, r6, r7] = build.rungs
    expectMoney(r5!.cost, 11_324.52444)
    expectMoney(r6!.cost, 11_537.11902)
    expectMoney(r7!.cost, 11_766.81129)
    expectMoney(build.totalCost, 34_628.45475)
  })

  it('pays coupon-only income in the deferral years and the exact target after', () => {
    // offsets 1-4: all three rungs outstanding, coupons only.
    for (let offset = 1; offset <= 4; offset++) {
      expectMoney(build.annualRealIncomeByOffset[offset - 1]!, 675.47556)
    }
    // offsets 5-7: maturing principal + remaining coupons = the $12,000 target.
    for (let offset = 5; offset <= 7; offset++) {
      expectMoney(build.annualRealIncomeByOffset[offset - 1]!, 12_000)
    }
  })
})
