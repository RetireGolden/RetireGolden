import { knownLifeTableEdition } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import type { LifeTableEdition, LongevityAnswers, LongevityPersisted, LongevityResult } from '@retiregolden/engine/longevity/types'
import { UNRECOGNIZED_LIFE_TABLE_EDITION } from './constants'

const SEX: LongevityAnswers['sex'][] = ['male', 'female', 'average']
const BMI: LongevityAnswers['bmiCategory'][] = [
  'underweight',
  'normal',
  'overweight',
  'obese_i',
  'obese_ii_plus',
]
const SMOKING: LongevityAnswers['smoking'][] = [
  'never',
  'former_15y',
  'former_lt15y',
  'current_light',
  'current_moderate',
  'current_heavy',
]
const ALCOHOL: LongevityAnswers['alcohol'][] = ['never', 'light', 'moderate', 'heavy']
const ACTIVITY: LongevityAnswers['activity'][] = ['high', 'moderate', 'low', 'sedentary']
const DIABETES: LongevityAnswers['diabetes'][] = ['no', 'yes_controlled', 'yes_uncontrolled']
const HEALTH: LongevityAnswers['selfRatedHealth'][] = [
  'excellent',
  'good',
  'fair',
  'poor',
  'very_poor',
]
const PARENTS: LongevityAnswers['parentalLongevity'][] = [
  'both_80',
  'one_80',
  'neither_80',
  'unknown',
]

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function num(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function str(x: unknown): string | null {
  return typeof x === 'string' ? x : null
}

function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T | null {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : null
}

function parseAnswers(raw: unknown): LongevityAnswers | null {
  if (!isRecord(raw)) return null
  const age = num(raw.age)
  if (age == null || age < 18 || age > 110) return null
  const sex = oneOf(raw.sex, SEX)
  const bmiCategory = oneOf(raw.bmiCategory, BMI)
  const smoking = oneOf(raw.smoking, SMOKING)
  const alcohol = oneOf(raw.alcohol, ALCOHOL)
  const activity = oneOf(raw.activity, ACTIVITY)
  const diabetes = oneOf(raw.diabetes, DIABETES)
  const selfRatedHealth = oneOf(raw.selfRatedHealth, HEALTH)
  const parentalLongevity = oneOf(raw.parentalLongevity, PARENTS)
  if (
    !sex ||
    !bmiCategory ||
    !smoking ||
    !alcohol ||
    !activity ||
    !diabetes ||
    !selfRatedHealth ||
    !parentalLongevity
  ) {
    return null
  }
  return {
    age,
    sex,
    bmiCategory,
    smoking,
    alcohol,
    activity,
    diabetes,
    selfRatedHealth,
    parentalLongevity,
  }
}

/**
 * The saved result's table edition (PR #759 review 7): absent on a result
 * saved before the field existed (read as the 2022 table by
 * storedLifeTableEdition), else one of the engine's known editions
 * (engine/longevity/ssaPeriodLifeTable.ts#KNOWN_LIFE_TABLE_EDITIONS). Anything
 * else, an unknown edition or a value that is not an edition, is read as
 * UNRECOGNIZED_LIFE_TABLE_EDITION: the result is kept, and its source says
 * the edition is not recognized rather than naming a page for it.
 */
function parseTableEdition(raw: unknown): LifeTableEdition | undefined {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) return UNRECOGNIZED_LIFE_TABLE_EDITION
  const known = knownLifeTableEdition({
    periodYear: num(raw.periodYear) ?? Number.NaN,
    trusteesReportYear: num(raw.trusteesReportYear) ?? Number.NaN,
  })
  return known ? known.edition : UNRECOGNIZED_LIFE_TABLE_EDITION
}

function parseResult(raw: unknown): LongevityResult | null {
  if (!isRecord(raw)) return null
  const tableEdition = parseTableEdition(raw.tableEdition)
  const baselineRemainingYears = num(raw.baselineRemainingYears)
  const rawMultiplier = num(raw.rawMultiplier)
  const appliedMultiplier = num(raw.appliedMultiplier)
  const centralRemainingYears = num(raw.centralRemainingYears)
  const bandLowRemainingYears = num(raw.bandLowRemainingYears)
  const bandHighRemainingYears = num(raw.bandHighRemainingYears)
  const illustrativePlanningAge = num(raw.illustrativePlanningAge)
  if (
    baselineRemainingYears == null ||
    rawMultiplier == null ||
    appliedMultiplier == null ||
    centralRemainingYears == null ||
    bandLowRemainingYears == null ||
    bandHighRemainingYears == null ||
    illustrativePlanningAge == null
  ) {
    return null
  }
  return {
    ...(tableEdition === undefined ? {} : { tableEdition }),
    baselineRemainingYears,
    rawMultiplier,
    appliedMultiplier,
    centralRemainingYears,
    bandLowRemainingYears,
    bandHighRemainingYears,
    illustrativePlanningAge,
  }
}

/** Returns null if JSON shape does not match v1 persisted longevity (schema drift / corruption). */
export function parseLongevityPersistedLoose(raw: unknown): LongevityPersisted | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  const answers = parseAnswers(raw.answers)
  const result = parseResult(raw.result)
  const updatedAt = str(raw.updatedAt)
  if (!answers || !result || !updatedAt) return null
  return { version: 1, answers, result, updatedAt }
}
