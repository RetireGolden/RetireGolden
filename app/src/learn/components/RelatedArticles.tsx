/**
 * Renders the "Related" strip for an article. Resolves related slugs to
 * articles and shows only readable ones, so there are never dead links.
 * Renders nothing when no related article is readable yet.
 */

import { getArticle, isReadable, type LearningArticle } from '../learningRegistry'
import { ArticleCard } from '../LearnCards'

export function RelatedArticles({ slugs }: { slugs: string[] }) {
  const related = slugs
    .map(getArticle)
    .filter((a): a is LearningArticle => a !== undefined && isReadable(a))

  if (related.length === 0) return null

  return (
    <section className="learn-section" aria-label="Related articles">
      <h2 className="learn-section-title">Related</h2>
      <div className="learn-card-grid">
        {related.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  )
}
