import { z } from 'zod'

import { planSchema } from '../model/plan.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type AnnualRetirementChronologyInvalidResult,
  type AnnualRetirementInventoryBuiltResult,
  type AnnualRetirementInventoryIncompleteResult,
  type AnnualRetirementPhysicalEvent,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type OwnedNonRothIraAnnualPhysicalEventPoolView,
} from './annualRetirementPhysicalEventInventory.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  evaluateAnnualQcdExecutionPrerequisites,
  type AnnualQcdExecutionPrerequisiteEvidence,
  type EvaluateAnnualQcdExecutionPrerequisitesInput,
} from './annualQcdExecutionPrerequisite.js'
import type { AccountOpeningBalanceSnapshot } from './execution.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
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
import type {
  CompletePlanOwnedNonRothIraLine8InventoryEvidence,
} from './ownedNonRothIraAnnualPlanCoordinator.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface StagedOwnedNonRothIraAnnualEventApplicationInput {
  inventoryEventId: string
  sourceBalanceBefore: UsdCents
  executedAmount: UsdCents
  sourceBalanceAfter: UsdCents
  stagingEvidenceId: string
}

export interface StagedOwnedNonRothIraAnnualContributionApplicationInput {
  inventoryEventId: string
  sourceBalanceBefore: UsdCents
  creditedAmount: UsdCents
  sourceBalanceAfter: UsdCents
  stagingEvidenceId: string
}

export interface PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput
  extends BuildAnnualRetirementPhysicalEventInventoryInput {
  ownerPersonId: PersonId
  openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
  actualApplications:
    readonly Readonly<StagedOwnedNonRothIraAnnualEventApplicationInput>[]
  settledContributionApplications:
    readonly Readonly<StagedOwnedNonRothIraAnnualContributionApplicationInput>[]
  qcdPrerequisiteInput?: Readonly<EvaluateAnnualQcdExecutionPrerequisitesInput>
}

export type OwnedNonRothIraAnnualPhysicalTransactionIssueKind =
  | 'hostileInput'
  | 'ownerInvalid'
  | 'ownerPoolMissing'
  | 'ownerPoolAmbiguous'
  | 'qcdStageRequired'
  | 'qcdStageInvalid'
  | 'qcdApplicationDuplicate'
  | 'qcdApplicationMissing'
  | 'qcdApplicationForeign'
  | 'qcdApplicationMismatch'
  | 'unsupportedPoolActivity'
  | 'openingBalanceInvalid'
  | 'openingBalanceDuplicate'
  | 'openingBalanceMissing'
  | 'openingBalanceForeign'
  | 'actualApplicationInvalid'
  | 'actualApplicationDuplicate'
  | 'actualApplicationMissing'
  | 'actualApplicationForeign'
  | 'contributionApplicationInvalid'
  | 'contributionApplicationDuplicate'
  | 'contributionApplicationMissing'
  | 'contributionApplicationForeign'
  | 'contributionCreditMismatch'
  | 'executionExceedsRequested'
  | 'runtimeExecutionMismatch'
  | 'sourceBalanceMismatch'
  | 'sourceArithmeticMismatch'
  | 'destinationLineageIncomplete'
  | 'destinationInvalid'
  | 'aggregateAmountOverflow'
  | 'identifierCollision'

export interface OwnedNonRothIraAnnualPhysicalTransactionIssue {
  kind: OwnedNonRothIraAnnualPhysicalTransactionIssueKind
  detail: string
  inventoryEventId?: string
  sourceAccountId?: AccountId
}

interface TransactionResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface OwnedNonRothIraAnnualPhysicalTransactionBlockedResult
  extends TransactionResultBase {
  status: 'unifiedAnnualPhysicalTransactionBlocked'
  transactionStatus: 'notEstablished'
  transactionEvidenceId: null
  inventory: Readonly<AnnualRetirementInventoryBuiltResult> | null
  issues: readonly [
    Readonly<OwnedNonRothIraAnnualPhysicalTransactionIssue>,
    ...Readonly<OwnedNonRothIraAnnualPhysicalTransactionIssue>[],
  ]
}

interface OwnedNonRothIraAnnualPhysicalApplicationBase {
  predicate: 'ownedNonRothIraUnifiedAnnualPhysicalApplication'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  inventoryEventId: string
  eventOrigin: AnnualRetirementPhysicalEvent['origin']
  eventKind: AnnualRetirementPhysicalEvent['kind']
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  scheduledDate: string
  scheduledSequence: number
  requestedAmount: UsdCents
  sourceBalanceBefore: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  sourceBalanceAfter: UsdCents
  stagingEvidenceId: string
  applicationEvidenceId: string
}

export interface OwnedNonRothIraAnnualLine7PhysicalApplication
  extends OwnedNonRothIraAnnualPhysicalApplicationBase {
  lineScope: 'form8606Line7Distributions'
  destinationRothAccountId: null
  destinationCreditEvidenceId: null
}

export interface OwnedNonRothIraAnnualLine8PhysicalApplication
  extends OwnedNonRothIraAnnualPhysicalApplicationBase {
  lineScope: 'form8606Line8NetConversions'
  destinationRothAccountId: AccountId
  destinationCreditEvidenceId: string
}

export interface OwnedNonRothIraAnnualQcdPhysicalApplication
  extends OwnedNonRothIraAnnualPhysicalApplicationBase {
  lineScope: 'qcdCharitableDistributions'
  destinationRothAccountId: null
  destinationCreditEvidenceId: null
  qcdPrerequisiteEvidence: Readonly<AnnualQcdExecutionPrerequisiteEvidence>
  qcdPrerequisiteEvidenceId: string
  charityCreditEvidenceId: string
}

export type OwnedNonRothIraAnnualPhysicalApplication =
  | Readonly<OwnedNonRothIraAnnualLine7PhysicalApplication>
  | Readonly<OwnedNonRothIraAnnualLine8PhysicalApplication>
  | Readonly<OwnedNonRothIraAnnualQcdPhysicalApplication>

