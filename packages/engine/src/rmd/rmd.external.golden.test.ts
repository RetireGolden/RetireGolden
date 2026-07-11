import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import { requiredMinimumDistribution } from './rmd.js'
import { jointLifeTableDivisor } from './jointLifeTable.js'
import { expectMoney } from '../testing/money.js'

/**
 * ORACLE-005 (Phase 5, external-oracle-comparisons.md) — RMD vs IRS Publication 590-B.
 *
 * Unlike the Phase 1 atomic test (rmd.golden.test.ts), which spot-checks six
 * divisors against a hand-transcribed table, this fixture freezes values that
 * the IRS itself published and asserts the *entire* Uniform Lifetime Table, plus
 * the IRS's own worked RMD examples.
 *
 * Oracle: IRS Publication 590-B (2025), "Distributions from IRAs"; 26 CFR
 *   1.401(a)(9)-9(d) Table 3 for Joint Life Table II values below age 20.
 * Oracle URL: https://www.irs.gov/publications/p590b
 * Table 3 URL: https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9
 * Table source (full Uniform Lifetime Table, ages 72–120): IRS final reg
 *   TD 9930 (Fed. Reg. 2020-24723), effective for distribution years 2022+.
 *   Cross-checked against Fidelity / Capital Group / Ed Slott reproductions.
 * Access date: 2026-06-29. Tax/benefit year under test: 2026 pack.
 * Tolerance: $1 (Pub 590-B rounds RMDs to whole dollars).
 *
 * Worked examples transcribed from Pub 590-B (for 2026 distributions):
 *   Example 1 (Uniform Lifetime): owner turns 75 in 2026, prior-year-end (Dec
 *     31 2025) balance $100,000, distribution period 24.6 → RMD $4,065.
 *   Example 2 (Joint Life & Last Survivor, Table II): same owner, spouse turns
 *     64 (sole beneficiary, >10 yrs younger), distribution period 25.3 → $3,953.
 *
 * The full IRS Uniform Lifetime Table, frozen here as the oracle. Phase 1 only
 * pinned ages 72, 73, 75, 80, 85, 90, 100; this asserts every published age.
 */
const IRS_UNIFORM_LIFETIME_TABLE_2022: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
  79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
  93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
  107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}

const pack = packForYear(2026).pack

describe('ORACLE-005: RMD vs IRS Publication 590-B', () => {
  it('matches the full IRS Uniform Lifetime Table (every published age, 72–120)', () => {
    const packTable = pack.rmd.uniformLifetimeTable
    for (const [ageStr, irsDivisor] of Object.entries(IRS_UNIFORM_LIFETIME_TABLE_2022)) {
      const age = Number(ageStr)
      expect(packTable[age], `pack divisor for age ${age}`).toBe(irsDivisor)
    }
    // No extra ages in the pack beyond the published 72–120 range.
    const packAges = Object.keys(packTable).map(Number).sort((a, b) => a - b)
    expect(packAges[0]).toBe(72)
    expect(packAges[packAges.length - 1]).toBe(120)
  })

  it('reproduces IRS Pub 590-B Example 1 (Uniform Lifetime): $100,000 / 24.6 = $4,065', () => {
    // Owner turns 75 in 2026 → born 1951 → RMD start age 73, so age 75 is an RMD year.
    const rmd = requiredMinimumDistribution(pack, 1951, 75, 100_000)
    expectMoney(rmd, 100_000 / 24.6) // 4065.04 unrounded
    expect(Math.round(rmd)).toBe(4_065) // IRS-published whole-dollar RMD
  })

  it('reproduces IRS Pub 590-B Example 2 (Joint Life Table II): $100,000 / 25.3 = $3,953', () => {
    const spouse = { ageAttained: 64, sex: 'average' as const }
    const rmd = requiredMinimumDistribution(pack, 1951, 75, 100_000, {
      ownerSex: 'average',
      spouse,
    })

    expect(jointLifeTableDivisor(75, 64)).toBe(25.3)
    expectMoney(rmd, 100_000 / 25.3)
    expect(Math.round(rmd)).toBe(3_953) // IRS-published whole-dollar RMD
  })

  it('uses 26 CFR Table 3 for Joint Life spouse ages below 20', () => {
    const rmd = requiredMinimumDistribution(pack, 1953, 73, 100_000, {
      ownerSex: 'average',
      spouse: { ageAttained: 19, sex: 'average' },
    })

    expect(jointLifeTableDivisor(73, 19)).toBe(66.1)
    expectMoney(rmd, 100_000 / 66.1)
    expect(rmd).toBeLessThan(100_000 / 26.5)
  })
})
