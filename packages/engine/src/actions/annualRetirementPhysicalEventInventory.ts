import { z } from 'zod'

import { planSchema, type Plan } from '../model/plan.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  planIdSchema,
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
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { parseCivilIsoDate } from './civilDate.js'

export const annualRetirementRuntimeEventKinds = [
  'ownedIraRmd',
  'employerPlanRmd',
  'inheritedIraRmd',
  'automaticSeppDistribution',
  'legacyNeedBasedWithdrawal',
  'legacyRothConversion',
  'legacyQcd',
  'ownedIraContribution',
  'ownedIraEmployerContribution',
  'employerPlanEmployeeContribution',
  'employerPlanEmployerMatch',
  'annuityFundingTransfer',
  'tipsFundingTransfer',
  'rolloverInflow',
  'otherTraditionalTransfer',
] as const

export type AnnualRetirementRuntimeEventKind =
  (typeof annualRetirementRuntimeEventKinds)[number]

export type AnnualRetirementRuntimeEventOrigin =
  | 'rmdEngine'
  | 'seppEngine'
  | 'legacyProjection'
  | 'contributionLedger'
  | 'transferLedger'

export type AnnualRetirementForm8606Category =
  | 'line7DistributionCandidate'
  | 'line8ConversionCandidate'
  | 'qcdCandidateAwaitingAnnualQcdStage'
  | 'nonForm8606OrForeignPoolEvent'

export interface CompleteAnnualRetirementRuntimeInventoryAttestation {
  predicate: 'completeAnnualRetirementPhysicalEventInventory'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  inventoryStatus: 'completeIncludingExplicitEmpty'
  resolvedEventIds: readonly string[]
  unresolvedActivityIds: readonly string[]
  evidenceId: string
  upstreamEvidenceId: string
}

export interface ResolvedAnnualRetirementPhysicalEventRecord {
  recordStatus: 'resolved'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  eventId: string
  movementAuthorityId: string
  kind: AnnualRetirementRuntimeEventKind
  origin: AnnualRetirementRuntimeEventOrigin
  ownerPersonId: PersonId
  /** Affected retirement account; for an inflow, this is the receiving account. */
  sourceAccountId: AccountId
  grossAmount: PositiveUsdCents
  executionDate: string
  executionSequence: number
  upstreamEvidenceId: string
}

export type AnnualRetirementUnresolvedActivityReason =
  | 'legacyAggregateIdentityUnavailable'
  | 'sourceAllocationUnavailable'
  | 'executionChronologyUnavailable'
  | 'movementAuthorityUnavailable'

export interface UnresolvedAnnualRetirementPhysicalActivityRecord {
  recordStatus: 'unresolved'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  activityId: string
  kind: AnnualRetirementRuntimeEventKind
  origin: AnnualRetirementRuntimeEventOrigin
  knownGrossAmount: UsdCents
  ownerPersonId: null
  sourceAccountId: null
  executionDate: null
  executionSequence: null
  incompatibility: AnnualRetirementUnresolvedActivityReason
  upstreamEvidenceId: string
}

export type AnnualRetirementRuntimeInventoryRecord =
  | Readonly<ResolvedAnnualRetirementPhysicalEventRecord>
  | Readonly<UnresolvedAnnualRetirementPhysicalActivityRecord>

export interface BuildAnnualRetirementPhysicalEventInventoryInput {
  plan: unknown
  taxYear: number
  runtimeInventoryAttestation:
    Readonly<CompleteAnnualRetirementRuntimeInventoryAttestation>
  runtimeRecords:
    readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[]
}

interface AnnualRetirementPhysicalEventBase {
  eventId: string
  planId: PlanId
  taxYear: number
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  grossAmount: PositiveUsdCents
  eventDate: string
  eventSequence: number
  form8606Category: AnnualRetirementForm8606Category
}

export interface PlanAnnualRetirementPhysicalEvent
  extends AnnualRetirementPhysicalEventBase {
  origin: 'planAction'
  kind: 'ordinaryWithdrawal' | 'rothConversion' | 'qcd'
  actionId: ActionId
  allocationId: AllocationId
  scheduledDate: string
  scheduledSequence: number
}

export interface RuntimeAnnualRetirementPhysicalEvent
  extends AnnualRetirementPhysicalEventBase {
  origin: AnnualRetirementRuntimeEventOrigin
  kind: AnnualRetirementRuntimeEventKind
  ledgerRunId: string
  movementAuthorityId: string
  executionDate: string
  executionSequence: number
  upstreamEvidenceId: string
}

export type AnnualRetirementPhysicalEvent =
  | Readonly<PlanAnnualRetirementPhysicalEvent>
  | Readonly<RuntimeAnnualRetirementPhysicalEvent>

export interface AnnualRetirementCategoryView {
  events: readonly AnnualRetirementPhysicalEvent[]
  grossAmount: UsdCents
}

export interface OwnedNonRothIraAnnualPhysicalEventPoolView {
  ownerPersonId: PersonId
  sourceAccountIds: readonly AccountId[]
  events: readonly AnnualRetirementPhysicalEvent[]
  line7DistributionCandidate: Readonly<AnnualRetirementCategoryView>
  line8ConversionCandidate: Readonly<AnnualRetirementCategoryView>
  qcdCandidateAwaitingAnnualQcdStage:
    Readonly<AnnualRetirementCategoryView>
  nonForm8606OrForeignPoolEvent:
    Readonly<AnnualRetirementCategoryView>
  grossAmount: UsdCents
}

export type UnifiedAnnualLedgerReason =
  | 'runtimePhysicalActivityPresent'
  | 'multipleOwnedIraOwners'
  | 'planConversionOrQcdPresent'
  | 'nonOwnedIraPlanActionPresent'
  | 'planOwnedIraActionBatchEmpty'

