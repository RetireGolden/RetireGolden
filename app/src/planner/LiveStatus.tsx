/**
 * A visually hidden ARIA live region. Rendering a new `message` (different text
 * content) prompts assistive tech to announce it; identical re-renders stay
 * silent, so it will not double-announce on unrelated re-renders. Keep the
 * component mounted (render it with an empty message rather than conditionally)
 * so the region exists before its text first changes — some screen readers skip
 * the announcement otherwise. Use `assertive` for errors that should interrupt.
 */
export function LiveStatus({ message, assertive = false }: { message: string; assertive?: boolean }) {
  return (
    <span className="sr-only" role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'}>
      {message}
    </span>
  )
}
