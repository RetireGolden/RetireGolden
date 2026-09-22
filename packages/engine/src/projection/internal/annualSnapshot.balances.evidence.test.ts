import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import type { Account } from '../../model/plan.js'
import { recurringOrdinaryIncome, singlePersonPlan, validatePlan } from '../../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { simulatePlan } from '../simulate.js'
import { annualSnapshot } from './annualSnapshot.js'

const YEAR = 2026

describeCalculation(
  'accounts-balance-per-account-annual',
  {
    example: {
      inputs: {
        investableIdAndOpening: ['acct-1', 100_000],
        contributions: 10_000,
        withdrawals: 15_000,
        returnPct: 0,
        propertyIdOpeningAppreciation: ['home-1', 200_000, 3],
        debtIdOpeningAmortized: ['debt-1', 30_000, 4_000],
        permanentLifePolicies: 0,
        collisionId: 'shared',
        collisionInsuranceCashValue: 8_000,
      },
      expected: {
        investableClose: 95_000,
        propertyClose: 206_000,
        debtClose: 26_000,
        collisionClose: 8_000,
        propertyGrowthOnAccountWrongReading: 97_850,
        debtAsNegativeAssetWrongReading: -26_000,
        firstWriteWinsWrongReading: 95_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/accounts-balance-per-account-annual.md',
    mutation: 'DOCS/calculations/accounts-and-growth/accounts-balance-per-account-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>
    const [investableId, opening] = inputs.investableIdAndOpening as [string, number]
    const [propertyId, propertyOpening, appreciationPct] = inputs.propertyIdOpeningAppreciation as [string, number, number]
    const [debtId, debtOpening, amortized] = inputs.debtIdOpeningAmortized as [string, number, number]
    const contributions = inputs.contributions as number
    const withdrawals = inputs.withdrawals as number

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    it('writes each channel its own year-end figure, netting nothing across them', () => {
      // A 51-year-old single filer, a flat zero-tax double, a single
      // projection year. Income funds the contribution and the debt service so
      // the only thing that leaves the investable account is the worksheet's
      // withdrawal, delivered as an uninflated one-time goal. The worksheet's
      // 3% property appreciation is set as the plan's GENERAL inflation,
      // because propertyEventsAndGrowth grows a property at general inflation
      // and ignores the account's own annualReturnPct; in the start year every
      // cumulative factor is still 1, so nothing else moves.
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.assumptions.inflationPct = appreciationPct
      plan.accounts = [
        {
          type: 'cash', id: investableId, name: investableId, ownerPersonId: null,
          annualReturnPct: inputs.returnPct as number, balance: opening, annualContribution: contributions,
        },
        {
          type: 'property', id: propertyId, name: propertyId, ownerPersonId: null,
          annualReturnPct: 0, value: propertyOpening,
          plannedSaleYear: null, expectedNetProceeds: null,
        } as unknown as Account,
        {
          type: 'debt', id: debtId, name: debtId, ownerPersonId: null, annualReturnPct: 0,
          balance: debtOpening, interestPct: 0, monthlyPayment: amortized / 12,
        } as unknown as Account,
      ]
      plan.incomes = [recurringOrdinaryIncome('income', contributions + amortized)]
      plan.expenses.oneTimeGoals = [
        { id: 'withdrawal', label: 'Withdrawal', year: YEAR, amount: withdrawals },
      ]
      const result = simulatePlan(validatePlan(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFlatTaxCalculator(0),
      })
      const balances = result.years[0]!.balances

      expect(Object.keys(balances).sort()).toEqual([investableId, debtId, propertyId].sort())
      expectWithin(balances[investableId]!, expected.investableClose!, investableId)
      expectWithin(balances[propertyId]!, expected.propertyClose!, propertyId)
      expectWithin(balances[debtId]!, expected.debtClose!, debtId)
      // The worksheet's first two wrong readings: property appreciation on the
      // account, and the debt recorded as a negative asset.
      expect(
        withinTolerance(balances[investableId]!, expected.propertyGrowthOnAccountWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(balances[debtId]!, expected.debtAsNegativeAssetWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('lets the last channel written win an id collision', () => {
      // No plan can give an investable account, a property, a debt and a
      // policy the same id — the plan schema rejects duplicate identifiers —
      // so the overwrite order is asserted on the snapshot itself, which is
      // where the order lives.
      const collisionId = inputs.collisionId as string
      const snapshot = annualSnapshot({
        balances: [{ account: { id: collisionId }, balance: expected.investableClose! }],
        unassignedCash: 0,
        propertyValues: new Map([[collisionId, expected.propertyClose!]]),
        debtBalances: new Map([[collisionId, expected.debtClose!]]),
        hecmStates: new Map(),
        insuranceCashValues: new Map([[collisionId, inputs.collisionInsuranceCashValue as number]]),
      })
      expect(snapshot.balanceRecord[collisionId]).toBe(expected.collisionClose)
      // The worksheet's third wrong reading: first write wins.
      expect(snapshot.balanceRecord[collisionId]).not.toBe(expected.firstWriteWinsWrongReading)
    })
  },
)
