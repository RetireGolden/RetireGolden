import { actionExecutionDispositionSchema } from './contract.js'
import type { ActionId, AllocationId } from './identity.js'
import type { PositiveUsdCents, UsdCents } from './money.js'
import type {
  OwnedNonRothIraAnnualCandidateEvidenceBoundResult,
  OwnedNonRothIraAnnualCandidateNoPositiveMovementResult,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import type {
  PlanOwnedNonRothIraAnnualExecutionAction,
  PlanOwnedNonRothIraAnnualExecutionBalance,
} from './ownedNonRothIraAnnualExecution.js'
import type {
  FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation,
} from './ownedNonRothIraAnnualFinalization.js'
import type {
  OwnedNonRothIraMovementCandidateBalance,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  OwnedNonRothIraPenaltyCharacterCoverageEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import type {
  OwnedNonRothIraWithdrawalTaxCharacter,
} from './ownedNonRothIraWithdrawalCharacter.js'

type PublishableCandidate =
  | Readonly<OwnedNonRothIraAnnualCandidateEvidenceBoundResult>
  | Readonly<OwnedNonRothIraAnnualCandidateNoPositiveMovementResult>

export interface PublishedPlanOwnedNonRothIraAnnualExecutionEvidence {
  balances:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionBalance>[]
  actions:
    readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[]
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function allocationKey(actionId: ActionId, allocationId: AllocationId): string {
  return JSON.stringify([actionId, allocationId])
}

function executionDisposition(
  candidateStatus: 'fullyStaged' | 'partiallyStaged' | 'notStaged',
  requestedAmount: PositiveUsdCents,
  executedAmount: UsdCents,
  unexecutedAmount: UsdCents,
  reasons: readonly unknown[],
) {
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
  result: PublishableCandidate,
): PlanOwnedNonRothIraAnnualExecutionAction[] {
  const characterizationByAllocation = new Map<string, Readonly<
    OwnedNonRothIraAnnualCandidateEvidenceBoundResult['annualEvidence']['characterization']['withdrawals'][number]
  >>()
  const coverageByAllocation = new Map<string, Readonly<
    OwnedNonRothIraPenaltyCharacterCoverageEvidence
  >>()
  const evaluationByAllocation = new Map<string, Readonly<
    FinalOwnedNonRothIraPenaltyPrerequisiteEvaluation
  >>()
  if (result.status === 'annualEvidenceBound') {
    for (const withdrawal of result.annualEvidence.characterization.withdrawals) {
      characterizationByAllocation.set(
        allocationKey(withdrawal.actionId, withdrawal.allocationId),
        withdrawal,
      )
    }
    for (const coverage of result.annualEvidence.penaltyPrerequisites.coverage) {
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
    const publishedAllocations = action.allocations.map((allocation) => {
      const key = allocationKey(action.actionId, allocation.allocationId)
      const characterization = characterizationByAllocation.get(key)
      const coverage = coverageByAllocation.get(key)
      const evaluation = evaluationByAllocation.get(key)
      if (allocation.executedAmount > 0) {
        if (characterization === undefined || coverage === undefined) {
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
    const [firstAllocation, ...remainingAllocations] = publishedAllocations
    if (firstAllocation === undefined) {
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
      allocations: [firstAllocation, ...remainingAllocations],
      taxCharacter: actionTaxCharacter,
      penaltyCoverage: actionPenaltyCoverage,
      penaltyEvaluations: actionPenaltyEvaluations,
    }
  })
}

/** Publishes evidence from an already staged candidate without moving it. */
export function publishPlanOwnedNonRothIraAnnualExecutionEvidence(
  result: PublishableCandidate,
): Readonly<PublishedPlanOwnedNonRothIraAnnualExecutionEvidence> {
  return deepFreeze({
    balances: balances(result.movementCandidate.candidateBalances),
    actions: actions(result),
  })
}
