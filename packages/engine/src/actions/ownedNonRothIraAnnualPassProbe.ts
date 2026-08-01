import type {
  AccountId,
  ActionId,
  AllocationId,
  PlanId,
} from './identity.js'
import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'
import {
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  type PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput,
} from './ownedNonRothIraAnnualCandidateTransaction.js'
import {
  coordinateOwnedNonRothIraAnnualWithdrawalCandidate,
} from './ownedNonRothIraAnnualCandidateCoordinator.js'
import type { PlanOwnedNonRothIraAnnualExecutionAction } from './ownedNonRothIraAnnualExecution.js'
import {
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type CompletePlanOwnedNonRothIraAnnualBasisRecord,
  type CompletePlanOwnedNonRothIraPostCandidateSnapshot,
  type CompletePlanOwnedNonRothIraPostYearContributionWindow,
  type PlanOwnedNonRothIraApplicableYearEndBalance,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import {
  executePlanOwnedNonRothIraAnnualPostCandidate,
  type ExecutePlanOwnedNonRothIraAnnualPostCandidateInput,
  type PlanOwnedNonRothIraAnnualPostCandidateCommittedResult,
  type PlanOwnedNonRothIraAnnualPostCandidateRefusedResult,
} from './ownedNonRothIraAnnualPostCandidateExecution.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementCandidateStagedResult,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

type AnnualPassPenaltyFacts = Omit<
  ExecutePlanOwnedNonRothIraAnnualPostCandidateInput,
  'postCandidateInput' | 'postCandidateEvidence' | 'annualFinalization'
>

export interface PlanOwnedNonRothIraAnnualPassAssumedEffect {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executedAmount: UsdCents
  basisReturnAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  allocatedPenaltyAmount: UsdCents
}

export type PlanOwnedNonRothIraAnnualPassObservedEffect =
  PlanOwnedNonRothIraAnnualPassAssumedEffect

export interface CompletePlanOwnedNonRothIraAnnualPassEvidence {
  predicate: 'completePlanOwnedNonRothIraAnnualPassEvidence'
  planId: PlanId
  ownerPersonId: ExecutePlanOwnedNonRothIraAnnualPostCandidateInput['ownerEvidence']['ownerPersonId']
  taxYear: number
  ledgerRunId: string
  movementCandidateId: string
  inventoryEvidenceId: string
  transactionEvidenceId: string
  assumedEffects:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[]
  yearEndApplicableBalances:
    readonly Readonly<PlanOwnedNonRothIraApplicableYearEndBalance>[]
  passStatus: 'completeAfterAllAnnualTransactionsAndGrowth'
  evidenceId: string
  upstreamEvidenceId: string
}

export interface ProbePlanOwnedNonRothIraAnnualPassInput {
  provisionalMovementInput:
    Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>
  provisionalMovementCandidate:
    Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  /**
   * Truthful inventory assembled after the pass, with the exact original
   * action-boundary pre-candidate opening balances.
   */
  completedCandidateInput:
    Readonly<PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput>
  annualPassEvidence:
    Readonly<CompletePlanOwnedNonRothIraAnnualPassEvidence>
  annualBasisRecord: Readonly<CompletePlanOwnedNonRothIraAnnualBasisRecord>
  postYearContributionWindow:
    Readonly<CompletePlanOwnedNonRothIraPostYearContributionWindow>
  penaltyFacts: Readonly<AnnualPassPenaltyFacts>
}

export interface PlanOwnedNonRothIraAnnualPassSnapshotEvidenceIds {
  upstreamEvidenceId: string
  evidenceId: string
}

export interface PlanOwnedNonRothIraAnnualPassControlBinding {
  transactionEvidenceId: string
  inventoryEvidenceId: string
  annualPassEvidenceId: string
  probeEvidenceId: string
}

export type PlanOwnedNonRothIraAnnualPassRollbackIssueKind =
  | 'annualPassEvidenceInvalid'
  | 'annualPassIdentifierCollision'
  | 'provisionalCandidateBlocked'
  | 'provisionalCandidateMismatch'
  | 'completedCandidateBlocked'
  | 'completedCandidateMismatch'
  | 'snapshotConstructionInvalid'
  | 'postCandidateEvidenceBlocked'
  | 'annualFinalizationBlocked'
  | 'postCandidateExecutionBlocked'
  | 'effectAssumptionInvalid'
  | 'effectProjectionInvalid'
  | 'probeEvidenceIdCollision'
  | 'orchestrationException'

export interface PlanOwnedNonRothIraAnnualPassRollbackIssue {
  kind: PlanOwnedNonRothIraAnnualPassRollbackIssueKind
  detail: string
  upstreamStatus?: string
}

export interface PlanOwnedNonRothIraAnnualPassRollbackResult {
  status: 'rollback'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  probeEvidenceId: null
  observedEffects: readonly []
  execution: null
  controlBinding: null
  issues: readonly [Readonly<PlanOwnedNonRothIraAnnualPassRollbackIssue>]
}

export interface PlanOwnedNonRothIraAnnualPassReprobeResult {
  status: 'reprobe'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  probeEvidenceId: string
  observedEffects:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassObservedEffect>[]
  execution: null
  controlBinding: Readonly<PlanOwnedNonRothIraAnnualPassControlBinding>
  issues: readonly []
}

interface PlanOwnedNonRothIraAnnualPassCommitBase {
  status: 'commit'
  actionability: 'established'
  probeEvidenceId: string
  observedEffects:
    readonly Readonly<PlanOwnedNonRothIraAnnualPassObservedEffect>[]
  controlBinding: Readonly<PlanOwnedNonRothIraAnnualPassControlBinding>
  issues: readonly []
}

export interface PlanOwnedNonRothIraAnnualPassPositiveCommitResult
  extends PlanOwnedNonRothIraAnnualPassCommitBase {
  decision: 'commitReady'
  /** A later atomic consumer must commit this stable binding. */
  movement: 'notCommitted'
  execution: Readonly<PlanOwnedNonRothIraAnnualPostCandidateCommittedResult>
}

export interface PlanOwnedNonRothIraAnnualPassSettledNoMovementResult
  extends PlanOwnedNonRothIraAnnualPassCommitBase {
  decision: 'settledNoMovement'
  movement: 'noMovement'
  execution: Readonly<PlanOwnedNonRothIraAnnualPostCandidateRefusedResult>
}

export type PlanOwnedNonRothIraAnnualPassCommitResult =
  | PlanOwnedNonRothIraAnnualPassPositiveCommitResult
  | PlanOwnedNonRothIraAnnualPassSettledNoMovementResult

export type ProbePlanOwnedNonRothIraAnnualPassResult =
  | PlanOwnedNonRothIraAnnualPassRollbackResult
  | PlanOwnedNonRothIraAnnualPassReprobeResult
  | PlanOwnedNonRothIraAnnualPassCommitResult

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null ||
      typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => same(value, right[index]))
  }
  const leftPrototype = Object.getPrototypeOf(left)
  const rightPrototype = Object.getPrototypeOf(right)
  if ((leftPrototype !== Object.prototype && leftPrototype !== null) ||
      (rightPrototype !== Object.prototype && rightPrototype !== null)) {
    return false
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort(compareUtf16CodeUnits)
  const rightKeys = Object.keys(rightRecord).sort(compareUtf16CodeUnits)
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && same(leftRecord[key], rightRecord[key]))
}

