import {
  actionExecutionDispositionSchema,
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
  OwnedNonRothIraMovementCandidateBalance,
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

function allocationKey(
  actionId: ActionId,
  allocationId: AllocationId,
): string {
  return JSON.stringify([actionId, allocationId])
}

function executionDisposition(
  candidateStatus: 'fullyStaged' | 'partiallyStaged' | 'notStaged',
  requestedAmount: PositiveUsdCents,
  executedAmount: UsdCents,
  unexecutedAmount: UsdCents,
  reasons: readonly unknown[],
): ActionExecutionDisposition {
  return actionExecutionDispositionSchema.parse({
    outcome:
      candidateStatus === 'fullyStaged'
        ? 'executed'
        : candidateStatus === 'partiallyStaged'
          ? 'partial'
          : 'refused',
    readiness:
      candidateStatus === 'notStaged' ? 'nonActionable' : 'actionable',
    requestedAmount,
    executedAmount,
    unexecutedAmount,
    reasons,
  })
}

function balances(
  candidateBalances:
    readonly Readonly<OwnedNonRothIraMovementCandidateBalance>[],
): PlanOwnedNonRothIraAnnualExecutionBalance[] {
  return candidateBalances.map((balance) => ({
    sourceAccountId: balance.sourceAccountId,
    ownerPersonId: balance.ownerPersonId,
    openingBalance: balance.openingBalance,
    requestedAmount: balance.requestedAmount,
    executedAmount: balance.executedAmount,
    unexecutedAmount: balance.unexecutedAmount,
    closingBalance: balance.candidateClosingBalance,
  }))
}

function actions(
  result:
    | AnnualEvidenceBoundCoordinatorResult
    | NoPositiveMovementCoordinatorResult,
): PlanOwnedNonRothIraAnnualExecutionAction[] {
  const characterizationByAllocation = new Map<string, Readonly<
    AnnualEvidenceBoundCoordinatorResult['annualEvidence']['characterization']['withdrawals'][number]
  >>()
  const coverageByAllocation = new Map<string, Readonly<
    OwnedNonRothIraPenaltyCharacterCoverageEvidence
  >>()
  const evaluationByAllocation = new Map<string, Readonly<
    FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation
  >>()
  if (result.status === 'annualEvidenceBound') {
    for (const withdrawal of
      result.annualEvidence.characterization.withdrawals) {
      characterizationByAllocation.set(
        allocationKey(withdrawal.actionId, withdrawal.allocationId),
        withdrawal,
      )
    }
    for (const coverage of
      result.annualEvidence.penaltyPrerequisites.coverage) {
      coverageByAllocation.set(
        allocationKey(coverage.actionId, coverage.allocationId),
        coverage,
      )
    }
    for (const evaluation of
      result.annualEvidence.penaltyPrerequisites.evaluations) {
      evaluationByAllocation.set(
        allocationKey(evaluation.actionId, evaluation.allocationId),
        evaluation,
      )
    }
  }

  return result.movementCandidate.actions.map((action) => {
    const actionTaxCharacter: OwnedNonRothIraWithdrawalTaxCharacter[] = []
    const actionPenaltyCoverage:
      OwnedNonRothIraPenaltyCharacterCoverageEvidence[] = []
    const actionPenaltyEvaluations:
      FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation[] = []
    const executionAllocations = action.allocations.map((allocation) => {
      const key = allocationKey(action.actionId, allocation.allocationId)
      const characterization = characterizationByAllocation.get(key)
      const coverage = coverageByAllocation.get(key)
      const evaluation = evaluationByAllocation.get(key)
      if (allocation.executedAmount > 0) {
        if (
          characterization === undefined ||
          coverage === undefined
        ) {
          throw new Error(
            'Bound annual IRA evidence lost a positive execution allocation',
          )
        }
        if (
          coverage.ordinaryIncomeExposureAmount > 0 &&
          evaluation === undefined
        ) {
          throw new Error(
            'Bound annual IRA evidence lost a taxable penalty evaluation',
          )
        }
        if (
          coverage.ordinaryIncomeExposureAmount === 0 &&
          evaluation !== undefined
        ) {
          throw new Error(
            'Basis-only IRA execution unexpectedly acquired a penalty evaluation',
          )
        }
      } else if (
        characterization !== undefined ||
        coverage !== undefined ||
        evaluation !== undefined
      ) {
        throw new Error(
          'Zero IRA execution allocation unexpectedly acquired annual evidence',
        )
      }
      const taxCharacter = characterization?.taxCharacter ?? []
      const penaltyCoverage = coverage === undefined ? [] : [coverage]
      const penaltyEvaluations = evaluation === undefined ? [] : [evaluation]
      actionTaxCharacter.push(...taxCharacter)
      actionPenaltyCoverage.push(...penaltyCoverage)
      actionPenaltyEvaluations.push(...penaltyEvaluations)
      return {
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        requestedAmount: allocation.requestedAmount,
        balanceBefore: allocation.balanceBefore,
        executedAmount: allocation.executedAmount,
        unexecutedAmount: allocation.unexecutedAmount,
        balanceAfter: allocation.candidateBalanceAfter,
        sourceEvidence: allocation.sourceEvidence,
        taxCharacter,
        penaltyCoverage,
        penaltyEvaluations,
      }
    })
    const [firstExecutionAllocation, ...remainingExecutionAllocations] =
      executionAllocations
    if (firstExecutionAllocation === undefined) {
      throw new Error('Owned IRA action execution requires an allocation')
    }
    const positiveMovement = action.executedAmount > 0
    return {
      request: action.request,
      actionId: action.actionId,
      ownerPersonId: action.ownerPersonId,
      taxYear: action.taxYear,
      scheduledDate: action.executionDate,
      scheduledSequence: action.executionSequence,
      executedDate: positiveMovement ? action.executionDate : null,
      executedSequence: positiveMovement ? action.executionSequence : null,
      requestedAmount: action.requestedAmount,
      executedAmount: action.executedAmount,
      unexecutedAmount: action.unexecutedAmount,
      disposition: executionDisposition(
        action.candidateDisposition.candidateStatus,
        action.requestedAmount,
        action.executedAmount,
        action.unexecutedAmount,
        action.candidateDisposition.reasons,
      ),
      allocations: [
        firstExecutionAllocation,
        ...remainingExecutionAllocations,
      ],
      taxCharacter: actionTaxCharacter,
      penaltyCoverage: actionPenaltyCoverage,
      penaltyEvaluations: actionPenaltyEvaluations,
    }
  })
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

  const executionBalances = balances(
    coordinated.movementCandidate.candidateBalances,
  )
  const executionActions = actions(coordinated)
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
