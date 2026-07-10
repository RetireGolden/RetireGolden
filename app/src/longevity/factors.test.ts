import { describe, expect, it } from 'vitest'

import {
  activityMultiplier,
  alcoholMultiplier,
  bmiMultiplier,
  combinedMultiplier,
  diabetesMultiplier,
  parentalMultiplier,
  selfRatedHealthMultiplier,
  smokingMultiplier,
} from './factors'
import type { LongevityAnswers } from './types'

describe('longevity factor multipliers', () => {
  it('pins every BMI category multiplier', () => {
    expect(bmiMultiplier('underweight')).toBe(0.97)
    expect(bmiMultiplier('normal')).toBe(1)
    expect(bmiMultiplier('overweight')).toBe(0.96)
    expect(bmiMultiplier('obese_i')).toBe(0.92)
    expect(bmiMultiplier('obese_ii_plus')).toBe(0.86)
  })

  it('pins every smoking category multiplier', () => {
    expect(smokingMultiplier('never')).toBe(1)
    expect(smokingMultiplier('former_15y')).toBe(0.98)
    expect(smokingMultiplier('former_lt15y')).toBe(0.95)
    expect(smokingMultiplier('current_light')).toBe(0.9)
    expect(smokingMultiplier('current_moderate')).toBe(0.82)
    expect(smokingMultiplier('current_heavy')).toBe(0.72)
  })

  it('pins every alcohol category multiplier', () => {
    expect(alcoholMultiplier('never')).toBe(1)
    expect(alcoholMultiplier('light')).toBe(1.01)
    expect(alcoholMultiplier('moderate')).toBe(1)
    expect(alcoholMultiplier('heavy')).toBe(0.92)
  })

  it('pins every activity category multiplier', () => {
    expect(activityMultiplier('high')).toBe(1.03)
    expect(activityMultiplier('moderate')).toBe(1)
    expect(activityMultiplier('low')).toBe(0.96)
    expect(activityMultiplier('sedentary')).toBe(0.91)
  })

  it('pins every diabetes category multiplier', () => {
    expect(diabetesMultiplier('no')).toBe(1)
    expect(diabetesMultiplier('yes_controlled')).toBe(0.92)
    expect(diabetesMultiplier('yes_uncontrolled')).toBe(0.85)
  })

  it('pins every self-rated health category multiplier', () => {
    expect(selfRatedHealthMultiplier('excellent')).toBe(1.03)
    expect(selfRatedHealthMultiplier('good')).toBe(1.01)
    expect(selfRatedHealthMultiplier('fair')).toBe(0.94)
    expect(selfRatedHealthMultiplier('poor')).toBe(0.86)
    expect(selfRatedHealthMultiplier('very_poor')).toBe(0.76)
  })

  it('pins every parental longevity category multiplier', () => {
    expect(parentalMultiplier('both_80')).toBe(1.02)
    expect(parentalMultiplier('one_80')).toBe(1)
    expect(parentalMultiplier('neither_80')).toBe(0.98)
    expect(parentalMultiplier('unknown')).toBe(1)
  })

  it('combines factors as a straight product', () => {
    const answers: LongevityAnswers = {
      age: 55,
      sex: 'male',
      bmiCategory: 'obese_i',
      smoking: 'former_lt15y',
      alcohol: 'heavy',
      activity: 'low',
      diabetes: 'yes_controlled',
      selfRatedHealth: 'fair',
      parentalLongevity: 'neither_80',
    }

    const expected = 0.92 * 0.95 * 0.92 * 0.96 * 0.92 * 0.94 * 0.98
    expect(combinedMultiplier(answers)).toBeCloseTo(expected, 12)
  })
})
