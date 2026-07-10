/**
 * The consistent layout for a finished article (spec §6.4): back link, category
 * kicker, title, one-sentence promise, the structured body, related articles,
 * sources, last-reviewed date, and a compact educational disclaimer.
 *
 * ArticlePage delegates the readable case here; the planned/not-found states
 * stay in ArticlePage but share {@link BackLink}.
 */

import { Link, useLocation } from 'react-router-dom'
import { OpenExampleButton } from '../../planner/examples/OpenExampleButton'
import { getCategory, type LearningArticle } from '../learningRegistry'
import { ArticleBody } from '../ArticleBody'
import { RelatedArticles } from './RelatedArticles'
import { SourceList } from './SourceList'

function formatReviewed(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Back link for any /learn page. When the reader arrived from a planner screen
 * via {@link LearnLink}, returns them there ("← Back to Optimize"); otherwise
 * falls back to the Learning Center home.
 */
export function BackLink() {
  const { state } = useLocation()
  const nav = state as { learnFrom?: unknown; learnFromLabel?: unknown } | null
  const from = nav?.learnFrom
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    const label = typeof nav?.learnFromLabel === 'string' ? `← Back to ${nav.learnFromLabel}` : '← Back'
    return (
      <Link to={from} className="learn-back">
        {label}
      </Link>
    )
  }
  return (
    <Link to="/learn" className="learn-back">
      ← Learning Center
    </Link>
  )
}

export function ArticleShell({ article }: { article: LearningArticle }) {
  const category = getCategory(article.category)

  return (
    <article className="page learn-article">
      <BackLink />
      {category && (
        <div className="learn-article-kicker">
          <span className="learn-card-cat">{category.label}</span>
        </div>
      )}
      <h1>{article.title}</h1>
      <p className="lede">{article.description}</p>

      {article.exampleId ? (
        <div className="learn-example-cta" style={{ marginBottom: '1.25rem' }}>
          <OpenExampleButton exampleId={article.exampleId} />
        </div>
      ) : null}

      <div className="learn-article-body">
        <ArticleBody blocks={article.blocks ?? []} />
      </div>

      <RelatedArticles slugs={article.relatedArticles} />

      {/* The persistent app footer directly below already carries the
          educational disclaimer, so the article foot no longer repeats it. */}
      <footer className="learn-article-foot">
        <SourceList urls={article.sourceUrls} />
        <p className="muted small">Last reviewed {formatReviewed(article.lastReviewed)}.</p>
      </footer>
    </article>
  )
}
