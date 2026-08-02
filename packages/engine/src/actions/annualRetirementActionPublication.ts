import { z } from 'zod'

import {
  actionExecutionDispositionSchema,
  retirementActionRequestSchema,
  type ActionOutcome,
  type ActionReadiness,
  type RetirementActionRequest,
  type SourceAllocationRequest,
} from './contract.js'
import { parseCivilIsoDate } from './civilDate.js'
import type {
  ExecuteOrdinaryWithdrawalsResult,
  OrdinaryWithdrawalExecutionEvidence,
  OrdinaryWithdrawalExecutionScheduleIssue,
} from './execution.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import {
  actionReasonSchema,
  createActionReason,
  type ActionReason,
} from './reasons.js'
import { compareUtf16CodeUnits } from './structuralId.js'

export const annualRetirementActionExecutorSources = [
  'ordinaryWithdrawalExecutor',
  'ownedNonRothIraExecutor',
  'rothConversionExecutor',
  'qcdExecutor',
] as const

export type AnnualRetirementActionExecutorSource =
  (typeof annualRetirementActionExecutorSources)[number]

export interface AnnualRetirementActionAllocationRecord {
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly resolution: 'resolved' | 'unresolved'
  readonly requestedAmount: PositiveUsdCents
  readonly executedAmount: UsdCents
  readonly unexecutedAmount: UsdCents
}

export interface AnnualRetirementActionRecord {
  readonly executorSource: AnnualRetirementActionExecutorSource
  readonly request: Readonly<RetirementActionRequest>
  readonly actionId: ActionId
  readonly kind: RetirementActionRequest['kind']
  readonly personId: PersonId | null
  readonly year: number
  readonly scheduledDate: string | null
  readonly scheduledSequence: number | null
  readonly executedDate: string | null
  readonly executedSequence: number | null
  readonly requestedAmount: PositiveUsdCents
  readonly executedAmount: UsdCents
  readonly unexecutedAmount: UsdCents
  readonly readiness: ActionReadiness
  readonly outcome: ActionOutcome
  readonly allocations: readonly Readonly<AnnualRetirementActionAllocationRecord>[]
  readonly reasons: readonly Readonly<ActionReason>[]
}

export type AnnualRetirementActionScheduleDiagnostic = Readonly<{
  kind: 'executionSequenceConflict'
  executorSource: AnnualRetirementActionExecutorSource
  actionId: ActionId
  year: number
  scheduledDate: string | null
  executionSequence: number
  collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
  reason: Readonly<ActionReason<'action-sequence-conflict'>>
}>

type WithoutExecutorSource<T> =
  T extends unknown ? Omit<T, 'executorSource'> : never

export interface AnnualRetirementActionPublicationSource {
  readonly executorSource: AnnualRetirementActionExecutorSource
  readonly records: readonly WithoutExecutorSource<AnnualRetirementActionRecord>[]
  readonly scheduleDiagnostics:
    readonly WithoutExecutorSource<AnnualRetirementActionScheduleDiagnostic>[]
}

export interface AnnualRetirementActionPublication {
  readonly taxYear: number
  readonly executorSources:
    readonly [AnnualRetirementActionExecutorSource, ...AnnualRetirementActionExecutorSource[]]
  readonly records: readonly Readonly<AnnualRetirementActionRecord>[]
  readonly scheduleDiagnostics:
    readonly Readonly<AnnualRetirementActionScheduleDiagnostic>[]
}

export interface PublishAnnualRetirementActionsInput {
  readonly taxYear: number
  readonly requests: readonly Readonly<RetirementActionRequest>[]
  readonly sources: readonly Readonly<AnnualRetirementActionPublicationSource>[]
}

const annualRecordAllocationSchema = z
  .object({
    allocationId: allocationIdSchema,
    sourceAccountId: accountIdSchema,
    resolution: z.enum(['resolved', 'unresolved']),
    requestedAmount: positiveUsdCentsSchema,
    executedAmount: usdCentsSchema,
    unexecutedAmount: usdCentsSchema,
  })
  .strict()

const annualRecordSchema = z
  .object({
    request: retirementActionRequestSchema,
    actionId: actionIdSchema,
    kind: z.enum([
      'ordinaryWithdrawal',
      'rothConversion',
      'qcd',
      'legacyAggregateWithdrawal',
      'legacyAggregateRothConversion',
      'legacyAggregateQcd',
    ]),
    personId: personIdSchema.nullable(),
    year: z.number().int().min(1).max(9999),
    scheduledDate: z.string().nullable(),
    scheduledSequence:
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    executedDate: z.string().nullable(),
    executedSequence:
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
    requestedAmount: positiveUsdCentsSchema,
    executedAmount: usdCentsSchema,
    unexecutedAmount: usdCentsSchema,
    readiness: z.enum(['actionable', 'nonActionable']),
    outcome: z.enum(['executed', 'partial', 'refused', 'unsupported']),
    allocations: z.array(annualRecordAllocationSchema),
    reasons: z.array(actionReasonSchema),
  })
  .strict()

const publicationDiagnosticSchema = z
  .object({
    kind: z.literal('executionSequenceConflict'),
    actionId: actionIdSchema,
    year: z.number().int().min(1).max(9999),
    scheduledDate: z.string().nullable(),
    executionSequence:
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    collidingActionIds: z.array(actionIdSchema).min(2),
    reason: actionReasonSchema,
  })
  .strict()

const publicationSourceSchema = z
  .object({
    executorSource: z.enum(annualRetirementActionExecutorSources),
    records: z.array(annualRecordSchema).min(1),
    scheduleDiagnostics: z.array(publicationDiagnosticSchema),
  })
  .strict()

function personId(request: Readonly<RetirementActionRequest>): PersonId | null {
  if (request.kind === 'qcd') return request.donorPersonId
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.personId
  }
  return null
}

function atLeastTwoActionIds(
  values: readonly ActionId[],
): [ActionId, ActionId, ...ActionId[]] {
  if (values.length < 2) {
    throw new Error('Schedule conflict must contain at least two action IDs')
  }
  return [values[0]!, values[1]!, ...values.slice(2)]
}

function allocationRecords(
  evidence: Readonly<OrdinaryWithdrawalExecutionEvidence>,
): AnnualRetirementActionAllocationRecord[] {
  return evidence.allocations.map((allocation) => ({
    allocationId: allocation.allocationId,
    sourceAccountId: allocation.sourceAccountId,
    resolution: allocation.resolution,
    requestedAmount: allocation.requestedAmount,
    executedAmount: allocation.executedAmount,
    unexecutedAmount: allocation.unexecutedAmount,
  }))
}

function requestAllocations(
  request: Readonly<RetirementActionRequest>,
): readonly Readonly<SourceAllocationRequest>[] {
  if (request.kind === 'qcd') return [request.allocation]
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.allocations
  }
  return []
}

type UnsupportedLegacyScheduleIssueKind = Exclude<
  OrdinaryWithdrawalExecutionScheduleIssue['kind'],
  'executionSequenceConflict'
>

export type OrdinaryWithdrawalPublicationEligibility =
  | Readonly<{ kind: 'publicationEligible' }>
  | Readonly<{
      kind: 'legacyScheduleDiagnosticsOnly'
      unsupportedIssueKinds: readonly [
        UnsupportedLegacyScheduleIssueKind,
        ...UnsupportedLegacyScheduleIssueKind[],
      ]
    }>

function allocationOrder(
  left: Readonly<SourceAllocationRequest>,
  right: Readonly<SourceAllocationRequest>,
): number {
  return compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}

const adjustedReasonOrder = [
  'qcd-person-limit-trimmed',
  'qcd-contribution-offset-applied',
  'qcd-taxable-amount-trimmed',
] as const

function reasonGroup(
  outcome: ActionOutcome,
  reason: Readonly<ActionReason>,
): number {
  if (outcome === 'partial') return reason.outcome === 'partial' ? 0 : 1
  if (outcome === 'unsupported') return reason.outcome === 'unsupported' ? 0 : 1
  return 0
}

