/**
 * Broker positions-CSV fixtures + adversarial suite (à la the SSA XML tests).
 * Fixtures are shaped on the documented customer downloads: Schwab
 * "Positions for account …" sections, the Fidelity portfolio-positions
 * account-column layout, and Vanguard's holdings+transactions download.
 */

import { describe, expect, it } from 'vitest'

import { parsePlan } from '@retiregolden/engine/model/plan'
import {
  applyBrokerBalance,
  draftPlanFromBrokerAccounts,
  guessAccountTypeFromLabel,
  parseBrokerPositionsCsv,
} from './brokerCsv'

const SCHWAB_FIXTURE = `"Positions for account Individual ...789 as of 09:12 PM ET, 07/07/2026"
""
"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","Cost Basis","Security Type"
"AAPL","APPLE INC","100","$190.50","$19,050.00","$15,000.00","Equity"
"SWVXX","SCHWAB VALUE ADVANTAGE MONEY FUND","5,000","$1.00","$5,000.00","--","Money Market"
"Cash & Cash Investments","--","--","--","$1,200.00","--","Cash"
"Account Total","--","--","--","$25,250.00","$15,000.00","--"

"Positions for account Roth IRA ...321 as of 09:12 PM ET, 07/07/2026"
""
"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","Cost Basis","Security Type"
"VTI","VANGUARD TOTAL STOCK MARKET ETF","50","$280.00","$14,000.00","$10,000.00","ETF"
"Account Total","--","--","--","$14,000.00","$10,000.00","--"
`

const FIDELITY_FIXTURE = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Last Price Change,Current Value,Total Gain/Loss Dollar,Percent Of Account,Cost Basis Total,Average Cost Basis,Type
Z12345678,Individual,AAPL,APPLE INC,100,$190.50,+$1.20,$19050.00,$4050.00,50%,$15000.00,$150.00,Cash
Z12345678,Individual,SPAXX**,FIDELITY GOVERNMENT MONEY MARKET,6000.00,$1.00,$0.00,$6000.00,--,20%,--,--,Cash
Z87654321,ROTH IRA,FXAIX,FIDELITY 500 INDEX FUND,80,$180.00,-$0.50,$14400.00,$2400.00,100%,$12000.00,$150.00,Cash
Z12345678,Individual,Pending Activity,,,,,$250.00,,,,,
Z12345678,Individual,,Account Total,,,,$25050.00,,,$15000.00,,
,
"The data and information in this spreadsheet is for informational purposes only and is not intended as tax advice."
"Date downloaded 07/07/2026 9:12 PM ET"
`

const VANGUARD_FIXTURE = `Account Number,Investment Name,Symbol,Shares,Share Price,Total Value
12345678,Vanguard Total Stock Market Index Fund,VTSAX,100.0,120.00,12000.00
12345678,Vanguard Federal Money Market Fund,VMFXX,3000.0,1.00,3000.00
12345678,Total,,,,15000.00
87654321,Vanguard Total Bond Market Index Fund,VBTLX,50.0,10.00,500.00

