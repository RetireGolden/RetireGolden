import {
  rothConversionRequestSchema,
  type RothConversionRequest,
} from './contract.js'
import { accountIdSchema } from './identity.js'
import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'
import {
  createActionReason,
  type ActionReason,
} from './reasons.js'
import { compareUtf16CodeUnits } from './structuralId.js'
import {
  evaluateRetirementActionSchedule,
  type OrdinaryWithdrawalExecutionScheduleIssue,
} from './execution.js'
import type { Plan } from '../model/plan.js'
import {
  evaluateRetirementActionEligibilityFromPlan,
  type RetirementActionEligibilityRuntimeEvidence,
} from '../strategies/accountEligibility.js'

export interface RothConversionBalanceSnapshot {
  accountId: string
  openingBalance: UsdCents
}

export interface ExecuteRothConversionsInput {
  year: number
  plan: Readonly<Plan>
  requests: readonly Readonly<RothConversionRequest>[]
  openingBalances: readonly Readonly<RothConversionBalanceSnapshot>[]
  runtimeEvidence?: RetirementActionEligibilityRuntimeEvidence
}

export interface RothConversionBalanceExecutionEvidence {
  accountId: string
  openingBalance: number
  closingBalance: number
}

export interface RothConversionAllocationExecutionEvidence {
  allocationId: string
  sourceAccountId: string
  resolution: 'resolved' | 'unresolved'
  requestedAmount: number
  executedAmount: 0
  unexecutedAmount: number
  taxableConvertedAmount: 0
  nontaxableConvertedAmount: 0
  basisEvidenceId: null
  rmdReserveEvidenceId: null
}

export interface RothConversionTaxFundingExecutionEvidence {
  kind: RothConversionRequest['taxFunding']['kind']
  status: 'unsupported'
  requiredFundingAmount: null
  fundedAmount: null
  evidenceId: null
}

export interface RothConversionExecutionEvidence {
  actionId: string
  kind: 'rothConversion'
  request: Readonly<RothConversionRequest>
  year: number
  scheduledDate: string | null
  executedDate: null
  scheduledSequence: number
  executedSequence: null
  destinationRothAccountId: string
  destinationCreditAmount: 0
  requestedAmount: number
  executedAmount: 0
  unexecutedAmount: number
  taxableConvertedAmount: 0
  nontaxableConvertedAmount: 0
  outcome: 'refused' | 'unsupported'
  readiness: 'nonActionable'
  allocations: readonly RothConversionAllocationExecutionEvidence[]
  taxFunding: Readonly<RothConversionTaxFundingExecutionEvidence>
  reasons: readonly ActionReason[]
  provenance: RothConversionRequest['provenance']
}

export type RothConversionExecutionScheduleIssue =
  | OrdinaryWithdrawalExecutionScheduleIssue
  | Readonly<{
      kind: 'invalidInput'
      actionId: null
      detail: string
    }>

