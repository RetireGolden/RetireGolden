import { expect, it } from 'vitest'
import { describeCalculation } from '../rules/describeCalculation.js'
import { exactCentLargestRemainderSlices, exactCentNearestHalfUp, exactCentProRataNearestHalfUp } from './exactCentProRata.js'

describeCalculation('exact-cent-largest-remainder-slices', {
  example: { inputs: { amount: 10n, weights: [1n, 1n, 1n] }, expected: { slices: [4n, 3n, 3n], sum: 10n }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/exact-cent-largest-remainder-slices.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/exact-cent-largest-remainder-slices.mutation.md',
}, ({ example }) => {
  it('allocates ten cents as 4/3/3 with the tied residual at position zero', () => {
    const slices = exactCentLargestRemainderSlices(example.inputs.amount as bigint, example.inputs.weights as bigint[])
    const expected = example.expected.slices as bigint[]
    expect(slices.length).toBe(expected.length)
    slices.forEach((slice, index) => expect(slice).toBe(expected[index]))
    expect(slices.reduce((sum, slice) => sum + slice, 0n)).toBe(example.expected.sum)
  })
})

describeCalculation('exact-cent-pro-rata-half-up', {
  example: { inputs: { amount: 101n, numerator: 1n, denominator: 2n }, expected: { cents: 51n }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/exact-cent-pro-rata-half-up.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/exact-cent-pro-rata-half-up.mutation.md',
}, ({ example }) => {
  it('rounds half of 101 cents upward to 51 cents', () => {
    expect(exactCentProRataNearestHalfUp(example.inputs.amount as bigint, example.inputs.numerator as bigint, example.inputs.denominator as bigint)).toBe(example.expected.cents)
  })
})

describeCalculation('exact-cent-rational-half-up', {
  example: { inputs: { numerator: 5n, denominator: 2n }, expected: { cents: 3n }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/exact-cent-rational-half-up.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/exact-cent-rational-half-up.mutation.md',
}, ({ example }) => {
  it('rounds the exact rational 5/2 cents upward to 3 cents', () => {
    expect(exactCentNearestHalfUp(example.inputs.numerator as bigint, example.inputs.denominator as bigint)).toBe(example.expected.cents)
  })
})
