/** @vitest-environment jsdom */
/**
 * Workspace chrome (#425, #430): the Enter rail keeps Assumptions active on
 * its Assumptions-card child route, and the standalone printable report names
 * its tab with plan + report context and gives each chart a text name.
 */
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { App } from '../App.tsx'
import type { PlanStore } from '../data/planStoreContext'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor, waitForText } from '../testSupport/settle'
import { LAZY_ROUTE_PRELOAD_TIMEOUT_MS, preloadLazyRoutes } from '../testSupport/lazyRoutes'

beforeAll(async () => {
  await preloadLazyRoutes('plan', 'assumptionsCard', 'report')
}, LAZY_ROUTE_PRELOAD_TIMEOUT_MS)

function storeFor(plan: ReturnType<typeof createSamplePlan>): PlanStore {
  return {
    listPlans: async () => [{ id: plan.id, name: plan.name, updatedAtIso: plan.updatedAtIso }],
    loadPlan: async (id) => (id === plan.id ? plan : null),
    savePlan: async () => undefined,
    deletePlan: async () => undefined,
  }
}

async function mountAt(path: string, store: PlanStore) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App planStore={store} />
      </MemoryRouter>,
    )
  })
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

describe('Workspace chrome', () => {
  it('keeps Assumptions the active rail item on /assumptions-card (#425)', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountAt(`/plan/${plan.id}/assumptions-card`, storeFor(plan))
    await waitForText(container, 'Assumptions card')
    const rail = container.querySelector('nav[aria-label="Plan sections"]')!
    const active = [...rail.querySelectorAll('a')].filter((a) => a.getAttribute('aria-current') === 'page')
    expect(active.map((a) => a.textContent)).toEqual(['Assumptions'])
    expect(active[0]!.className).toContain('rail-link--active')
    expect(active[0]!.getAttribute('href')).toBe(`/plan/${plan.id}/assumptions`)
    await unmount()
  })

  it('titles the report tab with plan + report context and names every chart (#430)', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountAt(`/plan/${plan.id}/report`, storeFor(plan))
    await waitForText(container, 'Retirement plan report')
    await waitFor(() => document.title === `${plan.name} · Report · RetireGolden`, { what: 'the report title' })
    const charts = [...container.querySelectorAll('.report-chart')]
    expect(charts).toHaveLength(3)
    for (const chart of charts) {
      const figure = chart.querySelector('[role="img"]')
      expect(figure?.getAttribute('aria-label'), chart.querySelector('h3')?.textContent ?? '').toMatch(/\S/)
    }
    await unmount()
    // Leaving the report restores the default title, like leaving the workspace.
    expect(document.title).toBe('RetireGolden')
  })
})
