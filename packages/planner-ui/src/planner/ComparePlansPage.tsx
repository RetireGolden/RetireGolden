/**
 * Cross-plan compare: load two independent saved plans and show headline
 * deterministic results side by side. This intentionally complements
 * Scenarios, which compares variants inside one plan.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { listPlansVia, loadPlanVia, usePlanStore, type PlanSummary } from '../data/planStoreContext'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { fmtMoneyCompact } from './format'
import { projectPlan, type ProjectionView } from './useProjection'

interface ComparedPlan {
  plan: Plan
  view: ProjectionView
}

function resultLabel(summary: ProjectionSummary, endYear: number): string {
  return summary.depletionYear === null ? `Full plan through ${endYear}` : `Depletes in ${summary.depletionYear}`
}

function primaryAgeIn(plan: Plan, year: number | null): string {
  if (year === null) return '—'
  const dobYear = Number(plan.household.people[0]?.dob.slice(0, 4))
  return Number.isFinite(dobYear) ? String(year - dobYear) : '—'
}

function deltaClass(value: number): string | undefined {
  if (Math.abs(value) < 0.5) return undefined
  return value > 0 ? 'delta-pos' : 'delta-neg'
}

function moneyDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${fmtMoneyCompact(value)}`
}

function MetricRow({
  label,
  a,
  b,
  delta,
  higherIsGood = true,
}: {
  label: string
  a: string
  b: string
  delta?: number
  higherIsGood?: boolean
}) {
  const adjustedDelta = delta === undefined ? undefined : higherIsGood ? delta : -delta
  return (
    <tr>
      <th>{label}</th>
      <td>{a}</td>
      <td>{b}</td>
      <td className={adjustedDelta === undefined ? undefined : deltaClass(adjustedDelta)}>
        {delta === undefined ? '—' : moneyDelta(delta)}
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
  const rows = useMemo(() => {
    if (!canCompare) return []
    const l = left.view.summary
    const r = right.view.summary
    return [
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
        a: l.depletionYear === null ? '100%' : '0%',
        b: r.depletionYear === null ? '100%' : '0%',
      },
      {
        label: 'Depletion age (primary)',
        a: primaryAgeIn(left.plan, l.depletionYear),
        b: primaryAgeIn(right.plan, r.depletionYear),
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
            <label>
              Plan A
              <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>
              Plan B
              <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          {!canCompare ? (
            <div className="callout callout--info">Choose two different plans to compare.</div>
          ) : (
            <div className="year-table-wrap">
              <table className="year-table compare-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>{left.plan.name}</th>
                    <th>{right.plan.name}</th>
                    <th>Plan B − Plan A</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Money lasts</th>
                    <td>{resultLabel(left.view.summary, left.view.result.endYear)}</td>
                    <td>{resultLabel(right.view.summary, right.view.result.endYear)}</td>
                    <td>—</td>
                  </tr>
                  {rows.map((row) => <MetricRow key={row.label} {...row} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
