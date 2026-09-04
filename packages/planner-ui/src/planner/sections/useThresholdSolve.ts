/**
 * The risk-based guardrail policy's on-demand dollar-threshold solve.
 *
 * Its own module because the band fields and the solved-threshold callout sit
 * in different parents (`SpendingPolicyRiskBased.tsx`), so the card holds this
 * state and hands it to both halves. Extracted from `SpendingSection.tsx`
 * unchanged.
 */

import { useEffect, useRef, useState } from 'react'

import { type RiskBasedGuardrailSolution } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'

import { runRiskBasedGuardrailSolve } from '../../mc/pool'
import { usePlan } from '../planContextCore'
import { buildModel } from '../marketModelPicker'
import { currentStartYear, seedFromPlanId } from '../useProjection'

/** Solver budget for the on-demand threshold solve (worker; ~40 probes). */
const THRESHOLD_SOLVE_PATH_COUNT = 200

export interface ThresholdSolve {
  readonly solving: boolean
  readonly error: string | null
  readonly solution: RiskBasedGuardrailSolution | null
  readonly solve: () => void
  /** Forget the solved thresholds: they belonged to the band that just changed. */
  readonly clear: () => void
}

/** The on-demand dollar-threshold solve, shared by the band fields and the callout. */
export function useThresholdSolve(): ThresholdSolve {
  const { plan, update } = usePlan()
  const e = plan.expenses
  const [solving, setSolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [solution, setSolution] = useState<RiskBasedGuardrailSolution | null>(null)
  // Latest committed band, readable from async solve callbacks: a solve result
  // computed against an older band (edited while the worker was busy) is
  // discarded instead of persisted.
  const committedBandRef = useRef({ mode: e.spendingPolicy?.mode, lower: 70, upper: 95 })
  useEffect(() => {
    committedBandRef.current = {
      mode: e.spendingPolicy?.mode,
      lower: e.spendingPolicy?.targetSuccessLowerPct ?? 70,
      upper: e.spendingPolicy?.targetSuccessUpperPct ?? 95,
    }
  })
  const solve = () => {
    setSolving(true)
    setError(null)
    const solvedBand = { ...committedBandRef.current }
    void runRiskBasedGuardrailSolve(plan, {
      startYear: currentStartYear(),
      pathCount: THRESHOLD_SOLVE_PATH_COUNT,
      seed: seedFromPlanId(plan.id),
      model: buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan),
    })
      .then((solved) => {
        const current = committedBandRef.current
        if (current.mode !== 'riskBasedGuardrails' || current.lower !== solvedBand.lower || current.upper !== solvedBand.upper) {
          return // the band (or mode) changed mid-solve; the result no longer applies
        }
        setSolution(solved)
        update((d) => {
          const policy = d.expenses.spendingPolicy
          if (!policy || policy.mode !== 'riskBasedGuardrails') return
          if (solved.lower) policy.lowerBalanceThresholdPct = Math.round(solved.lower.balanceFrac * 10_000) / 100
          else delete policy.lowerBalanceThresholdPct
          if (solved.upper) policy.upperBalanceThresholdPct = Math.round(solved.upper.balanceFrac * 10_000) / 100
          else delete policy.upperBalanceThresholdPct
        })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSolving(false))
  }
  return { solving, error, solution, solve, clear: () => setSolution(null) }
}