export interface OwnedNonRothIraSettledAnnualContributionApplication {
  predicate: 'ownedNonRothIraSettledAnnualContributionApplication'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  inventoryEventId: string
  eventOrigin: 'contributionLedger'
  eventKind: 'ownedIraContribution' | 'ownedIraEmployerContribution'
  movementAuthorityId: string
  sourceAccountId: AccountId
  scheduledDate: string
  scheduledSequence: number
  inventoriedAmount: UsdCents
  sourceBalanceBefore: UsdCents
  creditedAmount: UsdCents
  sourceBalanceAfter: UsdCents
  inventoryEventUpstreamEvidenceId: string
  stagingEvidenceId: string
  applicationEvidenceId: string
}

export interface OwnedNonRothIraDetachedAnnualSourceBalanceTransition {
  predicate: 'ownedNonRothIraDetachedAnnualSourceBalanceTransition'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  sourceAccountId: AccountId
  openingBalance: UsdCents
  settledContributionAmount: UsdCents
  requestedAmount: UsdCents
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  detachedClosingBalance: UsdCents
  upstreamEvidenceId: string
  evidenceId: string
}

export interface OwnedNonRothIraDetachedAnnualRothDestinationCredit {
  predicate: 'ownedNonRothIraDetachedAnnualRothDestinationCredit'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  inventoryEventId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  destinationRothAccountId: AccountId
  stagedCreditAmount: UsdCents
  creditStatus: 'detachedCandidateNotCommitted'
  upstreamEvidenceId: string
  evidenceId: string
}

export interface OwnedNonRothIraDetachedAnnualQcdCharityCredit {
  predicate: 'ownedNonRothIraDetachedAnnualQcdCharityCredit'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  inventoryEventId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  charity: NonNullable<Extract<AnnualRetirementPhysicalEvent, { origin: 'planAction' }>['charity']>
  stagedCreditAmount: UsdCents
  creditStatus: 'detachedCandidateNotCommitted'
  upstreamEvidenceId: string
  evidenceId: string
}

export interface PlanOwnedNonRothIraAnnualPhysicalTransactionPreparedResult
  extends TransactionResultBase {
  status: 'unifiedAnnualPhysicalTransactionPrepared'
  transactionStatus: 'appliedToDetachedSnapshotOnly'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  applications: readonly OwnedNonRothIraAnnualPhysicalApplication[]
  settledContributionApplications:
    readonly Readonly<OwnedNonRothIraSettledAnnualContributionApplication>[]
  sourceBalanceTransitions:
    readonly Readonly<OwnedNonRothIraDetachedAnnualSourceBalanceTransition>[]
  stagedDestinationCredits:
    readonly Readonly<OwnedNonRothIraDetachedAnnualRothDestinationCredit>[]
  stagedQcdCharityCredits:
    readonly Readonly<OwnedNonRothIraDetachedAnnualQcdCharityCredit>[]
  line7Entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
  line8Entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
  line7GrossAmount: UsdCents
  line8GrossAmount: UsdCents
  line8InventoryEvidence:
    Readonly<CompletePlanOwnedNonRothIraLine8InventoryEvidence>
  transactionEvidenceId: string
  issues: readonly []
}

export type PreparePlanOwnedNonRothIraAnnualPhysicalTransactionResult =
  | AnnualRetirementInventoryIncompleteResult
  | AnnualRetirementChronologyInvalidResult
  | OwnedNonRothIraAnnualPhysicalTransactionBlockedResult
  | PlanOwnedNonRothIraAnnualPhysicalTransactionPreparedResult

const nonblankString = z.string().refine(
  (value) => value.trim().length > 0,
  { message: 'Identifier must not be blank' },
)

const openingBalanceSchema = z.object({
  accountId: accountIdSchema,
  openingBalance: usdCentsSchema,
}).strict()

const actualApplicationSchema = z.object({
  inventoryEventId: nonblankString,
  sourceBalanceBefore: usdCentsSchema,
  executedAmount: usdCentsSchema,
  sourceBalanceAfter: usdCentsSchema,
  stagingEvidenceId: nonblankString,
}).strict()

const settledContributionApplicationSchema = z.object({
  inventoryEventId: nonblankString,
  sourceBalanceBefore: usdCentsSchema,
  creditedAmount: usdCentsSchema,
  sourceBalanceAfter: usdCentsSchema,
  stagingEvidenceId: nonblankString,
}).strict()

type CanonicalActualApplication = z.infer<typeof actualApplicationSchema>
type CanonicalSettledContributionApplication = z.infer<
  typeof settledContributionApplicationSchema
>

function issue(
  kind: OwnedNonRothIraAnnualPhysicalTransactionIssueKind,
  detail: string,
  bindings: Pick<
    OwnedNonRothIraAnnualPhysicalTransactionIssue,
    'inventoryEventId' | 'sourceAccountId'
  > = {},
): OwnedNonRothIraAnnualPhysicalTransactionIssue {
  return { kind, detail, ...bindings }
}

function canonicalIssues(
  issues: readonly OwnedNonRothIraAnnualPhysicalTransactionIssue[],
): OwnedNonRothIraAnnualPhysicalTransactionIssue[] {
  return [...issues].sort((left, right) =>
    compareUtf16CodeUnits(left.kind, right.kind) ||
    compareUtf16CodeUnits(
      left.inventoryEventId ?? '',
      right.inventoryEventId ?? '',
    ) ||
    compareUtf16CodeUnits(
      left.sourceAccountId ?? '',
      right.sourceAccountId ?? '',
    ) ||
    compareUtf16CodeUnits(left.detail, right.detail),
  )
}