export interface ExecuteRothConversionsResult {
  committed: false
  requests: readonly Readonly<RothConversionRequest>[]
  scheduleIssues: readonly RothConversionExecutionScheduleIssue[]
  balances: readonly RothConversionBalanceExecutionEvidence[]
  evidence: readonly RothConversionExecutionEvidence[]
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function immutableResult(
  result: ExecuteRothConversionsResult,
): ExecuteRothConversionsResult {
  return deepFreeze(result) as ExecuteRothConversionsResult
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

function canonicalReasons(reasons: readonly ActionReason[]): ActionReason[] {
  const unique = new Map<string, ActionReason>()
  for (const reason of reasons) {
    const typed = reason
    const key = JSON.stringify([
      typed.outcome === 'unsupported' ? 0 : 1,
      typed.code,
      typed.personId ?? null,
      typed.accountId ?? null,
      typed.allocationId ?? null,
    ])
    unique.set(key, typed)
  }
  return [...unique.entries()].sort(([left], [right]) => compareUtf16CodeUnits(left, right)).map(([, reason]) => reason)
}

function unchangedBalances(
  snapshots: readonly RothConversionBalanceSnapshot[],
): RothConversionBalanceExecutionEvidence[] {
  return [...snapshots]
    .map((snapshot) => ({ ...snapshot, closingBalance: snapshot.openingBalance }))
    .sort((left, right) =>
      compareUtf16CodeUnits(left.accountId, right.accountId) ||
      left.openingBalance - right.openingBalance,
    )
}

function nonActionableEvidence(
  request: RothConversionRequest,
  reasons: readonly ActionReason[],
  resolvedSourceAccountIds: ReadonlySet<string>,
): RothConversionExecutionEvidence {
  const canonical = canonicalReasons(reasons)
  const outcome = canonical.some((reason) => reason.outcome === 'unsupported')
    ? 'unsupported' as const
    : 'refused' as const
  return {
    actionId: request.actionId,
    kind: 'rothConversion',
    request,
    year: request.year,
    scheduledDate: request.executionDate ?? null,
    executedDate: null,
    scheduledSequence: request.executionSequence,
    executedSequence: null,
    destinationRothAccountId: request.destinationRothAccountId,
    destinationCreditAmount: 0,
    requestedAmount: request.requestedAmount,
    executedAmount: 0,
    unexecutedAmount: request.requestedAmount,
    taxableConvertedAmount: 0,
    nontaxableConvertedAmount: 0,
    outcome,
    readiness: 'nonActionable',
    allocations: [...request.allocations]
      .sort((left, right) => compareUtf16CodeUnits(left.allocationId, right.allocationId))
      .map((allocation) => ({
        ...allocation,
        resolution: resolvedSourceAccountIds.has(allocation.sourceAccountId)
          ? 'resolved' as const
          : 'unresolved' as const,
        executedAmount: 0,
        unexecutedAmount: allocation.requestedAmount,
        taxableConvertedAmount: 0,
        nontaxableConvertedAmount: 0,
        basisEvidenceId: null,
        rmdReserveEvidenceId: null,
      })),
    taxFunding: {
      kind: request.taxFunding.kind,
      status: 'unsupported',
      requiredFundingAmount: null,
      fundedAmount: null,
      evidenceId: null,
    },
    reasons: canonical,
    provenance: request.provenance,
  }
}

function executeUnchecked(input: ExecuteRothConversionsInput): ExecuteRothConversionsResult {
  if (!Number.isSafeInteger(input.year) || input.year < 1 || input.year > 9999) {
    return immutableResult({ committed: false, requests: [], scheduleIssues: [{ kind: 'invalidInput', actionId: null, detail: 'Execution year is invalid.' }], balances: [], evidence: [] })
  }
  const parsedRequests = input.requests.map((request) => rothConversionRequestSchema.parse(request))
  const scheduleState = evaluateRetirementActionSchedule(input.year, parsedRequests)
  const requests = scheduleState.requests.map((request) =>
    rothConversionRequestSchema.parse(request),
  )
  const snapshots = input.openingBalances.map((snapshot) => ({
    accountId: accountIdSchema.parse(snapshot.accountId),
    openingBalance: usdCentsSchema.parse(snapshot.openingBalance),
  }))
  const snapshotCounts = new Map<string, number>()
  for (const snapshot of snapshots) snapshotCounts.set(snapshot.accountId, (snapshotCounts.get(snapshot.accountId) ?? 0) + 1)
  const issues = scheduleState.scheduleIssues
  if (issues.length > 0 || [...snapshotCounts.values()].some((count) => count !== 1)) {
    return immutableResult({
      committed: false,
      requests,
      scheduleIssues: issues.length > 0 ? issues : [{ kind: 'invalidInput', actionId: null, detail: 'Opening balances must have unique account IDs.' }],
      balances: unchangedBalances(snapshots),
      evidence: [],
    })
  }

  const accountIds = input.plan.accounts.map((account) => account.id)
  if (hasDuplicates(accountIds)) {
    return immutableResult({
      committed: false,
      requests,
      scheduleIssues: [{
        kind: 'invalidInput',
        actionId: null,
        detail: 'Plan account identities must be unique.',
      }],
      balances: unchangedBalances(snapshots),
      evidence: [],
    })
  }

  const accounts = new Map(input.plan.accounts.map((account) => [account.id, account] as const))
  const openingByAccountId = new Map(
    snapshots.map((snapshot) => [String(snapshot.accountId), snapshot.openingBalance]),
  )
  const remainingByAccountId = new Map(openingByAccountId)
  const evidence: RothConversionExecutionEvidence[] = []
  for (const request of requests) {
    // These three annual facts must be produced and validated for the complete
    // owner-wide action group before any member can move. This prerequisite
    // intentionally accepts no shallow substitute and therefore cannot mark a
    // request actionable yet.
    const reasons: ActionReason[] = [
      createActionReason('conversion-basis-evidence-missing', {
        personId: request.personId,
      }),
      createActionReason('conversion-rmd-reserve-unavailable', {
        personId: request.personId,
      }),
      createActionReason('conversion-tax-funding-evidence-unsupported', {
        personId: request.personId,
      }),
    ]
    if (request.year !== input.year) reasons.push(createActionReason('conversion-date-outside-action-year', { personId: request.personId }))
    const preflight = evaluateRetirementActionEligibilityFromPlan(request, input.plan as Plan, input.runtimeEvidence ?? {})
    if (preflight.status !== 'accepted') reasons.push(...preflight.reasons)
    const destination = accounts.get(request.destinationRothAccountId)
    if (destination === undefined) {
      reasons.push(createActionReason('conversion-destination-not-found', { accountId: request.destinationRothAccountId }))
    } else if (destination.type !== 'roth') {
      reasons.push(createActionReason('conversion-destination-incompatible', { accountId: request.destinationRothAccountId }))
    }
    if (destination !== undefined && !openingByAccountId.has(request.destinationRothAccountId)) {
      reasons.push(createActionReason('required-facts-missing', {
        personId: request.personId,
        accountId: request.destinationRothAccountId,
      }))
    }

    const resolvedSourceAccountIds = new Set<string>()
    const canConsumeDiagnosticCapacity =
      preflight.status === 'accepted' &&
      destination !== undefined &&
      openingByAccountId.has(request.destinationRothAccountId) &&
      request.allocations.every((allocation) => {
        const source = accounts.get(allocation.sourceAccountId)
        return source?.type === 'traditional' &&
          remainingByAccountId.has(allocation.sourceAccountId)
      })
    for (const allocation of request.allocations) {
      const source = accounts.get(allocation.sourceAccountId)
      const remaining = remainingByAccountId.get(allocation.sourceAccountId)
      if (source === undefined) {
        reasons.push(createActionReason('source-account-not-found', { accountId: allocation.sourceAccountId, allocationId: allocation.allocationId }))
        continue
      }
      resolvedSourceAccountIds.add(allocation.sourceAccountId)
      if (source.type !== 'traditional') {
        reasons.push(createActionReason('conversion-source-not-convertible', { accountId: allocation.sourceAccountId, allocationId: allocation.allocationId }))
      }
      if (remaining === undefined) {
        reasons.push(createActionReason('required-facts-missing', {
          personId: request.personId,
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }))
      } else if (remaining === 0) {
        reasons.push(createActionReason('conversion-balance-unavailable', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }))
      } else if (remaining < allocation.requestedAmount) {
        reasons.push(createActionReason('conversion-balance-trimmed', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }))
      }
      if (canConsumeDiagnosticCapacity && remaining !== undefined) {
        remainingByAccountId.set(
          allocation.sourceAccountId,
          asUsdCents(Math.max(0, remaining - allocation.requestedAmount)),
        )
      }
    }
    evidence.push(nonActionableEvidence(request, reasons, resolvedSourceAccountIds))
  }

  return immutableResult({
    committed: false,
    requests,
    scheduleIssues: [],
    balances: unchangedBalances(snapshots),
    evidence,
  })
}

/**
 * Stage named conversion requests at the simulator boundary. The annual
 * owner-group/Form-8606/RMD/liability coordinator is not available yet, so
 * every well-formed request is published as non-actionable with zero movement.
 * Hostile, malformed, duplicate, or unsafe input also fails closed.
 */
export function executeRothConversions(input: ExecuteRothConversionsInput): ExecuteRothConversionsResult {
  try {
    const snapshot = structuredClone(input) as ExecuteRothConversionsInput
    return executeUnchecked(snapshot)
  } catch {
    return immutableResult({
      committed: false,
      requests: [],
      scheduleIssues: [{ kind: 'invalidInput', actionId: null, detail: 'Conversion execution input could not be inspected losslessly.' }],
      balances: [],
      evidence: [],
    })
  }
}
