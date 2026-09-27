/**
 * The Monte Carlo page's fan chart after R14 and its histogram labels: the
 * bands are range areas between two of the engine's percentile levels and the
 * tooltip prints a band as "$low to $high"; no width is computed, stacked or
 * printed, and the histogram bars are labelled with the engine's bin centres.
 */
// @ts-expect-error -- node builtin in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { fmtMoneyOrRange } from './format'

const page = readFileSync(new URL('./MonteCarloPage.tsx', import.meta.url), 'utf8')

describe('Range of outcomes', () => {
  it('prints a band as its two levels and a line as its level', () => {
    expect(fmtMoneyOrRange([400_000, 1_300_000])).toBe('$400,000 to $1,300,000')
    expect(fmtMoneyOrRange([600_000, 1_000_000])).toBe('$600,000 to $1,000,000')
    expect(fmtMoneyOrRange([12_345.67, 98_765.43])).toBe('$12,346 to $98,765')
    expect(fmtMoneyOrRange(800_000)).toBe('$800,000')
  })

  it('draws the bands as ranges of the engine levels, with no widths and no transparent base series', () => {
    expect(page).toContain('(d: { p10: number; p90: number }) => [d.p10, d.p90]')
    expect(page).toContain('(d: { p25: number; p75: number }) => [d.p25, d.p75]')
    expect(page).not.toContain('d.p90 - d.p10')
    expect(page).not.toContain('d.p75 - d.p25')
    expect(page).not.toContain('stackId="outer"')
    expect(page).not.toContain('name="p10"')
    expect(page).not.toContain('name="p25"')
    expect(page).toContain('formatter={(v: unknown) => fmtMoneyOrRange(v)}')
  })

  it('labels the histogram bars with the engine bin centres and computes none itself', () => {
    expect(page).toContain('fmtMoneyCompact(binCenters[i]!)')
    expect(page).not.toContain('(i + 0.5) * binWidth')
  })
})
