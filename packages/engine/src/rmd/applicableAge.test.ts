import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  applicableAgeAttainYears,
  deriveRbdComparison,
  type RbdDerivation,
} from './applicableAge.js'

/**
 * Compact death-vs-RBD outcome for the registry fixture. Omits free-text
 * `detail` so wording churn cannot collapse distinct readings. Both counterreadings
 * remain reachable through the unchanged assertion/refusal path.
 */
type RbdOutcome =
  | { kind: 'resolved'; comparison: 'before-rbd' | 'on-or-after-rbd'; contestedApplicableAge: false }
  | { kind: 'needs-review'; reason: 'birth-date-precision-insufficient' }

type SeventyHalfCohortVector = {
  attainYears: {
    born1948June: number[]
    born1948July: number[]
    born1949June: number[]
    born1949July: number[]
    born1949YearOnly: number[]
  }
  deathVersusRbd: {
    june30Death2020AssertedNotStarted: RbdOutcome
    july1Death2021AssertedNotStarted: RbdOutcome
    yearOnlyDeath2021AssertedNotStarted: RbdOutcome
  }
}

function resolvedRbd(comparison: 'before-rbd' | 'on-or-after-rbd'): RbdOutcome {
  return { kind: 'resolved', comparison, contestedApplicableAge: false }
}

const precisionInsufficient: RbdOutcome = {
  kind: 'needs-review',
  reason: 'birth-date-precision-insufficient',
}

function summarizeRbd(result: RbdDerivation): RbdOutcome {
  if (result.kind === 'resolved') {
    return {
      kind: 'resolved',
      comparison: result.comparison,
      contestedApplicableAge: result.contestedApplicableAge,
    }
  }
  if (result.reason !== 'birth-date-precision-insufficient') {
    throw new Error(`unexpected needs-review reason in 70½ cohort fixture: ${result.reason}`)
  }
  return precisionInsufficient
}

function observeSeventyHalfCohortVector(): SeventyHalfCohortVector {
  return {
    attainYears: {
      born1948June: applicableAgeAttainYears(1948, 6),
      born1948July: applicableAgeAttainYears(1948, 7),
      born1949June: applicableAgeAttainYears(1949, 6),
      born1949July: applicableAgeAttainYears(1949, 7),
      born1949YearOnly: applicableAgeAttainYears(1949),
    },
    deathVersusRbd: {
      june30Death2020AssertedNotStarted: summarizeRbd(deriveRbdComparison({
        ownerBirthYear: 1949,
        ownerBirthMonth: 6,
        ownerBirthDay: 30,
        ownerDeathYear: 2020,
        decedentHadStartedRmds: false,
      })),
      july1Death2021AssertedNotStarted: summarizeRbd(deriveRbdComparison({
        ownerBirthYear: 1949,
        ownerBirthMonth: 7,
        ownerBirthDay: 1,
        ownerDeathYear: 2021,
        decedentHadStartedRmds: false,
      })),
      yearOnlyDeath2021AssertedNotStarted: summarizeRbd(deriveRbdComparison({
        ownerBirthYear: 1949,
        ownerDeathYear: 2021,
        decedentHadStartedRmds: false,
      })),
    },
  }
}

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

// Independent worksheet (not engine output); attainment from former Treas. Reg.
// 1.401(a)(9)-2 Q&A-3 (T.D. 8987); IRA RBD from former 1.408-8 Q&A-3:
// 1948-06: 70th birthday June 2018; +6 months → Dec 2018; attain 2018; IRA RBD year 2019.
// 1948-07: 70th birthday July 2018; +6 months → Jan 2019; attain 2019; IRA RBD year 2020
//   (retains historical 70½; §114(d) does not move anyone who attained 70½ in 2019).
// 1949-06-30: born before July 1, 1949 → still 70½; attain Dec 2019 (not after 2019-12-31);
//   IRA RBD year 2020. Death 2020 in the RBD year, asserted not started → before-rbd (tie-break).
//   Placing the RBD in the attain year instead of attain year+1 would put it in 2019, so death
//   2020 would be after the RBD and the false assertion would contradict rather than tie-break.
// 1949-07-01: SECURE §114 moves age to 72 (would have attained 70½ in Jan 2020 after the
//   cutoff); attain 2021; IRA RBD year 2022 (not 2020). Death 2021 < 2022 → before-rbd.
// Year-only 1949: candidates 2019 (70½) and 2021 (age 72). For death 2021 those yield
//   on-or-after vs before, so precision is refused rather than guessed.
// Wrong reading A collapses every 1949 birth onto age 72 (June 30 stays on 70½ under the
//   statute and the final reg), so June death 2020 stays before-rbd (RBD 2022) without
//   contradicting the false assertion, and year-only 1949 invents a single side.
// Wrong reading B keeps July 1949 on 70½ attain-year math
//   (SECURE never moved the cohort), so July attain becomes 2020 rather than 2021.
describeRule('treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72', {
  readings: {
    statutoryJuly1949Boundary: {
      attainYears: {
        born1948June: [2018],
        born1948July: [2019],
        born1949June: [2019],
        born1949July: [2021],
        born1949YearOnly: [2019, 2021],
      },
      deathVersusRbd: {
        june30Death2020AssertedNotStarted: resolvedRbd('before-rbd'),
        july1Death2021AssertedNotStarted: resolvedRbd('before-rbd'),
        yearOnlyDeath2021AssertedNotStarted: precisionInsufficient,
      },
    } satisfies SeventyHalfCohortVector,
    allNineteenFortyNineAsAgeSeventyTwo: {
      attainYears: {
        born1948June: [2018],
        born1948July: [2019],
        born1949June: [2021],
        born1949July: [2021],
        born1949YearOnly: [2021],
      },
      deathVersusRbd: {
        june30Death2020AssertedNotStarted: resolvedRbd('before-rbd'),
        july1Death2021AssertedNotStarted: resolvedRbd('before-rbd'),
        yearOnlyDeath2021AssertedNotStarted: resolvedRbd('before-rbd'),
      },
    } satisfies SeventyHalfCohortVector,
    secureNeverMovedJulyNineteenFortyNine: {
      attainYears: {
        born1948June: [2018],
        born1948July: [2019],
        born1949June: [2019],
        born1949July: [2020],
        born1949YearOnly: [2019, 2020],
      },
      deathVersusRbd: {
        june30Death2020AssertedNotStarted: resolvedRbd('before-rbd'),
        july1Death2021AssertedNotStarted: resolvedRbd('before-rbd'),
        yearOnlyDeath2021AssertedNotStarted: precisionInsufficient,
      },
    } satisfies SeventyHalfCohortVector,
  },
  accepted: 'statutoryJuly1949Boundary',
}, ({ accepted, readings }) => {
  it('keeps the June 30 / July 1, 1949 cut, 70½ attain years, and IRA RBD-year placement', () => {
    const observed = observeSeventyHalfCohortVector()
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.allNineteenFortyNineAsAgeSeventyTwo)
    expect(observed).not.toEqual(readings.secureNeverMovedJulyNineteenFortyNine)
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
