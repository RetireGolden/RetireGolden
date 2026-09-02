/**
 * Insights Monte Carlo delta label (#527): only a delta the one-decimal
 * display would print as 0.0 is "no change"; 0.3 pts keeps its sign and
 * color. The finding was 0.0% painted success-green.
 */
import { describe, expect, it } from 'vitest'

import { formatMcDelta, MC_DELTA_FLAT_PTS } from './mcDeltaFormat'

describe('formatMcDelta (#527)', () => {
  it('reads a rounding remainder as no change, with no verdict', () => {
    expect(formatMcDelta(0)).toEqual({ flat: true })
    expect(formatMcDelta(0.04)).toEqual({ flat: true })
    expect(formatMcDelta(-0.04)).toEqual({ flat: true })
    expect(MC_DELTA_FLAT_PTS).toBe(0.05)
  })

  it('keeps a small real delta, signed and colored', () => {
    expect(formatMcDelta(0.3)).toEqual({ flat: false, good: true, text: '+0.3 pts' })
    expect(formatMcDelta(0.4)).toEqual({ flat: false, good: true, text: '+0.4 pts' })
    expect(formatMcDelta(-0.3)).toEqual({ flat: false, good: false, text: '−0.3 pts' })
    expect(formatMcDelta(-12)).toEqual({ flat: false, good: false, text: '−12.0 pts' })
    expect(formatMcDelta(3.25)).toEqual({ flat: false, good: true, text: '+3.3 pts' })
  })
})
