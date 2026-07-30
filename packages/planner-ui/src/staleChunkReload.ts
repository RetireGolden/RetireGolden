/**
 * Recovery from the classic SPA stale-deployment failure: a deploy replaces
 * the hashed chunk files while an already-open tab still holds the previous
 * index, so the next lazy-route navigation requests a chunk that no longer
 * exists ("Failed to fetch dynamically imported module"). The PWA widens
 * this window: the service worker registers as `autoUpdate` (skipWaiting +
 * clientsClaim + cleanupOutdatedCaches), so the moment a new deploy's worker
 * activates under a live tab, the old precached chunks are purged out from
 * under it.
 *
 * One reload always fixes it — by the time the chunk fetch failed, the new
 * worker's precache already holds the new index.html — so recovery is
 * automatic instead of a dead-end error screen:
 *
 *  - `installStaleChunkReloadHandler()` (the web host calls it before
 *    render) listens for Vite's `vite:preloadError` and reloads in place of
 *    letting the error throw.
 *  - `RouteErrorBoundary` uses the same helpers as a backstop, for hosts
 *    that mount the route groups without installing the listener.
 *
 * A sessionStorage timestamp caps recovery at one automatic reload per
 * minute per tab, so a genuinely broken deploy (or a lost connection)
 * degrades to the error boundary's manual fallback rather than a reload
 * loop. If sessionStorage itself is unavailable the guard can't work, so we
 * decline to auto-reload at all — fail closed to the manual path.
 */

const RELOADED_AT_KEY = 'retiregolden.staleChunkReloadedAt'
const RELOAD_COOLDOWN_MS = 60_000

// Browsers word the failure differently; all three engines are covered.
const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium (Chrome, Edge, Brave)
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
]

/** Whether an error is a failed dynamic import of a hashed route chunk. */
export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Reload the page to pick up the freshly deployed index, at most once per
 * cooldown window. Returns true when the reload was initiated (the caller
 * should render a quiet loading state, not an error), false when the guard
 * declined (recent auto-reload, or no sessionStorage to guard with).
 */
export function reloadOnceForStaleChunk(now: number = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(RELOADED_AT_KEY)
    const last = raw === null ? Number.NaN : Number(raw)
    const elapsed = now - last
    // A future timestamp (system clock stepped backward) is invalid, not a
    // cooldown — treating it as one could suppress recovery indefinitely.
    if (Number.isFinite(last) && elapsed >= 0 && elapsed < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOADED_AT_KEY, String(now))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * Listen for Vite's `vite:preloadError` (fired when a built dynamic import
 * or one of its preloaded deps fails to load) and recover with a one-shot
 * reload. `preventDefault()` stops Vite from rethrowing only when the reload
 * actually started; otherwise the error propagates to `RouteErrorBoundary`'s
 * manual fallback. Returns the uninstaller.
 */
export function installStaleChunkReloadHandler(): () => void {
  const onPreloadError = (event: Event): void => {
    if (reloadOnceForStaleChunk()) event.preventDefault()
  }
  window.addEventListener('vite:preloadError', onPreloadError)
  return () => window.removeEventListener('vite:preloadError', onPreloadError)
}
