import type {
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  stageBeneficiaryTraditionalIraResidualRmdMovement,
  type BeneficiaryTraditionalIraResidualRmdMovementCandidate,
  type BeneficiaryTraditionalIraResidualRmdMovementStagedResult,
  type BeneficiaryTraditionalIraNoResidualRmdMovementResult,
  type StageBeneficiaryTraditionalIraResidualRmdMovementInput,
} from './beneficiaryTraditionalIraResidualRmdMovementCandidate.js'
import type { AccountId, PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

export interface PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput {
  readonly movementInput:
    Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementInput>
}

export interface BeneficiaryTraditionalIraResidualRmdDetachedApplication {
  readonly predicate:
    'beneficiaryTraditionalIraResidualRmdDetachedApplication'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly sourceAccountId: AccountId
  readonly executionDate: string
  readonly executionSequence: number
  readonly sourceBalanceBefore: UsdCents
  readonly executedAmount: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly residualRmdBefore: UsdCents
  readonly residualRmdSatisfiedByApplication: UsdCents
  readonly residualRmdAfter: UsdCents
  readonly predecessorSourceBalanceTransitionEvidenceId: string
  readonly predecessorRmdTransitionEvidenceId: string
  readonly residualSourceAllocationEvidenceId: string
  readonly residualAllocationEvidenceId: string
  readonly scheduleEvidenceId: string
  readonly movementCandidateId: string
  readonly movementBatchId: string
  readonly applicationEvidenceId: string
}

export interface BeneficiaryTraditionalIraPostResidualRmdSourceBalanceTransition {
  readonly predicate:
    'beneficiaryTraditionalIraPostResidualRmdSourceBalanceTransition'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly sourceAccountId: AccountId
  readonly annualOpeningBalanceAmount: UsdCents
  readonly preResidualExecutedAmount: UsdCents
  readonly preResidualBalanceAmount: UsdCents
  readonly residualRmdExecutedAmount: UsdCents
  readonly postResidualExecutedAmount: UsdCents
  readonly postResidualBalanceAmount: UsdCents
  readonly residualApplicationEvidenceIds: readonly string[]
  readonly predecessorSourceBalanceTransitionEvidenceId: string
  readonly residualAllocationEvidenceId: string
  readonly movementBatchId: string
  readonly transitionEvidenceId: string
}

export interface BeneficiaryTraditionalIraPostResidualRmdTransition {
  readonly predicate: 'beneficiaryTraditionalIraPostResidualRmdTransition'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly rmdRequiredAmount: UsdCents
  readonly rmdSatisfiedBeforeResidual: UsdCents
  readonly rmdSatisfiedByResidualTransaction: UsdCents
  readonly finalRmdSatisfiedAmount: UsdCents
  readonly finalRmdRemainingAmount: UsdCents
  readonly residualApplicationEvidenceIds: readonly string[]
  readonly predecessorRmdTransitionEvidenceId: string
  readonly residualAllocationEvidenceId: string
  readonly movementBatchId: string
  readonly transitionEvidenceId: string
}

export interface BeneficiaryTraditionalIraResidualRmdPhysicalTransactionPreparedResult {
  readonly status: 'residualRmdPhysicalTransactionPrepared'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly transactionStatus: 'appliedToDetachedSnapshotOnly'
  readonly reasons: readonly []
  readonly movementEvidence:
    Readonly<BeneficiaryTraditionalIraResidualRmdMovementStagedResult>
  readonly residualApplications:
    readonly Readonly<BeneficiaryTraditionalIraResidualRmdDetachedApplication>[]
  readonly sourceBalanceTransitions:
    readonly Readonly<BeneficiaryTraditionalIraPostResidualRmdSourceBalanceTransition>[]
  readonly rmdTransition:
    Readonly<BeneficiaryTraditionalIraPostResidualRmdTransition>
  readonly residualRmdRequiredAmount: UsdCents
  readonly residualRmdExecutedAmount: UsdCents
  readonly residualRmdUnallocatedAmount: UsdCents
  readonly residualDistributionProceedsAmount: UsdCents
  readonly transactionEvidenceId: string
}

export interface BeneficiaryTraditionalIraNoResidualRmdPhysicalTransactionResult {
  readonly status: 'noResidualRmdPhysicalTransaction'
  readonly noTransactionReason:
    | 'requirementAlreadySatisfied'
    | 'noSourceCapacity'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly transactionStatus: 'notCreated'
  readonly reasons: readonly []
  readonly movementEvidence:
    Readonly<BeneficiaryTraditionalIraNoResidualRmdMovementResult>
  readonly residualApplications: readonly []
  readonly sourceBalanceTransitions: readonly []
  readonly rmdTransition: null
  readonly residualRmdRequiredAmount: UsdCents
  readonly residualRmdExecutedAmount: 0
  readonly residualRmdUnallocatedAmount: UsdCents
  readonly residualDistributionProceedsAmount: 0
  readonly transactionEvidenceId: null
}

export interface UnsupportedBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly transactionStatus: 'notEstablished'
  readonly reasons: readonly [Readonly<ActionReason>]
  readonly movementEvidence: null
  readonly residualApplications: readonly []
  readonly sourceBalanceTransitions: readonly []
  readonly rmdTransition: null
  readonly residualRmdRequiredAmount: null
  readonly residualRmdExecutedAmount: null
  readonly residualRmdUnallocatedAmount: null
  readonly residualDistributionProceedsAmount: null
  readonly transactionEvidenceId: null
}