export type AnnualRetirementInventoryIssueKind =
  | 'planInvalid'
  | 'taxYearInvalid'
  | 'runtimeRecordInvalid'
  | 'attestationInvalid'
  | 'attestationBindingMismatch'
  | 'runtimeRecordBindingMismatch'
  | 'runtimeEventOriginMismatch'
  | 'runtimeInventoryOmission'
  | 'runtimeInventoryUnexpectedRecord'
  | 'unresolvedRuntimeActivity'
  | 'ownerForeignToPlan'
  | 'sourceForeignToPlan'
  | 'sourceOwnerMismatch'
  | 'sourceKindMismatch'
  | 'identifierInvalid'
  | 'identifierCollision'
  | 'movementAuthorityBindingMismatch'
  | 'aggregateAmountOverflow'
  | 'legacyPlanActionUnresolved'
  | 'planActionExecutionDateMissing'
  | 'eventDateInvalid'
  | 'eventSequenceInvalid'
  | 'chronologyConflict'

export interface AnnualRetirementInventoryIssue {
  kind: AnnualRetirementInventoryIssueKind
  detail: string
  recordId?: string
  actionId?: ActionId
  sourceAccountId?: AccountId
}

interface AnnualRetirementInventoryResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface AnnualRetirementInventoryIncompleteResult
  extends AnnualRetirementInventoryResultBase {
  status: 'annualPhysicalEventInventoryIncomplete'
  compatibility: Readonly<{ status: 'inventoryIncomplete' }>
  inventoryEvidenceId: null
  events: null
  ownedIraPools: null
  planOwnedIraActionIds: null
  issues: readonly [
    Readonly<AnnualRetirementInventoryIssue>,
    ...Readonly<AnnualRetirementInventoryIssue>[],
  ]
}

export interface AnnualRetirementChronologyInvalidResult
  extends AnnualRetirementInventoryResultBase {
  status: 'annualPhysicalEventChronologyInvalid'
  compatibility: Readonly<{ status: 'chronologyInvalid' }>
  inventoryEvidenceId: null
  events: null
  ownedIraPools: null
  planOwnedIraActionIds: null
  issues: readonly [
    Readonly<AnnualRetirementInventoryIssue>,
    ...Readonly<AnnualRetirementInventoryIssue>[],
  ]
}

export interface StandaloneOwnedIraExecutorCompatibility {
  status: 'standaloneOwnedIraExecutorCompatible'
  ownerPersonId: PersonId
  planOwnedIraActionIds: readonly ActionId[]
}

export interface UnifiedAnnualLedgerCompatibility {
  status: 'requiresUnifiedAnnualLedger'
  reasons: readonly [
    UnifiedAnnualLedgerReason,
    ...UnifiedAnnualLedgerReason[],
  ]
}

export interface AnnualRetirementInventoryBuiltResult
  extends AnnualRetirementInventoryResultBase {
  status: 'annualPhysicalEventInventoryBuilt'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  runtimeInventoryEvidenceId: string
  runtimeInventoryUpstreamEvidenceId: string
  inventoryEvidenceId: string
  events: readonly AnnualRetirementPhysicalEvent[]
  ownedIraPools:
    readonly Readonly<OwnedNonRothIraAnnualPhysicalEventPoolView>[]
  planOwnedIraActionIds: readonly ActionId[]
  compatibility: Readonly<
    StandaloneOwnedIraExecutorCompatibility |
    UnifiedAnnualLedgerCompatibility
  >
  issues: readonly []
}

export type BuildAnnualRetirementPhysicalEventInventoryResult =
  | AnnualRetirementInventoryIncompleteResult
  | AnnualRetirementChronologyInvalidResult
  | AnnualRetirementInventoryBuiltResult

const nonblankString = z.string().refine(
  (value) => value.trim().length > 0,
  { message: 'Identifier must not be blank' },
)

const runtimeKindSchema = z.enum(annualRetirementRuntimeEventKinds)
const runtimeOriginSchema = z.enum([
  'rmdEngine',
  'seppEngine',
  'legacyProjection',
  'contributionLedger',
  'transferLedger',
])

const attestationSchema = z.object({
  predicate: z.literal('completeAnnualRetirementPhysicalEventInventory'),
  planId: planIdSchema,
  taxYear: z.number().int().min(1).max(9999),
  ledgerRunId: nonblankString,
  inventoryStatus: z.literal('completeIncludingExplicitEmpty'),
  resolvedEventIds: z.array(nonblankString),
  unresolvedActivityIds: z.array(nonblankString),
  evidenceId: nonblankString,
  upstreamEvidenceId: nonblankString,
}).strict()

const resolvedRecordSchema = z.object({
  recordStatus: z.literal('resolved'),
  planId: planIdSchema,
  taxYear: z.number().int().min(1).max(9999),
  ledgerRunId: nonblankString,
  eventId: nonblankString,
  movementAuthorityId: nonblankString,
  kind: runtimeKindSchema,
  origin: runtimeOriginSchema,
  ownerPersonId: personIdSchema,
  sourceAccountId: accountIdSchema,
  grossAmount: positiveUsdCentsSchema,
  executionDate: z.string(),
  executionSequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  upstreamEvidenceId: nonblankString,
}).strict()