function rollback(
  kind: PlanOwnedNonRothIraAnnualPassRollbackIssueKind,
  detail: string,
  upstreamStatus?: string,
): Readonly<PlanOwnedNonRothIraAnnualPassRollbackResult> {
  return deepFreeze({
    status: 'rollback',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    probeEvidenceId: null,
    observedEffects: [],
    execution: null,
    controlBinding: null,
    issues: [{ kind, detail, ...(upstreamStatus === undefined
      ? {}
      : { upstreamStatus }) }],
  })
}

function identifierValues(
  value: unknown,
  key = '',
  result: string[] = [],
  seen = new WeakSet<object>(),
): string[] {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.push(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return result
  }
  seen.add(value)
  if (Array.isArray(value)) {
    for (const child of value) identifierValues(child, key, result, seen)
    return result
  }
  for (const [childKey, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const item of child) if (typeof item === 'string') result.push(item)
    }
    identifierValues(child, childKey, result, seen)
  }
  return result
}

function containsIdentifier(value: unknown, expected: string): boolean {
  return identifierValues(value).some((identifier) => identifier === expected)
}

type SnapshotWithoutEvidenceIds = Omit<
  CompletePlanOwnedNonRothIraPostCandidateSnapshot,
  'evidenceId' | 'upstreamEvidenceId'
>