Account Number,Trade Date,Settlement Date,Transaction Type,Transaction Description,Investment Name,Symbol,Shares,Share Price,Principal Amount,Commission Fees,Net Amount,Accrued Interest,Account Type
12345678,2026-06-01,2026-06-02,Buy,Buy,Vanguard Total Stock Market Index Fund,VTSAX,10.0,120.00,-1200.00,0.00,-1200.00,0.00,CASH
`

describe('parseBrokerPositionsCsv — Schwab', () => {
  it('parses multi-account sections, summing positions and cash but not the Account Total row', () => {
    const r = parseBrokerPositionsCsv(SCHWAB_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.broker).toBe('schwab')
    expect(r.accounts).toHaveLength(2)

    const individual = r.accounts.find((a) => a.accountLabel.startsWith('Individual'))!
    expect(individual.totalValue).toBe(25250)
    expect(individual.costBasis).toBe(15000)
    expect(individual.positionCount).toBe(3)

    const roth = r.accounts.find((a) => a.accountLabel.startsWith('Roth IRA'))!
    expect(roth.totalValue).toBe(14000)
    expect(roth.costBasis).toBe(10000)
  })

  it('reports positions without basis as a review item, and never a silent import', () => {
    const r = parseBrokerPositionsCsv(SCHWAB_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.review.some((i) => i.status === 'defaulted' && i.detail.includes('no cost basis'))).toBe(true)
    expect(r.review.some((i) => i.status === 'unmapped')).toBe(true)
  })
})

describe('parseBrokerPositionsCsv — Fidelity', () => {
  it('groups by account number, labels with the account name, and ignores footer junk', () => {
    const r = parseBrokerPositionsCsv(FIDELITY_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.broker).toBe('fidelity')
    expect(r.accounts).toHaveLength(2)

    const individual = r.accounts.find((a) => a.accountLabel === 'Individual (Z12345678)')!
    expect(individual.totalValue).toBe(25050) // positions + money market; totals and pending activity excluded
    expect(individual.positionCount).toBe(2)
    expect(individual.costBasis).toBe(15000)

    const roth = r.accounts.find((a) => a.accountLabel === 'ROTH IRA (Z87654321)')!
    expect(roth.totalValue).toBe(14400)
    expect(roth.costBasis).toBe(12000)
  })

  it('never double-counts the Account Total row, and reports skipped pending activity', () => {
    const r = parseBrokerPositionsCsv(FIDELITY_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // The $25,050 total row re-states the two positions — counting it would double the account.
    expect(r.accounts.find((a) => a.accountLabel === 'Individual (Z12345678)')!.totalValue).toBe(25050)
    expect(r.review.some((i) => i.status === 'skipped' && i.source.includes('Pending Activity') && i.detail.includes('250'))).toBe(true)
  })
})

describe('parseBrokerPositionsCsv — Vanguard', () => {
  it('sums the holdings per account, skipping the total row and stopping at the transactions section', () => {
    const r = parseBrokerPositionsCsv(VANGUARD_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.broker).toBe('vanguard')
    expect(r.accounts).toHaveLength(2)
    // The "Total" summary row re-states the two holdings; funds whose *names*
    // start with "Total …" (with a real symbol) still count.
    expect(r.accounts.find((a) => a.accountLabel === '12345678')!.totalValue).toBe(15000)
    expect(r.accounts.find((a) => a.accountLabel === '12345678')!.positionCount).toBe(2)
    expect(r.accounts.find((a) => a.accountLabel === '87654321')!.totalValue).toBe(500)
  })

  it('reports the missing cost basis column as unmapped', () => {
    const r = parseBrokerPositionsCsv(VANGUARD_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.accounts.every((a) => a.costBasis === null)).toBe(true)
    expect(r.review.some((i) => i.status === 'unmapped' && i.source === 'Cost basis')).toBe(true)
  })
})

describe('parseBrokerPositionsCsv — hostile and malformed input', () => {
  it('refuses files that are not a recognized broker export, with a helpful message', () => {
    const r = parseBrokerPositionsCsv('name,phone\nalice,555-1234\n')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('spreadsheet import')
  })

  it('refuses plain text, JSON, and binary-ish garbage without throwing', () => {
    for (const junk of ['hello world', '{"a": 1}', '\u0000\u0001\u0002', 'PK\u0003\u0004fakezip']) {
      const r = parseBrokerPositionsCsv(junk)
      expect(r.ok).toBe(false)
    }
  })

  it('refuses truncated files that end inside a quote', () => {
    const r = parseBrokerPositionsCsv(SCHWAB_FIXTURE.slice(0, 200) + '"chopped')
    expect(r.ok).toBe(false)
  })

  it('skips rows with unparseable values instead of importing NaN, and reports them', () => {
    const hostile = `"Positions for account Test ...111 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"GOOD","FINE FUND","$1,000.00","$900.00"
"EVIL","BROKEN ROW","not-a-number","$1.00"
"HUGE","OVERFLOW","$99,999,999,999,999","$1.00"
`
    const r = parseBrokerPositionsCsv(hostile)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.accounts[0]!.totalValue).toBe(1000)
    expect(r.review.filter((i) => i.status === 'skipped')).toHaveLength(2)
  })

  it('keeps formula-injection strings as inert text in labels', () => {
    const hostile = `"Positions for account =HYPERLINK(""http://evil.test"") ...9 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"=1+1","<script>alert(1)</script>","$500.00","$400.00"
`
    const r = parseBrokerPositionsCsv(hostile)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.accounts[0]!.accountLabel).toContain('=HYPERLINK')
    expect(r.accounts[0]!.totalValue).toBe(500)
  })

  it('handles negative (short/margin) positions via parenthesized values', () => {
    const csv = `"Positions for account Margin ...5 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"LONG","FUND","$10,000.00","$8,000.00"
