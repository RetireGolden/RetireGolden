import { describe, expect, it } from 'vitest'

import {
  applicableAgeAttainYears,
  deriveRbdComparison,
} from './applicableAge.js'

describe('applicableAgeAttainYears', () => {
  it('keeps the 70½ cohort and the June/July 1949 boundary distinct', () => {
    expect(applicableAgeAttainYears(1948, 6)).toEqual([2018])
    expect(applicableAgeAttainYears(1948, 7)).toEqual([2019])
    expect(applicableAgeAttainYears(1949, 6)).toEqual([2019])
    expect(applicableAgeAttainYears(1949, 7)).toEqual([2021])
    expect(applicableAgeAttainYears(1949)).toEqual([2019, 2021])
  })

  it('uses the statutory age-72, age-73, contested-1959, and age-75 tiers', () => {
    expect(applicableAgeAttainYears(1950)).toEqual([2022])
    expect(applicableAgeAttainYears(1951)).toEqual([2024])
    expect(applicableAgeAttainYears(1958)).toEqual([2031])
    expect(applicableAgeAttainYears(1959)).toEqual([2032, 2034])
    expect(applicableAgeAttainYears(1960)).toEqual([2035])
    expect(applicableAgeAttainYears(1968)).toEqual([2043])
  })
})

describe('deriveRbdComparison', () => {
  it('resolves a certain pre-RBD comparison', () => {
    expect(deriveRbdComparison({
      ownerBirthYear: 1960,
      ownerDeathYear: 2035,
      decedentHadStartedRmds: false,
    })).toEqual({
      kind: 'resolved',
      comparison: 'before-rbd',
      contestedApplicableAge: false,
    })
  })

  it('uses the asserted fact only to break an RBD-year tie', () => {
    expect(deriveRbdComparison({
      ownerBirthYear: 1960,
      ownerDeathYear: 2036,
      decedentHadStartedRmds: false,
    })).toEqual({
      kind: 'resolved',
      comparison: 'before-rbd',
      contestedApplicableAge: false,
    })
    expect(deriveRbdComparison({
      ownerBirthYear: 1960,
      ownerDeathYear: 2036,
      decedentHadStartedRmds: true,
    })).toEqual({
      kind: 'resolved',
      comparison: 'on-or-after-rbd',
      contestedApplicableAge: false,
    })
  })

  it('refuses contradictions between a certain derivation and the asserted fact', () => {
    const result = deriveRbdComparison({
      ownerBirthYear: 1960,
      ownerDeathYear: 2037,
      decedentHadStartedRmds: false,
    })

    expect(result.kind).toBe('needs-review')
    if (result.kind === 'needs-review') {
      expect(result.reason).toBe('assertion-contradicts-derivation')
      expect(result.detail).toContain('decedentHadStartedRmds is false')
    }
  })

  it('refuses unknown owner birth years for asserted post-RBD deaths', () => {
    const result = deriveRbdComparison({
      ownerDeathYear: 2024,
      decedentHadStartedRmds: true,
    })

    expect(result.kind).toBe('needs-review')
    if (result.kind === 'needs-review') {
      expect(result.reason).toBe('owner-birth-year-unknown')
      expect(result.detail).toContain('ownerBirthYear')
    }
  })

  it('refuses precision-sensitive candidate conflicts', () => {
    const precision = deriveRbdComparison({
      ownerBirthYear: 1949,
      ownerDeathYear: 2021,
      decedentHadStartedRmds: false,
    })
    expect(precision.kind).toBe('needs-review')
    if (precision.kind === 'needs-review') {
      expect(precision.reason).toBe('birth-date-precision-insufficient')
      expect(precision.detail).toContain('ownerBirthMonth')
    }

  })

  it('uses the asserted fact only for a born-1959 RBD-year tie', () => {
    const contested = deriveRbdComparison({
      ownerBirthYear: 1959,
      ownerDeathYear: 2033,
      decedentHadStartedRmds: true,
    })
    expect(contested.kind).toBe('needs-review')
    if (contested.kind === 'needs-review') {
      expect(contested.reason).toBe('born-1959-applicable-age-contested')
      expect(contested.detail).toContain('contested applicable age')
    }

    expect(deriveRbdComparison({
      ownerBirthYear: 1959,
      ownerDeathYear: 2033,
      decedentHadStartedRmds: false,
    })).toEqual({
      kind: 'resolved',
      comparison: 'before-rbd',
      contestedApplicableAge: false,
    })

    for (const decedentHadStartedRmds of [false, true]) {
      const result = deriveRbdComparison({
        ownerBirthYear: 1959,
        ownerDeathYear: 2034,
        decedentHadStartedRmds,
      })
      expect(result.kind).toBe('needs-review')
      if (result.kind === 'needs-review') {
        expect(result.reason).toBe('born-1959-applicable-age-contested')
      }
    }

    expect(deriveRbdComparison({
      ownerBirthYear: 1959,
      ownerDeathYear: 2035,
      decedentHadStartedRmds: true,
    })).toEqual({
      kind: 'resolved',
      comparison: 'on-or-after-rbd',
      contestedApplicableAge: false,
    })
  })
})
