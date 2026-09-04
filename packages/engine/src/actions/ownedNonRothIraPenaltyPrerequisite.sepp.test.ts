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
  type EvaluateOwnedNonRothIraPenaltyPrerequisitesInput,
  type OwnedNonRothIraSeppPenaltyScheduleRouteInput,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
} from './ownedNonRothIraSeppAnnualReconciliation.js'
import {
  buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence,
  validateOwnedNonRothIraSeppCurrentPaymentCandidate,
  type OwnedNonRothIraSeppAnnualOpeningStateEvidence,
  type OwnedNonRothIraSeppAnnualScheduleEvidence,
  type OwnedNonRothIraSeppElectionEvidence,
  type OwnedNonRothIraSeppNoModificationEvidence,
  type OwnedNonRothIraSeppSourceEvidence,
} from './ownedNonRothIraSeppCurrentPaymentCandidate.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import { deriveActionStructuralId } from './structuralId.js'

function characterization(options: Readonly<{
  subtype?: OwnedNonRothIraSubtype
  grossAmount?: number
  basisAmount?: number
}> = {}) {
  const subtype = options.subtype ?? 'traditional'
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
      scheduledDate: '2030-06-01',
      scheduledSequence: 1,
      grossAmount: asUsdCents(grossAmount),
    }],
    line8Conversions: [],
  })
}

function scheduleRoute(options: Readonly<{
  subtype?: OwnedNonRothIraSubtype
  grossAmount?: number
  annualAmount?: number
  paymentGrossAmount?: number
  paymentScheduleEvidenceId?: string
  omitPayments?: boolean
}> = {}): OwnedNonRothIraSeppPenaltyScheduleRouteInput {
  const subtype = options.subtype ?? 'traditional'
  const grossAmount = options.grossAmount ?? 100
  const annualAmount = options.annualAmount ?? grossAmount
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    priorHistoryTerminalStateId: 'prior-terminal',
    nextScheduledSequence: 1 as const,
    scheduledGrossAmount: 0 as const,
    actualQualifyingGrossAmount: 0 as const,
  }
  const openingStateEvidence = {
    ...openingLineage,
    openingStateEvidenceId:
      deriveActionStructuralId(
        'owned-ira-sepp-annual-opening-state',
        [openingLineage],
      ),
  }
  const priorElectionHistoryEvidence =
    buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
      predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
      electionId: 'election',
      scheduleId: 'schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      historyThroughDate: '2029-12-31',
      terminalStateEvidenceId: 'prior-terminal',
      usedDistributionEvidenceIds: [],
    })
  return {
    sourceAccountId: asAccountId('ira-account'),
    electionId: 'election',
    scheduleId: 'schedule',
    annualReconciliationInput: {
      sourceEvidence: {
        predicate: 'ownedNonRothIraSeppSource',
        sourceAccountId: asAccountId('ira-account'),
        ownerPersonId: asPersonId('owner'),
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype,
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
        subtype,
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
        annualScheduledGrossAmount: asUsdCents(annualAmount),
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
      openingStateEvidence,
      priorElectionHistoryEvidence,
      payments: options.omitPayments
        ? undefined
        : [{
            currentPaymentEvidence: {
              predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
              electionId: 'election',
              scheduleId: 'schedule',
              actionId: asActionId('action'),
              allocationId: asAllocationId('allocation'),
              sourceAccountId: asAccountId('ira-account'),
              distributionDate: '2030-06-01',
              currentDistributionEvidenceId: 'distribution-date',
              paymentSequence: 1,
              previousScheduleStateId:
                openingStateEvidence.openingStateEvidenceId,
              currentScheduledGrossAmount: asUsdCents(
                options.paymentGrossAmount ?? grossAmount,
              ),
              paymentScheduleEvidenceId:
                options.paymentScheduleEvidenceId ?? 'payment-schedule',
            },
          }],
    },
  }
}

