import {
  coordinateBeneficiaryTraditionalIraAnnualRuntime,
  type BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult,
  type CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput,
} from './beneficiaryTraditionalIraAnnualRuntimeCoordinator.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import { asUsdCents, type PositiveUsdCents, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, exactKeys, nonblank, plainDataSnapshot } from './plainData.js'

export interface PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput {
  runtimeInput: Readonly<CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput>
}

export interface BeneficiaryTraditionalIraDetachedPhysicalApplication {
  predicate: 'beneficiaryTraditionalIraDetachedPhysicalApplication'
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executionDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: PositiveUsdCents
  sourceBalanceBefore: UsdCents
  sourceBalanceAfter: UsdCents
  rmdSatisfiedBefore: UsdCents
  rmdSatisfiedByApplication: UsdCents
  rmdSatisfiedAfter: UsdCents
  rmdRemainingAfter: UsdCents
  physicalSourceEvidenceId: string
  movementCandidateId: string
  finalMemberEvidenceId: string
  finalAnnualEvidenceId: string
  coordinatorEvidenceId: string
  applicationEvidenceId: string
}

export interface BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  predicate: 'beneficiaryTraditionalIraDetachedSourceBalanceTransition'
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  sourceAccountId: AccountId
  annualOpeningBalanceAmount: UsdCents
  totalExecutedAmount: UsdCents
  annualFinalBalanceAmount: UsdCents
  applicationEvidenceIds: readonly string[]
  finalAnnualEvidenceId: string
  coordinatorEvidenceId: string
  transitionEvidenceId: string
}

export interface BeneficiaryTraditionalIraDetachedRmdTransition {
  predicate: 'beneficiaryTraditionalIraDetachedRmdTransition'
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  rmdPoolId: string
  rmdRequiredAmount: UsdCents
  initialRmdSatisfiedAmount: UsdCents
  rmdSatisfiedByTransaction: UsdCents
  finalRmdSatisfiedAmount: UsdCents
  finalRmdRemainingAmount: UsdCents
  applicationEvidenceIds: readonly string[]
  finalAnnualEvidenceId: string
  coordinatorEvidenceId: string
  transitionEvidenceId: string
}

export interface BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult {
  status: 'annualPhysicalTransactionPrepared'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  transactionStatus: 'appliedToDetachedSnapshotOnly'
  reasons: readonly []
  runtimeEvidence:
    Readonly<BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult>
  applications:
    readonly Readonly<BeneficiaryTraditionalIraDetachedPhysicalApplication>[]
  sourceBalanceTransitions:
    readonly Readonly<BeneficiaryTraditionalIraDetachedSourceBalanceTransition>[]
  rmdTransition: Readonly<BeneficiaryTraditionalIraDetachedRmdTransition>
  transactionEvidenceId: string
}

export interface UnsupportedBeneficiaryTraditionalIraAnnualPhysicalTransactionResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  transactionStatus: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  runtimeEvidence: null
  applications: readonly []
  sourceBalanceTransitions: readonly []
  rmdTransition: null
  transactionEvidenceId: null
}

export type PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionResult =
  | BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult
  | UnsupportedBeneficiaryTraditionalIraAnnualPhysicalTransactionResult

const INPUT_KEYS = ['runtimeInput'] as const

function unsupported(): Readonly<
  UnsupportedBeneficiaryTraditionalIraAnnualPhysicalTransactionResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    runtimeEvidence: null,
    applications: [],
    sourceBalanceTransitions: [],
    rmdTransition: null,
    transactionEvidenceId: null,
  })
}

function identifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return result
  }
  seen.add(value)
  for (const [childKey, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const item of child) {
        if (typeof item === 'string') result.add(item)
      }
    }
    identifierValues(child, childKey, result, seen)
  }
  return result
}

function claimDerived(claimed: Set<string>, value: string): boolean {
  if (!nonblank(value) || claimed.has(value)) return false
  claimed.add(value)
  return true
}

