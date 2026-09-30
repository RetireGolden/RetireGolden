import { expect, it } from 'vitest'

import { startingInvestableOf } from '../montecarlo/riskBasedGuardrails.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import { cashAccount, singlePersonPlan, taxableAccount, traditionalAccount } from '../testing/planFixtures.js'
import { enteredBalanceSheet } from './enteredBalanceSheet.js'
import type { Account } from './plan.js'

function roth(id: string, balance: number): Account {
  return { type: 'roth', id, name: id, ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance, annualContribution: 0 }
}
function hsa(id: string, balance: number): Account {
  return { type: 'hsa', id, name: id, ownerPersonId: 'p1', annualReturnPct: 0, balance, annualContribution: 0 }
}
function equityComp(id: string, balance: number): Account {
  return { type: 'equityComp', id, name: id, ownerPersonId: null, annualReturnPct: 0, balance, costBasis: 0, annualContribution: 0, vestingMode: 'final', vestDate: null }
}
function property(id: string, value: number): Account {
  return { type: 'property', id, name: id, ownerPersonId: null, annualReturnPct: 0, value, plannedSaleYear: null, expectedNetProceeds: null }
}
function debt(id: string, balance: number): Account {
  return { type: 'debt', id, name: id, ownerPersonId: null, annualReturnPct: null, balance, interestPct: 5, monthlyPayment: 1_000 }
}
function pension(id: string, monthlyAmount: number): Account {
  return { type: 'pension', id, name: id, ownerPersonId: 'p1', annualReturnPct: null, startAge: 65, monthlyAmount, colaPct: 0, survivorPct: 0 }
}
function annuity(id: string, monthlyAmount: number): Account {
  return { type: 'annuity', id, name: id, ownerPersonId: 'p1', annualReturnPct: null, startAge: 65, monthlyAmount, colaPct: 0, taxablePct: 100 }
}

/** Case A: every account type, in the order a plan could list them. */
function caseA(): Account[] {
  return [
    cashAccount('cash', 40_000),
    taxableAccount('brokerage', 300_000, 200_000),
    traditionalAccount('ira', 500_000),
    roth('roth', 120_000),
    hsa('hsa', 25_000),
    equityComp('rsu', 15_000),
    property('home', 650_000),
    debt('mortgage', 210_000),
    pension('pension', 2_000),
    annuity('annuity', 1_500),
  ]
}

describeCalculation(
  'entered-balance-sheet',
  {
    example: {
      inputs: {
        caseA: 'cash 40,000; taxable 300,000; traditional 500,000; Roth 120,000; HSA 25,000; equityComp 15,000; property 650,000; debt 210,000; pension 2,000 a month; annuity 1,500 a month',
        caseB: 'cash 10,000; property 200,000; debt 350,000',
        caseC: 'no accounts',
        caseD: 'case A without the traditional account and the debt (a view that shows only some accounts)',
        caseE: 'cash 0.1; taxable 0.2; Roth 0.3',
      },
      expected: {
        caseA: { investable: 1_000_000, property: 650_000, assets: 1_650_000, liabilities: 210_000, netWorth: 1_440_000 },
        caseB: { investable: 10_000, property: 200_000, assets: 210_000, liabilities: 350_000, netWorth: -140_000 },
        caseC: { investable: 0, property: 0, assets: 0, liabilities: 0, netWorth: 0 },
        caseD: { investable: 500_000, property: 650_000, assets: 1_150_000, liabilities: 0, netWorth: 1_150_000 },
        wrongMonthlyAsBalanceInvestable: 1_003_500,
        wrongPropertyDroppedNetWorth: 790_000,
        wrongDebtAddedAssets: 1_860_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/household-map-entered-totals.md',
    mutation: 'DOCS/calculations/accounts-and-growth/household-map-entered-totals.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, unknown>

    it('case A: investable 1,000,000, property 650,000, assets 1,650,000, debts 210,000, net 1,440,000', () => {
      const sheet = enteredBalanceSheet(caseA())
      expect(sheet).toEqual(expected.caseA)
      expect(sheet.investable).not.toBe(expected.wrongMonthlyAsBalanceInvestable)
      expect(sheet.netWorth).not.toBe(expected.wrongPropertyDroppedNetWorth)
      expect(sheet.assets).not.toBe(expected.wrongDebtAddedAssets)
    })

    it('case B: debts larger than assets give a negative net of -140,000', () => {
      expect(enteredBalanceSheet([cashAccount('cash', 10_000), property('home', 200_000), debt('loan', 350_000)])).toEqual(expected.caseB)
    })

    it('case C: no accounts give a sheet of zeros', () => {
      expect(enteredBalanceSheet([])).toEqual(expected.caseC)
    })

    it('case D: the sheet of the accounts a view shows sums only those accounts', () => {
      const shown = caseA().filter((account) => account.id !== 'ira' && account.id !== 'mortgage')
      expect(enteredBalanceSheet(shown)).toEqual(expected.caseD)
    })

    it('case E: each sum adds its accounts in the order given, so 0.1, 0.2 and 0.3 give 0.6000000000000001', () => {
      const sheet = enteredBalanceSheet([cashAccount('a', 0.1), taxableAccount('b', 0.2, 0.2), roth('c', 0.3)])
      expect(sheet.investable).toBe(0.1 + 0.2 + 0.3)
      expect(sheet.investable).not.toBe(0.1 + (0.2 + 0.3))
    })

    it('reads the same investable total as the ledger\'s first-year portfolio, startingInvestableOf', () => {
      const plan = { ...singlePersonPlan(), accounts: caseA() }
      expect(enteredBalanceSheet(plan.accounts).investable).toBe(startingInvestableOf(plan))
    })

    it('refuses an entered figure that is not finite', () => {
      expect(() => enteredBalanceSheet([cashAccount('cash', Number.NaN)])).toThrow(RangeError)
      expect(() => enteredBalanceSheet([property('home', Number.POSITIVE_INFINITY)])).toThrow(RangeError)
      expect(() => enteredBalanceSheet([debt('loan', Number.NaN)])).toThrow(RangeError)
    })
  },
)