export type PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult =
  | BeneficiaryTraditionalIraResidualRmdPhysicalTransactionPreparedResult
  | BeneficiaryTraditionalIraNoResidualRmdPhysicalTransactionResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult

const INPUT_KEYS = ['movementInput'] as const
const INVALID_SNAPSHOT = Symbol('invalidSnapshot')

function plainDataSnapshot(
  value: unknown,
  ancestors = new Set<object>(),
): unknown | typeof INVALID_SNAPSHOT {
  if (
    value === null || typeof value === 'string' ||
    typeof value === 'number' || typeof value === 'boolean'
  ) return value
  if (typeof value !== 'object' || ancestors.has(value)) return INVALID_SNAPSHOT
  try {
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_SNAPSHOT
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')
      const size = length?.value
      if (
        length === undefined || length.enumerable ||
        !Object.hasOwn(length, 'value') || typeof size !== 'number' ||
        !Number.isSafeInteger(size) || size < 0 ||
        keys.length !== size + 1 || !keys.includes('length') ||
        Array.from({ length: size }, (_, index) => String(index))
          .some((key) => !keys.includes(key))
      ) return INVALID_SNAPSHOT
    }
    const output: unknown[] | Record<string, unknown> = array
      ? []
      : Object.create(null) as Record<string, unknown>
    ancestors.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined || !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return INVALID_SNAPSHOT
      const child = plainDataSnapshot(descriptor.value, ancestors)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      if (array) (output as unknown[])[Number(key as string)] = child
      else (output as Record<string, unknown>)[key as string] = child
    }
    return output
  } catch {
    return INVALID_SNAPSHOT
  } finally {
    ancestors.delete(value)
  }
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) &&
    typeof value === 'object' &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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

function unsupported(): Readonly<
  UnsupportedBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    movementEvidence: null,
    residualApplications: [],
    sourceBalanceTransitions: [],
    rmdTransition: null,
    residualRmdRequiredAmount: null,
    residualRmdExecutedAmount: null,
    residualRmdUnallocatedAmount: null,
    residualDistributionProceedsAmount: null,
    transactionEvidenceId: null,
  })
}

function claimRole(
  registry: Map<string, string>,
  value: string,
  role: string,
): boolean {
  if (!nonblank(value)) return false
  const existing = registry.get(value)
  if (existing !== undefined) return existing === role
  registry.set(value, role)
  return true
}

