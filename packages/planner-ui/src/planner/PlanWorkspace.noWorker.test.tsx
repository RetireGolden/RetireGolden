/** @vitest-environment jsdom */
/**
 * The workspace KPI bar in a production build without Worker. The headline
 * Monte Carlo run fails through the worker error path (../workers/spawn.ts),
 * and the "Market success" tile must say why instead of "open Monte Carlo to
 * retry": running again cannot help there. `vi.stubEnv('DEV', false)` is the
 * production build's view of the runners' in-process guards; jsdom has no
 * Worker. Runs the real useMcSuccessRateState, not a stub.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { WORKER_UNAVAILABLE_MESSAGE } from '../workers/spawn'
import { PlanWorkspace } from './PlanWorkspace'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the Market success KPI without Worker', () => {
  it('names the reason instead of "open Monte Carlo to retry"', async () => {
    vi.stubEnv('DEV', false)
    expect(typeof Worker).toBe('undefined')
    const plan = createSamplePlan()
    const saved = await savePlan(plan)
    if (!saved.ok) throw new Error('seed save failed')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${plan.id}/household`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    const tile = () =>
      [...container.querySelectorAll('[aria-label="Plan headline results"] .kpi')].find(
        (kpi) => kpi.querySelector('.kpi-label')?.textContent === 'Market success',
      )
    await waitFor(() => tile()?.querySelector('.kpi-sub')?.textContent?.startsWith('simulation unavailable') ?? false, {
      what: 'the failed Market success tile',
    })
    const kpi = tile()!
    expect(kpi.querySelector('.kpi-sub')!.textContent).toBe("simulation unavailable · this browser can't run it")
    const link = kpi.querySelector('a.kpi-value')!
    expect(link.getAttribute('aria-label')).toBe(`Simulation unavailable. ${WORKER_UNAVAILABLE_MESSAGE}`)
    expect(link.getAttribute('title')).toBe(WORKER_UNAVAILABLE_MESSAGE)
    expect(kpi.textContent).not.toMatch(/retry/)
    await act(async () => root.unmount())
    container.remove()
  })
})
