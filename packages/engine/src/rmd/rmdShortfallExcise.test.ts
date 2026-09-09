import { describe, expect, it } from 'vitest'
import { parsePlan, type Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { simulatePlan } from '../projection/simulate.js'
import {
  computeRmdShortfallExcise,
  rmdCorrectionWindowEnd,
  rmdShortfallObligationId,
  type RmdAutomaticWaiverEvidence,
  type RmdApplicablePlan,
  type RmdShortfallObligation,
  type RmdShortfallReliefElection,
} from './rmdShortfallExcise.js'

const OWNED_IRAS: RmdApplicablePlan = {
  kind: 'ownedTraditionalIras',
  payeePersonId: 'owner',
}

const EMPLOYER_PLAN: RmdApplicablePlan = {
  kind: 'employerPlan',
  accountId: 'employer-plan',
}

const INHERITED_IRAS: RmdApplicablePlan = {
  kind: 'inheritedIras',
  payeePersonId: 'beneficiary',
  decedentId: 'decedent',
  iraType: 'traditional',
}

type EdbTenYearElectionWaiver = Extract<
  RmdAutomaticWaiverEvidence,
  { kind: 'edbTenYearElection' }
>
type YearOfDeathWaiver = Extract<RmdAutomaticWaiverEvidence, { kind: 'yearOfDeath' }>

function obligation(
  overrides: Partial<RmdShortfallObligation> = {},
): RmdShortfallObligation {
  return {
    obligationId: rmdShortfallObligationId(OWNED_IRAS, 2026),
    distributionCalendarYear: 2026,
    taxYear: 2026,
    taxImposedOn: '2026-12-31',
    applicablePlan: OWNED_IRAS,
    requirementKind: 'ownedAnnual',
    requiredAmount: 10_000,
    distributedByDeadline: 8_000,
    ...overrides,
  }
}

function corrected(
  overrides: Partial<NonNullable<RmdShortfallReliefElection['correctiveDistribution']>> = {},
): RmdShortfallReliefElection {
  return {
    obligationId: rmdShortfallObligationId(OWNED_IRAS, 2026),
    correctiveDistribution: {
      amount: 2_000,
      receivedOn: '2027-03-01',
      sourceApplicablePlan: OWNED_IRAS,
      form5329FiledOn: '2027-04-15',
      returnReflectsReducedTax: true,
      ...overrides,
    },
  }
}

function inheritedObligation(
  overrides: Partial<RmdShortfallObligation> = {},
): RmdShortfallObligation {
  return obligation({
    obligationId: rmdShortfallObligationId(INHERITED_IRAS, 2026),
    applicablePlan: INHERITED_IRAS,
    requirementKind: 'inheritedAnnualLifeExpectancy',
    ...overrides,
  })
}

function edbTenYearElectionWaiver(
  overrides: Partial<EdbTenYearElectionWaiver> = {},
): EdbTenYearElectionWaiver {
  return {
    kind: 'edbTenYearElection',
    ownerDeathYear: 2024,
    electionMadeOn: '2033-12-31',
    ownerDiedBeforeRequiredBeginningDate: true,
    eligibleDesignatedBeneficiary: true,
    defaultLifeExpectancyApplied: true,
    affirmativeLifeExpectancyElectionMade: false,
    ...overrides,
  }
}

function yearOfDeathWaiver(
  overrides: Partial<YearOfDeathWaiver> = {},
): YearOfDeathWaiver {
  return {
    kind: 'yearOfDeath',
    ownerDeathYear: 2026,
    beneficiaryReturnDueDateIncludingExtensions: '2027-10-15',
    correctiveDistribution: {
      amount: 2_000,
      receivedOn: '2027-12-31',
      sourceApplicablePlan: INHERITED_IRAS,
    },
    ...overrides,
  }
}

// Sub-cent residue matches projection/rmdShortfallExcise.test.ts: the planner
// cannot leave whole-dollar balances undistributed, but ledger-cent rounding
// keeps a final-sweep requirement on the books with zero executed movement.
const POST_DEADLINE_REMAINING_BALANCE = 0.004
const POST_DEADLINE_EXCISE_TAX = POST_DEADLINE_REMAINING_BALANCE * 0.25
const noTax = createFlatTaxCalculator(0)

type ShortfallExciseReading = {
  partialShortfallTax: number
  qualifiedCorrectionTax: number
  waiverDeniedTax: number
  postDeadlineRequiredAmount: number
  postDeadlineExciseTax: number
}

function expectShortfallReading<K extends keyof ShortfallExciseReading>(
  field: K,
  observed: ShortfallExciseReading[K],
  accepted: ShortfallExciseReading,
  readings: Record<string, ShortfallExciseReading>,
  tolerance = 6,
) {
  if (typeof observed === 'number' && typeof accepted[field] === 'number') {
    expect(observed).toBeCloseTo(accepted[field], tolerance)
    for (const reading of Object.values(readings)) {
      if (reading[field] === accepted[field]) continue
      expect(observed).not.toBeCloseTo(reading[field], tolerance)
    }
    return
  }
  expect(observed).toBe(accepted[field])
  for (const reading of Object.values(readings)) {
    if (reading[field] === accepted[field]) continue
    expect(observed).not.toBe(reading[field])
  }
}

function postDeadlineInheritedPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1980-06-15', planningAge: 60 })
  plan.household.people[0]!.id = 'beneficiary'
  plan.accounts = [{
    type: 'traditional',
    kind: 'ira',
    id: 'inherited-traditional',
    name: 'Inherited traditional IRA',
    ownerPersonId: 'beneficiary',
    annualReturnPct: 0,
    balance: POST_DEADLINE_REMAINING_BALANCE,
    annualContribution: 0,
    inherited: {
      decedentId: 'decedent',
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'none',
        beneficiaryBirthYear: 1980,
        soleBeneficiary: true,
        election: 'none',
        ownerBirthYear: 1970,
        provenance: { source: 'test fixture', asOf: '2026-01-01' },
      },
    },
  }]
  return plan
}

