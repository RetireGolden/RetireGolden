/**
 * Broker positions-CSV import (onboarding-import-and-migration step 2).
 *
 * Parses the positions/holdings CSV files Schwab, Fidelity, and Vanguard let
 * every customer download, into per-account balance (and cost basis, where the
 * file carries it) aggregates. Two consumers: the account editor's "update
 * balances from CSV" flow, and the import wizard's "start a plan from a broker
 * CSV" path. Only documented customer-facing exports are recognized — files
 * are version-sniffed by header shape and refused with a helpful message
 * otherwise. All parsing is client-side on hostile input; see csv.ts.
 */

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'
import { findColumn, parseCsv, parseMoney } from './csv'
import { csvRowLocator as csvRow } from './provenance'
import type { ImportReviewItem } from './reviewChecklist'

export type BrokerId = 'schwab' | 'fidelity' | 'vanguard'

export const BROKER_LABEL: Record<BrokerId, string> = {
  schwab: 'Schwab',
  fidelity: 'Fidelity',
  vanguard: 'Vanguard',
}

export interface BrokerAccountBalance {
  /** Account label as it appears in the file (brokers mask numbers themselves). */
  accountLabel: string
  /**
   * Broker-reported calendar date for this balance; null when the file did
   * not carry a readable one. Optional at the public boundary so aggregates
   * built against the pre-WS5 shape keep type-checking (omitted reads as
   * null downstream).
   */
  asOfIso?: string | null
  /** Sum of position market values, including cash/money-market rows. */
  totalValue: number
  /** Sum of cost basis over rows that had one; null when the file carries none. */
  costBasis: number | null
  positionCount: number
}

export type BrokerCsvResult =
  | { ok: true; broker: BrokerId; accounts: BrokerAccountBalance[]; review: ImportReviewItem[] }
  | { ok: false; message: string }

const UNRECOGNIZED_MESSAGE =
  'This file does not look like a Schwab, Fidelity, or Vanguard positions export. ' +
  'Download the positions/holdings CSV from your broker, or use the spreadsheet import to map columns yourself.'

/** Boilerplate the brokers append below the positions — never a balance. */
function isFooterText(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim().toLowerCase()
  if (first.startsWith('the data and information')) return true // Fidelity disclaimer
  if (first.startsWith('date downloaded')) return true
  if (first.startsWith('brokerage services')) return true
  if (first.startsWith('"disclaimer') || first.startsWith('disclaimer')) return true
  return false
}

/** A row with nothing in it at all: a section separator, never data. */
function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => (cell ?? '').trim() === '')
}

/**
 * Rows that are file furniture, not positions — silently structural, never
 * balances. Schwab's sectioned layout leads with the symbol, so a blank first
 * cell there is separator furniture. `parseAccountColumnFile` must NOT use
 * this rule: Fidelity and Vanguard put Account Number first, where a blank
 * first cell is a row missing its account, which gets disclosed instead.
 */
function isFooterOrNoise(cells: string[]): boolean {
  if ((cells[0] ?? '').trim() === '') return true
  return isFooterText(cells)
}

/** Return an ISO calendar date only for the explicit US broker date shapes we recognize. */
function parseAsOfIso(raw: string): string | null {
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(raw)
  const numeric = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/.exec(raw)
  const named = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(raw)
  const months: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
    may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9,
    sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  }
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : numeric
      ? { year: Number(numeric[3]), month: Number(numeric[1]), day: Number(numeric[2]) }
      : named
        ? { year: Number(named[3]), month: months[named[1].toLowerCase().replace('.', '')], day: Number(named[2]) }
        : null
  if (!parts || !Number.isInteger(parts.year) || parts.year < 1000 || parts.year > 9999) return null
  if (!Number.isInteger(parts.month) || parts.month < 1 || parts.month > 12 || !Number.isInteger(parts.day) || parts.day < 1) return null
  const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate()
  if (parts.day > daysInMonth) return null
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Fidelity and Vanguard put one "Date downloaded" footer date on the whole file. */
function downloadedAsOfIso(rows: string[][]): string | null {
  for (const cells of rows) {
    const first = (cells[0] ?? '').trim()
    if (/^date downloaded\b/i.test(first)) return parseAsOfIso(cells.join(' '))
  }
  return null
}

interface Aggregate {
  label: string
  asOfIso: string | null
  total: number
  basis: number
  basisRows: number
  valueRowsWithoutBasis: number
  positions: number
  /** 1-based rows of the positions that were summed into `total`. */
  rows: number[]
  /** 1-based rows of the positions that carried no cost basis. */
  basislessRows: number[]
  /** 1-based rows whose cost basis was summed into `basis`. */
  rowsWithBasis: number[]
}

