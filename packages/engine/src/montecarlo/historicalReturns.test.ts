import { describe, expect, it } from 'vitest'

import { HISTORICAL_YEARS, portfolioReturnPct } from './historicalReturns.js'

/**
 * Hand-worked blend arithmetic on the embedded 1928 row (stocks 43.8%, bonds 0.8%).
 * Validates portfolioReturnPct percent-weight blending only — not Damodaran/Shiller
 * transcription, basis-point historical accuracy, or the full Monte Carlo model.
 *
 * Worksheet (60% equity): 43.8 × 0.60 + 0.8 × 0.40 = 26.28 + 0.32 = 26.60.
 * Endpoints: 0% equity → bond-only 0.8%; 100% equity → stock-only 43.8%.
 */
describe('portfolioReturnPct blend arithmetic', () => {
  it('blends the 1928 row at bond-only, stock-only, and 60% equity weights', () => {
    const year1928 = HISTORICAL_YEARS.find((row) => row.year === 1928)
    expect(year1928, 'HISTORICAL_YEARS must include year 1928').toBeDefined()

    expect(portfolioReturnPct(year1928!, 0)).toBeCloseTo(0.8, 10)
    expect(portfolioReturnPct(year1928!, 100)).toBeCloseTo(43.8, 10)
    expect(portfolioReturnPct(year1928!, 60)).toBeCloseTo(26.6, 10)
  })
})