function runPostDeadlineInheritedPlan() {
  const parsed = parsePlan(postDeadlineInheritedPlan())
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, {
    startYear: 2026,
    horizonEndYear: 2033,
    taxCalculator: noTax,
  })
}

describeRule('irc-4974-rmd-shortfall-excise-tax', {
  readings: {
    statute: {
      partialShortfallTax: 500,
      qualifiedCorrectionTax: 200,
      waiverDeniedTax: 500,
      postDeadlineRequiredAmount: POST_DEADLINE_REMAINING_BALANCE,
      postDeadlineExciseTax: POST_DEADLINE_EXCISE_TAX,
    },
    rejectedTaxOnTheWholeRequiredAmount: {
      partialShortfallTax: 2_500,
      qualifiedCorrectionTax: 200,
      waiverDeniedTax: 500,
      postDeadlineRequiredAmount: POST_DEADLINE_REMAINING_BALANCE,
      postDeadlineExciseTax: POST_DEADLINE_EXCISE_TAX,
    },
    rejectedDefaultRateAfterBothCorrectionConditions: {
      partialShortfallTax: 500,
      qualifiedCorrectionTax: 500,
      waiverDeniedTax: 500,
      postDeadlineRequiredAmount: POST_DEADLINE_REMAINING_BALANCE,
      postDeadlineExciseTax: POST_DEADLINE_EXCISE_TAX,
    },
    rejectedAutomaticZeroForAReasonableErrorRequest: {
      partialShortfallTax: 500,
      qualifiedCorrectionTax: 200,
      waiverDeniedTax: 0,
      postDeadlineRequiredAmount: POST_DEADLINE_REMAINING_BALANCE,
      postDeadlineExciseTax: POST_DEADLINE_EXCISE_TAX,
    },
    rejectedZeroObligationAfterEmptyingYear: {
      partialShortfallTax: 500,
      qualifiedCorrectionTax: 200,
      waiverDeniedTax: 500,
      postDeadlineRequiredAmount: 0,
      postDeadlineExciseTax: 0,
    },
  },
  accepted: 'statute',
}, ({ accepted, readings }) => {
  it('applies 25 percent to required minus timely distributed', () => {
    const result = computeRmdShortfallExcise(obligation())

    expect(result.shortfall).toBe(2_000)
    expectShortfallReading('partialShortfallTax', result.tax, accepted, readings)
    expect(result.reason).toBe('default25Percent')
  })

  it('requires the corrective distribution and the reflecting return inside the window', () => {
    const result = computeRmdShortfallExcise(obligation(), corrected())

    expectShortfallReading('qualifiedCorrectionTax', result.tax, accepted, readings)
    expect(result.reason).toBe('corrected10Percent')
  })

  it.each([
    ['partial corrective distribution', corrected({ amount: 1_999.99 })],
    ['wrong-plan corrective distribution', corrected({ sourceApplicablePlan: EMPLOYER_PLAN })],
    ['return does not reflect the reduced tax', corrected({ returnReflectsReducedTax: false })],
    ['distribution after an earlier notice of deficiency', corrected({
      noticeOfDeficiencyMailedOn: '2027-02-15',
    })],
    ['return after an earlier assessment', corrected({
      assessedOn: '2027-03-15',
      form5329FiledOn: '2027-04-15',
    })],
  ])('keeps the 25 percent default for a %s', (_label, relief) => {
    expect(computeRmdShortfallExcise(obligation(), relief).tax).toBe(500)
  })

  it('uses the earliest statutory correction-window endpoint', () => {
    expect(rmdCorrectionWindowEnd(2026, {})).toBe('2028-12-31')
    expect(rmdCorrectionWindowEnd(2026, {
      noticeOfDeficiencyMailedOn: '2028-03-01',
      assessedOn: '2027-11-15',
    })).toBe('2027-11-15')
  })

  it('does not turn a waiver request or denial into a grant', () => {
    for (const discretionaryWaiver of ['requested', 'denied'] as const) {
      const result = computeRmdShortfallExcise(obligation(), {
        obligationId: obligation().obligationId,
        discretionaryWaiver,
      })
      expectShortfallReading('waiverDeniedTax', result.tax, accepted, readings)
    }
  })

  it('uses zero only for an explicit modeled grant', () => {
    const result = computeRmdShortfallExcise(obligation(), {
      obligationId: obligation().obligationId,
      discretionaryWaiver: 'granted',
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('discretionaryWaiverGranted')
  })

  it('requires the entire remaining benefit after the emptying year and prices the excise on the shortfall', () => {
    // Independent worksheet (Treas. Reg. §54.4974-1(e)):
    // Death 2022 → ten-year emptying year 2032. If any benefit remains, each
    // later calendar year requires the entire remainder (worksheet example uses
    // $50,000; this compact fixture uses a sub-cent residue so simulatePlan can
    // keep the requirement on the books without clearing it at ledger cents).
    // Rejected: zero obligation as if the emptying year discharged it.
    // Excise: 25% × remainder shortfall.
    // Compact inherited fixture adapted from projection/rmdShortfallExcise.test.ts;
    // annualInheritedIraDistributions wires inheritedRequirementForYear into
    // §4974 obligations before computeRmdShortfallExcise runs.
    const postDeadlineYear = runPostDeadlineInheritedPlan().years.find((row) => row.year === 2033)!
    const inheritedEvidence = postDeadlineYear.inheritedAccounts?.find(
      (row) => row.accountId === 'inherited-traditional',
    )
    expect(inheritedEvidence?.requirementKind).toBe('final-sweep')
    expect(inheritedEvidence?.executedRequiredAmount).toBe(0)
    const postDeadlineExcise = postDeadlineYear.rmdShortfallExciseDetails?.find(
      (detail) => detail.distributionCalendarYear === 2033,
    )
    expect(postDeadlineExcise).toBeDefined()

    const observed = {
      postDeadlineRequiredAmount: inheritedEvidence!.requiredAmount,
      postDeadlineExciseTax: postDeadlineExcise!.tax,
    }
    expect(observed).toEqual({
      postDeadlineRequiredAmount: accepted.postDeadlineRequiredAmount,
      postDeadlineExciseTax: accepted.postDeadlineExciseTax,
    })
    expect(observed).not.toEqual({
      postDeadlineRequiredAmount:
        readings.rejectedZeroObligationAfterEmptyingYear.postDeadlineRequiredAmount,
      postDeadlineExciseTax:
        readings.rejectedZeroObligationAfterEmptyingYear.postDeadlineExciseTax,
    })
    expect(postDeadlineExcise!.shortfall).toBeCloseTo(POST_DEADLINE_REMAINING_BALANCE, 12)
    expect(postDeadlineExcise!.reason).toBe('default25Percent')
    expect(postDeadlineYear.rmdShortfallExciseTax).toBeCloseTo(POST_DEADLINE_EXCISE_TAX, 12)
  })
})

describeRule('treas-reg-54-4974-1-g-2-edb-ten-year-election-automatic-waiver', {
  readings: {
    everyStatedConditionIsMet: 0,
    rejectedAutomaticWaiverWithoutOneCondition: 500,
  },
  accepted: 'everyStatedConditionIsMet',
  note: 'each independently modeled automatic-waiver condition',
}, ({ accepted, readings }) => {
  it('requires the EDB, default-life-expectancy, ninth-year-election, and Commissioner conditions', () => {
    const target = inheritedObligation()
    const valid = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      automaticWaiver: edbTenYearElectionWaiver(),
    })
    expect(valid.tax).toBe(accepted)
    expect(valid.reason).toBe('automaticEdbTenYearElectionWaiver')
  })

  const rejectedCases: readonly [string, Partial<EdbTenYearElectionWaiver>, Partial<RmdShortfallObligation>][] = [
    ['a death on or after the RBD', { ownerDiedBeforeRequiredBeginningDate: false }, {}],
    ['a non-EDB payee', { eligibleDesignatedBeneficiary: false }, {}],
    ['a non-default life-expectancy amount', { defaultLifeExpectancyApplied: false }, {}],
    ['an affirmative life-expectancy election', { affirmativeLifeExpectancyElectionMade: true }, {}],
    ['an election after the ninth calendar year', { electionMadeOn: '2034-01-01' }, {}],
    // Conservative reading of (g)(2): the regulation does not resolve whether a
    // shortfall in the election year itself is waived; the engine denies it
    // (taxYear >= electionYear), which can only raise the excise.
    ['a shortfall in the election year itself', {}, {
      obligationId: rmdShortfallObligationId(INHERITED_IRAS, 2033),
      distributionCalendarYear: 2033,
      taxYear: 2033,
      taxImposedOn: '2033-12-31',
    }],
    ['a final-sweep rather than annual life-expectancy requirement', {}, { requirementKind: 'inheritedFinalSweep' }],
    ['a Commissioner determination otherwise', { commissionerDeterminedOtherwise: true }, {}],
  ]
  it.each(rejectedCases)('rejects %s', (_label, waiverOverrides, obligationOverrides) => {
    const candidate = inheritedObligation(obligationOverrides)
    const result = computeRmdShortfallExcise(candidate, {
      obligationId: candidate.obligationId,
      automaticWaiver: edbTenYearElectionWaiver(waiverOverrides),
    })
    expect(result.tax).toBe(readings.rejectedAutomaticWaiverWithoutOneCondition)
    expect(result.reason).toBe('default25Percent')
  })
})

