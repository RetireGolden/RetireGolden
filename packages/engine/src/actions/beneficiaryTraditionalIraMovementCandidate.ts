import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type AcceptedBeneficiaryTraditionalIraDeathPenaltyResult,
  type EvaluateBeneficiaryTraditionalIraDeathPenaltyInput,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { deriveActionStructuralId } from './structuralId.js'

export interface BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence {
  predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: PositiveUsdCents
  openingBalanceAmount: UsdCents
  closingBalanceAmount: UsdCents
  inheritanceEvidenceId: string
  basisEvidenceId: string
  sourceCharacterEvidenceId: string
  penaltyEvidenceId: string
  rmdPoolId: string
  rmdEvidenceId: string
  rmdRequiredAmount: UsdCents
  rmdSatisfiedBeforeExecution: UsdCents
  rmdRemainingBeforeExecution: UsdCents
  physicalSourceEvidenceId: string
}

export interface StageBeneficiaryTraditionalIraMovementCandidateInput {
  penaltyInput: Readonly<EvaluateBeneficiaryTraditionalIraDeathPenaltyInput>
  sourceSnapshots:
    readonly Readonly<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence>[] | null
}

export interface BeneficiaryTraditionalIraSourceDebitEvidence {
  kind: 'beneficiaryTraditionalIraSourceDebit'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  executionDate: string
  executionSequence: number
  debitAmount: PositiveUsdCents
  balanceBefore: UsdCents
  balanceAfter: UsdCents
  physicalSourceEvidenceId: string
}

export interface BeneficiaryTraditionalIraMovementCandidateEvidence {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  executionDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: PositiveUsdCents
  unexecutedAmount: 0
  openingBalanceAmount: UsdCents
  candidateClosingBalanceAmount: UsdCents
  sourceDebit: Readonly<BeneficiaryTraditionalIraSourceDebitEvidence>
  destinationCredits: readonly []
  inheritanceEvidenceId: string
  basisEvidenceId: string
  sourceCharacterEvidenceId: string
  penaltyEvidenceId: string
  rmdPoolId: string
  rmdEvidenceId: string
  rmdRequiredAmount: UsdCents
  rmdSatisfiedBeforeExecution: UsdCents
  rmdRemainingBeforeExecution: UsdCents
  physicalSourceEvidenceId: string
}

export interface StagedBeneficiaryTraditionalIraMovementCandidateResult {
  status: 'movementCandidateStaged'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly []
  movementCandidateId: string
  characterization:
    AcceptedBeneficiaryTraditionalIraDeathPenaltyResult['characterization']
  deathPenaltyEvidence:
    AcceptedBeneficiaryTraditionalIraDeathPenaltyResult['penaltyEvidence']
  candidate: Readonly<BeneficiaryTraditionalIraMovementCandidateEvidence>
}

export interface UnsupportedBeneficiaryTraditionalIraMovementCandidateResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  movementCandidateId: null
  characterization: null
  deathPenaltyEvidence: null
  candidate: null
}

export type StageBeneficiaryTraditionalIraMovementCandidateResult =
  | StagedBeneficiaryTraditionalIraMovementCandidateResult
  | UnsupportedBeneficiaryTraditionalIraMovementCandidateResult

const INPUT_KEYS = ['penaltyInput', 'sourceSnapshots'] as const
const SOURCE_KEYS = [
  'predicate',
  'actionId',
  'allocationId',
  'sourceAccountId',
  'beneficiaryPersonId',
  'decedentPersonId',
  'evaluationDate',
  'executionSequence',
  'requestedAmount',
  'executedAmount',
  'openingBalanceAmount',
  'closingBalanceAmount',
  'inheritanceEvidenceId',
  'basisEvidenceId',
  'sourceCharacterEvidenceId',
  'penaltyEvidenceId',
  'rmdPoolId',
  'rmdEvidenceId',
  'rmdRequiredAmount',
  'rmdSatisfiedBeforeExecution',
  'rmdRemainingBeforeExecution',
  'physicalSourceEvidenceId',
] as const

const INVALID_SNAPSHOT = Symbol('invalidSnapshot')

function plainDataSnapshot(
  value: unknown,
  ancestors = new Set<object>(),
): unknown | typeof INVALID_SNAPSHOT {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) return value
  if (typeof value !== 'object' || ancestors.has(value)) {
    return INVALID_SNAPSHOT
  }
  try {
    const isArray = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_SNAPSHOT
    const output: unknown[] | Record<string, unknown> = isArray
      ? []
      : Object.create(null) as Record<string, unknown>
    ancestors.add(value)
    for (const key of keys) {
      if (isArray && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return INVALID_SNAPSHOT
      const child = plainDataSnapshot(descriptor.value, ancestors)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      Object.defineProperty(output, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: child,
      })
    }
    return output
  } catch {
    return INVALID_SNAPSHOT
  } finally {
    ancestors.delete(value)
  }
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
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
  UnsupportedBeneficiaryTraditionalIraMovementCandidateResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    reasons: [
      createActionReason('withdrawal-inherited-facts-missing'),
    ] as [ActionReason],
    movementCandidateId: null,
    characterization: null,
    deathPenaltyEvidence: null,
    candidate: null,
  })
}