export function derivePlanOwnedNonRothIraAnnualPassSnapshotEvidenceIds(
  transactionEvidenceId: string,
  annualPassEvidence:
    Readonly<CompletePlanOwnedNonRothIraAnnualPassEvidence>,
  snapshot: Readonly<SnapshotWithoutEvidenceIds>,
): Readonly<PlanOwnedNonRothIraAnnualPassSnapshotEvidenceIds> {
  if (!nonblank(transactionEvidenceId) ||
      !nonblank(annualPassEvidence.evidenceId)) {
    throw new TypeError('Transaction and annual-pass evidence IDs must be nonblank')
  }
  const upstreamEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-pass-snapshot-upstream',
    [
      transactionEvidenceId,
      annualPassEvidence,
      snapshot.planId,
      snapshot.ownerPersonId,
      snapshot.taxYear,
      snapshot.ledgerRunId,
      snapshot.inventoryEvidenceId,
      snapshot.movementCandidateId,
    ],
  )
  const evidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-pass-snapshot',
    [transactionEvidenceId, annualPassEvidence, snapshot, upstreamEvidenceId],
  )
  return deepFreeze({ upstreamEvidenceId, evidenceId })
}

function buildSnapshot(
  completed: Extract<
    ReturnType<typeof preparePlanOwnedNonRothIraAnnualCandidateTransaction>,
    { status: 'candidateTransactionPrepared' }
  >,
  annualPassEvidence:
    Readonly<CompletePlanOwnedNonRothIraAnnualPassEvidence>,
  yearEndApplicableBalances:
    readonly Readonly<PlanOwnedNonRothIraApplicableYearEndBalance>[],
): Readonly<CompletePlanOwnedNonRothIraPostCandidateSnapshot> | null {
  const transitions = new Map(completed.sourceBalanceTransitions.map(
    (transition) => [transition.sourceAccountId, transition],
  ))
  const candidateBalances = completed.movementCandidate.candidateBalances.map(
    (balance) => {
      const transition = transitions.get(balance.sourceAccountId)
      return transition === undefined ? null : {
        ...balance,
        evidenceId: transition.evidenceId,
        upstreamEvidenceId: transition.upstreamEvidenceId,
      }
    },
  )
  if (candidateBalances.some((balance) => balance === null)) return null
  const body: SnapshotWithoutEvidenceIds = {
    predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot',
    planId: completed.planId,
    ownerPersonId: completed.ownerPersonId,
    taxYear: completed.taxYear,
    ledgerRunId: completed.ledgerRunId,
    inventoryEvidenceId: completed.inventory.inventoryEvidenceId,
    movementCandidateId: completed.movementCandidate.movementCandidateId,
    applicationStatus: 'canonicalMovementCandidateAppliedExactlyOnce',
    allocationApplications: completed.allocationApplications.map(
      (application) => ({
        actionId: application.actionId,
        allocationId: application.allocationId,
        sourceAccountId: application.sourceAccountId,
        scheduledDate: application.scheduledDate,
        scheduledSequence: application.scheduledSequence,
        requestedAmount: application.requestedAmount,
        balanceBefore: application.balanceBefore,
        executedAmount: application.executedAmount,
        unexecutedAmount: application.unexecutedAmount,
        candidateBalanceAfter: application.candidateBalanceAfter,
        applicationEvidenceId: application.applicationEvidenceId,
        upstreamEvidenceId: application.upstreamEvidenceId,
      }),
    ),
    candidateBalances: candidateBalances as NonNullable<
      typeof candidateBalances[number]
    >[],
    yearEndApplicableBalances: yearEndApplicableBalances.map((balance) => ({
      predicate: balance.predicate,
      planId: balance.planId,
      ownerPersonId: balance.ownerPersonId,
      sourceAccountId: balance.sourceAccountId,
      taxYear: balance.taxYear,
      ledgerRunId: balance.ledgerRunId,
      ledgerPhase: balance.ledgerPhase,
      asOfDate: balance.asOfDate,
      yearEndApplicableBalanceAmount: balance.yearEndApplicableBalanceAmount,
      evidenceId: balance.evidenceId,
      upstreamEvidenceId: balance.upstreamEvidenceId,
    })).sort((left, right) =>
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)),
  }
  const ids = derivePlanOwnedNonRothIraAnnualPassSnapshotEvidenceIds(
    completed.transactionEvidenceId,
    annualPassEvidence,
    body,
  )
  return deepFreeze({ ...body, ...ids })
}

