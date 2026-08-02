/**
 * Canonical identity-bearing retirement-action rows for scenario consumers.
 *
 * The published annual execution result (evidence, canonical requests, and
 * schedule issues) is the sole source of truth here. In particular, this
 * module never reconstructs identities from account array order or from
 * legacy aggregate ledger totals.
 */

import type { RetirementActionRequest, SourceAllocationRequest } from '../actions/contract.js'
import type {
  AnnualRetirementActionRecord,
  AnnualRetirementActionScheduleDiagnostic as PublishedScheduleDiagnostic,
} from '../actions/annualRetirementActionPublication.js'
import type { OrdinaryWithdrawalExecutionScheduleIssue } from '../actions/execution.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from '../actions/identity.js'
import { asUsdCents, type PositiveUsdCents, type UsdCents } from '../actions/money.js'
import type { ActionReason } from '../actions/reasons.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import type { YearResult } from '../projection/types.js'

function canonicalPublication(year: Readonly<YearResult>) {
  const publication = year.retirementActionPublication
  const legacy = year.retirementActionExecution
  if (publication !== undefined && publication.taxYear !== year.year) {
    throw new Error(
      'Canonical retirement-action publication belongs to a different annual result',
    )
  }
  if (publication !== undefined && legacy !== undefined) {
    const publishedById = new Map(
      publication.records.map((record) => [record.actionId, record]),
    )
    if (legacy.requests.some((request) => {
      const record = publishedById.get(request.actionId)
      return (
        record === undefined ||
        JSON.stringify(record.request) !== JSON.stringify(request)
      )
    })) {
      throw new Error(
        'Canonical retirement-action publication does not cover the legacy annual executor result',
      )
    }
  }
  return publication
}

export interface ScenarioActionSourceAllocation {
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly resolution: 'resolved' | 'unresolved'
  readonly requestedAmountCents: PositiveUsdCents
  readonly executedAmountCents: UsdCents
  readonly unexecutedAmountCents: UsdCents
}

export interface ScenarioActionRow {
  readonly actionId: ActionId
  readonly kind: RetirementActionRequest['kind']
  readonly year: number
  readonly personId: PersonId | null
  readonly destinationAccountId: AccountId | null
  readonly charityDesignationId: string | null
  readonly requestedAmountCents: PositiveUsdCents
  readonly executedAmountCents: UsdCents
  readonly unexecutedAmountCents: UsdCents
  readonly readiness: 'actionable' | 'nonActionable'
  readonly outcome: 'executed' | 'partial' | 'refused' | 'unsupported'
  readonly sourceAllocations: readonly Readonly<ScenarioActionSourceAllocation>[]
  readonly reasons: readonly Readonly<ActionReason>[]
}

export interface ScenarioActionComparisonRow {
  readonly actionId: ActionId
  readonly baseline: Readonly<ScenarioActionRow> | null
  readonly proposal: Readonly<ScenarioActionRow> | null
  readonly baselineScheduleDiagnostics: readonly Readonly<ScenarioActionScheduleDiagnostic>[]
  readonly proposalScheduleDiagnostics: readonly Readonly<ScenarioActionScheduleDiagnostic>[]
}

export type ScenarioActionScheduleDiagnostic =
  | Readonly<{
      kind: 'actionYearMismatch'
      actionId: ActionId
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'duplicateActionId'
      actionId: ActionId
      inputIndexes: readonly [number, number, ...number[]]
    }>
  | Readonly<{
      kind: 'executionSequenceConflict'
      actionId: ActionId
      year: number
      scheduledDate: string | null
      executionSequence: number
      collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
      reason: Readonly<ActionReason<'action-sequence-conflict'>>
    }>

function destinationAccountId(
  request: Readonly<RetirementActionRequest>,
): AccountId | null {
  return request.kind === 'rothConversion' ? request.destinationRothAccountId : null
}

function requestPersonId(request: Readonly<RetirementActionRequest>): PersonId | null {
  if (request.kind === 'qcd') return request.donorPersonId
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.personId
  }
  return null
}

function requestAllocations(
  request: Readonly<RetirementActionRequest>,
): readonly Readonly<SourceAllocationRequest>[] {
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.allocations
  }
  return request.kind === 'qcd' ? [request.allocation] : []
}

function charityDesignationId(
  request: Readonly<RetirementActionRequest>,
): string | null {
  return request.kind === 'qcd' ? request.charity.designationId : null
}

