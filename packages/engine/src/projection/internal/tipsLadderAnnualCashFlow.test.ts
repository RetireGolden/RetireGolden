/**
 * Atomic coverage for the TIPS-ladder annual cash-flow phase against its own
 * explicit contract — the seam that `simulatePlan` used to hold inline.
 *
 * WHAT IS PROVED HERE, against controlled rung fixtures: the four row kinds and
 * the exact boundary between them, the `scale` multiplication reaching every
 * term, the deflation clamp, which year the accretion differences against, the
 * post-death frozen offset and its (defensive, see below) lower clamp, the
 * refusal to sum across ladders, and the refusal to mutate its input.
 * Expected values are hand-computed from the two cited ladder primitives —
 * `ladderRealFlowsAtOffset` (outstanding face, coupons, and the maturing rung
 * at an offset) and `ladderRemainingFace` (face still outstanding after that
 * offset) — never by running this module. Every fixture number is exactly
 * representable in binary floating point so the assertions can be exact.
 *
 * WHAT IS NOT PROVED HERE: that the phase is wired into the ledger correctly.
 * That the taxable amount reaches federal ordinary income, is exempt from
 * state tax as U.S. government interest, lifts provisional income, and that
 * maturing principal stays tax-free, all remain proved against the real
 * `simulatePlan` in `../incomeFloor.test.ts` ('TIPS ladder cash flows' and
 * 'TIPS taxation in the ledger'). This file deliberately does not restate
 * those claims in miniature.
 *
 * Authority for the accretion leg: Treas. Reg. 1.1275-7(d)(4)(iii) (a positive
 * inflation adjustment is OID); the zero clamp in a deflation year is the
 * registered approximation treas-reg-1-1275-7-f-1-deflation-adjustment-income.
 */
import { describe, expect, it } from 'vitest'

import type { LadderRung } from '../../ladder/ladderMath.js'
import { tipsLadderAnnualCashFlows, type TipsLadderState, type TipsLadderYearRow } from './tipsLadderAnnualCashFlow.js'

/**
 * Three rungs maturing at offsets 1, 2 and 3. Faces and the coupon rate are
 * chosen so every product below is exact: 12.5% of 1000/2000/4000 is
 * 125/250/500, and the inflation factors are eighths.
 */
const RUNGS: LadderRung[] = [
  { maturityOffset: 1, face: 1000, couponRatePct: 12.5, cost: 0 },
  { maturityOffset: 2, face: 2000, couponRatePct: 12.5, cost: 0 },
  { maturityOffset: 3, face: 4000, couponRatePct: 12.5, cost: 0 },
]

const ANCHOR = 2025
const START = 2026

function ladder(overrides: Partial<TipsLadderState> = {}): TipsLadderState {
  return { id: 'L1', anchorYear: ANCHOR, rungs: RUNGS, costReal: 5000, purchase: undefined, scale: 1, ...overrides }
}

function runYear(
  states: TipsLadderState[],
  opts: { year: number; anyAlive?: boolean; inflFactor: number; prevInflFactor: number; lastAlive?: number },
): readonly TipsLadderYearRow[] {
  return tipsLadderAnnualCashFlows({
    ladderStates: states,
    year: opts.year,
    startYear: START,
    anyAlive: opts.anyAlive ?? true,
    inflFactor: opts.inflFactor,
    // Which year this lookup is asked for is pinned separately, below.
    inflFactorFrom: () => opts.prevInflFactor,
    ladderLastAliveYear: opts.lastAlive ?? 2100,
  })
}