function reasonOrder(
  outcome: ActionOutcome,
  left: Readonly<ActionReason>,
  right: Readonly<ActionReason>,
): number {
  const groupDifference = reasonGroup(outcome, left) - reasonGroup(outcome, right)
  if (groupDifference !== 0) return groupDifference
  if (left.outcome === 'adjusted' && right.outcome === 'adjusted') {
    const adjustedDifference = adjustedReasonOrder.indexOf(
      left.code as (typeof adjustedReasonOrder)[number],
    ) - adjustedReasonOrder.indexOf(
      right.code as (typeof adjustedReasonOrder)[number],
    )
    if (adjustedDifference !== 0) return adjustedDifference
  }
  return compareUtf16CodeUnits(left.code, right.code) ||
    compareUtf16CodeUnits(left.personId ?? '', right.personId ?? '') ||
    compareUtf16CodeUnits(left.accountId ?? '', right.accountId ?? '') ||
    compareUtf16CodeUnits(left.allocationId ?? '', right.allocationId ?? '')
}

function canonicalReasons(
  outcome: ActionOutcome,
  reasons: readonly Readonly<ActionReason>[],
): ActionReason[] {
  const byStructure = new Map<string, ActionReason>()
  for (const reason of reasons) {
    const key = JSON.stringify([
      reason.code,
      reason.personId ?? null,
      reason.accountId ?? null,
      reason.allocationId ?? null,
    ])
    if (!byStructure.has(key)) byStructure.set(key, { ...reason } as ActionReason)
  }
  return [...byStructure.values()].sort((left, right) =>
    reasonOrder(outcome, left, right))
}

function isConflictOnlyRecord(
  record: Readonly<{
    reasons: readonly Readonly<{ code: ActionReason['code'] }>[]
  }>,
): boolean {
  return record.reasons.length === 1 && (
    record.reasons[0]?.code === 'action-sequence-conflict' ||
    record.reasons[0]?.code === 'action-batch-schedule-conflict'
  )
}

// Structural allocation reasons cannot reach publication: the canonical request
// schema rejects duplicate IDs/sources and amount mismatches before execution.
const conversionPreflightReasonCodeList = [
  'conversion-date-missing',
  'conversion-date-invalid',
  'conversion-date-outside-action-year',
  'person-not-found',
  'person-not-alive',
  'required-facts-missing',
  'source-account-not-found',
  'conversion-source-owner-mismatch',
  'conversion-source-not-convertible',
  'conversion-inherited-source',
  'conversion-plan-availability-unknown',
  'conversion-ira-subtype-unknown',
  'conversion-simple-two-year-rule-unknown',
  'conversion-simple-two-year-period-open',
  'conversion-destination-not-found',
  'conversion-destination-owner-mismatch',
  'conversion-destination-incompatible',
  'conversion-employer-destination-unsupported',
  'conversion-principal-withholding-unsupported',
] as const satisfies readonly ActionReason['code'][]

const qcdPreflightReasonCodeList = [
  'qcd-date-missing',
  'qcd-date-invalid',
  'qcd-date-outside-action-year',
  'person-not-found',
  'person-not-alive',
  'required-facts-missing',
  'source-account-not-found',
  'qcd-before-age-70-half',
  'qcd-source-owner-mismatch',
  'qcd-source-not-ira',
  'qcd-roth-source-unsupported',
  'qcd-inherited-basis-unsupported',
  'qcd-sep-simple-activity-unknown',
  'qcd-ongoing-sep-simple',
  'qcd-split-interest-unsupported',
  'qcd-direct-charity-unconfirmed',
  'qcd-entire-distribution-deductibility-unconfirmed',
  'qcd-contribution-history-unknown',
] as const satisfies readonly ActionReason['code'][]

const conversionPreflightReasonCodes = new Set<ActionReason['code']>(
  conversionPreflightReasonCodeList,
)
const qcdPreflightReasonCodes = new Set<ActionReason['code']>(
  qcdPreflightReasonCodeList,
)

type PreflightReasonCode =
  | (typeof conversionPreflightReasonCodeList)[number]
  | (typeof qcdPreflightReasonCodeList)[number]

type PreflightIdentifierShape =
  | 'none'
  | 'person'
  | 'source-account'
  | 'source-allocation'
  | 'person-source-allocation'
  | 'destination-account'
  | 'person-destination-account'

// These are the exact identifier roles emitted by account eligibility. A code
// alone is not evidence that the ordinary executor reached that producer path.
const preflightIdentifierShapes = {
  'conversion-date-missing': 'none',
  'conversion-date-invalid': 'none',
  'conversion-date-outside-action-year': 'none',
  'qcd-date-missing': 'none',
  'qcd-date-invalid': 'none',
  'qcd-date-outside-action-year': 'none',
  'person-not-found': 'person',
  'person-not-alive': 'person',
  'required-facts-missing': 'person',
  'source-account-not-found': 'source-allocation',
  'conversion-source-owner-mismatch': 'person-source-allocation',
  'conversion-source-not-convertible': 'source-allocation',
  'conversion-inherited-source': 'source-allocation',
  'conversion-plan-availability-unknown': 'source-allocation',
  'conversion-ira-subtype-unknown': 'source-allocation',
  'conversion-simple-two-year-rule-unknown': 'source-allocation',
  'conversion-simple-two-year-period-open': 'source-allocation',
  'conversion-destination-not-found': 'destination-account',
  'conversion-destination-owner-mismatch': 'person-destination-account',
  'conversion-destination-incompatible': 'destination-account',
  'conversion-employer-destination-unsupported': 'destination-account',
  'conversion-principal-withholding-unsupported': 'none',
  'qcd-before-age-70-half': 'person',
  'qcd-source-owner-mismatch': 'person-source-allocation',
  'qcd-source-not-ira': 'source-account',
  'qcd-roth-source-unsupported': 'source-account',
  'qcd-inherited-basis-unsupported': 'source-account',
  'qcd-sep-simple-activity-unknown': 'source-account',
  'qcd-ongoing-sep-simple': 'source-account',
  'qcd-split-interest-unsupported': 'none',
  'qcd-direct-charity-unconfirmed': 'none',
  'qcd-entire-distribution-deductibility-unconfirmed': 'none',
  'qcd-contribution-history-unknown': 'person',
} as const satisfies Readonly<Record<
  PreflightReasonCode,
  PreflightIdentifierShape
>>

function isPreflightReasonCode(
  code: ActionReason['code'],
): code is PreflightReasonCode {
  return code in preflightIdentifierShapes
}

function preflightReasonHasCanonicalIdentifiers(
  reason: Readonly<{
    code: ActionReason['code']
    personId?: string
    accountId?: string
    allocationId?: string
  }>,
  request: Readonly<RetirementActionRequest>,
): boolean {
  if (!isPreflightReasonCode(reason.code)) return false
  const personId = request.kind === 'rothConversion'
    ? request.personId
    : request.kind === 'qcd'
      ? request.donorPersonId
      : undefined
  const allocations = request.kind === 'rothConversion'
    ? request.allocations
    : request.kind === 'qcd'
      ? [request.allocation]
      : []
  const hasNoPerson = reason.personId === undefined
  const hasNoAccount = reason.accountId === undefined
  const hasNoAllocation = reason.allocationId === undefined
  const matchesSourceAccount = reason.accountId !== undefined &&
    allocations.some((allocation) =>
      allocation.sourceAccountId === reason.accountId)
  const matchesSourceAllocation = reason.accountId !== undefined &&
    reason.allocationId !== undefined &&
    allocations.some((allocation) =>
      allocation.sourceAccountId === reason.accountId &&
      allocation.allocationId === reason.allocationId)
  const matchesDestination = request.kind === 'rothConversion' &&
    reason.accountId === request.destinationRothAccountId

  switch (preflightIdentifierShapes[reason.code]) {
    case 'none':
      return hasNoPerson && hasNoAccount && hasNoAllocation
    case 'person':
      return reason.personId === personId && hasNoAccount && hasNoAllocation
    case 'source-account':
      return hasNoPerson && matchesSourceAccount && hasNoAllocation
    case 'source-allocation':
      return hasNoPerson && matchesSourceAllocation
    case 'person-source-allocation':
      return reason.personId === personId && matchesSourceAllocation
    case 'destination-account':
      return hasNoPerson && matchesDestination && hasNoAllocation
    case 'person-destination-account':
      return reason.personId === personId && matchesDestination && hasNoAllocation
  }
}

