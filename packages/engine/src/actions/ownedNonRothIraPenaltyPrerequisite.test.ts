import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsResult,
  type OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  type EvaluateOwnedNonRothIraPenaltyPrerequisitesInput,
  type OwnedNonRothIraPenaltySourceEvidence,
  type SimpleIraParticipationEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'

function characterization(options: {
  subtype?: OwnedNonRothIraSubtype
  taxYear?: number
  grossAmount?: number
  basisAmount?: number
  scheduledDate?: string
} = {}): Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsResult> {
  const subtype = options.subtype ?? 'traditional'
  const taxYear = options.taxYear ?? 2030
  const grossAmount = options.grossAmount ?? 100
  const basisAmount = options.basisAmount ?? 0
  const yearEndAmount = basisAmount === 0 ? 0 : grossAmount
  return classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear,
      accountIds: [asAccountId('ira-account')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEndAmount),
      evidenceId: 'complete-pool',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear,
    poolMembers: [{
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype,
      yearEndApplicableBalanceAmount: asUsdCents(yearEndAmount),
      iraClassificationEvidenceId: 'classification',
      accountOwnershipEvidenceId: 'ownership',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(basisAmount),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEndAmount),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(grossAmount),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: [{
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      scheduledDate: options.scheduledDate ?? `${taxYear}-06-01`,
      scheduledSequence: 1,
      grossAmount: asUsdCents(grossAmount),
    }],
    line8Conversions: [],
  })
}

function sourceEvidence(
  subtype: OwnedNonRothIraSubtype = 'traditional',
  evaluationDate = '2030-06-01',
): OwnedNonRothIraPenaltySourceEvidence {
  return {
    predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
    actionId: asActionId('action'),
    allocationId: asAllocationId('allocation'),
    sourceAccountId: asAccountId('ira-account'),
    ownerPersonId: asPersonId('owner'),
    subtype,
    evaluationDate,
    distributionDateEvidenceId: 'distribution-date',
    accountOwnershipEvidenceId: 'ownership',
    iraClassificationEvidenceId: 'classification',
  }
}

function simpleParticipation(
  participationStartDate = '2028-06-30',
): SimpleIraParticipationEvidence {
  return {
    predicate: 'simpleIraParticipationStartForPenaltyRate',
    sourceAccountId: asAccountId('ira-account'),
    ownerPersonId: asPersonId('owner'),
    participationStartDate,
    participationStartEvidenceId: 'simple-participation',
  }
}

function input(options: {
  subtype?: OwnedNonRothIraSubtype
  taxYear?: number
  grossAmount?: number
  basisAmount?: number
  birthDate?: string
  evaluationDate?: string
  participationStartDate?: string
} = {}): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const subtype = options.subtype ?? 'traditional'
  const taxYear = options.taxYear ?? 2030
  const evaluationDate = options.evaluationDate ?? `${taxYear}-06-01`
  const characterizationResult = characterization({
    subtype,
    taxYear,
    grossAmount: options.grossAmount,
    basisAmount: options.basisAmount,
    scheduledDate: evaluationDate,
  })
  const ordinaryIncome =
    characterizationResult.withdrawals[0]?.ordinaryIncomeAmount ?? 0
  const birthDate = options.birthDate ?? '1980-01-01'
  const requiresSimpleParticipation =
    subtype === 'simple' &&
    ordinaryIncome > 0 &&
    evaluationDate <
      // The fixture birth date reaches 59½ well after the tested tax years.
      '9999-01-01'
  return {
    characterization: characterizationResult,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate,
      evidenceId: 'birth-date',
    },
    sourceEvidence: [sourceEvidence(subtype, evaluationDate)],
    simpleParticipationEvidence: requiresSimpleParticipation
      ? [simpleParticipation(options.participationStartDate)]
      : [],
  }
}

function first(
  value: Readonly<ReturnType<
    typeof evaluateOwnedNonRothIraPenaltyPrerequisites
  >>,
) {
  const evaluation = value.evaluations[0]
  if (evaluation === undefined) throw new Error('fixture lost evaluation')
  return evaluation
}

