import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import {
  evaluateOwnedNonRothIraPenaltyPrerequisites,
  type OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence,
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
  reconcileOwnedNonRothIraSeppAnnualSchedule,
  type OwnedNonRothIraSeppAnnualDistributionInventoryEvidence,
  type OwnedNonRothIraSeppAnnualDistributionInventoryWithoutId,
  type OwnedNonRothIraSeppAnnualRawPaymentEvidence,
  type OwnedNonRothIraSeppAnnualReconciledPaymentEvidence,
  type OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
  type OwnedNonRothIraSeppCompletePriorElectionHistoryWithoutId,
  type ReconcileOwnedNonRothIraSeppAnnualScheduleInput,
} from './ownedNonRothIraSeppAnnualReconciliation.js'
import {
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
  type OwnedNonRothIraSeppCurrentPaymentEvidence,
  type OwnedNonRothIraSeppNonconformanceKind,
  type OwnedNonRothIraSeppPriorPaymentHistoryEvidence,
} from './ownedNonRothIraSeppCurrentPaymentCandidate.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  coverageEvidenceIdParts,
  mintCoverageEvidenceId,
} from './ownedNonRothIraPenaltyCoverageEvidenceId.js'

function coverageOrder(
  left: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
  right: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
): number {
  return compareUtf16CodeUnits(left.evaluationDate, right.evaluationDate) ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
    compareUtf16CodeUnits(left.evidenceId, right.evidenceId)
}

function canonicalCoverages(options: {
  amounts: readonly number[]
  dates: readonly string[]
  openingBasisAmount?: number
}): readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[] {
  const line7Distributions = options.amounts.map((amount, index) => ({
    actionId: asActionId(`action-${index + 1}`),
    allocationId: asAllocationId(`allocation-${index + 1}`),
    sourceAccountId: asAccountId('ira-account'),
    scheduledDate: options.dates[index]!,
    scheduledSequence: index + 1,
    grossAmount: asUsdCents(amount),
  }))
  const gross = options.amounts.reduce((sum, amount) => sum + amount, 0)
  const characterization = classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [asAccountId('ira-account')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
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
      yearEndApplicableBalanceAmount: asUsdCents(0),
      iraClassificationEvidenceId: 'classification',
      accountOwnershipEvidenceId: 'ownership',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(options.openingBasisAmount ?? 0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(gross),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions,
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
    sourceEvidence: options.amounts.map((_amount, index) => ({
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal' as const,
      actionId: asActionId(`action-${index + 1}`),
      allocationId: asAllocationId(`allocation-${index + 1}`),
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'traditional' as const,
      evaluationDate: options.dates[index]!,
      distributionDateEvidenceId: `distribution-date-${index + 1}`,
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    })),
    simpleParticipationEvidence: [],
  })
  return [...prerequisite.coverage].sort(coverageOrder)
}

function inventory(
  records: readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[],
): OwnedNonRothIraSeppAnnualDistributionInventoryEvidence {
  const withoutId = {
    predicate: 'completeOwnedNonRothIraSeppAnnualDistributionInventory' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    characterCoverages: [...records].sort(coverageOrder),
  }
  return buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence(
    withoutId,
  )
}

function uncheckedInventory(
  records: readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[],
): OwnedNonRothIraSeppAnnualDistributionInventoryEvidence {
  const withoutId = {
    predicate: 'completeOwnedNonRothIraSeppAnnualDistributionInventory' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    characterCoverages: [...records].sort(coverageOrder),
  }
  return {
    ...withoutId,
    inventoryEvidenceId: deriveActionStructuralId(
      'owned-ira-sepp-annual-distribution-inventory',
      [withoutId],
    ),
  }
}

function priorElectionHistory(options: {
  usedIds?: readonly string[]
  historyThroughDate?: string
} = {}): OwnedNonRothIraSeppCompletePriorElectionHistoryEvidence {
  const usedIds = [...(options.usedIds ?? ['prior-lifetime-distribution'])].sort()
  const withoutId = {
    predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    historyThroughDate: options.historyThroughDate ?? '2029-12-31',
    terminalStateEvidenceId: 'prior-year-terminal-state',
    usedDistributionEvidenceIds: usedIds,
  }
  return buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence(
    withoutId,
  )
}

function openingEvidence() {
  const lineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    priorHistoryTerminalStateId: 'prior-year-terminal-state',
    nextScheduledSequence: 1 as const,
    scheduledGrossAmount: 0 as const,
    actualQualifyingGrossAmount: 0 as const,
  }
  return {
    ...lineage,
    openingStateEvidenceId: deriveActionStructuralId(
      'owned-ira-sepp-annual-opening-state',
      [lineage],
    ),
  }
}

