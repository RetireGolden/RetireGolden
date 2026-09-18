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
    // Two worksheet cases: (a) a guardrail cut with a small withdrawal shortfall
    // that discretionary dollars absorb; (b) a deeper cut where the cut and the
    // shortfall together breach the required floor.
    inputs: {
      guardrailCut: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 85, withdrawalShortfall: 5 },
      floorBreach: { requiredSpending: 60, targetSpending: 100, idealSpending: 20, excessSpending: 10, fundedSpending: 62, withdrawalShortfall: 5 },
    },
    expected: {
      guardrailCut: { requiredShortfall: 0, targetShortfall: 20, idealShortfall: 20, excessShortfall: 10 },
      floorBreach: { requiredShortfall: 3, targetShortfall: 43, idealShortfall: 20, excessShortfall: 10 },
    },
    tolerance: { abs: 1e-12 },
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/spending-layer-shortfall-attribution.mutation.md',
}, ({ example }) => {
  const cases = ['guardrailCut', 'floorBreach'] as const
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
  it('attributes ideal and excess misses of 20 and 10 in both cases', () => {
    for (const c of cases) {
      check(c, 'idealShortfall')
      check(c, 'excessShortfall')
    }
  })
})