describe('tipsLadderAnnualCashFlows — the flow row', () => {
  // Offset 2 (year 2027, anchor 2025). Rungs still outstanding: the 2000 rung
  // (maturing this year) and the 4000 rung, so outstanding face is 6000 and
  // coupons are 2000*0.125 + 4000*0.125 = 250 + 500 = 750. Maturing principal
  // is the 2000 rung. Face remaining AFTER this year is the 4000 rung alone.
  // Nominalised at inflFactor 1.25, with last year's factor 1.125:
  //   cash      = (750 + 2000) * 1.25            = 3437.5
  //   accretion = 6000 * (1.25 - 1.125)          = 750
  //   taxable   = 750 * 1.25 + 750               = 1687.5
  //   value     = 4000 * 1.25                    = 5000
  it('splits the year into cash, taxable income, and remaining face', () => {
    const rows = runYear([ladder()], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.kind).toBe('flow')
    if (row.kind !== 'flow') return
    expect(row.cash).toBe(3437.5)
    expect(row.taxable).toBe(1687.5)
    expect(row.ladderValue).toBe(5000)
  })

  it('reports the cash-flow ledger row split into coupons, principal, and accretion', () => {
    const rows = runYear([ladder()], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    const row = rows[0]!
    if (row.kind !== 'flow') throw new Error('expected a flow row')
    expect(row.record).toEqual({
      ladderId: 'L1',
      cash: 3437.5,
      coupons: 937.5, // 750 real * 1.25
      maturingPrincipal: 2500, // 2000 real * 1.25
      accretion: 750,
    })
    // Maturing principal is a tax-free return of already-taxed dollars, so the
    // taxable leg is coupons + accretion and nothing else.
    expect(row.record.coupons + row.record.accretion).toBe(row.taxable)
  })

  // Deliberately at offset 3 (year 2028), where `year - 1` is 2027 and so is a
  // DIFFERENT number from `startYear`. At year 2027 the two coincide, and the
  // assertion could not tell `inflFactorFrom(startYear, year - 1)` apart from
  // `inflFactorFrom(startYear, startYear)` — a substitution that silently turns
  // the year's incremental accretion into cumulative-since-startYear accretion.
  // The stub answers 1.125 for 2027 only, so a lookup of any other year also
  // wrecks the accretion below rather than only the recorded argument pair.
  it('reads last year’s inflation factor from the caller, at (startYear, year - 1)', () => {
    const seen: Array<[number, number]> = []
    const rows = tipsLadderAnnualCashFlows({
      ladderStates: [ladder()],
      year: 2028,
      startYear: START,
      anyAlive: true,
      inflFactor: 1.25,
      inflFactorFrom: (fromYear, toYear) => {
        seen.push([fromYear, toYear])
        return toYear === 2027 ? 1.125 : 0
      },
      ladderLastAliveYear: 2100,
    })
    expect(seen).toEqual([[START, 2027]])
    const row = rows[0]!
    if (row.kind !== 'flow') throw new Error('expected a flow row')
    // Offset 3 leaves only the 4000 rung outstanding, so the accretion is
    // 4000 * (1.25 - 1.125) = 500. Reading any other year returns 0 from the
    // stub and would make this 4000 * 1.25 = 5000.
    expect(row.record.accretion).toBe(500)
  })

  // A partially funded purchase scales every rung down, so it must scale cash,
  // accretion, taxable income and remaining face alike. At scale 0.5:
  //   cash = 2750 * 0.5 * 1.25 = 1718.75; accretion = 6000 * 0.5 * 0.125 = 375
  //   taxable = 750 * 0.5 * 1.25 + 375 = 843.75; value = 4000 * 0.5 * 1.25 = 2500
  it('applies a partial-fill scale to every term', () => {
    const rows = runYear([ladder({ scale: 0.5 })], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    const row = rows[0]!
    if (row.kind !== 'flow') throw new Error('expected a flow row')
    expect(row.cash).toBe(1718.75)
    expect(row.taxable).toBe(843.75)
    expect(row.ladderValue).toBe(2500)
    expect(row.record).toEqual({ ladderId: 'L1', cash: 1718.75, coupons: 468.75, maturingPrincipal: 1250, accretion: 375 })
  })

  it('accretes nothing when the inflation factor is unchanged', () => {
    const rows = runYear([ladder()], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.25 })
    const row = rows[0]!
    if (row.kind !== 'flow') throw new Error('expected a flow row')
    expect(row.record.accretion).toBe(0)
    expect(row.taxable).toBe(937.5) // coupons only
  })

  // Registered approximation treas-reg-1-1275-7-f-1-deflation-adjustment-income:
  // a deflation year yields no negative adjustment and no ordinary-loss carry —
  // the accretion is clamped at zero and the coupon stays fully taxable.
  it('clamps a deflation year to zero accretion rather than negative income', () => {
    const rows = runYear([ladder()], { year: 2027, inflFactor: 1.125, prevInflFactor: 1.25 })
    const row = rows[0]!
    if (row.kind !== 'flow') throw new Error('expected a flow row')
    expect(row.record.accretion).toBe(0)
    expect(row.taxable).toBe(843.75) // 750 real coupons * 1.125, no offset
    expect(row.cash).toBe(3093.75) // (750 + 2000) * 1.125
  })
})

describe('tipsLadderAnnualCashFlows — the offset-0 boundary', () => {
  // Purchase year: the rungs are owned but nothing has matured, so the full
  // face (all three rungs, 7000 real) rides in net worth and no flows appear.
  it('reports owned face and no flows in the purchase year', () => {
    const state = ladder({ anchorYear: 2030, purchase: { year: 2030, fundingAccountId: 'a1' } })
    const rows = runYear([state], { year: 2030, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows).toEqual([{ kind: 'preFlow', ladderValue: 8750 }]) // 7000 * 1.25
  })

  it('contributes nothing at all before the purchase year', () => {
    const state = ladder({ anchorYear: 2030, purchase: { year: 2030, fundingAccountId: 'a1' } })
    const rows = runYear([state], { year: 2029, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows).toEqual([{ kind: 'none' }])
  })

  it('contributes nothing when an unpurchased ladder is evaluated at its anchor year', () => {
    const rows = runYear([ladder()], { year: ANCHOR, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows).toEqual([{ kind: 'none' }])
  })

  it('starts flowing at offset 1', () => {
    const rows = runYear([ladder()], { year: ANCHOR + 1, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows[0]!.kind).toBe('flow')
  })
})

describe('tipsLadderAnnualCashFlows — the frozen estate row', () => {
  // Nobody alive: maturation stops. The face is frozen as of the last living
  // year rather than continuing to shrink as offset-space maturities pass —
  // 2027 is offset 2, so the 4000 rung is what rides in the estate.
  it('freezes remaining face at the last living year', () => {
    const rows = runYear([ladder()], { year: 2040, anyAlive: false, inflFactor: 1.25, prevInflFactor: 1.125, lastAlive: 2027 })
    expect(rows).toEqual([{ kind: 'frozen', ladderValue: 5000 }]) // 4000 * 1.25
  })

  it('freezes the full face when death precedes the anchor year', () => {
    const rows = runYear([ladder()], { year: 2040, anyAlive: false, inflFactor: 1.25, prevInflFactor: 1.125, lastAlive: 2020 })
    expect(rows).toEqual([{ kind: 'frozen', ladderValue: 8750 }]) // full 7000 face * 1.25
  })

  // The case above cannot see the `Math.max(0, ...)` lower clamp: every rung a
  // real ladder holds matures at offset >= 1 (`buildLadder` forces
  // `firstPayoutOffset` to at least 1) and `ladderRemainingFace` counts rungs
  // with `maturityOffset > offset`, so for real rung sets a negative offset and
  // a clamped 0 return the same face — the clamp is defensive. This fixture
  // adds a rung AT offset 0, which no ladder build produces, precisely so the
  // clamp becomes observable and a deleted clamp fails here.
  it('clamps the frozen offset at zero rather than resurrecting an already-matured rung', () => {
    const withMaturedRung: LadderRung[] = [{ maturityOffset: 0, face: 800, couponRatePct: 12.5, cost: 0 }, ...RUNGS]
    const rows = runYear([ladder({ rungs: withMaturedRung })], {
      year: 2040,
      anyAlive: false,
      inflFactor: 1.25,
      prevInflFactor: 1.125,
      lastAlive: 2020,
    })
    // Clamped to offset 0 the 800 rung has already matured: 7000 * 1.25.
    // Unclamped the offset would be 2020 - 2025 = -5 and the 800 rung would ride
    // in the estate as well, giving 7800 * 1.25 = 9750.
    expect(rows).toEqual([{ kind: 'frozen', ladderValue: 8750 }])
  })

  it('scales the frozen face like any other term', () => {
    const rows = runYear([ladder({ scale: 0.5 })], { year: 2040, anyAlive: false, inflFactor: 1.25, prevInflFactor: 1.125, lastAlive: 2027 })
    expect(rows).toEqual([{ kind: 'frozen', ladderValue: 2500 }])
  })

  it('never emits a cash-flow ledger row once no one is alive', () => {
    const rows = runYear([ladder()], { year: 2040, anyAlive: false, inflFactor: 1.25, prevInflFactor: 1.125, lastAlive: 2027 })
    expect(rows.some((r) => r.kind === 'flow')).toBe(false)
  })
})

describe('tipsLadderAnnualCashFlows — what it refuses to do', () => {
  // The caller's `ordinaryIncome` is already non-zero when this phase runs and
  // IEEE-754 addition is not associative, so folding two ladders into one total
  // here would not equal folding them in one at a time. It returns rows.
  it('returns one row per ladder and never sums across them', () => {
    const a = ladder({ id: 'A' })
    const b = ladder({ id: 'B', scale: 0.5 })
    const rows = runYear([a, b], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows).toHaveLength(2)
    const first = rows[0]!
    const second = rows[1]!
    if (first.kind !== 'flow' || second.kind !== 'flow') throw new Error('expected two flow rows')
    expect(first.record.ladderId).toBe('A')
    expect(second.record.ladderId).toBe('B')
    expect(first.taxable).toBe(1687.5)
    expect(second.taxable).toBe(843.75)
  })

  it('emits one row per ladder even when some contribute nothing', () => {
    const states = [
      ladder({ id: 'A' }),
      ladder({ id: 'B', anchorYear: 2030, purchase: { year: 2030, fundingAccountId: 'a1' } }),
      ladder({ id: 'C' }),
    ]
    const rows = runYear(states, { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows.map((r) => r.kind)).toEqual(['flow', 'none', 'flow'])
  })

  it('preserves the caller’s ladder order', () => {
    const states = [ladder({ id: 'first' }), ladder({ id: 'second' }), ladder({ id: 'third' })]
    const rows = runYear(states, { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(rows.map((r) => (r.kind === 'flow' ? r.record.ladderId : null))).toEqual(['first', 'second', 'third'])
  })

  it('mutates neither the ladder states nor their rungs', () => {
    const state = ladder({ scale: 0.5 })
    const before = structuredClone({ state, rungs: RUNGS })
    runYear([state], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    runYear([state], { year: 2030, anyAlive: false, inflFactor: 1.25, prevInflFactor: 1.125, lastAlive: 2027 })
    expect({ state, rungs: RUNGS }).toEqual(before)
  })

  it('holds no state between calls: the same year twice gives equal, freshly allocated rows', () => {
    const states = [ladder()]
    const first = runYear(states, { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    const second = runYear(states, { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
  })

  it('returns no rows for an empty ladder list', () => {
    expect(runYear([], { year: 2027, inflFactor: 1.25, prevInflFactor: 1.125 })).toEqual([])
  })
})