function input(options: Readonly<{
  subtype?: OwnedNonRothIraSubtype
  grossAmount?: number
  basisAmount?: number
  birthDate?: string
  disability?: boolean
  route?: OwnedNonRothIraSeppPenaltyScheduleRouteInput
}> = {}): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const subtype = options.subtype ?? 'traditional'
  return {
    characterization: characterization({
      subtype,
      grossAmount: options.grossAmount,
      basisAmount: options.basisAmount,
    }),
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: options.birthDate ?? '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      subtype,
      evaluationDate: '2030-06-01',
      distributionDateEvidenceId: 'distribution-date',
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    }],
    qualifiedDisabilityEvidence: options.disability
      ? [{
          kind: 'disability',
          disabledPersonId: asPersonId('owner'),
          disabilityQualificationDate: '2030-05-01',
          evaluationDate: '2030-06-01',
          qualifiedOnEvaluationDate: true,
          disabilityEvidenceId: 'disability',
        }]
      : [],
    iraSeppScheduleRoutes: options.route === undefined
      ? []
      : [options.route],
    simpleParticipationEvidence: subtype === 'simple' && options.route === undefined
      ? [{
          predicate: 'simpleIraParticipationStartForPenaltyRate',
          sourceAccountId: asAccountId('ira-account'),
          ownerPersonId: asPersonId('owner'),
          participationStartDate: '2029-01-01',
          participationStartEvidenceId: 'simple-participation',
        }]
      : [],
  }
}

interface ManyPaymentEntry {
  actionId: string
  allocationId: string
  date: string
  grossAmount: number
}

function manyPaymentInput(
  entries: readonly Readonly<ManyPaymentEntry>[],
  options: Readonly<{
    openingBasisAmount?: number
    birthDate?: string
    disabilityDates?: readonly string[]
  }> = {},
): EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  const annualGrossAmount = entries.reduce(
    (total, entry) => total + entry.grossAmount,
    0,
  )
  const characterizationResult = classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'many-payment-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'many-payment-pool',
      taxYear: 2030,
      accountIds: [asAccountId('ira-account')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      evidenceId: 'many-complete-pool',
    },
    annualBasisRecordEvidenceId: 'many-basis-record',
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
      form8606Line7DistributionAmount: asUsdCents(annualGrossAmount),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: entries.map((entry, index) => ({
      actionId: asActionId(entry.actionId),
      allocationId: asAllocationId(entry.allocationId),
      sourceAccountId: asAccountId('ira-account'),
      scheduledDate: entry.date,
      scheduledSequence: index + 1,
      grossAmount: asUsdCents(entry.grossAmount),
    })),
    line8Conversions: [],
  })
  return {
    characterization: characterizationResult,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: options.birthDate ?? '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: characterizationResult.withdrawals.map((withdrawal) => {
      const allocation = characterizationResult.line7AllocationEvidence
        .allocations.find((item) =>
          item.actionId === withdrawal.actionId &&
          item.allocationId === withdrawal.allocationId)
      if (allocation?.scheduledDate === null || allocation === undefined) {
        throw new Error('many-payment fixture lost its scheduled date')
      }
      return {
        predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
        actionId: withdrawal.actionId,
        allocationId: withdrawal.allocationId,
        sourceAccountId: withdrawal.sourceAccountId,
        ownerPersonId: asPersonId('owner'),
        subtype: withdrawal.subtype,
        evaluationDate: allocation.scheduledDate,
        distributionDateEvidenceId:
          `distribution-${withdrawal.allocationId}`,
        accountOwnershipEvidenceId: 'ownership',
        iraClassificationEvidenceId: 'classification',
      }
    }),
    qualifiedDisabilityEvidence: (options.disabilityDates ?? []).map(
      (evaluationDate) => ({
        kind: 'disability' as const,
        disabledPersonId: asPersonId('owner'),
        disabilityQualificationDate: evaluationDate,
        evaluationDate,
        qualifiedOnEvaluationDate: true as const,
        disabilityEvidenceId: `disability-${evaluationDate}`,
      }),
    ),
    iraSeppScheduleRoutes: [],
    simpleParticipationEvidence: [],
  }
}

