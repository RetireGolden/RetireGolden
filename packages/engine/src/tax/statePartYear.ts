/**
 * A year split between states: which part of the year's income each state's
 * slice receives. Pricing is in tax/stateTax.ts; this file only allocates.
 *
 * The rule (DOCS/calculations/taxes/state-enacted-tax-year-figures.md, part-year
 * residents):
 * - A dated row (a distribution or QCD transfer with a date in the year) goes
 *   whole into the slice holding its month.
 * - Social Security goes by the months it is paid inside each slice, when the
 *   recipient's paid months are known.
 * - Everything else is spread by months: the undated lumps (withdrawals, RMDs,
 *   Roth conversions, one-time income, sales and gains), and pensions,
 *   annuities and wages, which the projection pays for whole years, so the
 *   months they pay are all twelve.
 * - A row split between slices scales its amounts together.
 *
 * The plan carries the month of a move, not the day, so the slices are whole
 * months: a state that prorates by days is priced by months.
 */
import type { TaxYearInput } from '../projection/types.js'
import type {
  StateHouseholdTaxFacts,
  StateQcdEventFacts,
  StateRetirementDistributionFact,
} from './stateRetirementFacts.js'

/** One state's months of a split year, numbered 1 to 12 in calendar order. */
export interface ResidencySpan {
  state: string
  months: number
  first: number
  last: number
}

/**
 * The residency segments as month spans, in the order given: the projection
 * lists the state left first and the state moved to second
 * (model/plan.ts#stateResidencySegmentsForYear).
 */
export function residencySpans(segments: readonly { state: string; months: number }[]): ResidencySpan[] {
  const spans: ResidencySpan[] = []
  let next = 1
  for (const segment of segments) {
    const months = Math.min(13 - next, Math.max(0, segment.months))
    if (months > 0) spans.push({ state: segment.state, months, first: next, last: next + months - 1 })
    next += Math.max(0, months)
  }
  return spans
}

/** The month (1 to 12) of a civil date in `year`, or 0 when it is not one. */
function monthIn(year: number, date: string | undefined): number {
  const month = date?.startsWith(`${year}-`) ? Number(date.slice(5, 7)) : 0
  return month >= 1 && month <= 12 ? month : 0
}

/** The share of an amount dated `date` (or undated) that falls in the span. */
export function spanShare(span: ResidencySpan, year: number, date: string | undefined): number {
  const month = monthIn(year, date)
  if (month === 0) return span.months / 12
  return month >= span.first && month <= span.last ? 1 : 0
}

/**
 * The span's share of the year's Social Security: each recipient's benefits by
 * the months they are paid in the span (the last `paidMonths` of the year),
 * weighted by the benefits. Without paid months, by the span's months.
 */
function socialSecurityShare(span: ResidencySpan, facts: StateHouseholdTaxFacts | undefined): number {
  let gross = 0
  let inSpan = 0
  for (const row of facts?.recipientSocialSecurity ?? []) {
    const amount = Math.max(0, row.grossSocialSecurity)
    const paid = Math.min(12, Math.max(1, row.paidMonths ?? 12))
    gross += amount
    inSpan += amount * Math.max(0, span.last - Math.max(span.first, 13 - paid) + 1) / paid
  }
  return gross > 0 ? inSpan / gross : span.months / 12
}

const ROW_AMOUNTS = [
  'federallyIncludedAmount',
  'grossDistribution',
  'rothConversionAmount',
  'rothConversionAmountAtAge59HalfOrOlder',
  'taxableSocialSecurityAllocated',
] as const
const QCD_AMOUNTS = [
  'grossIraDistribution',
  'directCharityTransfer',
  'federalExcludedAmount',
  'federalTaxableAmount',
  'federalBasisAllocated',
  'otherwiseTaxableAmount',
] as const

/** A row's amounts times `share`, together; its identity and facts kept. */
function scaled<T extends object>(row: T, keys: readonly string[], share: number): T {
  const out = { ...row } as Record<string, unknown>
  for (const key of keys) {
    const value = out[key]
    if (typeof value === 'number') out[key] = value * share
  }
  return out as T
}