"SHORT","SHORT POSITION","($2,000.00)","--"
`
    const r = parseBrokerPositionsCsv(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.accounts[0]!.totalValue).toBe(8000)
  })
})

describe('applyBrokerBalance / guessAccountTypeFromLabel / draftPlanFromBrokerAccounts', () => {
  it('updates balance and basis on taxable accounts, balance only elsewhere', () => {
    const source = { accountLabel: 'X', totalValue: 12345.67, costBasis: 9000, positionCount: 2 }
    const taxable = applyBrokerBalance(
      { type: 'taxable', id: 't', name: 'B', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
      source,
    )
    expect(taxable).toMatchObject({ balance: 12345.67, costBasis: 9000 })

    const trad = applyBrokerBalance(
      { type: 'traditional', id: 'r', name: 'IRA', ownerPersonId: 'p', annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      source,
    )
    expect(trad).toMatchObject({ balance: 12345.67 })
    expect('costBasis' in trad).toBe(false)
  })

  it('leaves non-balance accounts (property, debt, pension) untouched', () => {
    const debt = { type: 'debt' as const, id: 'd', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 100, interestPct: 5, monthlyPayment: 1 }
    expect(applyBrokerBalance(debt, { accountLabel: 'X', totalValue: 999, costBasis: null, positionCount: 1 })).toBe(debt)
  })

  it('guesses account types from labels', () => {
    expect(guessAccountTypeFromLabel('Roth IRA ...321')).toBe('roth')
    expect(guessAccountTypeFromLabel('Rollover IRA (Z99)')).toBe('traditional')
    expect(guessAccountTypeFromLabel('MY 401K PLAN')).toBe('traditional')
    expect(guessAccountTypeFromLabel('Health Savings Account')).toBe('hsa')
    expect(guessAccountTypeFromLabel('Individual ...789')).toBe('taxable')
  })

  it('builds a schema-valid draft plan (through parsePlan) with every guess reported', () => {
    let n = 0
    const r = draftPlanFromBrokerAccounts(
      'schwab',
      [
        { accountLabel: 'Individual ...789', totalValue: 25250, costBasis: 15000, positionCount: 3 },
        { accountLabel: 'Roth IRA ...321', totalValue: 14000, costBasis: null, positionCount: 1 },
      ],
      () => `id-${++n}`,
    )
    expect(r.ok, JSON.stringify(!r.ok ? r.message : '')).toBe(true)
    if (!r.ok) return
    expect(parsePlan(r.plan).ok).toBe(true)
    expect(r.plan.accounts).toHaveLength(2)
    expect(r.plan.accounts[0]).toMatchObject({ type: 'taxable', balance: 25250, costBasis: 15000 })
    expect(r.plan.accounts[1]).toMatchObject({ type: 'roth', kind: 'ira', balance: 14000 })
    // Every created account carries a review item; the not-imported remainder is explicit.
    expect(r.review.filter((i) => i.status === 'defaulted').length).toBeGreaterThanOrEqual(2)
    expect(r.review.some((i) => i.status === 'unmapped')).toBe(true)
  })
})

describe('brokerCsv provenance (WS1)', () => {
  it('gives every review item a locator and a confidence, for all three brokers', () => {
    for (const fixture of [SCHWAB_FIXTURE, FIDELITY_FIXTURE, VANGUARD_FIXTURE]) {
      const r = parseBrokerPositionsCsv(fixture)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      for (const item of r.review) {
        expect(item.locator, `${item.source}`).toBeDefined()
        expect(item.confidence, `${item.source}`).toBeDefined()
      }
    }
  })

  it('records a Schwab balance as an exact sum of the position rows it read', () => {
    const r = parseBrokerPositionsCsv(SCHWAB_FIXTURE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const balance = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('Individual'))!
    expect(balance.confidence).toBe('exact')
    expect(balance.locator?.kind).toBe('derived')
    if (balance.locator?.kind === 'derived') {
      // AAPL is the first counted position: parsed rows are Positions title (1),
      // header (2), then AAPL at parsed-row 3.
      expect(balance.locator.from).toContainEqual({ kind: 'csvRow', row: 3, column: 'market value' })
      expect(balance.locator.from).toHaveLength(3) // three positions summed
    }
  })

  it('points a skipped Schwab row at its own row and marks it unmapped', () => {
    const hostile = `"Positions for account Test ...111 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"GOOD","FINE FUND","$1,000.00","$900.00"
"EVIL","BROKEN ROW","not-a-number","$1.00"
`
    const r = parseBrokerPositionsCsv(hostile)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const skipped = r.review.find((i) => i.status === 'skipped' && i.source.includes('EVIL'))!
    // Title (1), header (2), GOOD (3), EVIL (4).
    expect(skipped.locator).toEqual({ kind: 'csvRow', row: 4, column: 'market value' })
    expect(skipped.confidence).toBe('unmapped')
  })

  it('marks guessed account types assumed and the not-imported remainder unmapped in the draft', () => {
    const r = draftPlanFromBrokerAccounts(
      'schwab',
      [{ accountLabel: 'Individual ...789', totalValue: 25250, costBasis: 15000, positionCount: 3 }],
      (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const item of r.review) {
      expect(item.locator).toBeDefined()
      expect(item.confidence).toBeDefined()
    }
    const guess = r.review.find((i) => i.detail.includes('guessed from the name'))!
    expect(guess.confidence).toBe('assumed')
    expect(guess.locator?.kind).toBe('none')
    expect(r.review.find((i) => i.source === 'Everything except balances')!.confidence).toBe('unmapped')
  })
})
