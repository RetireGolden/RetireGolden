/**
 * The New Year timer behind `useClockYear` (decision D-2027-ROLLOVER; PR #768
 * review issues 3, 4 and 8): the wait is to just past the next local midnight
 * on 1 January, read on the local calendar. The pages that re-render at New
 * Year are held in `ComparePlansPage.newYear.test.tsx` and
 * `PlanWorkspace.asOfSave.test.tsx`.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { msUntilNextLocalNewYear } from './useClockYear'

// `process` is read off globalThis: the package tsconfig omits node types, and vitest runs in node.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env
const originalTz = env['TZ']

afterEach(() => {
  if (originalTz === undefined) delete env['TZ']
  else env['TZ'] = originalTz
})

describe('msUntilNextLocalNewYear', () => {
  it('waits to just past local midnight, one second before it in New York', () => {
    env['TZ'] = 'America/New_York'
    expect(msUntilNextLocalNewYear(new Date('2027-01-01T04:59:59.000Z'))).toBe(1_050)
  })

  it('reads the local calendar, not UTC: in Tokyo the new year is nine hours ahead of UTC', () => {
    env['TZ'] = 'Asia/Tokyo'
    // 23:00 on 31 December 2026 in Tokyo is 14:00 UTC.
    expect(msUntilNextLocalNewYear(new Date('2026-12-31T14:00:00.000Z'))).toBe(3_600_050)
  })

  it('from New Year’s morning waits for the next one', () => {
    env['TZ'] = 'UTC'
    expect(msUntilNextLocalNewYear(new Date('2027-01-01T00:00:01.000Z'))).toBe(Date.UTC(2028, 0, 1) - Date.UTC(2027, 0, 1, 0, 0, 1) + 50)
  })
})
