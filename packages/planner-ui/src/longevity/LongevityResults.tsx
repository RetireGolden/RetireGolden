import { BASELINE_CITATION, lifeTableCitation } from './constants'
import { isCurrentLifeTableEdition, storedLifeTableEdition } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import type { LongevityPersisted } from '@retiregolden/engine/longevity/types'

export interface LongevityResultsProps {
  data: LongevityPersisted
  onEdit: () => void
  /** Clear persisted storage for this profile and reset parent UI. */
  onClear: () => void
  /** Overrides the main results `<h2>` text */
  resultsHeading?: string
}

export function LongevityResults({ data, onEdit, onClear, resultsHeading }: LongevityResultsProps) {
  const { answers, result, updatedAt } = data
  const updated = new Date(updatedAt).toLocaleString()
  // A result saved on an earlier table keeps that table's label: its numbers
  // were computed on it (a result saved before the field existed is 2022's).
  const edition = storedLifeTableEdition(result.tableEdition)
  const citation = lifeTableCitation(edition)
  const current = isCurrentLifeTableEdition(result.tableEdition)

  return (
    <div className="results">
      <section className="disclaimer-box" aria-label="Disclaimer">
        <p>
          <strong>Educational estimate only.</strong> Not medical advice. This tool applies simple
          adjustments to a population life table; it cannot predict your individual lifespan.
        </p>
      </section>

      <section className="results-hero">
        <h2>{resultsHeading ?? 'Estimated remaining years'}</h2>
        <p className="results-central" aria-live="polite">
          About <strong>{result.centralRemainingYears.toFixed(1)}</strong> years
        </p>
        <p className="muted">
          Illustrative band (not a statistical confidence interval):{' '}
          <strong>
            {result.bandLowRemainingYears.toFixed(1)} to {result.bandHighRemainingYears.toFixed(1)}
          </strong>{' '}
          years remaining
        </p>
        <p className="muted">
          For planning visuals only: living to roughly age{' '}
          <strong>{result.illustrativePlanningAge}</strong> aligns with the central estimate above
          (rounded).
        </p>
      </section>

      <section className="results-detail">
        <h3>How we got this</h3>
        <ul className="results-list">
          <li>
            <strong>Population baseline:</strong> {result.baselineRemainingYears.toFixed(2)} remaining
            years at age {answers.age}
            {answers.sex === 'average' ? ', sex Not stated (average of male and female)' : ` (${answers.sex} table)`}.
          </li>
          <li>
            <strong>Lifestyle / health factor (combined):</strong>{' '}
            {(result.appliedMultiplier * 100).toFixed(1)}% of baseline (raw {(result.rawMultiplier * 100).toFixed(1)}%,
            clamped for stability).
          </li>
          <li>
            <strong>Source:</strong>{' '}
            <a href={citation.url} target="_blank" rel="noreferrer">
              {citation.label}
            </a>
            . {citation.note}
          </li>
          {current ? (
            <li>
              <strong>Same table elsewhere in the planner:</strong> the percentile planning age and the lifespans
              Monte Carlo draws use this table&apos;s death probabilities. The life expectancy they imply differs from
              SSA&apos;s printed figure above by at most 0.005 years.
            </li>
          ) : null}
        </ul>
        {current ? null : (
          <p className="muted" data-testid="longevity-older-table">
            Saved on the {citation.label}. The planner now uses the {BASELINE_CITATION.label}. Edit your answers to
            recompute this estimate on it.
          </p>
        )}
      </section>

      <p className="muted small">Last saved locally: {updated}</p>

      <div className="wizard-actions">
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          Edit answers
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            onClear()
          }}
        >
          Clear saved data
        </button>
      </div>
    </div>
  )
}