describeRule('treas-reg-54-4974-1-g-3-year-of-death-automatic-waiver', {
  readings: {
    everyStatedConditionIsMet: 0,
    rejectedAutomaticWaiverWithoutOneCondition: 500,
  },
  accepted: 'everyStatedConditionIsMet',
  note: 'same-year death, full correction, later-of deadline, and Commissioner conditions',
}, ({ accepted, readings }) => {
  it('requires each independently modeled year-of-death waiver condition', () => {
    const target = inheritedObligation({ requirementKind: 'inheritedYearOfDeath' })
    const valid = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      automaticWaiver: yearOfDeathWaiver(),
    })
    expect(valid.tax).toBe(accepted)
    expect(valid.reason).toBe('automaticYearOfDeathWaiver')
  })

  const rejectedCases: readonly [string, Partial<YearOfDeathWaiver>, Partial<RmdShortfallObligation>][] = [
    ['a requirement that is not for the year of death', {}, { requirementKind: 'inheritedAnnualLifeExpectancy' }],
    ['a death in a different calendar year', { ownerDeathYear: 2025 }, {}],
    ['a corrective distribution short of the full miss', {
      correctiveDistribution: { amount: 1_999.99, receivedOn: '2027-12-31', sourceApplicablePlan: INHERITED_IRAS },
    }, {}],
    ['a corrective distribution after the later automatic deadline', {
      correctiveDistribution: { amount: 2_000, receivedOn: '2028-01-01', sourceApplicablePlan: INHERITED_IRAS },
    }, {}],
    ['a corrective distribution from another applicable plan', {
      correctiveDistribution: { amount: 2_000, receivedOn: '2027-12-31', sourceApplicablePlan: EMPLOYER_PLAN },
    }, {}],
    ['a missing beneficiary return due date', {
      beneficiaryReturnDueDateIncludingExtensions: '',
    }, {}],
    ['a Commissioner determination otherwise', { commissionerDeterminedOtherwise: true }, {}],
  ]
  it.each(rejectedCases)('rejects %s', (_label, waiverOverrides, obligationOverrides) => {
    const candidate = inheritedObligation({
      requirementKind: 'inheritedYearOfDeath',
      ...obligationOverrides,
    })
    const result = computeRmdShortfallExcise(candidate, {
      obligationId: candidate.obligationId,
      automaticWaiver: yearOfDeathWaiver(waiverOverrides),
    })
    expect(result.tax).toBe(readings.rejectedAutomaticWaiverWithoutOneCondition)
    expect(result.reason).toBe('default25Percent')
  })

  it('waives when the beneficiary filing deadline is later than December 31 of the following year', () => {
    // Death year 2026 → following-year end is 2027-12-31. A 2028-10-15 filing
    // deadline makes laterDate pick the filing date, so a 2028-06-01 correction
    // still qualifies. An always-year-end+1 misreading would wrongly deny it.
    const target = inheritedObligation({ requirementKind: 'inheritedYearOfDeath' })
    const result = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      automaticWaiver: yearOfDeathWaiver({
        beneficiaryReturnDueDateIncludingExtensions: '2028-10-15',
        correctiveDistribution: {
          amount: 2_000,
          receivedOn: '2028-06-01',
          sourceApplicablePlan: INHERITED_IRAS,
        },
      }),
    })
    expect(result.tax).toBe(accepted)
    expect(result.reason).toBe('automaticYearOfDeathWaiver')
  })
})