/** Federal AGI items: ordinary income, qualified dividends, net gains and taxable Social Security. */
export function federalAgiItems(input: TaxYearInput, taxableSocialSecurity: number): number {
  return Math.max(0, input.ordinaryIncome) + Math.max(0, input.qualifiedDividends ?? 0) +
    Math.max(0, input.capitalGains) + Math.max(0, taxableSocialSecurity)
}

/**
 * The year's federal AGI items before Social Security, less the dated rows:
 * the income the slices take by their months.
 */
export function undatedIncome(input: TaxYearInput, rows: readonly StateRetirementDistributionFact[] | undefined): number {
  let dated = 0
  for (const row of rows ?? []) {
    if (monthIn(input.year, row.distributionDate) > 0) dated += Math.max(0, row.federallyIncludedAmount)
  }
  return Math.max(0, federalAgiItems(input, 0) - dated)
}

/** The part of a split year one state's slice receives. */
export interface SplitYearSlice {
  span: ResidencySpan
  /** The span's months over twelve: the share of income spread by months. */
  even: number
  /** The year's input with the slice's income, for the slice's state, unsplit. */
  input: TaxYearInput
  /** The characterized rows received in the span, scaled; undefined when the year has none. */
  rows: StateRetirementDistributionFact[] | undefined
  qcdEvents: StateQcdEventFacts[] | undefined
  taxableSocialSecurity: number
  /** Federal AGI items received in the span. */
  federalAgiItems: number
  /** The span's share of the year's retirement income (by months when there is none). */
  retirementShare: number
}

/**
 * Allocate the year's income to one span. `rows` and `qcdEvents` are the
 * year's; `annualTaxableSocialSecurity` is the federal figure for the whole
 * year, apportioned here as the benefits are.
 */
export function allocateSplitYear(
  input: TaxYearInput,
  span: ResidencySpan,
  rows: readonly StateRetirementDistributionFact[] | undefined,
  qcdEvents: readonly StateQcdEventFacts[] | undefined,
  facts: StateHouseholdTaxFacts | undefined,
  annualTaxableSocialSecurity: number,
): SplitYearSlice {
  const even = span.months / 12
  const year = input.year
  let ordinaryShift = 0
  let retirementYear = 0
  let retirementSpan = 0
  const sliceRows = rows?.flatMap((row) => {
    const share = spanShare(span, year, row.distributionDate)
    const amount = Math.max(0, row.federallyIncludedAmount)
    ordinaryShift += (share - even) * amount
    retirementYear += amount
    retirementSpan += share * amount
    return share > 0 ? [scaled(row, ROW_AMOUNTS, share)] : []
  })
  const sliceQcd = qcdEvents?.flatMap((event) => {
    const share = spanShare(span, year, event.transferDate)
    return share > 0 ? [scaled(event, QCD_AMOUNTS, share)] : []
  })
  const ss = socialSecurityShare(span, facts)
  const part = (amount: number | undefined) => (amount === undefined ? undefined : amount * even)
  const sliceInput: TaxYearInput = {
    ...input,
    state: span.state,
    stateResidency: undefined,
    ordinaryIncome: Math.max(0, input.ordinaryIncome * even + ordinaryShift),
    capitalGains: input.capitalGains * even,
    realizedCapitalGainsBeforeCarryforward: part(input.realizedCapitalGainsBeforeCarryforward),
    taxableInterestIncome: part(input.taxableInterestIncome),
    taxExemptInterest: part(input.taxExemptInterest),
    foreignExclusionAddback: part(input.foreignExclusionAddback),
    usGovernmentInterest: part(input.usGovernmentInterest),
    ordinaryDividends: part(input.ordinaryDividends),
    qualifiedDividends: part(input.qualifiedDividends),
    ssBenefits: input.ssBenefits * ss,
    retirementIncome: part(input.retirementIncome),
    privateRetirementIncome: part(input.privateRetirementIncome),
    publicPensionIncome: part(input.publicPensionIncome),
  }
  const taxableSocialSecurity = annualTaxableSocialSecurity * ss
  return {
    span,
    even,
    input: sliceInput,
    rows: sliceRows,
    qcdEvents: sliceQcd,
    taxableSocialSecurity,
    federalAgiItems: federalAgiItems(sliceInput, taxableSocialSecurity),
    retirementShare: retirementYear > 0 ? retirementSpan / retirementYear : even,
  }
}
