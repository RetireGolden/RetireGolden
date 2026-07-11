/**
 * Optimize tab (roadmap V8): runs the multi-year withdrawal/Roth optimizer in a
 * Web Worker, then shows the proposed conversion schedule and its effect on the
 * after-tax estate versus the plan's current strategy — measured on the EXACT
 * ledger (the worker's MILP is a linearisation; these headline numbers come from
 * re-running `simulate` with the proposed schedule, per V8 §3.1). The result is
 * advisory: "Apply" installs it as an optimized strategy, "Accept as manual"
 * rewrites it as an editable manual schedule.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import { objectivePolicies, type ObjectivePolicyId } from '@retiregolden/engine/decisions'
import {
  type ExactLedgerRecommendationState,
  type ExactLedgerValidation,
  withOptimizedConversions,
} from '@retiregolden/engine/projection/optimizePlan'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import type { OptimizeResult } from '../optimize/messages'
import { runOptimize } from '../optimize/runner'
import { downloadStandaloneReport } from '../report/downloadReport'
import { useReportBranding } from '../report/brandingContext'
import { reportEvidenceFromOptimizeResult } from '../report/reportHtml'
import { usePlan } from './planContextCore'
import { WhyRecommendationPanel } from './explainPanels'
import { CheckboxField, HelpTip, SelectField } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney, fmtMoneyCompact } from './format'
import { LEARN } from './learnLinks'
import { buildOptimizeChartRows, shouldShowRecommendedScheduleBars } from './optimizePageChart'
import { applyOptimizeRecommendation, claimEstateGain, planWithWinningClaim } from './optimizePageClaim'
import { currentStartYear, projectPlan, seedFromPlanId } from './useProjection'
import { chartTooltipStyle } from './chartStyle'

function DeltaStat({
  label,
  value,
  tone,
  help,
}: {
  label: string
  value: string
  tone: 'good' | 'bad' | 'neutral'
  help: string
}) {
  return (
    <div className="card">
      <span className="field-label-row">
        <span className="field-label">{label}</span>
        <HelpTip text={help} />
      </span>
      <div className={`stat-value stat-value--${tone}`}>{value}</div>
    </div>
  )
}

function recommendationHeading(validation: ExactLedgerValidation): string {
  switch (validation.recommendationState) {
    case 'beneficial':
      return `Up to ${fmtMoney(validation.afterTaxEstateDelta)} more for your heirs.`
    case 'neutral':
      return 'The optimizer matches your current strategy.'
    case 'rejected':
      return 'This lower-tax schedule is not recommended.'
    case 'unexecutable':
      return 'This conversion schedule is mostly theoretical.'
  }
}

function recommendationBody(validation: ExactLedgerValidation): string {
  const requested = fmtMoney(validation.requestedConversionTotal)
  const executed = fmtMoney(validation.executedConversionTotal)
  const from = fmtMoneyCompact(validation.baseline.endingAfterTaxEstate)
  const to = fmtMoneyCompact(validation.candidate.endingAfterTaxEstate)
  const taxPhrase =
    validation.lifetimeTaxDelta < 0
      ? `lowers lifetime tax by ${fmtMoney(Math.abs(validation.lifetimeTaxDelta))}`
      : validation.lifetimeTaxDelta > 0
        ? `raises lifetime tax by ${fmtMoney(validation.lifetimeTaxDelta)}`
        : 'leaves lifetime tax unchanged'

  switch (validation.recommendationState) {
    case 'beneficial':
      return `Converting ${requested} raises your projected after-tax estate from ${from} to ${to}.`
    case 'neutral':
      return `Converting ${requested} leaves your projected after-tax estate essentially unchanged at ${to}.`
    case 'rejected':
      return `Converting ${requested} ${taxPhrase}, but your projected after-tax estate moves from ${from} to ${to}.`
    case 'unexecutable':
      return `The optimizer proposed converting ${requested}, but only ${executed} could actually be converted — the traditional balance it counted on is not available in the plan years shown.`
  }
}

function stateColor(state: ExactLedgerRecommendationState): string {
  if (state === 'beneficial') return 'var(--good)'
  if (state === 'rejected' || state === 'unexecutable') return 'var(--bad)'
  return 'var(--fg)'
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function totalScheduleConversions(schedule: OptimizedSchedule | null): number {
  return schedule?.conversions.reduce((a, c) => a + c.amount, 0) ?? 0
}

/**
 * Objectives offered on this surface. `max-sustainable-spending` is excluded:
 * conversion candidates never change base spending, so it cannot separate them
 * — that objective lives on the "How much can I spend?" page instead.
 */
