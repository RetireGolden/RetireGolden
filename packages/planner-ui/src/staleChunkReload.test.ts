/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  installStaleChunkReloadHandler,
  isStaleChunkError,
  reloadOnceForStaleChunk,
} from './staleChunkReload'

// jsdom's location.reload is not implemented (it throws "Not implemented"),
// so every test replaces it with a spy.
function spyOnReload() {
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
    configurable: true,
  })
  return reload
}

describe('isStaleChunkError', () => {
  it('matches each engine wording of a failed dynamic import', () => {
    // Chromium (the wording observed in production on Brave), Firefox, Safari.
    expect(
      isStaleChunkError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://retiregolden.app/assets/ExamplesPage-BUXbSDwV.js',
        ),
      ),
    ).toBe(true)
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('does not match ordinary errors or non-errors', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleChunkError(new RangeError('Invalid array length'))).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(42)).toBe(false)
  })

  it('matches plain-string rejections too', () => {
    expect(isStaleChunkError('Failed to fetch dynamically imported module: /assets/x.js')).toBe(true)
  })
})

describe('reloadOnceForStaleChunk', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reloads on the first failure and records the timestamp', () => {
    const reload = spyOnReload()
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('retiregolden.staleChunkReloadedAt')).toBe('1000000')
  })

  it('declines a second reload inside the cooldown window', () => {
    const reload = spyOnReload()
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
    expect(reloadOnceForStaleChunk(1_000_000 + 30_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('allows another reload after the cooldown expires (long-lived tab, later deploy)', () => {
    const reload = spyOnReload()
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
    expect(reloadOnceForStaleChunk(1_000_000 + 61_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('treats a future timestamp (clock stepped backward) as invalid and still reloads', () => {
    const reload = spyOnReload()
    sessionStorage.setItem('retiregolden.staleChunkReloadedAt', String(2_000_000))
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    // The bogus timestamp was replaced, so the cooldown works from now on.
    expect(sessionStorage.getItem('retiregolden.staleChunkReloadedAt')).toBe('1000000')
  })

  it('treats a corrupted timestamp as absent', () => {
    const reload = spyOnReload()
    sessionStorage.setItem('retiregolden.staleChunkReloadedAt', 'garbage')
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('fails closed (no reload) when sessionStorage is unavailable', () => {
    const reload = spyOnReload()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(reloadOnceForStaleChunk(1_000_000)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('installStaleChunkReloadHandler', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reloads and suppresses the rethrow on vite:preloadError', () => {
    const reload = spyOnReload()
    const uninstall = installStaleChunkReloadHandler()
    try {
      const event = new Event('vite:preloadError', { cancelable: true })
      window.dispatchEvent(event)
      expect(reload).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)
    } finally {
      uninstall()
    }
  })

  it('lets the error propagate when the reload guard declines', () => {
    const reload = spyOnReload()
    const uninstall = installStaleChunkReloadHandler()
    try {
      window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
      const second = new Event('vite:preloadError', { cancelable: true })
      window.dispatchEvent(second)
      expect(reload).toHaveBeenCalledTimes(1)
      // Not default-prevented: Vite rethrows, and RouteErrorBoundary's manual
      // fallback takes over.
      expect(second.defaultPrevented).toBe(false)
    } finally {
      uninstall()
    }
  })

  it('stops listening after uninstall', () => {
    const reload = spyOnReload()
    const uninstall = installStaleChunkReloadHandler()
    uninstall()
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    expect(reload).not.toHaveBeenCalled()
  })
})
