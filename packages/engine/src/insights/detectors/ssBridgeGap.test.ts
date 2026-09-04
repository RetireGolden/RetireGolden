import { describe, expect, it } from 'vitest'

import { BRIDGE_FUNDING_MIN_FRACTION, sizeBridge } from '../../ladder/bridge.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../../params/index.js'
import { cashAccount, singlePersonPlan, socialSecurityIncome } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { ssBridgeGap } from './ssBridgeGap.js'

/**
 * Engine-local coverage for the Social Security bridge detector.
 *
 * The module states its condition: it "Fires when someone delays Social
 * Security past retirement with no TIPS ladder covering the gap years, and
 * liquid savings could fund one", and the funding gate names its own shared
 * constant: "Don't suggest a bridge the plan clearly cannot buy (shared
 * threshold)" — `BRIDGE_FUNDING_MIN_FRACTION`.
 *
 * The affordability boundary is fixtured on both sides from that shared
 * constant and the shared sizer, not from the detector's output: the test asks
 * `sizeBridge` for the same ladder the detector will size, multiplies by the
 * published fraction, and checks the balance one dollar below and exactly at
 * the resulting floor. If either the fraction or the sizing moves, both halves
 * of this pair move with it and the boundary stays honest.
 */
const DOB = '1962-06-15'
const PIA_MONTHLY = 3_000
const CLAIM_AGE_YEARS = 70
const RETIREMENT_AGE = 64
const START_YEAR = 2026

/** The ladder the detector will size for the fixture household. */
function fixtureBridge() {
  const sized = sizeBridge({
    piaMonthly: PIA_MONTHLY,
    dob: { year: 1962, month: 6, day: 15 },
    claimAge: { years: CLAIM_AGE_YEARS, months: 0 },
    currentYear: START_YEAR,
    retirementYear: 1962 + RETIREMENT_AGE,
    curve: EMBEDDED_REAL_YIELD_CURVE,
  })
  if (!sized) throw new Error('fixture household has no gap to bridge')
  return sized
}

function context(
  opts: {
    liquid?: number
    claimAgeYears?: number
    piaMonthly?: number | null
    retirementAge?: number | null
    ladders?: unknown[]
    noAccounts?: boolean
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: DOB, retirementAge: opts.retirementAge ?? RETIREMENT_AGE })
  plan.accounts = opts.noAccounts === true ? ([] as never) : ([cashAccount('cash', opts.liquid ?? 5_000_000)] as never)
  const income = socialSecurityIncome('ss', PIA_MONTHLY, opts.claimAgeYears ?? CLAIM_AGE_YEARS)
  plan.incomes = [
    { ...income, piaMonthly: opts.piaMonthly === undefined ? PIA_MONTHLY : opts.piaMonthly },
  ] as never
  if (opts.ladders !== undefined) plan.incomeFloor = { ladders: opts.ladders } as never
  return {
    plan,
    params: { year: START_YEAR },
    projection: { startYear: START_YEAR, result: { years: [] } },
  } as unknown as DetectorContext
}

describe('ssBridgeGap', () => {
  it('fires when a delayed claim leaves unfunded gap years the plan could bridge', () => {
    const sized = fixtureBridge()
    const card = ssBridgeGap.screen(context())
    expect(card?.id).toBe('ss-bridge-gap')
    expect(card?.category).toBe('social-security')
    expect(card?.severity).toBe('attention')
    expect(card?.evidence).toContainEqual({
      label: 'First Social Security gap year',
      value: `${sized.startYear}`,
      year: sized.startYear,
    })
    expect(card?.evidence).toContainEqual({
      label: 'Last Social Security gap year',
      value: `${sized.endYear}`,
      year: sized.endYear,
    })
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    const ladders = (card.action.patch as { incomeFloor: { ladders: Array<Record<string, unknown>> } })
      .incomeFloor.ladders
    expect(ladders).toHaveLength(1)
    expect(ladders[0]).toMatchObject({
      purpose: 'bridge',
      startYear: sized.startYear,
      endYear: sized.endYear,
      purchase: { year: START_YEAR, fundingAccountId: 'cash' },
    })
  })

  it('holds the shared funding fraction on both sides', () => {
    const floor = fixtureBridge().ladderCost * BRIDGE_FUNDING_MIN_FRACTION
    expect(ssBridgeGap.screen(context({ liquid: Math.ceil(floor) }))?.id).toBe('ss-bridge-gap')
    expect(ssBridgeGap.screen(context({ liquid: Math.floor(floor) - 1 }))).toBeNull()
  })

  it('stays silent when the claim is not delayed past 62', () => {
    // No forgone benefit before 62, so there is no gap to bridge.
    expect(ssBridgeGap.screen(context({ claimAgeYears: 62 }))).toBeNull()
  })

  it('stays silent without a Social Security benefit to forgo', () => {
    expect(ssBridgeGap.screen(context({ piaMonthly: null }))).toBeNull()
    expect(ssBridgeGap.screen(context({ piaMonthly: 0 }))).toBeNull()
  })

  it('stays silent with no liquid account to fund the ladder', () => {
    expect(ssBridgeGap.screen(context({ noAccounts: true }))).toBeNull()
  })

  it('stays silent when a ladder already covers the gap years', () => {
    const sized = fixtureBridge()
    expect(
      ssBridgeGap.screen(
        context({ ladders: [{ id: 'owned', startYear: sized.startYear, endYear: sized.endYear }] }),
      ),
    ).toBeNull()
    // A ladder that stops short of the gap does not count as coverage.
    expect(
      ssBridgeGap.screen(
        context({ ladders: [{ id: 'short', startYear: sized.startYear, endYear: sized.endYear - 1 }] }),
      )?.id,
    ).toBe('ss-bridge-gap')
  })

  it('stays silent when the benefit belongs to nobody in the household', () => {
    const ctx = context()
    ctx.plan.incomes = [socialSecurityIncome('ss', PIA_MONTHLY, CLAIM_AGE_YEARS, 'ghost')] as never
    expect(ssBridgeGap.screen(ctx)).toBeNull()
  })

  it('evaluate() refuses a plan with no gap', () => {
    expect(() => ssBridgeGap.evaluate!(context({ claimAgeYears: 62 }))).toThrow(/not eligible/i)
  })
})
