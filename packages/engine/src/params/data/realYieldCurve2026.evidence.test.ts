import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { REAL_YIELD_CURVE_2026 } from './realYieldCurve2026.js'

describeCalculation(
  'treasury-real-yield-curve-2026',
  {
    example: {
      inputs: { asOfIso: '2026-06-30', maturityYears: [5, 7, 10, 20, 30] },
      // The worksheet's Expected section: the STORED row, pinned as a dataset
      // fact. Its "Deviation from the official row" section tabulates how far
      // this row sits from the official 2026-06-30 Treasury row (stored minus
      // official: -8/-1/+5/+1/-3bp at 5/7/10/20/30 years); the record's limits
      // carry the same table, and the data correction is owed as its own
      // engine change. This slice pins what is stored so a silent edit to the
      // embedded row is caught; it does not call the row correct.
      expected: { storedRealYieldPct: [1.85, 2.05, 2.25, 2.55, 2.7] },
      // Exact, as the worksheet states: a zero absolute bound is
      // withinTolerance's exact comparison for non-integer expectations (the
      // 'exact' literal is reserved for integer results).
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/ladders-and-valuation/treasury-real-yield-curve-2026.md',
    mutation: 'DOCS/calculations/ladders-and-valuation/treasury-real-yield-curve-2026.mutation.md',
  },
  ({ example, record }) => {
    const maturities = example.inputs.maturityYears as number[]
    const expectedYields = example.expected.storedRealYieldPct as number[]

    it('is dated 2026-06-30 and carries the five Treasury maturities 5/7/10/20/30 in ascending order', () => {
      expect(REAL_YIELD_CURVE_2026.asOfIso).toBe(example.inputs.asOfIso)
      expect(REAL_YIELD_CURVE_2026.points.map((point) => point.maturityYears)).toEqual(maturities)
      expect(REAL_YIELD_CURVE_2026.source).toContain('Treasury')
    })

    it('carries the stored row 1.85/2.05/2.25/2.55/2.70 percent per year, exactly', () => {
      expect(REAL_YIELD_CURVE_2026.points).toHaveLength(expectedYields.length)
      REAL_YIELD_CURVE_2026.points.forEach((point, index) => {
        expect(
          withinTolerance(point.realYieldPct, expectedYields[index]!, example.tolerance),
          `realYieldPct at ${point.maturityYears} years ${point.realYieldPct} is not exactly the worksheet's stored ${expectedYields[index]}`,
        ).toBe(true)
      })
    })

    it('states the deviation from the official row in its limits rather than silently', () => {
      const limits = record.limits.join('\n')
      expect(limits).toContain('1.93/2.06/2.20/2.54/2.73')
      expect(limits).toContain('1.85/2.05/2.25/2.55/2.70')
      expect(limits).toContain('5y -8bp')
    })
  },
)
