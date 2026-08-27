/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanWorkspace } from './PlanWorkspace'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  throw new Error('Timed out waiting for expected render')
}

describe('PlanWorkspace Lifetime tax KPI caption (#318)', () => {
  it('keeps the Lifetime tax title and the shortened workspace kpi-sub without + penalties', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${sample.id}/household`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })

    await waitFor(() => {
      const bar = container.querySelector('[aria-label="Plan headline results"]')
      return Boolean(bar && !bar.classList.contains('kpi-bar--incomplete') && bar.querySelector('.kpi-label'))
    })

    const bar = container.querySelector('[aria-label="Plan headline results"]')
    if (!bar) throw new Error('headline KPI bar not rendered')
    const lifetime = Array.from(bar.querySelectorAll('.kpi')).find(
      (kpi) => kpi.querySelector('.kpi-label')?.textContent === 'Lifetime tax',
    )
    if (!lifetime) throw new Error('Lifetime tax KPI not rendered')

    expect(lifetime.querySelector('.kpi-label')?.textContent).toBe('Lifetime tax')
    expect(lifetime.querySelector('.kpi-sub')?.textContent).toBe('nominal $ · federal + state')
    expect(lifetime.querySelector('.kpi-sub')?.textContent).not.toMatch(/\+ penalties/)

    await act(async () => root.unmount())
    container.remove()
  })
})
