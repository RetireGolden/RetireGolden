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

const WITHDRAWAL_YEAR = 2026

/**
 * The withdrawal worksheets' plan: five accounts holding exactly the
 * worksheet's five category amounts, drained by a base lifestyle far above the
 * portfolio under the sequential order cash to taxable to traditional to Roth
 * to HSA. The owner is 76, so the traditional draw also carries a real RMD.
 * Zero inflation, zero returns, no taxable yield and cost basis equal to
 * balance, so nothing but the drain can move the year.
 */
function drainedYear(): YearResult {
  const plan = singlePersonPlan({ dob: '1950-06-15', planningAge: 95 })
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 4_000, annualContribution: 0 },
    { type: 'taxable', id: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: 0, balance: 11_000, costBasis: 11_000, annualContribution: 0, interestYieldPct: 0, dividendYieldPct: 0 },
    { type: 'traditional', id: 'traditional', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 18_000, annualContribution: 0 },
    { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 7_000, annualContribution: 0 },
    { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: 'p1', annualReturnPct: 0, balance: 2_000, annualContribution: 0 },
  ]
  plan.expenses.baseAnnual = 200_000
  const result = simulatePlan(validated(plan), {
    startYear: WITHDRAWAL_YEAR,
    horizonEndYear: WITHDRAWAL_YEAR,
    taxCalculator: createFederalTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === WITHDRAWAL_YEAR)
  if (row === undefined) throw new Error(`missing projection year ${WITHDRAWAL_YEAR}`)
  return row
}

describeCalculation(
  'withdrawals-total-annual',
  {
    example: {
      inputs: { cash: 4_000, taxable: 11_000, traditional: 18_000, roth: 7_000, hsa: 2_000 },
      expected: { total: 42_000, withoutHsaWrongReading: 40_000, rothSubtractedWrongReading: 28_000 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawals-total-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/withdrawals-total-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('sums the five categories to 42000', () => {
      const row = drainedYear()
      const withdrawals = row.withdrawals
      // The constructed year really does publish the worksheet's five amounts.
      for (const key of ['cash', 'taxable', 'traditional', 'roth', 'hsa'] as const) {
        expectWithin(withdrawals[key], inputs[key]!, example.tolerance, `withdrawals.${key}`)
      }
      expectWithin(withdrawals.total, expected.total!, example.tolerance, 'withdrawals.total')
      // ... and the published total is that sum of its own members.
      expectWithin(
        withdrawals.total,
        withdrawals.cash + withdrawals.taxable + withdrawals.traditional + withdrawals.roth + withdrawals.hsa,
        example.tolerance,
        'withdrawals.total against its own published categories',
      )
      // The worksheet's two wrong readings.
      expect(withinTolerance(withdrawals.total, expected.withoutHsaWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(withdrawals.total, expected.rothSubtractedWrongReading!, example.tolerance)).toBe(false)
    })
  },
)

describeCalculation(
  'withdrawals-by-category-annual',
  {
    example: {
      inputs: {
        cash: 4_000,
        taxable: 11_000,
        traditional: 18_000,
        roth: 7_000,
        hsa: 2_000,
        rmdSubsetOfTraditional: 8_000,
        seppSubsetOfTraditional: 3_000,
        forcedInheritedTraditionalSubset: 2_000,
        forcedInheritedRothSubset: 1_000,
      },
      expected: {
        traditional: 18_000,
        roth: 7_000,
        hsa: 2_000,
        subsetsAddedToTraditionalWrongReading: 31_000,
        inheritedRothInTraditionalWrongReading: 19_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawals-by-category-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/withdrawals-by-category-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('reports each account\'s draw in its own source category', () => {
      const row = drainedYear()
      const withdrawals = row.withdrawals
      // Each category equals its own account's opening balance: the partition
      // is by SOURCE account, in the sequential order the comment names.
      expectWithin(withdrawals.cash, inputs.cash!, example.tolerance, 'withdrawals.cash')
      expectWithin(withdrawals.taxable, inputs.taxable!, example.tolerance, 'withdrawals.taxable')
      expectWithin(withdrawals.traditional, expected.traditional!, example.tolerance, 'withdrawals.traditional')
      expectWithin(withdrawals.roth, expected.roth!, example.tolerance, 'withdrawals.roth')
      // HSA is a withdrawal category, not a sixth non-withdrawal bucket.
      expectWithin(withdrawals.hsa, expected.hsa!, example.tolerance, 'withdrawals.hsa')
    })

    it('keeps the RMD inside traditional rather than adding it again', () => {
      const row = drainedYear()
      // The worksheet's stated 8,000/3,000/2,000/1,000 subset split is not
      // constructed: those amounts are derived by the engine from age, balance
      // and beneficiary facts and cannot be set to chosen values inside a
      // traditional draw that must also equal 18,000. This run's own RMD is a
      // real, nonzero subset of the published traditional category.
      expect(row.rmd).toBeGreaterThan(0)
      expect(row.withdrawals.traditional).toBeGreaterThan(row.rmd)
      expectWithin(row.withdrawals.traditional, expected.traditional!, example.tolerance, 'withdrawals.traditional')
      expect(
        withinTolerance(
          row.withdrawals.traditional,
          row.withdrawals.traditional + row.rmd + row.sepp + row.inheritedTraditionalDistribution,
          example.tolerance,
        ),
      ).toBe(false)
      // The worksheet's two wrong readings, as totals.
      expect(withinTolerance(row.withdrawals.traditional, expected.subsetsAddedToTraditionalWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(row.withdrawals.traditional, expected.inheritedRothInTraditionalWrongReading!, example.tolerance)).toBe(false)
    })
  },
)
