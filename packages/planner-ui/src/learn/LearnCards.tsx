/**
 * Shared presentational cards for the Learning Center.
 *
 * A readable article renders as a clickable card; a planned (stub) article
 * renders as a non-interactive "Planned" card so users are never routed to an
 * empty page (spec §7.3).
 */

import { Link } from 'react-router-dom'
import { getCategory, isReadable, type LearningArticle } from './learningRegistry'

export function ArticleCard({ article }: { article: LearningArticle }) {
  const readable = isReadable(article)
  const category = getCategory(article.category)

  const inner = (
    <>
      <div className="learn-card-head">
        {category && <span className="learn-card-cat">{category.label}</span>}
        {readable ? null : <span className="learn-badge learn-badge--planned">Planned</span>}
      </div>
      <span className="learn-card-title">{article.title}</span>
      <span className="learn-card-desc">{article.description}</span>
    </>
  )

  if (readable) {
    return (
      <Link to={`/learn/${article.slug}`} className="learn-card learn-card--link">
        {inner}
      </Link>
    )
  }

  return (
    <div className="learn-card learn-card--planned">
      {inner}
      <span className="sr-only">Planned article, not yet available.</span>
    </div>
  )
}
