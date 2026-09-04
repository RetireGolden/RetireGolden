import { describe, expect, it } from 'vitest'

import type { OrdinaryWithdrawalRequest } from './contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import {
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
  type ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput,
} from './ownedNonRothIraAnnualFinalization.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  OwnedNonRothIraSeppPenaltyScheduleRouteInput,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
} from './ownedNonRothIraSeppAnnualReconciliation.js'
import type {
  OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import { deriveActionStructuralId } from './structuralId.js'

const ownerPersonId = asPersonId('owner')
const sourceAccountId = asAccountId('ira-account')
const actionId = asActionId('action')
const allocationId = asAllocationId('allocation')

function annualInput(subtype: OwnedNonRothIraSubtype = 'traditional') {
  return {
    ownerPersonId,
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear' as const,
      ownerPersonId,
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [sourceAccountId] as [typeof sourceAccountId],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      evidenceId: 'complete-pool',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear: 2030,
    poolMembers: [{
      sourceAccountId,
      ownerPersonId,
      accountType: 'traditional' as const,
      accountKind: 'ira' as const,
      inheritanceStatus: 'owned' as const,
      subtype,
      yearEndApplicableBalanceAmount: asUsdCents(0),
      iraClassificationEvidenceId: 'classification',
      accountOwnershipEvidenceId: 'ownership',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(100),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line8Conversions: [],
  }
}

function scheduleRoute(
  distributionDateEvidenceId: string,
  annualScheduledGrossAmount = 100,
  subtype: OwnedNonRothIraSubtype = 'traditional',
): OwnedNonRothIraSeppPenaltyScheduleRouteInput {
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'election',
    scheduleId: 'schedule',
    participantPersonId: ownerPersonId,
    sourceAccountId,
    taxYear: 2030,
    priorHistoryTerminalStateId: 'prior-terminal',
    nextScheduledSequence: 1 as const,
    scheduledGrossAmount: 0 as const,
    actualQualifyingGrossAmount: 0 as const,
  }
  const openingStateEvidence = {
    ...openingLineage,
    openingStateEvidenceId:
      `owned-ira-sepp-annual-opening-state:${JSON.stringify([
        openingLineage,
      ])}`,
  }
  return {
    sourceAccountId,
    electionId: 'election',
    scheduleId: 'schedule',
    annualReconciliationInput: {
      sourceEvidence: {
        predicate: 'ownedNonRothIraSeppSource',
        sourceAccountId,
        ownerPersonId,
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
        participantPersonId: ownerPersonId,
        sourceAccountId,
        subtype,
        electionStartDate: '2030-01-01',
        method: 'fixedAmortization',
        electionEvidenceId: 'election-evidence',
      },
      annualScheduleEvidence: {
        predicate: 'ownedNonRothIraSeppAnnualSchedule',
        electionId: 'election',
        scheduleId: 'schedule',
        participantPersonId: ownerPersonId,
        sourceAccountId,
        taxYear: 2030,
        annualScheduledGrossAmount:
          asUsdCents(annualScheduledGrossAmount),
        annualScheduleEvidenceId: 'annual-schedule',
      },
      noModificationEvidence: {
        predicate:
          'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
        electionId: 'election',
        scheduleId: 'schedule',
        participantPersonId: ownerPersonId,
        sourceAccountId,
        throughDate: '2030-12-31',
        disqualifyingModification: 'none',
        noModificationEvidenceId: 'no-modification',
      },
      openingStateEvidence,
      priorElectionHistoryEvidence:
        buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
          predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
          electionId: 'election',
          scheduleId: 'schedule',
          participantPersonId: ownerPersonId,
          sourceAccountId,
          historyThroughDate: '2029-12-31',
          terminalStateEvidenceId: 'prior-terminal',
          usedDistributionEvidenceIds: [],
        }),
      payments: [{
        currentPaymentEvidence: {
          predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
          electionId: 'election',
          scheduleId: 'schedule',
          actionId,
          allocationId,
          sourceAccountId,
          distributionDate: '2030-06-01',
          currentDistributionEvidenceId: distributionDateEvidenceId,
          paymentSequence: 1,
          previousScheduleStateId:
            openingStateEvidence.openingStateEvidenceId,
          currentScheduledGrossAmount: asUsdCents(100),
          paymentScheduleEvidenceId: 'payment-schedule',
        },
      }],
    },
  }
}

