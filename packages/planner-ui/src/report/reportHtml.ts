import { objectivePolicies } from '@retiregolden/engine/decisions'
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
import type { ExactLedgerTournament, ExactLedgerValidation } from '@retiregolden/engine/projection/optimizePlan'
import type { OptimizeResult } from '../optimize/messages'
import { fmtMoney } from '../planner/format'

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

export interface ReportRecommendationEvidence {
  objectiveId: string
  objectiveLabel: string
  recommendationState: string
  winnerLabel: string
  winnerSource: string
  validation: ExactLedgerValidation | null
  candidates: ReportDecisionCandidateRow[]
  /** Non-null only when claim-age co-optimization ran (Step 5). */
  claimAge: ReportClaimAgeEvidence | null
}

/**
 * Host-supplied identity for downloaded reports — a generic composition hook
 * (any host can pass any brand); omitting every field reproduces today's
 * RetireGolden report byte for byte. Values are sanitized, not trusted: the
 * report's no-script guarantee must hold whatever the host passes.
 */
export interface ReportBranding {
  /** Name used in the report <title>, the "prepared" line, and the download filename. Default: "RetireGolden". */
  productName?: string
  /** Letterhead logo. Must be a data:image/... URI so the report stays self-contained; anything else is ignored. */
  logoDataUri?: string
  /** Alt text for the logo; defaults to the product name. */
  logoAlt?: string
  /**
   * Color for the letterhead rule under the header — hex, rgb()/hsl(), or a
   * CSS named color; anything that doesn't parse as one falls back to the
   * default RetireGolden gold.
   */
  accentColor?: string
  /** Extra line rendered at the end of the report (e.g. a firm disclosure). Plain text; rendered escaped. */
  footerNote?: string
}

export interface StandaloneReportInput {
  plan: Plan
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  preparedAtIso?: string
  recommendationEvidence?: ReportRecommendationEvidence | null
  branding?: ReportBranding | null
}

const DEFAULT_PRODUCT_NAME = 'RetireGolden'
const DEFAULT_ACCENT_COLOR = '#B8860B'

/**
 * The accent is interpolated into a CSS context where escapeHtml doesn't
 * apply, so it must positively parse as a color — a charset allowlist alone
 * would still admit safe-charset non-colors (`not-a-color`, `calc(1px)`,
 * IE-era `expression(...)`), which the browser drops as invalid
 * declarations, silently losing the letterhead rule instead of falling back.
 * Recognized: hex, rgb()/rgba()/hsl()/hsla() (comma or space syntax), and
 * CSS named colors. Anything else falls back to the default.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
/** One rgb()/hsl() argument: a number with an optional %/angle unit, or CSS4 `none`. */
const COLOR_FUNCTION_ARG = /^(?:none|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?(?:%|deg|grad|rad|turn)?)$/i
// prettier-ignore
const NAMED_COLORS = new Set(('aliceblue,antiquewhite,aqua,aquamarine,azure,beige,bisque,black,blanchedalmond,blue,' +
  'blueviolet,brown,burlywood,cadetblue,chartreuse,chocolate,coral,cornflowerblue,cornsilk,crimson,cyan,darkblue,' +
  'darkcyan,darkgoldenrod,darkgray,darkgreen,darkgrey,darkkhaki,darkmagenta,darkolivegreen,darkorange,darkorchid,' +
  'darkred,darksalmon,darkseagreen,darkslateblue,darkslategray,darkslategrey,darkturquoise,darkviolet,deeppink,' +
  'deepskyblue,dimgray,dimgrey,dodgerblue,firebrick,floralwhite,forestgreen,fuchsia,gainsboro,ghostwhite,gold,' +
  'goldenrod,gray,green,greenyellow,grey,honeydew,hotpink,indianred,indigo,ivory,khaki,lavender,lavenderblush,' +
  'lawngreen,lemonchiffon,lightblue,lightcoral,lightcyan,lightgoldenrodyellow,lightgray,lightgreen,lightgrey,' +
  'lightpink,lightsalmon,lightseagreen,lightskyblue,lightslategray,lightslategrey,lightsteelblue,lightyellow,lime,' +
  'limegreen,linen,magenta,maroon,mediumaquamarine,mediumblue,mediumorchid,mediumpurple,mediumseagreen,' +
  'mediumslateblue,mediumspringgreen,mediumturquoise,mediumvioletred,midnightblue,mintcream,mistyrose,moccasin,' +
  'navajowhite,navy,oldlace,olive,olivedrab,orange,orangered,orchid,palegoldenrod,palegreen,paleturquoise,' +
  'palevioletred,papayawhip,peachpuff,peru,pink,plum,powderblue,purple,rebeccapurple,red,rosybrown,royalblue,' +
  'saddlebrown,salmon,sandybrown,seagreen,seashell,sienna,silver,skyblue,slateblue,slategray,slategrey,snow,' +
  'springgreen,steelblue,tan,teal,thistle,tomato,transparent,turquoise,violet,wheat,white,whitesmoke,yellow,' +
  'yellowgreen').split(','))

