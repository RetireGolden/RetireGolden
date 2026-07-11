/**
 * Shared review-checklist UI for every import path: what mapped, what was
 * assumed, what did not import, and what was skipped — grouped with the
 * items that need the user's attention first. Values render as inert text.
 */

import { countByStatus, IMPORT_STATUS_LABEL, IMPORT_STATUS_ORDER, type ImportReviewItem } from './reviewChecklist'

export function ReviewChecklist({ items }: { items: ImportReviewItem[] }) {
  const counts = countByStatus(items)
  return (
    <div className="import-review">
      <h3>Review what was imported</h3>
      <p className="card-hint">
        Nothing imports silently: every value placed in the draft plan, every assumption made for you, and
        everything that could not be brought over is listed here. You can change all of it in the planner.
      </p>
      {IMPORT_STATUS_ORDER.map((status) => {
        const group = items.filter((i) => i.status === status)
        if (group.length === 0) return null
        return (
          <section key={status} className={`import-review-group import-review-group--${status}`}>
            <h4>
              {IMPORT_STATUS_LABEL[status]} <span className="muted">({counts[status]})</span>
            </h4>
            <ul>
              {group.map((item, i) => (
                <li key={`${status}-${i}`}>
                  <strong>{item.source}</strong> — {item.detail}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
