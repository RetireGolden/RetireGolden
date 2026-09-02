/**
 * Compare-plans delta formatting (#499): the finding was Depletion age 65 vs
 * 86 and Money lasts 2030 vs 2051 both rendering "—", and 0% vs 0% success
 * rendering "—" instead of 0 pp. Presentation arithmetic on engine years and
 * ages, never dollars. The engine's `depletionYear` is the first year with a
 * shortfall, so the last funded year is the one before it.
 */
import { describe, expect, it } from 'vitest'

import { ageDelta, deterministicSuccessPct, formatDelta, lastFundedYear, moneyLastsDelta } from './compareDeltas'

describe('compareDeltas (#499)', () => {
  it('formats the year gaps the finding named', () => {
    expect(formatDelta(ageDelta(65, 86)!, 'years')).toBe('+21 yrs')
    expect(formatDelta(ageDelta(86, 65)!, 'years')).toBe('−21 yrs')
    expect(formatDelta(1, 'years')).toBe('+1 yr')
    expect(formatDelta(0, 'years')).toBe('same')
    expect(ageDelta(null, 86)).toBeNull()
    expect(ageDelta(65, null)).toBeNull()
  })

  it('money lasts compares last funded years, bounded when one side never depletes', () => {
    // "Depletes in 2054" was funded through 2053; "Full plan through 2054" through 2054.
    expect(lastFundedYear({ depletionYear: 2054, endYear: 2054 })).toBe(2053)
    expect(lastFundedYear({ depletionYear: null, endYear: 2054 })).toBe(2054)
    // The finding's pair: depletes 2030 vs 2051, an exact gap.
    expect(moneyLastsDelta({ depletionYear: 2030, endYear: 2060 }, { depletionYear: 2051, endYear: 2060 })).toEqual({ value: 21, label: '+21 yrs' })
    // Plan B never depletes: it lasts at least through its horizon, so the gap is a lower bound.
    expect(moneyLastsDelta({ depletionYear: 2054, endYear: 2054 }, { depletionYear: null, endYear: 2054 })).toEqual({ value: 1, label: '≥ +1 yr' })
    expect(moneyLastsDelta({ depletionYear: 2030, endYear: 2060 }, { depletionYear: null, endYear: 2060 })).toEqual({ value: 31, label: '≥ +31 yrs' })
    // Plan A never depletes: an upper bound.
    expect(moneyLastsDelta({ depletionYear: null, endYear: 2060 }, { depletionYear: 2054, endYear: 2060 })).toEqual({ value: -7, label: '≤ −7 yrs' })
    // Two full plans: "same" on one horizon, "both full plan" on different ones, never horizon arithmetic.
    expect(moneyLastsDelta({ depletionYear: null, endYear: 2060 }, { depletionYear: null, endYear: 2060 })).toEqual({ value: 0, label: 'same' })
    expect(moneyLastsDelta({ depletionYear: null, endYear: 2060 }, { depletionYear: null, endYear: 2062 })).toEqual({ value: 0, label: 'both full plan' })
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