function blocked(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult> | null,
  issues: readonly OwnedNonRothIraAnnualPhysicalTransactionIssue[],
): Readonly<OwnedNonRothIraAnnualPhysicalTransactionBlockedResult> {
  const ordered = canonicalIssues(issues)
  if (ordered.length === 0) {
    throw new Error('A blocked annual physical transaction needs an issue')
  }
  return deepFreeze({
    status: 'unifiedAnnualPhysicalTransactionBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    transactionEvidenceId: null,
    inventory,
    issues: ordered as [
      OwnedNonRothIraAnnualPhysicalTransactionIssue,
      ...OwnedNonRothIraAnnualPhysicalTransactionIssue[],
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

/**
 * Order-invariant charity comparison. Both sides are spread from the same
 * parsed Plan action today, so their key order matches, but a structural
 * equality check must not silently depend on that: a caller-constructed
 * charity with the same fields in a different order is the same designation
 * and must not read as a mismatch.
 */
function canonicalCharity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCharity).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalCharity(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function evidenceIdentifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'evidenceId' || key.endsWith('EvidenceId')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return result
  seen.add(value)
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    evidenceIdentifierValues(child, childKey, result, seen)
  }
  return result
}

function claimIdentifier(
  claimed: Set<string>,
  value: string,
  label: string,
): OwnedNonRothIraAnnualPhysicalTransactionIssue | null {
  if (value.trim().length === 0 || claimed.has(value)) {
    return issue(
      'identifierCollision',
      `${label} must be nonblank and unique across the unified physical-transaction boundary`,
    )
  }
  claimed.add(value)
  return null
}

function claim(
  claimed: Set<string>,
  value: string,
  label: string,
  issues: OwnedNonRothIraAnnualPhysicalTransactionIssue[],
): void {
  const collision = claimIdentifier(claimed, value, label)
  if (collision !== null) issues.push(collision)
}

function inventoryDeclarationEntries(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
): readonly Readonly<{ value: string; label: string }>[] {
  const declaredRuntimeAuthorities = new Set<string>()
  const result: { value: string; label: string }[] = [{
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
    result.push({
      value: event.eventId,
      label: 'Annual physical-event ID',
    })
    if (event.origin !== 'planAction') {
      if (!declaredRuntimeAuthorities.has(event.movementAuthorityId)) {
        declaredRuntimeAuthorities.add(event.movementAuthorityId)
        result.push({
          value: event.movementAuthorityId,
          label: 'Runtime movement-authority ID',
        })
      }
      result.push({
        value: event.upstreamEvidenceId,
        label: 'Runtime event upstream evidence ID',
      })
    }
  }
  return result
}

function safeSum(
  values: readonly UsdCents[],
  label: string,
  issues: OwnedNonRothIraAnnualPhysicalTransactionIssue[],
): UsdCents | null {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    issues.push(issue(
      'aggregateAmountOverflow',
      `${label} must remain within the exact-cent safe-integer range`,
    ))
    return null
  }
  return asUsdCents(Number(total))
}

function eventLineScope(
  event: AnnualRetirementPhysicalEvent,
): 'form8606Line7Distributions' | 'form8606Line8NetConversions' | 'qcdCharitableDistributions' {
  if (event.form8606Category === 'qcdCandidateAwaitingAnnualQcdStage') {
    return 'qcdCharitableDistributions'
  }
  return event.form8606Category === 'line8ConversionCandidate'
    ? 'form8606Line8NetConversions'
    : 'form8606Line7Distributions'
}

function isSettledContributionEvent(
  event: AnnualRetirementPhysicalEvent,
): event is Extract<AnnualRetirementPhysicalEvent, { origin: Exclude<
  AnnualRetirementPhysicalEvent['origin'], 'planAction'
> }> & {
  kind: 'ownedIraContribution' | 'ownedIraEmployerContribution'
} {
  return event.kind === 'ownedIraContribution' ||
    event.kind === 'ownedIraEmployerContribution'
}

function runtimeActionId(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  event: Exclude<AnnualRetirementPhysicalEvent, { origin: 'planAction' }>,
): ActionId {
  return actionIdSchema.parse(deriveActionStructuralId(
    'owned-ira-unified-runtime-action',
    [
      inventory.planId,
      inventory.taxYear,
      inventory.ledgerRunId,
      event.movementAuthorityId,
      event.ownerPersonId,
      event.kind,
      event.eventDate,
      event.eventSequence,
    ],
  ))
}

function runtimeAllocationId(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  event: Exclude<AnnualRetirementPhysicalEvent, { origin: 'planAction' }>,
): AllocationId {
  return allocationIdSchema.parse(deriveActionStructuralId(
    'owned-ira-unified-runtime-allocation',
    [
      inventory.planId,
      inventory.taxYear,
      inventory.ledgerRunId,
      event.eventId,
      event.sourceAccountId,
    ],
  ))
}

function selectedPool(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  ownerPersonId: PersonId,
  issues: OwnedNonRothIraAnnualPhysicalTransactionIssue[],
): Readonly<OwnedNonRothIraAnnualPhysicalEventPoolView> | null {
  const matches = inventory.ownedIraPools.filter(
    (pool) => pool.ownerPersonId === ownerPersonId,
  )
  if (matches.length === 0) {
    issues.push(issue(
      'ownerPoolMissing',
      'The selected owner has no owned non-Roth IRA annual pool',
    ))
    return null
  }
  if (matches.length !== 1) {
    issues.push(issue(
      'ownerPoolAmbiguous',
      'The selected owner must bind exactly one owned non-Roth IRA annual pool',
    ))
    return null
  }
  return matches[0]!
}

function prepare(
  input: Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput>,
): Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionResult> {
  const inventory = buildAnnualRetirementPhysicalEventInventory(input)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') return inventory

  const issues: OwnedNonRothIraAnnualPhysicalTransactionIssue[] = []
  const parsedOwner = personIdSchema.safeParse(input.ownerPersonId)
  if (!parsedOwner.success) {
    return blocked(inventory, [issue(
      'ownerInvalid',
      'The annual physical transaction owner must be a nonblank stable person ID',
    )])
  }
  const ownerPersonId = parsedOwner.data
  const pool = selectedPool(inventory, ownerPersonId, issues)
  if (pool === null) return blocked(inventory, issues)

  const plan = planSchema.parse(input.plan)
  const qcdEvents = pool.qcdCandidateAwaitingAnnualQcdStage.events
  let qcdPrerequisites: readonly Readonly<AnnualQcdExecutionPrerequisiteEvidence>[] = []
  if (qcdEvents.length > 0 && input.qcdPrerequisiteInput === undefined) {
    issues.push(issue(
      'qcdStageRequired',
      'Owned IRA QCD events require their rebuilt preflight/candidate evidence before the unified transaction can be complete',
    ))
  } else if (input.qcdPrerequisiteInput !== undefined) {
    const rebuilt = evaluateAnnualQcdExecutionPrerequisites({
      ...input.qcdPrerequisiteInput,
      taxYear: inventory.taxYear,
      plan,
    })
    if (rebuilt.status !== 'evaluated' || rebuilt.taxYear !== inventory.taxYear) {
      issues.push(issue(
        'qcdStageInvalid',
        'QCD preflight/candidate evidence must rebuild successfully for this exact transaction Plan and tax year',
      ))
    } else {
      qcdPrerequisites = rebuilt.evidence
    }
  }
  const settledContributionEvents =
    pool.nonForm8606OrForeignPoolEvent.events.filter(
      isSettledContributionEvent,
    )
  const unsupportedPoolEvents =
    pool.nonForm8606OrForeignPoolEvent.events.filter(
      (event) => !isSettledContributionEvent(event),
    )
  if (unsupportedPoolEvents.length > 0) {
    issues.push(issue(
      'unsupportedPoolActivity',
      'Owned IRA pool activity outside Form 8606 lines 7 and 8 must be a settled owned-IRA contribution; QCD, rollover, transfer, and other activity requires a broader physical ledger stage',
    ))
  }

  const claimed = identifierValues(plan)
  const planEvidenceIds = evidenceIdentifierValues(plan)
  for (const declaration of inventoryDeclarationEntries(inventory)) {
    claim(claimed, declaration.value, declaration.label, issues)
  }
  identifierValues(inventory, '', claimed)

  const openingBySource = new Map<AccountId, AccountOpeningBalanceSnapshot>()
  const poolSourceIds = new Set(pool.sourceAccountIds)
  const parsedOpenings = z.array(openingBalanceSchema).safeParse(
    input.openingBalances,
  )
  if (!parsedOpenings.success) {
    issues.push(issue(
      'openingBalanceInvalid',
      'Every opening balance must contain only a valid account ID and nonnegative safe-integer cents',
    ))
  } else {
    for (const opening of parsedOpenings.data) {
      if (openingBySource.has(opening.accountId)) {
        issues.push(issue(
          'openingBalanceDuplicate',
          'Opening balances must contain exactly one entry per owner-pool source',
          { sourceAccountId: opening.accountId },
        ))
        continue
      }
      openingBySource.set(opening.accountId, opening)
      if (!poolSourceIds.has(opening.accountId)) {
        issues.push(issue(
          'openingBalanceForeign',
          'Opening balance is foreign to the selected owner pool',
          { sourceAccountId: opening.accountId },
        ))
      }
    }
  }
  for (const sourceAccountId of pool.sourceAccountIds) {
    if (!openingBySource.has(sourceAccountId)) {
      issues.push(issue(
        'openingBalanceMissing',
        'Every selected owner-pool source requires one exact opening balance, including unchanged siblings',
        { sourceAccountId },
      ))
    }
  }

  const expectedEvents = pool.events.filter((event) =>
    event.form8606Category === 'line7DistributionCandidate' ||
    event.form8606Category === 'line8ConversionCandidate',
  )
  const expectedById = new Map(expectedEvents.map((event) => [event.eventId, event]))
  const actualByEventId = new Map<string, CanonicalActualApplication>()
  const parsedActual = z.array(actualApplicationSchema).safeParse(
    input.actualApplications,
  )
  if (!parsedActual.success) {
    issues.push(issue(
      'actualApplicationInvalid',
      'Every actual application must contain only an inventory event ID, exact before/executed/after cents, and staging evidence ID',
    ))
  } else {
    for (const actual of parsedActual.data) {
      if (actualByEventId.has(actual.inventoryEventId)) {
        issues.push(issue(
          'actualApplicationDuplicate',
          'Actual applications must bind each inventory event exactly once',
          { inventoryEventId: actual.inventoryEventId },
        ))
        continue
      }
      actualByEventId.set(actual.inventoryEventId, actual)
      if (!expectedById.has(actual.inventoryEventId)) {
        issues.push(issue(
          'actualApplicationForeign',
          'Actual application is foreign to the selected owner line-7/line-8 event set',
          { inventoryEventId: actual.inventoryEventId },
        ))
      }
      claim(
        claimed,
        actual.stagingEvidenceId,
        'Actual staging evidence ID',
        issues,
      )
    }
  }
  for (const event of expectedEvents) {
    if (!actualByEventId.has(event.eventId)) {
      issues.push(issue(
        'actualApplicationMissing',
        'Every selected owner line-7/line-8 inventory event requires one actual staged application, including zero executions',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
    if (
      event.form8606Category === 'line8ConversionCandidate' &&
      event.origin !== 'planAction'
    ) {
      issues.push(issue(
        'destinationLineageIncomplete',
        'Runtime conversion inventory does not carry a Roth destination and cannot be completed by inference',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
  }

  const qcdPrerequisiteByEventId = new Map<
    string,
    Readonly<AnnualQcdExecutionPrerequisiteEvidence>
  >()
  const qcdEventByAction = new Map(qcdEvents.flatMap((event) =>
    event.origin === 'planAction' ? [[event.actionId, event] as const] : [],
  ))
  const seenQcdActions = new Set<ActionId>()
  for (const prerequisite of qcdPrerequisites.filter(
    (entry) => entry.request.donorPersonId === ownerPersonId,
  )) {
    if (seenQcdActions.has(prerequisite.actionId)) {
      issues.push(issue(
        'qcdApplicationDuplicate',
        'QCD preflight evidence must contain one member per owner action',
      ))
      continue
    }
    seenQcdActions.add(prerequisite.actionId)
    const event = qcdEventByAction.get(prerequisite.actionId)
    if (event === undefined) {
      issues.push(issue(
        'qcdApplicationForeign',
        'QCD preflight evidence is foreign to the selected owner inventory',
      ))
      continue
    }
    const request = prerequisite.request
    if (
      event.origin !== 'planAction' || event.kind !== 'qcd' ||
      event.allocationId !== request.allocation.allocationId ||
      event.sourceAccountId !== request.allocation.sourceAccountId ||
      event.ownerPersonId !== request.donorPersonId ||
      event.eventDate !== request.executionDate ||
      event.eventSequence !== request.executionSequence ||
      event.grossAmount !== request.requestedAmount ||
      canonicalCharity(event.charity) !== canonicalCharity(request.charity)
    ) {
      issues.push(issue(
        'qcdApplicationMismatch',
        'QCD preflight action/allocation/source/charity/chronology/amount evidence must exactly match its inventory event',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
      continue
    }
    for (const evidenceId of evidenceIdentifierValues(prerequisite)) {
      if (planEvidenceIds.has(evidenceId)) claimed.add(evidenceId)
      else claim(claimed, evidenceId, 'QCD nested preflight evidence ID', issues)
    }
    qcdPrerequisiteByEventId.set(event.eventId, prerequisite)
  }
  for (const event of qcdEvents) {
    if (!qcdPrerequisiteByEventId.has(event.eventId)) {
      issues.push(issue(
        'qcdApplicationMissing',
        'Every selected owner QCD inventory event requires one exact rebuilt preflight member',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
  }

  const expectedContributionById = new Map(
    settledContributionEvents.map((event) => [event.eventId, event]),
  )
  const settledContributionByEventId = new Map<
    string,
    CanonicalSettledContributionApplication
  >()
  const parsedContributions = z.array(
    settledContributionApplicationSchema,
  ).safeParse(input.settledContributionApplications)
  if (!parsedContributions.success) {
    issues.push(issue(
      'contributionApplicationInvalid',
      'Every settled contribution application must contain only an inventory event ID, exact before/credited/after cents, and staging evidence ID',
    ))
  } else {
    for (const contribution of parsedContributions.data) {
      if (settledContributionByEventId.has(contribution.inventoryEventId)) {
        issues.push(issue(
          'contributionApplicationDuplicate',
          'Settled contribution applications must bind each contribution inventory event exactly once',
          { inventoryEventId: contribution.inventoryEventId },
        ))
        continue
      }
      settledContributionByEventId.set(
        contribution.inventoryEventId,
        contribution,
      )
      if (!expectedContributionById.has(contribution.inventoryEventId)) {
        issues.push(issue(
          'contributionApplicationForeign',
          'Settled contribution application is foreign to the selected owner contribution event set',
          { inventoryEventId: contribution.inventoryEventId },
        ))
      }
      claim(
        claimed,
        contribution.stagingEvidenceId,
        'Settled contribution staging evidence ID',
        issues,
      )
    }
  }
  for (const event of settledContributionEvents) {
    if (!settledContributionByEventId.has(event.eventId)) {
      issues.push(issue(
        'contributionApplicationMissing',
        'Every selected owner contribution inventory event requires one settled contribution application',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
  }
  if (issues.length > 0) return blocked(inventory, issues)

  const currentBalanceBySource = new Map<AccountId, UsdCents>(
    pool.sourceAccountIds.map((sourceAccountId) => [
      sourceAccountId,
      openingBySource.get(sourceAccountId)!.openingBalance,
    ]),
  )
  const applications: OwnedNonRothIraAnnualPhysicalApplication[] = []
  const settledContributionApplications:
    OwnedNonRothIraSettledAnnualContributionApplication[] = []
  const stagedDestinationCredits:
    OwnedNonRothIraDetachedAnnualRothDestinationCredit[] = []
  const stagedQcdCharityCredits:
    OwnedNonRothIraDetachedAnnualQcdCharityCredit[] = []
  const runtimeActionIds = new Map<string, ActionId>()
  const sourceChainEvidenceByEventId = new Map<string, readonly unknown[]>()

  const stagedEvents = pool.events.filter((event) =>
    expectedById.has(event.eventId) ||
    qcdPrerequisiteByEventId.has(event.eventId) ||
    expectedContributionById.has(event.eventId),
  )
  for (const event of stagedEvents) {
    if (isSettledContributionEvent(event)) {
      const contribution = settledContributionByEventId.get(event.eventId)!
      const currentBalance = currentBalanceBySource.get(event.sourceAccountId)!
      if (contribution.sourceBalanceBefore !== currentBalance) {
        issues.push(issue(
          'sourceBalanceMismatch',
          'Settled contribution source balance before the event must equal the detached source chain',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      }
      if (contribution.creditedAmount !== event.grossAmount) {
        issues.push(issue(
          'contributionCreditMismatch',
          'A resolved owned-IRA contribution must credit its exact inventoried gross amount',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      }
      const expectedAfter = BigInt(contribution.sourceBalanceBefore) +
        BigInt(contribution.creditedAmount)
      if (
        expectedAfter > BigInt(Number.MAX_SAFE_INTEGER) ||
        BigInt(contribution.sourceBalanceAfter) !== expectedAfter
      ) {
        issues.push(issue(
          'sourceArithmeticMismatch',
          'Settled contribution source balance after the event must equal before plus credited within the exact-cent safe-integer range',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      }

      const applicationWithoutEvidence = {
        predicate: 'ownedNonRothIraSettledAnnualContributionApplication' as const,
        planId: inventory.planId,
        ownerPersonId,
        taxYear: inventory.taxYear,
        ledgerRunId: inventory.ledgerRunId,
        inventoryEvidenceId: inventory.inventoryEvidenceId,
        inventoryEventId: event.eventId,
        eventOrigin: 'contributionLedger' as const,
        eventKind: event.kind,
        movementAuthorityId: event.movementAuthorityId,
        sourceAccountId: event.sourceAccountId,
        scheduledDate: event.eventDate,
        scheduledSequence: event.eventSequence,
        inventoriedAmount: asUsdCents(event.grossAmount),
        sourceBalanceBefore: contribution.sourceBalanceBefore,
        creditedAmount: contribution.creditedAmount,
        sourceBalanceAfter: contribution.sourceBalanceAfter,
        inventoryEventUpstreamEvidenceId: event.upstreamEvidenceId,
        stagingEvidenceId: contribution.stagingEvidenceId,
      }
      const applicationEvidenceId = deriveActionStructuralId(
        'owned-ira-unified-annual-settled-contribution-application',
        [applicationWithoutEvidence],
      )
      claim(
        claimed,
        applicationEvidenceId,
        'Derived settled contribution-application evidence ID',
        issues,
      )
      settledContributionApplications.push({
        ...applicationWithoutEvidence,
        applicationEvidenceId,
      })
      sourceChainEvidenceByEventId.set(event.eventId, [
        event.eventId,
        event.upstreamEvidenceId,
        contribution.stagingEvidenceId,
        applicationEvidenceId,
        contribution.sourceBalanceBefore,
        contribution.creditedAmount,
        contribution.sourceBalanceAfter,
      ])
      currentBalanceBySource.set(
        event.sourceAccountId,
        contribution.sourceBalanceAfter,
      )
      continue
    }
    const currentBalance = currentBalanceBySource.get(event.sourceAccountId)!
    const qcdPrerequisite = qcdPrerequisiteByEventId.get(event.eventId)
    const qcdPrerequisiteEvidenceId = qcdPrerequisite === undefined ? null
      : deriveActionStructuralId(
        'annual-qcd-execution-prerequisite',
        [qcdPrerequisite],
      )
    if (qcdPrerequisiteEvidenceId !== null) {
      claim(
        claimed,
        qcdPrerequisiteEvidenceId,
        'Derived QCD prerequisite evidence ID',
        issues,
      )
    }
    const actual = qcdPrerequisite === undefined
      ? actualByEventId.get(event.eventId)!
      : {
          inventoryEventId: event.eventId,
          sourceBalanceBefore: currentBalance,
          executedAmount: asUsdCents(Math.min(event.grossAmount, currentBalance)),
          sourceBalanceAfter: asUsdCents(
            currentBalance - Math.min(event.grossAmount, currentBalance),
          ),
          stagingEvidenceId: qcdPrerequisiteEvidenceId!,
        }
    if (actual.sourceBalanceBefore !== currentBalance) {
      issues.push(issue(
        'sourceBalanceMismatch',
        'Actual source balance before the event must equal the detached source chain',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
    if (event.origin === 'planAction') {
      if (actual.executedAmount > event.grossAmount) {
        issues.push(issue(
          'executionExceedsRequested',
          'A Plan event cannot execute more than its inventory-derived requested amount',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      }
    } else if (actual.executedAmount !== event.grossAmount) {
      issues.push(issue(
        'runtimeExecutionMismatch',
        'A resolved runtime physical event must execute its exact inventoried gross amount',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }
    if (
      actual.executedAmount > actual.sourceBalanceBefore ||
      actual.sourceBalanceAfter !==
        actual.sourceBalanceBefore - actual.executedAmount
    ) {
      issues.push(issue(
        'sourceArithmeticMismatch',
        'Actual source balance after the event must equal before minus executed without overdraft',
        { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
      ))
    }

    let actionId: ActionId
    let allocationId: AllocationId
    if (event.origin === 'planAction') {
      actionId = event.actionId
      allocationId = event.allocationId
    } else {
      const existingActionId = runtimeActionIds.get(event.movementAuthorityId)
      actionId = existingActionId ?? runtimeActionId(inventory, event)
      if (existingActionId === undefined) {
        runtimeActionIds.set(event.movementAuthorityId, actionId)
        claim(claimed, actionId, 'Derived runtime action ID', issues)
      }
      allocationId = runtimeAllocationId(inventory, event)
      claim(claimed, allocationId, 'Derived runtime allocation ID', issues)
    }

    const lineScope = eventLineScope(event)
    const unexecutedAmount = asUsdCents(Math.max(
      0,
      event.grossAmount - actual.executedAmount,
    ))
    const applicationWithoutEvidence = {
      predicate: 'ownedNonRothIraUnifiedAnnualPhysicalApplication' as const,
      planId: inventory.planId,
      ownerPersonId,
      taxYear: inventory.taxYear,
      ledgerRunId: inventory.ledgerRunId,
      inventoryEvidenceId: inventory.inventoryEvidenceId,
      inventoryEventId: event.eventId,
      eventOrigin: event.origin,
      eventKind: event.kind,
      lineScope,
      actionId,
      allocationId,
      sourceAccountId: event.sourceAccountId,
      scheduledDate: event.eventDate,
      scheduledSequence: event.eventSequence,
      requestedAmount: asUsdCents(event.grossAmount),
      sourceBalanceBefore: actual.sourceBalanceBefore,
      executedAmount: actual.executedAmount,
      unexecutedAmount,
      sourceBalanceAfter: actual.sourceBalanceAfter,
      stagingEvidenceId: actual.stagingEvidenceId,
    }
    const applicationEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-physical-application',
      [applicationWithoutEvidence, qcdPrerequisite ?? null],
    )
    claim(
      claimed,
      applicationEvidenceId,
      'Derived physical-application evidence ID',
      issues,
    )

    if (lineScope === 'qcdCharitableDistributions') {
      if (
        event.origin !== 'planAction' || event.kind !== 'qcd' ||
        event.charity === null || qcdPrerequisite === undefined ||
        qcdPrerequisiteEvidenceId === null
      ) {
        issues.push(issue(
          'qcdApplicationMismatch',
          'A QCD application requires one Plan QCD event, charity, and rebuilt preflight member',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      } else {
        const creditWithoutEvidence = {
          predicate: 'ownedNonRothIraDetachedAnnualQcdCharityCredit' as const,
          planId: inventory.planId,
          ownerPersonId,
          taxYear: inventory.taxYear,
          ledgerRunId: inventory.ledgerRunId,
          inventoryEvidenceId: inventory.inventoryEvidenceId,
          inventoryEventId: event.eventId,
          actionId,
          allocationId,
          sourceAccountId: event.sourceAccountId,
          charity: event.charity,
          stagedCreditAmount: actual.executedAmount,
          creditStatus: 'detachedCandidateNotCommitted' as const,
          upstreamEvidenceId: applicationEvidenceId,
        }
        const charityCreditEvidenceId = deriveActionStructuralId(
          'owned-ira-unified-annual-qcd-charity-credit',
          [creditWithoutEvidence],
        )
        claim(
          claimed,
          charityCreditEvidenceId,
          'Derived QCD charity-credit evidence ID',
          issues,
        )
        stagedQcdCharityCredits.push({
          ...creditWithoutEvidence,
          evidenceId: charityCreditEvidenceId,
        })
        applications.push({
          ...applicationWithoutEvidence,
          lineScope,
          destinationRothAccountId: null,
          destinationCreditEvidenceId: null,
          qcdPrerequisiteEvidence: qcdPrerequisite,
          qcdPrerequisiteEvidenceId,
          charityCreditEvidenceId,
          applicationEvidenceId,
        })
      }
    } else if (lineScope === 'form8606Line7Distributions') {
      applications.push({
        ...applicationWithoutEvidence,
        lineScope,
        destinationRothAccountId: null,
        destinationCreditEvidenceId: null,
        applicationEvidenceId,
      })
    } else if (event.origin === 'planAction') {
      const destination = plan.accounts.find(
        (account) => account.id === event.destinationRothAccountId,
      )
      if (
        event.destinationRothAccountId === null ||
        destination?.type !== 'roth' ||
        destination.kind !== 'ira' ||
        destination.ownerPersonId !== ownerPersonId
      ) {
        issues.push(issue(
          'destinationInvalid',
          'A conversion destination must be the inventory-derived same-owner Roth IRA',
          { inventoryEventId: event.eventId, sourceAccountId: event.sourceAccountId },
        ))
      } else {
        const creditWithoutEvidence = {
          predicate: 'ownedNonRothIraDetachedAnnualRothDestinationCredit' as const,
          planId: inventory.planId,
          ownerPersonId,
          taxYear: inventory.taxYear,
          ledgerRunId: inventory.ledgerRunId,
          inventoryEvidenceId: inventory.inventoryEvidenceId,
          inventoryEventId: event.eventId,
          actionId,
          allocationId,
          sourceAccountId: event.sourceAccountId,
          destinationRothAccountId: event.destinationRothAccountId,
          stagedCreditAmount: actual.executedAmount,
          creditStatus: 'detachedCandidateNotCommitted' as const,
          upstreamEvidenceId: actual.stagingEvidenceId,
        }
        const destinationCreditEvidenceId = deriveActionStructuralId(
          'owned-ira-unified-annual-roth-destination-credit',
          [creditWithoutEvidence],
        )
        claim(
          claimed,
          destinationCreditEvidenceId,
          'Derived Roth destination-credit evidence ID',
          issues,
        )
        stagedDestinationCredits.push({
          ...creditWithoutEvidence,
          evidenceId: destinationCreditEvidenceId,
        })
        applications.push({
          ...applicationWithoutEvidence,
          lineScope,
          destinationRothAccountId: event.destinationRothAccountId,
          destinationCreditEvidenceId,
          applicationEvidenceId,
        })
      }
    }
    sourceChainEvidenceByEventId.set(event.eventId, [
      event.eventId,
      actual.stagingEvidenceId,
      applicationEvidenceId,
      actual.sourceBalanceBefore,
      actual.executedAmount,
      actual.sourceBalanceAfter,
    ])
    currentBalanceBySource.set(
      event.sourceAccountId,
      actual.sourceBalanceAfter,
    )
  }
  if (issues.length > 0) return blocked(inventory, issues)

  const positiveEntries = (lineScope:
    'form8606Line7Distributions' | 'form8606Line8NetConversions',
  ): AnnualIraBasisAllocationEntryInput[] => applications
    .filter((application) =>
      application.lineScope === lineScope && application.executedAmount > 0,
    )
    .map((application) => ({
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      scheduledDate: application.scheduledDate,
      scheduledSequence: application.scheduledSequence,
      grossAmount: application.executedAmount,
    }))
  const line7Entries = positiveEntries('form8606Line7Distributions')
  const line8Entries = positiveEntries('form8606Line8NetConversions')
  const line7GrossAmount = safeSum(
    line7Entries.map((entry) => entry.grossAmount),
    'Line 7 executed gross amount',
    issues,
  )
  const line8GrossAmount = safeSum(
    line8Entries.map((entry) => entry.grossAmount),
    'Line 8 executed gross amount',
    issues,
  )

  const sourceBalanceTransitions:
    OwnedNonRothIraDetachedAnnualSourceBalanceTransition[] = []
  for (const sourceAccountId of pool.sourceAccountIds) {
    const sourceApplications = applications.filter(
      (application) => application.sourceAccountId === sourceAccountId,
    )
    const sourceContributions = settledContributionApplications.filter(
      (contribution) => contribution.sourceAccountId === sourceAccountId,
    )
    const settledContributionAmount = safeSum(
      sourceContributions.map((contribution) => contribution.creditedAmount),
      `Settled contribution amount for source ${sourceAccountId}`,
      issues,
    )
    const requestedAmount = safeSum(
      sourceApplications.map((application) => application.requestedAmount),
      `Requested amount for source ${sourceAccountId}`,
      issues,
    )
    const executedAmount = safeSum(
      sourceApplications.map((application) => application.executedAmount),
      `Executed amount for source ${sourceAccountId}`,
      issues,
    )
    const unexecutedAmount = safeSum(
      sourceApplications.map((application) => application.unexecutedAmount),
      `Unexecuted amount for source ${sourceAccountId}`,
      issues,
    )
    if (
      settledContributionAmount === null ||
      requestedAmount === null ||
      executedAmount === null ||
      unexecutedAmount === null
    ) continue
    const transitionUpstreamEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-source-balance-upstream',
      [
        inventory.inventoryEvidenceId,
        sourceAccountId,
        openingBySource.get(sourceAccountId)!.openingBalance,
        pool.events
          .filter((event) => event.sourceAccountId === sourceAccountId)
          .flatMap((event) => {
            const entry = sourceChainEvidenceByEventId.get(event.eventId)
            return entry === undefined ? [] : [entry]
          }),
      ],
    )
    claim(
      claimed,
      transitionUpstreamEvidenceId,
      'Derived source-balance-transition upstream evidence ID',
      issues,
    )
    const transitionWithoutEvidence = {
      predicate: 'ownedNonRothIraDetachedAnnualSourceBalanceTransition' as const,
      planId: inventory.planId,
      ownerPersonId,
      taxYear: inventory.taxYear,
      ledgerRunId: inventory.ledgerRunId,
      inventoryEvidenceId: inventory.inventoryEvidenceId,
      sourceAccountId,
      openingBalance: openingBySource.get(sourceAccountId)!.openingBalance,
      settledContributionAmount,
      requestedAmount,
      executedAmount,
      unexecutedAmount,
      detachedClosingBalance: currentBalanceBySource.get(sourceAccountId)!,
      upstreamEvidenceId: transitionUpstreamEvidenceId,
    }
    const evidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-source-balance-transition',
      [transitionWithoutEvidence],
    )
    claim(
      claimed,
      evidenceId,
      'Derived source-balance-transition evidence ID',
      issues,
    )
    sourceBalanceTransitions.push({ ...transitionWithoutEvidence, evidenceId })
  }
  if (
    line7GrossAmount === null ||
    line8GrossAmount === null ||
    issues.length > 0
  ) return blocked(inventory, issues)

  const line8UpstreamEvidenceId = deriveActionStructuralId(
    'owned-ira-unified-line8-inventory-upstream',
    [
      inventory.inventoryEvidenceId,
      ownerPersonId,
      applications
        .filter((application) =>
          application.lineScope === 'form8606Line8NetConversions',
        )
        .map((application) => application.applicationEvidenceId),
    ],
  )
  claim(
    claimed,
    line8UpstreamEvidenceId,
    'Derived line-8 inventory upstream evidence ID',
    issues,
  )
  const line8WithoutEvidence = {
    predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory' as const,
    planId: inventory.planId,
    ownerPersonId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    entries: line8Entries,
    upstreamEvidenceId: line8UpstreamEvidenceId,
  }
  const line8EvidenceId = deriveActionStructuralId(
    'owned-ira-unified-line8-inventory',
    [line8WithoutEvidence],
  )
  claim(
    claimed,
    line8EvidenceId,
    'Derived line-8 inventory evidence ID',
    issues,
  )
  const line8InventoryEvidence: CompletePlanOwnedNonRothIraLine8InventoryEvidence = {
    ...line8WithoutEvidence,
    evidenceId: line8EvidenceId,
  }

  const transactionWithoutEvidence = {
    planId: inventory.planId,
    ownerPersonId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventoryEvidenceId: inventory.inventoryEvidenceId,
    applications,
    settledContributionApplications,
    sourceBalanceTransitions,
    stagedDestinationCredits,
    stagedQcdCharityCredits,
    line7Entries,
    line8Entries,
    line7GrossAmount,
    line8GrossAmount,
    line8InventoryEvidence,
  }
  const transactionEvidenceId = deriveActionStructuralId(
    'owned-ira-unified-annual-physical-transaction',
    [transactionWithoutEvidence],
  )
  claim(
    claimed,
    transactionEvidenceId,
    'Derived unified annual physical-transaction evidence ID',
    issues,
  )
  if (issues.length > 0) return blocked(inventory, issues)

  return deepFreeze({
    status: 'unifiedAnnualPhysicalTransactionPrepared',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    transactionStatus: 'appliedToDetachedSnapshotOnly',
    planId: inventory.planId,
    ownerPersonId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    inventory,
    applications,
    settledContributionApplications,
    sourceBalanceTransitions,
    stagedDestinationCredits,
    stagedQcdCharityCredits,
    line7Entries,
    line8Entries,
    line7GrossAmount,
    line8GrossAmount,
    line8InventoryEvidence,
    transactionEvidenceId,
    issues: [],
  })
}

/**
 * Rejoins complete annual inventory events to physical staging facts. Rebuilt
 * QCD preflight members become candidates whose debit and charity credit are
 * staged exactly once by this chronology. The detached result neither mutates
 * balances nor establishes QCD tax character, actionability, or movement authority.
 */
export function preparePlanOwnedNonRothIraAnnualPhysicalTransaction(
  input: Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput>,
): Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionResult> {
  try {
    return prepare(input)
  } catch {
    return blocked(null, [issue(
      'hostileInput',
      'The annual physical transaction input could not be read or canonicalized safely',
    )])
  }
}
