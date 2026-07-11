/**
 * Generalized exact-ledger tournament (ledger-native decision engine, Phase 3).
 *
 * 1. gather candidates from the selected generators,
 * 2. dedupe candidates with equivalent patches/schedules,
 * 3. evaluate each through the exact ledger,
 * 4. rank by the objective policy's primary metric and hard constraints,
 * 5. return the ranked field, the winner, and why each loser lost.
 *
 * Deterministic: generation order, dedupe (first occurrence wins), stable
 * ranking with candidate-id tie-breaks, and a fixed evaluation bound.
 */

import { evaluateCandidate, type EvaluateCandidateOptions } from './evaluateCandidate.js'
import { maximizeAfterTaxEstate, type ObjectivePolicy } from './objectives.js'
import type { CandidateGenerator, DecisionCandidate, DecisionContext, ExactDecisionEvaluation } from './types.js'

/** Stable stringify: object keys sorted recursively so patch key order never matters. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

/** Equivalence key for a candidate's concrete change (patch + normalized schedule). */
export function candidateEquivalenceKey(candidate: DecisionCandidate): string {
  const conversions = candidate.conversions
    ? [...candidate.conversions]
        .map((c) => ({ year: c.year, amount: Math.round(c.amount * 100) / 100 }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => a.year - b.year)
    : null
  return canonicalJson({ patch: candidate.planPatch ?? null, conversions })
}

/** Drop candidates whose patch/schedule is equivalent to an earlier one (first wins). */
export function dedupeCandidates(candidates: DecisionCandidate[]): DecisionCandidate[] {
  const seen = new Set<string>()
  const unique: DecisionCandidate[] = []
  for (const candidate of candidates) {
    const key = candidateEquivalenceKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(candidate)
  }
  return unique
}

export interface RankedDecision {
  evaluation: ExactDecisionEvaluation
  /** Policy primary metric (higher is better). */
  primaryValue: number
  /** Hard-constraint violations; non-empty ⇒ ineligible to win. */
  constraintViolations: string[]
  eligible: boolean
  /** Why this candidate is not the recommendation (null for the winner). */
  lossReason: string | null
}

export interface DecisionTournamentResult {
  policyId: ObjectivePolicy['id']
  /** Every evaluated candidate, best first (ineligible candidates rank below eligible ones). */
  ranked: RankedDecision[]
  /** Best eligible candidate that actually improves the primary metric, or null. */
  winner: RankedDecision | null
  /** Exact-ledger simulations spent (one per unique candidate). */
  simulationCount: number
}

export interface DecisionTournamentOptions {
  policy?: ObjectivePolicy
  /** Safety bound on exact evaluations; candidates beyond it are dropped deterministically. */
  maxCandidates?: number
  /** Minimum primary-metric improvement before anything is recommended. */
  minimumImprovement?: number
  evaluation?: EvaluateCandidateOptions
}

const DEFAULT_MAX_CANDIDATES = 32
const DEFAULT_MINIMUM_IMPROVEMENT = 1

/** Rank pre-computed evaluations under a policy (shared by tournament and tests). */
export function rankEvaluations(
  evaluations: ExactDecisionEvaluation[],
  ctx: DecisionContext,
  policy: ObjectivePolicy = maximizeAfterTaxEstate,
  minimumImprovement: number = DEFAULT_MINIMUM_IMPROVEMENT,
): { ranked: RankedDecision[]; winner: RankedDecision | null } {
  const rows = evaluations.map((evaluation) => {
    const constraintViolations = policy.constraintViolations(evaluation, ctx)
    return {
      evaluation,
      primaryValue: policy.primaryMetric(evaluation, ctx),
      constraintViolations,
      eligible: constraintViolations.length === 0,
      lossReason: null as string | null,
    }
  })

  const tieBreak = (row: RankedDecision) =>
    policy.tieBreaker ? policy.tieBreaker(row.evaluation, ctx) : row.evaluation.deltas.endingAfterTaxEstate
  rows.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    if (a.primaryValue !== b.primaryValue) return b.primaryValue - a.primaryValue
    const tie = tieBreak(b) - tieBreak(a)
    if (tie !== 0) return tie
    return a.evaluation.candidate.id < b.evaluation.candidate.id ? -1 : 1
  })

  const winner = rows.find((row) => row.eligible && row.primaryValue > minimumImprovement) ?? null
  for (const row of rows) {
    if (row === winner) continue
    if (!row.eligible) {
      row.lossReason = `violates ${policy.label.toLowerCase()} constraints: ${row.constraintViolations.join('; ')}`
    } else if (winner) {
      row.lossReason = `${policy.primaryMetricLabel} trails the winner by ${Math.round(winner.primaryValue - row.primaryValue).toLocaleString()}`
    } else {
      row.lossReason = `${policy.primaryMetricLabel} does not improve on the current plan`
    }
  }
  return { ranked: rows, winner }
}

/** Gather → dedupe → exact-evaluate → rank. */
export function runDecisionTournament(
  ctx: DecisionContext,
  generators: CandidateGenerator[],
  options: DecisionTournamentOptions = {},
): DecisionTournamentResult {
  const policy = options.policy ?? maximizeAfterTaxEstate
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES
  const minimumImprovement = options.minimumImprovement ?? DEFAULT_MINIMUM_IMPROVEMENT

  const gathered: DecisionCandidate[] = []
  for (const generator of generators) gathered.push(...generator.generate(ctx))
  const unique = dedupeCandidates(gathered).slice(0, maxCandidates)

  const evaluations = unique.map((candidate) => evaluateCandidate(ctx, candidate, options.evaluation))
  const { ranked, winner } = rankEvaluations(evaluations, ctx, policy, minimumImprovement)
  return { policyId: policy.id, ranked, winner, simulationCount: evaluations.length }
}
