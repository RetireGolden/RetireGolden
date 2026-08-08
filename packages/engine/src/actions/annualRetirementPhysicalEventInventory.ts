import { z } from 'zod'

import { planSchema, type Plan } from '../model/plan.js'
import { packForYear, rmdStartAgeForBirthYear } from '../params/index.js'
import {
  classifyInheritedRegime,
  inheritedRequirementForYear,
} from '../strategies/inheritedIra.js'
import {
  acceptsContributions,
  isTreatAsOwnEffective,
} from '../strategies/accountEligibility.js'
import { seppActive } from '../strategies/sepp.js'
import { seppSeriesBeginsAfterSeparation } from './traditionalEmployerPlanPenaltyPrerequisite.js'
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
import type { QcdCharityDesignation } from './contract.js'

export const annualRetirementRuntimeEventKinds = [
  'ownedIraRmd',
  'employerPlanRmd',
  'inheritedIraRmd',
  'automaticSeppDistribution',
  'legacyNeedBasedWithdrawal',
  'legacyRothConversion',
  'legacyQcd',
  /**
   * A charitable distribution the exact-cent QCD executor committed against a
   * named request, as opposed to the aggregate strategy's household scalar.
   * The producer key carries the action and allocation that authorised it, so
   * the occurrence names one donor and one source account, which is precisely
   * what a household total cannot do. Its chronology and movement authority
   * stay with the executor's own published evidence, so like the named
   * conversion below it is not a resolved runtime event kind.
   */
  'namedQcd',
  /**
   * A conversion the exact-cent retirement-action executor committed against a
   * named request, as opposed to the aggregate strategy's first-source sweep.
   * The producer key carries the action and allocation that authorised it, so
   * the occurrence binds to one request rather than to Plan array order. Its
   * chronology and movement authority stay with the executor's own published
   * evidence: the simulator's loop position is still not an execution
   * sequence, which is why this is not a resolved runtime event kind.
   */
  'namedRothConversion',
  'ownedIraContribution',
  'ownedIraEmployerContribution',
  'employerPlanEmployeeContribution',
  'employerPlanEmployerMatch',
  'annuityFundingTransfer',
  /**
   * A payment under an annuity contract an owned IRA bought with a qualified
   * premium.
   *
   * It is a distribution, and this is the kind that says so. IRC 408(d)(1)
   * reaches an amount "paid or distributed out of an individual retirement
   * plan"; the premium was not one, because nothing was paid out, but the
   * payment is -- Publication 590-B states the pair in two sentences, "You
   * aren't taxed when you receive the annuity contract" and "You are taxed when
   * you start receiving payments under that annuity contract". Section
   * 408(d)(2)(B) then treats every distribution in a year as one distribution,
   * so the payment joins the year's other IRA distributions on Form 8606 line 7
   * and takes the same share of basis they do.
   *
   * Its source account is the CONTRACT, not the IRA that funded it, and that is
   * the fact this kind exists to carry: a section 408(b) individual retirement
   * annuity is an individual retirement plan in its own right under section
   * 7701(a)(37)(B), and a contract held inside a section 408(a) trust is an
   * asset of the account rather than of the payee. Either way the dollars come
   * out of the contract, which is why this is not an `ownedIraRmd` with a
   * borrowed source. Its chronology and movement authority stay absent: the
   * annual simulator's loop position is not an execution sequence, so like the
   * two named kinds above this is not a resolved runtime event kind.
   */
  'annuityContractDistribution',
  'rolloverInflow',
  'otherTraditionalTransfer',
] as const

export type AnnualRetirementRuntimeEventKind =
  (typeof annualRetirementRuntimeEventKinds)[number]

export const annualRetirementResolvedRuntimeEventKinds = [
  'ownedIraRmd',
  'employerPlanRmd',
  'inheritedIraRmd',
  'automaticSeppDistribution',
  'legacyNeedBasedWithdrawal',
  'legacyRothConversion',
  'ownedIraContribution',
  'ownedIraEmployerContribution',
  'employerPlanEmployeeContribution',
  'employerPlanEmployerMatch',
] as const satisfies readonly AnnualRetirementRuntimeEventKind[]

export type AnnualRetirementResolvedRuntimeEventKind =
  (typeof annualRetirementResolvedRuntimeEventKinds)[number]