function buildInput(options: {
  amounts?: readonly number[]
  dates?: readonly string[]
  annualAmount?: number
  openingBasisAmount?: number
  sourceEvidenceId?: string
  lifetimeIds?: readonly string[]
} = {}): ReconcileOwnedNonRothIraSeppAnnualScheduleInput {
  const amounts = options.amounts ?? [100]
  const dates = options.dates ?? amounts.map(
    (_amount, index) => `2030-${String(index + 1).padStart(2, '0')}-15`,
  )
  const coverages = canonicalCoverages({
    amounts,
    dates,
    openingBasisAmount: options.openingBasisAmount,
  })
  const annualAmount = options.annualAmount ??
    amounts.reduce((sum, amount) => sum + amount, 0)
  const sourceEvidence = {
    predicate: 'ownedNonRothIraSeppSource' as const,
    sourceAccountId: asAccountId('ira-account'),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional' as const,
    accountKind: 'ira' as const,
    inheritanceStatus: 'owned' as const,
    subtype: 'traditional' as const,
    accountOwnershipEvidenceId: 'ownership',
    iraClassificationEvidenceId: 'classification',
    sourceEvidenceId: options.sourceEvidenceId ?? 'sepp-source',
  }
  const electionEvidence = {
    predicate: 'ownedNonRothIraSeppElection' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    subtype: 'traditional' as const,
    electionStartDate: '2029-01-01',
    method: 'fixedAmortization' as const,
    electionEvidenceId: 'election-evidence',
  }
  const annualScheduleEvidence = {
    predicate: 'ownedNonRothIraSeppAnnualSchedule' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    annualScheduledGrossAmount: asUsdCents(annualAmount),
    annualScheduleEvidenceId: 'annual-schedule',
  }
  const noModificationEvidence = {
    predicate: 'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    throughDate: '2030-12-31',
    disqualifyingModification: 'none' as const,
    noModificationEvidenceId: 'no-modification',
  }
  const openingStateEvidence = openingEvidence()
  const payments: OwnedNonRothIraSeppAnnualRawPaymentEvidence[] = []
  const reconciledPayments: OwnedNonRothIraSeppAnnualReconciledPaymentEvidence[] = []
  const usedDistributionIds: string[] = []
  let scheduledTotal = 0
  let actualTotal = 0
  let previousTerminalStateId = openingStateEvidence.openingStateEvidenceId

  for (let index = 0; index < coverages.length; index += 1) {
    const coverage = coverages[index]!
    const historyWithoutId = {
      predicate: 'ownedNonRothIraSeppPriorPaymentHistory' as const,
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      openingStateEvidenceId: openingStateEvidence.openingStateEvidenceId,
      completedPaymentCount: index,
      usedCurrentDistributionEvidenceIds: [...usedDistributionIds].sort(),
      lastCompletedSequence: index,
      lastPaymentDate: index === 0 ? null : coverages[index - 1]!.evaluationDate,
      terminalStateEvidenceId: previousTerminalStateId,
      scheduledGrossAmountThroughPriorPayments: asUsdCents(scheduledTotal),
      actualQualifyingGrossAmountThroughPriorPayments: asUsdCents(actualTotal),
      nextScheduledSequence: index + 1,
    }
    const history: OwnedNonRothIraSeppPriorPaymentHistoryEvidence =
      buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(historyWithoutId)
    const currentPaymentEvidence = {
      predicate: 'ownedNonRothIraSeppCurrentScheduledPayment' as const,
      electionId: 'election',
      scheduleId: 'schedule',
      actionId: coverage.actionId,
      allocationId: coverage.allocationId,
      sourceAccountId: asAccountId('ira-account'),
      distributionDate: coverage.evaluationDate,
      currentDistributionEvidenceId:
        coverage.sourceEvidenceIds.distributionDateEvidenceId,
      paymentSequence: index + 1,
      previousScheduleStateId: previousTerminalStateId,
      currentScheduledGrossAmount: coverage.executedAmount,
      paymentScheduleEvidenceId: `payment-schedule-${index + 1}`,
    }
    const candidateResult =
      validateOwnedNonRothIraSeppCurrentPaymentCandidate({
        ownerPersonId: asPersonId('owner'),
        taxYear: 2030,
        actionId: coverage.actionId,
        allocationId: coverage.allocationId,
        characterCoverage: coverage,
        sourceEvidence,
        electionEvidence,
        annualScheduleEvidence,
        noModificationEvidence,
        openingStateEvidence,
        priorHistoryEvidence: history,
        currentPaymentEvidence,
      })
    if (candidateResult.status !== 'provisionalCandidate') {
      throw new Error(`Fixture payment ${index + 1} did not validate`)
    }
    const candidate = candidateResult.candidate
    reconciledPayments.push({
      predicate: 'ownedNonRothIraSeppAnnualReconciledPayment',
      actionId: candidate.actionId,
      allocationId: candidate.allocationId,
      distributionDate: candidate.distributionDate,
      paymentSequence: candidate.paymentSequence,
      scheduledGrossAmount: candidate.scheduledGrossAmount,
      actualGrossAmount: candidate.actualGrossAmount,
      basisReturnExcludedAmount: candidate.basisReturnExcludedAmount,
      prospectiveOrdinaryIncomeAmount: candidate.prospectiveOrdinaryIncomeAmount,
      characterCoverageEvidenceId: candidate.characterCoverageEvidenceId,
      currentDistributionEvidenceId: candidate.currentDistributionEvidenceId,
      paymentScheduleEvidenceId: candidate.paymentScheduleEvidenceId,
      priorHistoryEvidenceId: history.priorHistoryEvidenceId,
      beforeStateEvidenceId: candidate.beforeState.stateEvidenceId,
      afterStateEvidenceId: candidate.afterState.stateEvidenceId,
      currentPaymentCandidateId: candidate.candidateId,
    })
    payments.push({ currentPaymentEvidence })
    usedDistributionIds.push(currentPaymentEvidence.currentDistributionEvidenceId)
    scheduledTotal += candidate.scheduledGrossAmount
    actualTotal += candidate.actualGrossAmount
    previousTerminalStateId = candidate.afterState.stateEvidenceId
  }

  return {
    ownerPersonId: asPersonId('owner'),
    taxYear: 2030,
    sourceEvidence,
    electionEvidence,
    annualScheduleEvidence,
    noModificationEvidence,
    openingStateEvidence,
    priorElectionHistoryEvidence: priorElectionHistory({
      usedIds: options.lifetimeIds,
    }),
    distributionInventory: inventory(coverages),
    payments,
  }
}

function issueKinds(
  result: ReturnType<typeof reconcileOwnedNonRothIraSeppAnnualSchedule>,
): string[] {
  return result.status === 'reconciled'
    ? []
    : result.issues.map((issue) => issue.kind)
}

function replaceFirstPayment(
  value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput,
  changes: Partial<OwnedNonRothIraSeppCurrentPaymentEvidence>,
): void {
  const [first, ...rest] = value.payments!
  if (first === undefined) throw new Error('Fixture lost its first payment')
  value.payments = [{
    ...first,
    currentPaymentEvidence: {
      ...first.currentPaymentEvidence,
      ...changes,
    },
  }, ...rest]
}

