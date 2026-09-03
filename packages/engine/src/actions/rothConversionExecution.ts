import {
  conversionTaxFundingSchema,
  rothConversionRequestSchema,
  type ConversionTaxFunding,
  type RothConversionRequest,
} from './contract.js'
import { accountIdSchema, type AllocationId } from './identity.js'
import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'
import {
  createActionReason,
  type ActionReason,
} from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import {
  evaluateRetirementActionSchedule,
  type OrdinaryWithdrawalExecutionScheduleIssue,
} from './execution.js'
import type { Plan } from '../model/plan.js'
import {
  evaluateRetirementActionEligibilityFromPlan,
  isAggregatedIra,
  resolveOwnerAggregatedIraBasis,
  resolveOwnerIraRmdSatisfactionEvidenceId,
} from '../strategies/accountEligibility.js'
import {
  assessConversionLinkedWithdrawalGroups,
  conversionLinkedWithdrawalGroupForConversion,
  type ConversionLinkedWithdrawalGroupAssessment,
  type ConversionLinkedWithdrawalGroupFundingAuthority,
  type RetirementActionGroupRuntimeEvidence,
} from './conversionLinkedWithdrawalGroup.js'
import { deepFreeze } from './freeze.js'

export interface RothConversionBalanceSnapshot {
  accountId: string
  openingBalance: UsdCents
}

export interface ExecuteRothConversionsInput {
  year: number
  plan: Readonly<Plan>
  requests: readonly Readonly<RothConversionRequest>[]
  openingBalances: readonly Readonly<RothConversionBalanceSnapshot>[]
  /**
   * Eligibility evidence, widened by the linked-withdrawal group verdict. This
   * executor can see that a conversion names a funding withdrawal but not
   * whether the withdrawal side was ever scheduled, so the group decision is
   * supplied by the caller that saw both request sets.
   */
  runtimeEvidence?: RetirementActionGroupRuntimeEvidence
}

export interface RothConversionBalanceExecutionEvidence {
  accountId: string
  openingBalance: number
  closingBalance: number
}

