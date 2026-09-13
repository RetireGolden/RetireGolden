/**
 * Production HECM opening adapter: legacy quote-estimate delegates to
 * `hecmLineOpenings`; HUD-validated openings call the pure HUD helper with
 * case-year pack limits and fail closed on unknown year / missing MCA/MIP /
 * unverified PLF. Does not edit the legacy openings module.
 */
import { parseCivilIsoDate } from '../../actions/civilDate.js'
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { packForYear } from '../../params/index.js'
import {
  computeHecmHudValidatedOpening,
  priceHecmMonthlyMipFromOutstandingBalances,
  hecmCaseYearLimitsFromPack,
  type HecmCaseYearLimits,
} from '../hecmHudValidated.js'
import {
  hecmLineOpenings,
  type HecmLineOpeningRow,
  type HecmLineOpeningYearInput,
  type HecmLineState,
} from './hecmLineOpenings.js'
import { initializeHudObservedBaseline } from './hecmLineState.js'

/** HUD opening rows use the shared mutable line state, including evidence. */
export type HecmLineStateWithHudEvidence = HecmLineState

export interface HecmHudValidatedOpeningAdapterResult {
  readonly rows: readonly HecmLineOpeningRow[]
  readonly warnings: readonly string[]
}

function caseYearFromAccount(
  account: Extract<Account, { type: 'property' }>,
): number | 'unknown' {
  const line = account.hecm
  if (line === undefined || line.caseAssignmentDate === undefined) return 'unknown'
  const year = Number(line.caseAssignmentDate.slice(0, 4))
  return Number.isFinite(year) ? year : 'unknown'
}

function limitsMapForCaseYear(
  caseYear: number,
): ReadonlyMap<number, HecmCaseYearLimits> | null {
  const { pack, isStandIn } = packForYear(caseYear)
  if (isStandIn) return null
  const hecm = pack.hecm as ParameterPack['hecm'] & {
    maximumClaimAmount?: number
    initialMipPct?: number
    annualMipPct?: number
  }
  if (
    hecm.maximumClaimAmount === undefined ||
    hecm.initialMipPct === undefined ||
    hecm.annualMipPct === undefined
  ) {
    return null
  }
  return new Map([
    [
      caseYear,
      hecmCaseYearLimitsFromPack({
        hecm: {
          maximumClaimAmount: hecm.maximumClaimAmount,
          initialMipPct: hecm.initialMipPct,
          annualMipPct: hecm.annualMipPct,
        },
      }),
    ],
  ])
}

/**
 * Open HECM lines for the year. Legacy mode unchanged. HUD-validated accounts
 * use case-year pack MCA/MIP and verified PLF; unknown provenance fails closed.
 */