function prerequisiteRoles(
  input: Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementInput>,
  movement: Readonly<BeneficiaryTraditionalIraResidualRmdMovementStagedResult>,
): Map<string, string> | null {
  const registry = new Map<string, string>()
  const rmd = input.allocationInput.rmdTransition
  const claims: Array<readonly [string, string]> = [
    [rmd.beneficiaryPersonId, 'beneficiaryPerson'],
    [rmd.decedentPersonId, 'decedentPerson'],
    [rmd.rmdPoolId, 'rmdPool'],
    [rmd.finalAnnualEvidenceId, 'finalAnnualEvidence'],
    [rmd.coordinatorEvidenceId, 'coordinatorEvidence'],
    [rmd.transitionEvidenceId, 'predecessorRmdTransition'],
    [movement.residualAllocationEvidenceId, 'residualAllocation'],
    [movement.scheduleEvidence.scheduleEvidenceId, 'residualSchedule'],
    [movement.movementBatchId, 'residualMovementBatch'],
    ...rmd.applicationEvidenceIds.map(
      (id) => [id, `predecessorApplication:${id}`] as const,
    ),
  ]
  for (const source of input.allocationInput.sourceBalanceTransitions) {
    claims.push(
      [source.sourceAccountId, `sourceAccount:${source.sourceAccountId}`],
      [
        source.transitionEvidenceId,
        `predecessorSourceTransition:${source.sourceAccountId}`,
      ],
      ...source.applicationEvidenceIds.map(
        (id) => [id, `predecessorApplication:${id}`] as const,
      ),
    )
  }
  for (const predecessor of movement.scheduleEvidence.predecessorApplications) {
    claims.push(
      [predecessor.beneficiaryPersonId, 'beneficiaryPerson'],
      [predecessor.decedentPersonId, 'decedentPerson'],
      [
        predecessor.sourceAccountId,
        `sourceAccount:${predecessor.sourceAccountId}`,
      ],
      [predecessor.actionId, 'action'],
      [
        predecessor.allocationId,
        `allocation:${predecessor.applicationEvidenceId}`,
      ],
      [
        predecessor.physicalSourceEvidenceId,
        `physicalSource:${predecessor.applicationEvidenceId}`,
      ],
      [
        predecessor.movementCandidateId,
        `predecessorMovement:${predecessor.applicationEvidenceId}`,
      ],
      [
        predecessor.finalMemberEvidenceId,
        `finalMember:${predecessor.applicationEvidenceId}`,
      ],
      [predecessor.finalAnnualEvidenceId, 'finalAnnualEvidence'],
      [predecessor.coordinatorEvidenceId, 'coordinatorEvidence'],
      [
        predecessor.applicationEvidenceId,
        `predecessorApplication:${predecessor.applicationEvidenceId}`,
      ],
    )
  }
  for (const candidate of movement.movementCandidates) {
    claims.push(
      [candidate.sourceAccountId, `sourceAccount:${candidate.sourceAccountId}`],
      [
        candidate.residualSourceAllocationEvidenceId,
        `residualSourceAllocation:${candidate.sourceAccountId}`,
      ],
      [candidate.residualAllocationEvidenceId, 'residualAllocation'],
      [candidate.scheduleEvidenceId, 'residualSchedule'],
      [
        candidate.movementCandidateId,
        `residualMovement:${candidate.sourceAccountId}`,
      ],
    )
  }
  for (const [value, role] of claims) {
    if (!claimRole(registry, value, role)) return null
  }
  return registry
}

function safeCents(value: bigint): UsdCents | null {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return asUsdCents(Number(value))
}

