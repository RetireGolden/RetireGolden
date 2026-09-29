import { describe, expect, it } from 'vitest'

import {
  EARLIEST_HSA_LIMIT_YEAR,
  HSA_LIMIT_YEARS,
  LATEST_HSA_LIMIT_YEAR,
  hsaLimitYear2026,
  hsaLimitsForYear,
} from './hsaLimitYears.js'
import { packForYear } from './index.js'
import { indexingScaleFor } from './indexingScale.js'
import { year2026 } from './data/year2026.js'

const block2026 = hsaLimitsForYear(2026).params
const block2027 = hsaLimitsForYear(2027).params

describe('hsaLimitsForYear', () => {
  it('returns each published year exactly and flags every other year as a stand-in', () => {
    expect(HSA_LIMIT_YEARS.map((block) => block.year)).toEqual([2026, 2027])
    expect(EARLIEST_HSA_LIMIT_YEAR).toBe(2026)
    expect(LATEST_HSA_LIMIT_YEAR).toBe(2027)
    expect(hsaLimitsForYear(2026)).toEqual({ params: block2026, isStandIn: false })
    expect(hsaLimitsForYear(2027)).toEqual({ params: block2027, isStandIn: false })
    // After the latest published year, the latest stands in and is grown from it.
    expect(hsaLimitsForYear(2028)).toEqual({ params: block2027, isStandIn: true })
    expect(hsaLimitsForYear(2045).params.year).toBe(2027)
    // Before the earliest, the earliest stands in.
    expect(hsaLimitsForYear(2025)).toEqual({ params: block2026, isStandIn: true })
  })

  it('gives a year before the earliest published one the earliest limits, unscaled and flagged as a stand-in', () => {
    // PR #762 review: those are not that year's limits (Rev. Proc. 2024-25 set
    // 2025's at $4,300 and $8,550), so the flag is what tells a caller. No plan
    // reaches such a year: the examples are pinned to 2026 and a user's plan
    // starts in the clock's year.
    for (const year of [2025, 2024, 2000]) {
      const lookup = hsaLimitsForYear(year)
      expect(lookup.isStandIn, `${year}`).toBe(true)
      expect(lookup.params, `${year}`).toBe(hsaLimitYear2026)
      expect(lookup.params.year).toBe(EARLIEST_HSA_LIMIT_YEAR)
      // simulate.ts scales a stand-in by indexingScaleFor from the block's year,
      // which is exactly 1 at or below the latest published year: unscaled.
      expect(indexingScaleFor(lookup.params.year, year, () => 1.5, LATEST_HSA_LIMIT_YEAR)).toBe(1)
    }
    expect(hsaLimitsForYear(2025).params).toMatchObject({ selfOnly: 4_400, family: 8_750 })
  })

  it('carries the amounts each revenue procedure prints', () => {
    // Rev. Proc. 2025-19 section 2.01(1) and Rev. Proc. 2026-24 section 3.01(1).
    expect(block2026).toEqual({ year: 2026, source: 'Rev. Proc. 2025-19', selfOnly: 4_400, family: 8_750 })
    expect(block2027).toEqual({ year: 2027, source: 'Rev. Proc. 2026-24', selfOnly: 4_500, family: 9_000 })
  })

  it('stays sorted, one block per year', () => {
    const years = HSA_LIMIT_YEARS.map((block) => block.year)
    expect(years).toEqual([...new Set(years)].sort((a, b) => a - b))
  })

  it('holds the 2026 income-tax figures to the 2026 block, so the amounts have one home', () => {
    expect(year2026.contributionLimits.hsaSelfOnly).toBe(hsaLimitYear2026.selfOnly)
    expect(year2026.contributionLimits.hsaFamily).toBe(hsaLimitYear2026.family)
    // Any published income-tax year carries its own year's block.
    const { pack, isStandIn } = packForYear(2026)
    expect(isStandIn).toBe(false)
    expect(hsaLimitsForYear(pack.year).isStandIn).toBe(false)
    expect(pack.contributionLimits.hsaSelfOnly).toBe(hsaLimitsForYear(pack.year).params.selfOnly)
    expect(pack.contributionLimits.hsaFamily).toBe(hsaLimitsForYear(pack.year).params.family)
  })

  it('publishes 2027 while the 2027 income-tax figures are still projected', () => {
    expect(packForYear(2027).isStandIn).toBe(true)
    expect(hsaLimitsForYear(2027).isStandIn).toBe(false)
  })
})
