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
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import { objectivePolicies, type ObjectivePolicyId } from '@retiregolden/engine/decisions'
import {
  optimizerUnsupportedRetirementActions,
  type ExactLedgerRecommendationState,
  withOptimizedConversions,
} from '@retiregolden/engine/projection/optimizePlan'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import type { OptimizeResult } from '../optimize/messages'
import { runOptimize } from '../optimize/runner'
import { downloadStandaloneReport } from '../report/downloadReport'
import { useReportBranding } from '../report/brandingContext'
import { reportEvidenceFromOptimizeResult } from '../report/reportHtml'
import { acaVetoExplanation } from './acaVetoCopy'
import {
  OPTIMIZER_RETIREMENT_ACTION_HEADING,
  OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP,
  optimizerRetirementActionExplanation,
} from './optimizerRetirementActionCopy'
import { usePlan } from './planContextCore'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { WhyRecommendationPanel } from './explainPanels'
import { CheckboxField, HelpTip, SelectField } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney, fmtMoneyCompact } from './format'
import { LEARN } from './learnLinks'
import { LiveStatus } from './LiveStatus'
import {
  actionableTournamentConversions,
  buildOptimizeChartRows,
  displayedCleanedConversions,
  displayedScheduleAlreadyExecuted as isDisplayedScheduleAlreadyExecuted,
  monteCarloSuccessValue,
  positiveConversionCount,
  shouldShowRecommendedScheduleBars,
} from './optimizePageChart'
import {
  applyOptimizeRecommendation,
  claimEstateGain,
  claimOnlyApplyAvailable,
  claimRecommendationReportAvailable,
  planWithWinningClaim,
} from './optimizePageClaim'
import {
  optimizerProducedNoRecommendation,
  publicationValidation,
  recommendationBody,
  recommendationHeading,
} from './optimizePageRecommendation'
import {
  promotedRecommendationPlan,
  promotionBlocksApply,
  publishedPromotion,
  withheldPromotion,
} from './optimizePagePromotion'
import {
  PromotedSchedulePanel,
  PromotionWithheldPanel,
} from './retirementActionPromotionPanels'
import { promotedScheduleApplyHint } from './retirementActionPromotionCopy'
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
  const readOnly = useWorkspaceReadOnly()
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
  // An explicit Run / Re-run / Try again moves focus to the failure well when
  // the run ends without a recommendation (#525), so keyboard and
  // screen-reader users land on the answer; an auto-run never steals focus
  // from the field being edited. The flag is the explicit run's own token,
  // so an auto-run that supersedes it while it is in flight cannot inherit
  // the focus move. The outcome itself is announced by the live region
  // below, derived from state so it needs no effect.
  const explicitToken = useRef<number | null>(null)
  const failureWell = useRef<HTMLDivElement>(null)
  // Completed runs, explicit or automatic: the mount-time auto-run is the
  // first, and its success is not announced (nothing changed for the user).
  const [runsCompleted, setRunsCompleted] = useState(0)

  // Precondition, checked before any dispatch: the engine admits a plan
  // carrying recorded retirement actions — identity-bearing or migrated
  // aggregate — and nets their committed balance movement into the LP's
  // buckets. The predicate below is broader than any one engine limit: it
  // trips on ANY recorded action, and this page's own check is the thing that
  // declines to run.
  //
  // THE MODEL REASONS THAT USED TO STAND HERE ARE GONE. "A committed
  // conversion's income has no term" was true when this comment was written and
  // is not now: the LP takes that income as a floor its own conversions stack on
  // (`OptimizerYear.committedOrdinaryIncome`). Nor is the cash-side booking that
  // replaced it. A QCD routed out of an RMD is netted out of the exact ledger's
  // cash inflows and the LP re-decides that RMD as its own `wt`, so the solve
  // used to believe the household could spend dollars it gave away;
  // `forcedDistributionCashDiversion` now takes that cash back, alongside the
  // `forcedDistributionOrdinaryIncomeExclusion` that keeps the same dollars out
  // of income. Five strategy movements reach the balance recursion. Both sides
  // of every one of them are booked.
  //
  // WHAT STILL HOLDS IT UP, stated so the next attempt starts from the truth:
  // THE TELLING, and only that. Nothing on this page explains an optimizer
  // answer sitting on top of a plan's own named requests — which schedule was
  // priced, which year the named executor already owns, what Apply would
  // install. The engine's post-processor drops a named-conversion year from the
  // emitted schedule (the named executor is authoritative there), so a
  // recommendation for an action-bearing plan is silent about exactly the years
  // the user recorded. Shipping that needs copy, not a model term.
  //
  // The model limits that remain are not this predicate's to hold and never
  // were: they are cash and value crossing between the household and an asset
  // the LP carries in no bucket (a property sale, a HECM draw, a death
  // benefit), enumerated on `OptimizerYearProbe.exogenousStrategyAccountMovement`,
  // and none of them records a retirement action for this gate to see.
  // The page states the condition rather than ranking schedules against either.
  const unsupportedActionReasons = useMemo(
    () => optimizerUnsupportedRetirementActions(plan),
    [plan],
  )
  const optimizerUnavailable = unsupportedActionReasons.length > 0

  // The precondition gates what renders, not only what dispatches. `run` clears
  // the held result, but it is debounced 300ms, so a plan edit that records an
  // action leaves the previous result in state across at least one paint —
  // during which the claim-change Apply card below reads `schedule` and would
  // offer to install a recommendation computed for the pre-action plan. Reading
  // every result-derived value through this closes that window in the same
  // render that flips the precondition, with no intermediate frame to catch.
  const heldResult = optimizerUnavailable ? null : optimizeResult

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

  const schedule = heldResult?.schedule ?? null
  const postProcessed = heldResult?.postProcessed ?? null
  const tournament = heldResult?.tournament ?? null
  // The exact-ledger tournament arbitrates the recommendation: when a simple
  // candidate strategy beats the post-processed MILP schedule on the exact
  // after-tax estate, its schedule is what the page shows and applies.
  const candidateWins = tournament?.winnerSource === 'candidate'
  const withheldCandidateDisplayed =
    tournament?.retirementActionReadinessVeto?.vetoedWinnerSource === 'candidate'
  const withheldRefinedMilpDisplayed =
    tournament?.retirementActionReadinessVeto?.vetoedWinnerSource === 'milp' &&
    tournament.searchRefined
  const displayedScheduleAlreadyExecuted = isDisplayedScheduleAlreadyExecuted(tournament)
  // Nothing evaluated beat the plan's already-installed conversion strategy —
  // the usual state right after applying a winning schedule and re-running.
  // Rendered as a calm "no change recommended" card, not a rejected-schedule
  // diagnostic (the deltas on this page are always vs the current plan, so a
  // fresh solver proposal that loses to the incumbent shows scary negatives).
  const incumbentHolds =
    tournament?.winnerSource === 'incumbent' &&
    tournament.retirementActionReadinessVeto === null
  const candidateReplacedMilp = candidateWins && postProcessed?.recommendationSchedule === 'cleaned'
  const recommendedConversions = useMemo(
    () => actionableTournamentConversions(tournament),
    [tournament],
  )
  const displayedConversions = useMemo(
    () => displayedCleanedConversions(tournament, postProcessed),
    [tournament, postProcessed],
  )
  const displayedConversionCount = useMemo(
    () => positiveConversionCount(displayedConversions),
    [displayedConversions],
  )
  // Step 5 claim-age co-optimization: when a claim change won, the schedule and
  // every validation delta on this page were computed against the claim-patched
  // plan, so Monte Carlo, the report, and Apply must all start from it.
  const claimAge = heldResult?.claimAge ?? null
  const claimChangeRecommended = claimAge?.winningClaimPatch != null
  const planForRecommendation = useMemo(() => planWithWinningClaim(plan, claimAge), [plan, claimAge])
  // A promoted winner IS the recommendation, and it is a set of named requests
  // rather than an aggregate schedule. Everything downstream of the
  // recommendation — Monte Carlo, the report, Apply — has to describe that
  // plan; `withOptimizedConversions` below would re-aggregate the very
  // identities the promotion exists to name.
  const promotion = tournament?.retirementActionPromotion ?? null
  const published = useMemo(() => publishedPromotion(promotion), [promotion])
  const withheld = useMemo(() => withheldPromotion(promotion), [promotion])
  const promotedPlan = useMemo(
    () => (published === null
      ? null
      : promotedRecommendationPlan(plan, { claimAge, promotion: published })),
    [plan, claimAge, published],
  )
  const optimizedPlan = useMemo(() => {
    if (promotedPlan !== null) return promotedPlan.status === 'read' ? promotedPlan.plan : null
    if (recommendedConversions.length > 0) return withOptimizedConversions(planForRecommendation, recommendedConversions)
    // Price a claim-only plan only when the joint result established that the
    // incumbent strategy holds or no conversion change exists. A withheld
    // diagnostic schedule may have driven claim selection, so substituting an
    // unvalidated claim-only plan would make Monte Carlo and the report describe
    // a different recommendation.
    return claimOnlyApplyAvailable({
      claimChangeRecommended,
      scheduleApplyAvailable: false,
      incumbentHolds,
      displayedConversionCount,
    })
      ? planForRecommendation
      : null
  }, [
    promotedPlan,
    planForRecommendation,
    recommendedConversions,
    claimChangeRecommended,
    incumbentHolds,
    displayedConversionCount,
  ])
  const validation = candidateWins
    ? (tournament?.winnerValidation ?? null)
    : (tournament?.retirementActionReadinessVeto?.vetoedValidation ??
      postProcessed?.cleanedValidation ??
      null)
  const presentationValidation = validation === null
    ? null
    : publicationValidation(
        validation,
        tournament?.retirementActionReadinessVeto ?? null,
      )

  const run = useCallback((explicit = false) => {
    const token = ++runToken.current
    explicitToken.current = explicit ? token : null
    if (optimizerUnavailable) {
      explicitToken.current = null
      // Never dispatch: clear any result computed before the actions were
      // recorded so the chart and Apply cannot describe a superseded plan.
      setRunning(false)
      setError(null)
      setMcRate(null)
      setOptimizeResult(null)
      return
    }
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
        if (token === runToken.current) {
          setRunning(false)
          setRunsCompleted((n) => n + 1)
        }
      })
  }, [plan, startYear, objectiveId, coOptimizeRequested, optimizerUnavailable])

  // Auto-run on plan / rate change (debounced).
  useEffect(() => {
    const t = window.setTimeout(() => run(), 300)
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
  const totalConversions = displayedConversions.reduce((sum, c) => sum + c.amount, 0)
  const rawConversions = totalScheduleConversions(schedule)
  const executedConversions = validation?.executedConversionTotal ?? 0
  const hasPostProcessingAdjustments = (postProcessed?.adjustments.length ?? 0) > 0
  const recommendationState = presentationValidation?.recommendationState ?? 'neutral'
  const hasExecutionMismatch =
    !candidateWins &&
    (recommendationState === 'identityIncomplete' ||
      hasPostProcessingAdjustments ||
      (validation?.firstMateriallyUnexecutedYear !== null && validation?.firstMateriallyUnexecutedYear !== undefined))
  const showRecommendedBars = shouldShowRecommendedScheduleBars(candidateWins, hasExecutionMismatch)
  // The patch is the recommendation. A withheld verdict has none, and a
  // published verdict whose patch does not read back onto this plan has none
  // either; in both cases the aggregate schedule is not a substitute.
  const blocksApply = promotionBlocksApply(promotion, promotedPlan)
    ? true
    : candidateWins
    ? false
    : recommendationState === 'rejected' ||
      recommendationState === 'unexecutable' ||
      recommendationState === 'identityIncomplete' ||
      postProcessed?.recommendationSchedule === 'none'
  // A claim change can win on estate alone while the conversion side is
  // unappliable (incumbent holds, empty/infeasible schedule, or diagnostic-only
  // result). The claim card then carries its own apply control so the winning
  // claim change is never advertised without a way to install it.
  const scheduleApplyAvailable = recommendedConversions.length > 0 && !blocksApply
  const claimOnlyApplyIsAvailable = claimOnlyApplyAvailable({
    claimChangeRecommended,
    scheduleApplyAvailable,
    incumbentHolds,
    displayedConversionCount,
  })
  const noRecommendation = optimizerProducedNoRecommendation({
    scheduleStatus: schedule?.status ?? null,
    incumbentHolds,
    candidateWins,
    readinessVeto: tournament?.retirementActionReadinessVeto,
  })
  const recommendationReportIsAvailable =
    !noRecommendation &&
    claimRecommendationReportAvailable({
      claimChangeRecommended,
      scheduleApplyAvailable,
      incumbentHolds,
      displayedConversionCount,
    })

  const chartRows = useMemo(
    () => buildOptimizeChartRows({
      schedule,
      recommendedConversions: displayedConversions,
      postProcessed,
      displayedScheduleAlreadyExecuted,
    }),
    [schedule, displayedConversions, postProcessed, displayedScheduleAlreadyExecuted],
  )

  const apply = (mode: 'optimized' | 'manual') => {
    if (blocksApply) return
    if (published !== null) {
      // A promoted schedule installs the patch the engine published: named
      // requests, each carrying its person, source accounts and Roth
      // destination. There is no manual arm, because an aggregate manual
      // schedule cannot carry any of that.
      if (mode !== 'optimized' || promotedPlan?.status !== 'read') return
      const installed = promotedPlan.plan
      update((draft) => {
        Object.assign(draft, installed)
      })
      return
    }
    if (recommendedConversions.length === 0) return
    // Claim change and schedule install together: the schedule was computed
    // against the claim-patched plan, so conversions alone would be wrong.
    update((d) => applyOptimizeRecommendation(d, { claimAge, conversions: recommendedConversions, mode }))
  }

  // The incumbent-holds path has no schedule to install, but a winning claim
  // change is still an actionable recommendation on its own (the current
  // conversion strategy already holds under the new claim ages).
  const applyClaimChangeOnly = () => {
    if (!claimOnlyApplyIsAvailable) return
    update((d) => applyOptimizeRecommendation(d, { claimAge, conversions: [], mode: 'optimized' }))
  }

  const runExplicitly = () => run(true)

  const rerunButton = (label = 'Re-run optimizer') => (
    <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={runExplicitly}>
      {running ? 'Optimizing...' : label}
    </button>
  )

  const failed = !running && !optimizerUnavailable && (error !== null || noRecommendation)
  // Empty while a run is in flight, so the same outcome twice is announced
  // twice (the live region only speaks when its text changes). A thrown
  // failure is not repeated here: its well is a role="alert" that announces
  // itself when it mounts. The mount-time auto-run's success is silent.
  const liveMessage =
    running || optimizerUnavailable || error !== null || heldResult === null
      ? ''
      : noRecommendation
        ? "Optimizer finished: couldn't optimize this plan. No feasible schedule was found."
        : runsCompleted > 1
          ? 'Optimizer finished. Results updated below.'
          : ''
  useEffect(() => {
    if (running) return
    const wasExplicit = explicitToken.current !== null && explicitToken.current === runToken.current
    explicitToken.current = null
    if (wasExplicit && failed) failureWell.current?.focus()
  }, [running, failed])

  const downloadRecommendationReport = () => {
    if (!heldResult || !recommendationReportIsAvailable) return
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
      recommendationEvidence: reportEvidenceFromOptimizeResult(heldResult),
      branding: reportBranding,
    })
  }

  return (
    <section>
      <LiveStatus message={liveMessage} />
      <div className="card">
        <h2>Roth & Tax Optimizer</h2>
        <p className="card-hint">
          Search for a Roth-conversion & withdrawal schedule, then rank the candidates by the objective you choose.
          The default leaves the most after-tax wealth to your heirs; other modes can favor spending durability,
          lifetime tax with an estate floor, survivor liquidity, or bridge-year resilience. RetireGolden generates
          candidate schedules (a multi-year math program over federal brackets, IRMAA thresholds, and RMDs, plus
          simple bracket-fill and cliff-cap strategies), compares every candidate schedule on your full year-by-year
          projection, and shows the schedule that ranks highest on your chosen objective within the search limits. You
          decide whether to apply it.
        </p>
        <p className="field-hint">
          Using the {formatPct(plan.assumptions.heirTaxRatePct / 100)} heir tax rate from{' '}
          <Link to={`/plan/${plan.id}/assumptions`}>Assumptions</Link>.
        </p>
        <div className="form-grid" style={{ marginTop: '0.5rem' }}>
          <div className="field-span-full">
          <SelectField
            label="Optimize for"
            help="What 'better' means when candidate schedules are ranked on your full year-by-year projection. The default maximizes the after-tax estate. Other objectives re-rank the same evaluations by money lasting longer, lowest lifetime tax without breaking the estate floor, the worst-case balance in survivor years, or the worst-case balance across pre-Social-Security bridge years. Every objective still hard-rejects candidates that shorten how long the money lasts."
            hint={objectivePolicies[objectiveId].description}
            learn={LEARN.optimizerObjectives}
            value={objectiveId}
            options={OBJECTIVE_CHOICES}
            onCommit={setObjectiveId}
          />
          </div>
          {hasSocialSecurityIncome ? (
            <CheckboxField
              label="Also optimize Social Security claim age"
              help="Re-runs the full conversion optimizer at each canonical claim age (62 / full retirement age / 70, for up to two Social Security streams) and surfaces the claim-age and conversion pair with the highest projected after-tax estate. Note that claim combinations are always compared on after-tax estate, even when you have picked a different objective above; that objective still ranks the schedules within each combination. A claim change has to beat the current-claim optimum by a clear margin before it is surfaced."
              hint="Re-runs the full optimizer once per claim combination, so expect several times longer than a standard run."
              value={coOptimizeClaim}
              onCommit={setCoOptimizeClaim}
            />
          ) : null}
        </div>
        {/* Same window as `heldResult`: a run already in flight when the edit
            lands would otherwise keep claiming to optimize for one debounce
            interval, and an error from the superseded plan would sit next to a
            precondition that supersedes it. */}
        {running && !optimizerUnavailable ? (
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
        {error && !optimizerUnavailable ? (
          // The alert announces itself on mount (the live region above stays
          // silent for this path, so it is heard once); the tabIndex is for
          // the explicit-run focus move.
          <div className="callout callout--warn optimizer-failure" role="alert" tabIndex={-1} ref={failureWell}>
            Optimizer error: {error}
          </div>
        ) : null}
        {/* No run controls while the precondition holds: every control here
            either starts a run that cannot happen or downloads a report that
            does not exist. */}
        {optimizerUnavailable ? null : (
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!schedule && !running ? rerunButton(error ? 'Try again' : 'Run optimizer') : null}
            {/* Also disabled while re-running: the held result (and any claim
                patch in it) describes the pre-edit plan, so a report downloaded
                mid-run would mix live plan fields with stale recommendations.
                And disabled after a failed run (#426), because
                recommendationReportIsAvailable is false when there is no
                recommendation to report. */}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={!heldResult || running || !recommendationReportIsAvailable}
              onClick={downloadRecommendationReport}
            >
              Download recommendation report
            </button>
          </div>
        )}
      </div>

      {optimizerUnavailable ? (
        <div className="card">
          <h2 style={{ margin: '0 0 0.35rem' }}>{OPTIMIZER_RETIREMENT_ACTION_HEADING}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {optimizerRetirementActionExplanation(unsupportedActionReasons)}
          </p>
          <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
            {OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP}
          </p>
        </div>
      ) : null}

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
                  ? 'Everything below (the schedule, the estate and tax deltas, and the success rate) was computed assuming this claim change. Apply installs the new claim age and the conversion schedule together; the schedule alone would not be correct for your current claim ages.'
                  : displayedConversions.length === 0
                    ? 'No conversion change comes with this result, so the button here changes just the Social Security claim age. The estate gain above comes from the claim change itself.'
                    : 'The conversion schedule from this run is diagnostic-only and cannot be applied. The estate gain above was measured with that schedule included, and the claim change alone was not separately validated, so no Apply action is offered.'}
            </p>
            {/* Claim-only recommendations show their success rate here (the
                stats row below never renders for them); when a schedule comes
                along, the normal stats row already shows the rate computed
                against the same claim-patched plan via optimizedPlan. */}
            {claimOnlyApplyIsAvailable && mcRate !== null ? (
              <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                Monte Carlo success rate with this claim change: {Math.round(mcRate * 100)}%.
              </p>
            ) : null}
            {claimOnlyApplyIsAvailable ? (
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={applyClaimChangeOnly}>
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
              Nothing beat your current plan: {tournament.winnerLabel} still ranks highest.
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              RetireGolden compared {tournament.candidates.length} simple candidate strategies and a fresh solver
              schedule against your current plan on your full year-by-year projection;{' '}
              {tournament.acaActionabilityVeto
                ? 'none qualified as actionable (see the ACA note below)'
                : 'none improved it'}
              . Your current schedule (
              {fmtMoney(tournament.winnerConversions.reduce((sum, c) => sum + c.amount, 0))} of conversions across{' '}
              {tournament.winnerConversions.length} year{tournament.winnerConversions.length === 1 ? '' : 's'}) stays
              in place{claimChangeRecommended ? ', so only the claim change above is left to apply.' : ', so there is nothing to apply.'}
            </p>
            {tournament.acaActionabilityVeto ? (
              <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
                {acaVetoExplanation(tournament.acaActionabilityVeto)}
              </p>
            ) : null}
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
        ) : noRecommendation ? (
          <div className="card optimizer-failure" tabIndex={-1} ref={failureWell}>
            <h2>Couldn't optimize this plan</h2>
            <p className="muted">
              The optimizer couldn't find a feasible schedule, usually because the plan runs out of money before the end
              (spending exceeds what the portfolio can cover), so there's no conversion strategy to weigh. Resolve the
              shortfall in Results or Monte Carlo, then try again.
            </p>
            {tournament?.acaActionabilityVeto ? (
              <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
                {acaVetoExplanation(tournament.acaActionabilityVeto)}
              </p>
            ) : null}
            <div style={{ marginTop: '0.75rem' }}>{rerunButton()}</div>
          </div>
        ) : rawConversions < 1 &&
          !candidateWins &&
          !tournament?.retirementActionReadinessVeto ? (
          <div className="card">
            <h2>No beneficial conversions found</h2>
            <p className="muted">
              For this plan the optimizer didn't find conversions that improve the after-tax estate (often because there
              is little pre-tax balance to convert, or the current strategy already captures the opportunity).
            </p>
            {tournament?.acaActionabilityVeto ? (
              <p className="field-hint" style={{ margin: '0.6rem 0 0' }}>
                {acaVetoExplanation(tournament.acaActionabilityVeto)}
              </p>
            ) : null}
            <div style={{ marginTop: '0.75rem' }}>{rerunButton()}</div>
          </div>
        ) : (
          <>
            <div className="mc-hero">
              <div>
                <h2 style={{ margin: '0 0 0.35rem', color: stateColor(recommendationState) }}>
                  {presentationValidation
                    ? recommendationHeading(presentationValidation)
                    : 'The optimizer matches your current strategy.'}
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {presentationValidation
                    ? recommendationBody(presentationValidation)
                    : `${fmtMoney(totalConversions)} of conversions across ${displayedConversions.length} year(s).`}
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
                {tournament?.acaActionabilityVeto ? (
                  <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                    {acaVetoExplanation(tournament.acaActionabilityVeto)}
                  </p>
                ) : null}
                {tournament && tournament.policyId !== 'max-after-tax-estate' ? (
                  <p className="field-hint" style={{ margin: '0.45rem 0 0' }}>
                    Candidates ranked by <strong>{objectivePolicies[tournament.policyId].label}</strong>. The estate
                    and tax deltas below are context, not the ranking metric.
                  </p>
                ) : null}
                {hasExecutionMismatch && validation && !displayedScheduleAlreadyExecuted ? (
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

            {withheld ? <PromotionWithheldPanel plan={plan} promotion={withheld} /> : null}

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
                help="Change in total taxes and penalties paid over the whole plan. Conversions usually raise lifetime tax (you pay sooner) even as they raise the after-tax estate. Under the default objective the estate figure is the goal and this is the cost."
              />
              <DeltaStat
                label="Success rate"
                value={monteCarloSuccessValue(optimizedPlan !== null, mcRate)}
                tone={optimizedPlan !== null && mcRate !== null && mcRate >= 0.9 ? 'good' : 'neutral'}
                help="Monte Carlo success probability for the proposed plan (1,000 paths, lognormal markets), so you can confirm the recommendation doesn't materially raise the risk of running out."
              />
            </div>

            <div className="chart-card">
              <h2>Proposed conversions by year</h2>
              <p className="card-hint">
                {candidateWins
                  ? candidateReplacedMilp
                    ? 'Raw optimizer request, winning candidate schedule, and what your projection actually executed (nominal dollars).'
                    : 'Winning candidate schedule and what your projection actually executed (nominal dollars).'
                  : withheldCandidateDisplayed
                    ? 'Raw optimizer request and the withheld candidate schedule that your exact projection executed (nominal dollars).'
                    : withheldRefinedMilpDisplayed
                      ? 'Raw optimizer request and the withheld search-refined schedule that your exact projection executed (nominal dollars).'
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
                        name={candidateWins
                          ? 'Recommended schedule'
                          : withheldCandidateDisplayed
                            ? 'Withheld candidate schedule'
                            : withheldRefinedMilpDisplayed
                              ? 'Withheld refined schedule'
                              : 'Cleaned schedule'}
                        fill="var(--chart-2)"
                      />
                    ) : null}
                    {showRecommendedBars ? (
                      <Bar
                        dataKey="executed"
                        name={candidateWins
                          ? 'Executed recommendation'
                          : withheldCandidateDisplayed
                            ? 'Executed withheld candidate'
                            : withheldRefinedMilpDisplayed
                              ? 'Executed withheld refinement'
                              : 'Executed after cleaning'}
                        fill="var(--chart-3)"
                      />
                    ) : null}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="field-hint">
                Optimizer status: {schedule.status} · solved in {schedule.solveMs.toFixed(0)} ms. The optimizer reasons
                over a simplified plan; the headline figures above come from{' '}
                {displayedScheduleAlreadyExecuted
                  ? 'the displayed exact-ledger schedule run through your full projection.'
                  : 're-running your full projection with the cleaned schedule.'}
              </p>
            </div>

            {published && promotedPlan ? (
              <PromotedSchedulePanel
                read={promotedPlan}
                promotion={published}
                winnerConversions={recommendedConversions}
              />
            ) : null}

            <div className="card">
              <h2>Use this schedule</h2>
              <p className="card-hint">
                {blocksApply
                  ? 'This result is shown as a diagnostic; it cannot be applied to your plan as a recommended schedule.'
                  : published
                    ? `${promotedScheduleApplyHint(published.actionRequestIds.length)}${
                        claimChangeRecommended
                          ? ' Apply also installs the Social Security claim change shown above, because the schedule was computed assuming it.'
                          : ''
                      }`
                    : `Apply keeps it labeled as optimizer output; Accept as manual copies the same amounts into an editable manual conversion schedule you can adjust under Strategy.${
                      claimChangeRecommended
                        ? ' Both buttons also install the Social Security claim change shown above, because the schedule was computed assuming it.'
                        : ''
                    }`}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-small" disabled={blocksApply || readOnly} onClick={() => apply('optimized')}>
                  {published ? 'Apply named schedule' : 'Apply optimized schedule'}
                </button>
                {published ? null : (
                  <button type="button" className="btn btn-secondary btn-small" disabled={blocksApply || readOnly} onClick={() => apply('manual')}>
                    Accept as manual
                  </button>
                )}
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
