/** @vitest-environment jsdom */
/**
 * Social Security Optimizer empty state (#427): with no benefit modeled, the
 * card links to the Social Security entry form instead of leaving the reader
 * to find it in the rail.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createSamplePlan } from '../testSupport/samplePlan'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SsAnalysisPage empty state (#427)', () => {
  it('links to the Social Security entry form when no benefit is modeled', async () => {
    const plan = createSamplePlan()
    plan.incomes = plan.incomes.filter((income) => income.type !== 'socialSecurity')
    const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={value}>
            <SsAnalysisPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    const empty = container.querySelector('.empty-state')!
    expect(empty.textContent).toContain('No Social Security to analyze yet')
    const cta = empty.querySelector('a')!
    expect(cta.getAttribute('href')).toBe(`/plan/${plan.id}/social-security`)
    expect(cta.textContent).toBe('Add a Social Security benefit')
    expect(cta.className).toContain('btn')
  })
})