describe('historical §4974 rate boundary', () => {
  it('uses the former 50 percent default and rejects the modern 10 percent path before 2023', () => {
    const historical = obligation({
      obligationId: rmdShortfallObligationId(OWNED_IRAS, 2022),
      distributionCalendarYear: 2022,
      taxYear: 2022,
      taxImposedOn: '2022-12-31',
    })
    const result = computeRmdShortfallExcise(historical, {
      ...corrected(),
      obligationId: historical.obligationId,
    })

    expect(result.tax).toBe(1_000)
    expect(result.rate).toBe(0.50)
    expect(result.reason).toBe('preSecure2Default50Percent')
  })
})

describe('final-regulation automatic waivers', () => {
  it('waives an EDB default-to-life-expectancy miss after a timely 10-year election', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('automaticEdbTenYearElectionWaiver')
  })

  it('does not apply the EDB election waiver after an owner dies on or after the RBD', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: false,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('does not back-port the final-regulation automatic waivers before 2025', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const inheritedObligation = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2024),
      distributionCalendarYear: 2024,
      taxYear: 2024,
      taxImposedOn: '2024-12-31',
      applicablePlan: inherited,
      requirementKind: 'inheritedAnnualLifeExpectancy',
    })
    const result = computeRmdShortfallExcise(inheritedObligation, {
      obligationId: inheritedObligation.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2022,
        electionMadeOn: '2024-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })
    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('waives a year-of-death miss corrected by the later automatic deadline', () => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const yod = obligation({
      obligationId: rmdShortfallObligationId(inherited, 2026),
      applicablePlan: inherited,
      requirementKind: 'inheritedYearOfDeath',
    })
    const result = computeRmdShortfallExcise(yod, {
      obligationId: yod.obligationId,
      automaticWaiver: {
        kind: 'yearOfDeath',
        ownerDeathYear: 2026,
        beneficiaryReturnDueDateIncludingExtensions: '2027-10-15',
        correctiveDistribution: {
          amount: 2_000,
          receivedOn: '2027-12-31',
          sourceApplicablePlan: inherited,
        },
      },
    })
    expect(result.tax).toBe(0)
    expect(result.reason).toBe('automaticYearOfDeathWaiver')
  })

  it.each([
    ['the election year itself', 2033, 'inheritedAnnualLifeExpectancy' as const],
    ['a later year', 2034, 'inheritedAnnualLifeExpectancy' as const],
    ['a final-sweep obligation', 2032, 'inheritedFinalSweep' as const],
    ['a year-of-death obligation', 2026, 'inheritedYearOfDeath' as const],
  ])('does not extend an EDB ten-year election waiver to %s', (_label, taxYear, requirementKind) => {
    const inherited: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(inherited, taxYear),
      distributionCalendarYear: taxYear,
      taxYear,
      taxImposedOn: `${taxYear}-12-31`,
      applicablePlan: inherited,
      requirementKind,
    })
    const result = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      automaticWaiver: {
        kind: 'edbTenYearElection',
        ownerDeathYear: 2024,
        electionMadeOn: '2033-12-31',
        ownerDiedBeforeRequiredBeginningDate: true,
        eligibleDesignatedBeneficiary: true,
        defaultLifeExpectancyApplied: true,
        affirmativeLifeExpectancyElectionMade: false,
      },
    })

    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })
})

