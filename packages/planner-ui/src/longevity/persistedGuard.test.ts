import { describe, expect, it } from 'vitest'
import { parseLongevityPersistedLoose } from './persistedGuard'
import { lifeTableCitation, UNRECOGNIZED_LIFE_TABLE_EDITION } from './constants'

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
    const saved2022 = { ...base, result: { ...base.result, tableEdition: { periodYear: 2022, trusteesReportYear: 2025 } } }
    expect(parseLongevityPersistedLoose(saved2022)?.result.tableEdition).toEqual({ periodYear: 2022, trusteesReportYear: 2025 })
  })

  it('accepts only the known editions and reads anything else as unrecognized, keeping the result (PR #759 review 7)', () => {
    const base = {
      version: 1,
      updatedAt: '2026-09-27T12:00:00.000Z',
      answers: {
        age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
        diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
      },
      result: {
        baselineRemainingYears: 18.12, rawMultiplier: 1, appliedMultiplier: 1, centralRemainingYears: 18.12,
        bandLowRemainingYears: 16.3, bandHighRemainingYears: 19.6, illustrativePlanningAge: 83,
      },
    }
    // A mixed pair, a later edition, a year that is not whole, a partial or
    // non-object value: none is a known edition, and none is read as the 2022
    // default either.
    for (const tableEdition of [
      { periodYear: 2023, trusteesReportYear: 2025 },
      { periodYear: 2024, trusteesReportYear: 2027 },
      { periodYear: 2023.5, trusteesReportYear: 2026 },
      { periodYear: 2023, trusteesReportYear: 2026.25 },
      { periodYear: '2023' },
      '2023',
      2023,
      null,
      [2023, 2026],
    ]) {
      const parsed = parseLongevityPersistedLoose({ ...base, result: { ...base.result, tableEdition } })
      expect(parsed?.result.tableEdition, JSON.stringify(tableEdition)).toBe(UNRECOGNIZED_LIFE_TABLE_EDITION)
      expect(parsed?.result.illustrativePlanningAge, JSON.stringify(tableEdition)).toBe(83)
      expect(lifeTableCitation(parsed!.result.tableEdition!).label).toBe('SSA period life table (table edition not recognized)')
    }
    // Written back and read again, it is still unrecognized.
    const again = JSON.parse(JSON.stringify({ ...base, result: { ...base.result, tableEdition: UNRECOGNIZED_LIFE_TABLE_EDITION } })) as unknown
    expect(parseLongevityPersistedLoose(again)?.result.tableEdition).toBe(UNRECOGNIZED_LIFE_TABLE_EDITION)
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
