/**
 * Conservative multipliers applied to **population remaining life expectancy**.
 * These are illustrative adjustments for UX/education — not individualized medical
 * underwriting. Magnitudes kept small; combined product is clamped in `model.ts`.
 */
import type {
  Activity,
  Alcohol,
  BmiCategory,
  Diabetes,
  LongevityAnswers,
  ParentalLongevity,
  SelfRatedHealth,
  Smoking,
} from '@retiregolden/engine/longevity/types'

export function bmiMultiplier(c: BmiCategory): number {
  switch (c) {
    case 'underweight':
      return 0.97
    case 'normal':
      return 1
    case 'overweight':
      return 0.96
    case 'obese_i':
      return 0.92
    case 'obese_ii_plus':
      return 0.86
  }
}

export function smokingMultiplier(s: Smoking): number {
  switch (s) {
    case 'never':
      return 1
    case 'former_15y':
      return 0.98
    case 'former_lt15y':
      return 0.95
    case 'current_light':
      return 0.9
    case 'current_moderate':
      return 0.82
    case 'current_heavy':
      return 0.72
  }
}

export function alcoholMultiplier(a: Alcohol): number {
  switch (a) {
    case 'never':
      return 1
    case 'light':
      return 1.01
    case 'moderate':
      return 1
    case 'heavy':
      return 0.92
  }
}

export function activityMultiplier(a: Activity): number {
  switch (a) {
    case 'high':
      return 1.03
    case 'moderate':
      return 1
    case 'low':
      return 0.96
    case 'sedentary':
      return 0.91
  }
}

export function diabetesMultiplier(d: Diabetes): number {
  switch (d) {
    case 'no':
      return 1
    case 'yes_controlled':
      return 0.92
    case 'yes_uncontrolled':
      return 0.85
  }
}

export function selfRatedHealthMultiplier(h: SelfRatedHealth): number {
  switch (h) {
    case 'excellent':
      return 1.03
    case 'good':
      return 1.01
    case 'fair':
      return 0.94
    case 'poor':
      return 0.86
    case 'very_poor':
      return 0.76
  }
}

export function parentalMultiplier(p: ParentalLongevity): number {
  switch (p) {
    case 'both_80':
      return 1.02
    case 'one_80':
      return 1
    case 'neither_80':
      return 0.98
    case 'unknown':
      return 1
  }
}

/** Product of all category multipliers (uncapped). */
export function combinedMultiplier(a: LongevityAnswers): number {
  return (
    bmiMultiplier(a.bmiCategory) *
    smokingMultiplier(a.smoking) *
    alcoholMultiplier(a.alcohol) *
    activityMultiplier(a.activity) *
    diabetesMultiplier(a.diabetes) *
    selfRatedHealthMultiplier(a.selfRatedHealth) *
    parentalMultiplier(a.parentalLongevity)
  )
}
