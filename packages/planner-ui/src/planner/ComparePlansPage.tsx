/**
 * Cross-plan compare: load two independent saved plans and show headline
 * deterministic results side by side. This intentionally complements
 * Scenarios, which compares variants inside one plan.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { listPlansVia, loadPlanVia, usePlanStore, type PlanSummary } from '../data/planStoreContext'
import { listExampleSummaries } from '../data/planStore'
import { isExamplePlanId } from '../data/planOrigin'
import type { Plan } from '@retiregolden/engine/model/plan'
import type { MoneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import {
  comparePlanHeadlines,
  PlanHeadlineRefusal,
  type MoneyLastsComparison,
  type PlanHeadlineComparison,
} from '@retiregolden/engine/scenarios/planHeadlines'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
import { SelectField } from './fields'
import { fmtMoneyCompact } from './format'
import { LiveStatus } from './LiveStatus'
import { compareStartYear, projectPlan, projectionStartYear, type ProjectionView } from './useProjection'
import { useClockYear } from '../startYear'
import { EXAMPLE_FIXED_YEAR } from './examples/exampleClock'
import { compareExampleNote } from './compareExampleNote'
import { ScrollRegion } from './ScrollRegion'
import { formatDelta, type DeltaUnit } from './compareDeltas'
import { moneyLastsValue } from './format'

const SAME_PLAN_NOTICE = 'Choose two different plans to compare.'

/**
 * A comparison the engine refuses, in plain words with a next step (PR #754
 * finding 11): which plan the refusal is about and what to fix, never the
 * engine's own wording.
 */
function comparisonRefusalSentence(error: unknown): string {
  const lead = "These two plans can't be compared: "
  const planName = (side: 'baseline' | 'proposal') => (side === 'baseline' ? 'Plan A' : 'Plan B')
  if (error instanceof NonFiniteComparisonError) {
    if (error.role === 'difference') {
      return `${lead}the difference between their figures could not be computed. Open each plan's Results page to check its projection, then compare again.`
    }
    const name = planName(error.role)
    return `${lead}one of ${name}'s figures could not be computed. Open ${name}'s Results page to check its projection, then compare again.`
  }
  // The engine's other refusal, two start years, cannot reach this page: both
  // sides run from one `compareStartYear` (review L9, D-2027-ROLLOVER), so it
  // gets the plain fallback below rather than advice that would not help.
  if (error instanceof PlanHeadlineRefusal && error.reason === 'birth-date-missing' && error.side !== null) {
    const name = planName(error.side)
    return `${lead}${name} runs out of money, and its first person has no valid date of birth, so the age when that happens can't be worked out. Add the date of birth on ${name}'s Household page, then compare again.`
  }
  return `${lead}one plan's projection gave a result this page can't use. Open each plan's Results page to check its projection, then compare again.`
}

interface ComparedPlan {
  plan: Plan
  view: ProjectionView
}

/** A plan's name in the pickers: an example says it is one. */
function pickerLabel(summary: PlanSummary): string {
  return isExamplePlanId(summary.id) ? `${summary.name} (example)` : summary.name
}

/**
 * The "Money lasts" cell in the one wording every surface uses (owner decision
 * R15), from the engine's moneyLasts for the plan: "through L", "short from
 * S", or "full plan", which here also names the end year, since two compared
 * plans can end in different years.
 */
function lastsLabel(lasts: MoneyLasts, startYear: number): string {
  const value = moneyLastsValue(lasts, startYear)
  return lasts.depletionYear === null ? `${value} through ${lasts.endYear}` : value
}

/**
 * The Money lasts delta cell from the engine's comparison: two full plans read
 * "same" on one horizon and "both full plan" on different ones, a one-sided
 * comparison is a bound ("≥ +7 yrs": Plan B lasts at least seven more years),
 * and two depleting plans read the exact gap.
 */
function lastsDeltaLabel(lasts: MoneyLastsComparison, endYearDelta: number): string {
  if (lasts.bound === 'bothFull' || lasts.delta === null) return endYearDelta === 0 ? 'same' : 'both full plan'
  const years = formatDelta(lasts.delta, 'years')
  if (lasts.bound === null) return years
  return `${lasts.bound === 'atLeast' ? '≥' : '≤'} ${years}`
}

/**
 * The dollar rows' basis, stated where the numbers are: the shared start
 * year's dollars, or (plans ending in one year) that year's dollars for the
 * ending rows and nominal for the lifetime sum.
 */
function moneyLabel(label: string, headline: PlanHeadlineComparison, lifetime: boolean): string {
  if (headline.moneyBasis === 'today') return `${label} (${headline.startYear} $)`
  return lifetime ? `${label} (nominal)` : `${label} (${headline.endYear.baseline} $)`
}

/**
 * The sentence under the table that states the dollar rows' basis and both
 * end years (owner decision R13).
 */
