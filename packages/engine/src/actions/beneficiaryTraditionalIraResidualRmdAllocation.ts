import type {
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  accountIdSchema,
  personIdSchema,
  type AccountId,
  type PersonId,
} from './identity.js'
import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

export interface PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput {
  readonly rmdTransition:
    Readonly<BeneficiaryTraditionalIraDetachedRmdTransition>
  readonly sourceBalanceTransitions:
    readonly Readonly<BeneficiaryTraditionalIraDetachedSourceBalanceTransition>[]
}

export interface BeneficiaryTraditionalIraResidualRmdSourceAllocation {
  readonly predicate:
    'beneficiaryTraditionalIraResidualRmdSourceAllocation'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly sourceAccountId: AccountId
  readonly sourceBalanceBefore: UsdCents
  readonly allocatedAmount: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly residualRmdBefore: UsdCents
  readonly residualRmdAfter: UsdCents
  readonly sourceBalanceTransitionEvidenceId: string
  readonly rmdTransitionEvidenceId: string
  readonly allocationEvidenceId: string
}

export interface BeneficiaryTraditionalIraResidualRmdAllocationPreparedResult {
  readonly status: 'residualRmdAllocationPrepared'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly allocationPolicy: 'stableAccountIdAscending'
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly taxYear: number
  readonly rmdPoolId: string
  readonly rmdRequiredAmount: UsdCents
  readonly rmdSatisfiedBeforeResidual: UsdCents
  readonly residualRmdRequiredAmount: UsdCents
  readonly residualRmdAllocatedAmount: UsdCents
  readonly rmdSatisfiedAfterResidual: UsdCents
  readonly residualRmdUnallocatedAmount: UsdCents
  readonly residualRequirementSatisfied: boolean
  readonly sourceAllocations:
    readonly Readonly<BeneficiaryTraditionalIraResidualRmdSourceAllocation>[]
  readonly sourceBalanceTransitionEvidenceIds: readonly string[]
  readonly rmdTransitionEvidenceId: string
  readonly allocationEvidenceId: string
}

export interface UnsupportedBeneficiaryTraditionalIraResidualRmdAllocationResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly [Readonly<ActionReason>]
  readonly sourceAllocations: readonly []
  readonly allocationEvidenceId: null
}

export type PrepareBeneficiaryTraditionalIraResidualRmdAllocationResult =
  | BeneficiaryTraditionalIraResidualRmdAllocationPreparedResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdAllocationResult

const INPUT_KEYS = [
  'rmdTransition',
  'sourceBalanceTransitions',
] as const
const RMD_KEYS = [
  'predicate',
  'beneficiaryPersonId',
  'decedentPersonId',
  'taxYear',
  'rmdPoolId',
  'rmdRequiredAmount',
  'initialRmdSatisfiedAmount',
  'rmdSatisfiedByTransaction',
  'finalRmdSatisfiedAmount',
  'finalRmdRemainingAmount',
  'applicationEvidenceIds',
  'finalAnnualEvidenceId',
  'coordinatorEvidenceId',
  'transitionEvidenceId',
] as const
const SOURCE_KEYS = [
  'predicate',
  'beneficiaryPersonId',
  'decedentPersonId',
  'taxYear',
  'sourceAccountId',
  'annualOpeningBalanceAmount',
  'totalExecutedAmount',
  'annualFinalBalanceAmount',
  'applicationEvidenceIds',
  'finalAnnualEvidenceId',
  'coordinatorEvidenceId',
  'transitionEvidenceId',
] as const
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

