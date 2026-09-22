import { expect, it } from 'vitest'

import type { Plan } from '../../model/plan.js'
import { parsePlan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { taxableSocialSecurity } from '../../tax/federalTax.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

const YEAR = 2026
const pack = packForYear(YEAR).pack

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function yearOf(plan: Plan): YearResult {
  const result = simulatePlan(validated(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFederalTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === YEAR)
  if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
  return row
}

describeCalculation(
  'medicare-magi-composition',
  {
    example: {
      inputs: {
        positiveCase: {
          ordinaryIncomeRealized: 40_000,
          realizedGains: 5_000,
          qualifiedDividends: 2_000,
          taxableSocialSecurity: 3_000,
          taxExemptInterest: 1_000,
        },
        floorCase: {
          // The worksheet's Justification names the construction: a capital-loss
          // carryforward carried into a year that realizes nothing else, so the
          // netting deducts the annual limit on the capital line and floors
          // ordinary income at zero.
          carryforwardIntoYear: 20_000,
          ordinaryIncomeRealized: 0,
          realizedGains: -3_000,
          qualifiedDividends: 0,
          taxableSocialSecurity: 0,
          taxExemptInterest: 0,
        },
      },
      expected: { positiveCase: 51_000, floorCase: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/medicare-magi-composition.md',
    mutation: 'DOCS/calculations/medicare-and-aca/medicare-magi-composition.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number>>
    const expected = example.expected as Record<string, number>
    const positive = inputs.positiveCase!

    /**
     * The smallest real plan whose single year realizes all five terms: a
     * recurring ordinary stream for the first, a one-time capital-gain income
     * for the second, a taxable account whose dividend yield is wholly
     * qualified and whose municipal sleeve carries the tax-exempt yield for
     * the third and fifth, and a Social Security stream sized so that section
     * 86 makes exactly the fourth taxable. Cost basis equals the balance so
     * nothing but the one-time income can realize a gain.
     */
    function positivePlan(): Plan {
      const plan = singlePersonPlan({ dob: '1955-03-15', planningAge: 95 })
      const dividendBase = 100_000
      // 85 percent of the benefit is taxable this far above the upper tier, so
      // the benefit that makes the worksheet's taxable share is that share
      // divided by 0.85, paid over twelve months at an unreduced claim.
      const ssAnnual = positive.taxableSocialSecurity! / 0.85
      plan.incomes = [
        {
          type: 'recurring',
          id: 'other-1',
          label: 'Rental',
          annualAmount: positive.ordinaryIncomeRealized!,
          startYear: null,
          endYear: null,
          inflationAdjusted: false,
          taxTreatment: 'ordinary',
        },
        {
          type: 'oneTime',
          id: 'gain-1',
          label: 'Realized gain',
          year: YEAR,
          inflationAdjusted: false,
          amount: positive.realizedGains!,
          taxTreatment: 'capitalGain',
        },
        {
          type: 'socialSecurity',
          id: 'ss-1',
          personId: 'p1',
          piaMonthly: ssAnnual / 12,
          earnings: null,
          claimAge: { years: 66, months: 2 },
        },
      ]
      plan.accounts = [
        {
          type: 'taxable',
          id: 'brokerage',
          name: 'Brokerage',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          balance: dividendBase,
          costBasis: dividendBase,
          annualContribution: 0,
          interestYieldPct: 0,
          dividendYieldPct: (positive.qualifiedDividends! / dividendBase) * 100,
          qualifiedRatio: 1,
          taxExemptInterestYieldPct: (positive.taxExemptInterest! / dividendBase) * 100,
        },
      ]
      return plan
    }

    it('composes the five realized terms into a 51,000 published MAGI', () => {
      const year = yearOf(positivePlan())
      const accepted = year.acceptedTaxInput
      if (accepted === undefined) throw new Error('the year published no accepted tax input')
      const taxableSs = taxableSocialSecurity(
        pack,
        'single',
        accepted.ordinaryIncome + accepted.capitalGains + (accepted.qualifiedDividends ?? 0),
        accepted.ssBenefits,
        accepted.taxExemptInterest,
        accepted.foreignExclusionAddback,
      )
      // The constructed year really does realize the worksheet's five terms.
      expectWithin(accepted.ordinaryIncome, positive.ordinaryIncomeRealized!, example.tolerance, 'ordinaryIncomeRealized')
      expectWithin(accepted.capitalGains, positive.realizedGains!, example.tolerance, 'realizedGains')
      expectWithin(accepted.qualifiedDividends ?? 0, positive.qualifiedDividends!, example.tolerance, 'qualifiedDividends')
      expectWithin(taxableSs, positive.taxableSocialSecurity!, example.tolerance, 'taxableSocialSecurity')
      expectWithin(accepted.taxExemptInterest ?? 0, positive.taxExemptInterest!, example.tolerance, 'taxExemptInterest')

      expectWithin(year.magi, expected.positiveCase!, example.tolerance, 'magi')
      // ... and the published figure is that composition, not some other sum.
      expectWithin(
        year.magi,
        Math.max(
          0,
          accepted.ordinaryIncome +
            accepted.capitalGains +
            (accepted.qualifiedDividends ?? 0) +
            taxableSs +
            (accepted.taxExemptInterest ?? 0),
        ),
        example.tolerance,
        'magi against its own published components',
      )
    })

    it('counts tax-exempt interest, which AGI does not', () => {
      // The first wrong reading: dropping the municipal yield publishes 50,000
      // and leaves MAGI equal to AGI.
      const year = yearOf(positivePlan())
      const accepted = year.acceptedTaxInput!
      expectWithin(accepted.taxExemptInterest ?? 0, positive.taxExemptInterest!, example.tolerance, 'taxExemptInterest')
      expect(year.magi).toBeGreaterThan(year.magi - (accepted.taxExemptInterest ?? 0))
      expectWithin(
        year.magi - (accepted.taxExemptInterest ?? 0),
        expected.positiveCase! - positive.taxExemptInterest!,
        example.tolerance,
        'magi without the municipal yield',
      )
    })

    it('floors a negative sum at zero rather than publishing it', () => {
      // The worksheet's re-derived floor case: the ordinary-income term is the
      // capital-loss netting's ordinaryAfter, floored at zero, so the only
      // negative sum the ledger can reach is a deductible capital loss on the
      // capital line with nothing else realized. The year is built from the
      // worksheet's construction and each term is checked against the
      // worksheet's floor-case inputs; the third wrong reading would publish
      // the negative sum.
      const floor = inputs.floorCase!
      const plan = singlePersonPlan({ dob: '1955-03-15', planningAge: 95 })
      plan.household.capitalLossCarryforward = floor.carryforwardIntoYear!
      const year = yearOf(plan)
      const accepted = year.acceptedTaxInput
      if (accepted === undefined) throw new Error('the year published no accepted tax input')
      const taxableSs = taxableSocialSecurity(
        pack,
        'single',
        accepted.ordinaryIncome + accepted.capitalGains + (accepted.qualifiedDividends ?? 0),
        accepted.ssBenefits,
        accepted.taxExemptInterest,
        accepted.foreignExclusionAddback,
      )
      expectWithin(accepted.ordinaryIncome, floor.ordinaryIncomeRealized!, example.tolerance, 'ordinaryIncomeRealized')
      expectWithin(accepted.capitalGains, floor.realizedGains!, example.tolerance, 'realizedGains')
      expectWithin(accepted.qualifiedDividends ?? 0, floor.qualifiedDividends!, example.tolerance, 'qualifiedDividends')
      expectWithin(taxableSs, floor.taxableSocialSecurity!, example.tolerance, 'taxableSocialSecurity')
      expectWithin(accepted.taxExemptInterest ?? 0, floor.taxExemptInterest!, example.tolerance, 'taxExemptInterest')
      const sum =
        accepted.ordinaryIncome +
        accepted.capitalGains +
        (accepted.qualifiedDividends ?? 0) +
        taxableSs +
        (accepted.taxExemptInterest ?? 0)
      expect(sum).toBeLessThan(0)
      expectWithin(year.magi, expected.floorCase!, example.tolerance, 'magi')
      expectWithin(year.magi, Math.max(0, sum), example.tolerance, 'magi against its own published components')
    })
  },
)
