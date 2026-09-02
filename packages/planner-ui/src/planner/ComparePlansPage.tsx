/**
 * Cross-plan compare: load two independent saved plans and show headline
 * deterministic results side by side. This intentionally complements
 * Scenarios, which compares variants inside one plan.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { listPlansVia, loadPlanVia, usePlanStore, type PlanSummary } from '../data/planStoreContext'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { SelectField } from './fields'
import { fmtMoneyCompact } from './format'
import { LiveStatus } from './LiveStatus'
import { projectPlan, type ProjectionView } from './useProjection'
import { ScrollRegion } from './ScrollRegion'
import { ageDelta, deterministicSuccessPct, formatDelta, moneyLastsDelta, type DeltaUnit } from './compareDeltas'

const SAME_PLAN_NOTICE = 'Choose two different plans to compare.'

interface ComparedPlan {
  plan: Plan
  view: ProjectionView
}

function resultLabel(summary: ProjectionSummary, endYear: number): string {
  return summary.depletionYear === null ? `Full plan through ${endYear}` : `Depletes in ${summary.depletionYear}`
}

function primaryAgeIn(plan: Plan, year: number | null): number | null {
  if (year === null) return null
  const dobYear = Number(plan.household.people[0]?.dob.slice(0, 4))
  return Number.isFinite(dobYear) ? year - dobYear : null
}

function deltaClass(value: number): string | undefined {
  if (Math.abs(value) < 0.5) return undefined
  return value > 0 ? 'delta-pos' : 'delta-neg'
}

/**
 * One metric row. Every row that differs gets a formatted delta, not only the
 * money rows: years, ages, and percentage points are the largest differences
 * a diff page can show (#499). `delta` null means the difference is undefined
 * for this pair (one side never depletes), and the cell says so with a dash.
 */
function MetricRow({
  label,
  a,
  b,
  delta,
  deltaLabel,
  unit = 'money',
  higherIsGood = true,
}: {
  label: string
  a: string
  b: string
  delta: number | null
  /** Pre-formatted cell text (a bounded years delta); `delta` still drives the color. */
  deltaLabel?: string
  unit?: DeltaUnit
  higherIsGood?: boolean
}) {
  const adjustedDelta = delta === null ? null : higherIsGood ? delta : -delta
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{a}</td>
      <td>{b}</td>
      <td className={adjustedDelta === null ? undefined : deltaClass(adjustedDelta)}>
        {delta === null ? '—' : (deltaLabel ?? formatDelta(delta, unit))}
      </td>
    </tr>
  )
}

