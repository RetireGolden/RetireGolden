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
import type { Plan } from '../model/plan.js'
import { householdRetirement, type PersonRetirement, type RetirementYearRule } from '../projection/householdRetirement.js'
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

/** Where a household's funded ratio starts counting, and whose retirement that is. */
export interface FundedRatioStart {
  /**
   * The first year counted: the household's later retirement, never before
   * the start year. Null when nobody in the household retires in the plan:
   * wages carry the floor throughout, so there is no retirement to count from
   * and no ratio (the independent review's N3).
   */
  fromYear: number | null
  /**
   * The person whose retirement year is the household's later one; null when
   * nobody retires in the plan. For a couple the ratio is still the
   * household's: its floor and all of its guaranteed income.
   */
  personId: string | null
  /** That person's retirement year under `rule`; null when nobody retires in the plan. */
  retirementYear: number | null
  /** Which rule gave it (projection/householdRetirement.ts); null when nobody retires in the plan. */
  rule: RetirementYearRule | null
  /** That person's last year alive at the planning age; null when nobody retires in the plan. */
  lastYearAlive: number | null
  /** The people who never retire in the plan, left out of the later retirement, in the canonical order. */
  notRetiring: readonly PersonRetirement[]
}

/**
 * The year a household's essential floor starts to be counted (decision
 * D-PEOPLE-ORDER): the household's later retirement, the year the last
 * person's wages stop, since until then wages carry part of the floor. It is
 * the one rule the FI figures use (projection/householdRetirement.ts): a
 * retirement age gives birth year plus that age, or the first year without
 * the person's wages when a wage stream's end age keeps paying past it; a
 * person with no retirement age retires in the first year without their
 * wages, else in the start year;
 * a person who never retires in the plan (wages through their last year
 * alive, a retirement age past the planning age) is left out, and with nobody
 * retiring there is no start; a tie goes to the older person, then the
 * smaller id, so the answer is the same whoever is listed first. Never before
 * the start year.
 */
export function fundedRatioStart(plan: Pick<Plan, 'household' | 'incomes'>, startYear: number): FundedRatioStart {
  const { retirement, notRetiring } = householdRetirement(plan, startYear)
  return {
    fromYear: retirement === null ? null : Math.max(retirement.year, startYear),
    personId: retirement?.personId ?? null,
    retirementYear: retirement?.year ?? null,
    rule: retirement?.rule ?? null,
    lastYearAlive: retirement?.lastYearAlive ?? null,
    notRetiring,
  }
}