function canonicalRow(
  record: Readonly<AnnualRetirementActionRecord>,
): ScenarioActionRow {
  return {
    actionId: record.actionId,
    kind: record.kind,
    year: record.year,
    personId: record.personId,
    destinationAccountId: destinationAccountId(record.request),
    charityDesignationId: charityDesignationId(record.request),
    requestedAmountCents: record.requestedAmount,
    executedAmountCents: record.executedAmount,
    unexecutedAmountCents: record.unexecutedAmount,
    readiness: record.readiness,
    outcome: record.outcome,
    sourceAllocations: record.allocations.map((allocation) => ({
      allocationId: allocation.allocationId,
      sourceAccountId: allocation.sourceAccountId,
      resolution: allocation.resolution,
      requestedAmountCents: allocation.requestedAmount,
      executedAmountCents: allocation.executedAmount,
      unexecutedAmountCents: allocation.unexecutedAmount,
    })),
    reasons: record.reasons.map((reason) => ({ ...reason })),
  }
}

/** Normalize published annual execution results into deterministic rows. */
export function normalizeScenarioActionRows(
  years: readonly Readonly<YearResult>[],
): readonly Readonly<ScenarioActionRow>[] {
  const rows: ScenarioActionRow[] = []
  const seenActionIds = new Set<ActionId>()

  for (const year of years) {
    const publication = canonicalPublication(year)
    if (publication !== undefined) {
      for (const record of publication.records) {
        if (seenActionIds.has(record.actionId)) {
          throw new Error(
            `Duplicate retirement-action publication record for actionId "${record.actionId}"`,
          )
        }
        seenActionIds.add(record.actionId)
        rows.push(canonicalRow(record))
      }
      continue
    }

    const execution = year.retirementActionExecution
    for (const evidence of execution?.evidence ?? []) {
      if (seenActionIds.has(evidence.actionId)) {
        throw new Error(
          `Duplicate retirement-action execution evidence for actionId "${evidence.actionId}"`,
        )
      }
      seenActionIds.add(evidence.actionId)

      const sourceAllocations = evidence.allocations
        .map((allocation): ScenarioActionSourceAllocation => ({
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          resolution: allocation.resolution,
          requestedAmountCents: allocation.requestedAmount,
          executedAmountCents: allocation.executedAmount,
          unexecutedAmountCents: allocation.unexecutedAmount,
        }))

      rows.push({
        actionId: evidence.actionId,
        kind: evidence.kind,
        year: evidence.year,
        personId: evidence.personId,
        destinationAccountId: destinationAccountId(evidence.request),
        charityDesignationId: charityDesignationId(evidence.request),
        requestedAmountCents: evidence.disposition.requestedAmount,
        executedAmountCents: evidence.disposition.executedAmount,
        unexecutedAmountCents: evidence.disposition.unexecutedAmount,
        readiness: evidence.disposition.readiness,
        outcome: evidence.disposition.outcome,
        sourceAllocations,
        reasons: evidence.disposition.reasons.map((reason) => ({ ...reason })),
      })
    }

    if ((execution?.scheduleIssues.length ?? 0) > 0) {
      const issueWithoutPublishedReason = execution!.scheduleIssues.find(
        (issue) => issue.kind !== 'executionSequenceConflict',
      )
      if (issueWithoutPublishedReason !== undefined) {
        throw new Error(
          `Cannot normalize schedule-aborted retirement action: ${issueWithoutPublishedReason.kind} has no published typed refusal reason`,
        )
      }
      const batchConflictReasons = [
        ...new Map(
          execution!.scheduleIssues
            .filter((issue) => issue.kind === 'executionSequenceConflict')
            .map((issue) => [issue.reason.code, { ...issue.reason }]),
        ).values(),
      ].sort((left, right) => compareUtf16CodeUnits(left.code, right.code))
      for (const request of execution?.requests ?? []) {
        if (seenActionIds.has(request.actionId)) {
          throw new Error(
            `Duplicate retirement-action published request for actionId "${request.actionId}"`,
          )
        }
        seenActionIds.add(request.actionId)
        rows.push({
          actionId: request.actionId,
          kind: request.kind,
          year: request.year,
          personId: requestPersonId(request),
          destinationAccountId: destinationAccountId(request),
          charityDesignationId: charityDesignationId(request),
          requestedAmountCents: request.requestedAmount,
          executedAmountCents: asUsdCents(0),
          unexecutedAmountCents: request.requestedAmount,
          readiness: 'nonActionable',
          outcome: 'refused',
          sourceAllocations: requestAllocations(request).map((allocation) => ({
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            resolution: 'unresolved',
            requestedAmountCents: allocation.requestedAmount,
            executedAmountCents: asUsdCents(0),
            unexecutedAmountCents: allocation.requestedAmount,
          })),
          reasons: batchConflictReasons.map((reason) => ({ ...reason })),
        })
      }
    }
  }

  return rows.sort((left, right) =>
    compareUtf16CodeUnits(left.actionId, right.actionId),
  )
}

