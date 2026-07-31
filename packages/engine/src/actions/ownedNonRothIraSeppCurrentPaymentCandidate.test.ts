import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import {
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  type OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
  type OwnedNonRothIraSeppPriorPaymentHistoryWithoutId,
  type ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput,
} from './ownedNonRothIraSeppCurrentPaymentCandidate.js'

function canonicalCoverage(options: {
  grossAmount?: number
  openingBasisAmount?: number
  yearEndAmount?: number
  distributionDate?: string
} = {}): Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence> {
  const grossAmount = options.grossAmount ?? 100
  const openingBasisAmount = options.openingBasisAmount ?? 0
  const yearEndAmount = options.yearEndAmount ?? 0
  const distributionDate = options.distributionDate ?? '2030-06-01'
  const characterization = classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [asAccountId('ira-account')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEndAmount),
      evidenceId: 'complete-pool',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear: 2030,
    poolMembers: [{
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      yearEndApplicableBalanceAmount: asUsdCents(yearEndAmount),
      iraClassificationEvidenceId: 'classification',
      accountOwnershipEvidenceId: 'ownership',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(openingBasisAmount),
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
      scheduledDate: distributionDate,
      scheduledSequence: 1,
      grossAmount: asUsdCents(grossAmount),
    }],
    line8Conversions: [],
  })
  const prerequisite = evaluateOwnedNonRothIraPenaltyPrerequisites({
    characterization,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'traditional',
      evaluationDate: distributionDate,
      distributionDateEvidenceId: 'distribution-date',
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    }],
    simpleParticipationEvidence: [],
  })
  const coverage = prerequisite.coverage[0]
  if (coverage === undefined) throw new Error('Fixture lost coverage')
  return coverage
}

function input(options: {
  coverage?: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>
  priorPayment?: boolean
} = {}): ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput {
  const coverage = options.coverage ?? canonicalCoverage()
  const priorPayment = options.priorPayment === true
  const priorGross = priorPayment ? 100 : 0
  const priorDate = priorPayment ? '2030-05-01' : null
  const nextSequence = priorPayment ? 2 : 1
  const value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput = {
    ownerPersonId: asPersonId('owner'),
    taxYear: 2030,
    actionId: asActionId('action'),
    allocationId: asAllocationId('allocation'),
    characterCoverage: coverage,
    sourceEvidence: {
      predicate: 'ownedNonRothIraSeppSource',
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
      sourceEvidenceId: 'sepp-source',
    },
    electionEvidence: {
      predicate: 'ownedNonRothIraSeppElection',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      subtype: 'traditional',
      electionStartDate: '2030-01-01',
      method: 'fixedAmortization',
      electionEvidenceId: 'election-evidence',
    },
    annualScheduleEvidence: {
      predicate: 'ownedNonRothIraSeppAnnualSchedule',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      annualScheduledGrossAmount: asUsdCents(1_200),
      annualScheduleEvidenceId: 'annual-schedule',
    },
    noModificationEvidence: {
      predicate:
        'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      throughDate: '2030-12-31',
      disqualifyingModification: 'none',
      noModificationEvidenceId: 'no-modification',
    },
    openingStateEvidence: {
      predicate: 'ownedNonRothIraSeppAnnualOpeningState',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      priorHistoryTerminalStateId: 'prior-year-terminal-state',
      nextScheduledSequence: 1,
      scheduledGrossAmount: 0,
      actualQualifyingGrossAmount: 0,
      openingStateEvidenceId: 'derived-below',
    },
    priorHistoryEvidence: {
      predicate: 'ownedNonRothIraSeppPriorPaymentHistory',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      openingStateEvidenceId: 'derived-below',
      completedPaymentCount: priorPayment ? 1 : 0,
      usedCurrentDistributionEvidenceIds: priorPayment
        ? ['prior-distribution']
        : [],
      lastCompletedSequence: priorPayment ? 1 : 0,
      lastPaymentDate: priorDate,
      terminalStateEvidenceId: priorPayment
        ? 'prior-payment-terminal-state'
        : 'derived-below',
      scheduledGrossAmountThroughPriorPayments: asUsdCents(priorGross),
      actualQualifyingGrossAmountThroughPriorPayments:
        asUsdCents(priorGross),
      nextScheduledSequence: nextSequence,
      priorHistoryEvidenceId: 'derived-below',
    },
    currentPaymentEvidence: {
      predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
      electionId: 'election',
      scheduleId: 'schedule',
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      distributionDate: coverage.evaluationDate,
      currentDistributionEvidenceId:
        coverage.sourceEvidenceIds.distributionDateEvidenceId,
      paymentSequence: nextSequence,
      previousScheduleStateId: 'derived-below',
      currentScheduledGrossAmount: coverage.executedAmount,
      paymentScheduleEvidenceId: 'payment-schedule',
    },
  }
  const openingStateEvidenceId = expectedOpeningStateId(
    value.openingStateEvidence!,
  )
  value.openingStateEvidence = {
    ...value.openingStateEvidence!,
    openingStateEvidenceId,
  }
  value.priorHistoryEvidence = {
    ...value.priorHistoryEvidence!,
    openingStateEvidenceId,
    terminalStateEvidenceId: priorPayment
      ? value.priorHistoryEvidence!.terminalStateEvidenceId
      : openingStateEvidenceId,
  }
  value.currentPaymentEvidence = {
    ...value.currentPaymentEvidence!,
    previousScheduleStateId: expectedBeforeStateId(value),
  }
  return value
}

