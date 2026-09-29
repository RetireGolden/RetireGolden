/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { ImportAvailabilityProvider } from '../../import/ImportAvailabilityProvider'
import { STORAGE_KEYS } from '../../data/localStore'
import { PlanCtx } from '../planContextCore'
import { FundedRatioCard, LivePricesCard } from './IncomeFloorSection'
import { appExamplePlanById } from '../../testSupport/appExamples'

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

describe('FundedRatioCard for a couple (D-PEOPLE-ORDER)', () => {
  async function cardText(plan: Plan): Promise<string> {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <FundedRatioCard />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    return container.textContent ?? ''
  }

  it('counts from the later retirement, names whose it is, calls the floor the household\'s, in either order', async () => {
    // survivor-years lists Lee (retires 2027) before Chris (retires 2025):
    // the count starts on Lee's retirement, the later one, whoever is first;
    // with and without a required floor, the card says so.
    for (const requiredAnnual of [40_000, undefined]) {
      const plan = appExamplePlanById('survivor-years')
      plan.expenses.requiredAnnual = requiredAnnual
      const listed = await cardText(plan)
      expect(listed).toContain("of your household's essential floor is funded by guaranteed income")
      expect(listed).toContain('Counted from 2027 (the year Lee retires, the later of your two retirements) through')
      const reversed = { ...structuredClone(plan), household: { ...plan.household, people: [...plan.household.people].reverse() } }
      expect(await cardText(reversed)).toBe(listed)
    }
  })
})
