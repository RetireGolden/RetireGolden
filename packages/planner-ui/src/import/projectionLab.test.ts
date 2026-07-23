/**
 * ProjectionLab mapper fixture + adversarial suite. The fixture is
 * real-shaped (currentFinances accounts/income/expenses + plans/milestones);
 * the acceptance bar is an explicit unmapped-items report, never a silent map.
 */

import { describe, expect, it } from 'vitest'

import { parsePlan } from '@retiregolden/engine/model/plan'
import { mapProjectionLabAccountType, mapProjectionLabExport } from './projectionLab'

let n = 0
const testIds = () => `pl-${++n}`

const PROJECTIONLAB_FIXTURE = JSON.stringify({
  meta: { app: 'ProjectionLab', exportVersion: 2, exportedAt: '2026-07-01' },
  user: { birthYear: 1970 },
  currentFinances: {
    accounts: [
      { id: 'acc1', name: 'Chase Checking', type: 'cash', balance: 12000 },
      { id: 'acc2', name: 'Brokerage', type: 'taxable', balance: 350000, costBasis: 210000 },
      { id: 'acc3', name: '401(k)', type: '401k', balance: 800000 },
      { id: 'acc4', name: 'Roth IRA', type: 'roth-ira', balance: 120000 },
      { id: 'acc5', name: 'HSA', type: 'hsa', balance: 30000 },
      { id: 'acc6', name: 'Home', type: 'real-estate', balance: 500000 },
      { id: 'acc7', name: 'Mortgage', type: 'mortgage', balance: 250000, interestRate: 3.5, payment: 1800 },
      { id: 'acc8', name: 'Crypto Wallet', type: 'crypto', balance: 25000 },
    ],
    incomeSources: [
      { name: 'Salary', type: 'employment', annualAmount: 150000 },
      { name: 'Rental duplex', type: 'other', annualAmount: 18000 },
      { name: 'Social Security', type: 'social-security', annualAmount: 30000 },
    ],
    expenses: [
      { name: 'Living', annualAmount: 60000 },
      { name: 'Travel', annualAmount: 12000 },
    ],
  },
  plans: [{ name: 'Base plan', milestones: [{ name: 'Retirement', age: 62 }] }],
})