function uniqueNonblank(values: readonly unknown[]): values is readonly string[] {
  return values.every(nonblank) && new Set(values).size === values.length
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
  UnsupportedBeneficiaryTraditionalIraResidualRmdAllocationResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    sourceAllocations: [],
    allocationEvidenceId: null,
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

function identityRoles(
  rmd: BeneficiaryTraditionalIraDetachedRmdTransition,
  sources: readonly BeneficiaryTraditionalIraDetachedSourceBalanceTransition[],
): Map<string, string> | null {
  const registry = new Map<string, string>()
  const claims: readonly (readonly [string, string])[] = [
    [rmd.beneficiaryPersonId, 'beneficiaryPerson'],
    [rmd.decedentPersonId, 'decedentPerson'],
    [rmd.rmdPoolId, 'rmdPool'],
    [rmd.finalAnnualEvidenceId, 'finalAnnualEvidence'],
    [rmd.coordinatorEvidenceId, 'coordinatorEvidence'],
    [rmd.transitionEvidenceId, 'rmdTransitionEvidence'],
    ...rmd.applicationEvidenceIds.map(
      (value) => [value, 'physicalApplicationEvidence'] as const,
    ),
    ...sources.flatMap((source) => [
      [source.beneficiaryPersonId, 'beneficiaryPerson'] as const,
      [source.decedentPersonId, 'decedentPerson'] as const,
      [source.sourceAccountId, 'sourceAccount'] as const,
      [source.finalAnnualEvidenceId, 'finalAnnualEvidence'] as const,
      [source.coordinatorEvidenceId, 'coordinatorEvidence'] as const,
      [source.transitionEvidenceId, 'sourceTransitionEvidence'] as const,
      ...source.applicationEvidenceIds.map(
        (value) => [value, 'physicalApplicationEvidence'] as const,
      ),
    ]),
  ]
  for (const [value, role] of claims) {
    if (!claimRole(registry, value, role)) return null
  }
  return registry
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort(compareUtf16CodeUnits)
  const sortedRight = [...right].sort(compareUtf16CodeUnits)
  return sortedLeft.every((value, index) => value === sortedRight[index])
}

function exactRmdTransitionEvidenceId(
  rmd: BeneficiaryTraditionalIraDetachedRmdTransition,
): string {
  const transitionWithoutId = {
    predicate: rmd.predicate,
    beneficiaryPersonId: rmd.beneficiaryPersonId,
    decedentPersonId: rmd.decedentPersonId,
    taxYear: rmd.taxYear,
    rmdPoolId: rmd.rmdPoolId,
    rmdRequiredAmount: rmd.rmdRequiredAmount,
    initialRmdSatisfiedAmount: rmd.initialRmdSatisfiedAmount,
    rmdSatisfiedByTransaction: rmd.rmdSatisfiedByTransaction,
    finalRmdSatisfiedAmount: rmd.finalRmdSatisfiedAmount,
    finalRmdRemainingAmount: rmd.finalRmdRemainingAmount,
    applicationEvidenceIds: rmd.applicationEvidenceIds,
    finalAnnualEvidenceId: rmd.finalAnnualEvidenceId,
    coordinatorEvidenceId: rmd.coordinatorEvidenceId,
  }
  return deriveActionStructuralId(
    'beneficiary-ira-detached-rmd-transition',
    [transitionWithoutId],
  )
}

function exactSourceTransitionEvidenceId(
  source: BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
): string {
  const transitionWithoutId = {
    predicate: source.predicate,
    beneficiaryPersonId: source.beneficiaryPersonId,
    decedentPersonId: source.decedentPersonId,
    taxYear: source.taxYear,
    sourceAccountId: source.sourceAccountId,
    annualOpeningBalanceAmount: source.annualOpeningBalanceAmount,
    totalExecutedAmount: source.totalExecutedAmount,
    annualFinalBalanceAmount: source.annualFinalBalanceAmount,
    applicationEvidenceIds: source.applicationEvidenceIds,
    finalAnnualEvidenceId: source.finalAnnualEvidenceId,
    coordinatorEvidenceId: source.coordinatorEvidenceId,
  }
  return deriveActionStructuralId(
    'beneficiary-ira-detached-source-balance-transition',
    [transitionWithoutId],
  )
}

function validRmd(
  value: unknown,
): value is BeneficiaryTraditionalIraDetachedRmdTransition {
  if (!exactRecord(value, RMD_KEYS)) return false
  const rmd = value as unknown as BeneficiaryTraditionalIraDetachedRmdTransition
  return rmd.predicate === 'beneficiaryTraditionalIraDetachedRmdTransition' &&
    personIdSchema.safeParse(rmd.beneficiaryPersonId).success &&
    personIdSchema.safeParse(rmd.decedentPersonId).success &&
    rmd.beneficiaryPersonId !== rmd.decedentPersonId &&
    Number.isSafeInteger(rmd.taxYear) && rmd.taxYear >= 1 &&
    rmd.taxYear <= 9999 && nonblank(rmd.rmdPoolId) &&
    usdCentsSchema.safeParse(rmd.rmdRequiredAmount).success &&
    usdCentsSchema.safeParse(rmd.initialRmdSatisfiedAmount).success &&
    usdCentsSchema.safeParse(rmd.rmdSatisfiedByTransaction).success &&
    usdCentsSchema.safeParse(rmd.finalRmdSatisfiedAmount).success &&
    usdCentsSchema.safeParse(rmd.finalRmdRemainingAmount).success &&
    Array.isArray(rmd.applicationEvidenceIds) &&
    uniqueNonblank(rmd.applicationEvidenceIds) &&
    nonblank(rmd.finalAnnualEvidenceId) &&
    nonblank(rmd.coordinatorEvidenceId) &&
    nonblank(rmd.transitionEvidenceId) &&
    rmd.initialRmdSatisfiedAmount + rmd.rmdSatisfiedByTransaction ===
      rmd.finalRmdSatisfiedAmount &&
    rmd.finalRmdSatisfiedAmount + rmd.finalRmdRemainingAmount ===
      rmd.rmdRequiredAmount &&
    rmd.transitionEvidenceId === exactRmdTransitionEvidenceId(rmd)
}

function validSource(
  value: unknown,
  rmd: BeneficiaryTraditionalIraDetachedRmdTransition,
): value is BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  if (!exactRecord(value, SOURCE_KEYS)) return false
  const source =
    value as unknown as BeneficiaryTraditionalIraDetachedSourceBalanceTransition
  return source.predicate ===
      'beneficiaryTraditionalIraDetachedSourceBalanceTransition' &&
    source.beneficiaryPersonId === rmd.beneficiaryPersonId &&
    source.decedentPersonId === rmd.decedentPersonId &&
    source.taxYear === rmd.taxYear &&
    accountIdSchema.safeParse(source.sourceAccountId).success &&
    usdCentsSchema.safeParse(source.annualOpeningBalanceAmount).success &&
    usdCentsSchema.safeParse(source.totalExecutedAmount).success &&
    usdCentsSchema.safeParse(source.annualFinalBalanceAmount).success &&
    source.annualOpeningBalanceAmount - source.totalExecutedAmount ===
      source.annualFinalBalanceAmount &&
    Array.isArray(source.applicationEvidenceIds) &&
    uniqueNonblank(source.applicationEvidenceIds) &&
    source.finalAnnualEvidenceId === rmd.finalAnnualEvidenceId &&
    source.coordinatorEvidenceId === rmd.coordinatorEvidenceId &&
    nonblank(source.transitionEvidenceId) &&
    source.transitionEvidenceId === exactSourceTransitionEvidenceId(source)
}