/**
 * Every producer an annual retirement occurrence can come from. The list is the
 * single source of truth: the record schema below is built from it, so an
 * origin cannot exist in the type and be missing from the validator.
 */
const annualRetirementRuntimeEventOrigins = [
  'rmdEngine',
  'seppEngine',
  'legacyProjection',
  'contributionLedger',
  'transferLedger',
  /**
   * A custodian-direct charitable distribution, which leaves the household
   * altogether. Deliberately not `transferLedger`: that origin's stated claim
   * is a movement between two of the household's own accounts, and IRC
   * 408(d)(8)(B)(i) requires a QCD to be paid directly by the trustee to the
   * donee organization, so there is no household account on the receiving end
   * to transfer to. Recording a gift as a transfer would assert an internal
   * movement for money that had stopped being the household's.
   */
  'charitableDistributionLedger',
] as const

export type AnnualRetirementRuntimeEventOrigin =
  (typeof annualRetirementRuntimeEventOrigins)[number]

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
  /**
   * A resolved contribution record is a post-limit physical occurrence, not a
   * contribution candidate. Its exact gross and upstream lineage come from the
   * producer after owner-wide and section 415(c) limits; a fully suppressed
   * contribution is intentionally absent from the complete runtime inventory.
   */
  recordStatus: 'resolved'
  planId: PlanId
  taxYear: number
  ledgerRunId: string
  eventId: string
  movementAuthorityId: string
  kind: AnnualRetirementResolvedRuntimeEventKind
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
  sourceAccountKind: 'ira' | 'employer'
  sourceInheritanceStatus: 'owned' | 'inherited'
  destinationRothAccountId: AccountId | null
  charity: Readonly<QcdCharityDesignation> | null
  scheduledDate: string
  scheduledSequence: number
}

export interface RuntimeAnnualRetirementPhysicalEvent
  extends AnnualRetirementPhysicalEventBase {
  origin: AnnualRetirementRuntimeEventOrigin
  kind: AnnualRetirementResolvedRuntimeEventKind
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

/**
 * The standalone Plan-driven owned-IRA commit boundary this arm was named for
 * no longer exists: `projection/simulate.ts` settles owned-IRA basis from
 * runtime occurrences through `internal/ownedNonRothIraAnnualAttemptSettlement.ts`.
 * The arm is retained because it still records the narrower fact a consumer
 * needs — that the year's owned-IRA activity resolves per owner without
 * requiring the unified annual ledger.
 */
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
const resolvedRuntimeKindSchema = z.enum(
  annualRetirementResolvedRuntimeEventKinds,
)
const runtimeOriginSchema = z.enum(annualRetirementRuntimeEventOrigins)

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
  kind: resolvedRuntimeKindSchema,
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
type RothAccount = Extract<Plan['accounts'][number], { type: 'roth' }>
/** Traditional or Roth source that can carry an inherited-IRA runtime event. */
type InheritedCapableAccount = TraditionalAccount | RothAccount

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

type StableIdSchema =
  | typeof planIdSchema
  | typeof personIdSchema
  | typeof accountIdSchema
  | typeof actionIdSchema
  | typeof allocationIdSchema

function validatePlanStableId(
  schema: StableIdSchema,
  value: unknown,
  path: string,
  issues: AnnualRetirementInventoryIssue[],
): void {
  const parsed = schema.safeParse(value)
  if (parsed.success) return
  for (const idIssue of parsed.error.issues) {
    issues.push(issue('planInvalid', `${path}: ${idIssue.message}`))
  }
}

function planStableIdIssues(plan: Plan): AnnualRetirementInventoryIssue[] {
  const issues: AnnualRetirementInventoryIssue[] = []
  validatePlanStableId(planIdSchema, plan.id, 'id', issues)
  plan.household.people.forEach((person, index) => {
    validatePlanStableId(
      personIdSchema,
      person.id,
      `household.people.${index}.id`,
      issues,
    )
  })
  plan.accounts.forEach((account, index) => {
    validatePlanStableId(
      accountIdSchema,
      account.id,
      `accounts.${index}.id`,
      issues,
    )
    if (account.ownerPersonId !== null) {
      validatePlanStableId(
        personIdSchema,
        account.ownerPersonId,
        `accounts.${index}.ownerPersonId`,
        issues,
      )
    }
  })
  plan.strategies.retirementActions.forEach((action, actionIndex) => {
    validatePlanStableId(
      actionIdSchema,
      action.actionId,
      `strategies.retirementActions.${actionIndex}.actionId`,
      issues,
    )
    if (action.kind === 'qcd') {
      validatePlanStableId(
        personIdSchema,
        action.donorPersonId,
        `strategies.retirementActions.${actionIndex}.donorPersonId`,
        issues,
      )
    } else if (
      action.kind === 'ordinaryWithdrawal' ||
      action.kind === 'rothConversion'
    ) {
      validatePlanStableId(
        personIdSchema,
        action.personId,
        `strategies.retirementActions.${actionIndex}.personId`,
        issues,
      )
    }
    const allocations = action.kind === 'qcd'
      ? [action.allocation]
      : action.kind === 'ordinaryWithdrawal' ||
          action.kind === 'rothConversion'
        ? action.allocations
        : []
    allocations.forEach((allocation, allocationIndex) => {
      const allocationPath = action.kind === 'qcd'
        ? `strategies.retirementActions.${actionIndex}.allocation`
        : `strategies.retirementActions.${actionIndex}.allocations.${allocationIndex}`
      validatePlanStableId(
        allocationIdSchema,
        allocation.allocationId,
        `${allocationPath}.allocationId`,
        issues,
      )
      validatePlanStableId(
        accountIdSchema,
        allocation.sourceAccountId,
        `${allocationPath}.sourceAccountId`,
        issues,
      )
    })
    if (action.kind === 'rothConversion') {
      validatePlanStableId(
        accountIdSchema,
        action.destinationRothAccountId,
        `strategies.retirementActions.${actionIndex}.destinationRothAccountId`,
        issues,
      )
    }
  })
  return issues
}

function bestEffortRuntimeRecordId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const candidate = record.recordStatus === 'resolved'
    ? record.eventId
    : record.recordStatus === 'unresolved'
      ? record.activityId
      : undefined
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : undefined
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

function sortedDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    else seen.add(value)
  }
  return [...duplicates].sort(compareUtf16CodeUnits)
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