function issueDiagnostics(
  issue: Readonly<OrdinaryWithdrawalExecutionScheduleIssue>,
): ScenarioActionScheduleDiagnostic[] {
  if (issue.kind === 'actionYearMismatch') {
    return [{
      kind: issue.kind,
      actionId: issue.actionId,
      expectedYear: issue.expectedYear,
      actualYear: issue.actualYear,
    }]
  }
  if (issue.kind === 'duplicateActionId') {
    return [{
      kind: issue.kind,
      actionId: issue.actionId,
      inputIndexes: [...issue.inputIndexes],
    }]
  }
  return issue.collidingActionIds.map((actionId) => ({
    kind: issue.kind,
    actionId,
    year: issue.year,
    scheduledDate: issue.scheduledDate,
    executionSequence: issue.executionSequence,
    collidingActionIds: [...issue.collidingActionIds],
    reason: { ...issue.reason },
  }))
}

function publishedDiagnostic(
  diagnostic: Readonly<PublishedScheduleDiagnostic>,
): ScenarioActionScheduleDiagnostic {
  return {
    kind: diagnostic.kind,
    actionId: diagnostic.actionId,
    year: diagnostic.year,
    scheduledDate: diagnostic.scheduledDate,
    executionSequence: diagnostic.executionSequence,
    collidingActionIds: [...diagnostic.collidingActionIds],
    reason: { ...diagnostic.reason },
  }
}

/** Expand schedule-level refusals into deterministic per-action diagnostics. */
export function normalizeScenarioActionScheduleDiagnostics(
  years: readonly Readonly<YearResult>[],
): readonly Readonly<ScenarioActionScheduleDiagnostic>[] {
  return years
    .flatMap((year) => {
      const publication = canonicalPublication(year)
      return publication === undefined
        ? (year.retirementActionExecution?.scheduleIssues ?? []).flatMap(issueDiagnostics)
        : publication.scheduleDiagnostics.map(publishedDiagnostic)
    })
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.actionId, right.actionId) ||
        compareUtf16CodeUnits(left.kind, right.kind),
    )
}

function diagnosticsByActionId(
  diagnostics: readonly Readonly<ScenarioActionScheduleDiagnostic>[],
): Map<ActionId, Readonly<ScenarioActionScheduleDiagnostic>[]> {
  const byId = new Map<ActionId, Readonly<ScenarioActionScheduleDiagnostic>[]>()
  for (const diagnostic of diagnostics) {
    const current = byId.get(diagnostic.actionId)
    if (current === undefined) byId.set(diagnostic.actionId, [diagnostic])
    else current.push(diagnostic)
  }
  return byId
}

/** Align two independently normalized scenario ledgers by stable action ID. */
export function compareScenarioActionRows(
  baselineYears: readonly Readonly<YearResult>[],
  proposalYears: readonly Readonly<YearResult>[],
): readonly Readonly<ScenarioActionComparisonRow>[] {
  const baselineRows = normalizeScenarioActionRows(baselineYears)
  const proposalRows = normalizeScenarioActionRows(proposalYears)
  const baselineDiagnostics = normalizeScenarioActionScheduleDiagnostics(baselineYears)
  const proposalDiagnostics = normalizeScenarioActionScheduleDiagnostics(proposalYears)
  const baselineById = new Map(baselineRows.map((row) => [row.actionId, row]))
  const proposalById = new Map(proposalRows.map((row) => [row.actionId, row]))
  const baselineDiagnosticsById = diagnosticsByActionId(baselineDiagnostics)
  const proposalDiagnosticsById = diagnosticsByActionId(proposalDiagnostics)
  const actionIds = [...new Set([
    ...baselineById.keys(),
    ...proposalById.keys(),
    ...baselineDiagnosticsById.keys(),
    ...proposalDiagnosticsById.keys(),
  ])]
    .sort(compareUtf16CodeUnits)

  return actionIds.map((actionId) => ({
    actionId,
    baseline: baselineById.get(actionId) ?? null,
    proposal: proposalById.get(actionId) ?? null,
    baselineScheduleDiagnostics: baselineDiagnosticsById.get(actionId) ?? [],
    proposalScheduleDiagnostics: proposalDiagnosticsById.get(actionId) ?? [],
  }))
}
