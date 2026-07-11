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

/** Rows that are file furniture, not positions — silently structural, never balances. */
function isFooterOrNoise(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim().toLowerCase()
  if (first === '') return true
  if (first.startsWith('the data and information')) return true // Fidelity disclaimer
  if (first.startsWith('date downloaded')) return true
  if (first.startsWith('brokerage services')) return true
  if (first.startsWith('"disclaimer') || first.startsWith('disclaimer')) return true
  return false
}

interface Aggregate {
  label: string
  total: number
  basis: number
  basisRows: number
  valueRowsWithoutBasis: number
  positions: number
}

function newAggregate(label: string): Aggregate {
  return { label, total: 0, basis: 0, basisRows: 0, valueRowsWithoutBasis: 0, positions: 0 }
}

function finishAggregates(
  broker: BrokerId,
  byAccount: Map<string, Aggregate>,
  review: ImportReviewItem[],
): BrokerCsvResult {
  const accounts: BrokerAccountBalance[] = []
  for (const agg of byAccount.values()) {
    if (agg.positions === 0) continue
    accounts.push({
      accountLabel: agg.label,
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
    })
    if (agg.basisRows > 0 && agg.valueRowsWithoutBasis > 0) {
      review.push({
        status: 'defaulted',
        source: agg.label,
        detail: `${agg.valueRowsWithoutBasis} position${agg.valueRowsWithoutBasis === 1 ? '' : 's'} (typically cash/money market) had no cost basis; the imported basis covers the rest. Adjust it if this is a taxable account.`,
      })
    }
  }
  if (accounts.length === 0) {
    return { ok: false, message: 'No positions with a readable market value were found in this file.' }
  }
  review.push({
    status: 'unmapped',
    source: 'Positions detail',
    detail: 'Only account balances (and cost basis where present) import — individual holdings, lots, and quantities are not modeled.',
  })
  return { ok: true, broker, accounts, review }
}

// ---------------------------------------------------------------------------
// Schwab: title row per account section, then a header row, then positions.
// ---------------------------------------------------------------------------

function parseSchwab(rows: string[][]): BrokerCsvResult {
  const review: ImportReviewItem[] = []
  const byAccount = new Map<string, Aggregate>()
  let current: Aggregate | null = null
  let valueCol = -1
  let basisCol = -1

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]!
    const first = (cells[0] ?? '').trim()

    const section = /^positions for (?:account )?(.+?) as of /i.exec(first)
    if (section) {
      const label = section[1]!.trim()
      current = byAccount.get(label) ?? newAggregate(label)
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
      review.push({ status: 'skipped', source: `${current.label}: ${first}`, detail: 'Row had no readable market value.' })
      continue
    }
    current.total += value
    current.positions++
    const basis = basisCol === -1 ? null : parseMoney(cells[basisCol])
    if (basis === null) current.valueRowsWithoutBasis++
    else {
      current.basis += basis
      current.basisRows++
    }
  }

  if (byAccount.size === 0) return { ok: false, message: UNRECOGNIZED_MESSAGE }
  return finishAggregates('schwab', byAccount, review)
}

// ---------------------------------------------------------------------------
// Fidelity / Vanguard: single header row with an account-number column.
// ---------------------------------------------------------------------------

/** Summary rows that re-state position sums — counting them doubles balances. */
const TOTAL_ROW_RE = /^(sub|account |grand )?total\b/i

