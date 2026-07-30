/** @vitest-environment jsdom */
/**
 * The route error boundary's stale-deployment contract: a vanished lazy
 * chunk (deploy replaced the hashed assets under an open tab) auto-reloads
 * once behind the loading skeleton; when the reload guard declines, the
 * manual fallback explains that an update likely caused it. Ordinary render
 * errors keep the generic fallback and never trigger a reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import { RouteErrorBoundary } from './RouteErrorBoundary'

let root: Root | null = null
let container: HTMLDivElement | null = null

function Boom({ error }: { error: Error }): never {
  throw error
}

function renderWithError(error: Error) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Boom error={error} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
  })
  return container
}

beforeEach(() => {
  sessionStorage.clear()
  // React logs the caught error; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

function spyOnReload() {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
    configurable: true,
  })
  return reload
}

const staleChunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: https://retiregolden.app/assets/ExamplesPage-BUXbSDwV.js')

describe('RouteErrorBoundary', () => {
  it('auto-reloads once on a stale-chunk error, showing the loading skeleton', () => {
    const reload = spyOnReload()
    const el = renderWithError(staleChunkError())
    expect(reload).toHaveBeenCalledTimes(1)
    // Looks like the route is still loading, not an error.
    expect(el.querySelector('[role="status"]')).not.toBeNull()
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })

  it('falls back to the manual error UI with update-aware copy when the guard declines', () => {
    const reload = spyOnReload()
    // A reload already happened moments ago in this tab.
    sessionStorage.setItem('retiregolden.staleChunkReloadedAt', String(Date.now()))
    const el = renderWithError(staleChunkError())
    expect(reload).not.toHaveBeenCalled()
    const alert = el.querySelector('[role="alert"]')!
    expect(alert.textContent).toContain('right after an update')
    expect(alert.querySelector('button')!.textContent).toBe('Reload')
  })

  it('keeps the generic fallback (no reload) for ordinary render errors', () => {
    const reload = spyOnReload()
    const el = renderWithError(new Error('Cannot read properties of undefined'))
    expect(reload).not.toHaveBeenCalled()
    const alert = el.querySelector('[role="alert"]')!
    expect(alert.textContent).toContain('unexpected error')
    expect(alert.textContent).not.toContain('right after an update')
  })
})
