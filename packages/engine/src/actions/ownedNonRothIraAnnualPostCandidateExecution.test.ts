import { describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  buildOwnedNonRothIraStagedDistributionDateEvidenceId,
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import {
  executePlanOwnedNonRothIraAnnualPostCandidate,
  type ExecutePlanOwnedNonRothIraAnnualPostCandidateInput,
} from './ownedNonRothIraAnnualPostCandidateExecution.js'
import {
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import {
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
} from './ownedNonRothIraSeppAnnualReconciliation.js'
import { deriveActionStructuralId } from './structuralId.js'
import * as structuralId from './structuralId.js'

const owner = asPersonId('p1')
const planId = asPlanId('post-candidate-execution-plan')
const requestedIra = asAccountId('ira-requested')
const siblingIra = asAccountId('ira-unrequested')
// These two end-to-end penalty cases intentionally coordinate the annual
// evidence once to construct the expected finalization and again inside the
// binder. The synchronous structural hashing is substantially slower under V8
// coverage instrumentation on GitHub's Linux runners.
const COVERAGE_INSTRUMENTED_BINDER_TIMEOUT_MS = 60_000

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }
type MutablePostCandidateInput = Mutable<
  BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput
> & {
  inventoryInput: Mutable<
    BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput['inventoryInput']
  >
  movementInput: Mutable<
    BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput['movementInput']
  >
  postCandidateSnapshot: Mutable<
    BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput['postCandidateSnapshot']
  >
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.accounts = [
    traditionalAccount(requestedIra, 100, owner),
    traditionalAccount(siblingIra, 200, owner),
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [
      {
        sourceAccountId: requestedIra,
        subtype: 'traditional',
        evidenceId: 'classification-requested',
        provenance: { source: 'manual' },
      },
      {
        sourceAccountId: siblingIra,
        subtype: 'sep',
        evidenceId: 'classification-sibling',
        provenance: { source: 'manual' },
      },
    ],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [{
    actionId: asActionId('withdrawal'),
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 10,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'manual' },
    personId: owner,
    allocations: [{
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: requestedIra,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return value
}

function yearEnd(sourceAccountId: typeof requestedIra, amount: number, suffix: string) {
  return {
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId,
    ownerPersonId: owner,
    sourceAccountId,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    ledgerPhase:
      'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
    asOfDate: '2030-12-31',
    yearEndApplicableBalanceAmount: asUsdCents(amount),
    evidenceId: `year-end-${suffix}`,
    upstreamEvidenceId: `year-end-${suffix}-upstream`,
  }
}

function postCandidateInput(opening = 10_000): MutablePostCandidateInput {
  const valuePlan = plan()
  const inventoryInput = {
    plan: valuePlan,
    taxYear: 2030,
    runtimeRecords: [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty' as const,
      resolvedEventIds: [],
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
  const request = valuePlan.strategies.retirementActions[0]!
  if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
  const movementInput: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
    ownerPersonId: owner,
    taxYear: 2030,
    requests: [request],
    openingBalances: [{
      accountId: requestedIra,
      openingBalance: asUsdCents(opening),
    }],
    sourceEvidence: [{
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      accountOwnershipEvidenceId: deriveActionStructuralId(
        'owned-ira-plan-account-ownership',
        [planId, owner, requestedIra, 'traditional', 'ira', 'owned'],
      ),
      iraClassificationEvidenceId: 'classification-requested',
    }],
  }
  const candidate =
    stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  if (candidate.status !== 'movementCandidateStaged') {
    throw new Error('fixture candidate invalid')
  }
  const inventory = buildAnnualRetirementPhysicalEventInventory(inventoryInput)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error('fixture inventory invalid')
  }
  return structuredClone({
    inventoryInput,
    movementInput,
    movementCandidate: candidate,
    postCandidateSnapshot: {
      predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryEvidenceId: inventory.inventoryEvidenceId,
      movementCandidateId: candidate.movementCandidateId,
      applicationStatus: 'canonicalMovementCandidateAppliedExactlyOnce',
      allocationApplications: candidate.actions.flatMap((action) =>
        action.allocations.map((allocation) => ({
          actionId: action.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          scheduledDate: action.executionDate,
          scheduledSequence: action.executionSequence,
          requestedAmount: allocation.requestedAmount,
          balanceBefore: allocation.balanceBefore,
          executedAmount: allocation.executedAmount,
          unexecutedAmount: allocation.unexecutedAmount,
          candidateBalanceAfter: allocation.candidateBalanceAfter,
          applicationEvidenceId:
            `application-${action.actionId}-${allocation.allocationId}`,
          upstreamEvidenceId:
            `application-${action.actionId}-${allocation.allocationId}-upstream`,
        }))),
      candidateBalances: candidate.candidateBalances.map((balance) => ({
        ...balance,
        evidenceId: `candidate-balance-${balance.sourceAccountId}`,
        upstreamEvidenceId:
          `candidate-balance-${balance.sourceAccountId}-upstream`,
      })),
      yearEndApplicableBalances: [
        yearEnd(requestedIra, 0, 'requested'),
        yearEnd(siblingIra, 20_000, 'sibling'),
      ],
      evidenceId: 'post-candidate-snapshot',
      upstreamEvidenceId: 'post-candidate-snapshot-upstream',
    },
    annualBasisRecord: {
      predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete',
      openingBasisAmount: asUsdCents(4_000),
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
      evidenceId: 'annual-basis-record',
      upstreamEvidenceId: 'annual-basis-record-upstream',
    },
    postYearContributionWindow: {
      predicate:
        'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      deadlineEvidence: {
        predicate: 'federalIraContributionDeadlineForTaxYear',
        designatedTaxYear: 2030,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished',
        deadlineKind:
          'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
        calendarAdjustmentStatus:
          'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
        deadlineDate: '2031-04-15',
        evidenceId: 'contribution-deadline',
        upstreamEvidenceId: 'contribution-deadline-upstream',
      },
      contributions: [{
        contributionId: 'post-year-contribution',
        planId,
        ownerPersonId: owner,
        sourceAccountId: siblingIra,
        designatedTaxYear: 2030,
        contributionDate: '2031-02-01',
        nondeductibleContributionAmount: asPositiveUsdCents(2_500),
        evidenceId: 'post-year-contribution-evidence',
        upstreamEvidenceId: 'post-year-contribution-upstream',
      }],
      evidenceId: 'contribution-window',
      upstreamEvidenceId: 'contribution-window-upstream',
    },
  }) as unknown as MutablePostCandidateInput
}

function builtEvidence(
  input: BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
): PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult {
  const result =
    buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(input)
  if (result.status !== 'postCandidateClassificationInputBuilt') {
    throw new Error(
      `fixture build failed: ${result.status} ${JSON.stringify(result.issues)}`,
    )
  }
  return result
}

function annualFinalization(
  input: BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  evidence: PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult,
  birthDate = '1950-01-01',
  ownerEvidenceId = 'owner-birth',
) {
  const { line7Distributions, ...annualInput } =
    evidence.classificationInput
  void line7Distributions
  const result = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: input.movementInput,
    annualInput,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: owner,
      birthDate,
      evidenceId: ownerEvidenceId,
    },
    simpleParticipationEvidence: [],
  })
  return result.status === 'annualEvidenceBound'
    ? result.annualEvidence
    : null
}

function executionInput(
  opening = 10_000,
  birthDate = '1950-01-01',
  ownerEvidenceId = 'owner-birth',
): ExecutePlanOwnedNonRothIraAnnualPostCandidateInput {
  const evidenceInput = postCandidateInput(opening)
  const evidence = builtEvidence(evidenceInput)
  return {
    postCandidateInput: evidenceInput,
    postCandidateEvidence: evidence,
    annualFinalization:
      annualFinalization(
        evidenceInput,
        evidence,
        birthDate,
        ownerEvidenceId,
      ),
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: owner,
      birthDate,
      evidenceId: ownerEvidenceId,
    },
    simpleParticipationEvidence: [],
  }
}

