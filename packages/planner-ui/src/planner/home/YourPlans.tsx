import type { ReactNode } from 'react'

import type { PlanSummary } from '../../data/planStoreContext'
import { useWorkspaceReadOnly } from '../../data/workspaceReadOnly'

function fmtUpdated(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `Updated ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

type YourPlansProps = {
  plans: PlanSummary[] | null
  headingLevel?: 'h1' | 'h2'
  actions?: ReactNode
  onOpenPlan: (id: string) => void
  onDuplicate: (s: PlanSummary) => void
  onDelete: (s: PlanSummary) => void
}

export function YourPlans({ plans, headingLevel = 'h2', actions, onOpenPlan, onDuplicate, onDelete }: YourPlansProps) {
  const Heading = headingLevel
  const readOnly = useWorkspaceReadOnly()

  if (plans === null) {
    return <div className="skeleton" style={{ height: '8rem' }} aria-label="Loading plans" />
  }

  if (plans.length === 0) return null

  return (
    <section className="home-your-plans" aria-labelledby="your-plans-heading">
      <div className="home-your-plans-head">
        <Heading id="your-plans-heading">Your plans</Heading>
        {actions ? <div className="picker-actions home-returning-actions">{actions}</div> : null}
      </div>
      <div className="plan-grid">
        {plans.map((s) => (
          /* The open action is a real button that holds the visible name and
             is stretched over the whole card by its ::after, so the card
             stays clickable without nesting the Duplicate/Delete buttons
             inside another interactive element. The name is a block-level
             box inside the button (not a flex item of the card), which is
             where its two-line clamp lives (#533); the button's accessible
             name is that text, whole, so no aria-label repeats it. */
          <div key={s.id} className="plan-card">
            <button type="button" className="plan-card-open" onClick={() => onOpenPlan(s.id)}>
              <span className="plan-card-name">{s.name}</span>
              {/* The verb, after the name so voice control still matches on
                  the visible text; Duplicate and Delete carry theirs too. */}
              <span className="sr-only">, open plan</span>
            </button>
            <span className="plan-card-meta">{fmtUpdated(s.updatedAtIso)}</span>
            {/* Duplicate/Delete write through the seam — hidden when read-only.
                Opening a plan (read) stays available. */}
            {readOnly ? null : (
              <span className="plan-card-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  aria-label={`Duplicate plan ${s.name}`}
                  onClick={() => void onDuplicate(s)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-ghost-danger"
                  aria-label={`Delete plan ${s.name}`}
                  onClick={() => void onDelete(s)}
                >
                  Delete
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
