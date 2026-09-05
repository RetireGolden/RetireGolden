import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateTraditionalEmployerPlanPenaltyPrerequisite } from './traditionalEmployerPlanPenaltyPrerequisite.js'
import {
  classifyTraditionalEmployerPlanWithdrawal,
  type AcceptedTraditionalEmployerPlanWithdrawalClassification,
  type ClassifyTraditionalEmployerPlanWithdrawalInput,
  type TraditionalEmployerPlanDistributableEventKind,
} from './traditionalEmployerPlanWithdrawalCharacter.js'

function input(
  executedAmount = 60,
  preDistributionAccountValue = 100,
  afterTaxEmployeeBasisBeforeDistribution = 40,
): ClassifyTraditionalEmployerPlanWithdrawalInput {
  return {
    actionId: asActionId('withdrawal'),
    allocationId: asAllocationId('allocation'),
    sourceAccountId: asAccountId('employer-plan'),
    participantPersonId: asPersonId('participant'),
    evaluationDate: '2030-06-15',
    executedAmount: asUsdCents(executedAmount),
    availabilityEvidence: {
      predicate: 'employerDistributionEligibility',
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('employer-plan'),
      participantPersonId: asPersonId('participant'),
      evaluationDate: '2030-06-15',
      availabilityEvidence: {
        kind: 'distributableEvent',
        eventKind: 'separationFromService',
        eventDate: '2030-01-02',
        planTermsEvidenceId: 'plan-terms',
        availableOnEvaluationDate: true,
      },
    },
    basisSnapshot: {
      predicate: 'traditionalEmployerPlanBasisSnapshot',
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('employer-plan'),
      participantPersonId: asPersonId('participant'),
      evaluationDate: '2030-06-15',
      preDistributionAccountValue: asPositiveUsdCents(
        preDistributionAccountValue,
      ),
      afterTaxEmployeeBasisBeforeDistribution: asUsdCents(
        afterTaxEmployeeBasisBeforeDistribution,
      ),
      basisEvidenceId: 'employer-basis',
    },
  }
}

function evaluateAcceptedCharacterPenalty(
  characterization: AcceptedTraditionalEmployerPlanWithdrawalClassification,
) {
  const accepted = characterization.acceptedSourceEligibility
  const actionId = accepted.actionId ?? characterization.taxCharacter[0]?.actionId
  if (actionId === undefined) {
    throw new Error('accepted character must carry action identity')
  }
  return evaluateTraditionalEmployerPlanPenaltyPrerequisite({
    actionId,
    allocationId: accepted.allocationId,
    sourceAccountId: accepted.sourceAccountId,
    participantPersonId: accepted.participantPersonId,
    evaluationDate: accepted.evaluationDate,
    characterization,
    taxableTreatmentAmount: accepted.basisEvidence.ordinaryIncomeAmount,
    participantEvidence: {
      predicate: 'employerPlanParticipantBirthDateForPenalty',
      participantPersonId: accepted.participantPersonId,
      birthDate: '1960-06-15',
      birthDateEvidenceId: 'birth-record',
    },
    separationEvidence: null,
    disabilityEvidence: null,
    seppEvidence: null,
    otherExceptionAttestation: null,
  })
}

