import { describe, expect, it } from 'vitest'
import { parsePlanUpdatedAtIso } from './parsePlanUpdatedAtIso.js'

describe('parsePlanUpdatedAtIso', () => {
  it('accepts a Dec-31 UTC leap-second stamp and attributes the following minute', () => {
    // 2016-12-31T23:59:60Z → 2017-01-01T00:00:00Z.
    expect(parsePlanUpdatedAtIso('2016-12-31T23:59:60Z')).toEqual({
      year: 2017,
      month: '01',
    })
  })

  it('rejects a mid-day :60 stamp (not a leap-second instant)', () => {
    // 12:00:60 is never a leap second — GOVERNANCE silence on malformed input.
    expect(parsePlanUpdatedAtIso('2016-12-31T12:00:60Z')).toBeNull()
  })

  it('accepts a Jun-30 UTC leap-second stamp', () => {
    expect(parsePlanUpdatedAtIso('2015-06-30T23:59:60Z')).toEqual({
      year: 2015,
      month: '07',
    })
  })

  it('accepts an offset stamp that resolves to a UTC leap-second instant', () => {
    // 2016-12-31T18:59:60-05:00 === 2016-12-31T23:59:60Z.
    expect(parsePlanUpdatedAtIso('2016-12-31T18:59:60-05:00')).toEqual({
      year: 2017,
      month: '01',
    })
  })

  it('rejects an offset :60 that is not 23:59:60Z', () => {
    // Wall 23:59:60 at -05:00 is 04:59:60Z next day — not a leap-second slot.
    expect(parsePlanUpdatedAtIso('2016-12-31T23:59:60-05:00')).toBeNull()
  })
})
