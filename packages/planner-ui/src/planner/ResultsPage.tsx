/**
 * Deterministic results: net worth by account category, income vs spending,
 * tax detail, modeling warnings, and the full year-by-year drill-down table
 * with a nominal / today's-dollars toggle and CSV export.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { startingInvestableOf } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import { DEFAULT_PATH_COUNT } from '../mc/pool'
import type { YearResult } from '@retiregolden/engine/projection/types'
import { usePlan } from './planContextCore'
import { isPlanIncomplete } from './planCompleteness'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { downloadStandaloneReport } from '../report/downloadReport'
import { fmtMoney, fmtMoneyCompact } from './format'
import { useProjection } from './useProjection'
import { BucketLensCard } from './BucketLensCard'
import { FundedRatioCard } from './sections/IncomeFloorSection'
import { chartTooltipStyle } from './chartStyle'
import { frameH } from './chartFrame'
import { useMcSuccessRate } from './useMcSuccessRate'

type Dollars = 'nominal' | 'today'

const CATEGORIES = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const
const CAT_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  cash: 'Cash',
  taxable: 'Taxable',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
}
const CAT_COLOR: Record<(typeof CATEGORIES)[number], string> = {
  cash: 'var(--chart-5)',
  taxable: 'var(--chart-2)',
  equityComp: 'var(--chart-6)',
  traditional: 'var(--chart-3)',
  roth: 'var(--chart-1)',
  hsa: 'var(--chart-4)',
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

function categoryBalances(plan: Plan, y: YearResult): Record<(typeof CATEGORIES)[number], number> {
  const out = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
  for (const a of plan.accounts) {
    if ((CATEGORIES as readonly string[]).includes(a.type)) {
      out[a.type as (typeof CATEGORIES)[number]] += y.balances[a.id] ?? 0
    }
  }
  return out
}

function moneyTick(v: number): string {
  return fmtMoneyCompact(v)
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

/** "1,000" — keeps verdict copy in sync if the default path count changes. */
const PATH_COUNT_LABEL = DEFAULT_PATH_COUNT.toLocaleString()

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
  rows: ReadonlyArray<{ year: number; investable: number; fiTarget: number }>
  dollarLabel: string
}) {
  return (
    <>
      <p className="card-hint">
        {view.summary.fiYear !== null
          ? `Based on your safe withdrawal rate assumption (${plan.assumptions.safeWithdrawalRatePct ?? 4}%), you reach FI in ${view.summary.fiYear} (age ${view.summary.fiAge}).`
          : 'Your investable balance stays below the FI target through the plan horizon.'}{' '}
        Chart shown in {dollarLabel}.
      </p>
      <div className="metric-panel stat-grid">
        <div>
          <div className="stat-value stat-value--sm">{fmtMoney(view.summary.fiNumber)}</div>
          <div className="muted">FI target portfolio</div>
        </div>
        <div>
          <div className="stat-value stat-value--sm">{fmtMoney(view.summary.coastFireNumber)}</div>
          <div className="muted">Coast-FIRE target (now)</div>
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
            <div className="muted">FI date / age</div>
          </div>
        ) : null}
      </div>

      <div className="chart-frame" style={frameH(320)}>
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

