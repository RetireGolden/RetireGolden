import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Plan } from '../../engine/model/plan'
import { usePlan } from '../planContextCore'
import { useProjection, taxCalculatorFor, seedFromPlanId } from '../useProjection'
import { packForYear } from '../../engine/params'
import { applyScenarioPatch } from '../../engine/scenarios/scenarios'
import { createDecisionContext, evaluateInsightAction } from '../../engine/decisions'
import { runMonteCarlo } from '../../mc/pool'
import { registry } from '../../engine/insights/registry'
import type { InsightAction, InsightCard, InsightImpact } from '../../engine/insights/types'
import { LearnLink } from '../../learn/LearnLink'
import { fmtMoney, fmtMoneyCompact } from '../format'

function makeScenarioId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `scenario-${crypto.randomUUID()}`
    : `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function uniqueScenarioName(baseName: string, plan: Plan): string {
  const names = new Set(plan.scenarios.map((scenario) => scenario.name))
  if (!names.has(baseName)) return baseName

  let suffix = 2
  while (names.has(`${baseName} (${suffix})`)) {
    suffix += 1
  }
  return `${baseName} (${suffix})`
}

export function InsightCardView({ card, onDismiss }: { card: InsightCard; onDismiss: () => void }) {
  const { plan, update } = usePlan()
  const projectionView = useProjection(plan)
  const navigate = useNavigate()

  const [expanded, setExpanded] = useState(false)
  const [exactImpact, setExactImpact] = useState<InsightImpact | null>(null)
  // Detectors may refine their action during evaluate() (e.g. the spending
  // headroom card solves the exact level); Add-as-scenario must use that one.
  const [exactAction, setExactAction] = useState<InsightAction | null>(null)
  const [mcDelta, setMcDelta] = useState<number | null>(null)
  const [loadingExact, setLoadingExact] = useState(false)
  const [loadingMc, setLoadingMc] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [undoPlan, setUndoPlan] = useState<Plan | null>(null)

  const handleToggleExpand = async () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    setPreviewError(null)

    if (nextExpanded && card.action.kind === 'preview-scenario' && !exactImpact && !loadingExact) {
      setLoadingExact(true)
      try {
        const detector = registry.find((d) => d.id === card.id)
        if (!detector || !detector.evaluate) {
          setPreviewError('This insight cannot be previewed yet.')
          return
        }

        const paramsLookup = packForYear(projectionView.startYear)
        const ctx = {
          plan,
          projection: {
            result: projectionView.result,
            summary: projectionView.summary,
            startYear: projectionView.startYear,
            deflate: projectionView.deflate,
          },
          params: paramsLookup.pack,
        }

        const evalResult = detector.evaluate(ctx)
        if (evalResult.action.kind === 'preview-scenario') {
          const patch = evalResult.action.patch
          const applied = applyScenarioPatch(plan, patch)
          if (applied.ok) {
            // Shared exact-ledger evaluator (decision engine): the same core
            // the Roth & Tax Optimizer tournament uses, so this card's exact
            // deltas and recommendation state match that surface. Baseline is
            // reused from the memoized projection — one extra simulate() only.
            const decisionCtx = createDecisionContext(
              plan,
              { startYear: projectionView.startYear, taxCalculator: taxCalculatorFor(plan) },
              { result: projectionView.result, summary: projectionView.summary },
              // Per-candidate tax stacks: a preview patch may change tax
              // assumptions (e.g. relocation clearing the flat override).
              taxCalculatorFor,
            )
            const { evaluation, impact } = evaluateInsightAction(decisionCtx, card, evalResult.action)
            if (evaluation.recommendationState === 'diagnostic') {
              setPreviewError(evaluation.diagnostics.join(' ') || 'This insight could not be compared against the base plan.')
            } else {
              // Keep the detector's own evaluated summary line (e.g. the solved
              // spending level) alongside the shared evaluator's exact deltas.
              setExactImpact(
                evalResult.impact?.qualitative ? { ...impact, qualitative: evalResult.impact.qualitative } : impact,
              )
              setExactAction(evalResult.action)

              // If it impacts Monte Carlo success rate, run async MC pool query
              if (card.impact.successRateDeltaPct !== undefined) {
                setLoadingMc(true)
                const seed = seedFromPlanId(plan.id)
                const model = { type: 'historical' as const, mode: 'iid' as const, equityWeightPct: 60 }
                const mcOpts = {
                  startYear: projectionView.startYear,
                  pathCount: 250, // fast preview size
                  seed,
                  model,
                }
                const [baseMc, patchMc] = await Promise.all([
                  runMonteCarlo(plan, mcOpts),
                  runMonteCarlo(applied.plan, mcOpts),
                ])
                setMcDelta((patchMc.successRate - baseMc.successRate) * 100)
                setLoadingMc(false)
              }
            }
          } else {
            setPreviewError(`This suggestion can't be applied to your plan: ${applied.issues.join('; ')}`)
          }
        }
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : 'Failed to evaluate this insight.')
        setLoadingMc(false)
      } finally {
        setLoadingExact(false)
      }
    }
  }

  const handleAddScenario = () => {
    const action = exactAction?.kind === 'preview-scenario' ? exactAction : card.action
    if (action.kind !== 'preview-scenario') return
    const applied = applyScenarioPatch(plan, action.patch)
    if (!applied.ok) {
      setPreviewError(`This suggestion can't be applied to your plan: ${applied.issues.join('; ')}`)
      return
    }
    const name = uniqueScenarioName(action.scenarioName, plan)
    update((d) => {
      d.scenarios.push({
        id: makeScenarioId(),
        name,
        patch: action.patch,
      })
    })
    navigate(`/plan/${plan.id}/scenarios`)
  }

  const handleApplyToggle = () => {
    if (card.action.kind !== 'apply-toggle') return
    const applied = applyScenarioPatch(plan, card.action.patch)
    if (!applied.ok) {
      setPreviewError(`This change can't be applied to your plan: ${applied.issues.join('; ')}`)
      return
    }
    setUndoPlan(plan)
    update((d) => {
      Object.assign(d, applied.plan)
    })
  }

  const handleUndoToggle = () => {
    if (!undoPlan) return
    const previous = undoPlan
    setUndoPlan(null)
    update((d) => {
      Object.assign(d, previous)
    })
  }

  // Formatting helpers
  const formatDelta = (val: number, isGoodPositive = true) => {
    if (val === 0) return 'no change'
    const sign = val > 0 ? '+' : ''
    const good = (val > 0 && isGoodPositive) || (val < 0 && !isGoodPositive)
    return (
      <span className={good ? 'delta-pos' : 'delta-neg'}>
        {sign}
        {fmtMoney(val)}
      </span>
    )
  }

  const confidenceChips = {
    high: { className: 'type-chip type-chip--good', label: 'High Confidence' },
    medium: { className: 'type-chip type-chip--warn', label: 'Medium Confidence' },
    low: { className: 'type-chip type-chip--muted', label: 'Low Confidence' },
  }
  const confidence = confidenceChips[card.confidence]

  return (
    <div className="card insight-card">
      <button
        type="button"
        className="btn-ghost insight-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss this recommendation"
        title="Dismiss this recommendation"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      {/* Cards always render under their category's group heading, so the
          category chip would just repeat it — only the confidence chip earns
          its place. */}
      <div className="insight-badges">
        <span className={confidence.className}>{confidence.label}</span>
      </div>

      <h3 className="insight-card-title">{card.title}</h3>
      <p className="insight-rationale">{card.rationale}</p>

      {/* Impact Section */}
      <div className="insight-impact-box">
        {expanded && exactImpact ? (
          <div>
            {exactImpact.qualitative ? <p>{exactImpact.qualitative}</p> : null}
            <div className="insight-impact-grid">
              {exactImpact.endingAfterTaxEstateDelta !== undefined && (
                <div>
                  <span className="muted">Ending estate delta:</span>{' '}
                  {formatDelta(exactImpact.endingAfterTaxEstateDelta, true)}
                </div>
              )}
              {exactImpact.lifetimeTaxDelta !== undefined && (
                <div>
                  <span className="muted">Lifetime tax delta:</span>{' '}
                  {formatDelta(exactImpact.lifetimeTaxDelta, false)}
                </div>
              )}
              {card.impact.successRateDeltaPct !== undefined && (
                <div>
                  <span className="muted">Monte Carlo success:</span>{' '}
                  {loadingMc ? (
                    <span className="muted">calculating…</span>
                  ) : mcDelta !== null ? (
                    <span className={mcDelta >= 0 ? 'delta-pos' : 'delta-neg'}>
                      {mcDelta > 0 ? '+' : ''}
                      {mcDelta.toFixed(1)}%
                    </span>
                  ) : (
                    '--'
                  )}
                </div>
              )}
            </div>
            <div className="insight-impact-note">
              * Calculated by running a full plan re-simulation side-by-side.
            </div>
          </div>
        ) : (
          <div>
            <strong>Estimated impact:</strong>{' '}
            {card.impact.qualitative ? (
              <span>{card.impact.qualitative}</span>
            ) : (
              <span>
                {card.impact.endingAfterTaxEstateDelta !== undefined && (
                  <span>≈ {fmtMoneyCompact(card.impact.endingAfterTaxEstateDelta)} estate delta </span>
                )}
                {card.impact.lifetimeTaxDelta !== undefined && (
                  <span>≈ {fmtMoneyCompact(card.impact.lifetimeTaxDelta)} tax savings </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {previewError && (
        <div className="callout callout--warn insight-error" role="alert">
          {previewError}
        </div>
      )}

      {/* Actions Row */}
      <div className="insight-actions">
        <div className="insight-actions-links">
          {card.learnSlug && <LearnLink slug={card.learnSlug} label="Learn more" />}
          {card.plannerRoute && (
            <Link to={`/plan/${plan.id}/${card.plannerRoute}`} className="learn-link">
              Go to screen
            </Link>
          )}
        </div>

        <div className="insight-actions-buttons">
          {card.action.kind === 'preview-scenario' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleToggleExpand}
                disabled={loadingExact}
              >
                {loadingExact ? 'Loading…' : expanded ? 'Hide preview' : 'Preview impact'}
              </button>
              {expanded && exactImpact && (
                <button type="button" className="btn btn-primary btn-small" onClick={handleAddScenario}>
                  Add as scenario
                </button>
              )}
            </>
          )}
          {card.action.kind === 'advisory' && (
            <span className="insight-advisory-note">Advisory only</span>
          )}
          {card.action.kind === 'apply-toggle' && (
            <>
              <button type="button" className="btn btn-primary btn-small" onClick={handleApplyToggle}>
                Apply to plan
              </button>
              {undoPlan && (
                <button type="button" className="btn btn-secondary btn-small" onClick={handleUndoToggle}>
                  Undo
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
