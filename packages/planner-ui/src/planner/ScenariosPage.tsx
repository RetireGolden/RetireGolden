/**
 * Scenarios: curated what-if overrides on top of the base plan, compared
 * side by side (deterministic metrics + Monte Carlo success on a shared
 * seed, so every scenario faces the same markets).
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import {
  compareScenarioPlans,
  compareScenarioSpendingCapacityResults,
  type NullableScalarComparison,
  type ScalarComparison,
  type ScenarioPlanComparison,
} from '@retiregolden/engine/scenarios/comparison'
import { scenarioPlanSnapshotHash } from '@retiregolden/engine/scenarios/patch'
import {
  applyScenarioPatch,
  compareScenarios,
  type ScenarioComparison,
} from '@retiregolden/engine/scenarios/scenarios'
import { usePlan } from './planContextCore'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import { EditableFieldset } from './EditableFieldset'
import { MoneyField, NumberField, PercentField, SelectField } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { runSpendingSolve } from '../optimize/spendingRunner'
import { fmtMoneyCompact } from './format'
import { LiveStatus } from './LiveStatus'
import {
  buildScenarioLever,
  SCENARIO_LEVER_DEFINITIONS,
  supportedRothBracketTargets,
  type ScenarioLeverBuildResult,
  type ScenarioLeverId,
  type ScenarioLeverRequest,
} from '../scenarioLevers'
import {
  formatMetricValue,
  formatScenarioDelta,
  isScenarioComparisonCurrent,
  scenarioOverviewRequestKey,
  spendingCapacityStatus,
  type MetricFormat,
} from './scenarioComparisonView'
import { currentStartYear, seedFromPlanId, taxCalculatorFor } from './useProjection'
import { US_STATES } from './usStates'

const newId = () => crypto.randomUUID()
const LEVER_PREVIEW_DEBOUNCE_MS = 50

interface LeverParams {
  retireAgeDelta: number
  spendPct: number
  ssClaimAge: number
  ssCutPct: number
  rothTargetValue: number
  rothAnnual: number
  startYear: number
  endYear: number
  stockPct: number
  returnPct: number
  incomeChangePct: number
  incomeStartAgeDelta: number
  destinationState: string
  moveYear: number
  moveMonth: number
  survivorSpendingPct: number
  carePersonId: string
  careYears: number
  careAnnual: number
  careStartAge: number
  homePropertyId: string
  homeSaleYear: number
}

function defaultLeverParams(startYear: number): LeverParams {
  return {
    retireAgeDelta: -2,
    spendPct: 15,
    ssClaimAge: 70,
    ssCutPct: TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct,
    rothTargetValue: 24,
    rothAnnual: 40_000,
    startYear,
    endYear: startYear + 4,
    stockPct: 60,
    returnPct: 4,
    incomeChangePct: 0,
    incomeStartAgeDelta: 2,
    destinationState: 'FL',
    moveYear: startYear + 1,
    moveMonth: 7,
    survivorSpendingPct: 70,
    carePersonId: '',
    careYears: 3,
    careAnnual: 110_000,
    careStartAge: 84,
    homePropertyId: '',
    homeSaleYear: startYear + 5,
  }
}

function rebaseYearRelativeParams(
  current: LeverParams,
  previousStartYear: number,
  nextStartYear: number,
): LeverParams {
  if (previousStartYear === nextStartYear) return current
  const previousDefaults = defaultLeverParams(previousStartYear)
  const nextDefaults = defaultLeverParams(nextStartYear)
  const startWasDefault = current.startYear === previousDefaults.startYear
  const endWasDefault = current.endYear === previousDefaults.endYear
  const nextRothStart = startWasDefault
    ? nextDefaults.startYear
    : Math.max(nextStartYear, current.startYear)
  const nextRothEnd = endWasDefault
    ? nextDefaults.endYear
    : current.startYear < nextStartYear
      ? Math.max(nextRothStart, nextRothStart + Math.max(0, current.endYear - current.startYear))
      : Math.max(nextRothStart, current.endYear)
  return {
    ...current,
    startYear: nextRothStart,
    endYear: nextRothEnd,
    moveYear:
      current.moveYear === previousDefaults.moveYear
        ? nextDefaults.moveYear
        : Math.max(nextStartYear, current.moveYear),
    homeSaleYear:
      current.homeSaleYear === previousDefaults.homeSaleYear
        ? nextDefaults.homeSaleYear
        : Math.max(nextStartYear, current.homeSaleYear),
  }
}

function eligibleHomeSaleProperties(accounts: Plan['accounts'], startYear: number) {
  return accounts.filter(
    (account) =>
      account.type === 'property' &&
      (account.plannedSaleYear === null || account.plannedSaleYear >= startYear),
  )
}

function leverRequest(
  kind: ScenarioLeverId,
  p: LeverParams,
  plan: Plan,
  startYear: number,
): ScenarioLeverRequest {
  switch (kind) {
    case 'retirementAge': return { id: kind, yearsDelta: p.retireAgeDelta }
    case 'spending': return { id: kind, percentChange: p.spendPct }
    case 'socialSecurityClaim': return { id: kind, claimAge: p.ssClaimAge }
    case 'socialSecurityCut':
      return { id: kind, cutPct: p.ssCutPct, fromYear: TRUSTEES_DEFAULT_SS_HAIRCUT.fromYear }
    case 'rothTarget':
      return { id: kind, target: 'topOfBracket', targetValue: p.rothTargetValue, startYear: p.startYear, endYear: p.endYear }
    case 'rothSchedule':
      return { id: kind, annualAmount: p.rothAnnual, startYear: p.startYear, endYear: p.endYear }
    case 'rothNone': return { id: kind }
    case 'allocation': return { id: kind, stockPct: p.stockPct }
    case 'defaultReturn': return { id: kind, returnPct: p.returnPct }
    case 'pension':
    case 'annuity':
      return { id: kind, monthlyChangePct: p.incomeChangePct, startAgeDelta: p.incomeStartAgeDelta }
    case 'relocation':
      return {
        id: kind,
        state: p.destinationState,
        moveYear: p.moveYear,
        moveMonth: p.moveMonth,
      }
    case 'survivorSpending': return { id: kind, percent: p.survivorSpendingPct }
    case 'care':
      return {
        id: kind,
        personId:
          plan.household.people.length > 1 &&
          plan.household.people.some((person) => person.id === p.carePersonId)
            ? p.carePersonId
            : undefined,
        startAge: p.careStartAge,
        durationYears: p.careYears,
        annualCost: p.careAnnual,
      }
    case 'homeSale': {
      const properties = eligibleHomeSaleProperties(plan.accounts, startYear)
      return {
        id: kind,
        saleYear: p.homeSaleYear,
        propertyId:
          properties.length > 1 &&
          properties.some((property) => property.id === p.homePropertyId)
            ? p.homePropertyId
            : undefined,
      }
    }
    case 'stopContributions': return { id: kind }
  }
}

function AddScenario() {
  const { plan, update } = usePlan()
  const startYear = currentStartYear()
  const [kind, setKind] = useState<ScenarioLeverId>('retirementAge')
  const [params, setParams] = useState<LeverParams>(() => defaultLeverParams(startYear))
  const [saveError, setSaveError] = useState<string | null>(null)
  const previousPlanId = useRef(plan.id)
  const previousStartYear = useRef(startYear)
  const householdPersonIds = useMemo(
    () => new Set(plan.household.people.map((person) => person.id)),
    [plan.household.people],
  )
  const homeSaleProperties = useMemo(
    () => eligibleHomeSaleProperties(plan.accounts, startYear),
    [plan.accounts, startYear],
  )
  const homeSalePropertyIds = useMemo(
    () => new Set(homeSaleProperties.map((property) => property.id)),
    [homeSaleProperties],
  )
  useEffect(() => {
    const planChanged = previousPlanId.current !== plan.id
    const priorStartYear = previousStartYear.current
    previousPlanId.current = plan.id
    previousStartYear.current = startYear
    setParams((current) => {
      const yearSafe = rebaseYearRelativeParams(current, priorStartYear, startYear)
      const recipientStillValid =
        plan.household.people.length > 1 &&
        householdPersonIds.has(yearSafe.carePersonId)
      const propertyStillValid =
        homeSaleProperties.length > 1 &&
        homeSalePropertyIds.has(yearSafe.homePropertyId)
      const clearCareRecipient =
        yearSafe.carePersonId !== '' && (planChanged || !recipientStillValid)
      const clearHomeProperty =
        yearSafe.homePropertyId !== '' && (planChanged || !propertyStillValid)
      if (
        yearSafe === current &&
        !clearCareRecipient &&
        !clearHomeProperty
      ) {
        return current
      }
      return {
        ...yearSafe,
        carePersonId: clearCareRecipient ? '' : yearSafe.carePersonId,
        homePropertyId: clearHomeProperty ? '' : yearSafe.homePropertyId,
      }
    })
  }, [
    homeSaleProperties.length,
    homeSalePropertyIds,
    householdPersonIds,
    plan.household.people.length,
    plan.id,
    startYear,
  ])
  const set = <K extends keyof LeverParams>(key: K, value: LeverParams[K]) =>
    setParams((current) => ({ ...current, [key]: value }))
  const previewRequest = useMemo(
    () => leverRequest(kind, params, plan, startYear),
    [kind, params, plan, startYear],
  )
  const previewVersion = useRef(0)
  const [previewState, setPreviewState] = useState<{
    plan: Plan
    request: ScenarioLeverRequest
    startYear: number
    result: ScenarioLeverBuildResult
  } | null>(null)
  useEffect(() => {
    const version = ++previewVersion.current
    const timer = window.setTimeout(() => {
      const result = buildScenarioLever(plan, previewRequest, {
        createdAtIso: '2000-01-01T00:00:00.000Z',
        startYear,
        createId: () => 'preview-care-event',
        taxCalculatorForPlan: taxCalculatorFor,
      })
      if (previewVersion.current !== version) return
      setPreviewState({ plan, request: previewRequest, startYear, result })
    }, LEVER_PREVIEW_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [plan, previewRequest, startYear])
  const preview =
    previewState?.plan === plan &&
    previewState.request === previewRequest &&
    previewState.startYear === startYear
      ? previewState.result
      : null
  // The whole "Add a scenario" card is a plan-mutating form — disable it as a
  // unit when read-only, like the entry sections.
  return (
    <EditableFieldset>
    <div className="card" aria-busy={preview === null}>
      <h2>Add a scenario</h2>
      <p className="card-hint">Use a fast lever to create a reversible proposal. The exact modeled fields are shown before you add it.</p>
      <div className="form-grid">
        <SelectField
          label="What if…"
          value={kind}
          options={SCENARIO_LEVER_DEFINITIONS.map((definition) => ({ value: definition.id, label: definition.label }))}
          onCommit={(v) => setKind(v)}
        />
        {kind === 'retirementAge' ? (
          <NumberField label="All retirement ages: years earlier (−) / later (+)" value={params.retireAgeDelta} min={-15} max={15} onCommit={(v) => set('retireAgeDelta', Math.round(v ?? -2))} />
        ) : null}
        {kind === 'spending' ? <PercentField label="Base spending change" value={params.spendPct} min={-50} max={100} onCommit={(v) => set('spendPct', v ?? 15)} /> : null}
        {kind === 'socialSecurityClaim' ? <NumberField label="Claim age for all eligible streams" value={params.ssClaimAge} min={62} max={70} onCommit={(v) => set('ssClaimAge', Math.round(v ?? 70))} /> : null}
        {kind === 'socialSecurityCut' ? <PercentField label="Benefit cut" value={params.ssCutPct} min={0} max={100} onCommit={(v) => set('ssCutPct', v ?? TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct)} /> : null}
        {kind === 'rothTarget' || kind === 'rothSchedule' ? (
          <>
            <NumberField label="Start year" value={params.startYear} min={startYear} max={2200} onCommit={(v) => set('startYear', Math.round(v ?? startYear))} />
            <NumberField label="End year" value={params.endYear} min={startYear} max={2200} onCommit={(v) => set('endYear', Math.round(v ?? startYear))} />
          </>
        ) : null}
        {kind === 'rothTarget' ? (
          <SelectField
            label="Top of federal tax bracket"
            value={String(params.rothTargetValue)}
            options={supportedRothBracketTargets(plan, params.startYear, params.endYear).map((rate) => ({
              value: String(rate),
              label: `${rate}% bracket`,
            }))}
            onCommit={(value) => set('rothTargetValue', Number(value))}
          />
        ) : null}
        {kind === 'rothSchedule' ? <MoneyField label="Annual conversion" value={params.rothAnnual} onCommit={(v) => set('rothAnnual', v ?? 0)} /> : null}
        {kind === 'allocation' ? <PercentField label="Stocks (remainder in bonds)" value={params.stockPct} min={0} max={100} onCommit={(v) => set('stockPct', v ?? 60)} /> : null}
        {kind === 'defaultReturn' ? <PercentField label="Default annual return" value={params.returnPct} onCommit={(v) => set('returnPct', v ?? 4)} /> : null}
        {kind === 'pension' || kind === 'annuity' ? (
          <>
            <PercentField label="All matching accounts: monthly income change" value={params.incomeChangePct} min={-100} max={200} onCommit={(v) => set('incomeChangePct', v ?? 0)} />
            <NumberField label="All matching accounts: start age change" value={params.incomeStartAgeDelta} min={-20} max={20} onCommit={(v) => set('incomeStartAgeDelta', Math.round(v ?? 0))} />
          </>
        ) : null}
        {kind === 'relocation' ? (
          <>
            <SelectField label="Destination state" value={params.destinationState} options={US_STATES} onCommit={(v) => set('destinationState', v)} />
            <NumberField label="Move year" value={params.moveYear} min={startYear} max={2200} onCommit={(v) => set('moveYear', Math.round(v ?? startYear))} />
            <NumberField label="Move month (1-12)" value={params.moveMonth} min={1} max={12} onCommit={(v) => set('moveMonth', Math.round(v ?? 7))} />
          </>
        ) : null}
        {kind === 'survivorSpending' ? <PercentField label="Couple spending kept in survivor years" value={params.survivorSpendingPct} min={0} max={100} onCommit={(v) => set('survivorSpendingPct', v ?? 70)} /> : null}
        {kind === 'care' ? (
          <>
            {plan.household.people.length > 1 ? (
              <SelectField
                label="Care recipient"
                value={params.carePersonId}
                options={[
                  { value: '', label: 'Choose a household member' },
                  ...plan.household.people.map((person) => ({ value: person.id, label: person.name })),
                ]}
                onCommit={(value) => set('carePersonId', value)}
              />
            ) : null}
            <NumberField label="Years of care" value={params.careYears} min={1} max={25} onCommit={(v) => set('careYears', Math.round(v ?? 3))} />
            <MoneyField label="Annual cost (today's $)" value={params.careAnnual} onCommit={(v) => set('careAnnual', v ?? 110_000)} />
            <NumberField label="Starting age" value={params.careStartAge} min={40} max={110} onCommit={(v) => set('careStartAge', Math.round(v ?? 84))} />
          </>
        ) : null}
        {kind === 'homeSale' ? (
          <>
            {homeSaleProperties.length > 1 ? (
              <SelectField
                label="Property to sell"
                value={params.homePropertyId}
                options={[
                  { value: '', label: 'Choose a property' },
                  ...homeSaleProperties.map((property) => ({
                    value: property.id,
                    label: property.name,
                  })),
                ]}
                onCommit={(value) => set('homePropertyId', value)}
              />
            ) : null}
            <NumberField label="Property sale year" value={params.homeSaleYear} min={startYear} max={2200} onCommit={(v) => set('homeSaleYear', Math.round(v ?? startYear))} />
          </>
        ) : null}
      </div>
      {preview === null ? (
        <p className="card-hint" role="status" aria-live="polite">
          Checking this scenario against the projection…
        </p>
      ) : null}
      {preview !== null && preview.warnings.length > 0 ? (
        <div className="callout callout--warn" role="status">
          <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}
      {preview !== null && !preview.ok ? (
        <div className="callout callout--warn" role="status" aria-live="polite">
          <ul>{preview.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      ) : preview?.ok ? (
        <p className="card-hint">
          <strong>Fields this scenario patches:</strong>{' '}
          <code>{preview.operationPaths.join(', ')}</code>
        </p>
      ) : null}
      {saveError ? <p className="card-hint" role="alert">{saveError}</p> : null}
      <div className="add-row">
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={preview === null || !preview.ok}
          onClick={() => {
            setSaveError(null)
            const built = buildScenarioLever(plan, previewRequest, {
              createdAtIso: new Date().toISOString(),
              startYear,
              createId: newId,
              taxCalculatorForPlan: taxCalculatorFor,
            })
            if (!built.ok) {
              setSaveError(built.issues.join(' '))
              return
            }
            update((d) => {
              d.scenarios.push({ id: newId(), name: built.name, patch: built.patch })
            })
          }}
        >
          + Add scenario
        </button>
      </div>
    </div>
    </EditableFieldset>
  )
}

type ComparisonMetric = ScalarComparison | NullableScalarComparison

export function MetricTable({
  caption,
  basis,
  rows,
}: {
  caption: string
  basis: string
  rows: Array<{ label: string; metric: ComparisonMetric; format: MetricFormat }>
}) {
  return (
    <div className="year-table-wrap" style={{ border: 'none' }}>
      <table className="compare-table">
        <caption>
          {caption} <span className="small">({basis})</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Baseline</th>
            <th scope="col">Proposal</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" style={{ textAlign: 'left' }}>
                {row.label}
              </th>
              <td>{formatMetricValue(row.metric.baseline, row.format)}</td>
              <td>{formatMetricValue(row.metric.proposal, row.format)}</td>
              <td>{formatScenarioDelta(row.metric.delta, row.format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ANNUAL_METRICS: Array<{
  label: string
  key: keyof ScenarioPlanComparison['annual'][number]['values']
  format: MetricFormat
}> = [
  { label: 'Gross income', key: 'income', format: 'money' },
  { label: 'Intended spending', key: 'spendingIntended', format: 'money' },
  { label: 'Funded spending', key: 'spendingFunded', format: 'money' },
  { label: 'Tax', key: 'tax', format: 'money' },
  { label: 'Penalties', key: 'penalties', format: 'money' },
  { label: 'Medicare premiums', key: 'medicarePremiums', format: 'money' },
  { label: 'IRMAA surcharge', key: 'irmaaSurcharge', format: 'money' },
  { label: 'IRMAA tier', key: 'irmaaTier', format: 'number' },
  { label: 'MAGI', key: 'magi', format: 'money' },
  { label: 'Total shortfall', key: 'shortfall', format: 'money' },
  { label: 'Required shortfall', key: 'requiredShortfall', format: 'money' },
  { label: 'Target shortfall', key: 'targetShortfall', format: 'money' },
  { label: 'Investable assets', key: 'investable', format: 'money' },
  { label: 'Net worth', key: 'netWorth', format: 'money' },
  { label: 'Total withdrawals', key: 'withdrawals', format: 'money' },
  { label: 'Traditional withdrawals', key: 'traditionalWithdrawals', format: 'money' },
  { label: 'Roth withdrawals', key: 'rothWithdrawals', format: 'money' },
  { label: 'Roth conversion', key: 'rothConversion', format: 'money' },
  { label: 'RMD', key: 'rmd', format: 'money' },
  { label: 'QCD', key: 'qcd', format: 'money' },
]

function AnnualLedgerComparison({ comparison }: { comparison: ScenarioPlanComparison }) {
  return (
    <details>
      <summary>Annual ledger comparison ({comparison.annual.length} years)</summary>
      <div className="year-table-wrap">
        <table className="compare-table">
          <caption>Annual ledger (nominal dollars; IRMAA tier is a count)</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Metric</th>
              <th scope="col">Baseline</th>
              <th scope="col">Proposal</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {comparison.annual.flatMap((row) =>
              ANNUAL_METRICS.map(({ label, key, format }, index) => {
                const metric = row.values[key]
                return (
                  <tr key={`${row.year}-${key}`}>
                    {index === 0 ? (
                      <th scope="rowgroup" rowSpan={ANNUAL_METRICS.length}>
                        {row.year}
                      </th>
                    ) : null}
                    <th scope="row" style={{ textAlign: 'left' }}>
                      {label}
                    </th>
                    <td>{formatMetricValue(metric.baseline, format)}</td>
                    <td>{formatMetricValue(metric.proposal, format)}</td>
                    <td>{formatScenarioDelta(metric.delta, format)}</td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function CapacitySection({
  capacity,
  running,
  onCalculate,
}: {
  capacity: ScenarioPlanComparison['spendingCapacity']
  running: boolean
  onCalculate: () => void
}) {
  const diagnostics = capacity
    ? [
        ...capacity.baselineDiagnostics.map((message) => `Baseline: ${message}`),
        ...capacity.proposalDiagnostics.map((message) => `Proposal: ${message}`),
      ]
    : []
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="item-row-head">
        <div>
          <h3 style={{ margin: 0 }}>Sustainable spending capacity</h3>
          <p className="card-hint">Exact-ledger annual base spending in today&apos;s dollars.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-small" disabled={running} onClick={onCalculate}>
          {running ? 'Calculating…' : capacity ? 'Recalculate' : 'Calculate capacity'}
        </button>
      </div>
      {capacity ? (
        <>
          <MetricTable
            caption="Sustainable spending capacity"
            basis="today's dollars; proposal minus baseline"
            rows={[
              { label: 'Solved annual base spending', metric: capacity.maxBaseAnnual, format: 'money' },
              { label: 'Slack vs. current base spending', metric: capacity.spendingSlack, format: 'money' },
            ]}
          />
          <div className="year-table-wrap" style={{ border: 'none' }}>
            <table className="compare-table">
              <caption>Capacity solve status</caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Simulations</th>
                  <th scope="col">Limiting constraint</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Baseline</th>
                  <td>{spendingCapacityStatus(capacity.maxBaseAnnual.baseline, capacity.baselineConverged)}</td>
                  <td>{capacity.baselineSimulationCount}</td>
                  <td>{capacity.baselineLimitingConstraint ?? 'Not identified'}</td>
                </tr>
                <tr>
                  <th scope="row">Proposal</th>
                  <td>{spendingCapacityStatus(capacity.maxBaseAnnual.proposal, capacity.proposalConverged)}</td>
                  <td>{capacity.proposalSimulationCount}</td>
                  <td>{capacity.proposalLimitingConstraint ?? 'Not identified'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {diagnostics.length > 0 ? (
            <ul className="small">
              {diagnostics.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="small">
          Not calculated. This uses two worker-backed exact-ledger solves and reports whether each answer converged,
          is only a feasible lower bound, or is unavailable.
        </p>
      )}
    </div>
  )
}

function ScenarioDetail({
  comparison,
  capacity,
  capacityRunning,
  onCalculateCapacity,
}: {
  comparison: ScenarioPlanComparison
  capacity: ScenarioPlanComparison['spendingCapacity']
  capacityRunning: boolean
  onCalculateCapacity: () => void
}) {
  return (
    <>
      <h3>Headline and spending</h3>
      <MetricTable
        caption="Headline outcomes"
        basis="nominal dollars; proposal minus baseline"
        rows={[
          { label: 'Ending investable assets', metric: comparison.headline.endingInvestable, format: 'money' },
          { label: 'Ending net worth', metric: comparison.headline.endingNetWorth, format: 'money' },
          { label: 'Ending after-tax estate', metric: comparison.headline.endingAfterTaxEstate, format: 'money' },
          { label: 'Lifetime tax', metric: comparison.headline.lifetimeTax, format: 'money' },
          { label: 'Lifetime penalties', metric: comparison.headline.lifetimePenalties, format: 'money' },
          {
            label: 'Lifetime tax plus penalties',
            metric: comparison.headline.lifetimeTaxesAndPenalties,
            format: 'money',
          },
          { label: 'Depletion year', metric: comparison.headline.depletionYear, format: 'depletionYear' },
          { label: 'Projection end year', metric: comparison.headline.projectionEndYear, format: 'year' },
          { label: 'Intended spending', metric: comparison.spending.intended, format: 'money' },
          { label: 'Funded spending', metric: comparison.spending.funded, format: 'money' },
          { label: 'Total spending shortfall', metric: comparison.spending.totalShortfall, format: 'money' },
          { label: 'Required-floor shortfall', metric: comparison.spending.requiredShortfall, format: 'money' },
          { label: 'Target-lifestyle shortfall', metric: comparison.spending.targetShortfall, format: 'money' },
        ]}
      />
      <CapacitySection capacity={capacity} running={capacityRunning} onCalculate={onCalculateCapacity} />

      <h3>Income and withdrawals</h3>
      <MetricTable
        caption="Lifetime gross income by source"
        basis="nominal dollars"
        rows={[
          { label: 'Wages', metric: comparison.income.wages, format: 'money' },
          { label: 'Social Security', metric: comparison.income.socialSecurity, format: 'money' },
          { label: 'Pension', metric: comparison.income.pension, format: 'money' },
          { label: 'Annuity', metric: comparison.income.annuity, format: 'money' },
          { label: 'TIPS ladder', metric: comparison.income.tipsLadder, format: 'money' },
          { label: 'Recurring income', metric: comparison.income.recurring, format: 'money' },
          { label: 'One-time income', metric: comparison.income.oneTime, format: 'money' },
          { label: 'Taxable yield', metric: comparison.income.taxableYield, format: 'money' },
          { label: 'Total gross income', metric: comparison.income.total, format: 'money' },
        ]}
      />
      <MetricTable
        caption="Lifetime withdrawals by source"
        basis="nominal dollars"
        rows={[
          { label: 'Cash', metric: comparison.withdrawals.cash, format: 'money' },
          { label: 'Taxable', metric: comparison.withdrawals.taxable, format: 'money' },
          { label: 'Traditional', metric: comparison.withdrawals.traditional, format: 'money' },
          { label: 'Roth', metric: comparison.withdrawals.roth, format: 'money' },
          { label: 'HSA', metric: comparison.withdrawals.hsa, format: 'money' },
          { label: 'Roth conversions', metric: comparison.withdrawals.rothConversions, format: 'money' },
          { label: 'RMDs', metric: comparison.withdrawals.rmd, format: 'money' },
          { label: 'QCDs', metric: comparison.withdrawals.qcd, format: 'money' },
        ]}
      />

      <h3>IRMAA and estate</h3>
      <MetricTable
        caption="Medicare income surcharge"
        basis="nominal dollars except tier counts"
        rows={[
          { label: 'IRMAA surcharge', metric: comparison.irmaa.surcharge, format: 'money' },
          { label: 'Total Medicare premiums', metric: comparison.irmaa.totalMedicarePremiums, format: 'money' },
          { label: 'Years in a surcharge tier', metric: comparison.irmaa.surchargeTierYears, format: 'number' },
          { label: 'Maximum IRMAA tier', metric: comparison.irmaa.maxTier, format: 'number' },
        ]}
      />
      <MetricTable
        caption="Ending estate"
        basis="nominal dollars"
        rows={[
          { label: 'Gross net worth', metric: comparison.estate.grossNetWorth, format: 'money' },
          { label: 'After-tax estate to heirs', metric: comparison.estate.afterTaxEstate, format: 'money' },
          { label: 'Estimated heir income tax', metric: comparison.estate.heirTax, format: 'money' },
          { label: 'Charitable destination', metric: comparison.estate.charity, format: 'money' },
          { label: 'Cash', metric: comparison.estate.byCategory.cash, format: 'money' },
          { label: 'Taxable', metric: comparison.estate.byCategory.taxable, format: 'money' },
          { label: 'Traditional', metric: comparison.estate.byCategory.traditional, format: 'money' },
          { label: 'Roth', metric: comparison.estate.byCategory.roth, format: 'money' },
          { label: 'HSA', metric: comparison.estate.byCategory.hsa, format: 'money' },
        ]}
      />

      {comparison.risk ? (
        <>
          <h3>Shared-path risk</h3>
          <p className="small">
            {comparison.risk.provenance.pathCount} paths, seed {comparison.risk.provenance.seed}; both plans face the
            same market path at each path index.
          </p>
          <MetricTable
            caption="Shared-market risk outcomes"
            basis="rates and nominal dollars; estate values are marginal percentiles"
            rows={[
              { label: 'Portfolio success rate', metric: comparison.risk.successRate, format: 'percent' },
              {
                label: 'Required-floor success rate',
                metric: comparison.risk.requiredFloorSuccessRate,
                format: 'percent',
              },
              {
                label: 'Target-lifestyle success rate',
                metric: comparison.risk.targetLifestyleSuccessRate,
                format: 'percent',
              },
              { label: 'Median target attainment', metric: comparison.risk.targetAttainmentP50, format: 'percent' },
              {
                label: 'Expected shortfall on failing paths',
                metric: comparison.risk.expectedShortfallDollars,
                format: 'money',
              },
              {
                label: 'Average total shortfall',
                metric: comparison.risk.averageTotalShortfallDollars,
                format: 'money',
              },
              {
                label: 'Probability of a spending cut',
                metric: comparison.risk.probabilityOfAdjustment,
                format: 'percent',
              },
              { label: 'After-tax estate p10', metric: comparison.risk.estateP10, format: 'money' },
              { label: 'After-tax estate p50', metric: comparison.risk.estateP50, format: 'money' },
              { label: 'After-tax estate p90', metric: comparison.risk.estateP90, format: 'money' },
            ]}
          />
          {comparison.risk.depletionProbabilityByYear.length > 0 ? (
            <details>
              <summary>Cumulative depletion probability by year</summary>
              <MetricTable
                caption="Cumulative depletion probability"
                basis="shared paths"
                rows={comparison.risk.depletionProbabilityByYear.map((row) => ({
                  label: String(row.year),
                  metric: row.cumulativeProbability,
                  format: 'percent' as const,
                }))}
              />
            </details>
          ) : null}
        </>
      ) : (
        <p className="small">Shared-market risk is off for this comparison.</p>
      )}
      <AnnualLedgerComparison comparison={comparison} />
    </>
  )
}

function comparisonFingerprint(plan: Plan, label: 'baseline' | 'proposal') {
  try {
    return { hash: scenarioPlanSnapshotHash(plan), error: null }
  } catch {
    return {
      hash: null,
      error: `The ${label} plan could not be prepared for comparison. Review the plan and try again.`,
    }
  }
}

function ComparableScenariosPage() {
  const { plan, update } = usePlan()
  const readOnly = useWorkspaceReadOnly()
  const [withMc, setWithMc] = useState(true)
  const [overviewResult, setOverviewResult] = useState<{ key: string; value: ScenarioComparison } | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(() => plan.scenarios[0]?.id ?? null)
  const [detailResult, setDetailResult] = useState<{
    key: string
    value: ScenarioPlanComparison | null
    error: string | null
  } | null>(null)
  const [capacityRequestKey, setCapacityRequestKey] = useState<string | null>(null)
  const [capacityResult, setCapacityResult] = useState<{
    key: string
    value: ScenarioPlanComparison['spendingCapacity']
    error: string | null
  } | null>(null)
  const detailGeneration = useRef(0)
  const capacityGeneration = useRef(0)
  const startYear = currentStartYear()
  const seed = useMemo(() => seedFromPlanId(plan.id), [plan.id])
  const selectedScenario =
    plan.scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? plan.scenarios[0] ?? null
  const proposal = useMemo(() => {
    if (!selectedScenario) return { plan: null, error: null }
    try {
      const applied = applyScenarioPatch(plan, selectedScenario.patch)
      return applied.ok
        ? { plan: applied.plan, error: null }
        : { plan: null, error: `Scenario overrides are invalid: ${applied.issues.join('; ')}` }
    } catch {
      return { plan: null, error: 'The selected scenario could not be prepared for comparison.' }
    }
  }, [plan, selectedScenario])
  const baselineFingerprint = useMemo(() => comparisonFingerprint(plan, 'baseline'), [plan])
  const proposalFingerprint = useMemo(
    () => (proposal.plan ? comparisonFingerprint(proposal.plan, 'proposal') : { hash: null, error: null }),
    [proposal.plan],
  )
  const baselineHash = baselineFingerprint.hash
  const proposalHash = proposalFingerprint.hash
  const overviewKey = useMemo(
    () => (baselineHash ? scenarioOverviewRequestKey(baselineHash, plan.scenarios, startYear) : null),
    [baselineHash, plan.scenarios, startYear],
  )
  const detailKey =
    baselineHash && proposalHash
      ? `${baselineHash}:${proposalHash}:${startYear}:${withMc ? `mc-${seed}` : 'deterministic'}`
      : null
  const overview = overviewKey && overviewResult?.key === overviewKey ? overviewResult.value : null
  const detail = detailKey && detailResult?.key === detailKey ? detailResult.value : null
  const storedDetailError =
    detailKey && detailResult?.key === detailKey ? detailResult.error : null
  const detailError =
    baselineFingerprint.error ?? proposal.error ?? proposalFingerprint.error ?? storedDetailError
  const detailBusy = detailKey !== null && Boolean(proposal.plan) && detailResult?.key !== detailKey
  const capacityInputKey =
    detailKey && selectedScenario ? `${detailKey}:scenario:${selectedScenario.id}` : null
  const currentCapacityRequest =
    capacityInputKey && capacityRequestKey?.startsWith(`${capacityInputKey}:capacity:`) === true
      ? capacityRequestKey
      : null
  const capacity =
    currentCapacityRequest && capacityResult?.key === currentCapacityRequest ? capacityResult.value : null
  const capacityError =
    currentCapacityRequest && capacityResult?.key === currentCapacityRequest ? capacityResult.error : null
  const capacityBusy = currentCapacityRequest !== null && capacityResult?.key !== currentCapacityRequest
  const detailStatus = detailBusy ? 'Recalculating…' : detailError ? 'Error' : detail ? 'Current' : 'Unavailable'

  useEffect(() => {
    if (!overviewKey) return
    const t = window.setTimeout(() => {
      setOverviewResult({
        key: overviewKey,
        value: compareScenarios(plan, {
          startYear,
          taxCalculator: taxCalculatorFor(plan),
          // Per-row stacks so patches that change tax assumptions (e.g. a
          // relocation scenario clearing the flat override) price correctly.
          taxCalculatorForPlan: taxCalculatorFor,
        }),
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [plan, startYear, overviewKey])

  useEffect(() => {
    const generation = ++detailGeneration.current
    if (!proposal.plan || !proposalHash || !baselineHash || !detailKey) return
    const t = window.setTimeout(() => {
      try {
        const next = compareScenarioPlans(plan, proposal.plan!, {
          startYear,
          taxCalculatorForPlan: taxCalculatorFor,
          stochastic: withMc
            ? {
                model: { type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct },
                pathCount: 200,
                seed,
              }
            : undefined,
        })
        if (
          detailGeneration.current === generation &&
          isScenarioComparisonCurrent(next, baselineHash, proposalHash, startYear)
        ) {
          setDetailResult({ key: detailKey, value: next, error: null })
        }
      } catch (error) {
        if (detailGeneration.current === generation) {
          setDetailResult({
            key: detailKey,
            value: null,
            error: error instanceof Error ? error.message : 'The comparison could not be completed.',
          })
        }
      }
    }, 200)
    return () => window.clearTimeout(t)
  }, [plan, proposal, proposalHash, baselineHash, detailKey, startYear, withMc, seed])

  const calculateCapacity = () => {
    if (!proposal.plan || !proposalHash || !baselineHash || !detailKey || !capacityInputKey) return
    const generation = ++capacityGeneration.current
    const requestDetailGeneration = detailGeneration.current
    const requestKey = `${capacityInputKey}:capacity:${generation}`
    const baselinePlan = plan
    const proposalPlan = proposal.plan
    const requestIsCurrent = () =>
      capacityGeneration.current === generation &&
      detailGeneration.current === requestDetailGeneration &&
      scenarioPlanSnapshotHash(baselinePlan) === baselineHash &&
      scenarioPlanSnapshotHash(proposalPlan) === proposalHash
    setCapacityRequestKey(requestKey)
    void Promise.all([
      runSpendingSolve({ plan: baselinePlan, startYear }),
      runSpendingSolve({ plan: proposalPlan, startYear }),
    ])
      .then(([baselineSolved, proposalSolved]) => {
        if (!requestIsCurrent()) return
        setCapacityResult({
          key: requestKey,
          value: compareScenarioSpendingCapacityResults(baselineSolved, proposalSolved),
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (requestIsCurrent()) {
          setCapacityResult({
            key: requestKey,
            value: null,
            error: error instanceof Error ? error.message : 'Spending capacity could not be calculated.',
          })
        }
      })
  }

  const liveMessage = detailBusy
    ? 'Comparing the selected scenario.'
    : capacityBusy
      ? 'Calculating sustainable spending capacity.'
      : detailError
        ? detailError
        : capacityError
          ? capacityError
          : detail
            ? 'Scenario comparison is ready.'
            : ''

  return (
    <section>
      <LiveStatus message={liveMessage} assertive={Boolean(detailError || capacityError)} />
      <AddScenario />

      <div className="card">
        <div className="item-row-head">
          <h2 style={{ margin: 0 }}>Side-by-side</h2>
        </div>
        {plan.scenarios.length === 0 ? (
          <div className="empty-state">
            <p>No scenarios yet. Add one above — “{TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct}% SS cut” and “retire 2 years earlier” are classics.</p>
          </div>
        ) : baselineFingerprint.error ? (
          <p style={{ color: 'var(--bad)' }}>{baselineFingerprint.error}</p>
        ) : overview === null ? (
          <div className="skeleton" style={{ height: '10rem' }} aria-label="Comparing scenarios" />
        ) : (
          <div className="year-table-wrap" style={{ border: 'none' }}>
            <table className="compare-table">
              <caption>Deterministic overview (nominal dollars)</caption>
              <thead>
                <tr>
                  <th scope="col">Compare</th>
                  <th scope="col">Scenario</th>
                  <th scope="col">Ending net worth</th>
                  <th scope="col">After-tax estate</th>
                  <th scope="col">Lifetime tax plus penalties</th>
                  <th scope="col">Depletes</th>
                  <th scope="col">Changed</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {overview.rows.map((row) => (
                    <tr key={row.scenarioId ?? 'base'}>
                      <td>
                        {row.scenarioId === null ? (
                          <span className="small">Baseline</span>
                        ) : (
                          <input
                            type="radio"
                            name="selected-scenario"
                            aria-label={`Compare ${row.name}`}
                            checked={selectedScenario?.id === row.scenarioId}
                            onChange={() => setSelectedScenarioId(row.scenarioId)}
                          />
                        )}
                      </td>
                      <td>
                        <strong>{row.name}</strong>
                        {row.error ? <div className="small" style={{ color: 'var(--bad)' }}>{row.error}</div> : null}
                      </td>
                      <td>{row.error ? '—' : fmtMoneyCompact(row.summary.endingNetWorth)}</td>
                      <td>{row.error ? '—' : fmtMoneyCompact(row.summary.endingAfterTaxEstate)}</td>
                      <td>{row.error ? '—' : fmtMoneyCompact(row.summary.lifetimeTaxesAndPenalties)}</td>
                      <td>{row.error ? '—' : (row.summary.depletionYear ?? 'never')}</td>
                      <td style={{ maxWidth: '16rem', textAlign: 'left' }}>
                        {row.diff.slice(0, 4).map((d) => (
                          <span key={d.path} className="diff-chip" title={`${d.path}: ${JSON.stringify(d.baseValue)} → ${JSON.stringify(d.scenarioValue)}`}>
                            {d.path.split('.').slice(-2).join('.')}
                          </span>
                        ))}
                        {row.diff.length > 4 ? <span className="diff-chip">+{row.diff.length - 4} more</span> : null}
                      </td>
                      <td>
                        {row.scenarioId !== null ? (
                          <button
                            type="button"
                            className="btn-ghost btn-ghost-danger"
                            disabled={readOnly}
                            onClick={() =>
                              update((d) => {
                                d.scenarios = d.scenarios.filter((s) => s.id !== row.scenarioId)
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedScenario ? (
        <div className="card" aria-busy={detailBusy || capacityBusy}>
          <div className="item-row-head">
            <div>
              <h2 style={{ margin: 0 }}>Baseline vs. {selectedScenario.name}</h2>
              <p className="card-hint">
                Change is proposal minus baseline. Deterministic, stochastic, and annual-ledger amounts are nominal
                dollars unless a table explicitly says today&apos;s dollars.
              </p>
              <p className="small">
                Deterministic comparison · {detailStatus}
                {' · '}
                Stochastic comparison ·{' '}
                {withMc
                  ? detailStatus === 'Current'
                    ? 'Current · 200 shared market paths'
                    : detailStatus
                  : 'Off'}
              </p>
            </div>
            <label className="radio-option" style={{ padding: 0 }}>
              <input type="checkbox" checked={withMc} onChange={(event) => setWithMc(event.target.checked)} />
              <span className="small">Shared-market risk (200 paths)</span>
            </label>
          </div>
          {detailError ? (
            <p style={{ color: 'var(--bad)' }}>
              {detailError}
            </p>
          ) : null}
          {capacityError ? (
            <p style={{ color: 'var(--bad)' }}>
              {capacityError}
            </p>
          ) : null}
          {detailBusy || detail === null ? (
            detailError ? null : (
              <div className="skeleton" style={{ height: '14rem' }} aria-label="Comparing selected scenario" />
            )
          ) : (
            <ScenarioDetail
              comparison={detail}
              capacity={capacity}
              capacityRunning={capacityBusy}
              onCalculateCapacity={calculateCapacity}
            />
          )}
        </div>
      ) : null}

      <LearnAboutScreen route="/plan/:planId/scenarios" />
    </section>
  )
}

export function ScenariosPage() {
  const { issues } = usePlan()
  if (issues.length === 0) return <ComparableScenariosPage />

  const message =
    'Scenario comparison is unavailable while the plan has validation issues. Fix the highlighted plan fields to continue.'
  return (
    <section>
      <LiveStatus message={message} assertive />
      <div className="card">
        <h2>Scenario comparison unavailable</h2>
        <p style={{ color: 'var(--bad)' }}>{message}</p>
      </div>
      <LearnAboutScreen route="/plan/:planId/scenarios" />
    </section>
  )
}
