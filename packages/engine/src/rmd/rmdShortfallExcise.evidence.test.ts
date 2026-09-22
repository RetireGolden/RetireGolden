import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import {
  computeRmdShortfallExcise,
  RMD_SHORTFALL_DEFAULT_RATE,
  type RmdShortfallObligation,
} from './rmdShortfallExcise.js'

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
  'rmd-shortfall-excise-default',
  {
    example: {
      inputs: {
        requiredAmount: 10_000,
        distributedByDeadline: 4_000,
        reliefElection: 'none',
        defaultRate: 0.25,
      },
      expected: { shortfall: 6_000, tax: 1_500, reason: 'default25Percent' },
      // The rate is a non-integer leaf, so it is compared under its own bound
      // below; the dollar leaves here are whole and exact.
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/rmd/rmd-shortfall-excise-default.md',
    mutation: 'DOCS/calculations/rmd/rmd-shortfall-excise-default.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | string>
    const expected = example.expected as Record<string, number | string>
    const obligation: RmdShortfallObligation = {
      obligationId: 'owned-iras:p1:2026',
      distributionCalendarYear: 2026,
      taxYear: 2026,
      taxImposedOn: '2027-04-01',
      applicablePlan: { kind: 'ownedTraditionalIras', payeePersonId: 'p1' },
      requirementKind: 'ownedAnnual',
      requiredAmount: inputs.requiredAmount as number,
      distributedByDeadline: inputs.distributedByDeadline as number,
    }

    it('prices a 6,000 shortfall at 25% into a 1,500 excise, with no relief elected', () => {
      expect(RMD_SHORTFALL_DEFAULT_RATE).toBe(inputs.defaultRate)
      const result = computeRmdShortfallExcise(obligation)
      expectWithin(result.shortfall, expected.shortfall as number, example.tolerance, 'shortfall')
      expectWithin(result.tax, expected.tax as number, example.tolerance, 'tax')
      expect(result.rate).toBe(inputs.defaultRate)
      expect(result.reason).toBe(expected.reason)
    })

    it('reports no shortfall and no tax once the requirement is met in time', () => {
      const met = computeRmdShortfallExcise({
        ...obligation,
        distributedByDeadline: inputs.requiredAmount as number,
      })
      expect(met.shortfall).toBe(0)
      expect(met.tax).toBe(0)
      expect(met.rate).toBe(0)
      expect(met.reason).toBe('noShortfall')
    })

    it('charges the shortfall, not the whole requirement', () => {
      // The second wrong reading: 25% of the full 10,000 would be 2,500.
      const result = computeRmdShortfallExcise(obligation)
      expect(result.tax).toBeLessThan((inputs.requiredAmount as number) * RMD_SHORTFALL_DEFAULT_RATE)
    })
  },
)
