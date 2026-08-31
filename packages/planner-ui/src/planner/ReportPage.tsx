/**
 * Print-styled plan report. A standalone route (outside the workspace shell)
 * that lays out the whole plan — inputs, assumptions, headline results, and
 * the year-by-year appendix — for the browser's print-to-PDF. Replaces the
 * old jspdf/html2canvas path with native print CSS.
 */

import { Link, useParams } from 'react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { Account, IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'
import { downloadStandaloneReport } from '../report/downloadReport'
import { useReportBranding } from '../report/brandingContext'
import { buildInheritedSchedules, incomeDetail } from '../report/reportModel'
import { acaLedgerSummary, acaReportStatus } from './acaReportStatus'
import { PlanProvider } from './PlanContext'
import { usePlan } from './planContextCore'
import { fmtMoney, fmtMoneyCompact, fmtPct } from './format'
import { useProjection } from './useProjection'
import { US_STATES } from './usStates'
import { hasCapitalLossCarryforward } from './capitalLossCarryforwardVisibility'
import { ProfessionalConfirmationMarker } from './ProfessionalConfirmationMarker'

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

const ACCOUNT_LABEL: Record<Account['type'], string> = {
  cash: 'Cash', taxable: 'Brokerage', equityComp: 'Equity comp', traditional: 'Traditional', roth: 'Roth', hsa: 'HSA',
  pension: 'Pension', annuity: 'Annuity', property: 'Property', debt: 'Debt',
}

function ownerName(plan: Plan, ownerPersonId: string | null): string {
  if (ownerPersonId === null) return 'Joint'
  return plan.household.people.find((p) => p.id === ownerPersonId)?.name ?? '—'
}

function stateName(code: string): string {
  return US_STATES.find((s) => s.value === code)?.label ?? code
}

function accountBalance(a: Account): number {
  if ('balance' in a) return a.balance
  if (a.type === 'property') return a.value
  return 0
}

function incomeLabel(plan: Plan, s: IncomeStream): string {
  if (s.type === 'wages') return `Wages: ${ownerName(plan, s.personId)}`
  if (s.type === 'socialSecurity') return `Social Security: ${ownerName(plan, s.personId)}`
  return s.label
}

function conversionSummary(plan: Plan): string {
  const rc = plan.strategies.rothConversion
  if (rc.mode === 'none') return 'None'
  if (rc.mode === 'manual') return `Manual: ${rc.conversions.length} year(s)`
  if (rc.mode === 'optimized') return `Optimized: ${rc.conversions.length} year(s)`
  return `Fill to ${rc.target}${rc.targetValue !== null ? ` (${rc.targetValue})` : ''}, ${rc.startYear}–${rc.endYear}`
}

function withdrawalSummary(plan: Plan): string {
  const w = plan.strategies.withdrawalOrder
  if (w.mode === 'sequential') return 'Sequential (cash → taxable → equity comp → traditional → Roth)'
  if (w.mode === 'proportional') return 'Proportional across accounts'
  return `Bracket-targeted to ${w.bracketPct}%`
}

const td: React.CSSProperties = { padding: '0.3rem 0.6rem', borderBottom: '1px solid var(--border)' }

