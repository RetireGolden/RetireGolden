import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../../rules/describeCalculation.js'
import type { Plan } from '../../../model/plan.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../../../testing/planFixtures.js'
import { simulatePlan } from '../../simulate.js'
import type { YearAcaResult } from './aca.js'

const YEAR = 2026

/**
 * The smallest plan that publishes an ACA year result: a 63-year-old single
 * filer (pre-65, so every month is a Marketplace month and no Medicare month
 * competes), the credit on, one uninflated recurring ordinary stream that puts
 * the household inside the credit range, zero return and zero inflation, and a
 * cash account to fund the premium.
 */
function acaPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.accounts = [cashAccount('cash', 60_000)]
  plan.incomes = [recurringOrdinaryIncome('ordinary', 30_000)]
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 500,
    applyAcaCredit: true,
    medicareExtrasMonthlyPerPerson: 0,
  }
  return plan
}

function acaRow(plan: Plan): YearAcaResult {
  const result = simulatePlan(validatePlan(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: productionTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === YEAR)
  if (row === undefined) throw new Error(`missing projection year ${YEAR}`)
  if (row.aca === undefined) throw new Error('expected an ACA result on the year row')
  return row.aca
}

describeCalculation(
  'aca-enrollment-and-applicable-slcsp-premium-annual',
  {
    example: {
      inputs: {
        coveredMemberId: 'p1',
        coveredMonths: [1, 2, 3],
        enrollmentPremiumJanuaryToMarch: 500,
        enrollmentPremiumAprilToDecember: 0,
        slcspBenchmarkJanuaryToApril: 600,
        slcspBenchmarkMayToDecember: 0,
        contractPresent: true,
        contractInputsMatch: true,
      },
      expected: {
        grossEnrollmentPremium: 1_500,
        applicableSlcspPremium: 1_800,
        noContractApplicableSlcspPremium: null,
        countingAprilBenchmarkWrongReading: 2_400,
        benchmarkSummedIntoGrossWrongReading: 1_800,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-enrollment-and-applicable-slcsp-premium-annual.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-enrollment-and-applicable-slcsp-premium-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[] | string | boolean>
    const expected = example.expected as Record<string, number | null>
    const enrollment = inputs.enrollmentPremiumJanuaryToMarch as number
    const benchmark = inputs.slcspBenchmarkJanuaryToApril as number
    const enrolledMonths = (inputs.coveredMonths as number[]).length

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    it('sums three enrolled months of premium and three of benchmark, excluding April', () => {
      const plan = acaPlan()
      plan.expenses.healthcare.acaYears = [
        {
          year: YEAR,
          fplRegion: 'contiguous',
          taxFamilyMembers: [
            { personId: 'p1', relationship: 'primary', requiredToFile: 'required', magi: 0 },
          ],
          coveredMembers: [
            {
              personId: inputs.coveredMemberId as string,
              // January-March enrolled; April-December not.
              enrollmentPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
                month < enrolledMonths ? enrollment : (inputs.enrollmentPremiumAprilToDecember as number),
              ),
              // January-APRIL quoted; May-December not. April carries a
              // benchmark with no enrollment behind it.
              slcspBenchmarkPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
                month < enrolledMonths + 1 ? benchmark : (inputs.slcspBenchmarkMayToDecember as number),
              ),
            },
          ],
          taxExemptInterest: { state: 'notApplicable', amount: null },
          foreignExclusionAddback: { state: 'notApplicable', amount: null },
          assertions: {
            coverageEligibility: 'supported',
            form8814: 'notApplicable',
            specialAllocation: 'notApplicable',
            marriedFilingSeparatelyException: 'notApplicable',
            selfEmployedHealthInsuranceDeduction: 'notApplicable',
            otherMaterialFacts: 'none',
          },
        },
      ]
      const aca = acaRow(plan)

      // The constructed contract really does put three enrolled months on the
      // year, with a fourth benchmark quote behind no enrollment.
      expect(aca.coveredMembers[0]!.coveredMonths).toEqual(inputs.coveredMonths)
      expectWithin(aca.grossEnrollmentPremium, expected.grossEnrollmentPremium as number, 'grossEnrollmentPremium')
      expect(aca.applicableSlcspPremium).not.toBe(null)
      expectWithin(aca.applicableSlcspPremium!, expected.applicableSlcspPremium as number, 'applicableSlcspPremium')
      // The worksheet's first two wrong readings: counting April's benchmark,
      // and folding the benchmark into gross enrollment.
      expect(
        withinTolerance(aca.applicableSlcspPremium!, expected.countingAprilBenchmarkWrongReading as number, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(aca.grossEnrollmentPremium, expected.benchmarkSummedIntoGrossWrongReading as number, example.tolerance),
      ).toBe(false)
    })

    it('publishes null, not zero, for the applicable benchmark without a contract', () => {
      const aca = acaRow(acaPlan())
      // The worksheet's third wrong reading: a numeric zero where the contract
      // requires the null distinction. Gross enrollment is still a number.
      expect(aca.applicableSlcspPremium).toBe(expected.noContractApplicableSlcspPremium)
      expect(aca.grossEnrollmentPremium).toBeGreaterThan(0)
    })
  },
)
