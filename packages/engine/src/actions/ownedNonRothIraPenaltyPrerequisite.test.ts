import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { classifyTraditionalEmployerPlanWithdrawal } from './traditionalEmployerPlanWithdrawalCharacter.js'
import { evaluateTraditionalEmployerPlanPenaltyPrerequisite } from './traditionalEmployerPlanPenaltyPrerequisite.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsResult,
  type OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  type EvaluateOwnedNonRothIraPenaltyPrerequisitesInput,
  type NoOtherStatutoryExceptionClaimedAttestation,
  type OwnedNonRothIraNoSeppStatusEvidence,
  type OwnedNonRothIraOwnerAliveEvidence,
  type OwnedNonRothIraPenaltySourceEvidence,
  type QualifiedDisabilityEventEvidence,
  type RejectedDisabilityStatusEvidence,
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

function qualifiedDisability(
  evaluationDate = '2030-06-01',
  disabilityQualificationDate = '2030-06-01',
  disabilityEvidenceId = 'disability-record',
): QualifiedDisabilityEventEvidence {
  return {
    kind: 'disability',
    disabledPersonId: asPersonId('owner'),
    disabilityQualificationDate,
    evaluationDate,
    qualifiedOnEvaluationDate: true,
    disabilityEvidenceId,
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
  disabilityQualificationDate?: string
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
    qualifiedDisabilityEvidence:
      options.disabilityQualificationDate === undefined
        ? []
        : [qualifiedDisability(
            evaluationDate,
            options.disabilityQualificationDate,
          )],
    simpleParticipationEvidence: requiresSimpleParticipation
      && options.disabilityQualificationDate === undefined
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

function completeNegativeEvidence(
  value: EvaluateOwnedNonRothIraPenaltyPrerequisitesInput,
): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const taxableUnderAgeSources = value.sourceEvidence.filter((source) => {
    const withdrawal = value.characterization.withdrawals.find(
      (item) =>
        item.actionId === source.actionId &&
        item.allocationId === source.allocationId,
    )
    return (
      withdrawal !== undefined &&
      withdrawal.ordinaryIncomeAmount > 0 &&
      !value.qualifiedDisabilityEvidence?.some(
        (event) => event.evaluationDate === source.evaluationDate,
      )
    )
  })
  const ownerAliveEvidence: OwnedNonRothIraOwnerAliveEvidence[] =
    taxableUnderAgeSources.map((source) => ({
      predicate: 'ownerAliveOnOwnedIraDistributionDate',
      actionId: source.actionId,
      allocationId: source.allocationId,
      sourceAccountId: source.sourceAccountId,
      ownerPersonId: source.ownerPersonId,
      evaluationDate: source.evaluationDate,
      distributionDateEvidenceId: source.distributionDateEvidenceId,
      aliveOnEvaluationDate: true,
      ownerAliveEvidenceId:
        `owner-alive-${source.actionId}-${source.allocationId}`,
    }))
  const iraSeppStatusEvidence: OwnedNonRothIraNoSeppStatusEvidence[] =
    taxableUnderAgeSources.map((source) => ({
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId: source.actionId,
      allocationId: source.allocationId,
      sourceAccountId: source.sourceAccountId,
      ownerPersonId: source.ownerPersonId,
      evaluationDate: source.evaluationDate,
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId:
        `no-sepp-${source.actionId}-${source.allocationId}`,
    }))
  const noOtherExceptionAttestations:
    NoOtherStatutoryExceptionClaimedAttestation[] =
      taxableUnderAgeSources.map((source) => ({
        predicate: 'noOtherStatutoryExceptionClaimed',
        actionId: source.actionId,
        allocationId: source.allocationId,
        sourceAccountId: source.sourceAccountId,
        ownerPersonId: source.ownerPersonId,
        evaluationDate: source.evaluationDate,
        attested: true,
        evidenceScope:
          'planningEvidenceNotFilingGradeLegalAdjudication',
        attestationEvidenceId:
          `no-other-${source.actionId}-${source.allocationId}`,
      }))
  const rejectedDisabilityEvidence:
    RejectedDisabilityStatusEvidence[] = [
      ...new Set(
        taxableUnderAgeSources.map((source) => source.evaluationDate),
      ),
    ].map((evaluationDate) => ({
      kind: 'disability',
      disabledPersonId: asPersonId('owner'),
      disabilityQualificationDate: null,
      evaluationDate,
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId: `rejected-disability-${evaluationDate}`,
    }))
  return {
    ...value,
    ownerAliveEvidence,
    rejectedDisabilityEvidence,
    iraSeppStatusEvidence,
    noOtherExceptionAttestations,
  }
}

function employerIncludiblePortionPenaltyInput() {
  const actionId = asActionId('employer-rate-withdrawal')
  const allocationId = asAllocationId('employer-rate-allocation')
  const sourceAccountId = asAccountId('employer-rate-plan')
  const participantPersonId = asPersonId('employer-rate-participant')
  const evaluationDate = '2030-06-15'
  const separationDate = '2029-12-31'
  const character = classifyTraditionalEmployerPlanWithdrawal({
    actionId,
    allocationId,
    sourceAccountId,
    participantPersonId,
    evaluationDate,
    executedAmount: asUsdCents(100),
    availabilityEvidence: {
      predicate: 'employerDistributionEligibility',
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      availabilityEvidence: {
        kind: 'distributableEvent',
        eventKind: 'separationFromService',
        eventDate: separationDate,
        planTermsEvidenceId: 'employer-rate-plan-terms',
        availableOnEvaluationDate: true,
      },
    },
    basisSnapshot: {
      predicate: 'traditionalEmployerPlanBasisSnapshot',
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      preDistributionAccountValue: asPositiveUsdCents(100),
      afterTaxEmployeeBasisBeforeDistribution: asUsdCents(50),
      basisEvidenceId: 'employer-rate-basis-evidence',
    },
  })
  if (character.status !== 'accepted') {
    throw new Error('employer includible-portion fixture character must be accepted')
  }
  return {
    actionId,
    allocationId,
    sourceAccountId,
    participantPersonId,
    evaluationDate,
    characterization: character,
    taxableTreatmentAmount: asUsdCents(
      character.acceptedSourceEligibility.basisEvidence.ordinaryIncomeAmount,
    ),
    participantEvidence: {
      predicate: 'employerPlanParticipantBirthDateForPenalty' as const,
      participantPersonId,
      birthDate: '1975-06-15',
      birthDateEvidenceId: 'employer-rate-birth-record',
    },
    separationEvidence: {
      predicate: 'sponsoringEmployerSeparationForPenalty' as const,
      sourceAccountId,
      participantPersonId,
      separationDate,
      authoritative: true as const,
      separationEvidenceId: 'employer-rate-separation-record',
    },
    disabilityEvidence: {
      kind: 'disability' as const,
      disabledPersonId: participantPersonId,
      disabilityQualificationDate: null,
      evaluationDate,
      qualifiedOnEvaluationDate: false as const,
      disabilityEvidenceId: 'employer-rate-not-disabled',
    },
    seppEvidence: {
      predicate: 'employerPlanSeppStatusForWithdrawal' as const,
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      status: 'none' as const,
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'employer-rate-no-sepp',
    },
    otherExceptionAttestation: {
      predicate: 'otherEmployerPlanPenaltyExceptionAttestation' as const,
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      otherExceptionClaimed: false,
      exceptionDescription: null,
      evidenceScope: 'planningEvidenceNotFilingGradeLegalAdjudication' as const,
      attestationEvidenceId: 'employer-rate-other-exception-attestation',
    },
  }
}

function twoWithdrawalInput(
  reverseEvidence = false,
  residualBasis = false,
  sameAction = false,
  options: Readonly<{
    firstGrossAmount?: number
    secondGrossAmount?: number
    secondSubtype?: 'sep' | 'simple'
  }> = {},
): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const memberYearEndAmount = residualBasis ? 1 : 0
  const poolYearEndAmount = residualBasis ? 2 : 0
  const openingBasisAmount = residualBasis ? 2 : 0
  const firstGrossAmount =
    residualBasis ? 1 : (options.firstGrossAmount ?? 100)
  const secondGrossAmount =
    residualBasis ? 1 : (options.secondGrossAmount ?? 50)
  const secondSubtype = options.secondSubtype ?? 'sep'
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
          subtype: secondSubtype,
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
      subtype: secondSubtype,
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
    qualifiedDisabilityEvidence: [],
    simpleParticipationEvidence: secondSubtype === 'simple'
      ? [{
          predicate: 'simpleIraParticipationStartForPenaltyRate',
          sourceAccountId: asAccountId('ira-b'),
          ownerPersonId: asPersonId('owner'),
          participationStartDate: '2029-01-01',
          participationStartEvidenceId: 'simple-participation-b',
        }]
      : [],
  }
}

