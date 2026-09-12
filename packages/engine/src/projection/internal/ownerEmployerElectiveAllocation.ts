/**
 * Owner-wide §402(g)/§414(v) budget across employer plans, with per-plan
 * Roth catch-up destinations and plan-scoped prior Roth offset.
 *
 * Calls leaf `allocateEmployerElectiveDeferrals` once per plan group against the
 * remaining owner annual capacity. Does not reimplement deferral consume math.
 */
import {
  allocateEmployerElectiveDeferrals,
  type EmployerElectiveAllocation,
  type EmployerElectiveLimits,
  type EmployerElectiveRequest,
} from '../employerRothCatchUp.js'

export type OwnerEmployerPriorElectiveContributions =
  | { readonly status: 'unknown' }
  | {
      readonly status: 'known'
      readonly designatedRothElectiveDeferrals: number
      readonly totalElectiveDeferrals: number
      readonly asOfDate: string
    }

export interface OwnerEmployerPlanGroup {
  readonly groupKey: string
  readonly ownerId: string
  readonly employerPlanId: string | null
  readonly requests: readonly EmployerElectiveRequest[]
  readonly prior?: OwnerEmployerPriorElectiveContributions
}

/**
 * Leaf allocation plus the optional prior-history fields that land with the
 * federal elective-deferral leaf. Local leaf typings may lag; callers read the
 * optional fields when present.
 */
export type EmployerElectiveAllocationWithPrior = EmployerElectiveAllocation & {
  readonly additionalRothCatchUpStillRequired?: number | null
  readonly priorContributionsStatus?: 'omittedAsZero' | 'known' | 'unknown'
}

export interface OwnerEmployerElectiveAllocationResult {
  /** Per (owner, plan) allocation — Roth destination and redirects stay plan-local. */
  readonly allocationByGroupKey: ReadonlyMap<string, EmployerElectiveAllocationWithPrior>
  /** Account-level allowed amounts across all groups. */
  readonly allocatedByAccountId: ReadonlyMap<string, number>
  /**
   * Owner-merged view for totals / §415(c) catch-up slices. `catchUpRothAccountId`
   * is omitted on purpose when multiple plan groups exist so callers cannot
   * mis-route redirects across plans; use `allocationByGroupKey` for match basis.
   */
  readonly allocationByOwner: ReadonlyMap<string, EmployerElectiveAllocationWithPrior>
}

function sumAllowed(allocation: EmployerElectiveAllocation): number {
  let total = 0
  for (const amount of allocation.allowed.values()) total += amount
  return total
}

function mergeOwnerAllocation(
  existing: EmployerElectiveAllocationWithPrior | undefined,
  next: EmployerElectiveAllocationWithPrior,
  multiPlanOwner: boolean,
): EmployerElectiveAllocationWithPrior {
  if (existing === undefined) {
    if (!multiPlanOwner) return next
    return {
      ...next,
      // Multi-plan owners must look up destinations per group.
      catchUpRothAccountId: undefined,
    }
  }
  const allowed = new Map(existing.allowed)
  for (const [accountId, amount] of next.allowed) {
    allowed.set(accountId, (allowed.get(accountId) ?? 0) + amount)
  }
  const redirectedCatchUpBySource = new Map(existing.redirectedCatchUpBySource)
  for (const [accountId, amount] of next.redirectedCatchUpBySource) {
    redirectedCatchUpBySource.set(
      accountId,
      (redirectedCatchUpBySource.get(accountId) ?? 0) + amount,
    )
  }
  const catchUpByAccount = new Map(existing.catchUpByAccount)
  for (const [accountId, amount] of next.catchUpByAccount) {
    catchUpByAccount.set(
      accountId,
      (catchUpByAccount.get(accountId) ?? 0) + amount,
    )
  }
  const priorStatuses = [
    existing.priorContributionsStatus,
    next.priorContributionsStatus,
  ]
  const priorContributionsStatus = priorStatuses.includes('unknown')
    ? 'unknown'
    : priorStatuses.includes('known')
      ? 'known'
      : existing.priorContributionsStatus ?? next.priorContributionsStatus
  const additionalRothCatchUpStillRequired =
    priorContributionsStatus === 'unknown'
      ? null
      : (existing.additionalRothCatchUpStillRequired ?? 0) +
        (next.additionalRothCatchUpStillRequired ?? 0)
  return {
    allowed,
    designatedRothCatchUp:
      existing.designatedRothCatchUp + next.designatedRothCatchUp,
    refusedCatchUp: existing.refusedCatchUp + next.refusedCatchUp,
    redirectedCatchUpBySource,
    catchUpByAccount,
    catchUpRothAccountId: multiPlanOwner
      ? undefined
      : existing.catchUpRothAccountId ?? next.catchUpRothAccountId,
    additionalRothCatchUpStillRequired,
    priorContributionsStatus,
  }
}

