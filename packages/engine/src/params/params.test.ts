import { describe, expect, it } from 'vitest'

import {
  annuityExpectedReturnMultiple,
  EARLIEST_PACK_YEAR,
  LATEST_PACK_YEAR,
  packForYear,
  partBMonthlyPremium,
  rmdStartAgeForBirthYear,
  standardDeduction,
  uniformLifetimeDivisor,
} from './index.js'

describe('packForYear', () => {
  it('returns the exact pack for a published year', () => {
    const { pack, isStandIn } = packForYear(2026)
    expect(pack.year).toBe(2026)
    expect(isStandIn).toBe(false)
  })

  it('falls back to the latest pack for future years', () => {
    const { pack, isStandIn } = packForYear(LATEST_PACK_YEAR + 10)
    expect(pack.year).toBe(LATEST_PACK_YEAR)
    expect(isStandIn).toBe(true)
  })

  it('falls back to the earliest pack for past years', () => {
    const { pack, isStandIn } = packForYear(EARLIEST_PACK_YEAR - 5)
    expect(pack.year).toBe(EARLIEST_PACK_YEAR)
    expect(isStandIn).toBe(true)
  })
})

describe('2026 pack contents', () => {
  const pack = packForYear(2026).pack

  it('has seven ascending ordinary brackets per status', () => {
    for (const status of ['single', 'marriedFilingJointly'] as const) {
      const brackets = pack.federalTax.brackets[status]
      expect(brackets).toHaveLength(7)
      expect(brackets[0]).toEqual({ lowerBound: 0, ratePct: 10 })
      expect(brackets.at(-1)!.ratePct).toBe(37)
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i]!.lowerBound).toBeGreaterThan(brackets[i - 1]!.lowerBound)
        expect(brackets[i]!.ratePct).toBeGreaterThan(brackets[i - 1]!.ratePct)
      }
    }
  })

  it('MFJ thresholds are double single through the 32% bracket', () => {
    const s = pack.federalTax.brackets.single
    const m = pack.federalTax.brackets.marriedFilingJointly
    for (let i = 1; i <= 4; i++) {
      expect(m[i]!.lowerBound).toBe(s[i]!.lowerBound * 2)
    }
  })

  it('IRMAA tiers ascend in both threshold and applicable percentage', () => {
    const tiers = pack.medicare.irmaaTiers
    expect(tiers).toHaveLength(5)
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.magiOver.single).toBeGreaterThan(tiers[i - 1]!.magiOver.single)
      expect(tiers[i]!.applicablePct).toBeGreaterThan(tiers[i - 1]!.applicablePct)
    }
    expect(tiers.map((t) => t.applicablePct)).toEqual([35, 50, 65, 80, 85])
  })

  it('uniform lifetime table is monotonically decreasing from 72 to 120', () => {
    for (let age = 73; age <= 120; age++) {
      const prev = uniformLifetimeDivisor(pack, age - 1)!
      const cur = uniformLifetimeDivisor(pack, age)!
      expect(cur).toBeLessThanOrEqual(prev)
    }
    expect(uniformLifetimeDivisor(pack, 73)).toBe(26.5)
    expect(uniformLifetimeDivisor(pack, 125)).toBe(2.0)
    expect(uniformLifetimeDivisor(pack, 71)).toBeUndefined()
  })

  it('annuity expected-return multiple matches Pub 939 Table V, interpolating and clamping', () => {
    expect(annuityExpectedReturnMultiple(pack, 65)).toBe(20.0)
    expect(annuityExpectedReturnMultiple(pack, 70)).toBe(16.0)
    // Half-way between 65 (20.0) and 66 (19.2) → 19.6.
    expect(annuityExpectedReturnMultiple(pack, 65.5)).toBeCloseTo(19.6, 5)
    // Clamp outside the table's [50, 95] range.
    expect(annuityExpectedReturnMultiple(pack, 40)).toBe(annuityExpectedReturnMultiple(pack, 50))
    expect(annuityExpectedReturnMultiple(pack, 110)).toBe(annuityExpectedReturnMultiple(pack, 95))
  })
})

describe('rmdStartAgeForBirthYear (SECURE 2.0)', () => {
  it('maps cohorts to 72/73/75', () => {
    expect(rmdStartAgeForBirthYear(1950)).toBe(72)
    expect(rmdStartAgeForBirthYear(1951)).toBe(73)
    expect(rmdStartAgeForBirthYear(1959)).toBe(73)
    expect(rmdStartAgeForBirthYear(1960)).toBe(75)
    expect(rmdStartAgeForBirthYear(1975)).toBe(75)
  })
})

describe('partBMonthlyPremium', () => {
  const pack = packForYear(2026).pack

  it('returns the standard premium below the first tier', () => {
    expect(partBMonthlyPremium(pack, 109_000, 'single')).toBe(202.9)
    expect(partBMonthlyPremium(pack, 50_000, 'marriedFilingJointly')).toBe(202.9)
  })

  it('applies tier multiples above thresholds (statutory share of cost)', () => {
    // 35% tier: 202.90 * 1.4
    expect(partBMonthlyPremium(pack, 109_001, 'single')).toBeCloseTo(284.06, 2)
    // Top tier: 202.90 * 3.4
    expect(partBMonthlyPremium(pack, 500_000, 'single')).toBeCloseTo(689.86, 2)
    expect(partBMonthlyPremium(pack, 750_000, 'marriedFilingJointly')).toBeCloseTo(689.86, 2)
  })

  it('treats tier thresholds as cliffs', () => {
    const atEdge = partBMonthlyPremium(pack, 137_000, 'single')
    const overEdge = partBMonthlyPremium(pack, 137_001, 'single')
    expect(overEdge).toBeGreaterThan(atEdge)
    const belowTopEdge = partBMonthlyPremium(pack, 499_999, 'single')
    const atTopEdge = partBMonthlyPremium(pack, 500_000, 'single')
    expect(atTopEdge).toBeGreaterThan(belowTopEdge)
  })
})

describe('standardDeduction', () => {
  const pack = packForYear(2026).pack

  it('adds the 65+ amounts per qualifying person', () => {
    expect(standardDeduction(pack, 'single', 0)).toBe(16_100)
    expect(standardDeduction(pack, 'single', 1)).toBe(16_100 + 2_050)
    expect(standardDeduction(pack, 'marriedFilingJointly', 2)).toBe(32_200 + 2 * 1_650)
  })
})