const unresolvedRecordSchema = z.object({
  recordStatus: z.literal('unresolved'),
  planId: planIdSchema,
  taxYear: z.number().int().min(1).max(9999),
  ledgerRunId: nonblankString,
  activityId: nonblankString,
  kind: runtimeKindSchema,
  origin: runtimeOriginSchema,
  knownGrossAmount: usdCentsSchema,
  ownerPersonId: z.null(),
  sourceAccountId: z.null(),
  executionDate: z.null(),
  executionSequence: z.null(),
  incompatibility: z.enum([
    'legacyAggregateIdentityUnavailable',
    'sourceAllocationUnavailable',
    'executionChronologyUnavailable',
    'movementAuthorityUnavailable',
  ]),
  upstreamEvidenceId: nonblankString,
}).strict()

const runtimeRecordSchema = z.discriminatedUnion('recordStatus', [
  resolvedRecordSchema,
  unresolvedRecordSchema,
])

type CanonicalAttestation = z.infer<typeof attestationSchema>
type CanonicalRuntimeRecord = z.infer<typeof runtimeRecordSchema>
type CanonicalResolvedRecord = z.infer<typeof resolvedRecordSchema>

type TraditionalAccount = Extract<
  Plan['accounts'][number],
  { type: 'traditional' }
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

function issue(
  kind: AnnualRetirementInventoryIssueKind,
  detail: string,
  bindings: Pick<
    AnnualRetirementInventoryIssue,
    'recordId' | 'actionId' | 'sourceAccountId'
  > = {},
): AnnualRetirementInventoryIssue {
  return { kind, detail, ...bindings }
}

function canonicalIssues(
  issues: readonly AnnualRetirementInventoryIssue[],
): AnnualRetirementInventoryIssue[] {
  return [...issues].sort((left, right) =>
    compareUtf16CodeUnits(left.kind, right.kind) ||
    compareUtf16CodeUnits(left.recordId ?? '', right.recordId ?? '') ||
    compareUtf16CodeUnits(left.actionId ?? '', right.actionId ?? '') ||
    compareUtf16CodeUnits(
      left.sourceAccountId ?? '',
      right.sourceAccountId ?? '',
    ) ||
    compareUtf16CodeUnits(left.detail, right.detail),
  )
}

function incomplete(
  issues: readonly AnnualRetirementInventoryIssue[],
): Readonly<AnnualRetirementInventoryIncompleteResult> {
  if (issues.length === 0) {
    throw new Error('Incomplete inventory requires at least one issue')
  }
  const orderedIssues = canonicalIssues(issues)
  return deepFreeze({
    status: 'annualPhysicalEventInventoryIncomplete',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    compatibility: { status: 'inventoryIncomplete' },
    inventoryEvidenceId: null,
    events: null,
    ownedIraPools: null,
    planOwnedIraActionIds: null,
    issues: orderedIssues as [
      AnnualRetirementInventoryIssue,
      ...AnnualRetirementInventoryIssue[],
    ],
  })
}

function chronologyInvalid(
  issues: readonly AnnualRetirementInventoryIssue[],
): Readonly<AnnualRetirementChronologyInvalidResult> {
  if (issues.length === 0) {
    throw new Error('Invalid chronology requires at least one issue')
  }
  const orderedIssues = canonicalIssues(issues)
  return deepFreeze({
    status: 'annualPhysicalEventChronologyInvalid',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    compatibility: { status: 'chronologyInvalid' },
    inventoryEvidenceId: null,
    events: null,
    ownedIraPools: null,
    planOwnedIraActionIds: null,
    issues: orderedIssues as [
      AnnualRetirementInventoryIssue,
      ...AnnualRetirementInventoryIssue[],
    ],
  })
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index])
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16CodeUnits)
}

function safeSum(
  amounts: readonly (UsdCents | PositiveUsdCents)[],
  label: string,
): UsdCents | AnnualRetirementInventoryIssue {
  const sum = amounts.reduce((total, amount) => total + BigInt(amount), 0n)
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    return issue(
      'aggregateAmountOverflow',
      `${label} must remain within the safe-integer cents range`,
    )
  }
  return asUsdCents(Number(sum))
}

function expectedOrigin(
  kind: AnnualRetirementRuntimeEventKind,
): AnnualRetirementRuntimeEventOrigin {
  if (
    kind === 'ownedIraRmd' ||
    kind === 'employerPlanRmd' ||
    kind === 'inheritedIraRmd'
  ) return 'rmdEngine'
  if (kind === 'automaticSeppDistribution') return 'seppEngine'
  if (
    kind === 'legacyNeedBasedWithdrawal' ||
    kind === 'legacyRothConversion' ||
    kind === 'legacyQcd'
  ) return 'legacyProjection'
  if (
    kind === 'ownedIraContribution' ||
    kind === 'ownedIraEmployerContribution' ||
    kind === 'employerPlanEmployeeContribution' ||
    kind === 'employerPlanEmployerMatch'
  ) return 'contributionLedger'
  return 'transferLedger'
}

function isOwnedIra(account: TraditionalAccount): boolean {
  return account.kind === 'ira' && account.inherited === undefined
}

function categoryFor(
  kind:
    | PlanAnnualRetirementPhysicalEvent['kind']
    | AnnualRetirementRuntimeEventKind,
  ownedIra: boolean,
): AnnualRetirementForm8606Category {
  if (!ownedIra) return 'nonForm8606OrForeignPoolEvent'
  if (kind === 'rothConversion' || kind === 'legacyRothConversion') {
    return 'line8ConversionCandidate'
  }
  if (kind === 'qcd' || kind === 'legacyQcd') {
    return 'qcdCandidateAwaitingAnnualQcdStage'
  }
  if (
    kind === 'ordinaryWithdrawal' ||
    kind === 'ownedIraRmd' ||
    kind === 'automaticSeppDistribution' ||
    kind === 'legacyNeedBasedWithdrawal'
  ) return 'line7DistributionCandidate'
  return 'nonForm8606OrForeignPoolEvent'
}

