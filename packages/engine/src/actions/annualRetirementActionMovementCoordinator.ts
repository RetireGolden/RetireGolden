import { planSchema, type Plan } from '../model/plan.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type AnnualRetirementChronologyInvalidResult,
  type AnnualRetirementInventoryIncompleteResult,
  type AnnualRetirementInventoryBuiltResult,
  type AnnualRetirementPhysicalEvent,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type StandaloneOwnedIraExecutorCompatibility,
  type UnifiedAnnualLedgerCompatibility,
} from './annualRetirementPhysicalEventInventory.js'
import type { AnnualRetirementActionExecutorSource } from './annualRetirementActionPublication.js'
import {
  retirementActionRequestSchema,
  type RetirementActionRequest,
} from './contract.js'
import {
  actionIdSchema,
  allocationIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

export interface AnnualRetirementActionExecutorAssignment {
  actionId: ActionId
  kind: RetirementActionRequest['kind']
  request: Readonly<RetirementActionRequest>
  executorSource: AnnualRetirementActionExecutorSource | null
  inventoryCoverage: 'complete' | 'partial' | 'absent'
  inventoryEventIds: readonly string[]
}

export interface AnnualRetirementMovementEventReference {
  eventId: string
  eventIndex: number
  origin: AnnualRetirementPhysicalEvent['origin']
  kind: AnnualRetirementPhysicalEvent['kind']
  actionId: ActionId | null
  allocationId: AllocationId | null
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  eventDate: string
  eventSequence: number
  executorSource: AnnualRetirementActionExecutorSource | null
}

export interface StandaloneOwnedNonRothIraMovementBatch {
  predicate: 'standaloneOwnedNonRothIraMovementBatch'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  inventoryEvidenceId: string
  ownerPersonId: PersonId
  executorSource: 'ownedNonRothIraExecutor'
  actionIds: readonly ActionId[]
  eventIds: readonly string[]
  evidenceId: string
}

export interface AnnualRetirementActionMovementCoordinatedResult {
  status: 'annualRetirementActionMovementCoordinated'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  runtimeInventoryEvidenceId: string
  runtimeInventoryUpstreamEvidenceId: string
  inventoryEvidenceId: string
  coordinatorEvidenceId: string
  compatibility: Readonly<
    StandaloneOwnedIraExecutorCompatibility |
    UnifiedAnnualLedgerCompatibility
  >
  orderedEvents: readonly Readonly<AnnualRetirementMovementEventReference>[]
  assignments: readonly Readonly<AnnualRetirementActionExecutorAssignment>[]
  uninventoriedActionIds: readonly ActionId[]
  firstSupportedBatch:
    Readonly<StandaloneOwnedNonRothIraMovementBatch> | null
  issues: readonly []
}

export interface AnnualRetirementActionMovementCoordinationIssue {
  kind: 'identifierCollision'
  detail: string
}

export interface AnnualRetirementActionMovementCoordinationBlockedResult {
  status: 'annualRetirementActionMovementCoordinationBlocked'
  movement: 'notCommitted'
  actionability: 'notEstablished'
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>
  coordinatorEvidenceId: null
  firstSupportedBatch: null
  issues: readonly [
    Readonly<AnnualRetirementActionMovementCoordinationIssue>,
    ...Readonly<AnnualRetirementActionMovementCoordinationIssue>[],
  ]
}

export type CoordinateAnnualRetirementActionMovementResult =
  | AnnualRetirementInventoryIncompleteResult
  | AnnualRetirementChronologyInvalidResult
  | AnnualRetirementActionMovementCoordinationBlockedResult
  | AnnualRetirementActionMovementCoordinatedResult

type CurrentRetirementAction = Exclude<
  Plan['strategies']['retirementActions'][number],
  | { kind: 'legacyAggregateWithdrawal' }
  | { kind: 'legacyAggregateRothConversion' }
  | { kind: 'legacyAggregateQcd' }
>

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function currentActions(
  plan: Plan,
  taxYear: number,
): CurrentRetirementAction[] {
  return plan.strategies.retirementActions
    .filter((action): action is CurrentRetirementAction =>
      action.year === taxYear &&
      action.kind !== 'legacyAggregateWithdrawal' &&
      action.kind !== 'legacyAggregateRothConversion' &&
      action.kind !== 'legacyAggregateQcd',
    )
    .sort((left, right) => compareUtf16CodeUnits(
      left.actionId,
      right.actionId,
    ))
}

function allocationIds(
  action: CurrentRetirementAction,
): readonly AllocationId[] {
  return action.kind === 'qcd'
    ? [allocationIdSchema.parse(action.allocation.allocationId)]
    : action.allocations.map((allocation) =>
        allocationIdSchema.parse(allocation.allocationId),
      )
}

function sourceAccountIds(
  action: CurrentRetirementAction,
): readonly AccountId[] {
  return action.kind === 'qcd'
    ? [action.allocation.sourceAccountId]
    : action.allocations.map((allocation) => allocation.sourceAccountId)
}

function executorFor(
  action: CurrentRetirementAction,
  accountById: ReadonlyMap<string, Plan['accounts'][number]>,
): AnnualRetirementActionExecutorSource | null {
  if (action.kind === 'rothConversion') return 'rothConversionExecutor'
  if (action.kind === 'qcd') return 'qcdExecutor'

  const accounts = sourceAccountIds(action).map((sourceAccountId) =>
    accountById.get(sourceAccountId),
  )
  if (accounts.some((account) => account === undefined)) return null
  if (accounts.every((account) =>
    account?.type === 'cash' ||
    account?.type === 'equityComp' ||
    account?.type === 'taxable',
  )) return 'ordinaryWithdrawalExecutor'
  if (accounts.every((account) =>
    account?.type === 'traditional' &&
    account.kind === 'ira' &&
    account.inherited === undefined,
  )) return 'ownedNonRothIraExecutor'
  return null
}

function canonicalRequest(
  action: CurrentRetirementAction,
): RetirementActionRequest {
  if (action.kind === 'qcd') {
    return retirementActionRequestSchema.parse(action)
  }
  return retirementActionRequestSchema.parse({
    ...action,
    allocations: [...action.allocations].sort((left, right) =>
      compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
      compareUtf16CodeUnits(
        left.sourceAccountId,
        right.sourceAccountId,
      ),
    ),
  })
}

function assignmentEvidenceParts(
  assignment: AnnualRetirementActionExecutorAssignment,
): readonly unknown[] {
  return [
    assignment.actionId,
    assignment.kind,
    assignment.request,
    assignment.executorSource,
    assignment.inventoryCoverage,
    assignment.inventoryEventIds,
  ]
}

function eventEvidenceParts(
  event: AnnualRetirementMovementEventReference,
): readonly unknown[] {
  return [
    event.eventId,
    event.eventIndex,
    event.origin,
    event.kind,
    event.actionId,
    event.allocationId,
    event.ownerPersonId,
    event.sourceAccountId,
    event.eventDate,
    event.eventSequence,
    event.executorSource,
  ]
}

function claimedIdentifiers(
  plan: Plan,
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  actions: readonly CurrentRetirementAction[],
): Set<string> {
  const claimed = identifierValues(plan)
  for (const value of [
    inventory.planId,
    inventory.ledgerRunId,
    inventory.runtimeInventoryEvidenceId,
    inventory.runtimeInventoryUpstreamEvidenceId,
    inventory.inventoryEvidenceId,
  ]) claimed.add(value)
  for (const event of inventory.events) {
    claimed.add(event.eventId)
    claimed.add(event.ownerPersonId)
    claimed.add(event.sourceAccountId)
    if (event.origin === 'planAction') {
      claimed.add(event.actionId)
      claimed.add(event.allocationId)
    } else {
      claimed.add(event.movementAuthorityId)
      claimed.add(event.upstreamEvidenceId)
    }
  }
  for (const action of actions) {
    claimed.add(action.actionId)
    for (const allocationId of allocationIds(action)) claimed.add(allocationId)
  }
  return claimed
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

function inventoryEventIdsByAction(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
): ReadonlyMap<ActionId, readonly string[]> {
  const mutable = new Map<ActionId, string[]>()
  for (const event of inventory.events) {
    if (event.origin !== 'planAction') continue
    const eventIds = mutable.get(event.actionId)
    if (eventIds === undefined) mutable.set(event.actionId, [event.eventId])
    else eventIds.push(event.eventId)
  }
  return mutable
}

function collisionBlocked(
  inventory: Readonly<AnnualRetirementInventoryBuiltResult>,
  detail: string,
): Readonly<AnnualRetirementActionMovementCoordinationBlockedResult> {
  return deepFreeze({
    status: 'annualRetirementActionMovementCoordinationBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    inventory,
    coordinatorEvidenceId: null,
    firstSupportedBatch: null,
    issues: [{ kind: 'identifierCollision', detail }],
  })
}

/**
 * Derives one canonical annual movement order and one executor assignment per
 * current Plan action. This seam does not evaluate eligibility, stage balances,
 * characterize tax, or establish commit authority.
 */
export function coordinateAnnualRetirementActionMovement(
  input: Readonly<BuildAnnualRetirementPhysicalEventInventoryInput>,
): Readonly<CoordinateAnnualRetirementActionMovementResult> {
  const parsedPlan = planSchema.safeParse(input.plan)
  if (!parsedPlan.success) {
    // The inventory applies the same Plan schema, so this parse failure fixes
    // its result to the typed incomplete arm rather than the built arm.
    return buildAnnualRetirementPhysicalEventInventory(input) as Readonly<
      AnnualRetirementInventoryIncompleteResult
    >
  }
  const plan = parsedPlan.data
  const inventory = buildAnnualRetirementPhysicalEventInventory({
    ...input,
    plan,
  })
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') return inventory

  const actions = currentActions(plan, input.taxYear)
  const accountById = new Map(plan.accounts.map((account) => [
    account.id,
    account,
  ]))
  const eventIdsByAction = inventoryEventIdsByAction(inventory)
  const assignments: AnnualRetirementActionExecutorAssignment[] = actions.map(
    (action) => {
      const inventoryEventIds = [
        ...(eventIdsByAction.get(action.actionId) ?? []),
      ]
      const expectedAllocationCount = allocationIds(action).length
      return {
        actionId: actionIdSchema.parse(action.actionId),
        kind: action.kind,
        request: canonicalRequest(action),
        executorSource: executorFor(action, accountById),
        inventoryCoverage: inventoryEventIds.length === expectedAllocationCount
          ? 'complete'
          : inventoryEventIds.length === 0
            ? 'absent'
            : 'partial',
        inventoryEventIds,
      }
    },
  )
  const uninventoriedActionIds = assignments
    .filter((assignment) => assignment.inventoryCoverage !== 'complete')
    .map((assignment) => assignment.actionId)
  const executorByActionId = new Map(assignments.map((assignment) => [
    assignment.actionId,
    assignment.executorSource,
  ]))
  const orderedEvents: AnnualRetirementMovementEventReference[] =
    inventory.events.map((event, eventIndex) => ({
      eventId: event.eventId,
      eventIndex,
      origin: event.origin,
      kind: event.kind,
      actionId: event.origin === 'planAction' ? event.actionId : null,
      allocationId: event.origin === 'planAction'
        ? event.allocationId
        : null,
      ownerPersonId: event.ownerPersonId,
      sourceAccountId: event.sourceAccountId,
      eventDate: event.eventDate,
      eventSequence: event.eventSequence,
      executorSource: event.origin === 'planAction'
        ? executorByActionId.get(event.actionId) ?? null
        : null,
    }))

  const claimed = claimedIdentifiers(plan, inventory, actions)
  let firstSupportedBatch: StandaloneOwnedNonRothIraMovementBatch | null = null
  if (inventory.compatibility.status ===
      'standaloneOwnedIraExecutorCompatible' &&
      uninventoriedActionIds.length === 0) {
    const actionIdSet = new Set(inventory.compatibility.planOwnedIraActionIds)
    const eventIds = orderedEvents
      .filter((event) =>
        event.actionId !== null && actionIdSet.has(event.actionId),
      )
      .map((event) => event.eventId)
    const evidenceId = deriveActionStructuralId(
      'standalone-owned-non-roth-ira-movement-batch',
      [
        inventory.planId,
        inventory.taxYear,
        inventory.ledgerRunId,
        inventory.inventoryEvidenceId,
        inventory.compatibility.ownerPersonId,
        inventory.compatibility.planOwnedIraActionIds,
        eventIds,
      ],
    )
    if (claimed.has(evidenceId)) {
      return collisionBlocked(
        inventory,
        'Derived standalone owned-IRA batch evidence ID collides with an input identifier',
      )
    }
    claimed.add(evidenceId)
    firstSupportedBatch = {
      predicate: 'standaloneOwnedNonRothIraMovementBatch',
      planId: inventory.planId,
      taxYear: inventory.taxYear,
      ledgerRunId: inventory.ledgerRunId,
      inventoryEvidenceId: inventory.inventoryEvidenceId,
      ownerPersonId: inventory.compatibility.ownerPersonId,
      executorSource: 'ownedNonRothIraExecutor',
      actionIds: [...inventory.compatibility.planOwnedIraActionIds],
      eventIds,
      evidenceId,
    }
  }

  const coordinatorEvidenceId = deriveActionStructuralId(
    'annual-retirement-action-movement-coordinator',
    [
      inventory.planId,
      inventory.taxYear,
      inventory.ledgerRunId,
      inventory.runtimeInventoryEvidenceId,
      inventory.runtimeInventoryUpstreamEvidenceId,
      inventory.inventoryEvidenceId,
      inventory.compatibility,
      orderedEvents.map(eventEvidenceParts),
      assignments.map(assignmentEvidenceParts),
      uninventoriedActionIds,
      firstSupportedBatch,
    ],
  )

  if (claimed.has(coordinatorEvidenceId)) {
    return collisionBlocked(
      inventory,
      'Derived annual movement coordinator evidence ID collides with an input identifier',
    )
  }

  return deepFreeze({
    status: 'annualRetirementActionMovementCoordinated',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    planId: inventory.planId,
    taxYear: inventory.taxYear,
    ledgerRunId: inventory.ledgerRunId,
    runtimeInventoryEvidenceId: inventory.runtimeInventoryEvidenceId,
    runtimeInventoryUpstreamEvidenceId:
      inventory.runtimeInventoryUpstreamEvidenceId,
    inventoryEvidenceId: inventory.inventoryEvidenceId,
    coordinatorEvidenceId,
    compatibility: { ...inventory.compatibility },
    orderedEvents,
    assignments,
    uninventoriedActionIds,
    firstSupportedBatch,
    issues: [],
  })
}
