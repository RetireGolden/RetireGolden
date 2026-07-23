/**
 * Generic spreadsheet / RPM CSV wizard machinery tests. The RPM fixture is an
 * account-summary sheet saved as CSV (description + balance columns, the shape
 * the Bogleheads Retiree Portfolio Model's portfolio section produces); the
 * arbitrary fixture proves manual column assignment works when guesses fail.
 */

import { describe, expect, it } from 'vitest'

import { parsePlan } from '@retiregolden/engine/model/plan'
import { analyzeGenericCsv, draftPlanFromGenericCsv, guessColumnRole, type ColumnRole } from './genericCsv'

let n = 0
const testIds = () => `gc-${++n}`

const RPM_FIXTURE = `Retiree Portfolio Model,,,
Portfolio balances as of 12/31/2025,,,
Description,Balance,Cost Basis,Annual Contribution
Taxable account,"$450,000","$300,000","$10,000"
Tax-deferred account (401k) person 1,"$900,000",,"$23,000"
Roth IRA person 1,"$150,000",,"$7,000"
Health Savings Account,"$40,000",,
Cash / money market,"$25,000",,
`

const ARBITRARY_FIXTURE = `What,Where,How much
Emergency fund,Ally,18000
Old 403b,TIAA,220000
House,,650000
HELOC,,-40000
`

describe('guessColumnRole', () => {
  it('guesses roles from header keywords', () => {
    expect(guessColumnRole('Account Name')).toBe('name')
    expect(guessColumnRole('Description')).toBe('name')
    expect(guessColumnRole('Type')).toBe('type')
    expect(guessColumnRole('Balance')).toBe('balance')
    expect(guessColumnRole('Current Value')).toBe('balance')
    expect(guessColumnRole('Cost Basis')).toBe('costBasis')
    expect(guessColumnRole('Annual Contribution')).toBe('contribution')
    expect(guessColumnRole('Notes to self')).toBe('ignore')
  })
})

describe('analyzeGenericCsv', () => {
  it('finds the RPM header row past title rows and guesses roles', () => {
    const r = analyzeGenericCsv(RPM_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.analysis.header).toEqual(['Description', 'Balance', 'Cost Basis', 'Annual Contribution'])
    expect(r.analysis.guessedRoles).toEqual(['name', 'balance', 'costBasis', 'contribution'])
    expect(r.analysis.dataRows).toHaveLength(5)
  })

  it('refuses files with no usable table, with guidance', () => {
    const r = analyzeGenericCsv('just,words\nno,numbers\n')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('header row')
  })

  it('propagates hardened-CSV failures (truncated quotes, oversized files)', () => {
    expect(analyzeGenericCsv('a,b\n"unterminated').ok).toBe(false)
  })
})

describe('draftPlanFromGenericCsv — RPM fixture', () => {
  it('maps every RPM row to the right account type through the validated plan route', () => {
    const analysis = analyzeGenericCsv(RPM_FIXTURE)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return

    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(parsePlan(r.plan).ok).toBe(true)
    expect(r.plan.accounts.map((a) => a.type)).toEqual(['taxable', 'traditional', 'roth', 'hsa', 'cash'])

    const taxable = r.plan.accounts[0]!
    expect(taxable).toMatchObject({ balance: 450000, costBasis: 300000, annualContribution: 10000 })
    const trad = r.plan.accounts[1]!
    expect(trad).toMatchObject({ balance: 900000, kind: 'employer', annualContribution: 23000 })
    const hsa = r.plan.accounts[3]!
    expect(hsa).toMatchObject({ balance: 40000, annualContribution: 0 })
  })
})

describe('draftPlanFromGenericCsv — arbitrary sheet via manual column assignment', () => {
  it('maps an arbitrary CSV once the user assigns columns by hand', () => {
    const analysis = analyzeGenericCsv(ARBITRARY_FIXTURE)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    // "What/Where/How much" defeats the guesser for the money column; the user fixes it.
    const roles: ColumnRole[] = ['name', 'ignore', 'balance']
    const r = draftPlanFromGenericCsv(analysis.analysis, roles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(parsePlan(r.plan).ok).toBe(true)
    // HELOC's -$40,000 is a liability sign convention → imported as debt, with review items.
    expect(r.plan.accounts.map((a) => a.type)).toEqual(['cash', 'traditional', 'property', 'debt'])
    const heloc = r.plan.accounts[3]!
    expect(heloc).toMatchObject({ type: 'debt', balance: 40000 })
    expect(r.review.some((i) => i.source === 'HELOC' && i.status === 'defaulted' && i.detail.includes('liability'))).toBe(true)
    // Unknown-type rows default to taxable *with a visible review item* — none here,
    // but the not-imported remainder is always explicit.
    expect(r.review.some((i) => i.status === 'unmapped')).toBe(true)
  })

  it('skips total/summary footer rows instead of importing phantom accounts', () => {
    const csv = `Account,Balance
Brokerage,100000
Savings,20000
Total,120000
Grand Total,120000
`
    const analysis = analyzeGenericCsv(csv)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts).toHaveLength(2)
    expect(r.review.filter((i) => i.status === 'skipped' && i.detail.includes('Summary/total'))).toHaveLength(2)
  })

  it('treats a negative cost-basis cell like a missing basis instead of failing the whole import', () => {
    const csv = `Account,Balance,Cost Basis
Brokerage,"$50,000","($3,000)"
`
    const analysis = analyzeGenericCsv(csv)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts[0]).toMatchObject({ type: 'taxable', balance: 50000, costBasis: 50000 })
    const note = r.review.find((i) => i.status === 'defaulted' && i.detail.includes('negative'))!
    expect(note).toBeTruthy()
    // The landed basis came from the balance cell; the rejected negative basis
    // cell is context — the locator must not name it as the value's source.
    expect(note.locator).toEqual({
      kind: 'derived',
      from: [
        { kind: 'csvRow', row: 2, column: 'Balance' },
        { kind: 'csvRow', row: 2, column: 'Cost Basis' },
      ],
      note: 'basis set from the balance; the negative basis cell was ignored',
    })
    expect(parsePlan(r.plan).ok).toBe(true)
  })

  it('skips negative balances on rows that do not look like liabilities', () => {
    const csv = `Account,Balance
Fine,1000
Mystery deficit,-500
`
    const analysis = analyzeGenericCsv(csv)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts).toHaveLength(1)
    expect(r.review.some((i) => i.status === 'skipped' && i.source === 'Mystery deficit')).toBe(true)
  })

  it('fails helpfully when no balance column is assigned', () => {
    const analysis = analyzeGenericCsv(ARBITRARY_FIXTURE)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const r = draftPlanFromGenericCsv(analysis.analysis, ['name', 'ignore', 'ignore'], testIds)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('balance')
  })

  it('fails helpfully when every row is junk', () => {
    const analysis = analyzeGenericCsv('Name,Balance\nreal,100\n')
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const junk = { ...analysis.analysis, dataRows: [['x', 'not-money'], ['y', '--']] }
    const r = draftPlanFromGenericCsv(junk, ['name', 'balance'], testIds)
    expect(r.ok).toBe(false)
  })
})

