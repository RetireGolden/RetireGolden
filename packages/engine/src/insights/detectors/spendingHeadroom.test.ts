import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { spendingHeadroom } from './spendingHeadroom.js'

/**
 * Engine-local coverage for the spending-headroom detector's screen phase.
 *
 * The module states the screen's condition — "it only reads the baseline
 * projection (never depleting + a large ending estate above the bequest target
 * ⇒ the plan is leaving lifestyle on the table)" — and each constant carries
 * its own sentence: "Screen only when the excess estate could fund a meaningful
 * lifestyle bump" ($250,000 of excess estate; $2,000/yr of rough headroom).
 * Both dollar gates are fixtured on both sides.
 *
 * The identity deflator keeps the fixture in today's dollars, so the excess
 * estate is stated directly rather than back-solved through an inflation path;
 * the rough headroom is then the excess spread over the remaining years, which
 * is the module's own stated reading ("what spreading it evenly over the
 * remaining years would add to annual spending").
 *
 * `evaluate()` is not exercised beyond its refusal: it runs the exact-ledger
 * sustainable-spending solver, whose own coverage lives with the solver, and
 * driving it from here would make this suite a slow second copy of that.
 */
const START_YEAR = 2026

function context(
  opts: {
    endYear?: number
    endingAfterTaxEstate?: number
    bequestTargetDollars?: number
    depletionYear?: number | null
    spendingPolicyMode?: string
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.baseAnnual = 60_000
  if (opts.bequestTargetDollars !== undefined) plan.expenses.bequestTargetDollars = opts.bequestTargetDollars
  if (opts.spendingPolicyMode !== undefined) {
    plan.expenses.spendingPolicy = { mode: opts.spendingPolicyMode } as never
  }
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result: { endYear: opts.endYear ?? START_YEAR + 30, years: [] },
      summary: {
        depletionYear: opts.depletionYear ?? null,
        endingAfterTaxEstate: opts.endingAfterTaxEstate ?? 1_000_000,
      },
      deflate: (_year: number, amount: number) => amount,
    },
  } as unknown as DetectorContext
}

describe('spendingHeadroom', () => {
  it('fires on a never-depleting plan whose ending estate clears the bequest target', () => {
    const card = spendingHeadroom.screen(context({ endingAfterTaxEstate: 1_000_000 }))
    expect(card?.id).toBe('spending-headroom')
    expect(card?.category).toBe('sequence-risk')
    expect(card?.severity).toBe('info')
    expect(card?.exact).toBe(false)
    expect(card?.plannerRoute).toBe('spending-solver')
    expect(card?.evidence).toContainEqual({
      label: "Ending after-tax estate (today's $)",
      value: '$1,000,000',
      year: START_YEAR + 30,
    })
    expect(card?.evidence).toContainEqual({ label: 'Bequest target', value: '$0' })
    expect(card?.rationale).toContain('with no bequest target set')
  })

  it('measures the excess against the bequest target, not the whole estate', () => {
    // 1,000,000 estate against a 900,000 target is 100,000 of excess — below
    // the $250,000 screen — even though the estate itself is large.
    expect(
      spendingHeadroom.screen(context({ endingAfterTaxEstate: 1_000_000, bequestTargetDollars: 900_000 })),
    ).toBeNull()
    const card = spendingHeadroom.screen(
      context({ endingAfterTaxEstate: 1_000_000, bequestTargetDollars: 700_000 }),
    )
    expect(card?.id).toBe('spending-headroom')
    expect(card?.rationale).toContain('well above your $700,000 bequest target')
  })

  it('holds the $250,000 excess-estate gate on both sides', () => {
    expect(spendingHeadroom.screen(context({ endingAfterTaxEstate: 250_000 }))?.id).toBe('spending-headroom')
    expect(spendingHeadroom.screen(context({ endingAfterTaxEstate: 249_999 }))).toBeNull()
  })

  it('holds the $2,000/yr rough-headroom gate on both sides', () => {
    // Spread thin enough, even a large excess is not a meaningful lifestyle
    // bump: 400,000 over 200 remaining years is exactly $2,000/yr, and one
    // dollar less is not.
    const longHorizon = { endYear: START_YEAR + 200 }
    expect(
      spendingHeadroom.screen(context({ ...longHorizon, endingAfterTaxEstate: 400_000 }))?.id,
    ).toBe('spending-headroom')
    expect(spendingHeadroom.screen(context({ ...longHorizon, endingAfterTaxEstate: 399_999 }))).toBeNull()
  })

  it('stays silent on a plan that depletes', () => {
    expect(
      spendingHeadroom.screen(context({ depletionYear: 2050, endingAfterTaxEstate: 1_000_000 })),
    ).toBeNull()
  })

  it('stays silent for an amortized-spending plan, which spends the portfolio down by design', () => {
    expect(spendingHeadroom.screen(context({ spendingPolicyMode: 'abw' }))).toBeNull()
    // A fixed-target policy is still eligible.
    expect(spendingHeadroom.screen(context({ spendingPolicyMode: 'fixedTarget' }))?.id).toBe(
      'spending-headroom',
    )
  })

  it('evaluate() refuses a plan the screen already rejected', () => {
    expect(() => spendingHeadroom.evaluate!(context({ depletionYear: 2050 }))).toThrow(/not eligible/i)
  })
})
