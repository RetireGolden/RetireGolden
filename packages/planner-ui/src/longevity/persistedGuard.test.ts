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

  it("keeps a saved result's table edition, reads none as absent, and rejects a malformed one", () => {
    const base = {
      version: 1,
      updatedAt: '2026-09-27T00:00:00.000Z',
      answers: {
        age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
        diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
      },
      result: {
        baselineRemainingYears: 18.12, rawMultiplier: 1, appliedMultiplier: 1, centralRemainingYears: 18.12,
        bandLowRemainingYears: 16.3, bandHighRemainingYears: 19.6, illustrativePlanningAge: 83,
      },
    }
    // Saved before the field existed: no edition, which the results read as the 2022 table.
    expect(parseLongevityPersistedLoose(base)?.result.tableEdition).toBeUndefined()
    const withEdition = { ...base, result: { ...base.result, tableEdition: { periodYear: 2023, trusteesReportYear: 2026 } } }
    expect(parseLongevityPersistedLoose(withEdition)?.result.tableEdition).toEqual({ periodYear: 2023, trusteesReportYear: 2026 })
    const malformed = { ...base, result: { ...base.result, tableEdition: { periodYear: '2023' } } }
    expect(parseLongevityPersistedLoose(malformed)).toBeNull()
    // Not an object, or a year that is not whole: corrupt, not read as the 2022 default.
    for (const tableEdition of ['2023', 2023, null, [2023, 2026], { periodYear: 2023.5, trusteesReportYear: 2026 }, { periodYear: 2023, trusteesReportYear: 2026.25 }]) {
      expect(parseLongevityPersistedLoose({ ...base, result: { ...base.result, tableEdition } }), JSON.stringify(tableEdition)).toBeNull()
    }
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
