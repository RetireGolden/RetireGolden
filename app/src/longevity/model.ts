import { combinedMultiplier } from './factors'
import { baselineRemainingYears } from '@retiregolden/engine/longevity/ssaPeriod2022'
import type { LongevityAnswers, LongevityResult } from '@retiregolden/engine/longevity/types'

const MULT_MIN = 0.55
const MULT_MAX = 1.12

/** Narrow illustrative band around central estimate (not a confidence interval). */
const BAND_LOW = 0.9
const BAND_HIGH = 1.08

export function computeLongevity(answers: LongevityAnswers): LongevityResult {
  const baseline = baselineRemainingYears(answers.age, answers.sex)
  const raw = combinedMultiplier(answers)
  const applied = Math.min(MULT_MAX, Math.max(MULT_MIN, raw))
  const central = baseline * applied
  const bandLow = central * BAND_LOW
  const bandHigh = central * BAND_HIGH
  const illustrativePlanningAge =
    answers.age + Math.max(0, Math.round(central))

  return {
    baselineRemainingYears: baseline,
    rawMultiplier: raw,
    appliedMultiplier: applied,
    centralRemainingYears: central,
    bandLowRemainingYears: bandLow,
    bandHighRemainingYears: bandHigh,
    illustrativePlanningAge,
  }
}
