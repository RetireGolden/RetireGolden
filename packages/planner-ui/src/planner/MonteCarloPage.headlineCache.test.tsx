/** @vitest-environment jsdom */
/**
 * Monte Carlo page and the headline store agree (#497 review): after a run
 * has been published for a plan object, mounting the page under the headline
 * configuration shows that run (its gauge caption carries its path count) and
 * starts no fresh default run, so the KPI bar and the gauge can never quote
 * two different runs. A re-rolled seed is a different simulation and runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { MonteCarloPage } from './MonteCarloPage'
import { buildModel } from './marketModelPicker'
import { currentStartYear, seedFromPlanId } from './useProjection'
import { HEADLINE_MC_MODEL, publishMcHeadline } from './useMcSuccessRate'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn(original.runMonteCarlo) }
})

import * as pool from '../mc/pool'
const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

async function mount(plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>
          <MonteCarloPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400)) // past the 250 ms auto-run debounce
  })
}

describe('MonteCarloPage adopts the published headline run (#497)', () => {
  it('shows the published run and starts no default run when mounted on the headline configuration', async () => {
    const plan = createSamplePlan()
    // A real, tiny summary under the headline configuration stands in for a 10,000-path run.
    const model = buildModel(HEADLINE_MC_MODEL.kind, plan.assumptions.inflationPct, HEADLINE_MC_MODEL.returnVolPct, HEADLINE_MC_MODEL.equityWeightPct, plan)
    const published = await actualPool.runMonteCarlo(plan, { startYear: currentStartYear(), pathCount: 8, seed: seedFromPlanId(plan.id), model })
    publishMcHeadline(plan, published)
    mockedRunMc.mockClear()

    await mount(plan)
    await waitFor(() => container.querySelector('.success-gauge') !== null, { what: 'the gauge' })
    expect(mockedRunMc).not.toHaveBeenCalled()
    expect(container.querySelector('.success-gauge-caption')?.textContent).toBe('8 paths')
    expect(container.textContent).toContain('same plan 8 times')
  })

  it('runs a fresh default simulation when nothing is published for this plan object', async () => {
    const plan = createSamplePlan()
    mockedRunMc.mockImplementation((p, opts) => actualPool.runMonteCarlo(p, { ...opts, pathCount: 8 }))
    await mount(plan)
    await waitFor(() => container.querySelector('.success-gauge') !== null, { what: 'the gauge' })
    expect(mockedRunMc).toHaveBeenCalledTimes(1)
  })
})
