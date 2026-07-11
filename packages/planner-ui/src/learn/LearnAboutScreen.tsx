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

import { articlesForRoute, byListingOrder } from './learningRegistry'
import { LearnLink } from './LearnLink'

/** Keep the cluster focused — the doc's guidance is that 3-5 links is plenty. */
const MAX_LINKS = 5

export function LearnAboutScreen({
  route,
  title = 'Learn about this screen',
  limit = MAX_LINKS,
}: {
  route: string
  title?: string
  limit?: number
}) {
  const articles = articlesForRoute(route).slice().sort(byListingOrder).slice(0, limit)
  if (articles.length === 0) return null
  return (
    <aside className="learn-screen" aria-label={title}>
      <span className="learn-screen-title">{title}</span>
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
