/**
 * Local search over the exact ledger (ledger-native decision engine, Phase 4).
 *
 * Coordinate descent on a Roth conversion schedule: one decision variable per
 * schedule year (the conversion amount), coarse dollar steps first, then a
 * smaller refinement pass. Every move is scored by running the mutated
 * schedule through the exact ledger and applying the objective policy — cheap
 * screens are never the final score. Deterministic under a fixed simulation
 * budget: fixed year order, fixed step order, and a hard cap on evaluations.
 */

import { evaluateCandidate, type EvaluateCandidateOptions } from './evaluateCandidate.js'
import { maximizeAfterTaxEstate, type ObjectivePolicy } from './objectives.js'
import type { DecisionCandidate, DecisionContext, ExactDecisionEvaluation } from './types.js'

export interface CoordinateDescentOptions {
  /** Hard cap on exact-ledger simulations (including the seed evaluation). */
  maxSimulations?: number
  /** First-pass step size in dollars. */
  coarseStepDollars?: number
  /** Refinement-pass step size in dollars. */
  fineStepDollars?: number
  /** Max full sweeps per step size. */
  maxSweepsPerStep?: number
  /** A move must beat the incumbent primary metric by more than this. */
  minimumImprovement?: number
  policy?: ObjectivePolicy
  evaluation?: EvaluateCandidateOptions
  /** Base plan patch every mutated schedule is applied on top of. */
  basePatch?: Record<string, unknown>
}

export interface CoordinateDescentResult {
  bestConversions: Array<{ year: number; amount: number }>
  bestEvaluation: ExactDecisionEvaluation
  /** True when search found a strictly better schedule than the seed. */
  improved: boolean
  simulationCount: number
  /** Full sweeps performed across both step sizes. */
  sweepCount: number
}

const DEFAULT_MAX_SIMULATIONS = 48
const DEFAULT_COARSE_STEP = 10_000
const DEFAULT_FINE_STEP = 2_500
const DEFAULT_MAX_SWEEPS_PER_STEP = 3
const DEFAULT_MINIMUM_IMPROVEMENT = 1
/** Extra coordinate years past the seed's last conversion (taper discovery). */
const TAPER_EXTENSION_YEARS = 8

function normalizeSchedule(conversions: Array<{ year: number; amount: number }>): Array<{ year: number; amount: number }> {
  return conversions
    .map((c) => ({ year: c.year, amount: Math.round(c.amount * 100) / 100 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => a.year - b.year)
}

/**
 * Refine a conversion schedule by coordinate descent, keeping only moves the
 * exact ledger prices as improvements under the policy's primary metric and
 * hard constraints. Returns the seed evaluation unchanged when nothing beats it
 * within the budget.
 */
export function refineConversionSchedule(
  ctx: DecisionContext,
  seedConversions: Array<{ year: number; amount: number }>,
  options: CoordinateDescentOptions = {},
): CoordinateDescentResult {
  const policy = options.policy ?? maximizeAfterTaxEstate
  const maxSimulations = options.maxSimulations ?? DEFAULT_MAX_SIMULATIONS
  const coarseStep = options.coarseStepDollars ?? DEFAULT_COARSE_STEP
  const fineStep = options.fineStepDollars ?? DEFAULT_FINE_STEP
  const maxSweepsPerStep = options.maxSweepsPerStep ?? DEFAULT_MAX_SWEEPS_PER_STEP
  const minimumImprovement = options.minimumImprovement ?? DEFAULT_MINIMUM_IMPROVEMENT

  let simulationCount = 0
  let sweepCount = 0

  const makeCandidate = (conversions: Array<{ year: number; amount: number }>, moveId: string): DecisionCandidate => ({
    id: `search-${moveId}`,
    source: 'search',
    category: 'roth',
    label: 'Locally refined conversion schedule',
    explanation: 'Coordinate-descent mutation of the incumbent schedule, priced on the exact ledger.',
    planPatch: options.basePatch,
    conversions,
  })

  const evaluate = (conversions: Array<{ year: number; amount: number }>, moveId: string): ExactDecisionEvaluation => {
    simulationCount++
    return evaluateCandidate(ctx, makeCandidate(conversions, moveId), options.evaluation)
  }

  let bestConversions = normalizeSchedule(seedConversions)
  let bestEvaluation = evaluate(bestConversions, 'seed')
  let bestScore = policy.primaryMetric(bestEvaluation, ctx)
  let improved = false

  // Coordinate set: the seed's years plus a bounded extension past the last
  // seed year. Mutating only seed years can never ADD a conversion year, which
  // locks out taper shapes ("fill hard until RMDs, then convert smaller
  // amounts") — the years after a windowed fill ends are exactly where those
  // live. Bounded and deterministic: at most `TAPER_EXTENSION_YEARS` extra
  // coordinates, in ascending year order.
  const seedYears = bestConversions.map((c) => c.year)
  const lastSeedYear = seedYears.length > 0 ? seedYears[seedYears.length - 1]! : ctx.baselineResult.startYear - 1
  const extensionYears = ctx.baselineResult.years
    .map((year) => year.year)
    .filter((year) => year > lastSeedYear)
    .slice(0, TAPER_EXTENSION_YEARS)
  const years = [...seedYears, ...extensionYears]
  const steps = coarseStep === fineStep ? [coarseStep] : [coarseStep, fineStep]

  for (const step of steps) {
    for (let sweep = 0; sweep < maxSweepsPerStep; sweep++) {
      if (simulationCount >= maxSimulations) break
      sweepCount++
      let sweepImproved = false
      for (const year of years) {
        for (const direction of [1, -1]) {
          if (simulationCount >= maxSimulations) break
          const current = bestConversions.find((c) => c.year === year)?.amount ?? 0
          const mutated = Math.max(0, current + direction * step)
          if (mutated === current) continue
          const candidateConversions = normalizeSchedule([
            ...bestConversions.filter((c) => c.year !== year),
            { year, amount: mutated },
          ])
          if (candidateConversions.length === 0) continue
          const evaluation = evaluate(candidateConversions, `${year}-${direction > 0 ? 'up' : 'down'}-${step}`)
          if (policy.constraintViolations(evaluation, ctx).length > 0) continue
          const score = policy.primaryMetric(evaluation, ctx)
          if (score > bestScore + minimumImprovement) {
            bestConversions = candidateConversions
            bestEvaluation = evaluation
            bestScore = score
            sweepImproved = true
            improved = true
          }
        }
      }
      if (!sweepImproved) break
    }
  }

  return { bestConversions, bestEvaluation, improved, simulationCount, sweepCount }
}