function effectOrder(
  left: Readonly<PlanOwnedNonRothIraAnnualPassObservedEffect>,
  right: Readonly<PlanOwnedNonRothIraAnnualPassObservedEffect>,
): number {
  return compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}

function safeSum(values: readonly number[]): UsdCents | null {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  return total > BigInt(Number.MAX_SAFE_INTEGER)
    ? null
    : asUsdCents(Number(total))
}

function observedEffects(
  actions: readonly Readonly<PlanOwnedNonRothIraAnnualExecutionAction>[],
): PlanOwnedNonRothIraAnnualPassObservedEffect[] | null {
  const result: PlanOwnedNonRothIraAnnualPassObservedEffect[] = []
  for (const action of actions) {
    for (const allocation of action.allocations) {
      const basisReturnAmount = safeSum(allocation.taxCharacter
        .filter((item) => item.kind === 'basisReturn')
        .map((item) => item.amount))
      const ordinaryIncomeAmount = safeSum(allocation.taxCharacter
        .filter((item) => item.kind === 'ordinaryIncome')
        .map((item) => item.amount))
      const allocatedPenaltyAmount = safeSum(
        allocation.penaltyEvaluations.map((item) => item.finalPenaltyAmount),
      )
      if (basisReturnAmount === null || ordinaryIncomeAmount === null ||
          allocatedPenaltyAmount === null) return null
      result.push({
        actionId: action.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        executedAmount: allocation.executedAmount,
        basisReturnAmount,
        ordinaryIncomeAmount,
        allocatedPenaltyAmount,
      })
    }
  }
  return result.sort(effectOrder)
}

function canonicalAssumptions(
  effects: readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
): PlanOwnedNonRothIraAnnualPassAssumedEffect[] | null {
  const result: PlanOwnedNonRothIraAnnualPassAssumedEffect[] = []
  const identities = new Set<string>()
  for (const effect of effects) {
    const executedAmount = usdCentsSchema.safeParse(effect.executedAmount)
    const basisReturnAmount = usdCentsSchema.safeParse(effect.basisReturnAmount)
    const ordinaryIncomeAmount =
      usdCentsSchema.safeParse(effect.ordinaryIncomeAmount)
    const allocatedPenaltyAmount =
      usdCentsSchema.safeParse(effect.allocatedPenaltyAmount)
    if (!nonblank(effect.actionId) || !nonblank(effect.allocationId) ||
        !nonblank(effect.sourceAccountId) ||
        !executedAmount.success || !basisReturnAmount.success ||
        !ordinaryIncomeAmount.success || !allocatedPenaltyAmount.success) {
      return null
    }
    const identity = JSON.stringify([
      effect.actionId,
      effect.allocationId,
      effect.sourceAccountId,
    ])
    if (identities.has(identity)) return null
    identities.add(identity)
    result.push({
      actionId: effect.actionId,
      allocationId: effect.allocationId,
      sourceAccountId: effect.sourceAccountId,
      executedAmount: executedAmount.data,
      basisReturnAmount: basisReturnAmount.data,
      ordinaryIncomeAmount: ordinaryIncomeAmount.data,
      allocatedPenaltyAmount: allocatedPenaltyAmount.data,
    })
  }
  return result.sort(effectOrder)
}

function effectKeys(
  effects: readonly Readonly<PlanOwnedNonRothIraAnnualPassAssumedEffect>[],
): readonly (readonly [ActionId, AllocationId, AccountId])[] {
  return effects.map((effect) => [
    effect.actionId,
    effect.allocationId,
    effect.sourceAccountId,
  ] as const)
}

export type BuildCompletePlanOwnedNonRothIraAnnualPassEvidenceInput = Omit<
  CompletePlanOwnedNonRothIraAnnualPassEvidence,
  'evidenceId'
>

