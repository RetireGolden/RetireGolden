import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from './nra.js'

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
  'normal-retirement-age',
  {
    example: {
      inputs: { effectiveBirthYear: 2026 },
      expected: { years: 67, extraMonths: 0, totalMonths: 804 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/social-security/normal-retirement-age.md',
    mutation: 'DOCS/calculations/social-security/normal-retirement-age.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('assigns 67 years and 0 months, or 804 month slots, past the end of the ramp', () => {
      const fra = fraForBirthYear(inputs.effectiveBirthYear!)
      expect(fra.years).toBe(expected.years)
      expect(fra.extraMonths).toBe(expected.extraMonths)
      expectWithin(fraTotalMonths(fra), expected.totalMonths!, example.tolerance, 'totalMonths')
    })

    it('reaches the endpoint at the first year past the ramp and stays there', () => {
      expect(fraForBirthYear(1960)).toEqual(fraForBirthYear(inputs.effectiveBirthYear!))
      expect(fraForBirthYear(1959)).not.toEqual(fraForBirthYear(inputs.effectiveBirthYear!))
    })

    it('is not the survivor schedule, which caps at 66 years 8 months', () => {
      // The first wrong reading: the survivor FRA is 800 month slots, not 804.
      const survivorFra = survivorFraForBirthYear(inputs.effectiveBirthYear!)
      expect(fraTotalMonths(survivorFra)).toBe(800)
      expect(fraTotalMonths(survivorFra)).toBeLessThan(expected.totalMonths!)
    })
  },
)
