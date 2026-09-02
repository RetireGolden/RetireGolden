/**
 * Compare-plans delta formatting (#499): the finding was Depletion age 65 vs
 * 86 and Money lasts 2030 vs 2051 both rendering "—", and 0% vs 0% success
 * rendering "—" instead of 0 pp. Presentation arithmetic on engine years and
 * ages, never dollars.
 */
import { describe, expect, it } from 'vitest'

import { ageDelta, deterministicSuccessPct, formatDelta, moneyLastsDeltaYears } from './compareDeltas'

describe('compareDeltas (#499)', () => {
  it('formats the year gaps the finding named', () => {
    expect(formatDelta(ageDelta(65, 86)!, 'years')).toBe('+21 yrs')
    expect(formatDelta(ageDelta(86, 65)!, 'years')).toBe('−21 yrs')
    expect(formatDelta(1, 'years')).toBe('+1 yr')
    expect(formatDelta(0, 'years')).toBe('same')
    expect(ageDelta(null, 86)).toBeNull()
    expect(ageDelta(65, null)).toBeNull()
  })

  it('money lasts compares last funded years, and reads full-vs-full as no gap', () => {
    expect(moneyLastsDeltaYears({ depletionYear: 2030, endYear: 2060 }, { depletionYear: 2051, endYear: 2060 })).toBe(21)
    // Plan B never depletes: its last funded year is its end year.
    expect(moneyLastsDeltaYears({ depletionYear: 2030, endYear: 2060 }, { depletionYear: null, endYear: 2060 })).toBe(30)
    expect(moneyLastsDeltaYears({ depletionYear: null, endYear: 2060 }, { depletionYear: null, endYear: 2062 })).toBeNull()
  })

  it('deterministic success deltas are percentage points, zero included', () => {
    expect(deterministicSuccessPct(null)).toBe(100)
    expect(deterministicSuccessPct(2030)).toBe(0)
    expect(formatDelta(deterministicSuccessPct(2030) - deterministicSuccessPct(2031), 'pp')).toBe('0 pp')
    expect(formatDelta(deterministicSuccessPct(null) - deterministicSuccessPct(2031), 'pp')).toBe('+100 pp')
    expect(formatDelta(deterministicSuccessPct(2031) - deterministicSuccessPct(null), 'pp')).toBe('−100 pp')
  })

  it('money deltas keep the existing compact shape', () => {
    expect(formatDelta(23_000, 'money')).toBe('+$23k')
    expect(formatDelta(-23_000, 'money')).toBe('−$23k')
    expect(formatDelta(0, 'money')).toBe('$0')
  })
})