/** Builds the immutable annual-pass observation envelope consumed by probe. */
export function buildCompletePlanOwnedNonRothIraAnnualPassEvidence(
  input: Readonly<BuildCompletePlanOwnedNonRothIraAnnualPassEvidenceInput>,
): Readonly<CompletePlanOwnedNonRothIraAnnualPassEvidence> {
  if (input.predicate !== 'completePlanOwnedNonRothIraAnnualPassEvidence' ||
      input.passStatus !== 'completeAfterAllAnnualTransactionsAndGrowth' ||
      !nonblank(input.ledgerRunId) || !nonblank(input.movementCandidateId) ||
      !nonblank(input.inventoryEvidenceId) ||
      !nonblank(input.transactionEvidenceId) ||
      !nonblank(input.upstreamEvidenceId)) {
    throw new TypeError('Annual-pass evidence bindings must be complete and nonblank')
  }
  const assumptions = canonicalAssumptions(input.assumedEffects)
  if (assumptions === null) {
    throw new TypeError('Annual-pass assumptions must be valid and unique')
  }
  const yearEndApplicableBalances = input.yearEndApplicableBalances.map(
    (balance) => ({
      predicate: balance.predicate,
      planId: balance.planId,
      ownerPersonId: balance.ownerPersonId,
      sourceAccountId: balance.sourceAccountId,
      taxYear: balance.taxYear,
      ledgerRunId: balance.ledgerRunId,
      ledgerPhase: balance.ledgerPhase,
      asOfDate: balance.asOfDate,
      yearEndApplicableBalanceAmount: balance.yearEndApplicableBalanceAmount,
      evidenceId: balance.evidenceId,
      upstreamEvidenceId: balance.upstreamEvidenceId,
    }),
  ).sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const withoutId: BuildCompletePlanOwnedNonRothIraAnnualPassEvidenceInput = {
    predicate: input.predicate,
    planId: input.planId,
    ownerPersonId: input.ownerPersonId,
    taxYear: input.taxYear,
    ledgerRunId: input.ledgerRunId,
    movementCandidateId: input.movementCandidateId,
    inventoryEvidenceId: input.inventoryEvidenceId,
    transactionEvidenceId: input.transactionEvidenceId,
    assumedEffects: assumptions,
    yearEndApplicableBalances,
    passStatus: input.passStatus,
    upstreamEvidenceId: input.upstreamEvidenceId,
  }
  const evidenceId = deriveActionStructuralId(
    'owned-ira-plan-complete-annual-pass-evidence',
    [withoutId],
  )
  if (containsIdentifier(withoutId, evidenceId)) {
    throw new TypeError('Derived annual-pass evidence ID collides with its bindings')
  }
  return deepFreeze({ ...withoutId, evidenceId })
}

function canonicalPenaltyFacts(
  input: Readonly<AnnualPassPenaltyFacts>,
): AnnualPassPenaltyFacts {
  return {
    ownerEvidence: input.ownerEvidence,
    simpleParticipationEvidence: input.simpleParticipationEvidence,
    ...(input.qualifiedDisabilityEvidence === undefined ? {} : {
      qualifiedDisabilityEvidence: input.qualifiedDisabilityEvidence,
    }),
    ...(input.rejectedDisabilityEvidence === undefined ? {} : {
      rejectedDisabilityEvidence: input.rejectedDisabilityEvidence,
    }),
    ...(input.ownerAliveEvidence === undefined ? {} : {
      ownerAliveEvidence: input.ownerAliveEvidence,
    }),
    ...(input.iraSeppStatusEvidence === undefined ? {} : {
      iraSeppStatusEvidence: input.iraSeppStatusEvidence,
    }),
    ...(input.iraSeppScheduleRoutes === undefined ? {} : {
      iraSeppScheduleRoutes: input.iraSeppScheduleRoutes,
    }),
    ...(input.noOtherExceptionAttestations === undefined ? {} : {
      noOtherExceptionAttestations: input.noOtherExceptionAttestations,
    }),
  }
}