describe('applicable-plan and evidence-key fail-closed checks', () => {
  it('allows inherited-IRA correction only from the same beneficiary/decedent group', () => {
    const targetPlan: RmdApplicablePlan = {
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-a',
      iraType: 'traditional',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(targetPlan, 2026),
      applicablePlan: targetPlan,
    })
    const relief = (sourceApplicablePlan: RmdApplicablePlan): RmdShortfallReliefElection => ({
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan,
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(computeRmdShortfallExcise(target, relief({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-a',
      iraType: 'traditional',
    })).tax).toBe(200)
    expect(computeRmdShortfallExcise(target, relief({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent-b',
      iraType: 'traditional',
    })).tax).toBe(500)
  })

  it('keeps an unidentified inherited IRA distinct from an explicit lookalike decedent id', () => {
    const accountOnly: RmdApplicablePlan = {
      kind: 'inheritedIraAccount',
      payeePersonId: 'beneficiary',
      accountId: 'ira-a',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(accountOnly, 2026),
      applicablePlan: accountOnly,
    })
    const result = computeRmdShortfallExcise(target, {
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan: {
          kind: 'inheritedIras',
          payeePersonId: 'beneficiary',
          decedentId: 'account:ira-a',
          iraType: 'traditional',
        },
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(result.tax).toBe(500)
    expect(result.reason).toBe('default25Percent')
  })

  it('aggregates 403(b) correction sources per payee but not across payees', () => {
    const targetPlan: RmdApplicablePlan = {
      kind: 'aggregable403bPlans',
      payeePersonId: 'owner',
    }
    const target = obligation({
      obligationId: rmdShortfallObligationId(targetPlan, 2026),
      applicablePlan: targetPlan,
    })
    const relief = (payeePersonId: string): RmdShortfallReliefElection => ({
      obligationId: target.obligationId,
      correctiveDistribution: {
        amount: 2_000,
        receivedOn: '2027-03-01',
        sourceApplicablePlan: { kind: 'aggregable403bPlans', payeePersonId },
        form5329FiledOn: '2027-04-15',
        returnReflectsReducedTax: true,
      },
    })

    expect(computeRmdShortfallExcise(target, relief('owner')).tax).toBe(200)
    expect(computeRmdShortfallExcise(target, relief('spouse')).tax).toBe(500)
  })

  it('ignores a waiver whose obligation id does not match the computed obligation', () => {
    expect(computeRmdShortfallExcise(obligation(), {
      obligationId: 'some-other-obligation',
      discretionaryWaiver: 'granted',
    }).tax).toBe(500)
  })
})
