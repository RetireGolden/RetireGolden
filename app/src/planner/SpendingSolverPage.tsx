/**
 * "How much can I spend?" (sustainable-spending plan, Step 4): runs the
 * exact-ledger max-spending solver (`solveMaxSustainableSpending`) in a Web
 * Worker and presents the answer with its constraints — the no-depletion
 * horizon and the optional bequest target from the Spending screen — plus the
 * exact-ledger evidence at the solved level. Deterministic: identical inputs
 * re-solve to identical answers under the fixed ~25-simulation budget.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { compareSwrRules } from '../engine/decisions/swrComparator'
import { startingInvestableOf } from '../engine/montecarlo/riskBasedGuardrails'
import { spendingShapePhases, type SpendingShapeId } from '../engine/spending/shapePresets'
import type { Plan } from '../engine/model/plan'
import type { SpendingSolveResult } from '../optimize/spendingMessages'
import { runSpendingSolve } from '../optimize/spendingRunner'
import { usePlan } from './planContextCore'
import { HelpTip } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { LearnLink } from '../learn/LearnLink'
import { fmtMoney } from './format'
import { LEARN } from './learnLinks'
import { currentStartYear, taxCalculatorFor } from './useProjection'

function makeScenarioId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `scenario-${crypto.randomUUID()}`
    : `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function Stat({
  label,
  value,
  tone,
  help,
  small = false,
}: {
  label: string
  value: string
  tone: 'good' | 'bad' | 'neutral'
  help: string
  small?: boolean
}) {
  return (
    <div className="card">
      <span className="field-label-row">
        <span className="field-label">{label}</span>
        <HelpTip text={help} />
      </span>
      <div className={`stat-value${small ? ' stat-value--sm' : ''} stat-value--${tone}`}>{value}</div>
    </div>
  )
}

interface ShapeRow {
  id: SpendingShapeId
  label: string
  maxBaseAnnual: number | null
}

const SHAPE_DEFS: { id: SpendingShapeId; label: string }[] = [
  { id: 'flat', label: 'Constant-real (no decline)' },
  { id: 'smile', label: 'Smile — average retiree (−10% at 75, −20% at 85)' },
  { id: 'smirk', label: 'Smirk — median retiree (−1%/yr real)' },
]

export function SpendingSolverPage() {
  const { plan, update } = usePlan()
  const navigate = useNavigate()
  const startYear = currentStartYear()

  const [result, setResult] = useState<SpendingSolveResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runToken = useRef(0)

  // Amortized spending recomputes annual spending from the portfolio, so the
  // fixed-baseline bisection has nothing to move (the engine solver refuses
  // ABW plans with a diagnostic). Skip solving and explain instead; the
  // per-shape and SWR cards below solve fixed-target variants and stay useful.
  const abwActive = plan.expenses.spendingPolicy?.mode === 'abw'

  // --- solver output per spending shape (on demand; ~25 sims per shape) ----
  // Results are keyed to the plan object they were solved on, so an edit
  // anywhere simply makes them disappear instead of showing stale answers.
  const [shapeState, setShapeState] = useState<{
    forPlan: Plan
    rows: ShapeRow[] | null
    error: string | null
  } | null>(null)
  const [shapesRunning, setShapesRunning] = useState(false)
  const shapeToken = useRef(0)
  const shapeRows = shapeState !== null && shapeState.forPlan === plan ? shapeState.rows : null
  const shapesError = shapeState !== null && shapeState.forPlan === plan ? shapeState.error : null
  const compareShapes = () => {
    const token = ++shapeToken.current
    const forPlan = plan
    setShapesRunning(true)
    setShapeState(null)
    const retirementAge = plan.household.people[0]?.retirementAge ?? 65
    void (async () => {
      try {
        const rows: ShapeRow[] = []
        for (const def of SHAPE_DEFS) {
          const variant: Plan = {
            ...forPlan,
            expenses: {
              ...forPlan.expenses,
              phases: spendingShapePhases(def.id, retirementAge),
              // Under ABW the ledger ignores baseAnnual/phases entirely, so a
              // per-shape solve must price fixed-target variants; guardrail
              // policies stay (the solver handles them).
              ...(forPlan.expenses.spendingPolicy?.mode === 'abw' ? { spendingPolicy: undefined } : {}),
            },
          }
          const solved = await runSpendingSolve({ plan: variant, startYear })
          rows.push({ ...def, maxBaseAnnual: solved.maxBaseAnnual })
        }
        if (token === shapeToken.current) setShapeState({ forPlan, rows, error: null })
      } catch (e: unknown) {
        if (token === shapeToken.current) {
          setShapeState({ forPlan, rows: null, error: e instanceof Error ? e.message : String(e) })
        }
      } finally {
        if (token === shapeToken.current) setShapesRunning(false)
      }
    })()
  }

  // --- published SWR rules on this plan (three deterministic ledger runs) --
  const swrRows = useMemo(
    () => compareSwrRules(plan, { startYear, taxCalculator: taxCalculatorFor(plan) }),
    [plan, startYear],
  )
  const startingInvestable = useMemo(() => startingInvestableOf(plan), [plan])

  const run = useCallback(() => {
    const token = ++runToken.current
    setRunning(true)
    setError(null)
    runSpendingSolve({ plan, startYear })
      .then((r) => {
        if (token === runToken.current) setResult(r)
      })
      .catch((e: unknown) => {
        if (token === runToken.current) {
          setError(e instanceof Error ? e.message : String(e))
          setResult(null)
        }
      })
      .finally(() => {
        if (token === runToken.current) setRunning(false)
      })
  }, [plan, startYear])

  // Auto-run on plan change (debounced), like the Roth & Tax Optimizer.
  useEffect(() => {
    if (abwActive) return // nothing to solve; the ABW callout explains
    const t = window.setTimeout(run, 300)
    return () => window.clearTimeout(t)
  }, [run, abwActive])

  // The solver bisects to ~$500 resolution; a to-the-dollar headline claims
  // precision the answer doesn't have. Floor to $100 (still feasible — it's
  // below the level that passed) and use the same number everywhere: display,
  // Apply, and scenarios.
  const solvedRounded = result?.maxBaseAnnual != null ? Math.floor(result.maxBaseAnnual / 100) * 100 : null

  const applyToSpending = () => {
    if (solvedRounded === null) return
    const solved = solvedRounded
    update((d) => {
      d.expenses.baseAnnual = solved
    })
    // Land on Spending so the applied baseline is visible where it's edited.
    navigate(`/plan/${plan.id}/spending`)
  }

  const addScenario = () => {
    if (solvedRounded === null) return
    const solved = solvedRounded
    const baseName = `Spend ${fmtMoney(solved)}/yr (max sustainable)`
    const names = new Set(plan.scenarios.map((s) => s.name))
    let name = baseName
    let suffix = 2
    while (names.has(name)) name = `${baseName} (${suffix++})`
    update((d) => {
      d.scenarios.push({ id: makeScenarioId(), name, patch: { expenses: { baseAnnual: solved } } })
    })
    navigate(`/plan/${plan.id}/scenarios`)
  }

  // Slack measured against the rounded display value so the two tiles agree.
  const slack = result && solvedRounded !== null ? solvedRounded - result.currentBaseAnnual : null
  // Deflate nominal end-of-plan evidence back to today's dollars so it reads
  // on the same scale as the today's-dollars spending answer.
  const deflator =
    result?.evidence != null
      ? Math.pow(1 + plan.assumptions.inflationPct / 100, -(result.evidence.endYear - startYear))
      : 1

  return (
    <section>
      <div className="card">
        <h2>How much can I spend?</h2>
        <p className="card-hint">
          Finds the highest annual base spending (today's dollars) your exact projection ledger can sustain: the plan
          must never run out of investable money through the full horizon, and the ending after-tax estate must stay at
          or above your bequest target. Every probed level re-runs the whole ledger — taxes, ACA and IRMAA cliffs,
          withdrawal order, healthcare, debts, and survivor years all price in. Phases and one-time goals stay as
          entered; only the baseline level moves. <LearnLink {...LEARN.sustainableSpending} />
        </p>
        {abwActive ? (
          <div className="callout callout--info">
            <p className="card-hint">
              This plan uses <strong>amortized spending (ABW)</strong>: annual spending is recomputed from the actual
              portfolio every year, so there is no fixed base-spending level to solve for — the amortization rule{' '}
              <em>is</em> the answer to &quot;how much can I spend?&quot;, and it adjusts itself as markets move. See
              each year&apos;s amount on Results, or switch the spending policy back to fixed target under{' '}
              <Link to={`/plan/${plan.id}/spending`}>Spending</Link> to use this solver. The shape and published-rule
              comparisons below solve fixed-target variants of your plan and remain useful.
            </p>
          </div>
        ) : (
          <p className="field-hint">
            {result && result.estateFloorTodayDollars > 0 ? (
              <>
                Enforcing your {fmtMoney(result.estateFloorTodayDollars)} bequest target (today's dollars) from{' '}
                <Link to={`/plan/${plan.id}/spending`}>Spending</Link>.
              </>
            ) : (
              <>
                No bequest target set — the only constraint is not running out. Set one under{' '}
                <Link to={`/plan/${plan.id}/spending`}>Spending</Link> to protect an estate floor.
              </>
            )}
          </p>
        )}
        {running ? <div className="skeleton" style={{ height: '2rem', marginTop: '0.75rem' }} aria-label="Solving" /> : null}
        {error ? <p style={{ color: 'var(--bad)' }}>Solver error: {error}</p> : null}
        {error && !running ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-small" onClick={run}>
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {result && !running ? (
        result.maxBaseAnnual === null ? (
          <div className="card">
            <h2 style={{ color: 'var(--bad)' }}>No sustainable spending level found</h2>
            <p className="muted">
              {result.diagnostics.length > 0
                ? result.diagnostics.join(' ')
                : 'Even minimal base spending depletes the portfolio or breaks the bequest target within the plan horizon.'}{' '}
              Fixed costs modeled outside baseline spending (healthcare, debt service, property carrying costs, one-time
              goals) may already exceed what the plan can fund.
            </p>
          </div>
        ) : (
          <>
            <div className="mc-hero">
              <div>
                <h2 style={{ margin: '0 0 0.35rem', color: slack !== null && slack >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                  Your plan can sustain about {fmtMoney(solvedRounded ?? 0)} of baseline spending per year.
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {slack !== null && slack >= 0
                    ? `That is ${fmtMoney(slack)} per year of headroom above your current ${fmtMoney(result.currentBaseAnnual)} baseline (today's dollars).`
                    : `That is ${fmtMoney(Math.abs(slack ?? 0))} per year BELOW your current ${fmtMoney(result.currentBaseAnnual)} baseline — your projection cannot sustain today's spending through the horizon.`}
                  {!result.converged
                    ? ' The simulation budget ran out before the answer fully converged, so this is a feasible lower bound.'
                    : ''}
                </p>
              </div>
            </div>

            <div className="stat-grid">
              <Stat
                label="Max sustainable spending"
                value={`${fmtMoney(solvedRounded ?? 0)}/yr`}
                tone="neutral"
                help="Highest annual baseline spending (today's dollars) whose full year-by-year projection never depletes investable assets and keeps the ending after-tax estate at or above your bequest target. Solved by bisection to ~$500 resolution, then shown rounded down to the nearest $100 — the same rounded figure is what Apply and scenarios use."
              />
              <Stat
                label="Spending slack"
                value={`${slack !== null && slack >= 0 ? '+' : ''}${fmtMoney(slack ?? 0)}/yr`}
                tone={slack !== null && slack > 0 ? 'good' : slack !== null && slack < 0 ? 'bad' : 'neutral'}
                help="Max sustainable spending minus your current baseline. Positive = headroom you are not using; negative = the current baseline overspends what your plan can sustain."
              />
              <Stat
                label="What limits it"
                value={
                  result.limitingConstraint === 'estate-floor'
                    ? 'Bequest target'
                    : result.limitingConstraint === 'depletion'
                      ? 'Depletion — at higher spending'
                      : 'No limit found'
                }
                tone="neutral"
                small
                help="What failed at the next-higher spending level the solver probed — not at the answer above, which passed. 'Depletion' means spending any more than the answer would run the portfolio out of money before the end of the plan; 'Bequest target' means the ending estate would fall below your floor. 'No limit found' means spending appeared unbounded at every probed level (guaranteed income outruns spending)."
              />
            </div>

            {result.evidence ? (
              <div className="card">
                <h2>Evidence at that level</h2>
                <p className="card-hint">
                  From the full projection run at the solver&apos;s exact answer (shown as{' '}
                  {fmtMoney(solvedRounded ?? 0)}/yr, rounded down to the nearest $100) — the same year-by-year
                  numbers Results shows, not an approximation.
                </p>
                <ul style={{ margin: '0.25rem 0 0.75rem 1.1rem', lineHeight: 1.7 }}>
                  <li>
                    Money lasts through <strong>{result.evidence.endYear}</strong> (end of plan
                    {result.evidence.depletionYear === null ? ', never depleting' : ''}).
                  </li>
                  <li>
                    Ending after-tax estate: <strong>{fmtMoney(result.evidence.endingAfterTaxEstate * deflator)}</strong>{' '}
                    today's dollars ({fmtMoney(result.evidence.endingAfterTaxEstate)} nominal)
                    {result.estateFloorTodayDollars > 0 ? ` vs. the ${fmtMoney(result.estateFloorTodayDollars)} floor` : ''}.
                  </li>
                  <li>
                    Lifetime taxes and penalties at that spending level:{' '}
                    <strong>{fmtMoney(result.evidence.lifetimeTaxesAndPenalties)}</strong> (nominal, summed).
                  </li>
                </ul>
                <p className="field-hint">
                  Solved in {result.simulationCount} full-plan simulations
                  {result.converged ? ', converged to ~$500 resolution.' : ' — budget exhausted, feasible lower bound.'}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-small" onClick={applyToSpending}>
                    Apply to Spending
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={addScenario}>
                    Add as scenario
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={run}>
                    Re-solve
                  </button>
                </div>
                <p className="field-hint" style={{ marginTop: '0.5rem' }}>
                  "Apply to Spending" sets your plan's baseline spending to {fmtMoney(solvedRounded ?? 0)}/yr and opens
                  the Spending screen. "Add as scenario" instead creates a side-by-side scenario under Scenarios without
                  changing your plan.
                </p>
                <details className="ss-explainer">
                  <summary>Why this number?</summary>
                  <p>
                    The solver bisects on the baseline spending level: each probe re-runs your entire year-by-year
                    projection (taxes, ACA/IRMAA cliffs, withdrawal order, healthcare, debts, survivor years) and
                    checks two constraints — investable assets must never deplete before {result.evidence.endYear}, and
                    the ending after-tax estate must stay at or above{' '}
                    {result.estateFloorTodayDollars > 0
                      ? `your ${fmtMoney(result.estateFloorTodayDollars)} bequest target`
                      : 'zero (no bequest target set)'}
                    . The solver&apos;s exact answer is the highest level that passed both — it is shown, applied,
                    and added to scenarios rounded down to the nearest $100 ({fmtMoney(solvedRounded ?? 0)}), which
                    therefore also passes. The next-higher probe failed on{' '}
                    {result.limitingConstraint === 'estate-floor'
                      ? 'the bequest target'
                      : result.limitingConstraint === 'depletion'
                        ? 'running out of money'
                        : 'nothing (spending appeared unbounded at every probed level)'}
                    . This answer used {result.simulationCount} full-projection runs
                    {result.converged ? ' and converged to ~$500 resolution' : ' before the budget ran out (feasible lower bound)'}
                    . The assumptions behind every run are on{' '}
                    <Link to={`/plan/${plan.id}/assumptions-card`}>your assumptions card</Link>.
                  </p>
                </details>
              </div>
            ) : null}
          </>
        )
      ) : null}

      <div className="card">
        <h2>What shape of spending?</h2>
        <p className="card-hint">
          The answer above keeps your phases as entered. Research on actual retirees says spending rarely stays
          constant-real: the <em>average</em> path is a &quot;smile&quot; (a slow decline that late-life healthcare
          partly reverses — the preset approximates it as two downward steps) and the <em>median</em> path is a
          &quot;smirk&quot; — a steady ~1%/yr real decline with no late rise at all (Blanchett).
          Shape-aware plans support a higher initial spend from the same portfolio. Solve your plan under each shape
          to see the size of that effect here — apply a shape on the{' '}
          <Link to={`/plan/${plan.id}/spending`}>Spending</Link> screen if you want to keep it.{' '}
          <LearnLink {...LEARN.spendingProfiles} />
        </p>
        {shapeRows === null && !shapesRunning ? (
          <button type="button" className="btn btn-secondary btn-small" onClick={compareShapes}>
            Solve per shape (~75 simulations)
          </button>
        ) : null}
        {shapesRunning ? <div className="skeleton" style={{ height: '2rem' }} aria-label="Solving per shape" /> : null}
        {shapesError ? <p style={{ color: 'var(--bad)' }}>Per-shape solve error: {shapesError}</p> : null}
        {shapeRows !== null && !shapesRunning ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Spending shape</th>
                    <th style={{ textAlign: 'right' }}>Max sustainable initial spend</th>
                    <th style={{ textAlign: 'right' }}>vs constant-real</th>
                  </tr>
                </thead>
                <tbody>
                  {shapeRows.map((row) => {
                    const flat = shapeRows.find((r) => r.id === 'flat')?.maxBaseAnnual ?? null
                    const delta = row.maxBaseAnnual !== null && flat !== null ? row.maxBaseAnnual - flat : null
                    return (
                      <tr key={row.id}>
                        <td>{row.label}</td>
                        <td style={{ textAlign: 'right' }}>
                          {row.maxBaseAnnual !== null ? `${fmtMoney(Math.floor(row.maxBaseAnnual / 100) * 100)}/yr` : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {delta === null || row.id === 'flat' ? '—' : `${delta >= 0 ? '+' : ''}${fmtMoney(delta)}/yr`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="field-hint" style={{ marginTop: '0.5rem' }}>
              Each row re-solves your full plan with that shape&apos;s phase rows (initial spend in today&apos;s
              dollars; later years follow the shape). No shape is &quot;the answer&quot; — they are framings of how
              your own later-life spending might behave.
            </p>
          </>
        ) : null}
      </div>

      <div className="card">
        <h2>Whose 4% rule? Published rules vs this plan</h2>
        <p className="card-hint">
          The community argues about the &quot;right&quot; safe withdrawal rate — Bengen&apos;s 2025 book says 4.7%,
          Morningstar&apos;s latest study says 3.9%, Early Retirement Now conditions it on market valuations. Here is
          each published rule priced on <em>your</em> plan through the same year-by-year ledger, next to your
          plan&apos;s own solved answer above. The rules assume constant-real spending of a fixed fraction of the
          starting portfolio; your solver answer prices your actual phases, taxes, and horizon — which is why they
          differ.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Rule</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Spending/yr</th>
                <th style={{ textAlign: 'left' }}>On your plan</th>
                <th style={{ textAlign: 'right' }}>Ending estate (today&apos;s $)</th>
              </tr>
            </thead>
            <tbody>
              {swrRows.map((row) => {
                const deflate = Math.pow(1 + plan.assumptions.inflationPct / 100, -(row.endYear - startYear))
                return (
                  <tr key={row.id}>
                    <td>
                      {row.label} <HelpTip text={row.citation} />
                    </td>
                    <td style={{ textAlign: 'right' }}>{row.initialRatePct.toFixed(2)}%</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(row.initialAnnualSpend)}</td>
                    <td>
                      {row.depletionYear === null ? (
                        <span style={{ color: 'var(--good)' }}>lasts through {row.endYear}</span>
                      ) : (
                        <span style={{ color: 'var(--bad)' }}>runs out in {row.depletionYear}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.depletionYear === null ? fmtMoney(row.endingAfterTaxEstate * deflate) : '—'}
                    </td>
                  </tr>
                )
              })}
              {solvedRounded !== null && startingInvestable > 0 ? (
                <tr>
                  <td>
                    <strong>This plan&apos;s solver</strong>{' '}
                    <HelpTip text="The exact-ledger answer from the top of this page, expressed as an initial rate on the same starting investable balance so it can sit in the same table. Unlike the published rules it prices your actual phases, taxes, healthcare, and horizon." />
                  </td>
                  <td style={{ textAlign: 'right' }}>{((solvedRounded / startingInvestable) * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(solvedRounded)}</td>
                  <td>solved on your exact plan</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="field-hint" style={{ marginTop: '0.5rem' }}>
          Each rule runs with your accounts, taxes, healthcare, goals, and horizon unchanged — only recurring
          lifestyle spending is set to the rule&apos;s level (constant-real, as the rules define it). A rule
          &quot;running out&quot; on your plan usually means your horizon is longer than the 30 years the rule was
          derived for, or your fixed costs differ from a generic retiree&apos;s — evidence for why a plan-specific
          answer beats a debate about whose rule is right.
        </p>
      </div>

      <LearnAboutScreen route="/plan/:planId/spending-solver" />
    </section>
  )
}
