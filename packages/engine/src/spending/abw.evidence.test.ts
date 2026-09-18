import { expect, it } from 'vitest'
import type { AbwPolicy } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { ABW_DEFAULTS, abwAnnualPayment, abwExpectedRealReturnPct } from './abw.js'

describeCalculation(
  'abw-annuity-due-payment',
  {
    example: {
      // Percent units, as abwAnnualPayment takes them: the worksheet's r = 10%
      // is realReturnPct 10 and its g = 0 is tiltPct 0.
      inputs: { balance: 210, realReturnPct: 10, tiltPct: 0, years: 2 },
      expected: { payment: 110 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.mutation.md',
  },
  ({ example }) => {
    it('pays 110 now and 110 next period from 210 at 10% with no growth', () => {
      // abwAnnualPayment(balance, realReturnPct, tiltPct, remainingYears);
      // the fixture's `years` is the remaining-years count, current year inclusive.
      const payment = abwAnnualPayment(
        example.inputs.balance as number,
        example.inputs.realReturnPct as number,
        example.inputs.tiltPct as number,
        example.inputs.years as number,
      )
      const expected = example.expected.payment as number
      expect(
        withinTolerance(payment, expected, example.tolerance),
        `payment ${payment} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })
  },
)

describeCalculation(
  'abw-expected-real-return',
  {
    example: {
      inputs: { returnSource: 'cape', startingCape: 25, equitySharePct: 60, bondRealYieldPct: 2 },
      expected: { expectedRealReturnPct: 3.2 },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-expected-real-return.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/abw-expected-real-return.mutation.md',
  },
  ({ example }) => {
    const policy: AbwPolicy = {
      returnSource: example.inputs.returnSource as 'cape',
      startingCape: example.inputs.startingCape as number,
      equitySharePct: example.inputs.equitySharePct as number,
      bondRealYieldPct: example.inputs.bondRealYieldPct as number,
    }

    it('blends the 4% CAPE earnings yield at 60% with the 2% bond yield to 3.2%/yr real', () => {
      const rate = abwExpectedRealReturnPct(policy)
      const expected = example.expected.expectedRealReturnPct as number
      expect(
        withinTolerance(rate, expected, example.tolerance),
        `expectedRealReturnPct ${rate} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
    })

    it('returns the bond real yield alone under the tips source', () => {
      // The claim's second branch: the whole portfolio priced at the TIPS yield.
      expect(abwExpectedRealReturnPct({ returnSource: 'tips', bondRealYieldPct: policy.bondRealYieldPct })).toBe(
        policy.bondRealYieldPct,
      )
    })

    it('returns the fixed rate as entered under the fixed source, and the 3.8% default without a policy', () => {
      expect(abwExpectedRealReturnPct({ returnSource: 'fixed', fixedRealReturnPct: 4.5 })).toBe(4.5)
      expect(abwExpectedRealReturnPct(undefined)).toBe(ABW_DEFAULTS.fixedRealReturnPct)
      expect(ABW_DEFAULTS.fixedRealReturnPct).toBe(3.8)
    })
  },
)
