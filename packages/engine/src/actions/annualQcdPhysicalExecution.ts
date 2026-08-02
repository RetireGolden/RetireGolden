import {
  qualifiedCharitableDistributionRequestSchema,
  type QualifiedCharitableDistributionRequest,
} from './contract.js'
import { evaluateRetirementActionSchedule, type AccountOpeningBalanceSnapshot } from './execution.js'
import {
  accountIdSchema,
  personIdSchema,
  type AccountId, type PersonId,
} from './identity.js'
import { asUsdCents, usdCentsSchema, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { parsePlan, type Plan } from '../model/plan.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import {
  evaluateAnnualQcdExecutionPrerequisites,
  type AnnualQcdExecutionPrerequisitesEvaluated,
} from './annualQcdExecutionPrerequisite.js'

export interface AnnualQcdRmdPoolOpeningSnapshot {
  readonly predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot'
  readonly poolId: string
  readonly taxYear: number
  readonly donorPersonId: PersonId
  readonly scope: 'ownedIra'
  readonly sourceAccountIds: readonly [AccountId, ...AccountId[]]
  readonly rmdRequiredAmount: UsdCents
  readonly rmdSatisfiedBefore: UsdCents
  readonly rmdRemainingBefore: UsdCents
  readonly upstreamEvidenceId: string
}
export interface AnnualQcdRmdPoolStagedTransition extends AnnualQcdRmdPoolOpeningSnapshot {
  readonly evidenceId: string
  readonly rmdSatisfiedAfter: UsdCents
  readonly rmdRemainingAfter: UsdCents
}
export interface AnnualQcdDetachedBalanceTransition extends AccountOpeningBalanceSnapshot {
  readonly detachedClosingBalance: UsdCents
}
export interface AnnualQcdPhysicalApplication {
  readonly predicate: 'annualQcdDetachedPhysicalApplication'
  readonly request: Readonly<QualifiedCharitableDistributionRequest>
  readonly prerequisiteEvidenceId: string
  readonly sourceBalanceBefore: UsdCents
  readonly executedAmount: UsdCents
  readonly unexecutedAmount: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly charitableDistributionAmount: UsdCents
  readonly stagingDisposition: 'full' | 'partial' | 'zero'
  readonly physicalReason:
    | Readonly<ActionReason<'qcd-balance-trimmed' | 'qcd-balance-unavailable'>>
    | null
  readonly rmdPoolId: string
  readonly rmdRemainingBefore: UsdCents
  readonly rmdSatisfiedByAction: UsdCents
  readonly rmdRemainingAfter: UsdCents
  readonly stagingEvidenceId: string
}
export interface AnnualQcdPhysicalExecutionIssue {
  readonly kind:
    | 'hostileInput'
    | 'prerequisiteInvalid'
    | 'scheduleBlocked'
    | 'openingBalanceInvalid'
    | 'rmdEvidenceInvalid'
  readonly detail: string
}
export interface StageAnnualQcdPhysicalExecutionInput {
  readonly prerequisite: Readonly<AnnualQcdExecutionPrerequisitesEvaluated>
  readonly plan: Readonly<Plan>
  readonly runtimeEvidence: Readonly<RetirementActionEligibilityRuntimeEvidence>
  readonly openingBalances: readonly Readonly<AccountOpeningBalanceSnapshot>[]
  readonly rmdPools: readonly Readonly<AnnualQcdRmdPoolOpeningSnapshot>[]
}
interface AnnualQcdPhysicalExecutionBase {
  readonly committed: false
  readonly movement: 'notCommitted'
  readonly taxCharacterStatus: 'awaitingAnnualQcdPostPass'
}
export interface AnnualQcdPhysicalExecutionStaged extends AnnualQcdPhysicalExecutionBase {
  readonly status: 'annualQcdPhysicalExecutionStaged'
  readonly taxYear: number
  readonly detachedBalances: readonly Readonly<AnnualQcdDetachedBalanceTransition>[]
  readonly rmdPools: readonly Readonly<AnnualQcdRmdPoolStagedTransition>[]
  readonly applications: readonly Readonly<AnnualQcdPhysicalApplication>[]
  readonly issues: readonly []
}
export interface AnnualQcdPhysicalExecutionBlocked extends AnnualQcdPhysicalExecutionBase {
  readonly status: 'annualQcdPhysicalExecutionBlocked'
  readonly taxYear: number | null
  readonly detachedBalances: readonly []
  readonly rmdPools: readonly []
  readonly applications: readonly []
  readonly issues: readonly [Readonly<AnnualQcdPhysicalExecutionIssue>]
}
export type StageAnnualQcdPhysicalExecutionResult =
  | AnnualQcdPhysicalExecutionStaged
  | AnnualQcdPhysicalExecutionBlocked
