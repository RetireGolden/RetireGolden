import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { classifyTraditionalEmployerPlanWithdrawal } from './traditionalEmployerPlanWithdrawalCharacter.js'
import {
  evaluateTraditionalEmployerPlanPenaltyPrerequisite,
  type EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput,
  type TraditionalEmployerPlanSeppCurrentPaymentEvidence,
} from './traditionalEmployerPlanPenaltyPrerequisite.js'

type CurrentSeppFixture = Omit<
  TraditionalEmployerPlanSeppCurrentPaymentEvidence,
  'election' | 'payment'
> & {
  election: {
    -readonly [Key in keyof TraditionalEmployerPlanSeppCurrentPaymentEvidence['election']]:
      TraditionalEmployerPlanSeppCurrentPaymentEvidence['election'][Key]
  }
  payment: {
    -readonly [Key in keyof TraditionalEmployerPlanSeppCurrentPaymentEvidence['payment']]:
      TraditionalEmployerPlanSeppCurrentPaymentEvidence['payment'][Key]
  }
}

const ids = {
  actionId: asActionId('withdrawal'),
  allocationId: asAllocationId('allocation'),
  sourceAccountId: asAccountId('employer-plan'),
  participantPersonId: asPersonId('participant'),
}

function characterization(
  evaluationDate = '2030-06-15',
  executedAmount = 60,
  preDistributionAccountValue = 100,
  afterTaxEmployeeBasisBeforeDistribution = 40,
  availabilityEventDate = `${evaluationDate.slice(0, 4)}-01-02`,
) {
  const result = classifyTraditionalEmployerPlanWithdrawal({
    ...ids,
    evaluationDate,
    executedAmount: asUsdCents(executedAmount),
    availabilityEvidence: {
      predicate: 'employerDistributionEligibility',
      ...ids,
      evaluationDate,
      availabilityEvidence: {
        kind: 'distributableEvent',
        eventKind: 'separationFromService',
        eventDate: availabilityEventDate,
        planTermsEvidenceId: 'plan-terms',
        availableOnEvaluationDate: true,
      },
    },
    basisSnapshot: {
      predicate: 'traditionalEmployerPlanBasisSnapshot',
      ...ids,
      evaluationDate,
      preDistributionAccountValue: asPositiveUsdCents(preDistributionAccountValue),
      afterTaxEmployeeBasisBeforeDistribution: asUsdCents(
        afterTaxEmployeeBasisBeforeDistribution,
      ),
      basisEvidenceId: 'employer-basis',
    },
  })
  if (result.status !== 'accepted') throw new Error('fixture character must be accepted')
  return result
}

function taxableAmount(value: ReturnType<typeof characterization>): number {
  return value.acceptedSourceEligibility.basisEvidence.ordinaryIncomeAmount
}

function noSepp(evaluationDate = '2030-06-15') {
  return {
    predicate: 'employerPlanSeppStatusForWithdrawal' as const,
    ...ids,
    evaluationDate,
    status: 'none' as const,
    electionId: null,
    scheduleId: null,
    seppStatusEvidenceId: 'no-sepp',
  }
}

function rejectedDisability(evaluationDate = '2030-06-15') {
  return {
    kind: 'disability' as const,
    disabledPersonId: ids.participantPersonId,
    disabilityQualificationDate: null,
    evaluationDate,
    qualifiedOnEvaluationDate: false as const,
    disabilityEvidenceId: 'not-disabled',
  }
}

function otherAttestation(
  otherExceptionClaimed = false,
  evaluationDate = '2030-06-15',
) {
  return {
    predicate: 'otherEmployerPlanPenaltyExceptionAttestation' as const,
    ...ids,
    evaluationDate,
    otherExceptionClaimed,
    exceptionDescription: otherExceptionClaimed ? 'domestic-relations order' : null,
    evidenceScope: 'planningEvidenceNotFilingGradeLegalAdjudication' as const,
    attestationEvidenceId: 'other-exception-attestation',
  }
}

