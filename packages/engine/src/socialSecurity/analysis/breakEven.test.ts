/**
 * The retired planner-ui break-even suite's zero-COLA pins and its "a COLA
 * pulls the crossing earlier" result, restored on the engine's chart (the
 * slice review's F16). With a fixed 0% COLA and no cut each year's benefit is
 * PIA × factor × 12, so the retired worksheet's figures hold unchanged.
 */
import { describe, expect, it } from 'vitest'

import { claimBreakEven, type ClaimBreakEvenInput } from './breakEven.js'

const base: ClaimBreakEvenInput = {
  dob: { year: 1965, month: 6, day: 15 },
  piaMonthly: 2_000,
  claimAges: [62, 67, 70],
  startYear: 2026,
  assumptions: { inflationPct: 2.5, ssCola: { mode: 'fixed', annualPct: 0 }, ssHaircut: null },
  growthPct: 0,
  throughAge: 95,
}
const crossing = (input: ClaimBreakEvenInput, early: number, late: number) =>
  claimBreakEven(input).crossings.find((entry) => entry.early === early && entry.late === late)!.age!

describe('claimBreakEven at a 0% COLA', () => {
  it('pins the retired worksheet: 16,800, 24,000 and 29,760 a year, totals through 95 and crossings at 79.4 and 81.5', () => {
    const result = claimBreakEven(base)
    expect(result.series[0]!.age).toBe(62)
    expect(result.series).toHaveLength(95 - 62 + 1)
    const last = result.series.at(-1)!
    expect(last.age).toBe(95)
    expect(last.cumulative[62]).toBe(571_200)
    expect(last.cumulative[67]).toBe(696_000)
    expect(last.cumulative[70]).toBe(773_760)
    // 12,960 a = 1,028,640 and 5,760 a = 469,440.
    expect(crossing(base, 62, 70)).toBeCloseTo(1_028_640 / 12_960, 12)
    expect(crossing(base, 67, 70)).toBeCloseTo(469_440 / 5_760, 12)
  })

  it('a COLA pulls the crossing earlier, and a return on benefits received pushes it later', () => {
    const withCola = { ...base, assumptions: { ...base.assumptions, ssCola: { mode: 'fixed' as const, annualPct: 2.5 } } }
    expect(crossing(withCola, 62, 70)).toBeLessThan(crossing(base, 62, 70))
    const withReturn = claimBreakEven({ ...base, growthPct: 5 }).crossings.find((entry) => entry.early === 62 && entry.late === 70)!.age
    expect(withReturn === null || withReturn > crossing(base, 62, 70)).toBe(true)
  })
})
