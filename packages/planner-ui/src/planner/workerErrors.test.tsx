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
import { MemoryRouter } from 'react-router'

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
import { advanceBy } from '../testSupport/settle'
import { WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from '../workers/spawn'

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

describe('MonteCarloPage worker failures', () => {
  it('renders an error banner and stops running when the auto-run rejects', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new Error('worker exploded')))
    await mount(<MonteCarloPage />, createSamplePlan())
    await advanceBy(400) // past the 250 ms auto-run debounce
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
    await advanceBy(400)

    const buttons = () => [...container.querySelectorAll('button')]
    const frontierBtn = buttons().find((b) => b.textContent?.includes('frontiers'))
    const stressBtn = buttons().find((b) => b.textContent?.includes('rolling/reversed'))
    expect(frontierBtn).toBeDefined()
    expect(stressBtn).toBeDefined()

    await act(async () => frontierBtn!.click())
    await advanceBy(20)
    expect(container.textContent).toContain('Frontier run error: frontier worker exploded')
    expect(frontierBtn!.disabled).toBe(false)

    await act(async () => stressBtn!.click())
    await advanceBy(20)
    expect(container.textContent).toContain('Stress suite error: stress worker exploded')
    expect(stressBtn!.disabled).toBe(false)
    await act(async () => root.unmount())
  })
})

describe('MonteCarloPage in a production build without Worker', () => {
  it('shows the plain-words reason instead of computing on the main thread', async () => {
    // A production build compiles the in-process path out
    // (typeof Worker === 'undefined' && import.meta.env.DEV); jsdom has no Worker.
    vi.stubEnv('DEV', false)
    try {
      mockedRunMc.mockImplementation(actualPool.runMonteCarlo)
      await mount(<MonteCarloPage />, createSamplePlan())
      await advanceBy(400)
      expect(container.textContent).toContain(`Simulation error: ${WORKER_UNAVAILABLE_MESSAGE}`)
      expect(container.querySelector('[role="progressbar"]')).toBeNull()
      const alert = container.querySelector('.error-recovery[role="alert"]')
      expect(alert).not.toBeNull()
      // Running again cannot help without a Worker, so the well offers no retry.
      expect(runAgainButtons(alert!)).toHaveLength(0)
      await act(async () => root.unmount())
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('shows the reason with no "Run again" in the frontier and stress-suite wells', async () => {
    mockedRunMc.mockImplementation((plan, opts) => actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }))
    mockedFrontiers.mockImplementation(() => Promise.reject(new WorkerUnavailableError()))
    mockedHistorical.mockImplementation(() => Promise.reject(new WorkerUnavailableError()))
    await mount(<MonteCarloPage />, createSamplePlan())
    await advanceBy(400)
    const buttons = () => [...container.querySelectorAll('button')]
    await act(async () => buttons().find((b) => b.textContent?.includes('frontiers'))!.click())
    await advanceBy(20)
    await act(async () => buttons().find((b) => b.textContent?.includes('rolling/reversed'))!.click())
    await advanceBy(20)
    expect(container.textContent).toContain(`Frontier run error: ${WORKER_UNAVAILABLE_MESSAGE}`)
    expect(container.textContent).toContain(`Stress suite error: ${WORKER_UNAVAILABLE_MESSAGE}`)
    const alerts = [...container.querySelectorAll('.error-recovery[role="alert"]')]
    expect(alerts).toHaveLength(2)
    for (const alert of alerts) expect(runAgainButtons(alert)).toHaveLength(0)
    await act(async () => root.unmount())
  })
})

describe('SsAnalysisPage bridge comparison without Worker', () => {
  it('shows the no-Worker reason', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new WorkerUnavailableError()))
    await mount(<SsAnalysisPage />, createSamplePlan())
    await advanceBy(400)
    const compare = [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Compare vs claiming'))
    expect(compare, 'the bridge comparison button').toBeDefined()
    await act(async () => compare!.click())
    await advanceBy(20)
    expect(container.querySelector('p.card-hint[role="alert"]')?.textContent).toBe(WORKER_UNAVAILABLE_MESSAGE)
    await act(async () => root.unmount())
  })
})

function runAgainButtons(scope: Element): HTMLButtonElement[] {
  return [...scope.querySelectorAll('button')].filter((b) => b.textContent === 'Run again')
}

describe('SsAnalysisPage robustness check failure', () => {
  it('renders an error and re-enables the button when Monte Carlo rejects', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new Error('worker exploded')))
    // The check is offered only on a ranking the page stands behind (B2-P1
    // slice 5 review, L6). The sample plan's Marketplace credit is unpriced
    // from 2028, which refuses the ranking; without the credit it ranks.
    const plan = createSamplePlan()
    plan.expenses.healthcare = { ...plan.expenses.healthcare, applyAcaCredit: false }
    await mount(<SsAnalysisPage />, plan)
    // The claim-age sweep is debounced 200 ms off the render path; the
    // robustness button only exists once it has settled.
    await advanceBy(400)
    const button = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Check robustness'),
    )
    expect(button).toBeDefined()
    await act(async () => button!.click())
    await advanceBy(20)
    expect(container.textContent).toContain('Robustness check error: worker exploded')
    expect(button!.disabled).toBe(false)
    await act(async () => root.unmount())
  })

  it('shows the no-Worker reason with no "Run again"', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new WorkerUnavailableError()))
    const plan = createSamplePlan()
    plan.expenses.healthcare = { ...plan.expenses.healthcare, applyAcaCredit: false }
    await mount(<SsAnalysisPage />, plan)
    await advanceBy(400)
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Check robustness'))
    await act(async () => button!.click())
    await advanceBy(20)
    expect(container.textContent).toContain(`Robustness check error: ${WORKER_UNAVAILABLE_MESSAGE}`)
    const alert = container.querySelector('.error-recovery[role="alert"]')
    expect(alert).not.toBeNull()
    expect(runAgainButtons(alert!)).toHaveLength(0)
    await act(async () => root.unmount())
  })
})