function expectedOpeningStateId(
  opening: NonNullable<
    ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput[
      'openingStateEvidence'
    ]
  >,
): string {
  const lineage = {
    predicate: opening.predicate,
    electionId: opening.electionId,
    scheduleId: opening.scheduleId,
    participantPersonId: opening.participantPersonId,
    sourceAccountId: opening.sourceAccountId,
    taxYear: opening.taxYear,
    priorHistoryTerminalStateId:
      opening.priorHistoryTerminalStateId,
    nextScheduledSequence: opening.nextScheduledSequence,
    scheduledGrossAmount: opening.scheduledGrossAmount,
    actualQualifyingGrossAmount:
      opening.actualQualifyingGrossAmount,
  }
  return `owned-ira-sepp-annual-opening-state:${JSON.stringify([
    lineage,
  ])}`
}

function expectedBeforeStateId(
  value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput,
): string {
  const history = value.priorHistoryEvidence!
  const historyWithoutId: OwnedNonRothIraSeppPriorPaymentHistoryWithoutId = {
    predicate: history.predicate,
    electionId: history.electionId,
    scheduleId: history.scheduleId,
    participantPersonId: history.participantPersonId,
    sourceAccountId: history.sourceAccountId,
    taxYear: history.taxYear,
    openingStateEvidenceId: history.openingStateEvidenceId,
    completedPaymentCount: history.completedPaymentCount,
    usedCurrentDistributionEvidenceIds: history.usedCurrentDistributionEvidenceIds,
    lastCompletedSequence: history.lastCompletedSequence,
    lastPaymentDate: history.lastPaymentDate,
    terminalStateEvidenceId: history.terminalStateEvidenceId!,
    scheduledGrossAmountThroughPriorPayments:
      history.scheduledGrossAmountThroughPriorPayments,
    actualQualifyingGrossAmountThroughPriorPayments:
      history.actualQualifyingGrossAmountThroughPriorPayments,
    nextScheduledSequence: history.nextScheduledSequence,
  }
  value.priorHistoryEvidence =
    buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(historyWithoutId)
  return historyWithoutId.terminalStateEvidenceId
}

function issueKinds(
  result: ReturnType<
    typeof validateOwnedNonRothIraSeppCurrentPaymentCandidate
  >,
): string[] {
  return result.status === 'provisionalCandidate'
    ? []
    : result.issues.map((issue) => issue.kind)
}

