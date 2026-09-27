import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { REAL_YIELD_CURVE_2026 } from './realYieldCurve2026.js'

describeCalculation(
  'treasury-real-yield-curve-2026',
  {
    example: {
      inputs: { asOfIso: '2026-06-30', maturityYears: [5, 7, 10, 20, 30] },
      // The worksheet's Expected section: the official 2026-06-30 Treasury
      // row, exactly as published (decision D-TREASURY). The worksheet quotes
      // it from Treasury's page text and CSV; its deviation table now shows
      // 0bp at every maturity beside the row stored before 2026-09-27.
      expected: { officialRealYieldPct: [1.93, 2.06, 2.2, 2.54, 2.73] },
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
    const expectedYields = example.expected.officialRealYieldPct as number[]

    it('is dated 2026-06-30 and carries the five Treasury maturities 5/7/10/20/30 in ascending order', () => {
      expect(REAL_YIELD_CURVE_2026.asOfIso).toBe(example.inputs.asOfIso)
      expect(REAL_YIELD_CURVE_2026.points.map((point) => point.maturityYears)).toEqual(maturities)
      expect(REAL_YIELD_CURVE_2026.source).toContain('Treasury')
    })

    it('carries the official row 1.93/2.06/2.20/2.54/2.73 percent per year, exactly', () => {
      expect(REAL_YIELD_CURVE_2026.points).toHaveLength(expectedYields.length)
      REAL_YIELD_CURVE_2026.points.forEach((point, index) => {
        expect(
          withinTolerance(point.realYieldPct, expectedYields[index]!, example.tolerance),
          `realYieldPct at ${point.maturityYears} years ${point.realYieldPct} is not exactly the worksheet's official ${expectedYields[index]}`,
        ).toBe(true)
      })
    })

    it('states the official row in its statement and names the row it replaced in its limits', () => {
      expect(record.statement).toContain('1.93, 2.06, 2.20, 2.54 and 2.73')
      const limits = record.limits.join('\n')
      expect(limits).toContain('1.85/2.05/2.25/2.55/2.70')
      expect(limits).toContain('no rounding to the nearest 5 basis points')
    })

    it('publishes as its digest the SHA-256 of the stored points array as canonical JSON', async () => {
      // The record's transformation defines the digest over JSON.stringify of
      // the embedded points, as UTF-8. WebCrypto, not node:crypto: the
      // engine's compile-time surface carries no node types (the same shapes
      // coverageReport.freshness.test.ts declares).
      interface MinimalWebCrypto {
        subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> }
      }
      const { TextEncoder: TextEncoderConstructor } = globalThis as unknown as {
        TextEncoder: new () => { encode(input: string): Uint8Array }
      }
      const webCrypto = crypto as unknown as MinimalWebCrypto
      const bytes = new TextEncoderConstructor().encode(JSON.stringify(REAL_YIELD_CURVE_2026.points))
      const hex = [...new Uint8Array(await webCrypto.subtle.digest('SHA-256', bytes))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      if (record.justification.kind !== 'dataset') throw new Error('treasury-real-yield-curve-2026 is a dataset record')
      expect(record.justification.digest).toBe(`sha256:${hex}`)
    })
  },
)