function compareBasisSentence(headline: PlanHeadlineComparison): string {
  const a = headline.endYear.baseline
  const b = headline.endYear.proposal
  if (headline.moneyBasis === 'today') {
    return (
      `Plan A ends in ${a} and Plan B in ${b}, so every dollar row is in ${headline.startYear} dollars: ` +
      "each plan's figures are divided by that plan's own inflation to the year they fall in. " +
      "The lifetime rows still cover each plan's own years."
    )
  }
  return (
    `Both plans end in ${a}, so the dollar rows are nominal: the ending rows are in ${a} dollars and ` +
    "lifetime tax adds each year's own dollars. Each plan's dollars follow its own inflation assumption."
  )
}

function deltaClass(value: number): string | undefined {
  if (Math.abs(value) < 0.5) return undefined
  return value > 0 ? 'delta-pos' : 'delta-neg'
}

/**
 * One metric row. Every row that differs gets a formatted delta, not only the
 * money rows: years, ages, and percentage points are the largest differences
 * a diff page can show (#499). `delta` null means the difference is undefined
 * for this pair (one side never depletes), and the cell says so with a dash
 * unless `deltaLabel` says what it is instead; a null delta is never coloured.
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
  /** Pre-formatted cell text (a bounded years delta); `delta` still drives the color, none when it is null. */
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
        {deltaLabel ?? (delta === null ? '—' : formatDelta(delta, unit))}
      </td>
    </tr>
  )
}

/**
 * The depletion-age row names whose age it is: on each side the person the
 * engine's canonical order puts first (the older), never "primary". The two
 * plans can name different people; the label then says which is whose.
 */
function depletionAgeLabel(
  headline: PlanHeadlineComparison,
  planA: Plan | undefined,
  planB: Plan | undefined,
): string {
  const nameIn = (plan: Plan | undefined, id: string | null) =>
    plan?.household.people.find((person) => person.id === id)?.name ?? null
  const a = nameIn(planA, headline.depletionAgePersonId.baseline)
  const b = nameIn(planB, headline.depletionAgePersonId.proposal)
  if (a === null || b === null) return 'Depletion age'
  return a === b ? `Depletion age (${a})` : `Depletion age (${a} in A, ${b} in B)`
}