export function ResultsPage() {
  const { plan } = usePlan()
  const view = useProjection(plan)
  const [dollars, setDollars] = useState<Dollars>('today')
  const dollarLabel = dollars === 'today' ? 'today\'s $' : 'nominal $'
  const adj = useMemo(
    () => (year: number, v: number) => (dollars === 'today' ? view.deflate(year, v) : v),
    [dollars, view],
  )

  const hasCarryforward = plan.household.capitalLossCarryforward > 0
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
  // Highlight the first year the carryforward shelters realized gains (the early
  // brokerage-drawdown years it's meant for), else the first projection year.
  const carryforwardHighlight = hasCarryforward
    ? (view.result.years.find((y) => y.capitalLossUsedAgainstGains > 0.5) ?? view.result.years[0])
    : undefined

  const rows = useMemo(
    () =>
      view.result.years.map((y) => {
        const cats = categoryBalances(plan, y)
        const nominalFiTarget = view.summary.fiNumber * Math.pow(1 + plan.assumptions.inflationPct / 100, y.year - view.startYear)
        return {
          year: y.year,
          // Zero balances render as null so empty categories stay out of the
          // tooltip (an "HSA: $0" row is noise in a six-series stack).
          ...Object.fromEntries(
            CATEGORIES.map((c) => {
              const v = adj(y.year, cats[c])
              return [c, v > 0.5 ? v : null]
            }),
          ),
          income: adj(y.year, y.incomes.total),
          spending: adj(y.year, y.expenses.total + y.tax + y.penalties),
          tax: adj(y.year, y.tax),
          magi: adj(y.year, y.magi),
          shortfall: adj(y.year, y.shortfall),
          investable: adj(y.year, y.investableTotal),
          fiTarget: adj(y.year, nominalFiTarget),
        }
      }),
    [view, plan, adj],
  )

  // Zero series values render as null so the tooltip (filterNull) skips them —
  // a stack of 6–8 series otherwise lists every "$0" row as noise.
  const orNull = (v: number) => (v > 0.5 ? v : null)

  const incomeRows = useMemo(
    () =>
      view.result.years.map((y) => ({
        year: y.year,
        wages: orNull(adj(y.year, y.incomes.wages)),
        socialSecurity: orNull(adj(y.year, y.incomes.socialSecurity)),
        pension: orNull(adj(y.year, y.incomes.pension)),
        annuity: orNull(adj(y.year, y.incomes.annuity)),
        tipsLadder: orNull(adj(y.year, y.incomes.tipsLadder)),
        recurring: orNull(adj(y.year, y.incomes.recurring)),
        oneTime: orNull(adj(y.year, y.incomes.oneTime)),
        taxableYield: orNull(adj(y.year, y.incomes.taxableYield)),
      })),
    [view, adj],
  )

  const expenseRows = useMemo(
    () =>
      view.result.years.map((y) => ({
        year: y.year,
        base: orNull(adj(y.year, y.expenses.baseSpending)),
        healthcare: orNull(adj(y.year, y.expenses.healthcare)),
        property: orNull(adj(y.year, y.expenses.propertyCosts)),
        debt: orNull(adj(y.year, y.expenses.debtService)),
        insurance: orNull(adj(y.year, y.expenses.insurancePremiums)),
        care: orNull(adj(y.year, Math.max(0, y.expenses.careCost - y.expenses.ltcBenefit))),
        goals: orNull(adj(y.year, y.expenses.oneTimeGoals)),
        taxes: orNull(adj(y.year, y.tax + y.penalties)),
      })),
    [view, adj],
  )

  const handleCsv = () => {
    const cols = [
      'year', 'filingStatus', 'wages', 'socialSecurity', 'pension', 'annuity', 'tipsLadder', 'recurring', 'oneTimeIncome', 'taxableInterest', 'ordinaryDividends', 'qualifiedDividends', 'taxableYield', 'totalIncome',
      'baseSpending', 'goals', 'debtService', 'propertyCosts', 'healthcare', 'insurancePremiums', 'careCost', 'ltcBenefit', 'requiredSpending', 'targetSpending', 'idealSpending', 'excessSpending', 'intendedSpending', 'totalExpenses', 'contributions', 'employerMatch', 'rmd', 'qcd',
      'rothConversion', 'tax', 'amt', 'penalties', 'magi', 'withdrawals', 'realizedGains', 'lossCarryforwardUsed', 'lossCarryforwardRemaining', 'shortfall', 'investable',
      'requiredShortfall', 'targetShortfall', 'idealShortfall', 'excessShortfall', 'guardrailAction', 'guardrailFactor', 'flexibleGoalsFunded', 'flexibleGoalsPartiallyFunded', 'flexibleGoalsDeferred', 'flexibleGoalsSkipped', 'flexibleGoalFundedAmount', 'flexibleGoalUnfundedAmount', 'insuranceCashValue', 'ladderValue', 'deathBenefit', 'netWorth',
    ]
    const lines = [cols.join(',')]
    for (const y of view.result.years) {
      lines.push(
        [
          y.year, y.filingStatus, y.incomes.wages, y.incomes.socialSecurity, y.incomes.pension, y.incomes.annuity, y.incomes.tipsLadder, y.incomes.recurring,
          y.incomes.oneTime, y.incomes.taxableInterest, y.incomes.ordinaryDividends, y.incomes.qualifiedDividends, y.incomes.taxableYield, y.incomes.total, y.expenses.baseSpending, y.expenses.oneTimeGoals, y.expenses.debtService,
          y.expenses.propertyCosts, y.expenses.healthcare, y.expenses.insurancePremiums, y.expenses.careCost, y.expenses.ltcBenefit, y.expenses.requiredSpending, y.expenses.targetSpending, y.expenses.idealSpending, y.expenses.excessSpending, y.expenses.intendedSpending, y.expenses.total, y.contributions, y.employerMatch, y.rmd, y.qcd, y.rothConversion, y.tax, y.amt, y.penalties,
          y.magi, y.withdrawals.total, y.realizedGains, y.capitalLossUsedAgainstGains + y.capitalLossUsedAgainstOrdinary, y.capitalLossCarryforwardRemaining, y.shortfall, y.investableTotal,
          y.requiredShortfall, y.targetShortfall, y.idealShortfall, y.excessShortfall, y.guardrailAction, y.expenses.guardrailFactor.toFixed(2), y.flexibleGoals.funded, y.flexibleGoals.partiallyFunded, y.flexibleGoals.deferred, y.flexibleGoals.skipped, y.flexibleGoals.fundedAmount, y.flexibleGoals.unfundedAmount, y.insuranceCashValue, y.ladderValue, y.deathBenefit, y.netWorth,
        ]
          .map((v) => (typeof v === 'number' ? Math.round(v) : v))
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${plan.name.replace(/\W+/g, '-').toLowerCase()}-ledger.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleHtmlReport = () => {
    downloadStandaloneReport({
      plan,
      result: view.result,
      summary: view.summary,
      startYear: view.startYear,
    })
  }

  const depletionYear = view.summary.depletionYear
  const endYear = view.result.endYear
  const endingToday = view.deflate(endYear, view.result.endingNetWorth)
  // Same debounced, plan-keyed run the KPI bar uses (shared in-flight, so this
  // never adds a second simulation) — the verdict must speak with both of the
  // engine's voices, not just the steady-markets ledger.
  const mcRate = useMcSuccessRate(plan, !isPlanIncomplete(plan))
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
              : `Your money lasts the full plan — through ${endYear}.`}
          </h2>
          <p className="muted">
            {depletionYear !== null ? (
              <>
                The portfolio depletes {endYear - depletionYear} year{endYear - depletionYear === 1 ? '' : 's'} before
                the end of the plan.
                {floorYear !== undefined && floorYear.incomes.total > 0.5 ? (
                  <>
                    {' '}
                    Income doesn't stop: about {fmtMoneyCompact(view.deflate(floorYear.year, floorYear.incomes.total))}
                    /yr (today's dollars) of Social Security, pensions, and other income keeps arriving
                    {floorYear.shortfall > 0.5 ? (
                      <>
                        , leaving an uncovered spending gap of about{' '}
                        {fmtMoneyCompact(view.deflate(floorYear.year, floorYear.shortfall))}/yr
                      </>
                    ) : null}
                    .
                  </>
                ) : null}
                {mcRate !== null ? (
                  <>
                    {' '}
                    Across {PATH_COUNT_LABEL} varied markets, this plan succeeds {Math.round(mcRate * 100)}% of the
                    time — <Link to={`/plan/${plan.id}/monte-carlo`}>see Monte Carlo</Link>.
                  </>
                ) : null}{' '}
                <Link to={`/plan/${plan.id}/insights`}>See what would change this →</Link>
              </>
            ) : (
              <>
                In steady markets, ending net worth is {fmtMoneyCompact(view.result.endingNetWorth)} (
                {fmtMoneyCompact(endingToday)} in today's dollars).
                {mcRate !== null ? (
                  <>
                    {' '}
                    Across {PATH_COUNT_LABEL} varied markets, this plan succeeds {Math.round(mcRate * 100)}% of the
                    time — <Link to={`/plan/${plan.id}/monte-carlo`}>see Monte Carlo</Link>.
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
      </div>

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

      {plan.expenses.spendingPolicy?.mode === 'riskBasedGuardrails' ? (
        <div className="callout callout--info">
          <strong>Risk-based spending guardrails</strong>
          {plan.expenses.spendingPolicy.lowerBalanceThresholdPct !== undefined ||
          plan.expenses.spendingPolicy.upperBalanceThresholdPct !== undefined ? (
            <p>
              Solved for the {plan.expenses.spendingPolicy.targetSuccessLowerPct ?? 70}–
              {plan.expenses.spendingPolicy.targetSuccessUpperPct ?? 95}% success band (today's dollars):{' '}
              {plan.expenses.spendingPolicy.lowerBalanceThresholdPct !== undefined ? (
                <>
                  if the portfolio falls below{' '}
                  <strong>
                    {fmtMoney((plan.expenses.spendingPolicy.lowerBalanceThresholdPct / 100) * startingInvestableOf(plan))}
                  </strong>
                  , flexible spending is trimmed in {plan.expenses.spendingPolicy.adjustmentPct ?? 10}% steps
                </>
              ) : (
                <>no cut threshold was solved for this band (see Spending for why)</>
              )}
              {'; '}
              {plan.expenses.spendingPolicy.upperBalanceThresholdPct !== undefined ? (
                <>
                  above{' '}
                  <strong>
                    {fmtMoney((plan.expenses.spendingPolicy.upperBalanceThresholdPct / 100) * startingInvestableOf(plan))}
                  </strong>
                  , spending can be restored or raised
                </>
              ) : (
                <>no raise threshold was solved for this band</>
              )}
              . The required floor is never cut. Watch the “Guardrails” column below for the years the rule acted.
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
            forward. It nets against realized gains first, then up to $3,000/yr against ordinary income — watch it deplete
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
          {view.summary.depletionYear !== null ? (
            <>
              {' '}
              Portfolio depletes in {view.summary.depletionYear}. <Link to={`/plan/${plan.id}/insights`}>See what would change this →</Link>
            </>
          ) : null}
        </p>
        <div className="chart-frame" style={frameH(320)}>
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
              {CATEGORIES.map((c) => (
                <Area key={c} dataKey={c} stackId="bal" name={CAT_LABEL[c]} stroke={CAT_COLOR[c]} fill={CAT_COLOR[c]} fillOpacity={0.55} />
              ))}
              {view.summary.depletionYear !== null ? (
                <ReferenceLine x={view.summary.depletionYear} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: 'depleted', fill: 'var(--bad)', fontSize: 12 }} />
              ) : null}
              <Tooltip {...tooltipProps} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <BucketLensCard result={view.result} adj={adj} />

      {!fireLeads ? (
        <details className="ss-explainer">
          <summary>Path to Financial Independence (FIRE) — an optional lens</summary>
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
        <div className="chart-frame" style={frameH(280)}>
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
        <div className="chart-frame" style={frameH(280)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeRows} margin={{ left: 12, right: 8, top: 8 }} aria-label="Income by source, year by year">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="year" interval="equidistantPreserveStart" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickFormatter={moneyTick} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={70} />
              <Legend />
              {INCOME_SOURCES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="inc" name={s.label} fill={s.color} />
              ))}
              <Tooltip {...tooltipProps} />
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
        <div className="chart-frame" style={frameH(280)}>
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
              <Tooltip {...tooltipProps} />
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
        <div className="chart-frame" style={frameH(280)}>
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
            (screen readers, heading-jump extensions) — a bare summary is not. */}
        <summary className="year-table-summary">
          <h2>Year-by-year detail</h2>
        </summary>
        <div className="year-table-wrap">
          <table className="year-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Age</th>
                <th>Income</th>
                <th>Expenses</th>
                {hasLayeredSpending ? <th title="Must-fund floor spending, including required lifestyle and system costs.">Required</th> : null}
                {hasLayeredSpending ? <th title="Required plus target lifestyle spending before ideal/excess upside.">Target</th> : null}
                {hasLayeredSpending ? <th title="Ideal and excess spending intended above target.">Upside</th> : null}
                <th>Contrib.</th>
                <th>Match</th>
                <th>RMD</th>
                <th>Conversion</th>
                <th>Withdrawals</th>
                <th>Tax</th>
                {hasAmt ? <th title="Federal alternative minimum tax included in Tax.">AMT</th> : null}
                <th title="Displayed in the active dollar mode. IRMAA and ACA threshold checks use the nominal dollars for each rule.">
                  MAGI ({dollarLabel})
                </th>
                <th title="Additional long-term gains you could realize this year at $0 federal tax: your remaining loss carryforward absorbs gains dollar-for-dollar, then the 0% long-term bracket covers more on top.">Tax-free gains room</th>
                {hasCarryforward ? <th title="Capital-loss carryforward remaining at year end.">Loss carryf'd</th> : null}
                <th>Shortfall</th>
                {hasLayeredSpending ? <th title="Required-floor shortfall / target-lifestyle shortfall / upside miss.">Layer miss</th> : null}
                {hasLayeredSpending ? <th title="Guardrail action and flexible goal outcomes.">Guardrails</th> : null}
                <th>Investable</th>
                <th>Net worth</th>
              </tr>
            </thead>
            <tbody>
              {view.result.years.map((y) => (
                <tr key={y.year} className={y.shortfall > 0.005 ? 'row-depleted' : undefined}>
                  <td>{y.year}</td>
                  <td>{y.people.map((p) => (p.alive ? p.ageAttained : '—')).join(' / ')}</td>
                  <td>{fmtMoney(adj(y.year, y.incomes.total))}</td>
                  <td>{fmtMoney(adj(y.year, y.expenses.total))}</td>
                  {hasLayeredSpending ? <td>{fmtMoney(adj(y.year, y.expenses.requiredSpending))}</td> : null}
                  {hasLayeredSpending ? <td>{fmtMoney(adj(y.year, y.expenses.targetSpending))}</td> : null}
                  {hasLayeredSpending ? (
                    <td>
                      {y.expenses.idealSpending + y.expenses.excessSpending > 0.5
                        ? fmtMoney(adj(y.year, y.expenses.idealSpending + y.expenses.excessSpending))
                        : ''}
                    </td>
                  ) : null}
                  <td>{y.contributions > 0.005 ? fmtMoney(adj(y.year, y.contributions)) : ''}</td>
                  <td>{y.employerMatch > 0.005 ? fmtMoney(adj(y.year, y.employerMatch)) : ''}</td>
                  <td>{fmtMoney(adj(y.year, y.rmd))}</td>
                  <td>{fmtMoney(adj(y.year, y.rothConversion))}</td>
                  <td>{fmtMoney(adj(y.year, y.withdrawals.total))}</td>
                  <td>{fmtMoney(adj(y.year, y.tax + y.penalties))}</td>
                  {hasAmt ? <td>{y.amt > 0.5 ? fmtMoney(adj(y.year, y.amt)) : ''}</td> : null}
                  <td>{fmtMoney(adj(y.year, y.magi))}</td>
                  <td>{y.ltcgZeroHeadroom + y.capitalLossCarryforwardRemaining > 0.5 ? fmtMoney(adj(y.year, y.ltcgZeroHeadroom + y.capitalLossCarryforwardRemaining)) : ''}</td>
                  {hasCarryforward ? <td>{y.capitalLossCarryforwardRemaining > 0.5 ? fmtMoney(adj(y.year, y.capitalLossCarryforwardRemaining)) : '—'}</td> : null}
                  <td>{y.shortfall > 0.005 ? fmtMoney(adj(y.year, y.shortfall)) : ''}</td>
                  {hasLayeredSpending ? (
                    <td>
                      {y.requiredShortfall + y.targetShortfall + y.idealShortfall + y.excessShortfall > 0.5 ? (
                        <>
                          {y.requiredShortfall > 0.5 ? `Req ${fmtMoney(adj(y.year, y.requiredShortfall))} ` : ''}
                          {y.targetShortfall > 0.5 ? `Target ${fmtMoney(adj(y.year, y.targetShortfall))} ` : ''}
                          {y.idealShortfall + y.excessShortfall > 0.5
                            ? `Upside ${fmtMoney(adj(y.year, y.idealShortfall + y.excessShortfall))}`
                            : ''}
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                  ) : null}
                  {hasLayeredSpending ? (
                    <td>
                      {y.guardrailAction !== 'hold' ? y.guardrailAction : ''}
                      {y.flexibleGoals.funded + y.flexibleGoals.partiallyFunded + y.flexibleGoals.deferred + y.flexibleGoals.skipped > 0 ? (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Column semantics used to live only in title= tooltips — invisible on
            touch and unreliable for screen readers. This legend is the
            keyboard/touch-reachable copy of the same explanations. */}
        <details className="ss-explainer">
          <summary>What the columns mean</summary>
          <ul>
            <li>
              <strong>Age</strong> — one entry per person (e.g. "67 / 64"). A person shows "—" after their modeled
              death; income and spending reflect the survivor from that year on.
            </li>
            {hasLayeredSpending ? (
              <>
                <li>
                  <strong>Required</strong> — must-fund floor spending, including required lifestyle and system costs.
                </li>
                <li>
                  <strong>Target</strong> — required plus target lifestyle spending before ideal/excess upside.
                </li>
                <li>
                  <strong>Upside</strong> — ideal and excess spending intended above target.
                </li>
              </>
            ) : null}
            {hasAmt ? (
              <li>
                <strong>AMT</strong> — federal alternative minimum tax, included in Tax.
              </li>
            ) : null}
            <li>
              <strong>MAGI</strong> — modified adjusted gross income, displayed in the active dollar mode; IRMAA and
              ACA threshold checks always use each year's nominal dollars.
            </li>
            <li>
              <strong>Tax-free gains room</strong> — additional long-term gains you could realize this year at $0
              federal tax: remaining loss carryforward absorbs gains first, then the 0% long-term bracket covers more.
            </li>
            {hasCarryforward ? (
              <li>
                <strong>Loss carryf&apos;d</strong> — capital-loss carryforward remaining at year end.
              </li>
            ) : null}
            {hasLayeredSpending ? (
              <>
                <li>
                  <strong>Layer miss</strong> — required-floor shortfall / target-lifestyle shortfall / upside miss.
                </li>
                <li>
                  <strong>Guardrails</strong> — the guardrail action taken that year (cut / raise), and flexible goal
                  outcomes as counts: <strong>F</strong>unded / <strong>P</strong>artial / <strong>D</strong>eferred /{' '}
                  <strong>S</strong>kipped (e.g. “1F/0P/2D/1S”).
                </li>
              </>
            ) : null}
          </ul>
        </details>
      </details>

      <p className="field-hint">
        Every figure above comes from the single year-by-year ledger in this table — the same ledger Monte Carlo and
        the optimizer price against. <Link to={`/plan/${plan.id}/assumptions-card`}>See the assumptions behind it</Link>{' '}
        · <Link to="/how-tested">How RetireGolden is tested</Link>
      </p>

      <LearnAboutScreen route="/plan/:planId/results" />
    </section>
  )
}