function twoPaymentExecutionInput(
  birthDate = '1990-01-01',
  secondSourceAccountId = requestedIra,
): ExecutePlanOwnedNonRothIraAnnualPostCandidateInput {
  const evidenceInput = postCandidateInput(10_000)
  const firstRequest = {
    actionId: asActionId('withdrawal-a'),
    kind: 'ordinaryWithdrawal' as const,
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 10,
    requestedAmount: asPositiveUsdCents(5_000),
    provenance: { source: 'manual' as const },
    personId: owner,
    allocations: [{
      allocationId: asAllocationId('withdrawal-allocation-a'),
      sourceAccountId: requestedIra,
      requestedAmount: asPositiveUsdCents(5_000),
    }],
    purpose: { kind: 'spending' as const },
  }
  const secondRequest = {
    ...firstRequest,
    actionId: asActionId('withdrawal-b'),
    executionDate: '2030-09-15',
    executionSequence: 20,
    allocations: [{
      allocationId: asAllocationId('withdrawal-allocation-b'),
      sourceAccountId: secondSourceAccountId,
      requestedAmount: asPositiveUsdCents(5_000),
    }],
  }
  ;(evidenceInput.inventoryInput.plan as Plan).strategies.retirementActions = [
    firstRequest,
    secondRequest,
  ]
  evidenceInput.movementInput.requests = [firstRequest, secondRequest]
  if (secondSourceAccountId === siblingIra) {
    evidenceInput.movementInput.openingBalances = [{
      accountId: requestedIra,
      openingBalance: asUsdCents(5_000),
    }, {
      accountId: siblingIra,
      openingBalance: asUsdCents(5_000),
    }]
    evidenceInput.movementInput.sourceEvidence = [
      ...evidenceInput.movementInput.sourceEvidence,
      {
        predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
        sourceAccountId: siblingIra,
        ownerPersonId: owner,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: 'sep',
        accountOwnershipEvidenceId: deriveActionStructuralId(
          'owned-ira-plan-account-ownership',
          [planId, owner, siblingIra, 'traditional', 'ira', 'owned'],
        ),
        iraClassificationEvidenceId: 'classification-sibling',
      },
    ]
  }
  const candidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
    evidenceInput.movementInput,
  )
  if (candidate.status !== 'movementCandidateStaged') {
    throw new Error('two-payment fixture candidate invalid')
  }
  evidenceInput.movementCandidate = candidate
  const snapshot = evidenceInput.postCandidateSnapshot
  if (secondSourceAccountId === siblingIra) {
    for (const balance of snapshot.yearEndApplicableBalances) {
      if (balance.sourceAccountId === siblingIra) {
        ;(balance as { yearEndApplicableBalanceAmount: number })
          .yearEndApplicableBalanceAmount = 0
      }
    }
  }
  snapshot.movementCandidateId = candidate.movementCandidateId
  snapshot.allocationApplications = candidate.actions.flatMap((action) =>
    action.allocations.map((allocation) => ({
      actionId: action.actionId,
      allocationId: allocation.allocationId,
      sourceAccountId: allocation.sourceAccountId,
      scheduledDate: action.executionDate,
      scheduledSequence: action.executionSequence,
      requestedAmount: allocation.requestedAmount,
      balanceBefore: allocation.balanceBefore,
      executedAmount: allocation.executedAmount,
      unexecutedAmount: allocation.unexecutedAmount,
      candidateBalanceAfter: allocation.candidateBalanceAfter,
      applicationEvidenceId:
        `application-${action.actionId}-${allocation.allocationId}`,
      upstreamEvidenceId:
        `application-${action.actionId}-${allocation.allocationId}-upstream`,
    })))
  snapshot.candidateBalances = candidate.candidateBalances.map((balance) => ({
    ...balance,
    evidenceId: `candidate-balance-${balance.sourceAccountId}`,
    upstreamEvidenceId:
      `candidate-balance-${balance.sourceAccountId}-upstream`,
  }))
  const inventory = buildAnnualRetirementPhysicalEventInventory(
    evidenceInput.inventoryInput,
  )
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error('two-payment fixture inventory invalid')
  }
  snapshot.inventoryEvidenceId = inventory.inventoryEvidenceId
  const evidence = builtEvidence(evidenceInput)
  return {
    postCandidateInput: evidenceInput,
    postCandidateEvidence: evidence,
    annualFinalization: null,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: owner,
      birthDate,
      evidenceId: 'owner-birth',
    },
    simpleParticipationEvidence: [],
  }
}

