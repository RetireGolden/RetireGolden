/**
 * TIPS ladder math (social-security-bridge-and-tips-ladder, step 1).
 *
 * Pure functions: a target real income + payout window + real-yield curve
 * produce a rung schedule (face amounts, coupons, cost) and per-year cash
 * flows. Everything here is in REAL (today's) dollars — the ledger multiplies
 * by its own inflation path, which is exactly the TIPS inflation adjustment
 * (principal and coupons both index to CPI).
 *
 * Planning-grade model (documented simplifications):
 *  - Each rung is a par TIPS: coupon rate = the interpolated par real yield at
 *    its maturity (floored at the 0.125% statutory minimum TIPS coupon), so a
 *    rung on a flat curve prices exactly at face.
 *  - Rungs are priced by discounting their real cash flows on the same par
 *    curve (par-yields-as-spot approximation, fine at planning grade).
 *  - Coupons pay annually; real-world semiannual timing is ignored.
 *  - No CUSIP-level lot rounding in core mode ($1 granularity); the opt-in
 *    FedInvest mode (step 5) exists for users who want real security prices.
 */

import type { RealYieldCurve } from '../params/types.js'

/** Statutory minimum TIPS coupon rate (percent). */
export const MIN_TIPS_COUPON_PCT = 0.125

/** Interpolated par real yield (percent) at a maturity; endpoints held flat. */
export function realYieldAt(curve: RealYieldCurve, maturityYears: number): number {
  const points = curve.points
  if (points.length === 0) return 0
  const first = points[0]!
  const last = points[points.length - 1]!
  if (maturityYears <= first.maturityYears) return first.realYieldPct
  if (maturityYears >= last.maturityYears) return last.realYieldPct
  for (let i = 1; i < points.length; i++) {
    const lo = points[i - 1]!
    const hi = points[i]!
    if (maturityYears <= hi.maturityYears) {
      const t = (maturityYears - lo.maturityYears) / (hi.maturityYears - lo.maturityYears)
      return lo.realYieldPct + t * (hi.realYieldPct - lo.realYieldPct)
    }
  }
  return last.realYieldPct
}

export interface LadderRung {
  /** Years from the anchor (purchase) year to maturity; >= 1. */
  maturityOffset: number
  /** Real principal (today's $) returned at maturity. */
  face: number
  /** Annual coupon rate (percent of inflation-adjusted principal). */
  couponRatePct: number
  /** Real (today's $) purchase price of the rung. */
  cost: number
}

export interface LadderBuildInput {
  /** Level real income (today's $) the ladder should pay each payout year. */
  annualRealIncome: number
  /** Years from the anchor year to the first payout; >= 1 (1 = next year). */
  firstPayoutOffset: number
  /** Number of consecutive payout years; >= 1. */
  payoutYears: number
  curve: RealYieldCurve
}

export interface LadderBuild {
  rungs: LadderRung[]
  /** Total real (today's $) purchase cost of all rungs. */
  totalCost: number
  /** The input target, echoed for display. */
  targetAnnualRealIncome: number
  /**
   * Real income received in each year offset 1..lastMaturityOffset: coupons
   * from outstanding rungs plus any maturing principal. During a deferral
   * window (offsets before firstPayoutOffset) this is coupon income only.
   */
  annualRealIncomeByOffset: number[]
}

/** Real price of one rung: its coupons + principal discounted on the curve. */
function priceRung(face: number, couponRatePct: number, maturityOffset: number, curve: RealYieldCurve): number {
  let price = 0
  for (let k = 1; k <= maturityOffset; k++) {
    const y = realYieldAt(curve, k) / 100
    const coupon = face * (couponRatePct / 100)
    const principal = k === maturityOffset ? face : 0
    price += (coupon + principal) / Math.pow(1 + y, k)
  }
  return price
}

/**
 * Construct a level-real-income ladder: one rung per payout year, faces solved
 * back-to-front so that each payout year's maturing principal plus the coupons
 * of all still-outstanding rungs equals the target income (the standard
 * DIY/tipsladder.com construction).
 */
