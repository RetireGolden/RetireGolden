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
import { csvRowLocator as csvRow, type SourceLocator } from './provenance'
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
   * 1-based spreadsheet row for each `dataRows` entry: the number a person
   * sees beside the row (`parseCsv`'s `sourceLines`: blank lines count, a
   * line break inside a quoted cell does not). Additive/optional so a hand-built analysis
   * stays valid; when absent, locators fall back to a header-relative estimate.
   */
  dataRowNumbers?: number[]
  /**
   * Rows below the header that carry text but no money-ish cell anywhere: a
   * balance typed as words, an account whose amount cell is blank, a note or
   * footer line. The analyzer cannot tell those apart, so it sorts none of
   * them: every one is set aside here, shown on the map step by spreadsheet row,
   * and reported as skipped by `draftPlanFromGenericCsv` — never dropped in
   * silence (#557). Additive so a hand-built analysis stays valid.
   */
  skippedRows?: SkippedCsvRow[]
}

export interface SkippedCsvRow {
  /** 1-based spreadsheet row, like `dataRowNumbers`: what the person sees beside it. */
  rowNumber: number
  cells: string[]
}

/** Spreadsheet footers that re-state sums import as phantom accounts if kept. */
const TOTAL_ROW_RE = /^(sub)?total\b|grand total/i

/**
 * How many set-aside rows a surface lists one by one before saying "and N
 * more": the map step (the preview above it shows five data rows) and the
 * text-only failure message. A sheet can carry thousands of note lines
 * (`MAX_CSV_ROWS` is 20,000), and every one is still counted.
 */
export const MAX_SET_ASIDE_LISTED = 10
/** Per-row checklist entries before the rest fold into one summary entry. */
export const MAX_SET_ASIDE_ITEMS = 25

/**
 * Longest a cell is echoed back to the person, on the map step and in a
 * checklist label: enough to recognise the row, never a megabyte cell as a
 * DOM node. Longer text ends in an ellipsis.
 */
export const MAX_CELL_PREVIEW_CHARS = 40

/** Cells echoed per row before an ellipsis stands for the rest, so a wide row stays one line of preview. */
export const MAX_CELLS_PREVIEWED = 6

/**
 * " (rows 12 to 16)" for rows the person could scan as one block, "" when
 * they are scattered among rows that did import: a range would then name
 * rows that were not set aside at all.
 */
export function setAsideRange(rows: readonly SkippedCsvRow[]): string {
  if (rows.length < 2) return ''
  const contiguous = rows.every((row, i) => i === 0 || row.rowNumber === rows[i - 1].rowNumber + 1)
  return contiguous ? ` (rows ${rows[0].rowNumber} to ${rows[rows.length - 1].rowNumber})` : ''
}

/** "Row 3: I-bonds; Row 4: Prepared by Chase; and 12 more (rows 5 to 16)": the first `limit` rows spelled out. */
export function describeSetAsideRows(rows: readonly SkippedCsvRow[], limit = MAX_SET_ASIDE_LISTED): string {
  const shown = rows.slice(0, limit).map((row) => `Row ${row.rowNumber}: ${describeCsvRowCells(row)}`)
  const rest = rows.slice(limit)
  if (rest.length > 0) shown.push(`and ${rest.length} more${setAsideRange(rest)}`)
  return shown.join('; ')
}

/** A cell as it is echoed back: trimmed and bounded. */
export function previewCell(cell: string): string {
  const trimmed = cell.trim()
  return trimmed.length > MAX_CELL_PREVIEW_CHARS ? `${trimmed.slice(0, MAX_CELL_PREVIEW_CHARS - 1)}…` : trimmed
}

/**
 * The row's text cells, in order, for showing which spreadsheet line is
 * meant: each cell bounded, and at most `MAX_CELLS_PREVIEWED` of them, so the
 * preview is bounded per row as well as per cell.
 */
