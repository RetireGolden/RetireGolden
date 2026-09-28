import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { combinedMultiplier } from '../longevity/factors'
import { loadLongevity } from '../longevity/storage'
import { loadSs, saveSs, SS_STORAGE_KEY, type SsFormSnapshot } from './storage'
import { CLAIM_OPTIONS, defaultEndAge, initialSsForm, parseDob, SS_CHART_LINE_COLORS } from './ssFormUtils'

vi.mock('../longevity/storage', () => ({ loadLongevity: vi.fn(() => null) }))

const form: SsFormSnapshot = {
  householdMode: 'single',
  dob: '1964-06-15',
  piaMonthly: 2_100,
  claimAges: [62, 67, 70],
  endAge: 92,
  colaPercent: 2,
  discountPercent: 1,
}

let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(loadLongevity).mockReset()
})

describe('loadSs and saveSs', () => {
  it('round-trips a saved form, and reads nothing from an empty or corrupt store', () => {
    expect(loadSs()).toBeNull()
    saveSs(form)
    const loaded = loadSs()!
    expect(loaded.version).toBe(1)
    expect(loaded.form).toMatchObject(form)
    store.set(SS_STORAGE_KEY, '{not json')
    expect(loadSs()).toBeNull()
  })
})

describe('ssFormUtils', () => {
  it('parses an ISO date of birth and rejects anything else', () => {
    expect(parseDob(' 1964-06-15 ')).toEqual({ y: 1964, m: 6, d: 15 })
    expect(parseDob('1964-13-01')).toBeNull()
    expect(parseDob('1964-06-32')).toBeNull()
    expect(parseDob('0000-06-15')).toBeNull()
    expect(parseDob('June 15, 1964')).toBeNull()
  })

  it('defaults the end age to the saved longevity estimate, else 90', () => {
    vi.mocked(loadLongevity).mockReturnValue(null)
    expect(defaultEndAge()).toBe(90)
    vi.mocked(loadLongevity).mockReturnValue({
      result: { illustrativePlanningAge: 94, tableEdition: { periodYear: 2023, trusteesReportYear: 2026 } },
    } as ReturnType<typeof loadLongevity>)
    expect(defaultEndAge()).toBe(94)
  })

  it('reuses a result saved on the 2022 table as it was saved', () => {
    // A man of 55 whose result was saved before the edition field existed: its
    // age was computed on the 2022 table (e(55) = 24.94), and it is reused as
    // saved rather than recomputed on the 2023 table (25.73). These form
    // helpers have no caller in the planner's pages today (PR #759 review 2),
    // so no label is shown beside the age.
    const answers = {
      age: 55, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
      diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
    } as const
    const applied = Math.min(1.12, Math.max(0.55, combinedMultiplier(answers)))
    const saved2022 = 55 + Math.round(24.94 * applied)
    expect(55 + Math.round(25.73 * applied)).not.toBe(saved2022)
    vi.mocked(loadLongevity).mockReturnValue({ answers, result: { illustrativePlanningAge: saved2022 } } as ReturnType<typeof loadLongevity>)
    expect(defaultEndAge()).toBe(saved2022)
  })

  it('starts from the saved form when there is one, else from the defaults', () => {
    vi.mocked(loadLongevity).mockReturnValue(null)
    expect(initialSsForm()).toMatchObject({ dob: '1962-06-15', piaMonthly: 3_200, claimAges: [62, 67, 70], endAge: 90 })
    saveSs(form)
    expect(initialSsForm()).toMatchObject(form)
    expect(CLAIM_OPTIONS).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70])
    expect(SS_CHART_LINE_COLORS.length).toBeGreaterThanOrEqual(CLAIM_OPTIONS.length)
  })
})
