/**
 * Example library — browsable curated demos (rendered on `/examples`).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LearnLink } from '../../learn/LearnLink'
import { useDialogs } from '../dialogs'
import { EXAMPLE_PLANS, type ExamplePlan } from './registry'
import { openExampleExisting, openExampleFresh, prepareExampleOpen, saveExampleToMyPlans } from './loadExample'
import { EXAMPLE_LOAD_FRESH_DESC, EXAMPLE_OPEN_EXISTING_DESC } from './exampleCopy'
// Demo records are browser-local by design, so this loadPlan stays on the
// browser store; only the "Save to my plans" conversion crosses the seam.
import { loadPlan } from '../../data/planStore'
import { usePlanStore } from '../../data/planStoreContext'
import { readLocal, STORAGE_KEYS, writeLocal } from '../../data/localStore'
import { usePlannerEdition } from '../editionContext'

/**
 * Three curated starters shown first so a confused first-timer faces a handful
 * of choices, not the whole 24-card wall (UI/UX round 2, Step 4): a mainstream
 * couple, an approachable single just getting started, and an under-saved /
 * late-start cautionary case. The full library is one click away.
 */
const FEATURED_EXAMPLE_IDS = ['example-couple', 'early-career-match', 'under-saved-single'] as const

function householdFacts(example: ExamplePlan): string {
  const plan = example.build()
  const people = plan.household.people.length
  const filing = plan.household.filingStatus === 'marriedFilingJointly' ? 'Couple' : 'Single'
  return `${filing} · ${plan.household.state} · ${people} ${people === 1 ? 'person' : 'people'}`
}

function ExampleCard({ example, onNotice }: { example: ExamplePlan; onNotice: (msg: string) => void }) {
  const navigate = useNavigate()
  const store = usePlanStore()
  const { homeLabel } = usePlannerEdition()
  const [busy, setBusy] = useState(false)
  const { choice, dialogs } = useDialogs()

  const openDemo = async (chosen?: 'open-existing' | 'load-fresh') => {
    setBusy(true)
    try {
      if (chosen === 'open-existing') {
        const r = await openExampleExisting(example.id)
        if (r.ok) navigate(`/plan/${r.planId}/results`)
        else onNotice(r.reason)
        return
      }
      if (chosen === 'load-fresh') {
        const r = await openExampleFresh(example.id)
        if (r.ok) navigate(`/plan/${r.planId}/results`)
        else onNotice(r.reason)
        return
      }

      const prepared = await prepareExampleOpen(example.id)
      if (!prepared.ok) {
        onNotice(prepared.reason)
        return
      }
      if (prepared.needsChoice) {
        const picked = await choice({
          title: 'Open example',
          body: `"${example.title}" was opened before. Which version would you like?`,
          choices: [
            { value: 'open-existing', label: 'Open my version', description: EXAMPLE_OPEN_EXISTING_DESC },
            { value: 'load-fresh', label: 'Load a fresh copy', description: EXAMPLE_LOAD_FRESH_DESC },
          ],
        })
        if (picked !== null) await openDemo(picked)
        return
      }
      navigate(`/plan/${prepared.planId}/results`)
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      const prepared = await prepareExampleOpen(example.id)
      if (!prepared.ok) {
        onNotice(prepared.reason)
        return
      }
      let planId = prepared.planId
      if (prepared.needsChoice) {
        const fresh = await openExampleFresh(example.id)
        if (!fresh.ok) {
          onNotice(fresh.reason)
          return
        }
        planId = fresh.planId
      }
      const loaded = await loadPlan(planId)
      if (!loaded.ok) {
        onNotice('Could not load the example to save.')
        return
      }
      const converted = await saveExampleToMyPlans(loaded.plan, { store })
      if (converted.ok) {
        onNotice(`"${example.title}" saved to ${homeLabel}.`)
        navigate(`/plan/${converted.plan.id}/results`)
      } else {
        onNotice(converted.issues.join('; '))
      }
    } finally {
      setBusy(false)
    }
  }

  const learnHook = { slug: example.learnSlug, label: 'Learn about this example' }

  return (
    <div className="plan-card example-card">
      <span className="plan-card-name">{example.title}</span>
      <span className="plan-card-meta">{householdFacts(example)}</span>
      <p className="example-card-teaches">{example.teaches}</p>
      <span className="plan-card-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void openDemo()}>
          Open
        </button>
        <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void handleSave()}>
          Save to my plans
        </button>
        <LearnLink {...learnHook} variant="button" className="btn btn-ghost btn-small" />
      </span>
      {dialogs}
    </div>
  )
}

const FEATURED = FEATURED_EXAMPLE_IDS.map((id) => EXAMPLE_PLANS.find((e) => e.id === id)).filter(
  (e): e is ExamplePlan => e !== undefined,
)
const REST = EXAMPLE_PLANS.filter((e) => !FEATURED_EXAMPLE_IDS.includes(e.id as (typeof FEATURED_EXAMPLE_IDS)[number]))

export function ExampleLibrary({
  onNotice,
  headingLevel = 'h2',
}: {
  onNotice: (msg: string) => void
  headingLevel?: 'h1' | 'h2'
}) {
  const Heading = headingLevel
  const { homeLabel } = usePlannerEdition()
  // First-time visitors see the three starters; anyone who expanded the full
  // grid before keeps it open (stored per-device, cleared by "Clear all data").
  const [expanded, setExpanded] = useState(() => readLocal(STORAGE_KEYS.examplesExpanded) === 'true')

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev
      writeLocal(STORAGE_KEYS.examplesExpanded, String(next))
      return next
    })
  }

  return (
    <section className="example-library" aria-labelledby="example-library-heading">
      <Heading id="example-library-heading">Example library</Heading>
      <p className="lede">
        Explore curated households in the full planner. Examples stay out of {homeLabel} until you save one — edit
        freely and refresh without cluttering your own list.
      </p>
      <div className="plan-grid">
        {FEATURED.map((example) => (
          <ExampleCard key={example.id} example={example} onNotice={onNotice} />
        ))}
      </div>

      <div className="examples-browse-all">
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={expanded}
          aria-controls="examples-full-grid"
          onClick={toggle}
        >
          {expanded ? 'Show fewer examples' : `Browse all ${EXAMPLE_PLANS.length} examples`}
        </button>
      </div>

      {expanded ? (
        <div className="plan-grid" id="examples-full-grid">
          {REST.map((example) => (
            <ExampleCard key={example.id} example={example} onNotice={onNotice} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
