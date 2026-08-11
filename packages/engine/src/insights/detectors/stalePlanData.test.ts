import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { stalePlanData } from './stalePlanData.js'

function context(updatedAtIso = '2025-06-15T12:00:00.000Z'): DetectorContext {
  const plan = singlePersonPlan()
  plan.updatedAtIso = updatedAtIso
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

describe('stale plan data detector', () => {
  it('reports a one-year data gap with info severity and exact evidence', () => {
    const card = stalePlanData.screen(context())

    expect(card).toMatchObject({
      title: 'Plan last saved in 2025',
      rationale: expect.stringMatching(/plan has not been saved since 2025/i),
      severity: 'info',
      evidence: [
        { label: 'Plan last updated', value: '2025-06', year: 2025 },
        { label: 'Current planning year', value: '2026', year: 2026 },
        { label: 'Data gap', value: '1 year' },
      ],
    })
  })

  it('reports a two-year gap as info and stays silent at the current-year boundary', () => {
    expect(stalePlanData.screen(context('2024-12-31T23:59:59.000Z'))?.severity).toBe('info')
    expect(stalePlanData.screen(context('2026-01-01T00:00:00.000Z'))).toBeNull()
  })

  it('uses the projection start year when a stand-in parameter pack lags it', () => {
    const ctx = context('2025-06-15T12:00:00.000Z')
    ctx.params.year = 2026
    ctx.projection.startYear = 2027

    const card = stalePlanData.screen(ctx)
    expect(card?.severity).toBe('info')
    expect(card?.evidence).toContainEqual({ label: 'Current planning year', value: '2027', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'Data gap', value: '2 years' })
  })

  it('stays silent for an unparsable update stamp', () => {
    expect(stalePlanData.screen(context('not-a-date'))).toBeNull()
  })

  it('stays silent for a malformed timestamp that only matches a year-month prefix', () => {
    // Prefix-only parse would accept "2025-02" and emit precise staleness
    // evidence from garbage. Full ISO shape is required (GOVERNANCE silence).
    expect(stalePlanData.screen(context('2025-02-not-a-date'))).toBeNull()
    expect(stalePlanData.screen(context('2025-02-30T12:00:00.000Z'))).toBeNull()
  })

  it('stays silent for an impossible calendar day on a numeric-offset stamp', () => {
    // Calendar consistency must cover ±offset forms, not only Z-suffixed stamps.
    expect(stalePlanData.screen(context('2025-02-30T12:00:00+05:00'))).toBeNull()
    expect(stalePlanData.screen(context('2025-02-30T12:00:00.000+05:00'))).toBeNull()
  })

  it('accepts a valid numeric-offset stamp for the data-gap check', () => {
    expect(stalePlanData.screen(context('2025-06-15T12:00:00+05:00'))).toMatchObject({
      title: 'Plan last saved in 2025',
      severity: 'info',
    })
  })

  it('accepts a valid ISO stamp with more than three fractional-second digits', () => {
    // Microsecond (and longer) fractions are valid ISO-8601; the shared parser
    // must not reject them at the regex gate while still applying the Date
    // round-trip consistency check.
    expect(stalePlanData.screen(context('2025-06-15T12:00:00.123456Z'))).toMatchObject({
      title: 'Plan last saved in 2025',
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Plan last updated', value: '2025-06', year: 2025 },
      ]),
    })
  })

  it('attributes ISO end-of-day 24:00:00 to the resolved next midnight (year boundary)', () => {
    // 2025-12-31T24:00:00Z === 2026-01-01T00:00:00Z — a Jan-1 2026 save, not stale.
    expect(stalePlanData.screen(context('2025-12-31T24:00:00Z'))).toBeNull()
    // Non-boundary: 2024-12-31T24:00:00Z resolves to 2025-01-01 → still a gap vs 2026.
    expect(stalePlanData.screen(context('2024-12-31T24:00:00Z'))).toMatchObject({
      title: 'Plan last saved in 2025',
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Plan last updated', value: '2025-01', year: 2025 },
      ]),
    })
  })
})
