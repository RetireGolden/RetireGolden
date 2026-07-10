import { describe, expect, it } from 'vitest'

import { ficaOasdiPaidIn } from './ficaReturn'

// 2026 wage base; a couple of historical caps for capping tests.
const WAGE_BASE = { 2024: 168_600, 2025: 176_100, 2026: 184_500 }

describe('ficaOasdiPaidIn', () => {
  it('sums 6.2% of employee earnings, capped at the wage base', () => {
    const r = ficaOasdiPaidIn(
      [{ year: 2026, amount: 100_000 }],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: false, wageBaseByYear: WAGE_BASE },
    )
    expect(r.paidIn).toBeCloseTo(100_000 * 0.062, 6)
    expect(r.employerPaid).toBeCloseTo(100_000 * 0.062, 6)
  })

  it('caps earnings above the wage base (no tax above the cap)', () => {
    const r = ficaOasdiPaidIn(
      [{ year: 2026, amount: 500_000 }],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: false, wageBaseByYear: WAGE_BASE },
    )
    // Only the first 184,500 is taxed.
    expect(r.paidIn).toBeCloseTo(184_500 * 0.062, 6)
    expect(r.employerPaid).toBeCloseTo(184_500 * 0.062, 6)
  })

  it('doubles the rate for self-employed (12.4%) and reports no employer share', () => {
    const r = ficaOasdiPaidIn(
      [{ year: 2026, amount: 100_000 }],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: true, wageBaseByYear: WAGE_BASE },
    )
    expect(r.paidIn).toBeCloseTo(100_000 * 0.124, 6)
    expect(r.employerPaid).toBe(0)
  })

  it('uses the correct per-year cap across a multi-year history', () => {
    const r = ficaOasdiPaidIn(
      [
        { year: 2024, amount: 200_000 }, // capped at 168,600
        { year: 2025, amount: 100_000 }, // not capped
      ],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: false, wageBaseByYear: WAGE_BASE },
    )
    expect(r.paidIn).toBeCloseTo((168_600 + 100_000) * 0.062, 6)
  })

  it('falls back to the latest known wage base for years beyond the table', () => {
    const r = ficaOasdiPaidIn(
      [{ year: 2030, amount: 1_000_000 }],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: false, wageBaseByYear: WAGE_BASE },
    )
    // Falls back to the latest cap in the table (184,500 for 2026).
    expect(r.paidIn).toBeCloseTo(184_500 * 0.062, 6)
  })

  it('ignores zero/negative earnings rows', () => {
    const r = ficaOasdiPaidIn(
      [
        { year: 2026, amount: 0 },
        { year: 2026, amount: -5 },
        { year: 2026, amount: 100_000 },
      ],
      { oasdiEmployeeRatePct: 6.2, selfEmployed: false, wageBaseByYear: WAGE_BASE },
    )
    expect(r.paidIn).toBeCloseTo(100_000 * 0.062, 6)
  })

  it('hand-computes a full small career (employee)', () => {
    // 3 years at 50k (below cap). Employee 6.2% each.
    const earnings = [2021, 2022, 2023].map((y) => ({ year: y, amount: 50_000 }))
    const r = ficaOasdiPaidIn(earnings, {
      oasdiEmployeeRatePct: 6.2,
      selfEmployed: false,
      wageBaseByYear: WAGE_BASE,
    })
    expect(r.paidIn).toBeCloseTo(3 * 50_000 * 0.062, 6) // 9,300
    expect(r.employerPaid).toBeCloseTo(9_300, 6)
  })
})
