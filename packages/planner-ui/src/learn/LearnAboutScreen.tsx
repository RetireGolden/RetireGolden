/**
 * LearnAboutScreen (V9 PR3) — the standard contextual learning cluster for a
 * planner screen.
 *
 * Given a planner route pattern (e.g. `/plan/:planId/optimize`), it lists the
 * readable Learning Center articles that relate to that screen, each via
 * {@link LearnLink} so they carry a return path. The list is derived from
 * article metadata, so it stays in sync with the registry and renders nothing
 * when no ready article relates yet — every screen can host it safely.
 */

import { useId } from 'react'

import { articlesForRoute, byListingOrder } from './learningRegistry'
import { LearnLink } from './LearnLink'

/** Keep the cluster focused — the doc's guidance is that 3-5 links is plenty. */
const MAX_LINKS = 5

export function LearnAboutScreen({
  route,
  title = 'Learn about this screen',
  limit = MAX_LINKS,
  exclude = [],
}: {
  route: string
  title?: string
  limit?: number
  /**
   * Slugs the screen already links inline (its intro, a callout), so the
   * cluster does not repeat the same destination a second time (#429).
   */
  exclude?: readonly string[]
}) {
  const headingId = useId()
  const articles = articlesForRoute(route)
    .filter((a) => !exclude.includes(a.slug))
    .sort(byListingOrder)
    .slice(0, limit)
  if (articles.length === 0) return null
  // A card with a real heading (#446): the title joins the page outline at
  // the same level as the screen's other sections, and the cluster reads as
  // a section rather than loose text after the last card.
  return (
    <aside className="card learn-screen" aria-labelledby={headingId}>
      <h2 id={headingId} className="learn-screen-title">
        {title}
      </h2>
      <ul className="learn-screen-list">
        {articles.map((a) => (
          <li key={a.slug}>
            <LearnLink slug={a.slug} label={a.title} />
          </li>
        ))}
      </ul>
    </aside>
  )
}
