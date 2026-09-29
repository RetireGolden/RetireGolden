import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Plan } from '@retiregolden/engine/model/plan'
import { usePlan } from '../planContextCore'
import { TypeChip } from '../TypeChip'
import { useWorkspaceReadOnly } from '../../data/workspaceReadOnly'
import { projectionStartYear, useProjection, taxCalculatorFor } from '../useProjection'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import {
  compareMonteCarloSuccessRates,
  createDecisionContext,
  evaluateInsightAction,
} from '@retiregolden/engine/decisions'
import { runMonteCarlo } from '../../mc/pool'
import { guardrailPreviewUnpricedCreditRefusal } from '../acaVetoCopy'
import { headlineMcRun, headlineMcRunOptions } from '../useMcSuccessRate'
import { insightDetectorContext } from './insightContext'
import { registry } from '@retiregolden/engine/insights/registry'
import type { InsightAction, InsightCard, InsightImpact } from '@retiregolden/engine/insights/types'
import { LearnLink } from '../../learn/LearnLink'
import { sectionTitleOf } from '../sectionTitles'
import { fmtMoney, fmtMoneyCompact } from '../format'
import { insightPreviewErrorSentence } from '../engineRefusalCopy'
import { uniqueScenarioName } from '../scenarioNames'
import { formatMcDelta } from './mcDeltaFormat'

