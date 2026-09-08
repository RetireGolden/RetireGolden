/**
 * SPIA payout-rate producer (annuity-pension-and-home-equity decisions, step 2):
 * 65/70 linear-interpolation segment and endpoint clamps shared by annuitization,
 * purchase candidates, and annuitization-headroom.
 */
import { describe, expect, it } from 'vitest'

import { spiaPayoutRate } from './spiaQuotes.js'

describe('spiaPayoutRate', () => {
  it('interpolates between anchors and clamps outside the table per model convention', () => {
    // Characterization of frozen planning defaults, not a market-rate oracle.
    // Design: DOCS/domain/domain-rules-reference/19-annuity-payout-forms-the-annuitization-sweep.md
    // and DOCS/maintenance-schedule.md: age 85 is extrapolated, not quoted.
    // With frozen 65/70 anchors 0.07/0.084, linear interpolation gives
    // age 67 = 0.07 + (2/5) × (0.084 − 0.07) = 0.0756.
    expect(spiaPayoutRate(67)).toBeCloseTo(0.0756, 6)
    expect(spiaPayoutRate(55)).toBeCloseTo(0.06, 6)
    expect(spiaPayoutRate(90)).toBeCloseTo(0.153, 6)
  })
})
