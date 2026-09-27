/**
 * "How much can I spend?" (sustainable-spending plan, Step 4): runs the
 * exact-ledger max-spending solver (`solveMaxSustainableSpending`) in a Web
 * Worker and presents the answer with its constraints — the no-depletion
 * horizon and the optional bequest target from the Spending screen — plus the
 * exact-ledger evidence at the solved level. Deterministic: identical inputs
 * re-solve to identical answers under the fixed ~25-simulation budget.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { compareSwrRules } from '@retiregolden/engine/decisions/swrComparator'
import { isExactAnswerDiagnostic } from '@retiregolden/engine/decisions/spendingSolverDiagnostics'
import {
  planWithSpendingShape,
  SPENDING_SHAPE_COMPARISON,
  spendingShapeRows,
  type ComparedSpendingShape,
  type SolvedSpendingShape,
} from '@retiregolden/engine/decisions/spendingShapes'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { SpendingSolveResult } from '../optimize/spendingMessages'
import { runSpendingSolve } from '../optimize/spendingRunner'
import { diagnosticsWithoutUnpricedCreditSentence, formatYearRuns, unpricedCreditSpendingNote } from './acaVetoCopy'
import { usePlan } from './planContextCore'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { HelpTip } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { LearnLink } from '../learn/LearnLink'
import { fmtMoney } from './format'
import { LEARN } from './learnLinks'
import { currentStartYear, taxCalculatorFor } from './useProjection'
import { ScrollRegion } from './ScrollRegion'

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
  id: ComparedSpendingShape
  label: string
  /** The shape solve's published answer, as the engine's comparison rows carry it. */
  maxBaseAnnual: number | null
  /** The engine's difference from the flat row's published answer (R5); null on the flat row. */
  deltaVsFlatDollars: number | null
  /** Years whose premium tax credit that row's solve could not price. */
  acaGrossPremiumYears: number[]
  acaGrossPremiumDirection: SpendingSolveResult['acaGrossPremiumDirection']
}

/** Labels for the shapes the engine's comparison solves (`SPENDING_SHAPE_COMPARISON`), and only those. */
const SHAPE_LABELS: Record<ComparedSpendingShape, string> = {
  flat: 'Constant-real (no decline)',
  smile: 'Smile: average retiree (−10% at 75, −20% at 85)',
  smirk: 'Smirk: median retiree (−1%/yr real)',
}

/** Whether a plan spends under guardrails, where a lower level can fail although a higher one passed. */
function spendsUnderGuardrails(plan: Plan): boolean {
  const mode = plan.expenses.spendingPolicy?.mode
  return mode === 'withdrawalRateGuardrails' || mode === 'riskBasedGuardrails'
}