describe('traditional employer-plan withdrawal character', () => {
  it('derives basis return and ordinary income from one exact ratio', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input())

    expect(result).toMatchObject({
      status: 'accepted',
      reasons: [],
      acceptedSourceEligibility: {
        predicate: 'employerDistributionEligibility',
        actionId: 'withdrawal',
        allocationId: 'allocation',
        sourceAccountId: 'employer-plan',
        participantPersonId: 'participant',
        evaluationDate: '2030-06-15',
        sourceClass: 'traditionalEmployerPlan',
        availabilityEvidence: {
          kind: 'distributableEvent',
          eventKind: 'separationFromService',
          eventDate: '2030-01-02',
          planTermsEvidenceId: 'plan-terms',
          availableOnEvaluationDate: true,
        },
        basisEvidence: {
          rule: 'proRataSingleDistribution',
          sourcePlanAccountId: 'employer-plan',
          preDistributionAccountValue: 100,
          afterTaxEmployeeBasisBeforeDistribution: 40,
          aggregateBasisRatio: {
            representation: 'exactMinorUnitRational',
            numeratorMinorUnits: 40,
            denominatorMinorUnits: 100,
            intermediateArithmetic: 'bigintRational',
          },
          executedAmount: 60,
          basisRecoveredAmount: 24,
          ordinaryIncomeAmount: 36,
          basisRecoveryQuantization: 'nearestCentHalfUp',
          basisEvidenceId: 'employer-basis',
        },
      },
      taxCharacter: [
        {
          sourceClass: 'traditionalEmployerPlan',
          kind: 'basisReturn',
          amount: 24,
          characterEvidence: {
            rule: 'employerPlanProRataBasis',
            allocationId: 'allocation',
            basisEvidenceId: 'employer-basis',
            segmentAmount: 24,
          },
        },
        {
          sourceClass: 'traditionalEmployerPlan',
          kind: 'ordinaryIncome',
          amount: 36,
          characterEvidence: {
            rule: 'employerPlanProRataBasis',
            allocationId: 'allocation',
            basisEvidenceId: 'employer-basis',
            segmentAmount: 36,
          },
        },
      ],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.acceptedSourceEligibility)).toBe(true)
  })

  it('does not infer after-tax basis when the snapshot is absent', () => {
    const value = input()
    value.basisSnapshot = null

    expect(classifyTraditionalEmployerPlanWithdrawal(value)).toEqual({
      status: 'unsupported',
      reasons: [{
        code: 'withdrawal-employer-basis-unsupported',
        predicate: 'employerDistributionEligibility',
        outcome: 'unsupported',
        message:
          "The employer plan's allocation-bound after-tax basis evidence is missing or unsupported.",
        personId: 'participant',
        accountId: 'employer-plan',
        allocationId: 'allocation',
      }],
      acceptedSourceEligibility: null,
      taxCharacter: [],
    })
  })

  it('uses exact repeating-ratio arithmetic without floating point', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input(1, 3, 1))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 1,
    })
    expect(result.taxCharacter).toMatchObject([
      { kind: 'ordinaryIncome', amount: 1 },
    ])
  })

  it('rounds a half-cent basis result up exactly once', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input(1, 2, 1))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      basisRecoveredAmount: 1,
      ordinaryIncomeAmount: 0,
    })
    expect(result.taxCharacter).toMatchObject([
      { kind: 'basisReturn', amount: 1 },
    ])
  })

  it('classifies a proven zero-basis distribution as ordinary income', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input(80, 100, 0))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      afterTaxEmployeeBasisBeforeDistribution: 0,
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 80,
    })
    expect(result.taxCharacter).toMatchObject([
      { kind: 'ordinaryIncome', amount: 80 },
    ])
  })

  it('emits no character for zero execution while preserving the ratio', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input(0, 100, 40))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      executedAmount: 0,
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 0,
    })
    expect(result.taxCharacter).toEqual([])
  })

  it.each([
    'separationFromService',
    'inServiceWithdrawal',
    'planTermination',
    'requiredDistribution',
  ] satisfies TraditionalEmployerPlanDistributableEventKind[])(
    'accepts the dated distributable event %s',
    (eventKind) => {
      const value = input()
      ;(value.availabilityEvidence!.availabilityEvidence as {
        eventKind: TraditionalEmployerPlanDistributableEventKind
      }).eventKind = eventKind

      const result = classifyTraditionalEmployerPlanWithdrawal(value)
      expect(result.status).toBe('accepted')
      if (result.status !== 'accepted') throw new Error('expected acceptance')
      expect(result.acceptedSourceEligibility.availabilityEvidence.eventKind)
        .toBe(eventKind)
    },
  )

  it('returns typed unknown when availability evidence is absent', () => {
    const value = input()
    value.availabilityEvidence = null

    expect(classifyTraditionalEmployerPlanWithdrawal(value)).toMatchObject({
      status: 'unsupported',
      reasons: [{
        code: 'withdrawal-plan-availability-unknown',
        predicate: 'employerDistributionEligibility',
        outcome: 'unsupported',
      }],
      acceptedSourceEligibility: null,
      taxCharacter: [],
    })
  })

  it('returns typed refusal for complete terms that say unavailable', () => {
    const value = input()
    ;(value.availabilityEvidence!.availabilityEvidence as {
      availableOnEvaluationDate: boolean
    }).availableOnEvaluationDate = false
    value.basisSnapshot = null

    expect(classifyTraditionalEmployerPlanWithdrawal(value)).toMatchObject({
      status: 'refused',
      reasons: [{
        code: 'withdrawal-plan-not-available',
        predicate: 'employerDistributionEligibility',
        outcome: 'refused',
      }],
      acceptedSourceEligibility: null,
      taxCharacter: [],
    })
  })

  it.each([
    ['actionId', 'foreign-action'],
    ['allocationId', 'foreign-allocation'],
    ['sourceAccountId', 'foreign-source'],
    ['participantPersonId', 'foreign-person'],
    ['evaluationDate', '2030-06-16'],
  ] as const)(
    'rejects availability evidence with mismatched %s as unknown',
    (field, replacement) => {
      const value = input()
      ;(value.availabilityEvidence as unknown as Record<string, string>)[field] =
        replacement

      expect(classifyTraditionalEmployerPlanWithdrawal(value)).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-plan-availability-unknown' }],
      })
    },
  )

  it.each([
    ['eventDate', '2030-02-30'],
    ['eventDate', '2030-06-16'],
    ['planTermsEvidenceId', '  '],
    ['eventKind', 'foreign-event'],
  ] as const)(
    'rejects invalid or contradictory availability field %s as unknown',
    (field, replacement) => {
      const value = input()
      ;(value.availabilityEvidence!.availabilityEvidence as unknown as
        Record<string, string>)[field] = replacement

      expect(classifyTraditionalEmployerPlanWithdrawal(value)).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-plan-availability-unknown' }],
      })
    },
  )

  it.each([
    ['actionId', 'foreign-action'],
    ['allocationId', 'foreign-allocation'],
    ['sourceAccountId', 'foreign-source'],
    ['participantPersonId', 'foreign-person'],
    ['evaluationDate', '2030-06-16'],
  ] as const)(
    'rejects basis evidence with mismatched %s as unsupported',
    (field, replacement) => {
      const value = input()
      ;(value.basisSnapshot as unknown as Record<string, string>)[field] =
        replacement

      expect(classifyTraditionalEmployerPlanWithdrawal(value)).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
      })
    },
  )

  it('rejects basis above value and execution above value', () => {
    expect(classifyTraditionalEmployerPlanWithdrawal(input(1, 100, 101)))
      .toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
      })
    expect(classifyTraditionalEmployerPlanWithdrawal(input(101, 100, 40)))
      .toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
      })
  })

  it('rejects blank, unsafe, or zero-denominator basis snapshots', () => {
    const blank = input()
    ;(blank.basisSnapshot as { basisEvidenceId: string }).basisEvidenceId = ' '
    expect(classifyTraditionalEmployerPlanWithdrawal(blank)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
    })

    const unsafe = input()
    ;(unsafe.basisSnapshot as unknown as {
      afterTaxEmployeeBasisBeforeDistribution: number
    }).afterTaxEmployeeBasisBeforeDistribution = Number.MAX_SAFE_INTEGER + 1
    expect(classifyTraditionalEmployerPlanWithdrawal(unsafe)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
    })

    const zeroValue = input()
    ;(zeroValue.basisSnapshot as unknown as {
      preDistributionAccountValue: number
    }).preDistributionAccountValue = 0
    expect(classifyTraditionalEmployerPlanWithdrawal(zeroValue)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-employer-basis-unsupported' }],
    })
  })

  it('uses bigint when safe values have an unsafe intermediate product', () => {
    const max = Number.MAX_SAFE_INTEGER
    const result = classifyTraditionalEmployerPlanWithdrawal(
      input(max - 2, max, max - 1),
    )

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    const expected =
      (BigInt(max - 2) * BigInt(max - 1) * 2n + BigInt(max)) /
      (2n * BigInt(max))
    expect(BigInt(result.acceptedSourceEligibility.basisEvidence
      .basisRecoveredAmount)).toBe(expected)
  })

  it('does not mutate caller-owned evidence', () => {
    const value = input()
    const before = structuredClone(value)

    classifyTraditionalEmployerPlanWithdrawal(value)

    expect(value).toEqual(before)
  })

  it('rejects a noncanonical evaluation date at the input boundary', () => {
    const value = input()
    value.evaluationDate = '2030-02-30'

    expect(() => classifyTraditionalEmployerPlanWithdrawal(value))
      .toThrow(/evaluation date must be canonical/)
  })
})

