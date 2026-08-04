import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { packForYear } from '../params/index.js'
import { requiredMinimumDistribution } from './rmd.js'

const pack = packForYear(2026).pack

describe('requiredMinimumDistribution', () => {
  // Treas. Reg. 1.401(a)(9)-5 gives the Joint and Last Survivor Table only to a
  // sole-beneficiary spouse "more than 10 years younger". Exactly ten is not
  // more than ten, so that case stays on the Uniform Lifetime Table. An owner
  // aged 75 with a 100,000 balance takes 100,000 / 24.6 there; an eleven-year
  // gap moves to the joint table's 25.3 divisor and a smaller distribution.
  describeRule('treas-reg-1-401-a-9-5-joint-life-spouse-sole-beneficiary', {
    readings: {
      uniformAtExactlyTenYears: 100_000 / 24.6,
      jointTableAtElevenYears: 100_000 / 25.3,
    },
    accepted: 'uniformAtExactlyTenYears',
  }, ({ accepted, readings }) => {
    it('keeps a spouse exactly ten years younger on the Uniform Lifetime Table', () => {
      const spouse = (ageAttained: number) => ({ ageAttained, sex: 'average' as const })

      expect(requiredMinimumDistribution(pack, 1951, 75, 100_000, { spouse: spouse(65) }))
        .toBeCloseTo(accepted, 6)
      expect(requiredMinimumDistribution(pack, 1951, 75, 100_000, { spouse: spouse(64) }))
        .toBeCloseTo(readings.jointTableAtElevenYears, 6)
    })
  })

  it('starts at 73 for the 1951–1959 cohort', () => {
    expect(requiredMinimumDistribution(pack, 1953, 72, 265_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1953, 73, 265_000)).toBeCloseTo(265_000 / 26.5, 6)
  })

  it('starts at 75 for the 1960+ cohort', () => {
    expect(requiredMinimumDistribution(pack, 1960, 73, 246_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1960, 74, 246_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1960, 75, 246_000)).toBeCloseTo(10_000, 6)
  })

  it('uses the floor divisor beyond the table end', () => {
    expect(requiredMinimumDistribution(pack, 1950, 125, 10_000)).toBeCloseTo(5_000, 6)
  })

  it('is zero for an empty account', () => {
    expect(requiredMinimumDistribution(pack, 1953, 80, 0)).toBe(0)
  })

  it('uses the joint-life divisor (smaller RMD) when the spouse is >10 yrs younger', () => {
    const uniform = requiredMinimumDistribution(pack, 1953, 80, 500_000)
    const jointYoungSpouse = requiredMinimumDistribution(pack, 1953, 80, 500_000, {
      ownerSex: 'male',
      spouse: { ageAttained: 62, sex: 'female' }, // 18 yrs younger
    })
    expect(jointYoungSpouse).toBeGreaterThan(0)
    expect(jointYoungSpouse).toBeLessThan(uniform) // larger divisor → smaller RMD
  })

  it('keeps the uniform divisor when the age gap is 10 years or less', () => {
    const uniform = requiredMinimumDistribution(pack, 1953, 80, 500_000)
    const closeSpouse = requiredMinimumDistribution(pack, 1953, 80, 500_000, {
      ownerSex: 'male',
      spouse: { ageAttained: 72, sex: 'female' }, // 8 yrs younger
    })
    expect(closeSpouse).toBeCloseTo(uniform, 6)
  })
})

/**
 * Registered rules covering which row of the Uniform Lifetime Table is read,
 * and which calendar year the first required distribution belongs to.
 */
describe('registered rules: lifetime RMD denominator and first distribution year', () => {
  // Treas. Reg. 1.401(a)(9)-5(c)(1) selects the denominator by the age the
  // owner attains on the birthday falling IN the distribution calendar year,
  // not the age on 1 January and not the age on the date of the payment. The
  // whole-year convention is the statutory test here rather than an
  // approximation, which is why an owner who is still 75 in March takes the
  // age-76 denominator.
  //
  // Owner born 1950, prior 31 December balance 300,000, distribution calendar
  // year in which age 76 is attained. Table 2 to paragraph (c):
  //   age 76 (attained in the year) = 23.7 -> 12,658.23
  //   age 75 (age on 1 January)     = 24.6 -> 12,195.12
  //   age 77 (age a year later)     = 22.9 -> 13,100.44
  describeRule('treas-reg-1-401-a-9-9-c-uniform-lifetime-table', {
    readings: {
      ageAttainedInTheDistributionYear: 300_000 / 23.7,
      ageAtTheStartOfTheYear: 300_000 / 24.6,
      ageInTheFollowingYear: 300_000 / 22.9,
    },
    accepted: 'ageAttainedInTheDistributionYear',
  }, ({ accepted, readings }) => {
    it('divides the prior year-end balance by the denominator for the age attained', () => {
      const amount = requiredMinimumDistribution(pack, 1950, 76, 300_000)

      expect(amount).toBeCloseTo(accepted, 6)
      expect(amount).not.toBeCloseTo(readings.ageAtTheStartOfTheYear, 6)
      expect(amount).not.toBeCloseTo(readings.ageInTheFollowingYear, 6)
    })
  })

  // Treas. Reg. 1.401(a)(9)-5(a)(2)(ii) makes the attainment year itself the
  // first distribution calendar year, even though 1.401(a)(9)-5(a)(3) lets the
  // payment be made as late as the following 1 April. The deadline moves; the
  // year the amount belongs to does not. Reading the April 1 deferral as
  // pushing the amount into the later year is the natural misreading and it
  // drops a whole year of forced ordinary income out of the attainment year.
  //
  // Owner born 1954, applicable age 73, prior year-end balance 500,000:
  //   attainment year, denominator 26.5 at 73 -> 18,867.92
  //   nothing until the required beginning date year -> 0
  //   the following year's denominator, 25.5 at 74 -> 19,607.84
  describeRule('treas-reg-1-401-a-9-5-a-2-first-distribution-calendar-year', {
    readings: {
      attainmentYearIsTheFirstDistributionYear: 500_000 / 26.5,
      nothingUntilTheRequiredBeginningDateYear: 0,
      denominatorOfTheFollowingYear: 500_000 / 25.5,
    },
    accepted: 'attainmentYearIsTheFirstDistributionYear',
  }, ({ accepted, readings }) => {
    it('recognises the first required distribution in the attainment year', () => {
      const amount = requiredMinimumDistribution(pack, 1954, 73, 500_000)

      expect(amount).toBeCloseTo(accepted, 6)
      expect(amount).not.toBeCloseTo(readings.nothingUntilTheRequiredBeginningDateYear, 6)
      expect(amount).not.toBeCloseTo(readings.denominatorOfTheFollowingYear, 6)
    })
  })
})