export function ComparePlansPage() {
  const store = usePlanStore()
  const [summaries, setSummaries] = useState<PlanSummary[] | null>(null)
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [left, setLeft] = useState<ComparedPlan | null>(null)
  const [right, setRight] = useState<ComparedPlan | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // The clock's year, re-read at the next local New Year: a comparison left
  // open across midnight on 31 December runs again from the new year with no
  // click (PR #768 review issue 3). The effect below reads the clock when it
  // runs and lists this year among its inputs so it runs again then.
  const clockYear = useClockYear()

  // A rejected list must not leave the skeleton up forever, and an empty list
  // must not be mistaken for "you only have one plan": one is a browser that
  // refused, the other is a library the user can act on.
  const [listUnavailable, setListUnavailable] = useState(false)

  useEffect(() => {
    // Your plans, then the library examples opened on this device (they live
    // in this browser whatever the host store is). An unreadable example list
    // leaves the user plans comparable.
    const examples = listExampleSummaries().catch((): PlanSummary[] => [])
    void Promise.all([listPlansVia(store), examples]).then(
      ([plans, opened]) => {
        const items = [...plans, ...opened]
        setSummaries(items)
        setListUnavailable(false)
        setLeftId(items[0]?.id ?? '')
        setRightId(items.find((p) => p.id !== items[0]?.id)?.id ?? '')
      },
      () => {
        setSummaries([])
        setListUnavailable(true)
      },
    )
  }, [store])

  useEffect(() => {
    let cancelled = false
    // The clock is read once, before either plan loads: two reads could
    // straddle a New Year and start the two sides in different years.
    const now = new Date()
    async function loadCompared(id: string): Promise<Plan | null> {
      if (!id) return null
      // A rejected read leaves the selection with nothing behind it; say so
      // rather than leaving the comparison silently one-sided.
      let r
      try {
        r = await loadPlanVia(store, id)
      } catch {
        if (!cancelled) setNotice('One of those plans could not be read. Storage is unavailable in this browser right now.')
        return null
      }
      if (r.ok) return r.plan
      if (!cancelled) setNotice(`Could not load one of those plans (${r.reason}).`)
      return null
    }
    void Promise.all([loadCompared(leftId), loadCompared(rightId)]).then(([leftPlan, rightPlan]) => {
      if (cancelled) return
      // One start year for both sides, decided once both are loaded: the
      // engine compares two plans only from one start year. Two examples run
      // from the year their copy is written for; anything with a user plan in
      // it runs from the clock's year (`compareStartYear`).
      const startYear =
        leftPlan !== null && rightPlan !== null
          ? compareStartYear(leftPlan, rightPlan, now)
          : projectionStartYear(leftPlan ?? rightPlan ?? { origin: 'user' }, now)
      setLeft(leftPlan === null ? null : { plan: leftPlan, view: projectPlan(leftPlan, startYear) })
      setRight(rightPlan === null ? null : { plan: rightPlan, view: projectPlan(rightPlan, startYear) })
    })
    return () => {
      cancelled = true
    }
  }, [leftId, rightId, store, clockYear])

  const options = summaries ?? []
  const canCompare = left !== null && right !== null && left.plan.id !== right.plan.id
  // Every figure is the engine's comparison of the two projections (B2-P1
  // slice 3). A comparison the engine refuses (a non-finite figure, a
  // depleting plan whose first person has no birth date) is stated in plain
  // words, not thrown.
  const comparison = useMemo(():
    | { ok: true; headline: PlanHeadlineComparison }
    | { ok: false; message: string }
    | null => {
    if (!canCompare) return null
    try {
      return { ok: true, headline: comparePlanHeadlines(
        { plan: left.plan, result: left.view.result, summary: left.view.summary },
        { plan: right.plan, result: right.view.result, summary: right.view.summary },
      ) }
    } catch (error) {
      return { ok: false, message: comparisonRefusalSentence(error) }
    }
  }, [canCompare, left, right])
  const headline = comparison?.ok === true ? comparison.headline : null
  const rows = useMemo((): Parameters<typeof MetricRow>[0][] => {
    if (headline === null) return []
    const money = (label: string, row: PlanHeadlineComparison['endingNetWorth'], lifetime = false) => ({
      label: moneyLabel(label, headline, lifetime),
      a: fmtMoneyCompact(row.baseline),
      b: fmtMoneyCompact(row.proposal),
      delta: row.delta,
      ...(lifetime ? { higherIsGood: false } : {}),
    })
    const lasts = headline.moneyLasts
    const age = headline.depletionAge
    const success = headline.deterministicSuccessPct
    return [
      {
        label: 'Money lasts',
        a: lastsLabel(lasts.baseline, headline.startYear),
        b: lastsLabel(lasts.proposal, headline.startYear),
        delta: lasts.delta,
        deltaLabel: lastsDeltaLabel(lasts, headline.endYear.delta),
        unit: 'years',
      },
      money('Ending net worth', headline.endingNetWorth),
      money('Ending investable', headline.endingInvestable),
      money('After-tax estate', headline.endingAfterTaxEstate),
      {
        label: 'Success % (deterministic)',
        a: `${success.baseline}%`,
        b: `${success.proposal}%`,
        delta: success.delta,
        unit: 'pp',
      },
      {
        label: depletionAgeLabel(headline, left?.plan, right?.plan),
        a: age.baseline === null ? '—' : String(age.baseline),
        b: age.proposal === null ? '—' : String(age.proposal),
        delta: age.delta,
        // Two different people's ages have no difference to show (review L1).
        ...(headline.depletionAgeDeltaWithheld === 'differentPeople' ? { deltaLabel: 'different people' } : {}),
        unit: 'years',
      },
      money('Lifetime tax + penalties', headline.lifetimeTaxesAndPenalties, true),
    ]
  }, [headline, left, right])

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
        tracking across independently saved plans. Examples you have opened on this device are listed too. Two
        examples run from {EXAMPLE_FIXED_YEAR}, the year they are set in. An example compared with one of your plans
        runs from your plan&apos;s first year instead, and the page says so under the table.
      </p>
      {notice ? <div className="callout callout--warn">{notice}</div> : null}
      {summaries === null ? (
        <div className="skeleton" style={{ height: '8rem' }} aria-label="Loading plans" />
      ) : listUnavailable ? (
        <div className="empty-state">
          <h2>Your plans could not be read</h2>
          <p>
            Storage is unavailable in this browser right now, so there is nothing to compare yet. Reloading the page
            tries again.
          </p>
        </div>
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
              options={options.map((s) => ({ value: s.id, label: pickerLabel(s) }))}
              onCommit={setLeftId}
            />
            <SelectField
              label="Plan B"
              value={rightId}
              options={options.map((s) => ({ value: s.id, label: pickerLabel(s) }))}
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
          ) : comparison?.ok === false ? (
            <div className="callout callout--warn" role="alert">
              {comparison.message}
            </div>
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
              {headline !== null ? <p className="field-hint compare-basis">{compareBasisSentence(headline)}</p> : null}
              {headline !== null
                ? [left.plan, right.plan].map((plan) => {
                    const note = compareExampleNote(plan, headline.startYear)
                    return note === null ? null : (
                      <p key={plan.id} className="field-hint compare-example-year">
                        {note}
                      </p>
                    )
                  })
                : null}
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