function parseAccountColumnFile(
  broker: BrokerId,
  rows: string[][],
  headerIndex: number,
  cols: { account: number; accountName: number; value: number; basis: number; symbol: number; description: number },
): BrokerCsvResult {
  const review: ImportReviewItem[] = []
  const byAccount = new Map<string, Aggregate>()

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const cells = rows[r]!
    if (isFooterOrNoise(cells)) continue
    // Vanguard appends a transactions section with its own header; stop there.
    if (broker === 'vanguard' && findColumn(cells, 'trade date') !== -1) break

    const accountRaw = (cells[cols.account] ?? '').trim()
    if (accountRaw === '') continue
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
            ? `$${value.toLocaleString('en-US')} of unsettled activity was not counted — it will appear in a position or cash on your next download.`
            : 'Unsettled activity row was not counted.',
      })
      continue
    }

    if (value === null) {
      review.push({
        status: 'skipped',
        source: `${label}: ${symbol || 'row ' + String(r + 1)}`,
        detail: 'Row had no readable value.',
      })
      continue
    }
    const agg = byAccount.get(key) ?? newAggregate(label)
    byAccount.set(key, agg)
    agg.total += value
    agg.positions++
    const basis = cols.basis === -1 ? null : parseMoney(cells[cols.basis])
    if (basis === null) agg.valueRowsWithoutBasis++
    else {
      agg.basis += basis
      agg.basisRows++
    }
  }

  if (broker === 'vanguard') {
    review.push({
      status: 'unmapped',
      source: 'Cost basis',
      detail: "Vanguard's holdings download has no cost basis column — enter basis on taxable accounts from vanguard.com's cost basis page.",
    })
  }
  if (byAccount.size === 0) return { ok: false, message: 'No positions with a readable value were found in this file.' }
  return finishAggregates(broker, byAccount, review)
}

/**
 * Sniff the broker by header shape and parse. Unknown shapes are refused with
 * a pointer at the generic spreadsheet import — never guessed at.
 */
export function parseBrokerPositionsCsv(text: string): BrokerCsvResult {
  const parsed = parseCsv(text)
  if (!parsed.ok) return { ok: false, message: parsed.message }
  const rows = parsed.rows

  // Schwab: any section-title row wins, headers are per-section.
  if (rows.some((cells) => /^positions for /i.test((cells[0] ?? '').trim()))) {
    return parseSchwab(rows)
  }

  // Fidelity / Vanguard: locate the header row among leading junk.
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r]!
    const account = findColumn(cells, 'account number')
    if (account === -1) continue

    const fidelityValue = findColumn(cells, 'current value')
    if (fidelityValue !== -1) {
      return parseAccountColumnFile('fidelity', rows, r, {
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
      return parseAccountColumnFile('vanguard', rows, r, {
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
  const ownerId = plan.household.people[0]!.id

  for (const acc of accounts) {
    const type = guessAccountTypeFromLabel(acc.accountLabel)
    const base = {
      id: newId(),
      name: acc.accountLabel,
      annualReturnPct: null,
      annualContribution: 0,
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
          detail: 'No cost basis in the file — basis was set equal to the balance (no unrealized gain). Correct it on the Accounts screen.',
        })
      }
    } else if (type === 'roth' || type === 'traditional') {
      const kind = /401|403|tsp/i.test(acc.accountLabel) ? 'employer' : 'ira'
      plan.accounts.push({ ...base, type, kind, ownerPersonId: ownerId, balance: Math.max(0, acc.totalValue) })
    } else {
      plan.accounts.push({ ...base, type, ownerPersonId: ownerId, balance: Math.max(0, acc.totalValue) })
    }
    review.push({
      status: 'defaulted',
      source: acc.accountLabel,
      detail: `Created as a ${type === 'taxable' ? 'taxable brokerage' : type} account (guessed from the name) owned by ${
        type === 'taxable' ? 'the household' : 'you'
      }. Change the type or owner on the Accounts screen if the guess is wrong.`,
    })
  }

  review.push({
    status: 'unmapped',
    source: 'Everything except balances',
    detail: 'Broker files carry no household, income, spending, or Social Security data — enter those in the planner sections.',
  })
  const parsed = parsePlan(plan)
  if (!parsed.ok) {
    return { ok: false, message: `The mapped plan failed validation: ${parsed.issues.join('; ')}` }
  }
  return { ok: true, plan: parsed.plan, review }
}
