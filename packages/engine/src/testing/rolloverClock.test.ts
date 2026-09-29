/**
 * The rollover run's shifted `Date` (scripts/rollover/shiftClock.setup.mts,
 * decision D-2027-ROLLOVER; review L6, 2026-09-29).
 *
 * The weekly rollover job runs the three suites with this `Date` in place of
 * the real one, so it must behave as `Date` does in every call shape: `new
 * Date()`, `Date.now()` and `Date()` called as a function read the shifted
 * time, and everything else is the real `Date`. The first version was a
 * subclass, which throws when called without `new`; this holds all three.
 */
import { describe, expect, it } from 'vitest'

import { shiftedDate } from '../../../../scripts/rollover/shiftClock.setup.mjs'

const target = Date.parse('2027-01-15T12:00:00.000Z')
const Shifted = shiftedDate(Date, target - Date.now())
const near = (ms: number) => Math.abs(ms - target) < 60_000

describe('the rollover clock', () => {
  it('reads the shifted time through new Date(), Date.now() and Date() called as a function', () => {
    expect(near(new Shifted().getTime())).toBe(true)
    expect(near(Shifted.now())).toBe(true)
    const called = (Shifted as unknown as () => string)()
    expect(typeof called).toBe('string')
    expect(near(Date.parse(called))).toBe(true)
    expect(new Shifted().getUTCFullYear()).toBe(2027)
  })

  it('leaves every other construction and static method as the real Date', () => {
    expect(new Shifted(2026, 11, 31, 22).getFullYear()).toBe(2026)
    expect(new Shifted('2026-06-29T12:00:00.000Z').toISOString()).toBe('2026-06-29T12:00:00.000Z')
    expect(Shifted.parse('2026-06-29T12:00:00.000Z')).toBe(Date.parse('2026-06-29T12:00:00.000Z'))
    expect(Shifted.UTC(2026, 0, 1)).toBe(Date.UTC(2026, 0, 1))
    expect(new Shifted() instanceof Date).toBe(true)
    expect(Shifted.prototype).toBe(Date.prototype)
  })

  it('keeps a subclass working, as a test that extends Date would', () => {
    class Stamp extends Shifted {}
    const stamp = new Stamp()
    expect(stamp instanceof Stamp).toBe(true)
    expect(stamp instanceof Date).toBe(true)
    expect(near(stamp.getTime())).toBe(true)
  })
})