/**
 * Allocate each plan group against one shared owner annual elective budget.
 * Prior totals across all plans consume that budget before incremental desires.
 * Same-plan prior Roth offsets only that plan's §414(v)(7) mandate.
 */
export function allocateOwnerEmployerElectivesAcrossPlans(input: {
  readonly groups: readonly OwnerEmployerPlanGroup[]
  readonly contributionYear: number
  readonly baseLimit: number
  readonly catchUpLimit: number
  readonly wageThreshold: number
  readonly compensationByOwner: ReadonlyMap<string, number>
}): OwnerEmployerElectiveAllocationResult {
  const allocationByGroupKey = new Map<string, EmployerElectiveAllocationWithPrior>()
  const allocatedByAccountId = new Map<string, number>()
  const allocationByOwner = new Map<string, EmployerElectiveAllocationWithPrior>()

  const groupsByOwner = new Map<string, OwnerEmployerPlanGroup[]>()
  for (const group of input.groups) {
    const list = groupsByOwner.get(group.ownerId) ?? []
    list.push(group)
    groupsByOwner.set(group.ownerId, list)
  }

  for (const [ownerId, ownerGroups] of [...groupsByOwner.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )) {
    const sorted = [...ownerGroups].sort((a, b) =>
      a.groupKey < b.groupKey ? -1 : a.groupKey > b.groupKey ? 1 : 0,
    )
    const multiPlanOwner = sorted.length > 1
    const compensation = input.compensationByOwner.get(ownerId) ?? 0
    const maxAnnual = input.baseLimit + input.catchUpLimit

    // Phase 1: known priors across all plans consume the owner annual budget.
    let ownerUsedTotal = 0
    for (const group of sorted) {
      if (group.prior?.status !== 'known') continue
      ownerUsedTotal += Math.max(0, group.prior.totalElectiveDeferrals)
    }

    // Phase 2: per-plan incremental allocation against remaining capacity.
    for (const group of sorted) {
      const ownPrior = group.prior?.status === 'known' ? group.prior.totalElectiveDeferrals : 0
      // Remove OTHER plans' actual usage from the statutory limits, then let
      // the leaf consume this plan's genuine prior history once. Passing a
      // fictitious total=0 with positive prior Roth is inconsistent evidence.
      const otherUsed = Math.max(0, ownerUsedTotal - ownPrior)
      const availableAnnual = Math.max(0, maxAnnual - otherUsed)
      const baseLimit = Math.max(0, input.baseLimit - otherUsed)
      const limits: EmployerElectiveLimits = {
        contributionYear: input.contributionYear,
        baseLimit,
        catchUpLimit: Math.max(0, availableAnnual - baseLimit),
        wageThreshold: input.wageThreshold,
        compensation: Math.max(0, compensation - otherUsed),
        ...(group.prior === undefined ? {} : { priorContributions: group.prior }),
      }
      const allocation = allocateEmployerElectiveDeferrals(
        group.requests,
        limits as EmployerElectiveLimits,
      ) as EmployerElectiveAllocationWithPrior

      allocationByGroupKey.set(group.groupKey, allocation)
      for (const [accountId, amount] of allocation.allowed) {
        allocatedByAccountId.set(accountId, amount)
      }
      allocationByOwner.set(
        ownerId,
        mergeOwnerAllocation(
          allocationByOwner.get(ownerId),
          allocation,
          multiPlanOwner,
        ),
      )
      ownerUsedTotal += sumAllowed(allocation)
    }
  }

  return { allocationByGroupKey, allocatedByAccountId, allocationByOwner }
}
