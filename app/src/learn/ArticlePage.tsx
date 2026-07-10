/**
 * Article page (/learn/:slug).
 *
 * Routes a slug to one of three states: a finished article (rendered through
 * ArticleShell), an intentional "planned" placeholder for stubs, or a not-found
 * state for unknown slugs. Stubs and unknown slugs never render an empty page.
 */

import { Link, useParams } from 'react-router-dom'
import { getArticle, getCategory, isReadable, type LearningArticle } from './learningRegistry'
import { ArticleShell, BackLink } from './components/ArticleShell'

function ArticleNotFound() {
  return (
    <article className="page learn-article">
      <BackLink />
      <h1>Article not found</h1>
      <p className="lede">We couldn’t find that article. It may have moved, or the link may be out of date.</p>
      <p>
        <Link to="/learn">Browse the Learning Center</Link> to find what you’re looking for.
      </p>
    </article>
  )
}

function PlannedArticle({ article }: { article: LearningArticle }) {
  const category = getCategory(article.category)
  return (
    <article className="page learn-article">
      <BackLink />
      <div className="learn-card-head">
        {category && <span className="learn-card-cat">{category.label}</span>}
        <span className="learn-badge learn-badge--planned">Planned</span>
      </div>
      <h1>{article.title}</h1>
      <p className="lede">{article.description}</p>
      <div className="learn-callout learn-callout--note">
        <p>
          This article is planned but not written yet — it’s on the V9 content roadmap. In the meantime, explore the
          planner or browse other topics.
        </p>
      </div>
      <p>
        <Link to="/learn">Back to the Learning Center</Link>
      </p>
    </article>
  )
}

export function ArticlePage() {
  const { slug } = useParams()
  const article = slug ? getArticle(slug) : undefined

  if (!article) return <ArticleNotFound />
  if (!isReadable(article)) return <PlannedArticle article={article} />
  return <ArticleShell article={article} />
}
