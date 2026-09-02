/**
 * Lazy-route fallback (#433): the shimmer alone read as a bare grey page with
 * no sign anything was happening. A visible caption names the wait, the
 * region is busy for assistive tech, and the status announces politely.
 */
export function RouteFallback() {
  return (
    <div className="page route-fallback" role="status" aria-live="polite" aria-busy="true" aria-label="Loading">
      <p className="muted route-fallback-caption">Loading this section…</p>
      <div className="skeleton" style={{ height: '2rem', marginBottom: '1rem' }} aria-hidden="true" />
      <div className="skeleton" style={{ height: '14rem' }} aria-hidden="true" />
    </div>
  )
}
