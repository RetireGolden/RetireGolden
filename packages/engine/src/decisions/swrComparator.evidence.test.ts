import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import { compareSwrRules } from './swrComparator.js'

describeCalculation('swr-rule-rate-and-initial-spend', {
  example: {
    inputs: { startingInvestable: 1_000_000, cape: 25, spendTolerance: { abs: 1e-8 } },
    expected: { rates: [4.7, 3.9, 3.75], spends: [47_000, 39_000, 37_500] },
    tolerance: { abs: 1e-12 },
  },
  worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-rate-and-initial-spend.md',
  mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-rate-and-initial-spend.mutation.md',
}, ({ example }) => {
  it('prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million', () => {
    const plan = noTraditionalPlan()
    plan.accounts = [{ type: 'cash', id: 'worksheet-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: example.inputs.startingInvestable as number, annualContribution: 0 }]
    const actual = compareSwrRules(plan, simOptions(), example.inputs.cape as number)
    const rates = example.expected.rates as number[]
    const spends = example.expected.spends as number[]
    expect(actual.length).toBe(rates.length)
    actual.forEach((row, index) => {
      expect(withinTolerance(row.initialRatePct, rates[index]!, example.tolerance), `${row.id} rate: actual ${row.initialRatePct}, worksheet ${rates[index]}`).toBe(true)
      expect(withinTolerance(row.initialAnnualSpend, spends[index]!, example.inputs.spendTolerance as { abs: number }), `${row.id} spend: actual ${row.initialAnnualSpend}, worksheet ${spends[index]}`).toBe(true)
    })
  })
})
