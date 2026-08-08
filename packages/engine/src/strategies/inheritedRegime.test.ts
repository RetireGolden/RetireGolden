import { describe, expect, it } from 'vitest'

import {
  inheritedAccountSchema,
  type InheritedAccount,
  type InheritedBeneficiary,
} from '../model/plan.js'
import { packForYear, singleLifeExpectancyYears } from '../params/index.js'
import {
  classifyInheritedRegime,
  inheritedRequirementForYear,
  inheritedRequirementSchedule,
  spouseTreatAsOwnCatchUp,
  type InheritedRegimeClassification,
} from './inheritedIra.js'
import { jointLifeTableDivisor } from '../rmd/jointLifeTable.js'

const { pack } = packForYear(2026)
const provenance = { source: 'test', asOf: '2026-01-01' }

function beneficiary(
  overrides: Partial<InheritedBeneficiary> = {},
): InheritedBeneficiary {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1995,
    soleBeneficiary: true,
    election: 'none',
    ownerBirthYear: 1970,
    provenance,
    ...overrides,
  }
}

function inherited(
  ownerDeathYear: number,
  decedentHadStartedRmds: boolean,
  beneficiaryBlock: InheritedBeneficiary | undefined,
): InheritedAccount {
  return {
    ownerDeathYear,
    decedentHadStartedRmds,
    ...(beneficiaryBlock === undefined ? {} : { beneficiary: beneficiaryBlock }),
  }
}

function classification(
  accountType: 'traditional' | 'roth',
  account: InheritedAccount,
): InheritedRegimeClassification {
  const result = classifyInheritedRegime({ accountType, accountKind: 'ira', inherited: account })
  expect(result.kind).toBe('regime')
  if (result.kind !== 'regime') throw new Error(result.reason)
  return result
}

function requirement(
  classificationResult: InheritedRegimeClassification,
  account: InheritedAccount,
  year: number,
) {
  return inheritedRequirementForYear({
    pack,
    classification: classificationResult,
    inherited: account,
    year,
    priorYearEndBalance: 100_000,
  })
}

describe('WS3 fixture F1: R1 relief years and the 2022 reset', () => {
  it('uses the beneficiary fixed arm, publishes relief-year evidence, and sweeps in 2030', () => {
    const account = inherited(2020, true, beneficiary({
      ownerBirthYear: 1940,
      beneficiaryBirthYear: 1952,
      ownerYearOfDeathRmdSatisfied: true,
    }))
    const result = classification('traditional', account)

    expect(result.row).toBe('R1')
    expect(result.regime).toBe('ten-year-with-annual-rmds')
    expect(result.classification).toBe('settled')
    expect(result.finalDeadlineYear).toBe(2030)

    const in2021 = requirement(result, account, 2021)
    expect(in2021.kind).toBe('annual-rmd')
    expect(in2021.requiredAmount).toBe(0)
    expect(in2021.limitation).toBe('pre-2022-tables-not-carried')
    expect(in2021.noticeWaived).toBe(true)
    expect(in2021.citations).toContain('Notices 2022-53/2023-54/2024-35')

    const in2022 = requirement(result, account, 2022)
    expect(in2022.divisor).toBeCloseTo(18.6, 4)
    expect(in2022.noticeWaived).toBe(true)

    const in2024 = requirement(result, account, 2024)
    expect(in2024.noticeWaived).toBe(true)

    const in2025 = requirement(result, account, 2025)
    expect(in2025.divisor).toBeCloseTo(15.6, 4)
    expect(in2025.divisorArm).toBe('beneficiary-fixed')
    expect(in2025.requiredAmount).toBeCloseTo(100_000 / 15.6, 4)
    expect(in2025.noticeWaived).toBe(false)

    const sweep = requirement(result, account, 2030)
    expect(sweep.kind).toBe('final-sweep')
    expect(sweep.requiredAmount).toBe(100_000)
  })
})

