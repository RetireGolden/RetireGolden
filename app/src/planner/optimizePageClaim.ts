/**
 * Claim-age co-optimization helpers for the Optimize page
 * (optimizer-exact-ledger-convergence Track 1, Step 5). Pure functions so the load-bearing apply contract is unit-testable
 * without rendering: when the co-optimizer recommends a claim change, the
 * returned conversion schedule was computed against the CLAIM-PATCHED plan, so
 * the claim change and the schedule must always be installed together —
 * conversions applied to the unpatched plan are a different (wrong) plan.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { ClaimAgeCoOptimization } from '@retiregolden/engine/projection/optimizePlan'

/** Exact-estate improvement of the joint optimum over the current-claim optimum. */
export function claimEstateGain(claimAge: ClaimAgeCoOptimization | null): number {
  if (!claimAge?.winningClaimPatch) return 0
  return claimAge.jointExactEstate - claimAge.currentClaimExactEstate
}

/**
 * The plan the recommendation was actually computed against: the current plan
 * with the winning claim change installed, or the plan itself when the current
 * claim ages won (or co-optimization did not run). Monte Carlo and the report
 * must consume this plan, never the unpatched one.
 *
 * ASSUMPTION: a claim patch touches ONLY `incomes`. That mirrors the engine's
 * capture (`winningPatch = { incomes: patchedPlan.incomes }` in
 * optimizePlanCoOptimizingClaimAge) and the `winningClaimPatch` wire type, but
 * the claim generator flows through the general `applyScenarioPatch`, so
 * nothing at compile time enforces it. If the engine ever widens the patch,
 * this helper AND `applyOptimizeRecommendation` below must widen with it (or
 * better: ship the engine's `optimizedPlan` across the worker boundary).
 */
export function planWithWinningClaim(plan: Plan, claimAge: ClaimAgeCoOptimization | null): Plan {
  if (!claimAge?.winningClaimPatch) return plan
  return { ...plan, incomes: claimAge.winningClaimPatch.incomes }
}

/**
 * Install the joint recommendation on a plan draft: the winning claim change
 * (when one won) and the conversion schedule, atomically. An empty conversions
 * list leaves the existing conversion strategy in place — that is the correct
 * joint recommendation when the incumbent schedule holds under the new claim.
 */
export function applyOptimizeRecommendation(
  draft: Plan,
  args: {
    claimAge: ClaimAgeCoOptimization | null
    conversions: { year: number; amount: number }[]
    mode: 'optimized' | 'manual'
    nowIso?: string
  },
): void {
  if (args.claimAge?.winningClaimPatch) draft.incomes = args.claimAge.winningClaimPatch.incomes
  if (args.conversions.length > 0) {
    draft.strategies.rothConversion =
      args.mode === 'manual'
        ? { mode: 'manual', conversions: args.conversions }
        : {
            mode: 'optimized',
            conversions: args.conversions,
            optimizedAtIso: args.nowIso ?? new Date().toISOString(),
          }
  }
}
