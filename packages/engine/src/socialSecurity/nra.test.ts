import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths } from './nra.js'

describe('fraForBirthYear', () => {
  // 42 U.S.C. 416(l)(1) turns on the year an individual ATTAINS early
  // retirement age, not on the birth year, and the Social Security
  // Administration treats a person as attaining an age the day before their
  // birthday. So a 1 January 1960 birth attains 62 in 2021 -- inside the
  // "after 2016 and before 2022" branch -- and gets 66 and 10 months, while a
  // 2 January 1960 birth attains 62 in 2022 and gets the flat 67.
  //
  // Reading the schedule straight off the birth year collapses that boundary
  // and hands the 1 January cohort two extra months of reduction.
  describeRule('usc-42-416-l-retirement-age-schedule', {
    readings: { attainmentOfAgeSixtyTwo: 1959, birthYearAsWritten: 1960 },
    accepted: 'attainmentOfAgeSixtyTwo',
  }, ({ accepted, readings }) => {
    it('sends a January 1 birth to the prior cohort', () => {
      expect(effectiveBirthYear(1960, 1, 1)).toBe(accepted)
      expect(effectiveBirthYear(1960, 1, 1)).not.toBe(readings.birthYearAsWritten)
      // The day after is a different cohort with a different retirement age.
      expect(effectiveBirthYear(1960, 1, 2)).toBe(readings.birthYearAsWritten)
      expect(fraForBirthYear(accepted)).toEqual({ years: 66, extraMonths: 10 })
      expect(fraForBirthYear(readings.birthYearAsWritten)).toEqual({ years: 67, extraMonths: 0 })
    })
  })

  it('returns 67 for 1960+ cohorts', () => {
    expect(fraForBirthYear(1960)).toEqual({ years: 67, extraMonths: 0 })
    expect(fraForBirthYear(2000)).toEqual({ years: 67, extraMonths: 0 })
  })

  it('returns 66 for 1943–1954', () => {
    expect(fraForBirthYear(1954)).toEqual({ years: 66, extraMonths: 0 })
    expect(fraForBirthYear(1943)).toEqual({ years: 66, extraMonths: 0 })
  })

  it('returns gradual FRA for 1955–1959', () => {
    expect(fraForBirthYear(1955)).toEqual({ years: 66, extraMonths: 2 })
    expect(fraForBirthYear(1959)).toEqual({ years: 66, extraMonths: 10 })
  })

  it('returns 65+ for 1938–1942', () => {
    expect(fraForBirthYear(1938)).toEqual({ years: 65, extraMonths: 2 })
    expect(fraForBirthYear(1942)).toEqual({ years: 65, extraMonths: 10 })
  })

  it('Jan 1 uses prior year for FRA lookup', () => {
    const y = effectiveBirthYear(1960, 1, 1)
    expect(y).toBe(1959)
    expect(fraForBirthYear(y)).toEqual({ years: 66, extraMonths: 10 })
  })
})

describe('fraTotalMonths', () => {
  it('matches month counts for NRA math', () => {
    expect(fraTotalMonths({ years: 67, extraMonths: 0 })).toBe(804)
    expect(fraTotalMonths({ years: 66, extraMonths: 4 })).toBe(796)
  })
})