describe('evaluateOwnedNonRothIraPenaltyPrerequisites', () => {
  // IRC 72(t)(2)(A)(i) is inclusive: "made on or after the date on which the
  // employee attains age 59 1/2". A distribution exactly on the threshold
  // qualifies. Reading it as strictly after - the drafting 223(f)(4)(C) uses -
  // would leave that same distribution penalised.
  describeRule('irc-72-t-2-A-i-age-59-half', {
    readings: {
      inclusiveOnOrAfter: 'age59HalfReached',
      exclusiveStrictlyAfter: 'exceptionEvaluationRequired',
    },
    accepted: 'inclusiveOnOrAfter',
  }, ({ accepted, readings }) => {
    it('accepts a distribution taken exactly on the 59.5 threshold', () => {
      const equal = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        taxYear: 2029, birthDate: '1970-01-31', evaluationDate: '2029-07-31',
      })))
      expect(equal.outcome).toBe(accepted)
      expect(equal.outcome).not.toBe(readings.exclusiveStrictlyAfter)
      // The day before is still under, which is what makes the equality case
      // load-bearing rather than incidental.
      const before = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        taxYear: 2029, birthDate: '1970-01-31', evaluationDate: '2029-07-30',
      })))
      expect(before.outcome).toBe(readings.exclusiveStrictlyAfter)
    })
  })

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

  // IRC 72(t)(2)(A)(iii) removes the ADDITIONAL tax and nothing else. The
  // distribution stays ordinary income -- 72(t)(1) is a tax "in addition to"
  // the income tax, so switching it off cannot reach the inclusion. Reading the
  // exception as making the distribution tax-free would zero the income too.
  describeRule('irc-72-t-2-A-iii-disability-exception', {
    readings: { additionalTaxWaivedIncomeKept: 100, bothWaived: 0 },
    accepted: 'additionalTaxWaivedIncomeKept',
  }, ({ accepted, readings }) => {
    it('keeps the distribution in income while waiving the additional tax', () => {
      const evaluation = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        disabilityQualificationDate: '2030-05-31',
      })))

      expect(evaluation).toMatchObject({
        outcome: 'disabilityQualified',
        evaluatedOrdinaryIncomeExposureAmount: accepted,
        finalPenaltyAmount: 0,
      })
      expect(evaluation).not.toMatchObject({
        evaluatedOrdinaryIncomeExposureAmount: readings.bothWaived,
      })
    })
  })

  it('qualifies disability effective before or exactly on the distribution date', () => {
    const before = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      disabilityQualificationDate: '2030-05-31',
    })))
    const equal = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      disabilityQualificationDate: '2030-06-01',
    })))

    for (const evaluation of [before, equal]) {
      expect(evaluation).toMatchObject({
        outcome: 'disabilityQualified',
        evaluatedOrdinaryIncomeExposureAmount: 100,
        finalPenaltyAmount: 0,
        disabilityEvent: {
          kind: 'disability',
          disabledPersonId: 'owner',
          evaluationDate: '2030-06-01',
          qualifiedOnEvaluationDate: true,
          disabilityEvidenceId: 'disability-record',
        },
      })
      expect(evaluation).not.toHaveProperty('candidateAmountBeforeExceptions')
      expect(evaluation).not.toHaveProperty('rateEvidence')
    }
  })

  it('keeps an under-age distribution unresolved when disability evidence is absent', () => {
    expect(first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(input()),
    ).outcome).toBe('exceptionEvaluationRequired')

    const legacyCompatibleInput = input()
    delete legacyCompatibleInput.qualifiedDisabilityEvidence
    expect(first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(legacyCompatibleInput),
    ).outcome).toBe('exceptionEvaluationRequired')
  })

  it('does not require SIMPLE participation or construct a rate for qualified disability', () => {
    const value = input({
      subtype: 'simple',
      disabilityQualificationDate: '2029-12-31',
    })
    value.simpleParticipationEvidence = []

    const evaluation = first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    )

    expect(evaluation).toMatchObject({
      outcome: 'disabilityQualified',
      finalPenaltyAmount: 0,
    })
    expect(evaluation).not.toHaveProperty('rateEvidence')
    expect(evaluation).not.toHaveProperty('candidateAmountBeforeExceptions')
  })

  it('qualifies only the matching date and retains a rate candidate for another date', () => {
    const value = twoWithdrawalInput()
    value.qualifiedDisabilityEvidence = [
      qualifiedDisability('2030-01-01', '2029-12-31'),
    ]

    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(value)

    expect(result.evaluations.map((evaluation) => evaluation.outcome)).toEqual([
      'disabilityQualified',
      'exceptionEvaluationRequired',
    ])
    expect(result.evaluations[1]).toMatchObject({
      actionId: 'action-b',
      candidateAmountBeforeExceptions: 5,
      rateEvidence: {
        kind: 'traditionalOrSepStandardRate',
        subtype: 'sep',
      },
    })
  })

  it('applies one dated disability event across split same-date allocations', () => {
    const value = twoWithdrawalInput(false, false, true)
    value.qualifiedDisabilityEvidence = [
      qualifiedDisability('2030-01-01', '2030-01-01'),
    ]

    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(value)

    expect(result.evaluations).toHaveLength(2)
    expect(result.evaluations.every(
      (evaluation) => evaluation.outcome === 'disabilityQualified',
    )).toBe(true)
    expect(result.evaluations.map((evaluation) =>
      evaluation.outcome === 'disabilityQualified'
        ? evaluation.disabilityEvent.disabilityEvidenceId
        : null,
    )).toEqual(['disability-record', 'disability-record'])
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

  describeRule('irc-72-t-6-simple-two-year-rate', {
    // A SIMPLE distribution inside the two-year window, taken by someone a
    // 72(t)(2) exception reaches. IRC 72(t)(6) substitutes 25% for 10% *in
    // paragraph (1)*, so the exception still applies and zeroes the tax
    // entirely. Reading the window as an independent penalty gate ahead of the
    // exceptions would instead assess 25% of the 100c distribution.
    readings: { rateSubstitutionExceptionsApplyFirst: 0, independentPenaltyGate: 25 },
    accepted: 'rateSubstitutionExceptionsApplyFirst',
  }, ({ accepted, readings }) => {
    it('lets a 72(t)(2) exception zero the tax inside the two-year window', () => {
      // The engine does not even collect SIMPLE participation facts on this
      // path, which is itself the rate-substitution design: the window is only
      // consulted once an exception has failed to reach the distribution.
      const evaluation = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        subtype: 'simple',
        grossAmount: 100,
        evaluationDate: '2030-06-29',
        disabilityQualificationDate: '2029-01-01',
      })))
      expect(evaluation.outcome).toBe('disabilityQualified')
      if (evaluation.outcome !== 'disabilityQualified') return
      expect(evaluation.finalPenaltyAmount).toBe(accepted)
      expect(evaluation.finalPenaltyAmount).not.toBe(readings.independentPenaltyGate)
    })

    it('applies 25 percent only where no exception reaches the distribution', () => {
      const evaluation = first(evaluateOwnedNonRothIraPenaltyPrerequisites(input({
        subtype: 'simple', grossAmount: 100, evaluationDate: '2030-06-29',
      })))
      expect(evaluation).toMatchObject({
        candidateAmountBeforeExceptions: readings.independentPenaltyGate,
        rateEvidence: { phase: 'initialTwoYearPeriod', denominator: 4 },
      })
    })
  })

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

  it('rejects malformed, foreign, late, duplicate, and irrelevant disability evidence', () => {
    const malformed = input()
    malformed.qualifiedDisabilityEvidence = [{
      ...qualifiedDisability(),
      disabilityQualificationDate: '2030-02-30',
    }]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(malformed),
    ).toThrow(/canonical/)

    const notPositive = input({
      disabilityQualificationDate: '2030-05-01',
    })
    Object.assign(notPositive.qualifiedDisabilityEvidence![0]!, {
      qualifiedOnEvaluationDate: false,
    })
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(notPositive),
    ).toThrow(/positively qualify/)

    const foreign = input()
    foreign.qualifiedDisabilityEvidence = [{
      ...qualifiedDisability(),
      disabledPersonId: asPersonId('foreign'),
    }]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(foreign),
    ).toThrow(/characterized owner/)

    const late = input()
    late.qualifiedDisabilityEvidence = [
      qualifiedDisability('2030-06-01', '2030-06-02'),
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(late),
    ).toThrow(/cannot follow/)

    const beforeBirth = input()
    beforeBirth.qualifiedDisabilityEvidence = [
      qualifiedDisability('2030-06-01', '1979-12-31'),
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(beforeBirth),
    ).toThrow(/cannot precede/)

    const blankEvidenceId = input()
    blankEvidenceId.qualifiedDisabilityEvidence = [{
      ...qualifiedDisability(),
      disabilityEvidenceId: ' ',
    }]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(blankEvidenceId),
    ).toThrow(/nonblank/)

    const duplicate = input()
    duplicate.qualifiedDisabilityEvidence = [
      qualifiedDisability(),
      qualifiedDisability(),
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(duplicate),
    ).toThrow(/uniquely match/)

    const sharedRecord = twoWithdrawalInput()
    sharedRecord.qualifiedDisabilityEvidence = [
      qualifiedDisability(
        '2030-01-01',
        '2029-12-31',
        'disability-record-january',
      ),
      qualifiedDisability(
        '2030-02-01',
        '2029-12-31',
        'disability-record-february',
      ),
    ]
    expect(
      evaluateOwnedNonRothIraPenaltyPrerequisites(sharedRecord)
        .evaluations
        .map((evaluation) => evaluation.outcome),
    ).toEqual(['disabilityQualified', 'disabilityQualified'])

    const conflictingReuse = twoWithdrawalInput()
    conflictingReuse.qualifiedDisabilityEvidence = [
      qualifiedDisability('2030-01-01', '2029-12-31'),
      qualifiedDisability('2030-02-01', '2029-12-31'),
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(conflictingReuse),
    ).toThrow(/exact same dated event/)

    const ageQualified = input({ birthDate: '1950-01-01' })
    ageQualified.qualifiedDisabilityEvidence = [qualifiedDisability()]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(ageQualified),
    ).toThrow(/under-age positive ordinary-income/)

    const basisOnly = input({ grossAmount: 100, basisAmount: 10_000 })
    basisOnly.qualifiedDisabilityEvidence = [qualifiedDisability()]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(basisOnly),
    ).toThrow(/under-age positive ordinary-income/)
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

    const beforeBirth = input({
      subtype: 'simple',
      participationStartDate: '1979-12-31',
    })
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(beforeBirth),
    ).toThrow(/cannot precede the owner birth date/)
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
    const mutableInput = input({
      subtype: 'simple',
      disabilityQualificationDate: '2030-05-01',
    })
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(mutableInput)
    const canonical =
      evaluateOwnedNonRothIraPenaltyPrerequisites(twoWithdrawalInput())
    const permuted =
      evaluateOwnedNonRothIraPenaltyPrerequisites(twoWithdrawalInput(true))

    expect(permuted).toEqual(canonical)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evaluations)).toBe(true)
    expect(Object.isFrozen(first(result).characterCoverage)).toBe(true)
    const disabilityEvaluation = first(result)
    expect(Object.isFrozen(
      disabilityEvaluation.outcome === 'disabilityQualified'
        ? disabilityEvaluation.disabilityEvent
        : null,
    )).toBe(true)
    const originalEvidenceId = first(result).characterCoverage.evidenceId
    Object.assign(mutableInput.sourceEvidence[0]!, {
      distributionDateEvidenceId: 'mutated',
    })
    Object.assign(mutableInput.qualifiedDisabilityEvidence![0]!, {
      disabilityEvidenceId: 'mutated',
    })
    expect(first(result).characterCoverage.evidenceId).toBe(originalEvidenceId)
    expect(
      first(result).characterCoverage.sourceEvidenceIds
        .distributionDateEvidenceId,
    ).toBe('distribution-date')
    expect(
      disabilityEvaluation.outcome === 'disabilityQualified'
        ? disabilityEvaluation.disabilityEvent.disabilityEvidenceId
        : null,
    ).toBe('disability-record')
  })

  // IRC 72(t)(1) increases the tax by 10 percent of "the portion of such amount
  // which is includible in gross income" -- not of the amount distributed.
  //
  // The expected value comes from the rule, not from running the code. A 100
  // distribution against 100 of opening basis has a section 408(d)(2)
  // denominator of 100 year-end plus 100 line-7 = 200, so the nontaxable
  // fraction is 100/200 and half the distribution comes back as basis. The
  // includible half is 50, and 10 percent of that is 5. Charging the gross
  // instead would be 10 -- double. The employer arm uses accepted section-72
  // character on the same 100/50 gross/basis split rather than the Form 8606 pool.
  describeRule('irc-72-t-1-additional-tax-on-includible-portion', {
    readings: {
      tenPercentOfIncludible: [5, 5],
      tenPercentOfGross: [10, 10],
    },
    accepted: 'tenPercentOfIncludible',
  }, ({ accepted, readings }) => {
    it('charges the additional tax on the taxable half of a basis-bearing distribution', () => {
      const employerResult = evaluateTraditionalEmployerPlanPenaltyPrerequisite(
        employerIncludiblePortionPenaltyInput(),
      )
      const iraResult = evaluateOwnedNonRothIraPenaltyPrerequisites(
        completeNegativeEvidence(input({ basisAmount: 100 })),
      )
      const iraEvaluation = first(iraResult)

      expect(employerResult.status).toBe('accepted')
      if (employerResult.status !== 'accepted') return
      expect(employerResult.evidence.outcome).toBe('penaltyApplies')
      expect(employerResult.evidence.characterCoverage).toMatchObject({
        executedAmount: 100,
        basisReturnExcludedAmount: 50,
        taxableTreatmentAmount: 50,
      })

      expect(iraEvaluation).toMatchObject({
        outcome: 'penaltyApplies',
        evaluatedOrdinaryIncomeExposureAmount: 50,
      })
      if (iraEvaluation.outcome !== 'penaltyApplies') return

      const actual = [
        iraEvaluation.finalPenaltyAmount,
        employerResult.evidence.finalPenaltyAmount,
      ]
      expect(actual).toEqual(accepted)
      expect(actual).not.toEqual(readings.tenPercentOfGross)
    })
  })

  it('publishes a fixed age/death/SEPP/disability/other rejection tuple before applying the penalty', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(
      completeNegativeEvidence(input()),
    )

    expect(first(result)).toMatchObject({
      outcome: 'penaltyApplies',
      evaluatedOrdinaryIncomeExposureAmount: 100,
      candidateAmountBeforeExceptions: 10,
      finalPenaltyAmount: 10,
      rejectedExceptions: [
        { exception: 'age59Half', disposition: 'rejected' },
        {
          exception: 'death',
          disposition: 'rejected',
          ownerAliveEvidence: {
            aliveOnEvaluationDate: true,
            distributionDateEvidenceId: 'distribution-date',
          },
        },
        {
          exception: 'iraSepp',
          disposition: 'rejected',
          noSeppEvidence: {
            status: 'none',
            electionId: null,
            scheduleId: null,
          },
        },
        {
          exception: 'disability',
          disposition: 'rejected',
          rejectedDisabilityEvidence: {
            disabilityQualificationDate: null,
            qualifiedOnEvaluationDate: false,
          },
        },
        {
          exception: 'otherStatutoryException',
          disposition: 'rejected',
          attestation: {
            attested: true,
            evidenceScope:
              'planningEvidenceNotFilingGradeLegalAdjudication',
          },
        },
      ],
    })
  })

  it.each([
    ['owner alive', 'ownerAliveEvidence'],
    ['rejected disability', 'rejectedDisabilityEvidence'],
    ['no SEPP', 'iraSeppStatusEvidence'],
    ['no other exception', 'noOtherExceptionAttestations'],
  ] as const)(
    'preserves exceptionEvaluationRequired when %s evidence is missing',
    (_label, field) => {
      const value = completeNegativeEvidence(input())
      value[field] = []

      expect(first(
        evaluateOwnedNonRothIraPenaltyPrerequisites(value),
      ).outcome).toBe('exceptionEvaluationRequired')
    },
  )

  it('rejects bare notQualified SEPP status and non-null election/schedule bindings', () => {
    for (const malformed of [
      {
        status: 'notQualified',
        electionId: null,
        scheduleId: null,
      },
      {
        status: 'none',
        electionId: 'election',
        scheduleId: null,
      },
      {
        status: 'none',
        electionId: null,
        scheduleId: 'schedule',
      },
    ]) {
      const value = completeNegativeEvidence(input())
      value.iraSeppStatusEvidence = [{
        ...value.iraSeppStatusEvidence![0]!,
        ...malformed,
      } as unknown as OwnedNonRothIraNoSeppStatusEvidence]
      expect(() =>
        evaluateOwnedNonRothIraPenaltyPrerequisites(value),
      ).toThrow(/explicitly prove no election or schedule/)
    }
  })

  it('requires owner-alive evidence to reuse the exact distribution-date evidence binding', () => {
    const value = completeNegativeEvidence(input())
    value.ownerAliveEvidence = [{
      ...value.ownerAliveEvidence![0]!,
      distributionDateEvidenceId: 'different-distribution-date',
    }]

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/exact distribution-date evidence/)
  })

  it('fails closed on contradictory positive/rejected disability evidence', () => {
    const value = input({
      disabilityQualificationDate: '2030-05-01',
    })
    value.rejectedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: asPersonId('owner'),
      disabilityQualificationDate: null,
      evaluationDate: '2030-06-01',
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId: 'rejected-disability',
    }]

    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    ).toThrow(/uniquely bind an unresolved under-age owner and date/)
  })

  it('accepts a future qualification date as explicit not-qualified-on-distribution evidence', () => {
    const value = completeNegativeEvidence(input())
    value.rejectedDisabilityEvidence = [{
      ...value.rejectedDisabilityEvidence![0]!,
      disabilityQualificationDate: '2031-01-01',
    }]

    const evaluation = first(
      evaluateOwnedNonRothIraPenaltyPrerequisites(value),
    )
    expect(evaluation.outcome).toBe('penaltyApplies')
    if (evaluation.outcome !== 'penaltyApplies') return
    expect(
      evaluation.rejectedExceptions[3].rejectedDisabilityEvidence,
    ).toMatchObject({
      disabilityQualificationDate: '2031-01-01',
      qualifiedOnEvaluationDate: false,
    })
  })

  it('fails closed on duplicates, foreign extras, and cross-kind evidence-ID reuse', () => {
    const duplicated = completeNegativeEvidence(input())
    duplicated.ownerAliveEvidence = [
      ...duplicated.ownerAliveEvidence!,
      duplicated.ownerAliveEvidence![0]!,
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(duplicated),
    ).toThrow(/uniquely match/)

    const foreign = completeNegativeEvidence(input())
    foreign.noOtherExceptionAttestations = [
      ...foreign.noOtherExceptionAttestations!,
      {
        ...foreign.noOtherExceptionAttestations![0]!,
        actionId: asActionId('foreign-action'),
        attestationEvidenceId: 'foreign-attestation',
      },
    ]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(foreign),
    ).toThrow(/uniquely match/)

    const reused = completeNegativeEvidence(input())
    reused.iraSeppStatusEvidence = [{
      ...reused.iraSeppStatusEvidence![0]!,
      seppStatusEvidenceId:
        reused.ownerAliveEvidence![0]!.ownerAliveEvidenceId,
    }]
    expect(() =>
      evaluateOwnedNonRothIraPenaltyPrerequisites(reused),
    ).toThrow(/evidence ID reuse/)
  })

  it.each([
    [2030, '2030-12-31', '2029-01-01', 'initialTwoYearPeriod', 25],
    [2031, '2031-01-01', '2029-01-01', 'standardAfterTwoYearPeriod', 10],
  ] as const)(
    'applies the SIMPLE boundary rate in %i on %s',
    (taxYear, evaluationDate, participationStartDate, phase, amount) => {
      const result = evaluateOwnedNonRothIraPenaltyPrerequisites(
        completeNegativeEvidence(input({
          subtype: 'simple',
          taxYear,
          evaluationDate,
          participationStartDate,
        })),
      )
      const evaluation = first(result)
      expect(evaluation).toMatchObject({
        outcome: 'penaltyApplies',
        candidateAmountBeforeExceptions: amount,
        finalPenaltyAmount: amount,
        rateEvidence: {
          kind: 'simpleIraParticipationRate',
          phase,
        },
      })
    },
  )

  it.each([
    [1, 0],
    [5, 1],
    [14, 1],
    [15, 2],
  ])(
    'quantizes a %i-cent ordinary-income exposure to %i cents',
    (grossAmount, expectedPenalty) => {
      const evaluation = first(
        evaluateOwnedNonRothIraPenaltyPrerequisites(
          completeNegativeEvidence(input({ grossAmount })),
        ),
      )
      expect(evaluation).toMatchObject({
        outcome: 'penaltyApplies',
        candidateAmountBeforeExceptions: expectedPenalty,
        finalPenaltyAmount: expectedPenalty,
      })
    },
  )

  it('rounds a same-rate owner/year bucket once and deterministically allocates its cents', () => {
    const value = completeNegativeEvidence(twoWithdrawalInput(
      false,
      false,
      false,
      { firstGrossAmount: 5, secondGrossAmount: 5 },
    ))
    const result =
      evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    const permuted = completeNegativeEvidence(twoWithdrawalInput(
      true,
      false,
      false,
      { firstGrossAmount: 5, secondGrossAmount: 5 },
    ))
    permuted.ownerAliveEvidence = [
      ...permuted.ownerAliveEvidence!,
    ].reverse()
    permuted.rejectedDisabilityEvidence = [
      ...permuted.rejectedDisabilityEvidence!,
    ].reverse()
    permuted.iraSeppStatusEvidence = [
      ...permuted.iraSeppStatusEvidence!,
    ].reverse()
    permuted.noOtherExceptionAttestations = [
      ...permuted.noOtherExceptionAttestations!,
    ].reverse()
    expect(
      evaluateOwnedNonRothIraPenaltyPrerequisites(permuted),
    ).toEqual(result)
    const [firstEvaluation, secondEvaluation] = result.evaluations
    expect(firstEvaluation?.outcome).toBe('penaltyApplies')
    expect(secondEvaluation?.outcome).toBe('penaltyApplies')
    if (
      firstEvaluation?.outcome !== 'penaltyApplies' ||
      secondEvaluation?.outcome !== 'penaltyApplies'
    ) return

    expect([
      firstEvaluation.candidateAmountBeforeExceptions,
      secondEvaluation.candidateAmountBeforeExceptions,
    ]).toEqual([1, 1])
    expect([
      firstEvaluation.finalPenaltyAmount,
      secondEvaluation.finalPenaltyAmount,
    ]).toEqual([1, 0])
    expect(firstEvaluation.rateBucketEvidence).toEqual(
      secondEvaluation.rateBucketEvidence,
    )
    expect(firstEvaluation.rateBucketEvidence).toMatchObject({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
      numerator: 1,
      denominator: 10,
      aggregateOrdinaryIncomeExposureAmount: 10,
      aggregatePenaltyAmount: 1,
      allocationMethod:
        'floorQuotasThenLargestRemaindersCanonicalIdentity',
      quantization: 'nearestCentHalfUp',
      intermediateArithmetic: 'bigintRational',
      members: [
        {
          actionId: asActionId('action-a'),
          ordinaryIncomeExposureAmount: 5,
          floorQuotaAmount: 0,
          remainderNumerator: 5,
          allocatedPenaltyAmount: 1,
        },
        {
          actionId: asActionId('action-b'),
          ordinaryIncomeExposureAmount: 5,
          floorQuotaAmount: 0,
          remainderNumerator: 5,
          allocatedPenaltyAmount: 0,
        },
      ],
    })
    expect(
      firstEvaluation.rateBucketEvidence.members.reduce(
        (total, member) => total + member.allocatedPenaltyAmount,
        0,
      ),
    ).toBe(firstEvaluation.rateBucketEvidence.aggregatePenaltyAmount)
    expect(Object.isFrozen(firstEvaluation.rateBucketEvidence)).toBe(true)
    expect(Object.isFrozen(
      firstEvaluation.rateBucketEvidence.members,
    )).toBe(true)
  })

  it('keeps every same-rate sibling unresolved when one could still join the final bucket', () => {
    const value = completeNegativeEvidence(twoWithdrawalInput(
      false,
      false,
      false,
      { firstGrossAmount: 5, secondGrossAmount: 5 },
    ))
    value.ownerAliveEvidence = value.ownerAliveEvidence?.filter(
      (evidence) => evidence.actionId !== asActionId('action-b'),
    )

    const result =
      evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    expect(result.evaluations.map((evaluation) => evaluation.outcome))
      .toEqual([
        'exceptionEvaluationRequired',
        'exceptionEvaluationRequired',
      ])
    expect(
      result.evaluations.map((evaluation) =>
        evaluation.outcome === 'exceptionEvaluationRequired'
          ? evaluation.prerequisiteEvidenceId
          : null,
      ),
    ).not.toContain(null)
  })

  it('finalizes complete 10% and 25% buckets independently', () => {
    const value = completeNegativeEvidence(twoWithdrawalInput(
      false,
      false,
      false,
      {
        firstGrossAmount: 5,
        secondGrossAmount: 2,
        secondSubtype: 'simple',
      },
    ))
    const result =
      evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    const final = result.evaluations.filter(
      (evaluation) => evaluation.outcome === 'penaltyApplies',
    )

    expect(final).toHaveLength(2)
    expect(final.map(
      (evaluation) => evaluation.rateBucketEvidence.denominator,
    )).toEqual([10, 4])
    expect(final.map(
      (evaluation) => evaluation.rateBucketEvidence.members.length,
    )).toEqual([1, 1])
    expect(final.map(
      (evaluation) => evaluation.finalPenaltyAmount,
    )).toEqual([1, 1])
    expect(final[0]?.rateBucketEvidence.evidenceId).not.toBe(
      final[1]?.rateBucketEvidence.evidenceId,
    )

    value.noOtherExceptionAttestations =
      value.noOtherExceptionAttestations?.filter(
        (evidence) =>
          evidence.actionId !== asActionId('action-a'),
      )
    const partlyUnresolved =
      evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    expect(partlyUnresolved.evaluations.map(
      (evaluation) => evaluation.outcome,
    )).toEqual([
      'exceptionEvaluationRequired',
      'penaltyApplies',
    ])
  })

  it('keeps a maximum-safe aggregate exposure in bigint through bucket allocation', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(
      completeNegativeEvidence(twoWithdrawalInput(
        false,
        false,
        false,
        {
          firstGrossAmount: Number.MAX_SAFE_INTEGER - 1,
          secondGrossAmount: 1,
        },
      )),
    )
    const evaluation = result.evaluations[0]
    expect(evaluation?.outcome).toBe('penaltyApplies')
    if (evaluation?.outcome !== 'penaltyApplies') return

    expect(
      evaluation.rateBucketEvidence
        .aggregateOrdinaryIncomeExposureAmount,
    ).toBe(Number.MAX_SAFE_INTEGER)
    expect(
      evaluation.rateBucketEvidence.aggregatePenaltyAmount,
    ).toBe(900_719_925_474_099)
    expect(
      evaluation.rateBucketEvidence.members.reduce(
        (total, member) =>
          total + BigInt(member.allocatedPenaltyAmount),
        0n,
      ),
    ).toBe(
      BigInt(evaluation.rateBucketEvidence.aggregatePenaltyAmount),
    )
  })

  it('binds material member exposure into bucket and member evidence IDs', () => {
    const baseline = evaluateOwnedNonRothIraPenaltyPrerequisites(
      completeNegativeEvidence(twoWithdrawalInput(
        false,
        false,
        false,
        { firstGrossAmount: 5, secondGrossAmount: 5 },
      )),
    )
    const changed = evaluateOwnedNonRothIraPenaltyPrerequisites(
      completeNegativeEvidence(twoWithdrawalInput(
        false,
        false,
        false,
        { firstGrossAmount: 6, secondGrossAmount: 4 },
      )),
    )
    const baselineFirst = baseline.evaluations[0]
    const changedFirst = changed.evaluations[0]
    expect(baselineFirst?.outcome).toBe('penaltyApplies')
    expect(changedFirst?.outcome).toBe('penaltyApplies')
    if (
      baselineFirst?.outcome !== 'penaltyApplies' ||
      changedFirst?.outcome !== 'penaltyApplies'
    ) return

    expect(
      changedFirst.rateBucketEvidence.aggregatePenaltyAmount,
    ).toBe(baselineFirst.rateBucketEvidence.aggregatePenaltyAmount)
    expect(changedFirst.rateBucketEvidence.evidenceId).not.toBe(
      baselineFirst.rateBucketEvidence.evidenceId,
    )
    expect(changedFirst.finalEvidenceId).not.toBe(
      baselineFirst.finalEvidenceId,
    )
  })

  it('binds every completed member exception decision into the shared bucket and all final IDs', () => {
    const baselineInput = completeNegativeEvidence(twoWithdrawalInput())
    const changedInput = completeNegativeEvidence(twoWithdrawalInput())
    changedInput.noOtherExceptionAttestations =
      changedInput.noOtherExceptionAttestations?.map((attestation) =>
        attestation.actionId === asActionId('action-b')
          ? {
              ...attestation,
              attestationEvidenceId:
                'materially-revised-sibling-attestation',
            }
          : attestation,
      )

    const baseline =
      evaluateOwnedNonRothIraPenaltyPrerequisites(baselineInput)
    const changed =
      evaluateOwnedNonRothIraPenaltyPrerequisites(changedInput)
    const baselineFinal = baseline.evaluations.filter(
      (evaluation) => evaluation.outcome === 'penaltyApplies',
    )
    const changedFinal = changed.evaluations.filter(
      (evaluation) => evaluation.outcome === 'penaltyApplies',
    )
    expect(baselineFinal).toHaveLength(2)
    expect(changedFinal).toHaveLength(2)
    const baselineBucket = baselineFinal[0]?.rateBucketEvidence
    const changedBucket = changedFinal[0]?.rateBucketEvidence
    if (baselineBucket === undefined || changedBucket === undefined) {
      return
    }

    expect(changedBucket.aggregateOrdinaryIncomeExposureAmount).toBe(
      baselineBucket.aggregateOrdinaryIncomeExposureAmount,
    )
    expect(changedBucket.aggregatePenaltyAmount).toBe(
      baselineBucket.aggregatePenaltyAmount,
    )
    expect(changedBucket.members.map((member) => member.rateEvidenceId))
      .toEqual(
        baselineBucket.members.map((member) => member.rateEvidenceId),
      )
    expect(
      changedBucket.members[0]?.penaltyApplicabilityEvidenceId,
    ).toBe(
      baselineBucket.members[0]?.penaltyApplicabilityEvidenceId,
    )
    expect(
      changedBucket.members[1]?.penaltyApplicabilityEvidenceId,
    ).not.toBe(
      baselineBucket.members[1]?.penaltyApplicabilityEvidenceId,
    )
    expect(changedBucket.evidenceId).not.toBe(baselineBucket.evidenceId)
    expect(changedFinal.map((evaluation) => evaluation.finalEvidenceId))
      .not.toEqual(
        baselineFinal.map((evaluation) => evaluation.finalEvidenceId),
      )
    for (let index = 0; index < baselineFinal.length; index += 1) {
      expect(changedFinal[index]?.finalEvidenceId).not.toBe(
        baselineFinal[index]?.finalEvidenceId,
      )
    }
  })

  it('is permutation-invariant, detached, and deeply freezes final negative evidence', () => {
    const baseline = completeNegativeEvidence(twoWithdrawalInput())
    const permuted = completeNegativeEvidence(twoWithdrawalInput(true))
    permuted.ownerAliveEvidence = [
      ...permuted.ownerAliveEvidence!,
    ].reverse()
    permuted.rejectedDisabilityEvidence = [
      ...permuted.rejectedDisabilityEvidence!,
    ].reverse()
    permuted.iraSeppStatusEvidence = [
      ...permuted.iraSeppStatusEvidence!,
    ].reverse()
    permuted.noOtherExceptionAttestations = [
      ...permuted.noOtherExceptionAttestations!,
    ].reverse()

    const result =
      evaluateOwnedNonRothIraPenaltyPrerequisites(baseline)
    expect(
      evaluateOwnedNonRothIraPenaltyPrerequisites(permuted),
    ).toEqual(result)
    expect(result.evaluations).toHaveLength(2)
    expect(
      result.evaluations.every(
        (evaluation) => evaluation.outcome === 'penaltyApplies',
      ),
    ).toBe(true)
    const evaluation = result.evaluations[0]
    if (evaluation?.outcome !== 'penaltyApplies') return
    expect(Object.isFrozen(evaluation)).toBe(true)
    expect(Object.isFrozen(evaluation.rejectedExceptions)).toBe(true)
    expect(Object.isFrozen(
      evaluation.rejectedExceptions[4].attestation,
    )).toBe(true)
    Object.assign(baseline.ownerAliveEvidence![0]!, {
      ownerAliveEvidenceId: 'mutated',
    })
    expect(
      evaluation.rejectedExceptions[1].ownerAliveEvidence
        .ownerAliveEvidenceId,
    ).not.toBe('mutated')

    const changed = completeNegativeEvidence(twoWithdrawalInput())
    changed.noOtherExceptionAttestations = [
      {
        ...changed.noOtherExceptionAttestations![0]!,
        attestationEvidenceId: 'materially-revised-attestation',
      },
      changed.noOtherExceptionAttestations![1]!,
    ]
    const changedResult =
      evaluateOwnedNonRothIraPenaltyPrerequisites(changed)
    expect(
      changedResult.evaluations[0]?.outcome === 'penaltyApplies'
        ? changedResult.evaluations[0].finalEvidenceId
        : null,
    ).not.toBe(evaluation.finalEvidenceId)
  })

  it('mints its evidence IDs with the hardened structural minter', () => {
    const overAge = evaluateOwnedNonRothIraPenaltyPrerequisites(
      input({ birthDate: '1950-01-01' }),
    )
    const applies = evaluateOwnedNonRothIraPenaltyPrerequisites(
      completeNegativeEvidence(input({})),
    )

    expect(overAge.coverage[0]?.ageThresholdEvidenceId).toBe(
      'owned-ira-age-59-half:57fa14d8ff984f3e1d93e0898f57e4e7' +
        '8a5421ede3301f9b20b74135b0f28042',
    )
    expect(overAge.coverage[0]?.characterEvidenceIds).toEqual([
      'owned-ira-character-segment:11ec85684f393fd5fa1e494c69b763cd' +
        'e23dbb98f99b2ed1c1cfe5bc9411d0f7',
    ])
    const overAgeEvaluation = first(overAge)
    const appliesEvaluation = first(applies)

    expect(
      overAgeEvaluation.outcome === 'age59HalfReached'
        ? overAgeEvaluation.finalEvidenceId
        : null,
    ).toBe(
      'owned-ira-age-59-half-zero-penalty:6b0faa1abb2cb165dcec8701' +
        '26603f2b701491e3fe65145e0bfc2d0cdf49966e',
    )
    expect(appliesEvaluation.outcome).toBe('penaltyApplies')
    expect(
      appliesEvaluation.outcome === 'penaltyApplies'
        ? appliesEvaluation.finalEvidenceId
        : null,
    ).toBe(
      'owned-ira-penalty-applies:342dbd4994b82ec1bcb2df232807fecb' +
        '05507d81f66d79270d404c0040d2141c',
    )
    expect(
      evaluateOwnedNonRothIraPenaltyPrerequisites(
        input({ birthDate: '1950-01-01' }),
      ).coverage[0]?.ageThresholdEvidenceId,
    ).toBe(overAge.coverage[0]?.ageThresholdEvidenceId)
    expect(
      evaluateOwnedNonRothIraPenaltyPrerequisites(
        input({ birthDate: '1950-01-02' }),
      ).coverage[0]?.ageThresholdEvidenceId,
    ).not.toBe(overAge.coverage[0]?.ageThresholdEvidenceId)
  })
})
