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
import { waitFor } from '../testSupport/settle'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

/** Honest workspace chrome for lifetimeTaxesAndPenalties (tax + penalties). */
const LIFETIME_TAX_KPI_SUB = 'nominal $ · tax + penalties'

/**
 * Character budget calibrated to the 10rem auto-fit minimum, not a jsdom
 * line-box measurement. At `.kpi-sub` 0.78rem, Chromium system-ui measured
 * this 27-character string at 153px; 10rem is 160px. The old 39-character
 * `nominal $ · federal + state + penalties` measured 219px and wrapped.
 */
const LIFETIME_TAX_KPI_SUB_MAX_CHARS = 27

describe('PlanWorkspace Lifetime tax KPI caption (#318)', () => {
  it('keeps the Lifetime tax title and the honest shortened workspace kpi-sub', async () => {
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

    const sub = lifetime.querySelector('.kpi-sub')?.textContent ?? ''
    expect(lifetime.querySelector('.kpi-label')?.textContent).toBe('Lifetime tax')
    expect(sub).toBe(LIFETIME_TAX_KPI_SUB)
    expect(sub.length).toBeLessThanOrEqual(LIFETIME_TAX_KPI_SUB_MAX_CHARS)

    await act(async () => root.unmount())
    container.remove()
  })
})
