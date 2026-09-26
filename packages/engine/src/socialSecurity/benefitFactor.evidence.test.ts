import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { delayedCreditMonthlyPct, delayedRetirementFactor, earlyRetirementFactor } from './benefitFactor.js'

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
  'delayed-retirement-credit-factor',
  {
    example: {
      inputs: { monthsAfterNra: 24, maxMonthsToAge70: 36 },
      expected: { factor: 1.16 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/social-security/delayed-retirement-credit-factor.md',
    mutation: 'DOCS/calculations/social-security/delayed-retirement-credit-factor.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('credits 24 months at 2/3 of 1% for a factor of 1.16', () => {
      const factor = delayedRetirementFactor(inputs.monthsAfterNra!, inputs.maxMonthsToAge70!)
      expectWithin(factor, expected.factor!, example.tolerance, 'factor')
    })

    it('stops crediting at the cap, so months past age 70 add nothing', () => {
      const atCap = delayedRetirementFactor(inputs.maxMonthsToAge70!, inputs.maxMonthsToAge70!)
      const pastCap = delayedRetirementFactor(inputs.maxMonthsToAge70! + 24, inputs.maxMonthsToAge70!)
      expect(pastCap).toBe(atCap)
    })

    it('returns 1 for a claim at or before the normal retirement age', () => {
      expect(delayedRetirementFactor(0, inputs.maxMonthsToAge70!)).toBe(1)
      expect(delayedRetirementFactor(-6, inputs.maxMonthsToAge70!)).toBe(1)
    })

    it('uses the birth-date rate: the worked 2/3 of 1% for a 1943 birth, 5/8 of 1% for 1941', () => {
      // The worksheet's third wrong reading: 24 months at 5/8 of 1% is 1.15, not 1.16.
      expect(delayedCreditMonthlyPct(1943)).toBe(2 / 3)
      expect(
        delayedRetirementFactor(inputs.monthsAfterNra!, inputs.maxMonthsToAge70!, delayedCreditMonthlyPct(1941)),
      ).toBeCloseTo(1.15, 12)
    })
  },
)

describeCalculation(
  'early-claim-factor',
  {
    example: {
      inputs: { monthsBeforeNra: 60, firstBandMonths: 36 },
      expected: { factor: 0.7 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/social-security/early-claim-factor.md',
    mutation: 'DOCS/calculations/social-security/early-claim-factor.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('reduces 60 early months to a factor of 0.70 across both bands', () => {
      const factor = earlyRetirementFactor(inputs.monthsBeforeNra!)
      expectWithin(factor, expected.factor!, example.tolerance, 'factor')
    })

    it('charges the steeper 5/9 rate only through the first 36 months', () => {
      // The first wrong reading: 5/9 of 1% for all 60 months would leave 2/3.
      const firstBandOnly = earlyRetirementFactor(inputs.firstBandMonths!)
      expectWithin(firstBandOnly, 0.8, example.tolerance, 'factor at 36 months early')
      expect(earlyRetirementFactor(inputs.monthsBeforeNra!)).toBeGreaterThan(2 / 3)
    })

    it('returns 1 for a claim at or after the normal retirement age', () => {
      expect(earlyRetirementFactor(0)).toBe(1)
      expect(earlyRetirementFactor(-12)).toBe(1)
    })
  },
)