function finalizerFixture(
  options: Readonly<{
    annualScheduledGrossAmount?: number
    subtype?: OwnedNonRothIraSubtype
  }> = {},
): ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput {
  const subtype = options.subtype ?? 'traditional'
  return {
    annualInput: annualInput(subtype),
    stagedExecutedWithdrawals: [{
      actionId,
      allocationId,
      sourceAccountId,
      scheduledDate: '2030-06-01',
      scheduledSequence: 1,
      grossAmount: asUsdCents(100),
    }],
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId,
      birthDate: '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId,
      allocationId,
      sourceAccountId,
      ownerPersonId,
      subtype,
      evaluationDate: '2030-06-01',
      distributionDateEvidenceId: 'distribution-date',
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    }],
    iraSeppScheduleRoutes: [
      scheduleRoute(
        'distribution-date',
        options.annualScheduledGrossAmount ?? 100,
        subtype,
      ),
    ],
    simpleParticipationEvidence: [],
  }
}

function coordinatorFixture(
  options: Readonly<{
    annualScheduledGrossAmount?: number
    subtype?: OwnedNonRothIraSubtype
  }> = {},
): CoordinateOwnedNonRothIraAnnualWithdrawalCandidateInput {
  const subtype = options.subtype ?? 'traditional'
  const annualScheduledGrossAmount =
    options.annualScheduledGrossAmount ?? 100
  const request: OrdinaryWithdrawalRequest = {
    actionId,
    kind: 'ordinaryWithdrawal',
    personId: ownerPersonId,
    year: 2030,
    executionDate: '2030-06-01',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(100),
    allocations: [{
      allocationId,
      sourceAccountId,
      requestedAmount: asPositiveUsdCents(100),
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
  const movementInput = {
    ownerPersonId,
    taxYear: 2030,
    requests: [request],
    openingBalances: [{
      accountId: sourceAccountId,
      openingBalance: asUsdCents(100),
    }],
    sourceEvidence: [{
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource' as const,
      sourceAccountId,
      ownerPersonId,
      accountType: 'traditional' as const,
      accountKind: 'ira' as const,
      inheritanceStatus: 'owned' as const,
      subtype,
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    }],
  }
  const staged = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
    movementInput,
  )
  if (staged.status !== 'movementCandidateStaged') {
    throw new Error('SEPP coordinator fixture failed movement staging')
  }
  const distributionDateEvidenceId =
    buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: staged.movementCandidateId,
      actionId,
      allocationId,
      sourceAccountId,
      executionDate: '2030-06-01',
    })
  return {
    movementInput,
    annualInput: annualInput(subtype),
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId,
      birthDate: '1980-01-01',
      evidenceId: 'birth-date',
    },
    iraSeppScheduleRoutes: [
      scheduleRoute(
        distributionDateEvidenceId,
        annualScheduledGrossAmount,
        subtype,
      ),
    ],
    simpleParticipationEvidence: [],
  }
}

function fixtureForRouteStatus(
  status: 'evidenceMissing' | 'reconciliationIncomplete' | 'notReconciled',
): ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput {
  const input = finalizerFixture()
  const route = input.iraSeppScheduleRoutes![0]!
  const annualReconciliationInput = route.annualReconciliationInput
  input.iraSeppScheduleRoutes = [{
    ...route,
    annualReconciliationInput: {
      ...annualReconciliationInput,
      annualScheduleEvidence: status === 'evidenceMissing'
        ? undefined
        : {
            ...annualReconciliationInput.annualScheduleEvidence!,
            annualScheduledGrossAmount: asUsdCents(
              status === 'reconciliationIncomplete' ? 101 : 99,
            ),
          },
    },
  }]
  return input
}