function input(options: {
  evaluationDate?: string
  birthDate?: string
  separationDate?: string | null
  executedAmount?: number
  accountValue?: number
  basis?: number
} = {}): EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput {
  const evaluationDate = options.evaluationDate ?? '2030-06-15'
  const character = characterization(
    evaluationDate,
    options.executedAmount,
    options.accountValue,
    options.basis,
    options.separationDate ?? undefined,
  )
  return {
    ...ids,
    evaluationDate,
    characterization: character,
    taxableTreatmentAmount: asUsdCents(taxableAmount(character)),
    participantEvidence: {
      predicate: 'employerPlanParticipantBirthDateForPenalty',
      participantPersonId: ids.participantPersonId,
      birthDate: options.birthDate ?? '1975-06-15',
      birthDateEvidenceId: 'birth-record',
    },
    separationEvidence: options.separationDate === null ? null : {
      predicate: 'sponsoringEmployerSeparationForPenalty',
      sourceAccountId: ids.sourceAccountId,
      participantPersonId: ids.participantPersonId,
      separationDate: options.separationDate ?? '2030-01-02',
      authoritative: true,
      separationEvidenceId: 'separation-record',
    },
    disabilityEvidence: rejectedDisability(evaluationDate),
    seppEvidence: noSepp(evaluationDate),
    otherExceptionAttestation: otherAttestation(false, evaluationDate),
  }
}

function currentSepp(
  value: EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput,
): CurrentSeppFixture {
  const gross = value.characterization.acceptedSourceEligibility.basisEvidence.executedAmount
  const taxable = value.taxableTreatmentAmount
  return {
    predicate: 'employerPlanSeppStatusForWithdrawal',
    actionId: value.actionId,
    allocationId: value.allocationId,
    sourceAccountId: value.sourceAccountId,
    participantPersonId: value.participantPersonId,
    evaluationDate: value.evaluationDate,
    status: 'currentPayment',
    election: {
      electionId: 'election',
      scheduleId: 'schedule',
      method: 'amortization',
      electionStartDate: '2030-01-01',
      participantPersonId: value.participantPersonId,
      sourceAccountId: value.sourceAccountId,
      electionEvidenceId: 'election-record',
    },
    payment: {
      currentDistributionEvidenceId: 'current-distribution',
      scheduledPaymentSequence: 2,
      scheduleTaxYear: 2030,
      scheduledAnnualAmount: asUsdCents(gross * 2),
      scheduledGrossAmountThroughBefore: asUsdCents(gross),
      actualQualifyingGrossAmountPaidBefore: asUsdCents(gross),
      currentScheduledGrossAmount: gross,
      currentDistributionGrossAmount: gross,
      currentQualifyingTaxableAmount: taxable,
      excessCurrentDistributionGrossAmount: asUsdCents(0),
      scheduledGrossAmountThroughAfter: asUsdCents(gross * 2),
      actualQualifyingGrossAmountPaidAfter: asUsdCents(gross * 2),
      previousScheduleStateId: 'state-1',
      scheduleStateBeforeId: 'state-1',
      scheduleStateAfterId: 'state-2',
      noDisqualifyingModificationThroughDate: value.evaluationDate,
    },
  }
}

