/** @vitest-environment jsdom */
/**
 * Step 1 (UI/UX round 2): every async state change a sighted user sees, a
 * screen-reader user hears. Asserts Monte Carlo run/complete/error, home-page
 * notices, and insight dismissal render into role="status"/role="alert" live
 * regions, and that the status line latches (no re-announce on unrelated
 * re-renders).
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '../engine/model/plan'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { buildModel } from './marketModelPicker'
import { LiveStatus } from './LiveStatus'

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn(original.runMonteCarlo) }
})

import * as pool from '../mc/pool'
import { MonteCarloPage } from './MonteCarloPage'
import { InsightsPage } from './insights/InsightsPage'
import { PlanPickerPage } from './PlanPickerPage'

const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
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

const flush = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

async function mountWithPlan(page: React.ReactNode, plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>{page}</PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

const statusRegion = () => container.querySelector('[role="status"]')
const alertRegion = () => container.querySelector('[role="alert"]')

describe('LiveStatus', () => {
  it('renders a polite status region by default and an assertive alert when asked', async () => {
    await act(async () => root.render(<LiveStatus message="hello" />))
    const region = container.querySelector('[role="status"]')!
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.classList.contains('sr-only')).toBe(true)
    expect(region.textContent).toBe('hello')

    await act(async () => root.render(<LiveStatus message="boom" assertive />))
    const alert = container.querySelector('[role="alert"]')!
    expect(alert.getAttribute('aria-live')).toBe('assertive')
    expect(alert.textContent).toBe('boom')
  })
})

describe('Monte Carlo announcements', () => {
  it('announces completion into a polite status region', async () => {
    mockedRunMc.mockImplementation((plan, opts) => actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }))
    await mountWithPlan(<MonteCarloPage />, createSamplePlan())
    await flush(400) // past the 250 ms auto-run debounce
    const region = statusRegion()!
    expect(region).not.toBeNull()
    expect(region.textContent).toMatch(/Simulation complete\. \d+ percent of markets sustain the plan\./)
  })

  it('announces a failed run into an assertive alert region', async () => {
    mockedRunMc.mockImplementation(() => Promise.reject(new Error('worker exploded')))
    await mountWithPlan(<MonteCarloPage />, createSamplePlan())
    await flush(400)
    const alert = alertRegion()!
    expect(alert).not.toBeNull()
    expect(alert.textContent).toContain('Simulation error: worker exploded')
    // The completed-run message must not linger after an error.
    expect(statusRegion()?.textContent ?? '').not.toContain('Simulation complete')
  })

  it('latches the status line: a re-render with the same summary does not change the announced text', async () => {
    let resolveRun!: (v: Awaited<ReturnType<typeof actualPool.runMonteCarlo>>) => void
    mockedRunMc.mockImplementation(
      () => new Promise((res) => { resolveRun = res as typeof resolveRun }),
    )
    const plan = createSamplePlan()
    await mountWithPlan(<MonteCarloPage />, plan)
    await flush(300)
    // Mid-run: the status announces the run start, not a stale completion.
    expect(statusRegion()?.textContent).toMatch(/Simulating .* market paths…/)
    const latchPlan = createSamplePlan()
    const summary = await actualPool.runMonteCarlo(latchPlan, {
      startYear: 2026,
      pathCount: 8,
      seed: 1,
      model: buildModel('lognormal', latchPlan.assumptions.inflationPct, 12, 60, latchPlan),
      stochasticLongevity: false,
      ltcShock: null,
    })
    await act(async () => resolveRun(summary))
    const first = statusRegion()?.textContent
    expect(first).toContain('Simulation complete')
    // Force a REAL top-down re-render (root.render with the same tree makes
    // React re-render every component); the latched message stays identical.
    await mountWithPlan(<MonteCarloPage />, plan)
    await flush(50)
    expect(statusRegion()?.textContent).toBe(first)
  })
})

describe('home-page notices', () => {
  it('keeps a persistent status region so notices are announced', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<PlanPickerPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await flush(60)
    // The live region exists before any notice text is inserted (so screen
    // readers announce the change rather than miss a late-mounted region).
    expect(statusRegion()).not.toBeNull()
  })
})

describe('insight dismissal announcements', () => {
  it('announces when a recommendation is dismissed', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')
    await mountWithPlan(<InsightsPage />, sample)
    await flush(60)
    const dismissBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Dismiss this recommendation',
    )
    expect(dismissBtn, 'sample plan should surface at least one dismissable insight').toBeDefined()
    await act(async () => dismissBtn!.click())
    expect(statusRegion()?.textContent).toContain('Insight dismissed')
  })
})
