import { describe, expect, it } from 'vitest'
import {
  formatEvidenceAge,
  formatEvidencePercent,
  formatEvidenceUsd,
  formatGroupedNumber,
  formatWholeUsd,
} from './evidenceFormat.js'

/**
 * Expected strings here are the en-US conventions themselves (comma thousands
 * separator, `.` decimal point), not values read back out of the engine: the
 * point of the module is that the host locale cannot move them.
 */
describe('evidence formatters', () => {
  it('keeps integral dollars whole and non-integral dollars at exact cents', () => {
    expect(formatEvidenceUsd(1234)).toBe('$1,234')
    expect(formatEvidenceUsd(0)).toBe('$0')
    expect(formatEvidenceUsd(1.49)).toBe('$1.49')
    expect(formatEvidenceUsd(0.6)).toBe('$0.60')
    expect(formatEvidenceUsd(1234567.891)).toBe('$1,234,567.89')
    // The `$` is a literal prefix rather than a currency style, so a negative
    // amount reads `$-1,234.50`. Recorded, not endorsed: evidence values are
    // magnitudes today, and a signed one would want its own presentation.
    expect(formatEvidenceUsd(-1234.5)).toBe('$-1,234.50')
  })

  it('rounds whole-dollar amounts and groups thousands', () => {
    expect(formatWholeUsd(1234.49)).toBe('$1,234')
    expect(formatWholeUsd(1234.5)).toBe('$1,235')
    expect(formatWholeUsd(999)).toBe('$999')
    expect(formatWholeUsd(1_000_000)).toBe('$1,000,000')
  })

  it('groups a number without rounding or a currency symbol', () => {
    expect(formatGroupedNumber(12_345)).toBe('12,345')
    expect(formatGroupedNumber(7)).toBe('7')
    expect(formatGroupedNumber(-2_500)).toBe('-2,500')
  })

  it('formats percents to one decimal by default', () => {
    expect(formatEvidencePercent(7.25)).toBe('7.3%')
    expect(formatEvidencePercent(100)).toBe('100.0%')
    expect(formatEvidencePercent(0.5, 2)).toBe('0.50%')
  })

  it('spells singular and plural age components', () => {
    expect(formatEvidenceAge(67 * 12 + 2)).toBe('67 years 2 months')
    expect(formatEvidenceAge(12 + 1)).toBe('1 year 1 month')
    expect(formatEvidenceAge(70 * 12)).toBe('70 years 0 months')
  })
})
