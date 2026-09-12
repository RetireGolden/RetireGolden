/** HUD-validated HECM MCA / principal-limit / MIP arithmetic. */
import { parseCivilIsoDate } from '../actions/civilDate.js'

export type HecmCalculationMode = 'legacyQuoteEstimate' | 'hudValidated'

export interface HecmCaseYearLimits {
  readonly maximumClaimAmount: number
  readonly initialMipRate: number
  readonly annualMipRate: number
}

export function hecmCaseYearLimitsFromPack(pack: { readonly hecm: { readonly maximumClaimAmount: number; readonly initialMipPct: number; readonly annualMipPct: number } }): HecmCaseYearLimits {
  return { maximumClaimAmount: pack.hecm.maximumClaimAmount, initialMipRate: pack.hecm.initialMipPct / 100, annualMipRate: pack.hecm.annualMipPct / 100 }
}

export interface HecmHudValidatedOpeningInput {
  readonly calculationMode: HecmCalculationMode
  readonly transactionKind: 'ordinaryOrigination' | 'purchase' | 'refinance' | 'unknown'
  /** Case assignment selects the MCA pack; it is not the MIP-accrual date. */
  readonly caseAssignmentYear: number | 'unknown'
  /** Closing starts MIP accrual and must not be substituted by the case year. */
  readonly closingDate: string | 'unknown'
  readonly appraisedValue: number
  readonly principalLimitFactor: { readonly value: number; readonly provenance: 'quoted' | 'hudTableVerified' } | 'unverified'
  readonly limitsByCaseYear: ReadonlyMap<number, HecmCaseYearLimits>
  readonly otherClosingCosts?: number
  /** A verified borrower disbursement posted on the closing date, not a cost. */
  readonly closingDayBorrowerAdvance?: number
}

export type HecmHudValidatedOpeningResult =
  | { readonly status: 'legacyQuoteEstimate'; readonly reason: 'calculationModeIsLegacy' }
  | { readonly status: 'missingAuthority'; readonly reason: 'unknownCaseAssignmentYear' | 'unpublishedCaseYearCeiling' | 'unverifiedPrincipalLimitFactor' | 'invalidAppraisal' | 'invalidPrincipalLimitFactor' | 'invalidCaseYearLimits' | 'invalidOtherClosingCosts' | 'invalidClosingDayBorrowerAdvance' | 'unknownClosingDate' | 'invalidClosingDate' | 'unsupportedTransactionKind' }
  | { readonly status: 'hudValidated'; readonly maximumClaimAmount: number; readonly initialPrincipalLimit: number; readonly initialMip: number; readonly otherClosingCosts: number; readonly closingDayBorrowerAdvance: number; readonly openingLoanBalance: number; readonly annualMipRate: number; readonly caseParameterYear: number; readonly closingDate: string }

function limitsAreValid(limits: HecmCaseYearLimits): boolean {
  return Number.isFinite(limits.maximumClaimAmount) && limits.maximumClaimAmount > 0 && Number.isFinite(limits.initialMipRate) && limits.initialMipRate >= 0 && limits.initialMipRate <= 1 && Number.isFinite(limits.annualMipRate) && limits.annualMipRate >= 0 && limits.annualMipRate <= 1
}

export function computeHecmHudValidatedOpening(input: Readonly<HecmHudValidatedOpeningInput>): HecmHudValidatedOpeningResult {
  if (input.calculationMode !== 'hudValidated') return { status: 'legacyQuoteEstimate', reason: 'calculationModeIsLegacy' }
  if (input.transactionKind !== 'ordinaryOrigination') return { status: 'missingAuthority', reason: 'unsupportedTransactionKind' }
  if (input.caseAssignmentYear === 'unknown') return { status: 'missingAuthority', reason: 'unknownCaseAssignmentYear' }
  if (input.closingDate === 'unknown') return { status: 'missingAuthority', reason: 'unknownClosingDate' }
  if (parseCivilIsoDate(input.closingDate) === null) return { status: 'missingAuthority', reason: 'invalidClosingDate' }
  const limits = input.limitsByCaseYear.get(input.caseAssignmentYear)
  if (limits === undefined) return { status: 'missingAuthority', reason: 'unpublishedCaseYearCeiling' }
  if (!limitsAreValid(limits)) return { status: 'missingAuthority', reason: 'invalidCaseYearLimits' }
  if (input.principalLimitFactor === 'unverified') return { status: 'missingAuthority', reason: 'unverifiedPrincipalLimitFactor' }
  const plf = input.principalLimitFactor.value
  if (!Number.isFinite(plf) || plf <= 0 || plf > 1) return { status: 'missingAuthority', reason: 'invalidPrincipalLimitFactor' }
  if (!Number.isFinite(input.appraisedValue) || input.appraisedValue <= 0) return { status: 'missingAuthority', reason: 'invalidAppraisal' }
  const otherClosingCosts = input.otherClosingCosts ?? 0
  if (!Number.isFinite(otherClosingCosts) || otherClosingCosts < 0) return { status: 'missingAuthority', reason: 'invalidOtherClosingCosts' }
  const closingDayBorrowerAdvance = input.closingDayBorrowerAdvance ?? 0
  if (!Number.isFinite(closingDayBorrowerAdvance) || closingDayBorrowerAdvance < 0) return { status: 'missingAuthority', reason: 'invalidClosingDayBorrowerAdvance' }
  const maximumClaimAmount = Math.min(input.appraisedValue, limits.maximumClaimAmount)
  const initialPrincipalLimit = maximumClaimAmount * plf
  const initialMip = maximumClaimAmount * limits.initialMipRate
  return { status: 'hudValidated', maximumClaimAmount, initialPrincipalLimit, initialMip, otherClosingCosts, closingDayBorrowerAdvance, openingLoanBalance: initialMip + otherClosingCosts + closingDayBorrowerAdvance, annualMipRate: limits.annualMipRate, caseParameterYear: input.caseAssignmentYear, closingDate: input.closingDate }
}

