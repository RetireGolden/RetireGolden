import {
  conversionTaxFundingSchema,
  rothConversionRequestSchema,
  type ConversionTaxFunding,
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
  resolveOwnerIraRmdSatisfaction,
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

/**
 * Is the request's own external-cash attestation present and well formed?
 *
 * The request schema already requires `attested: true` and a positive cent
 * amount, so a request that reaches here should carry both. This re-reads the
 * attestation against that same schema anyway and fails closed on anything it
 * cannot confirm: the attestation is the entire evidence for this funding
 * disposition, so an absent, forged, or reshaped one must keep the staging
 * reason rather than be read as satisfied.
 *
 * The amount is deliberately not read against the conversion that carries it.
 * A cost ceiling of "no more than the amount converted" would follow only if
 * the incremental cost of a conversion were bounded by a marginal rate, and in
 * this model it is not: `tax/aca.ts` forfeits the whole premium tax credit
 * above the 400% FPL ceiling (`overCliff`) and the IRMAA tiers in
 * `params/data` step at a threshold, so a small conversion that crosses either
 * one can cost far more than it converts. The attestation's size is therefore
 * not evidence about its own validity, and this executor has no annual
 * liability of its own to check it against — that is exactly what the missing
 * coordinator would compute. Shape and attestation are what it can confirm.
 */
function hasWellFormedExternalCashAttestation(
  funding: Readonly<ConversionTaxFunding>,
): boolean {
  const parsed = conversionTaxFundingSchema.safeParse(funding)
  if (!parsed.success || parsed.data.kind !== 'externalCash') return false
  const attestation = parsed.data
  return attestation.attested === true &&
    Number.isSafeInteger(attestation.amount) &&
    attestation.amount > 0
}

/**
 * Which tax-funding reasons does this request still have to carry?
 *
 * The four named funding dispositions are not one staging gap.
 *
 * - `noneExpected` names no funding at all, so there is no funding evidence to
 *   be missing.
 * - `externalCash` is funded from outside the plan; the attestation the request
 *   schema requires is the evidence, and nothing else has to execute for it.
 *   An attestation that cannot be confirmed still blocks.
 * - `linkedWithdrawal` names a sibling withdrawal that must move inside the
 *   conversion's atomic annual group. That group executor does not exist —
 *   `actions/execution.ts` refuses the linked withdrawal for the same reason —
 *   so this one stays unsupported.
 * - `conversionPrincipalWithholding` is not staged at all: withholding from
 *   converted principal reduces the destination and may itself be an early
 *   distribution, so it is refused on the merits. `accountEligibility.ts`
 *   already names that refusal without identifiers, and this emits it the same
 *   way so the two sites canonicalize to one reason rather than two.
 */
function taxFundingReasons(request: Readonly<RothConversionRequest>): ActionReason[] {
  const funding = request.taxFunding
  switch (funding.kind) {
    case 'noneExpected':
      return []
    case 'externalCash':
      return hasWellFormedExternalCashAttestation(funding)
        ? []
        : [createActionReason('conversion-tax-funding-evidence-unsupported', {
            personId: request.personId,
          })]
    case 'conversionPrincipalWithholding':
      return [createActionReason('conversion-principal-withholding-unsupported')]
    case 'linkedWithdrawal':
      return [createActionReason('conversion-tax-funding-evidence-unsupported', {
        personId: request.personId,
      })]
  }
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
  const runtimeEvidence = input.runtimeEvidence ?? {}
  for (const request of requests) {
    // These annual facts must be produced and validated for the complete
    // owner-wide action group before any member can move. Each prerequisite
    // accepts no shallow substitute, so a request stays non-actionable until
    // every one of them is answered by evidence.
    //
    // The RMD reserve is the first of them to have an evidence channel.
    // Treas. Reg. 1.408A-4 A-6(b) bars a conversion "to the extent that" the
    // year's required minimum distribution has not been distributed, and
    // `resolveOwnerIraRmdSatisfaction` reads the owner's aggregated-IRA
    // outcome from bound runtime evidence. Anything short of proven
    // satisfaction — including no evidence at all — keeps the reason.
    //
    // Tax funding is the second. It is not one prerequisite but four
    // dispositions the request itself names, so `taxFundingReasons` answers
    // each on its own terms instead of blocking all of them alike.
    const reasons: ActionReason[] = [
      createActionReason('conversion-basis-evidence-missing', {
        personId: request.personId,
      }),
      ...(resolveOwnerIraRmdSatisfaction(request, runtimeEvidence) === 'satisfied'
        ? []
        : [createActionReason('conversion-rmd-reserve-unavailable', {
            personId: request.personId,
          })]),
      ...taxFundingReasons(request),
    ]
    if (request.year !== input.year) reasons.push(createActionReason('conversion-date-outside-action-year', { personId: request.personId }))
    const preflight = evaluateRetirementActionEligibilityFromPlan(request, input.plan as Plan, runtimeEvidence)
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