function isCanonicalOrdinaryMixedKindFallback(
  record: Readonly<{
    readiness: string
    outcome: string
    executedAmount: number
    unexecutedAmount: number
    requestedAmount: number
    executedDate: string | null
    executedSequence: number | null
    allocations: readonly Readonly<{
      executedAmount: number
      unexecutedAmount: number
      requestedAmount: number
    }>[]
    reasons: readonly Readonly<{
      code: ActionReason['code']
      personId?: string
      accountId?: string
      allocationId?: string
    }>[]
  }>,
  request: Readonly<RetirementActionRequest>,
): boolean {
  if (request.kind === 'ordinaryWithdrawal') {
    return false
  }
  const expectedCode =
    request.kind === 'legacyAggregateWithdrawal'
      ? 'withdrawal-aggregate-unallocated'
      : request.kind === 'legacyAggregateRothConversion'
        ? 'conversion-aggregate-unallocated'
        : request.kind === 'legacyAggregateQcd'
          ? 'qcd-aggregate-unallocated'
          : 'required-facts-missing'
  const expectedPersonId =
    request.kind === 'rothConversion'
      ? request.personId
      : request.kind === 'qcd'
        ? request.donorPersonId
        : undefined
  const hasCanonicalScopeReason = record.reasons.some((reason) =>
    reason.code === expectedCode &&
    reason.personId === expectedPersonId &&
    reason.accountId === undefined &&
    reason.allocationId === undefined)
  const legacyAggregate =
    request.kind === 'legacyAggregateWithdrawal' ||
    request.kind === 'legacyAggregateRothConversion' ||
    request.kind === 'legacyAggregateQcd'
  const allowedCurrentReasonCodes =
    request.kind === 'rothConversion'
      ? conversionPreflightReasonCodes
      : request.kind === 'qcd'
        ? qcdPreflightReasonCodes
        : null
  return record.readiness === 'nonActionable' &&
    record.outcome === 'unsupported' &&
    record.executedAmount === 0 &&
    record.unexecutedAmount === record.requestedAmount &&
    record.executedDate === null &&
    record.executedSequence === null &&
    record.allocations.every((allocation) =>
      allocation.executedAmount === 0 &&
      allocation.unexecutedAmount === allocation.requestedAmount) &&
    hasCanonicalScopeReason &&
    (legacyAggregate
      ? record.reasons.length === 1
      : allowedCurrentReasonCodes !== null &&
        record.reasons.every((reason) =>
          allowedCurrentReasonCodes.has(reason.code) &&
          isPreflightReasonCode(reason.code) &&
          preflightReasonHasCanonicalIdentifiers(reason, request)))
}

const destinationAccountReasonCodes = new Set<ActionReason['code']>([
  'conversion-destination-not-found',
  'conversion-destination-owner-mismatch',
  'conversion-destination-incompatible',
  'conversion-roth-simple-destination-unsupported',
  'conversion-employer-destination-unsupported',
])

const destinationInspectionReasonCodes = new Set(
  [...destinationAccountReasonCodes].filter((code) =>
    code !== 'conversion-destination-not-found'),
)

const destinationClassificationReasonCodes = new Set<ActionReason['code']>([
  'conversion-destination-incompatible',
  'conversion-roth-simple-destination-unsupported',
  'conversion-employer-destination-unsupported',
])

const mutuallyExclusivePersonReasonPairs = [
  ['person-not-found', 'person-not-alive'],
  ['person-not-found', 'qcd-before-age-70-half'],
  ['person-not-found', 'qcd-contribution-history-unknown'],
  ['qcd-before-age-70-half', 'qcd-contribution-history-unknown'],
] as const satisfies readonly (readonly [ActionReason['code'], ActionReason['code']])[]

const preCanonicalReasonCodes = new Set<ActionReason['code']>([
  'duplicate-source-account',
  'duplicate-allocation-id',
  'allocation-total-mismatch',
])

const sourceReasonResolutionRequirements = {
  'source-account-not-found': 'unresolved',
  'source-owner-mismatch': 'resolved',
  'joint-source-acting-person-mismatch': 'resolved',
  'required-facts-missing': 'either',
  'source-balance-trimmed': 'resolved',
  'source-balance-unavailable': 'resolved',
  'withdrawal-taxable-basis-unsupported': 'resolved',
  'withdrawal-employer-basis-unsupported': 'resolved',
  'withdrawal-roth-ira-character-unsupported': 'resolved',
  'withdrawal-designated-roth-character-unsupported': 'resolved',
  'withdrawal-source-not-spendable': 'resolved',
  'withdrawal-penalty-evidence-missing': 'resolved',
  'withdrawal-plan-availability-unknown': 'resolved',
  'withdrawal-plan-not-available': 'resolved',
  'withdrawal-rule-of-55-evidence-missing': 'resolved',
  'withdrawal-sepp-evidence-missing': 'resolved',
  'withdrawal-inherited-facts-missing': 'resolved',
  'withdrawal-hsa-qualification-unknown': 'resolved',
  'withdrawal-source-type-unsupported': 'resolved',
  'conversion-source-owner-mismatch': 'resolved',
  'conversion-source-not-convertible': 'resolved',
  'conversion-ira-subtype-unknown': 'resolved',
  'conversion-simple-two-year-rule-unknown': 'resolved',
  'conversion-simple-two-year-period-open': 'resolved',
  'conversion-plan-availability-unknown': 'resolved',
  'conversion-plan-not-available': 'resolved',
  'conversion-employer-basis-unsupported': 'resolved',
  'conversion-inherited-source': 'resolved',
  'conversion-rmd-reserve-unavailable': 'resolved',
  'conversion-basis-evidence-missing': 'resolved',
  'conversion-balance-trimmed': 'resolved',
  'conversion-balance-unavailable': 'resolved',
  'qcd-source-owner-mismatch': 'resolved',
  'qcd-source-not-ira': 'resolved',
  'qcd-sep-simple-activity-unknown': 'resolved',
  'qcd-ongoing-sep-simple': 'resolved',
  'qcd-roth-source-unsupported': 'resolved',
  'qcd-taxable-amount-trimmed': 'resolved',
  'qcd-inherited-basis-unsupported': 'resolved',
  'qcd-rmd-evidence-missing': 'resolved',
  'qcd-balance-trimmed': 'resolved',
  'qcd-balance-unavailable': 'resolved',
} as const satisfies Readonly<Partial<Record<
  ActionReason['code'],
  'resolved' | 'unresolved' | 'either'
>>>

const sourceIdentifierReasonCodes = new Set<ActionReason['code']>([
  ...preCanonicalReasonCodes,
  ...Object.keys(sourceReasonResolutionRequirements) as ActionReason['code'][],
])

const balanceReasonAllocationStates = {
  'source-balance-trimmed': 'partial',
  'source-balance-unavailable': 'unavailable',
  'conversion-balance-trimmed': 'partial',
  'conversion-balance-unavailable': 'unavailable',
  'qcd-balance-trimmed': 'partial',
  'qcd-balance-unavailable': 'unavailable',
} as const satisfies Readonly<Partial<Record<
  ActionReason['code'],
  'partial' | 'unavailable'
>>>

const physicalBalanceReasonCodes = new Set<ActionReason['code']>(
  Object.keys(balanceReasonAllocationStates) as ActionReason['code'][],
)

const mutuallyExclusiveAllocationReasonGroups: readonly ReadonlySet<
  ActionReason['code']
>[] = [
  new Set([
    'source-owner-mismatch',
    'joint-source-acting-person-mismatch',
  ]),
  new Set([
    'withdrawal-plan-availability-unknown',
    'withdrawal-plan-not-available',
  ]),
  new Set([
    'conversion-source-not-convertible',
    'conversion-inherited-source',
    'conversion-plan-availability-unknown',
    'conversion-plan-not-available',
    'conversion-ira-subtype-unknown',
    'conversion-simple-two-year-rule-unknown',
    'conversion-simple-two-year-period-open',
  ]),
  new Set([
    'qcd-source-not-ira',
    'qcd-roth-source-unsupported',
    'qcd-inherited-basis-unsupported',
    'qcd-sep-simple-activity-unknown',
    'qcd-ongoing-sep-simple',
  ]),
]