function resolvedSourceKindValid(
  kind: AnnualRetirementRuntimeEventKind,
  account: TraditionalAccount,
  plan: Plan,
): boolean {
  if (kind === 'ownedIraRmd') return isOwnedIra(account)
  if (kind === 'employerPlanRmd') {
    return account.kind === 'employer' && account.inherited === undefined
  }
  if (kind === 'inheritedIraRmd') {
    return account.kind === 'ira' && account.inherited !== undefined
  }
  if (kind === 'ownedIraContribution') return isOwnedIra(account)
  if (kind === 'ownedIraEmployerContribution') {
    const classifications =
      plan.retirementActionEligibilityFacts?.iraClassifications.filter(
        (classification) => classification.sourceAccountId === account.id,
      ) ?? []
    return isOwnedIra(account) && classifications.length === 1 &&
      (classifications[0]!.subtype === 'sep' ||
        classifications[0]!.subtype === 'simple')
  }
  if (
    kind === 'employerPlanEmployeeContribution' ||
    kind === 'employerPlanEmployerMatch'
  ) return account.kind === 'employer' && account.inherited === undefined
  return true
}

interface ClaimedIdentifier {
  role: string
  owner: string
}

interface MovementAuthorityBinding {
  binding: string
  firstEventId: string
  sourceAccountIds: Set<AccountId>
}

function canonicalRuntimeRecordKey(record: CanonicalRuntimeRecord): string {
  if (record.recordStatus === 'unresolved') {
    return JSON.stringify([
      record.activityId,
      record.recordStatus,
      record.kind,
      record.origin,
      record.planId,
      record.taxYear,
      record.ledgerRunId,
      record.knownGrossAmount,
      record.incompatibility,
      record.upstreamEvidenceId,
    ])
  }
  return JSON.stringify([
    record.eventId,
    record.recordStatus,
    record.kind,
    record.origin,
    record.planId,
    record.taxYear,
    record.ledgerRunId,
    record.ownerPersonId,
    record.sourceAccountId,
    record.grossAmount,
    record.executionDate,
    record.executionSequence,
    record.movementAuthorityId,
    record.upstreamEvidenceId,
  ])
}

function movementAuthorityBinding(record: CanonicalResolvedRecord): string {
  return JSON.stringify([
    record.ownerPersonId,
    record.kind,
    record.origin,
    record.executionDate,
    record.executionSequence,
  ])
}

function claimIdentifier(
  value: string,
  role: string,
  owner: string,
  claimed: Map<string, ClaimedIdentifier>,
  issues: AnnualRetirementInventoryIssue[],
  allowSameRoleReuse = false,
): void {
  if (value.trim().length === 0) {
    issues.push(issue('identifierInvalid', `${role} must be nonblank`, {
      recordId: owner,
    }))
    return
  }
  const existing = claimed.get(value)
  if (existing !== undefined) {
    if (allowSameRoleReuse && existing.role === role) return
    issues.push(issue(
      'identifierCollision',
      `${role} for ${owner} collides with ${existing.role} for ${existing.owner}`,
      { recordId: owner },
    ))
    return
  }
  claimed.set(value, { role, owner })
}

function canonicalPlanEvents(
  plan: Plan,
  taxYear: number,
  accountById: ReadonlyMap<string, Plan['accounts'][number]>,
  issues: AnnualRetirementInventoryIssue[],
): PlanAnnualRetirementPhysicalEvent[] {
  const events: PlanAnnualRetirementPhysicalEvent[] = []
  for (const action of plan.strategies.retirementActions) {
    if (action.year !== taxYear) continue
    if (
      action.kind === 'legacyAggregateWithdrawal' ||
      action.kind === 'legacyAggregateRothConversion' ||
      action.kind === 'legacyAggregateQcd'
    ) {
      issues.push(issue(
        'legacyPlanActionUnresolved',
        'A legacy aggregate Plan action has no owner, source, or chronology and cannot enter the physical-event inventory',
        { actionId: actionIdSchema.parse(action.actionId) },
      ))
      continue
    }

    const ownerPersonId = personIdSchema.parse(
      action.kind === 'qcd' ? action.donorPersonId : action.personId,
    )
    const allocations = action.kind === 'qcd'
      ? [action.allocation]
      : action.allocations
    const traditionalAllocations = allocations.filter((allocation) =>
      accountById.get(allocation.sourceAccountId)?.type === 'traditional',
    )
    if (traditionalAllocations.length === 0) continue
    if (action.executionDate === undefined) {
      issues.push(issue(
        'planActionExecutionDateMissing',
        'A Plan IRA action needs an explicit execution date before it can enter annual chronology',
        { actionId: actionIdSchema.parse(action.actionId) },
      ))
      continue
    }
    for (const allocation of traditionalAllocations) {
      const account = accountById.get(allocation.sourceAccountId)
      if (account?.type !== 'traditional') continue
      const actionId = actionIdSchema.parse(action.actionId)
      const allocationId = allocationIdSchema.parse(allocation.allocationId)
      const sourceAccountId = accountIdSchema.parse(allocation.sourceAccountId)
      const eventId = deriveActionStructuralId(
        'annual-retirement-plan-event',
        [
          plan.id,
          taxYear,
          actionId,
          allocationId,
          sourceAccountId,
          allocation.requestedAmount,
          action.executionDate,
          action.executionSequence,
          action.kind,
        ],
      )
      events.push({
        eventId,
        planId: planIdSchema.parse(plan.id),
        taxYear,
        origin: 'planAction',
        kind: action.kind,
        actionId,
        allocationId,
        ownerPersonId,
        sourceAccountId,
        grossAmount: positiveUsdCentsSchema.parse(allocation.requestedAmount),
        scheduledDate: action.executionDate,
        scheduledSequence: action.executionSequence,
        eventDate: action.executionDate,
        eventSequence: action.executionSequence,
        form8606Category: categoryFor(action.kind, isOwnedIra(account)),
      })
    }
  }
  return events.sort(compareEvents)
}

