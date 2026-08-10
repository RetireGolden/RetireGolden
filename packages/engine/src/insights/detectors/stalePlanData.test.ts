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

  it('escalates a two-year gap and stays silent at the current-year boundary', () => {
    expect(stalePlanData.screen(context('2024-12-31T23:59:59.000Z'))?.severity).toBe('attention')
    expect(stalePlanData.screen(context('2026-01-01T00:00:00.000Z'))).toBeNull()
  })

  it('uses the projection start year when a stand-in parameter pack lags it', () => {
    const ctx = context('2025-06-15T12:00:00.000Z')
    ctx.params.year = 2026
    ctx.projection.startYear = 2027

    const card = stalePlanData.screen(ctx)
    expect(card?.severity).toBe('attention')
    expect(card?.evidence).toContainEqual({ label: 'Current planning year', value: '2027', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'Data gap', value: '2 years' })
  })

  it('stays silent for an unparsable update stamp', () => {
    expect(stalePlanData.screen(context('not-a-date'))).toBeNull()
  })
})
