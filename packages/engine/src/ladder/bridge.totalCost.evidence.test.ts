import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { bridgeLaddersTotalCost } from './bridge.js'

describeCalculation(
  'ss-bridge-ladders-total-cost',
  {
    example: {
      inputs: {
        caseA: { ladderCosts: [85_000, 55_216.54] },
        caseB: { ladderCosts: [40_814.65] },
        caseC: { ladderCosts: [] },
        caseD: { ladderCosts: [0.1, 0.2, 0.3] },
      },
      expected: {
        caseA: 140_216.54,
        caseB: 40_814.65,
        caseC: 0,
        wrongFirstOnlyA: 85_000,
        wrongAverageA: 70_108.27,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/social-security/social-security-bridge-ladders-total-cost.md',
    mutation: 'DOCS/calculations/social-security/social-security-bridge-ladders-total-cost.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, { ladderCosts: number[] }>
    const expected = example.expected as Record<string, number>
    const totalOf = (costs: readonly number[]) => bridgeLaddersTotalCost(costs.map((ladderCost) => ({ ladderCost })))

    it('case A: two bridges quoted at 85,000 and 55,216.54 cost 140,216.54 together', () => {
      const total = totalOf(inputs.caseA!.ladderCosts)
      expect(total).toBe(expected.caseA)
      expect(total).not.toBe(expected.wrongFirstOnlyA)
      expect(total).not.toBe(expected.wrongAverageA)
    })

    it('case B: one bridge costs its own quote', () => {
      expect(totalOf(inputs.caseB!.ladderCosts)).toBe(expected.caseB)
    })

    it('case C: no bridge costs 0', () => {
      expect(totalOf(inputs.caseC!.ladderCosts)).toBe(expected.caseC)
    })

    it('case D: the quotes are added in the order given, so 0.1, 0.2 and 0.3 give 0.6000000000000001', () => {
      const total = totalOf(inputs.caseD!.ladderCosts)
      expect(total).toBe(0.1 + 0.2 + 0.3)
      expect(total).not.toBe(0.1 + (0.2 + 0.3))
    })

    it('refuses a quoted cost that is not finite', () => {
      expect(() => totalOf([85_000, Number.NaN])).toThrow(RangeError)
      expect(() => totalOf([Number.POSITIVE_INFINITY])).toThrow(RangeError)
    })
  },
)
