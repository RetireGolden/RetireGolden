import { planSchema, selectedLogicalAccounts, type Plan } from '../model/plan.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type BuildAnnualRetirementPhysicalEventInventoryResult,
  type UnifiedAnnualLedgerReason,
} from './annualRetirementPhysicalEventInventory.js'
import { ordinaryWithdrawalRequestSchema, type OrdinaryWithdrawalRequest } from './contract.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type OwnedNonRothIraMovementCandidateBalance,
  type OwnedNonRothIraMovementCandidateStagedResult,
  type OwnedNonRothIraMovementScheduleIssue,
  type OwnedNonRothIraMovementSourceEvidence,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import type {
  ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  CompleteOwnedNonRothIraPoolEvidence,
  OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { nonblank } from './plainData.js'

export interface PlanOwnedNonRothIraCandidateAllocationApplication {
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

export type PlanOwnedNonRothIraCandidateBalanceSnapshot =
  OwnedNonRothIraMovementCandidateBalance & {
    evidenceId: string
    upstreamEvidenceId: string
  }

export interface PlanOwnedNonRothIraApplicableYearEndBalance {
  predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance'
  planId: PlanId
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  ledgerRunId: string
  ledgerPhase: 'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate'
  asOfDate: string
  yearEndApplicableBalanceAmount: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CompletePlanOwnedNonRothIraPostCandidateSnapshot {
  predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  movementCandidateId: string
  applicationStatus: 'canonicalMovementCandidateAppliedExactlyOnce'
  allocationApplications:
    readonly Readonly<PlanOwnedNonRothIraCandidateAllocationApplication>[]
  candidateBalances:
    readonly Readonly<PlanOwnedNonRothIraCandidateBalanceSnapshot>[]
  yearEndApplicableBalances:
    readonly Readonly<PlanOwnedNonRothIraApplicableYearEndBalance>[]
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CompletePlanOwnedNonRothIraAnnualBasisRecord {
  predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete'
  openingBasisAmount: UsdCents
  outstandingRolloverAmount: 0
  rolloverRepaymentAdjustmentAmount: 0
  evidenceId: string
  upstreamEvidenceId: string
}

export interface PlanOwnedNonRothIraContributionDeadlineEvidence {
  predicate: 'federalIraContributionDeadlineForTaxYear'
  designatedTaxYear: number
  deadlineStatus: 'authoritativeFederalDeadlineEstablished'
  deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief'
  calendarAdjustmentStatus:
    'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied'
  deadlineDate: string
  evidenceId: string
  upstreamEvidenceId: string
}

export interface PlanOwnedNonRothIraPostYearNondeductibleContribution {
  contributionId: string
  planId: PlanId
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  designatedTaxYear: number
  contributionDate: string
  nondeductibleContributionAmount: PositiveUsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

export interface CompletePlanOwnedNonRothIraPostYearContributionWindow {
  predicate: 'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryStatus: 'completeIncludingExplicitEmpty'
  deadlineEvidence:
    Readonly<PlanOwnedNonRothIraContributionDeadlineEvidence>
  contributions:
    readonly Readonly<PlanOwnedNonRothIraPostYearNondeductibleContribution>[]
  evidenceId: string
  upstreamEvidenceId: string
}

export interface BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput {
  inventoryInput: Readonly<BuildAnnualRetirementPhysicalEventInventoryInput>
  movementInput:
    Readonly<StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput>
  movementCandidate: Readonly<OwnedNonRothIraMovementCandidateStagedResult>
  postCandidateSnapshot:
    Readonly<CompletePlanOwnedNonRothIraPostCandidateSnapshot>
  annualBasisRecord:
    Readonly<CompletePlanOwnedNonRothIraAnnualBasisRecord>
  postYearContributionWindow:
    Readonly<CompletePlanOwnedNonRothIraPostYearContributionWindow>
}

export type PlanOwnedNonRothIraPostCandidateEvidenceIssueKind =
  | 'inventoryBlocked'
  | 'unifiedAnnualLedgerRequired'
  | 'movementInputMismatch'
  | 'movementCandidateMismatch'
  | 'snapshotIncomplete'
  | 'snapshotMismatch'
  | 'contributionWindowIncomplete'
  | 'annualBasisIncomplete'
  | 'annualBasisArithmeticInvalid'
  | 'identifierCollision'

export interface PlanOwnedNonRothIraPostCandidateEvidenceIssue {
  kind: PlanOwnedNonRothIraPostCandidateEvidenceIssueKind
  detail: string
  sourceAccountId?: AccountId
  actionId?: ActionId
  identifier?: string
}

interface ResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
  classificationInput: null | Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>
  reconciliationEvidence: null | Readonly<PlanOwnedNonRothIraAnnualPostCandidateReconciliationEvidence>
}

export interface PlanOwnedNonRothIraPostCandidateInventoryBlockedResult
  extends ResultBase {
  status: 'inventoryBlocked'
  classificationInput: null
  reconciliationEvidence: null
  inventoryResult: Readonly<BuildAnnualRetirementPhysicalEventInventoryResult>
  issues: readonly [Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>, ...Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>[]]
}

export interface PlanOwnedNonRothIraPostCandidateUnifiedLedgerRequiredResult
  extends ResultBase {
  status: 'unifiedAnnualLedgerRequired'
  classificationInput: null
  reconciliationEvidence: null
  reasons: readonly [UnifiedAnnualLedgerReason, ...UnifiedAnnualLedgerReason[]]
  issues: readonly [Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>, ...Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>[]]
}

type PlanOwnedNonRothIraPostCandidateBlockedStatus = Exclude<
  PlanOwnedNonRothIraPostCandidateEvidenceIssueKind,
  'inventoryBlocked' | 'unifiedAnnualLedgerRequired'
>

export type PlanOwnedNonRothIraPostCandidateBlockedResult = {
  [Status in PlanOwnedNonRothIraPostCandidateBlockedStatus]: ResultBase & {
  status: Status
  classificationInput: null
  reconciliationEvidence: null
  issues: readonly [Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>, ...Readonly<PlanOwnedNonRothIraPostCandidateEvidenceIssue>[]]
  }
}[PlanOwnedNonRothIraPostCandidateBlockedStatus]

export interface PlanOwnedNonRothIraAnnualPostCandidateReconciliationEvidence {
  predicate: 'planOwnedNonRothIraAnnualPostCandidateClassificationInputReconciled'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  movementCandidateId: string
  postCandidateSnapshotEvidenceId: string
  annualBasisRecordEvidenceId: string
  contributionWindowEvidenceId: string
  form8606Line1NondeductibleContributionAmount: UsdCents
  form8606Line4PostYearExcludedContributionAmount: UsdCents
  form8606Line5BasisAmount: UsdCents
  form8606Line6AdjustedYearEndAndRolloverAmount: UsdCents
  form8606Line7DistributionAmount: UsdCents
  form8606Line8NetConversionAmount: 0
  form8606Line9DenominatorAmount: UsdCents
  movement: 'notCommitted'
  actionability: 'notEstablished'
  evidenceId: string
}

export interface PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult
  extends ResultBase {
  status: 'postCandidateClassificationInputBuilt'
  classificationInput: Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>
  reconciliationEvidence: Readonly<PlanOwnedNonRothIraAnnualPostCandidateReconciliationEvidence>
  issues: readonly []
}

export type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInputResult =
  | PlanOwnedNonRothIraPostCandidateInventoryBlockedResult
  | PlanOwnedNonRothIraPostCandidateUnifiedLedgerRequiredResult
  | PlanOwnedNonRothIraPostCandidateBlockedResult
  | PlanOwnedNonRothIraPostCandidateEvidenceBuiltResult

type OwnedIraPlanAccount = Extract<Plan['accounts'][number], { type: 'traditional' }>

function issue(
  kind: PlanOwnedNonRothIraPostCandidateEvidenceIssueKind,
  detail: string,
  bindings: Pick<PlanOwnedNonRothIraPostCandidateEvidenceIssue, 'sourceAccountId' | 'actionId' | 'identifier'> = {},
): PlanOwnedNonRothIraPostCandidateEvidenceIssue {
  return { kind, detail, ...bindings }
}

function blocked(
  status: PlanOwnedNonRothIraPostCandidateBlockedResult['status'],
  issues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[],
): Readonly<PlanOwnedNonRothIraPostCandidateBlockedResult> {
  return deepFreeze({
    status,
    movement: 'notCommitted',
    actionability: 'notEstablished',
    classificationInput: null,
    reconciliationEvidence: null,
    issues: issues as [PlanOwnedNonRothIraPostCandidateEvidenceIssue, ...PlanOwnedNonRothIraPostCandidateEvidenceIssue[]],
  })
}

function canonicalRequest(raw: unknown): OrdinaryWithdrawalRequest {
  const request = ordinaryWithdrawalRequestSchema.parse(raw)
  return {
    ...request,
    provenance: { ...request.provenance },
    purpose: { ...request.purpose },
    allocations: [...request.allocations]
      .map((allocation) => ({ ...allocation }))
      .sort((left, right) =>
        compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
        compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)),
  }
}

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null ||
      typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => same(value, right[index]))
  }
  const leftPrototype = Object.getPrototypeOf(left)
  const rightPrototype = Object.getPrototypeOf(right)
  if (
    (leftPrototype !== Object.prototype && leftPrototype !== null) ||
    (rightPrototype !== Object.prototype && rightPrototype !== null)
  ) return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort(compareUtf16CodeUnits)
  const rightKeys = Object.keys(rightRecord).sort(compareUtf16CodeUnits)
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] &&
      same(leftRecord[key], rightRecord[key]))
}

