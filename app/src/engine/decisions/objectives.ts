/**
 * Objective and constraint policies (ledger-native decision engine, Phase 1.5).
 *
 * A policy defines what "better" means for ranking exact-ledger evaluations:
 * one primary metric (higher is better), hard constraints that disqualify a
 * candidate outright, and secondary context metrics. Policies never simulate;
 * they only read evaluations the exact ledger already produced, so no surface
 * can pick an objective that bypasses exact evaluation.
 */

import type { Plan } from '../model/plan'
import type { ProjectionResult } from '../projection/types'
import { planForCandidate } from './evaluateCandidate'
import type { DecisionContext, ExactDecisionEvaluation } from './types'

export type ObjectivePolicyId =
  | 'max-after-tax-estate'
  | 'max-spending-durability'
  | 'min-lifetime-tax-estate-floor'
  | 'protect-survivor-liquidity'
  | 'bridge-durability'
  | 'max-sustainable-spending'
  | 'max-downside-resilience'

export interface ObjectivePolicy {
  id: ObjectivePolicyId
  label: string
  description: string
  primaryMetricLabel: string
  /** Higher is better. Deterministic function of the evaluation (and baseline via ctx). */
  primaryMetric(evaluation: ExactDecisionEvaluation, ctx: DecisionContext): number
  /** Ties on the primary metric break on this (higher is better); defaults to estate delta. */
  tieBreaker?(evaluation: ExactDecisionEvaluation, ctx: DecisionContext): number
  /** Human-readable hard-constraint violations; non-empty ⇒ candidate is ineligible. */
  constraintViolations(evaluation: ExactDecisionEvaluation, ctx: DecisionContext): string[]
  /** Secondary metrics shown as context, never used for ranking. */
  secondaryMetrics(evaluation: ExactDecisionEvaluation): Array<{ label: string; value: number }>
}

const centRound = (value: number) => Math.round(value * 100) / 100

function standardSecondaryMetrics(evaluation: ExactDecisionEvaluation): Array<{ label: string; value: number }> {
  return [
    { label: 'Lifetime tax delta', value: centRound(evaluation.deltas.lifetimeTax) },
    { label: 'Ending net worth delta', value: centRound(evaluation.deltas.endingNetWorth) },
    { label: 'Money-lasts delta (years)', value: evaluation.deltas.moneyLastsYears },
  ]
}

function moneyLastsViolations(evaluation: ExactDecisionEvaluation): string[] {
  if (evaluation.deltas.moneyLastsYears < 0) {
    return [`shortens money-lasts by ${-evaluation.deltas.moneyLastsYears} year(s)`]
  }
  return []
}

function structuralViolations(evaluation: ExactDecisionEvaluation): string[] {
  if (evaluation.recommendationState === 'diagnostic') {
    return ['diagnostic-only evaluation (invalid patch or materially unexecuted schedule)']
  }
  return []
}

/**
 * Minimum investable balance over the years `selectYears` picks, deflated by
 * nothing (nominal — both sides deflate identically so deltas are comparable).
 * Returns null when no year matches.
 */
function minInvestableOver(result: ProjectionResult, selectYears: (year: ProjectionResult['years'][number]) => boolean): number | null {
  let min: number | null = null
  for (const year of result.years) {
    if (!selectYears(year)) continue
    if (min === null || year.investableTotal < min) min = year.investableTotal
  }
  return min
}

function survivorYearFilter(year: ProjectionResult['years'][number]): boolean {
  const alive = year.people.filter((person) => person.alive).length
  return year.people.length > 1 && alive === 1
}

/** Pre-RMD, post-wage years with no Social Security yet — the early-retirement bridge. */
function bridgeYearFilter(year: ProjectionResult['years'][number]): boolean {
  const anyPreRmd = year.people.some((person) => person.alive && person.ageAttained < 73)
  return year.incomes.wages < 10_000 && year.incomes.socialSecurity <= 0 && anyPreRmd
}

/**
 * Primary policy: maximize the ending after-tax estate, never materially
 * worsening depletion. This is the conservative default the first shared
 * tournament ships with.
 */
export const maximizeAfterTaxEstate: ObjectivePolicy = {
  id: 'max-after-tax-estate',
  label: 'Maximize after-tax estate',
  description: 'Largest projected ending estate net of heir tax, with money-lasts as a hard guardrail.',
  primaryMetricLabel: 'Ending after-tax estate delta',
  primaryMetric: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
  constraintViolations: (evaluation) => [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)],
  secondaryMetrics: standardSecondaryMetrics,
}

/**
 * Maximize sustainable spending durability: money must last at least as long,
 * ranked by how much longer it lasts, estate as tie-break.
 */
