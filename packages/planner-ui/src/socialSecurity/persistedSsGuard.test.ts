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

  const minimalForm = {
    dob: '1962-06-15',
    piaMonthly: 3200,
    claimAges: [62, 67, 70],
    endAge: 90,
    colaPercent: 0,
    discountPercent: 0,
  }
  const payload = (form: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    form,
    ...extra,
  })

  it('rejects a payload that is not a v1 record, has no form record, or has no updatedAt', () => {
    expect(parseSsPersistedLoose(null)).toBeNull()
    expect(parseSsPersistedLoose([payload(minimalForm)])).toBeNull()
    expect(parseSsPersistedLoose({ ...payload(minimalForm), version: 2 })).toBeNull()
    expect(parseSsPersistedLoose({ ...payload(minimalForm), form: 'x' })).toBeNull()
    expect(parseSsPersistedLoose(payload(minimalForm, { updatedAt: 7 }))).toBeNull()
  })

  it('rejects a missing or non-numeric required field and a claim-age list that is not a list of numbers', () => {
    for (const key of ['dob', 'piaMonthly', 'endAge', 'colaPercent', 'discountPercent'] as const) {
      const rest: Record<string, unknown> = { ...minimalForm }
      delete rest[key]
      expect(parseSsPersistedLoose(payload(rest)), key).toBeNull()
    }
    expect(parseSsPersistedLoose(payload({ ...minimalForm, piaMonthly: Number.NaN }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, claimAges: 'x' }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, claimAges: [62, '67'] }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, endAge: 111 }))).toBeNull()
  })

  it('accepts partner claim ages of one or more in range and rejects an empty, non-list or out-of-range list', () => {
    expect(parseSsPersistedLoose(payload({ ...minimalForm, partnerClaimAges: [67] }))?.form.partnerClaimAges).toEqual([67])
    expect(parseSsPersistedLoose(payload({ ...minimalForm, partnerClaimAges: [] }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, partnerClaimAges: 67 }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, partnerClaimAges: [61] }))).toBeNull()
    expect(parseSsPersistedLoose(payload({ ...minimalForm, partnerClaimAges: [null] }))).toBeNull()
    expect(parseSsPersistedLoose(payload(minimalForm))?.form.partnerClaimAges).toBeUndefined()
  })

  it('keeps the enumerated modes it knows and drops the others', () => {
    const known = parseSsPersistedLoose(payload({
      ...minimalForm,
      householdMode: 'couple',
      piaSource: 'earnings',
      partnerPiaSource: 'quick',
      quickPiaKind: 'ssa_estimate',
      partnerQuickPiaKind: 'authoritative',
    }))!.form
    expect([known.householdMode, known.piaSource, known.partnerPiaSource, known.quickPiaKind, known.partnerQuickPiaKind]).toEqual([
      'couple', 'earnings', 'quick', 'ssa_estimate', 'authoritative',
    ])
    const unknown = parseSsPersistedLoose(payload({ ...minimalForm, householdMode: 'trio', piaSource: 3, quickPiaKind: 'guess' }))!.form
    expect([unknown.householdMode, unknown.piaSource, unknown.quickPiaKind]).toEqual([undefined, undefined, undefined])
  })

  it('reads each optional field as absent, null or its value, and drops a value of the wrong type', () => {
    const full = parseSsPersistedLoose(payload({
      ...minimalForm,
      ssaEstimateWorkThroughAge: 64,
      earningsPaste: '2020 50000',
      lastEarningsYear: 2024,
      partnerDob: '1964-01-01',
      partnerPiaMonthly: 1_500,
      partnerSsaEstimateWorkThroughAge: 63,
      partnerEarningsPaste: '2021 40000',
      partnerLastEarningsYear: 2023,
      survivorOverlayEnabled: true,
      survivorPrimaryDeathAge: 80,
      survivorPartnerDeathAge: 85,
    }))!.form
    expect(full).toMatchObject({
      ssaEstimateWorkThroughAge: 64,
      earningsPaste: '2020 50000',
      lastEarningsYear: 2024,
      partnerDob: '1964-01-01',
      partnerPiaMonthly: 1_500,
      partnerSsaEstimateWorkThroughAge: 63,
      partnerEarningsPaste: '2021 40000',
      partnerLastEarningsYear: 2023,
      survivorOverlayEnabled: true,
      survivorPrimaryDeathAge: 80,
      survivorPartnerDeathAge: 85,
    })
    const nulls = parseSsPersistedLoose(payload({
      ...minimalForm,
      ssaEstimateWorkThroughAge: null,
      lastEarningsYear: null,
      partnerSsaEstimateWorkThroughAge: null,
      partnerLastEarningsYear: null,
      survivorPrimaryDeathAge: null,
      survivorPartnerDeathAge: null,
    }))!.form
    expect([
      nulls.ssaEstimateWorkThroughAge, nulls.lastEarningsYear, nulls.partnerSsaEstimateWorkThroughAge,
      nulls.partnerLastEarningsYear, nulls.survivorPrimaryDeathAge, nulls.survivorPartnerDeathAge,
    ]).toEqual([null, null, null, null, null, null])
    const absent = parseSsPersistedLoose(payload(minimalForm))!.form
    expect([absent.ssaEstimateWorkThroughAge, absent.earningsPaste, absent.lastEarningsYear, absent.partnerDob, absent.partnerPiaMonthly, absent.survivorOverlayEnabled]).toEqual([
      undefined, undefined, undefined, undefined, undefined, undefined,
    ])
    const wrong = parseSsPersistedLoose(payload({
      ...minimalForm,
      earningsPaste: 5,
      partnerDob: 5,
      partnerPiaMonthly: 'x',
      partnerEarningsPaste: 5,
      survivorOverlayEnabled: 'yes',
      lastEarningsYear: 'x',
    }))!.form
    expect([wrong.earningsPaste, wrong.partnerDob, wrong.partnerPiaMonthly, wrong.partnerEarningsPaste, wrong.survivorOverlayEnabled, wrong.lastEarningsYear]).toEqual([
      undefined, undefined, undefined, undefined, undefined, null,
    ])
  })
})
