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

const destinationAccountReasonCodes = new Set<ActionReason['code']>([
  'conversion-destination-not-found',
  'conversion-destination-owner-mismatch',
  'conversion-destination-incompatible',
  'conversion-roth-simple-destination-unsupported',
  'conversion-employer-destination-unsupported',
])

const preCanonicalReasonCodes = new Set<ActionReason['code']>([
  'duplicate-source-account',
  'duplicate-allocation-id',
  'allocation-total-mismatch',
])

const sourceIdentifierReasonCodes = new Set<ActionReason['code']>([
  'source-account-not-found',
  'duplicate-source-account',
  'duplicate-allocation-id',
  'allocation-total-mismatch',
  'source-owner-mismatch',
  'joint-source-acting-person-mismatch',
  'required-facts-missing',
  'source-balance-trimmed',
  'source-balance-unavailable',
  'withdrawal-taxable-basis-unsupported',
  'withdrawal-employer-basis-unsupported',
  'withdrawal-roth-ira-character-unsupported',
  'withdrawal-designated-roth-character-unsupported',
  'withdrawal-source-not-spendable',
  'withdrawal-penalty-evidence-missing',
  'withdrawal-plan-availability-unknown',
  'withdrawal-plan-not-available',
  'withdrawal-rule-of-55-evidence-missing',
  'withdrawal-sepp-evidence-missing',
  'withdrawal-inherited-facts-missing',
  'withdrawal-hsa-qualification-unknown',
  'withdrawal-source-type-unsupported',
  'conversion-source-owner-mismatch',
  'conversion-source-not-convertible',
  'conversion-ira-subtype-unknown',
  'conversion-simple-two-year-rule-unknown',
  'conversion-simple-two-year-period-open',
  'conversion-plan-availability-unknown',
  'conversion-plan-not-available',
  'conversion-employer-basis-unsupported',
  'conversion-inherited-source',
  'conversion-rmd-reserve-unavailable',
  'conversion-basis-evidence-missing',
  'conversion-balance-trimmed',
  'conversion-balance-unavailable',
  'qcd-source-owner-mismatch',
  'qcd-source-not-ira',
  'qcd-sep-simple-activity-unknown',
  'qcd-ongoing-sep-simple',
  'qcd-roth-source-unsupported',
  'qcd-taxable-amount-trimmed',
  'qcd-inherited-basis-unsupported',
  'qcd-rmd-evidence-missing',
  'qcd-balance-trimmed',
  'qcd-balance-unavailable',
])

function reasonAppliesToKind(
  kind: RetirementActionRequest['kind'],
  code: ActionReason['code'],
): boolean {
  if (code === 'withdrawal-aggregate-unallocated') {
    return kind === 'legacyAggregateWithdrawal'
  }
  if (code === 'conversion-aggregate-unallocated') {
    return kind === 'legacyAggregateRothConversion'
  }
  if (code === 'qcd-aggregate-unallocated') return kind === 'legacyAggregateQcd'
  if (code === 'source-balance-trimmed' || code === 'source-balance-unavailable') {
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
  Record<ActionReason['code'], RetirementActionScheduleState['kind']>
> = {
  'conversion-date-missing': 'missingDate',
  'conversion-date-invalid': 'invalidDate',
  'conversion-date-outside-action-year': 'outsideActionYear',
  'qcd-date-missing': 'missingDate',
  'qcd-date-invalid': 'invalidDate',
  'qcd-date-outside-action-year': 'outsideActionYear',
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
    if (requiredScheduleState !== undefined && scheduleState.kind !== requiredScheduleState) {
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
    requestById.set(request.actionId, request)
  }

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
      !record.reasons.some((reason) =>
        JSON.stringify(reason) === JSON.stringify(diagnostic.reason))
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

  for (const record of records) {
    const recordScheduleKey = scheduleKey(record)
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
        diagnostics.some((diagnostic) =>
          diagnostic.executorSource === record.executorSource &&
          diagnostic.actionId === record.actionId) ||
        !diagnostics.some((diagnostic) =>
          diagnostic.kind === 'executionSequenceConflict' &&
          diagnostic.executorSource === record.executorSource)
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
