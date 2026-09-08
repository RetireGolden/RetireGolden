import { describe, expect, it } from 'vitest'

import { computeBreakEven } from './breakEven'

// Born 1965-06-15 → FRA 67. Compare 62 / 67 / 70.
const base = {
  dob: { year: 1965, month: 6, day: 15 },
  piaMonthly: 2_000,
  claimAges: [62, 67, 70],
  colaPct: 0,
  growthPct: 0,
  throughAge: 95,
}

describe('computeBreakEven', () => {
  it('produces monotonic claim factors (62 reduced, 67 = 1, 70 boosted)', () => {
    const r = computeBreakEven(base)
    expect(r.factors[62]).toBeLessThan(1)
    expect(r.factors[67]).toBeCloseTo(1, 5)
    expect(r.factors[70]).toBeGreaterThan(1)
    expect(r.factors[62]).toBeLessThan(r.factors[70]!)
  })

  it('pins the zero-COLA educational-model worksheet for the base household', () => {
    const r = computeBreakEven(base)
    // Source for claiming reductions/credits:
    // DOCS/domain/domain-rules-reference/04-social-security-program-parameters-2026.md.
    // At FRA 67, 60 months early reduces PIA by 36*(5/9)% + 24*(5/12)% = 30%;
    // 36 months delayed adds 36*(2/3)% = 24%.
    // Educational-model worksheet (not SSA payment outputs): $2,000 PIA with
    // claim factors 0.70/1.00/1.24 gives annual modeled benefits $16,800,
    // $24,000, and $29,760; whole-year accumulation through age 95 yields
    // $571,200, $696,000, and $773,760 with crossings at 79.4 and 81.5.
    expect(r.factors[62]).toBeCloseTo(0.70, 5)
    expect(r.factors[67]).toBeCloseTo(1.00, 5)
    expect(r.factors[70]).toBeCloseTo(1.24, 5)
    expect(r.crossings.find((x) => x.early === 62 && x.late === 70)!.age).toBeCloseTo(79.4, 1)
    expect(r.crossings.find((x) => x.early === 67 && x.late === 70)!.age).toBeCloseTo(81.5, 1)
    const last = r.series.at(-1)!
    expect(last.cumulative[62]).toBe(571_200)
    expect(last.cumulative[67]).toBe(696_000)
    expect(last.cumulative[70]).toBe(773_760)
  })

  it('straight (no-growth) break-even of 62 vs 70 lands in the late 70s/early 80s', () => {
    const r = computeBreakEven(base)
    const c = r.crossings.find((x) => x.early === 62 && x.late === 70)!
    expect(c.age).not.toBeNull()
    expect(c.age!).toBeGreaterThan(78)
    expect(c.age!).toBeLessThan(84)
  })

  it('break-even between two post-62 claim ages starts after the earlier claim, not at 62', () => {
    const r = computeBreakEven(base)
    const c = r.crossings.find((x) => x.early === 67 && x.late === 70)!
    expect(c.age).not.toBeNull()
    // Must be well past the claim ages — not a false 62 from both being $0 early.
    expect(c.age!).toBeGreaterThan(70)
    expect(c.age!).toBeLessThan(86)
  })

  it('the delayed claim eventually accumulates more (no growth)', () => {
    const r = computeBreakEven(base)
    const last = r.series.at(-1)!
    expect(last.cumulative[70]).toBeGreaterThan(last.cumulative[62]!)
  })

  it('investment growth pushes break-even later (or off the table)', () => {
    const noGrowth = computeBreakEven(base)
    const withGrowth = computeBreakEven({ ...base, growthPct: 5 })
    const noG = noGrowth.crossings.find((x) => x.early === 62 && x.late === 70)!.age!
    const withG = withGrowth.crossings.find((x) => x.early === 62 && x.late === 70)!.age
    // At 5% the early claimant's invested head start may never be caught (null),
    // or is caught only at a later age.
    expect(withG === null || withG > noG).toBe(true)
  })

  it('COLA shifts break-even earlier than the no-COLA case', () => {
    const noCola = computeBreakEven(base).crossings.find((x) => x.early === 62 && x.late === 70)!.age!
    const withCola = computeBreakEven({ ...base, colaPct: 2.5 }).crossings.find(
      (x) => x.early === 62 && x.late === 70,
    )!.age!
    expect(withCola).toBeLessThan(noCola)
  })

  it('charts every age from 62 through throughAge', () => {
    const r = computeBreakEven(base)
    expect(r.series[0]!.age).toBe(62)
    expect(r.series.at(-1)!.age).toBe(95)
    expect(r.series).toHaveLength(95 - 62 + 1)
  })
})
