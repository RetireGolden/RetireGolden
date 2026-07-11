import { describe, expect, it } from 'vitest'
import {
  baselineRemainingYears,
  FEMALE,
  MALE,
} from '@retiregolden/engine/longevity/ssaPeriod2022'
import { computeLongevity } from './model'

describe('ssaPeriod2022', () => {
  it('has 120 rows for ages 0–119 (male and female)', () => {
    expect(MALE.length).toBe(120)
    expect(FEMALE.length).toBe(120)
  })

  it('matches SSA 2022 TR table spot checks', () => {
    expect(baselineRemainingYears(65, 'male')).toBeCloseTo(17.48, 4)
    expect(baselineRemainingYears(65, 'female')).toBeCloseTo(20.12, 4)
    expect(baselineRemainingYears(40, 'male')).toBeCloseTo(37.67, 4)
  })

  it('averages male and female baselines for sex average', () => {
    const m = baselineRemainingYears(50, 'male')
    const f = baselineRemainingYears(50, 'female')
    expect(baselineRemainingYears(50, 'average')).toBeCloseTo((m + f) / 2, 4)
  })
})

describe('computeLongevity', () => {
  const baseAnswers = {
    age: 55,
    sex: 'male' as const,
    bmiCategory: 'normal' as const,
    smoking: 'never' as const,
    alcohol: 'moderate' as const,
    activity: 'moderate' as const,
    diabetes: 'no' as const,
    selfRatedHealth: 'good' as const,
    parentalLongevity: 'unknown' as const,
  }

  it('returns central near baseline when all neutral factors', () => {
    const r = computeLongevity(baseAnswers)
    expect(r.baselineRemainingYears).toBeCloseTo(24.94, 2)
    expect(r.appliedMultiplier).toBeGreaterThan(0.99)
    expect(r.appliedMultiplier).toBeLessThanOrEqual(1.12)
    expect(r.centralRemainingYears).toBeCloseTo(r.baselineRemainingYears * r.appliedMultiplier, 4)
  })

  it('reduces expectancy for heavy smoking and poor health', () => {
    const r = computeLongevity({
      ...baseAnswers,
      smoking: 'current_heavy',
      selfRatedHealth: 'very_poor',
    })
    expect(r.centralRemainingYears).toBeLessThan(r.baselineRemainingYears * 0.85)
  })

  it('keeps extreme lifestyle inputs within the modeled multiplier and planning-age bounds', () => {
    const veryLow = computeLongevity({
      ...baseAnswers,
      age: 119,
      bmiCategory: 'obese_ii_plus',
      smoking: 'current_heavy',
      alcohol: 'heavy',
      activity: 'sedentary',
      diabetes: 'yes_uncontrolled',
      selfRatedHealth: 'very_poor',
      parentalLongevity: 'neither_80',
    })
    expect(veryLow.rawMultiplier).toBeLessThan(0.55)
    expect(veryLow.appliedMultiplier).toBe(0.55)
    expect(veryLow.illustrativePlanningAge).toBeGreaterThanOrEqual(119)
    expect(veryLow.illustrativePlanningAge).toBeLessThanOrEqual(120)

    const favorable = computeLongevity({
      ...baseAnswers,
      age: 55,
      sex: 'female',
      alcohol: 'light',
      activity: 'high',
      selfRatedHealth: 'excellent',
      parentalLongevity: 'both_80',
    })
    expect(favorable.appliedMultiplier).toBeGreaterThan(1)
    expect(favorable.appliedMultiplier).toBeLessThanOrEqual(1.12)
    expect(favorable.illustrativePlanningAge).toBeGreaterThan(55)
    expect(favorable.illustrativePlanningAge).toBeLessThanOrEqual(
      55 + Math.round(favorable.baselineRemainingYears * 1.12),
    )
  })
})