function reverseKeys<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).reverse()) as T
}

function bindSeppRoute(
  input: ExecutePlanOwnedNonRothIraAnnualPostCandidateInput,
  sourceEvidenceId = 'sepp-source-evidence',
) {
  const candidate = input.postCandidateInput.movementCandidate
  const distributionDateEvidenceId =
    buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: candidate.movementCandidateId,
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: requestedIra,
      executionDate: '2030-06-15',
    })
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'sepp-election',
    scheduleId: 'sepp-schedule',
    participantPersonId: owner,
    sourceAccountId: requestedIra,
    taxYear: 2030,
    priorHistoryTerminalStateId: 'sepp-prior-terminal',
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
  input.iraSeppScheduleRoutes = [{
    sourceAccountId: requestedIra,
    electionId: 'sepp-election',
    scheduleId: 'sepp-schedule',
    annualReconciliationInput: {
      sourceEvidence: {
        predicate: 'ownedNonRothIraSeppSource',
        sourceAccountId: requestedIra,
        ownerPersonId: owner,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: 'traditional',
        accountOwnershipEvidenceId:
          input.postCandidateInput.movementInput.sourceEvidence[0]!
            .accountOwnershipEvidenceId,
        iraClassificationEvidenceId: 'classification-requested',
        sourceEvidenceId,
      },
      electionEvidence: {
        predicate: 'ownedNonRothIraSeppElection',
        electionId: 'sepp-election',
        scheduleId: 'sepp-schedule',
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        subtype: 'traditional',
        electionStartDate: '2030-01-01',
        method: 'fixedAmortization',
        electionEvidenceId: 'sepp-election-evidence',
      },
      annualScheduleEvidence: {
        predicate: 'ownedNonRothIraSeppAnnualSchedule',
        electionId: 'sepp-election',
        scheduleId: 'sepp-schedule',
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        taxYear: 2030,
        annualScheduledGrossAmount: asUsdCents(10_000),
        annualScheduleEvidenceId: 'sepp-annual-schedule-evidence',
      },
      noModificationEvidence: {
        predicate:
          'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
        electionId: 'sepp-election',
        scheduleId: 'sepp-schedule',
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        throughDate: '2030-12-31',
        disqualifyingModification: 'none',
        noModificationEvidenceId: 'sepp-no-modification-evidence',
      },
      openingStateEvidence,
      priorElectionHistoryEvidence:
        buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
          predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
          electionId: 'sepp-election',
          scheduleId: 'sepp-schedule',
          participantPersonId: owner,
          sourceAccountId: requestedIra,
          historyThroughDate: '2029-12-31',
          terminalStateEvidenceId: 'sepp-prior-terminal',
          usedDistributionEvidenceIds: [],
        }),
      payments: [{
        currentPaymentEvidence: {
          predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
          electionId: 'sepp-election',
          scheduleId: 'sepp-schedule',
          actionId: asActionId('withdrawal'),
          allocationId: asAllocationId('withdrawal-allocation'),
          sourceAccountId: requestedIra,
          distributionDate: '2030-06-15',
          currentDistributionEvidenceId: distributionDateEvidenceId,
          paymentSequence: 1,
          previousScheduleStateId:
            openingStateEvidence.openingStateEvidenceId,
          currentScheduledGrossAmount: asUsdCents(10_000),
          paymentScheduleEvidenceId: 'sepp-payment-schedule-evidence',
        },
      }],
    },
  }]
  const { line7Distributions, ...annualInput } =
    input.postCandidateEvidence.classificationInput
  void line7Distributions
  const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: input.postCandidateInput.movementInput,
    annualInput,
    ownerEvidence: input.ownerEvidence,
    iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    simpleParticipationEvidence: [],
  })
  if (coordinated.status !== 'annualEvidenceBound') {
    throw new Error(`SEPP fixture did not finalize: ${coordinated.status}`)
  }
  input.annualFinalization = coordinated.annualEvidence
  return coordinated
}

