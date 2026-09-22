import { expect, it } from 'vitest'

import { parsePlan, type Account, type CareEvent, type InsurancePolicy, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { PersonYearState } from '../types.js'
import {
  annualDebtServiceRows,
  annualLongTermCarePlan,
} from './annualDebtAndLongTermCare.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
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
  'spending-debt-service-annual',
  {
    example: {
      inputs: {
        debtA: { openingBalance: 10_000, interestPct: 12, monthlyPayment: 500, payoffYear: null },
        debtB: { openingBalance: 1_000, interestPct: 12, monthlyPayment: 100, payoffYear: 2030 },
        currentYear: 2030,
      },
      expected: {
        debtService: 7_120,
        debtAPayment: 6_000,
        debtBPayment: 1_120,
        debtARemaining: 5_200,
        debtBRemaining: 0,
        payBeforeGrowWrongReading: 7_000,
        ordinaryPaymentOnPayoffWrongReading: 7_200,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-debt-service-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-debt-service-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number | null> | number>
    const expected = example.expected as Record<string, number>
    const YEAR = inputs.currentYear as number
    const debtA = inputs.debtA as Record<string, number | null>
    const debtB = inputs.debtB as Record<string, number | null>

    function debtAccount(
      id: string,
      row: Record<string, number | null>,
    ): Account {
      return {
        type: 'debt',
        id,
        name: id,
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: row.openingBalance as number,
        interestPct: row.interestPct as number,
        monthlyPayment: row.monthlyPayment as number,
        payoffYear: row.payoffYear as number | null,
      } as unknown as Account
    }

    const accounts = [debtAccount('debt-a', debtA), debtAccount('debt-b', debtB)]

    it('grows each balance before paying, and pays Debt B out at its payoff year', () => {
      const rows = annualDebtServiceRows({
        accounts,
        balances: new Map([
          ['debt-a', debtA.openingBalance as number],
          ['debt-b', debtB.openingBalance as number],
        ]),
        year: YEAR,
      })
      expect(rows.map((row) => row.accountId)).toEqual(['debt-a', 'debt-b'])
      expectWithin(rows[0]!.amount, expected.debtAPayment!, example.tolerance, 'Debt A payment')
      expectWithin(rows[1]!.amount, expected.debtBPayment!, example.tolerance, 'Debt B payment')
      expectWithin(rows[0]!.nextBalance, expected.debtARemaining!, example.tolerance, 'Debt A remaining')
      expectWithin(rows[1]!.nextBalance, expected.debtBRemaining!, example.tolerance, 'Debt B remaining')

      const total = rows.reduce((sum, row) => sum + row.amount, 0)
      expectWithin(total, expected.debtService!, example.tolerance, 'annual debt service')
      // The worksheet's first two wrong readings.
      expect(withinTolerance(total, expected.payBeforeGrowWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(total, expected.ordinaryPaymentOnPayoffWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('publishes the same 7120 as expenses.debtService on a real 2030 ledger row', () => {
      // The same two debts inside a plan whose only other account is cash
      // large enough to fund them, so nothing but the debt rows can move the
      // published expense field.
      const plan = singlePersonPlan({ dob: `${YEAR - 60}-06-15`, planningAge: 95 })
      plan.accounts = [
        {
          type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0,
          balance: 500_000, annualContribution: 0,
        },
        ...accounts,
      ]
      const result = simulatePlan(validated(plan), {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
      expectWithin(
        row.expenses.debtService,
        expected.debtService!,
        example.tolerance,
        'expenses.debtService',
      )
    })
  },
)

describeCalculation(
  'spending-care-cost-gross-and-ltc-benefit-annual',
  {
    example: {
      inputs: {
        startYear: 2028,
        currentYear: 2030,
        careEpisodeStartAge: 80,
        currentAge: 80,
        episodeDurationYears: 3,
        episodeAnnualCost: 60_000,
        healthInflationFactor: 1.21,
        policyMonthlyBenefit: 5_000,
        inflationRiderPct: 5,
        eliminationPeriodDays: 90,
        benefitPeriodYears: 2,
        benefitYearsUsed: 0,
        secondPolicyYearsAllowed: 2,
        secondPolicyYearsUsed: 2,
      },
      expected: {
        careCost: 72_600,
        ltcBenefit: 49_839.0410958904,
        firstPolicyAnnualCapBeforeElimination: 66_150,
        todayDollarCostWrongReading: 60_000,
        noEliminationHaircutWrongReading: 66_150,
        haircutOnGrossCostWrongReading: 54_698.6301369863,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-care-cost-gross-and-ltc-benefit-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-care-cost-gross-and-ltc-benefit-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    const careEvents: readonly CareEvent[] = [
      {
        id: 'episode',
        personId: 'p1',
        startAge: inputs.careEpisodeStartAge!,
        durationYears: inputs.episodeDurationYears!,
        annualCost: inputs.episodeAnnualCost!,
      },
    ]
    const policies: readonly InsurancePolicy[] = [
      {
        kind: 'ltc', id: 'ltc-first', name: 'First LTC', owner: 'p1',
        annualPremium: 0, premiumMode: 'paidUp',
        benefitMonthly: inputs.policyMonthlyBenefit!,
        benefitPeriodYears: inputs.benefitPeriodYears!,
        eliminationPeriodDays: inputs.eliminationPeriodDays!,
        inflationRiderPct: inputs.inflationRiderPct!,
      },
      {
        kind: 'ltc', id: 'ltc-second', name: 'Second LTC', owner: 'p1',
        annualPremium: 0, premiumMode: 'paidUp',
        benefitMonthly: inputs.policyMonthlyBenefit!,
        benefitPeriodYears: inputs.secondPolicyYearsAllowed!,
        eliminationPeriodDays: inputs.eliminationPeriodDays!,
        inflationRiderPct: inputs.inflationRiderPct!,
      },
    ]

    function plan() {
      return annualLongTermCarePlan({
        careEvents,
        policies,
        benefitYearsUsed: new Map([
          ['ltc-first', inputs.benefitYearsUsed!],
          ['ltc-second', inputs.secondPolicyYearsUsed!],
        ]),
        resolvePerson: () => ({
          alive: true,
          ageAttained: inputs.currentAge!,
        } as unknown as PersonYearState),
        healthInflFactor: inputs.healthInflationFactor!,
        year: inputs.currentYear!,
        startYear: inputs.startYear!,
        capturePersonRows: false,
      })
    }

    it('charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut', () => {
      const result = plan()
      expectWithin(result.careCost, expected.careCost!, example.tolerance, 'expenses.careCost')
      expectWithin(result.ltcBenefit, expected.ltcBenefit!, example.tolerance, 'expenses.ltcBenefit')

      // The first policy's cap before the first-year haircut, stated by the
      // worksheet, is the rider-grown annual cap the engine builds.
      expectWithin(
        inputs.policyMonthlyBenefit! * 12 *
          Math.pow(1 + inputs.inflationRiderPct! / 100, inputs.currentYear! - inputs.startYear!),
        expected.firstPolicyAnnualCapBeforeElimination!,
        example.tolerance,
        'first-policy annual cap before elimination',
      )

      // Only the first policy pays: the second is out of benefit years.
      expect(result.benefitYearWrites.map((write) => write.policyId)).toEqual(['ltc-first'])

      // The worksheet's three numeric wrong readings.
      expect(withinTolerance(result.careCost, expected.todayDollarCostWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(result.ltcBenefit, expected.noEliminationHaircutWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(result.ltcBenefit, expected.haircutOnGrossCostWrongReading!, example.tolerance),
      ).toBe(false)
    })
  },
)
