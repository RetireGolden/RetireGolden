/**
 * Flexible one-time-goal scheduler. One scheduler instance belongs to one
 * projection path, so goal resolution is stateful and deterministic: a goal can
 * be funded, partially funded, or skipped at most once.
 */

import type { GoalFlexibility, OneTimeGoal, SpendingClassification } from '../model/plan'

const CLASSIFICATION_RANK: Record<SpendingClassification, number> = {
  required: 0,
  target: 1,
  ideal: 2,
  excess: 3,
}

const EPSILON = 0.005

export interface SchedulableGoal {
  id: string
  classification: SpendingClassification
  flexibility: GoalFlexibility
  earliestYear: number
  targetYear: number
  latestYear: number
  priority: number
  order: number
  amountTodayDollars: number
  minFundingPct: number
  allowPartialFunding: boolean
}

/** Resolve a stored goal's optional flexibility fields to their defaults. */
export function toSchedulableGoal(goal: OneTimeGoal, index: number): SchedulableGoal {
  const targetYear = goal.year
  const classification = goal.classification ?? 'target'
  const flexibility = goal.flexibility ?? 'fixed'
  const earliestYear = Math.min(goal.earliestYear ?? targetYear, targetYear)
  const latestYear = Math.max(goal.latestYear ?? targetYear, targetYear)
  const defaultMinFundingPct = flexibility === 'skippable' ? 0 : 100
  return {
    id: goal.id,
    classification,
    flexibility,
    earliestYear,
    targetYear,
    latestYear,
    priority: goal.priority ?? index,
    order: index,
    amountTodayDollars: goal.amount,
    minFundingPct: goal.minFundingPct ?? defaultMinFundingPct,
    allowPartialFunding: goal.allowPartialFunding ?? false,
  }
}

export type GoalOutcome = 'funded' | 'partiallyFunded' | 'deferred' | 'skipped'

export interface GoalYearResult {
  id: string
  classification: SpendingClassification
  outcome: GoalOutcome
  /** The goal's intended (inflated) cost this year, regardless of outcome. */
  amountNominal: number
  /** Nominal dollars funded this year. */
  fundedNominal: number
  /** Nominal dollars not funded when the goal resolves below its intended cost. */
  unfundedNominal: number
}

export interface GoalYearContext {
  /** Cumulative inflation factor from the projection start to this year. */
  inflFactor: number
  /** True when the guardrail policy is cutting discretionary spending this year. */
  cutting: boolean
  /** True when strong-path rules may pull goals earlier than their target year. */
  canPullForward?: boolean
  /**
   * Hard budget for flexible goals this year. `null` means unlimited; omitted
   * means no flexible-goal budget while cutting and unlimited otherwise.
   */
  availableBudget?: number | null
}

export interface GoalPlanningResult {
  results: GoalYearResult[]
  remainingBudget: number | null
}

export interface GoalScheduler {
  /** Decide every goal touching `year`; each goal resolves at most once. */
  planYear(year: number, ctx: GoalYearContext): GoalPlanningResult
  /** True after a goal has been funded, partially funded, or skipped. */
  isResolved(id: string): boolean
}

function result(goal: SchedulableGoal, ctx: GoalYearContext, outcome: GoalOutcome, fundedNominal: number): GoalYearResult {
  const amountNominal = goal.amountTodayDollars * ctx.inflFactor
  return {
    id: goal.id,
    classification: goal.classification,
    outcome,
    amountNominal,
    fundedNominal,
    unfundedNominal: Math.max(0, amountNominal - fundedNominal),
  }
}

function defaultBudget(ctx: GoalYearContext): number | null {
  if (ctx.availableBudget !== undefined) return ctx.availableBudget
  return ctx.cutting ? 0 : null
}

function canFullyFund(budget: number | null, amount: number): boolean {
  return budget === null || budget + EPSILON >= amount
}

function consume(budget: number | null, amount: number): number | null {
  return budget === null ? null : Math.max(0, budget - amount)
}

function partialAmount(goal: SchedulableGoal, budget: number | null, amount: number): number {
  if (!goal.allowPartialFunding || budget === null || budget <= EPSILON) return 0
  const minimum = amount * Math.max(0, Math.min(100, goal.minFundingPct)) / 100
  if (budget + EPSILON < minimum) return 0
  return Math.min(amount, budget)
}

function resolveBudget(ctx: GoalYearContext, beforeTarget: boolean, remainingBudget: number | null): number | null {
  if (beforeTarget || ctx.cutting) return remainingBudget
  return null
}

/**
 * Build a scheduler for a plan's goals. Flexible goals are evaluated by
 * classification, then explicit priority, then original list order so a target
 * car replacement cannot be crowded out by a lower-layer ideal remodel.
 */
export function createGoalScheduler(goals: SchedulableGoal[]): GoalScheduler {
  const ordered = [...goals].sort((a, b) => {
    const classDelta = CLASSIFICATION_RANK[a.classification] - CLASSIFICATION_RANK[b.classification]
    if (classDelta !== 0) return classDelta
    const priorityDelta = a.priority - b.priority
    if (priorityDelta !== 0) return priorityDelta
    return a.order - b.order
  })
  const resolved = new Set<string>()

  return {
    isResolved(id) {
      return resolved.has(id)
    },

    planYear(year, ctx) {
      const results: GoalYearResult[] = []
      let remainingBudget = defaultBudget(ctx)

      for (const goal of ordered) {
        if (resolved.has(goal.id)) continue

        if (goal.flexibility === 'fixed') {
          if (year === goal.targetYear) {
            const funded = goal.amountTodayDollars * ctx.inflFactor
            resolved.add(goal.id)
            results.push(result(goal, ctx, 'funded', funded))
          }
          continue
        }

        if (year < goal.earliestYear || year > goal.latestYear) continue
        const beforeTarget = year < goal.targetYear
        if (beforeTarget && !ctx.canPullForward) continue

        const amount = goal.amountTodayDollars * ctx.inflFactor
        const effectiveBudget = resolveBudget(ctx, beforeTarget, remainingBudget)
        if (canFullyFund(effectiveBudget, amount)) {
          if (effectiveBudget !== null) remainingBudget = consume(remainingBudget, amount)
          resolved.add(goal.id)
          results.push(result(goal, ctx, 'funded', amount))
          continue
        }

        const partial = partialAmount(goal, effectiveBudget, amount)
        if (partial > EPSILON) {
          remainingBudget = consume(remainingBudget, partial)
          resolved.add(goal.id)
          results.push(result(goal, ctx, 'partiallyFunded', partial))
          continue
        }

        if (year < goal.latestYear) {
          results.push(result(goal, ctx, 'deferred', 0))
        } else {
          resolved.add(goal.id)
          results.push(result(goal, ctx, 'skipped', 0))
        }
      }

      return { results, remainingBudget }
    },
  }
}
