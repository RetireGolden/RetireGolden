import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { attributeShortfall, splitLifestyle, type ShortfallAttributionInput } from './layers.js'

describeCalculation('lifestyle-required-discretionary-split', {
  example: { inputs: { base: 60_000, required: 70_000 }, expected: { requiredLifestyle: 60_000, discretionaryLifestyle: 0 }, tolerance: 'exact' },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/lifestyle-required-discretionary-split.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/lifestyle-required-discretionary-split.mutation.md',
}, ({ example }) => {
  it('clamps a 70000 required floor to a 60000 target with zero discretionary dollars', () => {
    const actual = splitLifestyle(example.inputs.base as number, example.inputs.required as number)
    for (const key of ['requiredLifestyle', 'discretionaryLifestyle'] as const) {
      expect(withinTolerance(actual[key], example.expected[key] as number, example.tolerance), `${key}: actual ${actual[key]}, worksheet ${example.expected[key]}`).toBe(true)
    }
  })
})

describeCalculation('spending-layer-shortfall-attribution', {
  example: {
    inputs: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 85, withdrawalShortfall: 5 },
    expected: { requiredShortfall: 0, targetShortfall: 15, idealShortfall: 20, excessShortfall: 10 },
    tolerance: { abs: 1e-12 },
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.mutation.md',
}, ({ example }) => {
  // Keep the independent worksheet, including the known target-miss disagreement.
  // Separate tests let a mutation kill a passing component despite that baseline failure.
  it('attributes zero required shortfall', () => {
    const actual = attributeShortfall(example.inputs as unknown as ShortfallAttributionInput).requiredShortfall
    expect(withinTolerance(actual, example.expected.requiredShortfall as number, example.tolerance), `requiredShortfall: actual ${actual}, worksheet ${example.expected.requiredShortfall}`).toBe(true)
  })
  it('attributes worksheet target shortfall 15 (production discrepancy remains visible)', () => {
    const actual = attributeShortfall(example.inputs as unknown as ShortfallAttributionInput).targetShortfall
    expect(withinTolerance(actual, example.expected.targetShortfall as number, example.tolerance), `targetShortfall: actual ${actual}, worksheet ${example.expected.targetShortfall}`).toBe(true)
  })
  it('attributes ideal and excess shortfalls 20 and 10', () => {
    const actual = attributeShortfall(example.inputs as unknown as ShortfallAttributionInput)
    for (const key of ['idealShortfall', 'excessShortfall'] as const) {
      expect(withinTolerance(actual[key], example.expected[key] as number, example.tolerance), `${key}: actual ${actual[key]}, worksheet ${example.expected[key]}`).toBe(true)
    }
  })
})
