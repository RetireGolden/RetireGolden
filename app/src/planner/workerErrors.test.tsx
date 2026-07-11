/** @vitest-environment jsdom */
/**
 * Worker-rejection error states: a failed worker job must surface a visible
 * error and reset its running flag instead of leaving a spinner or a silent
 * skeleton (MonteCarloPage run/frontiers/stress-suite, SsAnalysisPage
 * robustness check).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return {
    ...original,
    runMonteCarlo: vi.fn(original.runMonteCarlo),
    runStochasticFrontiers: vi.fn(original.runStochasticFrontiers),
    runHistoricalStressSuiteViews: vi.fn(original.runHistoricalStressSuiteViews),
  }
})

import * as pool from '../mc/pool'
import { MonteCarloPage } from './MonteCarloPage'
import { SsAnalysisPage } from './SsAnalysisPage'

const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)
const mockedFrontiers = vi.mocked(pool.runStochasticFrontiers)
const mockedHistorical = vi.mocked(pool.runHistoricalStressSuiteViews)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

async function mount(page: React.ReactNode, plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>{page}</PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

const flush = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

describe('MonteCarloPage worker failures', () => {
  it('renders an error banner and stops running when the auto-run rejects', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new Error('worker exploded')))
    await mount(<MonteCarloPage />, createSamplePlan())
    await flush(400) // past the 250 ms auto-run debounce
    expect(container.textContent).toContain('Simulation error: worker exploded')
    // The running progress bar is gone and no stale skeleton remains.
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    expect(container.querySelector('[aria-label="Simulating"]')).toBeNull()
    // Error recovery: the failed run offers a retry inside an alert region.
    const alert = container.querySelector('.error-recovery[role="alert"]')
    expect(alert).not.toBeNull()
    expect([...alert!.querySelectorAll('button')].some((b) => b.textContent === 'Run again')).toBe(true)
    await act(async () => root.unmount())
  })

  it('renders error banners for rejected frontier and stress-suite runs', async () => {
    // Let the main run succeed (real engine, few paths) so the frontier and
    // stress-suite cards render, then fail those two jobs.
    mockedRunMc.mockImplementation((plan, opts) => actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }))
    mockedFrontiers.mockImplementation(() => Promise.reject(new Error('frontier worker exploded')))
    mockedHistorical.mockImplementation(() => Promise.reject(new Error('stress worker exploded')))
    await mount(<MonteCarloPage />, createSamplePlan())
    await flush(400)

    const buttons = () => [...container.querySelectorAll('button')]
    const frontierBtn = buttons().find((b) => b.textContent?.includes('frontiers'))
    const stressBtn = buttons().find((b) => b.textContent?.includes('rolling/reversed'))
    expect(frontierBtn).toBeDefined()
    expect(stressBtn).toBeDefined()

    await act(async () => frontierBtn!.click())
    await flush(20)
    expect(container.textContent).toContain('Frontier run error: frontier worker exploded')
    expect(frontierBtn!.disabled).toBe(false)

    await act(async () => stressBtn!.click())
    await flush(20)
    expect(container.textContent).toContain('Stress suite error: stress worker exploded')
    expect(stressBtn!.disabled).toBe(false)
    await act(async () => root.unmount())
  })
})

describe('SsAnalysisPage robustness check failure', () => {
  it('renders an error and re-enables the button when Monte Carlo rejects', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new Error('worker exploded')))
    await mount(<SsAnalysisPage />, createSamplePlan())
    const button = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Check robustness'),
    )
    expect(button).toBeDefined()
    await act(async () => button!.click())
    await flush(20)
    expect(container.textContent).toContain('Robustness check error: worker exploded')
    expect(button!.disabled).toBe(false)
    await act(async () => root.unmount())
  })
})
