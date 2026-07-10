import { describe, expect, it } from 'vitest'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths } from './nra'

describe('fraForBirthYear', () => {
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
