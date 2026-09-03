/** @vitest-environment jsdom */
/**
 * The shell boundary catches what the route boundary cannot.
 *
 * `RouteErrorBoundary` lives inside `<main>`, so a throw in the header, the
 * theme switcher, the footer, or either provider blanked the page. That is
 * the worst failure this app has: the only copy of a household's plans is
 * this browser's IndexedDB, and every recovery affordance lives on the home
 * route a blank page cannot reach. So the fallback has to name the way back
 * to a backup, and it has to render without the router or any provider,
 * because one of those may be what threw.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from './data/planStore'
import { createEmptyPlan } from '@retiregolden/engine/model/plan'
import { waitFor } from './testSupport/settle'
import { ShellErrorBoundary } from './ShellErrorBoundary'

let root: Root | null = null
let container: HTMLDivElement | null = null

function Boom(): never {
  throw new Error('provider exploded')
}

beforeEach(() => {
  // React logs the caught error; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  // jsdom has neither of these; the download itself is not what is under test.
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

function render(children: React.ReactNode): HTMLDivElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // No MemoryRouter and no providers: the fallback must stand on its own.
  act(() => {
    root!.render(<ShellErrorBoundary>{children}</ShellErrorBoundary>)
  })
  return container
}

describe('ShellErrorBoundary', () => {
  it('renders its children untouched while nothing throws', () => {
    const host = render(<p>shell</p>)
    expect(host.textContent).toBe('shell')
    expect(host.querySelector('.error-boundary-fallback')).toBeNull()
  })

  it('points at the backup export, and says where the plans still are', () => {
    const host = render(<Boom />)
    const fallback = host.querySelector('.error-boundary-fallback')!
    expect(fallback.getAttribute('role')).toBe('alert')
    expect(fallback.textContent).toContain('Download plan backup')
    expect(fallback.textContent).toContain("still in this browser's storage")
    // The message the boundary caught is shown rather than swallowed.
    expect(host.querySelector('.error-boundary-stack')?.textContent).toBe('provider exploded')
  })

  it('offers a way out that needs neither the router nor a provider', () => {
    const host = render(<Boom />)
    // A plain anchor, not a react-router Link: the router may be what threw.
    const home = host.querySelector<HTMLAnchorElement>('a.btn')!
    expect(home.getAttribute('href')).toBe('/')
    expect(home.textContent).toBe('Home')
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Reload', 'Download plan backup'])
  })

  it('downloads every stored plan straight off IndexedDB, bypassing the broken tree', async () => {
    await savePlan({ ...createEmptyPlan({ newId: () => 'shell-1' }), name: 'Shell test plan' })
    const host = render(<Boom />)
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Download plan backup')!
    await act(async () => {
      button.click()
    })
    await waitFor(() => host.querySelector('.field-note') !== null, { what: 'the download-complete note' })
    expect(host.querySelector('.field-note')?.textContent).toBe('Backup downloaded with 1 plan.')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
  })

  it('reports a read failure inline instead of throwing again', async () => {
    // No IndexedDB at all in this window: the read the button attempts fails.
    // @ts-expect-error -- simulating a host with no IndexedDB
    delete globalThis.indexedDB
    const host = render(<Boom />)
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Download plan backup')!
    await act(async () => {
      button.click()
    })
    await waitFor(() => host.querySelector('.field-error') !== null, { what: 'the download-failed message' })
    expect(host.querySelector('.field-error')?.textContent).toBe(
      'No backup was downloaded. Storage is unavailable in this browser right now.',
    )
  })
})