describeRule('irc-72-e-8-B-employer-plan-pro-rata-basis', {
  // 60 cents distributed from a 100-cent account holding 40 cents of after-tax
  // basis. IRC 72(e)(8)(B) allocates basis in the ratio of investment to
  // account balance, so 60 * 40/100 = 24 comes back as basis and 36 is ordinary
  // income. The reading that basis is recovered first returns all 40 and leaves
  // only 20 of ordinary income. A fully internally coherent 40/20 clone is
  // RangeError at the penalty validator, which recomputes that same ratio.
  readings: {
    statute: { basisRecovered: 24, coherentBasisFirstAtPenalty: 'RangeError' },
    rejectedBasisFirst: { basisRecovered: 40, coherentBasisFirstAtPenalty: 'accepted' },
  },
  accepted: 'statute',
}, ({ accepted, readings }) => {
  it('recovers basis in the investment-to-account-balance ratio', () => {
    const result = classifyTraditionalEmployerPlanWithdrawal(input(60, 100, 40))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.acceptedSourceEligibility.basisEvidence.basisRecoveredAmount)
      .toBe(accepted.basisRecovered)
    expect(result.acceptedSourceEligibility.basisEvidence.basisRecoveredAmount)
      .not.toBe(readings.rejectedBasisFirst.basisRecovered)
    expect(result.acceptedSourceEligibility.basisEvidence.ordinaryIncomeAmount)
      .toBe(36)

    expect(evaluateAcceptedCharacterPenalty(result)).toMatchObject({
      status: 'accepted',
      evidence: {
        characterCoverage: {
          executedAmount: 60,
          basisReturnExcludedAmount: accepted.basisRecovered,
          taxableTreatmentAmount: 36,
        },
      },
    })

    const forged = structuredClone(result)
    const basisFirst = readings.rejectedBasisFirst.basisRecovered
    Object.assign(forged.acceptedSourceEligibility.basisEvidence, {
      basisRecoveredAmount: asUsdCents(basisFirst),
      ordinaryIncomeAmount: asUsdCents(20),
    })
    for (const segment of forged.taxCharacter) {
      const amount = asPositiveUsdCents(
        segment.kind === 'basisReturn' ? basisFirst : 20,
      )
      Object.assign(segment, { amount })
      Object.assign(segment.characterEvidence, { segmentAmount: amount })
    }
    let coherentBasisFirstAtPenalty: 'accepted' | 'RangeError'
    try {
      evaluateAcceptedCharacterPenalty(forged)
      coherentBasisFirstAtPenalty = 'accepted'
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      coherentBasisFirstAtPenalty = 'RangeError'
    }
    expect(coherentBasisFirstAtPenalty).toBe(accepted.coherentBasisFirstAtPenalty)
    expect(coherentBasisFirstAtPenalty).not.toBe(
      readings.rejectedBasisFirst.coherentBasisFirstAtPenalty,
    )
  })

  it('leaves a distribution smaller than the basis partly taxable', () => {
    // The sharpest consequence of pro rata over basis-first: a 10-cent
    // distribution against 40 cents of basis is not tax free.
    const result = classifyTraditionalEmployerPlanWithdrawal(input(10, 100, 40))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.acceptedSourceEligibility.basisEvidence.basisRecoveredAmount).toBe(4)
    expect(result.acceptedSourceEligibility.basisEvidence.ordinaryIncomeAmount).toBe(6)
  })
})