function safeCents(value: bigint): UsdCents | null {
  return value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)
    ? null
    : asUsdCents(Number(value))
}

type CandidateAllocationApplicationProjection = Omit<
  PlanOwnedNonRothIraCandidateAllocationApplication,
  'applicationEvidenceId' | 'upstreamEvidenceId'
>

function allocationApplications(
  candidate: Readonly<OwnedNonRothIraMovementCandidateStagedResult>,
): CandidateAllocationApplicationProjection[] {
  return candidate.actions.flatMap((action) => action.allocations.map((allocation) => ({
    actionId: action.actionId,
    allocationId: allocation.allocationId,
    sourceAccountId: allocation.sourceAccountId,
    scheduledDate: action.executionDate,
    scheduledSequence: action.executionSequence,
    requestedAmount: allocation.requestedAmount,
    balanceBefore: allocation.balanceBefore,
    executedAmount: allocation.executedAmount,
    unexecutedAmount: allocation.unexecutedAmount,
    candidateBalanceAfter: allocation.candidateBalanceAfter,
  }))).sort((left, right) =>
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
}

interface IdentifierClaim {
  role: string
  binding: string
  label: string
}

function claimIdentifier(
  ids: Map<string, IdentifierClaim[]>,
  value: unknown,
  role: string,
  bindingParts: readonly unknown[],
  label: string,
  issues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[],
  allowSameBindingReference = false,
  allowSameRoleDifferentBinding = false,
): void {
  if (!nonblank(value)) {
    issues.push(issue('identifierCollision', `${label} must be a nonblank stable identifier`))
    return
  }
  const binding = deriveActionStructuralId(
    'owned-ira-post-candidate-identifier-binding',
    bindingParts,
  )
  const existing = ids.get(value) ?? []
  const crossRole = existing.find((claim) => claim.role !== role)
  if (crossRole !== undefined) {
    issues.push(issue(
      'identifierCollision',
      `${label} collides with ${crossRole.label}`,
      { identifier: value },
    ))
    return
  }
  const sameBinding = existing.find((claim) => claim.binding === binding)
  if (sameBinding !== undefined) {
    if (allowSameBindingReference) return
    issues.push(issue(
      'identifierCollision',
      `${label} collides with ${sameBinding.label}`,
      { identifier: value },
    ))
    return
  }
  if (allowSameBindingReference) {
    issues.push(issue(
      'identifierCollision',
      `${label} does not match a prior ${role} declaration`,
      { identifier: value },
    ))
    return
  }
  if (existing.length > 0 && !allowSameRoleDifferentBinding) {
    issues.push(issue(
      'identifierCollision',
      `${label} is rebound from ${existing[0]!.label}`,
      { identifier: value },
    ))
    return
  }
  ids.set(value, [...existing, { role, binding, label }])
}

function derivedOwnershipId(planId: PlanId, ownerPersonId: PersonId, sourceAccountId: AccountId): string {
  return deriveActionStructuralId('owned-ira-plan-account-ownership', [
    planId,
    ownerPersonId,
    sourceAccountId,
    'traditional',
    'ira',
    'owned',
  ])
}

/**
 * Rebuilds and binds the complete post-candidate evidence needed by the
 * annual owned-IRA withdrawal classifier. It does not classify, execute, or
 * commit any action or balance.
 */
export function buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(
  input: Readonly<BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput>,
): Readonly<BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInputResult> {
  const inventory = buildAnnualRetirementPhysicalEventInventory(input.inventoryInput)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    return deepFreeze({
      status: 'inventoryBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      classificationInput: null,
      reconciliationEvidence: null,
      inventoryResult: inventory,
      issues: [issue('inventoryBlocked', 'Annual retirement physical-event inventory must be complete and chronological')],
    })
  }
  if (inventory.compatibility.status !== 'standaloneOwnedIraExecutorCompatible') {
    return deepFreeze({
      status: 'unifiedAnnualLedgerRequired',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      classificationInput: null,
      reconciliationEvidence: null,
      reasons: inventory.compatibility.reasons,
      issues: [issue('unifiedAnnualLedgerRequired', 'Annual physical activity requires the unified annual ledger')],
    })
  }

  const plan = planSchema.parse(input.inventoryInput.plan)
  const planId = inventory.planId
  const ownerPersonId = inventory.compatibility.ownerPersonId
  const taxYear = inventory.taxYear
  const movementIssues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[] = []
  const poolAccounts = plan.accounts.filter((account): account is OwnedIraPlanAccount =>
    account.type === 'traditional' &&
    account.kind === 'ira' &&
    account.inherited === undefined &&
    account.ownerPersonId === ownerPersonId,
  ).sort((left, right) => compareUtf16CodeUnits(left.id, right.id))
  const poolIds = poolAccounts.map((account) => accountIdSchema.parse(account.id))
  const poolIdSet = new Set(poolIds)
  const inventoryPool = inventory.ownedIraPools.find((pool) => pool.ownerPersonId === ownerPersonId)
  if (inventoryPool === undefined || !same(inventoryPool.sourceAccountIds, poolIds)) {
    movementIssues.push(issue('movementInputMismatch', 'Movement owner pool does not exactly rejoin the rebuilt Plan inventory'))
  }

  let expectedRequests: OrdinaryWithdrawalRequest[] = []
  try {
    const actionsById = new Map(plan.strategies.retirementActions.map((action) => [action.actionId, action]))
    expectedRequests = inventory.planOwnedIraActionIds.map((actionId) => canonicalRequest(actionsById.get(actionId)))
      .sort((left, right) => compareUtf16CodeUnits(left.actionId, right.actionId))
    const suppliedRequests = input.movementInput.requests.map(canonicalRequest)
      .sort((left, right) => compareUtf16CodeUnits(left.actionId, right.actionId))
    if (!same(suppliedRequests, expectedRequests)) {
      movementIssues.push(issue('movementInputMismatch', 'Movement requests must exactly equal the Plan-owned action batch'))
    }
  } catch (error) {
    movementIssues.push(issue('movementInputMismatch', `Movement request evidence is invalid: ${error instanceof Error ? error.message : String(error)}`))
  }
  if (input.movementInput.ownerPersonId !== ownerPersonId || input.movementInput.taxYear !== taxYear) {
    movementIssues.push(issue('movementInputMismatch', 'Movement input must bind the rebuilt inventory owner and tax year'))
  }

  const requestedSourceIds = [...new Set(expectedRequests.flatMap((request) =>
    request.allocations.map((allocation) => allocation.sourceAccountId)))]
    .sort(compareUtf16CodeUnits)
  const classificationsBySource = new Map<AccountId, NonNullable<
    Plan['retirementActionEligibilityFacts']
  >['iraClassifications']>()
  for (const classification of plan.retirementActionEligibilityFacts?.iraClassifications ?? []) {
    const sourceAccountId = accountIdSchema.parse(classification.sourceAccountId)
    classificationsBySource.set(sourceAccountId, [
      ...(classificationsBySource.get(sourceAccountId) ?? []),
      classification,
    ])
  }
  const classificationBySource = new Map<AccountId, NonNullable<
    Plan['retirementActionEligibilityFacts']
  >['iraClassifications'][number]>()
  for (const sourceAccountId of poolIds) {
    const classifications = classificationsBySource.get(sourceAccountId) ?? []
    if (classifications.length !== 1) {
      movementIssues.push(issue(
        'movementInputMismatch',
        'Every owned non-inherited IRA sibling needs exactly one Plan classification',
        { sourceAccountId },
      ))
      continue
    }
    classificationBySource.set(sourceAccountId, classifications[0]!)
  }
  const expectedSourceEvidence: OwnedNonRothIraMovementSourceEvidence[] = []
  for (const sourceAccountId of requestedSourceIds) {
    const classification = classificationBySource.get(sourceAccountId)
    if (!poolIdSet.has(sourceAccountId) || classification === undefined) {
      movementIssues.push(issue('movementInputMismatch', 'Every requested source needs one Plan-owned IRA classification', { sourceAccountId }))
      continue
    }
    expectedSourceEvidence.push({
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource',
      sourceAccountId,
      ownerPersonId,
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: classification.subtype,
      accountOwnershipEvidenceId: derivedOwnershipId(planId, ownerPersonId, sourceAccountId),
      iraClassificationEvidenceId: classification.evidenceId,
    })
  }
  const suppliedSourceEvidence = [...input.movementInput.sourceEvidence]
    .map((evidence) => ({ ...evidence }))
    .sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  if (!same(suppliedSourceEvidence, expectedSourceEvidence)) {
    movementIssues.push(issue('movementInputMismatch', 'Movement source evidence must exactly rejoin Plan ownership and IRA classifications'))
  }
  let openingBalances: { accountId: AccountId; openingBalance: UsdCents }[] = []
  try {
    openingBalances = input.movementInput.openingBalances.map((balance) => ({
      accountId: accountIdSchema.parse(balance.accountId),
      openingBalance: usdCentsSchema.parse(balance.openingBalance),
    })).sort((left, right) => compareUtf16CodeUnits(left.accountId, right.accountId))
    if (!same(openingBalances.map((balance) => balance.accountId), requestedSourceIds)) {
      movementIssues.push(issue('movementInputMismatch', 'Opening balances must exactly cover requested Plan-owned IRA sources'))
    }
  } catch (error) {
    movementIssues.push(issue('movementInputMismatch', `Opening balance evidence is invalid: ${error instanceof Error ? error.message : String(error)}`))
  }
  if (movementIssues.length > 0) return blocked('movementInputMismatch', movementIssues)

  let recomputed
  try {
    recomputed = stageOwnedNonRothIraOrdinaryWithdrawalMovements({
      ownerPersonId,
      taxYear,
      requests: expectedRequests,
      openingBalances,
      sourceEvidence: expectedSourceEvidence,
    })
  } catch (error) {
    return blocked('movementCandidateMismatch', [issue('movementCandidateMismatch', `Canonical movement candidate could not be rebuilt: ${error instanceof Error ? error.message : String(error)}`)])
  }
  if (recomputed.status === 'scheduleInvalid') {
    return blocked('movementCandidateMismatch', [issue('movementCandidateMismatch', `Canonical Plan schedule is invalid: ${recomputed.scheduleIssues.map((value: OwnedNonRothIraMovementScheduleIssue) => value.kind).join(', ')}`)])
  }
  if (!same(input.movementCandidate, recomputed)) {
    return blocked('movementCandidateMismatch', [issue('movementCandidateMismatch', 'Supplied movement candidate is not exactly the canonically rebuilt staged candidate')])
  }

  const snapshot = input.postCandidateSnapshot
  const snapshotIssues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[] = []
  if (
    snapshot.predicate !== 'completePlanOwnedNonRothIraPostCandidateSnapshot' ||
    snapshot.planId !== planId || snapshot.ownerPersonId !== ownerPersonId ||
    snapshot.taxYear !== taxYear || snapshot.ledgerRunId !== inventory.ledgerRunId ||
    snapshot.inventoryEvidenceId !== inventory.inventoryEvidenceId ||
    snapshot.movementCandidateId !== recomputed.movementCandidateId ||
    snapshot.applicationStatus !== 'canonicalMovementCandidateAppliedExactlyOnce' ||
    !nonblank(snapshot.evidenceId) || !nonblank(snapshot.upstreamEvidenceId)
  ) {
    snapshotIssues.push(issue('snapshotMismatch', 'Post-candidate snapshot must bind the Plan, owner, year, ledger, inventory, candidate, and exactly-once application status'))
  }
  let suppliedApplications: PlanOwnedNonRothIraCandidateAllocationApplication[] = []
  let suppliedCandidateBalances: PlanOwnedNonRothIraCandidateBalanceSnapshot[] = []
  try {
    suppliedApplications = snapshot.allocationApplications.map((application) => ({
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: accountIdSchema.parse(application.sourceAccountId),
      scheduledDate: application.scheduledDate,
      scheduledSequence: application.scheduledSequence,
      requestedAmount: usdCentsSchema.parse(application.requestedAmount),
      balanceBefore: usdCentsSchema.parse(application.balanceBefore),
      executedAmount: usdCentsSchema.parse(application.executedAmount),
      unexecutedAmount: usdCentsSchema.parse(application.unexecutedAmount),
      candidateBalanceAfter: usdCentsSchema.parse(application.candidateBalanceAfter),
      applicationEvidenceId: application.applicationEvidenceId,
      upstreamEvidenceId: application.upstreamEvidenceId,
    })).sort((left, right) => compareUtf16CodeUnits(left.actionId, right.actionId) || compareUtf16CodeUnits(left.allocationId, right.allocationId) || compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
    suppliedCandidateBalances = snapshot.candidateBalances.map((balance) => ({
      sourceAccountId: accountIdSchema.parse(balance.sourceAccountId),
      ownerPersonId: personIdSchema.parse(balance.ownerPersonId),
      openingBalance: usdCentsSchema.parse(balance.openingBalance),
      requestedAmount: usdCentsSchema.parse(balance.requestedAmount),
      executedAmount: usdCentsSchema.parse(balance.executedAmount),
      unexecutedAmount: usdCentsSchema.parse(balance.unexecutedAmount),
      candidateClosingBalance: usdCentsSchema.parse(balance.candidateClosingBalance),
      evidenceId: balance.evidenceId,
      upstreamEvidenceId: balance.upstreamEvidenceId,
    })).sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
    if (
      suppliedApplications.some((application) =>
        !nonblank(application.scheduledDate) ||
        !Number.isSafeInteger(application.scheduledSequence) ||
        !nonblank(application.applicationEvidenceId) ||
        !nonblank(application.upstreamEvidenceId)) ||
      suppliedCandidateBalances.some((balance) =>
        !nonblank(balance.evidenceId) ||
        !nonblank(balance.upstreamEvidenceId))
    ) {
      snapshotIssues.push(issue('snapshotMismatch', 'Every applied allocation and candidate balance needs complete schedule, amount, and evidence bindings'))
    }
  } catch (error) {
    snapshotIssues.push(issue('snapshotMismatch', `Post-candidate application evidence is invalid: ${error instanceof Error ? error.message : String(error)}`))
  }
  const suppliedApplicationProjection = suppliedApplications.map((application) => ({
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
  }))
  const suppliedCandidateBalanceProjection = suppliedCandidateBalances.map((balance) => ({
    sourceAccountId: balance.sourceAccountId,
    ownerPersonId: balance.ownerPersonId,
    openingBalance: balance.openingBalance,
    requestedAmount: balance.requestedAmount,
    executedAmount: balance.executedAmount,
    unexecutedAmount: balance.unexecutedAmount,
    candidateClosingBalance: balance.candidateClosingBalance,
  }))
  if (!same(suppliedApplicationProjection, allocationApplications(recomputed)) ||
      !same(suppliedCandidateBalanceProjection, recomputed.candidateBalances)) {
    snapshotIssues.push(issue('snapshotMismatch', 'Snapshot allocation applications and candidate balances must exactly project the canonical candidate'))
  }

  const yearEndBySource = new Map<AccountId, PlanOwnedNonRothIraApplicableYearEndBalance>()
  const yearEndBalances: PlanOwnedNonRothIraApplicableYearEndBalance[] = []
  const expectedYearEndDate = `${String(taxYear).padStart(4, '0')}-12-31`
  try {
    for (const raw of snapshot.yearEndApplicableBalances) {
      const sourceAccountId = accountIdSchema.parse(raw.sourceAccountId)
      if (yearEndBySource.has(sourceAccountId)) {
        snapshotIssues.push(issue('snapshotIncomplete', 'Year-end snapshot has duplicate source coverage', { sourceAccountId }))
        continue
      }
      const balance: PlanOwnedNonRothIraApplicableYearEndBalance = {
        predicate: raw.predicate,
        planId: raw.planId,
        ownerPersonId: raw.ownerPersonId,
        sourceAccountId,
        taxYear: raw.taxYear,
        ledgerRunId: raw.ledgerRunId,
        ledgerPhase: raw.ledgerPhase,
        asOfDate: raw.asOfDate,
        yearEndApplicableBalanceAmount: usdCentsSchema.parse(raw.yearEndApplicableBalanceAmount),
        evidenceId: raw.evidenceId,
        upstreamEvidenceId: raw.upstreamEvidenceId,
      }
      if (!poolIdSet.has(sourceAccountId)) snapshotIssues.push(issue('snapshotIncomplete', 'Year-end snapshot contains an employer, inherited, or foreign account', { sourceAccountId }))
      if (
        balance.predicate !== 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' ||
        balance.planId !== planId || balance.ownerPersonId !== ownerPersonId ||
        balance.taxYear !== taxYear || balance.ledgerRunId !== inventory.ledgerRunId ||
        balance.ledgerPhase !== 'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' ||
        balance.asOfDate !== expectedYearEndDate ||
        !nonblank(balance.evidenceId) || !nonblank(balance.upstreamEvidenceId)
      ) snapshotIssues.push(issue('snapshotMismatch', 'Year-end evidence must bind the complete post-candidate December 31 pool', { sourceAccountId }))
      yearEndBySource.set(sourceAccountId, balance)
      yearEndBalances.push(balance)
    }
  } catch (error) {
    snapshotIssues.push(issue('snapshotMismatch', `Year-end balance evidence is invalid: ${error instanceof Error ? error.message : String(error)}`))
  }
  for (const sourceAccountId of poolIds) {
    if (!yearEndBySource.has(sourceAccountId)) snapshotIssues.push(issue('snapshotIncomplete', 'Year-end snapshot must include every owned non-inherited IRA sibling, including zero and unrequested accounts', { sourceAccountId }))
  }
  if (snapshotIssues.length > 0) {
    const status = snapshotIssues.some((value) => value.kind === 'snapshotIncomplete') ? 'snapshotIncomplete' : 'snapshotMismatch'
    return blocked(status, snapshotIssues)
  }
  yearEndBalances.sort((left, right) => compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))

  const contribution = input.postYearContributionWindow
  const contributionIssues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[] = []
  const deadline = contribution.deadlineEvidence
  if (
    contribution.predicate !== 'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow' ||
    contribution.planId !== planId || contribution.ownerPersonId !== ownerPersonId ||
    contribution.taxYear !== taxYear || contribution.ledgerRunId !== inventory.ledgerRunId ||
    contribution.inventoryStatus !== 'completeIncludingExplicitEmpty' ||
    !nonblank(contribution.evidenceId) || !nonblank(contribution.upstreamEvidenceId) ||
    deadline.predicate !== 'federalIraContributionDeadlineForTaxYear' ||
    deadline.designatedTaxYear !== taxYear ||
    deadline.deadlineStatus !== 'authoritativeFederalDeadlineEstablished' ||
    deadline.deadlineKind !== 'ordinaryFederalFilingDeadlineExcludingDisasterRelief' ||
    deadline.calendarAdjustmentStatus !== 'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied' ||
    !nonblank(deadline.evidenceId) || !nonblank(deadline.upstreamEvidenceId)
  ) contributionIssues.push(issue('contributionWindowIncomplete', 'Post-year contribution window and evidenced deadline must bind the Plan owner, tax year, and annual ledger'))
  const deadlineDate =
    typeof deadline.deadlineDate === 'string' ? deadline.deadlineDate : ''
  const parsedDeadline =
    deadlineDate === '' ? null : parseCivilIsoDate(deadlineDate)
  const deadlineYear = String(taxYear + 1).padStart(4, '0')
  if (
    parsedDeadline === null ||
    formatCivilDate(parsedDeadline) !== deadlineDate ||
    parsedDeadline.year !== taxYear + 1 ||
    deadlineDate < `${deadlineYear}-04-15` ||
    deadlineDate > `${deadlineYear}-04-18`
  ) {
    contributionIssues.push(issue('contributionWindowIncomplete', 'The ordinary federal IRA deadline must be a canonical April 15-18 date in the following calendar year, excluding disaster relief'))
  }
  const contributionIds = new Set<string>()
  const contributions = [...contribution.contributions].sort((left, right) =>
    compareUtf16CodeUnits(
      typeof left.contributionDate === 'string' ? left.contributionDate : '',
      typeof right.contributionDate === 'string' ? right.contributionDate : '',
    ) ||
    compareUtf16CodeUnits(
      typeof left.contributionId === 'string' ? left.contributionId : '',
      typeof right.contributionId === 'string' ? right.contributionId : '',
    ))
  const normalizedContributions: PlanOwnedNonRothIraPostYearNondeductibleContribution[] = []
  let contributionTotal = 0n
  for (const entry of contributions) {
    let amount: PositiveUsdCents
    let sourceAccountId: AccountId
    try {
      amount = positiveUsdCentsSchema.parse(entry.nondeductibleContributionAmount)
      sourceAccountId = accountIdSchema.parse(entry.sourceAccountId)
    } catch {
      contributionIssues.push(issue('contributionWindowIncomplete', 'Contribution source must be a valid pool account and amount must be positive exact safe-integer cents; use an explicit-empty window for zero', { sourceAccountId: entry.sourceAccountId }))
      continue
    }
    const contributionDate =
      typeof entry.contributionDate === 'string' ? entry.contributionDate : ''
    const parsedDate =
      contributionDate === '' ? null : parseCivilIsoDate(contributionDate)
    if (
      !nonblank(entry.contributionId) || contributionIds.has(entry.contributionId) ||
      entry.planId !== planId || entry.ownerPersonId !== ownerPersonId ||
      entry.designatedTaxYear !== taxYear || !poolIdSet.has(sourceAccountId) ||
      parsedDate === null || formatCivilDate(parsedDate) !== contributionDate ||
      contributionDate <= expectedYearEndDate || contributionDate > deadlineDate ||
      !nonblank(entry.evidenceId) || !nonblank(entry.upstreamEvidenceId)
    ) contributionIssues.push(issue('contributionWindowIncomplete', 'Every post-year contribution must be unique, designate the tax year, belong to the owner-wide pool, and fall after December 31 through the evidenced deadline', { sourceAccountId }))
    contributionIds.add(entry.contributionId)
    contributionTotal += BigInt(amount)
    normalizedContributions.push({
      contributionId: entry.contributionId,
      planId: entry.planId,
      ownerPersonId: entry.ownerPersonId,
      sourceAccountId,
      designatedTaxYear: entry.designatedTaxYear,
      contributionDate: entry.contributionDate,
      nondeductibleContributionAmount: amount,
      evidenceId: entry.evidenceId,
      upstreamEvidenceId: entry.upstreamEvidenceId,
    })
  }
  if (contributionIssues.length > 0) return blocked('contributionWindowIncomplete', contributionIssues)

  const basis = input.annualBasisRecord
  const basisIssues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[] = []
  let openingBasisAmount: UsdCents | null = null
  try { openingBasisAmount = usdCentsSchema.parse(basis.openingBasisAmount) } catch {
    basisIssues.push(issue('annualBasisIncomplete', 'Opening IRA basis must be exact nonnegative safe-integer cents'))
  }
  if (
    basis.predicate !== 'completePlanOwnedNonRothIraAnnualBasisRecord' ||
    basis.planId !== planId || basis.ownerPersonId !== ownerPersonId ||
    basis.taxYear !== taxYear || basis.ledgerRunId !== inventory.ledgerRunId ||
    basis.recordStatus !== 'openingBasisAndExplicitZeroRolloverFactsComplete' ||
    basis.outstandingRolloverAmount !== 0 || basis.rolloverRepaymentAdjustmentAmount !== 0 ||
    !nonblank(basis.evidenceId) || !nonblank(basis.upstreamEvidenceId)
  ) basisIssues.push(issue('annualBasisIncomplete', 'Annual basis record must bind the annual ledger and explicitly establish zero rollover facts'))
  if (basisIssues.length > 0 || openingBasisAmount === null) return blocked('annualBasisIncomplete', basisIssues)

  const line1 = safeCents(contributionTotal)
  const line7 = safeCents(recomputed.line7Distributions.reduce((sum, entry) => sum + BigInt(entry.grossAmount), 0n))
  const line6 = safeCents(yearEndBalances.reduce((sum, entry) => sum + BigInt(entry.yearEndApplicableBalanceAmount), 0n))
  if (line1 === null || line7 === null || line6 === null) return blocked('annualBasisArithmeticInvalid', [issue('annualBasisArithmeticInvalid', 'Annual Form 8606 components exceed the exact safe-cent range')])
  const line4 = line1
  const line9 = safeCents(BigInt(line6) + BigInt(line7))
  if (line9 === null) return blocked('annualBasisArithmeticInvalid', [issue('annualBasisArithmeticInvalid', 'Form 8606 line 9 exceeds the exact safe-cent range')])

  const poolMembers: OwnedNonRothIraPoolMemberEvidence[] = []
  for (const balance of yearEndBalances) {
    const classification = classificationBySource.get(balance.sourceAccountId)
    if (classification === undefined) {
      return blocked('movementInputMismatch', [issue(
        'movementInputMismatch',
        'Complete owner-wide pool lost its required Plan IRA classification',
        { sourceAccountId: balance.sourceAccountId },
      )])
    }
    poolMembers.push({
      sourceAccountId: balance.sourceAccountId,
      ownerPersonId,
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: classification.subtype,
      yearEndApplicableBalanceAmount: balance.yearEndApplicableBalanceAmount,
      iraClassificationEvidenceId: classification.evidenceId,
      accountOwnershipEvidenceId: derivedOwnershipId(planId, ownerPersonId, balance.sourceAccountId),
    })
  }
  const ownerWidePoolBinding = [
    planId,
    ownerPersonId,
    taxYear,
    poolMembers.map((member) => [
        member.sourceAccountId,
        member.subtype,
        member.accountOwnershipEvidenceId,
        member.iraClassificationEvidenceId,
    ]),
  ] as const
  const ownerWideNonRothIraPoolId = deriveActionStructuralId(
    'owned-non-roth-ira-plan-owner-pool',
    ownerWidePoolBinding,
  )
  const completePoolBinding = [planId, ownerPersonId, taxYear, poolMembers] as const
  const completePoolEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-complete-pool',
    completePoolBinding,
  )
  const completePoolEvidence: CompleteOwnedNonRothIraPoolEvidence = {
    predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
    ownerPersonId,
    ownerWideNonRothIraPoolId,
    taxYear,
    accountIds: poolIds as [AccountId, ...AccountId[]],
    yearEndApplicablePoolBalanceAmount: line6,
    evidenceId: completePoolEvidenceId,
  }
  const classificationInput: ClassifyOwnedNonRothIraAnnualWithdrawalsInput = {
    ownerPersonId,
    ownerWideNonRothIraPoolId,
    completePoolEvidence,
    annualBasisRecordEvidenceId: basis.evidenceId,
    taxYear,
    poolMembers,
    annualFacts: {
      openingBasisAmount,
      taxYearNondeductibleContributionAmount: line1,
      postYearNondeductibleContributionExcludedAmount: line4,
      yearEndApplicablePoolBalanceAmount: line6,
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: line7,
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: recomputed.line7Distributions.map((entry): AnnualIraBasisAllocationEntryInput => ({ ...entry })),
    line8Conversions: [],
  }
  const snapshotBinding = {
    predicate: snapshot.predicate,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryEvidenceId: snapshot.inventoryEvidenceId,
    movementCandidateId: snapshot.movementCandidateId,
    applicationStatus: snapshot.applicationStatus,
    allocationApplications: suppliedApplications,
    candidateBalances: suppliedCandidateBalances,
    yearEndApplicableBalances: yearEndBalances,
    evidenceId: snapshot.evidenceId,
    upstreamEvidenceId: snapshot.upstreamEvidenceId,
  }
  const basisBinding = {
    predicate: basis.predicate,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId: inventory.ledgerRunId,
    recordStatus: basis.recordStatus,
    openingBasisAmount,
    outstandingRolloverAmount: basis.outstandingRolloverAmount,
    rolloverRepaymentAdjustmentAmount: basis.rolloverRepaymentAdjustmentAmount,
    evidenceId: basis.evidenceId,
    upstreamEvidenceId: basis.upstreamEvidenceId,
  }
  const deadlineBinding = {
    predicate: deadline.predicate,
    designatedTaxYear: deadline.designatedTaxYear,
    deadlineStatus: deadline.deadlineStatus,
    deadlineKind: deadline.deadlineKind,
    calendarAdjustmentStatus: deadline.calendarAdjustmentStatus,
    deadlineDate: deadline.deadlineDate,
    evidenceId: deadline.evidenceId,
    upstreamEvidenceId: deadline.upstreamEvidenceId,
  }
  const contributionWindowBinding = {
    predicate: contribution.predicate,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryStatus: contribution.inventoryStatus,
    deadlineEvidence: deadlineBinding,
    contributions: normalizedContributions,
    evidenceId: contribution.evidenceId,
    upstreamEvidenceId: contribution.upstreamEvidenceId,
  }
  const reconciliationBinding = [
    inventory,
    recomputed,
    snapshotBinding,
    basisBinding,
    contributionWindowBinding,
    classificationInput,
    line9,
  ] as const
  const reconciliationEvidenceId = deriveActionStructuralId(
    'owned-non-roth-ira-post-candidate-reconciliation',
    reconciliationBinding,
  )

  const ids = new Map<string, IdentifierClaim[]>()
  const idIssues: PlanOwnedNonRothIraPostCandidateEvidenceIssue[] = []
  const claim = (
    value: unknown,
    role: string,
    binding: readonly unknown[],
    label: string,
    allowReference = false,
    allowSameRoleDifferentBinding = false,
  ) => claimIdentifier(
    ids,
    value,
    role,
    binding,
    label,
    idIssues,
    allowReference,
    allowSameRoleDifferentBinding,
  )
  const logicalAccounts = selectedLogicalAccounts(plan.accounts)
  const accountsById = new Map(logicalAccounts.map((account) => [account.id, account] as const))
  const actionsById = new Map(plan.strategies.retirementActions.map((action) => [action.actionId, action] as const))
  const allocationsByAction = new Map<ActionId, Map<AllocationId, unknown>>()

  claim(planId, 'planId', [planId], 'Plan ID')
  for (const person of plan.household.people) {
    claim(person.id, 'personId', [planId, person], `person ID ${person.id}`)
  }
  for (const account of logicalAccounts) {
    claim(account.id, 'accountId', [planId, account], `account ID ${account.id}`)
  }
  for (const action of plan.strategies.retirementActions) {
    claim(action.actionId, 'actionId', [planId, action], `action ID ${action.actionId}`)
    const actionWithAllocations = action as unknown as {
      allocations?: readonly { allocationId: AllocationId }[]
      allocation?: { allocationId: AllocationId }
    }
    const actionAllocations = actionWithAllocations.allocations ??
      (actionWithAllocations.allocation === undefined ? [] : [actionWithAllocations.allocation])
    for (const allocation of actionAllocations) {
      claim(
        allocation.allocationId,
        'allocationId',
        [action.actionId, allocation],
        `allocation ID ${allocation.allocationId}`,
        false,
        true,
      )
      const actionAllocationsById =
        allocationsByAction.get(action.actionId) ?? new Map<AllocationId, unknown>()
      actionAllocationsById.set(allocation.allocationId, allocation)
      allocationsByAction.set(action.actionId, actionAllocationsById)
    }
  }
  for (const classification of plan.retirementActionEligibilityFacts?.iraClassifications ?? []) {
    claim(
      classification.evidenceId,
      'iraClassificationEvidence',
      [classification.sourceAccountId, classification],
      `IRA classification evidence ID for ${classification.sourceAccountId}`,
    )
  }
  for (const sourceAccountId of poolIds) {
    claim(
      derivedOwnershipId(planId, ownerPersonId, sourceAccountId),
      'accountOwnershipEvidence',
      [planId, ownerPersonId, sourceAccountId],
      `account ownership evidence ID for ${sourceAccountId}`,
    )
  }

  const inventoryBinding = [planId, taxYear, inventory.ledgerRunId, inventory] as const
  const movementCandidateBinding = [ownerPersonId, taxYear, recomputed] as const
  claim(inventory.ledgerRunId, 'annualLedgerRunId', [planId, taxYear, inventory.ledgerRunId], 'annual ledger-run ID')
  claim(inventory.runtimeInventoryEvidenceId, 'runtimeInventoryEvidence', inventoryBinding, 'runtime inventory evidence ID')
  claim(inventory.runtimeInventoryUpstreamEvidenceId, 'runtimeInventoryUpstreamEvidence', inventoryBinding, 'runtime inventory upstream evidence ID')
  claim(inventory.inventoryEvidenceId, 'annualInventoryEvidence', inventoryBinding, 'annual inventory evidence ID')
  for (const event of inventory.events) {
    claim(event.eventId, 'annualInventoryEventId', [event], `annual inventory event ID ${event.eventId}`)
    if (event.origin !== 'planAction') {
      claim(
        event.movementAuthorityId,
        'runtimeMovementAuthorityId',
        [event.ledgerRunId, event.movementAuthorityId],
        `runtime movement authority ID ${event.movementAuthorityId}`,
        true,
      )
      claim(
        event.upstreamEvidenceId,
        'runtimeEventUpstreamEvidence',
        [event],
        `runtime event upstream evidence ID for ${event.eventId}`,
      )
    }
  }
  claim(recomputed.movementCandidateId, 'movementCandidate', movementCandidateBinding, 'movement candidate ID')
  claim(snapshot.evidenceId, 'postCandidateSnapshotEvidence', [snapshotBinding], 'post-candidate snapshot evidence ID')
  claim(snapshot.upstreamEvidenceId, 'postCandidateSnapshotUpstreamEvidence', [snapshotBinding], 'post-candidate snapshot upstream evidence ID')
  claim(snapshot.inventoryEvidenceId, 'annualInventoryEvidence', inventoryBinding, 'snapshot inventory evidence reference', true)
  claim(snapshot.movementCandidateId, 'movementCandidate', movementCandidateBinding, 'snapshot movement candidate reference', true)

  for (const application of suppliedApplications) {
    const action = actionsById.get(application.actionId)
    const allocation = allocationsByAction
      .get(application.actionId)
      ?.get(application.allocationId)
    const account = accountsById.get(application.sourceAccountId)
    if (action !== undefined) claim(application.actionId, 'actionId', [planId, action], 'application action reference', true)
    if (allocation !== undefined) claim(application.allocationId, 'allocationId', [application.actionId, allocation], 'application allocation reference', true)
    if (account !== undefined) claim(application.sourceAccountId, 'accountId', [planId, account], 'application source-account reference', true)
    claim(application.applicationEvidenceId, 'allocationApplicationEvidence', [application], `allocation application evidence ID for ${application.allocationId}`)
    claim(application.upstreamEvidenceId, 'allocationApplicationUpstreamEvidence', [application], `allocation application upstream evidence ID for ${application.allocationId}`)
  }
  for (const balance of suppliedCandidateBalances) {
    const account = accountsById.get(balance.sourceAccountId)
    if (account !== undefined) claim(balance.sourceAccountId, 'accountId', [planId, account], 'candidate-balance account reference', true)
    claim(balance.evidenceId, 'candidateBalanceEvidence', [balance], `candidate-balance evidence ID for ${balance.sourceAccountId}`)
    claim(balance.upstreamEvidenceId, 'candidateBalanceUpstreamEvidence', [balance], `candidate-balance upstream evidence ID for ${balance.sourceAccountId}`)
  }
  for (const evidence of expectedSourceEvidence) {
    const account = accountsById.get(evidence.sourceAccountId)
    const classification = classificationBySource.get(evidence.sourceAccountId)
    if (account !== undefined) claim(evidence.sourceAccountId, 'accountId', [planId, account], 'movement source-account reference', true)
    claim(evidence.accountOwnershipEvidenceId, 'accountOwnershipEvidence', [planId, ownerPersonId, evidence.sourceAccountId], 'movement ownership evidence reference', true)
    if (classification !== undefined) {
      claim(evidence.iraClassificationEvidenceId, 'iraClassificationEvidence', [classification.sourceAccountId, classification], 'movement classification evidence reference', true)
    }
  }
  for (const balance of yearEndBalances) {
    const account = accountsById.get(balance.sourceAccountId)
    if (account !== undefined) claim(balance.sourceAccountId, 'accountId', [planId, account], 'year-end account reference', true)
    claim(balance.evidenceId, 'yearEndBalanceEvidence', [balance], `year-end evidence ID for ${balance.sourceAccountId}`)
    claim(balance.upstreamEvidenceId, 'yearEndBalanceUpstreamEvidence', [balance], `year-end upstream evidence ID for ${balance.sourceAccountId}`)
  }
  claim(basis.evidenceId, 'annualBasisEvidence', [basisBinding], 'annual basis record evidence ID')
  claim(basis.upstreamEvidenceId, 'annualBasisUpstreamEvidence', [basisBinding], 'annual basis record upstream evidence ID')
  claim(contribution.evidenceId, 'contributionWindowEvidence', [contributionWindowBinding], 'contribution window evidence ID')
  claim(contribution.upstreamEvidenceId, 'contributionWindowUpstreamEvidence', [contributionWindowBinding], 'contribution window upstream evidence ID')
  claim(deadline.evidenceId, 'contributionDeadlineEvidence', [deadlineBinding], 'contribution deadline evidence ID')
  claim(deadline.upstreamEvidenceId, 'contributionDeadlineUpstreamEvidence', [deadlineBinding], 'contribution deadline upstream evidence ID')
  for (const entry of normalizedContributions) {
    const account = accountsById.get(entry.sourceAccountId)
    if (account !== undefined) claim(entry.sourceAccountId, 'accountId', [planId, account], 'contribution account reference', true)
    claim(entry.contributionId, 'postYearContributionId', [entry], 'post-year contribution ID')
    claim(entry.evidenceId, 'postYearContributionEvidence', [entry], 'post-year contribution evidence ID')
    claim(entry.upstreamEvidenceId, 'postYearContributionUpstreamEvidence', [entry], 'post-year contribution upstream evidence ID')
  }
  claim(ownerWideNonRothIraPoolId, 'derivedOwnerWidePoolId', ownerWidePoolBinding, 'derived owner-wide pool ID')
  claim(completePoolEvidenceId, 'derivedCompletePoolEvidenceId', completePoolBinding, 'derived complete-pool evidence ID')
  claim(reconciliationEvidenceId, 'derivedReconciliationEvidenceId', reconciliationBinding, 'derived reconciliation evidence ID')
  if (idIssues.length > 0) return blocked('identifierCollision', idIssues)
  const reconciliationEvidence: PlanOwnedNonRothIraAnnualPostCandidateReconciliationEvidence = {
    predicate: 'planOwnedNonRothIraAnnualPostCandidateClassificationInputReconciled',
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryEvidenceId: inventory.inventoryEvidenceId,
    movementCandidateId: recomputed.movementCandidateId,
    postCandidateSnapshotEvidenceId: snapshot.evidenceId,
    annualBasisRecordEvidenceId: basis.evidenceId,
    contributionWindowEvidenceId: contribution.evidenceId,
    form8606Line1NondeductibleContributionAmount: line1,
    form8606Line4PostYearExcludedContributionAmount: line4,
    form8606Line5BasisAmount: openingBasisAmount,
    form8606Line6AdjustedYearEndAndRolloverAmount: line6,
    form8606Line7DistributionAmount: line7,
    form8606Line8NetConversionAmount: 0,
    form8606Line9DenominatorAmount: line9,
    movement: 'notCommitted',
    actionability: 'notEstablished',
    evidenceId: reconciliationEvidenceId,
  }
  return deepFreeze({
    status: 'postCandidateClassificationInputBuilt',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    classificationInput,
    reconciliationEvidence,
    issues: [],
  })
}
