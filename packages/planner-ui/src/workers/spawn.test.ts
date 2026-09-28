import { afterEach, describe, expect, it, vi } from 'vitest'

import { runHistoricalStressSuiteViews, runMonteCarlo, runRiskBasedGuardrailSolve, runStochasticFrontiers } from '../mc/pool'
import { runOptimize } from '../optimize/runner'
import { runSpendingSolve } from '../optimize/spendingRunner'
import { optimizeErrorSentence, relocationErrorSentence } from '../planner/engineRefusalCopy'
import { buildModel } from '../planner/marketModelPicker'
import { runRelocationCompare } from '../relocation/runner'
import { createSamplePlan } from '../testSupport/samplePlan'
import { spawnPlannerWorker, WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from './spawn'

/**
 * A production build has no in-process fallback: the seven
 * `typeof Worker === 'undefined' && import.meta.env.DEV` guards compile to
 * `false`, so the main bundle does not carry the solvers the worker already
 * ships. Where `Worker` is missing, every runner must then fail through the
 * worker error path with the plain-words reason, never hang or fail silently.
 * `vi.stubEnv('DEV', false)` is the production build's view of those guards;
 * this suite's node environment has no `Worker`.
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

const START_YEAR = 2026

function productionBuild(): void {
  vi.stubEnv('DEV', false)
  expect(import.meta.env.DEV).toBe(false)
  expect(typeof Worker).toBe('undefined')
}

describe('spawnPlannerWorker without Worker', () => {
  it('throws the plain-words reason as a typed error', () => {
    expect(typeof Worker).toBe('undefined')
    expect(() => spawnPlannerWorker()).toThrow(WorkerUnavailableError)
    expect(() => spawnPlannerWorker()).toThrow(WORKER_UNAVAILABLE_MESSAGE)
  })
})

describe('a production build where Worker is unavailable', () => {
  const plan = createSamplePlan()
  const model = buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan)
  const mc = { startYear: START_YEAR, pathCount: 10, seed: 1, model }

  const runners: [string, () => Promise<unknown>][] = [
    ['runMonteCarlo', () => runMonteCarlo(plan, mc)],
    ['runRiskBasedGuardrailSolve', () => runRiskBasedGuardrailSolve(plan, mc)],
    ['runStochasticFrontiers', () => runStochasticFrontiers(plan, mc)],
    ['runHistoricalStressSuiteViews', () => runHistoricalStressSuiteViews(plan, { startYear: START_YEAR, equityWeightPct: 60 })],
    ['runOptimize', () => runOptimize({ plan, startYear: START_YEAR })],
    ['runSpendingSolve', () => runSpendingSolve({ plan, startYear: START_YEAR })],
    ['runRelocationCompare', () => runRelocationCompare({ plan, candidates: [{ state: 'FL' }], startYear: START_YEAR })],
  ]

  it.each(runners)('%s rejects with the reason instead of computing in-process', async (_name, run) => {
    productionBuild()
    const outcome = run()
    await expect(outcome).rejects.toBeInstanceOf(WorkerUnavailableError)
    await expect(outcome).rejects.toThrow(WORKER_UNAVAILABLE_MESSAGE)
  })

  it('shows the reason alone in the optimizer and relocation failure wells', () => {
    const error = new WorkerUnavailableError()
    expect(optimizeErrorSentence(error)).toBe(WORKER_UNAVAILABLE_MESSAGE)
    expect(relocationErrorSentence(error)).toBe(WORKER_UNAVAILABLE_MESSAGE)
  })

  it('still computes in-process in a development build (tests, the dev server)', async () => {
    expect(import.meta.env.DEV).toBe(true)
    const summary = await runMonteCarlo(plan, mc)
    expect(summary.pathCount).toBe(10)
  })
})