function canonicalRuntimeEvent(
  record: CanonicalResolvedRecord,
  account: TraditionalAccount,
): RuntimeAnnualRetirementPhysicalEvent {
  return {
    eventId: record.eventId,
    planId: record.planId,
    taxYear: record.taxYear,
    ledgerRunId: record.ledgerRunId,
    origin: record.origin,
    kind: record.kind,
    movementAuthorityId: record.movementAuthorityId,
    ownerPersonId: record.ownerPersonId,
    sourceAccountId: record.sourceAccountId,
    grossAmount: record.grossAmount,
    executionDate: record.executionDate,
    executionSequence: record.executionSequence,
    eventDate: record.executionDate,
    eventSequence: record.executionSequence,
    upstreamEvidenceId: record.upstreamEvidenceId,
    form8606Category: categoryFor(record.kind, isOwnedIra(account)),
  }
}

function compareEvents(
  left: AnnualRetirementPhysicalEvent,
  right: AnnualRetirementPhysicalEvent,
): number {
  return compareUtf16CodeUnits(left.eventDate, right.eventDate) ||
    left.eventSequence - right.eventSequence ||
    compareUtf16CodeUnits(left.origin, right.origin) ||
    compareUtf16CodeUnits(left.eventId, right.eventId)
}

function eventAuthorityKey(event: AnnualRetirementPhysicalEvent): string {
  return event.origin === 'planAction'
    ? `plan:${event.actionId}`
    : `runtime:${event.movementAuthorityId}`
}

function categoryView(
  events: readonly AnnualRetirementPhysicalEvent[],
  category: AnnualRetirementForm8606Category,
): AnnualRetirementCategoryView | AnnualRetirementInventoryIssue {
  const matching = events.filter((event) => event.form8606Category === category)
  const total = safeSum(
    matching.map((event) => event.grossAmount),
    `${category} aggregate`,
  )
  if (typeof total !== 'number') return total
  return { events: matching, grossAmount: total }
}

function isCategoryView(
  value: AnnualRetirementCategoryView | AnnualRetirementInventoryIssue,
): value is AnnualRetirementCategoryView {
  return 'events' in value
}

function canonicalEvidenceParts(
  event: AnnualRetirementPhysicalEvent,
): readonly unknown[] {
  if (event.origin === 'planAction') {
    return [
      event.eventId,
      event.origin,
      event.kind,
      event.actionId,
      event.allocationId,
      event.ownerPersonId,
      event.sourceAccountId,
      event.grossAmount,
      event.eventDate,
      event.eventSequence,
      event.form8606Category,
    ]
  }
  return [
    event.eventId,
    event.origin,
    event.kind,
    event.movementAuthorityId,
    event.ownerPersonId,
    event.sourceAccountId,
    event.grossAmount,
    event.eventDate,
    event.eventSequence,
    event.upstreamEvidenceId,
    event.form8606Category,
  ]
}

/**
 * Builds a complete, immutable Plan/year chronology of traditional-retirement
 * physical events without mutating balances or claiming tax/execution authority.
 * Plan action allocations are derived from the validated Plan; every other
 * event must be covered by one exact runtime completeness attestation.
 */
