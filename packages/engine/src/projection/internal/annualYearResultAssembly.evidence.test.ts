import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'
import { annualSnapshot, type AnnualSnapshot } from './annualSnapshot.js'
import {
  annualYearResultAssembly,
  type AnnualYearResultAssemblyInput,
} from './annualYearResultAssembly.js'

/**
 * The publication coordinators' outputs as this boundary takes them. Every
 * channel the two worksheets do not name sits at zero, so nothing but the
 * stated components can reach either published field. The shapes are the
 * production ones; the casts carry only the opaque evidence payloads this
 * boundary copies without reading.
 */
function assemblyInput(overrides: {
  snapshot: AnnualSnapshot
  ladderValue: number
  expensesTotal: number
  incomesTotal: number
  tax: number
  penalties: number
}): AnnualYearResultAssemblyInput {
  return {
    chronology: {
      year: 2030,
      inflationScale: 1,
      people: [] as unknown as YearResult['people'],
      filingStatus: 'single',
    },
    ledger: {
      incomes: { total: overrides.incomesTotal } as YearResult['incomes'],
      expenses: { total: overrides.expensesTotal } as YearResult['expenses'],
      contributions: 0,
      ownedNonRothIraContributions: 0,
      ownedNonRothIraBalancesBeforeGrowth: {},
      ownedNonRothIraPhysicalBalancesBeforeGrowth: [],
      ownedNonRothIraPhysicalOpeningBalances: [],
      qualifiedAnnuityPayments: [],
      socialSecurityStreams: [],
      employerMatch: 0,
    },
    entityFacts: {
      ownedRothIraPoolActivity: [] as unknown as NonNullable<YearResult['ownedRothIraPoolActivity']>,
      employerRothAccountActivity: [] as unknown as NonNullable<YearResult['employerRothAccountActivity']>,
      ownedTraditionalIraAggregateActivity: [] as unknown as NonNullable<
        YearResult['ownedTraditionalIraAggregateActivity']
      >,
    },
    retirement: {
      rmd: 0,
      rmdShortfallExciseTax: 0,
      rmdShortfallExciseDetails: [],
      sepp: 0,
      inheritedDistribution: 0,
      inheritedTraditionalDistribution: 0,
      inheritedAccounts: undefined,
      qcd: 0,
      rothConversion: 0,
      aggregateRothConversionAllocationBalances: undefined,
      aggregateRothConversionAllocationDesired: undefined,
      retirementRuntimeSource: {} as unknown as NonNullable<YearResult['retirementRuntimeSource']>,
      retirementRuntimeApplicationSource: {} as unknown as NonNullable<
        YearResult['retirementRuntimeApplicationSource']
      >,
      ownedNonRothIraPostGrowthSource: {} as unknown as NonNullable<
        YearResult['ownedNonRothIraPostGrowthSource']
      >,
      retirementActionExecution: undefined,
      rothConversionActionExecution: undefined,
      qcdActionExecution: undefined,
    },
    settlement: {},
    tax: {
      penalties: overrides.penalties,
      magi: 0,
      aca: undefined,
      medicarePremiums: 0,
      irmaaSurcharge: 0,
      irmaaTier: 0,
      irmaaLookbackMagi: 0,
      irmaaLookbackMagiSource: 'planFallback',
      irmaaLookbackMagiYear: 2028,
      irmaaNextTierThreshold: 0,
      advisoryFederalTax: {
        input: {} as unknown as NonNullable<YearResult['advisoryFederalTax']>['input'],
        detail: { alternativeMinimumTax: 0 } as NonNullable<YearResult['advisoryFederalTax']>['detail'],
      },
      ltcgZeroHeadroom: 0,
      ssEarningsTestWithheld: 0,
      ssdiPaid: 0,
      tax: overrides.tax,
    },
    funding: {
      withdrawals: { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
      realizedGains: { withdrawal: 0, rebalance: 0, retirementAction: 0 },
      taxExemptInterest: 0,
      capitalLossUsedAgainstGains: 0,
      capitalLossUsedAgainstOrdinary: 0,
      capitalLossCarryforwardRemaining: 0,
      surplusInvested: 0,
      shortfall: 0,
      requiredShortfall: 0,
      targetShortfall: 0,
      idealShortfall: 0,
      excessShortfall: 0,
      guardrailAction: 'hold',
      flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
    },
    balanceSheet: {
      snapshot: overrides.snapshot,
      ladderValue: overrides.ladderValue,
      deathBenefit: 0,
      hecmDraw: 0,
    },
  }
}

function emptySnapshot(): AnnualSnapshot {
  return annualSnapshot({
    balances: [],
    unassignedCash: 0,
    propertyValues: new Map(),
    debtBalances: new Map(),
    hecmStates: new Map(),
    insuranceCashValues: new Map(),
  })
}

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'accounts-net-worth-annual',
  {
    example: {
      inputs: {
        investableTotal: 552_000,
        propertyHomeA: 350_000,
        propertyHomeB: 200_000,
        insuranceCashValue: 12_000,
        ladderValue: 30_000,
        ordinaryDebt: 80_000,
        hecmLoanOnHomeA: 420_000,
        hecmLoanOnHomeB: 50_000,
      },
      expected: {
        netWorth: 664_000,
        propertyTotal: 550_000,
        cappedHecmDeduction: 400_000,
        uncappedHecmWrongReading: 594_000,
        withoutInsuranceAndLadderWrongReading: 622_000,
        addingDebtWrongReading: 824_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/accounts-net-worth-annual.md',
    mutation: 'DOCS/calculations/accounts-and-growth/accounts-net-worth-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('caps each HECM at its own home and composes 664000', () => {
      // A HECM balance is an accrual of draws, interest and mortgage-insurance
      // premium; no plan sets one to a chosen year-end figure. The worksheet's
      // case is therefore asserted at annualSnapshot, which applies the
      // non-recourse cap, and at annualYearResultAssembly, which composes the
      // published field.
      const snapshot = annualSnapshot({
        balances: [{ account: { id: 'investable' }, balance: inputs.investableTotal! }],
        unassignedCash: 0,
        propertyValues: new Map([
          ['home-a', inputs.propertyHomeA!],
          ['home-b', inputs.propertyHomeB!],
        ]),
        debtBalances: new Map([['debt', inputs.ordinaryDebt!]]),
        hecmStates: new Map([
          ['home-a', { loanBalance: inputs.hecmLoanOnHomeA! }],
          ['home-b', { loanBalance: inputs.hecmLoanOnHomeB! }],
        ]),
        insuranceCashValues: new Map([['life', inputs.insuranceCashValue!]]),
      })

      // The snapshot really is the worksheet's balance sheet.
      expectWithin(snapshot.investableTotal, inputs.investableTotal!, example.tolerance, 'investableTotal')
      expectWithin(snapshot.propertyTotal, expected.propertyTotal!, example.tolerance, 'propertyTotal')
      expectWithin(snapshot.debtTotal, inputs.ordinaryDebt!, example.tolerance, 'debtTotal')
      expectWithin(snapshot.insuranceCashValueTotal, inputs.insuranceCashValue!, example.tolerance, 'insuranceCashValueTotal')
      // The uncapped loan total is published too, and is not the subtrahend.
      expectWithin(
        snapshot.hecmLoanTotal,
        inputs.hecmLoanOnHomeA! + inputs.hecmLoanOnHomeB!,
        example.tolerance,
        'hecmLoanTotal',
      )
      expectWithin(snapshot.hecmEffectiveDebt, expected.cappedHecmDeduction!, example.tolerance, 'hecmEffectiveDebt')

      const row = annualYearResultAssembly(
        assemblyInput({
          snapshot,
          ladderValue: inputs.ladderValue!,
          expensesTotal: 0,
          incomesTotal: 0,
          tax: 0,
          penalties: 0,
        }),
      )
      expectWithin(row.netWorth, expected.netWorth!, example.tolerance, 'netWorth')
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.uncappedHecmWrongReading!,
        expected.withoutInsuranceAndLadderWrongReading!,
        expected.addingDebtWrongReading!,
      ]) {
        expect(withinTolerance(row.netWorth, wrong, example.tolerance)).toBe(false)
      }
    })

    it('adds property and subtracts debt on a real projection row', () => {
      // The channels a plan CAN set exactly: a cash account, a home, and an
      // ordinary debt. Net worth is investable plus the home less the debt.
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 100_000, annualContribution: 0 },
        { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: 0, value: 250_000, plannedSaleYear: null, expectedNetProceeds: null } as unknown as Account,
        { type: 'debt', id: 'loan', name: 'Loan', ownerPersonId: null, annualReturnPct: 0, balance: 40_000, interestPct: 0, monthlyPayment: 0 } as unknown as Account,
      ]
      const result = simulatePlan(validatedPlan(plan), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === 2026)
      if (row === undefined) throw new Error('missing projection year 2026')
      expectWithin(
        row.netWorth,
        row.investableTotal + 250_000 - 40_000,
        example.tolerance,
        'netWorth against its own published channels',
      )
      // Adding the debt rather than subtracting it moves the row by twice it.
      expect(withinTolerance(row.netWorth, row.investableTotal + 250_000 + 40_000, example.tolerance)).toBe(false)
    })
  },
)

