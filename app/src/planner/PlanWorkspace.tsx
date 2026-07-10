/**
 * Workspace shell: left rail (entry sections + results surfaces), editable
 * plan name, autosave indicator, and a sticky KPI bar that re-simulates the
 * deterministic projection live as the plan changes.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import { duplicatePlan } from '../data/planStore'
import type { Plan } from '../engine/model/plan'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import { useDialogs } from './dialogs'
import { isPlanIncomplete } from './planCompleteness'
import { ExamplePreviewBanner } from './examples/ExamplePreviewBanner'
import { EXAMPLE_SAVE_INDICATOR } from './examples/exampleCopy'
import { buildModel } from './marketModelPicker'
import { PlanProvider } from './PlanContext'
import { usePlan } from './planContextCore'
import { fmtMoneyCompact } from './format'
import { successBand } from './successBand'
import { currentStartYear, seedFromPlanId, useProjection } from './useProjection'

const railClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'rail-link rail-link--active' : 'rail-link')

/** Section labels by route segment — drives the tab title and the page h1. */
const SECTION_TITLES: Record<string, string> = {
  household: 'Household',
  'social-security': 'Social Security',
  accounts: 'Accounts',
  insurance: 'Insurance',
  income: 'Income',
  'income-floor': 'Income floor',
  spending: 'Spending',
  strategy: 'Strategy',
  assumptions: 'Assumptions',
  insights: 'Insights',
  optimize: 'Roth & Tax Optimizer',
  'spending-solver': 'How much can I spend?',
  'social-security-analysis': 'Social Security Optimizer',
  results: 'Results',
  'monte-carlo': 'Monte Carlo',
  scenarios: 'Scenarios',
  survivor: 'Survivor transition',
  relocation: 'Relocation Compare',
  report: 'Report',
  'assumptions-card': 'Assumptions card',
}

function sectionTitleOf(pathname: string): string | null {
  // /plan/:planId/<section>[/...] — the segment after the plan id.
  const segments = pathname.split('/').filter(Boolean)
  const section = segments[2]
  return section !== undefined ? (SECTION_TITLES[section] ?? null) : null
}

function SaveIndicator() {
  const { plan, saveState, issues } = usePlan()
  const isExample = plan.origin === 'example'
  const text =
    saveState === 'saved'
      ? isExample
        ? EXAMPLE_SAVE_INDICATOR
        : 'Stored on this device'
      : saveState === 'saving' || saveState === 'dirty'
        ? 'Storing…'
        : saveState === 'invalid'
          ? `Fix ${issues.length} issue${issues.length === 1 ? '' : 's'} to store`
          : saveState === 'error'
            ? 'Could not store locally'
            : ''
  const title = isExample
    ? "This example is saved on this device under its own slot — your edits stick across reloads, but it stays out of Your plans until you use 'Save to my plans'. 'Load a fresh copy' resets it."
    : "Plans live only in this browser — nothing is sent to a server. Use 'Download plan backup' on the planner home to keep a copy."
  return (
    <span
      className={saveState === 'invalid' || saveState === 'error' ? 'save-state save-state--error' : 'save-state'}
      role="status"
      aria-live="polite"
      title={title}
    >
      {text}
    </span>
  )
}

/**
 * Background Monte Carlo for the KPI bar (the app's headline is the
 * distribution, not just the steady-markets ledger). Runs the MC page's exact
 * default configuration — same seed, model, and path count — so the KPI number
 * always matches what the Monte Carlo page shows on arrival. Debounced well
 * past the autosave window; failures stay silent here (the MC page owns the
 * full error/retry surface).
 */
const KPI_MC_DEBOUNCE_MS = 1200

