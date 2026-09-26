import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  delayedCreditMonthlyPct,
  delayedRetirementFactor,
  earlyRetirementFactor,
  retirementBenefitPiaFactor,
} from './benefitFactor.js'
import { claimFactor } from './claimFactor.js'
import { effectiveBirthYear } from './nra.js'

describe('earlyRetirementFactor', () => {
  // 20 CFR 404.410(a) changes rate after 36 months: 5/9 of 1 percent for the
  // first 36, then 5/12 of 1 percent. Carrying 5/9 all the way through is the
  // natural misreading and over-reduces anyone claiming more than three years
  // early -- which is every claim at 62 against a full retirement age above 65.
  //
  // 48 months early: 36 x 5/9 = 20 percent, plus 12 x 5/12 = 5 percent, so a
  // 25 percent reduction and a factor of exactly 0.75. At a flat 5/9 the
  // reduction would be 48 x 5/9 = 26.67 percent, a factor of about 0.7333.
  describeRule('cfr-20-404-410-early-retirement-reduction', {
    readings: { rateChangesAfterThirtySix: 0.75, flatFiveNinthsThroughout: 0.7333333333333334 },
    accepted: 'rateChangesAfterThirtySix',
  }, ({ accepted, readings }) => {
    it('slows the reduction after the thirty-sixth month', () => {
      expect(earlyRetirementFactor(48)).toBeCloseTo(accepted, 10)
      expect(earlyRetirementFactor(48)).not.toBeCloseTo(readings.flatFiveNinthsThroughout, 6)
      // The two readings agree at exactly 36 months, which is why the fixture
      // has to look past the boundary to discriminate at all.
      expect(earlyRetirementFactor(36)).toBeCloseTo(0.8, 10)
    })
  })

  it('matches 30% reduction at 60 months early (FRA 67 vs claim 62)', () => {
    const f = earlyRetirementFactor(60)
    expect(f).toBeCloseTo(0.7, 6)
  })

  it('matches 25% reduction at 48 months early (FRA 66 vs claim 62)', () => {
    const f = earlyRetirementFactor(48)
    expect(f).toBeCloseTo(0.75, 6)
  })
})

describe('delayedRetirementFactor', () => {
  // 20 CFR 404.313 ends the credit at the month age 70 is attained. The rate
  // itself is uncontroversial; the cap is what a naive implementation drops,
  // and dropping it rewards delay that earns nothing in reality.
  //
  // Full retirement age 67, so 36 months of credit are available before 70.
  // Asking for 48 months of delay:
  //   capped at 70:  36 x 2/3 = 24 percent, factor 1.24
  //   uncapped:      48 x 2/3 = 32 percent, factor 1.32
  describeRule('cfr-20-404-313-delayed-retirement-credit', {
    readings: { creditsStopAtSeventy: 1.24, creditsContinuePastSeventy: 1.32 },
    accepted: 'creditsStopAtSeventy',
  }, ({ accepted, readings }) => {
    it('stops crediting at age seventy however long the delay', () => {
      expect(delayedRetirementFactor(48, 36)).toBeCloseTo(accepted, 10)
      expect(delayedRetirementFactor(48, 36)).not.toBeCloseTo(readings.creditsContinuePastSeventy, 6)
      // Inside the window the two readings agree, so the cap is the only place
      // this rule can be discriminated at all.
      expect(delayedRetirementFactor(24, 36)).toBeCloseTo(1.16, 10)
    })
  })

  it('adds 24% at 36 months for max DRC to 70 from FRA 67', () => {
    const f = delayedRetirementFactor(36, 36)
    expect(f).toBeCloseTo(1.24, 6)
  })

  // 20 CFR 404.313(b)(2) sets the credit by date of birth. A worker born
  // 1941-06-15 has a full retirement age of 65y8m (788 months) and earns 52
  // credits by claiming at 70 (840 months). By hand:
  //   birth-date rate, 5/8 of 1 percent:  52 x 5/8 = 32.5 percent, factor 1.325
  //   flat 2/3 of 1 percent:               52 x 2/3 = 34.667 percent, factor 1.346667
  describeRule('cfr-20-404-313-delayed-retirement-credit', {
    note: 'the credit rate for a birth before 1943',
    readings: { rateForTheBirthDate: 1.325, flatTwoThirdsForEveryone: 1 + (52 * (2 / 3)) / 100 },
    accepted: 'rateForTheBirthDate',
  }, ({ accepted, readings }) => {
    it('prices a 1941 birth at 5/8 of 1 percent a month', () => {
      const factor = claimFactor(1941, 6, 15, { years: 70, months: 0 })
      expect(factor).toBeCloseTo(accepted, 10)
      expect(factor).not.toBeCloseTo(readings.flatTwoThirdsForEveryone, 6)
    })

    it('follows every row of the table, a January 1 birth counting in the prior year', () => {
      const rows: Array<[number, number]> = [
        [1916, 1 / 12], [1917, 1 / 4], [1924, 1 / 4], [1925, 7 / 24], [1927, 1 / 3], [1929, 3 / 8],
        [1931, 5 / 12], [1933, 11 / 24], [1935, 1 / 2], [1937, 13 / 24], [1939, 7 / 12], [1941, 5 / 8],
        [1942, 5 / 8], [1943, 2 / 3], [1960, 2 / 3],
      ]
      for (const [year, pct] of rows) expect(delayedCreditMonthlyPct(year), String(year)).toBe(pct)
      // Born 1/1/1943 falls in the 1/2/1941-1/1/1943 row.
      expect(delayedCreditMonthlyPct(effectiveBirthYear(1943, 1, 1))).toBe(5 / 8)
      expect(delayedCreditMonthlyPct(effectiveBirthYear(1943, 1, 2))).toBe(2 / 3)
    })
  })
})

describe('retirementBenefitPiaFactor', () => {
  it('claim 62 vs FRA 67 → 70% PIA', () => {
    const f = retirementBenefitPiaFactor(62, { years: 67, extraMonths: 0 })
    expect(f).toBeCloseTo(0.7, 6)
  })

  it('claim 70 vs FRA 67 → 124% PIA', () => {
    const f = retirementBenefitPiaFactor(70, { years: 67, extraMonths: 0 })
    expect(f).toBeCloseTo(1.24, 6)
  })

  it('claim 66 vs FRA 66 → 100% PIA', () => {
    const f = retirementBenefitPiaFactor(66, { years: 66, extraMonths: 0 })
    expect(f).toBeCloseTo(1, 6)
  })

  it('claim 62 vs FRA 66 → 75% PIA', () => {
    const f = retirementBenefitPiaFactor(62, { years: 66, extraMonths: 0 })
    expect(f).toBeCloseTo(0.75, 6)
  })
})
