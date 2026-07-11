/**
 * Glossary index (/learn/glossary).
 *
 * A flat, alphabetized definition list. Each term has a stable anchor id so
 * tooltips and articles can deep-link to a specific definition.
 */

import { Link } from 'react-router-dom'
import { GLOSSARY_TERMS } from './glossary'

export function GlossaryPage() {
  return (
    <article className="page learn-glossary">
      <Link to="/learn" className="learn-back">
        ← Learning Center
      </Link>
      <h1>Glossary</h1>
      <p className="lede">Plain-language definitions of the terms and acronyms used across RetireGolden.</p>

      <dl className="learn-glossary-list">
        {GLOSSARY_TERMS.map((t) => (
          <div key={t.id} className="learn-glossary-item" id={t.id}>
            <dt className="learn-glossary-term">
              {t.term}
              {t.expansion && <span className="learn-glossary-expansion"> — {t.expansion}</span>}
            </dt>
            <dd className="learn-glossary-def">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
