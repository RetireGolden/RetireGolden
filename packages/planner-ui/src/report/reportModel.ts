/**
 * Edition-neutral report model — the complete data a report needs, assembled
 * from an already-computed projection, independent of any DOM/HTML/theme.
 *
 * This is the shared seam of the advisor-branding plan: every edition renders
 * reports from the same `ReportModel`, and only branding/layout differ
 * downstream. The model therefore carries data and semantic block identity
 * (`REPORT_BLOCK_IDS`), never CSS, page, or firm concepts.
 *
 * Boundary note (decision-support-boundary.md): the model distinguishes
 * RetireGolden-computed modeled findings — objective-attributed evidence in
 * the `modeled-findings` block — from advisor-authored recommendations, which
 * exist in the model only as content the host explicitly supplies.
 * `buildReportModel` copies that content verbatim and never derives it.
 *
 * Assembly selects and formats already-computed results; all money math stays
 * in `@retiregolden/engine`. The model records the provenance of what it
 * selected (parameter pack years, data vintage, generation timestamp).
 *
 * Published as the stable `@retiregolden/planner-ui/report-model` subpath —
 * see the package README's "Published API surface".
 */

import type { Account, IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import {
  LATEST_PACK_YEAR,
  PARAMETER_DATA_AS_OF,
  PARAMETER_DATA_BASIS,
  PARAMETER_PROVENANCE,
} from '@retiregolden/engine/params'
import { LATEST_STATE_PACK_YEAR } from '@retiregolden/engine/params/state'
import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import type { ProjectionResult, YearResult } from '@retiregolden/engine/projection/types'
import { fmtMoney } from '../planner/format'
import { isPlanIncomplete } from '../planner/planCompleteness'

export const REPORT_MODEL_KIND = 'retiregolden.report-model'
export const REPORT_MODEL_VERSION = 1

/**
 * Stable identities of every block the model carries. Downstream templates
 * reference these ids; renderers that meet an id they don't know should warn
 * rather than silently drop content.
 */
export const REPORT_BLOCK_IDS = [
  'headline-results',
  'modeled-findings',
  'household',
  'accounts',
  'income-sources',
  'assumptions',
  'modeling-notes',
  'year-ledger',
  'chart-data',
  'parameter-sources',
  'disclosures',
  'advisor-recommendations',
] as const

export type ReportBlockId = (typeof REPORT_BLOCK_IDS)[number]

// ---------------------------------------------------------------------------
// Modeled findings (RetireGolden-computed, objective-attributed evidence)
// ---------------------------------------------------------------------------

export interface ReportDecisionCandidateRow {
  afterTaxEstateDelta: number
  candidateId: string
  label: string
  lifetimeTaxDelta: number
  lossReason: string
  moneyLastsYearsDelta: number
}

export interface ReportClaimAgeEvidence {
  combinationsEvaluated: number
  /** Null when the current claim ages won the joint grid. */
  winningClaimLabel: string | null
  jointExactEstate: number
  currentClaimExactEstate: number
}

/**
 * Exact-ledger validation of the winning candidate, restated as flat report
 * figures. Deliberately not the engine's `ExactLedgerValidation`: that type
 * embeds two full projection summaries, and carrying it verbatim would couple
 * this serialized contract to engine-internal shape. The model states only
 * the figures a report presents.
 */
export interface ReportValidationEvidence {
  baselineAfterTaxEstate: number
  candidateAfterTaxEstate: number
  afterTaxEstateDelta: number
  endingNetWorthDelta: number
  lifetimeTaxDelta: number
  moneyLastsYearsDelta: number
  requestedConversionTotal: number
  executedConversionTotal: number
  executedConversionRatio: number
  /** Null when every requested conversion year executed materially in full. */
  firstMateriallyUnexecutedYear: number | null
  traditionalDepletionYear: number | null
  recommendationState: string
}

/**
 * Evidence for a modeled finding: what objective the user selected, which
 * candidate won under it, the exact-ledger validation deltas, and why the
 * other candidates lost. This is calculation output attributed to the stated
 * objective — not a suitability determination.
 */
export interface ReportRecommendationEvidence {
  objectiveId: string
  objectiveLabel: string
  recommendationState: string
  winnerLabel: string
  winnerSource: string
  validation: ReportValidationEvidence | null
  candidates: ReportDecisionCandidateRow[]
  /** Non-null only when claim-age co-optimization ran (Step 5). */
  claimAge: ReportClaimAgeEvidence | null
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/** Headline projection metrics, selected verbatim from the projection summary. */
export interface ReportHeadlineResultsBlock {
  endingNetWorth: number
  /** Net of heir income tax on inherited pre-tax balances. */
  endingAfterTaxEstate: number
  endingInvestable: number
  /** Null when investable assets last through the whole projection. */
  depletionYear: number | null
  lifetimeTaxesAndPenalties: number
  lifetimeRothConversions: number
  /** Today-dollar portfolio target at the plan's safe withdrawal rate. */
  fiNumber: number
  fiYear: number | null
  fiAge: number | null
  coastFireNumber: number
  averagePreRetirementSavingsRatePct: number
}

export interface ReportPersonRow {
  name: string
  dob: string
  retirementAge: number | null
  planningAge: number
}

export interface ReportHouseholdBlock {
  filingStatus: Plan['household']['filingStatus']
  state: string
  people: ReportPersonRow[]
  /**
   * True while the plan has no income sources and nothing that can fund
   * spending — the plan is still being set up. Renderers must keep this
   * missing-data caveat visible; it is not removable compression.
   */
  incompleteData: boolean
}

export interface ReportAccountRow {
  id: string
  name: string
  type: Account['type']
  /** Report vocabulary for the account type (e.g. taxable → "Brokerage"). */
  typeLabel: string
  owner: string
  balance: number
  /** Null means the plan's default return assumption applies. */
  annualReturnPct: number | null
}

export interface ReportAccountsBlock {
  rows: ReportAccountRow[]
}

export interface ReportIncomeSourceRow {
  id: string
  type: IncomeStream['type']
  label: string
  /** Human-readable summary of the stream's terms (amount, timing, claim age). */
  detail: string
}

export interface ReportIncomeSourcesBlock {
  rows: ReportIncomeSourceRow[]
}

/**
 * The user's modeling assumptions and strategy selections, as configured on
 * the plan (visible, editable modeling inputs — not determinations).
 */
export interface ReportAssumptionsBlock {
  inflationPct: number
  healthcareExtraInflationPct: number
  defaultReturnPct: number
  /** The plan's value with the modeling default applied when unset. */
  safeWithdrawalRatePct: number
  stateEffectiveTaxPct: number
  localIncomeTaxPct: number
  heirTaxRatePct: number
  rothConversionSummary: string
  withdrawalOrderSummary: string
  spendingPolicySummary: string
}

/** Engine warnings for this run — model limitations the report must surface. */
export interface ReportModelingNotesBlock {
  warnings: string[]
}

export interface ReportYearLedgerRow {
  year: number
  income: number
  expenses: number
  contributions: number
  rmd: number
  rothConversion: number
  /** Combined tax + penalties, as the ledger appendix reports it. */
  taxAndPenalties: number
  magi: number
  withdrawals: number
  investable: number
  netWorth: number
}

export interface ReportYearLedgerBlock {
  rows: ReportYearLedgerRow[]
}

export const REPORT_CHART_CATEGORIES = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const

export type ReportChartCategory = (typeof REPORT_CHART_CATEGORIES)[number]

/** Whole-dollar per-year series behind the balance/income chart and CSV. */
export interface ReportChartDataRow {
  year: number
  cash: number
  taxable: number
  equityComp: number
  traditional: number
  roth: number
  hsa: number
  income: number
  spendingPlusTax: number
}

export interface ReportChartDataBlock {
  rows: ReportChartDataRow[]
}

export interface ReportParameterSourceRow {
  label: string
  figures: string
  publisher: string
  url: string
}

export interface ReportParameterSourcesBlock {
  sources: ReportParameterSourceRow[]
}

/** Disclosure statements every rendering must keep visible. */
export interface ReportDisclosuresBlock {
  statements: string[]
}

/**
 * Professional judgment affirmatively authored or adopted by an advisor.
 * The model carries this content only when the host supplies it;
 * RetireGolden never generates or pre-fills it (decision-support boundary).
 */
export interface ReportAdvisorRecommendation {
  heading: string
  body: string
  /** Attribution — the professional who authored or adopted this entry. */
  authoredBy: string
  /** When the advisor recorded adopting the entry, if the host tracks that. */
  adoptedAtIso?: string | null
}

export interface ReportAdvisorRecommendationsBlock {
  entries: ReportAdvisorRecommendation[]
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** Where the numbers came from: law/data vintage and build identifiers. */
export interface ReportProvenance {
  federalParameterPackYear: number
  stateParameterPackYear: number
  parameterDataAsOf: string
  parameterDataBasis: string
  /** Engine build the host ran, when the host supplies it — never guessed. */
  engineVersion: string | null
  /** Host application build, when the host supplies it. */
  hostVersion: string | null
}

export interface ReportModel {
  kind: typeof REPORT_MODEL_KIND
  version: typeof REPORT_MODEL_VERSION
  planName: string
  generatedAtIso: string
  startYear: number
  endYear: number
  provenance: ReportProvenance
  blocks: {
    'headline-results': ReportHeadlineResultsBlock
    /** Null when no optimization evidence accompanies this report. */
    'modeled-findings': ReportRecommendationEvidence | null
    'household': ReportHouseholdBlock
    'accounts': ReportAccountsBlock
    'income-sources': ReportIncomeSourcesBlock
    'assumptions': ReportAssumptionsBlock
    'modeling-notes': ReportModelingNotesBlock
    'year-ledger': ReportYearLedgerBlock
    'chart-data': ReportChartDataBlock
    'parameter-sources': ReportParameterSourcesBlock
    'disclosures': ReportDisclosuresBlock
    /** Host-supplied only; null unless the host passed advisor content in. */
    'advisor-recommendations': ReportAdvisorRecommendationsBlock | null
  }
}

export interface ReportModelInput {
  plan: Plan
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  /** Defaults to the current time; pass a fixed value for reproducible output. */
  generatedAtIso?: string
  /** Optimization evidence from a run the user directed, if one accompanied this report. */
  modeledFindings?: ReportRecommendationEvidence | null
  /**
   * Advisor-authored content, copied into the model verbatim. Omitting it —
   * the only behavior RetireGolden's own surfaces use — leaves the block null.
   */
  advisorRecommendations?: ReportAdvisorRecommendation[] | null
  /** Build identifiers recorded into provenance when the host knows them. */
  build?: { engineVersion?: string; hostVersion?: string } | null
}

export const REPORT_ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  annuity: 'Annuity',
  cash: 'Cash',
  debt: 'Debt',
  equityComp: 'Equity comp',
  hsa: 'HSA',
  pension: 'Pension',
  property: 'Property',
  roth: 'Roth',
  taxable: 'Brokerage',
  traditional: 'Traditional',
}

export const REPORT_EDUCATIONAL_DISCLAIMER =
  'Educational illustration only - not tax, legal, financial, or medical advice. Figures are projections based on the assumptions below and will differ from actual results.'

function ownerName(plan: Plan, ownerPersonId: string | null): string {
  if (ownerPersonId === null) return 'Joint'
  return plan.household.people.find((p) => p.id === ownerPersonId)?.name ?? '-'
}

function accountBalance(a: Account): number {
  if ('balance' in a) return a.balance
  if (a.type === 'property') return a.value
  return 0
}

function incomeLabel(plan: Plan, s: IncomeStream): string {
  if (s.type === 'wages') return `Wages - ${ownerName(plan, s.personId)}`
  if (s.type === 'socialSecurity') return `Social Security - ${ownerName(plan, s.personId)}`
  return s.label
}

function incomeDetail(s: IncomeStream): string {
  switch (s.type) {
    case 'wages':
      return `${fmtMoney(s.annualGross)}/yr until ${s.endAge ?? 'retirement'}`
    case 'socialSecurity':
      return `${s.piaMonthly !== null ? `${fmtMoney(s.piaMonthly)}/mo PIA` : 'from earnings record'}, claim ${s.claimAge.years}y${s.claimAge.months ? ` ${s.claimAge.months}m` : ''}`
    case 'recurring':
      return `${fmtMoney(s.annualAmount)}/yr${s.inflationAdjusted ? ', inflation-adjusted' : ''}`
    case 'oneTime':
      return `${fmtMoney(s.amount)} in ${s.year}`
  }
}

function conversionSummary(plan: Plan): string {
  const rc = plan.strategies.rothConversion
  if (rc.mode === 'none') return 'None'
  if (rc.mode === 'manual') return `Manual - ${rc.conversions.length} year(s)`
  if (rc.mode === 'optimized') return `Optimized - ${rc.conversions.length} year(s)`
  return `Fill to ${rc.target}${rc.targetValue !== null ? ` (${rc.targetValue})` : ''}, ${rc.startYear}-${rc.endYear}`
}

function withdrawalSummary(plan: Plan): string {
  const w = plan.strategies.withdrawalOrder
  if (w.mode === 'sequential') return 'Sequential: cash, taxable, equity comp, traditional, Roth, HSA'
  if (w.mode === 'proportional') return 'Proportional across accounts'
  return `Bracket-targeted to ${w.bracketPct}%`
}

function spendingPolicySummary(plan: Plan): string {
  const policy = plan.expenses.spendingPolicy
  if (!policy || policy.mode === 'fixedTarget') return 'Fixed target (no guardrails)'
  if (policy.mode === 'withdrawalRateGuardrails') {
    return `Withdrawal-rate guardrails: cut above ${policy.upperGuardrailPct ?? 120}% / restore below ${policy.lowerGuardrailPct ?? 80}% of the starting rate, ${policy.adjustmentPct ?? 10}% steps`
  }
  if (policy.mode === 'abw') {
    const source =
      policy.abw?.returnSource === 'cape'
        ? `CAPE ${policy.abw?.startingCape ?? 25} earnings yield`
        : policy.abw?.returnSource === 'tips'
          ? `TIPS real yield ${policy.abw?.bondRealYieldPct ?? 2}%`
          : `fixed ${policy.abw?.fixedRealReturnPct ?? 3.8}% real`
    const horizon =
      policy.abw?.horizon === 'survival25'
        ? '25% survival age'
        : policy.abw?.horizon === 'survival10'
          ? '10% survival age'
          : 'planning age'
    return `Amortized spending (ABW): ${source}, to ${horizon}, tilt ${policy.abw?.tiltPct ?? 0}%/yr`
  }
  const lower =
    policy.lowerBalanceThresholdPct !== undefined
      ? `cut below ${policy.lowerBalanceThresholdPct.toFixed(0)}%`
      : 'no cut threshold'
  const upper =
    policy.upperBalanceThresholdPct !== undefined
      ? `raise above ${policy.upperBalanceThresholdPct.toFixed(0)}%`
      : 'no raise threshold'
  return `Risk-based guardrails (${policy.targetSuccessLowerPct ?? 70}-${policy.targetSuccessUpperPct ?? 95}% success band): ${lower} / ${upper} of the starting portfolio, ${policy.adjustmentPct ?? 10}% steps`
}

function chartDataRows(plan: Plan, result: ProjectionResult): ReportChartDataRow[] {
  return result.years.map((year) => {
    const categories = Object.fromEntries(REPORT_CHART_CATEGORIES.map((category) => [category, 0])) as Record<
      ReportChartCategory,
      number
    >
    for (const account of plan.accounts) {
      if ((REPORT_CHART_CATEGORIES as readonly string[]).includes(account.type)) {
        categories[account.type as ReportChartCategory] += year.balances[account.id] ?? 0
      }
    }
    return {
      year: year.year,
      cash: Math.round(categories.cash),
      taxable: Math.round(categories.taxable),
      equityComp: Math.round(categories.equityComp),
      traditional: Math.round(categories.traditional),
      roth: Math.round(categories.roth),
      hsa: Math.round(categories.hsa),
      income: Math.round(year.incomes.total),
      spendingPlusTax: Math.round(year.expenses.total + year.tax + year.penalties),
    }
  })
}

/**
 * The model is a snapshot: copy the findings instead of aliasing the caller's
 * object, so later mutation of optimizer output can't silently change an
 * already-built model (all leaf fields are primitives, so shallow copies of
 * each layer suffice).
 */
function snapshotFindings(findings: ReportRecommendationEvidence | null | undefined): ReportRecommendationEvidence | null {
  if (!findings) return null
  return {
    ...findings,
    validation: findings.validation ? { ...findings.validation } : null,
    candidates: findings.candidates.map((candidate) => ({ ...candidate })),
    claimAge: findings.claimAge ? { ...findings.claimAge } : null,
  }
}

function yearLedgerRow(y: YearResult): ReportYearLedgerRow {
  return {
    year: y.year,
    income: y.incomes.total,
    expenses: y.expenses.total,
    contributions: y.contributions,
    rmd: y.rmd,
    rothConversion: y.rothConversion,
    taxAndPenalties: y.tax + y.penalties,
    magi: y.magi,
    withdrawals: y.withdrawals.total,
    investable: y.investableTotal,
    netWorth: y.netWorth,
  }
}

/**
 * Assemble the edition-neutral report model from an already-computed
 * projection. Pure selection/formatting — this function runs no simulation
 * and performs no money math beyond restating engine-computed values.
 */
export function buildReportModel(input: ReportModelInput): ReportModel {
  const { plan, result, summary } = input
  return {
    kind: REPORT_MODEL_KIND,
    version: REPORT_MODEL_VERSION,
    planName: plan.name,
    generatedAtIso: input.generatedAtIso ?? new Date().toISOString(),
    startYear: input.startYear,
    endYear: result.endYear,
    provenance: {
      federalParameterPackYear: LATEST_PACK_YEAR,
      stateParameterPackYear: LATEST_STATE_PACK_YEAR,
      parameterDataAsOf: PARAMETER_DATA_AS_OF,
      parameterDataBasis: PARAMETER_DATA_BASIS,
      engineVersion: input.build?.engineVersion ?? null,
      hostVersion: input.build?.hostVersion ?? null,
    },
    blocks: {
      'headline-results': {
        endingNetWorth: summary.endingNetWorth,
        endingAfterTaxEstate: summary.endingAfterTaxEstate,
        endingInvestable: summary.endingInvestable,
        depletionYear: summary.depletionYear,
        lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
        lifetimeRothConversions: summary.lifetimeRothConversions,
        fiNumber: summary.fiNumber,
        fiYear: summary.fiYear,
        fiAge: summary.fiAge,
        coastFireNumber: summary.coastFireNumber,
        averagePreRetirementSavingsRatePct: summary.averagePreRetirementSavingsRatePct,
      },
      'modeled-findings': snapshotFindings(input.modeledFindings),
      'household': {
        filingStatus: plan.household.filingStatus,
        state: plan.household.state,
        people: plan.household.people.map((p) => ({
          name: p.name,
          dob: p.dob,
          retirementAge: p.retirementAge,
          planningAge: p.longevity.planningAge,
        })),
        incompleteData: isPlanIncomplete(plan),
      },
      'accounts': {
        rows: plan.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          typeLabel: REPORT_ACCOUNT_TYPE_LABEL[a.type],
          owner: ownerName(plan, a.ownerPersonId),
          balance: accountBalance(a),
          annualReturnPct: 'annualReturnPct' in a ? a.annualReturnPct : null,
        })),
      },
      'income-sources': {
        rows: plan.incomes.map((s) => ({
          id: s.id,
          type: s.type,
          label: incomeLabel(plan, s),
          detail: incomeDetail(s),
        })),
      },
      'assumptions': {
        inflationPct: plan.assumptions.inflationPct,
        healthcareExtraInflationPct: plan.assumptions.healthcareExtraInflationPct,
        defaultReturnPct: plan.assumptions.defaultReturnPct,
        safeWithdrawalRatePct: plan.assumptions.safeWithdrawalRatePct ?? 4,
        stateEffectiveTaxPct: plan.assumptions.stateEffectiveTaxPct,
        localIncomeTaxPct: plan.assumptions.localIncomeTaxPct,
        heirTaxRatePct: plan.assumptions.heirTaxRatePct,
        rothConversionSummary: conversionSummary(plan),
        withdrawalOrderSummary: withdrawalSummary(plan),
        spendingPolicySummary: spendingPolicySummary(plan),
      },
      'modeling-notes': { warnings: [...result.warnings] },
      'year-ledger': { rows: result.years.map(yearLedgerRow) },
      'chart-data': { rows: chartDataRows(plan, result) },
      'parameter-sources': {
        sources: PARAMETER_PROVENANCE.map((source) => ({
          label: source.label,
          figures: source.figures,
          publisher: source.publisher,
          url: source.url,
        })),
      },
      'disclosures': { statements: [REPORT_EDUCATIONAL_DISCLAIMER] },
      'advisor-recommendations':
        input.advisorRecommendations && input.advisorRecommendations.length > 0
          ? {
              entries: input.advisorRecommendations.map((entry) => ({
                heading: entry.heading,
                body: entry.body,
                authoredBy: entry.authoredBy,
                adoptedAtIso: entry.adoptedAtIso ?? null,
              })),
            }
          : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Serialization and table export (Workstream 7's structured-data half)
// ---------------------------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function normalizeJson(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item) ?? null)
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {}
    // Codepoint order, not localeCompare: collation varies by runtime locale
    // and would break the same-bytes-everywhere guarantee.
    for (const [key, child] of Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const normalized = normalizeJson(child)
      if (normalized !== undefined) out[key] = normalized
    }
    return out
  }
  return String(value)
}

/**
 * Deterministic JSON for the model: sorted keys, two-space indent, trailing
 * newline, non-finite numbers as null. The same input always produces the
 * same bytes, so serialized models diff cleanly and suit golden fixtures.
 */
export function serializeReportModel(model: ReportModel): string {
  return `${JSON.stringify(normalizeJson(model) ?? null, null, 2)}\n`
}

function csvCell(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  // Text cells can carry user-entered names. Neutralize spreadsheet formula
  // injection: a cell starting with = + - @ or a tab/CR is evaluated by
  // Excel/Sheets even when quoted, so prefix it with an apostrophe (the
  // standard render-as-text marker). Then quote anything containing commas,
  // quotes, or line breaks (\r included — a bare CR also splits rows).
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized
}

function csvTable(header: string[], rows: (string | number | null)[][]): string {
  return [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n')
}

/**
 * The chart/automation series as CSV — byte-identical to the CSV embedded in
 * the standalone HTML report for the same projection.
 */
export function chartDataCsv(block: ReportChartDataBlock): string {
  return csvTable(
    ['year', ...REPORT_CHART_CATEGORIES, 'income', 'spendingPlusTax'],
    block.rows.map((row) => [
      row.year,
      ...REPORT_CHART_CATEGORIES.map((category) => row[category]),
      row.income,
      row.spendingPlusTax,
    ]),
  )
}

/** The year-by-year ledger appendix as CSV (raw engine dollars, unrounded). */
export function yearLedgerCsv(block: ReportYearLedgerBlock): string {
  return csvTable(
    ['year', 'income', 'expenses', 'contributions', 'rmd', 'rothConversion', 'taxAndPenalties', 'magi', 'withdrawals', 'investable', 'netWorth'],
    block.rows.map((row) => [
      row.year,
      row.income,
      row.expenses,
      row.contributions,
      row.rmd,
      row.rothConversion,
      row.taxAndPenalties,
      row.magi,
      row.withdrawals,
      row.investable,
      row.netWorth,
    ]),
  )
}

/** The accounts table as CSV. */
export function accountsCsv(block: ReportAccountsBlock): string {
  return csvTable(
    ['name', 'type', 'typeLabel', 'owner', 'balance', 'annualReturnPct'],
    block.rows.map((row) => [row.name, row.type, row.typeLabel, row.owner, row.balance, row.annualReturnPct]),
  )
}
