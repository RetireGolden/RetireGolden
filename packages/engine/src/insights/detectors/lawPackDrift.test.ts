import { describe, expect, it } from 'vitest'

import { PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '../../params/index.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { lawPackDrift } from './lawPackDrift.js'

function context(updatedAtIso = '2025-09-05T12:00:00.000Z'): DetectorContext {
  const plan = singlePersonPlan()
  plan.updatedAtIso = updatedAtIso
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

describe('law pack drift detector', () => {
  it('reports the active parameter-pack vintage for an earlier saved plan', () => {
    const card = lawPackDrift.screen(context())

    expect(card).toMatchObject({
      severity: 'info',
      confidence: 'high',
      evidence: [
        { label: 'Plan last-updated year', value: '2025', year: 2025 },
        { label: 'Active parameter year', value: '2026', year: 2026 },
        { label: 'Parameter data vintage', value: PARAMETER_DATA_AS_OF },
        { label: 'Parameter data basis', value: PARAMETER_DATA_BASIS },
      ],
    })
  })

  it('stays silent when the plan was updated in the active parameter year', () => {
    expect(lawPackDrift.screen(context('2026-01-01T00:00:00.000Z'))).toBeNull()
  })

  it('stays silent for a malformed timestamp that only matches a year-month prefix', () => {
    // Prefix-only parse would accept "2025-02" and emit drift evidence from
    // garbage. Full ISO shape is required (GOVERNANCE silence).
    expect(lawPackDrift.screen(context('2025-02-not-a-date'))).toBeNull()
    expect(lawPackDrift.screen(context('2025-02-30T12:00:00.000Z'))).toBeNull()
  })

  it('stays silent for an impossible calendar day on a numeric-offset stamp', () => {
    // Calendar consistency must cover ±offset forms, not only Z-suffixed stamps.
    expect(lawPackDrift.screen(context('2025-02-30T12:00:00+05:00'))).toBeNull()
    expect(lawPackDrift.screen(context('2025-02-30T12:00:00.000+05:00'))).toBeNull()
  })

  it('attributes ISO end-of-day 24:00:00 to the resolved next midnight (year boundary)', () => {
    // 2025-12-31T24:00:00Z → 2026-01-01; same year as active pack → silent.
    expect(lawPackDrift.screen(context('2025-12-31T24:00:00Z'))).toBeNull()
    // 2024-12-31T24:00:00Z → 2025-01-01; drift vs 2026 pack.
    expect(lawPackDrift.screen(context('2024-12-31T24:00:00Z'))).toMatchObject({
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Plan last-updated year', value: '2025', year: 2025 },
      ]),
    })
  })

  it('attributes a numeric-offset stamp crossing a UTC year boundary to the instant UTC year', () => {
    // 2025-12-31T23:30:00-02:00 → 2026-01-01Z; same year as active pack → silent.
    expect(lawPackDrift.screen(context('2025-12-31T23:30:00-02:00'))).toBeNull()
    // Still in UTC 2025 → drift vs 2026 pack.
    expect(lawPackDrift.screen(context('2025-12-31T20:30:00-02:00'))).toMatchObject({
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Plan last-updated year', value: '2025', year: 2025 },
      ]),
    })
  })

  it('accepts a UTC leap-second stamp and attributes year from the normalized instant', () => {
    // 2016-12-31T23:59:60Z → 2017-01-01T00:00:00Z; drift vs 2026 pack.
    expect(lawPackDrift.screen(context('2016-12-31T23:59:60Z'))).toMatchObject({
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Plan last-updated year', value: '2017', year: 2017 },
      ]),
    })
  })
})
