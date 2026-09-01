/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEYS } from '../../data/localStore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { PlanCtx } from '../planContextCore'
import { InsightsPage } from './InsightsPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('InsightsPage dismissed-insights recovery', () => {
  it.each([
    'not json',
    JSON.stringify(null),
    JSON.stringify([]),
  ])('renders with an empty dismissed map for corrupt or structurally invalid storage: %s', async (stored) => {
    const plan = createSamplePlan()
    localStorage.setItem(STORAGE_KEYS.insightsDismissed, stored)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <InsightsPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Insights')
    expect(container.textContent).not.toContain('Restore dismissed insights')
  })

  it('rejects an invalid dismissed array for the rendered plan', async () => {
    const plan = createSamplePlan()
    localStorage.setItem(STORAGE_KEYS.insightsDismissed, JSON.stringify({ [plan.id]: [null] }))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <InsightsPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    expect(container.textContent).not.toContain('Restore dismissed insights')
  })

  it('keeps a valid dismissed array for the rendered plan', async () => {
    const plan = createSamplePlan()
    localStorage.setItem(STORAGE_KEYS.insightsDismissed, JSON.stringify({ [plan.id]: ['card-1'] }))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <InsightsPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Restore dismissed insights')
  })
})