function reasonAppliesToKind(
  kind: RetirementActionRequest['kind'],
  code: ActionReason['code'],
): boolean {
  if (
    kind === 'legacyAggregateWithdrawal' ||
    kind === 'legacyAggregateRothConversion' ||
    kind === 'legacyAggregateQcd'
  ) {
    const aggregateReasonCode =
      kind === 'legacyAggregateWithdrawal'
        ? 'withdrawal-aggregate-unallocated'
        : kind === 'legacyAggregateRothConversion'
          ? 'conversion-aggregate-unallocated'
          : 'qcd-aggregate-unallocated'
    return code === aggregateReasonCode ||
      code === 'action-batch-schedule-conflict'
  }
  if (code === 'source-balance-trimmed' || code === 'source-balance-unavailable') {
    return kind === 'ordinaryWithdrawal'
  }
  if (
    code === 'source-owner-mismatch' ||
    code === 'joint-source-acting-person-mismatch'
  ) {
    return kind === 'ordinaryWithdrawal'
  }
  if (code.startsWith('withdrawal-')) return kind === 'ordinaryWithdrawal'
  if (code.startsWith('qcd-')) return kind === 'qcd'
  if (code.startsWith('conversion-')) {
    return kind === 'rothConversion' ||
      (kind === 'ordinaryWithdrawal' &&
        code === 'conversion-tax-funding-evidence-unsupported')
  }
  return true
}

function canonicalRequest(
  rawRequest: Readonly<RetirementActionRequest>,
): Readonly<RetirementActionRequest> {
  const request = retirementActionRequestSchema.parse(rawRequest)
  if (request.kind !== 'ordinaryWithdrawal' && request.kind !== 'rothConversion') {
    return request
  }
  return {
    ...request,
    allocations: [...request.allocations].sort(allocationOrder),
  }
}

function destinationAccountId(
  request: Readonly<RetirementActionRequest>,
): AccountId | null {
  return request.kind === 'rothConversion'
    ? request.destinationRothAccountId
    : null
}

function scheduleFailureFallbackRecord(
  request: Readonly<RetirementActionRequest>,
  hasConflictDiagnostic: boolean,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  const allocations = request.kind === 'qcd'
    ? [request.allocation]
    : request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion'
      ? request.allocations
      : []
  return {
    request,
    actionId: request.actionId,
    kind: request.kind,
    personId: personId(request),
    year: request.year,
    scheduledDate: 'executionDate' in request ? (request.executionDate ?? null) : null,
    scheduledSequence:
      'executionSequence' in request ? request.executionSequence : null,
    executedDate: null,
    executedSequence: null,
    requestedAmount: request.requestedAmount,
    executedAmount: asUsdCents(0),
    unexecutedAmount: request.requestedAmount,
    readiness: 'nonActionable',
    outcome: 'refused',
    allocations: allocations.map((allocation) => ({
      allocationId: allocation.allocationId,
      sourceAccountId: allocation.sourceAccountId,
      resolution: 'unresolved',
      requestedAmount: allocation.requestedAmount,
      executedAmount: asUsdCents(0),
      unexecutedAmount: allocation.requestedAmount,
    })),
    reasons: hasConflictDiagnostic
      ? [createActionReason('action-sequence-conflict')]
      : [createActionReason('action-batch-schedule-conflict')],
  }
}

type RetirementActionScheduleState =
  | Readonly<{
      kind: 'valid'
      effectiveDate: string
      undated: 0 | 1
      sequence: number
    }>
  | Readonly<{
      kind: 'missingDate' | 'invalidDate' | 'outsideActionYear' | 'unscheduled'
    }>

function retirementActionScheduleState(
  record: Pick<
    AnnualRetirementActionRecord,
    'kind' | 'year' | 'scheduledDate' | 'scheduledSequence'
  >,
): RetirementActionScheduleState {
  if (record.scheduledSequence === null) return { kind: 'unscheduled' }
  if (record.scheduledDate === null) {
    if (record.kind !== 'ordinaryWithdrawal') return { kind: 'missingDate' }
    return {
      kind: 'valid',
      effectiveDate: `${String(record.year).padStart(4, '0')}-12-31`,
      undated: 1,
      sequence: record.scheduledSequence,
    }
  }
  if (record.scheduledDate.length === 0) return { kind: 'missingDate' }
  const parsed = parseCivilIsoDate(record.scheduledDate)
  if (parsed === null) return { kind: 'invalidDate' }
  if (parsed.year !== record.year) return { kind: 'outsideActionYear' }
  return {
    kind: 'valid',
    effectiveDate: record.scheduledDate,
    undated: 0,
    sequence: record.scheduledSequence,
  }
}

const dateReasonScheduleStates: Partial<
  Record<ActionReason['code'], readonly RetirementActionScheduleState['kind'][]>
> = {
  'conversion-date-missing': ['missingDate'],
  'conversion-date-invalid': ['invalidDate'],
  'conversion-date-outside-action-year': ['outsideActionYear'],
  'conversion-simple-two-year-period-open': ['valid', 'outsideActionYear'],
  'qcd-date-missing': ['missingDate'],
  'qcd-date-invalid': ['invalidDate'],
  'qcd-date-outside-action-year': ['outsideActionYear'],
  'qcd-before-age-70-half': ['valid', 'outsideActionYear'],
  'qcd-contribution-history-unknown': ['valid'],
}

/**
 * Detach the ordinary executor's rich result into the common annual record
 * contract. Balance, character, and penalty artifacts remain on the native
 * executor result.
 */
export function ordinaryWithdrawalPublicationEligibility(
  execution: Readonly<ExecuteOrdinaryWithdrawalsResult>,
): Readonly<OrdinaryWithdrawalPublicationEligibility> {
  const unsupportedIssueKinds = [...new Set(
    execution.scheduleIssues.flatMap((issue) =>
      issue.kind === 'executionSequenceConflict' ? [] : [issue.kind]),
  )].sort(compareUtf16CodeUnits) as UnsupportedLegacyScheduleIssueKind[]
  return unsupportedIssueKinds.length === 0
    ? { kind: 'publicationEligible' }
    : {
        kind: 'legacyScheduleDiagnosticsOnly',
        unsupportedIssueKinds: [
          unsupportedIssueKinds[0]!,
          ...unsupportedIssueKinds.slice(1),
        ],
      }
}

export function ordinaryWithdrawalPublicationSource(
  execution: Readonly<ExecuteOrdinaryWithdrawalsResult>,
): Readonly<AnnualRetirementActionPublicationSource> {
  if (
    execution.committed === (execution.scheduleIssues.length > 0) ||
    (execution.scheduleIssues.length > 0 && execution.evidence.length > 0)
  ) {
    throw new Error(
      'Cannot publish ordinary-withdrawal evidence whose commit state differs from its schedule abort state',
    )
  }
  const eligibility = ordinaryWithdrawalPublicationEligibility(execution)
  if (eligibility.kind === 'legacyScheduleDiagnosticsOnly') {
    throw new Error(
      `Cannot publish an annual action batch whose legacy schedule issues have no canonical typed refusal reasons: ${eligibility.unsupportedIssueKinds.join(', ')}`,
    )
  }

  const diagnostics: Array<
    WithoutExecutorSource<AnnualRetirementActionScheduleDiagnostic>
  > = []
  for (const issue of execution.scheduleIssues) {
    if (issue.kind !== 'executionSequenceConflict') continue
    for (const actionId of issue.collidingActionIds) {
      diagnostics.push({
        ...issue,
        actionId,
        collidingActionIds: [...issue.collidingActionIds],
        reason: { ...issue.reason },
      })
    }
  }

  const diagnosedActionIds = new Set(
    diagnostics.map((diagnostic) => diagnostic.actionId),
  )
  const records = execution.scheduleIssues.length > 0
    ? execution.requests.map((request) => scheduleFailureFallbackRecord(
        request,
        diagnosedActionIds.has(request.actionId),
      ))
    : execution.evidence.map((evidence) => ({
        request: evidence.request,
        actionId: evidence.actionId,
        kind: evidence.kind,
        personId: evidence.personId,
        year: evidence.year,
        scheduledDate: evidence.scheduledDate,
        scheduledSequence: evidence.scheduledSequence,
        executedDate: evidence.executedDate,
        executedSequence: evidence.executedSequence,
        requestedAmount: evidence.disposition.requestedAmount,
        executedAmount: evidence.disposition.executedAmount,
        unexecutedAmount: evidence.disposition.unexecutedAmount,
        readiness: evidence.disposition.readiness,
        outcome: evidence.disposition.outcome,
        allocations: allocationRecords(evidence),
        reasons: canonicalReasons(
          evidence.disposition.outcome,
          evidence.disposition.reasons,
        ),
      }))

  return {
    executorSource: 'ordinaryWithdrawalExecutor',
    records,
    scheduleDiagnostics: diagnostics,
  }
}