/**
 * Which producer a runtime event kind must have come from.
 *
 * Exhaustive on purpose, and with no trailing fallthrough. The predecessor
 * ended in `return 'transferLedger'`, so a kind nobody classified was silently
 * declared a movement between two household accounts — the one origin whose
 * claim is hardest to notice being wrong, because a mis-origined record still
 * reconciles everywhere else. A new kind is now a compile error here instead.
 */
function expectedOrigin(
  kind: AnnualRetirementRuntimeEventKind,
): AnnualRetirementRuntimeEventOrigin {
  switch (kind) {
    case 'ownedIraRmd':
    case 'employerPlanRmd':
    case 'inheritedIraRmd': return 'rmdEngine'
    case 'automaticSeppDistribution': return 'seppEngine'
    case 'legacyNeedBasedWithdrawal':
    case 'legacyRothConversion':
    case 'legacyQcd': return 'legacyProjection'
    // The aggregate arm's gift is `legacyProjection` above because the
    // household scalar chose it. A named gift is chosen by the request and
    // paid to the donee organization, so it is neither that nor a transfer.
    case 'namedQcd': return 'charitableDistributionLedger'
    case 'ownedIraContribution':
    case 'ownedIraEmployerContribution':
    case 'employerPlanEmployeeContribution':
    case 'employerPlanEmployerMatch': return 'contributionLedger'
    // The contract's payment is sized by the projection's own income block from
    // the Plan's monthly amount, COLA, and payout form -- no request names it
    // and no executor commits it -- so it belongs with the other figures the
    // legacy projection chose. Deliberately not `transferLedger`, which is the
    // premium's origin one line down: the premium moved value between two of
    // the household's own line-6 assets, and the payment leaves the aggregate
    // for the owner's pocket.
    case 'annuityContractDistribution': return 'legacyProjection'
    case 'namedRothConversion':
    case 'annuityFundingTransfer':
    case 'rolloverInflow':
    case 'otherTraditionalTransfer': return 'transferLedger'
  }
}

/**
 * Owned (non-inherited) IRA for this tax year — including S2 treat-as-own after
 * the election year, when the account is the spouse's own for owner RMD and
 * Form 8606 categorization even though the plan still carries the inherited block.
 */
