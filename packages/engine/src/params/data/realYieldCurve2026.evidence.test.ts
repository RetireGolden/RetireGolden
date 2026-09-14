import { expect, it } from 'vitest'
import { describeCalculation } from '../../rules/describeCalculation.js'
import { REAL_YIELD_CURVE_2026 } from './realYieldCurve2026.js'

describeCalculation(
  'treasury-real-yield-curve-2026',
  {
    example: {
      inputs: { asOfIso: '2026-06-30', maturityYears: [5, 7, 10, 20, 30] },
      // The EMBEDDED values, as the record documents them. The official
      // 2026-06-30 Treasury row is 1.93/2.06/2.20/2.54/2.73 (worksheet); the
      // discrepancy is stated in the record's limits and its correction is a
      // separate packet, so this slice pins what is embedded, unchanged.
      expected: { embeddedRealYieldPct: [1.85, 2.05, 2.25, 2.55, 2.7] },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/treasury-real-yield-curve-2026.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/treasury-real-yield-curve-2026.mutation.md',
  },
  ({ example, record }) => {
    const abs = example.tolerance === 'exact' ? 0 : (example.tolerance.abs ?? 0)
    const maturities = example.inputs.maturityYears as number[]
    const expectedYields = example.expected.embeddedRealYieldPct as number[]

    it('is dated 2026-06-30 and carries the five Treasury maturities 5/7/10/20/30 in ascending order', () => {
      expect(REAL_YIELD_CURVE_2026.asOfIso).toBe(example.inputs.asOfIso)
      expect(REAL_YIELD_CURVE_2026.points.map((point) => point.maturityYears)).toEqual(maturities)
      expect(REAL_YIELD_CURVE_2026.source).toContain('Treasury')
    })

    it('carries the documented embedded yields 1.85/2.05/2.25/2.55/2.70 percent per year', () => {
      expect(REAL_YIELD_CURVE_2026.points).toHaveLength(expectedYields.length)
      REAL_YIELD_CURVE_2026.points.forEach((point, index) => {
        expect(Math.abs(point.realYieldPct - expectedYields[index]!)).toBeLessThanOrEqual(abs)
      })
    })

    it('records the official-row discrepancy in its limits rather than silently', () => {
      const limits = record.limits.join('\n')
      expect(limits).toContain('1.93/2.06/2.20/2.54/2.73')
      expect(limits).toContain('1.85/2.05/2.25/2.55/2.70')
    })
  },
)