export type HecmSimpleAnnualMipResult = | { readonly status: 'ok'; readonly amount: number } | { readonly status: 'invalidInput'; readonly amount: null }

/** A pre-timing check only; it is not annual HUD servicing capitalization. */
export function hecmAnnualMipOnOutstandingBalance(outstandingBalance: number, annualMipRate: number): HecmSimpleAnnualMipResult {
  if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0 || !Number.isFinite(annualMipRate) || annualMipRate < 0) return { status: 'invalidInput', amount: null }
  return { status: 'ok', amount: outstandingBalance * annualMipRate }
}

export interface HecmMonthlyMipAssessment {
  readonly assessmentDate: string
  /** Contractually sequenced balance immediately before this MIP assessment. */
  readonly outstandingBalanceBeforeMip: number
}

export interface HecmMonthlyOutstandingBalanceMipInput {
  readonly closingDate: string | 'unknown'
  readonly annualMipRate: number
  /** Caller owns advance/interest/fees/repayment ordering before each assessment. */
  readonly assessments: readonly Readonly<HecmMonthlyMipAssessment>[]
}

export type HecmMonthlyOutstandingBalanceMipResult =
  | { readonly status: 'ok'; readonly totalMipAccrued: number; readonly monthlyMip: readonly number[]; readonly postedBalances: readonly number[] }
  | { readonly status: 'invalidInput'; readonly totalMipAccrued: 0; readonly monthlyMip: readonly []; readonly postedBalances: readonly [] }
  | { readonly status: 'timingEvidenceIncomplete'; readonly reason: 'unknownClosingDate' | 'invalidClosingDate' | 'invalidAssessmentDate' | 'assessmentBeforeClosing' | 'unorderedAssessments'; readonly totalMipAccrued: 0; readonly monthlyMip: readonly []; readonly postedBalances: readonly [] }

function comparableDate(date: string): number | null {
  const parsed = parseCivilIsoDate(date)
  return parsed === null ? null : parsed.year * 10_000 + parsed.month * 100 + parsed.day
}

/**
 * Handbook 4000.1 Update 18 requires one-twelfth of annual MIP on the
 * outstanding balance and its remittance to be added to that balance.  The
 * caller supplies the dated pre-MIP balances because the Handbook passages do
 * not choose intramonth ordering for advances, interest, fees, or repayments.
 */
export function priceHecmMonthlyMipFromOutstandingBalances(input: Readonly<HecmMonthlyOutstandingBalanceMipInput>): HecmMonthlyOutstandingBalanceMipResult {
  if (!Number.isFinite(input.annualMipRate) || input.annualMipRate < 0 || input.assessments.some((assessment) => !Number.isFinite(assessment.outstandingBalanceBeforeMip) || assessment.outstandingBalanceBeforeMip < 0)) return { status: 'invalidInput', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
  if (input.closingDate === 'unknown') return { status: 'timingEvidenceIncomplete', reason: 'unknownClosingDate', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
  const closing = comparableDate(input.closingDate)
  if (closing === null) return { status: 'timingEvidenceIncomplete', reason: 'invalidClosingDate', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
  let priorAssessment: number | null = null
  for (const assessment of input.assessments) {
    const date = comparableDate(assessment.assessmentDate)
    if (date === null) return { status: 'timingEvidenceIncomplete', reason: 'invalidAssessmentDate', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
    if (date < closing) return { status: 'timingEvidenceIncomplete', reason: 'assessmentBeforeClosing', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
    if (priorAssessment !== null && date <= priorAssessment) return { status: 'timingEvidenceIncomplete', reason: 'unorderedAssessments', totalMipAccrued: 0, monthlyMip: [], postedBalances: [] }
    priorAssessment = date
  }
  const monthlyRate = input.annualMipRate / 12
  const monthlyMip = input.assessments.map((assessment) => assessment.outstandingBalanceBeforeMip * monthlyRate)
  return { status: 'ok', totalMipAccrued: monthlyMip.reduce((sum, amount) => sum + amount, 0), monthlyMip, postedBalances: input.assessments.map((assessment, index) => assessment.outstandingBalanceBeforeMip + monthlyMip[index]!) }
}