function probePlanOwnedNonRothIraAnnualPassUnchecked(
  input: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>,
): Readonly<ProbePlanOwnedNonRothIraAnnualPassResult> {
  const suppliedPass = input.annualPassEvidence
  if (!nonblank(suppliedPass.evidenceId) ||
      !nonblank(suppliedPass.upstreamEvidenceId) ||
      suppliedPass.evidenceId === suppliedPass.upstreamEvidenceId) {
    return rollback('annualPassEvidenceInvalid',
      'Annual-pass evidence must be a complete, nonblank, distinct-ID envelope')
  }
  const prerequisites = [
    input.provisionalMovementInput,
    input.provisionalMovementCandidate,
    input.completedCandidateInput,
    input.annualBasisRecord,
    input.postYearContributionWindow,
    input.penaltyFacts,
  ]
  if (containsIdentifier(prerequisites, suppliedPass.evidenceId) ||
      containsIdentifier(prerequisites, suppliedPass.upstreamEvidenceId)) {
    return rollback('annualPassIdentifierCollision',
      'Annual-pass evidence collides with a prerequisite identifier')
  }

  const provisional = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
    input.provisionalMovementInput,
  )
  if (provisional.status !== 'movementCandidateStaged') {
    return rollback('provisionalCandidateBlocked',
      'The speculative movement candidate could not be rebuilt',
      provisional.status)
  }
  if (!same(provisional, input.provisionalMovementCandidate)) {
    return rollback('provisionalCandidateMismatch',
      'Supplied provisional candidate does not exactly match canonical staging')
  }
  const canonicalProvisionalInput = {
    ...input.provisionalMovementInput,
    requests: provisional.actions.map((action) => action.request),
    openingBalances: [...input.provisionalMovementInput.openingBalances]
      .sort((left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId)),
    sourceEvidence: [...input.provisionalMovementInput.sourceEvidence]
      .sort((left, right) =>
        compareUtf16CodeUnits(
          left.sourceAccountId,
          right.sourceAccountId,
        )),
  }

  const completed = preparePlanOwnedNonRothIraAnnualCandidateTransaction(
    input.completedCandidateInput,
  )
  if (completed.status !== 'candidateTransactionPrepared') {
    return rollback('completedCandidateBlocked',
      'Truthful completed annual inventory cannot use the standalone transaction',
      completed.status)
  }
  if (canonicalAssumptions(suppliedPass.assumedEffects) === null) {
    return rollback('effectAssumptionInvalid',
      'Annual-pass assumptions must be a valid, unique allocation vector')
  }
  const { evidenceId: suppliedPassEvidenceId, ...suppliedPassBody } =
    suppliedPass
  const pass = buildCompletePlanOwnedNonRothIraAnnualPassEvidence(
    suppliedPassBody,
  )
  if (!same(pass, suppliedPass) ||
      suppliedPassEvidenceId !== pass.evidenceId ||
      pass.planId !== completed.planId ||
      pass.ownerPersonId !== completed.ownerPersonId ||
      pass.taxYear !== completed.taxYear ||
      pass.ledgerRunId !== completed.ledgerRunId ||
      pass.movementCandidateId !== completed.movementCandidate.movementCandidateId ||
      pass.inventoryEvidenceId !== completed.inventory.inventoryEvidenceId ||
      pass.transactionEvidenceId !== completed.transactionEvidenceId) {
    return rollback('completedCandidateMismatch',
      'Completed transaction and canonical annual-pass observation do not exactly rejoin')
  }
  if (!same(completed.movementInput, canonicalProvisionalInput) ||
      !same(completed.movementCandidate, provisional)) {
    return rollback('completedCandidateMismatch',
      'Completed transaction does not exactly rejoin the provisional movement')
  }

  const snapshot = buildSnapshot(
    completed,
    pass,
    pass.yearEndApplicableBalances,
  )
  if (snapshot === null ||
      snapshot.evidenceId === snapshot.upstreamEvidenceId ||
      containsIdentifier([input, completed], snapshot.evidenceId) ||
      containsIdentifier([input, completed], snapshot.upstreamEvidenceId)) {
    return rollback('snapshotConstructionInvalid',
      'Canonical annual-pass snapshot identity is incomplete or collides with prerequisites')
  }
  const { ledgerRunId, openingBalances, ...inventoryInput } =
    input.completedCandidateInput
  void ledgerRunId
  void openingBalances
  const postCandidateInput:
    BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput = {
      inventoryInput,
      movementInput: completed.movementInput,
      movementCandidate: completed.movementCandidate,
      postCandidateSnapshot: snapshot,
      annualBasisRecord: input.annualBasisRecord,
      postYearContributionWindow: input.postYearContributionWindow,
    }
  const rebuilt =
    buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(
      postCandidateInput,
    )
  if (rebuilt.status !== 'postCandidateClassificationInputBuilt') {
    return rollback('postCandidateEvidenceBlocked',
      'Completed annual-pass post-candidate evidence failed closed',
      rebuilt.status)
  }

  const { line7Distributions, ...annualInput } = rebuilt.classificationInput
  void line7Distributions
  const penaltyFacts = canonicalPenaltyFacts(input.penaltyFacts)
  const coordinated = coordinateOwnedNonRothIraAnnualWithdrawalCandidate({
    ...penaltyFacts,
    movementInput: completed.movementInput,
    annualInput,
  })
  if (coordinated.status !== 'annualEvidenceBound' &&
      coordinated.status !== 'noPositiveMovementStaged') {
    return rollback('annualFinalizationBlocked',
      'Completed annual characterization or penalty prerequisites failed closed',
      coordinated.status)
  }
  const executionInput: ExecutePlanOwnedNonRothIraAnnualPostCandidateInput = {
    ...penaltyFacts,
    postCandidateInput,
    postCandidateEvidence: rebuilt,
    annualFinalization: coordinated.status === 'annualEvidenceBound'
      ? coordinated.annualEvidence
      : null,
  }
  const execution =
    executePlanOwnedNonRothIraAnnualPostCandidate(executionInput)
  if (execution.status !== 'postCandidateAnnualWithdrawalCommitted' &&
      execution.status !== 'postCandidateMovementRefused') {
    return rollback('postCandidateExecutionBlocked',
      'The canonical post-candidate execution binder failed closed',
      execution.status)
  }
  const observed = observedEffects(execution.actions)
  if (observed === null) {
    return rollback('effectProjectionInvalid',
      'Canonical observed effects exceeded the exact-cent safe-integer range')
  }
  const assumed = pass.assumedEffects
  if (!same(effectKeys(assumed), effectKeys(observed))) {
    return rollback('effectAssumptionInvalid',
      'Assumed effects must be a valid, unique, exact-key allocation vector')
  }
  const probeEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-pass-probe',
    [
      completed.transactionEvidenceId,
      completed.inventory.inventoryEvidenceId,
      pass,
      rebuilt.reconciliationEvidence.evidenceId,
      execution.executionEvidenceId,
      observed,
    ],
  )
  if (containsIdentifier(
    [input, completed, snapshot, rebuilt, coordinated, execution],
    probeEvidenceId,
  )) {
    return rollback('probeEvidenceIdCollision',
      'Derived annual-pass probe evidence ID collides with prerequisite evidence')
  }
  const { transactionEvidenceId: referencedTransactionId, ...passWithoutTx } =
    pass
  void referencedTransactionId
  if (containsIdentifier(
    [completed, snapshot, rebuilt, coordinated, execution],
    pass.evidenceId,
  ) || containsIdentifier(
    [completed, snapshot, rebuilt, coordinated, execution],
    pass.upstreamEvidenceId,
  ) || containsIdentifier(
    [
      passWithoutTx,
      input.annualBasisRecord,
      input.postYearContributionWindow,
      penaltyFacts,
      rebuilt,
      coordinated,
      execution,
    ],
    completed.transactionEvidenceId,
  )) {
    return rollback('annualPassIdentifierCollision',
      'Annual-pass or transaction identity collides across controller evidence')
  }
  const controlBinding = deepFreeze({
    transactionEvidenceId: completed.transactionEvidenceId,
    inventoryEvidenceId: completed.inventory.inventoryEvidenceId,
    annualPassEvidenceId: pass.evidenceId,
    probeEvidenceId,
  })
  if (!same(assumed, observed)) {
    return deepFreeze({
      status: 'reprobe',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      probeEvidenceId,
      observedEffects: observed,
      execution: null,
      controlBinding,
      issues: [],
    })
  }
  if (execution.status === 'postCandidateMovementRefused') {
    return deepFreeze({
      status: 'commit',
      decision: 'settledNoMovement',
      movement: 'noMovement',
      actionability: 'established',
      probeEvidenceId,
      observedEffects: observed,
      execution,
      controlBinding,
      issues: [],
    })
  }
  return deepFreeze({
    status: 'commit',
    decision: 'commitReady',
    movement: 'notCommitted',
    actionability: 'established',
    probeEvidenceId,
    observedEffects: observed,
    execution,
    controlBinding,
    issues: [],
  })
}

export function probePlanOwnedNonRothIraAnnualPass(
  input: Readonly<ProbePlanOwnedNonRothIraAnnualPassInput>,
): Readonly<ProbePlanOwnedNonRothIraAnnualPassResult> {
  try {
    return probePlanOwnedNonRothIraAnnualPassUnchecked(input)
  } catch (error) {
    return rollback(
      'orchestrationException',
      `Annual-pass orchestration failed closed: ${
        error instanceof Error ? error.message : String(error)}`,
    )
  }
}