function isOwnedIra(account: TraditionalAccount, taxYear: number): boolean {
  if (account.kind !== 'ira') return false
  if (account.inherited === undefined) return true
  return isTreatAsOwnEffective(account, taxYear)
}

function categoryFor(
  kind:
    | PlanAnnualRetirementPhysicalEvent['kind']
    | AnnualRetirementResolvedRuntimeEventKind,
  ownedIra: boolean,
): AnnualRetirementForm8606Category {
  if (!ownedIra) return 'nonForm8606OrForeignPoolEvent'
  if (kind === 'rothConversion' || kind === 'legacyRothConversion') {
    return 'line8ConversionCandidate'
  }
  if (kind === 'qcd') {
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
  kind: AnnualRetirementResolvedRuntimeEventKind,
  account: InheritedCapableAccount,
  plan: Plan,
  taxYear: number,
  ownerPersonId: PersonId,
): boolean {
  // This boundary checks only Plan-local necessary source/route conditions.
  // Dynamic producer state (including shared contribution-limit usage and
  // exact allowed gross) is owned by the resolved record's upstream evidence
  // and the complete ledger-run attestation, not recomputed here.
  const owner = plan.household.people.find(
    (person) => person.id === ownerPersonId,
  )
  const birthYear = owner === undefined
    ? undefined
    : Number(owner.dob.slice(0, 4))
  const ownerAge = birthYear === undefined
    ? undefined
    : taxYear - birthYear
  const ownerModeledAlive = owner !== undefined &&
    ownerAge !== undefined &&
    ownerAge <= owner.longevity.planningAge
  const anyHouseholdMemberModeledAlive = plan.household.people.some((person) => {
    const personAge = taxYear - Number(person.dob.slice(0, 4))
    return personAge <= person.longevity.planningAge
  })
  const ownerRmdActive = birthYear !== undefined &&
    ownerAge !== undefined &&
    ownerAge >= rmdStartAgeForBirthYear(birthYear)

  // Inherited kinds (K1/K2 execute for Roth): traditional and Roth sources.
  if (kind === 'inheritedIraRmd') {
    if (account.inherited === undefined) return false
    if (!ownerModeledAlive) return false
    const inherited = account.inherited
    // S2 post-election: account left inherited execution for owner RMD —
    // except the same-year flip (election year = death year), when the
    // decedent's unsatisfied year-of-death RMD still executes as inherited
    // (Treas. Reg. §1.408-8(c)(3)).
    if (isTreatAsOwnEffective(account, taxYear)) {
      if (taxYear !== inherited.ownerDeathYear) return false
      // Fall through: structural test must accept the YOD row the ledger emits.
    }
    // Structural required-year test: take the WS3 engine's classified answer
    // (annual requirement or final-sweep year). Legacy formula retained only
    // for legacy-path accounts (X1 / refusal fallback) — including the S2
    // synthetic-S0 refusal mirror of the simulate cache.
    let scheduleInherited = inherited
    const accountType = account.type
    const accountKind = account.kind
    let regimeResult = classifyInheritedRegime({
      accountType,
      accountKind,
      inherited,
    })
    // S2 pre-election: synthetic S0 schedule (election overridden to 'none').
    // When the synthetic classification refuses, mirror the simulate cache:
    // fall back to the legacy formula for the pre-election window so inventory
    // accepts the legacy-formula events the simulator actually emits.
    if (
      regimeResult.kind === 'regime' &&
      regimeResult.regime === 'spouse-treat-as-own-transition' &&
      inherited.beneficiary
    ) {
      scheduleInherited = {
        ...inherited,
        beneficiary: {
          ...inherited.beneficiary,
          election: 'none',
          treatAsOwnElectionYear: undefined,
        },
      }
      const synthetic = classifyInheritedRegime({
        accountType,
        accountKind,
        inherited: scheduleInherited,
      })
      if (synthetic.kind === 'regime') {
        regimeResult = synthetic
      } else {
        // Synthetic refusal → same legacy structural rule as path: 'legacy'.
        regimeResult = synthetic
      }
    }
    if (regimeResult.kind === 'refusal') {
      const yearsSinceDeath = taxYear - inherited.ownerDeathYear
      return (
        yearsSinceDeath >= 10 ||
        (yearsSinceDeath >= 1 && inherited.decedentHadStartedRmds)
      )
    }
    const { pack } = packForYear(taxYear)
    // priorYearEndBalance is a positive sentinel: the structural question is
    // whether the year is an annual/sweep obligation year, not the dollar amount.
    const req = inheritedRequirementForYear({
      pack,
      classification: regimeResult,
      inherited: scheduleInherited,
      year: taxYear,
      priorYearEndBalance: 1,
    })
    // Notice-waived annual years publish evidence but execute zero — no
    // occurrence and no structural inventory requirement (matrix §4).
    if (req.noticeWaived === true) return false
    return (
      req.kind === 'year-of-death-rmd' ||
      req.kind === 'annual-rmd' ||
      req.kind === 'final-sweep'
    )
  }

  // Remaining kinds require a traditional source.
  if (account.type !== 'traditional') return false

  const ownerHasCurrentYearWages = owner !== undefined &&
    ownerAge !== undefined &&
    plan.incomes.some((income) => {
      if (
        income.type !== 'wages' ||
        income.personId !== ownerPersonId ||
        income.annualGross <= 0
      ) return false
      const stopAge = income.endAge ?? owner.retirementAge
      return stopAge === null || ownerAge < stopAge
    })
  const contributionSchedule = account.contributionSchedule
  const hasContributionSchedule =
    contributionSchedule !== undefined && contributionSchedule.length > 0
  const hasPositiveCurrentYearContributionRequest = hasContributionSchedule
    ? contributionSchedule.some((phase) =>
      ownerAge !== undefined &&
      ownerAge >= (phase.fromAge ?? 0) &&
      ownerAge <= (phase.toAge ?? 120) &&
      phase.annualAmount > 0
    )
    : account.annualContribution > 0
  const employerEmployeeContributionPossible =
    account.kind === 'employer' &&
    account.inherited === undefined &&
    ownerModeledAlive &&
    ownerHasCurrentYearWages &&
    hasPositiveCurrentYearContributionRequest
  const ownedIraContributionPossible =
    acceptsContributions(account) &&
    ownerModeledAlive &&
    hasPositiveCurrentYearContributionRequest &&
    (hasContributionSchedule || ownerHasCurrentYearWages)
  const rothConversionStrategy = plan.strategies.rothConversion
  const legacyFillTargetConfigured =
    rothConversionStrategy.mode === 'fillToTarget' &&
    (rothConversionStrategy.target === 'acaCliff' ||
      (rothConversionStrategy.target === 'irmaaTier'
        ? rothConversionStrategy.targetValue !== null &&
          Number.isInteger(rothConversionStrategy.targetValue) &&
          rothConversionStrategy.targetValue > 0
        : rothConversionStrategy.targetValue !== null &&
          rothConversionStrategy.targetValue > 0))
  const legacyRothConversionRequested =
    rothConversionStrategy.mode === 'manual' ||
      rothConversionStrategy.mode === 'optimized'
      ? rothConversionStrategy.conversions
        .filter((conversion) => conversion.year === taxYear)
        .reduce((sum, conversion) => sum + conversion.amount, 0) > 0.01
      : rothConversionStrategy.mode === 'fillToTarget' &&
        taxYear >= rothConversionStrategy.startYear &&
        taxYear <= rothConversionStrategy.endYear &&
        legacyFillTargetConfigured
  const legacyRothConversionRoutePossible =
    anyHouseholdMemberModeledAlive &&
    plan.accounts.some((candidate) => candidate.type === 'roth') &&
    legacyRothConversionRequested

  if (kind === 'ownedIraRmd') {
    return isOwnedIra(account, taxYear) && ownerRmdActive && ownerModeledAlive
  }
  if (kind === 'employerPlanRmd') {
    return account.kind === 'employer' &&
      account.inherited === undefined &&
      ownerRmdActive &&
      ownerModeledAlive
  }
  if (kind === 'automaticSeppDistribution') {
    // IRC 72(t)(3)(B) bars the exception for an employer plan unless the series
    // begins after the participant separates from service, and does not reach
    // IRAs. This inventory decides whether the simulator's SEPP distribution is
    // possible at all, so it applies the same retirement-age separation proxy
    // the simulator applies, on the same annual grain: the participant counts
    // as separated for the whole of the first year the wage model stops paying
    // them, which is the attained age Math.ceil rounds the retirement age up
    // to. Wages run while attained age is below the retirement age, so a
    // retirement age of 65.5 is paid for the year they attain 65 and separated
    // in the year they attain 66; reading the fraction down would separate them
    // in a year they are still paid.
    // See the irc-72-t-3-B-sepp-separation-annual-proxy registry record.
    if (account.inherited !== undefined || account.sepp === undefined) return false
    if (ownerAge === undefined || birthYear === undefined || !ownerModeledAlive) return false
    if (!seppActive(account.sepp.startAge, ownerAge)) return false
    if (account.kind !== 'employer') return true
    const retirementAge = owner?.retirementAge ?? null
    if (retirementAge === null) return false
    return seppSeriesBeginsAfterSeparation(
      `${birthYear + account.sepp.startAge}-12-31`,
      `${birthYear + Math.ceil(retirementAge)}-01-01`,
    )
  }
  if (kind === 'legacyRothConversion') {
    return account.inherited === undefined &&
      legacyRothConversionRoutePossible
  }
  if (kind === 'ownedIraContribution') return ownedIraContributionPossible
  if (kind === 'ownedIraEmployerContribution') {
    const eligibilityFacts = plan.retirementActionEligibilityFacts
    const classifications =
      eligibilityFacts?.iraClassifications.filter(
        (classification) => classification.sourceAccountId === account.id,
      ) ?? []
    const currentYearActivity = eligibilityFacts?.sepSimpleActivities.find(
      (activity) =>
        activity.sourceAccountId === account.id &&
        activity.actionTaxYear === taxYear,
    )
    return isOwnedIra(account, taxYear) && ownerModeledAlive &&
      classifications.length === 1 &&
      (classifications[0]!.subtype === 'sep' ||
        classifications[0]!.subtype === 'simple') &&
      currentYearActivity?.employerContributionMadeForPlanYear === true
  }
  if (kind === 'employerPlanEmployeeContribution') {
    return employerEmployeeContributionPossible
  }
  if (kind === 'employerPlanEmployerMatch') {
    return employerEmployeeContributionPossible &&
      account.employerMatch !== undefined &&
      account.employerMatch.matchPct > 0 &&
      account.employerMatch.capPctOfPay > 0
  }
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
        'A Plan action with a traditional-account allocation needs an explicit execution date before it can enter annual chronology',
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
      const destinationRothAccountId = action.kind === 'rothConversion'
        ? accountIdSchema.parse(action.destinationRothAccountId)
        : null
      const charity = action.kind === 'qcd'
        ? { ...action.charity }
        : null
      const sourceInheritanceStatus = account.inherited === undefined
        ? 'owned'
        : 'inherited'
      const form8606Category = categoryFor(action.kind, isOwnedIra(account, taxYear))
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
          ownerPersonId,
          account.ownerPersonId,
          account.kind,
          sourceInheritanceStatus,
          form8606Category,
          destinationRothAccountId,
          charity,
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
        sourceAccountKind: account.kind,
        sourceInheritanceStatus,
        destinationRothAccountId,
        charity,
        ownerPersonId,
        sourceAccountId,
        grossAmount: positiveUsdCentsSchema.parse(allocation.requestedAmount),
        scheduledDate: action.executionDate,
        scheduledSequence: action.executionSequence,
        eventDate: action.executionDate,
        eventSequence: action.executionSequence,
        form8606Category,
      })
    }
  }
  return events.sort(compareEvents)
}

