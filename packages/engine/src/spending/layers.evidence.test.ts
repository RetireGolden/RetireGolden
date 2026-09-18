import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { attributeShortfall, splitLifestyle, type ShortfallAttribution, type ShortfallAttributionInput } from './layers.js'

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
    // Three worksheet cases: (a) a guardrail cut with a small withdrawal shortfall
    // that discretionary dollars absorb; (b) a deeper cut where the cut and the
    // shortfall together breach the required floor; (c) partially funded excess.
    inputs: {
      guardrailCut: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 85, withdrawalShortfall: 5 },
      floorBreach: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 62, withdrawalShortfall: 5 },
      partialExcess: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 130, withdrawalShortfall: 5 },
    },
    expected: {
      guardrailCut: { requiredShortfall: 0, targetShortfall: 20, idealShortfall: 20, excessShortfall: 10 },
      floorBreach: { requiredShortfall: 3, targetShortfall: 43, idealShortfall: 20, excessShortfall: 10 },
      partialExcess: { requiredShortfall: 0, targetShortfall: 0, idealShortfall: 0, excessShortfall: 5 },
    },
    tolerance: { abs: 1e-12 },
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.mutation.md',
}, ({ example }) => {
  const cases = ['guardrailCut', 'floorBreach', 'partialExcess'] as const
  const inputsOf = (c: (typeof cases)[number]) => (example.inputs as Record<string, ShortfallAttributionInput>)[c]!
  const expectedOf = (c: (typeof cases)[number]) => (example.expected as Record<string, Record<keyof ShortfallAttribution, number>>)[c]!
  const check = (c: (typeof cases)[number], key: keyof ShortfallAttribution) => {
    const actual = attributeShortfall(inputsOf(c))[key]
    expect(withinTolerance(actual, expectedOf(c)[key], example.tolerance), `${c} ${key}: actual ${actual}, worksheet ${expectedOf(c)[key]}`).toBe(true)
  }
  // One test per layer rule, so a mutation of one rule fails by name.
  it('attributes the required miss as the floor less actually funded dollars: 0 for the cut alone, 3 when cut and shortfall breach the floor', () => {
    for (const c of cases) check(c, 'requiredShortfall')
  })
  it('attributes the target miss as the guardrail cut plus every dollar not produced: 20 and 43', () => {
    for (const c of cases) check(c, 'targetShortfall')
  })
  it('attributes ideal misses of 20, 20 and 0 after target funding', () => {
    for (const c of cases) check(c, 'idealShortfall')
  })
  it('attributes excess misses of 10, 10 and 5 after target and ideal funding', () => {
    for (const c of cases) check(c, 'excessShortfall')
  })
})
