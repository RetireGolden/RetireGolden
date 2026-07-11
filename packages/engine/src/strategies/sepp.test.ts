import { describe, expect, it } from 'vitest'

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
