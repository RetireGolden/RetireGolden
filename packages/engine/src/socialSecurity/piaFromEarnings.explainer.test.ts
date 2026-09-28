/**
 * The AIME explainer's helpers at the edges the worksheet cases do not reach
 * (the slice review's surviving mutants PF3, PF6, PF7 and PF10, and the
 * retired explain.test.ts's tier-rate assertion): the dime rounding against
 * float error, the sample from a history whose amounts differ, and the bend
 * tier at and below the first bend point.
 */
import { describe, expect, it } from 'vitest'

import { bendTierForAime, piaInputFromEarnings, zeroYearReplacementGain, zeroYearSampleEarnings } from './piaFromEarnings.js'

const years = (from: number, to: number, amount: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ year: from + i, amount }))

describe('zeroYearReplacementGain', () => {
  it('rounds the difference of two dime-floored PIAs to the dime: 2,343.60 less 2,343.00 is 0.60, not 0.50', () => {
    // Born 1966-07-20, $40,000 a year 1995-2024; $1,000 in 2027. In floating
    // point 2,343.6 − 2,343 is 0.5999999999999091, so flooring would print 0.50.
    const gain = zeroYearReplacementGain(piaInputFromEarnings(1966, 7, 20, years(1995, 2024, 40_000)), 1_000)!
    expect(gain.piaBefore).toBe(2_343)
    expect(gain.piaAfter).toBe(2_343.6)
    expect(gain.piaAfter - gain.piaBefore).toBeLessThan(0.6)
    expect(gain.gainMonthly).toBe(0.6)
    expect(gain.startYearGainMonthly).toBe(0.6)
  })
})

describe('zeroYearSampleEarnings', () => {
  it('takes the latest reported year\'s amount from a history whose amounts differ', () => {
    const input = piaInputFromEarnings(1966, 7, 20, [...years(1995, 2009, 30_000), ...years(2010, 2024, 50_000)])
    expect(zeroYearSampleEarnings(input)).toBe(50_000)
  })
})

describe('bendTierForAime', () => {
  // Eligibility 2028 stands in 2026's bend points, 1,286 and 7,749.
  it('credits the next dollar at 90% below the first bend point, 32% from it and 15% from the second', () => {
    expect(bendTierForAime(0, 2028)).toMatchObject({ label: '90%', marginalRate: 0.9, first: 1_286, second: 7_749 })
    expect(bendTierForAime(1_285, 2028).marginalRate).toBe(0.9)
    expect(bendTierForAime(1_286, 2028)).toMatchObject({ label: '32%', marginalRate: 0.32 })
    expect(bendTierForAime(7_748, 2028).marginalRate).toBe(0.32)
    expect(bendTierForAime(7_749, 2028)).toMatchObject({ label: '15%', marginalRate: 0.15 })
  })
})