export function ComparePlansPage() {
  const store = usePlanStore()
  const [summaries, setSummaries] = useState<PlanSummary[] | null>(null)
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [left, setLeft] = useState<ComparedPlan | null>(null)
  const [right, setRight] = useState<ComparedPlan | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void listPlansVia(store).then((items) => {
      setSummaries(items)
      setLeftId(items[0]?.id ?? '')
      setRightId(items.find((p) => p.id !== items[0]?.id)?.id ?? '')
    })
  }, [store])

  useEffect(() => {
    let cancelled = false
    async function loadCompared(id: string, setter: (plan: ComparedPlan | null) => void) {
      if (!id) {
        setter(null)
        return
      }
      const r = await loadPlanVia(store, id)
      if (cancelled) return
      if (r.ok) setter({ plan: r.plan, view: projectPlan(r.plan) })
      else {
        setter(null)
        setNotice(`Could not load one of those plans (${r.reason}).`)
      }
    }
    void loadCompared(leftId, setLeft)
    void loadCompared(rightId, setRight)
    return () => {
      cancelled = true
    }
  }, [leftId, rightId, store])

  const options = summaries ?? []
  const canCompare = left !== null && right !== null && left.plan.id !== right.plan.id
  const rows = useMemo((): Parameters<typeof MetricRow>[0][] => {
    if (!canCompare) return []
    const l = left.view.summary
    const r = right.view.summary
    const ageA = primaryAgeIn(left.plan, l.depletionYear)
    const ageB = primaryAgeIn(right.plan, r.depletionYear)
    const lasts = moneyLastsDelta(
      { depletionYear: l.depletionYear, endYear: left.view.result.endYear },
      { depletionYear: r.depletionYear, endYear: right.view.result.endYear },
    )
    return [
      {
        label: 'Money lasts',
        a: resultLabel(l, left.view.result.endYear),
        b: resultLabel(r, right.view.result.endYear),
        delta: lasts.value,
        deltaLabel: lasts.label,
        unit: 'years',
      },
      {
        label: 'Ending net worth',
        a: fmtMoneyCompact(l.endingNetWorth),
        b: fmtMoneyCompact(r.endingNetWorth),
        delta: r.endingNetWorth - l.endingNetWorth,
      },
      {
        label: 'Ending investable',
        a: fmtMoneyCompact(l.endingInvestable),
        b: fmtMoneyCompact(r.endingInvestable),
        delta: r.endingInvestable - l.endingInvestable,
      },
      {
        label: 'After-tax estate',
        a: fmtMoneyCompact(l.endingAfterTaxEstate),
        b: fmtMoneyCompact(r.endingAfterTaxEstate),
        delta: r.endingAfterTaxEstate - l.endingAfterTaxEstate,
      },
      {
        label: 'Success % (deterministic)',
        a: `${deterministicSuccessPct(l.depletionYear)}%`,
        b: `${deterministicSuccessPct(r.depletionYear)}%`,
        delta: deterministicSuccessPct(r.depletionYear) - deterministicSuccessPct(l.depletionYear),
        unit: 'pp',
      },
      {
        label: 'Depletion age (primary)',
        a: ageA === null ? '—' : String(ageA),
        b: ageB === null ? '—' : String(ageB),
        delta: ageDelta(ageA, ageB),
        unit: 'years',
      },
      {
        label: 'Lifetime tax + penalties',
        a: fmtMoneyCompact(l.lifetimeTaxesAndPenalties),
        b: fmtMoneyCompact(r.lifetimeTaxesAndPenalties),
        delta: r.lifetimeTaxesAndPenalties - l.lifetimeTaxesAndPenalties,
        higherIsGood: false,
      },
    ]
  }, [canCompare, left, right])

  return (
    <section className="page planner-shell" style={{ textAlign: 'left' }}>
      <div className="results-toolbar">
        <Link to="/" className="btn btn-secondary btn-small">
          Back to plans
        </Link>
      </div>
      <h1>Compare plans</h1>
      <p className="lede">
        Compare two saved plans side by side. Use this for A/B planning after duplicating a plan, or for year-over-year
        tracking across independently saved plans.
      </p>
      {notice ? <div className="callout callout--warn">{notice}</div> : null}
      {summaries === null ? (
        <div className="skeleton" style={{ height: '8rem' }} aria-label="Loading plans" />
      ) : summaries.length < 2 ? (
        <div className="empty-state">
          <h2>Two plans are needed</h2>
          <p>Duplicate an existing plan or create another plan before comparing.</p>
        </div>
      ) : (
        <>
          <div className="card compare-selectors">
            <SelectField
              label="Plan A"
              value={leftId}
              options={options.map((s) => ({ value: s.id, label: s.name }))}
              onCommit={setLeftId}
            />
            <SelectField
              label="Plan B"
              value={rightId}
              options={options.map((s) => ({ value: s.id, label: s.name }))}
              onCommit={setRightId}
            />
          </div>
          <LiveStatus
            message={
              left !== null && right !== null && left.plan.id === right.plan.id ? SAME_PLAN_NOTICE : ''
            }
          />
          {!canCompare ? (
            <div className="callout callout--info">{SAME_PLAN_NOTICE}</div>
          ) : (
            <>
              <ScrollRegion label="Plan comparison">
                <table className="year-table compare-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      <th scope="col" className="compare-table-plan-name">{left.plan.name}</th>
                      <th scope="col" className="compare-table-plan-name">{right.plan.name}</th>
                      <th scope="col">Plan B − Plan A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => <MetricRow key={row.label} {...row} />)}
                  </tbody>
                </table>
              </ScrollRegion>
              {/* The delta colors are a verdict on Plan B, so the page says
                  which way each row reads (#499): lifetime tax is "lower is
                  better", everything else "higher or later is better". */}
              <p className="field-hint compare-delta-legend">
                Plan B − Plan A: <span className="delta-pos">green</span> means Plan B does better on that row,{' '}
                <span className="delta-neg">red</span> means worse. Lifetime tax reads lower as better; every other row
                reads higher or later as better. A dash means the difference is undefined for this pair; ≥ or ≤ means
                one plan never runs out, so the gap is at least or at most that many years.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