export function SpendingSolverPage() {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const navigate = useNavigate()
  const startYear = currentStartYear()

  // The solve's answer, with the one fact about the plan it was solved on that
  // the copy needs (whether it spends under guardrails): the plan can change
  // before the next solve lands, and the copy describes the solve that ran.
  // The today's-dollar evidence arrives converted by the answer run's own
  // inflation factor, so nothing here depends on the clock (or the plan) at
  // render.
  const [solved, setSolved] = useState<{ result: SpendingSolveResult; guardrailSpending: boolean } | null>(null)
  const result = solved?.result ?? null
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
    void (async () => {
      try {
        // The engine builds each shape's plan (ABW is solved as fixed-target
        // variants; guardrail policies stay) and the rows' differences from
        // the flat shape, taken between the published answers (R5).
        const solves: { shape: ComparedSpendingShape; solved: SolvedSpendingShape; result: SpendingSolveResult }[] = []
        for (const shape of SPENDING_SHAPE_COMPARISON) {
          const solvedShape = await runSpendingSolve({ plan: planWithSpendingShape(forPlan, shape), startYear })
          solves.push({
            shape,
            solved: {
              shape,
              maxBaseAnnual: solvedShape.maxBaseAnnual,
              maxBaseAnnualRounding: solvedShape.maxBaseAnnualRounding ?? null,
            },
            result: solvedShape,
          })
        }
        // The engine returns the rows in the order it was given them.
        const rows: ShapeRow[] = spendingShapeRows(solves.map((entry) => entry.solved)).map((row, index) => ({
          id: solves[index]!.shape,
          label: SHAPE_LABELS[solves[index]!.shape],
          maxBaseAnnual: row.maxBaseAnnual,
          deltaVsFlatDollars: row.deltaVsFlatDollars,
          acaGrossPremiumYears: solves[index]!.result.acaGrossPremiumYears,
          acaGrossPremiumDirection: solves[index]!.result.acaGrossPremiumDirection,
        }))
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
  // Each row carries its ending estate in today's dollars, converted by the
  // rule's own run.
  const swrRows = useMemo(
    () => compareSwrRules(plan, { startYear, taxCalculator: taxCalculatorFor(plan) }),
    [plan, startYear],
  )

  const run = useCallback(() => {
    const token = ++runToken.current
    const guardrailSpending = spendsUnderGuardrails(plan)
    setRunning(true)
    setError(null)
    runSpendingSolve({ plan, startYear })
      .then((r) => {
        if (token === runToken.current) setSolved({ result: r, guardrailSpending })
      })
      .catch((e: unknown) => {
        if (token === runToken.current) {
          setError(e instanceof Error ? e.message : String(e))
          setSolved(null)
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

  // Under guardrails a lower level can fail where a higher one passed, which
  // is why the engine runs its rounded-down answer once more on such plans;
  // read from the plan the shown answer was solved on.
  const guardrailSpending = solved?.guardrailSpending ?? false
  // The engine publishes one amount (R4): the level that passed rounded down
  // to the nearest $100, or that exact level when the rounded one is not
  // known to pass. The page shows it, applies it, adds it as a scenario and
  // reads the slack the engine measured from it.
  const published = result?.maxBaseAnnual ?? null
  // The level that passed, on which "sustains today's spending" is judged.
  const passed = result === null ? null : (result.feasibleBaseAnnual ?? result.maxBaseAnnual)
  const exactPublished = result?.maxBaseAnnualRounding === 'none'
  // The engine's own sentence saying why the exact amount is published.
  const exactAnswerNote = exactPublished ? (result?.diagnostics.find(isExactAnswerDiagnostic) ?? null) : null

  const applyToSpending = () => {
    if (published === null) return
    const solved = published
    update((d) => {
      d.expenses.baseAnnual = solved
    })
    // Land on Spending so the applied baseline is visible where it's edited.
    void navigate(`/plan/${plan.id}/spending`)
  }

  const addScenario = () => {
    if (published === null) return
    const solved = published
    const baseName = `Spend ${fmtMoney(solved)}/yr (max sustainable)`
    const names = new Set(plan.scenarios.map((s) => s.name))
    let name = baseName
    let suffix = 2
    while (names.has(name)) name = `${baseName} (${suffix++})`
    update((d) => {
      d.scenarios.push({ id: makeScenarioId(), name, patch: { expenses: { baseAnnual: solved } } })
    })
    void navigate(`/plan/${plan.id}/scenarios`)
  }

  // Whether the plan sustains today's baseline is the engine's verdict on its
  // first probe, at the baseline rounded to a whole dollar, not the rounded
  // figure: a baseline of $72,030 solved at exactly $72,030 shows as $72,000,
  // and that baseline still passed. A result from before the engine published
  // the verdict is judged the same way, on the level that passed.
  const sustainsCurrent =
    result !== null &&
    (result.sustainsCurrentBase ?? (passed !== null && passed >= Math.round(result.currentBaseAnnual)))
  // The engine's slack, measured from the published amount the tiles show.
  const slack = result?.spendingSlackDollars ?? null
  // Only the rounding puts the shown figure below a baseline the plan
  // sustains: the headroom is under $100, not negative.
  const headroomUnderHundred = sustainsCurrent && slack !== null && slack < 0
  const acaNote = result ? unpricedCreditSpendingNote(result, result.maxBaseAnnual !== null) : null
  // The failure well prints the engine's reasons verbatim, except the
  // unpriced-credit sentence, which the plain note under it replaces.
  const failureDiagnostics = result ? diagnosticsWithoutUnpricedCreditSentence(result.diagnostics) : []
  // "Fixed costs may exceed what the plan can fund" is true only when a probe
  // at zero base spending ran and ran out of money: not after a required
  // floor failed (the diagnostic names that floor), a bequest miss, a budget
  // that stopped before zero was tried, or a solve that never ran a probe.
  const fixedCostsMayExceedFunding = result !== null && result.maxBaseAnnual === null && result.zeroSpendingDepletes
  const shapeAcaYears = shapeRows?.flatMap((row) => row.acaGrossPremiumYears) ?? []
  const shapesAdaptive = shapeRows?.some((row) => row.acaGrossPremiumDirection === 'uncertain') ?? false
  // The nominal end-of-plan estate in today's dollars, so it reads on the same
  // scale as the today's-dollars spending answer: the engine divided it by the
  // factor the answer's own run grew it with.
  const evidenceEstateToday = result?.evidence?.endingAfterTaxEstateTodayDollars ?? null

  return (
    <section>
      <div className="card">
        <h2>How much can I spend?</h2>
        <p className="card-hint">
          Finds the highest annual base spending (today's dollars) your exact projection ledger can sustain: the plan
          must never run out of investable money through the full horizon, and the ending after-tax estate must stay at
          or above your bequest target. Every probed level re-runs the whole ledger: taxes, ACA and IRMAA cliffs,
          withdrawal order, healthcare, debts, and survivor years all price in. Phases and one-time goals stay as
          entered; only the baseline level moves. <LearnLink {...LEARN.sustainableSpending} />
        </p>
        {abwActive ? (
          <div className="callout callout--info">
            <p className="card-hint">
              This plan uses <strong>amortized spending (ABW)</strong>: annual spending is recomputed from the actual
              portfolio every year, so there is no fixed base-spending level to solve for. The amortization rule{' '}
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
                No bequest target set. The only constraint is not running out. Set one under{' '}
                <Link to={`/plan/${plan.id}/spending`}>Spending</Link> to protect an estate floor.
              </>
            )}
          </p>
        )}
        {running ? <div className="skeleton" style={{ height: '2rem', marginTop: '0.75rem' }} aria-label="Solving" /> : null}
        {error ? <p style={{ color: 'var(--bad)' }}>Solver error: {error}</p> : null}
        {error && !running ? (
          <div className="mt-ms">
            <button type="button" className="btn btn-secondary btn-small" onClick={run}>
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {result && !running ? (
        result.maxBaseAnnual === null ? (
          <div className="callout callout--warn solver-failure" role="alert">
            {/* Failure reads as failure (#448): the warning well, announced, with
                the two places a fix usually lives. */}
            <h2 style={{ marginTop: 0 }}>No sustainable spending level found</h2>
            <p className="muted">
              {failureDiagnostics.length > 0
                ? failureDiagnostics.join(' ')
                : 'Even minimal base spending depletes the portfolio or breaks the bequest target within the plan horizon.'}
              {fixedCostsMayExceedFunding
                ? ' Fixed costs modeled outside baseline spending (healthcare, debt service, property carrying costs, one-time goals) may already exceed what the plan can fund.'
                : null}
            </p>
            {acaNote ? (
              <p className="muted" data-testid="aca-gross-premium-note">
                {acaNote}
              </p>
            ) : null}
            <p className="picker-actions">
              <Link to={`/plan/${plan.id}/spending`} className="btn btn-secondary btn-small">
                Review Spending
              </Link>
              <Link to={`/plan/${plan.id}/assumptions`} className="btn btn-secondary btn-small">
                Review Assumptions
              </Link>
            </p>
          </div>
        ) : (
          <>
            <div className="mc-hero">
              <div>
                <h2 style={{ margin: '0 0 0.35rem', color: sustainsCurrent ? 'var(--good)' : 'var(--bad)' }}>
                  Your plan can sustain about {fmtMoney(published ?? 0)} of baseline spending per year.
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {headroomUnderHundred
                    ? `That covers your current ${fmtMoney(result.currentBaseAnnual)} baseline with less than $100 a year to spare (today's dollars).${exactPublished ? '' : ' The figure above is rounded down to the nearest $100.'}`
                    : sustainsCurrent
                      ? `That is ${fmtMoney(slack ?? 0)} per year of headroom above your current ${fmtMoney(result.currentBaseAnnual)} baseline (today's dollars).`
                      : `That is ${fmtMoney(Math.abs(slack ?? 0))} per year BELOW your current ${fmtMoney(result.currentBaseAnnual)} baseline. ${
                          result.limitingConstraint === 'estate-floor'
                            ? "Your projection cannot sustain today's spending and still leave your bequest target."
                            : "Your projection cannot sustain today's spending through the horizon."
                        }`}
                  {!result.converged
                    ? ' The simulation budget ran out before the answer fully converged, so this is a feasible lower bound.'
                    : ''}
                </p>
                {exactAnswerNote ? (
                  <p className="field-hint mt-sm" style={{ marginBottom: 0 }} data-testid="exact-answer-note">
                    {exactAnswerNote}
                  </p>
                ) : null}
                {acaNote ? (
                  <p className="field-hint mt-sm" style={{ marginBottom: 0 }} data-testid="aca-gross-premium-note">
                    {acaNote}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="stat-grid">
              <Stat
                label="Max sustainable spending"
                value={`${fmtMoney(published ?? 0)}/yr`}
                tone="neutral"
                help="Highest annual baseline spending (today's dollars) whose full year-by-year projection never depletes investable assets and keeps the ending after-tax estate at or above your bequest target. Solved by bisection to ~$500 resolution, then rounded down to the nearest $100, the figure Apply and scenarios use too. Under guardrail spending that rounded figure is used only if a run at it passes; otherwise this is the exact amount that passed."
              />
              <Stat
                label="Spending slack"
                value={
                  headroomUnderHundred ? 'Under $100/yr' : `${slack !== null && slack >= 0 ? '+' : ''}${fmtMoney(slack ?? 0)}/yr`
                }
                tone={
                  headroomUnderHundred ? 'neutral' : slack !== null && slack > 0 ? 'good' : slack !== null && slack < 0 ? 'bad' : 'neutral'
                }
                help="Max sustainable spending minus your current baseline. Positive = headroom you are not using; negative = the current baseline overspends what your plan can sustain."
              />
              <Stat
                label="What limits it"
                value={
                  result.limitingConstraint === 'estate-floor'
                    ? 'Bequest target'
                    : result.limitingConstraint === 'depletion'
                      ? 'Depletion at higher spending'
                      : 'No limit found'
                }
                tone="neutral"
                small
                help="What failed at the next-higher spending level the solver probed, not at the answer above, which passed. 'Depletion' means spending any more than the answer would run the portfolio out of money before the end of the plan; 'Bequest target' means the ending estate would fall below your floor. 'No limit found' means spending appeared unbounded at every probed level (guaranteed income outruns spending)."
              />
            </div>

            {result.evidence ? (
              <div className="card">
                <h2>Evidence at that level</h2>
                <p className="card-hint">
                  From the full projection run at the solver&apos;s exact answer
                  {passed !== published ? ` (shown as ${fmtMoney(published ?? 0)}/yr, rounded down to the nearest $100)` : ''},
                  the same year-by-year numbers Results shows, not an approximation.
                </p>
                <ul style={{ margin: '0.25rem 0 0.75rem 1.1rem', lineHeight: 1.7 }}>
                  <li>
                    Money lasts through <strong>{result.evidence.endYear}</strong> (end of plan
                    {result.evidence.depletionYear === null ? ', never depleting' : ''}).
                  </li>
                  <li>
                    Ending after-tax estate:{' '}
                    {evidenceEstateToday !== null ? (
                      <>
                        <strong>{fmtMoney(evidenceEstateToday)}</strong> today's dollars (
                        {fmtMoney(result.evidence.endingAfterTaxEstate)} nominal)
                      </>
                    ) : (
                      <>
                        <strong>{fmtMoney(result.evidence.endingAfterTaxEstate)}</strong> nominal
                      </>
                    )}
                    {result.estateFloorTodayDollars > 0 ? ` vs. the ${fmtMoney(result.estateFloorTodayDollars)} floor` : ''}.
                  </li>
                  <li>
                    Lifetime taxes and penalties at that spending level:{' '}
                    <strong>{fmtMoney(result.evidence.lifetimeTaxesAndPenalties)}</strong> (nominal, summed).
                  </li>
                </ul>
                <p className="field-hint">
                  Solved in {result.simulationCount} full-plan simulations
                  {result.converged ? ', converged to ~$500 resolution.' : '. Budget exhausted, feasible lower bound.'}
                </p>
                <div className="gap-ms" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-small" disabled={readOnly} onClick={applyToSpending}>
                    Apply to Spending
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" disabled={readOnly} onClick={addScenario}>
                    Add as scenario
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={run}>
                    Re-solve
                  </button>
                </div>
                <p className="field-hint mt-sm">
                  "Apply to Spending" sets your plan's baseline spending to {fmtMoney(published ?? 0)}/yr and opens
                  the Spending screen. "Add as scenario" instead creates a side-by-side scenario under Scenarios without
                  changing your plan.
                  {guardrailSpending && !exactPublished && passed !== published
                    ? ' Under guardrail spending a lower level can fail where a higher one passed, so that rounded figure was run too, and it passes.'
                    : null}
                </p>
                <details className="ss-explainer">
                  <summary>Why this number?</summary>
                  <p>
                    The solver bisects on the baseline spending level: each probe re-runs your entire year-by-year
                    projection (taxes, ACA/IRMAA cliffs, withdrawal order, healthcare, debts, survivor years) and
                    checks two constraints: investable assets must never deplete before {result.evidence.endYear}, and
                    the ending after-tax estate must stay at or above{' '}
                    {result.estateFloorTodayDollars > 0
                      ? `your ${fmtMoney(result.estateFloorTodayDollars)} bequest target`
                      : 'zero (no bequest target set)'}
                    . The solver&apos;s exact answer is the highest level that passed both.{' '}
                    {exactPublished
                      ? 'It is shown, applied, and added to scenarios at that exact amount, not rounded down to the nearest $100, for the reason given above'
                      : guardrailSpending
                        ? `It is shown, applied, and added to scenarios rounded down to the nearest $100 (${fmtMoney(published ?? 0)}); under guardrail spending a lower level does not always pass when a higher one does, so that rounded figure was run too, and it passes`
                        : `It is shown, applied, and added to scenarios rounded down to the nearest $100 (${fmtMoney(published ?? 0)}); at fixed-target spending a lower level is expected to pass when a higher one does, and none has been found that fails`}
                    . The next-higher probe failed on{' '}
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
          partly reverses; the preset approximates it as two downward steps) and the <em>median</em> path is a
          &quot;smirk&quot;, a steady ~1%/yr real decline with no late rise at all (Blanchett).
          Shape-aware plans support a higher initial spend from the same portfolio. Solve your plan under each shape
          to see the size of that effect here. Apply a shape on the{' '}
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
            <ScrollRegion label="Spending shape comparison" grow style={{ border: 'none' }}>
              <table className="year-table year-table--plain">
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left' }}>Spending shape</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Max sustainable initial spend</th>
                    <th scope="col" style={{ textAlign: 'right' }}>vs constant-real</th>
                  </tr>
                </thead>
                <tbody>
                  {shapeRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td style={{ textAlign: 'right' }}>
                        {row.maxBaseAnnual !== null ? `${fmtMoney(row.maxBaseAnnual)}/yr` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {row.deltaVsFlatDollars === null
                          ? '—'
                          : `${row.deltaVsFlatDollars >= 0 ? '+' : ''}${fmtMoney(row.deltaVsFlatDollars)}/yr`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollRegion>
            <p className="field-hint mt-sm">
              Each row re-solves your full plan with that shape&apos;s phase rows (initial spend in today&apos;s
              dollars; later years follow the shape). No shape is &quot;the answer&quot;. They are framings of how
              your own later-life spending might behave.
              {shapeAcaYears.length > 0
                ? ` In these solves the premium tax credit isn't counted in ${formatYearRuns(shapeAcaYears)}, so they pay the full Marketplace premium then; ${
                    shapesAdaptive
                      ? 'a credit in those years could move these amounts up or down, because your spending guardrails respond to what healthcare costs.'
                      : 'if you receive a credit in those years, you would likely be able to spend somewhat more than these amounts.'
                  }`
                : null}
            </p>
          </>
        ) : null}
      </div>

      <div className="card">
        <h2>Whose 4% rule? Published rules vs this plan</h2>
        <p className="card-hint">
          The community argues about the &quot;right&quot; safe withdrawal rate: Bengen&apos;s 2025 book says 4.7%,
          Morningstar&apos;s latest study says 3.9%, Early Retirement Now conditions it on market valuations. Here is
          each published rule priced on <em>your</em> plan through the same year-by-year ledger, next to your
          plan&apos;s own solved answer above. The rules assume constant-real spending of a fixed fraction of the
          starting portfolio; your solver answer prices your actual phases, taxes, and horizon, which is why they
          differ.
        </p>
        <ScrollRegion label="Published withdrawal rules on this plan" grow style={{ border: 'none' }}>
          <table className="year-table year-table--plain">
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>Rule</th>
                <th scope="col" style={{ textAlign: 'right' }}>Rate</th>
                <th scope="col" style={{ textAlign: 'right' }}>Spending/yr</th>
                {/* Each row is the plan spending only this rule's dollars, so the
                    header says so: it is not the plan's own path, which the KPI
                    bar's "Money lasts" already reports (#510). */}
                <th scope="col" className="year-table-text">If your plan spent only this</th>
                <th scope="col" style={{ textAlign: 'right' }}>Ending estate (today&apos;s $)</th>
              </tr>
            </thead>
            <tbody>
              {swrRows.map((row) => {
                const estateToday = row.depletionYear === null ? row.endingAfterTaxEstateTodayDollars : null
                return (
                  <tr key={row.id}>
                    <td>
                      {row.label} <HelpTip text={row.citation} />
                    </td>
                    <td style={{ textAlign: 'right' }}>{row.initialRatePct.toFixed(2)}%</td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(row.initialAnnualSpend)}</td>
                    <td className="year-table-text">
                      {row.depletionYear === null ? (
                        <span style={{ color: 'var(--good)' }}>lasts through {row.endYear}</span>
                      ) : (
                        <span style={{ color: 'var(--bad)' }}>runs out in {row.depletionYear}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {estateToday !== null ? fmtMoney(estateToday) : '—'}
                    </td>
                  </tr>
                )
              })}
              {published !== null && result?.initialWithdrawalRatePct != null ? (
                <tr>
                  <td>
                    <strong>This plan&apos;s solver</strong>{' '}
                    <HelpTip text="The full-projection answer from the top of this page, expressed as an initial rate on the same starting investable balance so it can sit in the same table. Unlike the published rules it prices your actual phases, taxes, healthcare, and horizon." />
                  </td>
                  <td style={{ textAlign: 'right' }}>{result.initialWithdrawalRatePct.toFixed(2)}%</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoney(published)}</td>
                  <td className="year-table-text">solved on your exact plan</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </ScrollRegion>
        <p className="field-hint mt-sm">
          Each rule runs with your accounts, taxes, healthcare, goals, and horizon unchanged, only recurring
          lifestyle spending is set to the rule&apos;s level (constant-real, as the rules define it). A rule
          &quot;running out&quot; on your plan usually means your horizon is longer than the 30 years the rule was
          derived for, or your fixed costs differ from a generic retiree&apos;s, evidence for why a plan-specific
          answer beats a debate about whose rule is right.
        </p>
      </div>

      <LearnAboutScreen route="/plan/:planId/spending-solver" />
    </section>
  )
}