function newAggregate(label: string, asOfIso: string | null): Aggregate {
  return {
    label,
    asOfIso,
    total: 0,
    basis: 0,
    basisRows: 0,
    valueRowsWithoutBasis: 0,
    positions: 0,
    rows: [],
    basislessRows: [],
    rowsWithBasis: [],
  }
}

function finishAggregates(
  broker: BrokerId,
  byAccount: Map<string, Aggregate>,
  review: ImportReviewItem[],
  /** Header text of the market-value and cost-basis columns the rows were read from. */
  valueColumn: string,
  basisColumn: string,
): BrokerCsvResult {
  const accounts: BrokerAccountBalance[] = []
  for (const agg of byAccount.values()) {
    if (agg.positions === 0) continue
    accounts.push({
      accountLabel: agg.label,
      asOfIso: agg.asOfIso,
      totalValue: Math.round(agg.total * 100) / 100,
      costBasis: agg.basisRows > 0 ? Math.round(agg.basis * 100) / 100 : null,
      positionCount: agg.positions,
    })
    review.push({
      status: 'mapped',
      source: agg.label,
      detail: `${agg.positions} position${agg.positions === 1 ? '' : 's'} totaling $${agg.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}${
        agg.basisRows > 0 ? ` (cost basis $${agg.basis.toLocaleString('en-US', { maximumFractionDigits: 0 })})` : ''
      }.`,
      // When the item also reports a summed cost basis, the basis cells are
      // part of the derivation too — an advisor must be able to reproduce both.
      locator: {
        kind: 'derived',
        from: [
          ...agg.rows.map((row) => csvRow(row, valueColumn)),
          ...(agg.basisRows > 0 ? agg.rowsWithBasis.map((row) => csvRow(row, basisColumn)) : []),
        ],
        note: agg.basisRows > 0 ? 'summed position market values and cost basis' : 'summed position market values',
      },
      confidence: 'derived',
    })
    if (agg.basisRows > 0 && agg.valueRowsWithoutBasis > 0) {
      review.push({
        status: 'defaulted',
        source: agg.label,
        detail: `${agg.valueRowsWithoutBasis} position${agg.valueRowsWithoutBasis === 1 ? '' : 's'} (typically cash/money market) had no cost basis; the imported basis covers the rest. Adjust it if this is a taxable account.`,
        locator: { kind: 'derived', from: agg.basislessRows.map((row) => csvRow(row, basisColumn)), note: 'positions with no cost basis' },
        confidence: 'assumed',
      })
    }
  }
  if (accounts.length === 0) {
    return { ok: false, message: 'No positions with a readable market value were found in this file.' }
  }
  review.push({
    status: 'unmapped',
    source: 'Positions detail',
    detail: 'Only account balances (and cost basis where present) import. Individual holdings, lots, and quantities are not modeled.',
    locator: { kind: 'none', note: 'individual holdings, lots, and quantities are not modeled' },
    confidence: 'unmapped',
  })
  return { ok: true, broker, accounts, review }
}

// ---------------------------------------------------------------------------
// Schwab: title row per account section, then a header row, then positions.
// ---------------------------------------------------------------------------

function parseSchwab(rows: string[][], lines: number[]): BrokerCsvResult {
  const review: ImportReviewItem[] = []
  const byAccount = new Map<string, Aggregate>()
  let current: Aggregate | null = null
  let valueCol = -1
  let basisCol = -1

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]
    const first = (cells[0] ?? '').trim()

    const section = /^positions for (?:account )?(.+?)\s+as of\s+(.+)$/i.exec(first)
    if (section) {
      const label = section[1].trim()
      const asOfIso = parseAsOfIso(section[2])
      current = byAccount.get(label) ?? newAggregate(label, asOfIso)
      if (current.asOfIso === null) current.asOfIso = asOfIso
      byAccount.set(label, current)
      valueCol = -1
      basisCol = -1
      continue
    }

    if (first.toLowerCase() === 'symbol') {
      valueCol = findColumn(cells, 'market value', 'mkt val')
      basisCol = findColumn(cells, 'cost basis')
      continue
    }

    if (!current || valueCol === -1) continue
    if (isFooterOrNoise(cells)) continue
    const lower = first.toLowerCase()
    if (lower === 'account total' || lower === 'total') continue

    const value = parseMoney(cells[valueCol])
    if (value === null) {
      review.push({
        status: 'skipped',
        source: `${current.label}: ${first}`,
        detail: 'Row had no readable market value.',
        locator: csvRow(lines[r], 'market value'),
        confidence: 'unmapped',
      })
      continue
    }
    current.total += value
    current.positions++
    current.rows.push(lines[r])
    const basis = basisCol === -1 ? null : parseMoney(cells[basisCol])
    if (basis === null) {
      current.valueRowsWithoutBasis++
      current.basislessRows.push(lines[r])
    } else {
      current.basis += basis
      current.basisRows++
      current.rowsWithBasis.push(lines[r])
    }
  }

  if (byAccount.size === 0) return { ok: false, message: UNRECOGNIZED_MESSAGE }
  return finishAggregates('schwab', byAccount, review, 'market value', 'cost basis')
}

