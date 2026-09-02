/**
 * The kind badge: the small uppercase pill that names what a row is (Cash,
 * Event, Goal, Care, Convert) before the row's own title.
 *
 * It exists as a component for one reason. `.item-row-title` is a flex row, so
 * the badge and the title *look* separated by its gap — but the markup put
 * them in adjacent nodes with nothing between, and every layer that reads text
 * rather than boxes concatenated them: the accessible name, a copy/paste, a
 * screen reader, the QA transcript that filed "CashRiley", "EventInheritance",
 * "GoalKitchen", "Permanent lifeWhole life" (#570).
 *
 * So the separator is part of the badge, not something each call site
 * remembers. The trailing space is a whitespace-only text node: between flex
 * items it generates no anonymous flex item and is not rendered, and in
 * ordinary inline flow it collapses into the space the reader already sees —
 * so nothing moves visually in either theme, and the text layer gains the word
 * break it always claimed to have.
 */
export function TypeChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <span className={className ? `type-chip ${className}` : 'type-chip'}>{children}</span>{' '}
    </>
  )
}
