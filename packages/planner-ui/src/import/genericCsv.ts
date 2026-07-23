/**
 * Generic spreadsheet / RPM CSV import (onboarding-import-and-migration step 4).
 *
 * For everything without a recognized export: the Bogleheads Retiree Portfolio
 * Model saved as CSV, a homegrown net-worth spreadsheet, another tool's ad-hoc
 * dump. Two-phase: `analyzeGenericCsv` finds the header row and guesses a role
 * for each column; the wizard lets the user correct the roles; then
 * `draftPlanFromGenericCsv` maps rows to accounts with the shared review
 * checklist. Reuses the hardened CSV core from step 2.
 */

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'
import { parseCsv, parseMoney } from './csv'
import { mapProjectionLabAccountType } from './projectionLab'
import { csvRowLocator as csvRow } from './provenance'
import type { ImportReviewItem } from './reviewChecklist'

export type ColumnRole = 'name' | 'type' | 'balance' | 'costBasis' | 'contribution' | 'ignore'

export const COLUMN_ROLE_LABEL: Record<ColumnRole, string> = {
  name: 'Account name',
  type: 'Account type',
  balance: 'Balance / value',
  costBasis: 'Cost basis',
  contribution: 'Annual contribution',
  ignore: 'Ignore',
}

export interface GenericCsvAnalysis {
  header: string[]
  dataRows: string[][]
  /** One guessed role per header column; the wizard lets the user override. */
  guessedRoles: ColumnRole[]
  /**
   * 1-based parsed-row number for each `dataRows` entry (the header and any
   * leading title rows are skipped). Additive/optional so a hand-built analysis
   * stays valid; when absent, locators fall back to a header-relative estimate.
   */
  dataRowNumbers?: number[]
}

export type GenericCsvAnalysisResult = { ok: true; analysis: GenericCsvAnalysis } | { ok: false; message: string }

/** Guess a column's role from its header text. */
export function guessColumnRole(headerCell: string): ColumnRole {
  const h = headerCell.trim().toLowerCase()
  if (h === '') return 'ignore'
  if (/basis|cost/.test(h)) return 'costBasis'
  if (/contribut|saving|deposit/.test(h)) return 'contribution'
  if (/balance|value|amount|total|\$/.test(h)) return 'balance'
  if (/type|class|category|tax treatment/.test(h)) return 'type'
  if (/account|name|description|label|holding|asset/.test(h)) return 'name'
  return 'ignore'
}

/** True when the cell reads as data (money) rather than a label. */
function isMoneyish(cell: string): boolean {
  return parseMoney(cell) !== null
}

/**
 * Find the header row (the first row that is mostly non-numeric labels and is
 * followed by at least one row with a money-ish cell) and guess column roles.
 */
export function analyzeGenericCsv(text: string): GenericCsvAnalysisResult {
  const parsed = parseCsv(text)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const rows = parsed.rows

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const cells = rows[r]!
    const nonEmpty = cells.filter((c) => c.trim() !== '')
    if (nonEmpty.length < 2) continue
    if (nonEmpty.some(isMoneyish)) continue // data row, not a header
    const dataRows: string[][] = []
    const dataRowNumbers: number[] = []
    for (let k = r + 1; k < rows.length; k++) {
      if (rows[k]!.some(isMoneyish)) {
        dataRows.push(rows[k]!)
        dataRowNumbers.push(k + 1) // 1-based parsed-row number
      }
    }
    if (dataRows.length === 0) continue
    const guessedRoles = cells.map(guessColumnRole)
    // A usable table needs at least a name-ish and a money-ish column somewhere;
    // the user can still fix the guesses by hand.
    return { ok: true, analysis: { header: cells, dataRows, guessedRoles, dataRowNumbers } }
  }
  return {
    ok: false,
    message:
      'No header row followed by rows with dollar values was found. Save the sheet as CSV with one row per account and a header row (e.g. "Account, Type, Balance").',
  }
}

export interface GenericCsvDraft {
  plan: Plan
  review: ImportReviewItem[]
}

export type GenericCsvDraftResult = { ok: true } & GenericCsvDraft | { ok: false; message: string }

/**
 * Map data rows onto a draft plan using the (possibly user-corrected) column
 * roles. Rows without a readable balance are reported and skipped; account
 * types come from the type column when present, else from the name, else
 * default to taxable with a review item.
 */