// ---------------------------------------------------------------------------
// Fidelity / Vanguard: single header row with an account-number column.
// ---------------------------------------------------------------------------

/** Summary rows that re-state position sums — counting them doubles balances. */
const TOTAL_ROW_RE = /^(sub|account |grand )?total\b/i

function parseAccountColumnFile(
  broker: BrokerId,
  rows: string[][],
  lines: number[],
  headerIndex: number,
  asOfIso: string | null,
  cols: { account: number; accountName: number; value: number; basis: number; symbol: number; description: number },
): BrokerCsvResult {
  const review: ImportReviewItem[] = []
  const byAccount = new Map<string, Aggregate>()
  const valueLabel = (rows[headerIndex]?.[cols.value] ?? '').trim().toLowerCase()
  const basisLabel = cols.basis === -1 ? '' : (rows[headerIndex]?.[cols.basis] ?? '').trim().toLowerCase()
  const accountLabel = (rows[headerIndex]?.[cols.account] ?? '').trim().toLowerCase()

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const cells = rows[r]
    // Deliberately NOT `isFooterOrNoise`: these layouts put Account Number in
    // column 0, so its blank-first-cell rule would swallow exactly the rows
    // the disclosure below exists to report, and it would do so on the real
    // Fidelity and Vanguard shapes rather than only on odd ones.
    if (isEmptyRow(cells) || isFooterText(cells)) continue
    // Vanguard appends a transactions section with its own header; stop there.
    if (broker === 'vanguard' && findColumn(cells, 'trade date') !== -1) break

    const accountRaw = (cells[cols.account] ?? '').trim()
    if (accountRaw === '') {
      // A blank account cell has nothing to add the row's value to, and a
      // silent `continue` here understated the imported balance whenever an
      // export used blank cells for continuation rows. Every other skip in
      // this parser is disclosed; this one is too.
      const orphaned = parseMoney(cells[cols.value])
      review.push({
        status: 'skipped',
        source: `Row ${String(lines[r])}`,
        detail:
          orphaned !== null
            ? `$${orphaned.toLocaleString('en-US')} was not counted. The row has no account number, so there is no account to add it to.`
            : 'Row had no account number, so it was not counted.',
        locator: csvRow(lines[r], accountLabel || undefined),
        confidence: 'unmapped',
      })
      continue
    }
    const name = cols.accountName === -1 ? '' : (cells[cols.accountName] ?? '').trim()
    const label = name !== '' ? `${name} (${accountRaw})` : accountRaw
    const key = accountRaw
    const symbol = cols.symbol === -1 ? '' : (cells[cols.symbol] ?? '').trim()
    const description = cols.description === -1 ? '' : (cells[cols.description] ?? '').trim()

    // Summary furniture, not positions: total rows re-state money already
    // counted (silent double-count if kept), and pending activity is unsettled.
    // A description match only counts with no symbol, so a fund actually named
    // "Total Stock Market Index" is never mistaken for a summary row.
    const isTotalRow =
      TOTAL_ROW_RE.test(accountRaw) || TOTAL_ROW_RE.test(symbol) || (symbol === '' && TOTAL_ROW_RE.test(description))
    if (isTotalRow) continue
    const value = parseMoney(cells[cols.value])
    if (/^pending activity$/i.test(symbol) || /^pending activity$/i.test(description)) {
      review.push({
        status: 'skipped',
        source: `${label}: Pending Activity`,
        detail:
          value !== null
            ? `$${value.toLocaleString('en-US')} of unsettled activity was not counted. It will appear in a position or cash on your next download.`
            : 'Unsettled activity row was not counted.',
        locator: csvRow(lines[r], valueLabel || undefined),
        confidence: 'unmapped',
      })
      continue
    }

    if (value === null) {
      review.push({
        status: 'skipped',
        source: `${label}: ${symbol || 'row ' + String(lines[r])}`,
        detail: 'Row had no readable value.',
        locator: csvRow(lines[r], valueLabel || undefined),
        confidence: 'unmapped',
      })
      continue
    }
    const agg = byAccount.get(key) ?? newAggregate(label, asOfIso)
    byAccount.set(key, agg)
    agg.total += value
    agg.positions++
    agg.rows.push(lines[r])
    const basis = cols.basis === -1 ? null : parseMoney(cells[cols.basis])
    if (basis === null) {
      agg.valueRowsWithoutBasis++
      agg.basislessRows.push(lines[r])
    } else {
      agg.basis += basis
      agg.basisRows++
      agg.rowsWithBasis.push(lines[r])
    }
  }

  if (broker === 'vanguard') {
    review.push({
      status: 'unmapped',
      source: 'Cost basis',
      detail: "Vanguard's holdings download has no cost basis column. A balance refresh leaves existing taxable-account basis unchanged; enter basis from vanguard.com's cost basis page.",
      locator: { kind: 'none', note: "Vanguard's holdings download has no cost basis column" },
      confidence: 'unmapped',
    })
  }
  if (byAccount.size === 0) return { ok: false, message: 'No positions with a readable value were found in this file.' }
  return finishAggregates(broker, byAccount, review, valueLabel, basisLabel)
}

