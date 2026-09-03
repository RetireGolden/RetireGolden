import { planSchema, type Plan } from '../model/plan.js'
import type { OrdinaryWithdrawalRequest } from './contract.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction,
  type BeneficiaryTraditionalIraNoResidualRmdPhysicalTransactionResult,
  type BeneficiaryTraditionalIraResidualRmdDetachedApplication,
  type BeneficiaryTraditionalIraResidualRmdPhysicalTransactionPreparedResult,
  type PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput,
} from './beneficiaryTraditionalIraResidualRmdPhysicalTransaction.js'
import type { AccountId, ActionId, AllocationId } from './identity.js'
import { positiveUsdCentsSchema, type PositiveUsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  allocateRetirementActionCandidateIdentity,
} from './retirementActionCandidateIdentityAllocator.js'
import { deriveActionStructuralId } from './structuralId.js'
import { exactKeys, plainDataSnapshot } from './plainData.js'

export interface PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput {
  readonly plan: unknown
  readonly planSnapshotEvidenceId: string
  readonly physicalTransactionInput:
    Readonly<PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput>
}

export interface BeneficiaryTraditionalIraResidualRmdApplicationIdentityBinding {
  readonly predicate:
    'beneficiaryTraditionalIraResidualRmdApplicationIdentityBinding'
  readonly sourceAccountId: AccountId
  readonly applicationEvidenceId: string
  readonly transactionEvidenceId: string
  readonly actionId: ActionId
  readonly allocationId: AllocationId
  readonly executedAmount: PositiveUsdCents
  readonly bindingEvidenceId: string
}

export interface BeneficiaryTraditionalIraResidualRmdActionIdentityPreparedResult {
  readonly status: 'residualRmdActionIdentityPrepared'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly []
  readonly request: Readonly<OrdinaryWithdrawalRequest>
  readonly physicalTransaction:
    Readonly<BeneficiaryTraditionalIraResidualRmdPhysicalTransactionPreparedResult>
  readonly applicationBindings:
    readonly Readonly<BeneficiaryTraditionalIraResidualRmdApplicationIdentityBinding>[]
  readonly identityEvidenceId: string
}

export interface BeneficiaryTraditionalIraNoResidualRmdActionIdentityResult {
  readonly status: 'noResidualRmdActionIdentity'
  readonly noIdentityReason: 'requirementAlreadySatisfied' | 'noSourceCapacity'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly []
  readonly request: null
  readonly physicalTransaction:
    Readonly<BeneficiaryTraditionalIraNoResidualRmdPhysicalTransactionResult>
  readonly applicationBindings: readonly []
  readonly identityEvidenceId: null
}

export interface UnsupportedBeneficiaryTraditionalIraResidualRmdActionIdentityResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly [Readonly<ActionReason>]
  readonly request: null
  readonly physicalTransaction: null
  readonly applicationBindings: readonly []
  readonly identityEvidenceId: null
}

export type PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityResult =
  | BeneficiaryTraditionalIraResidualRmdActionIdentityPreparedResult
  | BeneficiaryTraditionalIraNoResidualRmdActionIdentityResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdActionIdentityResult

const INPUT_KEYS = [
  'plan', 'planSnapshotEvidenceId', 'physicalTransactionInput',
] as const

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function freeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function identifiers(value: unknown, key = '', result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object') return result
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const id of child) if (typeof id === 'string') result.add(id)
    }
    identifiers(child, childKey, result)
  }
  return result
}

function unsupported(): Readonly<UnsupportedBeneficiaryTraditionalIraResidualRmdActionIdentityResult> {
  return freeze({
    status: 'unsupported', movement: 'notCommitted', committed: false,
    actionability: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    request: null, physicalTransaction: null, applicationBindings: [],
    identityEvidenceId: null,
  })
}

function provenSources(
  plan: Readonly<Plan>,
  applications: readonly Readonly<BeneficiaryTraditionalIraResidualRmdDetachedApplication>[],
): boolean {
  if (applications.length === 0 ||
    plan.household.people.filter((person) =>
      person.id === applications[0]!.beneficiaryPersonId).length !== 1) return false
  return applications.every((application) => {
    const matches = plan.accounts.filter((account) =>
      account.id === application.sourceAccountId)
    const account = matches[0]
    return matches.length === 1 && account?.ownerPersonId ===
      application.beneficiaryPersonId && account.type === 'traditional' &&
      account.kind === 'ira' && account.inherited !== undefined
  })
}

