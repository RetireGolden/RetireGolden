import { BASELINE_CITATION } from './constants'
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
            {result.bandLowRemainingYears.toFixed(1)} – {result.bandHighRemainingYears.toFixed(1)}
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
            years at age {answers.age} ({answers.sex === 'average' ? 'average of male/female' : `${answers.sex} table`}).
          </li>
          <li>
            <strong>Lifestyle / health factor (combined):</strong>{' '}
            {(result.appliedMultiplier * 100).toFixed(1)}% of baseline (raw {(result.rawMultiplier * 100).toFixed(1)}%,
            clamped for stability).
          </li>
          <li>
            <strong>Source:</strong>{' '}
            <a href={BASELINE_CITATION.url} target="_blank" rel="noreferrer">
              {BASELINE_CITATION.label}
            </a>
            . {BASELINE_CITATION.note}
          </li>
        </ul>
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
