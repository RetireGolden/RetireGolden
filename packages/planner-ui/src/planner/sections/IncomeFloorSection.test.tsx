/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { ImportAvailabilityProvider } from '../../import/ImportAvailabilityProvider'
import { STORAGE_KEYS } from '../../data/localStore'
import { PlanCtx } from '../planContextCore'
import { LivePricesCard } from './IncomeFloorSection'

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

function incomeFloorPlan(): Plan {
  const plan = createEmptyPlan({ newId: () => crypto.randomUUID() })
  plan.incomeFloor = {
    ladders: [{
      id: 'ladder-test',
      name: 'Test ladder',
      purpose: 'floor',
      startYear: new Date().getFullYear() + 1,
      endYear: new Date().getFullYear() + 2,
      annualRealAmount: 12_000,
    }],
  }
  return plan
}

describe('LivePricesCard cache recovery', () => {
  it('renders its cache-miss fallback when a structurally invalid snapshot is stored', async () => {
    localStorage.setItem(STORAGE_KEYS.fedInvestCache, JSON.stringify({
      priceDateIso: '2026-07-07',
      fetchedAtIso: '2026-07-08T12:00:00.000Z',
      source: 'fetch',
      tips: [{ cusip: '912828S50', ratePct: 0.125, endOfDayPrice: 100.03 }],
    }))
    const plan = incomeFloorPlan()

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <ImportAvailabilityProvider enabled>
              <LivePricesCard />
            </ImportAvailabilityProvider>
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    expect(container.textContent).toContain('Fetch live prices from Treasury FedInvest')
  })
})