function scheduleKey(record: Readonly<AnnualRetirementActionRecord>): string | null {
  const state = retirementActionScheduleState(record)
  return state.kind === 'valid'
    ? JSON.stringify([state.effectiveDate, state.undated, state.sequence])
    : null
}

function schedulePosition(
  record: Readonly<AnnualRetirementActionRecord>,
): readonly [date: string, undated: number, sequence: number] | null {
  const state = retirementActionScheduleState(record)
  return state.kind === 'valid'
    ? [state.effectiveDate, state.undated, state.sequence]
    : null
}

function assertLinkedWithdrawalRequests(
  requests: readonly Readonly<RetirementActionRequest>[],
  requestById: ReadonlyMap<ActionId, Readonly<RetirementActionRequest>>,
): void {
  const conversionIdsByWithdrawalId = new Map<ActionId, ActionId[]>()
  for (const request of requests) {
    if (
      request.kind !== 'rothConversion' ||
      request.taxFunding.kind !== 'linkedWithdrawal'
    ) continue
    const withdrawalId = request.taxFunding.withdrawalActionId
    const conversionIds = conversionIdsByWithdrawalId.get(withdrawalId)
    if (conversionIds === undefined) {
      conversionIdsByWithdrawalId.set(withdrawalId, [request.actionId])
    } else {
      conversionIds.push(request.actionId)
    }
  }
  for (const request of requests) {
    if (
      request.kind !== 'rothConversion' ||
      request.taxFunding.kind !== 'linkedWithdrawal'
    ) continue
    const withdrawalId = request.taxFunding.withdrawalActionId
    const withdrawal = requestById.get(withdrawalId)
    if (
      conversionIdsByWithdrawalId.get(withdrawalId)?.length !== 1 ||
      withdrawal?.kind !== 'ordinaryWithdrawal' ||
      withdrawal.personId !== request.personId ||
      withdrawal.year !== request.year ||
      withdrawal.purpose.kind !== 'taxPayment' ||
      withdrawal.purpose.referenceId !== request.actionId
    ) {
      throw new Error(
        `Linked conversion funding differs for action "${request.actionId}"`,
      )
    }
  }
}

function assertLinkedWithdrawalRecordAtomicity(
  requests: readonly Readonly<RetirementActionRequest>[],
  records: readonly Readonly<AnnualRetirementActionRecord>[],
): void {
  const recordById = new Map(records.map((record) => [record.actionId, record]))
  for (const request of requests) {
    if (
      request.kind !== 'rothConversion' ||
      request.taxFunding.kind !== 'linkedWithdrawal'
    ) continue
    const conversionRecord = recordById.get(request.actionId)
    const withdrawalRecord = recordById.get(request.taxFunding.withdrawalActionId)
    if (
      conversionRecord === undefined ||
      withdrawalRecord === undefined ||
      (conversionRecord.executedAmount > 0) !==
        (withdrawalRecord.executedAmount > 0)
    ) {
      throw new Error(
        `Linked conversion funding disposition differs for action "${request.actionId}"`,
      )
    }
  }
}

