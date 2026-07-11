import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaMonthlyFromAime,
} from './piaFromEarnings.js'
import { PIA_BEND_POINTS, WAGE_BASE_BY_YEAR } from './ssaWageData.js'

/**
 * ORACLE-006 (Phase 5, external-oracle-comparisons.md) — Social Security PIA vs
 * SSA primary sources (bend-point series, PIA formula, and a worked example).
 *
 * Oracles:
 *   Bend points: SSA Benefit Formula Bend Points (https://www.ssa.gov/oact/cola/bendpoints.html).
 *   PIA formula + dime rounding: SSA (https://www.ssa.gov/oact/cola/piaformula.html),
 *     42 U.S.C. §415(a)(1)(A).
 *   Worked example: SSA Annual Statistical Supplement 2025, Appendix C
 *     (https://www.ssa.gov/policy/docs/statcomps/supplement/2025/apnc.pdf):
 *     a worker attaining age 62 in 2025 (bend points $1,226 / $7,391) with an
 *     AIME of $700 has a PIA of $630.00 (90% of $700, rounded down to the dime).
 *   Taxable maximum: SSA (https://www.ssa.gov/oact/cola/cbb.html).
 * (SSA.gov blocks automated fetch; values were taken from the SSA documents via
 * search snippets and cross-checked against multiple SSA-reproducing sources.)
 * Access date: 2026-06-29. Tolerance: $0.10 (PIA is published to the dime).
 *
 * Distinct from the Phase 1 test (piaFromEarnings.golden.test.ts), which takes the
 * bend points as given and hand-checks the formula: here the encoded SSA series
 * are themselves frozen against SSA's published values, plus an SSA worked PIA.
 */

// SSA Benefit Formula Bend Points — recent eligibility years (first, second $).
const SSA_BEND_POINTS = {
  2024: { first: 1_174, second: 7_078 },
  2025: { first: 1_226, second: 7_391 },
  2026: { first: 1_286, second: 7_749 },
} as const
// SSA OASDI taxable maximum (contribution & benefit base).
const SSA_WAGE_BASE = { 2025: 176_100, 2026: 184_500 } as const

describe('ORACLE-006: Social Security PIA vs SSA primary sources', () => {
  it('encoded PIA bend points match the SSA published series (2024–2026)', () => {
    for (const [year, bp] of Object.entries(SSA_BEND_POINTS)) {
      expect(PIA_BEND_POINTS[Number(year)], `bend points ${year}`).toEqual(bp)
    }
  })

  it('encoded OASDI taxable maximum matches the SSA published base (2025–2026)', () => {
    for (const [year, base] of Object.entries(SSA_WAGE_BASE)) {
      expect(WAGE_BASE_BY_YEAR[Number(year)], `wage base ${year}`).toBe(base)
    }
  })

  it('reproduces SSA Appendix C Example 1: AIME $700 (2025 eligibility) → PIA $630.00', () => {
    // 90% of $700 = $630.00; $700 is below the first 2025 bend point ($1,226).
    expectMoney(piaMonthlyFromAime(700, 2025), 630.0, 0.1)
  })

  it('applies the 90/32/15 formula with dime flooring over SSA-verified 2026 bend points', () => {
    const { first, second } = SSA_BEND_POINTS[2026] // $1,286 / $7,749
    // At the first bend point: 90% of 1,286 = $1,157.40.
    expectMoney(piaMonthlyFromAime(first, 2026), 1_157.4, 0.1)
    // At the second bend point: 0.9·1,286 + 0.32·(7,749−1,286) = 1,157.40 + 2,068.16 = 3,225.56 → $3,225.50.
    expectMoney(piaMonthlyFromAime(second, 2026), 3_225.5, 0.1)
    // Above the second bend point (AIME 12,000): + 0.15·(12,000−7,749) = +637.65 → 3,863.21 → $3,863.20.
    expectMoney(piaMonthlyFromAime(12_000, 2026), 3_863.2, 0.1)
    // Dime flooring (2025): 0.9·1,226 + 0.32·(1,227−1,226) = 1,103.40 + 0.32 = 1,103.72 → floored to $1,103.70.
    expectMoney(piaMonthlyFromAime(1_227, 2025), 1_103.7, 0.1)
  })

  it('reproduces SSA Example 1 end-to-end through the earnings→AIME→PIA path', () => {
    // Worker attaining age 62 in 2025 (born 1963). For 2025 eligibility the AWI
    // indexing year is 2023, so 2023 earnings index by AWI(2023)/AWI(2023) = 1 and
    // 2024 is the non-indexed year — both enter the AIME at nominal dollars, making
    // the AIME auditable without applying AWI ratios.
    //   $147,000 in 2023 + $147,000 in 2024 = $294,000 (both under the taxable max).
    //   Base period is 40 years; drop the 5 lowest (zeros) → 35 computation years.
    //   AIME = floor(294,000 / (12·35)) = floor(294,000 / 420) = $700.
    //   PIA  = 90% × 700 = $630.00 (matches SSA Appendix C Example 1).
    const result = computePiaFromEarnings({
      dobYear: 1963,
      dobMonth: 6,
      dobDay: 15,
      earnings: [
        { year: 2023, amount: 147_000 },
        { year: 2024, amount: 147_000 },
      ],
      lastEarningsYear: 2024,
    })
    expect(isPiaFromEarningsError(result)).toBe(false)
    if (isPiaFromEarningsError(result)) return
    expect(result.eligibilityYear).toBe(2025)
    expect(result.aime).toBe(700)
    expectMoney(result.piaMonthly, 630.0, 0.1)
  })
})