function makeScenarioId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `scenario-${crypto.randomUUID()}`
    : `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function InsightCardView({ card, onDismiss }: { card: InsightCard; onDismiss: () => void }) {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const projectionView = useProjection(plan, projectionStartYear(plan))
  const navigate = useNavigate()

  // Whether Preview also runs the Monte Carlo pair is the detector's property,
  // never a figure on the card (B2-P1 slice 3).
  const detector = registry.find((d) => d.id === card.id)
  const previewsMonteCarlo = detector?.previewsMonteCarlo === true

  const [expanded, setExpanded] = useState(false)
  // Preview results are keyed to the plan object they were computed for and
  // read as absent once the plan changes, so a stale delta can never sit
  // beside a newer plan's depletion year; the next Preview recomputes them.
  const [exactImpactFor, setExactImpactFor] = useState<{ plan: Plan; impact: InsightImpact } | null>(null)
  const exactImpact = exactImpactFor !== null && exactImpactFor.plan === plan ? exactImpactFor.impact : null
  const setExactImpact = (impact: InsightImpact) => setExactImpactFor({ plan, impact })
  // Detectors may refine their action during evaluate() (e.g. the spending
  // headroom card solves the exact level); Add-as-scenario must use that one.
  const [exactActionFor, setExactActionFor] = useState<{ plan: Plan; action: InsightAction } | null>(null)
  const exactAction = exactActionFor !== null && exactActionFor.plan === plan ? exactActionFor.action : null
  const setExactAction = (action: InsightAction) => setExactActionFor({ plan, action })
  const [mcDeltaFor, setMcDeltaFor] = useState<{ plan: Plan; delta: number } | null>(null)
  const mcDelta = mcDeltaFor !== null && mcDeltaFor.plan === plan ? mcDeltaFor.delta : null
  const setMcDelta = (delta: number) => setMcDeltaFor({ plan, delta })
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
        if (!detector || !detector.evaluate) {
          setPreviewError('This insight cannot be previewed yet.')
          return
        }

        const ctx = insightDetectorContext(plan, projectionView)

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
              // The guardrail preview keeps its refusal on a year whose premium
              // tax credit is unpriced, and says which years and why in plain
              // words rather than in the engine's sentence (decision of
              // 2026-09-26). Other refusals keep the engine's diagnostics.
              const unpricedCredit =
                card.id === 'spending-guardrails'
                  ? guardrailPreviewUnpricedCreditRefusal(projectionView.result.years, evaluation.candidateResult.years, plan.expenses.healthcare)
                  : null
              setPreviewError(
                unpricedCredit ??
                  (evaluation.diagnostics.join(' ') || 'This insight could not be compared against the base plan.'),
              )
            } else {
              // Keep the detector's own evaluated summary line (e.g. the solved
              // spending level) alongside the shared evaluator's exact deltas.
              setExactImpact(
                evalResult.impact?.qualitative ? { ...impact, qualitative: evalResult.impact.qualitative } : impact,
              )
              setExactAction(evalResult.action)
              // The exact dollar deltas are final here: release the button so
              // the reader can hide the preview while the slower Monte Carlo
              // pair below is still running (#527).
              setLoadingExact(false)

              // The Monte Carlo pair runs the headline configuration (owner
              // decision R11): the base side is the run whose rate the KPI bar
              // shows, reused when it is published or in flight, and the
              // previewed plan runs on the same model (built from the base
              // plan), seed, path count and start year, so path N is one
              // market for both, even when the base run is from before a New
              // Year the plan object outlived (PR #754 findings 1 and 2).
              if (previewsMonteCarlo) {
                setLoadingMc(true)
                const base = await headlineMcRun(plan)
                const options = headlineMcRunOptions(plan, base.pathCount, base.startYear)
                const previewed = await runMonteCarlo(applied.plan, options)
                setMcDelta(
                  compareMonteCarloSuccessRates(base, {
                    successRate: previewed.successRate,
                    pathCount: previewed.pathCount,
                    startYear: options.startYear,
                  }).delta,
                )
                setLoadingMc(false)
              }
            }
          } else {
            setPreviewError(`This insight can't be applied to your plan: ${applied.issues.join('; ')}`)
          }
        }
      } catch (err) {
        // A refusal or failure in plain words with a next step, never the
        // engine's wording; a detector that found nothing to preview says why
        // in its own words (PR #754).
        setPreviewError(insightPreviewErrorSentence(err))
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
      setPreviewError(`This insight can't be applied to your plan: ${applied.issues.join('; ')}`)
      return
    }
    const name = uniqueScenarioName(
      action.scenarioName,
      plan.scenarios.map((scenario) => scenario.name),
    )
    update((d) => {
      d.scenarios.push({
        id: makeScenarioId(),
        name,
        patch: action.patch,
      })
    })
    void navigate(`/plan/${plan.id}/scenarios`)
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

  // A Monte Carlo delta the one-decimal display would print as 0.0 is "no
  // change": its sign must not paint it in a verdict color (#527).
  const mcLabel = mcDelta === null ? null : formatMcDelta(mcDelta)
  const mcFlat = mcLabel !== null && mcLabel.flat
  // Every delta this card defines is zero (dollar deltas exact; the Monte
  // Carlo line, if the card has one, settled and flat). The base plan running
  // out of money is stated beside that as a fact, not as the cause: the
  // evaluator reports no depletion delta, so the cause is not verified here.
  const baseDepletionYear = projectionView.summary.depletionYear
  const definedDollarDeltas = exactImpact === null
    ? []
    : [exactImpact.endingAfterTaxEstateDelta, exactImpact.lifetimeTaxDelta].filter((v): v is number => v !== undefined)
  const mcSettledFlat = previewsMonteCarlo ? !loadingMc && mcFlat : true
  // At least one delta of any kind must be defined: a card with only a Monte
  // Carlo line still gets the note when that line is settled and flat.
  const anyDeltaDefined = definedDollarDeltas.length > 0 || previewsMonteCarlo
  const allFlat = anyDeltaDefined && definedDollarDeltas.every((v) => v === 0) && mcSettledFlat

  const confidenceChips = {
    high: { className: 'type-chip--good', label: 'High Confidence' },
    medium: { className: 'type-chip--warn', label: 'Medium Confidence' },
    low: { className: 'type-chip--muted', label: 'Low Confidence' },
  }
  const confidence = confidenceChips[card.confidence]

  return (
    <div className="card insight-card" data-insight-id={card.id}>
      {/* The accessible name carries the insight title (#505): with several
          findings on screen, "Dismiss this insight" was one name repeated. */}
      <button
        type="button"
        className="btn-ghost insight-dismiss"
        onClick={onDismiss}
        aria-label={`Dismiss insight: ${card.title}`}
        title={`Dismiss insight: ${card.title}`}
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
        <TypeChip className={confidence.className}>{confidence.label}</TypeChip>
      </div>

      <h3 className="insight-card-title">{card.title}</h3>
      <p className="insight-rationale">{card.rationale}</p>

      {/* Impact Section */}
      <div className="insight-impact-box">
        {expanded && loadingExact && !exactImpact ? (
          // The wait shows where the numbers will land, as a shimmer with a
          // visible caption, not as a greyed button elsewhere on the card (#527).
          <div className="insight-preview-wait" role="status">
            <div className="skeleton" style={{ height: '2.5rem' }} aria-hidden="true" />
            <p className="small muted">Re-simulating this plan…</p>
          </div>
        ) : expanded && exactImpact ? (
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
              {previewsMonteCarlo && (
                <div>
                  <span className="muted">Monte Carlo success:</span>{' '}
                  {loadingMc ? (
                    <span className="muted" role="status" aria-busy="true">
                      still simulating…
                    </span>
                  ) : mcLabel !== null ? (
                    mcLabel.flat ? (
                      'no change'
                    ) : (
                      <span className={mcLabel.good ? 'delta-pos' : 'delta-neg'}>{mcLabel.text}</span>
                    )
                  ) : (
                    '—'
                  )}
                </div>
              )}
            </div>
            {allFlat && baseDepletionYear !== null ? (
              <p className="small muted insight-flat-note">
                Every delta shown is zero. The base plan runs out of money in {baseDepletionYear}.
              </p>
            ) : null}
            <div className="insight-impact-note">
              * Calculated by running a full plan re-simulation side-by-side.
              {loadingMc ? ' The Monte Carlo line is still running; the dollar deltas above are final.' : ''}
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
              Go to {sectionTitleOf(card.plannerRoute) ?? 'screen'}
            </Link>
          )}
        </div>

        <div className="insight-actions-buttons">
          {card.action.kind === 'preview-scenario' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => void handleToggleExpand()}
                disabled={loadingExact}
                aria-busy={loadingExact || loadingMc || undefined}
              >
                {loadingExact ? 'Previewing…' : expanded ? 'Hide preview' : 'Preview impact'}
              </button>
              {expanded && exactImpact && (
                <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={handleAddScenario}>
                  Add as scenario
                </button>
              )}
            </>
          )}
          {card.action.kind === 'advisory' && (
            <span className="insight-advisory-note">Informational only</span>
          )}
          {card.action.kind === 'apply-toggle' && (
            <>
              <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={handleApplyToggle}>
                Apply to plan
              </button>
              {undoPlan && (
                <button type="button" className="btn btn-secondary btn-small" disabled={readOnly} onClick={handleUndoToggle}>
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