describe('reconcileOwnedNonRothIraSeppAnnualSchedule', () => {
  it('builds deterministic detached annual inventory evidence', () => {
    const records = [...canonicalCoverages({
      amounts: [50, 50],
      dates: ['2030-02-15', '2030-01-15'],
    })]
    let toJsonCalls = 0
    const withoutId: OwnedNonRothIraSeppAnnualDistributionInventoryWithoutId =
      Object.assign({
        predicate:
          'completeOwnedNonRothIraSeppAnnualDistributionInventory' as const,
        electionId: 'election',
        scheduleId: 'schedule',
        participantPersonId: asPersonId('owner'),
        sourceAccountId: asAccountId('ira-account'),
        taxYear: 2030,
        characterCoverages: records,
        ignoredExtra: 'not structural',
      }, {
        toJSON: () => {
          toJsonCalls += 1
          return undefined
        },
      })
    const built =
      buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence(withoutId)
    records.length = 0
    const reordered =
      buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence({
        ...withoutId,
        characterCoverages: [...built.characterCoverages].reverse(),
      })

    expect(built).toEqual(reordered)
    expect(toJsonCalls).toBe(0)
    expect(built.characterCoverages).toHaveLength(2)
    expect(Object.isFrozen(built)).toBe(true)
    expect(Object.isFrozen(built.characterCoverages)).toBe(true)
    expect(Object.isFrozen(built.characterCoverages[0])).toBe(true)
    expect(() =>
      buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence({
        ...withoutId,
        characterCoverages: [{
          ...built.characterCoverages[0]!,
          evidenceId: 'not-canonical',
        }],
      })
    ).toThrow('requires canonical character coverage')
    expect(() =>
      buildOwnedNonRothIraSeppAnnualDistributionInventoryEvidence({
        ...withoutId,
        predicate: 'wrong-inventory-predicate',
      } as unknown as OwnedNonRothIraSeppAnnualDistributionInventoryWithoutId)
    ).toThrow('predicate')
  })

  it('builds deterministic detached complete prior-election history', () => {
    const usedIds = ['prior-z', 'prior-a']
    const withoutId: OwnedNonRothIraSeppCompletePriorElectionHistoryWithoutId = {
      predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      historyThroughDate: '2029-12-31',
      terminalStateEvidenceId: 'prior-terminal',
      usedDistributionEvidenceIds: usedIds,
    }
    const built =
      buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence(withoutId)
    usedIds.push('mutated-after-build')
    const reordered =
      buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
        ...withoutId,
        usedDistributionEvidenceIds: ['prior-a', 'prior-z'],
      })

    expect(built).toEqual(reordered)
    expect(built.usedDistributionEvidenceIds).toEqual(['prior-a', 'prior-z'])
    expect(Object.isFrozen(built)).toBe(true)
    expect(Object.isFrozen(built.usedDistributionEvidenceIds)).toBe(true)
    expect(() =>
      buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
        ...withoutId,
        usedDistributionEvidenceIds: ['duplicate', 'duplicate'],
      })
    ).toThrow('must be unique')
    expect(() =>
      buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
        ...withoutId,
        historyThroughDate: '2029-02-30',
      })
    ).toThrow('canonical civil ISO date')
    expect(() =>
      buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
        ...withoutId,
        predicate: 'wrong-prior-election-history-predicate',
      } as unknown as OwnedNonRothIraSeppCompletePriorElectionHistoryWithoutId)
    ).toThrow('predicate')
  })

  it('reconciles an exact twelve-payment schedule without penalty authority', () => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput({
      amounts: Array.from({ length: 12 }, () => 100),
      dates: Array.from(
        { length: 12 },
        (_unused, index) => `2030-${String(index + 1).padStart(2, '0')}-15`,
      ),
    }))

    expect(result).toMatchObject({
      status: 'reconciled',
      reconciliation: 'complete',
      qualification: 'notEstablished',
      penaltyTreatment: 'notEstablished',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      evidence: {
        paymentCount: 12,
        annualScheduledGrossAmount: 1_200,
        reconciledScheduledGrossAmount: 1_200,
        reconciledActualGrossAmount: 1_200,
        prospectiveOrdinaryIncomeAmount: 1_200,
        terminalState: {
          completedPaymentCount: 12,
          lastCompletedSequence: 12,
          nextScheduledSequence: 13,
          scheduledGrossAmount: 1_200,
          actualQualifyingGrossAmount: 1_200,
        },
      },
    })
    expect(result).not.toHaveProperty('penaltyRate')
    expect(result).not.toHaveProperty('penaltyAmount')
    expect(result).not.toHaveProperty('readiness')
    expect(result.evidence).not.toHaveProperty('iraSeppQualified')
    if (result.status !== 'reconciled') throw new Error('expected reconciliation')
    expect(result.evidence.payments[0]!.beforeStateEvidenceId).toBe(
      result.evidence.openingStateEvidenceId,
    )
    for (let index = 1; index < result.evidence.payments.length; index += 1) {
      expect(result.evidence.payments[index]!.beforeStateEvidenceId).toBe(
        result.evidence.payments[index - 1]!.afterStateEvidenceId,
      )
    }
    const fixedWidthIds = [
      result.evidence.distributionInventory.inventoryEvidenceId,
      result.evidence.annualReconciliationId,
      result.evidence.terminalState.stateEvidenceId,
      ...result.evidence.payments.flatMap((payment) => [
        payment.priorHistoryEvidenceId,
        payment.afterStateEvidenceId,
        payment.currentPaymentCandidateId,
      ]),
    ]
    expect(fixedWidthIds.every((id) => /^[^:]+:[0-9a-f]{64}$/.test(id))).toBe(
      true,
    )
    expect(Math.max(...fixedWidthIds.map((id) => id.length))).toBeLessThan(128)
    expect(JSON.stringify(result).length).toBeLessThan(750_000)
  })

  it('reconciles a one-payment exact schedule', () => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput())
    expect(result.status).toBe('reconciled')
    if (result.status !== 'reconciled') throw new Error('expected reconciliation')
    expect(result.evidence.payments).toHaveLength(1)
    expect(result.evidence.terminalState).toEqual(
      expect.objectContaining({
        stateEvidenceId: result.evidence.payments[0]!.afterStateEvidenceId,
      }),
    )
  })

  it('reports every absent evidence class without throwing', () => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule({
      ownerPersonId: asPersonId('owner'),
      taxYear: 2030,
    })
    expect(result.status).toBe('evidenceMissing')
    expect(result.issues).toHaveLength(8)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('distinguishes empty and underfilled schedules as incomplete', () => {
    const empty = buildInput()
    empty.payments = []
    empty.distributionInventory = inventory([])
    const emptyResult = reconcileOwnedNonRothIraSeppAnnualSchedule(empty)
    expect(emptyResult.status).toBe('reconciliationIncomplete')
    expect(issueKinds(emptyResult)).toEqual(
      expect.arrayContaining(['paymentTupleEmpty', 'distributionInventoryEmpty']),
    )

    const under = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput({
      annualAmount: 101,
    }))
    expect(under.status).toBe('reconciliationIncomplete')
    expect(issueKinds(under)).toEqual(expect.arrayContaining([
      'terminalScheduledGrossIncomplete',
      'terminalActualGrossIncomplete',
    ]))
  })

  it('detects an omitted installment through inventory bijection and totals', () => {
    const value = buildInput({
      amounts: [100, 100],
      dates: ['2030-01-15', '2030-02-15'],
    })
    value.payments = [value.payments![0]!]
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('reconciliationIncomplete')
    expect(issueKinds(result)).toEqual(expect.arrayContaining([
      'inventoryMemberWithoutPayment',
      'terminalScheduledGrossIncomplete',
      'terminalActualGrossIncomplete',
    ]))
  })

  it('rejects overpayment as contradictory rather than incomplete', () => {
    const value = buildInput()
    value.annualScheduleEvidence = {
      ...value.annualScheduleEvidence!,
      annualScheduledGrossAmount: asUsdCents(99),
    }
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toContain('paymentNotLocallyConforming')
  })

  it('rejects duplicate inventory and payment members', () => {
    const inventoryDuplicate = buildInput()
    const inventoryRecords = inventoryDuplicate.distributionInventory!
      .characterCoverages
    inventoryDuplicate.distributionInventory = inventory([
      ...inventoryRecords,
      inventoryRecords[0]!,
    ])
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(inventoryDuplicate),
    )).toContain('duplicateInventoryMember')

    const paymentDuplicate = buildInput()
    paymentDuplicate.payments = [
      paymentDuplicate.payments![0]!,
      paymentDuplicate.payments![0]!,
    ]
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(paymentDuplicate),
    )).toEqual(expect.arrayContaining([
      'duplicatePaymentMember',
      'duplicateDistributionEvidenceId',
      'duplicatePaymentEvidenceId',
    ]))
  })

  it.each([
    ['inventory', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) =>
      value.distributionInventory!.inventoryEvidenceId],
    ['prior history', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) =>
      value.priorElectionHistoryEvidence!.priorElectionHistoryEvidenceId],
    ['annual line-7', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) =>
      value.distributionInventory!.characterCoverages[0]!
        .line7AllocationEvidenceId],
  ] as const)(
    'rejects payment-schedule ID reuse of %s evidence',
    (_label, collisionId) => {
      const value = buildInput()
      replaceFirstPayment(value, {
        paymentScheduleEvidenceId: collisionId(value),
      })
      const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
      expect(result.status).toBe('notReconciled')
      expect(issueKinds(result)).toContain('duplicateAnnualEvidenceId')
    },
  )

  it('rejects a generated current-history ID reused by common evidence', () => {
    const seed = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput())
    expect(seed.status).toBe('reconciled')
    if (seed.status !== 'reconciled') throw new Error('expected reconciliation')
    const generatedHistoryId = seed.evidence.payments[0]!
      .priorHistoryEvidenceId
    const value = buildInput()
    value.sourceEvidence = {
      ...value.sourceEvidence!,
      sourceEvidenceId: generatedHistoryId,
    }
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toContain('duplicateAnnualEvidenceId')
  })

  it('permits the intentional source, distribution, and state alias chains', () => {
    const value = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('reconciled')
    if (result.status !== 'reconciled') throw new Error('expected reconciliation')

    const firstCoverage = value.distributionInventory!.characterCoverages[0]!
    const secondCoverage = value.distributionInventory!.characterCoverages[1]!
    expect(secondCoverage.line7AllocationEvidenceId).toBe(
      firstCoverage.line7AllocationEvidenceId,
    )
    expect(secondCoverage.ageThresholdEvidenceId).toBe(
      firstCoverage.ageThresholdEvidenceId,
    )

    for (let index = 0; index < result.evidence.payments.length; index += 1) {
      const coverage = value.distributionInventory!.characterCoverages[index]!
      const rawPayment = value.payments![index]!.currentPaymentEvidence
      const payment = result.evidence.payments[index]!
      expect(coverage.sourceEvidenceIds.accountOwnershipEvidenceId).toBe(
        value.sourceEvidence!.accountOwnershipEvidenceId,
      )
      expect(coverage.sourceEvidenceIds.iraClassificationEvidenceId).toBe(
        value.sourceEvidence!.iraClassificationEvidenceId,
      )
      expect(coverage.sourceEvidenceIds.distributionDateEvidenceId).toBe(
        rawPayment.currentDistributionEvidenceId,
      )
      expect(payment.beforeStateEvidenceId).toBe(
        rawPayment.previousScheduleStateId,
      )
      if (index === 0) {
        expect(payment.beforeStateEvidenceId).toBe(
          value.openingStateEvidence!.openingStateEvidenceId,
        )
      } else {
        expect(payment.beforeStateEvidenceId).toBe(
          result.evidence.payments[index - 1]!.afterStateEvidenceId,
        )
      }
    }
    expect(issueKinds(result)).not.toContain('duplicateAnnualEvidenceId')
  })

  it('rejects foreign and extra members on either side of the bijection', () => {
    const foreign = buildInput()
    const record = foreign.distributionInventory!.characterCoverages[0]!
    foreign.distributionInventory = uncheckedInventory([{
      ...record,
      sourceAccountId: asAccountId('foreign-ira'),
    }])
    const foreignResult = reconcileOwnedNonRothIraSeppAnnualSchedule(foreign)
    expect(foreignResult.status).toBe('notReconciled')
    expect(issueKinds(foreignResult)).toEqual(expect.arrayContaining([
      'foreignInventoryMember',
      'inventoryMemberWithoutPayment',
      'paymentOutsideCompleteInventory',
    ]))

    const paymentExtra = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    paymentExtra.distributionInventory = inventory([
      paymentExtra.distributionInventory!.characterCoverages[0]!,
    ])
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(paymentExtra),
    )).toContain('paymentOutsideCompleteInventory')
  })

  it('rejects lifetime replay independently of current-year chaining', () => {
    const value = buildInput()
    const distributionId = value.distributionInventory!
      .characterCoverages[0]!.sourceEvidenceIds.distributionDateEvidenceId
    value.priorElectionHistoryEvidence = priorElectionHistory({
      usedIds: [distributionId],
    })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toContain('lifetimeDistributionReplay')
  })

  it('rejects current-year distribution replay and a discontinuous sequence', () => {
    const replay = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    const firstDistributionId = replay.payments![0]!
      .currentPaymentEvidence.currentDistributionEvidenceId
    replay.payments = replay.payments!.map((payment, index) => index === 1
      ? {
          ...payment,
          currentPaymentEvidence: {
            ...payment.currentPaymentEvidence,
            currentDistributionEvidenceId: firstDistributionId,
          },
        }
      : payment)
    const replayResult = reconcileOwnedNonRothIraSeppAnnualSchedule(replay)
    expect(issueKinds(replayResult)).toContain('duplicateDistributionEvidenceId')
    expect(replayResult.status === 'notReconciled' && replayResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'paymentNotLocallyConforming',
          paymentIssue: 'currentDistributionReplay',
        }),
      ]),
    )

    const sequence = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    sequence.payments = sequence.payments!.map((payment, index) => index === 1
      ? {
          ...payment,
          currentPaymentEvidence: {
            ...payment.currentPaymentEvidence,
            paymentSequence: 3,
          },
        }
      : payment)
    const sequenceResult = reconcileOwnedNonRothIraSeppAnnualSchedule(sequence)
    expect(sequenceResult.status === 'notReconciled' && sequenceResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'paymentNotLocallyConforming',
          paymentIssue: 'paymentSequenceNotContiguous',
        }),
      ]),
    )
  })

  it('requires prior-election history to terminate at the annual opening', () => {
    const value = buildInput()
    value.priorElectionHistoryEvidence = {
      ...value.priorElectionHistoryEvidence!,
      terminalStateEvidenceId: 'foreign-terminal-state',
    }
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toEqual(expect.arrayContaining([
      'priorElectionHistoryBindingMismatch',
      'priorElectionHistoryEvidenceIdMismatch',
    ]))
  })

  it('rejects a stale but self-consistent prior-history cutoff', () => {
    const value = buildInput()
    value.priorElectionHistoryEvidence = priorElectionHistory({
      historyThroughDate: '2029-12-30',
    })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toContain('priorElectionHistoryBindingMismatch')
    expect(issueKinds(result)).not.toContain(
      'priorElectionHistoryEvidenceIdMismatch',
    )
  })

  it('fails closed when a lifetime distribution ID collides with current non-distribution evidence', () => {
    const paymentCollision = buildInput()
    paymentCollision.priorElectionHistoryEvidence = priorElectionHistory({
      usedIds: [
        paymentCollision.payments![0]!.currentPaymentEvidence
          .paymentScheduleEvidenceId,
      ],
    })
    const paymentResult = reconcileOwnedNonRothIraSeppAnnualSchedule(
      paymentCollision,
    )
    expect(issueKinds(paymentResult)).toContain('lifetimeEvidenceIdCollision')
    expect(issueKinds(paymentResult)).not.toContain('lifetimeDistributionReplay')

    const commonCollision = buildInput()
    commonCollision.priorElectionHistoryEvidence = priorElectionHistory({
      usedIds: [commonCollision.sourceEvidence!.sourceEvidenceId],
    })
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(commonCollision),
    )).toContain('lifetimeEvidenceIdCollision')
  })

  it('does not treat business identities or internal member keys as evidence collisions', () => {
    const value = buildInput()
    const coverage = value.distributionInventory!.characterCoverages[0]!
    const memberKey = deriveActionStructuralId(
      'owned-ira-sepp-annual-distribution-member',
      [
        coverage.evaluationDate,
        coverage.actionId,
        coverage.allocationId,
        coverage.sourceAccountId,
      ],
    )
    value.priorElectionHistoryEvidence = priorElectionHistory({
      usedIds: [
        value.ownerPersonId,
        value.sourceEvidence!.sourceAccountId,
        coverage.actionId,
        coverage.allocationId,
        value.electionEvidence!.electionId,
        value.electionEvidence!.scheduleId,
        memberKey,
      ],
    })

    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('reconciled')
  })

  it('rejects stale/forked previous-state references', () => {
    const value = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    value.payments = value.payments!.map((payment, index) => index === 1
      ? {
          ...payment,
          currentPaymentEvidence: {
            ...payment.currentPaymentEvidence,
            previousScheduleStateId: 'stale-state',
          },
        }
      : payment)
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(result.status === 'notReconciled' && result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'paymentNotLocallyConforming',
          paymentIssue: 'previousStateMismatch',
        }),
      ]),
    )
  })

  it.each([
    ['identity', 'paymentOutsideCompleteInventory', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) => {
      replaceFirstPayment(value, { actionId: asActionId('wrong-action') })
    }],
    ['date', 'paymentOutsideCompleteInventory', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) => {
      replaceFirstPayment(value, { distributionDate: '2030-01-16' })
    }],
    ['gross', 'paymentNotLocallyConforming', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) => {
      replaceFirstPayment(value, {
        currentScheduledGrossAmount: asUsdCents(99),
      })
    }],
    ['character', 'paymentNotLocallyConforming', (value: ReconcileOwnedNonRothIraSeppAnnualScheduleInput) => {
      const coverage = value.distributionInventory!.characterCoverages[0]!
      value.distributionInventory = uncheckedInventory([{
        ...coverage,
        ordinaryIncomeExposureAmount: asUsdCents(99),
      }])
    }],
  ] as const)('rejects wrong %s binding', (_label, expectedIssue, mutate) => {
    const value = buildInput()
    mutate(value)
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('notReconciled')
    expect(issueKinds(result)).toContain(expectedIssue)
  })

  it('retains an all-basis member in gross while excluding ordinary exposure', () => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput({
      openingBasisAmount: 100,
    }))
    expect(result.status).toBe('reconciled')
    if (result.status !== 'reconciled') throw new Error('expected reconciliation')
    expect(result.evidence).toMatchObject({
      reconciledActualGrossAmount: 100,
      basisReturnExcludedAmount: 100,
      prospectiveOrdinaryIncomeAmount: 0,
      payments: [{
        actualGrossAmount: 100,
        basisReturnExcludedAmount: 100,
        prospectiveOrdinaryIncomeAmount: 0,
      }],
    })
  })

  it('is invariant to payment, inventory, and lifetime-ID input order', () => {
    const baselineInput = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
      lifetimeIds: ['prior-a', 'prior-b'],
    })
    const permuted = {
      ...baselineInput,
      payments: [...baselineInput.payments!].reverse(),
      distributionInventory: {
        ...baselineInput.distributionInventory!,
        characterCoverages: [
          ...baselineInput.distributionInventory!.characterCoverages,
        ].reverse(),
      },
      priorElectionHistoryEvidence: {
        ...baselineInput.priorElectionHistoryEvidence!,
        usedDistributionEvidenceIds: [
          ...baselineInput.priorElectionHistoryEvidence!
            .usedDistributionEvidenceIds,
        ].reverse(),
      },
    }
    const baseline = reconcileOwnedNonRothIraSeppAnnualSchedule(baselineInput)
    const reordered = reconcileOwnedNonRothIraSeppAnnualSchedule(permuted)
    expect(reordered).toEqual(baseline)
  })

  it('canonicalizes caller-owned lineage before deriving annual evidence', () => {
    const baseline = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput())
    const value = buildInput()
    let toJsonCalls = 0
    const reorderedWithExtra = <T extends object>(lineage: T): T => ({
      ignoredExtraProperty: 'must-not-affect-evidence',
      ...Object.fromEntries(Object.entries(lineage).reverse()),
    }) as T
    value.sourceEvidence = Object.assign(
      reorderedWithExtra(value.sourceEvidence!),
      {
        toJSON: () => {
          toJsonCalls += 1
          return undefined
        },
      },
    )
    value.electionEvidence = reorderedWithExtra(value.electionEvidence!)
    value.annualScheduleEvidence = reorderedWithExtra(
      value.annualScheduleEvidence!,
    )
    value.noModificationEvidence = reorderedWithExtra(
      value.noModificationEvidence!,
    )
    value.openingStateEvidence = reorderedWithExtra(
      value.openingStateEvidence!,
    )

    const canonicalized = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(canonicalized).toEqual(baseline)
    expect(toJsonCalls).toBe(0)
    expect(canonicalized.status).toBe('reconciled')
    if (canonicalized.status !== 'reconciled' || baseline.status !== 'reconciled') {
      throw new Error('expected reconciliations')
    }
    expect(canonicalized.evidence.annualReconciliationId).toBe(
      baseline.evidence.annualReconciliationId,
    )
  })

  it('orders same-date non-ASCII identities by UTF-16 code units', () => {
    const seed = buildInput({
      amounts: [50, 50],
      dates: ['2030-06-15', '2030-06-15'],
    })
    const first = seed.distributionInventory!.characterCoverages[0]!
    const second = seed.distributionInventory!.characterCoverages[1]!
    const accented = withCoverageIdentity(
      first,
      asActionId('action-\u00e9'),
      asAllocationId('allocation-\u00e9'),
    )
    const ascii = withCoverageIdentity(
      second,
      asActionId('action-z'),
      asAllocationId('allocation-z'),
    )
    const value = buildRawInputFromCoverages([accented, ascii], 100)
    value.payments = [...value.payments!].reverse()
    value.distributionInventory = {
      ...value.distributionInventory!,
      characterCoverages: [accented, ascii],
    }

    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(result.status).toBe('reconciled')
    if (result.status !== 'reconciled') throw new Error('expected reconciliation')
    expect(result.evidence.payments.map((payment) => payment.actionId)).toEqual([
      asActionId('action-z'),
      asActionId('action-\u00e9'),
    ])
  })

  it('binds multiple material evidence IDs into the reconciliation ID', () => {
    const baseline = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput())
    const changed = reconcileOwnedNonRothIraSeppAnnualSchedule(buildInput({
      sourceEvidenceId: 'different-source-evidence',
    }))
    expect(baseline.status).toBe('reconciled')
    expect(changed.status).toBe('reconciled')
    if (baseline.status !== 'reconciled' || changed.status !== 'reconciled') {
      throw new Error('expected reconciliations')
    }
    expect(changed.evidence.annualReconciliationId).not.toBe(
      baseline.evidence.annualReconciliationId,
    )

    const inventoryChanged = buildInput()
    inventoryChanged.distributionInventory = {
      ...inventoryChanged.distributionInventory!,
      inventoryEvidenceId: 'wrong-inventory-id',
    }
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(inventoryChanged),
    )).toContain('distributionInventoryEvidenceIdMismatch')

    const historyChanged = buildInput()
    historyChanged.priorElectionHistoryEvidence = {
      ...historyChanged.priorElectionHistoryEvidence!,
      priorElectionHistoryEvidenceId: 'wrong-prior-history-id',
    }
    expect(issueKinds(
      reconcileOwnedNonRothIraSeppAnnualSchedule(historyChanged),
    )).toContain('priorElectionHistoryEvidenceIdMismatch')
  })

  it('reports BigInt-safe overflow without constructing unsafe totals', () => {
    const value = buildInput({
      amounts: [1, 1],
      dates: ['2030-01-15', '2030-02-15'],
      annualAmount: 2,
    })
    const first = value.distributionInventory!.characterCoverages[0]!
    const maximumCoverage = withCoverageAmounts(
      first,
      Number.MAX_SAFE_INTEGER,
      0,
      Number.MAX_SAFE_INTEGER,
    )
    const second = value.distributionInventory!.characterCoverages[1]!
    const oneCoverage = withCoverageAmounts(second, 1, 0, 1)
    const rebuilt = buildRawInputFromCoverages(
      [maximumCoverage, oneCoverage],
      Number.MAX_SAFE_INTEGER,
    )
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(rebuilt)
    expect(result.status).toBe('notReconciled')
    expect(result.status === 'notReconciled' && result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'paymentNotLocallyConforming',
          paymentIssue: 'safeIntegerOverflow',
        }),
      ]),
    )
  })

  it('is deterministic, detached, and deeply frozen', () => {
    const value = buildInput({
      amounts: [50, 50],
      dates: ['2030-01-15', '2030-02-15'],
    })
    const snapshot = structuredClone(value)
    const first = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    const second = reconcileOwnedNonRothIraSeppAnnualSchedule(value)
    expect(first).toEqual(second)
    expect(value).toEqual(snapshot)
    expect(Object.isFrozen(first)).toBe(true)
    if (first.status !== 'reconciled') throw new Error('expected reconciliation')
    expect(Object.isFrozen(first.evidence)).toBe(true)
    expect(Object.isFrozen(first.evidence.payments)).toBe(true)
    expect(Object.isFrozen(first.evidence.terminalState)).toBe(true)
  })

  it('throws for malformed dates and duplicate lifetime evidence IDs', () => {
    const badDate = buildInput()
    badDate.priorElectionHistoryEvidence = {
      ...badDate.priorElectionHistoryEvidence!,
      historyThroughDate: '2030-99-99',
    }
    expect(() => reconcileOwnedNonRothIraSeppAnnualSchedule(badDate)).toThrow(
      /canonical civil ISO date/,
    )

    const replayed = buildInput()
    replayed.priorElectionHistoryEvidence = {
      ...replayed.priorElectionHistoryEvidence!,
      usedDistributionEvidenceIds: ['same-id', 'same-id'],
    }
    expect(() => reconcileOwnedNonRothIraSeppAnnualSchedule(replayed)).toThrow(
      /must be unique/,
    )
  })
})