class StageError extends Error {
  readonly kind: AnnualQcdPhysicalExecutionIssue['kind']
  constructor(kind: AnnualQcdPhysicalExecutionIssue['kind'], detail: string) {
    super(detail)
    this.kind = kind
  }
}
function fail(kind: AnnualQcdPhysicalExecutionIssue['kind'], detail: string): never {
  throw new StageError(kind, detail)
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function blocked(error: unknown): AnnualQcdPhysicalExecutionBlocked {
  const issue = error instanceof StageError
    ? { kind: error.kind, detail: error.message }
    : {
        kind: 'hostileInput' as const,
        detail: 'QCD physical-stage input must be valid losslessly snapshot-compatible data.',
      }
  return deepFreeze({
    status: 'annualQcdPhysicalExecutionBlocked',
    committed: false,
    movement: 'notCommitted',
    taxCharacterStatus: 'awaitingAnnualQcdPostPass',
    taxYear: null,
    detachedBalances: [],
    rmdPools: [],
    applications: [],
    issues: [issue],
  })
}

function nonblank(value: string, label: string): string {
  if (value.trim().length === 0) fail('rmdEvidenceInvalid', `${label} must be nonblank.`)
  return value
}

function cents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new StageError('hostileInput', `${label} exceeded the exact-cent range.`)
  }
  return asUsdCents(Number(value))
}

function canonicalPrerequisite(
  prerequisite: Readonly<AnnualQcdExecutionPrerequisitesEvaluated>,
  plan: Readonly<Plan>,
  runtimeEvidence: Readonly<RetirementActionEligibilityRuntimeEvidence>,
): readonly QualifiedCharitableDistributionRequest[] {
  if (prerequisite.status !== 'evaluated' || prerequisite.committed !== false ||
      prerequisite.issues.length !== 0 ||
      prerequisite.publicationSource.executorSource !== 'qcdExecutor' ||
      prerequisite.requests.length === 0) {
    fail('prerequisiteInvalid', 'QCD physical staging requires an evaluated qcdExecutor prerequisite batch.')
  }
  const schedule = evaluateRetirementActionSchedule(prerequisite.taxYear, prerequisite.requests)
  if (schedule.scheduleIssues.length > 0) {
    fail('scheduleBlocked', 'QCD physical staging requires a conflict-free canonical annual schedule.')
  }
  if (prerequisite.publicationSource.scheduleDiagnostics.length !== 0) {
    fail('prerequisiteInvalid', 'QCD prerequisite diagnostics conflict with its request schedule.')
  }
  const requests = schedule.requests.map((request) =>
    qualifiedCharitableDistributionRequestSchema.parse(request))
  const rebuilt = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: prerequisite.taxYear, plan, requests, runtimeEvidence,
  })
  if (rebuilt.status !== 'evaluated' || JSON.stringify(rebuilt) !== JSON.stringify(prerequisite)) {
    fail('prerequisiteInvalid', 'QCD prerequisite differs from its authoritative Plan evaluation.')
  }
  return rebuilt.requests
}

function canonicalBalances(
  input: readonly Readonly<AccountOpeningBalanceSnapshot>[],
  sourceIds: ReadonlySet<AccountId>,
): AnnualQcdDetachedBalanceTransition[] {
  const seen = new Set<AccountId>()
  const balances = input.map((raw) => {
    const accountId = accountIdSchema.parse(raw.accountId)
    const openingBalance = usdCentsSchema.parse(raw.openingBalance)
    if (seen.has(accountId)) {
      fail('openingBalanceInvalid', `Opening balance for "${accountId}" is duplicated.`)
    }
    seen.add(accountId)
    return { accountId, openingBalance, detachedClosingBalance: openingBalance }
  }).sort((left, right) => compareUtf16CodeUnits(left.accountId, right.accountId))
  if ([...sourceIds].some((sourceId) => !seen.has(sourceId))) {
    throw new StageError('openingBalanceInvalid', 'Every QCD source requires one exact opening balance.')
  }
  return balances
}