function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationResult> {
  const raw = plainDataSnapshot(input)
  if (
    !exactRecord(raw, INPUT_KEYS) ||
    !validRmd(raw.rmdTransition) ||
    !Array.isArray(raw.sourceBalanceTransitions) ||
    raw.sourceBalanceTransitions.length === 0
  ) return unsupported()
  const rmd = raw.rmdTransition
  if (
    raw.sourceBalanceTransitions.some((source) => !validSource(source, rmd))
  ) return unsupported()
  const sources = raw.sourceBalanceTransitions as unknown as
    BeneficiaryTraditionalIraDetachedSourceBalanceTransition[]
  if (
    new Set(sources.map((source) => source.sourceAccountId)).size !==
      sources.length ||
    new Set(sources.map((source) => source.transitionEvidenceId)).size !==
      sources.length ||
    !sameMembers(
      rmd.applicationEvidenceIds,
      sources.flatMap((source) => source.applicationEvidenceIds),
    )
  ) return unsupported()

  const claimed = identityRoles(rmd, sources)
  if (claimed === null) return unsupported()
  let remaining = rmd.finalRmdRemainingAmount
  const sourceAllocations:
    BeneficiaryTraditionalIraResidualRmdSourceAllocation[] = []
  for (const source of [...sources].sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))) {
    if (remaining === 0) break
    const allocatedAmount = asUsdCents(Math.min(
      source.annualFinalBalanceAmount,
      remaining,
    ))
    if (allocatedAmount === 0) continue
    const sourceBalanceAfter = asUsdCents(
      source.annualFinalBalanceAmount - allocatedAmount,
    )
    const residualRmdAfter = asUsdCents(remaining - allocatedAmount)
    const allocationWithoutId = {
      predicate:
        'beneficiaryTraditionalIraResidualRmdSourceAllocation' as const,
      beneficiaryPersonId: rmd.beneficiaryPersonId,
      decedentPersonId: rmd.decedentPersonId,
      taxYear: rmd.taxYear,
      rmdPoolId: rmd.rmdPoolId,
      sourceAccountId: source.sourceAccountId,
      sourceBalanceBefore: source.annualFinalBalanceAmount,
      allocatedAmount,
      sourceBalanceAfter,
      residualRmdBefore: remaining,
      residualRmdAfter,
      sourceBalanceTransitionEvidenceId: source.transitionEvidenceId,
      rmdTransitionEvidenceId: rmd.transitionEvidenceId,
    }
    const allocationEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-source-allocation',
      [allocationWithoutId],
    )
    if (
      !nonblank(allocationEvidenceId) ||
      !claimRole(
        claimed,
        allocationEvidenceId,
        `derivedSourceAllocation:${source.sourceAccountId}`,
      )
    ) {
      return unsupported()
    }
    sourceAllocations.push({
      ...allocationWithoutId,
      allocationEvidenceId,
    })
    remaining = residualRmdAfter
  }

  const residualRmdAllocatedAmount = asUsdCents(
    rmd.finalRmdRemainingAmount - remaining,
  )
  const rmdSatisfiedAfterResidual = asUsdCents(
    rmd.finalRmdSatisfiedAmount + residualRmdAllocatedAmount,
  )
  const resultWithoutId = {
    status: 'residualRmdAllocationPrepared' as const,
    movement: 'notCommitted' as const,
    committed: false as const,
    actionability: 'notEstablished' as const,
    allocationPolicy: 'stableAccountIdAscending' as const,
    beneficiaryPersonId: rmd.beneficiaryPersonId,
    decedentPersonId: rmd.decedentPersonId,
    taxYear: rmd.taxYear,
    rmdPoolId: rmd.rmdPoolId,
    rmdRequiredAmount: rmd.rmdRequiredAmount,
    rmdSatisfiedBeforeResidual: rmd.finalRmdSatisfiedAmount,
    residualRmdRequiredAmount: rmd.finalRmdRemainingAmount,
    residualRmdAllocatedAmount,
    rmdSatisfiedAfterResidual,
    residualRmdUnallocatedAmount: remaining,
    residualRequirementSatisfied: remaining === 0,
    sourceAllocations,
    sourceBalanceTransitionEvidenceIds: [...sources]
      .sort((left, right) =>
        compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
      .map((source) => source.transitionEvidenceId),
    rmdTransitionEvidenceId: rmd.transitionEvidenceId,
  }
  const allocationEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-allocation',
    [resultWithoutId],
  )
  if (
    !nonblank(allocationEvidenceId) ||
    !claimRole(claimed, allocationEvidenceId, 'derivedResidualAllocation')
  ) {
    return unsupported()
  }
  return deepFreeze({
    ...resultWithoutId,
    allocationEvidenceId,
  })
}

/**
 * Allocates only the inherited-RMD remainder left after identity-bearing
 * beneficiary actions. Sources are selected by stable account ID, never by
 * Plan array order. The result is detached evidence and commits no movement.
 */
export function prepareBeneficiaryTraditionalIraResidualRmdAllocation(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAllocationResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
