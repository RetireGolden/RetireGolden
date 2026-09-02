/**
 * Compare-plans delta formatting (#499): the finding was Depletion age 65 vs
 * 86 and Money lasts 2030 vs 2051 both rendering "—", and 0% vs 0% success
 * rendering "—" instead of 0 pp. Presentation arithmetic on engine years and
 * ages, never dollars. The engine's `depletionYear` is the first year with a
 * shortfall, so the last funded year is the one before it.
 */
import { describe, expect, it } from 'vitest'

import { ageDelta, deterministicSuccessPct, formatDelta, lastFundedYear, moneyLastsDeltaYears } from './compareDeltas'

describe('compareDeltas (#499)', () => {
  it('formats the year gaps the finding named', () => {
    expect(formatDelta(ageDelta(65, 86)!, 'years')).toBe('+21 yrs')
    expect(formatDelta(ageDelta(86, 65)!, 'years')).toBe('−21 yrs')
    expect(formatDelta(1, 'years')).toBe('+1 yr')
    expect(formatDelta(0, 'years')).toBe('same')
    expect(ageDelta(null, 86)).toBeNull()
    expect(ageDelta(65, null)).toBeNull()
  })

  it('money lasts compares last funded years, so distinct labels never collapse to "same"', () => {
    // "Depletes in 2054" was funded through 2053; "Full plan through 2054" through 2054.
    expect(lastFundedYear({ depletionYear: 2054, endYear: 2054 })).toBe(2053)
    expect(lastFundedYear({ depletionYear: null, endYear: 2054 })).toBe(2054)
    expect(moneyLastsDeltaYears({ depletionYear: 2054, endYear: 2054 }, { depletionYear: null, endYear: 2054 })).toBe(1)
    // The finding's pair: depletes 2030 vs 2051.
    expect(moneyLastsDeltaYears({ depletionYear: 2030, endYear: 2060 }, { depletionYear: 2051, endYear: 2060 })).toBe(21)
    // Plan B never depletes: its last funded year is its end year.
    expect(moneyLastsDeltaYears({ depletionYear: 2030, endYear: 2060 }, { depletionYear: null, endYear: 2060 })).toBe(31)
    // Two full plans with different horizons differ by the horizon gap; equal horizons are "same".
    expect(moneyLastsDeltaYears({ depletionYear: null, endYear: 2060 }, { depletionYear: null, endYear: 2062 })).toBe(2)
    expect(formatDelta(moneyLastsDeltaYears({ depletionYear: null, endYear: 2060 }, { depletionYear: null, endYear: 2060 }), 'years')).toBe('same')
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
