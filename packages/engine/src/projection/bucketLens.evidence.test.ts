import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import { BUCKET_LENS_SPANS, bucketLens } from './bucketLens.js'
import type { YearResult } from './types.js'

/** Year rows carrying only the two published fields the lens reads. */
function rows(startYear: number, needs: readonly number[], investable: readonly number[]): { years: YearResult[] } {
  return {
    years: needs.map(
      (need, index) => ({ year: startYear + index, netPortfolioNeed: need, investableTotal: investable[index]! }) as unknown as YearResult,
    ),
  }
}

describeCalculation(
  'bucket-lens-allocation',
  {
    example: {
      inputs: {
        needs: [10_000, 20_000, 30_000, 40_000, 50_000],
        investable: [200_000, 150_000, 100_000, 60_000, 20_000],
        spansThree: [2, 8],
        spansTwo: [3],
        floatCase: { needs: [1_028.55, 2_057.21, 0], investable: [100_000.01, 0, 0], spans: [1, 1] },
      },
      expected: {
        three: [
          [30_000, 120_000, 50_000],
          [50_000, 90_000, 10_000],
          [70_000, 30_000, 0],
          [60_000, 0, 0],
          [20_000, 0, 0],
        ],
        two: [
          [60_000, 140_000],
          [90_000, 60_000],
          [100_000, 0],
          [60_000, 0],
          [20_000, 0],
        ],
        floatBuckets: [1_028.55, 2_057.21, 96_914.24999999999],
        floatSum: 100_000.00999999998,
        nextYearStartWrongReadingBucket1: 50_000,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/bucket-lens-allocation.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/bucket-lens-allocation.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as {
      needs: number[]
      investable: number[]
      spansThree: number[]
      spansTwo: number[]
      floatCase: { needs: number[]; investable: number[]; spans: number[] }
    }
    const expected = example.expected as Record<string, unknown>

    it('five years at spans [2, 8]: each bucket claims the next years of need, capped by what is left', () => {
      const lens = bucketLens(rows(2026, inputs.needs, inputs.investable), inputs.spansThree)
      expect(lens.map((row) => row.buckets)).toEqual(expected.three)
      expect(lens.map((row) => row.need)).toEqual(inputs.needs)
      expect(lens.map((row) => row.investableTotal)).toEqual(inputs.investable)
      expect(lens[0]!.buckets[0]).not.toBe(expected.nextYearStartWrongReadingBucket1)
    })

    it('five years at spans [3]', () => {
      const lens = bucketLens(rows(2026, inputs.needs, inputs.investable), inputs.spansTwo)
      expect(lens.map((row) => row.buckets)).toEqual(expected.two)
    })

    it('the two presets the planner offers are [2, 8] and [3]', () => {
      expect(BUCKET_LENS_SPANS.three).toEqual(inputs.spansThree)
      expect(BUCKET_LENS_SPANS.two).toEqual(inputs.spansTwo)
    })

    it('adds to the investable total to within one unit in the last place, not exactly', () => {
      const c = inputs.floatCase
      const lens = bucketLens(rows(2026, c.needs, c.investable), c.spans)
      expect(lens[0]!.buckets).toEqual(expected.floatBuckets)
      const sum = lens[0]!.buckets.reduce((a, b) => a + b, 0)
      expect(sum).toBe(expected.floatSum)
      expect(sum).not.toBe(c.investable[0])
    })

    it('refuses a span that is not a positive whole number and a year without a finite need', () => {
      const good = rows(2026, inputs.needs, inputs.investable)
      for (const spans of [[0], [2.5], [-1]]) expect(() => bucketLens(good, spans)).toThrow(RangeError)
      const missing = rows(2026, [10_000, Number.NaN], [100_000, 90_000])
      expect(() => bucketLens(missing, [2])).toThrow(/2027/u)
    })
  },
)
