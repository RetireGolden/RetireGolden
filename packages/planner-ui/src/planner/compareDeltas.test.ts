/**
 * Compare-plans delta formatting (#499): the finding was Depletion age 65 vs
 * 86 and Money lasts 2030 vs 2051 both rendering "—", and 0% vs 0% success
 * rendering "—" instead of 0 pp. The differences themselves are the engine's
 * (scenarios/planHeadlines.ts, B2-P1 slice 3; comparePlanHeadlines.parity.test.ts
 * holds the retired functions' readings); this module only formats them.
 */
import { describe, expect, it } from 'vitest'

import { formatDelta } from './compareDeltas'

describe('compareDeltas (#499)', () => {
  it('formats the year gaps the finding named', () => {
    expect(formatDelta(21, 'years')).toBe('+21 yrs')
    expect(formatDelta(-21, 'years')).toBe('−21 yrs')
    expect(formatDelta(1, 'years')).toBe('+1 yr')
    expect(formatDelta(0, 'years')).toBe('same')
  })

  it('deterministic success deltas are percentage points, zero included', () => {
    expect(formatDelta(0, 'pp')).toBe('0 pp')
    expect(formatDelta(100, 'pp')).toBe('+100 pp')
    expect(formatDelta(-100, 'pp')).toBe('−100 pp')
  })

  it('money deltas keep the existing compact shape', () => {
    expect(formatDelta(23_000, 'money')).toBe('+$23k')
    expect(formatDelta(-23_000, 'money')).toBe('−$23k')
    expect(formatDelta(0, 'money')).toBe('$0')
  })
})
