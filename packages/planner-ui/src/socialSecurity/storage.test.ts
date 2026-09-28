import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.mocked(loadLongevity).mockReturnValue({ result: { illustrativePlanningAge: 94 } } as ReturnType<typeof loadLongevity>)
    expect(defaultEndAge()).toBe(94)
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
