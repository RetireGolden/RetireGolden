/** @vitest-environment jsdom */
/**
 * `/sources` is the short path people type for the Learning Center's sources
 * page (#520): it redirects to `/learn/sources` instead of the not-found page.
 */
import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { App } from '../App.tsx'
import { waitFor } from '../testSupport/settle'
import { LAZY_ROUTE_PRELOAD_TIMEOUT_MS, preloadLazyRoutes, ROUTE_FALLBACK_SELECTOR } from '../testSupport/lazyRoutes'
import { plannerContentRoutes } from './groups'

beforeAll(async () => {
  await preloadLazyRoutes('learn')
}, LAZY_ROUTE_PRELOAD_TIMEOUT_MS)

beforeEach(() => {
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
})

describe('/sources alias (#520)', () => {
  it('is a content-group route, so any host mounting the group gets the alias', () => {
    const alias = plannerContentRoutes.find((r) => r.path === 'sources')
    expect(alias).toBeDefined()
  })

  it('lands on the Sources & review methodology page, not Page not found', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/sources']}>
          <App />
        </MemoryRouter>,
      )
    })
    await waitFor(() => !container.querySelector(ROUTE_FALLBACK_SELECTOR), { what: 'the learn route chunk' })
    expect(container.textContent).toContain('Sources & review methodology')
    expect(container.textContent).not.toContain('Page not found')
    await act(async () => root.unmount())
    container.remove()
  })
})
