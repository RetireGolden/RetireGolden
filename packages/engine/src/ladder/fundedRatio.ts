/**
 * Funded ratio (social-security-bridge-and-tips-ladder, step 4) — Pfau's
 * "pension accounting for households" lens: the present value of essential
 * (required-floor) spending discounted on the TIPS curve, against the present
 * value of the guaranteed real income dedicated to it (Social Security,
 * pensions, annuities, TIPS-ladder flows).
 *
 * Both sides are read from the SAME deterministic ledger years and deflated to
 * today's dollars, so the ratio is consistent with the projection by
 * construction: every tax, COLA, survivor, and haircut effect the ledger
 * models is already inside the cash flows being discounted.
 */

import type { RealYieldCurve } from '../params/types.js'
import type { YearResult } from '../projection/types.js'
import { realPresentValue } from './ladderMath.js'

export interface FundedRatioInput {
  years: YearResult[]
  startYear: number
  /** Deflator from the projection (nominal in `year` → today's $). */
  deflate: (year: number, amount: number) => number
  curve: RealYieldCurve
  /**
   * Count essential spending only from this year on (typically the retirement
   * year): pre-retirement spending is funded by wages, not the floor.
   */
  fromYear?: number
}

export interface FundedRatioResult {
  /** PV (today's $) of required-floor spending over the horizon, on the TIPS curve. */
  essentialSpendingPv: number
  /** PV (today's $) of guaranteed income: SS + pensions + annuities + ladder flows. */
  guaranteedIncomePv: number
  /** guaranteedIncomePv / essentialSpendingPv × 100. */
  fundedRatioPct: number
  /** PV of the floor left for the portfolio to cover: max(0, essential − guaranteed). */
  unfundedPv: number
  /** First and last calendar years counted. */
  fromYear: number
  toYear: number
}

/** Null when there is nothing to measure (no years, or no essential spending in the window). */
export function computeFundedRatio(input: FundedRatioInput): FundedRatioResult | null {
  const { years, startYear, deflate, curve } = input
  if (years.length === 0) return null
  const fromYear = input.fromYear ?? startYear

  const essentialFlows: Array<{ yearsFromNow: number; realAmount: number }> = []
  const guaranteedFlows: Array<{ yearsFromNow: number; realAmount: number }> = []
  let toYear = fromYear
  for (const y of years) {
    if (y.year < fromYear) continue
    toYear = y.year
    const yearsFromNow = y.year - startYear
    essentialFlows.push({ yearsFromNow, realAmount: deflate(y.year, y.expenses.requiredSpending) })
    guaranteedFlows.push({
      yearsFromNow,
      realAmount: deflate(y.year, y.incomes.socialSecurity + y.incomes.pension + y.incomes.annuity + y.incomes.tipsLadder),
    })
  }

  const essentialSpendingPv = realPresentValue(essentialFlows, curve)
  if (essentialSpendingPv <= 0) return null
  const guaranteedIncomePv = realPresentValue(guaranteedFlows, curve)
  return {
    essentialSpendingPv,
    guaranteedIncomePv,
    fundedRatioPct: (guaranteedIncomePv / essentialSpendingPv) * 100,
    unfundedPv: Math.max(0, essentialSpendingPv - guaranteedIncomePv),
    fromYear,
    toYear,
  }
}