export function buildLadder(input: LadderBuildInput): LadderBuild {
  const { annualRealIncome, curve } = input
  const firstPayoutOffset = Math.max(1, Math.round(input.firstPayoutOffset))
  const payoutYears = Math.max(1, Math.round(input.payoutYears))
  const lastOffset = firstPayoutOffset + payoutYears - 1

  const offsets: number[] = []
  for (let m = firstPayoutOffset; m <= lastOffset; m++) offsets.push(m)
  const couponRate = (m: number) => Math.max(MIN_TIPS_COUPON_PCT, realYieldAt(curve, m)) / 100

  // Back-substitution: the last rung funds its year alone; earlier rungs fund
  // the target net of the coupons every later (still-outstanding) rung pays.
  const faces = new Map<number, number>()
  for (let i = offsets.length - 1; i >= 0; i--) {
    const m = offsets[i]!
    let laterCoupons = 0
    for (let j = i + 1; j < offsets.length; j++) {
      const later = offsets[j]!
      laterCoupons += (faces.get(later) ?? 0) * couponRate(later)
    }
    faces.set(m, Math.max(0, (annualRealIncome - laterCoupons) / (1 + couponRate(m))))
  }

  const rungs: LadderRung[] = offsets.map((m) => {
    const face = faces.get(m) ?? 0
    const couponRatePct = Math.max(MIN_TIPS_COUPON_PCT, realYieldAt(curve, m))
    return { maturityOffset: m, face, couponRatePct, cost: priceRung(face, couponRatePct, m, curve) }
  })

  const annualRealIncomeByOffset: number[] = []
  for (let offset = 1; offset <= lastOffset; offset++) {
    const flow = ladderRealFlowsAtOffset(rungs, offset)
    annualRealIncomeByOffset.push(flow.coupons + flow.maturingPrincipal)
  }

  return {
    rungs,
    totalCost: rungs.reduce((sum, r) => sum + r.cost, 0),
    targetAnnualRealIncome: annualRealIncome,
    annualRealIncomeByOffset,
  }
}

export interface LadderRealFlows {
  /** Coupon income (real $) from all rungs outstanding during this year. */
  coupons: number
  /** Principal (real $) of the rung maturing this year (0 in non-payout years). */
  maturingPrincipal: number
  /**
   * Total face (real $) outstanding during this year — the maturing rung
   * included. Inflation accretion (taxable phantom income) applies to this.
   */
  outstandingFace: number
}

/** Real cash flows of a rung set in the year at `offset` (>= 1) from the anchor. */
export function ladderRealFlowsAtOffset(rungs: LadderRung[], offset: number): LadderRealFlows {
  let coupons = 0
  let maturingPrincipal = 0
  let outstandingFace = 0
  for (const rung of rungs) {
    if (rung.maturityOffset < offset) continue
    outstandingFace += rung.face
    coupons += rung.face * (rung.couponRatePct / 100)
    if (rung.maturityOffset === offset) maturingPrincipal += rung.face
  }
  return { coupons, maturingPrincipal, outstandingFace }
}

/** Total face (real $) still outstanding AFTER the year at `offset` completes. */
export function ladderRemainingFace(rungs: LadderRung[], offset: number): number {
  let face = 0
  for (const rung of rungs) if (rung.maturityOffset > offset) face += rung.face
  return face
}

/**
 * Present value (real, today's $) of a stream of real cash flows discounted on
 * the TIPS curve — the "pension accounting" discounting behind the funded
 * ratio: what it would cost today to defease each future real dollar with a
 * Treasury of matching maturity.
 */
export function realPresentValue(flows: Array<{ yearsFromNow: number; realAmount: number }>, curve: RealYieldCurve): number {
  let pv = 0
  for (const flow of flows) {
    if (flow.yearsFromNow < 0 || flow.realAmount === 0) continue
    if (flow.yearsFromNow === 0) {
      pv += flow.realAmount
      continue
    }
    const y = realYieldAt(curve, flow.yearsFromNow) / 100
    pv += flow.realAmount / Math.pow(1 + y, flow.yearsFromNow)
  }
  return pv
}