export function hecmLineOpeningsWithHudValidation(
  input: HecmLineOpeningYearInput,
): HecmHudValidatedOpeningAdapterResult {
  const warnings: string[] = []
  const legacyAccounts: Account[] = []
  const hudAccounts: Array<Extract<Account, { type: 'property' }>> = []

  for (const account of input.accounts) {
    if (account.type !== 'property' || account.hecm === undefined) {
      legacyAccounts.push(account)
      continue
    }
    if (account.hecm.calculationMode === 'hudValidated') {
      hudAccounts.push(account)
    } else {
      legacyAccounts.push(account)
    }
  }

  const legacyRows =
    legacyAccounts.length === 0
      ? []
      : hecmLineOpenings({
          ...input,
          accounts: legacyAccounts,
        })

  const hudRows: HecmLineOpeningRow[] = []
  const opened = new Set<string>()
  for (const account of hudAccounts) {
    if (input.openHecmLines.has(account.id) || opened.has(account.id)) continue
    const line = account.hecm!
    if (input.year !== Math.max(line.openYear, input.startYear)) continue
    const closing = line.closingDate === undefined ? null : parseCivilIsoDate(line.closingDate)
    const caseDate = line.caseAssignmentDate === undefined ? null : parseCivilIsoDate(line.caseAssignmentDate)
    if (closing === null || caseDate === null || line.closingDate! < line.caseAssignmentDate! || closing.year !== line.openYear) {
      warnings.push(`HECM HUD-validated opening for ${account.id} refused: valid chronological case and closing dates matching openYear are required.`)
      continue
    }
    if (closing.year < input.startYear) {
      warnings.push(`HECM HUD-validated opening for ${account.id} refused: a pre-projection loan needs an observed opening debt and principal-limit ledger.`)
      continue
    }
    const closingAdvance = line.closingDayBorrowerAdvance ?? 0
    if (closingAdvance > 0 && (
      line.closingDayBorrowerAdvanceTreatment === undefined ||
      line.closingDayBorrowerAdvanceTreatment === 'unknown' ||
      (line.closingDayBorrowerAdvanceTreatment === 'alreadyIncludedInStartingCash' &&
        line.closingDate! > `${input.startYear}-01-01`)
    )) {
      warnings.push(`HECM HUD-validated opening for ${account.id} refused: the closing advance must be identified as already included in starting cash or a new modeled cash receipt.`)
      continue
    }
    const caseYear = caseYearFromAccount(account)
    if (caseYear === 'unknown') {
      warnings.push(
        `HECM HUD-validated opening for ${account.id} refused: unknown case-assignment year.`,
      )
      continue
    }
    const limitsByCaseYear = limitsMapForCaseYear(caseYear)
    if (limitsByCaseYear === null) {
      warnings.push(
        `HECM HUD-validated opening for ${account.id} refused: unpublished or stand-in case-year MCA/MIP parameters for ${caseYear}.`,
      )
      continue
    }
    if (
      line.appraisedValue === undefined ||
      line.verifiedPrincipalLimitFactorPct === undefined ||
      line.principalLimitFactorProvenance === undefined ||
      (line.principalLimitFactorProvenance.kind !== 'quoted' &&
        line.principalLimitFactorProvenance.kind !== 'hudTableVerified') ||
      line.hudTransactionKind === undefined ||
      line.hudTransactionKind === 'unknown'
    ) {
      warnings.push(
        `HECM HUD-validated opening for ${account.id} refused: verified transaction kind, appraisal, and verified PLF provenance are required.`,
      )
      continue
    }
    const opening = computeHecmHudValidatedOpening({
      calculationMode: 'hudValidated',
      caseAssignmentYear: caseYear,
      closingDate: line.closingDate!,
      closingDayBorrowerAdvance: line.closingDayBorrowerAdvance ?? 0,
      appraisedValue: line.appraisedValue,
      otherClosingCosts: line.otherClosingCosts ?? 0,
      principalLimitFactor: {
        value: line.verifiedPrincipalLimitFactorPct / 100,
        provenance: line.principalLimitFactorProvenance.kind,
      },
      transactionKind: line.hudTransactionKind,
      limitsByCaseYear,
    })
    if (opening.status !== 'hudValidated') {
      warnings.push(
        `HECM HUD-validated opening for ${account.id} refused: ${opening.reason}.`,
      )
      continue
    }
    const youngestAge = Math.min(
      ...input.people.map((person) => input.year - input.dobYear(person)),
    )
    const warning =
      youngestAge < 62
        ? 'A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).'
        : null
    const state: HecmLineStateWithHudEvidence = {
      principalLimit: opening.initialPrincipalLimit,
      // A borrower advance posted at closing is debt before the first monthly
      // assessment; principal-limit availability and opening debt are distinct.
      loanBalance: opening.openingLoanBalance,
      calculationMode: 'hudValidated',
      maximumClaimAmount: opening.maximumClaimAmount,
      initialMip: opening.initialMip,
      otherClosingCosts: opening.otherClosingCosts,
      annualMipRate: opening.annualMipRate,
      caseParameterYear: opening.caseParameterYear,
      principalLimitFactorProvenance: line.principalLimitFactorProvenance.kind,
    }
    initializeHudObservedBaseline(state, opening.openingLoanBalance)
    opened.add(account.id)
    hudRows.push({
      propertyAccountId: account.id,
      state,
      warning,
      ...(closingAdvance > 0 && line.closingDayBorrowerAdvanceTreatment === 'disburseAtModeledClosing'
        ? { borrowerAdvanceCashReceipt: closingAdvance } : {}),
    })
  }

  return {
    rows: [...legacyRows, ...hudRows],
    warnings,
  }
}