describe('traditional employer-plan penalty prerequisite', () => {
  it('accepts age 59.5 exactly on the civil threshold without irrelevant exception facts', () => {
    const value = input({
      birthDate: '1970-08-31',
      evaluationDate: '2030-02-28',
      separationDate: null,
    })
    value.disabilityEvidence = null
    value.seppEvidence = null
    value.otherExceptionAttestation = null

    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)

    expect(result).toMatchObject({
      status: 'accepted',
      reasons: [],
      evidence: {
        outcome: 'age59HalfReached',
        finalPenaltyAmount: 0,
        ageEvidence: {
          age59HalfDate: '2030-02-28',
          calendarYearParticipantAttains55: 2025,
          calculation: 'addCalendarMonths714WithMonthEndClamp',
        },
      },
    })
  })

  it('requires exception evidence immediately before the exact 59.5 threshold', () => {
    const value = input({
      birthDate: '1970-08-31',
      evaluationDate: '2030-02-27',
      separationDate: null,
    })

    expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-rule-of-55-evidence-missing' }],
      evidence: { missingEvidence: 'separation' },
    })
  })

  it('accepts Rule of 55 separation before the birthday in the qualifying year', () => {
    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(input())

    expect(result).toMatchObject({
      status: 'accepted',
      evidence: {
        outcome: 'ruleOf55Qualified',
        finalPenaltyAmount: 0,
        ruleOf55Assessment: {
          disposition: 'accepted',
          separationDate: '2030-01-02',
          separationYear: 2030,
          calendarYearParticipantAttains55: 2030,
        },
      },
    })
  })

  it('does not qualify otherwise-identical prior-year separation', () => {
    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(
      input({ separationDate: '2029-12-31' }),
    )

    expect(result).toMatchObject({
      status: 'accepted',
      evidence: {
        outcome: 'penaltyApplies',
        finalPenaltyAmount: 4,
        ruleOf55Assessment: { disposition: 'refused', separationYear: 2029 },
        disabilityEvidence: { qualifiedOnEvaluationDate: false },
        seppAssessment: { disposition: 'refused' },
        otherExceptionAssessment: { disposition: 'refused' },
        rateEvidence: { numerator: 1, denominator: 10 },
      },
    })
  })

  it('requires separation to occur on or before the distribution', () => {
    const value = input({ separationDate: '2030-01-02' })
    value.separationEvidence = { ...value.separationEvidence!, separationDate: '2030-07-01' }
    value.characterization = {
      ...value.characterization,
      acceptedSourceEligibility: {
        ...value.characterization.acceptedSourceEligibility,
        availabilityEvidence: {
          ...value.characterization.acceptedSourceEligibility.availabilityEvidence,
          eventKind: 'inServiceWithdrawal',
        },
      },
    }
    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted penalty')
    expect(result.evidence.outcome).toBe('penaltyApplies')
    expect(result.evidence.ruleOf55Assessment?.disposition).toBe('refused')
  })

  it('uses only the exact taxable treatment and rounds a 10% half-cent up', () => {
    const value = input({
      separationDate: '2029-12-31',
      executedAmount: 15,
      accountValue: 15,
      basis: 10,
    })

    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted penalty')
    expect(result.evidence.characterCoverage).toMatchObject({
      executedAmount: 15,
      basisReturnExcludedAmount: 10,
      taxableTreatmentAmount: 5,
    })
    expect(result.evidence.finalPenaltyAmount).toBe(1)
  })

  it.each([
    ['zero execution', { executedAmount: 0, accountValue: 100, basis: 40 }],
    ['positive all-basis execution', { executedAmount: 50, accountValue: 100, basis: 100 }],
  ] as const)('accepts %s as literal zero exposure without exception facts', (_name, amounts) => {
    const value = input({ ...amounts, separationDate: null })
    value.disabilityEvidence = null
    value.seppEvidence = null
    value.otherExceptionAttestation = null

    expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
      status: 'accepted',
      evidence: {
        outcome: 'noTaxableExposure',
        finalPenaltyAmount: 0,
        characterCoverage: { taxableTreatmentAmount: 0 },
        ruleOf55Assessment: null,
        disabilityEvidence: null,
        seppAssessment: null,
        otherExceptionAssessment: null,
        rateEvidence: null,
      },
    })
  })

  it('preserves rejected disability identity when separation evidence is missing', () => {
    const firstInput = input({ separationDate: null })
    const secondInput = input({ separationDate: null })
    secondInput.disabilityEvidence = {
      ...rejectedDisability(),
      disabilityEvidenceId: 'alternate-not-disabled',
    }

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const second = evaluateTraditionalEmployerPlanPenaltyPrerequisite(secondInput)
    expect(first).toMatchObject({
      status: 'unsupported',
      evidence: {
        missingEvidence: 'separation',
        disabilityEvidence: { disabilityEvidenceId: 'not-disabled' },
      },
    })
    expect(second.evidence.evidenceId).not.toBe(first.evidence.evidenceId)
  })

  it('rejects a zero-character classification borrowed from another action', () => {
    const value = input({ executedAmount: 0, separationDate: null })
    value.characterization = structuredClone(value.characterization)
    ;(value.characterization.acceptedSourceEligibility as { actionId: string }).actionId = 'foreign-action'

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/exactly bind identity/)
  })

  it('accepts a dated disability that qualified by the distribution date', () => {
    const value = input({ separationDate: null })
    value.disabilityEvidence = {
      kind: 'disability',
      disabledPersonId: ids.participantPersonId,
      disabilityQualificationDate: '2030-06-14',
      evaluationDate: value.evaluationDate,
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'qualified-disability',
    }

    expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
      status: 'accepted',
      evidence: { outcome: 'disabilityQualified', finalPenaltyAmount: 0 },
    })
  })

  it('requires disability as-of status to be a literal boolean', () => {
    const value = input({ separationDate: '2029-12-31' })
    const disability = rejectedDisability()
    Reflect.set(disability, 'qualifiedOnEvaluationDate', 'false')
    value.disabilityEvidence = disability

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/literal as-of-date status/)
  })

  it('rejects an evaluation date before participant birth', () => {
    const value = input({ birthDate: '2031-01-01' })
    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/cannot precede participant birth/)
  })

  it('fails closed when disability status is missing after Rule of 55 rejection', () => {
    const firstInput = input({ separationDate: '2029-12-31' })
    firstInput.disabilityEvidence = null
    const secondInput = input({ separationDate: '2029-12-30' })
    secondInput.disabilityEvidence = null

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const second = evaluateTraditionalEmployerPlanPenaltyPrerequisite(secondInput)
    expect(first).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-penalty-evidence-missing' }],
      evidence: {
        missingEvidence: 'disability',
        ruleOf55Assessment: { disposition: 'refused', separationDate: '2029-12-31' },
      },
    })
    expect(second.evidence.ruleOf55Assessment).toMatchObject({ separationDate: '2029-12-30' })
    expect(first.evidence.evidenceId).not.toBe(second.evidence.evidenceId)
  })

  it('rejects a future date serialized as currently qualified disability', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.disabilityEvidence = {
      kind: 'disability',
      disabledPersonId: ids.participantPersonId,
      disabilityQualificationDate: '2030-06-16',
      evaluationDate: value.evaluationDate,
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'future-disability',
    }

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/dated participant status/)
  })

  it('rejects disability qualification evidence dated before participant birth', () => {
    const value = input({ separationDate: null })
    value.disabilityEvidence = {
      kind: 'disability',
      disabledPersonId: ids.participantPersonId,
      disabilityQualificationDate: '1975-06-14',
      evaluationDate: value.evaluationDate,
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'pre-birth-disability',
    }

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/dated participant status/)
  })

  it.each(['rmd', 'amortization', 'fixedAnnuitization'] as const)(
    'keeps a conforming %s current SEPP payment provisional for annual reconciliation',
    (method) => {
      const value = input({ separationDate: '2029-12-31' })
      const sepp = currentSepp(value)
      sepp.election.method = method
      value.seppEvidence = sepp

      expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'withdrawal-sepp-evidence-missing' }],
        evidence: {
          outcome: 'unsupported',
          missingEvidence: 'seppAnnualReconciliation',
          seppAssessment: {
            disposition: 'provisional',
            characterCoverageEvidenceId: expect.stringMatching(/^employer-penalty-character-coverage:/),
            characterEvidenceIds: expect.any(Array),
          },
        },
      })
      expect(Object.isFrozen(value.seppEvidence)).toBe(false)
    },
  )

  it('binds unsupported evidence ID to the provisional SEPP assessment ID', () => {
    const firstInput = input({ separationDate: '2029-12-31' })
    firstInput.seppEvidence = currentSepp(firstInput)
    const secondInput = input({ separationDate: '2029-12-31' })
    const secondSepp = currentSepp(secondInput)
    secondSepp.payment.currentDistributionEvidenceId = 'different-current-distribution'
    secondInput.seppEvidence = secondSepp

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const second = evaluateTraditionalEmployerPlanPenaltyPrerequisite(secondInput)
    expect(first.status).toBe('unsupported')
    expect(second.status).toBe('unsupported')
    if (first.status !== 'unsupported' || second.status !== 'unsupported') {
      throw new Error('expected provisional SEPP results')
    }
    expect(first.evidence.characterCoverage).toEqual(second.evidence.characterCoverage)
    expect(first.evidence.seppAssessment?.evidenceId)
      .not.toBe(second.evidence.seppAssessment?.evidenceId)
    expect(first.evidence.evidenceId).not.toBe(second.evidence.evidenceId)
  })

  it('binds the SEPP assessment to exact coverage and character evidence IDs', () => {
    const firstInput = input({ separationDate: '2029-12-31' })
    firstInput.seppEvidence = currentSepp(firstInput)
    const changedInput = input({ separationDate: '2029-12-31' })
    const changedCharacterization = structuredClone(changedInput.characterization)
    changedInput.characterization = {
      ...changedCharacterization,
      acceptedSourceEligibility: {
        ...changedCharacterization.acceptedSourceEligibility,
        basisEvidence: {
          ...changedCharacterization.acceptedSourceEligibility.basisEvidence,
          basisEvidenceId: 'alternate-employer-basis',
        },
      },
      taxCharacter: changedCharacterization.taxCharacter.map((segment) => ({
        ...segment,
        characterEvidence: {
          ...segment.characterEvidence,
          basisEvidenceId: 'alternate-employer-basis',
        },
      })),
    }
    changedInput.seppEvidence = currentSepp(changedInput)

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const changed = evaluateTraditionalEmployerPlanPenaltyPrerequisite(changedInput)
    expect(first.status).toBe('unsupported')
    expect(changed.status).toBe('unsupported')
    if (first.status !== 'unsupported' || changed.status !== 'unsupported') {
      throw new Error('expected provisional SEPP results')
    }
    expect(changed.evidence.seppAssessment).toMatchObject({
      characterCoverageEvidenceId: changed.evidence.characterCoverage.evidenceId,
      characterEvidenceIds: changed.evidence.characterCoverage.characterEvidenceIds,
    })
    expect(changed.evidence.seppAssessment?.evidenceId)
      .not.toBe(first.evidence.seppAssessment?.evidenceId)
  })

  it('does not qualify a SEPP election that starts before separation', () => {
    const value = input({ separationDate: '2029-12-31' })
    const sepp = currentSepp(value)
    sepp.election.electionStartDate = '2029-12-01'
    value.seppEvidence = sepp

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/election or current-payment identity/)
  })

  it('rejects collisions among immutable SEPP election, distribution, and state IDs', () => {
    const value = input({ separationDate: '2029-12-31' })
    const sepp = currentSepp(value)
    sepp.payment.currentDistributionEvidenceId = sepp.payment.scheduleStateAfterId
    value.seppEvidence = sepp

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/election or current-payment identity/)
  })

  it.each([
    ['stale before state', (sepp: CurrentSeppFixture) => {
      sepp.payment.actualQualifyingGrossAmountPaidBefore = asUsdCents(0)
    }],
    ['extra current gross', (sepp: CurrentSeppFixture) => {
      sepp.payment.currentDistributionGrossAmount = asUsdCents(61)
      sepp.payment.excessCurrentDistributionGrossAmount = asUsdCents(1)
    }],
    ['wrong taxable amount', (sepp: CurrentSeppFixture) => {
      sepp.payment.currentQualifyingTaxableAmount = asUsdCents(35)
    }],
    ['stale no-modification date', (sepp: CurrentSeppFixture) => {
      sepp.payment.noDisqualifyingModificationThroughDate = '2030-06-14'
    }],
  ] as const)('refuses %s as current SEPP qualification', (_name, mutate) => {
    const value = input({ separationDate: '2029-12-31' })
    const sepp = currentSepp(value)
    mutate(sepp)
    value.seppEvidence = sepp

    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted penalty')
    expect(result.evidence.outcome).toBe('penaltyApplies')
    expect(result.evidence.seppAssessment?.disposition).toBe('refused')
  })

  it('fails closed when SEPP status is absent', () => {
    const firstInput = input({ separationDate: '2029-12-31' })
    firstInput.seppEvidence = null
    const secondInput = input({ separationDate: '2029-12-31' })
    secondInput.disabilityEvidence = {
      ...rejectedDisability(),
      disabilityEvidenceId: 'alternate-not-disabled',
    }
    secondInput.seppEvidence = null

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const second = evaluateTraditionalEmployerPlanPenaltyPrerequisite(secondInput)
    expect(first).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-sepp-evidence-missing' }],
      evidence: {
        missingEvidence: 'sepp',
        disabilityEvidence: { disabilityEvidenceId: 'not-disabled' },
      },
    })
    expect(second.evidence.disabilityEvidence).toMatchObject({
      disabilityEvidenceId: 'alternate-not-disabled',
    })
    expect(first.evidence.evidenceId).not.toBe(second.evidence.evidenceId)
  })

  it('fails closed without an explicit negative other-exception attestation', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.otherExceptionAttestation = null

    expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
      status: 'unsupported',
      evidence: {
        missingEvidence: 'otherExceptionAttestation',
        disabilityEvidence: { qualifiedOnEvaluationDate: false },
        seppAssessment: { disposition: 'refused' },
      },
    })
  })

  it('preserves a positive unmodeled other-exception claim as unsupported', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.otherExceptionAttestation = otherAttestation(true)

    expect(evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'withdrawal-penalty-evidence-missing' }],
      evidence: {
        missingEvidence: 'otherExceptionAdjudication',
        otherExceptionAttestation: {
          otherExceptionClaimed: true,
          exceptionDescription: 'domestic-relations order',
        },
        disabilityEvidence: { qualifiedOnEvaluationDate: false },
        seppAssessment: { disposition: 'refused' },
      },
    })
  })

  it('rejects a blank positive other-exception claim', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.otherExceptionAttestation = {
      ...otherAttestation(true),
      exceptionDescription: ' ',
    }

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/exactly bind its claim/)
  })

  it('rejects taxable treatment not equal to exact ordinary-income character', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.taxableTreatmentAmount = asUsdCents(value.taxableTreatmentAmount - 1)

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/exactly bind identity and taxable treatment/)
  })

  it('rejects character evidence borrowed from another action', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.characterization = structuredClone(value.characterization)
    ;(value.characterization.taxCharacter[0] as { actionId: string }).actionId = 'foreign-action'

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/foreign or mismatched/)
  })

  it('canonicalizes character evidence IDs independent of equivalent segment order', () => {
    const firstInput = input({ separationDate: '2029-12-31' })
    const reorderedInput = input({ separationDate: '2029-12-31' })
    const reorderedCharacterization = structuredClone(reorderedInput.characterization)
    reorderedInput.characterization = {
      ...reorderedCharacterization,
      taxCharacter: [...reorderedCharacterization.taxCharacter].reverse(),
    }

    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(firstInput)
    const reordered = evaluateTraditionalEmployerPlanPenaltyPrerequisite(reorderedInput)
    expect(reordered.evidence.characterCoverage).toEqual(first.evidence.characterCoverage)
    expect(reordered.evidence.evidenceId).toBe(first.evidence.evidenceId)
  })

  it('rejects separation evidence from another sponsoring plan', () => {
    const value = input()
    ;(value.separationEvidence as { sourceAccountId: string }).sourceAccountId = 'foreign-plan'

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/named sponsoring plan/)
  })

  it('rejects a separation date that disagrees with accepted source availability', () => {
    const value = input({ separationDate: '2029-12-31' })
    value.separationEvidence = {
      ...value.separationEvidence!,
      separationDate: '2029-12-30',
    }

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/equal accepted source-availability evidence/)
  })

  it('rejects authoritative separation evidence dated before participant birth', () => {
    const value = input({ separationDate: '1975-06-14' })
    value.characterization = structuredClone(value.characterization)
    Reflect.set(value.characterization.acceptedSourceEligibility.availabilityEvidence, 'eventKind', 'inServiceWithdrawal')
    Reflect.set(value.characterization.acceptedSourceEligibility.availabilityEvidence, 'eventDate', '2030-01-02')

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value))
      .toThrow(/named sponsoring plan and participant/)
  })

  it('distinguishes arrays from objects in structural evidence identities', () => {
    const objectInput = input({ separationDate: '2029-12-31' })
    Reflect.set(objectInput.otherExceptionAttestation!, 'metadata', { a: 'b' })
    const arrayInput = input({ separationDate: '2029-12-31' })
    Reflect.set(arrayInput.otherExceptionAttestation!, 'metadata', [['a', 'b']])

    const objectResult = evaluateTraditionalEmployerPlanPenaltyPrerequisite(objectInput)
    const arrayResult = evaluateTraditionalEmployerPlanPenaltyPrerequisite(arrayInput)
    expect(objectResult.status).toBe('accepted')
    expect(arrayResult.status).toBe('accepted')
    expect(objectResult.evidence.evidenceId).not.toBe(arrayResult.evidence.evidenceId)
  })

  it('tags null-like and non-finite metadata distinctly in structural evidence identities', () => {
    const values = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0]
    const evidenceIds = values.map((metadata) => {
      const value = input({ separationDate: '2029-12-31' })
      Reflect.set(value.otherExceptionAttestation!, 'metadata', metadata)
      return evaluateTraditionalEmployerPlanPenaltyPrerequisite(value).evidence.evidenceId
    })

    expect(new Set(evidenceIds).size).toBe(values.length)
  })

  it('fails closed on cyclic evidence metadata without recursing indefinitely', () => {
    const value = input({ separationDate: '2029-12-31' })
    const metadata: Record<string, unknown> = {}
    metadata.self = metadata
    Reflect.set(value.otherExceptionAttestation!, 'metadata', metadata)

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toThrow(/acyclic/)
  })

  it('clones nested attestation metadata before freezing returned evidence', () => {
    const value = input({ separationDate: '2029-12-31' })
    const metadata = { nested: { retained: true } }
    Reflect.set(value.otherExceptionAttestation!, 'metadata', metadata)

    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected accepted penalty')
    const returned = Reflect.get(result.evidence.otherExceptionAssessment!.attestation, 'metadata') as typeof metadata
    expect(returned).not.toBe(metadata)
    expect(Object.isFrozen(returned.nested)).toBe(true)
    expect(Object.isFrozen(metadata.nested)).toBe(false)
    metadata.nested.retained = false
    expect(returned.nested.retained).toBe(true)
  })

  it('clones nested disability metadata before freezing returned evidence', () => {
    const value = input({ separationDate: '2029-12-31' })
    const metadata = { nested: { retained: true } }
    Reflect.set(value.disabilityEvidence!, 'metadata', metadata)

    const result = evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)
    expect(result.status).toBe('accepted')
    const returned = Reflect.get(result.evidence.disabilityEvidence!, 'metadata') as typeof metadata
    expect(returned).not.toBe(metadata)
    expect(Object.isFrozen(returned.nested)).toBe(true)
    expect(Object.isFrozen(metadata.nested)).toBe(false)
    metadata.nested.retained = false
    expect(returned.nested.retained).toBe(true)
  })

  it('rechecks persisted character account-balance bounds', () => {
    const overdrawn = input({ separationDate: '2029-12-31', executedAmount: 100, accountValue: 100, basis: 0 })
    overdrawn.characterization = structuredClone(overdrawn.characterization)
    const overdrawnBasis = overdrawn.characterization.acceptedSourceEligibility.basisEvidence
    Reflect.set(overdrawnBasis, 'executedAmount', asUsdCents(200))
    Reflect.set(overdrawnBasis, 'ordinaryIncomeAmount', asUsdCents(200))
    Reflect.set(overdrawn.characterization.taxCharacter[0]!, 'amount', asPositiveUsdCents(200))
    Reflect.set(overdrawn.characterization.taxCharacter[0]!.characterEvidence, 'segmentAmount', asPositiveUsdCents(200))
    overdrawn.taxableTreatmentAmount = asUsdCents(200)

    const excessBasis = input({ separationDate: '2029-12-31', executedAmount: 0, accountValue: 100, basis: 40 })
    excessBasis.characterization = structuredClone(excessBasis.characterization)
    const excessBasisEvidence = excessBasis.characterization.acceptedSourceEligibility.basisEvidence
    Reflect.set(excessBasisEvidence, 'afterTaxEmployeeBasisBeforeDistribution', asUsdCents(120))
    Reflect.set(excessBasisEvidence.aggregateBasisRatio, 'numeratorMinorUnits', asUsdCents(120))

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(overdrawn)).toThrow(/exactly bind/)
    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(excessBasis)).toThrow(/exactly bind/)
  })

  it.each([
    ['future event', 'eventDate', '2030-06-16'],
    ['noncanonical event', 'eventDate', '2030-1-02'],
    ['blank plan evidence', 'planTermsEvidenceId', ' '],
    ['unavailable event', 'availableOnEvaluationDate', false],
    ['unknown event kind', 'eventKind', 'unmodeledEvent'],
  ] as const)('revalidates accepted distribution availability: %s', (_name, field, replacement) => {
    const value = input()
    value.characterization = structuredClone(value.characterization)
    const availability = value.characterization.acceptedSourceEligibility.availabilityEvidence
    Reflect.set(availability, field, replacement)
    if (field === 'eventDate') Reflect.set(availability, 'eventKind', 'inServiceWithdrawal')

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toThrow()
  })

  it('binds authoritative source-availability facts into character coverage identity', () => {
    const first = input()
    const second = input()
    second.characterization = structuredClone(second.characterization)
    Reflect.set(second.characterization.acceptedSourceEligibility.availabilityEvidence, 'planTermsEvidenceId', 'alternate-plan-terms')

    const firstResult = evaluateTraditionalEmployerPlanPenaltyPrerequisite(first)
    const secondResult = evaluateTraditionalEmployerPlanPenaltyPrerequisite(second)
    expect(firstResult.evidence.characterCoverage.evidenceId)
      .not.toBe(secondResult.evidence.characterCoverage.evidenceId)
    expect(firstResult.evidence.evidenceId).not.toBe(secondResult.evidence.evidenceId)
  })

  it('rejects accepted source availability dated before participant birth', () => {
    const value = input({ birthDate: '1970-01-01', separationDate: null })
    value.characterization = structuredClone(value.characterization)
    Reflect.set(value.characterization.acceptedSourceEligibility.availabilityEvidence, 'eventDate', '1969-12-31')

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toThrow(/exactly bind/)
  })

  it('rejects authority evidence IDs reused across negative facts', () => {
    const value = input({ separationDate: '2029-12-31' })
    const reusedId = value.separationEvidence!.separationEvidenceId
    Reflect.set(value.disabilityEvidence!, 'disabilityEvidenceId', reusedId)
    Reflect.set(value.seppEvidence!, 'seppStatusEvidenceId', reusedId)
    Reflect.set(value.otherExceptionAttestation!, 'attestationEvidenceId', reusedId)

    expect(() => evaluateTraditionalEmployerPlanPenaltyPrerequisite(value)).toThrow(/distinct evidence IDs/)
  })

  it('returns stable deeply frozen structural evidence', () => {
    const first = evaluateTraditionalEmployerPlanPenaltyPrerequisite(
      input({ separationDate: '2029-12-31' }),
    )
    const second = evaluateTraditionalEmployerPlanPenaltyPrerequisite(
      input({ separationDate: '2029-12-31' }),
    )

    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.evidence)).toBe(true)
    expect(first.evidence.evidenceId).toMatch(/^employer-penalty-final:/)
  })
})