function canonicalPools(
  input: readonly Readonly<AnnualQcdRmdPoolOpeningSnapshot>[],
  requests: readonly Readonly<QualifiedCharitableDistributionRequest>[],
  plan: Readonly<Plan>,
): AnnualQcdRmdPoolStagedTransition[] {
  const ids = new Set<string>()
  const evidenceIds = new Set<string>()
  const claimedAccounts = new Set<AccountId>()
  const pools = input.map((raw) => {
    const poolId = nonblank(raw.poolId, 'RMD pool ID')
    const upstreamEvidenceId = nonblank(raw.upstreamEvidenceId, 'RMD upstream evidence ID')
    const donorPersonId = personIdSchema.parse(raw.donorPersonId)
    const sourceAccountIds = [...raw.sourceAccountIds]
      .map((id) => accountIdSchema.parse(id)).sort(compareUtf16CodeUnits)
    const completeAccountIds = plan.accounts.filter((account) =>
      account.ownerPersonId === donorPersonId && account.type === 'traditional' &&
      account.kind === 'ira' && account.inherited === undefined)
      .map((account) => accountIdSchema.parse(account.id)).sort(compareUtf16CodeUnits)
    const required = usdCentsSchema.parse(raw.rmdRequiredAmount)
    const satisfied = usdCentsSchema.parse(raw.rmdSatisfiedBefore)
    const remaining = usdCentsSchema.parse(raw.rmdRemainingBefore)
    const evidenceId = deriveActionStructuralId('annual-qcd-owned-ira-rmd-pool', [
      poolId, raw.taxYear, donorPersonId, sourceAccountIds, required, satisfied, remaining, upstreamEvidenceId,
    ])
    const allEvidenceIds = [evidenceId, upstreamEvidenceId]
    if (raw.predicate !== 'annualQcdOwnedIraRmdPoolOpeningSnapshot' || raw.scope !== 'ownedIra' ||
        raw.taxYear !== requests[0]!.year || sourceAccountIds.length === 0 ||
        new Set(sourceAccountIds).size !== sourceAccountIds.length ||
        JSON.stringify(sourceAccountIds) !== JSON.stringify(completeAccountIds) ||
        BigInt(satisfied) + BigInt(remaining) !== BigInt(required) || ids.has(poolId) ||
        new Set(allEvidenceIds).size !== allEvidenceIds.length ||
        allEvidenceIds.some((id) => evidenceIds.has(id)) ||
        sourceAccountIds.some((id) => claimedAccounts.has(id))) {
      fail('rmdEvidenceInvalid', `RMD pool "${poolId}" is malformed, duplicated, or overlaps another pool.`)
    }
    ids.add(poolId)
    allEvidenceIds.forEach((id) => evidenceIds.add(id))
    sourceAccountIds.forEach((id) => claimedAccounts.add(id))
    return {
      ...raw,
      poolId, donorPersonId,
      sourceAccountIds: sourceAccountIds as [AccountId, ...AccountId[]],
      rmdRequiredAmount: required, rmdSatisfiedBefore: satisfied,
      rmdRemainingBefore: remaining, evidenceId, upstreamEvidenceId,
      rmdSatisfiedAfter: satisfied, rmdRemainingAfter: remaining,
    }
  }).sort((left, right) => compareUtf16CodeUnits(left.poolId, right.poolId))
  for (const request of requests) {
    const matches = pools.filter((pool) =>
      pool.donorPersonId === request.donorPersonId &&
      pool.sourceAccountIds.includes(request.allocation.sourceAccountId))
    if (matches.length !== 1) {
      fail('rmdEvidenceInvalid', `QCD action "${request.actionId}" requires one donor/source RMD pool.`)
    }
  }
  return pools
}