function ReportBody() {
  const { plan } = usePlan()
  const reportBranding = useReportBranding()
  const view = useProjection(plan)
  const { result, summary } = view
  const acaLedgerRows = acaLedgerSummary(result.years)
  const inheritedSchedules = buildInheritedSchedules(plan, result.years).accounts
  const hasCarryforward = hasCapitalLossCarryforward(
    plan.household.capitalLossCarryforward,
    result.years,
  )
  const depleted = summary.depletionYear !== null

  const chartRows = result.years.map((y) => {
    const cats = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
    for (const a of plan.accounts) {
      if ((CATEGORIES as readonly string[]).includes(a.type)) cats[a.type as (typeof CATEGORIES)[number]] += y.balances[a.id] ?? 0
    }
    return {
      year: y.year,
      ...cats,
      income: y.incomes.total,
      spending: y.expenses.total + y.tax + y.penalties,
      tax: y.tax,
      magi: y.magi,
    }
  })

  return (
    <article className="report">
      <header className="report-head">
        <div>
          <h1>{plan.name}</h1>
          <p className="muted">Retirement plan report · prepared {new Date().toLocaleDateString()}</p>
        </div>
        <div className="report-actions no-print">
          <button type="button" className="btn btn-primary btn-small" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              downloadStandaloneReport({
                plan,
                result,
                summary,
                startYear: view.startYear,
                branding: reportBranding,
              })
            }
          >
            Download HTML report
          </button>
          <Link to={`/plan/${plan.id}/results`} className="btn btn-secondary btn-small">
            Back to plan
          </Link>
        </div>
      </header>

      <p className="report-disclaimer">
        Educational illustration only, not tax, legal, financial, or medical advice. Figures are projections based on
        the assumptions below and will differ from actual results. See the full disclaimer in the app.
      </p>

      {/* Headline results */}
      <section className="report-section">
        <h2>Headline results</h2>
        <div className="report-kpis">
          <ReportKpi label="Ending net worth" value={fmtMoneyCompact(result.endingNetWorth)} sub={`in ${result.endYear}`} />
          <ReportKpi label="After-tax estate" value={fmtMoneyCompact(summary.endingAfterTaxEstate)} sub="net of heir tax on pre-tax" />
          <ReportKpi label="Money lasts" value={depleted ? `to ${summary.depletionYear}` : 'full plan'} sub={depleted ? 'portfolio depletes' : `through ${result.endYear}`} />
          <ReportKpi label="Lifetime tax" value={fmtMoneyCompact(summary.lifetimeTaxesAndPenalties)} sub="federal + state + penalties" />
        </div>
        <div className="report-kpis" style={{ marginTop: '1rem' }}>
          <ReportKpi label="FI Target" value={fmtMoneyCompact(summary.fiNumber)} sub={`SWR: ${plan.assumptions.safeWithdrawalRatePct ?? 4}%`} />
          <ReportKpi label="FI Reached" value={summary.fiYear !== null ? `${summary.fiYear} (Age ${summary.fiAge})` : 'Never'} sub="based on target SWR" />
          <ReportKpi label="Avg Savings Rate" value={`${summary.averagePreRetirementSavingsRatePct.toFixed(1)}%`} sub="pre-retirement average" />
          <ReportKpi label="Coast-FIRE Target" value={fmtMoneyCompact(summary.coastFireNumber)} sub="needed today" />
        </div>
        <div className="report-chart">
          <h3>Investable balances by account type (nominal)</h3>
          <AreaChart width={700} height={260} data={chartRows} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={64} />
            <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} />
            <Legend />
            {CATEGORIES.map((c) => (
              <Area key={c} dataKey={c} stackId="bal" name={CAT_LABEL[c]} stroke={CAT_COLOR[c]} fill={CAT_COLOR[c]} fillOpacity={0.55} isAnimationActive={false} />
            ))}
          </AreaChart>
        </div>
        <div className="report-chart">
          <h3>Income vs. spending (nominal)</h3>
          <BarChart width={700} height={220} data={chartRows} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={64} />
            <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} />
            <Legend />
            {/* Income is green (chart-3), spending gold: money in reads as green. */}
            <Bar dataKey="income" name="Income" fill="var(--chart-3)" isAnimationActive={false} />
            <Bar dataKey="spending" name="Spending + tax" fill="var(--chart-1)" isAnimationActive={false} />
          </BarChart>
        </div>
        <div className="report-chart">
          <h3>Tax and MAGI (nominal)</h3>
          <LineChart width={700} height={200} data={chartRows} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
            <YAxis tickFormatter={fmtMoneyCompact} tick={{ fill: 'var(--muted)', fontSize: 11 }} width={64} />
            <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} />
            <Legend />
            <Line dataKey="tax" name="Tax" stroke="var(--chart-4)" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line dataKey="magi" name="MAGI" stroke="var(--chart-2)" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </div>
      </section>

      {/* Inputs */}
      <section className="report-section">
        <h2>Household</h2>
        <p className="muted">
          {plan.household.filingStatus === 'marriedFilingJointly' ? 'Married filing jointly' : 'Single'} · {stateName(plan.household.state)}
        </p>
        <table className="report-table">
          <thead><tr><th>Person</th><th>Date of birth</th><th>Retirement age</th><th>Planning age</th></tr></thead>
          <tbody>
            {plan.household.people.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.dob}</td>
                <td style={td}>{p.retirementAge ?? '—'}</td>
                <td style={td}>{p.longevity.planningAge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Accounts</h2>
        <table className="report-table">
          <thead><tr><th>Account</th><th>Type</th><th>Owner</th><th style={{ textAlign: 'right' }}>Balance</th><th style={{ textAlign: 'right' }}>Return</th></tr></thead>
          <tbody>
            {plan.accounts.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.name}</td>
                <td style={td}>{ACCOUNT_LABEL[a.type]}</td>
                <td style={td}>{ownerName(plan, a.ownerPersonId)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(accountBalance(a))}</td>
                <td style={{ ...td, textAlign: 'right' }}>{a.annualReturnPct !== null ? `${a.annualReturnPct}%` : 'default'}</td>
              </tr>
            ))}
            {plan.accounts.length === 0 ? <tr><td style={td} colSpan={5}>No accounts.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Income</h2>
        <table className="report-table">
          <thead><tr><th>Source</th><th>Detail</th></tr></thead>
          <tbody>
            {plan.incomes.map((s) => (
              <tr key={s.id}><td style={td}>{incomeLabel(plan, s)}</td><td style={td}>{incomeDetail(s)}</td></tr>
            ))}
            {plan.incomes.length === 0 ? <tr><td style={td} colSpan={2}>No income streams.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="report-section">
        <h2>Spending &amp; strategy</h2>
        <table className="report-table">
          <tbody>
            <tr><td style={td}>Baseline annual spending</td><td style={{ ...td, textAlign: 'right' }}>{fmtMoney(plan.expenses.baseAnnual)} (today's $)</td></tr>
            <tr><td style={td}>Retirement phases</td><td style={{ ...td, textAlign: 'right' }}>{plan.expenses.phases.length ? plan.expenses.phases.map((p) => `${p.multiplier}× from ${p.fromAge}`).join(', ') : 'none'}</td></tr>
            <tr><td style={td}>One-time goals</td><td style={{ ...td, textAlign: 'right' }}>{plan.expenses.oneTimeGoals.length}</td></tr>
            <tr><td style={td}>Legacy pre-65 premium input / person</td><td style={{ ...td, textAlign: 'right' }}>{fmtMoney(plan.expenses.healthcare.pre65MonthlyPremiumPerPerson)}/mo{acaReportStatus(plan, result.years)}</td></tr>
            <tr><td style={td}>Withdrawal order</td><td style={{ ...td, textAlign: 'right' }}>{withdrawalSummary(plan)}</td></tr>
            <tr><td style={td}>Roth conversions</td><td style={{ ...td, textAlign: 'right' }}>{conversionSummary(plan)}</td></tr>
            <tr><td style={td}>QCD per year</td><td style={{ ...td, textAlign: 'right' }}>{fmtMoney(plan.strategies.qcdAnnual)}</td></tr>
          </tbody>
        </table>
      </section>

      {acaLedgerRows.length > 0 ? (
        <section className="report-section">
          <h2>ACA current-year ledger</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Gross enrollment premium</th>
                <th>Applicable SLCSP</th>
                <th>Modeled allowable PTC</th>
                <th>Economic net premium</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody>
              {acaLedgerRows.map((row) => (
                <tr key={row.year}>
                  <td style={td}>{row.year}</td>
                  <td style={td}>{fmtMoney(row.grossEnrollmentPremium)}</td>
                  <td style={td}>{row.applicableSlcspPremium === null ? 'Not modeled' : fmtMoney(row.applicableSlcspPremium)}</td>
                  <td style={td}>{row.modeledAllowablePtc === null ? 'Not modeled' : fmtMoney(row.modeledAllowablePtc)}</td>
                  <td style={td}>{fmtMoney(row.economicNetPremium)}</td>
                  <td style={td}>{row.readiness === 'actionable' ? 'Actionable' : 'Non-actionable'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="report-section">
        <h2>Assumptions</h2>
        <table className="report-table">
          <tbody>
            <tr><td style={td}>General inflation</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.inflationPct / 100, 1)}</td></tr>
            <tr><td style={td}>Healthcare extra inflation</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.healthcareExtraInflationPct / 100, 1)}</td></tr>
            <tr><td style={td}>Default return</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.defaultReturnPct / 100, 1)}</td></tr>
            <tr><td style={td}>Safe withdrawal rate</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct((plan.assumptions.safeWithdrawalRatePct ?? 4) / 100, 1)}</td></tr>
            <tr><td style={td}>State effective tax</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.stateEffectiveTaxPct / 100, 1)}</td></tr>
            <tr><td style={td}>Local income tax</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.localIncomeTaxPct / 100, 1)}</td></tr>
            <tr><td style={td}>Heir tax rate (pre-tax estate)</td><td style={{ ...td, textAlign: 'right' }}>{fmtPct(plan.assumptions.heirTaxRatePct / 100, 0)}</td></tr>
            <tr><td style={td}>Social Security COLA</td><td style={{ ...td, textAlign: 'right' }}>{plan.assumptions.ssCola.mode === 'matchInflation' ? 'matches inflation' : `${plan.assumptions.ssCola.annualPct}% fixed`}</td></tr>
            <tr><td style={td}>SS trust-fund cut</td><td style={{ ...td, textAlign: 'right' }}>{plan.assumptions.ssHaircut ? `${plan.assumptions.ssHaircut.cutPct}% from ${plan.assumptions.ssHaircut.fromYear}` : 'none (scheduled benefits)'}</td></tr>
          </tbody>
        </table>
        <p className="muted small">
          Federal tax brackets, contribution limits, RMD tables, Medicare/IRMAA, and FPL come from dated parameter
          packs; values beyond the latest published year are indexed forward at the assumed inflation rate.
        </p>
      </section>

      {result.warnings.length > 0 ? (
        <section className="report-section">
          <h2>Modeling notes</h2>
          <ul>
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      ) : null}

      {/* Appendix */}
      <section className="report-section report-appendix">
        <h2>Year-by-year appendix (nominal $)</h2>
        <table className="report-table report-appendix-table">
          <thead>
            <tr>
              <th>Year</th><th>Age</th><th style={{ textAlign: 'right' }}>Income</th><th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Contrib.</th><th style={{ textAlign: 'right' }}>Match</th>
              <th style={{ textAlign: 'right' }}>RMD</th><th style={{ textAlign: 'right' }}>Conv.</th><th style={{ textAlign: 'right' }}>Tax</th>
              {hasCarryforward ? <th style={{ textAlign: 'right' }}>Loss CF</th> : null}
              <th style={{ textAlign: 'right' }}>Investable</th><th style={{ textAlign: 'right' }}>Net worth</th>
            </tr>
          </thead>
          <tbody>
            {result.years.map((y: YearResult) => (
              <tr key={y.year}>
                <td style={td}>{y.year}</td>
                <td style={td}>{y.people.map((p) => (p.alive ? p.ageAttained : '—')).join('/')}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.incomes.total)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.expenses.total)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.contributions)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.employerMatch)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.rmd)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.rothConversion)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.tax + y.penalties)}</td>
                {hasCarryforward ? <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.capitalLossCarryforwardRemaining)}</td> : null}
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.investableTotal)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(y.netWorth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {inheritedSchedules.length > 0 ? (
        <section className="report-section report-appendix">
          <h2>Inherited account schedules (nominal $)</h2>
          <p className="muted small">
            Compact schedule per inherited account. Full notes and citations are on the Results page.
          </p>
          {inheritedSchedules.map((account) => (
            <div key={account.accountId} style={{ marginTop: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.35rem' }}>
                {account.accountName}: {account.regimeLabel}
              </h3>
              {account.isRefusal ? (
                <p className="muted small">
                  Needs review: the model does not cover these facts, so it shows the limitation rather than guessing.
                  The schedule below uses the simpler planning estimate.
                </p>
              ) : null}
              {account.isSuccessorScope ? (
                <p className="muted small">
                  After the beneficiary&apos;s death the account passes to a successor; successor schedules are not
                  modeled and no amounts are forced.
                </p>
              ) : null}
              {account.isLegacyApproximation && !account.isRefusal ? (
                <p className="muted small">Planning estimate (beneficiary details not supplied).</p>
              ) : null}
              {account.finalDeadlineYear !== null ? (
                <p className="muted small">Final deadline year: {account.finalDeadlineYear}</p>
              ) : null}
              {account.needsProfessionalConfirmation ? <ProfessionalConfirmationMarker compact /> : null}
              <table className="report-table report-appendix-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Kind</th>
                    <th style={{ textAlign: 'right' }}>Required</th>
                    <th style={{ textAlign: 'right' }}>Executed</th>
                  </tr>
                </thead>
                <tbody>
                  {account.years.map((row) => (
                    <tr key={row.year}>
                      <td style={td}>{row.year}</td>
                      <td style={td}>{row.kindLabel}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(row.requiredAmount)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(row.executedRequiredAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ) : null}
    </article>
  )
}

function ReportKpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="report-kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </div>
  )
}

export function ReportPage() {
  const { planId } = useParams()
  if (!planId) return null
  return (
    <PlanProvider planId={planId}>
      <ReportBody />
    </PlanProvider>
  )
}
