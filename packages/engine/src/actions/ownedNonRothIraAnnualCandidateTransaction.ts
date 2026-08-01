import { planSchema } from '../model/plan.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type AnnualRetirementChronologyInvalidResult,
  type AnnualRetirementInventoryBuiltResult,
  type AnnualRetirementInventoryIncompleteResult,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type UnifiedAnnualLedgerCompatibility,
} from './annualRetirementPhysicalEventInventory.js'
import type { OrdinaryWithdrawalRequest } from './contract.js'
import type { AccountOpeningBalanceSnapshot } from './execution.js'
import {
  accountIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  asUsdCents,
  usdCentsSchema,
  type UsdCents,
} from './money.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementCandidateStagedResult,
  type OwnedNonRothIraMovementScheduleIssue,
  type OwnedNonRothIraMovementSourceEvidence,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

export interface PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput
  extends BuildAnnualRetirementPhysicalEventInventoryInput {
  ledgerRunId: string
  openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
}

export type PlanOwnedNonRothIraCandidateTransactionIssueKind =
  | 'ledgerRunMismatch'
  | 'openingBalanceInvalid'
  | 'openingBalanceDuplicate'
  | 'openingBalanceMissing'
  | 'openingBalanceForeign'
  | 'iraClassificationMissing'
  | 'identifierCollision'
  | 'stagedProceedsOverflow'

export interface PlanOwnedNonRothIraCandidateTransactionIssue {
  kind: PlanOwnedNonRothIraCandidateTransactionIssueKind
  detail: string
  sourceAccountId?: AccountId
}

interface ResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
  transactionStatus: 'notEstablished'
  transactionEvidenceId: null
}

export interface PlanOwnedNonRothIraCandidateTransactionUnifiedLedgerResult
  extends ResultBase {
  status: 'requiresUnifiedAnnualLedger'
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  compatibility: Readonly<UnifiedAnnualLedgerCompatibility>
  issues: readonly []
}

export interface PlanOwnedNonRothIraCandidateTransactionBlockedResult
  extends ResultBase {
  status: 'candidateTransactionBlocked'
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  issues: readonly [
    Readonly<PlanOwnedNonRothIraCandidateTransactionIssue>,
    ...Readonly<PlanOwnedNonRothIraCandidateTransactionIssue>[],
  ]
}

export interface PlanOwnedNonRothIraCandidateTransactionScheduleInvalidResult
  extends ResultBase {
  status: 'candidateTransactionScheduleInvalid'
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  scheduleIssues: readonly [
    Readonly<OwnedNonRothIraMovementScheduleIssue>,
    ...Readonly<OwnedNonRothIraMovementScheduleIssue>[],
  ]
  issues: readonly []
}

export interface PlanOwnedNonRothIraDetachedAllocationApplication {
  predicate: 'planOwnedNonRothIraDetachedCandidateAllocationApplication'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  movementCandidateId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  scheduledDate: string
  scheduledSequence: number
  requestedAmount: UsdCents
  balanceBefore: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  candidateBalanceAfter: UsdCents
  applicationEvidenceId: string
  upstreamEvidenceId: string
}