describe('genericCsv provenance (WS1)', () => {
  it('gives every review item a locator and a confidence', () => {
    const analysis = analyzeGenericCsv(RPM_FIXTURE)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const item of r.review) {
      expect(item.locator, item.source).toBeDefined()
      expect(item.confidence, item.source).toBeDefined()
    }
  })

  it('locates each RPM account at its header-offset-corrected row, widened to every column that landed', () => {
    const analysis = analyzeGenericCsv(RPM_FIXTURE)
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    // Two title rows (1,2) then the header (3): the first data row is parsed-row 4.
    expect(analysis.analysis.dataRowNumbers).toEqual([4, 5, 6, 7, 8])
    const r = draftPlanFromGenericCsv(analysis.analysis, analysis.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const taxable = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('Taxable account'))!
    // The taxable row supplied a cost basis and a contribution that both landed on
    // the account, so the locator covers those columns alongside the balance.
    expect(taxable.locator).toEqual({
      kind: 'derived',
      from: [
        { kind: 'csvRow', row: 4, column: 'Balance' },
        { kind: 'csvRow', row: 4, column: 'Cost Basis' },
        { kind: 'csvRow', row: 4, column: 'Annual Contribution' },
      ],
      note: 'balance + cost basis + contribution',
    })
    // No type column in the RPM sheet — the class is a name-keyword guess.
    expect(taxable.confidence).toBe('assumed')
    // The account is the first row pushed to the draft plan.
    expect(taxable.target).toBe('accounts[0]')
  })

  it('keeps the plain balance locator when only the balance column landed', () => {
    // Cash account: no basis column, no contribution value that lands.
    const cash = analyzeGenericCsv('Account,Balance\nAlly Savings,20000\n')
    expect(cash.ok).toBe(true)
    if (!cash.ok) return
    const r = draftPlanFromGenericCsv(cash.analysis, cash.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const item = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('Ally Savings'))!
    expect(item.locator).toEqual({ kind: 'csvRow', row: 2, column: 'Balance' })
  })

  it('widens the locator to just the contribution column when no basis landed', () => {
    // A Roth (explicit type) with a contribution but no cost-basis column.
    const roth = analyzeGenericCsv('Account,Type,Balance,Annual Contribution\nMy Roth,Roth IRA,50000,7000\n')
    expect(roth.ok).toBe(true)
    if (!roth.ok) return
    const r = draftPlanFromGenericCsv(roth.analysis, roth.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const item = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('My Roth'))!
    expect(item.locator).toEqual({
      kind: 'derived',
      from: [
        { kind: 'csvRow', row: 2, column: 'Balance' },
        { kind: 'csvRow', row: 2, column: 'Annual Contribution' },
      ],
      note: 'balance + contribution',
    })
    // Confidence semantics are unchanged — an explicit type column is still exact.
    expect(item.confidence).toBe('exact')
  })

  it('grades a class read from an explicit type column as exact', () => {
    const typed = analyzeGenericCsv('Account,Type,Balance\nMy Roth,Roth IRA,50000\n')
    expect(typed.ok).toBe(true)
    if (!typed.ok) return
    const r = draftPlanFromGenericCsv(typed.analysis, typed.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const roth = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('My Roth'))!
    expect(roth.confidence).toBe('exact')
    expect(roth.locator).toEqual({ kind: 'csvRow', row: 2, column: 'Balance' })
  })

  it('grades a type cell that did not name the class as assumed, even when nonempty', () => {
    // The type cell "Asset" matches no class keyword — "roth" comes from the
    // NAME, so claiming column-exact fidelity would overstate it.
    const typed = analyzeGenericCsv('Account,Type,Balance\nMy Roth IRA,Asset,50000\n')
    expect(typed.ok).toBe(true)
    if (!typed.ok) return
    const r = draftPlanFromGenericCsv(typed.analysis, typed.analysis.guessedRoles, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts[0]!.type).toBe('roth')
    const roth = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('My Roth'))!
    expect(roth.confidence).toBe('assumed')
  })
})
