export type Sex = 'male' | 'female' | 'average'

export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_i'
  | 'obese_ii_plus'

export type Smoking =
  | 'never'
  | 'former_15y'
  | 'former_lt15y'
  | 'current_light'
  | 'current_moderate'
  | 'current_heavy'

export type Alcohol = 'never' | 'light' | 'moderate' | 'heavy'

export type Activity = 'high' | 'moderate' | 'low' | 'sedentary'

export type Diabetes = 'no' | 'yes_controlled' | 'yes_uncontrolled'

export type SelfRatedHealth =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'very_poor'

export type ParentalLongevity = 'both_80' | 'one_80' | 'neither_80' | 'unknown'

export interface LongevityAnswers {
  age: number
  sex: Sex
  bmiCategory: BmiCategory
  smoking: Smoking
  alcohol: Alcohol
  activity: Activity
  diabetes: Diabetes
  selfRatedHealth: SelfRatedHealth
  parentalLongevity: ParentalLongevity
}

/**
 * An edition of SSA's period life table (Table 4C6): the year of the death
 * rates and the Trustees Report that used them. A stored figure computed on the
 * table (a percentile pick, a saved questionnaire result) records it, so the
 * figure is labelled with the edition it was made on after the engine moves to
 * a later one.
 */
export interface LifeTableEdition {
  readonly periodYear: number
  readonly trusteesReportYear: number
}

export interface LongevityResult {
  /**
   * The table edition the result was computed on. A result saved before the
   * field existed has none, and was made on the 2022 period table
   * (ssaPeriodLifeTable.ts#storedLifeTableEdition).
   */
  tableEdition?: LifeTableEdition
  /** SSA's printed e(x) at the age, from `tableEdition` */
  baselineRemainingYears: number
  /** Product of lifestyle/health factors (before clamp) */
  rawMultiplier: number
  /** After conservative clamp */
  appliedMultiplier: number
  /** Baseline × appliedMultiplier */
  centralRemainingYears: number
  /** Illustrative band — not statistical confidence */
  bandLowRemainingYears: number
  bandHighRemainingYears: number
  /** age + central (rounded) */
  illustrativePlanningAge: number
}

export interface LongevityPersisted {
  version: 1
  answers: LongevityAnswers
  result: LongevityResult
  updatedAt: string
}