export const maximizeSpendingDurability: ObjectivePolicy = {
  id: 'max-spending-durability',
  label: 'Maximize spending durability',
  description: 'Money lasting longer beats a bigger estate; depletion must never arrive sooner.',
  primaryMetricLabel: 'Money-lasts delta (years)',
  primaryMetric: (evaluation) => evaluation.deltas.moneyLastsYears,
  tieBreaker: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
  constraintViolations: (evaluation) => [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)],
  secondaryMetrics: standardSecondaryMetrics,
}

/**
 * Minimize lifetime taxes and penalties, subject to an after-tax-estate floor.
 * With no bequest target the floor is "the estate must not worsen" — the
 * classic "tax savings that aren't estate-negative" screen. With a bequest
 * target (today's dollars, e.g. `plan.expenses.bequestTargetDollars`) the
 * floor is absolute instead: the candidate's ending after-tax estate must
 * clear the target inflated to nominal end-of-plan dollars.
 */
export function makeMinimizeLifetimeTaxWithEstateFloor(bequestTargetTodayDollars = 0): ObjectivePolicy {
  return {
    id: 'min-lifetime-tax-estate-floor',
    label: 'Minimize lifetime tax (estate floor)',
    description:
      bequestTargetTodayDollars > 0
        ? `Lowest lifetime taxes and penalties among candidates that keep the after-tax estate at or above the $${Math.round(bequestTargetTodayDollars).toLocaleString()} bequest target (today's dollars).`
        : 'Lowest lifetime taxes and penalties among candidates that do not reduce the after-tax estate.',
    primaryMetricLabel: 'Lifetime tax savings',
    primaryMetric: (evaluation) => -evaluation.deltas.lifetimeTax,
    tieBreaker: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
    constraintViolations: (evaluation, ctx) => {
      const violations = [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)]
      if (bequestTargetTodayDollars > 0) {
        // Inflate under the candidate plan's own assumptions — its patch may
        // change inflation, and the estate it produced is nominal.
        const built = planForCandidate(ctx.plan, evaluation.candidate)
        const candidatePlan = built.ok ? built.plan : ctx.plan
        const nominalFloor = nominalDollarsAtPlanEnd(bequestTargetTodayDollars, candidatePlan, evaluation.candidateResult)
        if (evaluation.candidateSummary.endingAfterTaxEstate < nominalFloor) {
          violations.push(
            `ending after-tax estate falls below the $${Math.round(bequestTargetTodayDollars).toLocaleString()} bequest target (today's dollars)`,
          )
        }
      } else if (evaluation.deltas.endingAfterTaxEstate < -1) {
        violations.push(
          `reduces the after-tax estate by $${Math.round(-evaluation.deltas.endingAfterTaxEstate).toLocaleString()}`,
        )
      }
      return violations
    },
    secondaryMetrics: standardSecondaryMetrics,
  }
}

export const minimizeLifetimeTaxWithEstateFloor: ObjectivePolicy = makeMinimizeLifetimeTaxWithEstateFloor()

/** Worst survivor-year investable balance, deflated to today's dollars. */
function minDeflatedSurvivorInvestable(result: ProjectionResult, plan: Plan): number | null {
  const startYear = result.years[0]?.year ?? result.endYear
  const inflationRate = plan.assumptions.inflationPct / 100
  let min: number | null = null
  for (const year of result.years) {
    if (!survivorYearFilter(year)) continue
    const deflated = year.investableTotal / Math.pow(1 + inflationRate, year.year - startYear)
    if (min === null || deflated < min) min = deflated
  }
  return min
}

/**
 * Protect survivor-year liquidity: rank by the minimum investable balance in
 * years where exactly one spouse survives. Falls back to the estate delta for
 * plans with no survivor years (single household or joint survival throughout).
 * With a survivor reserve target (today's dollars) the policy also enforces a
 * hard floor: a candidate whose worst survivor-year investable balance falls
 * below the target is disqualified with a readable loss reason.
 */
