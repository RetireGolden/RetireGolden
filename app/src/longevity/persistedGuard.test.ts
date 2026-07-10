import { describe, expect, it } from 'vitest'
import { parseLongevityPersistedLoose } from './persistedGuard'

describe('parseLongevityPersistedLoose', () => {
  it('accepts a valid v1 payload', () => {
    const raw = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      answers: {
        age: 55,
        sex: 'average',
        bmiCategory: 'normal',
        smoking: 'never',
        alcohol: 'moderate',
        activity: 'moderate',
        diabetes: 'no',
        selfRatedHealth: 'good',
        parentalLongevity: 'unknown',
      },
      result: {
        baselineRemainingYears: 28,
        rawMultiplier: 1,
        appliedMultiplier: 1,
        centralRemainingYears: 28,
        bandLowRemainingYears: 24,
        bandHighRemainingYears: 32,
        illustrativePlanningAge: 83,
      },
    }
    const parsed = parseLongevityPersistedLoose(raw)
    expect(parsed?.version).toBe(1)
    expect(parsed?.answers.age).toBe(55)
    expect(parsed?.result.illustrativePlanningAge).toBe(83)
  })

  it('rejects wrong version or bad enums', () => {
    expect(parseLongevityPersistedLoose({ version: 2 })).toBeNull()
    expect(
      parseLongevityPersistedLoose({
        version: 1,
        updatedAt: 'x',
        answers: { age: 55, sex: 'nope' },
        result: {},
      }),
    ).toBeNull()
  })
})