export function draftPlanFromGenericCsv(
  analysis: GenericCsvAnalysis,
  roles: ColumnRole[],
  newId: () => string = () => crypto.randomUUID(),
): GenericCsvDraftResult {
  const nameCol = roles.indexOf('name')
  const balanceCol = roles.indexOf('balance')
  if (balanceCol === -1) {
    return { ok: false, message: 'Assign one column as the balance/value before importing.' }
  }
  const typeCol = roles.indexOf('type')
  const basisCol = roles.indexOf('costBasis')
  const contributionCol = roles.indexOf('contribution')

  /** Header text of a role's column, for the `column` on a row locator. */
  const columnFor = (col: number): string | undefined => (col >= 0 ? analysis.header[col] || undefined : undefined)
  const balanceColumn = columnFor(balanceCol)

  const review: ImportReviewItem[] = []
  const plan = createEmptyPlan({ newId, name: 'Imported from spreadsheet' })
  const ownerId = plan.household.people[0]!.id

  // Spreadsheet footers that re-state sums import as phantom accounts if kept.
  const totalRowRe = /^(sub)?total\b|grand total/i
  const loanLikeRe = /\bloan\b|debt|mortgage|heloc|liabilit|credit/i

  for (let r = 0; r < analysis.dataRows.length; r++) {
    const cells = analysis.dataRows[r]!
    // True parsed-row number when the analysis carries it; else a header-relative
    // estimate (header at row 1, first data row at row 2).
    const rowNumber = analysis.dataRowNumbers?.[r] ?? r + 2
    const name = (nameCol === -1 ? '' : (cells[nameCol] ?? '').trim()) || `Row ${r + 1}`
    const typeText = typeCol === -1 ? '' : (cells[typeCol] ?? '').trim()
    if (totalRowRe.test(name) || totalRowRe.test(typeText)) {
      review.push({
        status: 'skipped',
        source: name,
        detail: 'Summary/total row — counting it would double the money above it.',
        locator: csvRow(rowNumber, columnFor(nameCol) ?? balanceColumn),
        confidence: 'unmapped',
      })
      continue
    }
    const balance = parseMoney(cells[balanceCol])
    // A negative balance on a loan-looking row is a liability written with a
    // sign convention — import it as debt instead of dropping the row.
    const negativeLiability = balance !== null && balance < 0 && loanLikeRe.test(`${name} ${typeText}`)
    if ((balance === null || balance < 0) && !negativeLiability) {
      review.push({
        status: 'skipped',
        source: name,
        detail: 'Row had no readable non-negative balance.',
        locator: csvRow(rowNumber, balanceColumn),
        confidence: 'unmapped',
      })
      continue
    }
    const guessSource = typeText !== '' ? typeText : name
    const typeGuess = negativeLiability ? 'debt' : mapProjectionLabAccountType(typeText, name)
    const mapped = typeGuess ?? 'taxable'
    // 'exact' only when an explicit type column named the class; a keyword guess
    // off the name, or the taxable fallback, is 'assumed'.
    const typeFromColumn = typeGuess !== null && !negativeLiability && typeCol !== -1 && typeText !== ''
    const amount = Math.abs(balance!)

    const base = { id: newId(), name, annualReturnPct: null }
    const contribution = contributionCol === -1 ? null : parseMoney(cells[contributionCol])
    const annualContribution = contribution !== null && contribution > 0 ? contribution : 0

    let account: Account
    switch (mapped) {
      case 'taxable': {
        const basisRaw = basisCol === -1 ? null : parseMoney(cells[basisCol])
        // A negative basis cell (adjustment lines, sign conventions) must not
        // sink the whole import at validation — treat it like a missing basis.
        const basis = basisRaw !== null && basisRaw >= 0 ? basisRaw : null
        account = { ...base, type: 'taxable', ownerPersonId: null, balance: amount, costBasis: basis ?? amount, annualContribution }
        if (basis === null) {
          review.push({
            status: 'defaulted',
            source: name,
            detail:
              (basisRaw !== null && basisRaw < 0 ? 'The cost basis cell was negative, so it was ignored — ' : 'No cost basis column/value — ') +
              'basis was set equal to the balance (no unrealized gain). Correct it on the Accounts screen.',
            locator: csvRow(rowNumber, columnFor(basisCol) ?? balanceColumn),
            confidence: 'assumed',
          })
        }
        break
      }
      case 'traditional':
      case 'roth':
        account = {
          ...base,
          type: mapped,
          ownerPersonId: ownerId,
          kind: /401|403|457|tsp/i.test(guessSource) ? 'employer' : 'ira',
          balance: amount,
          annualContribution,
        }
        break
      case 'hsa':
        account = { ...base, type: 'hsa', ownerPersonId: ownerId, balance: amount, annualContribution }
        break
      case 'cash':
        account = { ...base, type: 'cash', ownerPersonId: null, balance: amount, annualContribution }
        break
      case 'property':
        account = { ...base, type: 'property', ownerPersonId: null, value: amount, plannedSaleYear: null, expectedNetProceeds: null }
        break
      case 'debt':
        account = { ...base, type: 'debt', ownerPersonId: null, balance: amount, interestPct: 5, monthlyPayment: 0 }
        if (negativeLiability) {
          review.push({
            status: 'defaulted',
            source: name,
            detail: `The negative balance looked like a liability sign convention — imported as a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} debt.`,
            locator: csvRow(rowNumber, balanceColumn),
            confidence: 'assumed',
          })
        }
        review.push({
          status: 'defaulted',
          source: name,
          detail: 'Debts need an interest rate and monthly payment — defaults of 5% and $0/mo were used; set the real terms on the Accounts screen.',
          locator: csvRow(rowNumber),
          confidence: 'assumed',
        })
        break
    }
    plan.accounts.push(account)
    review.push({
      status: typeGuess === null ? 'defaulted' : 'mapped',
      source: `${name}${typeText !== '' ? ` (${typeText})` : ''}`,
      detail:
        typeGuess === null
          ? `No recognizable account type — imported as a taxable account with a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} balance. Change the type on the Accounts screen if that is wrong.`
          : `Imported as a ${mapped} account with a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} balance.`,
      locator: csvRow(rowNumber, balanceColumn),
      confidence: typeFromColumn ? 'exact' : 'assumed',
    })
  }

  if (plan.accounts.length === 0) {
    return { ok: false, message: 'No rows with a readable balance were found with the current column assignment.' }
  }

  review.push({
    status: 'unmapped',
    source: 'Everything except accounts',
    detail: 'Spreadsheet rows import as account balances only — enter household, income, spending, and Social Security in the planner sections.',
    locator: { kind: 'none', note: 'spreadsheet rows carry only account balances, not household, income, spending, or Social Security' },
    confidence: 'unmapped',
  })

  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The mapped plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
