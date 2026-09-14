import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { abwAnnualPayment } from './abw.js'

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
