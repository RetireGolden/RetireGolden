/**
 * Deterministic results: net worth by account category, income vs spending,
 * tax detail, modeling warnings, and the full year-by-year drill-down table
 * with a nominal / today's-dollars toggle and CSV export.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { Plan } from '@retiregolden/engine/model/plan'
import { guardrailThresholdDollars } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import { nominalForDisplay, toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import type { InheritedIraRefusalCode, YearResult } from '@retiregolden/engine/projection/types'
import { projectionDisplayFigures, type YearDisplayFigures } from '@retiregolden/engine/projection/yearFigures'
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_CATEGORY_COLOR,
  ACCOUNT_CATEGORY_LABEL,
  hasUnassignedCash,
  UNASSIGNED_CASH_COLOR,
  UNASSIGNED_CASH_KEY,
  UNASSIGNED_CASH_LABEL,
} from './accountCategories'
import { serializeSinglePlan } from '../data/planFormat'
import { downloadCsv } from '../csvDownload'
import { buildExpenseRows, buildIncomeRows, buildLedgerCsv, buildResultsRows } from './resultsRows'
import { CopyButton } from './CopyButton'
import { usePlan } from './planContextCore'
import { isPlanIncomplete } from './planCompleteness'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { downloadStandaloneReport } from '../report/downloadReport'
import { useReportBranding } from '../report/brandingContext'
import {
  buildInheritedSchedules,
  inheritedDeadlineExplanation,
  type ReportInheritedScheduleAccount,
} from '../report/reportModel'
import { fmtMoney, fmtMoneyCompact } from './format'
import { coastFireHorizonYear, fiReachedPhrase, fiTargetBasisFacts, fiTargetBasisSentence } from './fiTargetCopy'
import { useProjection } from './useProjection'
import { BucketLensCard } from './BucketLensCard'
import { FundedRatioCard } from './sections/IncomeFloorSection'
import { chartTooltipStyle } from './chartStyle'
import { NonZeroTooltipContent } from './chartTooltip'
import { frameH } from './chartFrame'
import { useMcSuccessRateState } from './useMcSuccessRate'
import {
  capitalLossCarryforwardHighlight,
  hasCapitalLossCarryforward,
} from './capitalLossCarryforwardVisibility'
import { ProfessionalConfirmationMarker } from './ProfessionalConfirmationMarker'
import { ScrollRegion } from './ScrollRegion'
import { citationHref } from './provenanceLinks'
import { formatYearList } from './acaVetoCopy'
import { buildYearCashFlowSankey, type YearCashFlowSankeyViewId } from './yearCashFlow'
import { YearCashFlowDialog } from './yearCashFlow/YearCashFlowDialog'

type Dollars = 'nominal' | 'today'

const FLOW_YEAR_PARAM = 'flowYear'
const FLOW_VIEW_PARAM = 'flowView'

type FlowViewParam = 'cash' | 'transfers'

function parseFlowYearParam(
  raw: string | null,
  years: readonly { year: number }[],
): number | null {
  if (raw === null || raw === '') return null
  if (!/^[0-9]+$/.test(raw)) return null
  const year = Number(raw)
  if (!Number.isSafeInteger(year)) return null
  return years.some((y) => y.year === year) ? year : null
}

function parseFlowViewParam(raw: string | null): { view: FlowViewParam; invalid: boolean } {
  if (raw === null || raw === '') return { view: 'cash', invalid: false }
  if (raw === 'cash' || raw === 'transfers') return { view: raw, invalid: false }
  return { view: 'cash', invalid: true }
}

function flowViewToSankey(view: FlowViewParam): YearCashFlowSankeyViewId {
  return view === 'transfers' ? 'transfers' : 'cashFlow'
}

function sankeyToFlowView(view: YearCashFlowSankeyViewId): FlowViewParam {
  return view === 'transfers' ? 'transfers' : 'cash'
}

function stripFlowParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(FLOW_YEAR_PARAM)
  next.delete(FLOW_VIEW_PARAM)
  return next
}


/** Income streams, stacked bottom-to-top in the income breakdown. */
const INCOME_SOURCES = [
  { key: 'wages', label: 'Wages', color: 'var(--chart-2)' },
  { key: 'socialSecurity', label: 'Social Security', color: 'var(--chart-1)' },
  { key: 'pension', label: 'Pension', color: 'var(--chart-3)' },
  { key: 'annuity', label: 'Annuity', color: 'var(--chart-4)' },
  { key: 'tipsLadder', label: 'TIPS ladder', color: 'var(--chart-8)' },
  { key: 'recurring', label: 'Other recurring', color: 'var(--chart-5)' },
  { key: 'oneTime', label: 'One-time', color: 'var(--chart-6)' },
  { key: 'taxableYield', label: 'Brokerage yield', color: 'var(--chart-7)' },
  { key: 'taxExemptInterest', label: 'Tax-exempt interest', color: 'var(--muted)' },
] as const

/** Spending categories, stacked bottom-to-top; sums to expenses + tax + penalties. */
const EXPENSE_CATEGORIES = [
  { key: 'base', label: 'Baseline living', color: 'var(--chart-1)' },
  { key: 'healthcare', label: 'Healthcare', color: 'var(--chart-2)' },
  { key: 'property', label: 'Property tax + insurance', color: 'var(--chart-3)' },
  { key: 'debt', label: 'Debt payments', color: 'var(--chart-4)' },
  { key: 'insurance', label: 'Insurance premiums', color: 'var(--chart-5)' },
  { key: 'care', label: 'Long-term care (net)', color: 'var(--chart-6)' },
  { key: 'goals', label: 'One-time goals', color: 'var(--chart-8)' },
  { key: 'taxes', label: 'Tax + penalties', color: 'var(--muted)' },
] as const


function moneyTick(v: number): string {
  return fmtMoneyCompact(v)
}

/** Plain-language cause per published engine refusal code. */
const REFUSAL_CAUSE_BY_CODE: Record<InheritedIraRefusalCode, string> = {
  'entity-beneficiary': 'estates, trusts, and other entities are not modeled',
  'successor-beneficiary': 'accounts already inherited from a prior beneficiary are not modeled',
  'employer-plan': 'inherited workplace-plan schedules are not modeled',
  'multiple-beneficiaries': 'facts are contradictory or incomplete',
  'needs-review': 'facts are contradictory or incomplete',
  'successor-clock-out-of-scope': 'facts are contradictory or incomplete',
}

