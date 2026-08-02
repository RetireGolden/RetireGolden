import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
  type PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import type { AccountId, PersonId } from './identity.js'
import type { UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { deriveActionStructuralId } from './structuralId.js'
import {
  validateBeneficiaryTraditionalIraResidualRmdSchedule,
  type BeneficiaryTraditionalIraResidualRmdScheduleEvidence,
} from './beneficiaryTraditionalIraResidualRmdChronology.js'

export type {
  BeneficiaryTraditionalIraResidualRmdScheduleEvidence,
} from './beneficiaryTraditionalIraResidualRmdChronology.js'

export interface StageBeneficiaryTraditionalIraResidualRmdMovementInput {
  readonly allocationInput:
    Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput>
  readonly scheduleEvidence:
    Readonly<BeneficiaryTraditionalIraResidualRmdScheduleEvidence> | null
}

export interface BeneficiaryTraditionalIraResidualRmdMovementCandidate {
  readonly predicate:
    'beneficiaryTraditionalIraResidualRmdMovementCandidate'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly sourceAccountId: AccountId
  readonly executionDate: string
  readonly executionSequence: number
  readonly sourceBalanceBefore: UsdCents
  readonly stagedDebitAmount: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly residualRmdBefore: UsdCents
  readonly residualRmdAfter: UsdCents
  readonly residualSourceAllocationEvidenceId: string
  readonly residualAllocationEvidenceId: string
  readonly scheduleEvidenceId: string
  readonly movementCandidateId: string
}

export interface BeneficiaryTraditionalIraResidualRmdMovementStagedResult {
  readonly status: 'residualRmdMovementStaged'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly chronology: 'exactScheduleEvidenceBound'
  readonly residualRmdRequiredAmount: UsdCents
  readonly residualRmdStagedAmount: UsdCents
  readonly residualRmdUnallocatedAmount: UsdCents
  readonly scheduleEvidence:
    Readonly<BeneficiaryTraditionalIraResidualRmdScheduleEvidence>
  readonly movementCandidates:
    readonly Readonly<BeneficiaryTraditionalIraResidualRmdMovementCandidate>[]
  readonly residualAllocationEvidenceId: string
  readonly movementBatchId: string
}

export interface BeneficiaryTraditionalIraNoResidualRmdMovementResult {
  readonly status: 'noResidualRmdMovement'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly chronology: 'notRequiredWithoutMovement'
  readonly residualRmdRequiredAmount: UsdCents
  readonly residualRmdStagedAmount: 0
  readonly residualRmdUnallocatedAmount: UsdCents
  readonly scheduleEvidence: null
  readonly movementCandidates: readonly []
  readonly residualAllocationEvidenceId: string
  readonly movementBatchId: null
}

export interface UnsupportedBeneficiaryTraditionalIraResidualRmdMovementResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly chronology: 'notEstablished'
  readonly reasons: readonly [Readonly<ActionReason>]
  readonly scheduleEvidence: null
  readonly movementCandidates: readonly []
  readonly residualAllocationEvidenceId: null
  readonly movementBatchId: null
}

export type StageBeneficiaryTraditionalIraResidualRmdMovementResult =
  | BeneficiaryTraditionalIraResidualRmdMovementStagedResult
  | BeneficiaryTraditionalIraNoResidualRmdMovementResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdMovementResult

const INPUT_KEYS = ['allocationInput', 'scheduleEvidence'] as const
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
  UnsupportedBeneficiaryTraditionalIraResidualRmdMovementResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    chronology: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    scheduleEvidence: null,
    movementCandidates: [],
    residualAllocationEvidenceId: null,
    movementBatchId: null,
  })
}

function claimRole(
  registry: Map<string, string>,
  value: string,
  role: string,
): boolean {
  const existing = registry.get(value)
  if (existing !== undefined) return existing === role
  registry.set(value, role)
  return true
}

