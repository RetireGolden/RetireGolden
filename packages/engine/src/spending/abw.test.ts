import { describe, expect, it } from 'vitest'

import { ABW_DEFAULTS, abwAnnualPayment, abwExpectedRealReturnPct } from './abw.js'

describe('abwAnnualPayment', () => {
  it('pays balance/n at zero return and zero tilt', () => {
    expect(abwAnnualPayment(300_000, 0, 0, 30)).toBeCloseTo(10_000, 6)
  })

  it('pays the whole balance in the terminal year and 0 on an empty portfolio', () => {
    expect(abwAnnualPayment(123_456, 4, 0, 1)).toBe(123_456)
    expect(abwAnnualPayment(123_456, 4, 0, 0)).toBe(123_456)
    expect(abwAnnualPayment(0, 4, 0, 20)).toBe(0)
    expect(abwAnnualPayment(-5, 4, 0, 20)).toBe(0)
  })

  it('satisfies the annuity-due amortization identity: simulated payments deplete exactly at the horizon', () => {
    // Recompute the payment from the actual balance every year (the ABW rule),
    // with realized return == expected return: the balance must hit exactly 0
    // after the horizon's last payment, and payments must grow at the tilt.
    for (const [r, g, n] of [
      [4, 0, 30],
      [3.8, -1.5, 26],
      [2, 1, 12],
    ] as const) {
      let balance = 1_000_000
      let prevPayment: number | null = null
      for (let remaining = n; remaining >= 1; remaining--) {
        const payment = abwAnnualPayment(balance, r, g, remaining)
        if (prevPayment !== null) {
          expect(payment / prevPayment).toBeCloseTo(1 + g / 100, 8)
        }
        prevPayment = payment
        balance = (balance - payment) * (1 + r / 100)
      }
      expect(balance).toBeCloseTo(0, 6)
    }
  })

  it('a higher expected return pays more today; a negative tilt front-loads', () => {
    const base = abwAnnualPayment(500_000, 3, 0, 25)
    expect(abwAnnualPayment(500_000, 5, 0, 25)).toBeGreaterThan(base)
    expect(abwAnnualPayment(500_000, 3, -2, 25)).toBeGreaterThan(base)
    expect(abwAnnualPayment(500_000, 3, 2, 25)).toBeLessThan(base)
  })
})

describe('abwExpectedRealReturnPct', () => {
  it('defaults to the VPW-style fixed return', () => {
    expect(abwExpectedRealReturnPct(undefined)).toBe(ABW_DEFAULTS.fixedRealReturnPct)
    expect(abwExpectedRealReturnPct({ returnSource: 'fixed' })).toBe(ABW_DEFAULTS.fixedRealReturnPct)
    expect(abwExpectedRealReturnPct({ returnSource: 'fixed', fixedRealReturnPct: 3.0 })).toBe(3.0)
  })

  it('CAPE source blends the earnings yield with the bond yield at the equity share', () => {
    // CAPE 25 ⇒ CAEY 4%; 60/40 with 2% bonds ⇒ 3.2% real.
    expect(abwExpectedRealReturnPct({ returnSource: 'cape' })).toBeCloseTo(3.2, 10)
    // CAPE 20 ⇒ 5%; 100% equity ⇒ 5%.
    expect(
      abwExpectedRealReturnPct({ returnSource: 'cape', startingCape: 20, equitySharePct: 100 }),
    ).toBeCloseTo(5, 10)
    // Higher CAPE ⇒ lower expected return (the ERN conditioning direction).
    expect(abwExpectedRealReturnPct({ returnSource: 'cape', startingCape: 35 })).toBeLessThan(
      abwExpectedRealReturnPct({ returnSource: 'cape', startingCape: 25 }),
    )
  })

  it('TIPS source reads the bond real yield alone', () => {
    expect(abwExpectedRealReturnPct({ returnSource: 'tips' })).toBe(ABW_DEFAULTS.bondRealYieldPct)
    expect(abwExpectedRealReturnPct({ returnSource: 'tips', bondRealYieldPct: 1.6 })).toBe(1.6)
  })
})
