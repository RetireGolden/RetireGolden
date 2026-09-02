/**
 * Learning Center home (/learn): a fast index, not long copy.
 *
 * Search, featured high-value topics, a browse-by-category grid, and links to
 * the glossary and sources.
 */

import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  articlesInCategory,
  byListingOrder,
  categorySummaries,
  featuredArticles,
  searchArticles,
} from './learningRegistry'
import { ArticleCard } from './LearnCards'

export function LearningCenterPage() {
  const [query, setQuery] = useState('')
  const searchInputId = useId()
  // The region the search box controls: results while a query is typed, the
  // index otherwise. One stable id either way, so `aria-controls` always
  // resolves (#534).
  const resultsId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmed = query.trim()
  const results = trimmed ? searchArticles(trimmed) : null
  const resultsSummary = results ? `${results.length} result${results.length === 1 ? '' : 's'} for “${trimmed}”` : ''

  const featured = featuredArticles()

  return (
    <article className="page learn-home">
      <h1>Learning Center</h1>
      <p className="lede">
        Plain-language explanations of the ideas behind your plan: taxes, Social Security, withdrawals, risk, and
        more. Read a topic, then come back to the planner with a clearer picture.
      </p>

      <div className={query ? 'learn-search learn-search--has-query' : 'learn-search'}>
        <label htmlFor={searchInputId} className="sr-only">
          Search the Learning Center
        </label>
        <input
          id={searchInputId}
          ref={inputRef}
          type="search"
          className="learn-search-input"
          placeholder="Search topics, e.g. Roth, IRMAA, sequence risk"
          value={query}
          aria-controls={resultsId}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* A real button, so the clear affordance is reachable from the
            keyboard and named for a screen reader; the UA's own search
            cancel glyph is neither, and is hidden in CSS (#534). */}
        {query ? (
          <button
            type="button"
            className="learn-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        {/* Always mounted so the announcement lands when the results change;
            the visible count below is a heading, which is not announced. */}
        <p className="sr-only" role="status" aria-live="polite">
          {resultsSummary}
        </p>
      </div>

      <div id={resultsId}>
        {results ? (
          <section className="learn-section" aria-label="Search results">
            <h2 className="learn-section-title">{resultsSummary}</h2>
            {results.length === 0 ? (
              <p className="muted">No matching topics yet. Try a broader word, or browse the categories below.</p>
            ) : (
              <div className="learn-card-grid">
                {results.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {featured.length > 0 && (
              <section className="learn-section" aria-label="Featured topics">
                <h2 className="learn-section-title">Featured topics</h2>
                <div className="learn-card-grid">
                  {featured.map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </div>
              </section>
            )}

            <section className="learn-section" aria-label="Browse by category">
              <h2 className="learn-section-title">Browse by category</h2>
              {categorySummaries().map(({ category, count }) => (
                <div key={category.id} className="learn-category">
                  <div className="learn-category-head">
                    <h3 className="learn-category-title">{category.label}</h3>
                    <span className="muted small">
                      {count} article{count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="learn-category-blurb muted">{category.blurb}</p>
                  <div className="learn-card-grid">
                    {articlesInCategory(category.id)
                      .slice()
                      .sort(byListingOrder)
                      .map((a) => (
                        <ArticleCard key={a.slug} article={a} />
                      ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="learn-section learn-utility-links" aria-label="Reference">
              <Link to="/learn/glossary" className="learn-utility-link">
                <strong>Glossary</strong>
                <span className="muted small">Plain definitions of the terms used across the app.</span>
              </Link>
              <Link to="/learn/sources" className="learn-utility-link">
                <strong>Sources &amp; review methodology</strong>
                <span className="muted small">Where the rules come from and how often they are reviewed.</span>
              </Link>
            </section>
          </>
        )}
      </div>
    </article>
  )
}
