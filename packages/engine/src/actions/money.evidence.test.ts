import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { addUsdCents, asUsdCents, subtractUsdCents, sumUsdCents } from './money.js'

describeCalculation('usd-cent-arithmetic', {
  example: { inputs: { left: 125, right: 25, vector: [125, 25, 50] }, expected: { addition: 150, subtraction: 100, sum: 200 }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/usd-cent-arithmetic.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/usd-cent-arithmetic.mutation.md',
}, ({ example }) => {
  it('adds, subtracts and sums exact cents to 150, 100 and 200', () => {
    const left = asUsdCents(example.inputs.left)
    const right = asUsdCents(example.inputs.right)
    expect(addUsdCents(left, right)).toBe(example.expected.addition)
    expect(subtractUsdCents(left, right)).toBe(example.expected.subtraction)
    expect(sumUsdCents((example.inputs.vector as number[]).map(asUsdCents))).toBe(example.expected.sum)
  })
})
