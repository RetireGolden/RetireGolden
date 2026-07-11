/**
 * Social Security bridge sizing (social-security-bridge-and-tips-ladder,
 * step 3). The canonical fix for the early-claiming problem (Bipartisan
 * Policy Center, July 2025): instead of claiming at 62, pay yourself the
 * forgone age-62 benefit from a dedicated bridge account until the chosen
 * (usually later, often 70) claim age — buying the delayed benefit's
 * longevity insurance without a lifestyle gap.
 *
 * Pure sizing math: the plan artifact itself is a TIPS ladder
 * (plan.incomeFloor) covering the bridge window; the ledger prices its cash
 * flows and taxes like any other ladder.
 */

import type { RealYieldCurve } from '../params/types.js'
import { claimFactor, type ClaimAge } from '../socialSecurity/claimFactor.js'
import { buildLadder } from './ladderMath.js'

/**
 * Minimum share of the quoted ladder cost the funding account must hold
 * before a bridge is proposed. One threshold shared by the `ss-bridge-gap`
 * Insights detector and `bridgeLadderGenerator`, so a household never gets a
 * decision candidate without the matching Insights card (or vice versa) —
 * the "can you fund this?" story stays consistent across surfaces.
 */
export const BRIDGE_FUNDING_MIN_FRACTION = 0.5

export interface BridgeSizingInput {
  /** Worker's PIA, monthly, today's dollars. */
  piaMonthly: number
  dob: { year: number; month: number; day: number }
  /** The chosen (or optimized) claim age the bridge funds the wait for. */
  claimAge: ClaimAge
  /** Calendar year the projection starts ("today"). */
  currentYear: number
  /**
   * Calendar year retirement-phase spending begins (wages stop). The bridge
   * never starts before age 62 — before that there is no forgone benefit to
   * replace — nor before next year (this year's income is already set).
   */
  retirementYear: number
  curve: RealYieldCurve
}

export interface BridgeSizing {
  /** Forgone age-62 benefit: monthly, today's dollars. */
  monthlyAge62Benefit: number
  /** The bridge's level real payout — the annualized age-62 benefit. */
  annualRealAmount: number
  /** First calendar year the bridge pays. */
  startYear: number
  /**
   * Last calendar year the bridge pays: the year before the claim starts, or
   * the claim year itself for a mid-year claim (months > 0) — the ledger pays
   * only the post-claim months of SS that year, so ending the bridge a year
   * earlier would leave the pre-claim months unfunded. Bridging the whole
   * claim year is the conservative planning-grade resolution (the bridge and
   * the new benefit overlap for the post-claim months).
   */
  endYear: number
  years: number
  /**
   * Quoted TIPS-ladder cost (today's $) on the curve, anchored to a purchase
   * THIS year — matching how the SS Optimizer panel, the detector, and the
   * generator all buy the ladder (purchase.year = current year), which is the
   * ledger's anchor for the same rungs.
   */
  ladderCost: number
}

/**
 * Size the bridge for one claimant, or null when there is no gap to fund
 * (claiming at/before 62, or the claim starts before any bridge year could).
 */
export function sizeBridge(input: BridgeSizingInput): BridgeSizing | null {
  const { piaMonthly, dob, claimAge, currentYear, curve } = input
  if (piaMonthly <= 0) return null
  const claimYears = claimAge.years + claimAge.months / 12
  if (claimYears <= 62) return null

  const age62Year = dob.year + 62
  const claimYear = dob.year + Math.floor(claimYears)
  const startYear = Math.max(input.retirementYear, age62Year, currentYear + 1)
  // A mid-year claim (months > 0) pays SS only from the claim month on, so the
  // claim year itself is bridged too (see BridgeSizing.endYear).
  const endYear = claimAge.months > 0 ? claimYear : claimYear - 1
  if (endYear < startYear) return null

  const monthlyAge62Benefit = piaMonthly * claimFactor(dob.year, dob.month, dob.day, { years: 62, months: 0 })
  const annualRealAmount = monthlyAge62Benefit * 12
  const years = endYear - startYear + 1
  const build = buildLadder({
    annualRealIncome: annualRealAmount,
    firstPayoutOffset: startYear - currentYear,
    payoutYears: years,
    curve,
  })
  return {
    monthlyAge62Benefit,
    annualRealAmount,
    startYear,
    endYear,
    years,
    ladderCost: build.totalCost,
  }
}