export function makeProtectSurvivorLiquidity(reserveTargetTodayDollars = 0): ObjectivePolicy {
  return {
    id: 'protect-survivor-liquidity',
    label: 'Protect survivor liquidity',
    description:
      reserveTargetTodayDollars > 0
        ? `Raise the worst-case survivor-year investable balance while keeping it at or above the $${Math.round(reserveTargetTodayDollars).toLocaleString()} reserve target (today's dollars); never shorten money-lasts.`
        : 'Raise the worst-case investable balance during survivor years; never shorten money-lasts.',
    primaryMetricLabel: 'Minimum survivor-year investable delta',
    primaryMetric: (evaluation, ctx) => {
      const candidateMin = minInvestableOver(evaluation.candidateResult, survivorYearFilter)
      const baselineMin = minInvestableOver(ctx.baselineResult, survivorYearFilter)
      if (candidateMin === null || baselineMin === null) return evaluation.deltas.endingAfterTaxEstate
      return candidateMin - baselineMin
    },
    tieBreaker: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
    constraintViolations: (evaluation, ctx) => {
      const violations = [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)]
      if (reserveTargetTodayDollars > 0) {
        const built = planForCandidate(ctx.plan, evaluation.candidate)
        const candidatePlan = built.ok ? built.plan : ctx.plan
        const worst = minDeflatedSurvivorInvestable(evaluation.candidateResult, candidatePlan)
        if (worst !== null && worst < reserveTargetTodayDollars - 1) {
          violations.push(
            `survivor-year investable balance falls to $${Math.round(worst).toLocaleString()} (today's dollars), below the $${Math.round(reserveTargetTodayDollars).toLocaleString()} reserve target`,
          )
        }
      }
      return violations
    },
    secondaryMetrics: standardSecondaryMetrics,
  }
}

export const protectSurvivorLiquidity: ObjectivePolicy = makeProtectSurvivorLiquidity()

/**
 * Improve early-retirement bridge durability: rank by the minimum investable
 * balance across bridge years (retired, pre-Social-Security, pre-RMD). Falls
 * back to the estate delta when the plan has no bridge years.
 */
export const improveBridgeDurability: ObjectivePolicy = {
  id: 'bridge-durability',
  label: 'Improve bridge durability',
  description: 'Raise the worst-case investable balance across pre-Social-Security bridge years.',
  primaryMetricLabel: 'Minimum bridge-year investable delta',
  primaryMetric: (evaluation, ctx) => {
    const candidateMin = minInvestableOver(evaluation.candidateResult, bridgeYearFilter)
    const baselineMin = minInvestableOver(ctx.baselineResult, bridgeYearFilter)
    if (candidateMin === null || baselineMin === null) return evaluation.deltas.endingAfterTaxEstate
    return candidateMin - baselineMin
  },
  tieBreaker: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
  constraintViolations: (evaluation) => [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)],
  secondaryMetrics: standardSecondaryMetrics,
}

/**
 * Convert a today's-dollars amount to nominal dollars at the plan's end year
 * under the deterministic inflation assumption. Projection balances (and
 * therefore `endingAfterTaxEstate`) are nominal, while user inputs like
 * spending and estate floors are today's dollars — comparisons must bring one
 * side to the other. Pass the plan the projection actually ran (the candidate
 * plan when the candidate's patch could change assumptions).
 */
export function nominalDollarsAtPlanEnd(
  todayDollars: number,
  plan: Plan,
  result: ProjectionResult,
): number {
  const inflationRate = plan.assumptions.inflationPct / 100
  const startYear = result.years[0]?.year ?? result.endYear
  return todayDollars * Math.pow(1 + inflationRate, result.endYear - startYear)
}

/** The annual base spending a candidate's patch sets, falling back to the plan's own. */
function candidateBaseAnnual(evaluation: ExactDecisionEvaluation, ctx: DecisionContext): number {
  const expenses = evaluation.candidate.planPatch?.['expenses']
  if (expenses && typeof expenses === 'object') {
    const baseAnnual = (expenses as Record<string, unknown>)['baseAnnual']
    if (typeof baseAnnual === 'number' && Number.isFinite(baseAnnual)) return baseAnnual
  }
  return ctx.plan.expenses.baseAnnual
}

/**
 * Maximize sustainable annual spending: rank by the base spending level a
 * candidate sets, disqualifying any candidate whose exact-ledger run depletes
 * or ends below the required after-tax estate floor. Unlike the money-lasts
 * delta guard, the depletion constraint here is absolute — "sustainable" means
 * the money lasts through the horizon, full stop. The floor is in today's
 * dollars (like `expenses.baseAnnual`) and is inflated to nominal end-of-plan
 * dollars before comparing against the nominal ending estate.
 */
