/**
 * Survivor ↔ personal switching (V7 phase 3). A widow(er) can hold two benefits
 * on different records and switch between them: take the survivor benefit early
 * and let their own retirement benefit grow to 70, or take their own early and
 * switch to survivor later. Only one benefit is paid at a time (the larger of
 * those claimed), so the value is in the *sequencing*.
 *
 * Why it matters: survivor benefits earn no delayed credits (they top out at the
 * survivor's FRA), while own benefits grow ~8%/yr to 70. So a common pattern is
 * survivor-first then own-at-70 when the deceased's benefit is the smaller of the
 * two, or own-first then survivor when own is smaller.
 *
 * Survivor precision (cited in DOCS/domain/domain-rules-reference.md §4): the
 * early-claim widow(er) reduction (up to 28.5% at 60, measured against the
 * **survivor** FRA — a separate, earlier schedule than the worker FRA) and the
 * **RIB-LIM / widow's-limit** cap (`max(deceased's actual benefit, 82.5% × PIA)`)
 * are computed by the shared `survivorBenefitMonthly` helper, identical to the
 * projection ledger so the PV view and the ledger can't drift. Illustrative, not
 * a filing tool.
 *
 * @see DOCS/features/social-security.md
 */

import { claimFactor } from '@retiregolden/engine/socialSecurity/claimFactor'
import { survivalCurve } from './expectedPv'
import type { Sex } from '@retiregolden/engine/longevity/types'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '@retiregolden/engine/socialSecurity/nra'
import { survivorBenefitMonthly, survivorReductionFactor, SURVIVOR_EARLIEST_AGE } from '@retiregolden/engine/socialSecurity/survivorBenefit'

// Re-exported for back-compat (callers that previously imported them from here).
export { survivorReductionFactor, SURVIVOR_EARLIEST_AGE }

export interface SwitchingInput {
  dob: { year: number; month: number; day: number }
  sex: Sex
  /** Whole age today (PV reference, t=0). */
  currentAge: number
  /** The claimant's own monthly PIA. */
  ownPiaMonthly: number
  /**
   * The deceased spouse's actual monthly benefit (claim-age-adjusted, including
   * delayed credits) — the survivor base before RIB-LIM.
   */
  survivorMonthly: number
  /**
   * The deceased's monthly PIA. When omitted, defaults to `survivorMonthly`
   * (i.e. the deceased claimed at FRA: actual = PIA), so the RIB-LIM floor
   * (82.5% × PIA) never binds and behavior matches the pre-precision model.
   * Provide it separately when the deceased claimed early (actual < PIA) so the
   * widow's-limit cap is applied.
   */
  deceasedPiaMonthly?: number
  /** Scales SSA remaining-years (longevity questionnaire); default 1. */
  longevityMultiplier?: number
}

export interface SwitchStrategy {
  /** Age the survivor benefit starts (≥60), or null to never take survivor. */
  survivorClaimAge: number | null
  /** Age the own retirement benefit starts (62–70), or null to never take own. */
  ownClaimAge: number | null
}

export interface SwitchResult {
  strategy: SwitchStrategy
  expectedPv: number
  /** Plain-language description, e.g. "Survivor at 60, switch to own at 70". */
  label: string
}

function strategyLabel(s: SwitchStrategy): string {
  if (s.survivorClaimAge !== null && s.ownClaimAge !== null) {
    if (s.survivorClaimAge <= s.ownClaimAge) return `Survivor at ${s.survivorClaimAge}, switch to own at ${s.ownClaimAge}`
    return `Own at ${s.ownClaimAge}, switch to survivor at ${s.survivorClaimAge}`
  }
  if (s.survivorClaimAge !== null) return `Survivor only, at ${s.survivorClaimAge}`
  if (s.ownClaimAge !== null) return `Own only, at ${s.ownClaimAge}`
  return 'Claim nothing'
}

export interface SwitchingOptions {
  discountRate: number
  maxAge?: number
}

/** Expected PV of a single switching strategy: survival-weighted, discounted to today. */
export function expectedPvSwitch(input: SwitchingInput, strategy: SwitchStrategy, opts: SwitchingOptions): number {
  const maxAge = opts.maxAge ?? 119
  const curve = survivalCurve(input.sex, input.longevityMultiplier)
  const survivorFraMonths = fraTotalMonths(
    survivorFraForBirthYear(effectiveBirthYear(input.dob.year, input.dob.month, input.dob.day)),
  )

  const deceasedPia = input.deceasedPiaMonthly ?? input.survivorMonthly
  const survivorAnnual =
    strategy.survivorClaimAge !== null
      ? survivorBenefitMonthly({
          deceasedPiaMonthly: deceasedPia,
          deceasedActualMonthly: input.survivorMonthly,
          survivorClaimAge: { years: strategy.survivorClaimAge, months: 0 },
          survivorFraMonths,
        }) * 12
      : 0
  const ownAnnual =
    strategy.ownClaimAge !== null
      ? input.ownPiaMonthly * 12 * claimFactor(input.dob.year, input.dob.month, input.dob.day, { years: strategy.ownClaimAge, months: 0 })
      : 0

  let pv = 0
  for (let age = input.currentAge; age <= maxAge; age++) {
    const survivorOn = strategy.survivorClaimAge !== null && age >= strategy.survivorClaimAge
    const ownOn = strategy.ownClaimAge !== null && age >= strategy.ownClaimAge
    const benefit = Math.max(survivorOn ? survivorAnnual : 0, ownOn ? ownAnnual : 0)
    if (benefit > 0) {
      const t = age - input.currentAge
      pv += curve.survival(input.currentAge, age) * benefit * Math.pow(1 + opts.discountRate, -t)
    }
  }
  return pv
}

/**
 * Rank candidate switching strategies by expected PV (descending). Sweeps
 * survivor claim ages 60→FRA and own claim ages 62→70, plus the single-benefit
 * options, never claiming before the claimant's current age.
 */
export function rankSwitchStrategies(input: SwitchingInput, opts: SwitchingOptions): SwitchResult[] {
  const effY = effectiveBirthYear(input.dob.year, input.dob.month, input.dob.day)
  const survivorFraYears = survivorFraForBirthYear(effY).years
  const ownFraYears = fraForBirthYear(effY).years
  // Always include "claim now" so users already past the earliest age can still
  // take a benefit immediately (e.g. a 63-year-old widow bridging to own at 70).
  const survivorNow = Math.max(input.currentAge, SURVIVOR_EARLIEST_AGE)
  const survivorAges = [...new Set([survivorNow, Math.max(survivorNow, survivorFraYears)])]
  const ownNow = Math.min(70, Math.max(input.currentAge, 62))
  const ownAges = [...new Set([ownNow, ownFraYears, 70].filter((a) => a >= ownNow && a <= 70))]

  const strategies: SwitchStrategy[] = []
  for (const s of survivorAges) for (const o of ownAges) strategies.push({ survivorClaimAge: s, ownClaimAge: o })
  for (const s of survivorAges) strategies.push({ survivorClaimAge: s, ownClaimAge: null })
  for (const o of ownAges) strategies.push({ survivorClaimAge: null, ownClaimAge: o })

  // De-dupe identical (survivor/own age) pairs that survive the filters.
  const seen = new Set<string>()
  const results: SwitchResult[] = []
  for (const strategy of strategies) {
    const key = `${strategy.survivorClaimAge ?? 'x'}-${strategy.ownClaimAge ?? 'x'}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ strategy, expectedPv: expectedPvSwitch(input, strategy, opts), label: strategyLabel(strategy) })
  }
  return results.sort((a, b) => b.expectedPv - a.expectedPv)
}