function lineageRoles(
  allocation: Extract<
    ReturnType<typeof prepareBeneficiaryTraditionalIraResidualRmdAllocation>,
    { readonly status: 'residualRmdAllocationPrepared' }
  >,
  schedule: Readonly<BeneficiaryTraditionalIraResidualRmdScheduleEvidence>,
  allocationInput:
    Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput>,
): Map<string, string> | null {
  const registry = new Map<string, string>()
  const claims: Array<readonly [string, string]> = [
    [allocation.beneficiaryPersonId, 'beneficiaryPerson'],
    [allocation.decedentPersonId, 'decedentPerson'],
    [allocation.rmdPoolId, 'rmdPool'],
    [allocation.allocationEvidenceId, 'residualAllocationEvidence'],
    [allocation.rmdTransitionEvidenceId, 'rmdTransitionEvidence'],
    [schedule.beneficiaryPersonId, 'beneficiaryPerson'],
    [schedule.decedentPersonId, 'decedentPerson'],
    [schedule.rmdPoolId, 'rmdPool'],
    [schedule.residualAllocationEvidenceId, 'residualAllocationEvidence'],
    [schedule.finalAnnualEvidenceId, 'finalAnnualEvidence'],
    [schedule.coordinatorEvidenceId, 'coordinatorEvidence'],
    [schedule.scheduleEvidenceId, 'residualScheduleEvidence'],
  ]
  for (const source of allocationInput.sourceBalanceTransitions) {
    claims.push(
      [source.sourceAccountId, 'sourceAccount'],
      [
        source.transitionEvidenceId,
        `sourceTransitionEvidence:${source.sourceAccountId}`,
      ],
    )
  }
  for (const source of allocation.sourceAllocations) {
    claims.push(
      [source.sourceAccountId, 'sourceAccount'],
      [
        source.allocationEvidenceId,
        `residualSourceAllocationEvidence:${source.sourceAccountId}`,
      ],
      [source.rmdTransitionEvidenceId, 'rmdTransitionEvidence'],
    )
  }
  for (const application of schedule.predecessorApplications) {
    claims.push(
      [application.beneficiaryPersonId, 'beneficiaryPerson'],
      [application.decedentPersonId, 'decedentPerson'],
      [application.sourceAccountId, 'sourceAccount'],
      [application.actionId, 'action'],
      [
        application.allocationId,
        `allocation:${application.applicationEvidenceId}`,
      ],
      [
        application.physicalSourceEvidenceId,
        `physicalSourceEvidence:${application.actionId}:${application.allocationId}:${application.sourceAccountId}`,
      ],
      [
        application.movementCandidateId,
        `movementCandidate:${application.applicationEvidenceId}`,
      ],
      [
        application.finalMemberEvidenceId,
        `finalMemberEvidence:${application.applicationEvidenceId}`,
      ],
      [application.finalAnnualEvidenceId, 'finalAnnualEvidence'],
      [application.coordinatorEvidenceId, 'coordinatorEvidence'],
      [
        application.applicationEvidenceId,
        `physicalApplicationEvidence:${application.actionId}:${application.allocationId}:${application.sourceAccountId}`,
      ],
    )
  }
  for (const [value, role] of claims) {
    if (!claimRole(registry, value, role)) return null
  }
  return registry
}