describe('WS3 fixture F2: greater-of owner arm', () => {
  it('uses Uniform Lifetime for year zero and the owner fixed arm afterward', () => {
    const account = inherited(2023, true, beneficiary({
      ownerBirthYear: 1948,
      beneficiaryBirthYear: 1940,
      edbCategory: 'not-more-than-10-years-younger',
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const result = classification('traditional', account)

    expect(result.row).toBe('R3')
    expect(result.regime).toBe('edb-life-expectancy')
    expect(result.classification).toBe('settled')
    expect(result.disclosures).toContain('successor-clock-out-of-scope')

    const yearOfDeath = requirement(result, account, 2023)
    expect(yearOfDeath.kind).toBe('year-of-death-rmd')
    expect(yearOfDeath.divisor).toBeCloseTo(24.6, 4)
    expect(yearOfDeath.divisorArm).toBe('uniform-lifetime')
    expect(yearOfDeath.requiredAmount).toBeCloseTo(100_000 / 24.6, 4)

    const in2024 = requirement(result, account, 2024)
    expect(in2024.kind).toBe('annual-rmd')
    expect(in2024.divisor).toBeCloseTo(13.8, 4)
    expect(in2024.divisorArm).toBe('owner-fixed')
    expect(in2024.requiredAmount).toBeCloseTo(100_000 / 13.8, 4)

    const in2025 = requirement(result, account, 2025)
    expect(in2025.divisor).toBeCloseTo(12.8, 4)
    expect(in2025.divisorArm).toBe('owner-fixed')
  })
})

describe('WS3 year-of-death joint-life divisor', () => {
  it('uses the Joint and Last Survivor Table for a sole spouse more than 10 years younger', () => {
    const account = inherited(2024, true, beneficiary({
      ownerBirthYear: 1940,
      beneficiaryBirthYear: 1965,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const result = classification('traditional', account)
    const yearOfDeath = requirement(result, account, 2024)

    expect(yearOfDeath.kind).toBe('year-of-death-rmd')
    expect(yearOfDeath.divisorArm).toBe('joint-life')
    expect(yearOfDeath.divisor).toBe(jointLifeTableDivisor(84, 59))
    expect(yearOfDeath.divisor).toBeGreaterThan(16.8)
    expect(yearOfDeath.citations).toContain('Treas. Reg. §1.401(a)(9)-5(c)(2)(i)')
  })

  it('uses Uniform Lifetime without a gap limitation when owner born December 31 and gap is exactly 10 birth years', () => {
    const account = inherited(2024, true, beneficiary({
      ownerBirthYear: 1950,
      ownerBirthMonth: 12,
      ownerBirthDay: 31,
      beneficiaryBirthYear: 1960,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const result = classification('traditional', account)
    const yearOfDeath = requirement(result, account, 2024)

    expect(yearOfDeath.kind).toBe('year-of-death-rmd')
    expect(yearOfDeath.divisorArm).toBe('uniform-lifetime')
    expect(yearOfDeath.limitation).toBeUndefined()
    expect(yearOfDeath.divisor).toBeCloseTo(25.5, 4)
    expect(yearOfDeath.requiredAmount).toBeCloseTo(100_000 / 25.5, 4)
  })
})

describe('WS3 year-of-death CARES 2020 waiver', () => {
  it('returns none for a 2020 death year — calendar-year-2020 RMDs were waived entirely', () => {
    const account = inherited(2020, true, beneficiary({
      ownerBirthYear: 1940,
      beneficiaryBirthYear: 1965,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const result = classification('traditional', account)
    const yearOfDeath = requirement(result, account, 2020)

    expect(yearOfDeath.kind).toBe('none')
    expect(yearOfDeath.requiredAmount).toBe(0)
    expect(yearOfDeath.citations).toContain('IRC §401(a)(9)(I) (CARES Act §2203)')
  })

  it('keeps the pre-2022-tables limitation for a 2021 death year', () => {
    const account = inherited(2021, true, beneficiary({
      ownerBirthYear: 1940,
      beneficiaryBirthYear: 1965,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const result = classification('traditional', account)
    const yearOfDeath = requirement(result, account, 2021)

    expect(yearOfDeath.kind).toBe('year-of-death-rmd')
    expect(yearOfDeath.requiredAmount).toBe(0)
    expect(yearOfDeath.limitation).toBe('pre-2022-tables-not-carried')
  })
})

describe('WS3 fixture F3: spouse redetermination', () => {
  it('redetermines the spouse arm rather than subtracting one from its prior value', () => {
    const account = inherited(2024, true, beneficiary({
      ownerBirthYear: 1945,
      beneficiaryBirthYear: 1947,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      ownerYearOfDeathRmdSatisfied: true,
    }))
    const result = classification('traditional', account)

    expect(result.row).toBe('S1')
    expect(result.regime).toBe('spouse-remain-beneficiary')
    expect(result.classification).toBe('settled')
    expect(result.disclosures).toContain('successor-clock-out-of-scope')

    const in2025 = requirement(result, account, 2025)
    expect(in2025.kind).toBe('annual-rmd')
    expect(in2025.divisor).toBeCloseTo(12.6, 4)
    expect(in2025.divisorArm).toBe('spouse-redetermined')

    const in2026 = requirement(result, account, 2026)
    expect(in2026.divisor).toBeCloseTo(11.9, 4)
    expect(in2026.divisorArm).toBe('spouse-redetermined')
    expect(in2026.divisor).not.toBeCloseTo(11.6, 4)
  })
})

describe('WS3 fixture F4: S0 spouse deferral and §327 commencement gating', () => {
  it('defers to the year the owner would have attained 75', () => {
    const account = inherited(2021, false, beneficiary({
      ownerBirthYear: 1960,
      beneficiaryBirthYear: 1962,
      edbCategory: 'surviving-spouse',
      election: 'none',
    }))
    const result = classification('traditional', account)

    expect(result.row).toBe('S0')
    expect(result.regime).toBe('spouse-remain-beneficiary')
    expect(result.classification).toBe('unsettled')
    expect(result.disclosures).toEqual(expect.arrayContaining([
      'deemed-election-risk',
      'prop-reg-spouse-as-employee',
      'successor-clock-out-of-scope',
    ]))
    expect(result.citations).toEqual(expect.arrayContaining([
      'Treas. Reg. §1.401(a)(9)-3(d)',
      'Treas. Reg. §1.401(a)(9)-5(d)(2)',
      'Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)',
    ]))
    for (let year = 2022; year <= 2034; year++) {
      expect(requirement(result, account, year).kind).toBe('none')
    }
    const in2035 = requirement(result, account, 2035)
    expect(in2035.kind).toBe('annual-rmd')
    expect(in2035.divisor).toBeCloseTo(16.4, 4)
    expect(in2035.divisorArm).toBe('spouse-redetermined')
  })

  it('returns plain none (no pre-2022 limitation) during deferral for a 2020 death', () => {
    const account = inherited(2020, false, beneficiary({
      ownerBirthYear: 1960,
      beneficiaryBirthYear: 1962,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
    }))
    const result = classification('traditional', account)

    expect(result.row).toBe('S1')
    expect(result.regime).toBe('spouse-remain-beneficiary')
    expect(result.rbdComparison).toBe('before-rbd')

    const in2021 = requirement(result, account, 2021)
    expect(in2021.kind).toBe('none')
    expect(in2021.requiredAmount).toBe(0)
    expect(in2021.limitation).toBeUndefined()

    const in2035 = requirement(result, account, 2035)
    expect(in2035.kind).toBe('annual-rmd')
    expect(in2035.divisorArm).toBe('spouse-redetermined')
  })

  it('settles S1 without §327 disclosure when commencement is 2022', () => {
    const account = inherited(2021, false, beneficiary({
      ownerBirthYear: 1950,
      beneficiaryBirthYear: 1952,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('S1')
    expect(result.classification).toBe('settled')
    expect(result.disclosures).not.toContain('prop-reg-spouse-as-employee')
  })

  it('settles Roth K2 without §327 disclosure when commencement is 2022', () => {
    const account = inherited(2021, false, beneficiary({
      ownerBirthYear: 1950,
      beneficiaryBirthYear: 1952,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
      roth5YearStartYear: 2015,
    }))
    const result = classification('roth', account)
    expect(result.row).toBe('K2')
    expect(result.classification).toBe('settled')
    expect(result.disclosures).not.toContain('prop-reg-spouse-as-employee')
    expect(result.disclosures).not.toContain('roth-taxability-needs-review')
  })
})

describe('WS3 fixtures F5 through F8', () => {
  it('F5 classifies R2 and carries no annual or year-zero amount', () => {
    const account = inherited(2022, false, beneficiary({
      ownerBirthYear: 1970,
      beneficiaryBirthYear: 1995,
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('R2')
    expect(result.regime).toBe('ten-year-no-annual')
    expect(result.finalDeadlineYear).toBe(2032)
    expect(requirement(result, account, 2022).kind).toBe('none')
    expect(requirement(result, account, 2026).kind).toBe('none')
    expect(requirement(result, account, 2032).kind).toBe('final-sweep')
  })

  it('F6 keeps a minor child on annual RMDs through the tail', () => {
    const account = inherited(2020, false, beneficiary({
      ownerBirthYear: 1975,
      beneficiaryBirthYear: 2010,
      edbCategory: 'minor-child',
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('R3')
    expect(result.disclosures).toContain('successor-clock-out-of-scope')
    expect(result.minorMajorityYear).toBe(2031)
    expect(result.finalDeadlineYear).toBe(2041)

    const in2021 = requirement(result, account, 2021)
    expect(in2021.kind).toBe('annual-rmd')
    expect(in2021.requiredAmount).toBe(0)
    expect(in2021.limitation).toBe('pre-2022-tables-not-carried')
    const in2022 = requirement(result, account, 2022)
    expect(in2022.kind).toBe('annual-rmd')
    expect(in2022.divisor).toBeCloseTo(72.9, 4)
    expect(in2022.divisorArm).toBe('beneficiary-fixed')
    expect(requirement(result, account, 2035).divisor).toBeCloseTo(59.9, 4)
    expect(requirement(result, account, 2041).kind).toBe('final-sweep')
  })

  it('F7 classifies Roth K1 and attaches the K3 evidence disclosure', () => {
    const account = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      ownerBirthYear: undefined,
    }))
    const result = classification('roth', account)
    expect(result.row).toBe('K1')
    expect(result.regime).toBe('roth-ten-year-no-annual')
    expect(result.classification).toBe('settled')
    expect(result.rbdComparison).toBe('before-rbd')
    expect(result.finalDeadlineYear).toBe(2032)
    expect(result.disclosures).toEqual(['roth-taxability-needs-review'])
    expect(requirement(result, account, 2022).kind).toBe('none')
    expect(requirement(result, account, 2026).kind).toBe('none')
  })

  it('F8 defers Roth spouse K2 distributions until 2031', () => {
    const account = inherited(2022, false, beneficiary({
      ownerBirthYear: 1958,
      beneficiaryBirthYear: 1960,
      edbCategory: 'surviving-spouse',
      election: 'remain-beneficiary',
    }))
    const result = classification('roth', account)
    expect(result.row).toBe('K2')
    expect(result.regime).toBe('roth-edb-life-expectancy')
    expect(result.classification).toBe('unsettled')
    expect(result.disclosures).toEqual(expect.arrayContaining([
      'prop-reg-spouse-as-employee',
      'roth-taxability-needs-review',
      'successor-clock-out-of-scope',
    ]))
    expect(requirement(result, account, 2030).kind).toBe('none')
    const in2031 = requirement(result, account, 2031)
    expect(in2031.kind).toBe('annual-rmd')
    expect(in2031.divisorArm).toBe('spouse-redetermined')
  })
})

describe('WS3 fixture F9: born-1959 sensitivity', () => {
  it('settles the RBD-year tie-break but refuses ambiguous spouse deferrals', () => {
    const beforeBoth = inherited(2020, false, beneficiary({
      ownerBirthYear: 1959,
      beneficiaryBirthYear: 1990,
    }))
    const settled = classification('traditional', beforeBoth)
    expect(settled.row).toBe('R2')
    expect(settled.classification).toBe('settled')

    const tied = classification('traditional', inherited(2033, false, beneficiary({
      ownerBirthYear: 1959,
      beneficiaryBirthYear: 1990,
    })))
    expect(tied.row).toBe('R2')
    expect(tied.classification).toBe('settled')

    const contested = classifyInheritedRegime({
      accountType: 'traditional',
      accountKind: 'ira',
      inherited: inherited(2033, true, beneficiary({
        ownerBirthYear: 1959,
        beneficiaryBirthYear: 1990,
      })),
    })
    expect(contested.kind).toBe('refusal')
    if (contested.kind === 'refusal') {
      expect(contested.row).toBe('X5')
      expect(contested.refusal).toBe('needs-review')
      expect(contested.reason).toContain('contested applicable age')
    }

    const spouse = classifyInheritedRegime({
      accountType: 'traditional',
      accountKind: 'ira',
      inherited: inherited(2020, false, beneficiary({
        ownerBirthYear: 1959,
        beneficiaryBirthYear: 1962,
        edbCategory: 'surviving-spouse',
        election: 'remain-beneficiary',
      })),
    })
    expect(spouse.kind).toBe('refusal')
    if (spouse.kind === 'refusal') {
      expect(spouse.row).toBe('X5')
      expect(spouse.refusal).toBe('needs-review')
      expect(spouse.reason).toContain('2032 vs 2034')
    }

    for (const accountType of ['traditional', 'roth'] as const) {
      const unknownOwner = classifyInheritedRegime({
        accountType,
        accountKind: 'ira',
        inherited: inherited(2020, false, beneficiary({
          ownerBirthYear: undefined,
          beneficiaryBirthYear: 1962,
          edbCategory: 'surviving-spouse',
          election: 'remain-beneficiary',
        })),
      })
      expect(unknownOwner.kind).toBe('refusal')
      if (unknownOwner.kind === 'refusal') {
        expect(unknownOwner.row).toBe('X5')
        expect(unknownOwner.refusal).toBe('needs-review')
        expect(unknownOwner.reason).toContain('§1.401(a)(9)-3(d)')
      }
    }
  })
})

describe('WS3 fixture F10: X precedence and refusals', () => {
  function expectRefusal(
    accountType: 'traditional' | 'roth',
    account: InheritedAccount,
    row: string,
    refusal: string,
    reasonFragment: string,
  ) {
    const result = classifyInheritedRegime({ accountType, accountKind: 'ira', inherited: account })
    expect(result.kind).toBe('refusal')
    if (result.kind === 'refusal') {
      expect(result.row).toBe(row)
      expect(result.refusal).toBe(refusal)
      expect(result.reason).toContain(reasonFragment)
    }
  }

  it('fails closed in X1 through X5 precedence cases', () => {
    expectRefusal('traditional', inherited(2024, false, beneficiary({
      beneficiaryClass: 'estate', edbCategory: 'none', beneficiaryBirthYear: undefined,
      soleBeneficiary: undefined,
    })), 'X3', 'unsupported', "beneficiaryClass 'estate'")
    expectRefusal('traditional', inherited(2024, false, beneficiary({
      beneficiaryClass: 'successor-beneficiary', edbCategory: 'none', beneficiaryBirthYear: undefined,
      soleBeneficiary: undefined,
    })), 'X2', 'unsupported', "beneficiaryClass 'successor-beneficiary'")
    expectRefusal('traditional', inherited(2024, false, beneficiary({ soleBeneficiary: false })), 'X4', 'unsupported', 'soleBeneficiary is false')
    expectRefusal('traditional', inherited(2024, false, beneficiary({ soleBeneficiary: undefined })), 'X5', 'needs-review', 'soleBeneficiary is required')
    expectRefusal('traditional', inherited(2019, false, beneficiary()), 'X1', 'legacy-planning-approximation', 'before 2020')

    expectRefusal('traditional', inherited(2031, false, beneficiary({
      ownerBirthYear: 1970, beneficiaryBirthYear: 2010, edbCategory: 'minor-child',
    })), 'X5', 'needs-review', 'ambiguous at year precision')
    expectRefusal('traditional', inherited(2032, false, beneficiary({
      ownerBirthYear: 1970, beneficiaryBirthYear: 2010, edbCategory: 'minor-child',
    })), 'X5', 'needs-review', 'after the beneficiary\'s majority year')
    expectRefusal('traditional', inherited(2023, true, beneficiary({
      ownerBirthYear: 1948, beneficiaryBirthYear: 1940,
    })), 'X5', 'needs-review', "edbCategory 'none' is contradicted")
    expectRefusal('traditional', inherited(2022, true, beneficiary({
      ownerBirthYear: 1940,
      ownerBirthMonth: 12,
      ownerBirthDay: 31,
      beneficiaryBirthYear: 1950,
      edbCategory: 'none',
    })), 'X5', 'needs-review', "edbCategory 'none' is contradicted")
    expectRefusal('traditional', inherited(2022, false, beneficiary({
      ownerBirthYear: 1970, beneficiaryBirthYear: 1981,
      edbCategory: 'not-more-than-10-years-younger',
    })), 'X5', 'needs-review', "edbCategory 'not-more-than-10-years-younger' is contradicted")

    expectRefusal('roth', inherited(2022, false, beneficiary({
      ownerBirthYear: 1970,
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 2023,
    })), 'X5', 'needs-review', 'roth5YearStartYear 2023 is after ownerDeathYear 2022')

    expectRefusal('roth', inherited(2022, false, beneficiary({
      ownerBirthYear: 1970,
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 1965,
    })), 'X5', 'needs-review', 'roth5YearStartYear 1965 is before ownerBirthYear 1970')

    const exactTen = classification('traditional', inherited(2022, false, beneficiary({
      ownerBirthYear: 1970, beneficiaryBirthYear: 1980,
      edbCategory: 'not-more-than-10-years-younger',
    })))
    expect(exactTen.row).toBe('R3')
    expect(exactTen.disclosures).toEqual(expect.arrayContaining([
      'edb-category-year-precision-unverified',
      'successor-clock-out-of-scope',
    ]))

    // The classifier is total over its input type, even when callers bypass
    // the parser, so it must fail closed on this required designated-person fact.
    expectRefusal('traditional', inherited(2024, false, beneficiary({
      beneficiaryBirthYear: undefined,
    })), 'X5', 'needs-review', 'beneficiaryBirthYear')

    expectRefusal('roth', inherited(2024, true, beneficiary({
      beneficiaryBirthYear: 1980,
      ownerBirthYear: 1945,
    })), 'X5', 'needs-review', 'decedentHadStartedRmds true is contradictory for an inherited Roth')

    expectRefusal('traditional', inherited(2024, true, beneficiary({
      ownerBirthYear: 1945, beneficiaryBirthYear: 1947,
      edbCategory: 'surviving-spouse', election: 'ten-year-election',
    })), 'S3x', 'needs-review', "election 'ten-year-election' applies only when death is before the RBD")
    expectRefusal('traditional', inherited(2024, true, beneficiary({
      ownerBirthYear: 1945, beneficiaryBirthYear: 1947,
      edbCategory: 'surviving-spouse', election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: undefined,
    })), 'X5', 'needs-review', 'spouseUnlimitedWithdrawalRight true')

    const employerPlan = classifyInheritedRegime({
      accountType: 'traditional',
      accountKind: 'employer',
      inherited: inherited(2024, false, beneficiary()),
    })
    expect(employerPlan.kind).toBe('refusal')
    if (employerPlan.kind === 'refusal') {
      expect(employerPlan.refusal).toBe('unsupported')
      expect(employerPlan.row).toBe('X5')
      expect(employerPlan.reason).toContain('employer-plan')
    }
  })
})

describe('WS3 fixture F11: parsed completeness join', () => {
  it('classifies every parser-accepted product combination exactly once', () => {
    const tally: Record<string, number> = {}
    const accountTypes = ['traditional', 'roth'] as const
    const deathYears = [2019, 2020, 2023]
    const beneficiaryClasses = [
      'designated-individual', 'estate', 'trust', 'entity', 'successor-beneficiary',
    ] as const
    const edbCategories = [
      'none', 'surviving-spouse', 'minor-child', 'disabled', 'chronically-ill',
      'not-more-than-10-years-younger',
    ] as const
    const elections = [undefined, 'none', 'remain-beneficiary', 'treat-as-own', 'ten-year-election'] as const
    const ownerBirthYears = [1940, 1948, 1959, 1970, undefined]
    const beneficiaryBirthYears = [1940, 1952, 2010]

    for (const accountType of accountTypes) {
      for (const ownerDeathYear of deathYears) {
        for (const hasBeneficiary of [false, true]) {
          for (const beneficiaryClass of beneficiaryClasses) {
            for (const edbCategory of edbCategories) {
              for (const soleBeneficiary of [false, true]) {
                for (const election of elections) {
                  for (const decedentHadStartedRmds of [false, true]) {
                    for (const ownerBirthYear of ownerBirthYears) {
                      for (const beneficiaryBirthYear of beneficiaryBirthYears) {
                        for (const spouseUnlimitedWithdrawalRight of [undefined, true]) {
                          const candidate = {
                            ownerDeathYear,
                            decedentHadStartedRmds,
                            ...(hasBeneficiary
                              ? {
                                  beneficiary: {
                                    beneficiaryClass,
                                    edbCategory,
                                    beneficiaryBirthYear,
                                    soleBeneficiary,
                                    election,
                                    ownerBirthYear,
                                    spouseUnlimitedWithdrawalRight,
                                    provenance,
                                  },
                                }
                              : {}),
                          }
                          const parsed = inheritedAccountSchema.safeParse(candidate)
                          if (!parsed.success) continue

                          let result: ReturnType<typeof classifyInheritedRegime> | undefined
                          expect(() => {
                            result = classifyInheritedRegime({ accountType, accountKind: 'ira', inherited: parsed.data })
                          }).not.toThrow()
                          expect(result).toBeDefined()
                          expect(result!.kind === 'regime' || result!.kind === 'refusal').toBe(true)
                          if (ownerDeathYear === 2019) {
                            expect(result!.row).toBe('X1')
                          } else if (hasBeneficiary && beneficiaryClass === 'successor-beneficiary') {
                            expect(result!.row).toBe('X2')
                          } else if (hasBeneficiary && (beneficiaryClass === 'estate' || beneficiaryClass === 'trust' || beneficiaryClass === 'entity')) {
                            expect(result!.row).toBe('X3')
                          } else if (hasBeneficiary && soleBeneficiary === false) {
                            expect(result!.row).toBe('X4')
                          }
                          if (accountType === 'roth' && result!.kind === 'regime') {
                            // Matrix R3a covers 'traditional or Roth EDB' ten-year elections, so R3a is a legitimate Roth row.
                            expect(['K1', 'K2', 'S2', 'S3', 'R3a']).toContain(result!.row)
                          }
                          if (edbCategory === 'none' && result!.kind === 'regime') {
                            expect(['R1', 'R2', 'K1']).toContain(result!.row)
                          }
                          if (result!.kind === 'refusal') {
                            expect(result!.reason).not.toHaveLength(0)
                            expect(result!.reason).toMatch(/owner|beneficiary|soleBeneficiary|edbCategory|election|accountType|death|RBD|Treas\. Reg\.|matrix/i)
                          }
                          tally[result!.row] = (tally[result!.row] ?? 0) + 1
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(tally).toMatchInlineSnapshot(`
      {
        "K1": 64,
        "K2": 468,
        "R1": 24,
        "R2": 40,
        "R3": 360,
        "R3a": 292,
        "S0": 72,
        "S1": 36,
        "S3": 96,
        "X1": 77040,
        "X2": 960,
        "X3": 2880,
        "X4": 3120,
        "X5": 37668,
      }
    `)
  })
})

describe('WS3 fixtures F12 and F13', () => {
  it('F12 sweeps an exhausted fixed expectancy before a minor-child deadline could apply', () => {
    const account = inherited(2020, false, beneficiary({
      ownerBirthYear: 1975,
      beneficiaryBirthYear: 1920,
      edbCategory: 'not-more-than-10-years-younger',
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('R3')
    const schedule = inheritedRequirementSchedule({
      pack,
      classification: result,
      inherited: account,
      fromYear: 2021,
      toYear: 2030,
      priorYearEndBalance: 100_000,
    })
    const exhaustion = schedule.find((entry) => entry.kind === 'final-sweep')
    expect(exhaustion).toBeDefined()
    expect(exhaustion!.year).toBeLessThan(2030)
    expect(exhaustion!.requiredAmount).toBe(100_000)
  })

  it('F12 divisor boundary sweep without a notice waiver', () => {
    const account = inherited(2022, true, beneficiary({
      ownerBirthYear: 1910,
      beneficiaryBirthYear: 1903,
      edbCategory: 'not-more-than-10-years-younger',
      ownerYearOfDeathRmdSatisfied: true,
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('R3')
    expect(singleLifeExpectancyYears(pack, 120)).toBe(1)

    const boundary = requirement(result, account, 2023)
    expect(boundary.kind).toBe('final-sweep')
    expect(boundary.requiredAmount).toBe(100_000)
    expect(boundary.noticeWaived).toBeUndefined()
    // R1 exhaustion during a notice-relief year is unreachable from valid facts;
    // annualEvidence preserves its noticeWaived flag defensively for that branch.
  })

  it('F13 computes Uniform Lifetime catch-up from the first applicable year', () => {
    const account = inherited(2021, false, beneficiary({
      ownerBirthYear: 1950,
      beneficiaryBirthYear: 1951,
      edbCategory: 'surviving-spouse',
      election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: true,
    }))
    const result = classification('traditional', account)
    expect(result.row).toBe('S2')
    expect(result.regime).toBe('spouse-treat-as-own-transition')
    expect(result.classification).toBe('settled')
    const afterDeath = requirement(result, account, 2022)
    expect(afterDeath.kind).toBe('none')
    expect(afterDeath.limitation).toBe('treat-as-own-election-year-not-carried')

    const catchUp = spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: account,
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {
        2024: 100_000,
        2025: 100_000,
        2026: 100_000,
        2027: 100_000,
      },
    })
    expect(catchUp).toHaveLength(4)
    for (const [index, divisor] of [26.5, 25.5, 24.6, 23.7].entries()) {
      const entry = catchUp[index]!
      expect(entry.year).toBe(2024 + index)
      expect(entry.kind).toBe('annual-rmd')
      expect(entry.divisor).toBeCloseTo(divisor, 4)
      expect(entry.divisorArm).toBe('uniform-lifetime')
      expect(entry.requiredAmount).toBeCloseTo(100_000 / divisor, 4)
      expect(entry.citations).toContain('Treas. Reg. §1.402(c)-2(j)(4)(i)–(v)')
    }
    expect(spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: account,
      electionYear: 2023,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toEqual([])
    expect(spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: account,
      electionYear: 2027,
      spouseWasUnderTenYearRule: false,
      priorYearEndBalancesByYear: {},
    })).toEqual([])

    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: 1950,
        beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2020,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('electionYear precedes ownerDeathYear')

    const born1950Account = inherited(2020, false, beneficiary({
      ownerBirthYear: 1950,
      beneficiaryBirthYear: 1950,
      edbCategory: 'surviving-spouse',
      election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: true,
    }))
    expect(spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: born1950Account,
      electionYear: 2020,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toEqual([])
    const born1950CatchUp = spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: born1950Account,
      electionYear: 2023,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {
        2022: 100_000,
        2023: 100_000,
      },
    })
    expect(born1950CatchUp).toHaveLength(2)
    expect(born1950CatchUp[0]!.year).toBe(2022)

    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2019, false, beneficiary({
        ownerBirthYear: 1950,
        beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2023,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('ownerDeathYear on or after 2020')

    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, true, beneficiary({
        ownerBirthYear: 1950,
        beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('§1.401(a)(9)-3(c)(3)')

    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: 1940,
        beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('§1.401(a)(9)-3(c)(3)')

    const clampAccount = inherited(2022, false, beneficiary({
      ownerBirthYear: 1950,
      beneficiaryBirthYear: 1948,
      edbCategory: 'surviving-spouse',
      election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: true,
    }))
    const electionInDeathYear = spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: clampAccount,
      electionYear: 2022,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: { 2022: 100_000 },
    })
    expect(electionInDeathYear).toHaveLength(1)
    expect(electionInDeathYear[0]!.year).toBe(2022)
    const clampedCatchUp = spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: clampAccount,
      electionYear: 2024,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {
        2022: 100_000,
        2023: 100_000,
        2024: 100_000,
      },
    })
    expect(clampedCatchUp).toHaveLength(3)
    expect(clampedCatchUp[0]!.year).toBe(2022)

    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: 1950, beneficiaryBirthYear: 1951, edbCategory: 'disabled',
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('requires a sole surviving-spouse beneficiary')
    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: undefined, beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse', election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('requires both beneficiaryBirthYear and ownerBirthYear')
    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: 1950, beneficiaryBirthYear: undefined,
        edbCategory: 'surviving-spouse', election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('requires both beneficiaryBirthYear and ownerBirthYear')
    expect(() => spouseTreatAsOwnCatchUp({
      pack,
      accountType: 'traditional',
      inherited: inherited(2021, false, beneficiary({
        ownerBirthYear: 1959, beneficiaryBirthYear: 1951,
        edbCategory: 'surviving-spouse', election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
      })),
      electionYear: 2027,
      spouseWasUnderTenYearRule: true,
      priorYearEndBalancesByYear: {},
    })).toThrow('cannot settle')
  })
})