function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityResult> {
  const raw = plainDataSnapshot(input)
  if (!exactKeys(raw, INPUT_KEYS) || !nonblank(raw.planSnapshotEvidenceId)) return unsupported()
  const parsed = planSchema.strict().safeParse(raw.plan)
  if (!parsed.success) return unsupported()
  const transaction = prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
    raw.physicalTransactionInput as Readonly<
      PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput
    >,
  )
  if (transaction.status === 'unsupported') return unsupported()
  if (transaction.status === 'noResidualRmdPhysicalTransaction') {
    return freeze({
      status: 'noResidualRmdActionIdentity',
      noIdentityReason: transaction.noTransactionReason,
      movement: 'notCommitted', committed: false,
      actionability: 'notEstablished', reasons: [], request: null,
      physicalTransaction: transaction, applicationBindings: [],
      identityEvidenceId: null,
    })
  }
  const applications = transaction.residualApplications
  if (!provenSources(parsed.data, applications)) return unsupported()
  const requestedAmount = positiveUsdCentsSchema.safeParse(
    transaction.residualRmdExecutedAmount,
  )
  if (!requestedAmount.success || applications.some((application) =>
    !positiveUsdCentsSchema.safeParse(application.executedAmount).success)) {
    return unsupported()
  }
  const first = applications[0]!
  if (applications.some((application) =>
    application.beneficiaryPersonId !== first.beneficiaryPersonId ||
    application.taxYear !== first.taxYear ||
    application.executionDate !== first.executionDate ||
    application.executionSequence !== first.executionSequence)) return unsupported()
  const allocated = allocateRetirementActionCandidateIdentity(parsed.data, {
    kind: 'ordinaryWithdrawal', year: first.taxYear,
    executionDate: first.executionDate,
    executionSequence: first.executionSequence,
    requestedAmount: requestedAmount.data,
    personId: first.beneficiaryPersonId,
    sourceAllocations: applications.map((application) => ({
      sourceAccountId: application.sourceAccountId,
      requestedAmount: positiveUsdCentsSchema.parse(application.executedAmount),
    })),
    purpose: { kind: 'other', referenceId: transaction.transactionEvidenceId },
    provenance: { source: 'generator', sourceId: transaction.transactionEvidenceId },
  })
  if (allocated.status !== 'allocated' ||
    allocated.request.kind !== 'ordinaryWithdrawal') return unsupported()

  const reserved = identifiers(parsed.data)
  reserved.add(raw.planSnapshotEvidenceId)
  identifiers(raw.physicalTransactionInput, '', reserved)
  identifiers(transaction, '', reserved)
  const generated = [allocated.request.actionId,
    ...allocated.request.allocations.map((allocation) => allocation.allocationId)]
  if (generated.some((id) => reserved.has(id)) ||
    new Set(generated).size !== generated.length) return unsupported()
  generated.forEach((id) => reserved.add(id))

  const allocationsBySource = new Map(allocated.request.allocations.map(
    (allocation) => [allocation.sourceAccountId, allocation] as const,
  ))
  if (allocationsBySource.size !== applications.length) return unsupported()
  const applicationBindings: BeneficiaryTraditionalIraResidualRmdApplicationIdentityBinding[] = []
  for (const application of applications) {
    const allocation = allocationsBySource.get(application.sourceAccountId)
    if (allocation === undefined ||
      allocation.requestedAmount !== application.executedAmount) return unsupported()
    const withoutId = {
      predicate: 'beneficiaryTraditionalIraResidualRmdApplicationIdentityBinding' as const,
      sourceAccountId: application.sourceAccountId,
      applicationEvidenceId: application.applicationEvidenceId,
      transactionEvidenceId: transaction.transactionEvidenceId,
      actionId: allocated.request.actionId,
      allocationId: allocation.allocationId,
      executedAmount: allocation.requestedAmount,
    }
    const bindingEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-application-identity-binding', [withoutId],
    )
    if (!nonblank(bindingEvidenceId) || reserved.has(bindingEvidenceId)) return unsupported()
    reserved.add(bindingEvidenceId)
    applicationBindings.push({ ...withoutId, bindingEvidenceId })
  }
  const identityEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-action-identity', [[
      raw.planSnapshotEvidenceId, transaction.transactionEvidenceId,
      allocated.request.actionId,
      applicationBindings.map((binding) => binding.bindingEvidenceId),
    ]],
  )
  if (!nonblank(identityEvidenceId) || reserved.has(identityEvidenceId)) return unsupported()
  return freeze({
    status: 'residualRmdActionIdentityPrepared', movement: 'notCommitted',
    committed: false, actionability: 'notEstablished', reasons: [],
    request: allocated.request, physicalTransaction: transaction,
    applicationBindings, identityEvidenceId,
  })
}

/** Allocates canonical action identity for rebuilt positive residual-RMD movement only. */
export function prepareBeneficiaryTraditionalIraResidualRmdActionIdentity(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
