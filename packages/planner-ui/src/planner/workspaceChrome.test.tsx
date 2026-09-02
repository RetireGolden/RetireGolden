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

  it('renders not-found chrome inside the workspace for an unknown section segment (#464)', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountAt(`/plan/${plan.id}/healthcare`, storeFor(plan))
    await waitForText(container, 'This plan has no such section')
    // The shell stays up: rail, breadcrumb, and a way back into the plan.
    expect(container.querySelector('nav[aria-label="Plan sections"]')).not.toBeNull()
    const back = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Go to Household')
    expect(back?.getAttribute('href')).toBe(`/plan/${plan.id}/household`)
    // No skeleton left pretending to load.
    expect(container.querySelector('#plan-content .skeleton')).toBeNull()
    await unmount()
  })

  it('narrows the shell to each reading page\'s own measure, and not on the home routes (#443)', async () => {
    const plan = createSamplePlan()
    for (const [path, expected] of [
      ['/learn', 'app-shell--reading'],
      ['/disclaimer', 'app-shell--reading'],
      ['/how-tested', 'app-shell--reading'],
      ['/learn/glossary', 'app-shell--reading-narrow'],
      ['/learn/sources', 'app-shell--reading-narrow'],
      ['/', null],
      ['/examples', null],
    ] as const) {
      const { container, unmount } = await mountAt(path, storeFor(plan))
      const shell = container.querySelector('.app-shell')!
      const reading = [...shell.classList].filter((c) => c.startsWith('app-shell--reading'))
      expect(reading, `${path} shell classes`).toEqual(expected ? [expected] : [])
      await unmount()
    }
  })

  it('renders not-found chrome for an unmatched site URL instead of a blank main (#442)', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountAt('/zzz-not-a-route', storeFor(plan))
    await waitForText(container, 'Page not found')
    const main = container.querySelector('main')!
    // Page-level heading, so heading navigation lands on it.
    expect(main.querySelector('.card.empty-state h1')?.textContent).toBe('Page not found')
    expect(main.querySelectorAll('h1')).toHaveLength(1)
    const hrefs = [...main.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/examples', '/learn']))
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
    // Plan orientation survives leaving the workspace shell (#432): a breadcrumb
    // back into the plan, and Back to plan lands on the plan itself, not Results.
    const crumb = container.querySelector('.report-head nav[aria-label="Breadcrumb"]')!
    expect(crumb).not.toBeNull()
    expect(crumb.className).toContain('no-print')
    const crumbLinks = [...crumb.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])
    expect(crumbLinks).toEqual([
      ['Your plans', '/'],
      [plan.name, `/plan/${plan.id}`],
    ])
    expect(crumb.querySelector('[aria-current="page"]')?.textContent).toBe('Report')
    const back = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Back to plan')
    expect(back?.getAttribute('href')).toBe(`/plan/${plan.id}`)
    // The year-by-year appendix is a named, reachable scroll region (#474).
    const appendix = container.querySelector('.report-appendix [role="region"]')
    expect(appendix?.getAttribute('aria-label')).toBe('Year-by-year appendix')
    expect(appendix?.className).toContain('year-table-wrap--grow')
    await unmount()
    // Leaving the report restores the default title, like leaving the workspace.
    expect(document.title).toBe('RetireGolden')
  })
})
