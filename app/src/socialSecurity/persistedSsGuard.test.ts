import { describe, expect, it } from 'vitest'
import { parseSsPersistedLoose } from './persistedSsGuard'

describe('parseSsPersistedLoose', () => {
  it('accepts a minimal valid v1 payload', () => {
    const raw = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      form: {
        dob: '1962-06-15',
        piaMonthly: 3200,
        claimAges: [62, 67, 70],
        endAge: 90,
        colaPercent: 0,
        discountPercent: 0,
      },
    }
    const parsed = parseSsPersistedLoose(raw)
    expect(parsed?.form.dob).toBe('1962-06-15')
    expect(parsed?.form.claimAges).toEqual([62, 67, 70])
  })

  it('rejects invalid claim ages or end age out of range', () => {
    expect(
      parseSsPersistedLoose({
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        form: {
          dob: '1962-06-15',
          piaMonthly: 1,
          claimAges: [62],
          endAge: 90,
          colaPercent: 0,
          discountPercent: 0,
        },
      }),
    ).toBeNull()
    expect(
      parseSsPersistedLoose({
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        form: {
          dob: '1962-06-15',
          piaMonthly: 1,
          claimAges: [62, 71],
          endAge: 90,
          colaPercent: 0,
          discountPercent: 0,
        },
      }),
    ).toBeNull()
    expect(
      parseSsPersistedLoose({
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        form: {
          dob: '1962-06-15',
          piaMonthly: 1,
          claimAges: [62, 63],
          endAge: 50,
          colaPercent: 0,
          discountPercent: 0,
        },
      }),
    ).toBeNull()
  })
})