function exactCandidateChain(
  movement: Readonly<BeneficiaryTraditionalIraResidualRmdMovementStagedResult>,
  sources: readonly Readonly<BeneficiaryTraditionalIraDetachedSourceBalanceTransition>[],
  rmd: Readonly<BeneficiaryTraditionalIraDetachedRmdTransition>,
): boolean {
  const candidates = movement.movementCandidates
  if (candidates.length === 0) return false
  const sourceById = new Map(sources.map((source) => [
    source.sourceAccountId,
    source,
  ] as const))
  let expectedRemaining = movement.residualRmdRequiredAmount
  let previousSourceId: AccountId | null = null
  let executed = 0n
  for (const candidate of candidates) {
    const source = sourceById.get(candidate.sourceAccountId)
    if (
      source === undefined ||
      (previousSourceId !== null &&
        compareUtf16CodeUnits(previousSourceId, candidate.sourceAccountId) >= 0) ||
      candidate.beneficiaryPersonId !== rmd.beneficiaryPersonId ||
      candidate.decedentPersonId !== rmd.decedentPersonId ||
      candidate.taxYear !== rmd.taxYear || candidate.rmdPoolId !== rmd.rmdPoolId ||
      candidate.executionDate !== movement.scheduleEvidence.executionDate ||
      candidate.executionSequence !==
        movement.scheduleEvidence.executionSequence ||
      candidate.sourceBalanceBefore !== source.annualFinalBalanceAmount ||
      candidate.stagedDebitAmount <= 0 ||
      candidate.sourceBalanceAfter !==
        candidate.sourceBalanceBefore - candidate.stagedDebitAmount ||
      candidate.residualRmdBefore !== expectedRemaining ||
      candidate.residualRmdAfter !==
        candidate.residualRmdBefore - candidate.stagedDebitAmount ||
      candidate.residualAllocationEvidenceId !==
        movement.residualAllocationEvidenceId ||
      candidate.scheduleEvidenceId !==
        movement.scheduleEvidence.scheduleEvidenceId
    ) return false
    executed += BigInt(candidate.stagedDebitAmount)
    expectedRemaining = candidate.residualRmdAfter
    previousSourceId = candidate.sourceAccountId
  }
  const safeExecuted = safeCents(executed)
  return safeExecuted !== null &&
    safeExecuted === movement.residualRmdStagedAmount &&
    expectedRemaining === movement.residualRmdUnallocatedAmount &&
    movement.residualRmdStagedAmount + movement.residualRmdUnallocatedAmount ===
      movement.residualRmdRequiredAmount
}

function applicationFor(
  candidate: Readonly<BeneficiaryTraditionalIraResidualRmdMovementCandidate>,
  movement: Readonly<BeneficiaryTraditionalIraResidualRmdMovementStagedResult>,
  source: Readonly<BeneficiaryTraditionalIraDetachedSourceBalanceTransition>,
  rmd: Readonly<BeneficiaryTraditionalIraDetachedRmdTransition>,
  claimed: Map<string, string>,
): BeneficiaryTraditionalIraResidualRmdDetachedApplication | null {
  const withoutId = {
    predicate:
      'beneficiaryTraditionalIraResidualRmdDetachedApplication' as const,
    beneficiaryPersonId: candidate.beneficiaryPersonId,
    decedentPersonId: candidate.decedentPersonId,
    taxYear: candidate.taxYear,
    rmdPoolId: candidate.rmdPoolId,
    sourceAccountId: candidate.sourceAccountId,
    executionDate: candidate.executionDate,
    executionSequence: candidate.executionSequence,
    sourceBalanceBefore: candidate.sourceBalanceBefore,
    executedAmount: candidate.stagedDebitAmount,
    sourceBalanceAfter: candidate.sourceBalanceAfter,
    residualRmdBefore: candidate.residualRmdBefore,
    residualRmdSatisfiedByApplication: candidate.stagedDebitAmount,
    residualRmdAfter: candidate.residualRmdAfter,
    predecessorSourceBalanceTransitionEvidenceId: source.transitionEvidenceId,
    predecessorRmdTransitionEvidenceId: rmd.transitionEvidenceId,
    residualSourceAllocationEvidenceId:
      candidate.residualSourceAllocationEvidenceId,
    residualAllocationEvidenceId: candidate.residualAllocationEvidenceId,
    scheduleEvidenceId: candidate.scheduleEvidenceId,
    movementCandidateId: candidate.movementCandidateId,
    movementBatchId: movement.movementBatchId,
  }
  const applicationEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-detached-application',
    [withoutId],
  )
  if (!claimRole(
    claimed,
    applicationEvidenceId,
    `derivedResidualApplication:${candidate.sourceAccountId}`,
  )) return null
  return { ...withoutId, applicationEvidenceId }
}

function noTransaction(
  movement: Readonly<BeneficiaryTraditionalIraNoResidualRmdMovementResult>,
): Readonly<
  | BeneficiaryTraditionalIraNoResidualRmdPhysicalTransactionResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult
