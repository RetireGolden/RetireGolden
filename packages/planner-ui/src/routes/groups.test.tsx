/** @vitest-environment jsdom */
/**
 * Route-group mounting: a host can render the workspace group alone under
 * its own router (deep links included), the content group alone, and omit
 * the home group entirely.
 */
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, isValidElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, useRoutes, type RouteObject } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { RouteErrorBoundary } from '../RouteErrorBoundary'
import { plannerContentRoutes, plannerHomeRoutes, plannerWorkspaceRoutes } from './groups'
import PlanRoutes from './PlanRoutes'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor, waitForText } from '../testSupport/settle'
import { LAZY_ROUTE_PRELOAD_TIMEOUT_MS, preloadLazyRoutes } from '../testSupport/lazyRoutes'

/** A bare host: no planner chrome, just the given groups under a router. */
function GroupHost({ routes }: { routes: RouteObject[] }) {
  return useRoutes(routes)
}

// Every chunk this file waits on is behind `lazy()`: `plan/*`, `examples`,
// and — since the workspace output screens became lazy too — the `Results:`
// destination the basename test navigates to.
//
// `plan/*` is already safe: the static `PlanRoutes` import above is evaluated
// before any test in this file runs, which is a real guarantee, though one
// this file gets as a side effect of an import kept for the route-tree
// assertion. `examples` has nothing warming it at all, and `Results:` rests
// only on whatever the earlier workspace render happened to pull in first —
// incidental warmth, not a guarantee. Naming all three keeps the reason
// stated rather than inferred — see ../testSupport/lazyRoutes.ts.
beforeAll(async () => {
  await preloadLazyRoutes('plan', 'examples', 'results')
}, LAZY_ROUTE_PRELOAD_TIMEOUT_MS)

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
  await waitFor(() => readyWhen(container.innerHTML), { what: `the lazy route at ${path}` })
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

  it('serves under a URL prefix via the router basename — in-app navigation stays inside it', async () => {
    // The supported prefixing story (README "Route groups"): the prefix lives
    // in the router's basename, so the pages' root-absolute navigation
    // resolves against it instead of escaping to the host's root.
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter basename="/planner" initialEntries={[`/planner/plan/${sample.id}/household`]}>
          <GroupHost routes={plannerWorkspaceRoutes} />
        </MemoryRouter>,
      )
    })
    await waitFor(() => container.innerHTML.includes('workspace-rail'), { what: 'the workspace rail' })
    expect(container.textContent).toContain('Household')

    // Navigate in-app via the rail (rendered href carries the basename), and
    // the destination must still match inside the prefixed mount.
    const resultsLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find(
      (a) => a.textContent === 'Results',
    )
    expect(resultsLink?.getAttribute('href')).toBe(`/planner/plan/${sample.id}/results`)
    await act(async () => {
      resultsLink!.click()
    })
    await waitForText(container, 'Results:')
    expect(container.querySelector('h1')?.textContent).toBe(`Results: ${sample.name}`)

    await act(async () => root.unmount())
    container.remove()
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

/** Every `<Route>` in a rendered route tree, flattened, as `[path, element]`. */
function routeElements(node: ReactNode, into: Array<[string, ReactNode]> = []): Array<[string, ReactNode]> {
  if (Array.isArray(node)) {
    for (const child of node) routeElements(child, into)
    return into
  }
  if (!isValidElement(node)) return into
  const props = node.props as { path?: string; element?: ReactNode; children?: ReactNode }
  if (node.type === Route && typeof props.path === 'string') into.push([props.path, props.element])
  if (props.children) routeElements(props.children, into)
  return into
}

describe('lazy route elements', () => {
  it('each ships its own RouteErrorBoundary, so bare route-group hosts get stale-chunk recovery', () => {
    // A host mounting the groups without <PlannerApp/> has no outer boundary;
    // a lazy chunk that vanished under a deploy must still recover per-route
    // (staleChunkReload.ts) instead of surfacing an uncaught rejection.
    const lazyPaths = ['plan/*', 'compare', 'examples', 'learn/*', 'how-tested', 'import']
    const all = [...plannerHomeRoutes, ...plannerWorkspaceRoutes, ...plannerContentRoutes]
    for (const path of lazyPaths) {
      const route = all.find((r) => r.path === path)
      expect(route, `route ${path} exists`).toBeDefined()
      expect(
        isValidElement(route!.element) && route!.element.type === RouteErrorBoundary,
        `route ${path} wraps in RouteErrorBoundary`,
      ).toBe(true)
    }
  })

  it('the plan workspace wraps each lazy output screen too, so one bad chunk stays in the outlet', () => {
    // PlanRoutes declares <Route> JSX rather than a RouteObject[], so the walk
    // above cannot see inside it. Same contract, though: the Enter sections are
    // eager and need no boundary, while every screen behind lazy() must keep
    // its failure inside the outlet instead of blanking the workspace.
    const lazyPaths = [
      'assumptions-card',
      'social-security-analysis',
      'results',
      'monte-carlo',
      'scenarios',
      'household-map',
      'survivor',
      'relocation',
      'optimize',
      'spending-solver',
      'insights',
      ':planId/report',
    ]
    const declared = new Map(routeElements(PlanRoutes()))

    for (const path of lazyPaths) {
      expect(declared.has(path), `PlanRoutes declares ${path}`).toBe(true)
      const element = declared.get(path)
      expect(
        isValidElement(element) && element.type === RouteErrorBoundary,
        `plan route ${path} wraps in RouteErrorBoundary`,
      ).toBe(true)
    }

    // And the Enter sections deliberately do not — they are in the chunk the
    // workspace already loaded, so a boundary there would guard nothing.
    const household = declared.get('household')
    expect(isValidElement(household) && household.type === RouteErrorBoundary).toBe(false)
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