function recordOrder(
  left: Readonly<AnnualRetirementActionRecord>,
  right: Readonly<AnnualRetirementActionRecord>,
): number {
  const leftPosition = schedulePosition(left)
  const rightPosition = schedulePosition(right)
  if (leftPosition === null || rightPosition === null) {
    if (leftPosition === null && rightPosition !== null) return 1
    if (leftPosition !== null && rightPosition === null) return -1
    return compareUtf16CodeUnits(left.actionId, right.actionId)
  }
  return compareUtf16CodeUnits(leftPosition[0], rightPosition[0]) ||
    leftPosition[1] - rightPosition[1] ||
    leftPosition[2] - rightPosition[2] ||
    compareUtf16CodeUnits(left.actionId, right.actionId)
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function assertRecordBinding(
  record: Omit<AnnualRetirementActionRecord, 'executorSource'>,
  request: Readonly<RetirementActionRequest>,
): void {
  if (
    record.actionId !== request.actionId ||
    record.kind !== request.kind ||
    record.year !== request.year ||
    record.personId !== personId(request) ||
    record.requestedAmount !== request.requestedAmount
  ) {
    throw new Error(`Executor record identity differs for action "${request.actionId}"`)
  }
  const scheduledDate =
    'executionDate' in request ? (request.executionDate ?? null) : null
  const scheduledSequence =
    'executionSequence' in request ? request.executionSequence : null
  if (
    record.scheduledDate !== scheduledDate ||
    record.scheduledSequence !== scheduledSequence
  ) {
    throw new Error(`Executor schedule binding differs for action "${request.actionId}"`)
  }
  const scheduleState = retirementActionScheduleState(record)

  actionExecutionDispositionSchema.parse({
    outcome: record.outcome,
    readiness: record.readiness,
    requestedAmount: record.requestedAmount,
    executedAmount: record.executedAmount,
    unexecutedAmount: record.unexecutedAmount,
    reasons: record.reasons,
  })
  if (
    BigInt(record.executedAmount) + BigInt(record.unexecutedAmount) !==
      BigInt(record.requestedAmount)
  ) {
    throw new Error(`Executor amounts do not reconcile for action "${request.actionId}"`)
  }
  const positiveMovement = record.executedAmount > 0
  const effectiveScheduledDate = scheduleState.kind === 'valid'
    ? scheduleState.effectiveDate
    : null
  const scheduledCivilDate = effectiveScheduledDate === null
    ? null
    : parseCivilIsoDate(effectiveScheduledDate)
  const executedCivilDate = record.executedDate === null
    ? null
    : parseCivilIsoDate(record.executedDate)
  if (
    positiveMovement !==
      (record.executedDate !== null && record.executedSequence !== null) ||
    ((record.executedDate === null) !== (record.executedSequence === null)) ||
    (positiveMovement &&
      (scheduledCivilDate === null ||
        scheduledCivilDate.year !== record.year ||
        executedCivilDate === null ||
        executedCivilDate.year !== record.year)) ||
    (positiveMovement &&
      (record.executedDate !== effectiveScheduledDate ||
        record.executedSequence !== record.scheduledSequence))
  ) {
    throw new Error(`Executor movement chronology differs for action "${request.actionId}"`)
  }

  const expectedAllocations = requestAllocations(request)
  if (record.allocations.length !== expectedAllocations.length) {
    throw new Error(`Executor allocation coverage differs for action "${request.actionId}"`)
  }
  const expectedById = new Map(
    expectedAllocations.map((allocation) => [allocation.allocationId, allocation]),
  )
  let executedAllocationTotal = 0n
  for (const allocation of record.allocations) {
    const expected = expectedById.get(allocation.allocationId)
    if (
      expected === undefined ||
      expected.sourceAccountId !== allocation.sourceAccountId ||
      expected.requestedAmount !== allocation.requestedAmount ||
      BigInt(allocation.executedAmount) + BigInt(allocation.unexecutedAmount) !==
        BigInt(allocation.requestedAmount)
    ) {
      throw new Error(`Executor allocation binding differs for action "${request.actionId}"`)
    }
    if (
      (record.readiness === 'actionable' &&
        allocation.resolution !== 'resolved') ||
      (allocation.resolution === 'unresolved' &&
        allocation.executedAmount !== 0)
    ) {
      throw new Error(
        `Executor allocation resolution differs for action "${request.actionId}"`,
      )
    }
    expectedById.delete(allocation.allocationId)
    executedAllocationTotal += BigInt(allocation.executedAmount)
  }
  if (
    expectedById.size !== 0 ||
    executedAllocationTotal !== BigInt(record.executedAmount)
  ) {
    throw new Error(`Executor allocation totals differ for action "${request.actionId}"`)
  }

  const sourceAccountIds = new Set(
    expectedAllocations.map((allocation) => allocation.sourceAccountId),
  )
  const destinationId = destinationAccountId(request)
  const reasonCodes = new Set(record.reasons.map((reason) => reason.code))
  const conflictOnly = isConflictOnlyRecord(record)
  const requiredDateReasonCode =
    request.kind === 'ordinaryWithdrawal'
      ? request.executionDate !== undefined && scheduleState.kind !== 'valid'
        ? 'required-facts-missing'
        : undefined
      : request.kind === 'rothConversion'
      ? scheduleState.kind === 'missingDate'
        ? 'conversion-date-missing'
        : scheduleState.kind === 'invalidDate'
          ? 'conversion-date-invalid'
          : scheduleState.kind === 'outsideActionYear'
            ? 'conversion-date-outside-action-year'
            : undefined
      : request.kind === 'qcd'
        ? scheduleState.kind === 'missingDate'
          ? 'qcd-date-missing'
          : scheduleState.kind === 'invalidDate'
            ? 'qcd-date-invalid'
            : scheduleState.kind === 'outsideActionYear'
              ? 'qcd-date-outside-action-year'
              : undefined
        : undefined
  if (
    !conflictOnly &&
    requiredDateReasonCode !== undefined &&
    !record.reasons.some((reason) =>
      reason.code === requiredDateReasonCode &&
      (request.kind === 'ordinaryWithdrawal'
        ? reason.personId === request.personId
        : reason.personId === undefined) &&
      reason.accountId === undefined &&
      reason.allocationId === undefined)
  ) {
    throw new Error(`Executor date reason missing for action "${request.actionId}"`)
  }
  if (
    !conflictOnly &&
    request.kind === 'rothConversion' &&
    request.taxFunding.kind === 'conversionPrincipalWithholding' &&
    !reasonCodes.has('conversion-principal-withholding-unsupported')
  ) {
    throw new Error(`Executor funding reason missing for action "${request.actionId}"`)
  }
  if (!conflictOnly && request.kind === 'qcd') {
    const charity = request.charity
    const requiredCharityReasonCodes: ActionReason['code'][] = []
    if (
      charity.designationKind === 'splitInterestEntity' ||
      !charity.notSplitInterestEntityAttested
    ) {
      requiredCharityReasonCodes.push('qcd-split-interest-unsupported')
    }
    if (
      charity.designationKind !== 'eligiblePublicCharity' ||
      !charity.directFromCustodianAttested ||
      !charity.eligibleOrganizationAttested ||
      !charity.notDonorAdvisedFundOrSupportingOrganizationAttested
    ) {
      requiredCharityReasonCodes.push('qcd-direct-charity-unconfirmed')
    }
    if (!charity.entireDistributionOtherwiseDeductibleAttested) {
      requiredCharityReasonCodes.push(
        'qcd-entire-distribution-deductibility-unconfirmed',
      )
    }
    if (requiredCharityReasonCodes.some((code) => !reasonCodes.has(code))) {
      throw new Error(`Executor charity reason missing for action "${request.actionId}"`)
    }
  }
  if (
    reasonCodes.has('conversion-destination-not-found') &&
    [...destinationInspectionReasonCodes].some((code) => reasonCodes.has(code))
  ) {
    throw new Error(`Executor destination resolution differs for action "${request.actionId}"`)
  }
  if (
    [...destinationClassificationReasonCodes].filter((code) =>
      reasonCodes.has(code)).length > 1
  ) {
    throw new Error(`Executor destination classification differs for action "${request.actionId}"`)
  }
  if (mutuallyExclusivePersonReasonPairs.some(([left, right]) =>
    reasonCodes.has(left) && reasonCodes.has(right))) {
    throw new Error(`Executor person resolution differs for action "${request.actionId}"`)
  }
  for (const allocation of record.allocations) {
    for (const group of mutuallyExclusiveAllocationReasonGroups) {
      const matchingCodes = new Set(record.reasons
        .filter((reason) =>
          group.has(reason.code) &&
          (reason.allocationId === undefined ||
            reason.allocationId === allocation.allocationId) &&
          (reason.accountId === undefined ||
            reason.accountId === allocation.sourceAccountId))
        .map((reason) => reason.code))
      if (matchingCodes.size > 1) {
        throw new Error(
          `Executor source classification differs for action "${request.actionId}"`,
        )
      }
    }
  }
  const hasPhysicalBalanceReason = record.reasons.some((reason) =>
    physicalBalanceReasonCodes.has(reason.code))
  if (
    hasPhysicalBalanceReason &&
    record.allocations.some((allocation) => allocation.resolution !== 'resolved')
  ) {
    throw new Error(`Executor reason resolution differs for action "${request.actionId}"`)
  }
  if (
    hasPhysicalBalanceReason &&
    record.reasons.some((reason) =>
      !physicalBalanceReasonCodes.has(reason.code) &&
      (reason.outcome === 'refused' || reason.outcome === 'unsupported'))
  ) {
    throw new Error(`Executor reason phase differs for action "${request.actionId}"`)
  }
  for (const reason of record.reasons) {
    if (preCanonicalReasonCodes.has(reason.code)) {
      throw new Error(`Executor reason phase differs for action "${request.actionId}"`)
    }
    if (!reasonAppliesToKind(record.kind, reason.code)) {
      throw new Error(`Executor reason kind differs for action "${request.actionId}"`)
    }
    if (
      reason.code === 'conversion-principal-withholding-unsupported' &&
      (
        request.kind !== 'rothConversion' ||
        request.taxFunding.kind !== 'conversionPrincipalWithholding'
      )
    ) {
      throw new Error(`Executor funding reason differs for action "${request.actionId}"`)
    }
    if (
      reason.code === 'conversion-tax-funding-unallocated' &&
      (
        request.kind !== 'rothConversion' ||
        request.taxFunding.kind === 'noneExpected'
      )
    ) {
      throw new Error(`Executor funding reason differs for action "${request.actionId}"`)
    }
    if (request.kind === 'qcd') {
      const charity = request.charity
      const charityReasonApplies =
        reason.code === 'qcd-direct-charity-unconfirmed'
          ? charity.designationKind !== 'eligiblePublicCharity' ||
            !charity.directFromCustodianAttested ||
            !charity.eligibleOrganizationAttested ||
            !charity.notDonorAdvisedFundOrSupportingOrganizationAttested
          : reason.code === 'qcd-split-interest-unsupported'
            ? charity.designationKind === 'splitInterestEntity' ||
              !charity.notSplitInterestEntityAttested
            : reason.code ===
                'qcd-entire-distribution-deductibility-unconfirmed'
              ? !charity.entireDistributionOtherwiseDeductibleAttested
              : true
      if (!charityReasonApplies) {
        throw new Error(`Executor charity reason differs for action "${request.actionId}"`)
      }
    }
    const requiredScheduleState = dateReasonScheduleStates[reason.code]
    if (
      requiredScheduleState !== undefined &&
      !requiredScheduleState.includes(scheduleState.kind)
    ) {
      throw new Error(`Executor date reason differs for action "${request.actionId}"`)
    }
    if (reason.personId !== undefined && reason.personId !== record.personId) {
      throw new Error(`Executor reason person differs for action "${request.actionId}"`)
    }
    const reasonAllocation = reason.allocationId === undefined
      ? undefined
      : expectedAllocations.find((allocation) =>
          allocation.allocationId === reason.allocationId)
    if (reason.allocationId !== undefined && reasonAllocation === undefined) {
      throw new Error(`Executor reason allocation differs for action "${request.actionId}"`)
    }
    const sourceIdentifiersAllowed = sourceIdentifierReasonCodes.has(reason.code)
    const destinationAccountAllowed = destinationAccountReasonCodes.has(reason.code)
    const boundRecordAllocation = reasonAllocation === undefined
      ? reason.accountId === undefined
        ? undefined
        : record.allocations.find((allocation) =>
            allocation.sourceAccountId === reason.accountId)
      : record.allocations.find((allocation) =>
          allocation.allocationId === reasonAllocation.allocationId)
    if (reason.allocationId !== undefined && !sourceIdentifiersAllowed) {
      throw new Error(`Executor reason identifiers differ for action "${request.actionId}"`)
    }
    if (reason.accountId !== undefined) {
      const accountMatchesRole = destinationAccountAllowed
        ? reason.accountId === destinationId
        : sourceIdentifiersAllowed && sourceAccountIds.has(reason.accountId)
      if (!accountMatchesRole) {
        throw new Error(`Executor reason account differs for action "${request.actionId}"`)
      }
    }
    if (
      reasonAllocation !== undefined &&
      reason.accountId !== undefined &&
      reason.accountId !== reasonAllocation.sourceAccountId
    ) {
      throw new Error(`Executor reason identifiers differ for action "${request.actionId}"`)
    }
    const resolutionRequirement = (
      sourceReasonResolutionRequirements as Readonly<Partial<Record<
        ActionReason['code'],
        'resolved' | 'unresolved' | 'either'
      >>>
    )[reason.code]
    const candidateAllocations = boundRecordAllocation === undefined
      ? record.allocations
      : [boundRecordAllocation]
    if (
      resolutionRequirement === 'resolved' &&
      !physicalBalanceReasonCodes.has(reason.code) &&
      boundRecordAllocation === undefined &&
      record.allocations.length !== 1
    ) {
      throw new Error(`Executor reason identifiers differ for action "${request.actionId}"`)
    }
    if (
      resolutionRequirement === 'unresolved' &&
      (
        boundRecordAllocation === undefined ||
        boundRecordAllocation.resolution !== 'unresolved'
      )
    ) {
      throw new Error(`Executor reason resolution differs for action "${request.actionId}"`)
    }
    if (
      resolutionRequirement === 'resolved' &&
      !candidateAllocations.some((allocation) =>
        allocation.resolution === 'resolved')
    ) {
      throw new Error(`Executor reason resolution differs for action "${request.actionId}"`)
    }
    const balanceState = (
      balanceReasonAllocationStates as Readonly<Partial<Record<
        ActionReason['code'],
        'partial' | 'unavailable'
      >>>
    )[reason.code]
    const balanceStateMatches = balanceState === undefined ||
      (boundRecordAllocation === undefined
        ? balanceState === 'partial'
          ? record.executedAmount > 0 && record.unexecutedAmount > 0
          : record.executedAmount === 0 &&
            record.unexecutedAmount === record.requestedAmount
        : boundRecordAllocation.resolution === 'resolved' &&
          (balanceState === 'partial'
            ? boundRecordAllocation.executedAmount > 0 &&
              boundRecordAllocation.unexecutedAmount > 0
            : boundRecordAllocation.executedAmount === 0 &&
              boundRecordAllocation.unexecutedAmount ===
                boundRecordAllocation.requestedAmount))
    if (!balanceStateMatches) {
      throw new Error(`Executor reason amounts differ for action "${request.actionId}"`)
    }
  }
}

/**
 * Compose executor adapters into one complete, detached annual publication.
 * Every annual request must have exactly one owning record. Cross-executor
 * action or schedule overlap fails closed instead of silently preferring one
 * result field.
 */
export function publishAnnualRetirementActions(
  input: Readonly<PublishAnnualRetirementActionsInput>,
): Readonly<AnnualRetirementActionPublication> | undefined {
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999
  ) {
    throw new Error(
      'Annual retirement-action publication tax year must be an integer from 1 through 9999',
    )
  }
  if (input.requests.length === 0 && input.sources.length === 0) return undefined
  if (input.sources.length === 0) {
    throw new Error('Annual retirement-action publication has requests but no executor source')
  }

  const requests = input.requests.map(canonicalRequest)
  const requestById = new Map<ActionId, Readonly<RetirementActionRequest>>()
  for (const request of requests) {
    if (request.year !== input.taxYear) {
      throw new Error(
        `Annual retirement-action request "${request.actionId}" belongs to ${request.year}, not ${input.taxYear}`,
      )
    }
    if (requestById.has(request.actionId)) {
      throw new Error(`Duplicate annual retirement-action request "${request.actionId}"`)
    }
    if (
      request.kind === 'rothConversion' &&
      request.allocations.some((allocation) =>
        allocation.sourceAccountId === request.destinationRothAccountId)
    ) {
      throw new Error(
        `Conversion destination aliases a source for action "${request.actionId}"`,
      )
    }
    requestById.set(request.actionId, request)
  }
  assertLinkedWithdrawalRequests(requests, requestById)

  const sourceKinds = new Set<AnnualRetirementActionExecutorSource>()
  const records: AnnualRetirementActionRecord[] = []
  const diagnostics: AnnualRetirementActionScheduleDiagnostic[] = []
  for (const rawSource of input.sources) {
    const source = publicationSourceSchema.parse(rawSource)
    if (sourceKinds.has(source.executorSource)) {
      throw new Error(`Duplicate annual executor source "${source.executorSource}"`)
    }
    sourceKinds.add(source.executorSource)
    for (const record of source.records) {
      const request = requestById.get(record.actionId)
      if (request === undefined) {
        throw new Error(`Executor published foreign action "${record.actionId}"`)
      }
      if (record.year !== input.taxYear) {
        throw new Error(
          `Executor record "${record.actionId}" belongs to ${record.year}, not ${input.taxYear}`,
        )
      }
      const specializedSourceOwnsKind =
        (source.executorSource === 'ordinaryWithdrawalExecutor' &&
          (
            request.kind === 'ordinaryWithdrawal' ||
            isConflictOnlyRecord(record) ||
            isCanonicalOrdinaryMixedKindFallback(record, request)
          )) ||
        (source.executorSource === 'ownedNonRothIraExecutor' &&
          request.kind === 'ordinaryWithdrawal') ||
        (source.executorSource === 'rothConversionExecutor' &&
          request.kind === 'rothConversion') ||
        (source.executorSource === 'qcdExecutor' && request.kind === 'qcd')
      if (!specializedSourceOwnsKind) {
        throw new Error(`Executor source kind differs for action "${record.actionId}"`)
      }
      if (records.some((current) => current.actionId === record.actionId)) {
        throw new Error(`Multiple executors published action "${record.actionId}"`)
      }
      const parsedRecordRequest = canonicalRequest(record.request)
      if (JSON.stringify(parsedRecordRequest) !== JSON.stringify(request)) {
        throw new Error(`Executor request binding differs for action "${record.actionId}"`)
      }
      const parsedReasons = record.reasons.map(
        (reason) => actionReasonSchema.parse(reason) as ActionReason,
      )
      const boundRecord: Omit<AnnualRetirementActionRecord, 'executorSource'> = {
        ...record,
        request: parsedRecordRequest,
        allocations: record.allocations
          .map((allocation) => ({ ...allocation }))
          .sort(allocationOrder),
        reasons: parsedReasons,
      }
      assertRecordBinding(boundRecord, request)
      records.push({
        ...boundRecord,
        reasons: canonicalReasons(boundRecord.outcome, parsedReasons),
        executorSource: source.executorSource,
      })
    }
    diagnostics.push(...source.scheduleDiagnostics.map((diagnostic) => {
      if (diagnostic.reason.code !== 'action-sequence-conflict') {
        throw new Error(
          `Schedule conflict reason differs for action "${diagnostic.actionId}"`,
        )
      }
      return {
        ...diagnostic,
        executorSource: source.executorSource,
        collidingActionIds: atLeastTwoActionIds(
          [...diagnostic.collidingActionIds].sort(compareUtf16CodeUnits),
        ),
        reason: actionReasonSchema.parse(diagnostic.reason) as ActionReason<
          'action-sequence-conflict'
        >,
      }
    }))
  }

  const missing = [...requestById.keys()].filter((actionId) =>
    !records.some((record) => record.actionId === actionId))
  if (missing.length > 0) {
    throw new Error(`Annual publication omitted actions: ${missing.sort(compareUtf16CodeUnits).join(', ')}`)
  }
  assertLinkedWithdrawalRecordAtomicity(requests, records)

  const diagnosticKeys = new Set<string>()
  for (const diagnostic of diagnostics) {
    const diagnosticKey =
      `${diagnostic.executorSource}\u0000${diagnostic.kind}\u0000${diagnostic.actionId}`
    if (diagnosticKeys.has(diagnosticKey)) {
      throw new Error(
        `Duplicate schedule diagnostic for action "${diagnostic.actionId}"`,
      )
    }
    diagnosticKeys.add(diagnosticKey)

    const record = records.find((candidate) =>
      candidate.actionId === diagnostic.actionId)
    if (
      record === undefined ||
      record.executorSource !== diagnostic.executorSource
    ) {
      throw new Error(
        `Schedule diagnostic has no same-source record for action "${diagnostic.actionId}"`,
      )
    }
    if (
      diagnostic.year !== input.taxYear ||
      diagnostic.reason.code !== 'action-sequence-conflict' ||
      diagnostic.scheduledDate !== record.scheduledDate ||
      diagnostic.executionSequence !== record.scheduledSequence ||
      scheduleKey(record) === null
    ) {
      throw new Error(
        `Schedule conflict diagnostic differs for action "${diagnostic.actionId}"`,
      )
    }
    if (
      record.readiness !== 'nonActionable' ||
      record.outcome !== 'refused' ||
      record.executedAmount !== 0 ||
      record.unexecutedAmount !== record.requestedAmount ||
      record.executedDate !== null ||
      record.executedSequence !== null ||
      record.allocations.some((allocation) =>
        allocation.resolution !== 'unresolved' ||
        allocation.executedAmount !== 0 ||
        allocation.unexecutedAmount !== allocation.requestedAmount) ||
      record.reasons.length !== 1 ||
      JSON.stringify(record.reasons[0]) !== JSON.stringify(diagnostic.reason)
    ) {
      throw new Error(
        `Schedule conflict record remains actionable for action "${diagnostic.actionId}"`,
      )
    }
    const collisionIds = new Set(diagnostic.collidingActionIds)
    const diagnosticScheduleKey = scheduleKey(record)
    const groupIds = records
      .filter((candidate) =>
        candidate.executorSource === diagnostic.executorSource &&
        scheduleKey(candidate) === diagnosticScheduleKey)
      .map((candidate) => candidate.actionId)
    if (
      collisionIds.size !== diagnostic.collidingActionIds.length ||
      !collisionIds.has(diagnostic.actionId) ||
      groupIds.length !== collisionIds.size ||
      groupIds.some((actionId) => !collisionIds.has(actionId))
    ) {
      throw new Error(
        `Schedule conflict members differ for action "${diagnostic.actionId}"`,
      )
    }
  }

  for (const diagnostic of diagnostics) {
    for (const actionId of diagnostic.collidingActionIds) {
      if (!diagnostics.some((candidate) =>
        candidate.kind === 'executionSequenceConflict' &&
        candidate.executorSource === diagnostic.executorSource &&
        candidate.actionId === actionId &&
        candidate.scheduledDate === diagnostic.scheduledDate &&
        candidate.executionSequence === diagnostic.executionSequence)) {
        throw new Error(
          `Schedule conflict has no per-action diagnostic for "${actionId}"`,
        )
      }
    }
  }

  const conflictDiagnosticSources = new Set(
    diagnostics.map((diagnostic) => diagnostic.executorSource),
  )
  const diagnosedConflictRecords = new Set(
    diagnostics.map((diagnostic) => JSON.stringify([
      diagnostic.executorSource,
      diagnostic.actionId,
    ])),
  )
  for (const record of records) {
    const recordScheduleKey = scheduleKey(record)
    const sourceConflictAborted =
      record.executorSource === 'ordinaryWithdrawalExecutor' &&
      conflictDiagnosticSources.has(record.executorSource)
    const recordDiagnosed = diagnosedConflictRecords.has(JSON.stringify([
      record.executorSource,
      record.actionId,
    ]))
    if (
      sourceConflictAborted &&
      !recordDiagnosed &&
      (
        record.readiness !== 'nonActionable' ||
        record.outcome !== 'refused' ||
        record.executedAmount !== 0 ||
        record.unexecutedAmount !== record.requestedAmount ||
        record.executedDate !== null ||
        record.executedSequence !== null ||
        record.allocations.some((allocation) =>
          allocation.resolution !== 'unresolved' ||
          allocation.executedAmount !== 0 ||
          allocation.unexecutedAmount !== allocation.requestedAmount) ||
        record.reasons.length !== 1 ||
        record.reasons[0]?.code !== 'action-batch-schedule-conflict'
      )
    ) {
      throw new Error(
        `Schedule batch conflict disposition differs for action "${record.actionId}"`,
      )
    }
    if (
      record.kind === 'ordinaryWithdrawal' &&
      record.reasons.some((reason) =>
        reason.code === 'conversion-tax-funding-evidence-unsupported') &&
      !requests.some((request) =>
        request.kind === 'rothConversion' &&
        request.taxFunding.kind === 'linkedWithdrawal' &&
        request.taxFunding.withdrawalActionId === record.actionId)
    ) {
      throw new Error(
        `Executor funding linkage differs for action "${record.actionId}"`,
      )
    }
    if (
      record.reasons.some((reason) => reason.code === 'action-sequence-conflict') &&
      (
        recordScheduleKey === null ||
        !diagnostics.some((diagnostic) =>
          diagnostic.kind === 'executionSequenceConflict' &&
          diagnostic.executorSource === record.executorSource &&
          diagnostic.actionId === record.actionId &&
          diagnostic.scheduledDate === record.scheduledDate &&
          diagnostic.executionSequence === record.scheduledSequence)
      )
    ) {
      throw new Error(
        `Schedule conflict reason has no source diagnostic for action "${record.actionId}"`,
      )
    }
    if (
      record.reasons.some((reason) =>
        reason.code === 'action-batch-schedule-conflict') &&
      (
        record.executorSource !== 'ordinaryWithdrawalExecutor' ||
        recordDiagnosed ||
        !conflictDiagnosticSources.has(record.executorSource)
      )
    ) {
      throw new Error(
        `Schedule batch conflict reason differs for action "${record.actionId}"`,
      )
    }
  }

  const scheduled = new Map<string, AnnualRetirementActionRecord>()
  for (const record of records) {
    const key = scheduleKey(record)
    if (key === null) continue
    const existing = scheduled.get(key)
    if (existing !== undefined && existing.actionId !== record.actionId) {
      const diagnosedWithinSource =
        existing.executorSource === record.executorSource &&
        diagnostics.some((diagnostic) =>
          diagnostic.kind === 'executionSequenceConflict' &&
          diagnostic.executorSource === record.executorSource &&
          diagnostic.collidingActionIds.includes(existing.actionId) &&
          diagnostic.collidingActionIds.includes(record.actionId))
      if (!diagnosedWithinSource) {
        throw new Error(
          `Annual publication schedule collision between "${existing.actionId}" and "${record.actionId}"`,
        )
      }
    }
    scheduled.set(key, record)
  }

  const executorSources = [...sourceKinds].sort(compareUtf16CodeUnits) as [
    AnnualRetirementActionExecutorSource,
    ...AnnualRetirementActionExecutorSource[],
  ]
  records.sort(recordOrder)
  diagnostics.sort((left, right) =>
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.kind, right.kind))
  return deepFreeze({
    taxYear: input.taxYear,
    executorSources,
    records,
    scheduleDiagnostics: diagnostics,
  })
}
