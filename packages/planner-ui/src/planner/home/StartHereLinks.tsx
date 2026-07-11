import { LearnLink } from '../../learn/LearnLink'
import { getArticle } from '../../learn/learningRegistry'
import { START_HERE_SLUGS } from './startHereSlugs'

export function StartHereLinks() {
  return (
    <section className="home-start-here" aria-labelledby="start-here-heading">
      <h2 id="start-here-heading">Start here</h2>
      <ul className="home-start-here-list">
        {START_HERE_SLUGS.map((slug) => {
          const article = getArticle(slug)
          if (!article) return null
          return (
            <li key={slug}>
              <LearnLink slug={slug} label={article.title} variant="inline" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
