/**
 * Canonical owned-IRA post-candidate classification input for unit tests.
 *
 * Shared by `ownedNonRothIraAnnualPostCandidateEvidence.test.ts` and the
 * `irc-219-f-3-prior-year-contribution-window` describeRule block in
 * `ownedNonRothIraAnnualFilingEvidence.test.ts`. Test-only support; not
 * published for external consumers.
 */

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from './planFixtures.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import { buildAnnualRetirementPhysicalEventInventory } from '../actions/annualRetirementPhysicalEventInventory.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from '../actions/ownedNonRothIraMovementCandidate.js'
import { deriveActionStructuralId } from '../actions/structuralId.js'
import type { BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput } from '../actions/ownedNonRothIraAnnualPostCandidateEvidence.js'

export const owner = asPersonId('p1')
export const siblingOwner = asPersonId('p2')
export const planId = asPlanId('post-candidate-plan')
export const requestedIra = asAccountId('ira-requested')
export const siblingIra = asAccountId('ira-unrequested')
export const employer = asAccountId('employer-plan')
export const inherited = asAccountId('inherited-ira')

type MutableObject<T> = { -readonly [Key in keyof T]: T[Key] }

type ImmutableInput =
  BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput

export type MutableInput = MutableObject<
  Omit<
    ImmutableInput,
    | 'inventoryInput'
    | 'movementInput'
    | 'postCandidateSnapshot'
    | 'annualBasisRecord'
    | 'postYearContributionWindow'
  >
> & {
  inventoryInput: MutableObject<ImmutableInput['inventoryInput']>
  movementInput: MutableObject<ImmutableInput['movementInput']>
  postCandidateSnapshot: MutableObject<ImmutableInput['postCandidateSnapshot']>
  annualBasisRecord: MutableObject<ImmutableInput['annualBasisRecord']>
  postYearContributionWindow: MutableObject<
    ImmutableInput['postYearContributionWindow']
  >
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.accounts = [
    traditionalAccount(requestedIra, 100, owner),
    traditionalAccount(siblingIra, 200, owner),
    traditionalAccount(employer, 300, owner, 'employer'),
    {
      type: 'traditional',
      id: inherited,
      name: 'Inherited IRA',
      ownerPersonId: owner,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 400,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2028, decedentHadStartedRmds: true },
    },
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

export function yearEnd(
  sourceAccountId: typeof requestedIra,
  amount: number,
  suffix: string,
) {
  return {
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId,
    ownerPersonId: owner,
    sourceAccountId,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    ledgerPhase: 'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
    asOfDate: '2030-12-31',
    yearEndApplicableBalanceAmount: asUsdCents(amount),
    evidenceId: `year-end-${suffix}`,
    upstreamEvidenceId: `year-end-${suffix}-upstream`,
  }
}

export function base(opening = 10_000): MutableInput {
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
  const ownership = deriveActionStructuralId('owned-ira-plan-account-ownership', [
    planId, owner, requestedIra, 'traditional', 'ira', 'owned',
  ])
  const request = valuePlan.strategies.retirementActions[0]!
  if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture action drift')
  const movementInput: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
    ownerPersonId: owner,
    taxYear: 2030,
    requests: [request],
    openingBalances: [{ accountId: requestedIra, openingBalance: asUsdCents(opening) }],
    sourceEvidence: [{
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource' as const,
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      accountType: 'traditional' as const,
      accountKind: 'ira' as const,
      inheritanceStatus: 'owned' as const,
      subtype: 'traditional' as const,
      accountOwnershipEvidenceId: ownership,
      iraClassificationEvidenceId: 'classification-requested',
    }],
  }
  const candidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  if (candidate.status !== 'movementCandidateStaged') throw new Error('fixture schedule invalid')
  // Inventory ID is deterministic, but obtain it from the dedicated builder's
  // dependency to keep this fixture independent of hash details.
  const builtInventory = buildAnnualRetirementPhysicalEventInventory(inventoryInput)
  if (builtInventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error('fixture inventory invalid')
  }
  const result: BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput = {
    inventoryInput,
    movementInput,
    movementCandidate: candidate,
    postCandidateSnapshot: {
      predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryEvidenceId: builtInventory.inventoryEvidenceId,
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
          applicationEvidenceId: `application-${action.actionId}-${allocation.allocationId}`,
          upstreamEvidenceId: `application-${action.actionId}-${allocation.allocationId}-upstream`,
        }))),
      candidateBalances: candidate.candidateBalances.map((balance) => ({
        ...balance,
        evidenceId: `candidate-balance-${balance.sourceAccountId}`,
        upstreamEvidenceId: `candidate-balance-${balance.sourceAccountId}-upstream`,
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
      predicate: 'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      deadlineEvidence: {
        predicate: 'federalIraContributionDeadlineForTaxYear',
        designatedTaxYear: 2030,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished',
        deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
        calendarAdjustmentStatus: 'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
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
  }
  return structuredClone(result) as unknown as MutableInput
}

export function clone(): MutableInput {
  return structuredClone(base())
}

export function refreshInventoryAndCandidate(value: MutableInput): void {
  const inventory = buildAnnualRetirementPhysicalEventInventory(value.inventoryInput)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error('refreshed fixture inventory invalid')
  }
  const candidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
    value.movementInput,
  )
  if (candidate.status !== 'movementCandidateStaged') {
    throw new Error('refreshed fixture candidate invalid')
  }
  value.movementCandidate = candidate
  value.postCandidateSnapshot.inventoryEvidenceId = inventory.inventoryEvidenceId
  value.postCandidateSnapshot.movementCandidateId = candidate.movementCandidateId
  value.postCandidateSnapshot.allocationApplications = candidate.actions.flatMap(
    (action) => action.allocations.map((allocation) => ({
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
      applicationEvidenceId: `application-${action.actionId}-${allocation.allocationId}`,
      upstreamEvidenceId: `application-${action.actionId}-${allocation.allocationId}-upstream`,
    })),
  )
  value.postCandidateSnapshot.candidateBalances = candidate.candidateBalances.map(
    (balance) => ({
      ...balance,
      evidenceId: `candidate-balance-${balance.sourceAccountId}`,
      upstreamEvidenceId: `candidate-balance-${balance.sourceAccountId}-upstream`,
    }),
  )
}