const OBJECTIVE_CHOICES: ReadonlyArray<{ value: ObjectivePolicyId; label: string }> = [
  'max-after-tax-estate',
  'max-spending-durability',
  'min-lifetime-tax-estate-floor',
  'protect-survivor-liquidity',
  'bridge-durability',
  'max-downside-resilience',
].map((id) => ({ value: id as ObjectivePolicyId, label: objectivePolicies[id as ObjectivePolicyId].label }))

export function OptimizePage() {
  const { plan, update } = usePlan()
  const reportBranding = useReportBranding()
  const startYear = currentStartYear()

  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mcRate, setMcRate] = useState<number | null>(null)
  const [objectiveId, setObjectiveId] = useState<ObjectivePolicyId>('max-after-tax-estate')
  // Default-off: the claim grid re-runs the full optimizer for every claim
  // combination (up to ~7×), so the user opts into the extra runtime per session.
  const [coOptimizeClaim, setCoOptimizeClaim] = useState(false)
  const runToken = useRef(0)

  const hasSocialSecurityIncome = plan.incomes.some((s) => s.type === 'socialSecurity')
  const coOptimizeRequested = coOptimizeClaim && hasSocialSecurityIncome

  // Derived-state-during-render (same pattern as fields.tsx useLocalText): if
  // every SS stream is removed the checkbox unmounts but its state would
  // survive, so re-adding a stream would silently resurrect the expensive
  // joint-grid run. Clear it — the toggle stays a deliberate opt-in.
  const [prevHasSsIncome, setPrevHasSsIncome] = useState(hasSocialSecurityIncome)
  if (prevHasSsIncome !== hasSocialSecurityIncome) {
    setPrevHasSsIncome(hasSocialSecurityIncome)
    if (!hasSocialSecurityIncome) setCoOptimizeClaim(false)
  }

  const schedule = optimizeResult?.schedule ?? null
  const postProcessed = optimizeResult?.postProcessed ?? null
  const tournament = optimizeResult?.tournament ?? null
  // The exact-ledger tournament arbitrates the recommendation: when a simple
  // candidate strategy beats the post-processed MILP schedule on the exact
  // after-tax estate, its schedule is what the page shows and applies.
  const candidateWins = tournament?.winnerSource === 'candidate'
  // Nothing evaluated beat the plan's already-installed conversion strategy —
  // the usual state right after applying a winning schedule and re-running.
  // Rendered as a calm "no change recommended" card, not a rejected-schedule
  // diagnostic (the deltas on this page are always vs the current plan, so a
  // fresh solver proposal that loses to the incumbent shows scary negatives).
  const incumbentHolds = tournament?.winnerSource === 'incumbent'
  const candidateReplacedMilp = candidateWins && postProcessed?.recommendationSchedule === 'cleaned'
  const displaySchedule = postProcessed?.cleanedSchedule ?? schedule
  const recommendedConversions = useMemo(
    () =>
      incumbentHolds
        ? [] // the plan already holds the best schedule — nothing to apply or Monte-Carlo
        : candidateWins
          ? tournament!.winnerConversions
          : (displaySchedule?.conversions ?? []),
    [incumbentHolds, candidateWins, tournament, displaySchedule],
  )
  // Step 5 claim-age co-optimization: when a claim change won, the schedule and
  // every validation delta on this page were computed against the claim-patched
  // plan, so Monte Carlo, the report, and Apply must all start from it.
  const claimAge = optimizeResult?.claimAge ?? null
  const claimChangeRecommended = claimAge?.winningClaimPatch != null
  const planForRecommendation = useMemo(() => planWithWinningClaim(plan, claimAge), [plan, claimAge])
  const optimizedPlan = useMemo(() => {
    if (recommendedConversions.length > 0) return withOptimizedConversions(planForRecommendation, recommendedConversions)
    // A claim change with no conversion change (the incumbent schedule holds
    // under the new claim) is still a recommendation worth pricing and reporting.
    return claimChangeRecommended ? planForRecommendation : null
  }, [planForRecommendation, recommendedConversions, claimChangeRecommended])
  const validation = candidateWins ? (tournament?.winnerValidation ?? null) : (postProcessed?.cleanedValidation ?? null)

  const run = useCallback(() => {
    const token = ++runToken.current
    setRunning(true)
    setError(null)
    setMcRate(null)
    runOptimize({ plan, startYear, objectivePolicyId: objectiveId, coOptimizeClaimAge: coOptimizeRequested })
      .then((s) => {
        if (token === runToken.current) setOptimizeResult(s)
      })
      .catch((e: unknown) => {
        if (token === runToken.current) {
          setError(e instanceof Error ? e.message : String(e))
          // Drop any prior result so a stale chart/Apply can't render against
          // inputs the optimizer just failed on.
          setOptimizeResult(null)
        }
      })
      .finally(() => {
        if (token === runToken.current) setRunning(false)
      })
  }, [plan, startYear, objectiveId, coOptimizeRequested])

  // Auto-run on plan / rate change (debounced).
  useEffect(() => {
    const t = window.setTimeout(run, 300)
    return () => window.clearTimeout(t)
  }, [run])

  // Auto Monte Carlo success-% for the proposed schedule (V8 §1.6).
  useEffect(() => {
    if (!optimizedPlan) return
    let cancelled = false
    void runMonteCarlo(optimizedPlan, {
      startYear,
      pathCount: DEFAULT_PATH_COUNT,
      seed: seedFromPlanId(plan.id),
      model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct, returnVolPct: 12 },
    }).then((s) => {
      if (!cancelled) setMcRate(s.successRate)
    })
    return () => {
      cancelled = true
    }
  }, [optimizedPlan, startYear, plan.id, plan.assumptions.inflationPct])

  const estateDelta = validation?.afterTaxEstateDelta ?? 0
  const taxDelta = validation?.lifetimeTaxDelta ?? 0
  const totalConversions = recommendedConversions.reduce((sum, c) => sum + c.amount, 0)
  const rawConversions = totalScheduleConversions(schedule)
  const executedConversions = validation?.executedConversionTotal ?? 0
  const hasPostProcessingAdjustments = (postProcessed?.adjustments.length ?? 0) > 0
  const hasExecutionMismatch =
    !candidateWins &&
    (hasPostProcessingAdjustments ||
      (validation?.firstMateriallyUnexecutedYear !== null && validation?.firstMateriallyUnexecutedYear !== undefined))
  const showRecommendedBars = shouldShowRecommendedScheduleBars(candidateWins, hasExecutionMismatch)
  const recommendationState = validation?.recommendationState ?? 'neutral'
  const blocksApply = candidateWins
    ? false
    : recommendationState === 'rejected' ||
      recommendationState === 'unexecutable' ||
      postProcessed?.recommendationSchedule === 'none'
  // A claim change can win on estate alone while the conversion side is
  // unappliable (incumbent holds, empty/infeasible schedule, or diagnostic-only
  // result). The claim card then carries its own apply control so the winning
  // claim change is never advertised without a way to install it.
  const scheduleApplyAvailable = recommendedConversions.length > 0 && !blocksApply

  const chartRows = useMemo(
    () => buildOptimizeChartRows({ schedule, recommendedConversions, postProcessed, candidateWins }),
    [schedule, recommendedConversions, postProcessed, candidateWins],
  )

  const apply = (mode: 'optimized' | 'manual') => {
    if (recommendedConversions.length === 0 || blocksApply) return
    // Claim change and schedule install together: the schedule was computed
    // against the claim-patched plan, so conversions alone would be wrong.
    update((d) => applyOptimizeRecommendation(d, { claimAge, conversions: recommendedConversions, mode }))
  }

  // The incumbent-holds path has no schedule to install, but a winning claim
  // change is still an actionable recommendation on its own (the current
  // conversion strategy already holds under the new claim ages).
  const applyClaimChangeOnly = () => {
    if (!claimChangeRecommended) return
    update((d) => applyOptimizeRecommendation(d, { claimAge, conversions: [], mode: 'optimized' }))
  }

  const rerunButton = (label = 'Re-run optimizer') => (
    <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={run}>
      {running ? 'Optimizing...' : label}
    </button>
  )

  const downloadRecommendationReport = () => {
    if (!optimizeResult) return
    // Report the plan the evidence section describes: when the optimizer recommends
    // a schedule, project that recommended plan so the headline results and ledger
    // appendix match the recommendation. When nothing beats the incumbent (no
    // optimizedPlan), the recommendation is "no change", so the current plan is correct.
    const reportPlan = optimizedPlan ?? plan
    const view = projectPlan(reportPlan, startYear)
    downloadStandaloneReport({
      plan: reportPlan,
      result: view.result,
      summary: view.summary,
      startYear,
      recommendationEvidence: reportEvidenceFromOptimizeResult(optimizeResult),
      branding: reportBranding,
    })
  }

  return (
    <section>
      <div className="card">
        <h2>Roth & Tax Optimizer</h2>
        <p className="card-hint">
          Search for a Roth-conversion & withdrawal schedule, then rank the candidates by the objective you choose.
          The default leaves the most after-tax wealth to your heirs; other modes can favor spending durability,
          lifetime tax with an estate floor, survivor liquidity, or bridge-year resilience. RetireGolden generates
          candidate schedules (a multi-year math program over federal brackets, IRMAA thresholds, and RMDs, plus
          simple bracket-fill and cliff-cap strategies), compares every candidate on your full year-by-year
          projection, and recommends the best result it found within the search limits.
        </p>
        <p className="field-hint">
          Using the {formatPct(plan.assumptions.heirTaxRatePct / 100)} heir tax rate from{' '}
          <Link to={`/plan/${plan.id}/assumptions`}>Assumptions</Link>.
        </p>
        <div className="form-grid" style={{ marginTop: '0.5rem' }}>
          <SelectField
            label="Optimize for"
            help="What 'better' means when candidate schedules are ranked on your full year-by-year projection. The default maximizes the after-tax estate; other objectives re-rank the same evaluations — money lasting longer, lowest lifetime tax without breaking the estate floor, the worst-case balance in survivor years, or the worst-case balance across pre-Social-Security bridge years. Every objective still hard-rejects candidates that shorten how long the money lasts."
            hint={objectivePolicies[objectiveId].description}
            learn={LEARN.optimizerObjectives}
            value={objectiveId}
            options={OBJECTIVE_CHOICES}
            onCommit={setObjectiveId}
          />
          {hasSocialSecurityIncome ? (
            <CheckboxField
              label="Also optimize Social Security claim age"
              help="Re-runs the full conversion optimizer at each canonical claim age (62 / full retirement age / 70, for up to two Social Security streams) and recommends the claim-age + conversion pair with the best projected after-tax estate. A claim change must beat the current-claim optimum by a clear margin to be recommended."
              hint="Re-runs the full optimizer once per claim combination — expect several times longer than a standard run."
              value={coOptimizeClaim}
              onCommit={setCoOptimizeClaim}
            />
          ) : null}
        </div>
        {running ? (
          <>
            <div className="skeleton" style={{ height: '2rem', marginTop: '0.75rem' }} aria-label="Optimizing" />
            {coOptimizeRequested ? (
              <p className="field-hint" style={{ margin: '0.5rem 0 0' }} role="status">
                Also optimizing Social Security claim age: the optimizer is re-run in full for every claim
                combination, so this takes several times longer than a standard optimize.
              </p>
            ) : null}
          </>
        ) : null}
        {error ? <p style={{ color: 'var(--bad)' }}>Optimizer error: {error}</p> : null}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!schedule && !running ? rerunButton(error ? 'Try again' : 'Run optimizer') : null}
          {/* Also disabled while re-running: the held result (and any claim
              patch in it) describes the pre-edit plan, so a report downloaded
              mid-run would mix live plan fields with stale recommendations. */}
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={!optimizeResult || running}
            onClick={downloadRecommendationReport}
          >
            Download recommendation report
          </button>
        </div>
      </div>

      {schedule && !running && claimAge?.enabled ? (
        claimChangeRecommended ? (
          <div className="card" style={{ borderColor: 'var(--good)' }}>
            <h2 style={{ margin: '0 0 0.35rem', color: 'var(--good)' }}>
              Recommended claim change: {claimAge.winningClaimLabel}
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Changing the claim age and re-optimizing conversions is worth{' '}
              <strong>{fmtMoney(claimEstateGain(claimAge))}</strong> more projected after-tax estate than the best
              result at your current claim ages ({fmtMoneyCompact(claimAge.currentClaimExactEstate)} →{' '}
              {fmtMoneyCompact(claimAge.jointExactEstate)}), across {claimAge.combinationsEvaluated} claim combinations
              each fully re-optimized.
            </p>
            <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
              {incumbentHolds
                ? 'Your current conversion strategy already holds under the new claim age, so applying changes only the Social Security claim age.'
                : scheduleApplyAvailable
                  ? 'Everything below — the schedule, the estate and tax deltas, and the success rate — was computed assuming this claim change. Apply installs the new claim age and the conversion schedule together; the schedule alone would not be correct for your current claim ages.'
                  : recommendedConversions.length === 0
                    ? 'No conversion change comes with this recommendation, so the button here changes just the Social Security claim age — the estate gain above comes from the claim change itself.'
                    : 'The conversion schedule from this run is diagnostic-only and cannot be applied, so the button here changes just the Social Security claim age. The estate gain above was measured with that schedule included, so the claim change alone may capture only part of it.'}
            </p>
            {/* Claim-only recommendations show their success rate here (the
                stats row below never renders for them); when a schedule comes
                along, the normal stats row already shows the rate computed
                against the same claim-patched plan via optimizedPlan. */}
            {recommendedConversions.length === 0 && mcRate !== null ? (
              <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                Monte Carlo success rate with this claim change: {Math.round(mcRate * 100)}%.
              </p>
            ) : null}
            {!scheduleApplyAvailable ? (
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-primary btn-small" onClick={applyClaimChangeOnly}>
                  Apply claim change
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card">
            <p className="field-hint" style={{ margin: 0 }}>
              Social Security claim age co-optimized: {claimAge.combinationsEvaluated} claim combinations were each
              fully re-optimized; none beat your current claim ages by a meaningful margin, so the recommendation
              below keeps them.
            </p>
          </div>
        )
      ) : null}

      {schedule && !running ? (
        incumbentHolds && tournament ? (
          <div className="card">
            <h2 style={{ margin: '0 0 0.35rem', color: 'var(--good)' }}>
              No change recommended — {tournament.winnerLabel} is still the best result found.
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              RetireGolden compared {tournament.candidates.length} simple candidate strategies and a fresh solver
              schedule against your current plan on your full year-by-year projection; none improved it. Your current schedule (
              {fmtMoney(tournament.winnerConversions.reduce((sum, c) => sum + c.amount, 0))} of conversions across{' '}
              {tournament.winnerConversions.length} year{tournament.winnerConversions.length === 1 ? '' : 's'}) stays
              in place{claimChangeRecommended ? ' — only the claim change above is left to apply.' : ' — nothing to apply.'}
            </p>
            {postProcessed?.cleanedValidation ? (
              <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
                Diagnostic: the solver's latest cleaned schedule would move the projected after-tax estate by{' '}
                {fmtMoney(postProcessed.cleanedValidation.afterTaxEstateDelta)} versus your current plan, so it is not
                offered as a recommendation. To explore alternatives from scratch, remove or edit the conversion
                schedule under Strategy and re-run.
              </p>
            ) : (
              <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
                To explore alternatives from scratch, remove or edit the conversion schedule under Strategy and re-run.
              </p>
            )}
            <div style={{ marginTop: '0.75rem' }}>{rerunButton()}</div>
          </div>
        ) : schedule.status === 'infeasible' && !candidateWins ? (
          <div className="card">
            <h2>Couldn't optimize this plan</h2>
            <p className="muted">
              The optimizer couldn't find a feasible schedule — usually because the plan runs out of money before the end
              (spending exceeds what the portfolio can cover), so there's no conversion strategy to weigh. Resolve the
              shortfall in Results or Monte Carlo, then try again.
            </p>
            <div style={{ marginTop: '0.75rem' }}>{rerunButton()}</div>
          </div>
        ) : rawConversions < 1 && !candidateWins ? (
          <div className="card">
            <h2>No beneficial conversions found</h2>
            <p className="muted">
              For this plan the optimizer didn't find conversions that improve the after-tax estate (often because there
              is little pre-tax balance to convert, or the current strategy already captures the opportunity).
            </p>
            <div style={{ marginTop: '0.75rem' }}>{rerunButton()}</div>
          </div>
        ) : (
          <>
            <div className="mc-hero">
              <div>
                <h2 style={{ margin: '0 0 0.35rem', color: stateColor(recommendationState) }}>
                  {validation ? recommendationHeading(validation) : 'The optimizer matches your current strategy.'}
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {validation
                    ? recommendationBody(validation)
                    : `${fmtMoney(totalConversions)} of conversions across ${recommendedConversions.length} year(s).`}
                </p>
                {candidateWins && tournament ? (
                  <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                    {candidateReplacedMilp ? (
                      <>
                        A simple strategy wins on your projection: <strong>{tournament.winnerLabel}</strong> beats the
                        solver's schedule by {fmtMoney(tournament.marginOverMilpDollars)} of after-tax estate. The
                        schedule shown and applied below follows it; the "Requested" bars show what the solver had
                        proposed.
                      </>
                    ) : (
                      <>
                        A simple strategy wins on your projection: <strong>{tournament.winnerLabel}</strong>. The
                        schedule shown and applied below follows it.
                      </>
                    )}
                    {tournament.searchRefined
                      ? ' A bounded search on your full projection then fine-tuned the winning schedule’s per-year amounts.'
                      : ''}
                  </p>
                ) : null}
                {tournament && tournament.policyId !== 'max-after-tax-estate' ? (
                  <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                    Candidates ranked by <strong>{objectivePolicies[tournament.policyId].label}</strong> — the estate
                    and tax deltas below are context, not the ranking metric.
                  </p>
                ) : null}
                {hasExecutionMismatch && validation ? (
                  <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                    Raw optimizer request: {fmtMoney(rawConversions)}. Cleaned executable schedule:{' '}
                    {fmtMoney(totalConversions)}. Executed after cleaning: {fmtMoney(executedConversions)} (
                    {formatPct(validation.executedConversionRatio)}).
                    {postProcessed?.rawValidation.firstMateriallyUnexecutedYear
                      ? ` First raw shortfall: ${postProcessed.rawValidation.firstMateriallyUnexecutedYear}.`
                      : ''}
                    {postProcessed?.adjustments.some((a) => a.reason === 'estate-pruned')
                      ? ' Later conversion years that lowered the projected after-tax estate were pruned.'
                      : ''}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="stat-grid">
              <DeltaStat
                label="After-tax estate"
                value={`${estateDelta >= 0 ? '+' : ''}${fmtMoney(estateDelta)}`}
                tone={estateDelta > 0 ? 'good' : estateDelta < 0 ? 'bad' : 'neutral'}
                help="Change in ending net worth, net of the heir tax on inherited pre-tax balances, versus your current strategy. Measured on your full year-by-year projection, not the optimizer's simplified model."
              />
              <DeltaStat
                label="Lifetime tax"
                value={`${taxDelta <= 0 ? '' : '+'}${fmtMoney(taxDelta)}`}
                tone={taxDelta < 0 ? 'good' : taxDelta > 0 ? 'bad' : 'neutral'}
                help="Change in total taxes and penalties paid over the whole plan. Conversions usually raise lifetime tax (you pay sooner) even as they raise the after-tax estate — the estate figure is the goal, this is the cost."
              />
              <DeltaStat
                label="Success rate"
                value={mcRate === null ? '…' : `${Math.round(mcRate * 100)}%`}
                tone={mcRate !== null && mcRate >= 0.9 ? 'good' : 'neutral'}
                help="Monte Carlo success probability for the proposed schedule (1,000 paths, lognormal markets), so you can confirm the conversions don't materially raise the risk of running out."
              />
            </div>

            <div className="chart-card">
              <h2>Proposed conversions by year</h2>
              <p className="card-hint">
                {candidateWins
                  ? candidateReplacedMilp
                    ? 'Raw optimizer request, winning candidate schedule, and what your projection actually executed (nominal dollars).'
                    : 'Winning candidate schedule and what your projection actually executed (nominal dollars).'
                  : 'Raw optimizer requests, cleaned schedule, and what your projection actually executed (nominal dollars).'}
              </p>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ left: 12, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
                    <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="requested" name="Requested" fill="var(--chart-1)" />
                    {showRecommendedBars ? (
                      <Bar
                        dataKey="cleaned"
                        name={candidateWins ? 'Recommended schedule' : 'Cleaned schedule'}
                        fill="var(--chart-2)"
                      />
                    ) : null}
                    {showRecommendedBars ? (
                      <Bar
                        dataKey="executed"
                        name={candidateWins ? 'Executed recommendation' : 'Executed after cleaning'}
                        fill="var(--chart-3)"
                      />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="field-hint">
                Optimizer status: {schedule.status} · solved in {schedule.solveMs.toFixed(0)} ms. The optimizer reasons
                over a simplified plan; the headline figures above come from re-running your full projection with the cleaned schedule.
              </p>
            </div>

            <div className="card">
              <h2>Use this schedule</h2>
              <p className="card-hint">
                {blocksApply
                  ? 'This result is shown as a diagnostic; it cannot be applied to your plan as a recommended schedule.'
                  : `Apply keeps it labeled as optimizer output; Accept as manual copies the same amounts into an editable manual conversion schedule you can adjust under Strategy.${
                      claimChangeRecommended
                        ? ' Both buttons also install the recommended Social Security claim change — the schedule was computed assuming it.'
                        : ''
                    }`}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-small" disabled={blocksApply} onClick={() => apply('optimized')}>
                  Apply optimized schedule
                </button>
                <button type="button" className="btn btn-secondary btn-small" disabled={blocksApply} onClick={() => apply('manual')}>
                  Accept as manual
                </button>
                {rerunButton()}
              </div>
            </div>
          </>
        )
      ) : null}

      {tournament && schedule && !running ? (
        <WhyRecommendationPanel tournament={tournament} objectiveLabel={objectivePolicies[tournament.policyId].label} />
      ) : null}

      <LearnAboutScreen route="/plan/:planId/optimize" />
    </section>
  )
}
