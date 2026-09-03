/**
 * Example library — browsable curated demos (rendered on `/examples`).
 */

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'

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

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4'

/** The group heading and card title levels under each section level (#519). */
const HEADING_LEVELS: Record<'h1' | 'h2', { group: HeadingTag; card: HeadingTag }> = {
  h1: { group: 'h2', card: 'h3' },
  h2: { group: 'h3', card: 'h4' },
}

function ExampleCard({
  example,
  onNotice,
  headingTag,
}: {
  example: ExamplePlan
  onNotice: (msg: string) => void
  /** The card title's level: one below the group heading it sits under (#519). */
  headingTag: HeadingTag
}) {
  const CardHeading = headingTag
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
        if (r.ok) void navigate(`/plan/${r.planId}/results`)
        else onNotice(r.reason)
        return
      }
      if (chosen === 'load-fresh') {
        const r = await openExampleFresh(example.id)
        if (r.ok) void navigate(`/plan/${r.planId}/results`)
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
      void navigate(`/plan/${prepared.planId}/results`)
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
        void navigate(`/plan/${converted.plan.id}/results`)
      } else {
        onNotice(converted.issues.join('; '))
      }
    } finally {
      setBusy(false)
    }
  }

  const learnHook = { slug: example.learnSlug, label: 'Learn about this example' }

  // A list item with a heading (#478): assistive tech navigates card by card,
  // and every action names its example so twenty-nine "Open" buttons are not
  // one identical name. The heading level follows the group heading above the
  // list (#519), so the outline is section > group > card, not a flat wall.
  return (
    <li className="plan-card example-card">
      <CardHeading className="plan-card-name">{example.title}</CardHeading>
      <span className="plan-card-meta">{householdFacts(example)}</span>
      <p className="example-card-teaches">{example.teaches}</p>
      {/* Each action names its example so no two cards share a name (#478).
          The visible label stays a contiguous prefix of the accessible name
          (WCAG 2.5.3 Label in Name) so speech-input users can say what they
          see. */}
      <span className="plan-card-actions">
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={busy}
          aria-label={`Open ${example.title}`}
          onClick={() => void openDemo()}
        >
          Open
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={busy}
          aria-label={`Save to my plans: ${example.title}`}
          onClick={() => void handleSave()}
        >
          Save to my plans
        </button>
        <LearnLink
          {...learnHook}
          variant="button"
          className="btn btn-ghost btn-small"
          ariaLabel={`Learn about this example: ${example.title}`}
        />
      </span>
      {dialogs}
    </li>
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
  const GroupHeading = HEADING_LEVELS[headingLevel].group
  const cardHeading = HEADING_LEVELS[headingLevel].card
  const { homeLabel } = usePlannerEdition()
  // First-time visitors see the three starters; anyone who expanded the full
  // grid before keeps it open (stored per-device, cleared by "Clear all data").
  const [expanded, setExpanded] = useState(() => readLocal(STORAGE_KEYS.examplesExpanded) === 'true')

  const browseRef = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev
      writeLocal(STORAGE_KEYS.examplesExpanded, String(next))
      return next
    })
    // Collapsing unmounts the grid above the control, so the control jumps
    // up the page; bring it back under the reader's eye (and focus stays on
    // it, since it never unmounts). jsdom has no scrollIntoView.
    if (expanded) {
      requestAnimationFrame(() => browseRef.current?.scrollIntoView?.({ block: 'nearest' }))
    }
  }

  return (
    <section className="example-library" aria-labelledby="example-library-heading">
      <Heading id="example-library-heading">Example library</Heading>
      <p className="lede">
        Explore curated households in the full planner. Examples stay out of {homeLabel} until you save one. Edit
        freely and refresh without cluttering your own list.
      </p>
      {/* Each list sits under a real group heading (#519): the outline is
          section > group > card, and the lists are labelled by those headings.
          role="list" restores list semantics WebKit drops for list-style: none. */}
      <GroupHeading className="example-group-heading" id="examples-featured-heading">
        Featured examples
      </GroupHeading>
      <ul className="plan-grid" role="list" aria-labelledby="examples-featured-heading">
        {FEATURED.map((example) => (
          <ExampleCard key={example.id} example={example} onNotice={onNotice} headingTag={cardHeading} />
        ))}
      </ul>

      {/* The controlled region stays in the DOM while collapsed — hidden, and
          with no cards mounted — so the toggle's aria-controls always points
          at an element that exists (#519; #445 had dropped the attribute
          instead, which left an expandable with no target). */}
      <div id="examples-full-grid" hidden={!expanded}>
        {expanded ? (
          <>
            <GroupHeading className="example-group-heading" id="examples-rest-heading">
              All other examples
            </GroupHeading>
            <ul className="plan-grid" role="list" aria-labelledby="examples-rest-heading">
              {REST.map((example) => (
                <ExampleCard key={example.id} example={example} onNotice={onNotice} headingTag={cardHeading} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
      {/* The toggle changes 3 cards to 29 (and back) without moving focus;
          announce it so a screen-reader user hears what happened (#478). */}
      <p className="sr-only" role="status" aria-live="polite">
        {expanded ? `Showing all ${EXAMPLE_PLANS.length} examples.` : `Showing ${FEATURED.length} featured examples.`}
      </p>

      {/* One control, one vocabulary, after the rows it controls (#445): the
          expanded state used to leave it stranded between the two grids. */}
      <div className="examples-browse-all">
        <button
          ref={browseRef}
          type="button"
          className="btn btn-secondary"
          aria-expanded={expanded}
          aria-controls="examples-full-grid"
          onClick={toggle}
        >
          {expanded ? 'Show fewer examples' : `Show all ${EXAMPLE_PLANS.length} examples`}
        </button>
      </div>
    </section>
  )
}
