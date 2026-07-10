/**
 * Live deterministic projection: memoized simulatePlan over the standard tax
 * stack (federal engine + flat state rate — same stack the Monte Carlo
 * workers use, see src/mc/runRequest.ts). Fast enough (<5 ms typical) to run
 * on every committed keystroke.
 */

import { useMemo } from 'react'

import type { Plan } from '../engine/model/plan'
import { summarizeProjection, type ProjectionSummary } from '../engine/projection/compare'
import { simulatePlan } from '../engine/projection/simulate'
import type { ProjectionResult } from '../engine/projection/types'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'

export function taxCalculatorFor(plan: Plan) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

export function currentStartYear(): number {
  return new Date().getFullYear()
}

export interface ProjectionView {
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  /** Divide a nominal amount in `year` by this to get today's dollars. */
  deflate: (year: number, amount: number) => number
}

export function projectPlan(plan: Plan, startYear = currentStartYear()): ProjectionView {
  const result = simulatePlan(plan, { startYear, taxCalculator: taxCalculatorFor(plan) })
  const summary = summarizeProjection(plan, result)
  const r = 1 + plan.assumptions.inflationPct / 100
  return {
    result,
    summary,
    startYear,
    deflate: (year, amount) => amount / Math.pow(r, year - startYear),
  }
}

export function useProjection(plan: Plan): ProjectionView {
  return useMemo(() => projectPlan(plan), [plan])
}

/** Stable Monte Carlo seed per plan (re-rollable in the UI). */
export function seedFromPlanId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