export interface PlanOwnedNonRothIraDetachedSourceBalanceTransition {
  predicate: 'planOwnedNonRothIraDetachedCandidateSourceBalanceTransition'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  movementCandidateId: string
  sourceAccountId: AccountId
  openingBalance: UsdCents
  requestedAmount: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  candidateClosingBalance: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface PlanOwnedNonRothIraAnnualCandidateTransactionPreparedResult {
  status: 'candidateTransactionPrepared'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  transactionStatus: 'appliedToDetachedSnapshotOnly'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  movementInput:
    Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>
  movementCandidate: Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  allocationApplications:
    readonly Readonly<PlanOwnedNonRothIraDetachedAllocationApplication>[]
  sourceBalanceTransitions:
    readonly Readonly<PlanOwnedNonRothIraDetachedSourceBalanceTransition>[]
  stagedProceeds: UsdCents
  transactionEvidenceId: string
  issues: readonly []
}

export type PreparePlanOwnedNonRothIraAnnualCandidateTransactionResult =
  | AnnualRetirementInventoryIncompleteResult
  | AnnualRetirementChronologyInvalidResult
  | PlanOwnedNonRothIraCandidateTransactionUnifiedLedgerResult
  | PlanOwnedNonRothIraCandidateTransactionBlockedResult
  | PlanOwnedNonRothIraCandidateTransactionScheduleInvalidResult
  | PlanOwnedNonRothIraAnnualCandidateTransactionPreparedResult

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function blocked(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  issues: readonly PlanOwnedNonRothIraCandidateTransactionIssue[],
): Readonly<PlanOwnedNonRothIraCandidateTransactionBlockedResult> {
  return deepFreeze({
    status: 'candidateTransactionBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    transactionEvidenceId: null,
    inventory,
    issues: issues as [
      PlanOwnedNonRothIraCandidateTransactionIssue,
      ...PlanOwnedNonRothIraCandidateTransactionIssue[],
    ],
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

function claimIdentifier(
  claimed: Set<string>,
  value: string,
  label: string,
): PlanOwnedNonRothIraCandidateTransactionIssue | null {
  if (value.trim().length === 0 || claimed.has(value)) {
    return {
      kind: 'identifierCollision',
      detail: `${label} must be nonblank and unique across the candidate-transaction boundary`,
    }
  }
  claimed.add(value)
  return null
}

function inventoryDeclarationEntries(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
): readonly Readonly<{ value: string; label: string }>[] {
  const declarations: { value: string; label: string }[] = [{
    value: inventory.ledgerRunId,
    label: 'Annual inventory ledger-run ID',
  }, {
    value: inventory.runtimeInventoryEvidenceId,
    label: 'Runtime inventory evidence ID',
  }, {
    value: inventory.runtimeInventoryUpstreamEvidenceId,
    label: 'Runtime inventory upstream evidence ID',
  }, {
    value: inventory.inventoryEvidenceId,
    label: 'Annual inventory evidence ID',
  }]
  for (const event of inventory.events) {
    declarations.push({
      value: event.eventId,
      label: 'Annual physical-event ID',
    })
    if (event.origin !== 'planAction') {
      declarations.push({
        value: event.movementAuthorityId,
        label: 'Runtime movement-authority ID',
      }, {
        value: event.upstreamEvidenceId,
        label: 'Runtime event upstream evidence ID',
      })
    }
  }
  return declarations
}

/**
 * Builds and applies a Plan-owned IRA movement candidate to detached evidence
 * only. It deliberately publishes no year-end snapshot, tax character,
 * penalty result, finalization, actionability, or committed movement.
 */
export function preparePlanOwnedNonRothIraAnnualCandidateTransaction(
  input: Readonly<PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput>,
): Readonly<PreparePlanOwnedNonRothIraAnnualCandidateTransactionResult> {
  const inventory = buildAnnualRetirementPhysicalEventInventory(input)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    return inventory
  }
  if (inventory.compatibility.status === 'requiresUnifiedAnnualLedger') {
    return deepFreeze({
      status: 'requiresUnifiedAnnualLedger',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      transactionStatus: 'notEstablished',
      transactionEvidenceId: null,
      inventory,
      compatibility: inventory.compatibility,
      issues: [],
    })
  }

  const plan = planSchema.parse(input.plan)
  const issues: PlanOwnedNonRothIraCandidateTransactionIssue[] = []
  if (
    typeof input.ledgerRunId !== 'string' ||
    input.ledgerRunId.trim().length === 0 ||
    input.ledgerRunId !== inventory.ledgerRunId
  ) {
    issues.push({
      kind: 'ledgerRunMismatch',
      detail: 'Candidate transaction and physical inventory must share one nonblank ledger run',
    })
  }
  const selectedActionIds = new Set(inventory.planOwnedIraActionIds)
  const requests = plan.strategies.retirementActions
    .filter((action): action is OrdinaryWithdrawalRequest =>
      selectedActionIds.has(action.actionId) &&
      action.kind === 'ordinaryWithdrawal')
  const requestedSourceIds = [...new Set(requests.flatMap((request) =>
    request.allocations.map((allocation) => allocation.sourceAccountId),
  ))].sort(compareUtf16CodeUnits)
  const requestedSourceIdSet = new Set(requestedSourceIds)

  const openingBySource = new Map<AccountId, AccountOpeningBalanceSnapshot>()
  for (const raw of input.openingBalances) {
    const account = accountIdSchema.safeParse(raw.accountId)
    const balance = usdCentsSchema.safeParse(raw.openingBalance)
    if (!account.success || !balance.success) {
      issues.push({
        kind: 'openingBalanceInvalid',
        detail: 'Every candidate opening balance must use a valid account ID and nonnegative safe-integer cents',
      })
      continue
    }
    if (openingBySource.has(account.data)) {
      issues.push({
        kind: 'openingBalanceDuplicate',
        detail: 'Candidate opening balances must be unique per source',
        sourceAccountId: account.data,
      })
      continue
    }
    openingBySource.set(account.data, {
      accountId: account.data,
      openingBalance: balance.data,
    })
    if (!requestedSourceIdSet.has(account.data)) {
      issues.push({
        kind: 'openingBalanceForeign',
        detail: 'Candidate opening balance is foreign to the exact Plan action/source batch',
        sourceAccountId: account.data,
      })
    }
  }
  for (const sourceAccountId of requestedSourceIds) {
    if (!openingBySource.has(sourceAccountId)) {
      issues.push({
        kind: 'openingBalanceMissing',
        detail: 'Every requested Plan-owned IRA source requires one exact-cent opening balance',
        sourceAccountId,
      })
    }
  }

  // The validated Plan is prerequisite evidence too, including accounts and
  // classifications outside the requested source batch. Inventory references
  // may reuse those Plan IDs, but inventory declarations may not. Register the
  // declarations before adding inventory references so an existing cross-role
  // collision cannot disappear inside a Set.
  const claimed = identifierValues(plan)
  for (const declaration of inventoryDeclarationEntries(inventory)) {
    const declarationIssue = claimIdentifier(
      claimed,
      declaration.value,
      declaration.label,
    )
    if (declarationIssue !== null) issues.push(declarationIssue)
  }
  identifierValues(inventory, '', claimed)
  if (issues.length > 0) return blocked(inventory, issues)
  const sourceEvidence: OwnedNonRothIraMovementSourceEvidence[] = []
  for (const sourceAccountId of requestedSourceIds) {
    const account = plan.accounts.find((candidate) =>
      candidate.id === sourceAccountId)
    const classifications =
      plan.retirementActionEligibilityFacts?.iraClassifications.filter(
        (classification) =>
          classification.sourceAccountId === sourceAccountId,
      ) ?? []
    if (
      account === undefined ||
      account.type !== 'traditional' ||
      account.kind !== 'ira' ||
      account.inherited !== undefined ||
      account.ownerPersonId !== inventory.compatibility.ownerPersonId ||
      classifications.length !== 1
    ) {
      issues.push({
        kind: 'iraClassificationMissing',
        detail: 'Every requested owned IRA source requires exactly one matching Plan classification',
        sourceAccountId,
      })
      continue
    }
    const classification = classifications[0]!
    const accountOwnershipEvidenceId = deriveActionStructuralId(
      'owned-ira-plan-account-ownership',
      [
        plan.id,
        inventory.compatibility.ownerPersonId,
        sourceAccountId,
        'traditional',
        'ira',
        'owned',
      ],
    )
    const ownershipIssue = claimIdentifier(
      claimed,
      accountOwnershipEvidenceId,
      'Derived account-ownership evidence ID',
    )
    if (ownershipIssue !== null) issues.push(ownershipIssue)
    sourceEvidence.push({
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
      sourceAccountId,
      ownerPersonId: inventory.compatibility.ownerPersonId,
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: classification.subtype,
      accountOwnershipEvidenceId,
      iraClassificationEvidenceId: classification.evidenceId,
    })
  }
  if (issues.length > 0) return blocked(inventory, issues)

  const movementInput: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
    ownerPersonId: inventory.compatibility.ownerPersonId,
    taxYear: inventory.taxYear,
    requests,
    openingBalances: requestedSourceIds.map((sourceAccountId) =>
      openingBySource.get(sourceAccountId)!),
    sourceEvidence,
  }
  const movementCandidate =
    stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  if (movementCandidate.status === 'scheduleInvalid') {
    return deepFreeze({
      status: 'candidateTransactionScheduleInvalid',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      transactionStatus: 'notEstablished',
      transactionEvidenceId: null,
      inventory,
      scheduleIssues: movementCandidate.scheduleIssues,
      issues: [],
    })
  }
  const candidateIdIssue = claimIdentifier(
    claimed,
    movementCandidate.movementCandidateId,
    'Movement-candidate evidence ID',
  )
  if (candidateIdIssue !== null) return blocked(inventory, [candidateIdIssue])
  const canonicalMovementInput:
    StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
      ...movementInput,
      requests: movementCandidate.actions.map((action) => action.request),
    }

  const allocationApplications: PlanOwnedNonRothIraDetachedAllocationApplication[] = []
  for (const action of movementCandidate.actions) {
    for (const allocation of action.allocations) {
      const withoutId = {
        predicate:
          'planOwnedNonRothIraDetachedCandidateAllocationApplication' as const,
        planId: inventory.planId,
        ownerPersonId: inventory.compatibility.ownerPersonId,
        taxYear: inventory.taxYear,
        ledgerRunId: inventory.ledgerRunId,
        inventoryEvidenceId: inventory.inventoryEvidenceId,
        movementCandidateId: movementCandidate.movementCandidateId,
        actionId: action.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        scheduledDate: action.executionDate,
        scheduledSequence: action.executionSequence,
        requestedAmount: asUsdCents(allocation.requestedAmount),
        balanceBefore: allocation.balanceBefore,
        executedAmount: allocation.executedAmount,
        unexecutedAmount: allocation.unexecutedAmount,
        candidateBalanceAfter: allocation.candidateBalanceAfter,
      }
      const upstreamEvidenceId = deriveActionStructuralId(
        'owned-ira-plan-detached-candidate-allocation-upstream',
        [
          inventory.inventoryEvidenceId,
          movementCandidate.movementCandidateId,
          action.actionId,
          allocation,
        ],
      )
      const upstreamIssue = claimIdentifier(
        claimed,
        upstreamEvidenceId,
        'Detached allocation-application upstream evidence ID',
      )
      if (upstreamIssue !== null) issues.push(upstreamIssue)
      const applicationEvidenceId = deriveActionStructuralId(
        'owned-ira-plan-detached-candidate-allocation-application',
        [withoutId, upstreamEvidenceId],
      )
      const applicationIssue = claimIdentifier(
        claimed,
        applicationEvidenceId,
        'Detached allocation-application evidence ID',
      )
      if (applicationIssue !== null) issues.push(applicationIssue)
      allocationApplications.push({
        ...withoutId,
        applicationEvidenceId,
        upstreamEvidenceId,
      })
    }
  }
  const sourceBalanceTransitions: PlanOwnedNonRothIraDetachedSourceBalanceTransition[] = []
  for (const balance of movementCandidate.candidateBalances) {
    const withoutId = {
      predicate:
        'planOwnedNonRothIraDetachedCandidateSourceBalanceTransition' as const,
      planId: inventory.planId,
      ownerPersonId: inventory.compatibility.ownerPersonId,
      taxYear: inventory.taxYear,
      ledgerRunId: inventory.ledgerRunId,
      inventoryEvidenceId: inventory.inventoryEvidenceId,
      movementCandidateId: movementCandidate.movementCandidateId,
      sourceAccountId: balance.sourceAccountId,
      openingBalance: balance.openingBalance,
      requestedAmount: balance.requestedAmount,
      executedAmount: balance.executedAmount,
      unexecutedAmount: balance.unexecutedAmount,
      candidateClosingBalance: balance.candidateClosingBalance,
    }
    const upstreamEvidenceId = deriveActionStructuralId(
      'owned-ira-plan-detached-candidate-source-balance-upstream',
      [
        inventory.inventoryEvidenceId,
        movementCandidate.movementCandidateId,
        balance,
      ],
    )
    const upstreamIssue = claimIdentifier(
      claimed,
      upstreamEvidenceId,
      'Detached source-balance upstream evidence ID',
    )
    if (upstreamIssue !== null) issues.push(upstreamIssue)
    const transitionEvidenceId = deriveActionStructuralId(
      'owned-ira-plan-detached-candidate-source-balance-transition',
      [withoutId, upstreamEvidenceId],
    )
    const transitionIssue = claimIdentifier(
      claimed,
      transitionEvidenceId,
      'Detached source-balance transition evidence ID',
    )
    if (transitionIssue !== null) issues.push(transitionIssue)
    sourceBalanceTransitions.push({
      ...withoutId,
      evidenceId: transitionEvidenceId,
      upstreamEvidenceId,
    })
  }
  const stagedProceedsBigInt = allocationApplications.reduce(
    (sum, application) => sum + BigInt(application.executedAmount),
    0n,
  )
  if (stagedProceedsBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    issues.push({
      kind: 'stagedProceedsOverflow',
      detail: 'Aggregate staged proceeds exceed the exact-cent safe-integer range',
    })
  }
  if (issues.length > 0) return blocked(inventory, issues)
  const stagedProceeds = asUsdCents(Number(stagedProceedsBigInt))
  const transactionWithoutId = {
    planId: inventory.planId,
    ownerPersonId: inventory.compatibility.ownerPersonId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryEvidenceId: inventory.inventoryEvidenceId,
    movementCandidateId: movementCandidate.movementCandidateId,
    allocationApplications,
    sourceBalanceTransitions,
    stagedProceeds,
  }
  const transactionEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-annual-candidate-transaction',
    [transactionWithoutId],
  )
  const transactionIssue = claimIdentifier(
    claimed,
    transactionEvidenceId,
    'Candidate-transaction evidence ID',
  )
  if (transactionIssue !== null) return blocked(inventory, [transactionIssue])
  return deepFreeze({
    status: 'candidateTransactionPrepared',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    transactionStatus: 'appliedToDetachedSnapshotOnly',
    planId: inventory.planId,
    ownerPersonId: inventory.compatibility.ownerPersonId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventory,
    movementInput: canonicalMovementInput,
    movementCandidate,
    allocationApplications,
    sourceBalanceTransitions,
    stagedProceeds,
    transactionEvidenceId,
    issues: [],
  })
}