function isCssColor(value: string): boolean {
  if (HEX_COLOR.test(value)) return true
  const colorFunction = /^(?:rgb|rgba|hsl|hsla)\((.*)\)$/i.exec(value)
  if (colorFunction) {
    const args = colorFunction[1].trim().split(/\s*[,/]\s*|\s+/)
    return args.length >= 3 && args.length <= 4 && args.every((arg) => COLOR_FUNCTION_ARG.test(arg))
  }
  return NAMED_COLORS.has(value.toLowerCase())
}

function safeCssColor(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return DEFAULT_ACCENT_COLOR
  return trimmed.length <= 64 && isCssColor(trimmed) ? trimmed : DEFAULT_ACCENT_COLOR
}

/** Only self-contained raster/svg data URIs; <img> never executes SVG scripts. */
function safeLogoDataUri(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return /^data:image\/(png|jpeg|gif|webp|svg\+xml|avif);base64,[a-zA-Z0-9+/=]+$/.test(trimmed) ? trimmed : null
}

const CATEGORIES = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const

const ACCOUNT_LABEL: Record<Account['type'], string> = {
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

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtSignedMoney(value: number): string {
  return `${value > 0 ? '+' : ''}${fmtMoney(value)}`
}

function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

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

function table(headers: string[], rows: string[][]): string {
  return [
    '<table>',
    `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`,
    '</table>',
  ].join('')
}

function headlineSection(summary: ProjectionSummary, result: ProjectionResult): string {
  const lasts = summary.depletionYear === null ? `Full plan through ${result.endYear}` : `Depletes in ${summary.depletionYear}`
  const rows = [
    ['Ending net worth', fmtMoney(summary.endingNetWorth), `in ${result.endYear}`],
    ['Ending after-tax estate', fmtMoney(summary.endingAfterTaxEstate), 'net of heir tax on pre-tax balances'],
    ['Money lasts', escapeHtml(lasts), 'deterministic exact-ledger run'],
    ['Lifetime tax + penalties', fmtMoney(summary.lifetimeTaxesAndPenalties), 'federal + state + penalties'],
    ['Lifetime Roth conversions', fmtMoney(summary.lifetimeRothConversions), 'executed by the ledger'],
    ['FI target', fmtMoney(summary.fiNumber), 'today-dollar portfolio target'],
  ]
  return `<section><h2>Headline results</h2>${table(['Metric', 'Value', 'Notes'], rows)}</section>`
}

function householdSection(plan: Plan): string {
  return `<section><h2>Household</h2>${table(
    ['Person', 'Date of birth', 'Retirement age', 'Planning age'],
    plan.household.people.map((p) => [
      escapeHtml(p.name),
      escapeHtml(p.dob),
      escapeHtml(p.retirementAge ?? '-'),
      escapeHtml(p.longevity.planningAge),
    ]),
  )}</section>`
}

function accountsSection(plan: Plan): string {
  const rows = plan.accounts.map((a) => [
    escapeHtml(a.name),
    escapeHtml(ACCOUNT_LABEL[a.type]),
    escapeHtml(ownerName(plan, a.ownerPersonId)),
    fmtMoney(accountBalance(a)),
    escapeHtml('annualReturnPct' in a && a.annualReturnPct !== null ? `${a.annualReturnPct}%` : 'default'),
  ])
  return `<section><h2>Accounts</h2>${table(['Account', 'Type', 'Owner', 'Balance', 'Return'], rows)}</section>`
}

function incomeSection(plan: Plan): string {
  return `<section><h2>Income</h2>${table(
    ['Source', 'Detail'],
    plan.incomes.map((stream) => [escapeHtml(incomeLabel(plan, stream)), escapeHtml(incomeDetail(stream))]),
  )}</section>`
}

function assumptionsSection(plan: Plan): string {
  const rows = [
    ['General inflation', fmtPct(plan.assumptions.inflationPct)],
    ['Healthcare extra inflation', fmtPct(plan.assumptions.healthcareExtraInflationPct)],
    ['Default return', fmtPct(plan.assumptions.defaultReturnPct)],
    ['Safe withdrawal rate', fmtPct(plan.assumptions.safeWithdrawalRatePct ?? 4)],
    ['State effective tax override', fmtPct(plan.assumptions.stateEffectiveTaxPct)],
    ['Local income tax', fmtPct(plan.assumptions.localIncomeTaxPct)],
    ['Heir tax rate', fmtPct(plan.assumptions.heirTaxRatePct, 0)],
    ['Roth conversions', escapeHtml(conversionSummary(plan))],
    ['Withdrawal order', escapeHtml(withdrawalSummary(plan))],
    ['Spending policy', escapeHtml(spendingPolicySummary(plan))],
    ['Federal parameter pack', `${LATEST_PACK_YEAR}`],
    ['State parameter pack', `${LATEST_STATE_PACK_YEAR}`],
    ['Parameter data as of', escapeHtml(PARAMETER_DATA_AS_OF)],
    ['Parameter data basis', escapeHtml(PARAMETER_DATA_BASIS)],
  ]
  return `<section><h2>Assumptions and provenance</h2>${table(['Assumption', 'Value'], rows)}</section>`
}

function warningsSection(result: ProjectionResult): string {
  if (result.warnings.length === 0) return ''
  return `<section><h2>Modeling notes</h2><ul>${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul></section>`
}

function provenanceSection(): string {
  return `<section><h2>Parameter source appendix</h2>${table(
    ['Group', 'Figures', 'Publisher', 'Source'],
    PARAMETER_PROVENANCE.map((source) => [
      escapeHtml(source.label),
      escapeHtml(source.figures),
      escapeHtml(source.publisher),
      `<a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>`,
    ]),
  )}</section>`
}

function recommendationSection(evidence: ReportRecommendationEvidence | null | undefined): string {
  if (!evidence) return ''
  const validation = evidence.validation
  const summaryRows = [
    ['Objective', escapeHtml(evidence.objectiveLabel)],
    ['Winner source', escapeHtml(evidence.winnerSource)],
    ['Winner', escapeHtml(evidence.winnerLabel)],
    ['Recommendation state', escapeHtml(evidence.recommendationState)],
  ]
  if (validation) {
    summaryRows.push(
      ['Baseline after-tax estate', fmtMoney(validation.baseline.endingAfterTaxEstate)],
      ['Candidate after-tax estate', fmtMoney(validation.candidate.endingAfterTaxEstate)],
      ['After-tax estate delta', fmtSignedMoney(validation.afterTaxEstateDelta)],
      ['Lifetime tax delta', fmtSignedMoney(validation.lifetimeTaxDelta)],
      ['Money-lasts delta', `${validation.moneyLastsYearsDelta > 0 ? '+' : ''}${validation.moneyLastsYearsDelta} year(s)`],
      ['Requested conversions', fmtMoney(validation.requestedConversionTotal)],
      ['Executed conversions', `${fmtMoney(validation.executedConversionTotal)} (${Math.round(validation.executedConversionRatio * 100)}%)`],
    )
    if (validation.firstMateriallyUnexecutedYear !== null) {
      summaryRows.push(['First material execution shortfall', `${validation.firstMateriallyUnexecutedYear}`])
    }
  }
  if (evidence.claimAge) {
    const claim = evidence.claimAge
    summaryRows.push(
      ['SS claim combinations optimized', `${claim.combinationsEvaluated}`],
      [
        'Recommended Social Security claim change',
        escapeHtml(claim.winningClaimLabel ?? 'None - current claim ages held'),
      ],
    )
    if (claim.winningClaimLabel !== null) {
      summaryRows.push(
        ['Joint (claim + conversions) after-tax estate', fmtMoney(claim.jointExactEstate)],
        ['Best current-claim after-tax estate', fmtMoney(claim.currentClaimExactEstate)],
        ['Claim-change estate gain', fmtSignedMoney(claim.jointExactEstate - claim.currentClaimExactEstate)],
      )
    }
  }
  const candidateRows = evidence.candidates.map((candidate) => [
    escapeHtml(candidate.label),
    fmtSignedMoney(candidate.afterTaxEstateDelta),
    fmtSignedMoney(candidate.lifetimeTaxDelta),
    `${candidate.moneyLastsYearsDelta > 0 ? '+' : ''}${candidate.moneyLastsYearsDelta}`,
    escapeHtml(candidate.lossReason),
  ])
  return `<section><h2>Recommendation evidence</h2>${table(['Field', 'Value'], summaryRows)}${
    candidateRows.length > 0
      ? `<h3>Candidate loss reasons</h3>${table(['Candidate', 'Estate delta', 'Tax delta', 'Years delta', 'Reason'], candidateRows)}`
      : ''
  }</section>`
}

function appendixSection(result: ProjectionResult): string {
  const rowFor = (y: YearResult) => [
    `${y.year}`,
    fmtMoney(y.incomes.total),
    fmtMoney(y.expenses.total),
    fmtMoney(y.contributions),
    fmtMoney(y.rmd),
    fmtMoney(y.rothConversion),
    fmtMoney(y.tax + y.penalties),
    fmtMoney(y.magi),
    fmtMoney(y.withdrawals.total),
    fmtMoney(y.investableTotal),
    fmtMoney(y.netWorth),
  ]
  return `<section><h2>Year-by-year ledger appendix</h2>${table(
    ['Year', 'Income', 'Expenses', 'Contrib.', 'RMD', 'Roth conv.', 'Tax + penalties', 'MAGI', 'Withdrawals', 'Investable', 'Net worth'],
    result.years.map(rowFor),
  )}</section>`
}

function balanceChartData(plan: Plan, result: ProjectionResult): string {
  const rows = result.years.map((year) => {
    const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<(typeof CATEGORIES)[number], number>
    for (const account of plan.accounts) {
      if ((CATEGORIES as readonly string[]).includes(account.type)) {
        categories[account.type as (typeof CATEGORIES)[number]] += year.balances[account.id] ?? 0
      }
    }
    return [
      year.year,
      ...CATEGORIES.map((category) => Math.round(categories[category])),
      Math.round(year.incomes.total),
      Math.round(year.expenses.total + year.tax + year.penalties),
    ].join(',')
  })
  return [
    ['year', ...CATEGORIES, 'income', 'spendingPlusTax'].join(','),
    ...rows,
  ].join('\n')
}

export function buildStandaloneReportHtml(input: StandaloneReportInput): string {
  const preparedAtIso = input.preparedAtIso ?? new Date().toISOString()
  const csvData = escapeHtml(balanceChartData(input.plan, input.result))
  const branding = input.branding ?? {}
  const productName = branding.productName?.trim() || DEFAULT_PRODUCT_NAME
  const accentColor = safeCssColor(branding.accentColor)
  const logoDataUri = safeLogoDataUri(branding.logoDataUri)
  const logoHtml = logoDataUri
    ? `<img class="report-logo" src="${escapeHtml(logoDataUri)}" alt="${escapeHtml(branding.logoAlt?.trim() || productName)}">\n`
    : ''
  const logoCss = logoDataUri ? '.report-logo { display: block; max-height: 56px; max-width: 280px; margin-bottom: 12px; }\n' : ''
  const footerNote = branding.footerNote?.trim()
  const footerNoteHtml = footerNote ? `\n<p class="muted">${escapeHtml(footerNote)}</p>` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.plan.name)} - ${escapeHtml(productName)} report</title>