/**
 * Map a technical classifier refusal into a plain-language cause for the
 * Results callout. Verbatim technical text stays in a collapsed detail.
 *
 * The engine publishes a discriminated `refusalCode` beside the prose, so the
 * normal path is a lookup. The substring reading below is the fallback for a
 * stored result serialized before the engine published codes, or for a code
 * a newer engine published that predates this UI build — either way,
 * `refusalCode` is only a type at compile time; a deserialized result can
 * carry any string, and an unrecognized one must fall through to the
 * substring reading rather than interpolate as literal `undefined`.
 */
function plainRefusalCause(
  refusalReason: string,
  refusalCode: InheritedIraRefusalCode | null,
): string {
  if (refusalCode !== null && refusalCode in REFUSAL_CAUSE_BY_CODE) {
    return REFUSAL_CAUSE_BY_CODE[refusalCode]
  }
  const lower = refusalReason.toLowerCase()
  if (
    lower.includes('estate') ||
    lower.includes('trust') ||
    lower.includes('entity') ||
    lower.includes('non-individual')
  ) {
    return 'estates, trusts, and other entities are not modeled'
  }
  if (lower.includes('before 2020') || lower.includes('pre-secure')) {
    return 'death before 2020 predates the modeled rules'
  }
  if (lower.includes('successor-beneficiary')) {
    return 'accounts already inherited from a prior beneficiary are not modeled'
  }
  if (lower.includes('employer-plan') || lower.includes('scopes inherited support to iras')) {
    return 'inherited workplace-plan schedules are not modeled'
  }
  return 'facts are contradictory or incomplete'
}

/**
 * Expandable per-account inherited schedule: the primary explanation surface,
 * fed from engine evidence rows already on the year ledger; no extra
 * simulation.
 */
export function InheritedSchedulesSection({
  plan,
  years,
  startYear,
  adj,
}: {
  plan: Plan
  years: readonly YearResult[]
  startYear: number
  adj: (year: number, v: number) => number
}) {
  const schedules = useMemo(() => buildInheritedSchedules(plan, years).accounts, [plan, years])
  if (schedules.length === 0) return null

  return (
    <div className="chart-card" id="inherited-schedules">
      <h2>Inherited account schedules</h2>
      <p className="card-hint">
        Required distribution schedules for the inherited accounts on this plan. Accounts with beneficiary details
        follow IRS schedules matched to the facts when supported; accounts without beneficiary details, and inherited
        workplace plans, use the simpler planning estimate. Planning illustration only, not tax or legal advice.
      </p>
      {schedules.map((account) => (
        <InheritedAccountSchedule details={account} startYear={startYear} adj={adj} key={account.accountId} />
      ))}
    </div>
  )
}

