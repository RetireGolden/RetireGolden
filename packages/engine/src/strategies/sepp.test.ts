import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { seppActive, seppAnnualAmount, SEPP_AMORTIZATION_RATE_PCT } from './sepp.js'

describe('seppActive — longer of 5 years or until 59½', () => {
  it('is inactive before the start age', () => {
    expect(seppActive(55, 54)).toBe(false)
  })
  it('is active in the start year and through age 59', () => {
    expect(seppActive(55, 55)).toBe(true)
    expect(seppActive(55, 59)).toBe(true)
  })
  it('stops at 60 once five years have elapsed', () => {
    // Started at 55: by 60, five years are up AND past 59½ -> stop.
    expect(seppActive(55, 60)).toBe(false)
  })
  it('continues past 60 when five years are not yet up', () => {
    // Started at 58: must run to age 63 (5 years) even though past 59½.
    expect(seppActive(58, 60)).toBe(true)
    expect(seppActive(58, 62)).toBe(true)
    expect(seppActive(58, 63)).toBe(false)
  })
})

describe('seppAnnualAmount', () => {
  it('rmd method divides the current balance by life expectancy', () => {
    const le = baselineRemainingYears(55, 'average')
    expect(seppAnnualAmount('rmd', 500_000, 55, 'average')).toBeCloseTo(500_000 / le, 4)
  })

  it('amortization pays more than the rmd method at the same age (interest front-loads it)', () => {
    const rmd = seppAnnualAmount('rmd', 500_000, 55, 'average')
    const amort = seppAnnualAmount('amortization', 500_000, 55, 'average')
    expect(amort).toBeGreaterThan(rmd)
  })

  it('amortization matches the level-payment formula', () => {
    const le = Math.max(1, baselineRemainingYears(55, 'average'))
    const r = SEPP_AMORTIZATION_RATE_PCT / 100
    const expected = (500_000 * r) / (1 - Math.pow(1 + r, -le))
    expect(seppAnnualAmount('amortization', 500_000, 55, 'average')).toBeCloseTo(expected, 2)
  })

  it('amortization at 0% interest equals balance ÷ life expectancy', () => {
    const le = Math.max(1, baselineRemainingYears(55, 'average'))
    expect(seppAnnualAmount('amortization', 300_000, 55, 'average', 0)).toBeCloseTo(300_000 / le, 4)
  })

  it('returns 0 for an empty balance', () => {
    expect(seppAnnualAmount('rmd', 0, 55, 'average')).toBe(0)
  })
})
describeRule('notice-2022-6-3-02-c-interest-rate-ceiling', {
  // The rate the engine applies to the fixed amortization method, in percent.
  // Notice 2022-6 section 3.02(c) caps it at the GREATER of 5% or 120% of the
  // federal mid-term rate, so 5% clears the ceiling in every rate environment.
  // The superseded Rev. Rul. 2002-62 section 2.02(c) had no 5% leg at all: in a
  // month when the mid-term rate was 0.5%, its ceiling was 0.6% and a flat 5%
  // was impermissible. The two readings therefore price the same series
  // differently, and only one of them is still law.
  readings: {
    notice2022_6GreaterOf5PctOr120PctMidTerm: 5,
    revRul2002_62OneHundredTwentyPctMidTermOnly: 0.6,
  },
  accepted: 'notice2022_6GreaterOf5PctOr120PctMidTerm',
}, ({ accepted, readings }) => {
  it('uses the 5% floor of the ceiling, which no rate environment can breach', () => {
    expect(SEPP_AMORTIZATION_RATE_PCT).toBe(accepted)
    expect(SEPP_AMORTIZATION_RATE_PCT)
      .not.toBe(readings.revRul2002_62OneHundredTwentyPctMidTermOnly)
  })

  it('prices the series above what the superseded 120% ceiling would allow', () => {
    const atNoticeCeiling = seppAnnualAmount('amortization', 500_000, 55, 'average')
    const atSupersededCeiling = seppAnnualAmount(
      'amortization', 500_000, 55, 'average',
      readings.revRul2002_62OneHundredTwentyPctMidTermOnly,
    )
    // Not a rounding difference: the readings disagree by thousands a year.
    expect(atNoticeCeiling).toBeGreaterThan(atSupersededCeiling + 1_000)
  })

  it('defaults to the ceiling floor rather than requiring a rate argument', () => {
    expect(seppAnnualAmount('amortization', 500_000, 55, 'average'))
      .toBe(seppAnnualAmount('amortization', 500_000, 55, 'average', accepted))
  })
})