describeCalculation(
  'portfolio-need-annual',
  {
    example: {
      inputs: {
        expensesTotal: 94_000,
        tax: 12_000,
        penalties: 1_000,
        incomesTotal: 90_000,
        surplusCaseIncomesTotal: 120_000,
      },
      expected: {
        netPortfolioNeed: 17_000,
        surplusCaseNetPortfolioNeed: 0,
        withoutPenaltiesWrongReading: 16_000,
        addingIncomeWrongReading: 197_000,
        unflooredSurplusWrongReading: -13_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/portfolio-need-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/portfolio-need-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    function needFor(incomesTotal: number): number {
      return annualYearResultAssembly(
        assemblyInput({
          snapshot: emptySnapshot(),
          ladderValue: 0,
          expensesTotal: inputs.expensesTotal!,
          incomesTotal,
          tax: inputs.tax!,
          penalties: inputs.penalties!,
        }),
      ).netPortfolioNeed
    }

    it('publishes 17000 of uncovered outflow', () => {
      const need = needFor(inputs.incomesTotal!)
      expectWithin(need, expected.netPortfolioNeed!, example.tolerance, 'netPortfolioNeed')
      // The worksheet's first two wrong readings.
      expect(withinTolerance(need, expected.withoutPenaltiesWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(need, expected.addingIncomeWrongReading!, example.tolerance)).toBe(false)
    })

    it('floors a surplus year at exactly 0 rather than publishing a negative need', () => {
      const need = needFor(inputs.surplusCaseIncomesTotal!)
      expect(need).toBe(expected.surplusCaseNetPortfolioNeed)
      expect(withinTolerance(need, expected.unflooredSurplusWrongReading!, example.tolerance)).toBe(false)
    })

    it('equals its own row\'s published components on a real projection', () => {
      const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
      ]
      plan.expenses.baseAnnual = 40_000
      plan.incomes = [
        { type: 'recurring', id: 'rec', label: 'Rental', annualAmount: 25_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
      ]
      const result = simulatePlan(validatedPlan(plan), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === 2026)
      if (row === undefined) throw new Error('missing projection year 2026')
      expect(row.netPortfolioNeed).toBeGreaterThan(0)
      expectWithin(
        row.netPortfolioNeed,
        Math.max(0, row.expenses.total + row.tax + row.penalties - row.incomes.total),
        example.tolerance,
        'netPortfolioNeed against its own published components',
      )
    })
  },
)

describeCalculation(
  'tax-realized-gains-annual',
  {
    example: {
      inputs: {
        taxableWithdrawals: 2_500,
        rebalancingSales: 750,
        namedRetirementActions: -200,
      },
      expected: {
        realizedGains: 3_050,
        droppingSignedLossWrongReading: 3_250,
        absoluteValuesWrongReading: 3_450,
        withdrawalsOnlyWrongReading: 2_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/tax-realized-gains-annual.md',
    mutation: 'DOCS/calculations/taxes/tax-realized-gains-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('folds 2500, 750 and -200 into a signed 3050', () => {
      const base = assemblyInput({
        snapshot: emptySnapshot(),
        ladderValue: 0,
        expensesTotal: 0,
        incomesTotal: 0,
        tax: 0,
        penalties: 0,
      })
      const row = annualYearResultAssembly({
        ...base,
        funding: {
          ...base.funding,
          realizedGains: {
            withdrawal: inputs.taxableWithdrawals!,
            rebalance: inputs.rebalancingSales!,
            retirementAction: inputs.namedRetirementActions!,
          },
        },
      })
      expectWithin(row.realizedGains, expected.realizedGains!, example.tolerance, 'realizedGains')
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.droppingSignedLossWrongReading!,
        expected.absoluteValuesWrongReading!,
        expected.withdrawalsOnlyWrongReading!,
      ]) {
        expect(withinTolerance(row.realizedGains, wrong, example.tolerance)).toBe(false)
      }
    })

    it('lets one source loss offset another source gain rather than flooring it', () => {
      const base = assemblyInput({
        snapshot: emptySnapshot(),
        ladderValue: 0,
        expensesTotal: 0,
        incomesTotal: 0,
        tax: 0,
        penalties: 0,
      })
      const row = annualYearResultAssembly({
        ...base,
        funding: {
          ...base.funding,
          realizedGains: {
            withdrawal: inputs.taxableWithdrawals!,
            rebalance: 0,
            retirementAction: -inputs.taxableWithdrawals!,
          },
        },
      })
      expect(row.realizedGains).toBe(0)
    })
  },
)

function validatedPlan(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}