<style>
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #12342b; background: #f7fbf8; }
body { margin: 0; }
main { max-width: 1040px; margin: 0 auto; padding: 32px 20px 56px; }
header { border-bottom: 3px solid ${accentColor}; margin-bottom: 24px; padding-bottom: 18px; }
${logoCss}h1 { font-size: 2rem; margin: 0 0 6px; }
h2 { border-bottom: 1px solid #cfe2d8; font-size: 1.25rem; margin: 32px 0 12px; padding-bottom: 6px; }
h3 { font-size: 1rem; margin: 18px 0 8px; }
p, li { line-height: 1.5; }
.muted { color: #577167; }
.disclaimer { background: #eef8f1; border: 1px solid #cfe2d8; border-radius: 8px; padding: 12px 14px; }
table { border-collapse: collapse; font-size: 0.9rem; margin: 10px 0 18px; width: 100%; }
th, td { border-bottom: 1px solid #dceae3; padding: 7px 8px; text-align: left; vertical-align: top; }
th { background: #eaf5ef; font-weight: 700; }
a { color: #087452; }
details { margin-top: 16px; }
pre { background: #f0f5f2; border: 1px solid #dceae3; border-radius: 8px; max-height: 220px; overflow: auto; padding: 10px; }
@media print { body { background: #fff; } main { padding: 0; } a { color: inherit; } }
</style>
</head>
<body>
<main>
<header>
${logoHtml}<h1>${escapeHtml(input.plan.name)}</h1>
<p class="muted">${escapeHtml(productName)} self-contained HTML report prepared ${escapeHtml(dateLabel(preparedAtIso))}. Projection start year: ${input.startYear}.</p>
</header>
<p class="disclaimer">Educational illustration only - not tax, legal, financial, or medical advice. Figures are projections based on the assumptions below and will differ from actual results.</p>
${headlineSection(input.summary, input.result)}
${recommendationSection(input.recommendationEvidence)}
${householdSection(input.plan)}
${accountsSection(input.plan)}
${incomeSection(input.plan)}
${assumptionsSection(input.plan)}
${warningsSection(input.result)}
${appendixSection(input.result)}
${provenanceSection()}
<details>
<summary>Embedded chart/automation data CSV</summary>
<pre>${csvData}</pre>
</details>${footerNoteHtml}
</main>
</body>
</html>`
}

function lossReasonForCandidate(
  tournament: ExactLedgerTournament,
  validation: ExactLedgerValidation | null,
  candidate: ExactLedgerTournament['candidates'][number],
): string {
  if (tournament.winnerCandidateId === candidate.id) return 'Selected exact-ledger winner.'
  if (candidate.afterTaxEstateDelta <= 1) return 'Did not improve after-tax estate over the current plan.'
  const benchmark = validation?.afterTaxEstateDelta ?? Math.max(0, ...tournament.candidates.map((row) => row.afterTaxEstateDelta))
  if (benchmark > candidate.afterTaxEstateDelta) return `Trailed the selected recommendation by ${fmtMoney(benchmark - candidate.afterTaxEstateDelta)}.`
  if (tournament.winnerSource === 'incumbent') return 'The current conversion strategy remained the best result found.'
  if (tournament.winnerSource === 'none') return 'No candidate cleared the recommendation threshold.'
  return 'Not selected under the active objective and guardrails.'
}

export function reportEvidenceFromOptimizeResult(result: OptimizeResult): ReportRecommendationEvidence {
  const tournament = result.tournament
  // Only the winning source's validation belongs on the report. winnerValidation is
  // set for 'milp'/'candidate' winners and intentionally null for 'incumbent'/'none';
  // do not fall back to the solver's cleanedValidation, which describes a schedule that
  // did not win and would mislabel a "no change" / incumbent result.
  const validation = tournament.winnerValidation ?? null
  const policy = objectivePolicies[tournament.policyId]
  const recommendationState = validation?.recommendationState ?? (tournament.winnerSource === 'incumbent' ? 'neutral' : 'none')
  const winnerLabel =
    tournament.winnerLabel ??
    (tournament.winnerSource === 'milp'
      ? "the solver's cleaned schedule"
      : tournament.winnerSource === 'incumbent'
        ? 'current plan strategy'
        : 'none')
  return {
    objectiveId: tournament.policyId,
    objectiveLabel: policy.label,
    recommendationState,
    winnerLabel,
    winnerSource: tournament.winnerSource,
    validation,
    candidates: tournament.candidates.map((candidate) => ({
      afterTaxEstateDelta: candidate.afterTaxEstateDelta,
      candidateId: candidate.id,
      label: candidate.label,
      lifetimeTaxDelta: candidate.lifetimeTaxDelta,
      lossReason: lossReasonForCandidate(tournament, validation, candidate),
      moneyLastsYearsDelta: candidate.moneyLastsYearsDelta,
    })),
    claimAge: result.claimAge?.enabled
      ? {
          combinationsEvaluated: result.claimAge.combinationsEvaluated,
          winningClaimLabel: result.claimAge.winningClaimLabel,
          jointExactEstate: result.claimAge.jointExactEstate,
          currentClaimExactEstate: result.claimAge.currentClaimExactEstate,
        }
      : null,
  }
}
