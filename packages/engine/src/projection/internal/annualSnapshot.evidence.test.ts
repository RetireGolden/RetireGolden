import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import { annualSnapshot, type AnnualSnapshotBalance } from './annualSnapshot.js'

const YEAR = 2026

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function investableBalance(id: string, balance: number): AnnualSnapshotBalance {
  return { account: { id }, balance }
}

describeCalculation(
  'accounts-investable-total-annual',
  {
    example: {
      inputs: {
        cashAccounts: 15_000,
        taxableAccounts: 120_000,
        traditionalAccounts: 300_000,
        rothAccounts: 90_000,
        hsaAccounts: 25_000,
        unassignedCash: 2_000,
        equityCompensation: 40_000,
        insuranceCashValue: 12_000,
        ladderValue: 30_000,
      },
      expected: {
        investableTotal: 592_000,
        withoutEquityCompensationWrongReading: 552_000,
        withInsuranceCashValueWrongReading: 604_000,
        withLadderValueWrongReading: 622_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/accounts-investable-total-annual.md',
    mutation: 'DOCS/calculations/accounts-and-growth/accounts-investable-total-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('folds the seven investable members to 592000 and leaves the other three channels out', () => {
      // The worksheet's $2,000 of unassigned cash cannot coexist with its cash
      // and taxable accounts in a real plan: simulatePlan only tracks cash as
      // unassigned when there is no cash or taxable account for surplus to
      // land in. The case is therefore asserted at annualSnapshot, the
      // function that computes the field.
      const snapshot = annualSnapshot({
        balances: [
          investableBalance('cash', inputs.cashAccounts!),
          investableBalance('taxable', inputs.taxableAccounts!),
          investableBalance('traditional', inputs.traditionalAccounts!),
          investableBalance('roth', inputs.rothAccounts!),
          investableBalance('hsa', inputs.hsaAccounts!),
          investableBalance('equity-comp', inputs.equityCompensation!),
        ],
        unassignedCash: inputs.unassignedCash!,
        propertyValues: new Map(),
        debtBalances: new Map(),
        hecmStates: new Map(),
        insuranceCashValues: new Map([['life', inputs.insuranceCashValue!]]),
      })

      expect(
        withinTolerance(snapshot.investableTotal, expected.investableTotal!, example.tolerance),
        `investableTotal: actual ${snapshot.investableTotal}, worksheet ${expected.investableTotal}`,
      ).toBe(true)
      // Insurance cash value is folded into its own channel, not this one.
      expect(
        withinTolerance(snapshot.insuranceCashValueTotal, inputs.insuranceCashValue!, example.tolerance),
        `insuranceCashValueTotal: actual ${snapshot.insuranceCashValueTotal}, worksheet ${inputs.insuranceCashValue}`,
      ).toBe(true)
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.withoutEquityCompensationWrongReading!,
        expected.withInsuranceCashValueWrongReading!,
        expected.withLadderValueWrongReading!,
      ]) {
        expect(withinTolerance(snapshot.investableTotal, wrong, example.tolerance)).toBe(false)
      }
    })

    it('publishes the same member list on a real projection, excluding policy cash value and property', () => {
      // The six account members the worksheet names, at its own balances, plus
      // a permanent-life policy and a property the same row publishes
      // separately. Unassigned cash is 0 here, so the expected total is the
      // worksheet's 592,000 less its 2,000 of unassigned cash.
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      const accounts: Account[] = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: inputs.cashAccounts!, annualContribution: 0 },
        { type: 'taxable', id: 'taxable', name: 'Brokerage', ownerPersonId: 'p1', annualReturnPct: 0, balance: inputs.taxableAccounts!, costBasis: inputs.taxableAccounts!, annualContribution: 0, interestYieldPct: 0, dividendYieldPct: 0 },
        { type: 'traditional', id: 'traditional', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: inputs.traditionalAccounts!, annualContribution: 0 },
        { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: inputs.rothAccounts!, annualContribution: 0 },
        { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: 'p1', annualReturnPct: 0, balance: inputs.hsaAccounts!, annualContribution: 0 },
        { type: 'equityComp', id: 'equity-comp', name: 'RSUs', ownerPersonId: 'p1', annualReturnPct: 0, balance: inputs.equityCompensation!, costBasis: inputs.equityCompensation!, annualContribution: 0, vestingMode: 'final', vestDate: null },
        { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0, value: 350_000, plannedSaleYear: null, expectedNetProceeds: null } as unknown as Account,
      ]
      plan.accounts = accounts
      plan.insurance = [
        {
          kind: 'permanentLife', id: 'life', name: 'Whole life', insured: 'p1', beneficiary: 'estate',
          annualPremium: 0, premiumMode: 'lifetime', deathBenefit: 100_000,
          cashValue: inputs.insuranceCashValue!, cashValueMode: 'flatRate', cashValueGrowthPct: 0,
        },
      ]
      const result = simulatePlan(validated(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      const sixMembers =
        inputs.cashAccounts! + inputs.taxableAccounts! + inputs.traditionalAccounts! +
        inputs.rothAccounts! + inputs.hsaAccounts! + inputs.equityCompensation!
      expect(
        withinTolerance(row.investableTotal, sixMembers, example.tolerance),
        `investableTotal: actual ${row.investableTotal}, six worksheet members ${sixMembers}`,
      ).toBe(true)
      expect(
        withinTolerance(row.investableTotal, expected.investableTotal! - inputs.unassignedCash!, example.tolerance),
        `investableTotal: actual ${row.investableTotal}, worksheet less its unassigned cash ${expected.investableTotal! - inputs.unassignedCash!}`,
      ).toBe(true)
      // The two excluded channels are published on the same row and are not in it.
      expect(
        withinTolerance(row.insuranceCashValue, inputs.insuranceCashValue!, example.tolerance),
        `insuranceCashValue: actual ${row.insuranceCashValue}, worksheet ${inputs.insuranceCashValue}`,
      ).toBe(true)
      expect(row.balances.home).toBe(350_000)
      expect(withinTolerance(row.investableTotal, sixMembers + inputs.insuranceCashValue!, example.tolerance)).toBe(false)
      expect(withinTolerance(row.investableTotal, sixMembers + 350_000, example.tolerance)).toBe(false)
    })
  },
)