function bindTwoPaymentSeppRoute(
  input: ExecutePlanOwnedNonRothIraAnnualPostCandidateInput,
) {
  const electionId = 'sepp-election'
  const scheduleId = 'sepp-schedule'
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId,
    scheduleId,
    participantPersonId: owner,
    sourceAccountId: requestedIra,
    taxYear: 2030,
    priorHistoryTerminalStateId: 'sepp-prior-terminal',
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
  const candidate = input.postCandidateInput.movementCandidate
  const firstDistributionId =
    buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: candidate.movementCandidateId,
      actionId: asActionId('withdrawal-a'),
      allocationId: asAllocationId('withdrawal-allocation-a'),
      sourceAccountId: requestedIra,
      executionDate: '2030-06-15',
    })
  const secondDistributionId =
    buildOwnedNonRothIraStagedDistributionDateEvidenceId({
      movementCandidateId: candidate.movementCandidateId,
      actionId: asActionId('withdrawal-b'),
      allocationId: asAllocationId('withdrawal-allocation-b'),
      sourceAccountId: requestedIra,
      executionDate: '2030-09-15',
    })
  const firstPaymentWithoutPrevious = {
    predicate: 'ownedNonRothIraSeppCurrentScheduledPayment' as const,
    electionId,
    scheduleId,
    actionId: asActionId('withdrawal-a'),
    allocationId: asAllocationId('withdrawal-allocation-a'),
    sourceAccountId: requestedIra,
    distributionDate: '2030-06-15',
    currentDistributionEvidenceId: firstDistributionId,
    paymentSequence: 1,
    currentScheduledGrossAmount: asUsdCents(5_000),
    paymentScheduleEvidenceId: 'sepp-payment-schedule-evidence-a',
  }
  const firstAfterWithoutId = {
    predicate: 'ownedNonRothIraSeppCurrentPaymentState' as const,
    electionId,
    scheduleId,
    participantPersonId: owner,
    sourceAccountId: requestedIra,
    taxYear: 2030,
    completedPaymentCount: 1,
    lastCompletedSequence: 1,
    lastPaymentDate: '2030-06-15',
    nextScheduledSequence: 2,
    scheduledGrossAmount: asUsdCents(5_000),
    actualQualifyingGrossAmount: asUsdCents(5_000),
  }
  const firstAfterStateId = deriveActionStructuralId(
    'owned-ira-sepp-current-payment-after',
    [
      openingStateEvidence.openingStateEvidenceId,
      firstPaymentWithoutPrevious,
      firstAfterWithoutId,
    ],
  )
  input.iraSeppScheduleRoutes = [{
    sourceAccountId: requestedIra,
    electionId,
    scheduleId,
    annualReconciliationInput: {
      sourceEvidence: {
        predicate: 'ownedNonRothIraSeppSource',
        sourceAccountId: requestedIra,
        ownerPersonId: owner,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: 'traditional',
        accountOwnershipEvidenceId:
          input.postCandidateInput.movementInput.sourceEvidence[0]!
            .accountOwnershipEvidenceId,
        iraClassificationEvidenceId: 'classification-requested',
        sourceEvidenceId: 'sepp-source-evidence',
      },
      electionEvidence: {
        predicate: 'ownedNonRothIraSeppElection',
        electionId,
        scheduleId,
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        subtype: 'traditional',
        electionStartDate: '2030-01-01',
        method: 'fixedAmortization',
        electionEvidenceId: 'sepp-election-evidence',
      },
      annualScheduleEvidence: {
        predicate: 'ownedNonRothIraSeppAnnualSchedule',
        electionId,
        scheduleId,
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        taxYear: 2030,
        annualScheduledGrossAmount: asUsdCents(10_000),
        annualScheduleEvidenceId: 'sepp-annual-schedule-evidence',
      },
      noModificationEvidence: {
        predicate:
          'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
        electionId,
        scheduleId,
        participantPersonId: owner,
        sourceAccountId: requestedIra,
        throughDate: '2030-12-31',
        disqualifyingModification: 'none',
        noModificationEvidenceId: 'sepp-no-modification-evidence',
      },
      openingStateEvidence,
      priorElectionHistoryEvidence:
        buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
          predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
          electionId,
          scheduleId,
          participantPersonId: owner,
          sourceAccountId: requestedIra,
          historyThroughDate: '2029-12-31',
          terminalStateEvidenceId: 'sepp-prior-terminal',
          usedDistributionEvidenceIds: [],
        }),
      payments: [{
        currentPaymentEvidence: {
          ...firstPaymentWithoutPrevious,
          previousScheduleStateId:
            openingStateEvidence.openingStateEvidenceId,
        },
      }, {
        currentPaymentEvidence: {
          predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
          electionId,
          scheduleId,
          actionId: asActionId('withdrawal-b'),
          allocationId: asAllocationId('withdrawal-allocation-b'),
          sourceAccountId: requestedIra,
          distributionDate: '2030-09-15',
          currentDistributionEvidenceId: secondDistributionId,
          paymentSequence: 2,
          previousScheduleStateId: firstAfterStateId,
          currentScheduledGrossAmount: asUsdCents(5_000),
          paymentScheduleEvidenceId: 'sepp-payment-schedule-evidence-b',
        },
      }],
    },
  }]
  const { line7Distributions, ...annualInput } =
    input.postCandidateEvidence.classificationInput
  void line7Distributions
  const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    movementInput: input.postCandidateInput.movementInput,
    annualInput,
    ownerEvidence: input.ownerEvidence,
    iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    simpleParticipationEvidence: [],
  })
  if (coordinated.status !== 'annualEvidenceBound') {
    throw new Error(
      `two-payment SEPP fixture did not finalize: ${coordinated.status}`,
    )
  }
  input.annualFinalization = coordinated.annualEvidence
  return coordinated
}