describe('owned non-Roth IRA annual SEPP integration', () => {
  it('finalizes a complete reconciled route as zero-penalty SEPP evidence', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      finalizerFixture(),
    )

    expect(result.status).toBe('annualEvidenceResolved')
    if (result.status !== 'annualEvidenceResolved') return
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations,
    ).toHaveLength(1)
    const evaluation =
      result.annualEvidence.penaltyPrerequisites.evaluations[0]
    expect(evaluation).toMatchObject({
      outcome: 'iraSeppQualified',
      finalPenaltyAmount: 0,
    })
    expect(
      result.annualEvidence.penaltyPrerequisites
        .iraSeppScheduleReconciliations[0]?.reconciliation.status,
    ).toBe('reconciled')
    const annualReconciliationId =
      result.annualEvidence.penaltyPrerequisites
        .iraSeppScheduleReconciliations[0]!.reconciliation
    if (annualReconciliationId.status !== 'reconciled') return
    expect(annualReconciliationId.evidence.annualReconciliationId).toMatch(
      /^[^:]+:[0-9a-f]{64}$/,
    )
  })

  it.each([
    'evidenceMissing',
    'reconciliationIncomplete',
    'notReconciled',
  ] as const)('keeps a %s route pending with exact diagnostics', (status) => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      fixtureForRouteStatus(status),
    )

    expect(result.status).toBe('penaltyEvidenceMissing')
    if (result.status !== 'penaltyEvidenceMissing') return
    expect(result.issues[0]?.prerequisite.outcome).toBe(
      'exceptionEvaluationRequired',
    )
    expect(result.iraSeppScheduleReconciliations).toHaveLength(1)
    expect(
      result.iraSeppScheduleReconciliations[0]?.reconciliation.status,
    ).toBe(status)
    expect(
      result.iraSeppScheduleReconciliations[0]?.reconciliation,
    ).toHaveProperty('issues')
  })

  it('preserves the established no-route finalization ID formula', () => {
    const input = finalizerFixture()
    input.iraSeppScheduleRoutes = []
    input.ownerEvidence = {
      ...input.ownerEvidence,
      birthDate: '1950-01-01',
    }
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(input)

    expect(result.status).toBe('annualEvidenceResolved')
    if (result.status !== 'annualEvidenceResolved') return
    const evidence = result.annualEvidence
    expect(evidence.finalizationEvidenceId).toBe(
      deriveActionStructuralId(
        'owned-non-roth-ira-annual-withdrawal-finalization',
        [
          evidence.ownerPersonId,
          evidence.ownerWideNonRothIraPoolId,
          evidence.taxYear,
          evidence.characterization.annualBasisEvidence.basisEvidenceId,
          evidence.characterization.line7AllocationEvidence
            .allocationEvidenceId,
          evidence.characterization.line8AllocationEvidence
            .allocationEvidenceId,
          evidence.penaltyPrerequisites.coverage
            .map((item) => item.evidenceId)
            .sort(),
          evidence.penaltyPrerequisites.evaluations
            .map((item) => item.finalEvidenceId)
            .sort(),
        ],
      ),
    )

    const omitted = finalizerFixture()
    omitted.ownerEvidence = input.ownerEvidence
    delete omitted.iraSeppScheduleRoutes
    const omittedResult =
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(omitted)
    expect(omittedResult.status).toBe('annualEvidenceResolved')
    if (omittedResult.status !== 'annualEvidenceResolved') return
    expect(omittedResult.annualEvidence.finalizationEvidenceId).toBe(
      evidence.finalizationEvidenceId,
    )
  })

  it('coordinates a complete raw route and binds the final SEPP decision', () => {
    const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
      coordinatorFixture(),
    )

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations[0],
    ).toMatchObject({
      outcome: 'iraSeppQualified',
      finalPenaltyAmount: 0,
    })
    expect(result.bindingEvidence.finalizationEvidenceId).toBe(
      result.annualEvidence.finalizationEvidenceId,
    )
  })

  it('propagates blocked route diagnostics through the coordinator', () => {
    const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
      coordinatorFixture({ annualScheduledGrossAmount: 101 }),
    )

    expect(result.status).toBe('annualEvidenceBlocked')
    if (result.status !== 'annualEvidenceBlocked') return
    expect(result.iraSeppScheduleReconciliations).toHaveLength(1)
    expect(
      result.iraSeppScheduleReconciliations[0]?.reconciliation.status,
    ).not.toBe('reconciled')
  })

  it('qualifies a complete SIMPLE route without participation-rate evidence', () => {
    const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate(
      coordinatorFixture({ subtype: 'simple' }),
    )

    expect(result.status).toBe('annualEvidenceBound')
    if (result.status !== 'annualEvidenceBound') return
    expect(result.annualEvidence.penaltyPrerequisites.evaluations[0])
      .toMatchObject({ outcome: 'iraSeppQualified', subtype: 'simple' })
  })

  it('rejects contradictory no-SEPP evidence when a source route is submitted', () => {
    const input = finalizerFixture()
    input.iraSeppStatusEvidence = [{
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId,
      allocationId,
      sourceAccountId,
      ownerPersonId,
      evaluationDate: '2030-06-01',
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'no-sepp',
    }]

    expect(() => resolveOwnedNonRothIraAnnualWithdrawalEvidence(input))
      .toThrow('contradictory for a submitted positive schedule route')
  })

  it('preserves age, disability, and all-basis precedence over SEPP qualification', () => {
    const age = fixtureForRouteStatus('notReconciled')
    age.ownerEvidence = { ...age.ownerEvidence, birthDate: '1950-01-01' }
    const ageResult = resolveOwnedNonRothIraAnnualWithdrawalEvidence(age)
    expect(ageResult.status).toBe('annualEvidenceResolved')
    if (ageResult.status !== 'annualEvidenceResolved') return
    expect(ageResult.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome)
      .toBe('age59HalfReached')

    const disability = fixtureForRouteStatus('notReconciled')
    disability.qualifiedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: ownerPersonId,
      disabilityQualificationDate: '2030-05-01',
      evaluationDate: '2030-06-01',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'disability',
    }]
    const disabilityResult =
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(disability)
    expect(disabilityResult.status).toBe('annualEvidenceResolved')
    if (disabilityResult.status !== 'annualEvidenceResolved') return
    expect(
      disabilityResult.annualEvidence.penaltyPrerequisites.evaluations[0]
        ?.outcome,
    ).toBe('disabilityQualified')

    const allBasis = finalizerFixture()
    allBasis.annualInput = {
      ...allBasis.annualInput,
      annualFacts: {
        ...allBasis.annualInput.annualFacts,
        openingBasisAmount: asUsdCents(100),
      },
    }
    const allBasisResult =
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(allBasis)
    expect(allBasisResult.status).toBe('annualEvidenceResolved')
    if (allBasisResult.status !== 'annualEvidenceResolved') return
    expect(
      allBasisResult.annualEvidence.penaltyPrerequisites.evaluations,
    ).toEqual([])
    expect(
      allBasisResult.annualEvidence.penaltyPrerequisites.coverage[0],
    ).toMatchObject({
      executedAmount: 100,
      basisReturnExcludedAmount: 100,
      ordinaryIncomeExposureAmount: 0,
    })
  })

  it('uses a fixed-width digest for non-success route bindings on resolved precedence outcomes', () => {
    const input = fixtureForRouteStatus('notReconciled')
    input.ownerEvidence = { ...input.ownerEvidence, birthDate: '1950-01-01' }
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(input)

    expect(result.status).toBe('annualEvidenceResolved')
    if (result.status !== 'annualEvidenceResolved') return
    const evidence = result.annualEvidence
    const route = evidence.penaltyPrerequisites
      .iraSeppScheduleReconciliations[0]!
    const routeResultDigest = deriveActionStructuralId(
      'owned-ira-sepp-annual-route-result',
      [route.reconciliation],
    )

    expect(route.reconciliation.status).toBe('notReconciled')
    expect(routeResultDigest).toMatch(
      /^owned-ira-sepp-annual-route-result:[0-9a-f]{64}$/,
    )
    // The whole finalization ID is rebuilt here, so this pins that the
    // non-success route contributes exactly its account/election/schedule
    // triple, its status, and the fixed-width digest of the reconciliation —
    // never the reconciliation payload itself.
    expect(evidence.finalizationEvidenceId).toBe(
      deriveActionStructuralId(
        'owned-non-roth-ira-annual-withdrawal-finalization',
        [
          evidence.ownerPersonId,
          evidence.ownerWideNonRothIraPoolId,
          evidence.taxYear,
          evidence.characterization.annualBasisEvidence.basisEvidenceId,
          evidence.characterization.line7AllocationEvidence
            .allocationEvidenceId,
          evidence.characterization.line8AllocationEvidence
            .allocationEvidenceId,
          evidence.penaltyPrerequisites.coverage
            .map((item) => item.evidenceId)
            .sort(),
          evidence.penaltyPrerequisites.evaluations
            .map((item) => item.finalEvidenceId)
            .sort(),
          [[
            route.sourceAccountId,
            route.electionId,
            route.scheduleId,
            route.reconciliation.status,
            routeResultDigest,
          ]],
        ],
      ),
    )
  })

  it('blocks a mismatched staged-date lineage and accepts no caller candidate ID', () => {
    const input = coordinatorFixture()
    const payment = input.iraSeppScheduleRoutes![0]!
      .annualReconciliationInput.payments![0]!.currentPaymentEvidence
    ;(payment as { currentDistributionEvidenceId: string })
      .currentDistributionEvidenceId = 'foreign-distribution-date'
    expect(payment).not.toHaveProperty('currentPaymentCandidateId')

    const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)
    expect(result.status).toBe('annualEvidenceBlocked')
    if (result.status !== 'annualEvidenceBlocked') return
    expect(
      result.iraSeppScheduleReconciliations[0]?.reconciliation.status,
    ).toBe('notReconciled')
  })

  it('binds material SEPP lineage changes transitively without changing movement identity', () => {
    const baselineInput = coordinatorFixture()
    const changedInput = coordinatorFixture()
    const changedPayment = changedInput.iraSeppScheduleRoutes![0]!
      .annualReconciliationInput.payments![0]!.currentPaymentEvidence
    ;(changedPayment as { paymentScheduleEvidenceId: string })
      .paymentScheduleEvidenceId = 'changed-payment-schedule'

    const baseline =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(baselineInput)
    const changed =
      coordinateOwnedNonRothIraAnnualWithdrawalCandidate(changedInput)
    expect(baseline.status).toBe('annualEvidenceBound')
    expect(changed.status).toBe('annualEvidenceBound')
    if (
      baseline.status !== 'annualEvidenceBound' ||
      changed.status !== 'annualEvidenceBound'
    ) return
    expect(changed.movementCandidate.movementCandidateId).toBe(
      baseline.movementCandidate.movementCandidateId,
    )
    const baselineReconciliation = baseline.annualEvidence
      .penaltyPrerequisites.iraSeppScheduleReconciliations[0]!.reconciliation
    const changedReconciliation = changed.annualEvidence
      .penaltyPrerequisites.iraSeppScheduleReconciliations[0]!.reconciliation
    expect(baselineReconciliation.status).toBe('reconciled')
    expect(changedReconciliation.status).toBe('reconciled')
    if (
      baselineReconciliation.status !== 'reconciled' ||
      changedReconciliation.status !== 'reconciled'
    ) return
    expect(changedReconciliation.evidence.annualReconciliationId).not.toBe(
      baselineReconciliation.evidence.annualReconciliationId,
    )
    expect(changed.annualEvidence.finalizationEvidenceId).not.toBe(
      baseline.annualEvidence.finalizationEvidenceId,
    )
    expect(changed.bindingEvidence.bindingEvidenceId).not.toBe(
      baseline.bindingEvidence.bindingEvidenceId,
    )
  })

  it('returns detached deeply frozen route evidence without freezing callers', () => {
    const input = coordinatorFixture()
    const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate(input)

    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.iraSeppScheduleRoutes)).toBe(false)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.movementCandidate)).toBe(true)
    if (result.status !== 'annualEvidenceBound') return
    expect(Object.isFrozen(result.annualEvidence)).toBe(true)
    expect(Object.isFrozen(
      result.annualEvidence.penaltyPrerequisites
        .iraSeppScheduleReconciliations[0],
    )).toBe(true)

    const payment = input.iraSeppScheduleRoutes![0]!
      .annualReconciliationInput.payments![0]!.currentPaymentEvidence
    ;(payment as { paymentScheduleEvidenceId: string })
      .paymentScheduleEvidenceId = 'mutated-after-call'
    const reconciliation = result.annualEvidence.penaltyPrerequisites
      .iraSeppScheduleReconciliations[0]!.reconciliation
    expect(reconciliation.status).toBe('reconciled')
    if (reconciliation.status !== 'reconciled') return
    expect(reconciliation.evidence.payments[0]?.paymentScheduleEvidenceId)
      .toBe('payment-schedule')
  })

  it('exports the exact coordinator distribution-date evidence formula', () => {
    expect(buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: 'candidate',
      actionId,
      allocationId,
      sourceAccountId,
      executionDate: '2030-06-01',
    })).toBe(
      deriveActionStructuralId(
        'owned-non-roth-ira-staged-distribution-date',
        [
          'candidate',
          actionId,
          allocationId,
          sourceAccountId,
          '2030-06-01',
        ],
      ),
    )
    expect(() => buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: ' ',
      actionId,
      allocationId,
      sourceAccountId,
      executionDate: '2030-06-01',
    })).toThrow('nonblank stable identifier')
    expect(() => buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: 'candidate',
      actionId,
      allocationId,
      sourceAccountId,
      executionDate: '2030-02-30',
    })).toThrow('valid civil date')
  })
})