function stage(
  input: Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementInput>,
): Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementResult> {
  const raw = plainDataSnapshot(input)
  if (!exactRecord(raw, INPUT_KEYS)) return unsupported()
  const allocation =
    prepareBeneficiaryTraditionalIraResidualRmdAllocation(
      raw.allocationInput as Readonly<
        PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput
      >,
    )
  if (allocation.status !== 'residualRmdAllocationPrepared') {
    return unsupported()
  }
  if (allocation.residualRmdAllocatedAmount === 0) {
    if (raw.scheduleEvidence !== null) return unsupported()
    return deepFreeze({
      status: 'noResidualRmdMovement',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      chronology: 'notRequiredWithoutMovement',
      residualRmdRequiredAmount: allocation.residualRmdRequiredAmount,
      residualRmdStagedAmount: 0,
      residualRmdUnallocatedAmount:
        allocation.residualRmdUnallocatedAmount,
      scheduleEvidence: null,
      movementCandidates: [],
      residualAllocationEvidenceId: allocation.allocationEvidenceId,
      movementBatchId: null,
    })
  }
  if (!validateBeneficiaryTraditionalIraResidualRmdSchedule(
    raw.scheduleEvidence,
    allocation,
    raw.allocationInput as Readonly<
      PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput
    >,
  )) {
    return unsupported()
  }
  const schedule = raw.scheduleEvidence
  const claimed = lineageRoles(
    allocation,
    schedule,
    raw.allocationInput as Readonly<
      PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput
    >,
  )
  if (claimed === null) return unsupported()

  const movementCandidates:
    BeneficiaryTraditionalIraResidualRmdMovementCandidate[] = []
  for (const source of allocation.sourceAllocations) {
    const withoutId = {
      predicate:
        'beneficiaryTraditionalIraResidualRmdMovementCandidate' as const,
      beneficiaryPersonId: allocation.beneficiaryPersonId,
      decedentPersonId: allocation.decedentPersonId,
      taxYear: allocation.taxYear,
      rmdPoolId: allocation.rmdPoolId,
      sourceAccountId: source.sourceAccountId,
      executionDate: schedule.executionDate,
      executionSequence: schedule.executionSequence,
      sourceBalanceBefore: source.sourceBalanceBefore,
      stagedDebitAmount: source.allocatedAmount,
      sourceBalanceAfter: source.sourceBalanceAfter,
      residualRmdBefore: source.residualRmdBefore,
      residualRmdAfter: source.residualRmdAfter,
      residualSourceAllocationEvidenceId: source.allocationEvidenceId,
      residualAllocationEvidenceId: allocation.allocationEvidenceId,
      scheduleEvidenceId: schedule.scheduleEvidenceId,
    }
    const movementCandidateId = deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-movement-candidate',
      [withoutId],
    )
    if (
      !nonblank(movementCandidateId) ||
      !claimRole(
        claimed,
        movementCandidateId,
        `derivedResidualMovement:${source.sourceAccountId}`,
      )
    ) {
      return unsupported()
    }
    movementCandidates.push({ ...withoutId, movementCandidateId })
  }
  const movementBatchId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-movement-batch',
    [[
      allocation.allocationEvidenceId,
      schedule.scheduleEvidenceId,
      movementCandidates.map((candidate) => candidate.movementCandidateId),
      allocation.residualRmdUnallocatedAmount,
    ]],
  )
  if (
    !nonblank(movementBatchId) ||
    !claimRole(claimed, movementBatchId, 'derivedResidualMovementBatch')
  ) {
    return unsupported()
  }
  return deepFreeze({
    status: 'residualRmdMovementStaged',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    chronology: 'exactScheduleEvidenceBound',
    residualRmdRequiredAmount: allocation.residualRmdRequiredAmount,
    residualRmdStagedAmount: allocation.residualRmdAllocatedAmount,
    residualRmdUnallocatedAmount: allocation.residualRmdUnallocatedAmount,
    scheduleEvidence: schedule,
    movementCandidates,
    residualAllocationEvidenceId: allocation.allocationEvidenceId,
    movementBatchId,
  })
}

/**
 * Rebuilds the residual inherited-RMD allocation and stages it only when an
 * exact pool-bound execution date/sequence is available. It never invents
 * phase order, commits balances, or publishes tax character.
 */
export function stageBeneficiaryTraditionalIraResidualRmdMovement(
  input: Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementInput>,
): Readonly<StageBeneficiaryTraditionalIraResidualRmdMovementResult> {
  try {
    return stage(input)
  } catch {
    return unsupported()
  }
}