export function describeCsvRowCells(row: SkippedCsvRow): string {
  const text = row.cells.map(previewCell).filter((c) => c !== '')
  const shown = text.slice(0, MAX_CELLS_PREVIEWED)
  if (text.length > shown.length) shown.push('…')
  return shown.join(' · ')
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
  const lines = parsed.sourceLines

  // The first header-shaped row whose rows below all lack a dollar value: a
  // text-only sheet. It cannot be mapped, but its rows are still named in the
  // failure, so the #557 case where every amount is blank or words is not
  // the one place a row goes unmentioned. The row is called a header only
  // when its labels named columns the analyzer recognises; a multi-cell title
  // line above the real header would otherwise be reported as the header
  // and the real header as a set-aside row.
  let textOnly: { header: string[] | null; skippedRows: SkippedCsvRow[] } | null = null

  const searchLimit = Math.min(rows.length, 30)
  /** Two or more text cells and no figure: the shape of a header (or of a title line). */
  const headerShaped = (r: number): boolean => {
    const nonEmpty = rows[r].filter((c) => c.trim() !== '')
    return nonEmpty.length >= 2 && !nonEmpty.some(isMoneyish)
  }
  /** Whether any label on the row names a column the analyzer knows. */
  const recognisedHeader = (r: number): boolean => rows[r].map(guessColumnRole).some((role) => role !== 'ignore')
  /** Rows below `r` sorted into data rows (a money-ish cell) and set-aside rows, numbered by spreadsheet row. */
  const collect = (r: number) => {
    const dataRows: string[][] = []
    const dataRowNumbers: number[] = []
    const skippedRows: SkippedCsvRow[] = []
    for (let k = r + 1; k < rows.length; k++) {
      const row = rows[k]
      // Numbered by spreadsheet row, so "Row 7" is row 7 in the sheet even
      // past a blank separator line the parser dropped.
      const rowNumber = lines[k]
      if (row.some(isMoneyish)) {
        dataRows.push(row)
        dataRowNumbers.push(rowNumber)
        continue
      }
      // parseCsv already drops fully blank rows, so anything here has text.
      // Nothing here sorts notes from truncated account rows: under a header,
      // `I-bonds,` and `Prepared by Chase,` look the same to this analyzer
      // (one text cell, no figure), and a label test would call "Total Bond
      // Market" a footer. Every such row is set aside and shown, and the
      // person decides which it was.
      skippedRows.push({ rowNumber, cells: row })
    }
    return { dataRows, dataRowNumbers, skippedRows }
  }
  const success = (r: number, found: ReturnType<typeof collect>): GenericCsvAnalysisResult => {
    // Rows above the header (title lines, a "balances as of" note, junk) had
    // no header to map under, so they are set aside like the text-only rows
    // below it and named by spreadsheet row, ahead of them, rather than
    // passed over in silence because the header search stepped past them.
    const above = rows.slice(0, r).map((row, k) => ({ rowNumber: lines[k], cells: row }))
    // A usable table needs at least a name-ish and a money-ish column somewhere;
    // the user can still fix the guesses by hand.
    return {
      ok: true,
      analysis: {
        header: rows[r],
        dataRows: found.dataRows,
        guessedRoles: rows[r].map(guessColumnRole),
        dataRowNumbers: found.dataRowNumbers,
        skippedRows: [...above, ...found.skippedRows],
      },
    }
  }

  for (let r = 0; r < searchLimit; r++) {
    if (!headerShaped(r)) continue
    const found = collect(r)
    if (found.dataRows.length === 0) {
      if (found.skippedRows.length > 0) {
        // A recognised header wins over an earlier unrecognised candidate
        // (the title line above it); the first of either kind is kept. The
        // rows named are every row but the header, those above it included:
        // a title line or junk above the header is set aside like the rest,
        // not dropped because the search passed over it.
        const allButHeader = rows.flatMap((row, k) => (k === r ? [] : [{ rowNumber: lines[k], cells: row }]))
        if (recognisedHeader(r) && (textOnly === null || textOnly.header === null)) textOnly = { header: rows[r], skippedRows: allButHeader }
        else textOnly ??= { header: null, skippedRows: allButHeader }
      }
      continue
    }
    // A header-shaped row nobody recognises, followed before any data row by
    // one the analyzer does recognise, is a title line over the real header
    // ("My net worth,as of year end" above "Account,Type,Balance"): the
    // recognised row is the header and the title is set aside above it. A
    // sheet with no recognised header at all keeps its first header-shaped
    // row, and the person assigns the columns by hand.
    if (!recognisedHeader(r)) {
      for (let r2 = r + 1; r2 < searchLimit && !rows[r2].some(isMoneyish); r2++) {
        if (headerShaped(r2) && recognisedHeader(r2)) {
          const below = collect(r2)
          if (below.dataRows.length > 0) return success(r2, below)
        }
      }
    }
    return success(r, found)
  }
  if (textOnly) {
    const n = textOnly.skippedRows.length
    const lead = textOnly.header
      ? `A header row (${textOnly.header.map(previewCell).filter((c) => c !== '').join(', ')}) was found, but no row below it has a dollar value.`
      : 'No header row was recognised (no column named like an account, type, or balance), and no row has a dollar value.'
    return {
      ok: false,
      message:
        `${lead} ` +
        `${n} row${n === 1 ? '' : 's'} with no dollar value in any column ${n === 1 ? 'was' : 'were'} set aside: ` +
        `${describeSetAsideRows(textOnly.skippedRows)}. ` +
        'Save the sheet with a header row (e.g. "Account, Type, Balance"), one row per account, and a dollar amount in each.',
    }
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
 * Roles assigned to more than one column, in header order.
 *
 * Every role but `ignore` is single-valued: the mapper reads one name column,
 * one balance column, and so on with `roles.indexOf`, so a second column
 * carrying the same role was read by nothing and its data vanished with no
 * message (#569). "Ignore" is the one role a whole sheet can share.
 */
export function duplicateColumnRoles(roles: ColumnRole[]): ColumnRole[] {
  const seen = new Set<ColumnRole>()
  const duplicated = new Set<ColumnRole>()
  for (const role of roles) {
    if (role === 'ignore') continue
    if (seen.has(role)) duplicated.add(role)
    else seen.add(role)
  }
  return [...duplicated]
}

/**
 * The wizard's inline warning and the mapper's refusal say the same thing.
 *
 * It counts nothing: `guessColumnRole` sends `account`, `name` and
 * `description` all to `name`, so a three-column clash is an ordinary header
 * row, and two roles can clash at once — "Two columns" would be wrong for
 * both. "More than one column" is true of every case.
 */
export function duplicateRoleMessage(duplicated: ColumnRole[]): string {
  const named = duplicated.map((r) => `“${COLUMN_ROLE_LABEL[r]}”`)
  const list = named.length < 2 ? (named[0] ?? '') : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
  return (
    `More than one column is set to ${list}. Only the first would be read and the rest would be dropped ` +
    'without a trace, so give each column its own role, or set the extras to “Ignore”.'
  )
}

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
  // Checked before anything is read: a duplicate role is a silent data loss,
  // not a row-level skip the checklist can report afterwards.
  const duplicated = duplicateColumnRoles(roles)
  if (duplicated.length > 0) return { ok: false, message: duplicateRoleMessage(duplicated) }
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
  const ownerId = plan.household.people[0].id

  const totalRowRe = TOTAL_ROW_RE
  const loanLikeRe = /\bloan\b|debt|mortgage|heloc|liabilit|credit/i

  for (let r = 0; r < analysis.dataRows.length; r++) {
    const cells = analysis.dataRows[r]
    // The spreadsheet row when the analysis carries it (parseCsv sourceLines); else a header-relative
    // estimate (header at row 1, first data row at row 2).
    const rowNumber = analysis.dataRowNumbers?.[r] ?? r + 2
    const name = (nameCol === -1 ? '' : (cells[nameCol] ?? '').trim()) || `Row ${r + 1}`
    const typeText = typeCol === -1 ? '' : (cells[typeCol] ?? '').trim()
    if (totalRowRe.test(name) || totalRowRe.test(typeText)) {
      review.push({
        status: 'skipped',
        source: name,
        detail: 'Summary/total row. Counting it would double the money above it.',
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
    // 'exact' only when the type text ITSELF named the class — a nonempty type
    // cell does not prove it did (Name "My Roth IRA" + Type "Asset" maps roth
    // off the name); a name-keyword guess or the taxable fallback is 'assumed'.
    const typeFromColumn =
      typeGuess !== null &&
      !negativeLiability &&
      typeCol !== -1 &&
      typeText !== '' &&
      mapProjectionLabAccountType(typeText, '') === typeGuess
    const amount = Math.abs(balance)

    const base = { id: newId(), name, annualReturnPct: null }
    const contribution = contributionCol === -1 ? null : parseMoney(cells[contributionCol])
    const annualContribution = contribution !== null && contribution > 0 ? contribution : 0
    // The index this row's account will occupy once pushed — every row that
    // reaches the switch pushes exactly one account (skipped rows `continue`).
    const accountIndex = plan.accounts.length
    // Whether a cost-basis / contribution column value actually landed on this
    // account, so the mapped item's locator can point at those columns too.
    // Contribution only lands on account types that carry `annualContribution`.
    const contribContributed = annualContribution > 0 && mapped !== 'property' && mapped !== 'debt'
    let basisContributed = false

    let account: Account
    switch (mapped) {
      case 'taxable': {
        const basisRaw = basisCol === -1 ? null : parseMoney(cells[basisCol])
        // A negative basis cell (adjustment lines, sign conventions) must not
        // sink the whole import at validation — treat it like a missing basis.
        const basis = basisRaw !== null && basisRaw >= 0 ? basisRaw : null
        basisContributed = basis !== null
        account = { ...base, type: 'taxable', ownerPersonId: null, balance: amount, costBasis: basis ?? amount, annualContribution }
        if (basis === null) {
          review.push({
            status: 'defaulted',
            source: name,
            detail:
              (basisRaw !== null && basisRaw < 0 ? 'The cost basis cell was negative, so it was ignored, ' : 'No cost basis column/value, ') +
              'basis was set equal to the balance (no unrealized gain). Correct it on the Accounts screen.',
            // The landed basis came from the balance cell; a rejected negative
            // basis cell is context, never the source of the landed value.
            locator:
              basisRaw !== null && basisRaw < 0
                ? {
                    kind: 'derived',
                    from: [csvRow(rowNumber, balanceColumn), csvRow(rowNumber, columnFor(basisCol))],
                    note: 'basis set from the balance; the negative basis cell was ignored',
                  }
                : csvRow(rowNumber, balanceColumn),
            confidence: 'assumed',
            target: `accounts[${accountIndex}].costBasis`,
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
            detail: `The negative balance looked like a liability sign convention, imported as a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} debt.`,
            locator: csvRow(rowNumber, balanceColumn),
            confidence: 'assumed',
            target: `accounts[${accountIndex}]`,
          })
        }
        review.push({
          status: 'defaulted',
          source: name,
          detail: 'Debts need an interest rate and monthly payment. Defaults of 5% and $0/mo were used; set the real terms on the Accounts screen.',
          locator: csvRow(rowNumber),
          confidence: 'assumed',
          target: `accounts[${accountIndex}]`,
        })
        break
    }
    plan.accounts.push(account)
    // The locator covers every cell that populated the account record: the
    // name/type cells that named and classified it, the balance, and any
    // cost-basis/contribution cells that landed — not just the balance.
    const extraLocators: SourceLocator[] = []
    const extraNotes: string[] = []
    if (nameCol !== -1) {
      extraLocators.push(csvRow(rowNumber, columnFor(nameCol)))
      extraNotes.push('name')
    }
    if (typeFromColumn) {
      extraLocators.push(csvRow(rowNumber, columnFor(typeCol)))
      extraNotes.push('type')
    }
    if (basisContributed) {
      extraLocators.push(csvRow(rowNumber, columnFor(basisCol) ?? balanceColumn))
      extraNotes.push('cost basis')
    }
    if (contribContributed) {
      extraLocators.push(csvRow(rowNumber, columnFor(contributionCol) ?? balanceColumn))
      extraNotes.push('contribution')
    }
    const mappedLocator: SourceLocator =
      extraLocators.length > 0
        ? { kind: 'derived', from: [csvRow(rowNumber, balanceColumn), ...extraLocators], note: ['balance', ...extraNotes].join(' + ') }
        : csvRow(rowNumber, balanceColumn)
    review.push({
      status: typeGuess === null ? 'defaulted' : 'mapped',
      source: `${name}${typeText !== '' ? ` (${typeText})` : ''}`,
      detail:
        typeGuess === null
          ? `No recognizable account type, imported as a taxable account with a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} balance. Change the type on the Accounts screen if that is wrong.`
          : `Imported as a ${mapped} account with a $${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} balance.`,
      locator: mappedLocator,
      confidence: typeFromColumn ? 'exact' : 'assumed',
      target: `accounts[${accountIndex}]`,
    })
    // Cells the user explicitly assigned but this account type discards — say
    // so, or the report implies they landed.
    if (basisCol !== -1 && mapped !== 'taxable' && parseMoney(cells[basisCol]) !== null) {
      review.push({
        status: 'unmapped',
        source: name,
        detail: `The cost basis cell was not imported. Only taxable accounts track cost basis, and this row was imported as ${mapped}.`,
        locator: csvRow(rowNumber, columnFor(basisCol)),
        confidence: 'unmapped',
      })
    }
    if (contribution !== null && contribution > 0 && !contribContributed) {
      review.push({
        status: 'unmapped',
        source: name,
        detail: `The contribution cell was not imported. ${mapped} accounts do not carry an annual contribution.`,
        locator: csvRow(rowNumber, columnFor(contributionCol)),
        confidence: 'unmapped',
      })
    }
  }

  // Rows the analysis set aside because no cell read as money. They never
  // reached the mapping loop, so without this entry a malformed row would
  // vanish from the count and the checklist alike (#557).
  // The row number leads, so two lines that share a first cell stay
  // distinguishable and the line can be found in the spreadsheet. The
  // remediation is conditional: the analyzer cannot tell a footer from an
  // account whose amount cell is blank, so it says what each would need
  // rather than calling the row either.
  const skippedRows = analysis.skippedRows ?? []
  const setAsideDetail =
    'No cell in this row read as a dollar value, so nothing was imported from it. A note or footer needs nothing; an account whose amount is missing can be entered on the Accounts screen.'
  for (const row of skippedRows.slice(0, MAX_SET_ASIDE_ITEMS)) {
    const label = previewCell(row.cells.find((c) => c.trim() !== '') ?? '')
    review.push({
      status: 'skipped',
      source: `Row ${row.rowNumber}${label ? `: ${label}` : ''}`,
      detail: setAsideDetail,
      // The whole row: no cell in it read as a figure, so pointing at the
      // balance column (which the person may have re-assigned) would name a
      // cell that says nothing.
      locator: csvRow(row.rowNumber),
      confidence: 'unmapped',
    })
  }
  // Past the cap, one entry stands for the rest, still counted and ranged:
  // a sheet of thousands of note lines must not become thousands of items.
  if (skippedRows.length > MAX_SET_ASIDE_ITEMS) {
    const rest = skippedRows.slice(MAX_SET_ASIDE_ITEMS)
    // A row range only when the rest sit together; scattered among rows that
    // imported, a range would name rows that were not set aside.
    review.push({
      status: 'skipped',
      source: `${rest.length} more rows${setAsideRange(rest)}`,
      detail: `Each of these also had no cell that read as a dollar value. ${setAsideDetail}`,
      locator: { kind: 'none', note: `${rest.length} further rows with no dollar value${setAsideRange(rest)}` },
      confidence: 'unmapped',
    })
  }

  if (plan.accounts.length === 0) {
    // The set-aside disclosure survives the failure: the message names them,
    // since there is no checklist to carry the items.
    // Capped like every other surface: the message is rendered in the
    // import error callout, and a sheet can hold thousands of such rows.
    const setAside =
      skippedRows.length > 0
        ? ` ${skippedRows.length} row${skippedRows.length === 1 ? '' : 's'} with no dollar value in any column ${skippedRows.length === 1 ? 'was' : 'were'} set aside: ${describeSetAsideRows(skippedRows)}.`
        : ''
    return { ok: false, message: `No rows with a readable balance were found with the current column assignment.${setAside}` }
  }

  review.push({
    status: 'unmapped',
    source: 'Everything except accounts',
    detail: 'Spreadsheet rows import as account balances only. Enter household, income, spending, and Social Security in the planner sections.',
    locator: { kind: 'none', note: 'spreadsheet rows carry only account balances, not household, income, spending, or Social Security' },
    confidence: 'unmapped',
  })

  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The mapped plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
