/**
 * Dedicated example library route — browsable curated demos separate from the
 * planner home so the home stays focused on the user's own plans.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ExampleLibrary } from './ExampleLibrary'
import { usePlannerEdition } from '../editionContext'

export function ExamplesPage() {
  const [notice, setNotice] = useState<string | null>(null)
  const { homeLabel } = usePlannerEdition()

  return (
    <section className="page examples-page">
      <nav className="examples-back" aria-label="Back to planner home">
        <Link to="/">← {homeLabel}</Link>
      </nav>

      {notice ? <div className="callout callout--info">{notice}</div> : null}

      <ExampleLibrary onNotice={setNotice} headingLevel="h1" />
    </section>
  )
}
