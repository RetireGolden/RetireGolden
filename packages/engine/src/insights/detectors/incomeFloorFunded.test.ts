import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { incomeFloorFunded } from './incomeFloorFunded.js'

/**
 * Engine-local coverage for the funded-ratio detector.
 *
 * The module states its condition: it "Fires when the household has
 * distinguished a required floor from lifestyle spending and guaranteed income
 * covers less than ~90% of its present value on the TIPS curve."
 *
 * The 90% gate is exercised from both sides without recomputing the detector's
 * discounting. `computeFundedRatio` discounts the essential-spending flows and
 * the guaranteed-income flows over the SAME year offsets with the SAME curve,
 * so when both series are level the discount factors cancel and the ratio is
 * exactly guaranteed/essential. A level $100,000 floor against level guaranteed
 * income of $89,000 is therefore 89% by construction, and $90,000 is 90% — one
 * fixture on each side of the boundary, derived from that identity rather than
 * from the detector's own output.
 */
interface FloorYears {
  requiredSpending: number
  guaranteed: number
  years?: number
}

function context(
  opts: { requiredAnnual?: number | undefined; retirementAge?: number | null } & Partial<FloorYears> = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', retirementAge: opts.retirementAge ?? null })
  if (opts.requiredAnnual !== undefined) plan.expenses.requiredAnnual = opts.requiredAnnual
  const count = opts.years ?? 5
  const years = Array.from({ length: count }, (_, i) => ({
    year: 2026 + i,
    expenses: { requiredSpending: opts.requiredSpending ?? 100_000 },
    incomes: {
      socialSecurity: opts.guaranteed ?? 89_000,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
    },
  }))
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years },
      // Identity deflator: the fixtures are already stated in today's dollars.
      deflate: (_year: number, amount: number) => amount,
    },
  } as unknown as DetectorContext
}

describe('incomeFloorFunded', () => {
  it('fires below the ~90% funded gate and names the ratio in its title', () => {
    const card = incomeFloorFunded.screen(context({ requiredAnnual: 100_000, guaranteed: 89_000 }))
    expect(card?.id).toBe('income-floor-funded')
    expect(card?.category).toBe('longevity-insurance-geography')
    expect(card?.severity).toBe('attention')
    expect(card?.action).toEqual({ kind: 'advisory' })
    expect(card?.title).toBe('Your essential-spending floor is 89% funded')
    expect(card?.evidence[0]).toEqual({ label: 'Funded ratio', value: '89.0%' })
  })

  it('stays silent at the 90% boundary', () => {
    expect(incomeFloorFunded.screen(context({ requiredAnnual: 100_000, guaranteed: 90_000 }))).toBeNull()
  })

  it('stays silent until the household distinguishes a required floor', () => {
    // Without requiredAnnual the floor equals the whole lifestyle and the card
    // would only restate the success rate — the module's own reasoning.
    const ctx = context({ guaranteed: 0 })
    expect(ctx.plan.expenses.requiredAnnual).toBeUndefined()
    expect(incomeFloorFunded.screen(ctx)).toBeNull()
  })

  it('stays silent when there is nothing to measure', () => {
    // No projection years, and a zero floor: computeFundedRatio returns null in
    // both cases, which is the detector's missing-data refusal.
    expect(incomeFloorFunded.screen(context({ requiredAnnual: 100_000, years: 0 }))).toBeNull()
    expect(
      incomeFloorFunded.screen(context({ requiredAnnual: 100_000, requiredSpending: 0, guaranteed: 0 })),
    ).toBeNull()
  })

  it('stays silent when the household has no members', () => {
    const ctx = context({ requiredAnnual: 100_000 })
    ctx.plan.household.people = []
    expect(incomeFloorFunded.screen(ctx)).toBeNull()
  })

  it('counts the floor only from the retirement year on', () => {
    // "Count essential spending only from this year on (typically the
    // retirement year): pre-retirement spending is funded by wages."
    // Retiring at 68 (born 1961) starts the window in 2029, so the first three
    // fixture years are excluded and the reported window shrinks.
    const ctx = context({ requiredAnnual: 100_000, retirementAge: 68 })
    ctx.projection.result.years = ctx.projection.result.years.map((year, index) => ({
      ...year,
      // Pre-retirement years carry no guaranteed income at all; if they were
      // counted the ratio would fall below 89% and the assertion below fails.
      incomes: index < 3 ? { socialSecurity: 0, pension: 0, annuity: 0, tipsLadder: 0 } : year.incomes,
    })) as never
    expect(incomeFloorFunded.screen(ctx)?.title).toBe('Your essential-spending floor is 89% funded')
  })
})
