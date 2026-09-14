import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { abwAnnualPayment } from './abw.js'

describeCalculation(
  'abw-annuity-due-payment',
  {
    example: {
      inputs: { balance: 210, returnPct: 10, growthPct: 0, years: 2 },
      expected: { payment: 110 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.mutation.md',
  },
  ({ example }) => {
    it('pays 110 now and 110 next period from 210 at 10% with no growth', () => {
      // abwAnnualPayment(balance, realReturnPct, tiltPct, remainingYears) —
      // the fixture names returnPct/growthPct/years; those map onto the
      // production parameters realReturnPct, tiltPct, and remainingYears.
      const payment = abwAnnualPayment(
        example.inputs.balance as number,
        example.inputs.returnPct as number,
        example.inputs.growthPct as number,
        example.inputs.years as number,
      )
      const abs = example.tolerance === 'exact' ? 0 : (example.tolerance.abs ?? 0)
      expect(Math.abs(payment - (example.expected.payment as number))).toBeLessThanOrEqual(abs)
    })
  },
)