export function makeMaximizeSustainableSpending(estateFloorTodayDollars = 0): ObjectivePolicy {
  return {
    id: 'max-sustainable-spending',
    label: 'Maximize sustainable spending',
    description:
      'Highest annual base spending whose full projection never depletes and keeps the after-tax estate at or above the floor.',
    primaryMetricLabel: 'Annual base spending (today’s dollars)',
    primaryMetric: candidateBaseAnnual,
    tieBreaker: (evaluation) => evaluation.deltas.endingAfterTaxEstate,
    constraintViolations: (evaluation, ctx) => {
      const violations = structuralViolations(evaluation)
      const depletionYear = evaluation.candidateResult.depletionYear
      if (depletionYear !== null) violations.push(`portfolio depletes in ${depletionYear}`)
      // Inflate the floor under the candidate plan's own assumptions — its
      // patch may change inflation, and the estate it produced is nominal.
      // A zero floor needs no inflating (or plan rebuild): it still rejects
      // a negative ending estate.
      let nominalFloor = 0
      if (estateFloorTodayDollars > 0) {
        const built = planForCandidate(ctx.plan, evaluation.candidate)
        const candidatePlan = built.ok ? built.plan : ctx.plan
        nominalFloor = nominalDollarsAtPlanEnd(estateFloorTodayDollars, candidatePlan, evaluation.candidateResult)
      }
      if (evaluation.candidateSummary.endingAfterTaxEstate < nominalFloor) {
        violations.push(
          `ending after-tax estate falls below the $${Math.round(estateFloorTodayDollars).toLocaleString()} floor (today's dollars)`,
        )
      }
      return violations
    },
    secondaryMetrics: standardSecondaryMetrics,
  }
}

export const maximizeSustainableSpending: ObjectivePolicy = makeMaximizeSustainableSpending()

export function makeMaximizeDownsideResilience(successTarget = 0.85): ObjectivePolicy {
  return {
    id: 'max-downside-resilience',
    label: 'Maximize downside resilience',
    description:
      `Opt-in robust ranking: highest 10th-percentile after-tax estate among candidates that keep Monte Carlo success at or above ${Math.round(successTarget * 100)}%.`,
    primaryMetricLabel: '10th-percentile after-tax estate delta',
    primaryMetric: (evaluation) => evaluation.stochastic?.deltas.p10EndingAfterTaxEstate ?? Number.NEGATIVE_INFINITY,
    tieBreaker: (evaluation) => evaluation.stochastic?.deltas.successRate ?? evaluation.deltas.endingAfterTaxEstate,
    constraintViolations: (evaluation) => {
      const violations = [...structuralViolations(evaluation), ...moneyLastsViolations(evaluation)]
      const stochastic = evaluation.stochastic?.candidate
      if (!stochastic) {
        violations.push('stochastic metrics unavailable for robust ranking')
        return violations
      }
      if (stochastic.successRate + 1e-9 < successTarget) {
        violations.push(`Monte Carlo success ${Math.round(stochastic.successRate * 100)}% is below the ${Math.round(successTarget * 100)}% robust target`)
      }
      return violations
    },
    secondaryMetrics: (evaluation) => [
      ...standardSecondaryMetrics(evaluation),
      { label: 'Monte Carlo success delta (pct pts)', value: centRound((evaluation.stochastic?.deltas.successRate ?? 0) * 100) },
      {
        label: 'Expected shortfall delta',
        value: centRound(evaluation.stochastic?.deltas.expectedShortfallDollars ?? 0),
      },
    ],
  }
}

export const maximizeDownsideResilience: ObjectivePolicy = makeMaximizeDownsideResilience()

export const objectivePolicies: Record<ObjectivePolicyId, ObjectivePolicy> = {
  'max-after-tax-estate': maximizeAfterTaxEstate,
  'max-spending-durability': maximizeSpendingDurability,
  'min-lifetime-tax-estate-floor': minimizeLifetimeTaxWithEstateFloor,
  'protect-survivor-liquidity': protectSurvivorLiquidity,
  'bridge-durability': improveBridgeDurability,
  'max-sustainable-spending': maximizeSustainableSpending,
  'max-downside-resilience': maximizeDownsideResilience,
}

/**
 * Resolve a policy id against a concrete plan: floor-style policies pick up
 * the plan's bequest target (`expenses.bequestTargetDollars`) so every surface
 * prices the same floor without re-plumbing it call site by call site.
 */
export function objectivePolicyForPlan(id: ObjectivePolicyId, plan: Plan): ObjectivePolicy {
  const bequestTarget = plan.expenses.bequestTargetDollars ?? 0
  if (bequestTarget > 0 && id === 'min-lifetime-tax-estate-floor') {
    return makeMinimizeLifetimeTaxWithEstateFloor(bequestTarget)
  }
  if (bequestTarget > 0 && id === 'max-sustainable-spending') {
    return makeMaximizeSustainableSpending(bequestTarget)
  }
  const survivorReserve = plan.strategies.survivorReserveTarget ?? 0
  if (survivorReserve > 0 && id === 'protect-survivor-liquidity') {
    return makeProtectSurvivorLiquidity(survivorReserve)
  }
  return objectivePolicies[id]
}
