/** Shown while a lazy route chunk loads — the shared skeleton vocabulary, not bare text. */
export function RouteFallback() {
  return (
    <div className="page" role="status" aria-live="polite" aria-label="Loading">
      <div className="skeleton" style={{ height: '2rem', marginBottom: '1rem' }} aria-hidden="true" />
      <div className="skeleton" style={{ height: '14rem' }} aria-hidden="true" />
    </div>
  )
}
