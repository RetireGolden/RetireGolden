/** @vitest-environment jsdom */
/**
 * Route-group mounting: a host can render the workspace group alone under
 * its own router (deep links included), the content group alone, and omit
 * the home group entirely.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, useRoutes, type RouteObject } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { plannerContentRoutes, plannerHomeRoutes, plannerWorkspaceRoutes } from './groups'
import { createSamplePlan } from '../testSupport/samplePlan'

/** A bare host: no planner chrome, just the given groups under a router. */
function GroupHost({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes)
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

async function renderAt(path: string, routes: RouteObject[], readyWhen: (html: string) => boolean) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <GroupHost routes={routes} />
      </MemoryRouter>,
    )
  })
  for (let attempt = 0; attempt < 200 && !readyWhen(container.innerHTML); attempt++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

describe('workspace group mounted alone', () => {
  it('deep-links straight into a plan section with no home routes present', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    const { container, unmount } = await renderAt(
      `/plan/${sample.id}/household`,
      plannerWorkspaceRoutes,
      (html) => html.includes('workspace-rail'),
    )

    // The workspace shell and the deep-linked section both rendered.
    expect(container.querySelector('.workspace-rail')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toContain(sample.name)
    expect(container.textContent).toContain('Household')
    await unmount()
  })

  it('matches nothing for home paths, leaving them to the host', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/import']}>
        <GroupHost routes={plannerWorkspaceRoutes} />
      </MemoryRouter>,
    )
    expect(html).toBe('')
  })
})

describe('content group mounted alone', () => {
  it('renders the disclaimer without any storage or chrome', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/disclaimer']}>
        <GroupHost routes={plannerContentRoutes} />
      </MemoryRouter>,
    )
    expect(html).toContain('Educational use only')
  })

  it('renders the example library', async () => {
    const { container, unmount } = await renderAt('/examples', plannerContentRoutes, (html) =>
      html.includes('Example library'),
    )
    expect(container.innerHTML).toContain('Example library')
    await unmount()
  })
})

describe('all groups together', () => {
  it('composes into the full route table (home + workspace + content), like <PlannerApp/>', () => {
    const all = [...plannerHomeRoutes, ...plannerWorkspaceRoutes, ...plannerContentRoutes]
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <GroupHost routes={all} />
      </MemoryRouter>,
    )
    // The home page's first paint is the loading skeleton + privacy card;
    // that's enough to prove the home group matched at '/'.
    expect(html).toContain('picker-page')
    expect(html).toContain('Your data stays on your device')
  })
})
