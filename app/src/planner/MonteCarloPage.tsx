/**
 * Monte Carlo: success gauge, percentile fan, ending-balance and depletion
 * distributions. Runs 1,000 paths automatically on the worker pool (sync
 * fallback in tests) and 10,000 on demand; the seed is stable per plan and
 * re-rollable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { planUsesAssetAllocation } from '../engine/allocation/assetClasses'
import type { Plan } from '../engine/model/plan'
import { DEFAULT_LTC_SHOCK } from '../engine/montecarlo/ltcShock'
import { startingInvestableOf } from '../engine/montecarlo/riskBasedGuardrails'
import type { MarketModelConfig } from '../engine/montecarlo/marketModels'
import type { AnnuitizationSweep } from '../engine/decisions/annuitization'
import type { StochasticFrontierPoint } from '../engine/montecarlo/frontiers'
import type { MonteCarloSummary } from '../engine/montecarlo/run'
import {
  DEFAULT_PATH_COUNT,
  ON_DEMAND_PATH_COUNT,
  runHistoricalStressSuiteViews,
  runMonteCarlo,
  runStochasticFrontiers,
  type HistoricalStressSuiteViewResult,
} from '../mc/pool'
import { usePlan } from './planContextCore'
import { WhySuccessPanel } from './explainPanels'
import { LiveStatus } from './LiveStatus'
import { HelpTip } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney, fmtMoneyCompact } from './format'
import {
  buildModel,
  catalogLabelOf,
  MODEL_CATALOG,
  MODEL_PRESETS,
  PRESET_FAMILY_LABELS,
  presetFamilyOf,
  type ModelKind,
} from './marketModelPicker'
import { currentStartYear, seedFromPlanId } from './useProjection'
import { chartTooltipStyle } from './chartStyle'
import { successBand } from './successBand'
import { frameH } from './chartFrame'

function SuccessGauge({ rate, pathCount }: { rate: number; pathCount: number }) {
  const pct = Math.round(rate * 100)
  const { color: tone, severity } = successBand(rate)
  const r = 64
  const c = 2 * Math.PI * r
  return (
    <div
      className="success-gauge"
      role="img"
      aria-label={`Success probability ${pct} percent — ${severity} — over ${pathCount} paths`}
    >
      <svg width="176" height="176" viewBox="0 0 176 176">
        <circle cx="88" cy="88" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        <circle
          cx="88"
          cy="88"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${c * rate} ${c}`}
        />
      </svg>
      <div className="success-gauge-label">
        <span className="success-gauge-value" style={{ color: tone }}>
          {pct}%
        </span>
        <span className="success-gauge-caption">{pathCount.toLocaleString()} paths</span>
      </div>
    </div>
  )
}

export function MonteCarloPage() {
  const { plan } = usePlan()
  const [modelKind, setModelKind] = useState<ModelKind>('lognormal')
  const [returnVolPct, setReturnVolPct] = useState(12)
  const [equityWeightPct, setEquityWeightPct] = useState(60)
  const [seed, setSeed] = useState(() => seedFromPlanId(plan.id))
  const [stochasticLongevity, setStochasticLongevity] = useState(false)
  const [ltcShock, setLtcShock] = useState(false)
  const [summary, setSummary] = useState<MonteCarloSummary | null>(null)
  const [frontier, setFrontier] = useState<{
    plan: Plan
    model: MarketModelConfig
    seed: number
    stochasticLongevity: boolean
    ltcShock: boolean
    spending: StochasticFrontierPoint[]
    retirement: StochasticFrontierPoint[]
    annuitization: AnnuitizationSweep
  } | null>(null)
  const [frontierRunning, setFrontierRunning] = useState(false)
  const [historical, setHistorical] = useState<{
    plan: Plan
    equityWeightPct: number
    result: HistoricalStressSuiteViewResult
  } | null>(null)
  const [historicalRunning, setHistoricalRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [frontierError, setFrontierError] = useState<string | null>(null)
  const [historicalError, setHistoricalError] = useState<string | null>(null)
  const runToken = useRef(0)

  const model = useMemo(
    () => buildModel(modelKind, plan.assumptions.inflationPct, returnVolPct, equityWeightPct, plan),
    [modelKind, plan, returnVolPct, equityWeightPct],
  )

  const run = useCallback(
    (paths: number) => {
      const token = ++runToken.current
      setRunning(true)
      setProgress(0)
      setError(null)
      setStatusMessage(`Simulating ${paths.toLocaleString()} market paths…`)
      void runMonteCarlo(plan, {
        startYear: currentStartYear(),
        pathCount: paths,
        seed,
        model,
        stochasticLongevity,
        ltcShock: ltcShock ? DEFAULT_LTC_SHOCK : null,
        onProgress: (done, total) => {
          if (token === runToken.current) setProgress(done / total)
        },
      })
        .then((s) => {
          if (token === runToken.current) {
            setSummary(s)
            setStatusMessage(
              `Simulation complete. ${Math.round(s.successRate * 100)} percent of markets sustain the plan.`,
            )
          }
        })
        .catch((e: unknown) => {
          if (token === runToken.current) {
            setError(e instanceof Error ? e.message : String(e))
            setStatusMessage('')
          }
        })
        .finally(() => {
          if (token === runToken.current) setRunning(false)
        })
    },
    [plan, seed, model, stochasticLongevity, ltcShock],
  )

  const runFrontiers = useCallback(() => {
    setFrontierRunning(true)
    setFrontierError(null)
    void runStochasticFrontiers(plan, {
      startYear: currentStartYear(),
      pathCount: 200,
      seed,
      model,
      stochasticLongevity,
      ltcShock: ltcShock ? DEFAULT_LTC_SHOCK : null,
    })
      .then((result) => {
        setFrontier({
          plan,
          model,
          seed,
          stochasticLongevity,
          ltcShock,
          spending: result.spending,
          retirement: result.retirement,
          annuitization: result.annuitization,
        })
      })
      .catch((e: unknown) => setFrontierError(e instanceof Error ? e.message : String(e)))
      .finally(() => setFrontierRunning(false))
  }, [plan, model, seed, stochasticLongevity, ltcShock])

  const runHistoricalSuites = useCallback(() => {
    setHistoricalRunning(true)
    setHistoricalError(null)
    void runHistoricalStressSuiteViews(plan, {
      startYear: currentStartYear(),
      equityWeightPct,
      classShocks: planUsesAssetAllocation(plan),
      worstWindowCount: 5,
    })
      .then((result) => {
        setHistorical({ plan, equityWeightPct, result })
      })
      .catch((e: unknown) => setHistoricalError(e instanceof Error ? e.message : String(e)))
      .finally(() => setHistoricalRunning(false))
  }, [plan, equityWeightPct])

  // Auto-run 1k paths whenever the plan, seed, or model changes (debounced).
  useEffect(() => {
    const t = window.setTimeout(() => run(DEFAULT_PATH_COUNT), 250)
    return () => window.clearTimeout(t)
  }, [run])

  const fanRows = useMemo(() => summary?.fan ?? [], [summary])
  const histRows = useMemo(() => {
    if (!summary) return []
    const { min, binWidth, counts } = summary.endingInvestable.histogram
    return counts.map((count, i) => ({ label: fmtMoneyCompact(min + (i + 0.5) * binWidth), count }))
  }, [summary])
  const depletionRows = useMemo(
    () =>
      summary?.depletionProbabilityByYear.map((row) => ({
        year: row.year,
        probability: row.probability * 100,
        cumulativeProbability: row.cumulativeProbability * 100,
      })) ?? [],
    [summary],
  )
  const visibleFrontier =
    frontier &&
    frontier.plan === plan &&
    frontier.model === model &&
    frontier.seed === seed &&
    frontier.stochasticLongevity === stochasticLongevity &&
    frontier.ltcShock === ltcShock
      ? frontier
      : null
  const visibleHistorical =
    historical && historical.plan === plan && historical.equityWeightPct === equityWeightPct ? historical.result : null

  return (
    <section>
      <LiveStatus message={statusMessage} />
      <div className="card">
        <h2>Market model</h2>
        <p className="card-hint">
          Your deterministic projection assumes the same return and inflation every year. Monte Carlo replays the exact
          same plan a thousand times with markets that vary year to year, then reports how often the money lasts. The
          model below controls <em>how</em> those markets are generated — your expected returns and inflation from
          Assumptions stay the center of the distribution either way.
        </p>
        <div className="form-grid">
          <div className="field field-span-full">
            <span className="field-label-row">
              <span className="field-label">Model</span>
              <HelpTip text="Monte Carlo needs a rule for generating each year's market. Smooth randomness draws each year's return from a bell-shaped curve around your expected return, with inflation statistically linked to it. Replay real history starts your retirement in a random year since 1928 and lets actual market history unfold from there. Stress test forces a 25% market drop in the first year, then returns to normal randomness. The advanced catalog offers more ways to shape the markets — fat tails, volatility clustering, bull/bear regimes, and more. Every model keeps your expected returns and inflation from Assumptions at the center of the distribution, and the same seed always reproduces the same markets." />
            </span>
            <div className="model-preset-row" role="group" aria-label="Market model presets">
              {MODEL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="model-preset"
                  aria-pressed={modelKind === preset.kind}
                  onClick={() => setModelKind(preset.kind)}
                >
                  <span className="model-preset-label">{preset.label}</span>
                  <span className="model-preset-desc">{preset.description}</span>
                </button>
              ))}
            </div>
            <details className="ss-explainer model-advanced">
              <summary>Advanced models</summary>
              <div className="field model-advanced-field">
                <label className="field-label" htmlFor="mc-advanced-model">
                  Full model catalog
                </label>
                <select id="mc-advanced-model" value={modelKind} onChange={(e) => setModelKind(e.target.value as ModelKind)}>
                  {MODEL_CATALOG.map((entry) => (
                    <option key={entry.kind} value={entry.kind}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  {catalogLabelOf(modelKind)} is part of the “{PRESET_FAMILY_LABELS[presetFamilyOf(modelKind)]}” family.
                </p>
                <p className="field-hint">Current market seed: {seed} — “Re-roll markets” draws a new one.</p>
              </div>
            </details>
          </div>
          {modelKind === 'lognormal' ? (
            <div className="field">
              <span className="field-label-row">
                <span className="field-label">Return volatility: {returnVolPct}%</span>
                <HelpTip text="How wildly returns swing year to year (one standard deviation). ~10% resembles a balanced 60/40 portfolio, ~15% a mostly-stock portfolio, ~20% all stocks. Higher volatility means more sequence-of-returns risk: the same average return with bigger swings fails more often." />
              </span>
              <input type="range" min={5} max={25} step={1} value={returnVolPct} onChange={(e) => setReturnVolPct(Number(e.target.value))} />
            </div>
          ) : (
            <div className="field">
              <span className="field-label-row">
                <span className="field-label">Equity weight: {equityWeightPct}/{100 - equityWeightPct}</span>
                <HelpTip text="The stock/bond mix used when sampling historical years (e.g. 60/40 = 60% S&P 500, 40% 10-year Treasuries). It shapes how volatile the resampled history is; your accounts' expected returns still come from the Accounts/Assumptions forms." />
              </span>
              <input type="range" min={0} max={100} step={5} value={equityWeightPct} onChange={(e) => setEquityWeightPct(Number(e.target.value))} />
            </div>
          )}
          <div className="field">
            <span className="field-label-row">
              <span className="field-label">Market draw</span>
              <HelpTip text="The random sequence is reproducible: the same draw always produces the same thousand markets, so results don't jump around as you edit the plan. Re-roll to check the conclusion holds under a different draw — if success swings more than a point or two, run 10,000 paths. The exact seed number is under Advanced models." />
            </span>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setSeed((Math.random() * 0xffffffff) >>> 0)}>
              Re-roll markets
            </button>
          </div>
          <div className="field">
            <span className="field-label-row">
              <span className="field-label">Precision</span>
              <HelpTip text="1,000 paths run automatically and put the success rate within roughly ±1.5 points. 10,000 paths tighten that to about ±0.5 — useful when comparing strategies that differ by a hair." />
            </span>
            <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={() => run(ON_DEMAND_PATH_COUNT)}>
              Run {ON_DEMAND_PATH_COUNT.toLocaleString()} paths
            </button>
          </div>
          <div className="field">
            <label className="radio-option">
              <input type="checkbox" checked={stochasticLongevity} onChange={(e) => setStochasticLongevity(e.target.checked)} />
              <span>
                <span className="field-label-row">
                  <span className="field-label">Model longevity</span>
                  <HelpTip text="Instead of everyone living to their fixed planning age, each path draws a lifespan from SSA mortality tables (by age and sex). Outcomes are then weighted by how long people actually live — dying earlier frees the plan, living longer stresses it. Couples use a joint-life RMD divisor when one spouse is much younger." />
                </span>
                <p className="field-hint">Draw lifespans from mortality tables instead of the fixed planning age.</p>
              </span>
            </label>
          </div>
          <div className="field">
            <label className="radio-option">
              <input type="checkbox" checked={ltcShock} onChange={(e) => setLtcShock(e.target.checked)} />
              <span>
                <span className="field-label-row">
                  <span className="field-label">Model an LTC shock</span>
                  <HelpTip text="Each path may draw a paid long-term-care episode (incidence, onset age, and duration from published LTC-risk research), adding a late-life cost spike. Any LTC policy you've entered offsets it — so the success rate with vs. without coverage shows what the policy buys you across the whole distribution." />
                </span>
                <p className="field-hint">Add a probabilistic care episode; your LTC policy offsets it.</p>
              </span>
            </label>
          </div>
        </div>
        {running ? (
          <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
          </div>
        ) : null}
        {error ? (
          <div className="error-recovery" role="alert">
            <p className="error-text">Simulation error: {error}</p>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => run(DEFAULT_PATH_COUNT)}>
              Run again
            </button>
          </div>
        ) : null}
      </div>

      {summary === null ? (
        error ? null : <div className="skeleton" style={{ height: '22rem' }} aria-label="Simulating" />
      ) : (
        <>
          <div className="mc-hero">
            <SuccessGauge rate={summary.successRate} pathCount={summary.pathCount} />
            <div>
              <h2>{successBand(summary.successRate).verdict}</h2>
              <p className="muted">
                Median ending estate {fmtMoneyCompact(summary.endingAfterTaxEstate.percentiles.p50)} · worst 10%{' '}
                {fmtMoneyCompact(summary.endingAfterTaxEstate.percentiles.p10)} · best 10%{' '}
                {fmtMoneyCompact(summary.endingAfterTaxEstate.percentiles.p90)}. Success means investable assets never run
                out before the end of the plan.
              </p>
              {summary.successRate < 0.9 ? (
                <p className="mc-handrail">
                  A result like this is usually movable — small changes to spending, retirement age, or claiming
                  strategy shift it the most. See what would change this:{' '}
                  <Link to={`/plan/${plan.id}/insights`}>Insights</Link> ·{' '}
                  <Link to={`/plan/${plan.id}/spending-solver`}>How much can I spend?</Link>
                </p>
              ) : null}
            </div>
          </div>

          <WhySuccessPanel summary={summary} modelLabel={catalogLabelOf(modelKind)} seed={seed} planId={plan.id} />

          <div className="chart-card">
            <h2>Downside risk</h2>
            <p className="card-hint">
              Success rate answers "did the plan last?" These metrics show how deep the misses are when it does not.
            </p>
            <div className="stat-grid">
              <div>
                <div className="stat-value">{fmtMoneyCompact(summary.endingAfterTaxEstate.percentiles.p10)}</div>
                <div className="muted">
                  In the worst 10% of markets, you&apos;d end with{' '}
                  <HelpTip
                    text="The 10th-percentile (p10) ending estate: 9 in 10 simulated markets leave you with more than this, 1 in 10 with less."
                    learn={{ slug: 'understanding-monte-carlo-success-rate', label: 'Understanding success rate' }}
                  />
                </div>
              </div>
              <div>
                <div className="stat-value">{fmtMoneyCompact(summary.downsideRisk.expectedShortfallDollars)}</div>
                <div className="muted">
                  Typical shortfall when the plan falls short{' '}
                  <HelpTip
                    text="Expected shortfall: the average unmet spending across only the markets where the money runs out — a sense of how bad a bad outcome tends to be."
                    learn={{ slug: 'sequence-of-returns-risk', label: 'Sequence-of-returns risk' }}
                  />
                </div>
              </div>
              <div>
                <div className="stat-value">{fmtMoneyCompact(summary.spendingShortfall.p90TotalShortfallDollars)}</div>
                <div className="muted">
                  Worst-case total spending miss{' '}
                  <HelpTip text="The 90th-percentile (p90) cumulative shortfall: in the worst 10% of markets, total unmet spending across the whole retirement reaches at least this much." />
                </div>
              </div>
              <div>
                <div className="stat-value">{Math.round(summary.downsideRisk.failureRate * 100)}%</div>
                <div className="muted">
                  Chance the money runs out{' '}
                  <HelpTip text="The share of simulated markets in which investable assets are depleted before the end of the plan — the complement of the success rate." />
                </div>
              </div>
            </div>
            {depletionRows.length > 0 ? (
              <div
                className="chart-frame chart-frame--spaced"
                style={frameH(220)}
                role="img"
                aria-label={`Depletion probability by year: by ${depletionRows[depletionRows.length - 1]!.year}, ${depletionRows[depletionRows.length - 1]!.cumulativeProbability.toFixed(1)} percent of paths have depleted.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={depletionRows} margin={{ left: 12, right: 8, top: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(Number(v))}%`} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} />
                    <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} contentStyle={chartTooltipStyle} />
                    <Bar dataKey="probability" name="First depletion" fill="var(--chart-3)" />
                    {/* Rising depletion odds must not wear the brand/good green. */}
                    <Line dataKey="cumulativeProbability" name="Depleted by year" stroke="var(--bad)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">No path depleted, so there is no depletion-by-year curve to show.</p>
            )}
          </div>

          {summary.requiredFloorSuccessRate !== summary.successRate ||
          summary.targetLifestyleSuccessRate !== summary.successRate ||
          summary.idealFundingRate < 1 ||
          summary.excessFundingRate < 1 ||
          summary.flexibleGoals.funded + summary.flexibleGoals.partiallyFunded + summary.flexibleGoals.deferred + summary.flexibleGoals.skipped > 0 ||
          summary.guardrailActionCounts.cut + summary.guardrailActionCounts.raise > 0 ? (
            <div className="chart-card">
              <h2>Spending resilience</h2>
              <p className="card-hint">
                With a required floor or spending guardrails, a single success number is too blunt. These separate
                funding the essential floor every year from funding the full target lifestyle.
              </p>
              {/* Two headline numbers; the qualifying metrics live one click away
                  so they stop taxing the pair that matters (round-4 critique). */}
              <div className="stat-grid">
                <div>
                  <div className="stat-value">{Math.round(summary.requiredFloorSuccessRate * 100)}%</div>
                  <div className="muted">funded the required floor every year</div>
                </div>
                <div>
                  <div className="stat-value">{Math.round(summary.targetLifestyleSuccessRate * 100)}%</div>
                  <div className="muted">funded the full target lifestyle every year</div>
                </div>
              </div>
              <details className="ss-explainer">
                <summary>All resilience metrics</summary>
                <div className="stat-grid">
                  <div>
                    <div className="stat-value">{Math.round(summary.successRate * 100)}%</div>
                    <div className="muted">never depleted investable assets</div>
                  </div>
                  <div>
                    <div className="stat-value">{Math.round(summary.targetAttainmentPct.p50 * 100)}%</div>
                    <div className="muted">median target dollars funded</div>
                  </div>
                  <div>
                    <div className="stat-value">{fmtMoneyCompact(summary.p90AverageAnnualTargetShortfall)}</div>
                    <div className="muted">
                      Worst-case average annual target miss{' '}
                      <HelpTip text="The 90th-percentile (p90) average annual shortfall against the target lifestyle: only 1 in 10 markets miss by more." />
                    </div>
                  </div>
                  <div>
                    <div className="stat-value">{summary.averageYearsBelowTarget.toFixed(1)}</div>
                    <div className="muted">average years below target</div>
                  </div>
                  {summary.idealFundingRate < 1 || summary.excessFundingRate < 1 ? (
                    <div>
                      <div className="stat-value">
                        {Math.round(summary.idealFundingRate * 100)}% / {Math.round(summary.excessFundingRate * 100)}%
                      </div>
                      <div className="muted">ideal / excess upside funded</div>
                    </div>
                  ) : null}
                  {summary.flexibleGoals.funded + summary.flexibleGoals.partiallyFunded + summary.flexibleGoals.deferred + summary.flexibleGoals.skipped > 0 ? (
                    <div>
                      <div className="stat-value stat-value--sm">
                        {summary.flexibleGoals.funded} funded · {summary.flexibleGoals.partiallyFunded} partial ·{' '}
                        {summary.flexibleGoals.deferred} deferred · {summary.flexibleGoals.skipped} skipped
                      </div>
                      <div className="muted">flexible goal outcomes across paths</div>
                    </div>
                  ) : null}
                  {summary.guardrailActionCounts.cut + summary.guardrailActionCounts.raise > 0 ? (
                    <div>
                      <div className="stat-value stat-value--sm">
                        {summary.guardrailActionCounts.cut} cuts · {summary.guardrailActionCounts.raise} raises
                      </div>
                      <div className="muted">guardrail actions across path-years</div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          ) : null}

          {/* Guardrail modes only: ABW re-amortizes instead of cutting, so the
              cut/raise adjustment framing would just read as zeros there. */}
          {plan.expenses.spendingPolicy &&
          (plan.expenses.spendingPolicy.mode === 'withdrawalRateGuardrails' ||
            plan.expenses.spendingPolicy.mode === 'riskBasedGuardrails') ? (
            <div className="chart-card">
              <h2>Adjustment outlook</h2>
              <p className="card-hint">
                A more useful headline than one success number: how likely a mid-course spending adjustment is, how
                deep it tends to go, how long it lasts — and how likely the plan ends with money left over.
              </p>
              {/* Headline pair: how likely a cut is, how likely it ends well. */}
              <div className="stat-grid">
                <div>
                  <div className="stat-value">{Math.round(summary.adjustments.pathsWithCut * 100)}%</div>
                  <div className="muted">of paths needed at least one spending cut</div>
                </div>
                <div>
                  <div className="stat-value">{Math.round(summary.adjustments.probEndingSurplus * 100)}%</div>
                  <div className="muted">chance the plan ends with a surplus</div>
                </div>
              </div>
              <details className="ss-explainer">
                <summary>Cut depth, duration, and raises</summary>
                <div className="stat-grid">
                  <div>
                    <div className="stat-value">
                      {Math.round(summary.adjustments.medianMaxCutDepth * 100)}% / {Math.round(summary.adjustments.p90MaxCutDepth * 100)}%
                    </div>
                    <div className="muted">
                      median / worst-case deepest cut, as a share of flexible spending{' '}
                      <HelpTip text="Worst-case here is the 90th percentile (p90): only 1 in 10 cut paths dig deeper than this." />
                    </div>
                  </div>
                  <div>
                    <div className="stat-value">
                      {summary.adjustments.averageCutYears.toFixed(1)} / {summary.adjustments.p90CutYears.toFixed(0)}
                    </div>
                    <div className="muted">
                      average / worst-case years spent below target (cut paths){' '}
                      <HelpTip text="Worst-case here is the 90th percentile (p90) across cut paths." />
                    </div>
                  </div>
                  <div>
                    <div className="stat-value">{summary.adjustments.averageLongestCutSpellYears.toFixed(1)}</div>
                    <div className="muted">average longest consecutive cut spell, years</div>
                  </div>
                  <div>
                    <div className="stat-value">{Math.round(summary.adjustments.pathsWithRaise * 100)}%</div>
                    <div className="muted">of paths earned at least one raise</div>
                  </div>
                  {summary.adjustments.probEndingAboveBequestTarget !== null ? (
                    <div>
                      <div className="stat-value">{Math.round(summary.adjustments.probEndingAboveBequestTarget * 100)}%</div>
                      <div className="muted">chance the estate clears the bequest target</div>
                    </div>
                  ) : null}
                </div>
              </details>
              {plan.expenses.spendingPolicy.mode === 'riskBasedGuardrails' ? (
                plan.expenses.spendingPolicy.lowerBalanceThresholdPct !== undefined ||
                plan.expenses.spendingPolicy.upperBalanceThresholdPct !== undefined ? (
                  <p className="card-hint">
                    Risk-based dollar guardrails ({plan.expenses.spendingPolicy.targetSuccessLowerPct ?? 70}–
                    {plan.expenses.spendingPolicy.targetSuccessUpperPct ?? 95}% success band):{' '}
                    {plan.expenses.spendingPolicy.lowerBalanceThresholdPct !== undefined
                      ? `cut below ${fmtMoney((plan.expenses.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))}`
                      : 'no cut threshold'}
                    {' · '}
                    {plan.expenses.spendingPolicy.upperBalanceThresholdPct !== undefined
                      ? `raise above ${fmtMoney((plan.expenses.spendingPolicy.upperBalanceThresholdPct / 100) * startingInvestableOf(plan))}`
                      : 'no raise threshold'}
                    {' '}(today's dollars, solved on Spending).
                  </p>
                ) : (
                  <p className="card-hint">
                    Risk-based guardrails are selected but the dollar thresholds have not been solved yet — solve them
                    on the Spending screen to activate adjustments.
                  </p>
                )
              ) : null}
            </div>
          ) : null}

          <div className="chart-card">
            <div className="item-row-head">
              <h2 style={{ margin: 0 }}>Frontier views</h2>
              <button type="button" className="btn btn-secondary btn-small" disabled={frontierRunning} onClick={runFrontiers}>
                {frontierRunning ? 'Running...' : 'Run 200-path frontiers'}
              </button>
            </div>
            <p className="card-hint">
              These sweeps reuse the same seeded market paths for every point, so the curve shows the effect of the
              changed spending or retirement age instead of fresh random noise.
            </p>
            {frontierError ? (
              <div className="error-recovery" role="alert">
                <p className="error-text">Frontier run error: {frontierError}</p>
                <button type="button" className="btn btn-secondary btn-small" disabled={frontierRunning} onClick={runFrontiers}>
                  Run again
                </button>
              </div>
            ) : null}
            {visibleFrontier ? (
              <div className="chart-grid">
                <div>
                  <h3 style={{ marginTop: 0 }}>Spending vs. success</h3>
                  <div className="chart-frame" style={frameH(240)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleFrontier.spending} margin={{ left: 12, right: 8, top: 8 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="x" tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} />
                        <Tooltip
                          formatter={(v: unknown, name: unknown) =>
                            name === 'Success rate' ? `${Math.round(Number(v) * 100)}%` : fmtMoneyCompact(Number(v))
                          }
                          labelFormatter={(v) => `Spending ${fmtMoneyCompact(Number(v))}`}
                          contentStyle={chartTooltipStyle}
                        />
                        <Line dataKey="successRate" name="Success rate" stroke="var(--chart-1)" strokeWidth={2.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 style={{ marginTop: 0 }}>Retirement age vs. success</h3>
                  <div className="chart-frame" style={frameH(240)}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleFrontier.retirement} margin={{ left: 12, right: 8, top: 8 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="x" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} />
                        <Tooltip
                          formatter={(v: unknown, name: unknown) =>
                            name === 'Success rate' ? `${Math.round(Number(v) * 100)}%` : fmtMoneyCompact(Number(v))
                          }
                          labelFormatter={(v) => `Retirement age ${v}`}
                          contentStyle={chartTooltipStyle}
                        />
                        <Line dataKey="successRate" name="Success rate" stroke="var(--chart-2)" strokeWidth={2.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">Run the frontier sweep to compare bounded variants on the same market paths.</p>
            )}
            {visibleFrontier && visibleFrontier.annuitization.points.length > 1 ? (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>How much to annuitize?</h3>
                <p className="card-hint">
                  Each point trades that share of your investable assets for an immediate life annuity (payout rate{' '}
                  {visibleFrontier.annuitization.payoutRatePct.toFixed(1)}% at age {visibleFrontier.annuitization.startAge},{' '}
                  {visibleFrontier.annuitization.rateSource === 'default-table'
                    ? 'from a published-quote planning table — check a marketplace quote before acting'
                    : 'from your entered quote'}
                  ), priced on the exact ledger over the same market paths.
                  {visibleFrontier.annuitization.attributionAvailable
                    ? ' The dashed line holds the same dollars but shifts them from bonds to stocks instead of buying the annuity — the implicit rising-equity glidepath that research attributes much of a SPIA\'s benefit to. The gap between the lines is what annuitization adds beyond it (mortality credits, spending floor), net of lost liquidity.'
                    : ''}
                </p>
                <div className="chart-grid">
                  <div>
                    <div className="chart-frame" style={frameH(240)}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={visibleFrontier.annuitization.points.map((p) => ({
                            pct: Math.round(p.effectiveAllocationPct * 10) / 10,
                            success: p.metrics.successRate,
                            control: p.glidepathControl?.successRate,
                          }))}
                          margin={{ left: 12, right: 8, top: 8 }}
                        >
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                          <XAxis dataKey="pct" tickFormatter={(v) => `${v}%`} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={56} />
                          <Tooltip
                            formatter={(v: unknown) =>
                              Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : '—'
                            }
                            labelFormatter={(v) => `${v}% annuitized`}
                            contentStyle={chartTooltipStyle}
                          />
                          <Line dataKey="success" name="Success rate (annuitized)" stroke="var(--chart-1)" strokeWidth={2.5} />
                          {visibleFrontier.annuitization.attributionAvailable ? (
                            <Line
                              dataKey="control"
                              name="Glidepath only (no annuity)"
                              stroke="var(--chart-3)"
                              strokeWidth={2}
                              strokeDasharray="6 4"
                            />
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <div className="year-table-wrap" style={{ border: 'none' }}>
                      <table className="compare-table">
                        <thead>
                          <tr>
                            <th>Annuitized</th>
                            <th>Premium</th>
                            <th>Income/yr</th>
                            <th>Median estate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleFrontier.annuitization.points.map((p) => (
                            <tr key={p.allocationPct}>
                              <td>{Math.round(p.effectiveAllocationPct * 10) / 10}%</td>
                              <td>{fmtMoneyCompact(p.premium)}</td>
                              <td>{fmtMoneyCompact(p.annualIncome)}</td>
                              <td>{fmtMoneyCompact(p.metrics.medianEndingAfterTaxEstate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                {visibleFrontier.annuitization.notes.map((note) => (
                  <p key={note} className="muted" style={{ marginBottom: 0 }}>
                    {note}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="chart-card">
            <div className="item-row-head">
              <h2 style={{ margin: 0 }}>Historical stress windows</h2>
              <button type="button" className="btn btn-secondary btn-small" disabled={historicalRunning} onClick={runHistoricalSuites}>
                {historicalRunning ? 'Running...' : 'Run rolling/reversed suite'}
              </button>
            </div>
            <p className="card-hint">
              Replay every rolling historical window, then replay those windows in reverse order, to find the named
              sequences that hurt this plan most.
            </p>
            {historicalError ? (
              <div className="error-recovery" role="alert">
                <p className="error-text">Stress suite error: {historicalError}</p>
                <button type="button" className="btn btn-secondary btn-small" disabled={historicalRunning} onClick={runHistoricalSuites}>
                  Run again
                </button>
              </div>
            ) : null}
            {visibleHistorical ? (
              <div className="chart-grid">
                {visibleHistorical.suites.map((suite) => (
                  <div key={suite.kind}>
                    <h3 style={{ marginTop: 0 }}>{suite.name}</h3>
                    <div className="year-table-wrap" style={{ border: 'none' }}>
                      <table className="compare-table">
                        <thead>
                          <tr>
                            <th>Window</th>
                            <th>Estate</th>
                            <th>Depletes</th>
                            <th>Shortfall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suite.worstByEndingAfterTaxEstate.map((window) => (
                            <tr key={window.label}>
                              <td>{window.label}</td>
                              <td>{fmtMoneyCompact(window.summary.endingAfterTaxEstate)}</td>
                              <td>{window.projection.depletionYear ?? 'never'}</td>
                              <td>{fmtMoneyCompact(window.totalShortfall)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Run the suite to list the worst rolling and reversed historical windows.</p>
            )}
          </div>

          <div className="chart-card">
            <h2>Range of outcomes</h2>
            <p className="card-hint">Investable assets per year (nominal). Bands: 10–90th and 25–75th percentiles; line: median.</p>
            <div
              className="chart-frame"
              style={frameH(340)}
              role="img"
              aria-label={
                fanRows.length > 0
                  ? `Fan chart of investable assets by year. In ${fanRows[fanRows.length - 1]!.year}, the median is ${fmtMoneyCompact(fanRows[fanRows.length - 1]!.p50)}, with the 10th to 90th percentile range spanning ${fmtMoneyCompact(fanRows[fanRows.length - 1]!.p10)} to ${fmtMoneyCompact(fanRows[fanRows.length - 1]!.p90)}.`
                  : 'Fan chart of investable assets by year.'
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fanRows} margin={{ left: 12, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={chartTooltipStyle} />
                  <Area dataKey="p10" stackId="outer" stroke="none" fill="transparent" name="p10" />
                  <Area dataKey={(d: { p10: number; p90: number }) => d.p90 - d.p10} stackId="outer" stroke="none" fill="var(--chart-1)" fillOpacity={0.18} name="10–90%" />
                  <Area dataKey="p25" stackId="inner" stroke="none" fill="transparent" name="p25" legendType="none" />
                  <Area dataKey={(d: { p25: number; p75: number }) => d.p75 - d.p25} stackId="inner" stroke="none" fill="var(--chart-1)" fillOpacity={0.3} name="25–75%" />
                  <Line dataKey="p50" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} name="Median" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <h2>Ending balance distribution</h2>
              <div
                className="chart-frame"
                style={frameH(240)}
                role="img"
                aria-label={`Histogram of ending investable balances across ${summary.pathCount.toLocaleString()} simulated paths. Median ending estate ${fmtMoneyCompact(summary.endingAfterTaxEstate.percentiles.p50)}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histRows} margin={{ left: 4, right: 8, top: 8 }}>
                    <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} width={40} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="count" name="Paths" fill="var(--chart-2)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="chart-card">
              <h2>When depleting plans run out</h2>
              {summary.depletionYearCounts.length === 0 ? (
                <p className="muted">No path depleted — every simulated market carried the plan to the end.</p>
              ) : (
                <div
                  className="chart-frame"
                  style={frameH(240)}
                  role="img"
                  aria-label={`Histogram of first-depletion years for the ${summary.depletionYearCounts.reduce((a, r) => a + r.count, 0)} paths that ran out of money.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.depletionYearCounts} margin={{ left: 4, right: 8, top: 8 }}>
                      <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} width={40} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="count" name="Paths" fill="var(--chart-3)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

        </>
      )}

      <LearnAboutScreen route="/plan/:planId/monte-carlo" />
    </section>
  )
}