function stageUnchecked(input: StageAnnualQcdPhysicalExecutionInput): AnnualQcdPhysicalExecutionStaged {
  const parsedPlan = parsePlan(input.plan)
  if (!parsedPlan.ok) fail('prerequisiteInvalid', 'QCD physical staging requires one valid authoritative Plan.')
  const plan = parsedPlan.plan
  const requests = canonicalPrerequisite(input.prerequisite, plan, input.runtimeEvidence)
  const sourceIds = new Set(requests.map((request) => request.allocation.sourceAccountId))
  const detachedBalances = canonicalBalances(input.openingBalances, sourceIds)
  const pools = canonicalPools(input.rmdPools, requests, plan)
  const workingBalances = new Map(
    detachedBalances.map((entry) => [entry.accountId, entry.openingBalance]),
  )
  const workingPools = new Map(pools.map((pool) => [pool.poolId, {
    satisfied: pool.rmdSatisfiedBefore,
    remaining: pool.rmdRemainingBefore,
  }]))
  const applications: AnnualQcdPhysicalApplication[] = []
  for (const request of requests) {
    const prerequisiteEntry = input.prerequisite.evidence.find(
      (entry) => entry.actionId === request.actionId,
    )!
    const prerequisiteEvidenceId = deriveActionStructuralId(
      'annual-qcd-execution-prerequisite', [prerequisiteEntry],
    )
    const pool = pools.find((entry) =>
      entry.donorPersonId === request.donorPersonId &&
      entry.sourceAccountIds.includes(request.allocation.sourceAccountId))!
    const poolState = workingPools.get(pool.poolId)!
    const before = workingBalances.get(request.allocation.sourceAccountId)!
    const executed = asUsdCents(Math.min(request.requestedAmount, before))
    const unexecuted = cents(
      BigInt(request.requestedAmount) - BigInt(executed),
      'QCD unexecuted amount',
    )
    const after = cents(
      BigInt(before) - BigInt(executed),
      'QCD detached source balance',
    )
    const rmdSatisfied = asUsdCents(Math.min(executed, poolState.remaining))
    const rmdRemainingBefore = poolState.remaining
    const rmdSatisfiedAfter = cents(
      BigInt(poolState.satisfied) + BigInt(rmdSatisfied),
      'RMD satisfied amount',
    )
    const rmdRemainingAfter = cents(
      BigInt(poolState.remaining) - BigInt(rmdSatisfied),
      'RMD remaining amount',
    )
    workingBalances.set(request.allocation.sourceAccountId, after)
    workingPools.set(pool.poolId, { satisfied: rmdSatisfiedAfter, remaining: rmdRemainingAfter })
    const disposition = executed === 0 ? 'zero' : executed === request.requestedAmount ? 'full' : 'partial'
    const physicalReason = disposition === 'full' ? null : createActionReason(
      disposition === 'zero' ? 'qcd-balance-unavailable' : 'qcd-balance-trimmed',
      { accountId: request.allocation.sourceAccountId, allocationId: request.allocation.allocationId },
    )
    const stagingEvidenceId = deriveActionStructuralId(
      'annual-qcd-detached-physical-application',
      [
        request,
        prerequisiteEvidenceId,
        before,
        executed,
        after,
        pool.poolId,
        rmdRemainingBefore,
        rmdSatisfied,
        rmdRemainingAfter,
        pool.sourceAccountIds, pool.evidenceId,
        pool.upstreamEvidenceId,
      ],
    )
    applications.push({
      predicate: 'annualQcdDetachedPhysicalApplication',
      request, prerequisiteEvidenceId,
      sourceBalanceBefore: before, sourceBalanceAfter: after,
      executedAmount: executed, unexecutedAmount: unexecuted,
      charitableDistributionAmount: executed,
      stagingDisposition: disposition, physicalReason,
      rmdPoolId: pool.poolId, rmdRemainingBefore,
      rmdSatisfiedByAction: rmdSatisfied, rmdRemainingAfter, stagingEvidenceId,
    })
  }
  const finalBalances = detachedBalances.map((entry) => ({
    ...entry,
    detachedClosingBalance: workingBalances.get(entry.accountId)!,
  }))
  const finalPools = pools.map((pool) => ({
    ...pool,
    rmdSatisfiedAfter: workingPools.get(pool.poolId)!.satisfied,
    rmdRemainingAfter: workingPools.get(pool.poolId)!.remaining,
  }))
  return deepFreeze({
    status: 'annualQcdPhysicalExecutionStaged',
    committed: false,
    movement: 'notCommitted',
    taxCharacterStatus: 'awaitingAnnualQcdPostPass',
    taxYear: input.prerequisite.taxYear,
    detachedBalances: finalBalances,
    rmdPools: finalPools,
    applications,
    issues: [],
  })
}

/** Stage exact QCD source/RMD transitions on detached snapshots; no balance or tax character is committed. */
export function stageAnnualQcdPhysicalExecution(
  input: Readonly<StageAnnualQcdPhysicalExecutionInput>,
): Readonly<StageAnnualQcdPhysicalExecutionResult> {
  try {
    return stageUnchecked(structuredClone(input) as StageAnnualQcdPhysicalExecutionInput)
  } catch (error) {
    return blocked(error)
  }
}