> {
  const noTransactionReason = movement.residualRmdRequiredAmount === 0
    ? 'requirementAlreadySatisfied' as const
    : 'noSourceCapacity' as const
  if (
    movement.residualRmdStagedAmount !== 0 ||
    movement.residualRmdUnallocatedAmount !==
      movement.residualRmdRequiredAmount ||
    (noTransactionReason === 'noSourceCapacity' &&
      movement.residualRmdRequiredAmount <= 0)
  ) return unsupported()
  return deepFreeze({
    status: 'noResidualRmdPhysicalTransaction',
    noTransactionReason,
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notCreated',
    reasons: [],
    movementEvidence: movement,
    residualApplications: [],
    sourceBalanceTransitions: [],
    rmdTransition: null,
    residualRmdRequiredAmount: movement.residualRmdRequiredAmount,
    residualRmdExecutedAmount: 0,
    residualRmdUnallocatedAmount: movement.residualRmdUnallocatedAmount,
    residualDistributionProceedsAmount: 0,
    transactionEvidenceId: null,
  })
}

function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult> {
  const raw = plainDataSnapshot(input)
  if (!exactRecord(raw, INPUT_KEYS)) return unsupported()
  const snapshot = raw as unknown as
    PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput
  const movement = stageBeneficiaryTraditionalIraResidualRmdMovement(
    snapshot.movementInput,
  )
  if (movement.status === 'unsupported') return unsupported()
  if (movement.status === 'noResidualRmdMovement') {
    return noTransaction(movement)
  }

  const rmd = snapshot.movementInput.allocationInput.rmdTransition
  const sources = [...snapshot.movementInput.allocationInput
    .sourceBalanceTransitions].sort((left, right) =>
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  if (!exactCandidateChain(movement, sources, rmd)) return unsupported()
  const claimed = prerequisiteRoles(snapshot.movementInput, movement)
  if (claimed === null) return unsupported()

  const sourceById = new Map(sources.map((source) => [
    source.sourceAccountId,
    source,
  ] as const))
  const residualApplications:
    BeneficiaryTraditionalIraResidualRmdDetachedApplication[] = []
  for (const candidate of movement.movementCandidates) {
    const source = sourceById.get(candidate.sourceAccountId)
    if (source === undefined) return unsupported()
    const application = applicationFor(
      candidate,
      movement,
      source,
      rmd,
      claimed,
    )
    if (application === null) return unsupported()
    residualApplications.push(application)
  }

  const applicationsBySource = new Map(residualApplications.map(
    (application) => [application.sourceAccountId, application] as const,
  ))
  const sourceBalanceTransitions:
    BeneficiaryTraditionalIraPostResidualRmdSourceBalanceTransition[] = []
  for (const source of sources) {
    const application = applicationsBySource.get(source.sourceAccountId)
    const residualRmdExecutedAmount = application?.executedAmount ??
      asUsdCents(0)
    const postResidualExecutedAmount = safeCents(
      BigInt(source.totalExecutedAmount) + BigInt(residualRmdExecutedAmount),
    )
    const postResidualBalanceAmount = safeCents(
      BigInt(source.annualFinalBalanceAmount) -
        BigInt(residualRmdExecutedAmount),
    )
    if (
      postResidualExecutedAmount === null ||
      postResidualBalanceAmount === null ||
      BigInt(source.annualOpeningBalanceAmount) -
        BigInt(postResidualExecutedAmount) !==
          BigInt(postResidualBalanceAmount) ||
      (application !== undefined &&
        (application.sourceBalanceBefore !== source.annualFinalBalanceAmount ||
          application.sourceBalanceAfter !== postResidualBalanceAmount))
    ) return unsupported()
    const withoutId = {
      predicate:
        'beneficiaryTraditionalIraPostResidualRmdSourceBalanceTransition' as const,
      beneficiaryPersonId: rmd.beneficiaryPersonId,
      decedentPersonId: rmd.decedentPersonId,
      taxYear: rmd.taxYear,
      sourceAccountId: source.sourceAccountId,
      annualOpeningBalanceAmount: source.annualOpeningBalanceAmount,
      preResidualExecutedAmount: source.totalExecutedAmount,
      preResidualBalanceAmount: source.annualFinalBalanceAmount,
      residualRmdExecutedAmount,
      postResidualExecutedAmount,
      postResidualBalanceAmount,
      residualApplicationEvidenceIds: application === undefined
        ? []
        : [application.applicationEvidenceId],
      predecessorSourceBalanceTransitionEvidenceId:
        source.transitionEvidenceId,
      residualAllocationEvidenceId: movement.residualAllocationEvidenceId,
      movementBatchId: movement.movementBatchId,
    }
    const transitionEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-post-residual-rmd-source-balance-transition',
      [withoutId],
    )
    if (!claimRole(
      claimed,
      transitionEvidenceId,
      `derivedPostResidualSourceTransition:${source.sourceAccountId}`,
    )) return unsupported()
    sourceBalanceTransitions.push({ ...withoutId, transitionEvidenceId })
  }

  const proceeds = safeCents(residualApplications.reduce(
    (total, application) => total + BigInt(application.executedAmount),
    0n,
  ))
  const finalSatisfied = safeCents(
    BigInt(rmd.finalRmdSatisfiedAmount) +
      BigInt(movement.residualRmdStagedAmount),
  )
  if (
    proceeds === null || finalSatisfied === null ||
    proceeds !== movement.residualRmdStagedAmount ||
    BigInt(finalSatisfied) +
        BigInt(movement.residualRmdUnallocatedAmount) !==
      BigInt(rmd.rmdRequiredAmount)
  ) return unsupported()
  const rmdWithoutId = {
    predicate: 'beneficiaryTraditionalIraPostResidualRmdTransition' as const,
    beneficiaryPersonId: rmd.beneficiaryPersonId,
    decedentPersonId: rmd.decedentPersonId,
    taxYear: rmd.taxYear,
    rmdPoolId: rmd.rmdPoolId,
    rmdRequiredAmount: rmd.rmdRequiredAmount,
    rmdSatisfiedBeforeResidual: rmd.finalRmdSatisfiedAmount,
    rmdSatisfiedByResidualTransaction: movement.residualRmdStagedAmount,
    finalRmdSatisfiedAmount: finalSatisfied,
    finalRmdRemainingAmount: movement.residualRmdUnallocatedAmount,
    residualApplicationEvidenceIds: residualApplications.map(
      (application) => application.applicationEvidenceId,
    ),
    predecessorRmdTransitionEvidenceId: rmd.transitionEvidenceId,
    residualAllocationEvidenceId: movement.residualAllocationEvidenceId,
    movementBatchId: movement.movementBatchId,
  }
  const rmdTransitionEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-post-residual-rmd-transition',
    [rmdWithoutId],
  )
  if (!claimRole(
    claimed,
    rmdTransitionEvidenceId,
    'derivedPostResidualRmdTransition',
  )) return unsupported()
  const rmdTransition = {
    ...rmdWithoutId,
    transitionEvidenceId: rmdTransitionEvidenceId,
  }

  const transactionEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-physical-transaction',
    [[
      movement.residualAllocationEvidenceId,
      movement.scheduleEvidence.scheduleEvidenceId,
      movement.movementBatchId,
      residualApplications.map(
        (application) => application.applicationEvidenceId,
      ),
      sourceBalanceTransitions.map(
        (transition) => transition.transitionEvidenceId,
      ),
      rmdTransition.transitionEvidenceId,
      proceeds,
      movement.residualRmdUnallocatedAmount,
    ]],
  )
  if (!claimRole(
    claimed,
    transactionEvidenceId,
    'derivedResidualPhysicalTransaction',
  )) return unsupported()
  return deepFreeze({
    status: 'residualRmdPhysicalTransactionPrepared',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'appliedToDetachedSnapshotOnly',
    reasons: [],
    movementEvidence: movement,
    residualApplications,
    sourceBalanceTransitions,
    rmdTransition,
    residualRmdRequiredAmount: movement.residualRmdRequiredAmount,
    residualRmdExecutedAmount: movement.residualRmdStagedAmount,
    residualRmdUnallocatedAmount: movement.residualRmdUnallocatedAmount,
    residualDistributionProceedsAmount: proceeds,
    transactionEvidenceId,
  })
}

/**
 * Rebuilds residual inherited-RMD movement evidence and applies its exact
 * candidate chain only to detached predecessor source/RMD transitions. It
 * creates no Plan mutation, tax character, actionability, or committed event.
 */
export function prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
