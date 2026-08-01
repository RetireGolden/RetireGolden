import {
  type ActionExecutionDisposition,
  type OrdinaryWithdrawalRequest,
} from './contract.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import type {
  PositiveUsdCents,
  UsdCents,
} from './money.js'
import {
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput,
  type CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateResult,
} from './ownedNonRothIraAnnualPlanCoordinator.js'
import type {
  FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation,
} from './ownedNonRothIraAnnualFinalization.js'
import type {
  OwnedNonRothIraMovementAllocationEvidence,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import type {
  OwnedNonRothIraWithdrawalTaxCharacter,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import {
  publishPlanOwnedNonRothIraAnnualExecutionEvidence,
} from './ownedNonRothIraAnnualExecutionEvidence.js'

export type ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput =
  CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput

export interface PlanOwnedNonRothIraAnnualExecutionBalance {
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  openingBalance: UsdCents
  requestedAmount: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  closingBalance: UsdCents
}

export interface PlanOwnedNonRothIraAnnualExecutionAllocation {
  allocationId: AllocationId
  sourceAccountId: AccountId
  requestedAmount: PositiveUsdCents
  balanceBefore: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  balanceAfter: UsdCents
  sourceEvidence:
    Readonly<OwnedNonRothIraMovementAllocationEvidence>['sourceEvidence']
  taxCharacter:
    readonly Readonly<OwnedNonRothIraWithdrawalTaxCharacter>[]
  penaltyCoverage:
    readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[]
  penaltyEvaluations:
    readonly Readonly<FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation>[]
}

export interface PlanOwnedNonRothIraAnnualExecutionAction {
  request: Readonly<OrdinaryWithdrawalRequest>
  actionId: ActionId
  ownerPersonId: PersonId
  taxYear: number
  scheduledDate: string
  scheduledSequence: number
  executedDate: string | null
  executedSequence: number | null
  requestedAmount: PositiveUsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  disposition: Readonly<ActionExecutionDisposition>
  allocations: readonly [
    Readonly<PlanOwnedNonRothIraAnnualExecutionAllocation>,
    ...Readonly<PlanOwnedNonRothIraAnnualExecutionAllocation>[],
  ]
  taxCharacter:
    readonly Readonly<OwnedNonRothIraWithdrawalTaxCharacter>[]
  penaltyCoverage:
    readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[]
  penaltyEvaluations:
    readonly Readonly<FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation>[]
}

type CoordinatorResultWithoutStatus<
  Status extends string,
> = CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateResult extends infer Result
  ? Result extends { status: Status }
    ? Result
    : never
  : never

type PlanOwnedNonRothIraAnnualExecutionPassThroughResult =
  CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateResult extends infer Result
    ? Result extends {
        status: 'annualEvidenceBound' | 'noPositiveMovementStaged'
      }
      ? never
      : Result
    : never

type AnnualEvidenceBoundCoordinatorResult = CoordinatorResultWithoutStatus<
  'annualEvidenceBound'
>

type NoPositiveMovementCoordinatorResult = CoordinatorResultWithoutStatus<
  'noPositiveMovementStaged'
>

export interface PlanOwnedNonRothIraAnnualExecutionIdCollisionIssue {
  kind: 'executionEvidenceIdCollision'
  detail: string
}

export type PlanOwnedNonRothIraAnnualExecutionIdCollisionResult = Readonly<
  Omit<AnnualEvidenceBoundCoordinatorResult, 'status' | 'issues'> & {
    status: 'executionEvidenceIdCollision'
    movement: 'notCommitted'
    actionability: 'notEstablished'
    executionEvidenceId: null
    issues: readonly [
      Readonly<PlanOwnedNonRothIraAnnualExecutionIdCollisionIssue>,
    ]
  }
>

export type PlanOwnedNonRothIraAnnualExecutionNoPositiveMovementResult =
  Readonly<
    Omit<
      NoPositiveMovementCoordinatorResult,
      'status' | 'movement' | 'actionability'
    > & {
      status: 'noPositiveMovementRefused'
      movement: 'noMovement'
      actionability: 'established'
      executionEvidenceId: null
      balances:
        readonly Readonly<PlanOwnedNonRothIraAnnualExecutionBalance>[]
      actions:
        readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[]
    }
  >

export type PlanOwnedNonRothIraAnnualExecutionCommittedResult = Readonly<
  Omit<
    AnnualEvidenceBoundCoordinatorResult,
    'status' | 'movement' | 'actionability'
  > & {
    status: 'annualWithdrawalCommitted'
    movement: 'committed'
    actionability: 'established'
    executionEvidenceId: string
    balances:
      readonly Readonly<PlanOwnedNonRothIraAnnualExecutionBalance>[]
    actions:
      readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[]
  }
>

export type ExecutePlanOwnedNonRothIraAnnualWithdrawalsResult =
  | PlanOwnedNonRothIraAnnualExecutionPassThroughResult
  | PlanOwnedNonRothIraAnnualExecutionIdCollisionResult
  | PlanOwnedNonRothIraAnnualExecutionNoPositiveMovementResult
  | PlanOwnedNonRothIraAnnualExecutionCommittedResult

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function containsExactString(
  value: unknown,
  expected: string,
  seen: WeakSet<object>,
): boolean {
  if (typeof value === 'string') return value === expected
  if (value === null || typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (containsExactString(child, expected, seen)) return true
  }
  return false
}

function hasExecutionIdCollision(
  executionEvidenceId: string,
  values: readonly unknown[],
): boolean {
  return values.some((value) =>
    containsExactString(value, executionEvidenceId, new WeakSet()),
  )
}

/**
 * Commits a complete Plan-authoritative owner/year owned-IRA withdrawal batch.
 *
 * The existing Plan coordinator is rerun internally so callers cannot forge a
 * previously coordinated result. Every coordinator blocking arm is returned
 * unchanged. A zero-movement batch establishes explicit refusals but commits
 * no balances. Only complete annual character and final penalty evidence can
 * produce a committed exact-cent result.
 */
export function executePlanOwnedNonRothIraAnnualWithdrawals(
  input: Readonly<ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput>,
): Readonly<ExecutePlanOwnedNonRothIraAnnualWithdrawalsResult> {
  const coordinated =
    coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(input)
  if (
    coordinated.status !== 'annualEvidenceBound' &&
    coordinated.status !== 'noPositiveMovementStaged'
  ) {
    return coordinated
  }

  const published = publishPlanOwnedNonRothIraAnnualExecutionEvidence(
    coordinated,
  )
  const executionBalances = [...published.balances]
  const executionActions = published.actions
  if (coordinated.status === 'noPositiveMovementStaged') {
    return deepFreeze({
      ...coordinated,
      status: 'noPositiveMovementRefused',
      movement: 'noMovement',
      actionability: 'established',
      executionEvidenceId: null,
      balances: executionBalances,
      actions: executionActions,
    })
  }

  executionBalances.sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )
  const executionEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-execution',
    [
      coordinated.sourceInventoryEvidenceId,
      coordinated.physicalEligibilityEvidenceId,
      coordinated.planOwnedIraCandidateEvidenceId,
      coordinated.movementCandidate.movementCandidateId,
      coordinated.annualEvidence.finalizationEvidenceId,
      coordinated.bindingEvidence.bindingEvidenceId,
      executionBalances,
      executionActions,
    ],
  )
  if (hasExecutionIdCollision(executionEvidenceId, [
    input,
    coordinated,
    executionBalances,
    executionActions,
  ])) {
    return deepFreeze({
      ...coordinated,
      status: 'executionEvidenceIdCollision',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      executionEvidenceId: null,
      issues: [{
        kind: 'executionEvidenceIdCollision',
        detail:
          'Derived annual IRA execution evidence ID collides with input or prerequisite evidence',
      }],
    })
  }
  return deepFreeze({
    ...coordinated,
    status: 'annualWithdrawalCommitted',
    movement: 'committed',
    actionability: 'established',
    executionEvidenceId,
    balances: executionBalances,
    actions: executionActions,
  })
}
