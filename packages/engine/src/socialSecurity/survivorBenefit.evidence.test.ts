import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { fraTotalMonths, survivorFraForBirthYear } from './nra.js'
import {
  SURVIVOR_EARLIEST_AGE,
  SURVIVOR_MAX_REDUCTION,
  WIDOW_LIMIT_PIA_FRACTION,
  survivorBenefitMonthly,
  survivorReductionFactor,
} from './survivorBenefit.js'

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

describeCalculation(
  'survivor-benefit-rib-lim',
  {
    example: {
      inputs: {
        deceasedPiaMonthly: 2_000,
        deceasedActualMonthly: 1_400,
        survivorClaimAgeYears: 60,
        survivorClaimAgeMonths: 0,
        survivorFraYears: 66,
        survivorFraExtraMonths: 8,
        widowLimitFraction: 0.825,
        maxReduction: 0.285,
      },
      expected: { widowLimitAmount: 1_650, factorAtAge60: 0.715, monthlyBenefit: 1_179.75 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/social-security/survivor-benefit-rib-lim.md',
    mutation: 'DOCS/calculations/social-security/survivor-benefit-rib-lim.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    // The worksheet's 66y8m survivor FRA is the 1960 row of the schedule, read from
    // the production table rather than written in.
    const survivorFra = survivorFraForBirthYear(1960)
    const survivorFraMonths = fraTotalMonths(survivorFra)

    it('floors the base at 82.5% of PIA and reduces it 28.5% at age 60', () => {
      expect(WIDOW_LIMIT_PIA_FRACTION).toBe(inputs.widowLimitFraction)
      expect(SURVIVOR_MAX_REDUCTION).toBe(inputs.maxReduction)
      expect(SURVIVOR_EARLIEST_AGE).toBe(inputs.survivorClaimAgeYears)
      expect(survivorFra.years).toBe(inputs.survivorFraYears)
      expect(survivorFra.extraMonths).toBe(inputs.survivorFraExtraMonths)

      expectWithin(
        inputs.deceasedPiaMonthly! * WIDOW_LIMIT_PIA_FRACTION,
        expected.widowLimitAmount!,
        example.tolerance,
        'widowLimitAmount',
      )
      const factor = survivorReductionFactor(
        inputs.survivorClaimAgeYears! * 12 + inputs.survivorClaimAgeMonths!,
        survivorFraMonths,
      )
      expectWithin(factor, expected.factorAtAge60!, { abs: 1e-12 }, 'factorAtAge60')

      const monthly = survivorBenefitMonthly({
        deceasedPiaMonthly: inputs.deceasedPiaMonthly!,
        deceasedActualMonthly: inputs.deceasedActualMonthly!,
        survivorClaimAge: {
          years: inputs.survivorClaimAgeYears!,
          months: inputs.survivorClaimAgeMonths!,
        },
        survivorFraMonths,
      })
      expectWithin(monthly, expected.monthlyBenefit!, example.tolerance, 'monthlyBenefit')
    })

    it('takes the widow limit over the deceased\'s smaller actual benefit', () => {
      // The first wrong reading: the 1,400 actual benefit reduced at 0.715
      // would publish 1,001.00.
      const monthly = survivorBenefitMonthly({
        deceasedPiaMonthly: inputs.deceasedPiaMonthly!,
        deceasedActualMonthly: inputs.deceasedActualMonthly!,
        survivorClaimAge: {
          years: inputs.survivorClaimAgeYears!,
          months: inputs.survivorClaimAgeMonths!,
        },
        survivorFraMonths,
      })
      expectWithin(
        monthly,
        expected.widowLimitAmount! * expected.factorAtAge60!,
        example.tolerance,
        'monthlyBenefit',
      )
      expect(monthly).toBeGreaterThan(inputs.deceasedActualMonthly! * expected.factorAtAge60!)
    })

    it('is unreduced at the survivor full retirement age and pays nothing without a PIA', () => {
      expect(survivorReductionFactor(survivorFraMonths, survivorFraMonths)).toBe(1)
      expect(
        survivorBenefitMonthly({
          deceasedPiaMonthly: 0,
          deceasedActualMonthly: inputs.deceasedActualMonthly!,
          survivorClaimAge: { years: inputs.survivorClaimAgeYears!, months: 0 },
          survivorFraMonths,
        }),
      ).toBe(0)
    })
  },
)