/**
 * Sniff the broker by header shape and parse. Unknown shapes are refused with
 * a pointer at the generic spreadsheet import — never guessed at.
 */
export function parseBrokerPositionsCsv(text: string): BrokerCsvResult {
  const parsed = parseCsv(text)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const rows = parsed.rows
  const lines = parsed.sourceLines

  // Schwab: any section-title row wins, headers are per-section.
  if (rows.some((cells) => /^positions for /i.test((cells[0] ?? '').trim()))) {
    return parseSchwab(rows, lines)
  }

  // Fidelity / Vanguard: locate the header row among leading junk.
  const asOfIso = downloadedAsOfIso(rows)
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r]
    const account = findColumn(cells, 'account number')
    if (account === -1) continue

    const fidelityValue = findColumn(cells, 'current value')
    if (fidelityValue !== -1) {
      return parseAccountColumnFile('fidelity', rows, lines, r, asOfIso, {
        account,
        accountName: findColumn(cells, 'account name'),
        value: fidelityValue,
        basis: findColumn(cells, 'cost basis total', 'cost basis'),
        symbol: findColumn(cells, 'symbol'),
        description: findColumn(cells, 'description'),
      })
    }

    const vanguardValue = findColumn(cells, 'total value')
    if (vanguardValue !== -1 && findColumn(cells, 'investment name') !== -1) {
      return parseAccountColumnFile('vanguard', rows, lines, r, asOfIso, {
        account,
        accountName: -1,
        value: vanguardValue,
        basis: -1,
        symbol: findColumn(cells, 'symbol'),
        description: findColumn(cells, 'investment name'),
      })
    }
  }

  return { ok: false, message: UNRECOGNIZED_MESSAGE }
}

// ---------------------------------------------------------------------------
// Applying parsed balances
// ---------------------------------------------------------------------------

/** Plan account types a broker balance can sensibly land on. */
export function isBalanceUpdatable(account: Account): account is Account & { balance: number } {
  return (
    account.type === 'cash' ||
    account.type === 'taxable' ||
    account.type === 'equityComp' ||
    account.type === 'traditional' ||
    account.type === 'roth' ||
    account.type === 'hsa'
  )
}

/**
 * Return a copy of `account` with the parsed balance (and, on basis-tracking
 * account types, cost basis when the file had one) applied.
 */
export function applyBrokerBalance(account: Account, source: BrokerAccountBalance): Account {
  if (!isBalanceUpdatable(account)) return account
  const next = { ...account, balance: Math.max(0, source.totalValue) }
  if ((next.type === 'taxable' || next.type === 'equityComp') && source.costBasis !== null) {
    next.costBasis = Math.max(0, source.costBasis)
  }
  return next
}

/** Guess a plan account type from a broker account label, for the new-plan path. */
export function guessAccountTypeFromLabel(label: string): 'roth' | 'traditional' | 'hsa' | 'taxable' {
  const l = label.toLowerCase()
  if (/\broth\b/.test(l)) return 'roth'
  if (/\bhsa\b|health savings/.test(l)) return 'hsa'
  if (/\bira\b|401|403|rollover|sep[- ]|simple[- ]|pension|retirement/.test(l)) return 'traditional'
  return 'taxable'
}

export type BrokerDraftResult = { ok: true; plan: Plan; review: ImportReviewItem[] } | { ok: false; message: string }

/**
 * Build a draft plan from parsed broker accounts (the import wizard's "start
 * from a broker CSV" path). Account types are guessed from labels and every
 * guess is a review item — nothing imports silently. Like every other mapper,
 * the draft goes through `parsePlan` so an unsaveable plan fails here, not at save.
 */