export { accrueHecmAnnualMip } from '../hecm.js'
export { applyHudModeledDraw, cloneHecmLineStateForRollback } from './hecmLineState.js'

export type HecmAssessmentYearResult =
  | { readonly status: 'complete'; readonly totalMipAccrued: number; readonly endingLoanBalance: number }
  | { readonly status: 'timingEvidenceIncomplete'; readonly reason: string }

/**
 * HUD 4000.1 Update 18, origination p.593 and servicing p.1456: monthly
 * remittance is added to the outstanding balance. Assessment balances belong
 * to the servicer ledger, including intervening advances, note interest,
 * fees and prior MIP. An annual growth rate cannot reconstruct that sequence.
 */
export function priceHecmHudMipAssessmentYear(input: {
  readonly line: NonNullable<Extract<Account, { type: 'property' }>['hecm']>
  readonly year: number
  readonly annualMipRate: number
}): HecmAssessmentYearResult {
  const incomplete = (reason: string): HecmAssessmentYearResult => ({ status: 'timingEvidenceIncomplete', reason })
  const { line, year } = input
  const closing = line.closingDate === undefined ? null : parseCivilIsoDate(line.closingDate)
  if (closing === null || closing.year > year) return incomplete('Closing date is missing, invalid, or after this year.')
  // The cited HUD text does not choose intramonth proration. Even a perfectly
  // observed balance is insufficient to infer the first partial-month charge.
  if (closing.year === year && (closing.day !== 1 || line.firstMipPeriodConvention !== 'fullCalendarMonths')) {
    return incomplete('The closing period lacks a supported full-calendar-month MIP convention.')
  }
  const evidence = line.mipAssessmentLedgerEvidence
  const yearEnd = `${year}-12-31`
  if (evidence === undefined || parseCivilIsoDate(evidence.completeThroughDate) === null ||
      evidence.completeThroughDate < yearEnd || !evidence.noUnrepresentedTransactionsAfterLastAssessment ||
      parseCivilIsoDate(evidence.provenance.asOf) === null || evidence.provenance.source.trim().length === 0 || evidence.provenance.asOf < evidence.completeThroughDate) {
    return incomplete('The assessment ledger is not verified complete through year end.')
  }
  const rows = line.outstandingBalanceAtMipAssessmentByMonth
  if (rows === undefined) return incomplete('The monthly assessment ledger is missing.')
  const annual = rows.filter((row) => Number(row.assessmentDate.slice(0, 4)) === year)
  const firstMonth = closing.year === year ? closing.month : 1
  if (annual.length !== 13 - firstMonth) return incomplete('The year does not contain every required monthly assessment.')
  for (let index = 0; index < annual.length; index += 1) {
    const row = annual[index]!
    const date = parseCivilIsoDate(row.assessmentDate)
    if (date === null || date.month !== firstMonth + index || row.assessmentDate < line.closingDate! ||
        parseCivilIsoDate(row.provenance.asOf) === null || row.provenance.source.trim().length === 0 || row.provenance.asOf < row.assessmentDate ||
        row.provenance.asOf > evidence.provenance.asOf) {
      return incomplete('Assessment dates, order, monthly coverage, or observation provenance are invalid.')
    }
  }
  const mip = priceHecmMonthlyMipFromOutstandingBalances({
    annualMipRate: input.annualMipRate,
    closingDate: line.closingDate!,
    assessments: annual,
  })
  if (mip.status !== 'ok') return incomplete('The supplied monthly balance or MIP rate is invalid.')
  return {
    status: 'complete', totalMipAccrued: mip.totalMipAccrued,
    endingLoanBalance: mip.postedBalances.at(-1)!,
  }
}