describe('post-candidate owned non-Roth IRA annual execution', () => {
  it.each([
    ['full', 10_000, 'executed', 10_000, 0],
    ['partial', 5_000, 'partial', 5_000, 5_000],
    ['zero', 0, 'refused', 0, 10_000],
  ] as const)(
    'publishes the %s already-applied candidate exactly once',
    (_label, opening, outcome, executed, unexecuted) => {
      const result = executePlanOwnedNonRothIraAnnualPostCandidate(
        executionInput(opening),
      )
      expect(result.status).toBe(
        opening === 0
          ? 'postCandidateMovementRefused'
          : 'postCandidateAnnualWithdrawalCommitted',
      )
      if (
        result.status !== 'postCandidateMovementRefused' &&
        result.status !== 'postCandidateAnnualWithdrawalCommitted'
      ) return
      expect(result.actions[0]).toMatchObject({
        executedAmount: executed,
        unexecutedAmount: unexecuted,
        disposition: { outcome },
      })
      expect(result.balances[0]).toMatchObject({
        openingBalance: opening,
        executedAmount: executed,
        closingBalance: 0,
      })
      expect(result.actions[0]?.allocations[0]?.balanceAfter).toBe(0)
      expect(result.actions[0]?.allocations[0]?.executedAmount).toBe(executed)
    },
  )

  it('publishes tax character and penalties exactly from annual finalization', () => {
    const input = structuredClone(executionInput()) as unknown as
      ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    const result = executePlanOwnedNonRothIraAnnualPostCandidate(input)
    expect(result.status).toBe('postCandidateAnnualWithdrawalCommitted')
    if (result.status !== 'postCandidateAnnualWithdrawalCommitted') return
    const characterized =
      result.annualFinalization.characterization.withdrawals[0]!
    const coverage = result.annualFinalization.penaltyPrerequisites.coverage[0]!
    const evaluation =
      result.annualFinalization.penaltyPrerequisites.evaluations[0]!
    expect(result.actions[0]?.taxCharacter).toEqual(
      characterized.taxCharacter,
    )
    expect(result.actions[0]?.penaltyCoverage).toEqual([coverage])
    expect(result.actions[0]?.penaltyEvaluations).toEqual([evaluation])
    expect(result.executionEvidenceId).toMatch(
      /^owned-ira-plan-post-candidate-annual-execution:[0-9a-f]{64}$/,
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.actions[0])).toBe(true)
    ;(input.postCandidateInput.movementInput.openingBalances[0] as {
      openingBalance: number
    }).openingBalance = 1
    ;(input.annualFinalization as {
      finalizationEvidenceId: string
    }).finalizationEvidenceId = 'mutated-after-execution'
    expect(result.balances[0]?.openingBalance).toBe(10_000)
    expect(result.annualFinalization.finalizationEvidenceId)
      .not.toBe('mutated-after-execution')
  })

  it('keeps post-candidate blocking and incomplete penalty arms nonmoving', () => {
    const blockedInput = executionInput()
    const mutable = blockedInput.postCandidateInput as MutablePostCandidateInput
    mutable.postCandidateSnapshot.applicationStatus =
      'not-applied' as never
    const snapshotBlocked =
      executePlanOwnedNonRothIraAnnualPostCandidate(blockedInput)
    expect(snapshotBlocked).toMatchObject({
      status: 'snapshotMismatch',
      movement: 'notCommitted',
      actionability: 'notEstablished',
    })

    const penaltyBlocked = executePlanOwnedNonRothIraAnnualPostCandidate(
      executionInput(10_000, '1990-01-01'),
    )
    expect(penaltyBlocked).toMatchObject({
      status: 'annualEvidenceBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualEvidence: null,
    })
  })

  it('preserves distinct complete under-age penalty evidence', () => {
    const input = structuredClone(
      executionInput(10_000, '1990-01-01'),
    ) as unknown as ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    input.rejectedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: owner,
      disabilityQualificationDate: null,
      evaluationDate: '2030-06-15',
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId: 'rejected-disability',
    }]
    input.ownerAliveEvidence = [{
      predicate: 'ownerAliveOnOwnedIraDistributionDate',
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      evaluationDate: '2030-06-15',
      aliveOnEvaluationDate: true,
      ownerAliveEvidenceId: 'owner-alive',
    }]
    input.iraSeppStatusEvidence = [{
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal',
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      evaluationDate: '2030-06-15',
      status: 'none',
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: 'no-sepp',
    }]
    input.noOtherExceptionAttestations = [{
      predicate: 'noOtherStatutoryExceptionClaimed',
      actionId: asActionId('withdrawal'),
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      evaluationDate: '2030-06-15',
      attested: true,
      evidenceScope: 'planningEvidenceNotFilingGradeLegalAdjudication',
      attestationEvidenceId: 'no-other-exception',
    }]
    const { line7Distributions, ...annualInput } =
      input.postCandidateEvidence.classificationInput
    void line7Distributions
    const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
      movementInput: input.postCandidateInput.movementInput,
      annualInput,
      ownerEvidence: input.ownerEvidence,
      rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
      ownerAliveEvidence: input.ownerAliveEvidence,
      iraSeppStatusEvidence: input.iraSeppStatusEvidence,
      noOtherExceptionAttestations: input.noOtherExceptionAttestations,
      simpleParticipationEvidence: [],
    })
    expect(coordinated.status).toBe('annualEvidenceBound')
    if (coordinated.status !== 'annualEvidenceBound') {
      throw new Error('complete penalty fixture did not finalize')
    }
    input.annualFinalization = coordinated.annualEvidence
    const result = executePlanOwnedNonRothIraAnnualPostCandidate(input)
    expect(result.status).toBe('postCandidateAnnualWithdrawalCommitted')
    if (result.status !== 'postCandidateAnnualWithdrawalCommitted') return
    expect(result.actions[0]?.penaltyEvaluations[0]?.outcome)
      .toBe('penaltyApplies')
  }, COVERAGE_INSTRUMENTED_BINDER_TIMEOUT_MS)

  it('accepts shared same-rate evidence across two penalty evaluations', () => {
    const input = twoPaymentExecutionInput('1990-01-01', siblingIra)
    const slots = [{
      actionId: asActionId('withdrawal-a'),
      allocationId: asAllocationId('withdrawal-allocation-a'),
      evaluationDate: '2030-06-15',
      sourceAccountId: requestedIra,
      suffix: 'a',
    }, {
      actionId: asActionId('withdrawal-b'),
      allocationId: asAllocationId('withdrawal-allocation-b'),
      evaluationDate: '2030-09-15',
      sourceAccountId: siblingIra,
      suffix: 'b',
    }]
    input.rejectedDisabilityEvidence = slots.map((slot) => ({
      kind: 'disability' as const,
      disabledPersonId: owner,
      disabilityQualificationDate: null,
      evaluationDate: slot.evaluationDate,
      qualifiedOnEvaluationDate: false as const,
      disabilityEvidenceId: `rejected-disability-${slot.suffix}`,
    }))
    input.ownerAliveEvidence = slots.map((slot) => ({
      predicate: 'ownerAliveOnOwnedIraDistributionDate' as const,
      actionId: slot.actionId,
      allocationId: slot.allocationId,
      sourceAccountId: slot.sourceAccountId,
      ownerPersonId: owner,
      evaluationDate: slot.evaluationDate,
      aliveOnEvaluationDate: true as const,
      ownerAliveEvidenceId: `owner-alive-${slot.suffix}`,
    }))
    input.iraSeppStatusEvidence = slots.map((slot) => ({
      predicate: 'ownedNonRothIraSeppStatusForWithdrawal' as const,
      actionId: slot.actionId,
      allocationId: slot.allocationId,
      sourceAccountId: slot.sourceAccountId,
      ownerPersonId: owner,
      evaluationDate: slot.evaluationDate,
      status: 'none' as const,
      electionId: null,
      scheduleId: null,
      seppStatusEvidenceId: `no-sepp-${slot.suffix}`,
    }))
    input.noOtherExceptionAttestations = slots.map((slot) => ({
      predicate: 'noOtherStatutoryExceptionClaimed' as const,
      actionId: slot.actionId,
      allocationId: slot.allocationId,
      sourceAccountId: slot.sourceAccountId,
      ownerPersonId: owner,
      evaluationDate: slot.evaluationDate,
      attested: true as const,
      evidenceScope:
        'planningEvidenceNotFilingGradeLegalAdjudication' as const,
      attestationEvidenceId: `no-other-exception-${slot.suffix}`,
    }))
    const { line7Distributions, ...annualInput } =
      input.postCandidateEvidence.classificationInput
    void line7Distributions
    const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
      movementInput: input.postCandidateInput.movementInput,
      annualInput,
      ownerEvidence: input.ownerEvidence,
      rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
      ownerAliveEvidence: input.ownerAliveEvidence,
      iraSeppStatusEvidence: input.iraSeppStatusEvidence,
      noOtherExceptionAttestations: input.noOtherExceptionAttestations,
      simpleParticipationEvidence: [],
    })
    expect(coordinated.status).toBe('annualEvidenceBound')
    if (coordinated.status !== 'annualEvidenceBound') {
      throw new Error('multi-allocation penalty fixture did not finalize')
    }
    input.annualFinalization = coordinated.annualEvidence
    const evaluations = coordinated.annualEvidence.penaltyPrerequisites
      .evaluations.filter((item) => item.outcome === 'penaltyApplies')
    expect(evaluations).toHaveLength(2)
    expect(new Set(evaluations.map((item) => item.rateEvidence.evidenceId)))
      .toHaveLength(2)
    expect(new Set(evaluations.map(
      (item) => item.rateBucketEvidence.evidenceId,
    ))).toHaveLength(1)
    for (const evaluation of evaluations) {
      const member = evaluation.rateBucketEvidence.members.find((item) =>
        item.actionId === evaluation.actionId &&
        item.allocationId === evaluation.allocationId)
      expect(member?.rateEvidenceId).toBe(evaluation.rateEvidence.evidenceId)
    }
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input).status)
      .toBe('postCandidateAnnualWithdrawalCommitted')
  }, COVERAGE_INSTRUMENTED_BINDER_TIMEOUT_MS)

  it.each([
    'snapshot',
    'application',
    'candidateBalance',
    'reconciliation',
    'finalization',
  ] as const)('fails closed for tampered %s evidence', (target) => {
    const input = structuredClone(executionInput()) as unknown as
      ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    if (target === 'snapshot') {
      ;(input.postCandidateInput.postCandidateSnapshot as {
        evidenceId: string
      }).evidenceId = 'tampered-snapshot'
    } else if (target === 'application') {
      ;(input.postCandidateInput.postCandidateSnapshot
        .allocationApplications[0] as { executedAmount: number })
        .executedAmount = 1
    } else if (target === 'candidateBalance') {
      ;(input.postCandidateInput.postCandidateSnapshot
        .candidateBalances[0] as { candidateClosingBalance: number })
        .candidateClosingBalance = 1
    } else if (target === 'reconciliation') {
      ;(input.postCandidateEvidence.reconciliationEvidence as {
        evidenceId: string
      }).evidenceId = 'tampered-reconciliation'
    } else {
      ;(input.annualFinalization as { finalizationEvidenceId: string })
        .finalizationEvidenceId = 'tampered-finalization'
    }
    const result = executePlanOwnedNonRothIraAnnualPostCandidate(input)
    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
    expect(result.status).toMatch(
      /^(snapshotMismatch|postCandidateEvidenceMismatch|annualFinalizationMismatch)$/,
    )
  })

  it('is independent of account and object-property order', () => {
    const baseline = executionInput()
    const permuted = structuredClone(baseline) as unknown as
      ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    ;(permuted.postCandidateInput.inventoryInput.plan as Plan).accounts.reverse()
    ;(permuted.postCandidateInput.postCandidateSnapshot
      .yearEndApplicableBalances as unknown[]).reverse()
    ;(permuted.postCandidateInput.postCandidateSnapshot
      .allocationApplications as unknown[]).reverse()
    ;(permuted.postCandidateInput.postCandidateSnapshot
      .candidateBalances as unknown[]).reverse()
    permuted.postCandidateEvidence = reverseKeys(
      permuted.postCandidateEvidence,
    )
    if (permuted.annualFinalization !== null) {
      permuted.annualFinalization = reverseKeys(permuted.annualFinalization)
    }
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(permuted)).toEqual(
      executePlanOwnedNonRothIraAnnualPostCandidate(baseline),
    )
  })

  it('rejects a derived execution ID collision', () => {
    const initial = executionInput()
    const originalDerive = deriveActionStructuralId
    const deriveSpy = vi.spyOn(structuralId, 'deriveActionStructuralId')
      .mockImplementation((prefix, parts) =>
        prefix === 'owned-ira-plan-post-candidate-annual-execution'
          ? 'post-candidate-snapshot'
          : originalDerive(prefix, parts))
    try {
      expect(executePlanOwnedNonRothIraAnnualPostCandidate(initial))
        .toMatchObject({
          status: 'executionEvidenceIdCollision',
          movement: 'notCommitted',
          executionEvidenceId: null,
        })
    } finally {
      deriveSpy.mockRestore()
    }
  })

  it('rejects penalty evidence that reuses a post-candidate identifier', () => {
    const result = executePlanOwnedNonRothIraAnnualPostCandidate(
      executionInput(10_000, '1950-01-01', 'post-candidate-snapshot'),
    )
    expect(result).toMatchObject({
      status: 'identifierCollision',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      executionEvidenceId: null,
      issues: [{ kind: 'identifierCollision' }],
    })
  })

  it('rejects colliding disability evidence even when finalization resolves', () => {
    const input = structuredClone(
      executionInput(10_000, '1990-01-01'),
    ) as unknown as
      ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    input.qualifiedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: owner,
      disabilityQualificationDate: '2030-01-01',
      evaluationDate: '2030-06-15',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'post-candidate-snapshot',
    }]
    const { line7Distributions, ...annualInput } =
      input.postCandidateEvidence.classificationInput
    void line7Distributions
    const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
      movementInput: input.postCandidateInput.movementInput,
      annualInput,
      ownerEvidence: input.ownerEvidence,
      qualifiedDisabilityEvidence: input.qualifiedDisabilityEvidence,
      simpleParticipationEvidence: [],
    })
    expect(coordinated.status).toBe('annualEvidenceBound')
    if (coordinated.status !== 'annualEvidenceBound') {
      throw new Error('disability fixture did not finalize')
    }
    input.annualFinalization = coordinated.annualEvidence
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input))
      .toMatchObject({
        status: 'identifierCollision',
        movement: 'notCommitted',
        executionEvidenceId: null,
      })
  })

  it('rejects a valid SEPP route declaration that reuses snapshot evidence', () => {
    const input = structuredClone(
      executionInput(10_000, '1990-01-01'),
    ) as unknown as ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    bindSeppRoute(input, 'post-candidate-snapshot')
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input))
      .toMatchObject({
        status: 'identifierCollision',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        executionEvidenceId: null,
      })
  })

  it('accepts one shared reconciliation across two SEPP evaluations', () => {
    const input = twoPaymentExecutionInput()
    const coordinated = bindTwoPaymentSeppRoute(input)
    const evaluations = coordinated.annualEvidence.penaltyPrerequisites
      .evaluations.filter((item) => item.outcome === 'iraSeppQualified')
    expect(evaluations).toHaveLength(2)
    expect(new Set(evaluations.map(
      (item) => item.annualReconciliationEvidence.annualReconciliationId,
    ))).toHaveLength(1)
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input).status)
      .toBe('postCandidateAnnualWithdrawalCommitted')
  }, 15_000)

  it('preflights a cross-kind caller SEPP declaration collision', () => {
    const input = structuredClone(
      executionInput(10_000, '1990-01-01'),
    ) as unknown as ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    bindSeppRoute(input)
    const annual = input.iraSeppScheduleRoutes![0]!
      .annualReconciliationInput
    if (
      annual.sourceEvidence === undefined ||
      annual.electionEvidence === undefined
    ) throw new Error('SEPP fixture lost caller evidence')
    ;(annual.electionEvidence as { electionEvidenceId: string })
      .electionEvidenceId = annual.sourceEvidence.sourceEvidenceId
    expect(() => executePlanOwnedNonRothIraAnnualPostCandidate(input))
      .not.toThrow()
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input))
      .toMatchObject({
        status: 'identifierCollision',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        executionEvidenceId: null,
      })
  })

  it('registers a reconciled SEPP route when age takes precedence', () => {
    const input = structuredClone(
      executionInput(10_000, '1950-01-01'),
    ) as unknown as ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
    const first = bindSeppRoute(input)
    expect(first.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome)
      .toBe('age59HalfReached')
    const route = first.annualEvidence.penaltyPrerequisites
      .iraSeppScheduleReconciliations[0]
    expect(route?.reconciliation.status).toBe('reconciled')
    if (route?.reconciliation.status !== 'reconciled') {
      throw new Error('SEPP fixture lost its reconciliation')
    }
    const inventoryEvidenceId =
      route.reconciliation.evidence.distributionInventory
        .inventoryEvidenceId
    ;(input.postCandidateInput.postCandidateSnapshot as {
      evidenceId: string
    }).evidenceId = inventoryEvidenceId
    input.postCandidateEvidence = builtEvidence(input.postCandidateInput)
    bindSeppRoute(input)
    expect(executePlanOwnedNonRothIraAnnualPostCandidate(input))
      .toMatchObject({
        status: 'identifierCollision',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        executionEvidenceId: null,
      })
  })

  it.each([
    'currentDistributionEvidenceId',
    'previousScheduleStateId',
  ] as const)(
    'preflights an unreconciled SEPP %s collision despite age precedence',
    (field) => {
      const input = structuredClone(
        executionInput(10_000, '1950-01-01'),
      ) as unknown as ExecutePlanOwnedNonRothIraAnnualPostCandidateInput
      bindSeppRoute(input)
      const payment = input.iraSeppScheduleRoutes?.[0]
        ?.annualReconciliationInput.payments?.[0]?.currentPaymentEvidence
      if (payment === undefined) throw new Error('SEPP fixture lost its payment')
      ;(payment as unknown as Record<typeof field, string>)[field] =
        'post-candidate-snapshot'

      const { line7Distributions, ...annualInput } =
        input.postCandidateEvidence.classificationInput
      void line7Distributions
      const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
        movementInput: input.postCandidateInput.movementInput,
        annualInput,
        ownerEvidence: input.ownerEvidence,
        iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
        simpleParticipationEvidence: [],
      })
      expect(coordinated.status).toBe('annualEvidenceBound')
      if (coordinated.status !== 'annualEvidenceBound') {
        throw new Error('age-precedence fixture did not finalize')
      }
      expect(coordinated.annualEvidence.penaltyPrerequisites
        .evaluations[0]?.outcome).toBe('age59HalfReached')
      expect(coordinated.annualEvidence.penaltyPrerequisites
        .iraSeppScheduleReconciliations[0]?.reconciliation.status)
        .not.toBe('reconciled')
      input.annualFinalization = coordinated.annualEvidence

      expect(executePlanOwnedNonRothIraAnnualPostCandidate(input))
        .toMatchObject({
          status: 'identifierCollision',
          movement: 'notCommitted',
          actionability: 'notEstablished',
          executionEvidenceId: null,
        })
    },
    COVERAGE_INSTRUMENTED_BINDER_TIMEOUT_MS,
  )
})
