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

export interface StagedOwnedNonRothIraAnnualEventApplicationInput {
  inventoryEventId: string
  sourceBalanceBefore: UsdCents
  executedAmount: UsdCents
  sourceBalanceAfter: UsdCents
  stagingEvidenceId: string
}

export interface PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput
  extends BuildAnnualRetirementPhysicalEventInventoryInput {
  ownerPersonId: PersonId
  openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
  actualApplications:
    readonly Readonly<StagedOwnedNonRothIraAnnualEventApplicationInput>[]
}

export type OwnedNonRothIraAnnualPhysicalTransactionIssueKind =
  | 'hostileInput'
  | 'ownerInvalid'
  | 'ownerPoolMissing'
  | 'ownerPoolAmbiguous'
  | 'qcdStageRequired'
  | 'unsupportedPoolActivity'
  | 'openingBalanceInvalid'
  | 'openingBalanceDuplicate'
  | 'openingBalanceMissing'
  | 'openingBalanceForeign'
  | 'actualApplicationInvalid'
  | 'actualApplicationDuplicate'
  | 'actualApplicationMissing'
  | 'actualApplicationForeign'
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

export type OwnedNonRothIraAnnualPhysicalApplication =
  | Readonly<OwnedNonRothIraAnnualLine7PhysicalApplication>
  | Readonly<OwnedNonRothIraAnnualLine8PhysicalApplication>

export interface OwnedNonRothIraDetachedAnnualSourceBalanceTransition {
  predicate: 'ownedNonRothIraDetachedAnnualSourceBalanceTransition'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  sourceAccountId: AccountId
  openingBalance: UsdCents
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
  sourceBalanceTransitions:
    readonly Readonly<OwnedNonRothIraDetachedAnnualSourceBalanceTransition>[]
  stagedDestinationCredits:
    readonly Readonly<OwnedNonRothIraDetachedAnnualRothDestinationCredit>[]
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

type CanonicalActualApplication = z.infer<typeof actualApplicationSchema>

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

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
): 'form8606Line7Distributions' | 'form8606Line8NetConversions' {
  return event.form8606Category === 'line8ConversionCandidate'
    ? 'form8606Line8NetConversions'
    : 'form8606Line7Distributions'
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

  if (pool.qcdCandidateAwaitingAnnualQcdStage.events.length > 0) {
    issues.push(issue(
      'qcdStageRequired',
      'Owned IRA QCD events require their annual QCD stage before this line-7/line-8 transaction can be complete',
    ))
  }
  if (pool.nonForm8606OrForeignPoolEvent.events.length > 0) {
    issues.push(issue(
      'unsupportedPoolActivity',
      'Owned IRA pool activity outside Form 8606 lines 7 and 8 requires a broader physical ledger stage',
    ))
  }

  const plan = planSchema.parse(input.plan)
  const claimed = identifierValues(plan)
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
  if (issues.length > 0) return blocked(inventory, issues)

  const currentBalanceBySource = new Map<AccountId, UsdCents>(
    pool.sourceAccountIds.map((sourceAccountId) => [
      sourceAccountId,
      openingBySource.get(sourceAccountId)!.openingBalance,
    ]),
  )
  const applications: OwnedNonRothIraAnnualPhysicalApplication[] = []
  const stagedDestinationCredits:
    OwnedNonRothIraDetachedAnnualRothDestinationCredit[] = []
  const runtimeActionIds = new Map<string, ActionId>()

  for (const event of expectedEvents) {
    const actual = actualByEventId.get(event.eventId)!
    const currentBalance = currentBalanceBySource.get(event.sourceAccountId)!
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
      [applicationWithoutEvidence],
    )
    claim(
      claimed,
      applicationEvidenceId,
      'Derived physical-application evidence ID',
      issues,
    )

    if (lineScope === 'form8606Line7Distributions') {
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
        sourceApplications.map((application) => [
          application.inventoryEventId,
          application.stagingEvidenceId,
          application.applicationEvidenceId,
          application.sourceBalanceBefore,
          application.executedAmount,
          application.sourceBalanceAfter,
        ]),
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
    sourceBalanceTransitions,
    stagedDestinationCredits,
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
    sourceBalanceTransitions,
    stagedDestinationCredits,
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
 * Rejoins complete annual inventory events to caller-supplied physical staging
 * facts. The result is detached evidence only: it neither mutates source/Roth
 * balances nor establishes tax character, actionability, or movement authority.
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
