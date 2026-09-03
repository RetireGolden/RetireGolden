/**
 * Pure row-derivation selectors for `ResultsPage`: turn a projection `view`
 * (plus the day/nominal dollar toggle `adj`) into the exact row shapes the
 * balance, income, expense, and CSV-export views render. No React, no DOM —
 * every function here is a plain function of `view`/`plan`/`adj`, so
 * `ResultsPage` only wraps the call in `useMemo` and the row-building logic
 * is unit testable without mounting a component.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'
import { csvCell } from '../csvCell'
import type { ProjectionView } from '../projection'
import { inheritedEvidenceNote } from '../report/reportModel'
import { ACCOUNT_CATEGORIES, categoryBalances } from './accountCategories'
import { inheritedCsvColumnHeaders } from './inheritedCsv'
import { needsProfessionalConfirmation } from './professionalConfirmation'

/** Converts a nominal-dollar amount in `year` to the dollar basis the page currently shows (today's or nominal). */
export type DollarAdjuster = (year: number, value: number) => number

/** Plan accounts that publish inherited-IRA evidence rows (CSV column order). */
export function inheritedAccountIds(plan: Plan): string[] {
  return plan.accounts
    .filter(
      (account) =>
        (account.type === 'traditional' || account.type === 'roth') && account.inherited !== undefined,
    )
    .map((account) => account.id)
}

/** One year of the account-balance / income / spending chart data, in the page's chosen dollar basis. */
export function buildResultsRows(view: ProjectionView, plan: Plan, adj: DollarAdjuster) {
  return view.result.years.map((y) => {
    const cats = categoryBalances(plan, y)
    // The engine publishes `fiNumber` in today's dollars; the line is
    // plotted against nominal balances, so it rides the view's own
    // inflation helper rather than a second compounding written here.
    const nominalFiTarget = view.inflate(y.year, view.summary.fiNumber)
    return {
      year: y.year,
      ...Object.fromEntries(ACCOUNT_CATEGORIES.map((c) => [c, adj(y.year, cats[c])])),
      income: adj(y.year, y.incomes.total),
      spending: adj(y.year, y.expenses.total + y.tax + y.penalties),
      tax: adj(y.year, y.tax),
      magi: adj(y.year, y.magi),
      shortfall: adj(y.year, y.shortfall),
      investable: adj(y.year, y.investableTotal),
      fiTarget: adj(y.year, nominalFiTarget),
    }
  })
}

/** One year of the "income by source" chart data, in the page's chosen dollar basis. */
export function buildIncomeRows(view: ProjectionView, adj: DollarAdjuster) {
  return view.result.years.map((y) => ({
    year: y.year,
    wages: adj(y.year, y.incomes.wages),
    socialSecurity: adj(y.year, y.incomes.socialSecurity),
    pension: adj(y.year, y.incomes.pension),
    annuity: adj(y.year, y.incomes.annuity),
    tipsLadder: adj(y.year, y.incomes.tipsLadder),
    recurring: adj(y.year, y.incomes.recurring),
    oneTime: adj(y.year, y.incomes.oneTime),
    taxableYield: adj(y.year, y.incomes.taxableYield),
    taxExemptInterest: adj(y.year, y.incomes.taxExemptInterest),
  }))
}

/** One year of the "expenses by category" chart data, in the page's chosen dollar basis. */
export function buildExpenseRows(view: ProjectionView, adj: DollarAdjuster) {
  return view.result.years.map((y) => ({
    year: y.year,
    base: adj(y.year, y.expenses.baseSpending),
    healthcare: adj(y.year, y.expenses.healthcare),
    property: adj(y.year, y.expenses.propertyCosts),
    debt: adj(y.year, y.expenses.debtService),
    insurance: adj(y.year, y.expenses.insurancePremiums),
    care: adj(y.year, Math.max(0, y.expenses.careCost - y.expenses.ltcBenefit)),
    goals: adj(y.year, y.expenses.oneTimeGoals),
    taxes: adj(y.year, y.tax + y.penalties),
  }))
}