export function draftPlanFromBrokerAccounts(
  broker: BrokerId,
  accounts: BrokerAccountBalance[],
  newId: () => string = () => crypto.randomUUID(),
): BrokerDraftResult {
  const review: ImportReviewItem[] = []
  const plan = createEmptyPlan({ newId, name: `Imported from ${BROKER_LABEL[broker]}` })
  const ownerId = plan.household.people[0].id

  for (const acc of accounts) {
    const type = guessAccountTypeFromLabel(acc.accountLabel)
    const accountIndex = plan.accounts.length
    const base = {
      id: newId(),
      name: acc.accountLabel,
      annualReturnPct: null,
      annualContribution: 0,
    }
    // Negative aggregates (shorts exceeding longs, adjustment rows) are
    // clamped to $0 in the plan — the report must say the landed value is not
    // the file's aggregate, or its provenance overstates fidelity.
    if (acc.totalValue < 0) {
      review.push({
        status: 'defaulted',
        source: acc.accountLabel,
        detail: `The file's net-negative total of -$${Math.abs(acc.totalValue).toLocaleString('en-US', { maximumFractionDigits: 0 })} was clamped to a $0 balance. Set the real balance on the Accounts screen.`,
        locator: { kind: 'none', note: 'net-negative account totals cannot be modeled and were clamped to zero' },
        confidence: 'assumed',
        target: `accounts[${accountIndex}]`,
      })
    }
    if (type === 'taxable' && acc.costBasis !== null && acc.costBasis < 0) {
      review.push({
        status: 'defaulted',
        source: acc.accountLabel,
        detail: `The file's negative cost basis of -$${Math.abs(acc.costBasis).toLocaleString('en-US', { maximumFractionDigits: 0 })} was clamped to $0. Correct it on the Accounts screen.`,
        locator: { kind: 'none', note: 'a negative cost basis cannot be modeled and was clamped to zero' },
        confidence: 'assumed',
        target: `accounts[${accountIndex}].costBasis`,
      })
    }
    if (type === 'taxable') {
      plan.accounts.push({
        ...base,
        type,
        ownerPersonId: null,
        balance: Math.max(0, acc.totalValue),
        costBasis: Math.max(0, acc.costBasis ?? acc.totalValue),
      })
      if (acc.costBasis === null) {
        review.push({
          status: 'defaulted',
          source: acc.accountLabel,
          detail: 'No cost basis in the file. Basis was set equal to the balance (no unrealized gain). Correct it on the Accounts screen.',
          locator: { kind: 'none', note: 'the imported broker file carried no cost basis for this account' },
          confidence: 'assumed',
          target: `accounts[${accountIndex}].costBasis`,
        })
      }
    } else if (type === 'roth' || type === 'traditional') {
      const kind = /401|403|tsp/i.test(acc.accountLabel) ? 'employer' : 'ira'
      plan.accounts.push({ ...base, type, kind, ownerPersonId: ownerId, balance: Math.max(0, acc.totalValue) })
      if (acc.costBasis !== null) {
        // The file's basis is real, but this account type has no basis field —
        // say so instead of letting the report imply the basis landed.
        review.push({
          status: 'unmapped',
          source: acc.accountLabel,
          detail: `The file's $${acc.costBasis.toLocaleString('en-US', { maximumFractionDigits: 0 })} cost basis was not imported. Cost basis only applies to taxable accounts, and this was created as a ${type} account.`,
          locator: { kind: 'none', note: 'cost basis does not apply to this account type' },
          confidence: 'unmapped',
        })
      }
    } else {
      plan.accounts.push({ ...base, type, ownerPersonId: ownerId, balance: Math.max(0, acc.totalValue) })
    }
    review.push({
      status: 'defaulted',
      source: acc.accountLabel,
      detail: `Created as a ${type === 'taxable' ? 'taxable brokerage' : type} account (guessed from the name) owned by ${
        type === 'taxable' ? 'the household' : 'you'
      }. Change the type or owner on the Accounts screen if the guess is wrong.`,
      locator: { kind: 'none', note: 'account type guessed from the account name' },
      confidence: 'assumed',
      target: `accounts[${accountIndex}]`,
    })
  }

  review.push({
    status: 'unmapped',
    source: 'Everything except balances',
    detail: 'Broker files carry no household, income, spending, or Social Security data. Enter those in the planner sections.',
    locator: { kind: 'none', note: 'broker files carry no household, income, spending, or Social Security data' },
    confidence: 'unmapped',
  })
  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The mapped plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