describe('mapProjectionLabExport', () => {
  it('maps accounts, income, and spending from a real-shaped export into a valid draft plan', () => {
    const r = mapProjectionLabExport(PROJECTIONLAB_FIXTURE, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(parsePlan(r.plan).ok).toBe(true)
    expect(r.plan.name).toBe('Imported from ProjectionLab')

    const types = r.plan.accounts.map((a) => a.type).sort()
    expect(types).toEqual(['cash', 'debt', 'hsa', 'property', 'roth', 'taxable', 'traditional'])

    const taxable = r.plan.accounts.find((a) => a.type === 'taxable')!
    expect(taxable).toMatchObject({ balance: 350000, costBasis: 210000 })
    const trad = r.plan.accounts.find((a) => a.type === 'traditional')!
    expect(trad).toMatchObject({ balance: 800000, kind: 'employer' })
    const debt = r.plan.accounts.find((a) => a.type === 'debt')!
    expect(debt).toMatchObject({ balance: 250000, interestPct: 3.5, monthlyPayment: 1800 })
    const property = r.plan.accounts.find((a) => a.type === 'property')!
    expect(property).toMatchObject({ value: 500000 })

    // Household context: birth year and the retirement milestone.
    expect(r.plan.household.people[0]!.dob).toBe('1970-07-01')
    expect(r.plan.household.people[0]!.retirementAge).toBe(62)

    // Income: wages map, other income lands as recurring, SS is explicitly deferred.
    const wages = r.plan.incomes.find((i) => i.type === 'wages')
    expect(wages).toMatchObject({ annualGross: 150000 })
    const recurring = r.plan.incomes.find((i) => i.type === 'recurring')
    expect(recurring).toMatchObject({ annualAmount: 18000 })
    expect(r.plan.incomes.some((i) => i.type === 'socialSecurity')).toBe(false)

    // Spending: summed with a review note.
    expect(r.plan.expenses.baseAnnual).toBe(72000)
  })

  it('produces an explicit unmapped-items report (acceptance criterion)', () => {
    const r = mapProjectionLabExport(PROJECTIONLAB_FIXTURE, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const unmapped = r.review.filter((i) => i.status === 'unmapped')
    // The crypto account has no RetireGolden equivalent; SS needs a claim setup;
    // strategies/assumptions never transfer.
    expect(unmapped.some((i) => i.source.includes('Crypto Wallet'))).toBe(true)
    expect(unmapped.some((i) => i.source === 'Social Security')).toBe(true)
    expect(unmapped.some((i) => i.source.includes('Strategies'))).toBe(true)

    // Every invented default is visible too.
    const defaulted = r.review.filter((i) => i.status === 'defaulted')
    expect(defaulted.some((i) => i.source.includes('Filing status'))).toBe(true)
    expect(defaulted.some((i) => i.source.includes('Living'))).toBe(true)
  })

  it('refuses files that are not a ProjectionLab export, with a helpful message', () => {
    for (const bad of ['{"accounts": []}', '{"plans": []}', '[]', '"str"', '{"currentFinances": {"accounts": "no"}}']) {
      const r = mapProjectionLabExport(bad, testIds)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10)
    }
  })

  it('refuses non-JSON and oversized files without throwing', () => {
    expect(mapProjectionLabExport('not json {', testIds).ok).toBe(false)
    expect(mapProjectionLabExport('x'.repeat(10_000_001), testIds).ok).toBe(false)
  })

  it('skips hostile balances (negative, absurd, non-numeric) with review items instead of importing them', () => {
    const hostile = JSON.stringify({
      currentFinances: {
        accounts: [
          { name: 'Fine', type: 'cash', balance: 100 },
          { name: 'Negative', type: 'cash', balance: -5 },
          { name: 'Absurd', type: 'cash', balance: 1e15 },
          { name: 'NaN-ish', type: 'cash', balance: 'lots' },
          { name: '<script>alert(1)</script>', type: 'cash', balance: 200 },
        ],
      },
    })
    const r = mapProjectionLabExport(hostile, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts).toHaveLength(2)
    expect(r.plan.accounts[1]!.name).toBe('<script>alert(1)</script>') // inert data, never rendered as markup
    expect(r.review.filter((i) => i.status === 'skipped')).toHaveLength(3)
  })

  it('maps account-type strings by keyword', () => {
    expect(mapProjectionLabAccountType('pre-tax', 'Old 457 plan')).toBe('traditional')
    expect(mapProjectionLabAccountType('', 'Roth 401k')).toBe('roth')
    expect(mapProjectionLabAccountType('investment', 'Index funds')).toBe('taxable')
    expect(mapProjectionLabAccountType('', 'Emergency fund')).toBe('cash')
    expect(mapProjectionLabAccountType('collectible', 'Pokemon cards')).toBeNull()
  })

  it('classifies loans against retirement accounts as debt, never assets', () => {
    expect(mapProjectionLabAccountType('', '401k loan')).toBe('debt')
    expect(mapProjectionLabAccountType('loan', 'Loan against 401(k)')).toBe('debt')
    expect(mapProjectionLabAccountType('', 'IRA loan')).toBe('debt')
    expect(mapProjectionLabAccountType('', 'Margin loan')).toBe('debt')
    expect(mapProjectionLabAccountType('', 'HELOC')).toBe('debt')
  })

  it('accepts stringified numeric balances via the strict money parser', () => {
    const json = JSON.stringify({
      currentFinances: {
        accounts: [
          { name: 'String balance', type: 'cash', balance: '350000' },
          { name: 'Currency string', type: 'cash', balance: '$4,500.50' },
          { name: 'Junk string', type: 'cash', balance: 'lots of money' },
        ],
      },
    })
    const r = mapProjectionLabExport(json, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.accounts.map((a) => a.type === 'cash' && a.balance)).toEqual([350000, 4500.5])
    expect(r.review.some((i) => i.status === 'skipped' && i.source === 'Junk string')).toBe(true)
  })

  it('never defaults debt interest silently and scales fraction-looking rates', () => {
    const json = JSON.stringify({
      currentFinances: {
        accounts: [
          { name: 'No-rate loan', type: 'mortgage', balance: 100000, payment: 900 },
          { name: 'Fraction-rate loan', type: 'mortgage', balance: 50000, interestRate: 0.035, payment: 400 },
        ],
      },
    })
    const r = mapProjectionLabExport(json, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [noRate, fraction] = r.plan.accounts
    expect(noRate).toMatchObject({ type: 'debt', interestPct: 5 })
    expect(fraction).toMatchObject({ type: 'debt', interestPct: 3.5 })
    expect(r.review.some((i) => i.source === 'No-rate loan' && i.status === 'defaulted' && i.detail.includes('5%'))).toBe(true)
    expect(r.review.some((i) => i.source === 'Fraction-rate loan' && i.status === 'defaulted' && i.detail.includes('fraction'))).toBe(true)
  })
})

describe('projectionLab provenance (WS1)', () => {
  it('gives every review item a locator and a confidence', () => {
    const r = mapProjectionLabExport(PROJECTIONLAB_FIXTURE, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const item of r.review) {
      expect(item.locator, item.source).toBeDefined()
      expect(item.confidence, item.source).toBeDefined()
    }
  })

  it('points each account item at its JSON path with the right confidence', () => {
    const r = mapProjectionLabExport(PROJECTIONLAB_FIXTURE, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // Brokerage is accounts[1]; a mapped balance is exact.
    const brokerage = r.review.find((i) => i.status === 'mapped' && i.source.startsWith('Brokerage'))!
    expect(brokerage.locator).toEqual({ kind: 'jsonPath', path: 'currentFinances.accounts[1]' })
    expect(brokerage.confidence).toBe('exact')

    // Crypto Wallet is accounts[7]; no mapping, so unmapped.
    const crypto = r.review.find((i) => i.status === 'unmapped' && i.source.startsWith('Crypto Wallet'))!
    expect(crypto.locator).toEqual({ kind: 'jsonPath', path: 'currentFinances.accounts[7]' })
    expect(crypto.confidence).toBe('unmapped')
  })

  it('marks the July-1 DOB assumption and derives the expense baseline', () => {
    const r = mapProjectionLabExport(PROJECTIONLAB_FIXTURE, testIds)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const dob = r.review.find((i) => i.source.startsWith('Birth year'))!
    expect(dob.locator).toEqual({ kind: 'jsonPath', path: 'user.birthYear' })
    expect(dob.confidence).toBe('assumed')

    const milestone = r.review.find((i) => i.source.startsWith('Milestone'))!
    expect(milestone.locator).toEqual({ kind: 'jsonPath', path: 'plans[0].milestones[0].age' })
    expect(milestone.confidence).toBe('exact')

    // The spending baseline is the sum of two expenses — a derived value.
    const spending = r.review.find((i) => i.source === 'Living, Travel')!
    expect(spending.confidence).toBe('derived')
    expect(spending.locator?.kind).toBe('derived')
    if (spending.locator?.kind === 'derived') {
      expect(spending.locator.from).toEqual([
        { kind: 'jsonPath', path: 'currentFinances.expenses[0]' },
        { kind: 'jsonPath', path: 'currentFinances.expenses[1]' },
      ])
    }
  })
})