export interface RothConversionStagedAllocationExecutionEvidence {
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

/**
 * One allocation that actually moved.
 *
 * The character pair is nullable, and null is a statement rather than a gap.
 * When the bound evidence proves the owner's aggregated-IRA basis numerator is
 * zero, IRC 408A(d)(3)(A) and the Form 8606 line-8 computation make the whole
 * converted gross includible with no ratio to apply, and this executor states
 * that character itself. When the numerator is a proven positive figure the
 * character is the year's Form 8606 line-10 ratio applied to line 8, whose
 * denominator — line 6, the aggregate December 31 value of the owner's non-Roth
 * IRAs — does not exist at this mid-year call site. Both fields are then null:
 * the movement is authorised and its character is settled once, annually, by
 * `internal/ownedNonRothIraContiguousReplay.ts`. A number here would be an
 * assumption dressed as evidence, and zero would be the taxpayer-unfavourable
 * one.
 */
export interface RothConversionExecutedAllocationExecutionEvidence {
  allocationId: string
  sourceAccountId: string
  resolution: 'resolved'
  requestedAmount: number
  executedAmount: number
  unexecutedAmount: 0
  taxableConvertedAmount: number | null
  nontaxableConvertedAmount: number | null
  /** The owner aggregated-IRA basis evidence this character rests on. */
  basisEvidenceId: string
  /** The owner IRA-RMD satisfaction evidence Treas. Reg. 1.408A-4 A-6 needs. */
  rmdReserveEvidenceId: string
}

export type RothConversionAllocationExecutionEvidence =
  | Readonly<RothConversionStagedAllocationExecutionEvidence>
  | Readonly<RothConversionExecutedAllocationExecutionEvidence>

/**
 * What a conversion's tax funding did, in the vocabulary this executor
 * publishes.
 *
 * The specification this implements names four arms — `funded`, `unavailable`,
 * `canceled`, `notRequired` — and none of the four values overlaps the three
 * that shipped. The shipped vocabulary wins, because it is the one the
 * publication invariants already check and the one every serialized record
 * already carries; two of the specification's arms are the shipped names for
 * the same states (`unavailable` is `unsupported`, `notRequired` is
 * `notExpected`), and the two that are genuinely missing are added here rather
 * than renaming anything.
 *
 * - `unsupported` — this executor cannot state what was required or paid.
 * - `notExpected` — the request names no funding, so nothing is owed.
 * - `externallyAttested` — funded from outside the plan, on the household's
 *   attestation.
 * - `funded` — the required amount was computed and the funding met it. Its
 *   producer is the released group verdict: a conversion whose disposition is
 *   `executedAsAtomicGroup` carries the proved share of the filing unit's
 *   `max(0, T1(F) − T0)` and the cents its dedicated withdrawal moved against
 *   it. Both figures travel on the verdict rather than being derived here,
 *   because only a whole annual pass can produce them.
 * - `canceled` — the funding group aborted because a peer conversion in the
 *   same filing unit and year was non-actionable. **No producer.** The annual
 *   group that gives "peer" a meaning exists, but a cancellation is a statement
 *   about a group that was going to move, and the release is all-or-nothing
 *   across the unit's whole group — so no member is ever left holding one.
 */
export interface RothConversionTaxFundingExecutionEvidence {
  kind: RothConversionRequest['taxFunding']['kind']
  status:
    | 'unsupported'
    | 'notExpected'
    | 'externallyAttested'
    | 'funded'
    | 'canceled'
  requiredFundingAmount: number | null
  fundedAmount: number | null
  evidenceId: string | null
}

/**
 * The funding statuses a committed conversion may publish.
 *
 * Named positively rather than left as "anything but `unsupported`". A negative
 * test admits every arm added later by default, which is how `canceled` would
 * have become a lawful accompaniment to a conversion that moved.
 */
export const committedRothConversionTaxFundingStatuses = [
  'notExpected',
  'externallyAttested',
  'funded',
] as const

export type CommittedRothConversionTaxFundingStatus =
  (typeof committedRothConversionTaxFundingStatuses)[number]

interface RothConversionExecutionEvidenceBase {
  actionId: string
  kind: 'rothConversion'
  request: Readonly<RothConversionRequest>
  year: number
  scheduledDate: string | null
  scheduledSequence: number
  destinationRothAccountId: string
  requestedAmount: number
  taxFunding: Readonly<RothConversionTaxFundingExecutionEvidence>
  reasons: readonly ActionReason[]
  provenance: RothConversionRequest['provenance']
}

export interface RothConversionStagedExecutionEvidence
  extends RothConversionExecutionEvidenceBase {
  executedDate: null
  executedSequence: null
  destinationCreditAmount: 0
  executedAmount: 0
  unexecutedAmount: number
  taxableConvertedAmount: 0
  nontaxableConvertedAmount: 0
  outcome: 'refused' | 'unsupported'
  readiness: 'nonActionable'
  allocations: readonly Readonly<RothConversionStagedAllocationExecutionEvidence>[]
}

/**
 * One request that moved its full requested amount.
 *
 * There is no partial arm. A conversion whose named source cannot cover its
 * allocation keeps `conversion-balance-trimmed` or
 * `conversion-balance-unavailable` and moves nothing: a trimmed conversion is
 * a different conversion from the one the household stated, and this executor
 * has no authority to choose a smaller one on its behalf.
 */
export interface RothConversionExecutedExecutionEvidence
  extends RothConversionExecutionEvidenceBase {
  executedDate: string
  executedSequence: number
  destinationCreditAmount: number
  executedAmount: number
  unexecutedAmount: 0
  /** Null exactly when the allocations' character is null; see them. */
  taxableConvertedAmount: number | null
  nontaxableConvertedAmount: number | null
  outcome: 'executed'
  readiness: 'actionable'
  allocations: readonly [
    Readonly<RothConversionExecutedAllocationExecutionEvidence>,
    ...Readonly<RothConversionExecutedAllocationExecutionEvidence>[],
  ]
}

export type RothConversionExecutionEvidence =
  | Readonly<RothConversionStagedExecutionEvidence>
  | Readonly<RothConversionExecutedExecutionEvidence>

export type RothConversionExecutionScheduleIssue =
  | OrdinaryWithdrawalExecutionScheduleIssue
  | Readonly<{
      kind: 'invalidInput'
      actionId: null
      detail: string
    }>

export interface ExecuteRothConversionsStagedResult {
  committed: false
  requests: readonly Readonly<RothConversionRequest>[]
  scheduleIssues: readonly RothConversionExecutionScheduleIssue[]
  balances: readonly RothConversionBalanceExecutionEvidence[]
  evidence: readonly Readonly<RothConversionStagedExecutionEvidence>[]
}

/**
 * At least one request in the annual batch moved money. The batch is still
 * mixed: a request that could not clear every prerequisite stays staged
 * alongside the ones that did, because refusing an unrelated request is not a
 * reason to refuse a proven one.
 */
export interface ExecuteRothConversionsCommittedResult {
  committed: true
  requests: readonly Readonly<RothConversionRequest>[]
  scheduleIssues: readonly []
  balances: readonly RothConversionBalanceExecutionEvidence[]
  evidence: readonly [
    RothConversionExecutionEvidence,
    ...RothConversionExecutionEvidence[],
  ]
}

export type ExecuteRothConversionsResult =
  | ExecuteRothConversionsStagedResult
  | ExecuteRothConversionsCommittedResult

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

function settledBalances(
  snapshots: readonly RothConversionBalanceSnapshot[],
  closingByAccountId: ReadonlyMap<string, UsdCents>,
): RothConversionBalanceExecutionEvidence[] {
  return [...snapshots]
    .map((snapshot) => ({
      ...snapshot,
      closingBalance: closingByAccountId.get(String(snapshot.accountId)) ??
        snapshot.openingBalance,
    }))
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
 *   conversion's atomic annual group, and this executor does not decide that
 *   on its own any more. The group verdict decides for both sides at once —
 *   `actions/execution.ts` refuses the sibling withdrawal from the same
 *   verdict — so the two can no longer answer one group question differently.
 *   Every verdict is a refusal today, because the group executor that would
 *   move the pair does not exist.
 * - `conversionPrincipalWithholding` is not staged at all: withholding from
 *   converted principal reduces the destination and may itself be an early
 *   distribution, so it is refused on the merits. `accountEligibility.ts`
 *   already names that refusal without identifiers, and this emits it the same
 *   way so the two sites canonicalize to one reason rather than two.
 */
function taxFundingReasons(
  request: Readonly<RothConversionRequest>,
  groups: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
): ActionReason[] {
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
    case 'linkedWithdrawal': {
      const verdict = conversionLinkedWithdrawalGroupForConversion(
        groups,
        request.actionId,
      )
      if (verdict === null) {
        // The supplied assessment does not answer for a group this request
        // names. Nothing at this call site can stand in for that answer, and
        // silence is not permission, so the whole batch fails closed rather
        // than converting on funding nobody assessed.
        // Named, because the `executeRothConversions` wrapper catches around
        // its `executeUnchecked` call and collapses this into one batch-level
        // `invalidInput` issue carrying no action id of its own. Without the
        // id here the throw says only that some conversion in the batch was
        // unassessed.
        throw new TypeError(
          `Conversion linked-withdrawal group verdict is missing for action "${request.actionId}"`,
        )
      }
      return verdict.disposition === 'refusedPendingGroupExecution'
        ? [createActionReason(verdict.reasonCode, {
            personId: request.personId,
          })]
        : []
    }
  }
}

/**
 * The group's proved funding figures for this conversion, or nothing.
 *
 * Returns a figure pair only when the conversion's own group verdict released
 * it. A conversion that names a linked withdrawal and has no release has no
 * funding to publish, and one that names any other funding kind has no group to
 * read — both fall through to the arms `committedTaxFunding` already answers.
 */
function releasedLinkedFunding(
  request: Readonly<RothConversionRequest>,
  groups: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
): Readonly<ConversionLinkedWithdrawalGroupFundingAuthority> | null {
  if (request.taxFunding.kind !== 'linkedWithdrawal') return null
  const verdict = conversionLinkedWithdrawalGroupForConversion(
    groups,
    request.actionId,
  )
  if (verdict === null || verdict.disposition !== 'executedAsAtomicGroup') {
    return null
  }
  // The verdict is matched on the conversion; the withdrawal it was released
  // against has to be the one this request names, or the funding published
  // would be a different pair's.
  return verdict.withdrawalActionId === request.taxFunding.withdrawalActionId
    ? verdict.fundingAuthority
    : null
}

/**
 * The funding evidence a committed conversion carries.
 *
 * Only the two dispositions that need nothing else to execute can reach here;
 * `linkedWithdrawal` and `conversionPrincipalWithholding` keep their reasons
 * and never commit. `noneExpected` states that no funding is required, so both
 * figures are an exact zero. `externalCash` reports what the household
 * attested and leaves `requiredFundingAmount` null: the annual liability the
 * attestation would have to cover is the missing coordinator's to compute, and
 * this executor will not invent it.
 *
 * `linkedWithdrawal` splits on whether its group was released. A released one
 * publishes `funded` with the share of the filing unit's annual liability the
 * group proved it owed and the cents its dedicated withdrawal moved against it;
 * the two are equal by the fixed point the release rests on, and they are
 * carried rather than recomputed because nothing at this call site can compute
 * an annual liability. An unreleased one never reaches here at all — its
 * refusal reason is still on the request — and the arm is answered anyway with
 * `unsupported` and null figures, because the alternative is that a future
 * change to the release gate silently republishes the last arm's answer.
 *
 * `conversionPrincipalWithholding` stays unreachable and is answered the same
 * way. The switch is exhaustive over the union rather than falling through to a
 * default: before this, anything that was not `externalCash` returned
 * `notExpected` with both figures zero, so the first `linkedWithdrawal` to
 * reach commit would have published "no funding was expected, none was
 * required, none was paid" for a conversion that was in fact funded by a
 * withdrawal.
 */
function committedTaxFunding(
  request: Readonly<RothConversionRequest>,
  linkedFunding: Readonly<ConversionLinkedWithdrawalGroupFundingAuthority> | null,
): RothConversionTaxFundingExecutionEvidence {
  const funding = request.taxFunding
  const evidenceId = deriveActionStructuralId(
    'retirement-action-conversion-tax-funding',
    [request.actionId, request.year, funding.kind, request.executionDate ?? null],
  )
  if (funding.kind === 'linkedWithdrawal' && linkedFunding !== null) {
    return {
      kind: funding.kind,
      status: 'funded',
      requiredFundingAmount: linkedFunding.requiredFundingAmount,
      fundedAmount: linkedFunding.fundedAmount,
      evidenceId,
    }
  }
  switch (funding.kind) {
    case 'externalCash':
      return {
        kind: funding.kind,
        status: 'externallyAttested',
        requiredFundingAmount: null,
        fundedAmount: funding.amount,
        evidenceId,
      }
    case 'noneExpected':
      return {
        kind: funding.kind,
        status: 'notExpected',
        requiredFundingAmount: 0,
        fundedAmount: 0,
        evidenceId,
      }
    case 'linkedWithdrawal':
    case 'conversionPrincipalWithholding':
      return {
        kind: funding.kind,
        status: 'unsupported',
        requiredFundingAmount: null,
        fundedAmount: null,
        evidenceId,
      }
    default: {
      // A fifth funding arm must decide what it publishes here rather than
      // inheriting whichever answer happened to be last. This is the line that
      // makes adding one a compile error.
      const unreachable: never = funding
      throw new Error(
        `Unhandled conversion tax funding kind: ${JSON.stringify(unreachable)}`,
      )
    }
  }
}

function executedEvidence(
  request: RothConversionRequest,
  executedDate: string,
  basisStatus: 'zeroBasis' | 'nonzeroBasis',
  basisEvidenceId: string,
  rmdReserveEvidenceId: string,
  linkedFunding: Readonly<ConversionLinkedWithdrawalGroupFundingAuthority> | null,
): Readonly<RothConversionExecutedExecutionEvidence> {
  // A proven-zero aggregated-IRA basis numerator makes the whole gross
  // includible under IRC 408A(d)(3)(A) and there is nothing to apportion, so
  // the character is knowable here. A proven positive numerator needs the
  // year's line-10 ratio and is left null rather than assumed either way.
  const characterKnown = basisStatus === 'zeroBasis'
  const allocations = [...request.allocations]
    .sort((left, right) => compareUtf16CodeUnits(left.allocationId, right.allocationId))
    .map((allocation) => ({
      ...allocation,
      resolution: 'resolved' as const,
      executedAmount: allocation.requestedAmount,
      unexecutedAmount: 0 as const,
      taxableConvertedAmount: characterKnown ? allocation.requestedAmount : null,
      nontaxableConvertedAmount: characterKnown ? 0 : null,
      basisEvidenceId,
      rmdReserveEvidenceId,
    }))
  return {
    actionId: request.actionId,
    kind: 'rothConversion',
    request,
    year: request.year,
    scheduledDate: request.executionDate ?? null,
    executedDate,
    scheduledSequence: request.executionSequence,
    executedSequence: request.executionSequence,
    destinationRothAccountId: request.destinationRothAccountId,
    destinationCreditAmount: request.requestedAmount,
    requestedAmount: request.requestedAmount,
    executedAmount: request.requestedAmount,
    unexecutedAmount: 0,
    taxableConvertedAmount: characterKnown ? request.requestedAmount : null,
    nontaxableConvertedAmount: characterKnown ? 0 : null,
    outcome: 'executed',
    readiness: 'actionable',
    allocations: allocations as unknown as Readonly<RothConversionExecutedExecutionEvidence>['allocations'],
    taxFunding: committedTaxFunding(request, linkedFunding),
    reasons: [],
    provenance: request.provenance,
  }
}

function nonActionableEvidence(
  request: RothConversionRequest,
  reasons: readonly ActionReason[],
  resolvedSourceAccountIds: ReadonlySet<string>,
): Readonly<RothConversionStagedExecutionEvidence> {
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
  const closingByAccountId = new Map(openingByAccountId)
  const evidence: RothConversionExecutionEvidence[] = []
  const runtimeEvidence = input.runtimeEvidence ?? {}
  // Honoured, not rederived. When no caller supplied a verdict this falls back
  // to the conversions in this batch, which is everything this executor can
  // see by itself and less than the caller can.
  const conversionLinkedWithdrawalGroups =
    runtimeEvidence.conversionLinkedWithdrawalGroups ??
    assessConversionLinkedWithdrawalGroups(requests)
  let committedAny = false
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
    //
    // The Form 8606 basis pool is the third, and what it has to establish is
    // that the numerator is KNOWN — not that it is zero. IRC 408(d)(2) makes
    // that numerator a single owner-wide figure over every non-Roth IRA the
    // owner holds, and `resolveOwnerAggregatedIraBasis` returns three distinct
    // answers about it: `zeroBasis`, `nonzeroBasis`, and `unproven`. Only
    // `unproven` keeps the reason here.
    //
    // Nothing in section 408A conditions a conversion's *legality* on the
    // owner's basis. 408A(d)(3)(A)(i) says a conversion is treated as a
    // distribution to which section 72 applies, and 408A(d)(3)(A)(iii) then
    // waives the 72(t) additional tax on it. The basis figure is an input to
    // section 72(e)(8)/408(d)(2) apportionment — how much of the converted
    // gross is includible — and nothing else. A positive numerator therefore
    // changes the CHARACTER of the movement, never whether it may occur.
    //
    // The earlier reading refused a positive numerator, and it was right for
    // as long as this executor was the only place a committed conversion's
    // character could be stated. What it was protecting against is real: the
    // line-10 ratio's denominator is Form 8606 line 6 — the aggregate December
    // 31 value of the owner's non-Roth IRAs — plus the year's complete line-7
    // and line-8 gross, and this call site runs mid-year, before the growth
    // pass and before need-based withdrawals are sized, so line 6 does not
    // exist here and no figure that does exist is a lawful substitute.
    // Committing while stating a character would have meant inventing that
    // ratio.
    //
    // What supersedes it is that the executor no longer has to state one. The
    // annual settlement computes the ratio in exactly one place, from sealed
    // post-growth year-end balances, and the simulator feeds it back through
    // the assumption vector until observed equals assumed. So a positive
    // numerator now commits with a null character and defers to that single
    // computation, which is the opposite of approximating: refusing here would
    // now suppress a lawful conversion — and a suppressed conversion is not a
    // conservative answer, it is a different plan than the household stated.
    //
    // That single computation is only lawful because line 8 is knowable: the
    // simulator forces the aggregate conversion strategy off for any year that
    // carries a named request, so this batch is the year's whole line 8 and
    // nothing else can join it. An allocation across a partial entry set would
    // be a different defect from the one this used to refuse, and a worse one.
    //
    // Admission stays outside the fixed point deliberately. The dollars moved
    // are the request's own stated amounts, identical in every attempt, so
    // line-8 gross and the line-10 denominator do not depend on the answer the
    // loop is converging to. Reading `zeroBasis` as the admission predicate
    // made admission settlement-dependent, which is genuinely circular: the
    // denominator needs the admission to have already happened.
    //
    // An employer-plan source keeps the reason too: its pre-tax balance is
    // outside the 408(d)(2) aggregation this evidence describes, so the
    // evidence does not answer for it.
    const ownedIraSources = request.allocations.every((allocation) => {
      const source = accounts.get(allocation.sourceAccountId)
      return source !== undefined && isAggregatedIra(source)
    })
    const basis = resolveOwnerAggregatedIraBasis(request, runtimeEvidence)
    const rmdReserveEvidenceId =
      resolveOwnerIraRmdSatisfactionEvidenceId(request, runtimeEvidence)
    const basisNumeratorKnown = ownedIraSources && basis.status !== 'unproven'
    const reasons: ActionReason[] = [
      ...(basisNumeratorKnown
        ? []
        : [createActionReason('conversion-basis-evidence-missing', {
            personId: request.personId,
          })]),
      ...(rmdReserveEvidenceId !== null
        ? []
        : [createActionReason('conversion-rmd-reserve-unavailable', {
            personId: request.personId,
          })]),
      ...taxFundingReasons(request, conversionLinkedWithdrawalGroups),
    ]
    // Committed movement has to be dated. `assertRecordBinding` refuses to
    // publish a positive executed amount whose executed date is not the
    // request's own effective schedule date, and the annual simulator has no
    // civil date of its own to supply, so an undated request cannot move.
    if ((request.executionDate ?? null) === null) {
      reasons.push(createActionReason('conversion-date-missing'))
    }
    if (request.year !== input.year) reasons.push(createActionReason('conversion-date-outside-action-year', { personId: request.personId }))
    const preflight = evaluateRetirementActionEligibilityFromPlan(request, input.plan as Plan, runtimeEvidence)
    if (preflight.status !== 'accepted') reasons.push(...preflight.reasons)
    // Which allocations the preflight has already disqualified as sources: an
    // unproven IRA subtype, an inherited source, an employer plan that has not
    // opened for distribution. A physical-balance report about one of those
    // would claim its balance was authoritatively consulted, and the
    // disqualification is the statement that it could not have been — the
    // account is not established as a source to consult. The report is
    // withheld for that allocation and no other, because this executor answers
    // every allocation in one pass rather than stopping at the first blocker:
    // a household short on one IRA still learns it while a second stays
    // unclassified.
    const disqualifiedAllocationIds = new Set<AllocationId>()
    if (preflight.status !== 'accepted') {
      for (const reason of preflight.reasons) {
        if (reason.allocationId !== undefined) {
          disqualifiedAllocationIds.add(reason.allocationId)
        }
      }
    }
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
      // A source this executor has just refused for what it IS carries the
      // same silence as one the preflight refused, and for the same reason.
      const sourceEstablished = source.type === 'traditional' &&
        !disqualifiedAllocationIds.has(allocation.allocationId)
      if (remaining === undefined) {
        reasons.push(createActionReason('required-facts-missing', {
          personId: request.personId,
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }))
      } else if (sourceEstablished && remaining === 0) {
        reasons.push(createActionReason('conversion-balance-unavailable', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }))
      } else if (sourceEstablished && remaining < allocation.requestedAmount) {
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
    // Nothing left unanswered, so the movement is authorised. Every reason
    // above is a blocker — `conversion-balance-trimmed` included, since this
    // executor commits a request whole or not at all — which makes an empty
    // list the exact predicate for committing.
    const executedDate = request.executionDate ?? null
    if (reasons.length === 0 && executedDate !== null &&
        basis.status !== 'unproven' && rmdReserveEvidenceId !== null) {
      committedAny = true
      for (const allocation of request.allocations) {
        const source = closingByAccountId.get(allocation.sourceAccountId)!
        closingByAccountId.set(
          allocation.sourceAccountId,
          asUsdCents(source - allocation.requestedAmount),
        )
      }
      const destinationBalance = closingByAccountId.get(request.destinationRothAccountId)!
      closingByAccountId.set(
        request.destinationRothAccountId,
        asUsdCents(destinationBalance + request.requestedAmount),
      )
      evidence.push(executedEvidence(
        request, executedDate, basis.status, basis.evidenceId,
        rmdReserveEvidenceId,
        releasedLinkedFunding(request, conversionLinkedWithdrawalGroups),
      ))
      continue
    }
    evidence.push(nonActionableEvidence(request, reasons, resolvedSourceAccountIds))
  }

  if (committedAny) {
    return immutableResult({
      committed: true,
      requests,
      scheduleIssues: [],
      balances: settledBalances(snapshots, closingByAccountId),
      evidence: evidence as [
        RothConversionExecutionEvidence,
        ...RothConversionExecutionEvidence[],
      ],
    })
  }
  return immutableResult({
    committed: false,
    requests,
    scheduleIssues: [],
    balances: unchangedBalances(snapshots),
    evidence: evidence as Readonly<RothConversionStagedExecutionEvidence>[],
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