describe('validateOwnedNonRothIraSeppCurrentPaymentCandidate', () => {
  it('builds deterministic detached populated prior-payment history', () => {
    const seed = input({ priorPayment: true }).priorHistoryEvidence!
    const usedIds = ['prior-z', 'prior-a']
    let toJsonCalls = 0
    const withoutId = Object.assign({
      predicate: seed.predicate,
      electionId: seed.electionId,
      scheduleId: seed.scheduleId,
      participantPersonId: seed.participantPersonId,
      sourceAccountId: seed.sourceAccountId,
      taxYear: seed.taxYear,
      openingStateEvidenceId: seed.openingStateEvidenceId,
      completedPaymentCount: seed.completedPaymentCount,
      usedCurrentDistributionEvidenceIds: usedIds,
      lastCompletedSequence: seed.lastCompletedSequence,
      lastPaymentDate: seed.lastPaymentDate,
      terminalStateEvidenceId: seed.terminalStateEvidenceId!,
      scheduledGrossAmountThroughPriorPayments:
        seed.scheduledGrossAmountThroughPriorPayments,
      actualQualifyingGrossAmountThroughPriorPayments:
        seed.actualQualifyingGrossAmountThroughPriorPayments,
      nextScheduledSequence: seed.nextScheduledSequence,
      ignoredExtra: 'not structural',
    }, {
      toJSON: () => {
        toJsonCalls += 1
        return undefined
      },
    })
    const built = buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(
      withoutId,
    )
    usedIds.push('mutated-after-build')
    const reordered = buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence({
      ...withoutId,
      usedCurrentDistributionEvidenceIds: ['prior-z', 'prior-a'],
    })

    expect(built).toEqual(reordered)
    expect(toJsonCalls).toBe(0)
    expect(built.usedCurrentDistributionEvidenceIds).toEqual([
      'prior-a',
      'prior-z',
    ])
    expect(Object.isFrozen(built)).toBe(true)
    expect(Object.isFrozen(built.usedCurrentDistributionEvidenceIds)).toBe(true)
    expect(() => buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence({
      ...withoutId,
      usedCurrentDistributionEvidenceIds: ['duplicate', 'duplicate'],
    })).toThrow('must be unique')
    expect(() => buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence({
      ...withoutId,
      lastPaymentDate: '2030-02-30',
    })).toThrow('canonical civil ISO date')
    expect(() => buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence({
      ...withoutId,
      predicate: 'wrong-prior-history-predicate',
    } as unknown as OwnedNonRothIraSeppPriorPaymentHistoryWithoutId)).toThrow(
      'predicate',
    )
  })

  it('returns only a provisional first-payment transition with no authority', () => {
    const value = input()
    const result = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      value,
    )

    expect(result).toMatchObject({
      status: 'provisionalCandidate',
      qualification: 'pendingAnnualReconciliation',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      penaltyTreatment: 'notEstablished',
      candidate: {
        paymentSequence: 1,
        scheduledGrossAmount: 100,
        actualGrossAmount: 100,
        basisReturnExcludedAmount: 0,
        prospectiveOrdinaryIncomeAmount: 100,
        beforeState: {
          completedPaymentCount: 0,
          nextScheduledSequence: 1,
          scheduledGrossAmount: 0,
          actualQualifyingGrossAmount: 0,
        },
        afterState: {
          completedPaymentCount: 1,
          lastCompletedSequence: 1,
          nextScheduledSequence: 2,
          scheduledGrossAmount: 100,
          actualQualifyingGrossAmount: 100,
        },
      },
    })
    expect(result).not.toHaveProperty('iraSeppQualified')
    expect(result).not.toHaveProperty('finalPenaltyAmount')
    expect(result).not.toHaveProperty('finalEvidenceId')
    if (result.status !== 'provisionalCandidate') return
    expect(result.candidate.beforeState.stateEvidenceId).toBe(
      value.openingStateEvidence!.openingStateEvidenceId,
    )
    expect(result.candidate).not.toHaveProperty('penaltyRate')
    expect(result.candidate).not.toHaveProperty('penaltyAmount')
    expect(result.candidate).not.toHaveProperty('finalizationEvidenceId')
    expect(result.candidate).not.toHaveProperty('bindingEvidenceId')
    expect(result.candidate).not.toHaveProperty('readinessEvidenceId')
  })

  it('advances an exactly proved prior state and contiguous sequence', () => {
    const value = input({ priorPayment: true })
    const result = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      value,
    )

    expect(result).toMatchObject({
      status: 'provisionalCandidate',
      candidate: {
        paymentSequence: 2,
        beforeState: {
          completedPaymentCount: 1,
          lastCompletedSequence: 1,
          lastPaymentDate: '2030-05-01',
          scheduledGrossAmount: 100,
          actualQualifyingGrossAmount: 100,
        },
        afterState: {
          completedPaymentCount: 2,
          lastCompletedSequence: 2,
          lastPaymentDate: '2030-06-01',
          nextScheduledSequence: 3,
          scheduledGrossAmount: 200,
          actualQualifyingGrossAmount: 200,
        },
      },
    })
    if (result.status !== 'provisionalCandidate') return
    expect(result.candidate.beforeState.stateEvidenceId).toBe(
      value.priorHistoryEvidence!.terminalStateEvidenceId,
    )
    expect(value.currentPaymentEvidence!.previousScheduleStateId).toBe(
      result.candidate.beforeState.stateEvidenceId,
    )
  })

  it('preserves legacy empty-history inputs but fails closed on populated history without terminal proof', () => {
    const legacyEmpty = input()
    legacyEmpty.priorHistoryEvidence = {
      ...legacyEmpty.priorHistoryEvidence!,
      terminalStateEvidenceId: undefined,
      priorHistoryEvidenceId: 'legacy-arbitrary-empty-history-id',
    }
    legacyEmpty.currentPaymentEvidence = {
      ...legacyEmpty.currentPaymentEvidence!,
      previousScheduleStateId:
        legacyEmpty.openingStateEvidence!.openingStateEvidenceId,
    }
    expect(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(legacyEmpty).status,
    ).toBe('provisionalCandidate')

    const legacyPopulated = input({ priorPayment: true })
    legacyPopulated.priorHistoryEvidence = {
      ...legacyPopulated.priorHistoryEvidence!,
      terminalStateEvidenceId: undefined,
      priorHistoryEvidenceId: 'legacy-populated-history-id',
    }
    expect(() =>
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(legacyPopulated),
    ).not.toThrow()
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(legacyPopulated),
    )).toContain('priorHistoryBindingMismatch')
  })

  it('returns an explicit issue for every missing evidence class', () => {
    const value = input()
    delete value.characterCoverage
    delete value.electionEvidence
    delete value.priorHistoryEvidence

    const result = validateOwnedNonRothIraSeppCurrentPaymentCandidate(value)
    expect(result).toMatchObject({
      status: 'evidenceMissing',
      candidate: null,
      issues: [
        { kind: 'evidenceMissing', evidence: 'characterCoverage' },
        { kind: 'evidenceMissing', evidence: 'electionEvidence' },
        { kind: 'evidenceMissing', evidence: 'priorHistoryEvidence' },
      ],
    })
  })

  it.each([
    ['owner', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.ownerPersonId = asPersonId('other-owner')
    }],
    ['source', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        sourceAccountId: asAccountId('other-source'),
      }
    }],
    ['action', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        actionId: asActionId('other-action'),
      }
    }],
    ['allocation', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        allocationId: asAllocationId('other-allocation'),
      }
    }],
    ['date', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        distributionDate: '2030-06-02',
      }
    }],
    ['distribution evidence', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        currentDistributionEvidenceId: 'other-distribution',
      }
    }],
    ['year', (value: ValidateOwnedNonRothIraSeppCurrentPaymentCandidateInput) => {
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        distributionDate: '2031-06-01',
      }
    }],
  ])('fails closed on a wrong current-payment %s binding', (_label, mutate) => {
    const value = input()
    mutate(value)
    const result = validateOwnedNonRothIraSeppCurrentPaymentCandidate(value)
    expect(result.status).toBe('notLocallyConforming')
    expect(issueKinds(result)).toContain('canonicalBindingMismatch')
  })

  it('requires an exact owned, non-inherited IRA source and named election owner', () => {
    const foreignSource = input()
    foreignSource.sourceEvidence = {
      ...foreignSource.sourceEvidence!,
      inheritanceStatus: 'inherited',
    } as unknown as typeof foreignSource.sourceEvidence
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(foreignSource),
    )).toContain('sourceNotOwnedNonRothIra')

    const foreignParticipant = input()
    foreignParticipant.electionEvidence = {
      ...foreignParticipant.electionEvidence!,
      participantPersonId: asPersonId('other-owner'),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(
        foreignParticipant,
      ),
    )).toContain('electionBindingMismatch')
  })

  it('rejects tampered canonical character coverage and its structural ID', () => {
    const amountTamper = input()
    amountTamper.characterCoverage = {
      ...amountTamper.characterCoverage!,
      basisReturnExcludedAmount: asUsdCents(1),
      ordinaryIncomeExposureAmount: asUsdCents(99),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(amountTamper),
    )).toContain('canonicalBindingMismatch')

    const idTamper = input()
    idTamper.characterCoverage = {
      ...idTamper.characterCoverage!,
      evidenceId: 'counterfeit-coverage-id',
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(idTamper),
    )).toContain('canonicalBindingMismatch')
  })

  it('rejects unsupported methods and elections starting after payment', () => {
    const value = input()
    value.electionEvidence = {
      ...value.electionEvidence!,
      method: 'unsupported' as 'fixedAmortization',
      electionStartDate: '2030-06-02',
    }
    const kinds = issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )
    expect(kinds).toContain('unsupportedMethod')
    expect(kinds).toContain('electionStartsAfterDistribution')
  })

  it('requires no-modification coverage through the current payment date', () => {
    const value = input()
    value.noModificationEvidence = {
      ...value.noModificationEvidence!,
      throughDate: '2030-05-31',
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )).toContain('modificationEvidenceInsufficient')
  })

  it('requires the opening evidence ID to bind its prior-history terminal state', () => {
    const value = input()
    value.openingStateEvidence = {
      ...value.openingStateEvidence!,
      priorHistoryTerminalStateId: 'different-terminal-state',
    }

    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )).toContain('openingStateBindingMismatch')
  })

  it.each([99, 101])(
    'rejects a %i-cent scheduled gross against canonical 100-cent execution',
    (currentScheduledGrossAmount) => {
      const value = input()
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        currentScheduledGrossAmount: asUsdCents(
          currentScheduledGrossAmount,
        ),
      }
      expect(issueKinds(
        validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
      )).toContain('currentGrossMismatch')
    },
  )

  it('rejects discontinuous sequence and a wrong previous-state reference', () => {
    const value = input({ priorPayment: true })
    value.currentPaymentEvidence = {
      ...value.currentPaymentEvidence!,
      paymentSequence: 3,
      previousScheduleStateId: 'wrong-previous-state',
    }
    const kinds = issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )
    expect(kinds).toContain('paymentSequenceNotContiguous')
    expect(kinds).toContain('previousStateMismatch')
  })

  it('rejects prior-history dates outside the annual/election chain or after the current payment', () => {
    const wrongYear = input({ priorPayment: true })
    wrongYear.priorHistoryEvidence = {
      ...wrongYear.priorHistoryEvidence!,
      lastPaymentDate: '2029-12-31',
    }
    wrongYear.currentPaymentEvidence = {
      ...wrongYear.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(wrongYear),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(wrongYear),
    )).toContain('priorHistoryBindingMismatch')

    const future = input({ priorPayment: true })
    future.priorHistoryEvidence = {
      ...future.priorHistoryEvidence!,
      lastPaymentDate: '2030-06-02',
    }
    future.currentPaymentEvidence = {
      ...future.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(future),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(future),
    )).toContain('paymentDateBreaksContinuity')
  })

  it('rejects prior actual gross excess and annual scheduled excess', () => {
    const chain = input({ priorPayment: true })
    chain.priorHistoryEvidence = {
      ...chain.priorHistoryEvidence!,
      actualQualifyingGrossAmountThroughPriorPayments:
        asUsdCents(99),
    }
    chain.currentPaymentEvidence = {
      ...chain.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(chain),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(chain),
    )).toContain('grossChainInvalid')

    const annual = input()
    annual.annualScheduleEvidence = {
      ...annual.annualScheduleEvidence!,
      annualScheduledGrossAmount: asUsdCents(99),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(annual),
    )).toContain('annualScheduledAmountExceeded')
  })

  it('reports overflow before converting derived totals to JavaScript numbers', () => {
    const value = input({ priorPayment: true })
    value.priorHistoryEvidence = {
      ...value.priorHistoryEvidence!,
      scheduledGrossAmountThroughPriorPayments:
        asUsdCents(Number.MAX_SAFE_INTEGER),
      actualQualifyingGrossAmountThroughPriorPayments:
        asUsdCents(Number.MAX_SAFE_INTEGER),
    }
    value.currentPaymentEvidence = {
      ...value.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(value),
    }
    value.annualScheduleEvidence = {
      ...value.annualScheduleEvidence!,
      annualScheduledGrossAmount: asUsdCents(Number.MAX_SAFE_INTEGER),
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )).toContain('safeIntegerOverflow')
  })

  it('keeps basis outside prospective ordinary income, including all-basis gross', () => {
    const partial = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      input({
        coverage: canonicalCoverage({
          openingBasisAmount: 100,
          yearEndAmount: 100,
        }),
      }),
    )
    expect(partial).toMatchObject({
      status: 'provisionalCandidate',
      candidate: {
        scheduledGrossAmount: 100,
        basisReturnExcludedAmount: 50,
        prospectiveOrdinaryIncomeAmount: 50,
      },
    })

    const allBasis = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      input({
        coverage: canonicalCoverage({
          openingBasisAmount: 200,
          yearEndAmount: 100,
        }),
      }),
    )
    expect(allBasis).toMatchObject({
      status: 'provisionalCandidate',
      qualification: 'pendingAnnualReconciliation',
      penaltyTreatment: 'notEstablished',
      candidate: {
        scheduledGrossAmount: 100,
        actualGrossAmount: 100,
        basisReturnExcludedAmount: 100,
        prospectiveOrdinaryIncomeAmount: 0,
        sourceEvidenceId: 'sepp-source',
      },
    })
  })

  it('is deterministic, materially ID-sensitive, detached, and deeply frozen', () => {
    const baselineInput = input()
    const before = structuredClone(baselineInput)
    const baseline = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      baselineInput,
    )
    expect(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(input()),
    ).toEqual(baseline)
    expect(baselineInput).toEqual(before)
    expect(Object.isFrozen(baseline)).toBe(true)
    expect(Object.isFrozen(baseline.candidate)).toBe(true)
    if (baseline.status !== 'provisionalCandidate') return
    expect(Object.isFrozen(baseline.candidate.beforeState)).toBe(true)
    expect(Object.isFrozen(baseline.candidate.afterState)).toBe(true)

    const changedInput = input()
    changedInput.noModificationEvidence = {
      ...changedInput.noModificationEvidence!,
      noModificationEvidenceId: 'revised-no-modification',
    }
    const changed = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      changedInput,
    )
    expect(changed.status).toBe('provisionalCandidate')
    if (changed.status !== 'provisionalCandidate') return
    expect(changed.candidate.candidateId).not.toBe(
      baseline.candidate.candidateId,
    )

    baselineInput.currentPaymentEvidence = {
      ...baselineInput.currentPaymentEvidence!,
      paymentScheduleEvidenceId: 'mutated',
    }
    expect(baseline.candidate.paymentScheduleEvidenceId).toBe(
      'payment-schedule',
    )
  })

  it('canonicalizes the complete prior-distribution ID set', () => {
    const makeHistory = (usedCurrentDistributionEvidenceIds: string[]) => {
      const value = input({ priorPayment: true })
      value.priorHistoryEvidence = {
        ...value.priorHistoryEvidence!,
        completedPaymentCount: 2,
        usedCurrentDistributionEvidenceIds,
        lastCompletedSequence: 2,
        scheduledGrossAmountThroughPriorPayments: asUsdCents(200),
        actualQualifyingGrossAmountThroughPriorPayments: asUsdCents(200),
        nextScheduledSequence: 3,
      }
      value.currentPaymentEvidence = {
        ...value.currentPaymentEvidence!,
        paymentSequence: 3,
        previousScheduleStateId: expectedBeforeStateId(value),
      }
      return value
    }

    const forward = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      makeHistory(['prior-a', 'prior-b']),
    )
    const reversed = validateOwnedNonRothIraSeppCurrentPaymentCandidate(
      makeHistory(['prior-b', 'prior-a']),
    )

    expect(forward).toEqual(reversed)
  })

  it('throws on malformed dates and replayed evidence IDs', () => {
    const malformed = input()
    malformed.currentPaymentEvidence = {
      ...malformed.currentPaymentEvidence!,
      distributionDate: '2030-02-30',
    }
    expect(() =>
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(malformed),
    ).toThrow(/canonical civil ISO date/)

    const replayed = input()
    replayed.currentPaymentEvidence = {
      ...replayed.currentPaymentEvidence!,
      paymentScheduleEvidenceId:
        replayed.priorHistoryEvidence!.priorHistoryEvidenceId,
    }
    expect(() =>
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(replayed),
    ).toThrow(/must not be reused/)

    const historicalCrossKindCollision = input({ priorPayment: true })
    historicalCrossKindCollision.priorHistoryEvidence = {
      ...historicalCrossKindCollision.priorHistoryEvidence!,
      usedCurrentDistributionEvidenceIds: ['payment-schedule'],
    }
    historicalCrossKindCollision.currentPaymentEvidence = {
      ...historicalCrossKindCollision.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(
        historicalCrossKindCollision,
      ),
    }
    expect(() =>
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(
        historicalCrossKindCollision,
      ),
    ).toThrow(/must not be reused/)
  })

  it('rejects a current distribution replayed from complete prior history', () => {
    const value = input({ priorPayment: true })
    value.priorHistoryEvidence = {
      ...value.priorHistoryEvidence!,
      usedCurrentDistributionEvidenceIds: ['distribution-date'],
    }
    value.currentPaymentEvidence = {
      ...value.currentPaymentEvidence!,
      previousScheduleStateId: expectedBeforeStateId(value),
    }

    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(value),
    )).toContain('currentDistributionReplay')
  })

  it('requires prior used-distribution IDs to be complete, nonblank, and unique', () => {
    const incomplete = input({ priorPayment: true })
    incomplete.priorHistoryEvidence = {
      ...incomplete.priorHistoryEvidence!,
      usedCurrentDistributionEvidenceIds: [],
    }
    expect(issueKinds(
      validateOwnedNonRothIraSeppCurrentPaymentCandidate(incomplete),
    )).toContain('priorHistoryBindingMismatch')

    for (const ids of [['prior', 'prior'], ['']]) {
      const malformed = input({ priorPayment: true })
      malformed.priorHistoryEvidence = {
        ...malformed.priorHistoryEvidence!,
        usedCurrentDistributionEvidenceIds: ids,
      }
      expect(() =>
        validateOwnedNonRothIraSeppCurrentPaymentCandidate(malformed),
      ).toThrow(/nonblank|must be unique/)
    }
  })
})