const LEDGER_CSV_COLUMNS = [
  'year', 'filingStatus', 'wages', 'socialSecurity', 'pension', 'annuity', 'tipsLadder', 'recurring', 'oneTimeIncome', 'taxableInterest', 'taxExemptInterest', 'ordinaryDividends', 'qualifiedDividends', 'taxableYield', 'totalIncome',
  'baseSpending', 'goals', 'debtService', 'propertyCosts', 'healthcare', 'insurancePremiums', 'careCost', 'ltcBenefit', 'requiredSpending', 'targetSpending', 'idealSpending', 'excessSpending', 'intendedSpending', 'totalExpenses', 'contributions', 'employerMatch', 'rmd', 'qcd',
  'rothConversion', 'tax', 'amt', 'penalties', 'magi', 'withdrawals', 'realizedGains', 'lossCarryforwardUsed', 'lossCarryforwardRemaining', 'shortfall', 'investable',
  'requiredShortfall', 'targetShortfall', 'idealShortfall', 'excessShortfall', 'guardrailAction', 'guardrailFactor', 'flexibleGoalsFunded', 'flexibleGoalsPartiallyFunded', 'flexibleGoalsDeferred', 'flexibleGoalsSkipped', 'flexibleGoalFundedAmount', 'flexibleGoalUnfundedAmount', 'insuranceCashValue', 'ladderValue', 'deathBenefit', 'netWorth',
] as const

function inheritedLedgerCsvValues(
  y: YearResult,
  inheritedIds: readonly string[],
): (string | number)[] {
  const byAccount = new Map((y.inheritedAccounts ?? []).map((row) => [row.accountId, row]))
  return inheritedIds.flatMap((id) => {
    const row = byAccount.get(id)
    if (!row) return ['', '', '', '', '', '']
    const confirm = needsProfessionalConfirmation(row) ? 'yes' : ''
    const note = csvCell(inheritedEvidenceNote(row))
    return [
      row.requiredAmount,
      row.executedRequiredAmount,
      row.voluntaryAmount,
      csvCell(row.requirementKind),
      csvCell(confirm),
      note,
    ]
  })
}

/**
 * The full year-by-year ledger CSV `ResultsPage`'s "Download CSV" button
 * offers — nominal dollars regardless of the page's today's/nominal toggle,
 * matching the engine's own units. Pure text; the caller owns the Blob/anchor
 * download mechanics.
 */
export function buildLedgerCsv(plan: Plan, view: ProjectionView): string {
  const inheritedIds = inheritedAccountIds(plan)
  // Per-account inherited columns, flattened in plan account order (same
  // convention as the rest of this ledger export).
  const inheritedCols = inheritedCsvColumnHeaders(inheritedIds)
  const cols = [...LEDGER_CSV_COLUMNS, ...inheritedCols]
  const lines = [cols.join(',')]
  for (const y of view.result.years) {
    const inheritedValues = inheritedLedgerCsvValues(y, inheritedIds)
    lines.push(
      [
        y.year, y.filingStatus, y.incomes.wages, y.incomes.socialSecurity, y.incomes.pension, y.incomes.annuity, y.incomes.tipsLadder, y.incomes.recurring,
        y.incomes.oneTime, y.incomes.taxableInterest, y.incomes.taxExemptInterest, y.incomes.ordinaryDividends, y.incomes.qualifiedDividends, y.incomes.taxableYield, y.incomes.total, y.expenses.baseSpending, y.expenses.oneTimeGoals, y.expenses.debtService,
        y.expenses.propertyCosts, y.expenses.healthcare, y.expenses.insurancePremiums, y.expenses.careCost, y.expenses.ltcBenefit, y.expenses.requiredSpending, y.expenses.targetSpending, y.expenses.idealSpending, y.expenses.excessSpending, y.expenses.intendedSpending, y.expenses.total, y.contributions, y.employerMatch, y.rmd, y.qcd, y.rothConversion, y.tax, y.amt, y.penalties,
        y.magi, y.withdrawals.total, y.realizedGains, y.capitalLossUsedAgainstGains + y.capitalLossUsedAgainstOrdinary, y.capitalLossCarryforwardRemaining, y.shortfall, y.investableTotal,
        y.requiredShortfall, y.targetShortfall, y.idealShortfall, y.excessShortfall, y.guardrailAction, y.expenses.guardrailFactor.toFixed(2), y.flexibleGoals.funded, y.flexibleGoals.partiallyFunded, y.flexibleGoals.deferred, y.flexibleGoals.skipped, y.flexibleGoals.fundedAmount, y.flexibleGoals.unfundedAmount, y.insuranceCashValue, y.ladderValue, y.deathBenefit, y.netWorth,
        ...inheritedValues,
      ]
        .map((v) => (typeof v === 'number' ? Math.round(v) : v))
        .join(','),
    )
  }
  return lines.join('\n')
}
