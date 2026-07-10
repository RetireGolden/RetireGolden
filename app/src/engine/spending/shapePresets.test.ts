import { describe, expect, it } from 'vitest'

import { annualDeltaPhases, SMIRK_ANNUAL_REAL_DELTA_PCT, spendingShapePhases } from './shapePresets'

describe('annualDeltaPhases', () => {
  it('compiles a steady drift into compounded 5-year steps to age 100', () => {
    const phases = annualDeltaPhases(-1, 65)
    expect(phases[0]).toEqual({ fromAge: 70, multiplier: 0.95 })
    expect(phases[phases.length - 1]!.fromAge).toBe(100)
    // Fully compounded at each step: (0.99)^(age − 65) rounded to 2dp.
    for (const p of phases) {
      expect(p.multiplier).toBeCloseTo(Math.round(Math.pow(0.99, p.fromAge - 65) * 100) / 100, 10)
    }
    // Strictly declining, never below the schema floor.
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.multiplier).toBeLessThan(phases[i - 1]!.multiplier)
      expect(phases[i]!.multiplier).toBeGreaterThanOrEqual(0)
    }
  })

  it('zero delta compiles to constant-real (no phases) and positive deltas rise', () => {
    expect(annualDeltaPhases(0, 65)).toEqual([])
    const rising = annualDeltaPhases(1, 65)
    expect(rising[0]!.multiplier).toBeGreaterThan(1)
    // Clamped to the phase schema's multiplier ceiling.
    for (const p of rising) expect(p.multiplier).toBeLessThanOrEqual(3)
  })

  it('respects the phase schema fromAge bounds for extreme retirement ages', () => {
    for (const retirementAge of [30, 80, 108]) {
      for (const p of annualDeltaPhases(-1, retirementAge)) {
        expect(p.fromAge).toBeGreaterThanOrEqual(40)
        expect(p.fromAge).toBeLessThanOrEqual(110)
      }
    }
  })
})

describe('spendingShapePhases', () => {
  it('keeps the shipped flat/smile/front-loaded calibrations byte-identical', () => {
    expect(spendingShapePhases('flat', 65)).toEqual([])
    expect(spendingShapePhases('smile', 65)).toEqual([
      { fromAge: 75, multiplier: 0.9 },
      { fromAge: 85, multiplier: 0.8 },
    ])
    expect(spendingShapePhases('frontLoaded', 65)).toEqual([
      { fromAge: 65, multiplier: 1.1 },
      { fromAge: 75, multiplier: 1 },
    ])
    expect(spendingShapePhases('frontLoaded', 76)).toEqual([])
  })

  it('smirk is the documented Blanchett-median drift', () => {
    expect(spendingShapePhases('smirk', 65)).toEqual(
      annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT, 65),
    )
    expect(SMIRK_ANNUAL_REAL_DELTA_PCT).toBeLessThan(0)
  })
})