function withCoverageAmounts(
  input: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
  executedAmount: number,
  basisAmount: number,
  ordinaryAmount: number,
): OwnedNonRothIraPenaltyCharacterCoverageEvidence {
  const coverage = {
    ...input,
    executedAmount: asUsdCents(executedAmount),
    basisReturnExcludedAmount: asUsdCents(basisAmount),
    ordinaryIncomeExposureAmount: asUsdCents(ordinaryAmount),
  }
  return {
    ...coverage,
    evidenceId: mintCoverageEvidenceId(coverageEvidenceIdParts(coverage)),
  }
}

function withCoverageIdentity(
  input: Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>,
  actionId: ReturnType<typeof asActionId>,
  allocationId: ReturnType<typeof asAllocationId>,
): OwnedNonRothIraPenaltyCharacterCoverageEvidence {
  return withCoverageAmounts(
    { ...input, actionId, allocationId },
    input.executedAmount,
    input.basisReturnExcludedAmount,
    input.ordinaryIncomeExposureAmount,
  )
}

function buildRawInputFromCoverages(
  coverages: readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[],
  annualAmount: number,
): ReconcileOwnedNonRothIraSeppAnnualScheduleInput {
  const base = buildInput()
  const sorted = [...coverages].sort(coverageOrder)
  base.annualScheduleEvidence = {
    ...base.annualScheduleEvidence!,
    annualScheduledGrossAmount: asUsdCents(annualAmount),
  }
  base.distributionInventory = inventory(sorted)
  const payments: OwnedNonRothIraSeppAnnualRawPaymentEvidence[] = []
  const reconciled: OwnedNonRothIraSeppAnnualReconciledPaymentEvidence[] = []
  const usedIds: string[] = []
  let scheduled = 0
  let actual = 0
  let terminalId = base.openingStateEvidence!.openingStateEvidenceId
  for (let index = 0; index < sorted.length; index += 1) {
    const coverage = sorted[index]!
    const historyWithoutId = {
      predicate: 'ownedNonRothIraSeppPriorPaymentHistory' as const,
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      openingStateEvidenceId: base.openingStateEvidence!.openingStateEvidenceId,
      completedPaymentCount: index,
      usedCurrentDistributionEvidenceIds: [...usedIds].sort(),
      lastCompletedSequence: index,
      lastPaymentDate: index === 0 ? null : sorted[index - 1]!.evaluationDate,
      terminalStateEvidenceId: terminalId,
      scheduledGrossAmountThroughPriorPayments: asUsdCents(scheduled),
      actualQualifyingGrossAmountThroughPriorPayments: asUsdCents(actual),
      nextScheduledSequence: index + 1,
    }
    const history =
      buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence(historyWithoutId)
    const payment = {
      predicate: 'ownedNonRothIraSeppCurrentScheduledPayment' as const,
      electionId: 'election',
      scheduleId: 'schedule',
      actionId: coverage.actionId,
      allocationId: coverage.allocationId,
      sourceAccountId: coverage.sourceAccountId,
      distributionDate: coverage.evaluationDate,
      currentDistributionEvidenceId:
        coverage.sourceEvidenceIds.distributionDateEvidenceId,
      paymentSequence: index + 1,
      previousScheduleStateId: terminalId,
      currentScheduledGrossAmount: coverage.executedAmount,
      paymentScheduleEvidenceId: `overflow-payment-${index + 1}`,
    }
    const candidate = validateOwnedNonRothIraSeppCurrentPaymentCandidate({
      ownerPersonId: base.ownerPersonId,
      taxYear: base.taxYear,
      actionId: payment.actionId,
      allocationId: payment.allocationId,
      characterCoverage: coverage,
      sourceEvidence: base.sourceEvidence,
      electionEvidence: base.electionEvidence,
      annualScheduleEvidence: base.annualScheduleEvidence,
      noModificationEvidence: base.noModificationEvidence,
      openingStateEvidence: base.openingStateEvidence,
      priorHistoryEvidence: history,
      currentPaymentEvidence: payment,
    })
    payments.push({ currentPaymentEvidence: payment })
    if (candidate.status !== 'provisionalCandidate') break
    const item = candidate.candidate
    reconciled.push({
      predicate: 'ownedNonRothIraSeppAnnualReconciledPayment',
      actionId: item.actionId,
      allocationId: item.allocationId,
      distributionDate: item.distributionDate,
      paymentSequence: item.paymentSequence,
      scheduledGrossAmount: item.scheduledGrossAmount,
      actualGrossAmount: item.actualGrossAmount,
      basisReturnExcludedAmount: item.basisReturnExcludedAmount,
      prospectiveOrdinaryIncomeAmount: item.prospectiveOrdinaryIncomeAmount,
      characterCoverageEvidenceId: item.characterCoverageEvidenceId,
      currentDistributionEvidenceId: item.currentDistributionEvidenceId,
      paymentScheduleEvidenceId: item.paymentScheduleEvidenceId,
      priorHistoryEvidenceId: history.priorHistoryEvidenceId,
      beforeStateEvidenceId: item.beforeState.stateEvidenceId,
      afterStateEvidenceId: item.afterState.stateEvidenceId,
      currentPaymentCandidateId: item.candidateId,
    })
    scheduled += item.scheduledGrossAmount
    actual += item.actualGrossAmount
    usedIds.push(item.currentDistributionEvidenceId)
    terminalId = item.afterState.stateEvidenceId
  }
  base.payments = payments
  return base
}
/**
 * The per-payment nonconformance kinds a failed reconciliation reported.
 *
 * `paymentIssue` is only ever set on a `paymentNotLocallyConforming` issue, and
 * that kind is not one of the kinds that keep a result `reconciliationIncomplete`,
 * so only a `notReconciled` result can carry one. Issues without a payment scope
 * are dropped rather than returned as `undefined` holes, so a `toContain`
 * assertion cannot pass on a gap in the list.
 */
