/**
 * Social Security explainer helpers (V7 phase 1). Pure functions that turn the
 * earnings-mode PIA computation into teaching points: which bend-point tier the
 * next dollar lands in, how many zero years drag down the average, the marginal
 * value of replacing a zero year, and a rough credits-of-coverage eligibility
 * estimate. No engine behavior depends on these — they only feed copy.
 *
 * @see DOCS/features/social-security.md §3.1
 * @see DOCS/features/social-security.md
 */

import type { PiaFromEarningsResult, YearEarning } from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import { bendPointsForEligibilityYearOrLatest } from '@retiregolden/engine/socialSecurity/ssaWageData'

/**
 * SSA quarter-of-coverage ("credit") earnings amount — 2025 figure. One credit
 * is earned per this much in covered wages, up to 4 per year. Used only to
 * estimate eligibility for the warning; the user can override the credit count.
 * @see https://www.ssa.gov/oact/cola/QC.html
 */
export const CREDIT_EARNINGS = 1_810
export const CREDITS_FOR_ELIGIBILITY = 40

export interface BendTier {
  /** Replacement rate applied to the next dollar of AIME. */
  label: '90%' | '32%' | '15%'
  marginalRate: number
  first: number
  second: number
}

/** Which bend-point tier the next dollar of AIME falls into for this eligibility year. */
export function bendTierForAime(aime: number, eligibilityYear: number): BendTier {
  const bp = bendPointsForEligibilityYearOrLatest(eligibilityYear)
  if (aime < bp.first) return { label: '90%', marginalRate: 0.9, first: bp.first, second: bp.second }
  if (aime < bp.second) return { label: '32%', marginalRate: 0.32, first: bp.first, second: bp.second }
  return { label: '15%', marginalRate: 0.15, first: bp.first, second: bp.second }
}

export interface ComputationSummary {
  /** Years averaged into AIME (the top 35, or fewer if the history is short). */
  computationYearCount: number
  /** How many of those averaged years are $0 — each is a "replace a zero year" opportunity. */
  zeroYearsInAime: number
  /** AIME divisor in months (12 × computationYearCount). */
  divisorMonths: number
}

export function summarizeComputation(result: PiaFromEarningsResult): ComputationSummary {
  const zeroYearsInAime = result.yearsUsedInAime.filter((v) => v === 0).length
  return {
    computationYearCount: result.computationYearCount,
    zeroYearsInAime,
    divisorMonths: 12 * result.computationYearCount,
  }
}

/**
 * Marginal monthly-PIA gain from replacing one $0 computation year with a year
 * of `indexedAnnual` covered earnings: AIME rises by indexedAnnual / divisor,
 * then the next-dollar bend rate applies. A rough teaching estimate, not the
 * exact recomputation (which would re-sort the top 35).
 */
export function replaceZeroYearGain(result: PiaFromEarningsResult, indexedAnnual: number): number {
  if (indexedAnnual <= 0 || result.computationYearCount <= 0) return 0
  const aimeDelta = indexedAnnual / (12 * result.computationYearCount)
  return aimeDelta * bendTierForAime(result.aime, result.eligibilityYear).marginalRate
}

export interface CreditEstimate {
  credits: number
  eligible: boolean
  /** True when derived from earnings rather than a user-entered count. */
  estimated: boolean
}

/**
 * Estimate covered-work credits (max 40). An explicit `override` wins; otherwise
 * count up to 4 credits per year with covered earnings, using the current credit
 * threshold (conservative for low-wage older years — the user can override).
 */
export function estimateCredits(earnings: YearEarning[], override: number | null | undefined): CreditEstimate {
  if (override != null) {
    return { credits: override, eligible: override >= CREDITS_FOR_ELIGIBILITY, estimated: false }
  }
  let credits = 0
  for (const e of earnings) {
    if (e.amount > 0) credits += Math.min(4, Math.floor(e.amount / CREDIT_EARNINGS))
  }
  credits = Math.min(CREDITS_FOR_ELIGIBILITY, credits)
  return { credits, eligible: credits >= CREDITS_FOR_ELIGIBILITY, estimated: true }
}