function canonicalRuntimeEvent(
  record: CanonicalResolvedRecord,
  account: InheritedCapableAccount,
): RuntimeAnnualRetirementPhysicalEvent {
  const ownedIra = account.type === 'traditional' &&
    isOwnedIra(account, record.taxYear)
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
    form8606Category: categoryFor(record.kind, ownedIra),
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
      event.sourceAccountKind,
      event.sourceInheritanceStatus,
      event.destinationRothAccountId,
      event.charity,
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
        { recordId: bestEffortRuntimeRecordId(rawRecord) },
      ),
    ))
  }
  if (recordParseIssues.length > 0) return incomplete(recordParseIssues)
  const sortedRecords = records
    .map((record) => ({
      record,
      sortKey: canonicalRuntimeRecordKey(record),
    }))
    .sort((left, right) => compareUtf16CodeUnits(
      left.sortKey,
      right.sortKey,
    ))
    .map(({ record }) => record)

  const plan = parsedPlan.data
  const stableIdIssues = planStableIdIssues(plan)
  if (stableIdIssues.length > 0) return incomplete(stableIdIssues)
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

  const duplicatePersonIds = sortedDuplicates(
    plan.household.people.map((person) => person.id),
  )
  const duplicateAccountIds = sortedDuplicates(
    plan.accounts.map((account) => account.id),
  )
  for (const personId of duplicatePersonIds) {
    inventoryIssues.push(issue(
      'identifierCollision',
      `Plan household person ID ${personId} is ambiguous`,
      { recordId: personId },
    ))
  }
  for (const accountId of duplicateAccountIds) {
    inventoryIssues.push(issue(
      'identifierCollision',
      `Plan account ID ${accountId} is ambiguous`,
      { recordId: accountId, sourceAccountId: accountIdSchema.parse(accountId) },
    ))
  }
  if (inventoryIssues.length > 0) return incomplete(inventoryIssues)

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
  for (const record of sortedRecords) {
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
    const traditionalAccount = traditionalById.get(record.sourceAccountId)
    // Inherited kinds (K1/K2) execute for Roth sources; other retirement kinds
    // still require a traditional account.
    const account: InheritedCapableAccount | undefined =
      traditionalAccount ??
      (anyAccount?.type === 'roth' && record.kind === 'inheritedIraRmd'
        ? anyAccount
        : undefined)
    if (anyAccount === undefined) {
      inventoryIssues.push(issue(
        'sourceForeignToPlan',
        'Runtime event source account is foreign to the Plan',
        { recordId: record.eventId, sourceAccountId: record.sourceAccountId },
      ))
    } else if (account === undefined) {
      inventoryIssues.push(issue(
        'sourceKindMismatch',
        record.kind === 'inheritedIraRmd'
          ? 'Runtime inherited retirement event source must be a traditional or Roth account'
          : 'Runtime retirement event source must be a traditional account',
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
      if (!resolvedSourceKindValid(
        record.kind,
        account,
        plan,
        taxYear,
        record.ownerPersonId,
      )) {
        inventoryIssues.push(issue(
          'sourceKindMismatch',
          `Runtime event kind ${record.kind} is incompatible with this ${account.type}-account class`,
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
  const canonicalResolvedIdSet = new Set(canonicalResolvedIds)
  const canonicalUnresolvedIdSet = new Set(canonicalUnresolvedIds)
  const resolvedIdsRepeated =
    attestedResolvedIds.length !== new Set(attestedResolvedIds).size
  const unresolvedIdsRepeated =
    attestedUnresolvedIds.length !== new Set(attestedUnresolvedIds).size
  if (resolvedIdsRepeated) {
    inventoryIssues.push(issue(
      'runtimeInventoryUnexpectedRecord',
      'Runtime attestation must not repeat a resolved event ID',
    ))
  }
  if (unresolvedIdsRepeated) {
    inventoryIssues.push(issue(
      'runtimeInventoryUnexpectedRecord',
      'Runtime attestation must not repeat an unresolved activity ID',
    ))
  }
  if (!sameStrings(attestedResolvedIds, canonicalResolvedIds)) {
    const hasUnexpectedResolvedId = resolvedIdsRepeated ||
      attestedResolvedIds.some((id) => !canonicalResolvedIdSet.has(id))
    inventoryIssues.push(issue(
      hasUnexpectedResolvedId
        ? 'runtimeInventoryUnexpectedRecord'
        : 'runtimeInventoryOmission',
      'Attested resolved-event IDs must exactly equal supplied resolved records',
    ))
  }
  if (!sameStrings(attestedUnresolvedIds, canonicalUnresolvedIds)) {
    const hasUnexpectedUnresolvedId = unresolvedIdsRepeated ||
      attestedUnresolvedIds.some((id) => !canonicalUnresolvedIdSet.has(id))
    inventoryIssues.push(issue(
      hasUnexpectedUnresolvedId
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
  // Allocation IDs are validated within their owning action by the Plan
  // contract. They intentionally do not enter the global identifier namespace.
  for (const event of planEvents) {
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
  const inventoryTotal = safeSum(
    events.map((event) => event.grossAmount),
    'Annual physical-event inventory aggregate',
  )
  if (typeof inventoryTotal !== 'number') return incomplete([inventoryTotal])
  const ownedAccounts = [...traditionalById.values()]
    .filter((account) => isOwnedIra(account, taxYear))
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
        return account !== undefined && isOwnedIra(account, taxYear)
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
