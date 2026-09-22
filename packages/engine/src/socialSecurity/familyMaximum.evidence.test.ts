import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { familyMaximumMonthlyFromPia } from './familyMaximum.js'
import { FAMILY_MAXIMUM_BEND_POINTS } from './ssaWageData.js'

describeCalculation(
  'family-maximum-bend-points',
  {
    example: {
      inputs: {
        eligibilityYear: 2026,
        crossAllThreePiaMonthly: 4_000,
        belowFirstPiaMonthly: 1_000,
        firstBendPoint: 1_643,
        secondBendPoint: 2_371,
        thirdBendPoint: 3_093,
      },
      // The dime-floored publications. The unrounded sums, 6,999.39 and
      // 1,500.00, are intermediates the worksheet names but does not publish.
      expected: { crossAllThreeMonthly: 6_999.3, belowFirstMonthly: 1_500 },
      // The worksheet asks for exact equality on the dime-floored figure; the
      // registry's 'exact' is reserved for all-integer expectations, so the
      // same contract is written as a zero absolute bound.
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/social-security/family-maximum-bend-points.md',
    mutation: 'DOCS/calculations/social-security/family-maximum-bend-points.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    function expectExactly(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${target}`,
      ).toBe(true)
    }

    it('reads the 2026 bend points the worksheet names from the production table', () => {
      const bendPoints = FAMILY_MAXIMUM_BEND_POINTS[inputs.eligibilityYear!]
      expect(bendPoints).toBeDefined()
      expect(bendPoints!.first).toBe(inputs.firstBendPoint)
      expect(bendPoints!.second).toBe(inputs.secondBendPoint)
      expect(bendPoints!.third).toBe(inputs.thirdBendPoint)
    })

    it('crosses all three bend points to a dime-floored 6999.30', () => {
      const actual = familyMaximumMonthlyFromPia(
        inputs.crossAllThreePiaMonthly!,
        inputs.eligibilityYear!,
      )
      expectExactly(actual, expected.crossAllThreeMonthly!, 'family maximum')
      // The worksheet's wrong readings: dropping the slice above the third
      // bend point, and publishing the unrounded sum.
      expect(withinTolerance(actual, 5_412.1, example.tolerance)).toBe(false)
      expect(withinTolerance(actual, 6_999.39, example.tolerance)).toBe(false)
    })

    it('isolates the first band below the first bend point at 1500.00', () => {
      const actual = familyMaximumMonthlyFromPia(
        inputs.belowFirstPiaMonthly!,
        inputs.eligibilityYear!,
      )
      expectExactly(actual, expected.belowFirstMonthly!, 'family maximum')
      // The worksheet's second wrong reading applies the PIA formula's own
      // 90/32/15 percent rates; on this case that is the PIA itself, not
      // 150 percent of it.
      expect(withinTolerance(actual, inputs.belowFirstPiaMonthly!, example.tolerance)).toBe(false)
    })
  },
)