function memberCompare(
  left: BeneficiaryTraditionalIraDetachedPhysicalApplication,
  right: BeneficiaryTraditionalIraDetachedPhysicalApplication,
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}

function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput>,
): Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionResult> {
  const raw = plainDataSnapshot(input)
  if (
    raw === INVALID_SNAPSHOT || raw === null || Array.isArray(raw) ||
    typeof raw !== 'object' || !exactKeys(raw, INPUT_KEYS)
  ) return unsupported()
  const snapshot = raw as unknown as
    PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput
  const runtime = coordinateBeneficiaryTraditionalIraAnnualRuntime(
    snapshot.runtimeInput,
  )
  if (runtime.status !== 'annualRuntimeEvidenceCoordinated') {
    return unsupported()
  }
  const annual = runtime.annualEvidence
  const binding = runtime.inventoryBinding
  const attestation = snapshot.runtimeInput.attestation
  const claimed = identifierValues(snapshot)
  identifierValues(runtime, '', claimed)

  const applications: BeneficiaryTraditionalIraDetachedPhysicalApplication[] = []
  for (const member of annual.canonicalMembers) {
    const candidate = member.candidate
    const rmdSatisfiedByApplication = asUsdCents(Math.min(
      candidate.executedAmount,
      candidate.rmdRemainingBeforeExecution,
    ))
    const rmdSatisfiedAfter = asUsdCents(
      candidate.rmdSatisfiedBeforeExecution + rmdSatisfiedByApplication,
    )
    const rmdRemainingAfter = asUsdCents(
      candidate.rmdRemainingBeforeExecution - rmdSatisfiedByApplication,
    )
    const applicationWithoutId = {
      predicate: 'beneficiaryTraditionalIraDetachedPhysicalApplication' as const,
      beneficiaryPersonId: annual.beneficiaryPersonId,
      decedentPersonId: annual.decedentPersonId,
      taxYear: annual.taxYear,
      actionId: candidate.actionId,
      allocationId: candidate.allocationId,
      sourceAccountId: candidate.sourceAccountId,
      executionDate: candidate.executionDate,
      executionSequence: candidate.executionSequence,
      requestedAmount: candidate.requestedAmount,
      executedAmount: candidate.executedAmount,
      sourceBalanceBefore: candidate.openingBalanceAmount,
      sourceBalanceAfter: candidate.candidateClosingBalanceAmount,
      rmdSatisfiedBefore: candidate.rmdSatisfiedBeforeExecution,
      rmdSatisfiedByApplication,
      rmdSatisfiedAfter,
      rmdRemainingAfter,
      physicalSourceEvidenceId: candidate.physicalSourceEvidenceId,
      movementCandidateId: member.movementCandidateId,
      finalMemberEvidenceId: member.finalMemberEvidenceId,
      finalAnnualEvidenceId: annual.finalAnnualEvidenceId,
      coordinatorEvidenceId: binding.coordinatorEvidenceId,
    }
    const applicationEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-detached-physical-application',
      [applicationWithoutId],
    )
    if (!claimDerived(claimed, applicationEvidenceId)) return unsupported()
    applications.push({ ...applicationWithoutId, applicationEvidenceId })
  }
  applications.sort(memberCompare)

  const sourceBalanceTransitions:
    BeneficiaryTraditionalIraDetachedSourceBalanceTransition[] = []
  const sourceIds = [...attestation.sourceAccountIds]
    .sort(compareUtf16CodeUnits)
  for (const sourceAccountId of sourceIds) {
    const balance = attestation.sourceBalances.find(
      (entry) => entry.sourceAccountId === sourceAccountId,
    )
    if (balance === undefined) return unsupported()
    const sourceApplications = applications.filter(
      (entry) => entry.sourceAccountId === sourceAccountId,
    )
    const total = sourceApplications.reduce(
      (sum, entry) => sum + entry.executedAmount,
      0,
    )
    if (
      !Number.isSafeInteger(total) || total < 0 ||
      balance.annualOpeningBalanceAmount - total !==
        balance.annualFinalBalanceAmount
    ) return unsupported()
    const transitionWithoutId = {
      predicate:
        'beneficiaryTraditionalIraDetachedSourceBalanceTransition' as const,
      beneficiaryPersonId: annual.beneficiaryPersonId,
      decedentPersonId: annual.decedentPersonId,
      taxYear: annual.taxYear,
      sourceAccountId,
      annualOpeningBalanceAmount: balance.annualOpeningBalanceAmount,
      totalExecutedAmount: asUsdCents(total),
      annualFinalBalanceAmount: balance.annualFinalBalanceAmount,
      applicationEvidenceIds: sourceApplications.map(
        (entry) => entry.applicationEvidenceId,
      ),
      finalAnnualEvidenceId: annual.finalAnnualEvidenceId,
      coordinatorEvidenceId: binding.coordinatorEvidenceId,
    }
    const transitionEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-detached-source-balance-transition',
      [transitionWithoutId],
    )
    if (!claimDerived(claimed, transitionEvidenceId)) return unsupported()
    sourceBalanceTransitions.push({
      ...transitionWithoutId,
      transitionEvidenceId,
    })
  }

  const rmdSatisfiedByTransaction =
    annual.finalRmdSatisfiedAmount - annual.initialRmdSatisfiedAmount
  if (!Number.isSafeInteger(rmdSatisfiedByTransaction) || rmdSatisfiedByTransaction < 0) {
    return unsupported()
  }
  const rmdWithoutId = {
    predicate: 'beneficiaryTraditionalIraDetachedRmdTransition' as const,
    beneficiaryPersonId: annual.beneficiaryPersonId,
    decedentPersonId: annual.decedentPersonId,
    taxYear: annual.taxYear,
    rmdPoolId: annual.rmdPoolId,
    rmdRequiredAmount: annual.rmdRequiredAmount,
    initialRmdSatisfiedAmount: annual.initialRmdSatisfiedAmount,
    rmdSatisfiedByTransaction: asUsdCents(rmdSatisfiedByTransaction),
    finalRmdSatisfiedAmount: annual.finalRmdSatisfiedAmount,
    finalRmdRemainingAmount: annual.finalRmdRemainingAmount,
    applicationEvidenceIds: applications.map(
      (entry) => entry.applicationEvidenceId,
    ),
    finalAnnualEvidenceId: annual.finalAnnualEvidenceId,
    coordinatorEvidenceId: binding.coordinatorEvidenceId,
  }
  const rmdTransitionEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-detached-rmd-transition',
    [rmdWithoutId],
  )
  if (!claimDerived(claimed, rmdTransitionEvidenceId)) return unsupported()
  const rmdTransition = {
    ...rmdWithoutId,
    transitionEvidenceId: rmdTransitionEvidenceId,
  }

  const transactionEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-detached-annual-physical-transaction',
    [[
      binding.inventoryEvidenceId,
      binding.upstreamInventoryEvidenceId,
      binding.coordinatorEvidenceId,
      annual.finalAnnualEvidenceId,
      applications.map((entry) => entry.applicationEvidenceId),
      sourceBalanceTransitions.map((entry) => entry.transitionEvidenceId),
      rmdTransition.transitionEvidenceId,
    ]],
  )
  if (!claimDerived(claimed, transactionEvidenceId)) return unsupported()
  return deepFreeze({
    status: 'annualPhysicalTransactionPrepared',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'appliedToDetachedSnapshotOnly',
    reasons: [],
    runtimeEvidence: runtime,
    applications,
    sourceBalanceTransitions,
    rmdTransition,
    transactionEvidenceId,
  })
}

/**
 * Rebuilds complete beneficiary/decedent annual runtime evidence and applies it
 * only to detached source/RMD snapshots. No Plan balance is mutated and no
 * movement or actionability authority is established.
 */
export function prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
  input: Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput>,
): Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
