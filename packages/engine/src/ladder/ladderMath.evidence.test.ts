import { expect, it } from 'vitest'
import type { RealYieldCurve } from '../params/types.js'
import { describeCalculation, type CalculationExample } from '../rules/describeCalculation.js'
import {
  buildLadder,
  ladderRealFlowsAtOffset,
  ladderRemainingFace,
  MIN_TIPS_COUPON_PCT,
  realPresentValue,
  realYieldAt,
  type LadderRung,
} from './ladderMath.js'

/** A dated curve from (maturityYears, realYieldPct) pairs; the fixture carries the pairs. */
function curveOf(points: readonly (readonly [number, number])[]): RealYieldCurve {
  return {
    asOfIso: '2026-09-14',
    source: 'evidence fixture',
    points: points.map(([maturityYears, realYieldPct]) => ({ maturityYears, realYieldPct })),
  }
}

function absToleranceOf(example: CalculationExample): number {
  return example.tolerance === 'exact' ? 0 : (example.tolerance.abs ?? 0)
}

describeCalculation(
  'ladder-real-yield-interpolation',
  {
    example: {
      inputs: { curvePoints: [[5, 2], [10, 3]], interiorMaturity: 7, lowProbe: 2, highProbe: 15 },
      expected: { interiorYieldPct: 2.4, lowYieldPct: 2, highYieldPct: 3 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-real-yield-interpolation.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/ladder-real-yield-interpolation.mutation.md',
  },
  ({ example }) => {
    const curve = curveOf(example.inputs.curvePoints as readonly (readonly [number, number])[])
    const abs = absToleranceOf(example)

    it('interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%)', () => {
      const yieldPct = realYieldAt(curve, example.inputs.interiorMaturity as number)
      expect(Math.abs(yieldPct - (example.expected.interiorYieldPct as number))).toBeLessThanOrEqual(abs)
    })

    it('holds the endpoints flat: 2% at 2 years and 3% at 15 years', () => {
      const low = realYieldAt(curve, example.inputs.lowProbe as number)
      const high = realYieldAt(curve, example.inputs.highProbe as number)
      expect(Math.abs(low - (example.expected.lowYieldPct as number))).toBeLessThanOrEqual(abs)
      expect(Math.abs(high - (example.expected.highYieldPct as number))).toBeLessThanOrEqual(abs)
    })

    it('returns the point yields exactly at the 5- and 10-year knots', () => {
      // Endpoint case: at a knot the interior fraction is 0 or 1, so the
      // formula returns the knot's own yield.
      expect(Math.abs(realYieldAt(curve, 5) - 2)).toBeLessThanOrEqual(abs)
      expect(Math.abs(realYieldAt(curve, 10) - 3)).toBeLessThanOrEqual(abs)
    })
  },
)

describeCalculation(
  'ladder-annual-coupon-par-pricing',
  {
    example: {
      inputs: { face: 1000, couponAndYieldPct: 2, maturityYears: 3 },
      expected: { rungCost: 1000, couponRatePct: 2 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-annual-coupon-par-pricing.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/ladder-annual-coupon-par-pricing.mutation.md',
  },
  ({ example }) => {
    const abs = absToleranceOf(example)
    const face = example.inputs.face as number
    const pct = example.inputs.couponAndYieldPct as number
    const maturityYears = example.inputs.maturityYears as number
    const flat = curveOf([[1, pct], [30, pct]])

    // priceRung and tipsCouponRatePct are module-private. A one-rung ladder
    // maturing at `maturityYears` with target F(1 + c) is solved by the
    // back-substitution as face = A/(1 + c) = F exactly (the last rung funds
    // its year alone), so the rung buildLadder returns carries
    // priceRung(F, c, n, curve) as its cost and tipsCouponRatePct(y(n)) as
    // its coupon. 1020/1.02 is exactly 1000 in binary floating point.
    const build = buildLadder({
      annualRealIncome: face * (1 + pct / 100),
      firstPayoutOffset: maturityYears,
      payoutYears: 1,
      curve: flat,
    })

    it('prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve', () => {
      expect(build.rungs).toHaveLength(1)
      const rung = build.rungs[0]!
      expect(rung.maturityOffset).toBe(maturityYears)
      expect(Math.abs(rung.face - face)).toBeLessThanOrEqual(abs)
      expect(Math.abs(rung.cost - (example.expected.rungCost as number))).toBeLessThanOrEqual(abs)
      expect(Math.abs(build.totalCost - (example.expected.rungCost as number))).toBeLessThanOrEqual(abs)
    })

    it('uses the 2% curve yield as the coupon because the 0.125% floor does not bind', () => {
      expect(Math.abs(build.rungs[0]!.couponRatePct - (example.expected.couponRatePct as number))).toBeLessThanOrEqual(abs)
    })

    it('floors the coupon at 0.125% when the curve yield is below it', () => {
      // Endpoint of the coupon rule: y(n) = 0.05% is below the regulatory
      // minimum, so the synthetic coupon is the floor, not the yield.
      const floored = buildLadder({
        annualRealIncome: 100,
        firstPayoutOffset: maturityYears,
        payoutYears: 1,
        curve: curveOf([[1, 0.05], [30, 0.05]]),
      })
      expect(floored.rungs[0]!.couponRatePct).toBe(0.125)
      expect(floored.rungs[0]!.couponRatePct).toBe(MIN_TIPS_COUPON_PCT)
    })
  },
)

describeCalculation(
  'ladder-real-present-value',
  {
    example: {
      inputs: {
        curvePoints: [[1, 1], [3, 3]],
        flows: [
          { yearsFromNow: 2, realAmount: 100 },
          { yearsFromNow: 4, realAmount: 100 },
        ],
      },
      expected: { realPresentValue: 184.9655829154 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-real-present-value.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/ladder-real-present-value.mutation.md',
  },
  ({ example }) => {
    const abs = absToleranceOf(example)
    const curve = curveOf(example.inputs.curvePoints as readonly (readonly [number, number])[])
    const flows = example.inputs.flows as Array<{ yearsFromNow: number; realAmount: number }>

    it('discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154', () => {
      const pv = realPresentValue(flows, curve)
      expect(Math.abs(pv - (example.expected.realPresentValue as number))).toBeLessThanOrEqual(abs)
    })

    it('adds a t = 0 flow undiscounted', () => {
      // Domain endpoint t = 0: (1 + y)^0 = 1, so the flow is its own PV.
      expect(realPresentValue([{ yearsFromNow: 0, realAmount: 100 }], curve)).toBe(100)
    })
  },
)

describeCalculation(
  'ladder-backward-face-construction',
  {
    example: {
      inputs: { annualRealIncome: 110, firstPayoutOffset: 1, payoutYears: 2, flatYieldPct: 10 },
      expected: {
        faces: [90.9090909091, 100],
        annualRealIncomeByOffset: [110, 110],
        totalCost: 190.9090909091,
        targetAnnualRealIncome: 110,
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-backward-face-construction.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/ladder-backward-face-construction.mutation.md',
  },
  ({ example }) => {
    const abs = absToleranceOf(example)
    const yieldPct = example.inputs.flatYieldPct as number
    const build = buildLadder({
      annualRealIncome: example.inputs.annualRealIncome as number,
      firstPayoutOffset: example.inputs.firstPayoutOffset as number,
      payoutYears: example.inputs.payoutYears as number,
      curve: curveOf([[1, yieldPct], [30, yieldPct]]),
    })
    const expectedFaces = example.expected.faces as number[]

    it('solves faces [1000/11, 100] back to front on a flat 10% curve', () => {
      expect(build.rungs.map((rung) => rung.maturityOffset)).toEqual([1, 2])
      build.rungs.forEach((rung, index) => {
        expect(Math.abs(rung.face - expectedFaces[index]!)).toBeLessThanOrEqual(abs)
      })
    })

    it('pays the level $110 target in both years and echoes the target', () => {
      const expectedIncome = example.expected.annualRealIncomeByOffset as number[]
      expect(build.annualRealIncomeByOffset).toHaveLength(expectedIncome.length)
      build.annualRealIncomeByOffset.forEach((income, index) => {
        expect(Math.abs(income - expectedIncome[index]!)).toBeLessThanOrEqual(abs)
      })
      expect(build.targetAnnualRealIncome).toBe(example.expected.targetAnnualRealIncome as number)
    })

    it('prices each par rung at face, so total cost is 2100/11', () => {
      expect(Math.abs(build.totalCost - (example.expected.totalCost as number))).toBeLessThanOrEqual(abs)
    })

    it('year 1 receipt is 1.1·F1 + 0.1·F2 from the returned faces', () => {
      // The worksheet's receipt identity, recomputed from the faces the
      // engine returned rather than from its income array.
      const [first, second] = build.rungs
      const receipt = first!.face * (1 + yieldPct / 100) + second!.face * (yieldPct / 100)
      expect(Math.abs(receipt - (example.inputs.annualRealIncome as number))).toBeLessThanOrEqual(abs)
    })
  },
)

describeCalculation(
  'ladder-rung-flows-and-remaining-face',
  {
    example: {
      inputs: {
        rungs: [
          { face: 100, couponRatePct: 2, maturityOffset: 1 },
          { face: 200, couponRatePct: 3, maturityOffset: 3 },
        ],
        offset: 1,
      },
      expected: { coupons: 8, maturingPrincipal: 100, outstandingFace: 300, remainingFace: 200 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/ladder-rung-flows-and-remaining-face.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/ladder-rung-flows-and-remaining-face.mutation.md',
  },
  ({ example }) => {
    // `cost` is a LadderRung field neither function reads; 0 keeps the
    // fixture to the worksheet's three columns.
    const rungs: LadderRung[] = (
      example.inputs.rungs as Array<{ face: number; couponRatePct: number; maturityOffset: number }>
    ).map((rung) => ({ ...rung, cost: 0 }))
    const offset = example.inputs.offset as number

    it('at offset 1: coupons $8, maturing $100, outstanding $300 with the maturing rung included', () => {
      const flows = ladderRealFlowsAtOffset(rungs, offset)
      expect(flows.coupons).toBe(example.expected.coupons)
      expect(flows.maturingPrincipal).toBe(example.expected.maturingPrincipal)
      expect(flows.outstandingFace).toBe(example.expected.outstandingFace)
    })

    it('after offset 1 completes, $200 of face remains', () => {
      expect(ladderRemainingFace(rungs, offset)).toBe(example.expected.remainingFace)
    })

    it('the matured rung is gone at offset 2, and nothing remains after offset 3', () => {
      // Boundary from the worksheet's rule: a bond is outstanding through
      // its maturity year and no longer outstanding immediately after.
      const later = ladderRealFlowsAtOffset(rungs, 2)
      expect(later.coupons).toBe(6)
      expect(later.maturingPrincipal).toBe(0)
      expect(later.outstandingFace).toBe(200)
      expect(ladderRemainingFace(rungs, 3)).toBe(0)
    })
  },
)
