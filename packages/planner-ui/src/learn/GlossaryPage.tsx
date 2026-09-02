/**
 * Glossary index (/learn/glossary).
 *
 * A flat, alphabetized definition list. Each term has a stable anchor id so
 * tooltips and articles can deep-link to a specific definition. A filter
 * narrows the list live (#487): 26 terms is a long scroll with nothing to
 * type into.
 */

import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { GLOSSARY_TERMS } from './glossary'

function matches(term: (typeof GLOSSARY_TERMS)[number], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return [term.term, term.expansion ?? '', term.definition].some((s) => s.toLowerCase().includes(q))
}

export function GlossaryPage() {
  const [query, setQuery] = useState('')
  const filterId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Clearing from the empty state unmounts the Clear button; focus goes back
  // to the filter so a keyboard user is not dropped at the top of the page.
  const clear = () => {
    setQuery('')
    inputRef.current?.focus()
  }
  const filtering = query.trim() !== ''
  const shown = GLOSSARY_TERMS.filter((t) => matches(t, query))
  const total = GLOSSARY_TERMS.length
  return (
    <article className="page learn-glossary">
      <Link to="/learn" className="learn-back">
        ← Learning Center
      </Link>
      <h1>Glossary</h1>
      <p className="lede">Plain-language definitions of the terms and acronyms used across RetireGolden.</p>

      <div className="field learn-glossary-filter">
        <label htmlFor={filterId}>Filter terms</label>
        <input
          ref={inputRef}
          id={filterId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type part of a term or definition"
          autoComplete="off"
        />
      </div>
      <p className="small muted" role="status" aria-live="polite">
        {!filtering ? `${total} terms` : shown.length === total ? `All ${total} terms match` : `${shown.length} of ${total} terms match`}
      </p>

      {shown.length === 0 ? (
        <div className="empty-state">
          <p>No terms match “{query.trim()}”.</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={clear}>
            Clear filter
          </button>
        </div>
      ) : (
        <dl className="learn-glossary-list">
          {shown.map((t) => (
            <div key={t.id} className="learn-glossary-item" id={t.id}>
              <dt className="learn-glossary-term">
                {t.term}
                {t.expansion && <span className="learn-glossary-expansion"> ({t.expansion})</span>}
              </dt>
              <dd className="learn-glossary-def">{t.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
