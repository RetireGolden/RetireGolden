import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { piaMonthlyFromAime } from './piaFromEarnings.js'
import { PIA_BEND_POINTS } from './ssaWageData.js'

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
  'pia-from-aime-bend-points',
  {
    example: {
      inputs: {
        eligibilityYear: 2026,
        aimeCrossBoth: 9_000,
        aimeBelowFirst: 1_000,
        firstBendPoint: 1_286,
        secondBendPoint: 7_749,
      },
      expected: { crossBoth: 3_413.2, belowFirst: 900 },
      // The worksheet publishes a dime-floored currency value and states a
      // $0.10 granularity; half a step is the bound, the same convention the
      // catalog uses for a cents publication.
      tolerance: { abs: 0.05 },
    },
    worksheet: 'DOCS/calculations/social-security/pia-from-aime-bend-points.md',
    mutation: 'DOCS/calculations/social-security/pia-from-aime-bend-points.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('applies 90/32/15 across the 2026 bend points for a 3,413.20 PIA', () => {
      const bend = PIA_BEND_POINTS[inputs.eligibilityYear!]
      if (bend === undefined) throw new Error('missing 2026 bend points')
      expect(bend.first).toBe(inputs.firstBendPoint)
      expect(bend.second).toBe(inputs.secondBendPoint)
      const pia = piaMonthlyFromAime(inputs.aimeCrossBoth!, inputs.eligibilityYear!)
      expectWithin(pia, expected.crossBoth!, example.tolerance, 'crossBoth')
    })

    it('applies 90% alone below the first bend point', () => {
      const pia = piaMonthlyFromAime(inputs.aimeBelowFirst!, inputs.eligibilityYear!)
      expectWithin(pia, expected.belowFirst!, example.tolerance, 'belowFirst')
    })

    it('floors to the dime rather than rounding to the nearest one', () => {
      // The worksheet's own note: its cross-both case cannot tell floor from
      // round, so the suite carries a discriminator that can. An AIME one
      // dollar above the first bend point adds 32 cents, and 1,157.72 floors
      // to 1,157.70 where rounding to the nearest dime would give 1,157.70 as
      // well; 1,286 + 3 adds 96 cents, giving 1,158.36, which floors to
      // 1,158.30 and rounds to 1,158.40.
      const pia = piaMonthlyFromAime(inputs.firstBendPoint! + 3, inputs.eligibilityYear!)
      expectWithin(pia, 1_158.3, example.tolerance, 'floored PIA')
      expect(pia).toBeLessThan(1_158.4)
    })

    it('reads the bend points from the SSA wage data, which the tax pack does not carry', () => {
      expect(Object.keys(PIA_BEND_POINTS)).toContain(String(inputs.eligibilityYear))
    })
  },
)