function completeRouteForInput(
  value: Readonly<EvaluateOwnedNonRothIraPenaltyPrerequisitesInput>,
): OwnedNonRothIraSeppPenaltyScheduleRouteInput {
  const withoutRoute = evaluateOwnedNonRothIraPenaltyPrerequisites({
    ...value,
    iraSeppScheduleRoutes: [],
  })
  const coverages = [...withoutRoute.coverage].sort((left, right) =>
    left.evaluationDate < right.evaluationDate
      ? -1
      : left.evaluationDate > right.evaluationDate
        ? 1
        : left.actionId < right.actionId
          ? -1
          : left.actionId > right.actionId
            ? 1
            : left.allocationId < right.allocationId
              ? -1
              : left.allocationId > right.allocationId
                ? 1
                : 0,
  )
  const annualAmount = coverages.reduce(
    (total, coverage) => total + coverage.executedAmount,
    0,
  )
  const sourceEvidence: OwnedNonRothIraSeppSourceEvidence = {
    predicate: 'ownedNonRothIraSeppSource',
    sourceAccountId: asAccountId('ira-account'),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype: 'traditional',
    accountOwnershipEvidenceId: 'ownership',
    iraClassificationEvidenceId: 'classification',
    sourceEvidenceId: 'many-sepp-source',
  }
  const electionEvidence: OwnedNonRothIraSeppElectionEvidence = {
    predicate: 'ownedNonRothIraSeppElection',
    electionId: 'many-election',
    scheduleId: 'many-schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    subtype: 'traditional',
    electionStartDate: '2030-01-01',
    method: 'fixedAmortization',
    electionEvidenceId: 'many-election-evidence',
  }
  const annualScheduleEvidence: OwnedNonRothIraSeppAnnualScheduleEvidence = {
    predicate: 'ownedNonRothIraSeppAnnualSchedule',
    electionId: 'many-election',
    scheduleId: 'many-schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    annualScheduledGrossAmount: asUsdCents(annualAmount),
    annualScheduleEvidenceId: 'many-annual-schedule',
  }
  const noModificationEvidence: OwnedNonRothIraSeppNoModificationEvidence = {
    predicate: 'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
    electionId: 'many-election',
    scheduleId: 'many-schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    throughDate: '2030-12-31',
    disqualifyingModification: 'none',
    noModificationEvidenceId: 'many-no-modification',
  }
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'many-election',
    scheduleId: 'many-schedule',
    participantPersonId: asPersonId('owner'),
    sourceAccountId: asAccountId('ira-account'),
    taxYear: 2030,
    priorHistoryTerminalStateId: 'many-prior-terminal',
    nextScheduledSequence: 1 as const,
    scheduledGrossAmount: 0 as const,
    actualQualifyingGrossAmount: 0 as const,
  }
  const openingStateEvidence: OwnedNonRothIraSeppAnnualOpeningStateEvidence = {
    ...openingLineage,
    openingStateEvidenceId:
      deriveActionStructuralId(
        'owned-ira-sepp-annual-opening-state',
        [openingLineage],
      ),
  }
  const priorElectionHistoryEvidence =
    buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
      predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
      electionId: 'many-election',
      scheduleId: 'many-schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      historyThroughDate: '2029-12-31',
      terminalStateEvidenceId: 'many-prior-terminal',
      usedDistributionEvidenceIds: [],
    })
  const payments: NonNullable<
    OwnedNonRothIraSeppPenaltyScheduleRouteInput[
      'annualReconciliationInput'
    ]['payments']
  >[number][] = []
  const usedDistributionIds: string[] = []
  let terminalStateEvidenceId = openingStateEvidence.openingStateEvidenceId
  let scheduledTotal = 0
  let actualTotal = 0
  for (let index = 0; index < coverages.length; index += 1) {
    const coverage = coverages[index]!
    const history = buildOwnedNonRothIraSeppPriorPaymentHistoryEvidence({
      predicate: 'ownedNonRothIraSeppPriorPaymentHistory',
      electionId: 'many-election',
      scheduleId: 'many-schedule',
      participantPersonId: asPersonId('owner'),
      sourceAccountId: asAccountId('ira-account'),
      taxYear: 2030,
      openingStateEvidenceId: openingStateEvidence.openingStateEvidenceId,
      completedPaymentCount: index,
      usedCurrentDistributionEvidenceIds: usedDistributionIds,
      lastCompletedSequence: index,
      lastPaymentDate: index === 0
        ? null
        : coverages[index - 1]!.evaluationDate,
      terminalStateEvidenceId,
      scheduledGrossAmountThroughPriorPayments: asUsdCents(scheduledTotal),
      actualQualifyingGrossAmountThroughPriorPayments:
        asUsdCents(actualTotal),
      nextScheduledSequence: index + 1,
    })
    const currentPaymentEvidence = {
      predicate: 'ownedNonRothIraSeppCurrentScheduledPayment' as const,
      electionId: 'many-election',
      scheduleId: 'many-schedule',
      actionId: coverage.actionId,
      allocationId: coverage.allocationId,
      sourceAccountId: coverage.sourceAccountId,
      distributionDate: coverage.evaluationDate,
      currentDistributionEvidenceId:
        coverage.sourceEvidenceIds.distributionDateEvidenceId,
      paymentSequence: index + 1,
      previousScheduleStateId: terminalStateEvidenceId,
      currentScheduledGrossAmount: coverage.executedAmount,
      paymentScheduleEvidenceId: `many-payment-${index + 1}`,
    }
    const candidate = validateOwnedNonRothIraSeppCurrentPaymentCandidate({
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
    if (candidate.status !== 'provisionalCandidate') {
      throw new Error('many-payment fixture failed local SEPP validation')
    }
    payments.push({ currentPaymentEvidence })
    usedDistributionIds.push(currentPaymentEvidence.currentDistributionEvidenceId)
    scheduledTotal += candidate.candidate.scheduledGrossAmount
    actualTotal += candidate.candidate.actualGrossAmount
    terminalStateEvidenceId = candidate.candidate.afterState.stateEvidenceId
  }
  return {
    sourceAccountId: asAccountId('ira-account'),
    electionId: 'many-election',
    scheduleId: 'many-schedule',
    annualReconciliationInput: {
      sourceEvidence,
      electionEvidence,
      annualScheduleEvidence,
      noModificationEvidence,
      openingStateEvidence,
      priorElectionHistoryEvidence,
      payments,
    },
  }
}

describe('owned IRA SEPP penalty prerequisite integration', () => {
  it('produces final zero-penalty SEPP qualification from raw routed annual input', () => {
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      route: scheduleRoute(),
    }))

    expect(result.iraSeppScheduleReconciliations).toHaveLength(1)
    expect(result.iraSeppScheduleReconciliations[0]).toMatchObject({
      sourceAccountId: asAccountId('ira-account'),
      electionId: 'election',
      scheduleId: 'schedule',
      reconciliation: { status: 'reconciled' },
    })
    expect(result.evaluations).toHaveLength(1)
    expect(result.evaluations[0]).toMatchObject({
      outcome: 'iraSeppQualified',
      finalPenaltyAmount: 0,
      evaluatedOrdinaryIncomeExposureAmount: 100,
      reconciledPayment: {
        actionId: asActionId('action'),
        allocationId: asAllocationId('allocation'),
        currentDistributionEvidenceId: 'distribution-date',
      },
    })
  })

  it('binds final evidence to the annual result and current candidate/payment', () => {
    const baseline = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      route: scheduleRoute({ paymentScheduleEvidenceId: 'payment-a' }),
    }))
    const changed = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      route: scheduleRoute({ paymentScheduleEvidenceId: 'payment-b' }),
    }))
    const baselineEvaluation = baseline.evaluations[0]
    const changedEvaluation = changed.evaluations[0]
    expect(baselineEvaluation?.outcome).toBe('iraSeppQualified')
    expect(changedEvaluation?.outcome).toBe('iraSeppQualified')
    if (
      baselineEvaluation?.outcome !== 'iraSeppQualified' ||
      changedEvaluation?.outcome !== 'iraSeppQualified'
    ) return
    expect(changedEvaluation.reconciledPayment.currentPaymentCandidateId)
      .not.toBe(
        baselineEvaluation.reconciledPayment.currentPaymentCandidateId,
      )
    expect(changedEvaluation.annualReconciliationEvidence.annualReconciliationId)
      .not.toBe(
        baselineEvaluation.annualReconciliationEvidence.annualReconciliationId,
      )
    expect(changedEvaluation.finalEvidenceId).not.toBe(
      baselineEvaluation.finalEvidenceId,
    )
  })

  it('keeps every non-successful submitted route pending without negative authority', () => {
    for (const route of [
      scheduleRoute({ omitPayments: true }),
      scheduleRoute({ annualAmount: 101 }),
    ]) {
      const result = evaluateOwnedNonRothIraPenaltyPrerequisites(input({ route }))
      expect(result.iraSeppScheduleReconciliations[0]?.reconciliation.status)
        .not.toBe('reconciled')
      expect(result.evaluations[0]?.outcome).toBe(
        'exceptionEvaluationRequired',
      )
      expect(result.evaluations[0]).not.toHaveProperty('finalPenaltyAmount')
      expect(result.evaluations[0]).not.toHaveProperty('rejectedExceptions')
    }

    const notReconciled = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      route: scheduleRoute({ paymentGrossAmount: 99 }),
    }))
    expect(notReconciled.iraSeppScheduleReconciliations[0]
      ?.reconciliation.status).toBe('notReconciled')
    expect(notReconciled.evaluations[0]?.outcome).toBe(
      'exceptionEvaluationRequired',
    )
    expect(notReconciled.evaluations[0]).not.toHaveProperty(
      'rejectedExceptions',
    )
  })

  it('applies all-basis, age, and disability precedence before SEPP', () => {
    const allBasis = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      grossAmount: 100,
      basisAmount: 200,
      route: scheduleRoute(),
    }))
    expect(allBasis.iraSeppScheduleReconciliations[0]?.reconciliation.status)
      .toBe('reconciled')
    expect(allBasis.evaluations).toEqual([])

    const age = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      birthDate: '1970-01-01',
      route: scheduleRoute(),
    }))
    expect(age.evaluations[0]?.outcome).toBe('age59HalfReached')

    const disability = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      disability: true,
      route: scheduleRoute(),
    }))
    expect(disability.evaluations[0]?.outcome).toBe('disabilityQualified')
  })

  it('lets qualified SIMPLE bypass participation facts while fallback stays 25 percent', () => {
    const qualified = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
      route: scheduleRoute({ subtype: 'simple' }),
    }))
    expect(qualified.evaluations[0]?.outcome).toBe('iraSeppQualified')

    const fallback = evaluateOwnedNonRothIraPenaltyPrerequisites(input({
      subtype: 'simple',
    }))
    expect(fallback.evaluations[0]).toMatchObject({
      outcome: 'exceptionEvaluationRequired',
      rateEvidence: { denominator: 4 },
    })
  })

  it('uses the full same-source inventory while preserving sibling precedence', () => {
    const value = manyPaymentInput([
      {
        actionId: 'action-all-basis',
        allocationId: 'allocation-all-basis',
        date: '2030-01-05',
        grossAmount: 1,
      },
      {
        actionId: 'action-disability',
        allocationId: 'allocation-disability',
        date: '2030-01-10',
        grossAmount: 100,
      },
      {
        actionId: 'action-sepp',
        allocationId: 'allocation-sepp',
        date: '2030-01-20',
        grossAmount: 100,
      },
      {
        actionId: 'action-age',
        allocationId: 'allocation-age',
        date: '2030-03-01',
        grossAmount: 100,
      },
    ], {
      openingBasisAmount: 151,
      birthDate: '1970-08-01',
      disabilityDates: ['2030-01-10'],
    })
    value.iraSeppScheduleRoutes = [completeRouteForInput(value)]
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(value)

    expect(result.coverage).toHaveLength(4)
    const route = result.iraSeppScheduleReconciliations[0]
    expect(route?.reconciliation.status).toBe('reconciled')
    if (route?.reconciliation.status !== 'reconciled') return
    expect(route.reconciliation.evidence.distributionInventory
      .characterCoverages).toHaveLength(4)
    expect(result.coverage.find(
      (item) => item.actionId === asActionId('action-all-basis'),
    )?.ordinaryIncomeExposureAmount).toBe(0)
    expect(result.evaluations.map((item) => [item.actionId, item.outcome]))
      .toEqual([
        [asActionId('action-disability'), 'disabilityQualified'],
        [asActionId('action-sepp'), 'iraSeppQualified'],
        [asActionId('action-age'), 'age59HalfReached'],
      ])
  })

  it('is invariant to raw payment and source-evidence permutation', () => {
    const value = manyPaymentInput([
      {
        actionId: 'action-a',
        allocationId: 'allocation-a',
        date: '2030-01-05',
        grossAmount: 10,
      },
      {
        actionId: 'action-b',
        allocationId: 'allocation-b',
        date: '2030-02-05',
        grossAmount: 20,
      },
      {
        actionId: 'action-c',
        allocationId: 'allocation-c',
        date: '2030-03-05',
        grossAmount: 30,
      },
    ])
    const route = completeRouteForInput(value)
    const baseline = evaluateOwnedNonRothIraPenaltyPrerequisites({
      ...value,
      iraSeppScheduleRoutes: [route],
    })
    const reversedRoute = {
      ...route,
      annualReconciliationInput: {
        ...route.annualReconciliationInput,
        payments: [...route.annualReconciliationInput.payments!].reverse(),
      },
    }
    const reversed = evaluateOwnedNonRothIraPenaltyPrerequisites({
      ...value,
      sourceEvidence: [...value.sourceEvidence].reverse(),
      iraSeppScheduleRoutes: [reversedRoute],
    })

    expect(reversed).toEqual(baseline)
  })

  it('reconciles a complete twelve-payment route into twelve final decisions', () => {
    const entries = Array.from({ length: 12 }, (_unused, index) => ({
      actionId: `action-${String(index + 1).padStart(2, '0')}`,
      allocationId: `allocation-${String(index + 1).padStart(2, '0')}`,
      date: `2030-${String(index + 1).padStart(2, '0')}-15`,
      grossAmount: 10,
    }))
    const value = manyPaymentInput(entries)
    value.iraSeppScheduleRoutes = [completeRouteForInput(value)]
    const result = evaluateOwnedNonRothIraPenaltyPrerequisites(value)

    expect(result.iraSeppScheduleReconciliations[0]?.reconciliation.status)
      .toBe('reconciled')
    expect(result.evaluations).toHaveLength(12)
    expect(result.evaluations.every(
      (evaluation) => evaluation.outcome === 'iraSeppQualified',
    )).toBe(true)
  })

  it('rejects duplicate/ambiguous routes and contradictory no-SEPP evidence', () => {
    const duplicate = input({ route: scheduleRoute() })
    duplicate.iraSeppScheduleRoutes = [scheduleRoute(), scheduleRoute()]
    expect(() => evaluateOwnedNonRothIraPenaltyPrerequisites(duplicate))
      .toThrow('routes must be unique')

    const repeatedElection = input({ route: scheduleRoute() })
    repeatedElection.iraSeppScheduleRoutes = [
      scheduleRoute(),
      {
        ...scheduleRoute(),
        sourceAccountId: asAccountId('different-source'),
        scheduleId: 'different-schedule',
      },
    ]
    expect(() => evaluateOwnedNonRothIraPenaltyPrerequisites(repeatedElection))
      .toThrow('election IDs must be unique')

    const repeatedSchedule = input({ route: scheduleRoute() })
    repeatedSchedule.iraSeppScheduleRoutes = [
      scheduleRoute(),
      {
        ...scheduleRoute(),
        sourceAccountId: asAccountId('different-source'),
        electionId: 'different-election',
      },
    ]
    expect(() => evaluateOwnedNonRothIraPenaltyPrerequisites(repeatedSchedule))
      .toThrow('schedule IDs must be unique')

    const contradictory = input({ route: scheduleRoute() })
    contradictory.iraSeppStatusEvidence = [{
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      evaluationDate: '2030-06-01',
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'no-sepp',
    }]
    expect(() => evaluateOwnedNonRothIraPenaltyPrerequisites(contradictory))
      .toThrow('contradictory')
  })

  it('is deterministic, detached, and deeply frozen', () => {
    const value = input({ route: scheduleRoute() })
    const first = evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    const second = evaluateOwnedNonRothIraPenaltyPrerequisites(value)
    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.iraSeppScheduleReconciliations)).toBe(true)
    expect(Object.isFrozen(
      first.iraSeppScheduleReconciliations[0]?.reconciliation,
    )).toBe(true)
    expect(Object.isFrozen(first.evaluations[0])).toBe(true)

    const payments = value.iraSeppScheduleRoutes?.[0]
      ?.annualReconciliationInput.payments
    if (payments === undefined) throw new Error('fixture lost payments')
    ;(payments as unknown as {
      currentPaymentEvidence: { paymentScheduleEvidenceId: string }
    }[])[0]!
      .currentPaymentEvidence.paymentScheduleEvidenceId = 'mutated'
    expect(first.evaluations[0]?.outcome).toBe('iraSeppQualified')
    expect(first.iraSeppScheduleReconciliations[0]?.reconciliation.status)
      .toBe('reconciled')
  })
})