export function buildAnnualRetirementPhysicalEventInventory(
  input: Readonly<BuildAnnualRetirementPhysicalEventInventoryInput>,
): Readonly<BuildAnnualRetirementPhysicalEventInventoryResult> {
  const parsedPlan = planSchema.safeParse(input.plan)
  if (!parsedPlan.success) {
    return incomplete(parsedPlan.error.issues.map((planIssue) => issue(
      'planInvalid',
      `${planIssue.path.join('.') || '(root)'}: ${planIssue.message}`,
    )))
  }
  if (!Number.isInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999) {
    return incomplete([issue(
      'taxYearInvalid',
      'Tax year must be an integer from 1 through 9999',
    )])
  }
  const parsedAttestation = attestationSchema.safeParse(
    input.runtimeInventoryAttestation,
  )
  if (!parsedAttestation.success) {
    return incomplete(parsedAttestation.error.issues.map((attestationIssue) =>
      issue(
        'attestationInvalid',
        `${attestationIssue.path.join('.') || '(root)'}: ${attestationIssue.message}`,
      ),
    ))
  }
  const records: CanonicalRuntimeRecord[] = []
  const recordParseIssues: AnnualRetirementInventoryIssue[] = []
  for (const rawRecord of input.runtimeRecords) {
    const parsedRecord = runtimeRecordSchema.safeParse(rawRecord)
    if (parsedRecord.success) {
      records.push(parsedRecord.data)
      continue
    }
    recordParseIssues.push(...parsedRecord.error.issues.map((recordIssue) =>
      issue(
        'runtimeRecordInvalid',
        `${recordIssue.path.join('.') || '(root)'}: ${recordIssue.message}`,
      ),
    ))
  }
  if (recordParseIssues.length > 0) return incomplete(recordParseIssues)
  records.sort((left, right) => compareUtf16CodeUnits(
    canonicalRuntimeRecordKey(left),
    canonicalRuntimeRecordKey(right),
  ))

  const plan = parsedPlan.data
  const planId = planIdSchema.parse(plan.id)
  const taxYear = input.taxYear
  const attestation: CanonicalAttestation = parsedAttestation.data
  const inventoryIssues: AnnualRetirementInventoryIssue[] = []
  if (
    attestation.planId !== planId ||
    attestation.taxYear !== taxYear
  ) {
    inventoryIssues.push(issue(
      'attestationBindingMismatch',
      'Runtime inventory attestation must bind the validated Plan and requested tax year',
    ))
  }

  const people = new Set(plan.household.people.map((person) => person.id))
  const accountById = new Map(
    plan.accounts.map((account) => [account.id, account] as const),
  )
  const traditionalById = new Map(
    plan.accounts
      .filter((account): account is TraditionalAccount =>
        account.type === 'traditional',
      )
      .map((account) => [account.id, account] as const),
  )
  const claimed = new Map<string, ClaimedIdentifier>()
  claimIdentifier(
    attestation.evidenceId,
    'runtime inventory evidence ID',
    'runtime inventory attestation',
    claimed,
    inventoryIssues,
  )
  claimIdentifier(
    attestation.upstreamEvidenceId,
    'runtime inventory upstream evidence ID',
    'runtime inventory attestation',
    claimed,
    inventoryIssues,
  )

  const resolvedIds: string[] = []
  const unresolvedIds: string[] = []
  const runtimeEvents: RuntimeAnnualRetirementPhysicalEvent[] = []
  const authorityBindings = new Map<string, MovementAuthorityBinding>()
  for (const record of records) {
    const recordId = record.recordStatus === 'resolved'
      ? record.eventId
      : record.activityId
    if (
      record.planId !== planId ||
      record.taxYear !== taxYear ||
      record.ledgerRunId !== attestation.ledgerRunId
    ) {
      inventoryIssues.push(issue(
        'runtimeRecordBindingMismatch',
        'Runtime record must bind the Plan, tax year, and attested ledger run',
        { recordId },
      ))
    }
    if (record.origin !== expectedOrigin(record.kind)) {
      inventoryIssues.push(issue(
        'runtimeEventOriginMismatch',
        `Runtime event kind ${record.kind} cannot originate from ${record.origin}`,
        { recordId },
      ))
    }
    if (record.recordStatus === 'unresolved') {
      unresolvedIds.push(record.activityId)
      claimIdentifier(
        record.activityId,
        'unresolved activity ID',
        record.activityId,
        claimed,
        inventoryIssues,
      )
      claimIdentifier(
        record.upstreamEvidenceId,
        'unresolved activity upstream evidence ID',
        record.activityId,
        claimed,
        inventoryIssues,
      )
      inventoryIssues.push(issue(
        'unresolvedRuntimeActivity',
        `Runtime activity ${record.kind} (${record.knownGrossAmount} cents) remains unresolved: ${record.incompatibility}`,
        { recordId: record.activityId },
      ))
      continue
    }

    resolvedIds.push(record.eventId)
    claimIdentifier(
      record.eventId,
      'runtime event ID',
      record.eventId,
      claimed,
      inventoryIssues,
    )
    claimIdentifier(
      record.movementAuthorityId,
      'runtime movement authority ID',
      record.eventId,
      claimed,
      inventoryIssues,
      true,
    )
    const authorityBinding = movementAuthorityBinding(record)
    const existingAuthority = authorityBindings.get(
      record.movementAuthorityId,
    )
    if (
      existingAuthority !== undefined &&
      existingAuthority.binding !== authorityBinding
    ) {
      inventoryIssues.push(issue(
        'movementAuthorityBindingMismatch',
        `Runtime movement authority ${record.movementAuthorityId} conflicts with its binding on event ${existingAuthority.firstEventId}`,
        { recordId: record.eventId },
      ))
    } else if (
      existingAuthority?.sourceAccountIds.has(record.sourceAccountId)
    ) {
      inventoryIssues.push(issue(
        'movementAuthorityBindingMismatch',
        `Runtime movement authority ${record.movementAuthorityId} repeats source account ${record.sourceAccountId}`,
        { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
      ))
    } else if (existingAuthority === undefined) {
      authorityBindings.set(record.movementAuthorityId, {
        binding: authorityBinding,
        firstEventId: record.eventId,
        sourceAccountIds: new Set([record.sourceAccountId]),
      })
    } else {
      existingAuthority.sourceAccountIds.add(record.sourceAccountId)
    }
    claimIdentifier(
      record.upstreamEvidenceId,
      'runtime upstream evidence ID',
      record.eventId,
      claimed,
      inventoryIssues,
    )
    if (!people.has(record.ownerPersonId)) {
      inventoryIssues.push(issue(
        'ownerForeignToPlan',
        'Runtime event owner is foreign to the Plan household',
        { recordId: record.eventId },
      ))
    }
    const anyAccount = accountById.get(record.sourceAccountId)
    const account = traditionalById.get(record.sourceAccountId)
    if (anyAccount === undefined) {
      inventoryIssues.push(issue(
        'sourceForeignToPlan',
        'Runtime event source account is foreign to the Plan',
        { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
      ))
    } else if (account === undefined) {
      inventoryIssues.push(issue(
        'sourceKindMismatch',
        'Runtime retirement event source must be a traditional account',
        { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
      ))
    } else {
      if (
        account.ownerPersonId !== null &&
        account.ownerPersonId !== record.ownerPersonId
      ) {
        inventoryIssues.push(issue(
          'sourceOwnerMismatch',
          'Runtime event source owner must match the event owner',
          { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
        ))
      }
      if (!resolvedSourceKindValid(record.kind, account, plan)) {
        inventoryIssues.push(issue(
          'sourceKindMismatch',
          `Runtime event kind ${record.kind} is incompatible with this traditional-account class`,
          { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
        ))
      }
      runtimeEvents.push(canonicalRuntimeEvent(record, account))
    }
  }

  const attestedResolvedIds = [...attestation.resolvedEventIds]
    .sort(compareUtf16CodeUnits)
  const attestedUnresolvedIds = [...attestation.unresolvedActivityIds]
    .sort(compareUtf16CodeUnits)
  const canonicalResolvedIds = [...resolvedIds].sort(compareUtf16CodeUnits)
  const canonicalUnresolvedIds = [...unresolvedIds].sort(compareUtf16CodeUnits)
  if (attestedResolvedIds.length !== new Set(attestedResolvedIds).size) {
    inventoryIssues.push(issue(
      'runtimeInventoryUnexpectedRecord',
      'Runtime attestation must not repeat a resolved event ID',
    ))
  }
  if (attestedUnresolvedIds.length !== new Set(attestedUnresolvedIds).size) {
    inventoryIssues.push(issue(
      'runtimeInventoryUnexpectedRecord',
      'Runtime attestation must not repeat an unresolved activity ID',
    ))
  }
  if (!sameStrings(attestedResolvedIds, canonicalResolvedIds)) {
    inventoryIssues.push(issue(
      canonicalResolvedIds.some((id) => !attestedResolvedIds.includes(id))
        ? 'runtimeInventoryUnexpectedRecord'
        : 'runtimeInventoryOmission',
      'Attested resolved-event IDs must exactly equal supplied resolved records',
    ))
  }
  if (!sameStrings(attestedUnresolvedIds, canonicalUnresolvedIds)) {
    inventoryIssues.push(issue(
      canonicalUnresolvedIds.some((id) => !attestedUnresolvedIds.includes(id))
        ? 'runtimeInventoryUnexpectedRecord'
        : 'runtimeInventoryOmission',
      'Attested unresolved-activity IDs must exactly equal supplied unresolved records',
    ))
  }

  const planEvents = canonicalPlanEvents(plan, taxYear, accountById, inventoryIssues)
  for (const actionId of sortedUnique(
    planEvents.map((event) => event.actionId),
  )) {
    claimIdentifier(
      actionId,
      'Plan action ID',
      actionId,
      claimed,
      inventoryIssues,
    )
  }
  for (const event of planEvents) {
    claimIdentifier(
      event.allocationId,
      'Plan allocation ID',
      event.actionId,
      claimed,
      inventoryIssues,
    )
    claimIdentifier(
      event.eventId,
      'Plan event structural ID',
      event.actionId,
      claimed,
      inventoryIssues,
    )
  }
  if (inventoryIssues.length > 0) return incomplete(inventoryIssues)

  const events: AnnualRetirementPhysicalEvent[] = [
    ...planEvents,
    ...runtimeEvents,
  ]
  events.sort(compareEvents)
  const chronologyIssues: AnnualRetirementInventoryIssue[] = []
  const authorityBySlot = new Map<string, string>()
  for (const event of events) {
    if (
      parseCivilIsoDate(event.eventDate) === null ||
      Number(event.eventDate.slice(0, 4)) !== taxYear
    ) {
      chronologyIssues.push(issue(
        'eventDateInvalid',
        'Every event date must be a real canonical civil date in the inventory tax year',
        {
          recordId: event.eventId,
          ...(event.origin === 'planAction' ? { actionId: event.actionId } : {}),
        },
      ))
    }
    if (
      !Number.isSafeInteger(event.eventSequence) ||
      event.eventSequence <= 0
    ) {
      chronologyIssues.push(issue(
        'eventSequenceInvalid',
        'Every event sequence must be a positive safe integer',
        { recordId: event.eventId },
      ))
    }
    const slot = JSON.stringify([event.eventDate, event.eventSequence])
    const authority = eventAuthorityKey(event)
    const existingAuthority = authorityBySlot.get(slot)
    if (existingAuthority !== undefined && existingAuthority !== authority) {
      chronologyIssues.push(issue(
        'chronologyConflict',
        'Different movement authorities must not occupy one annual chronology slot',
        { recordId: event.eventId },
      ))
    }
    authorityBySlot.set(slot, authority)
  }
  if (chronologyIssues.length > 0) return chronologyInvalid(chronologyIssues)
  const ownedAccounts = [...traditionalById.values()]
    .filter(isOwnedIra)
  const sourceAccountIdsByOwner = new Map<string, AccountId[]>()
  const ownedIraOwnerByAccountId = new Map<AccountId, string>()
  for (const account of ownedAccounts) {
    if (account.ownerPersonId === null) continue
    const ownerAccountIds = sourceAccountIdsByOwner.get(account.ownerPersonId)
    const accountId = accountIdSchema.parse(account.id)
    if (ownerAccountIds === undefined) {
      sourceAccountIdsByOwner.set(account.ownerPersonId, [accountId])
    } else {
      ownerAccountIds.push(accountId)
    }
    ownedIraOwnerByAccountId.set(accountId, account.ownerPersonId)
  }
  for (const sourceAccountIds of sourceAccountIdsByOwner.values()) {
    sourceAccountIds.sort(compareUtf16CodeUnits)
  }
  const poolEventsByOwner = new Map<string, AnnualRetirementPhysicalEvent[]>()
  for (const event of events) {
    const owner = ownedIraOwnerByAccountId.get(event.sourceAccountId)
    if (owner === undefined) continue
    const ownerEvents = poolEventsByOwner.get(owner)
    if (ownerEvents === undefined) {
      poolEventsByOwner.set(owner, [event])
    } else {
      ownerEvents.push(event)
    }
  }
  const owners = [...sourceAccountIdsByOwner.keys()].sort(compareUtf16CodeUnits)
  const pools: OwnedNonRothIraAnnualPhysicalEventPoolView[] = []
  const aggregationIssues: AnnualRetirementInventoryIssue[] = []
  for (const owner of owners) {
    const ownerPersonId = personIdSchema.parse(owner)
    const sourceAccountIds = sourceAccountIdsByOwner.get(owner) ?? []
    const poolEvents = poolEventsByOwner.get(owner) ?? []
    const line7 = categoryView(poolEvents, 'line7DistributionCandidate')
    const line8 = categoryView(poolEvents, 'line8ConversionCandidate')
    const qcd = categoryView(
      poolEvents,
      'qcdCandidateAwaitingAnnualQcdStage',
    )
    const other = categoryView(poolEvents, 'nonForm8606OrForeignPoolEvent')
    const total = safeSum(
      poolEvents.map((event) => event.grossAmount),
      `Owned IRA pool ${owner} aggregate`,
    )
    for (const value of [line7, line8, qcd, other, total]) {
      if (typeof value !== 'number' && 'kind' in value) {
        aggregationIssues.push(value)
      }
    }
    if (
      !isCategoryView(line7) ||
      !isCategoryView(line8) ||
      !isCategoryView(qcd) ||
      !isCategoryView(other) ||
      typeof total !== 'number'
    ) continue
    pools.push({
      ownerPersonId,
      sourceAccountIds,
      events: poolEvents,
      line7DistributionCandidate: line7,
      line8ConversionCandidate: line8,
      qcdCandidateAwaitingAnnualQcdStage: qcd,
      nonForm8606OrForeignPoolEvent: other,
      grossAmount: total,
    })
  }
  if (aggregationIssues.length > 0) return incomplete(aggregationIssues)

  const planEventsByActionId = new Map<ActionId, PlanAnnualRetirementPhysicalEvent[]>()
  for (const event of planEvents) {
    const actionEvents = planEventsByActionId.get(event.actionId)
    if (actionEvents === undefined) {
      planEventsByActionId.set(event.actionId, [event])
    } else {
      actionEvents.push(event)
    }
  }
  const planActionsById = new Map(
    plan.strategies.retirementActions.map((action) => [action.actionId, action]),
  )
  const planOwnedIraActionIds = [...planEventsByActionId.keys()]
    .filter((actionId) => {
      const actionEvents = planEventsByActionId.get(actionId) ?? []
      const planAction = planActionsById.get(actionId)
      if (
        planAction === undefined ||
        planAction.kind === 'legacyAggregateWithdrawal' ||
        planAction.kind === 'legacyAggregateRothConversion' ||
        planAction.kind === 'legacyAggregateQcd'
      ) return false
      const allocationCount = planAction.kind === 'qcd'
        ? 1
        : planAction.allocations.length
      return actionEvents.length === allocationCount && actionEvents.every((event) => {
        const account = traditionalById.get(event.sourceAccountId)
        return account !== undefined && isOwnedIra(account)
      })
    })
    .sort(compareUtf16CodeUnits)
  const planOwnedIraActionIdSet = new Set(planOwnedIraActionIds)

  const unifiedReasons: UnifiedAnnualLedgerReason[] = []
  if (runtimeEvents.length > 0) unifiedReasons.push('runtimePhysicalActivityPresent')
  const ownedActionOwners = sortedUnique(
    planEvents
      .filter((event) => planOwnedIraActionIdSet.has(event.actionId))
      .map((event) => event.ownerPersonId),
  )
  if (ownedActionOwners.length > 1) unifiedReasons.push('multipleOwnedIraOwners')
  if (planEvents.some((event) =>
    event.kind === 'rothConversion' || event.kind === 'qcd',
  )) unifiedReasons.push('planConversionOrQcdPresent')
  if (planEvents.some((event) =>
    !planOwnedIraActionIdSet.has(event.actionId),
  )) unifiedReasons.push('nonOwnedIraPlanActionPresent')
  if (planOwnedIraActionIds.length === 0) {
    unifiedReasons.push('planOwnedIraActionBatchEmpty')
  }
  const uniqueUnifiedReasons = [...new Set(unifiedReasons)]
  const compatibility: StandaloneOwnedIraExecutorCompatibility |
    UnifiedAnnualLedgerCompatibility = uniqueUnifiedReasons.length === 0
      ? {
          status: 'standaloneOwnedIraExecutorCompatible',
          ownerPersonId: personIdSchema.parse(ownedActionOwners[0]!),
          planOwnedIraActionIds,
        }
      : {
          status: 'requiresUnifiedAnnualLedger',
          reasons: uniqueUnifiedReasons as [
            UnifiedAnnualLedgerReason,
            ...UnifiedAnnualLedgerReason[],
          ],
        }

  const inventoryEvidenceId = deriveActionStructuralId(
    'annual-retirement-physical-event-inventory',
    [
      planId,
      taxYear,
      attestation.ledgerRunId,
      attestation.evidenceId,
      attestation.upstreamEvidenceId,
      events.map(canonicalEvidenceParts),
      pools.map((pool) => [
        pool.ownerPersonId,
        pool.sourceAccountIds,
        pool.grossAmount,
      ]),
      planOwnedIraActionIds,
      compatibility,
    ],
  )
  if (claimed.has(inventoryEvidenceId)) {
    return incomplete([issue(
      'identifierCollision',
      'Derived annual inventory evidence ID collides with an input identifier',
    )])
  }

  return deepFreeze({
    status: 'annualPhysicalEventInventoryBuilt',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    planId,
    taxYear,
    ledgerRunId: attestation.ledgerRunId,
    runtimeInventoryEvidenceId: attestation.evidenceId,
    runtimeInventoryUpstreamEvidenceId: attestation.upstreamEvidenceId,
    inventoryEvidenceId,
    events,
    ownedIraPools: pools,
    planOwnedIraActionIds,
    compatibility,
    issues: [],
  })
}