function InheritedAccountSchedule({
  details,
  startYear,
  adj,
}: {
  details: ReportInheritedScheduleAccount
  startYear: number
  adj: (year: number, v: number) => number
}) {
  const thisYear = details.years.find((row) => row.year === startYear) ?? details.years[0]
  return (
    <details className="ss-explainer" data-testid={`inherited-schedule-${details.accountId}`}>
      <summary>
        {details.accountName}: {details.regimeLabel}
      </summary>
      {details.isSuccessorScope ? (
        <p className="field-hint">
          After the beneficiary&apos;s death the account passes to a successor; successor schedules are not modeled and
          no amounts are forced.
        </p>
      ) : null}
      {details.isRefusal ? (
        <div className="callout callout--warn" role="status">
          <strong>Needs review</strong>
          <p>
            The model does not cover these facts, so it shows the limitation rather than guessing. The schedule below
            uses the simpler planning estimate.
          </p>
          {details.refusalReason ? (
            <>
              <p>
                The model does not cover these facts:{' '}
                {plainRefusalCause(details.refusalReason, details.refusalCode)}.
              </p>
              <details>
                <summary>Technical detail</summary>
                <p className="field-hint">{details.refusalReason}</p>
              </details>
            </>
          ) : null}
        </div>
      ) : null}
      {details.isLegacyApproximation && !details.isRefusal ? (
        <p className="field-hint">
          <strong>Planning estimate.</strong> Beneficiary details were not supplied (or the death was before 2020), so
          this account uses the simpler planning estimate rather than a fact-matched IRS schedule.
        </p>
      ) : null}
      {details.needsProfessionalConfirmation ? <ProfessionalConfirmationMarker /> : null}
      <ul>
        <li>
          <strong>Why this schedule</strong>: {details.regimeLabel}
          {details.classification === 'unsettled'
            ? '. This schedule follows a reading of rules that are not yet settled.'
            : '.'}
        </li>
        <li>
          <strong>Final deadline year</strong>: {inheritedDeadlineExplanation(details)}
        </li>
        {thisYear ? (
          <li>
            <strong>This year ({thisYear.year})</strong>: {thisYear.kindLabel}, required{' '}
            {fmtMoney(adj(thisYear.year, thisYear.requiredAmount))}, executed{' '}
            {fmtMoney(adj(thisYear.year, thisYear.executedRequiredAmount))}, voluntary{' '}
            {fmtMoney(adj(thisYear.year, thisYear.voluntaryAmount))}.
          </li>
        ) : null}
      </ul>
      {details.facts.length > 0 ? (
        <>
          <p>
            <strong>Facts used</strong>
          </p>
          <ul>
            {details.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </>
      ) : null}
      {details.notes.length > 0 ? (
        <>
          <p>
            <strong>Notes</strong>
          </p>
          <ul>
            {details.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}
      {details.citations.length > 0 ? (
        <>
          <p>
            <strong>Citations</strong>
          </p>
          <ul>
            {details.citations.map((citation) => {
              const href = citationHref(citation)
              return (
                <li key={citation}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {citation} ↗
                    </a>
                  ) : (
                    citation
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
      <ScrollRegion label="Roth conversion details" style={{ border: 'none', marginTop: '0.5rem' }}>
        <table className="year-table">
          <caption className="sr-only">Roth conversion details by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Kind</th>
              <th scope="col">Required</th>
              <th scope="col">Executed</th>
              <th scope="col">Voluntary</th>
            </tr>
          </thead>
          <tbody>
            {details.years.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{row.kindLabel}</td>
                <td>{fmtMoney(adj(row.year, row.requiredAmount))}</td>
                <td>{fmtMoney(adj(row.year, row.executedRequiredAmount))}</td>
                <td>{row.voluntaryAmount > 0.5 ? fmtMoney(adj(row.year, row.voluntaryAmount)) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </details>
  )
}

function DollarsToggle({ value, onChange }: { value: Dollars; onChange: (v: Dollars) => void }) {
  return (
    <div className="seg" role="group" aria-label="Dollar display">
      <button type="button" aria-pressed={value === 'today'} onClick={() => onChange('today')}>
        Today's $
      </button>
      <button type="button" aria-pressed={value === 'nominal'} onClick={() => onChange('nominal')}>
        Nominal $
      </button>
    </div>
  )
}

const tooltipProps = {
  formatter: (v: unknown) => fmtMoney(Number(v)),
  contentStyle: chartTooltipStyle,
  wrapperStyle: { zIndex: 2 },
} as const

// Stacked charts (6–8 series) hide ~$0 rows in the tooltip via content, never
// by nulling zeros in the data, see NonZeroTooltipContent.
const stackTooltipProps = { ...tooltipProps, content: NonZeroTooltipContent } as const

/**
 * The Tax-free gains room column's meaning, shared by the header tooltip and
 * the keyboard/touch explainer so the two cannot drift. The figure is the
 * engine's `taxFreeGainsRoom`: the extra long-term gain that raises the year's
 * federal income tax by $0.
 */
const TAX_FREE_GAINS_ROOM_TOOLTIP =
  "Extra long-term gains you could realize this year without raising this year's federal income tax. " +
  'Your remaining loss carryforward absorbs gains first. After that, gains count only while they add no ' +
  'federal tax: they stay in the 0% bracket and do not make more of your Social Security taxable, use up a ' +
  'loss deduction your other income was using, shrink a deduction, or reach the 3.8% net investment income ' +
  'tax or the AMT. State tax, the ACA premium credit, and Medicare premiums are not included. The figure is ' +
  'rounded down to the dollar.'

/** The per-year marker beside the gains room in a year with an ACA premium credit. */
const ACA_CREDIT_MARKER = '†'

const ACA_CREDIT_MARKER_TEXT =
  'This year has an ACA premium credit. Realizing gains this year can also shrink the credit; if it was paid ' +
  'in advance, the part you lose is paid back as federal tax when you file. The room does not include that.'

const ACA_CREDIT_MARKER_EXPLAINER =
  'marks a year with an ACA premium credit. Realizing gains that year can also shrink the credit; if it was ' +
  'paid in advance, the part you lose is paid back as federal tax when you file. The room does not include that.'

/**
 * The marker's text for one year. A credit priced on a year's published
 * Marketplace figures while that year's tax brackets are still projected
 * (engine support code income-tax-parameters-projected) says so.
 */
function acaCreditMarkerText(year: number, incomeTaxProjected: boolean): string {
  return incomeTaxProjected
    ? `${ACA_CREDIT_MARKER_TEXT} The ${year} credit uses the published ${year} Marketplace figures; your ${year} ` +
        `income uses projected ${year} tax brackets, because the ${year} brackets are not published yet.`
    : ACA_CREDIT_MARKER_TEXT
}


/**
 * The FIRE metrics + FI-target chart. Rendered as the leading card only for
 * households still accumulating with retirement 5+ years out; for everyone
 * else it lives behind a disclosure below the balances chart. The FI-date tile
 * is omitted (not "—") when FI is never reached, so a successful near-retiree
 * plan never wears a failure-flavored verdict on a question it didn't ask.
 */
function FireLens({
  view,
  plan,
  rows,
  dollarLabel,
}: {
  view: ReturnType<typeof useProjection>
  plan: Plan
  rows: ReadonlyArray<{ year: number; investable: number; fiTarget: number | null }>
  dollarLabel: string
}) {
  const fiFacts = fiTargetBasisFacts(view.summary, plan)
  return (
    <>
      <p className="card-hint">
        {/* With nobody retiring in the plan there is no target to reach, and
            the basis sentence says so on its own (the independent review's N3). */}
        {view.summary.fiNumber === null
          ? ''
          : view.summary.fiYear !== null
            ? `Based on your safe withdrawal rate assumption (${plan.assumptions.safeWithdrawalRatePct ?? 4}%), you reach FI in ${fiReachedPhrase(view.summary.fiYear, view.summary.fiAge, fiFacts)}. `
            : 'Your investable balance stays below the FI target through the plan horizon. '}
        {fiTargetBasisSentence(fiFacts)} Chart shown in {dollarLabel}.
      </p>
      <div className="metric-panel stat-grid">
        <div>
          <div className="stat-value stat-value--sm">{view.summary.fiNumber === null ? 'Not priced' : fmtMoney(view.summary.fiNumber)}</div>
          <div className="muted">FI target portfolio</div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{view.summary.coastFireNumber === null ? 'Not priced' : fmtMoney(view.summary.coastFireNumber)}</div>
          <div className="muted">
            {view.summary.coastFireNumber === null
              ? 'Coast-FIRE target (no retirement in the plan to grow into)'
              : coastFireHorizonYear(fiFacts) === null
                ? 'Coast-FIRE target (now)'
                : `Coast-FIRE target (now, growing into the FI target by ${coastFireHorizonYear(fiFacts)} with no further saving)`}
          </div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{view.summary.averagePreRetirementSavingsRatePct.toFixed(1)}%</div>
          <div className="muted">average savings rate</div>
        </div>
        {view.summary.fiYear !== null ? (
          <div>
            <div className="stat-value stat-value--sm">
              {view.summary.fiYear} (Age {view.summary.fiAge})
            </div>
            <div className="muted">{fiFacts.householdSize > 1 && fiFacts.personName !== null ? `FI date / ${fiFacts.personName}'s age` : 'FI date / age'}</div>
          </div>
        ) : null}
      </div>

      <div className="chart-frame" style={frameH(320)} role="figure">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={[...rows]}
            margin={{ left: 12, right: 8, top: 8 }}
            aria-label="Path to financial independence: investable portfolio vs. FI target, year by year"
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
            <Legend />
            <Line dataKey="investable" name="Investable Portfolio" stroke="var(--chart-1)" dot={false} strokeWidth={3} />
            <Line dataKey="fiTarget" name="FI Target Line" stroke="var(--bad)" strokeDasharray="4 4" dot={false} strokeWidth={2} />
            <Tooltip {...tooltipProps} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function YearByYearLedger({
  plan,
  years,
  adj,
  dollars,
  dollarLabel,
  hasLayeredSpending,
  hasAmt,
  hasCarryforward,
  figures: figuresProp,
}: {
  plan: Plan
  years: readonly YearResult[]
  adj: (year: number, v: number) => number
  dollars: Dollars
  dollarLabel: string
  hasLayeredSpending: boolean
  hasAmt: boolean
  hasCarryforward: boolean
  /**
   * The engine's display figures for `years`, one per row in the same order.
   * The page computes them once per projection (the gains room runs a search)
   * and hands them in; without them the table computes its own.
   */
  figures?: readonly YearDisplayFigures[]
}) {
  const figures = useMemo(
    () => figuresProp ?? projectionDisplayFigures(plan, { years: [...years] }),
    [figuresProp, plan, years],
  )
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAllFlowYear, setShowAllFlowYear] = useState<number | null>(null)
  const rawFlowYear = searchParams.get(FLOW_YEAR_PARAM)
  const rawFlowView = searchParams.get(FLOW_VIEW_PARAM)
  const flowYear = parseFlowYearParam(rawFlowYear, years)
  const parsedFlowView = parseFlowViewParam(rawFlowView)
  const flowView = parsedFlowView.view
  const showAll = flowYear !== null && showAllFlowYear === flowYear
  const selectedYear = flowYear === null ? undefined : years.find((y) => y.year === flowYear)
  const model = useMemo(
    () => (selectedYear === undefined ? null : buildYearCashFlowSankey(plan, selectedYear, { showAll })),
    [plan, selectedYear, showAll],
  )
  const invalidFlowYear = rawFlowYear !== null && flowYear === null
  const orphanFlowView = (rawFlowYear === null || rawFlowYear === '') && rawFlowView !== null
  const invalidFlowView = flowYear !== null && parsedFlowView.invalid
  const invalidFlowRedirect = invalidFlowYear || orphanFlowView
    ? (() => {
        const cleaned = stripFlowParams(searchParams)
        const search = cleaned.toString()
        return search ? `?${search}` : ''
      })()
    : invalidFlowView
      ? (() => {
          const next = new URLSearchParams(searchParams)
          next.set(FLOW_VIEW_PARAM, 'cash')
          const search = next.toString()
          return search ? `?${search}` : ''
        })()
      : null

  const openYear = useCallback(
    (year: number) => {
      setShowAllFlowYear(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(FLOW_YEAR_PARAM, String(year))
          next.set(FLOW_VIEW_PARAM, 'cash')
          return next
        },
        { replace: false },
      )
    },
    [setSearchParams],
  )

  const closeFlow = useCallback(() => {
    setShowAllFlowYear(null)
    setSearchParams((prev) => stripFlowParams(prev), { replace: true })
  }, [setSearchParams])

  const onViewChange = useCallback(
    (viewId: YearCashFlowSankeyViewId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(FLOW_VIEW_PARAM, sankeyToFlowView(viewId))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return (
    <>
      {invalidFlowRedirect !== null ? (
        <Navigate to={{ pathname: location.pathname, search: invalidFlowRedirect }} replace />
      ) : null}
      <ScrollRegion label="Year-by-year table">
        <table className="year-table">
          <caption className="sr-only">Year-by-year projection, one row per plan year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Age</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
              {hasLayeredSpending ? <th scope="col" title="Must-fund floor spending, including required lifestyle and system costs.">Required</th> : null}
              {hasLayeredSpending ? <th scope="col" title="Required plus target lifestyle spending before ideal/excess upside.">Target</th> : null}
              {hasLayeredSpending ? <th scope="col" title="Ideal and excess spending intended above target.">Upside</th> : null}
              <th scope="col">Contrib.</th>
              <th scope="col">Match</th>
              <th scope="col">RMD</th>
              <th scope="col">Conversion</th>
              <th scope="col">Withdrawals</th>
              <th scope="col">Tax</th>
              {hasAmt ? <th scope="col" title="Federal alternative minimum tax included in Tax.">AMT</th> : null}
              <th scope="col" title="Displayed in the active dollar mode. IRMAA and ACA threshold checks use the nominal dollars for each rule.">
                MAGI ({dollarLabel})
              </th>
              <th scope="col" title={TAX_FREE_GAINS_ROOM_TOOLTIP}>Tax-free gains room</th>
              {hasCarryforward ? <th scope="col" title="Capital-loss carryforward remaining at year end.">Loss carryf'd</th> : null}
              <th scope="col">Shortfall</th>
              {hasLayeredSpending ? <th scope="col" title="Required-floor shortfall / target-lifestyle shortfall / upside miss.">Layer miss</th> : null}
              {hasLayeredSpending ? <th scope="col" title="Guardrail action and flexible goal outcomes.">Guardrails</th> : null}
              <th scope="col">Investable</th>
              <th scope="col">Net worth</th>
              <th scope="col" className="year-table-flow">Flow</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y, index) => {
              const f = figures[index]!
              const room = f.taxFreeGainsRoom
              // Rounded down to the whole dollar in the page's dollars, so the
              // cell never shows more room than the engine computed.
              const roomShown = room === null ? null : Math.floor(adj(y.year, room))
              return (
              <tr key={y.year} className={y.shortfall > 0.005 ? 'row-depleted' : undefined}>
                <td className="year-table-year">{y.year}</td>
                <td>{y.people.map((p) => (p.alive ? p.ageAttained : '—')).join(' / ')}</td>
                <td>{fmtMoney(adj(y.year, y.incomes.total))}</td>
                <td>{fmtMoney(adj(y.year, y.expenses.total))}</td>
                {hasLayeredSpending ? <td>{fmtMoney(adj(y.year, y.expenses.requiredSpending))}</td> : null}
                {hasLayeredSpending ? <td>{fmtMoney(adj(y.year, y.expenses.targetSpending))}</td> : null}
                {hasLayeredSpending ? (
                  <td>{f.upsideSpending > 0.5 ? fmtMoney(adj(y.year, f.upsideSpending)) : ''}</td>
                ) : null}
                {/* Zero prints as $0, the convention the RMD / Conversion / Withdrawals
                    columns already follow; a blank read as missing data (#483). */}
                <td>{fmtMoney(adj(y.year, y.contributions))}</td>
                <td>{fmtMoney(adj(y.year, y.employerMatch))}</td>
                <td>{fmtMoney(adj(y.year, y.rmd))}</td>
                <td>{fmtMoney(adj(y.year, y.rothConversion))}</td>
                <td>{fmtMoney(adj(y.year, y.withdrawals.total))}</td>
                <td>{fmtMoney(adj(y.year, f.taxAndPenalties))}</td>
                {hasAmt ? <td>{y.amt > 0.5 ? fmtMoney(adj(y.year, y.amt)) : ''}</td> : null}
                <td>{fmtMoney(adj(y.year, y.magi))}</td>
                <td>
                  {roomShown !== null && roomShown >= 1 ? fmtMoney(roomShown) : ''}
                  {f.premiumTaxCreditYear ? (
                    <span
                      className="gains-room-aca-marker"
                      title={acaCreditMarkerText(y.year, f.premiumTaxCreditOnProjectedIncomeTax)}
                    >
                      <span aria-hidden="true">{ACA_CREDIT_MARKER}</span>
                      <span className="sr-only">
                        {acaCreditMarkerText(y.year, f.premiumTaxCreditOnProjectedIncomeTax)}
                      </span>
                    </span>
                  ) : null}
                </td>
                {hasCarryforward ? <td>{y.capitalLossCarryforwardRemaining > 0.5 ? fmtMoney(adj(y.year, y.capitalLossCarryforwardRemaining)) : '—'}</td> : null}
                <td>{fmtMoney(adj(y.year, y.shortfall))}</td>
                {hasLayeredSpending ? (
                  <td>
                    {y.requiredShortfall > 0.5 || y.targetShortfall > 0.5 || f.upsideShortfall > 0.5 ? (
                      <>
                        {y.requiredShortfall > 0.5 ? `Req ${fmtMoney(adj(y.year, y.requiredShortfall))} ` : ''}
                        {y.targetShortfall > 0.5 ? `Target ${fmtMoney(adj(y.year, y.targetShortfall))} ` : ''}
                        {f.upsideShortfall > 0.5 ? `Upside ${fmtMoney(adj(y.year, f.upsideShortfall))}` : ''}
                      </>
                    ) : (
                      ''
                    )}
                  </td>
                ) : null}
                {hasLayeredSpending ? (
                  <td>
                    {y.guardrailAction !== 'hold' ? y.guardrailAction : ''}
                    {[y.flexibleGoals.funded, y.flexibleGoals.partiallyFunded, y.flexibleGoals.deferred, y.flexibleGoals.skipped].some((count) => count > 0) ? (
                      <span
                        title={`Goals: ${y.flexibleGoals.funded} funded, ${y.flexibleGoals.partiallyFunded} partially funded, ${y.flexibleGoals.deferred} deferred, ${y.flexibleGoals.skipped} skipped`}
                        aria-label={`Goals: ${y.flexibleGoals.funded} funded, ${y.flexibleGoals.partiallyFunded} partially funded, ${y.flexibleGoals.deferred} deferred, ${y.flexibleGoals.skipped} skipped`}
                      >
                        {y.guardrailAction !== 'hold' ? ' · ' : ''}
                        {y.flexibleGoals.funded}F/{y.flexibleGoals.partiallyFunded}P/{y.flexibleGoals.deferred}D/{y.flexibleGoals.skipped}S
                      </span>
                    ) : null}
                  </td>
                ) : null}
                <td>{fmtMoney(adj(y.year, y.investableTotal))}</td>
                <td>{fmtMoney(adj(y.year, y.netWorth))}</td>
                <td className="year-table-flow">
                  <button
                    type="button"
                    className="btn-ghost btn-small"
                    aria-label={`View cash flow for ${y.year}`}
                    onClick={() => openYear(y.year)}
                  >
                    View flow
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollRegion>
      {selectedYear !== undefined && model !== null ? (
        <YearCashFlowDialog
          model={model}
          displayAmount={adj}
          dollarMode={dollars}
          onClose={closeFlow}
          year={selectedYear.year}
          viewId={flowViewToSankey(flowView)}
          onViewChange={onViewChange}
          onShowAll={() => {
            if (flowYear !== null) setShowAllFlowYear(flowYear)
          }}
        />
      ) : null}
    </>
  )
}

export function ResultsPage() {
  const { plan } = usePlan()
  const reportBranding = useReportBranding()
  const view = useProjection(plan, { captureAnnualCashFlow: true })
  const [dollars, setDollars] = useState<Dollars>('today')
  const dollarLabel = dollars === 'today' ? 'today\'s $' : 'nominal $'
  // The page's dollar adjuster, on the projection's own published inflation
  // factors (the engine's dollar basis); also the cash-flow dialog's
  // displayAmount, so the Sankey and the table can never disagree.
  const adj = useMemo(
    () => (year: number, v: number) => nominalForDisplay(view.basis, dollars, year, v),
    [dollars, view],
  )
  // The engine's per-year display figures, once per projection: the table's
  // Tax, Upside, Tax-free gains room and Layer miss cells read these, and the
  // gains room runs a search, so it is never recomputed on a dollar toggle.
  const figures = useMemo(() => projectionDisplayFigures(plan, view.result), [plan, view])

  const hasCarryforward = hasCapitalLossCarryforward(
    plan.household.capitalLossCarryforward,
    view.result.years,
  )
  const hasAmt = view.result.years.some((y) => y.amt > 0.5)
  const hasFlexibleGoalControls = plan.expenses.oneTimeGoals.some(
    (g) =>
      g.classification !== undefined ||
      g.flexibility !== undefined ||
      g.earliestYear !== undefined ||
      g.latestYear !== undefined ||
      g.priority !== undefined ||
      g.allowPartialFunding === true ||
      g.minFundingPct !== undefined,
  )
  const hasLayeredSpending =
    plan.expenses.requiredAnnual !== undefined ||
    (plan.expenses.idealAnnual ?? 0) > 0 ||
    (plan.expenses.excessAnnual ?? 0) > 0 ||
    (plan.expenses.spendingPolicy !== undefined && plan.expenses.spendingPolicy.mode !== 'fixedTarget') ||
    hasFlexibleGoalControls
  const carryforwardHighlight = capitalLossCarryforwardHighlight(
    plan.household.capitalLossCarryforward,
    view.result.years,
  )
  // The risk-based thresholds in today's dollars, as the engine publishes them
  // on the base the ledger acts on (null unless the policy is risk-based).
  const riskThresholds = guardrailThresholdDollars(plan)

  const rows = useMemo(() => buildResultsRows(view, plan, dollars), [view, plan, dollars])
  const incomeRows = useMemo(() => buildIncomeRows(view, dollars), [view, dollars])
  const expenseRows = useMemo(() => buildExpenseRows(view, dollars), [view, dollars])
  const showUnassignedCash = hasUnassignedCash(view.result.years)
  const hasAcaCreditYears = figures.some((f) => f.premiumTaxCreditYear)
  const projectedIncomeTaxCreditYears = figures
    .filter((f) => f.premiumTaxCreditOnProjectedIncomeTax)
    .map((f) => f.year)

  const handleCsv = () => {
    downloadCsv(buildLedgerCsv(plan, view), `${plan.name.replace(/\W+/g, '-').toLowerCase()}-ledger.csv`)
  }

  const handleHtmlReport = () => {
    downloadStandaloneReport({
      plan,
      result: view.result,
      summary: view.summary,
      startYear: view.startYear,
      branding: reportBranding,
    })
  }

  // How long the money lasts, as the engine publishes it: the last funded
  // year L, the first short year D, and the N = E - L years short of the end.
  const lasts = moneyLasts(view.result)
  const depletionYear = lasts.depletionYear
  const endYear = view.result.endYear
  const planStartYear = view.result.startYear
  // A projection whose horizon ended before it started has no rows, so no
  // factor for its end year; say nothing in today's dollars then.
  const endingToday =
    view.result.years.length > 0 ? toTodayDollars(view.basis, endYear, view.result.endingNetWorth) : null
  // Same debounced, plan-keyed run the KPI bar uses (shared in-flight, so this
  // never adds a second simulation) — the verdict must speak with both of the
  // engine's voices, not just the steady-markets ledger.
  // The verdict quotes the same run and path count as the KPI bar (#497).
  const { rate: mcRate, pathCount: mcPathCount } = useMcSuccessRateState(plan, !isPlanIncomplete(plan))
  const pathCountLabel = mcPathCount.toLocaleString()
  // The first full year after depletion shows what the ledger already knows:
  // guaranteed income keeps flowing, and the uncovered gap is the engine's own
  // shortfall figure — no recomputation here. When depletion lands in the
  // final plan year there is no later year, so that year carries the floor.
  const floorYear =
    depletionYear !== null
      ? (view.result.years.find((y) => y.year > depletionYear) ??
        view.result.years.find((y) => y.year === depletionYear))
      : undefined
  // The FIRE lens leads only for households genuinely accumulating: wages in
  // the projection AND retirement 5+ years out. For everyone else (retirees,
  // near-retirees whose plan may succeed while "FI date: —" reads as failure)
  // it stays available behind a disclosure below the balances chart, so it
  // never takes the top spot or contradicts the verdict.
  const isAccumulating = view.result.years.some((y) => y.incomes.wages > 0)
  const yearsToLastRetirement = Math.max(
    0,
    ...plan.household.people.map((p) =>
      // No set retirement age = working indefinitely = still accumulating.
      p.retirementAge === null ? Number.POSITIVE_INFINITY : Number(p.dob.slice(0, 4)) + p.retirementAge - view.startYear,
    ),
  )
  const fireLeads = isAccumulating && yearsToLastRetirement >= 5

  return (
    <section>
      {!isPlanIncomplete(plan) ? (
        <div className="results-verdict">
          <h2>
            {depletionYear !== null
              ? `This plan runs out of money in ${depletionYear}.`
              : `Your money lasts the full plan, through ${endYear}.`}
          </h2>
          <p className="muted">
            {depletionYear !== null ? (
              <>
                {lasts.lastFundedYear < planStartYear
                  ? `The plan is short of money from its first year, ${planStartYear}.`
                  : `Money lasts through ${lasts.lastFundedYear}, ${lasts.yearsShortOfPlanEnd} year${lasts.yearsShortOfPlanEnd === 1 ? '' : 's'} short of the plan's end in ${endYear}.`}
                {floorYear !== undefined && floorYear.incomes.total > 0.5 ? (
                  <>
                    {' '}
                    Income doesn't stop: about{' '}
                    {fmtMoneyCompact(toTodayDollars(view.basis, floorYear.year, floorYear.incomes.total))}
                    /yr (today's dollars) of Social Security, pensions, and other income keeps arriving
                    {floorYear.shortfall > 0.5 ? (
                      <>
                        , leaving an uncovered spending gap of about{' '}
                        {fmtMoneyCompact(toTodayDollars(view.basis, floorYear.year, floorYear.shortfall))}/yr
                      </>
                    ) : null}
                    .
                  </>
                ) : null}
                {mcRate !== null ? (
                  <>
                    {' '}
                    Across {pathCountLabel} varied markets, this plan succeeds {Math.round(mcRate * 100)}% of the
                    time, <Link to={`/plan/${plan.id}/monte-carlo`}>see Monte Carlo</Link>.
                  </>
                ) : null}{' '}
                <Link to={`/plan/${plan.id}/insights`}>See what would change this →</Link>
              </>
            ) : (
              <>
                In steady markets, ending net worth is {fmtMoneyCompact(view.result.endingNetWorth)}
                {endingToday !== null ? <> ({fmtMoneyCompact(endingToday)} in today's dollars)</> : null}.
                {mcRate !== null ? (
                  <>
                    {' '}
                    Across {pathCountLabel} varied markets, this plan succeeds {Math.round(mcRate * 100)}% of the
                    time, <Link to={`/plan/${plan.id}/monte-carlo`}>see Monte Carlo</Link>.
                  </>
                ) : null}{' '}
                The charts below are the evidence behind this verdict.
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="results-toolbar">
        <DollarsToggle value={dollars} onChange={setDollars} />
        <button type="button" className="btn btn-secondary btn-small" onClick={handleCsv}>
          Download CSV
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={handleHtmlReport}>
          Download HTML report
        </button>
        <Link to={`/plan/${plan.id}/report`} className="btn btn-secondary btn-small">
          View printable report
        </Link>
        <Link to={`/plan/${plan.id}/assumptions-card`} className="btn btn-secondary btn-small">
          View assumptions card
        </Link>
        <CopyButton
          label="Copy plan for your AI"
          copiedLabel="Plan copied ✓"
          fallbackLabel="Your plan, as JSON"
          // The projection's own start year, not a freshly computed one, the
          // payload must reproduce the numbers on this page, and a reader that
          // defaults the year would drift from them every January.
          text={() => serializeSinglePlan(plan, view.startYear)}
        />
      </div>

      <p className="results-privacy field-hint">
        <strong>Copy plan for your AI</strong> puts this plan on your clipboard as JSON. Paste it into any assistant
        and ask it about your plan. It is your whole plan in the clear: balances, ages, income, spending. Nothing
        leaves this device when you copy, but whatever you paste it into sees all of it, under your own account and
        that provider's terms.
      </p>

      <p className="results-jump">
        <a href="#year-table">Jump to the year-by-year table ↓</a>
      </p>

      {view.result.warnings.length > 0 ? (
        <div className="callout callout--warn">
          <strong>Modeling notes</strong>
          <ul>
            {view.result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.expenses.spendingPolicy?.mode === 'riskBasedGuardrails' && riskThresholds !== null ? (
        <div className="callout callout--info">
          <strong>Risk-based spending guardrails</strong>
          {riskThresholds.status === 'anchored' ? (
            <p>
              Solved for the {plan.expenses.spendingPolicy.targetSuccessLowerPct ?? 70}–
              {plan.expenses.spendingPolicy.targetSuccessUpperPct ?? 95}% success band (today's dollars):{' '}
              {riskThresholds.lower !== null ? (
                <>
                  if the portfolio falls below <strong>{fmtMoney(riskThresholds.lower)}</strong>, flexible spending is
                  trimmed in {plan.expenses.spendingPolicy.adjustmentPct ?? 10}% steps
                </>
              ) : (
                <>no cut threshold was solved for this band (see Spending for why)</>
              )}
              {'; '}
              {riskThresholds.upper !== null ? (
                <>
                  above <strong>{fmtMoney(riskThresholds.upper)}</strong>, spending can be restored or raised
                </>
              ) : (
                <>no raise threshold was solved for this band</>
              )}
              . The required floor is never cut.{' '}
              {riskThresholds.acts
                ? 'Watch the “Guardrails” column below for the years the rule acted.'
                : 'The cut threshold is not below the raise threshold, so the rule holds spending every year; re-solve the thresholds on Spending.'}
            </p>
          ) : riskThresholds.status === 'no-starting-portfolio' ? (
            <p>
              Solved for the {plan.expenses.spendingPolicy.targetSuccessLowerPct ?? 70}–
              {plan.expenses.spendingPolicy.targetSuccessUpperPct ?? 95}% success band:{' '}
              {riskThresholds.lowerPct !== null ? `cut below ${riskThresholds.lowerPct}%` : 'no cut threshold'} and{' '}
              {riskThresholds.upperPct !== null ? `raise above ${riskThresholds.upperPct}%` : 'no raise threshold'} of the
              portfolio. This plan has no investable balance today, so in this projection those percents apply to the
              portfolio in the first year the projection gives it a balance, and there is no dollar figure to show.
              Re-solve them on Spending after adding balances.
            </p>
          ) : (
            <p>
              The dollar thresholds for your success band have not been solved yet, so this policy currently holds
              spending steady. Solve them on the Spending screen to activate adjustments.
            </p>
          )}
        </div>
      ) : null}

      {carryforwardHighlight ? (
        <div className="callout callout--info">
          <strong>Capital loss carryforward</strong>
          <p>
            Starting balance {fmtMoney(plan.household.capitalLossCarryforward)}. In {carryforwardHighlight.year} it offset{' '}
            {fmtMoney(adj(carryforwardHighlight.year, carryforwardHighlight.capitalLossUsedAgainstGains))} of realized
            gains and {fmtMoney(adj(carryforwardHighlight.year, carryforwardHighlight.capitalLossUsedAgainstOrdinary))} of
            ordinary income;{' '}
            {fmtMoney(adj(carryforwardHighlight.year, carryforwardHighlight.capitalLossCarryforwardRemaining))} carries
            forward. It nets against realized gains first, then up to $3,000/yr against ordinary income. Watch it deplete
            in the “Loss carryf'd” column below.
          </p>
        </div>
      ) : null}

      {fireLeads ? (
        <div className="chart-card">
          <h2>Path to Financial Independence (FIRE)</h2>
          <FireLens view={view} plan={plan} rows={rows} dollarLabel={dollarLabel} />
        </div>
      ) : null}

      <div className="chart-card">
        <h2>Investable balances by account type</h2>
        <p className="card-hint">
          End-of-year balances, shown in {dollarLabel}.
          {showUnassignedCash ? (
            <>
              {' '}
              The top band, {UNASSIGNED_CASH_LABEL}, is surplus cash the plan had no cash or taxable account to hold.
              It still counts toward your investable total.
            </>
          ) : null}
          {view.summary.depletionYear !== null ? (
            <>
              {' '}
              Portfolio depletes in {view.summary.depletionYear}. <Link to={`/plan/${plan.id}/insights`}>See what would change this →</Link>
            </>
          ) : null}
        </p>
        <div className="chart-frame" style={frameH(320)} role="figure">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ left: 12, right: 8, top: 8 }}
              aria-label="Investable balances by account type, year by year"
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              {ACCOUNT_CATEGORIES.map((c) => (
                <Area key={c} dataKey={c} stackId="bal" name={ACCOUNT_CATEGORY_LABEL[c]} stroke={ACCOUNT_CATEGORY_COLOR[c]} fill={ACCOUNT_CATEGORY_COLOR[c]} fillOpacity={0.55} />
              ))}
              {showUnassignedCash ? (
                <Area key={UNASSIGNED_CASH_KEY} dataKey={UNASSIGNED_CASH_KEY} stackId="bal" name={UNASSIGNED_CASH_LABEL} stroke={UNASSIGNED_CASH_COLOR} fill={UNASSIGNED_CASH_COLOR} fillOpacity={0.55} />
              ) : null}
              {view.summary.depletionYear !== null ? (
                <ReferenceLine x={view.summary.depletionYear} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: 'depleted', fill: 'var(--bad)', fontSize: 12 }} />
              ) : null}
              <Tooltip {...stackTooltipProps} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <BucketLensCard result={view.result} adj={adj} />

      {!fireLeads ? (
        <details className="ss-explainer">
          <summary>Path to Financial Independence (FIRE): an optional lens</summary>
          <p className="field-hint">
            FI metrics matter most while accumulating; for plans at or near retirement they are shown here for
            reference, not as a verdict.
          </p>
          <FireLens view={view} plan={plan} rows={rows} dollarLabel={dollarLabel} />
        </details>
      ) : null}

      <div className="chart-card">
        <h2>Income vs. spending</h2>
        <p className="card-hint">
          Spending includes taxes and penalties; the gap is funded by withdrawals. Shown in {dollarLabel}.
        </p>
        <div className="chart-frame" style={frameH(280)} role="figure">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: 12, right: 8, top: 8 }} aria-label="Income vs. spending, year by year">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              {/* Income is green (chart-3), spending gold: money in reads as green. */}
              <Bar dataKey="income" name="Income" fill="var(--chart-3)" />
              <Bar dataKey="spending" name="Spending + tax" fill="var(--chart-1)" />
              <Tooltip {...tooltipProps} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h2>Income by source</h2>
        <p className="card-hint">
          Gross income streams each year, shown in {dollarLabel}. Any shortfall below spending is funded by portfolio
          withdrawals.
        </p>
        <div className="chart-frame" style={frameH(280)} role="figure">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeRows} margin={{ left: 12, right: 8, top: 8 }} aria-label="Income by source, year by year">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              {INCOME_SOURCES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="inc" name={s.label} fill={s.color} />
              ))}
              <Tooltip {...stackTooltipProps} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <FundedRatioCard />

      <div className="chart-card">
        <h2>Spending by category</h2>
        <p className="card-hint">
          The big line items behind the Expenses column (taxes and penalties included), shown in {dollarLabel}. Mortgage
          principal &amp; interest is "Debt payments"; property tax &amp; insurance are their own band; everything else
          lives in "Baseline living."
        </p>
        <div className="chart-frame" style={frameH(280)} role="figure">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={expenseRows}
              margin={{ left: 12, right: 8, top: 8 }}
              aria-label="Spending by category, year by year"
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              {EXPENSE_CATEGORIES.map((c) => (
                <Bar key={c.key} dataKey={c.key} stackId="exp" name={c.label} fill={c.color} />
              ))}
              <Tooltip {...stackTooltipProps} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h2>Tax and MAGI ({dollarLabel})</h2>
        <p className="card-hint">
          Modified adjusted gross income (MAGI) sets Medicare's income surcharge (IRMAA, which looks back two years)
          and the marketplace health-insurance credit (ACA) before 65. Threshold checks always use each year's nominal
          dollars.
        </p>
        <div className="chart-frame" style={frameH(280)} role="figure">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 12, right: 8, top: 8 }} aria-label="Tax and MAGI, year by year">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              <Line dataKey="tax" name="Tax" stroke="var(--chart-4)" dot={false} strokeWidth={2} />
              <Line dataKey="magi" name="MAGI" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
              <Tooltip {...tooltipProps} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details open id="year-table">
        {/* The h2 inside the summary keeps this reachable by heading navigation
            (screen readers, heading-jump extensions). A bare summary is not. */}
        <summary className="year-table-summary">
          <h2>Year-by-year detail</h2>
        </summary>
        <YearByYearLedger
          plan={plan}
          years={view.result.years}
          adj={adj}
          dollars={dollars}
          dollarLabel={dollarLabel}
          hasLayeredSpending={hasLayeredSpending}
          hasAmt={hasAmt}
          hasCarryforward={hasCarryforward}
          figures={figures}
        />
        {/* Column semantics used to live only in title= tooltips — invisible on
            touch and unreliable for screen readers. This legend is the
            keyboard/touch-reachable copy of the same explanations. */}
        <details className="ss-explainer">
          <summary>What the columns mean</summary>
          <ul>
            <li>
              <strong>Age</strong>: one entry per person (e.g. "67 / 64"). A person shows "—" after their modeled
              death; income and spending reflect the survivor from that year on.
            </li>
            {hasLayeredSpending ? (
              <>
                <li>
                  <strong>Required</strong>: must-fund floor spending, including required lifestyle and system costs.
                </li>
                <li>
                  <strong>Target</strong>: required plus target lifestyle spending before ideal/excess upside.
                </li>
                <li>
                  <strong>Upside</strong>: ideal and excess spending intended above target.
                </li>
              </>
            ) : null}
            {hasAmt ? (
              <li>
                <strong>AMT</strong>: federal alternative minimum tax, included in Tax.
              </li>
            ) : null}
            <li>
              <strong>MAGI</strong>: modified adjusted gross income, displayed in the active dollar mode; IRMAA and
              ACA threshold checks always use each year's nominal dollars.
            </li>
            <li>
              <strong>Tax-free gains room</strong>: {TAX_FREE_GAINS_ROOM_TOOLTIP} The room left in the 0% long-term
              bracket can be larger than this figure, because gains in that bracket can still raise tax in the ways
              above; this column is the room at no extra federal tax.
            </li>
            {hasAcaCreditYears ? (
              <li>
                <strong>{ACA_CREDIT_MARKER}</strong> beside the gains room {ACA_CREDIT_MARKER_EXPLAINER}
                {projectedIncomeTaxCreditYears.length > 0
                  ? ` In ${formatYearList(projectedIncomeTaxCreditYears)} the credit uses that year's published ` +
                    'Marketplace figures, while the income it is measured on uses projected tax brackets.'
                  : ''}
              </li>
            ) : null}
            {hasCarryforward ? (
              <li>
                <strong>Loss carryf&apos;d</strong>: capital-loss carryforward remaining at year end.
              </li>
            ) : null}
            {hasLayeredSpending ? (
              <>
                <li>
                  <strong>Layer miss</strong>: required-floor shortfall / target-lifestyle shortfall / upside miss.
                </li>
                <li>
                  <strong>Guardrails</strong>: the guardrail action taken that year (cut / raise), and flexible goal
                  outcomes as counts: <strong>F</strong>unded / <strong>P</strong>artial / <strong>D</strong>eferred /{' '}
                  <strong>S</strong>kipped (e.g. “1F/0P/2D/1S”).
                </li>
              </>
            ) : null}
          </ul>
        </details>
      </details>

      <InheritedSchedulesSection
        plan={plan}
        years={view.result.years}
        startYear={view.startYear}
        adj={adj}
      />

      <p className="field-hint">
        Every figure above comes from the single year-by-year ledger in this table, the same ledger Monte Carlo and
        the optimizer price against. <Link to={`/plan/${plan.id}/assumptions-card`}>See the assumptions behind it</Link>{' '}
        · <Link to="/how-tested">How RetireGolden is tested</Link>
      </p>

      <LearnAboutScreen route="/plan/:planId/results" />
    </section>
  )
}

