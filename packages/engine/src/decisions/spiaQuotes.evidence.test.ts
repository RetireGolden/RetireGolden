import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { QLAC_DEFERRED_PAYOUT_RATE, spiaPayoutRate } from './spiaQuotes.js'

describeCalculation(
  'qlac-deferred-payout-placeholder',
  {
    example: {
      inputs: { premium: 100_000, placeholderRate: 0.16 },
      expected: { annualPayout: 16_000, monthlyPayout: 1_333.33333333333 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/qlac-deferred-payout-placeholder.md',
    mutation: 'DOCS/calculations/monte-carlo/qlac-deferred-payout-placeholder.mutation.md',
  },
  ({ example }) => {
    const premium = example.inputs.premium as number

    it('the placeholder rate is 0.16', () => {
      expect(QLAC_DEFERRED_PAYOUT_RATE).toBe(example.inputs.placeholderRate)
    })

    it('$100,000 of premium pays $16,000 annually, $1,333.33333333333 monthly', () => {
      const annual = premium * QLAC_DEFERRED_PAYOUT_RATE
      const monthly = annual / 12
      expect(annual).toBe(example.expected.annualPayout)
      expect(
        withinTolerance(monthly, example.expected.monthlyPayout as number, example.tolerance),
        `monthlyPayout ${monthly} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${example.expected.monthlyPayout}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'spia-payout-rate-interpolation',
  {
    example: {
      inputs: { startAge: 67.5, age65Rate: 0.07, age70Rate: 0.084, premium: 100_000 },
      expected: { rate: 0.077, annualPayout: 7_700 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/spia-payout-rate-interpolation.md',
    mutation: 'DOCS/calculations/monte-carlo/spia-payout-rate-interpolation.mutation.md',
  },
  ({ example }) => {
    const startAge = example.inputs.startAge as number
    const expectedRate = example.expected.rate as number

    it('interpolates 0.077 at age 67.5 between the 65 and 70 anchors', () => {
      const rate = spiaPayoutRate(startAge)
      expect(
        withinTolerance(rate, expectedRate, example.tolerance),
        `rate ${rate} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedRate}`,
      ).toBe(true)
    })

    it('$100,000 of premium at that rate pays $7,700 per year', () => {
      const annual = (example.inputs.premium as number) * spiaPayoutRate(startAge)
      const expected = example.expected.annualPayout as number
      expect(
        withinTolerance(annual, expected, example.tolerance),
        `annualPayout ${annual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('the 65 and 70 anchors the interpolation uses are 0.070 and 0.084', () => {
      expect(
        withinTolerance(spiaPayoutRate(65), example.inputs.age65Rate as number, example.tolerance),
        `age-65 rate ${spiaPayoutRate(65)} is not the worksheet's ${example.inputs.age65Rate}`,
      ).toBe(true)
      expect(
        withinTolerance(spiaPayoutRate(70), example.inputs.age70Rate as number, example.tolerance),
        `age-70 rate ${spiaPayoutRate(70)} is not the worksheet's ${example.inputs.age70Rate}`,
      ).toBe(true)
    })
  },
)