function useKpiSuccessRate(plan: Plan, enabled: boolean): number | null {
  // The rate is stored WITH the plan it was computed for, and derived to null
  // whenever the current plan differs — so a headline KPI can never show a
  // previous plan's number through the debounce + recompute, and a silently
  // failed re-run can never leave a stale rate up (edits produce a new plan
  // object via structuredClone, so reference identity is the right key).
  const [snapshot, setSnapshot] = useState<{ plan: Plan; rate: number } | null>(null)
  const runToken = useRef(0)
  useEffect(() => {
    if (!enabled) return undefined
    const token = ++runToken.current
    const t = window.setTimeout(() => {
      const model = buildModel('lognormal', plan.assumptions.inflationPct, 12, 60, plan)
      runMonteCarlo(plan, {
        startYear: currentStartYear(),
        pathCount: DEFAULT_PATH_COUNT,
        seed: seedFromPlanId(plan.id),
        model,
      })
        .then((s) => {
          if (token === runToken.current) setSnapshot({ plan, rate: s.successRate })
        })
        .catch(() => {
          /* silent — the Monte Carlo page carries the error state and retry */
        })
    }, KPI_MC_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [plan, enabled])
  return enabled && snapshot !== null && snapshot.plan === plan ? snapshot.rate : null
}

function KpiBar() {
  const { plan } = usePlan()
  const { result, summary, deflate } = useProjection(plan)
  const mcRate = useKpiSuccessRate(plan, !isPlanIncomplete(plan))
  const endYear = result.endYear
  const depleted = summary.depletionYear !== null
  const endingToday = deflate(endYear, result.endingNetWorth)

  if (isPlanIncomplete(plan)) {
    return (
      <div className="kpi-bar kpi-bar--incomplete" aria-label="Plan headline results">
        <div className="kpi">
          <span className="kpi-label">Plan status</span>
          <span className="kpi-value kpi-value--pending">Getting started</span>
          <span className="kpi-sub kpi-sub--wrap">
            Add income sources or account balances to complete the picture — results appear as you enter them.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="kpi-bar" aria-label="Plan headline results">
      <div className="kpi">
        <span className="kpi-label">Ending net worth</span>
        <span className="kpi-value">{fmtMoneyCompact(result.endingNetWorth)}</span>
        <span className="kpi-sub">{fmtMoneyCompact(endingToday)} today's $ · {endYear}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Money lasts</span>
        {depleted ? (
          <Link
            className="kpi-value kpi-value--bad kpi-value-link"
            to="insights"
            title="See what would change this in Insights"
          >
            until {summary.depletionYear}
          </Link>
        ) : (
          <span className="kpi-value kpi-value--good">full plan</span>
        )}
        <span className="kpi-sub">{depleted ? 'steady markets · depletes' : `steady markets · ${endYear}`}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Market success</span>
        {mcRate !== null ? (
          <Link
            className="kpi-value kpi-value-link"
            style={{ color: successBand(mcRate).color }}
            to="monte-carlo"
            title="Share of 1,000 varied-market simulations where the money lasts — open Monte Carlo for the full picture"
          >
            {Math.round(mcRate * 100)}%
          </Link>
        ) : (
          <span className="kpi-value kpi-value--pending" aria-label="Simulating markets">
            …
          </span>
        )}
        <span className="kpi-sub">of 1,000 varied markets</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Lifetime tax</span>
        <span className="kpi-value">{fmtMoneyCompact(summary.lifetimeTaxesAndPenalties)}</span>
        <span className="kpi-sub">federal + state + penalties</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Roth converted</span>
        <span className="kpi-value">{fmtMoneyCompact(summary.lifetimeRothConversions)}</span>
        <span className="kpi-sub">ending Roth {fmtMoneyCompact(summary.endingByCategory.roth)}</span>
      </div>
    </div>
  )
}

function PlanName() {
  const { plan, update } = usePlan()
  return (
    <input
      className="plan-name-input"
      value={plan.name}
      aria-label="Plan name"
      onChange={(e) =>
        update((d) => {
          d.name = e.target.value || 'My plan'
        })
      }
    />
  )
}

function WorkspaceInner() {
  const { plan, discardPendingSave } = usePlan()
  const navigate = useNavigate()
  const location = useLocation()
  const { prompt, alert, dialogs } = useDialogs()

  // Page identity: retitle the tab per section so history and multi-tab
  // comparison work, and give every plan page exactly one h1 (sr-only — the
  // visual header is the plan name + KPI bar).
  const sectionTitle = sectionTitleOf(location.pathname)
  useEffect(() => {
    document.title = sectionTitle ? `${sectionTitle} · ${plan.name} · RetireGolden` : `${plan.name} · RetireGolden`
  }, [sectionTitle, plan.name])
  // Reset only when leaving the workspace entirely — a per-change cleanup
  // would churn the title through 'RetireGolden' between sections.
  useEffect(
    () => () => {
      document.title = 'RetireGolden'
    },
    [],
  )
  const handleDuplicate = async () => {
    const name = await prompt({
      title: 'Duplicate plan',
      label: 'Name for the duplicated plan',
      defaultValue: `Copy of ${plan.name}`,
      confirmLabel: 'Duplicate',
    })
    if (name === null) return
    if (plan.origin === 'example') discardPendingSave()
    const r = await duplicatePlan(plan.id, { name, source: plan })
    if (r.ok) navigate(`/plan/${r.plan.id}/results`)
    else await alert({ title: 'Duplicate plan', body: `Could not duplicate this plan: ${r.issues.join('; ')}` })
  }

  return (
    <div className="planner-shell">
      <ExamplePreviewBanner />
      <div className="workspace-head">
        <div className="workspace-head-main">
          <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Your plans</Link>
              </li>
              <li aria-current="page">{plan.name}</li>
            </ol>
          </nav>
          <PlanName />
        </div>
        <div className="workspace-head-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => void handleDuplicate()}>
            Duplicate plan
          </button>
          <SaveIndicator />
        </div>
      </div>
      <KpiBar />
      <div className="workspace">
        <nav className="workspace-rail" aria-label="Plan sections">
          <NavLink to="/" className="rail-link rail-link--back" end>
            ← Your plans
          </NavLink>
          <span className="rail-group">Enter</span>
          <NavLink to="household" className={railClass}>Household</NavLink>
          <NavLink to="social-security" className={railClass}>Social Security</NavLink>
          <NavLink to="accounts" className={railClass}>Accounts</NavLink>
          <NavLink to="insurance" className={railClass}>Insurance</NavLink>
          <NavLink to="income" className={railClass}>Income</NavLink>
          <NavLink to="income-floor" className={railClass}>Income floor</NavLink>
          <NavLink to="spending" className={railClass}>Spending</NavLink>
          <NavLink to="strategy" className={railClass}>Strategy</NavLink>
          <NavLink to="assumptions" className={railClass}>Assumptions</NavLink>
          <span className="rail-group">Optimize</span>
          <NavLink to="insights" className={railClass}>Insights</NavLink>
          <NavLink to="optimize" className={railClass}>Roth & Tax Optimizer</NavLink>
          <NavLink to="spending-solver" className={railClass}>How much can I spend?</NavLink>
          <NavLink to="social-security-analysis" className={railClass}>Social Security Optimizer</NavLink>
          <span className="rail-group">Explore</span>
          <NavLink to="results" className={railClass}>Results</NavLink>
          <NavLink to="monte-carlo" className={railClass}>Monte Carlo</NavLink>
          <NavLink to="scenarios" className={railClass}>Scenarios</NavLink>
          {plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2 ? (
            <NavLink to="survivor" className={railClass}>Survivor transition</NavLink>
          ) : null}
          <NavLink to="relocation" className={railClass}>Relocation Compare</NavLink>
          <NavLink to="/compare" className={railClass}>Compare plans</NavLink>
        </nav>
        <div>
          <h1 className="sr-only">{sectionTitle ? `${sectionTitle} — ${plan.name}` : plan.name}</h1>
          <Outlet />
        </div>
      </div>
      {dialogs}
    </div>
  )
}

export function PlanWorkspace() {
  const { planId } = useParams()
  if (!planId) return null
  return (
    <PlanProvider planId={planId}>
      <WorkspaceInner />
    </PlanProvider>
  )
}
