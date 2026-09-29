/**
 * The Insights context reads the save stamp on the start year's calendar
 * (decision D-2027-ROLLOVER). A stamp is UTC and the planner starts a
 * projection on the local calendar, so the context passes the stamp's local
 * year and month (`planSavedOn`) and the stale-plan card compares like with
 * like. The check measured the old reading in Tokyo: a plan saved seconds
 * earlier, at 05:00 on 1 January 2027, read "Plan last saved in 2026".
 *
 * The zone is set at runtime (process.env.TZ), which Node honours.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runScreen } from '@retiregolden/engine/insights/runInsights'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { projectPlan, projectionStartYear } from '../../projection'
import { insightDetectorContext } from './insightContext'

// `process` is read off globalThis: the package tsconfig omits node types, and vitest runs in node.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env
const originalTz = env['TZ']

afterEach(() => {
  vi.useRealTimers()
  if (originalTz === undefined) delete env['TZ']
  else env['TZ'] = originalTz
})

function openedAt(zone: string, openedIso: string, savedIso: string) {
  env['TZ'] = zone
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(openedIso))
  const plan = { ...createSamplePlan(), origin: 'user' as const, updatedAtIso: savedIso }
  const view = projectPlan(plan, projectionStartYear(plan))
  const ctx = insightDetectorContext(plan, view)
  return { startYear: view.startYear, planSavedOn: ctx.planSavedOn, titles: runScreen(ctx).map((card) => card.title) }
}

describe('the save stamp on the start year’s calendar', () => {
  it('Tokyo, 05:00 on 1 January 2027: a plan saved ten seconds earlier is not "last saved in 2026"', () => {
    const opened = openedAt('Asia/Tokyo', '2026-12-31T20:00:00.000Z', '2026-12-31T19:59:50.000Z')
    expect(opened.startYear).toBe(2027)
    expect(opened.planSavedOn).toEqual({ year: 2027, month: '01' })
    expect(opened.titles.some((title) => title.startsWith('Plan last saved in'))).toBe(false)
  })

  it('New York, 22:00 on 31 December 2026: a save whose UTC stamp is 2027 reads as a 2026 save', () => {
    const opened = openedAt('America/New_York', '2027-01-01T03:00:00.000Z', '2027-01-01T02:59:50.000Z')
    expect(opened.startYear).toBe(2026)
    expect(opened.planSavedOn).toEqual({ year: 2026, month: '12' })
    expect(opened.titles.some((title) => title.startsWith('Plan last saved in'))).toBe(false)
  })

  it('still names a plan truly saved in an earlier year', () => {
    const opened = openedAt('America/New_York', '2027-01-15T17:00:00.000Z', '2026-10-15T15:00:00.000Z')
    expect(opened.titles).toContain('Plan last saved in 2026')
  })
})
