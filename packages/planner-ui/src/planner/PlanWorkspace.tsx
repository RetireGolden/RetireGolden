/**
 * Workspace shell: left rail (entry sections + results surfaces), editable
 * plan name, autosave indicator, and a sticky KPI bar that re-simulates the
 * deterministic projection live as the plan changes.
 */

import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'

import { duplicatePlanVia, usePlanStore } from '../data/planStoreContext'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { DEFAULT_PATH_COUNT } from '../mc/pool'
import { useDialogs } from './dialogs'
import { isPlanIncomplete } from './planCompleteness'
import { ExamplePreviewBanner } from './examples/ExamplePreviewBanner'
import { EXAMPLE_SAVE_INDICATOR } from './examples/exampleCopy'
import { usePlannerEdition } from './editionContext'
import { PlanProvider } from './PlanContext'
import { usePlan } from './planContextCore'
import { PrivacyProvider } from './privacyContext'
import { usePrivacy } from './privacyContextCore'
import { fmtMoneyCompact } from './format'
import { successBand } from './successBand'
import { useMcSuccessRate } from './useMcSuccessRate'
import { useProjection } from './useProjection'

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
  'household-map': 'Household map',
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
  const readOnly = useWorkspaceReadOnly()
  const { homeLabel, storageTooltip } = usePlannerEdition()
  const isExample = plan.origin === 'example'
  // Read-only wins over any save state: nothing is being stored, so the
  // "Stored on this device" / "Storing…" copy would be misleading. Keep the
  // label generic — planner-ui doesn't know the reason (the host explains it).
  if (readOnly) {
    return (
      <span className="save-state" role="status" aria-live="polite" title="This plan is read-only right now.">
        Read-only
      </span>
    )
  }
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
    ? `This example is saved on this device under its own slot — your edits stick across reloads, but it stays out of ${homeLabel} until you use 'Save to my plans'. 'Load a fresh copy' resets it.`
    : storageTooltip
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

function KpiBar() {
  const { plan } = usePlan()
  const { result, summary, deflate } = useProjection(plan)
  const mcRate = useMcSuccessRate(plan, !isPlanIncomplete(plan))
  // While a page has Hide amounts active (the Household map's screen-share
  // toggle), the KPI bar masks every dollar it would otherwise show — the
  // chrome must not leak what the page below is hiding. The literal "$" unit
  // captions go too, so a masked workspace contains no dollar text at all.
  const { hideAmounts } = usePrivacy()
  const money = (v: number) => (hideAmounts ? '•••' : fmtMoneyCompact(v))
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
        <span className="kpi-value">{money(result.endingNetWorth)}</span>
        <span className="kpi-sub">{hideAmounts ? 'amounts hidden' : <>{fmtMoneyCompact(endingToday)} today's $ · {endYear}</>}</span>
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
            title={`Share of ${DEFAULT_PATH_COUNT.toLocaleString()} varied-market simulations where the money lasts — open Monte Carlo for the full picture`}
          >
            {Math.round(mcRate * 100)}%
          </Link>
        ) : (
          <span className="kpi-value kpi-value--pending" aria-label="Simulating markets">
            …
          </span>
        )}
        <span className="kpi-sub">of {DEFAULT_PATH_COUNT.toLocaleString()} varied markets</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Lifetime tax</span>
        <span className="kpi-value">{money(summary.lifetimeTaxesAndPenalties)}</span>
        <span className="kpi-sub">{hideAmounts ? 'amounts hidden' : 'nominal $ · federal + state + penalties'}</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Roth converted</span>
        <span className="kpi-value">{money(summary.lifetimeRothConversions)}</span>
        <span className="kpi-sub">{hideAmounts ? 'amounts hidden' : <>ending Roth {fmtMoneyCompact(summary.endingByCategory.roth)}</>}</span>
      </div>
    </div>
  )
}

function PlanName() {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  return (
    <input
      className="plan-name-input"
      value={plan.name}
      aria-label="Plan name"
      disabled={readOnly}
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
  const store = usePlanStore()
  const readOnly = useWorkspaceReadOnly()
  const { homeLabel } = usePlannerEdition()
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
    const r = await duplicatePlanVia(store, plan.id, { name, source: plan })
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
                <Link to="/">{homeLabel}</Link>
              </li>
              <li aria-current="page">{plan.name}</li>
            </ol>
          </nav>
          <PlanName />
        </div>
        <div className="workspace-head-actions">
          {readOnly ? null : (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void handleDuplicate()}>
              Duplicate plan
            </button>
          )}
          <SaveIndicator />
        </div>
      </div>
      <KpiBar />
      <div className="workspace">
        {/* The global skip link lands on #main-content, which still puts the
            20-link rail between keyboard users and the page content. This
            second link lets them clear the rail in one stop. */}
        <a className="skip-link" href="#plan-content">
          Skip section navigation
        </a>
        <nav className="workspace-rail" aria-label="Plan sections">
          <NavLink to="/" className="rail-link rail-link--back" end>
            ← {homeLabel}
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
          <NavLink to="household-map" className={railClass}>Household map</NavLink>
          {plan.household.filingStatus === 'marriedFilingJointly' && plan.household.people.length === 2 ? (
            <NavLink to="survivor" className={railClass}>Survivor transition</NavLink>
          ) : null}
          <NavLink to="relocation" className={railClass}>Relocation Compare</NavLink>
          <NavLink to="/compare" className={railClass}>Compare plans</NavLink>
        </nav>
        <div id="plan-content" tabIndex={-1}>
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
      <PrivacyProvider>
        <WorkspaceInner />
      </PrivacyProvider>
    </PlanProvider>
  )
}