function paymentIssueKinds(
  result: ReturnType<typeof reconcileOwnedNonRothIraSeppAnnualSchedule>,
): readonly OwnedNonRothIraSeppNonconformanceKind[] {
  return result.status === 'notReconciled'
    ? result.issues.flatMap((issue) => issue.paymentIssue ?? [])
    : []
}

/**
 * Registry fixtures for the 72(t) SEPP cluster.
 *
 * Each candidate reading below was written from the authority before the
 * implementation was consulted, and each pair predicts a different reconciled
 * dollar figure or payment count, so a fixture cannot pass under both.
 */
describe('72(t) SEPP registry conformance', () => {
  describeRule('irc-72-t-2-A-iv-sepp-exception', {
    // Two payments of $120.00 against an annual schedule of $360.00. The
    // statute excepts a distribution only if it is "part of a series of
    // substantially equal periodic payments", so the question is whether
    // membership in a complete series gates the exception, or whether each
    // payment carries its own exception on its own facts.
    readings: {
      // Series membership gates it: the year never made up the annual payment
      // the method determined, so nothing in it is part of a qualifying series.
      seriesMembershipGatesTheException: 0,
      // Each payment stands alone: both payments were substantially equal and
      // on schedule, so both would still be excepted.
      eachPaymentStandsAlone: 24_000,
    },
    accepted: 'seriesMembershipGatesTheException',
  }, ({ accepted, readings }) => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(
      buildInput({ amounts: [12_000, 12_000], annualAmount: 36_000 }),
    )

    it('excepts nothing in a year that never completed the annual payment', () => {
      expect(result.evidence?.reconciledActualGrossAmount ?? 0).toBe(accepted)
      expect(result.evidence?.reconciledActualGrossAmount ?? 0)
        .not.toBe(readings.eachPaymentStandsAlone)
    })

    it('reports the year incomplete rather than partly qualified', () => {
      expect(result.status).toBe('reconciliationIncomplete')
      expect(issueKinds(result)).toEqual([
        'terminalScheduledGrossIncomplete',
        'terminalActualGrossIncomplete',
      ])
    })
  })

  describeRule('irc-72-t-5-sepp-participant-scope', {
    // The same $120.00 payment, reconciled for a household member who is not
    // the participant the election and the account belong to. Section 72(t)(5)
    // makes the IRA owner the employee, so the question is whether the series
    // is scored per participant or across the household.
    readings: {
      // Per participant: another person cannot draw on this series at all.
      perParticipantAndAccount: 0,
      // Household aggregate: any member of the household could reconcile it.
      householdAggregate: 12_000,
    },
    accepted: 'perParticipantAndAccount',
  }, ({ accepted, readings }) => {
    const base = buildInput({ amounts: [12_000] })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule({
      ...base,
      ownerPersonId: asPersonId('spouse'),
    })

    it('scores the series for the participant it belongs to, not the household', () => {
      expect(result.evidence?.reconciledActualGrossAmount ?? 0).toBe(accepted)
      expect(result.evidence?.reconciledActualGrossAmount ?? 0)
        .not.toBe(readings.householdAggregate)
    })

    it('names the inventory member as foreign to this participant', () => {
      expect(result.status).toBe('notReconciled')
      expect(issueKinds(result)).toContain('foreignInventoryMember')
    })
  })

  describeRule('notice-2022-6-3-01-three-permitted-methods', {
    // A fixed annuitization election. Notice 2022-6 section 3.01 lists three
    // methods; the engine's own projection strategy carries a two-value method
    // union, which would refuse this election.
    readings: {
      threeMethodsUnderNotice2022_6: 'reconciled',
      twoMethodsAsTheProjectionStrategyModelsThem: 'notReconciled',
    },
    accepted: 'threeMethodsUnderNotice2022_6',
  }, ({ accepted, readings }) => {
    const base = buildInput({ amounts: [12_000] })
    const withMethod = (
      method: typeof base.electionEvidence extends undefined ? never
        : NonNullable<typeof base.electionEvidence>['method'],
    ): ReturnType<typeof reconcileOwnedNonRothIraSeppAnnualSchedule> =>
      reconcileOwnedNonRothIraSeppAnnualSchedule({
        ...base,
        electionEvidence: { ...base.electionEvidence!, method },
      })

    it('accepts the fixed annuitization method on the same footing as the others', () => {
      expect(withMethod('fixedAnnuitization').status).toBe(accepted)
      expect(withMethod('fixedAnnuitization').status)
        .not.toBe(readings.twoMethodsAsTheProjectionStrategyModelsThem)
    })

    it('accepts the required minimum distribution and fixed amortization methods', () => {
      expect(withMethod('requiredMinimumDistribution').status).toBe(accepted)
      expect(withMethod('fixedAmortization').status).toBe(accepted)
    })

    it('refuses a fourth method by name rather than reconciling it', () => {
      const result = reconcileOwnedNonRothIraSeppAnnualSchedule({
        ...base,
        electionEvidence: {
          ...base.electionEvidence!,
          method: 'levelDollar' as NonNullable<
            typeof base.electionEvidence
          >['method'],
        },
      })
      expect(result.status).toBe('notReconciled')
      expect(paymentIssueKinds(result)).toContain('unsupportedMethod')
    })
  })

  describeRule('notice-2022-6-3-01-annual-payment-completeness', {
    // Three $40.00 distributions against a $120.00 annual schedule. The statute
    // requires payments "not less frequently than annually", which is a floor
    // on frequency, and the methods determine an annual payment. So the
    // question is what the year is measured by.
    readings: {
      // The annual total is the payment: all three distributions are one
      // annual payment and the year is complete at $120.00.
      annualTotalOfEveryDistribution: 12_000,
      // One payment per year: only the first distribution could count, leaving
      // the year at $40.00.
      onlyOneDistributionCountsPerYear: 4_000,
    },
    accepted: 'annualTotalOfEveryDistribution',
  }, ({ accepted, readings }) => {
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule(
      buildInput({ amounts: [4_000, 4_000, 4_000] }),
    )

    it('measures the year by the total of every scheduled distribution', () => {
      expect(result.status).toBe('reconciled')
      expect(result.evidence?.reconciledActualGrossAmount).toBe(accepted)
      expect(result.evidence?.reconciledActualGrossAmount)
        .not.toBe(readings.onlyOneDistributionCountsPerYear)
    })

    it('keeps all three distributions in the one reconciled series', () => {
      expect(result.evidence?.paymentCount).toBe(3)
    })
  })

  describeRule('notice-2022-6-3-02-e-single-account-balance-scope', {
    // A $120.00 scheduled payment plus a $30.00 unscheduled distribution from
    // the same IRA. The series is calculated against that one account balance,
    // so the question is what an extra distribution from it does.
    readings: {
      // It leaves the year unproven: nothing from the account is excepted.
      unscheduledDistributionLeavesTheYearUnproven: 0,
      // It is merely a separately penalized withdrawal and the scheduled
      // payment still qualifies on its own.
      scheduledPaymentSurvivesTheExtraWithdrawal: 12_000,
    },
    accepted: 'unscheduledDistributionLeavesTheYearUnproven',
  }, ({ accepted, readings }) => {
    const base = buildInput({ amounts: [12_000, 3_000], annualAmount: 15_000 })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule({
      ...base,
      annualScheduleEvidence: {
        ...base.annualScheduleEvidence!,
        annualScheduledGrossAmount: asUsdCents(12_000),
      },
      payments: [base.payments![0]!],
    })

    it('excepts nothing when the account made a distribution outside the series', () => {
      expect(result.evidence?.reconciledActualGrossAmount ?? 0).toBe(accepted)
      expect(result.evidence?.reconciledActualGrossAmount ?? 0)
        .not.toBe(readings.scheduledPaymentSurvivesTheExtraWithdrawal)
    })

    it('names the inventory member that no scheduled payment answers', () => {
      expect(result.status).toBe('reconciliationIncomplete')
      expect(issueKinds(result)).toEqual(['inventoryMemberWithoutPayment'])
    })
  })

  describeRule('irc-72-t-4-sepp-modification-proof-window', {
    // The $120.00 payment falls on 2030-01-15, but the no-modification proof
    // runs only through 2029-12-31. Section 72(t)(4) pulls the exception back
    // from every prior payment on a later modification, so the question is how
    // far the proof has to reach.
    readings: {
      proofMustReachThePaymentDate: 0,
      proofOpeningTheYearIsEnough: 12_000,
    },
    accepted: 'proofMustReachThePaymentDate',
  }, ({ accepted, readings }) => {
    const base = buildInput({ amounts: [12_000] })
    const result = reconcileOwnedNonRothIraSeppAnnualSchedule({
      ...base,
      noModificationEvidence: {
        ...base.noModificationEvidence!,
        throughDate: '2029-12-31',
      },
    })

    it('refuses a payment its no-modification proof does not reach', () => {
      expect(result.evidence?.reconciledActualGrossAmount ?? 0).toBe(accepted)
      expect(result.evidence?.reconciledActualGrossAmount ?? 0)
        .not.toBe(readings.proofOpeningTheYearIsEnough)
    })

    it('names the insufficient modification evidence on the payment', () => {
      expect(result.status).toBe('notReconciled')
      expect(paymentIssueKinds(result)).toContain('modificationEvidenceInsufficient')
    })

    it('reconciles once the proof reaches the payment date', () => {
      expect(reconcileOwnedNonRothIraSeppAnnualSchedule(base).status)
        .toBe('reconciled')
    })
  })
})
