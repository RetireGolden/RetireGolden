import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { reducedConversionTaxFundingExactCentAmount } from './conversionTaxFundingEvidence.js'

describeCalculation('conversion-tax-funding-gcd-reduction', {
  example: { inputs: { numerator: 150n, denominator: 100n }, expected: { numeratorMinorUnits: 3, denominator: 2 }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/taxes/conversion-tax-funding-gcd-reduction.md',
  mutation: 'DOCS/calculations/taxes/conversion-tax-funding-gcd-reduction.mutation.md',
}, ({ example }) => {
  it('reduces 150/100 exact cents to the canonical pair 3/2', () => {
    const amount = reducedConversionTaxFundingExactCentAmount(example.inputs.numerator as bigint, example.inputs.denominator as bigint)!
    expect(amount).not.toBeNull()
    expect(amount.numeratorMinorUnits).toBe(example.expected.numeratorMinorUnits)
    expect(amount.denominator).toBe(example.expected.denominator)
  })
})