/**
 * Stages one exact-source inherited-IRA debit as immutable candidate evidence.
 * It rebuilds character and death-penalty facts and never mutates a balance.
 */
export function stageBeneficiaryTraditionalIraMovementCandidate(
  input: Readonly<StageBeneficiaryTraditionalIraMovementCandidateInput>,
): Readonly<StageBeneficiaryTraditionalIraMovementCandidateResult> {
  try {
    const rawSnapshot = plainDataSnapshot(input)
    if (
      rawSnapshot === INVALID_SNAPSHOT ||
      !exactKeys(rawSnapshot, INPUT_KEYS)
    ) return unsupported()
    const snapshot = rawSnapshot as unknown as
      StageBeneficiaryTraditionalIraMovementCandidateInput
    if (!Array.isArray(snapshot.sourceSnapshots) || snapshot.sourceSnapshots.length !== 1) {
      return unsupported()
    }
    const rawSource = snapshot.sourceSnapshots[0]
    if (!exactKeys(rawSource, SOURCE_KEYS)) return unsupported()
    const source = rawSource as unknown as
      BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence

    const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(
      snapshot.penaltyInput,
    )
    if (penalty.status !== 'accepted') return unsupported()
    const characterized = penalty.characterization.acceptedSourceEligibility
    const deathPenalty = penalty.penaltyEvidence
    const basis = characterized.basisEvidence
    const rmd = characterized.rmdEvidence
    const currentAnnualAllocation =
      basis.annualDistributionBasisAllocation.allocations.find(
        (allocation) =>
          allocation.actionId === deathPenalty.actionId &&
          allocation.allocationId === deathPenalty.allocationId,
      )
    const basisPoolEvidenceId =
      snapshot.penaltyInput.characterizationInput.basisPoolEvidence?.evidenceId

    const actionId = actionIdSchema.safeParse(source.actionId)
    const allocationId = allocationIdSchema.safeParse(source.allocationId)
    const sourceAccountId = accountIdSchema.safeParse(source.sourceAccountId)
    const beneficiaryPersonId = personIdSchema.safeParse(
      source.beneficiaryPersonId,
    )
    const decedentPersonId = personIdSchema.safeParse(source.decedentPersonId)
    const requestedAmount = positiveUsdCentsSchema.safeParse(
      source.requestedAmount,
    )
    const executedAmount = positiveUsdCentsSchema.safeParse(
      source.executedAmount,
    )
    const openingBalanceAmount = usdCentsSchema.safeParse(
      source.openingBalanceAmount,
    )
    const closingBalanceAmount = usdCentsSchema.safeParse(
      source.closingBalanceAmount,
    )
    const rmdRequiredAmount = usdCentsSchema.safeParse(source.rmdRequiredAmount)
    const rmdSatisfiedBeforeExecution = usdCentsSchema.safeParse(
      source.rmdSatisfiedBeforeExecution,
    )
    const rmdRemainingBeforeExecution = usdCentsSchema.safeParse(
      source.rmdRemainingBeforeExecution,
    )
    const ids = [
      source.inheritanceEvidenceId,
      source.basisEvidenceId,
      source.sourceCharacterEvidenceId,
      source.penaltyEvidenceId,
      source.rmdPoolId,
      source.rmdEvidenceId,
      source.physicalSourceEvidenceId,
    ]
    if (
      source.predicate !==
        'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal' ||
      !actionId.success ||
      !allocationId.success ||
      !sourceAccountId.success ||
      !beneficiaryPersonId.success ||
      !decedentPersonId.success ||
      !requestedAmount.success ||
      !executedAmount.success ||
      !openingBalanceAmount.success ||
      !closingBalanceAmount.success ||
      !rmdRequiredAmount.success ||
      !rmdSatisfiedBeforeExecution.success ||
      !rmdRemainingBeforeExecution.success ||
      currentAnnualAllocation === undefined ||
      !nonblank(basisPoolEvidenceId) ||
      !Number.isSafeInteger(source.executionSequence) ||
      source.executionSequence < 1 ||
      source.executionSequence !== currentAnnualAllocation.scheduledSequence ||
      ids.some((id) => !nonblank(id)) ||
      actionId.data !== deathPenalty.actionId ||
      allocationId.data !== deathPenalty.allocationId ||
      sourceAccountId.data !== deathPenalty.sourceAccountId ||
      beneficiaryPersonId.data !== deathPenalty.beneficiaryPersonId ||
      decedentPersonId.data !== deathPenalty.decedentPersonId ||
      source.evaluationDate !== deathPenalty.evaluationDate ||
      requestedAmount.data !== executedAmount.data ||
      executedAmount.data !== deathPenalty.executedAmount ||
      executedAmount.data > openingBalanceAmount.data ||
      closingBalanceAmount.data !==
        openingBalanceAmount.data - executedAmount.data ||
      source.inheritanceEvidenceId !==
        characterized.inheritanceEvidenceId ||
      source.basisEvidenceId !== basis.evidenceId ||
      source.sourceCharacterEvidenceId !==
        deathPenalty.sourceCharacterEvidenceId ||
      source.penaltyEvidenceId !== deathPenalty.penaltyEvidenceId ||
      source.rmdPoolId !== rmd.poolId ||
      source.rmdEvidenceId !== rmd.evidenceId ||
      rmdRequiredAmount.data !== rmd.requiredAmount ||
      rmdSatisfiedBeforeExecution.data !== rmd.satisfiedBeforeExecution ||
      rmdRemainingBeforeExecution.data !== rmd.remainingBeforeExecution
    ) return unsupported()

    const authorityIds = [
      characterized.inheritanceEvidenceId,
      basisPoolEvidenceId,
      basis.evidenceId,
      basis.annualDistributionBasisAllocation.allocationEvidenceId,
      rmd.evidenceId,
      deathPenalty.sourceCharacterEvidenceId,
      deathPenalty.penaltyEvidenceId,
      ...deathPenalty.characterBindings.map(
        (binding) => binding.characterEvidenceId,
      ),
      source.physicalSourceEvidenceId,
    ]
    if (new Set(authorityIds).size !== authorityIds.length) {
      return unsupported()
    }

    const sourceDebit: BeneficiaryTraditionalIraSourceDebitEvidence = {
      kind: 'beneficiaryTraditionalIraSourceDebit',
      actionId: actionId.data,
      allocationId: allocationId.data,
      sourceAccountId: sourceAccountId.data,
      beneficiaryPersonId: beneficiaryPersonId.data,
      decedentPersonId: decedentPersonId.data,
      executionDate: deathPenalty.evaluationDate,
      executionSequence: source.executionSequence,
      debitAmount: executedAmount.data,
      balanceBefore: openingBalanceAmount.data,
      balanceAfter: closingBalanceAmount.data,
      physicalSourceEvidenceId: source.physicalSourceEvidenceId,
    }
    const candidate: BeneficiaryTraditionalIraMovementCandidateEvidence = {
      actionId: actionId.data,
      allocationId: allocationId.data,
      sourceAccountId: sourceAccountId.data,
      beneficiaryPersonId: beneficiaryPersonId.data,
      decedentPersonId: decedentPersonId.data,
      executionDate: deathPenalty.evaluationDate,
      executionSequence: source.executionSequence,
      requestedAmount: requestedAmount.data,
      executedAmount: executedAmount.data,
      unexecutedAmount: 0,
      openingBalanceAmount: openingBalanceAmount.data,
      candidateClosingBalanceAmount: closingBalanceAmount.data,
      sourceDebit,
      destinationCredits: [],
      inheritanceEvidenceId: source.inheritanceEvidenceId,
      basisEvidenceId: source.basisEvidenceId,
      sourceCharacterEvidenceId: source.sourceCharacterEvidenceId,
      penaltyEvidenceId: source.penaltyEvidenceId,
      rmdPoolId: source.rmdPoolId,
      rmdEvidenceId: source.rmdEvidenceId,
      rmdRequiredAmount: rmdRequiredAmount.data,
      rmdSatisfiedBeforeExecution: rmdSatisfiedBeforeExecution.data,
      rmdRemainingBeforeExecution: rmdRemainingBeforeExecution.data,
      physicalSourceEvidenceId: source.physicalSourceEvidenceId,
    }
    const movementCandidateId = deriveActionStructuralId(
      'beneficiary-ira-movement-candidate',
      [candidate, penalty.penaltyEvidence],
    )
    if (authorityIds.includes(movementCandidateId)) return unsupported()

    return deepFreeze({
      status: 'movementCandidateStaged',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      movementCandidateId,
      characterization: penalty.characterization,
      deathPenaltyEvidence: penalty.penaltyEvidence,
      candidate,
    })
  } catch {
    return unsupported()
  }
}
