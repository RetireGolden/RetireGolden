import { describe, expect, it } from 'vitest'

import { earningsTestWithheldAnnual } from './earningsTest.js'

const limits = { belowFraExemptAnnual: 24_480, fraYearExemptAnnual: 65_160 }

describe('earningsTestWithheldAnnual (42 U.S.C. 403(f)(3), 403(b))', () => {
  it('withholds half the wages above the lower exempt amount before the full-retirement-age year', () => {
    expect(earningsTestWithheldAnnual({ ageAttained: 63, fraYears: 67, wages: 34_480, benefit: 20_000, ...limits })).toBe(5_000)
  })

  it('withholds a third above the higher exempt amount in the full-retirement-age year, and nothing after it', () => {
    expect(earningsTestWithheldAnnual({ ageAttained: 67, fraYears: 67, wages: 71_160, benefit: 20_000, ...limits })).toBe(2_000)
    expect(earningsTestWithheldAnnual({ ageAttained: 68, fraYears: 67, wages: 500_000, benefit: 20_000, ...limits })).toBe(0)
  })

  it('never withholds below 0 or beyond the year\'s benefit', () => {
    expect(earningsTestWithheldAnnual({ ageAttained: 63, fraYears: 67, wages: 10_000, benefit: 20_000, ...limits })).toBe(0)
    expect(earningsTestWithheldAnnual({ ageAttained: 63, fraYears: 67, wages: 200_000, benefit: 20_000, ...limits })).toBe(20_000)
  })
})