function twoWithdrawalInput(
  reverseEvidence = false,
  residualBasis = false,
  sameAction = false,
): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const memberYearEndAmount = residualBasis ? 1 : 0
  const poolYearEndAmount = residualBasis ? 2 : 0
  const openingBasisAmount = residualBasis ? 2 : 0
  const firstGrossAmount = residualBasis ? 1 : 100
  const secondGrossAmount = residualBasis ? 1 : 50
  const annualGrossAmount = firstGrossAmount + secondGrossAmount
  const firstActionId = sameAction ? 'action-shared' : 'action-a'
  const secondActionId = sameAction ? 'action-shared' : 'action-b'
  const firstDate = '2030-01-01'
  const secondDate = sameAction ? firstDate : '2030-02-01'
  const characterizationResult =
    classifyOwnedNonRothIraAnnualWithdrawals({
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'two-source-pool',
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: asPersonId('owner'),
        ownerWideNonRothIraPoolId: 'two-source-pool',
        taxYear: 2030,
        accountIds: [asAccountId('ira-a'), asAccountId('ira-b')],
        yearEndApplicablePoolBalanceAmount: asUsdCents(poolYearEndAmount),
        evidenceId: 'complete-two-source-pool',
      },
      annualBasisRecordEvidenceId: 'two-source-basis-record',
      taxYear: 2030,
      poolMembers: [
        {
          sourceAccountId: asAccountId('ira-a'),
          ownerPersonId: asPersonId('owner'),
          accountType: 'traditional',
          accountKind: 'ira',
          inheritanceStatus: 'owned',
          subtype: 'traditional',
          yearEndApplicableBalanceAmount: asUsdCents(memberYearEndAmount),
          iraClassificationEvidenceId: 'classification-a',
          accountOwnershipEvidenceId: 'ownership-a',
        },
        {
          sourceAccountId: asAccountId('ira-b'),
          ownerPersonId: asPersonId('owner'),
          accountType: 'traditional',
          accountKind: 'ira',
          inheritanceStatus: 'owned',
          subtype: 'sep',
          yearEndApplicableBalanceAmount: asUsdCents(memberYearEndAmount),
          iraClassificationEvidenceId: 'classification-b',
          accountOwnershipEvidenceId: 'ownership-b',
        },
      ],
      annualFacts: {
        openingBasisAmount: asUsdCents(openingBasisAmount),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(poolYearEndAmount),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(annualGrossAmount),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [
        {
          actionId: asActionId(secondActionId),
          allocationId: asAllocationId('allocation-b'),
          sourceAccountId: asAccountId('ira-b'),
          scheduledDate: secondDate,
          scheduledSequence: 1,
          grossAmount: asUsdCents(secondGrossAmount),
        },
        {
          actionId: asActionId(firstActionId),
          allocationId: asAllocationId('allocation-a'),
          sourceAccountId: asAccountId('ira-a'),
          scheduledDate: firstDate,
          scheduledSequence: 1,
          grossAmount: asUsdCents(firstGrossAmount),
        },
      ],
      line8Conversions: [],
    })
  const evidence: OwnedNonRothIraPenaltySourceEvidence[] = [
    {
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId(firstActionId),
      allocationId: asAllocationId('allocation-a'),
      sourceAccountId: asAccountId('ira-a'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'traditional',
      evaluationDate: firstDate,
      distributionDateEvidenceId: sameAction ? 'date-shared' : 'date-a',
      accountOwnershipEvidenceId: 'ownership-a',
      iraClassificationEvidenceId: 'classification-a',
    },
    {
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId(secondActionId),
      allocationId: asAllocationId('allocation-b'),
      sourceAccountId: asAccountId('ira-b'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'sep',
      evaluationDate: secondDate,
      distributionDateEvidenceId: sameAction ? 'date-shared' : 'date-b',
      accountOwnershipEvidenceId: 'ownership-b',
      iraClassificationEvidenceId: 'classification-b',
    },
  ]
  return {
    characterization: characterizationResult,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: reverseEvidence ? evidence.reverse() : evidence,
    simpleParticipationEvidence: [],
  }
}

describe('evaluateOwnedNonRothIraPenaltyPrerequisites', () => {
  it('uses exactly 714 calendar months and accepts equality', () => {
    const before = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      taxYear: 2029,
      birthDate: '1970-01-31',
      evaluationDate: '2029-07-30',
    })))
    const equal = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      taxYear: 2029,
      birthDate: '1970-01-31',
      evaluationDate: '2029-07-31',
    })))
    const after = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      taxYear: 2029,
      birthDate: '1970-01-31',
      evaluationDate: '2029-08-01',
    })))

    expect(before.outcome).toBe('exceptionEvaluationRequired')
    expect(equal.outcome).toBe('age59HalfReached')
    expect(after.outcome).toBe('age59HalfReached')
  })

  it('uses civil leap/month-end clamping without JavaScript Date rollover', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      birthDate: '1970-08-31',
      evaluationDate: '2030-02-28',
    }))

    expect(result.ageThresholdEvidence).toMatchObject({
      birthDate: '1970-08-31',
      age59HalfDate: '2030-02-28',
      calculation: 'addCalendarMonths714WithMonthEndClamp',
    })
    expect(first(result).outcome).toBe('age59HalfReached')
  })

  it('cannot substitute a date across the age-59½ boundary', () => {
    const value = input({
      taxYear: 2029,
      birthDate: '1970-01-31',
      evaluationDate: '2029-07-31',
    })
    value.sourceEvidence = [{
      ...value.sourceEvidence[0]!,
      evaluationDate: '2029-07-30',
    }]

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/exactly match the dated annual line-7 allocation/)
  })

  it.each(['traditional', 'sep'] as const)(
    'uses a 10%% pre-exception candidate for %s IRAs',
    (subtype) => {
      const evaluation = first(
        evaluateOwnedNonRothIraPenaltyPrerequisites(input({
          subtype,
          grossAmount: 105,
        })),
      )

      expect(evaluation).toMatchObject({
        outcome: 'exceptionEvaluationRequired',
        evaluatedOrdinaryIncomeExposureAmount: 105,
        candidateAmountBeforeExceptions: 11,
        rateEvidence: {
          kind: 'traditionalOrSepStandardRate',
          subtype,
          numerator: 1,
          denominator: 10,
          quantization: 'nearestCentHalfUp',
          intermediateArithmetic: 'bigintRational',
        },
      })
      expect(evaluation).not.toHaveProperty('penaltyApplies')
      expect(evaluation).not.toHaveProperty('readiness')
      expect(evaluation).not.toHaveProperty('finalPenaltyAmount')
    },
  )

  it('uses 25% strictly before the SIMPLE two-year end and 10% at/after it', () => {
    const before = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 100,
      evaluationDate: '2030-06-29',
    })))
    const equal = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 100,
      evaluationDate: '2030-06-30',
    })))
    const after = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 100,
      evaluationDate: '2030-07-01',
    })))

    expect(before).toMatchObject({
      candidateAmountBeforeExceptions: 25,
      rateEvidence: {
        phase: 'initialTwoYearPeriod',
        denominator: 4,
        participationStartDate: '2028-06-30',
        initialTwoYearPeriodEndDate: '2030-06-30',
      },
    })
    expect(equal).toMatchObject({
      candidateAmountBeforeExceptions: 10,
      rateEvidence: {
        phase: 'standardAfterTwoYearPeriod',
        denominator: 10,
      },
    })
    expect(after).toMatchObject({
      candidateAmountBeforeExceptions: 10,
      rateEvidence: {
        phase: 'standardAfterTwoYearPeriod',
        denominator: 10,
      },
    })
  })

  it('cannot substitute a date across the SIMPLE two-year boundary', () => {
    const value = input({
      subtype: 'simple',
      grossAmount: 100,
      evaluationDate: '2030-06-30',
    })
    value.sourceEvidence = [{
      ...value.sourceEvidence[0]!,
      evaluationDate: '2030-06-29',
    }]

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/exactly match the dated annual line-7 allocation/)
  })

  it('rejects an undated annual line-7 allocation', () => {
    const value = structuredClone(input())
    Object.assign(
      value.characterization.line7AllocationEvidence.allocations[0]!,
      { scheduledDate: null },
    )

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/canonical rederived result/)
  })

  it('applies month-end clamp to the SIMPLE 24-month boundary', () => {
    const result = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      evaluationDate: '2030-02-28',
      participationStartDate: '2028-02-29',
    })))

    expect(result).toMatchObject({
      rateEvidence: {
        initialTwoYearPeriodEndDate: '2030-02-28',
        phase: 'standardAfterTwoYearPeriod',
        denominator: 10,
      },
    })
  })

  it('exposes only ordinary income and explicitly excludes basis return', () => {
    const evaluation = first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        grossAmount: 200,
        basisAmount: 200,
      })),
    )

    expect(evaluation).toMatchObject({
      outcome: 'exceptionEvaluationRequired',
      evaluatedOrdinaryIncomeExposureAmount: 100,
      candidateAmountBeforeExceptions: 10,
      characterCoverage: {
        executedAmount: 200,
        basisReturnExcludedAmount: 100,
        ordinaryIncomeExposureAmount: 100,
      },
    })
  })

  it('rounds exact rational candidates to cents half up, including below ties', () => {
    const belowTen = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      grossAmount: 4,
    })))
    const tieTen = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      grossAmount: 5,
    })))
    const belowQuarter = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 1,
      evaluationDate: '2030-06-29',
    })))
    const tieQuarter = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 2,
      evaluationDate: '2030-06-29',
    })))

    expect(belowTen).toMatchObject({ candidateAmountBeforeExceptions: 0 })
    expect(tieTen).toMatchObject({ candidateAmountBeforeExceptions: 1 })
    expect(belowQuarter).toMatchObject({ candidateAmountBeforeExceptions: 0 })
    expect(tieQuarter).toMatchObject({ candidateAmountBeforeExceptions: 1 })
  })

  it('keeps large products in bigint through quantization', () => {
    const evaluation = first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        grossAmount: Number.MAX_SAFE_INTEGER,
      })),
    )

    expect(evaluation).toMatchObject({
      evaluatedOrdinaryIncomeExposureAmount: Number.MAX_SAFE_INTEGER,
      candidateAmountBeforeExceptions: 900_719_925_474_099,
    })
  })

  it('emits final zero penalty after 59½ with exact exposure coverage', () => {
    const evaluation = first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        birthDate: '1950-01-01',
        grossAmount: 123,
      })),
    )

    expect(evaluation).toMatchObject({
      outcome: 'age59HalfReached',
      evaluatedOrdinaryIncomeExposureAmount: 123,
      finalPenaltyAmount: 0,
      characterCoverage: {
        ordinaryIncomeExposureAmount: 123,
      },
    })
    expect(evaluation).not.toHaveProperty('candidateAmountBeforeExceptions')
  })

  it('emits coverage but no penalty record or candidate for zero ordinary income', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      grossAmount: 100,
      basisAmount: 10_000,
    }))

    expect(result.evaluations).toEqual([])
    expect(result.coverage[0]).toMatchObject({
      basisReturnExcludedAmount: 100,
      ordinaryIncomeExposureAmount: 0,
    })
    expect(result.coverage[0]).not.toHaveProperty(
      'candidateAmountBeforeExceptions',
    )
    expect(result.coverage[0]).not.toHaveProperty('finalPenaltyAmount')
  })

  it.each([
    ['malformed birth date', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.ownerEvidence = {
        ...value.ownerEvidence,
        birthDate: '2030-02-30',
      }
    }],
    ['out-of-year evaluation date', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [{ ...value.sourceEvidence[0]!, evaluationDate: '2029-12-31' }]
    }],
    ['foreign owner', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [{
        ...value.sourceEvidence[0]!,
        ownerPersonId: asPersonId('foreign'),
      }]
    }],
    ['foreign source', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [{
        ...value.sourceEvidence[0]!,
        sourceAccountId: asAccountId('foreign'),
      }]
    }],
    ['mismatched ownership evidence', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [{
        ...value.sourceEvidence[0]!,
        accountOwnershipEvidenceId: 'other',
      }]
    }],
    ['blank date evidence', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [{
        ...value.sourceEvidence[0]!,
        distributionDateEvidenceId: ' ',
      }]
    }],
    ['duplicate source evidence', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = [value.sourceEvidence[0]!, value.sourceEvidence[0]!]
    }],
    ['missing source evidence', (value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput) => {
      value.sourceEvidence = []
    }],
  ])('fails closed for %s', (_label, mutate) => {
    const value = input()
    mutate(value)
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow()
  })

  it('rejects missing, duplicate, foreign, and malformed SIMPLE evidence', () => {
    const missing = input({ subtype: 'simple' })
    missing.simpleParticipationEvidence = []
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(missing),
    ).toThrow(/missing/)

    const duplicate = input({ subtype: 'simple' })
    duplicate.simpleParticipationEvidence = [
      duplicate.simpleParticipationEvidence[0]!,
      duplicate.simpleParticipationEvidence[0]!,
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(duplicate),
    ).toThrow(/exactly cover/)

    const foreign = input()
    foreign.simpleParticipationEvidence = [simpleParticipation()]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(foreign),
    ).toThrow(/exactly cover/)

    const malformed = input({ subtype: 'simple' })
    malformed.simpleParticipationEvidence = [{
      ...malformed.simpleParticipationEvidence[0]!,
      participationStartDate: '2028-13-01',
    }]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(malformed),
    ).toThrow(/canonical/)
  })

  it('rejects missing, duplicated, malformed, or foreign character segments', () => {
    const missing = structuredClone(input())
    Object.assign(missing.characterization.withdrawals[0]!, {
      taxCharacter: [],
    })
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(missing),
    ).toThrow(/canonical rederived result/)

    const duplicated = structuredClone(input())
    Object.assign(duplicated.characterization.withdrawals[0]!, {
      taxCharacter: [
        duplicated.characterization.withdrawals[0]!.taxCharacter[0]!,
        duplicated.characterization.withdrawals[0]!.taxCharacter[0]!,
      ],
    })
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(duplicated),
    ).toThrow(/canonical rederived result/)

    const malformed = structuredClone(input())
    Object.assign(
      malformed.characterization.withdrawals[0]!.taxCharacter[0]!
        .characterEvidence,
      { segmentAmount: asUsdCents(99) },
    )
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(malformed),
    ).toThrow(/canonical rederived result/)

    const foreign = structuredClone(input())
    Object.assign(
      foreign.characterization.withdrawals[0]!.taxCharacter[0]!
        .characterEvidence,
      { allocationEvidenceId: 'foreign' },
    )
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(foreign),
    ).toThrow(/canonical rederived result/)
  })

  it('rejects synchronized erasure of nonzero line-7 activity', () => {
    const value = structuredClone(input())
    Object.assign(value.characterization.line7AllocationEvidence, {
      annualGrossAmount: asUsdCents(0),
      annualNontaxableBasisAmount: asUsdCents(0),
      annualTaxableAmount: asUsdCents(0),
      allocations: [],
    })
    Object.assign(value.characterization, { withdrawals: [] })

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow()
  })

  it('rejects synchronized taxable-to-basis reclassification', () => {
    const value = structuredClone(input({
      grossAmount: 200,
      basisAmount: 200,
    }))
    const allocation =
      value.characterization.line7AllocationEvidence.allocations[0]!
    const withdrawal = value.characterization.withdrawals[0]!
    const basisCharacter = withdrawal.taxCharacter.find(
      (segment) => segment.kind === 'basisReturn',
    )!
    const ordinaryCharacter = withdrawal.taxCharacter.find(
      (segment) => segment.kind === 'ordinaryIncome',
    )!
    Object.assign(value.characterization.line7AllocationEvidence, {
      annualNontaxableBasisAmount: asUsdCents(101),
      annualTaxableAmount: asUsdCents(99),
    })
    Object.assign(allocation, {
      allocatedBasisAmount: asUsdCents(101),
      taxableAmount: asUsdCents(99),
    })
    Object.assign(withdrawal, {
      basisRecoveredAmount: asUsdCents(101),
      ordinaryIncomeAmount: asUsdCents(99),
    })
    Object.assign(basisCharacter, { amount: asUsdCents(101) })
    Object.assign(basisCharacter.characterEvidence, {
      segmentAmount: asUsdCents(101),
    })
    Object.assign(ordinaryCharacter, { amount: asUsdCents(99) })
    Object.assign(ordinaryCharacter.characterEvidence, {
      segmentAmount: asUsdCents(99),
    })

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/canonical rederived result/)
  })

  it('rejects a synchronized residual-basis shift between allocations', () => {
    const value = structuredClone(twoWithdrawalInput(false, true))
    const allocations =
      value.characterization.line7AllocationEvidence.allocations
    const withdrawals = value.characterization.withdrawals
    const firstAllocation = allocations[0]!
    const secondAllocation = allocations[1]!
    const firstWithdrawal = withdrawals[0]!
    const secondWithdrawal = withdrawals[1]!
    const firstCharacter = firstWithdrawal.taxCharacter[0]!
    const secondCharacter = secondWithdrawal.taxCharacter[0]!

    Object.assign(firstAllocation, {
      allocatedBasisAmount: asUsdCents(0),
      taxableAmount: asUsdCents(1),
      residualCentAwarded: 0,
    })
    Object.assign(secondAllocation, {
      allocatedBasisAmount: asUsdCents(1),
      taxableAmount: asUsdCents(0),
      residualCentAwarded: 1,
    })
    Object.assign(firstWithdrawal, {
      basisRecoveredAmount: asUsdCents(0),
      ordinaryIncomeAmount: asUsdCents(1),
    })
    Object.assign(secondWithdrawal, {
      basisRecoveredAmount: asUsdCents(1),
      ordinaryIncomeAmount: asUsdCents(0),
    })
    Object.assign(firstCharacter, { kind: 'ordinaryIncome' })
    Object.assign(secondCharacter, { kind: 'basisReturn' })

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/canonical rederived result/)
  })

  it('allows one action date evidence ID across split IRA allocations', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(
      twoWithdrawalInput(false, false, true),
    )

    expect(result.evaluations).toHaveLength(2)
    expect(result.evaluations.map((evaluation) => evaluation.actionId)).toEqual([
      'action-shared',
      'action-shared',
    ])
    expect(
      result.coverage.map(
        (item) => item.sourceEvidenceIds.distributionDateEvidenceId,
      ),
    ).toEqual(['date-shared', 'date-shared'])
  })

  it('rejects distribution-date evidence ID reuse across actions', () => {
    const value = twoWithdrawalInput()
    value.sourceEvidence = [
      value.sourceEvidence[0]!,
      {
        ...value.sourceEvidence[1]!,
        distributionDateEvidenceId:
          value.sourceEvidence[0]!.distributionDateEvidenceId,
      },
    ]

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/reuse must bind one action and exact date/)
  })

  it('is deterministic, detached from inputs, and deeply frozen', () => {
    const mutableInput = input({ subtype: 'simple' })
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(mutableInput)
    const canonical =
      evaluateOwnedNonRothIraPenaltyPrerequisites(twoWithdrawalInput())
    const permuted =
      evaluateOwnedNonRothIraPenaltyPrerequisites(twoWithdrawalInput(true))

    expect(permuted).toEqual(canonical)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evaluations)).toBe(true)
    expect(Object.isFrozen(first(result).characterCoverage)).toBe(true)
    const originalEvidenceId = first(result).characterCoverage.evidenceId
    Object.assign(mutableInput.sourceEvidence[0]!, {
      distributionDateEvidenceId: 'mutated',
    })
    expect(first(result).characterCoverage.evidenceId).toBe(originalEvidenceId)
    expect(
      first(result).characterCoverage.sourceEvidenceIds
        .distributionDateEvidenceId,
    ).toBe('distribution-date')
  })
})
