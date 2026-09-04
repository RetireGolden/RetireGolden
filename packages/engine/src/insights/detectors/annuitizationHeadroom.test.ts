import { describe, expect, it } from 'vitest'

import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { annuitizationHeadroom } from './annuitizationHeadroom.js'

/**
 * Engine-local coverage for the annuitization-headroom detector, driven from
 * the conditions the module itself states rather than from its arithmetic.
 *
 * The header names three gates — "longevity-anxious plans (a planning age of
 * 95+) with meaningful liquid savings, no annuity on the books, and no pension
 * income covering the same ground" — and the constant comment names the liquid
 * floor: "Below this, the largest liquid account cannot fund a meaningful
 * SPIA" ($100,000). Both numeric gates are fixtured on both sides, so a drift
 * in either direction fails rather than only a loosening.
 *
 * Nothing here asserts a premium or payout dollar figure: the SPIA quote comes
 * from `spiaPayoutRate`, whose own coverage lives with that module, and this
 * suite would otherwise be pinning the detector's arithmetic to itself.
 */
function context(
  opts: { planningAge?: number; liquid?: number; extraAccounts?: unknown[]; noPeople?: boolean } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: opts.planningAge ?? 95 })
  plan.accounts = [cashAccount('cash', opts.liquid ?? 400_000), ...(opts.extraAccounts ?? [])] as never
  if (opts.noPeople === true) plan.household.people = []
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

const ownedAnnuity = {
  type: 'annuity',
  id: 'spia',
  name: 'Owned SPIA',
  ownerPersonId: 'p1',
  annualReturnPct: null,
  startAge: 65,
  monthlyAmount: 1_000,
  colaPct: 0,
  taxablePct: 100,
}

function pension(extra: Record<string, unknown> = {}): unknown {
  return {
    type: 'pension',
    id: 'pen',
    name: 'Pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 1_500,
    colaPct: 0,
    survivorPct: 0,
    ...extra,
  }
}

describe('annuitizationHeadroom', () => {
  it('fires for a planning age of 95 and stays silent one year below it', () => {
    // "a planning age of 95+" — 95 is inside the stated gate, 94 is outside.
    const card = annuitizationHeadroom.screen(context({ planningAge: 95 }))
    expect(card?.id).toBe('annuitization-headroom')
    expect(card?.category).toBe('longevity-insurance-geography')
    expect(card?.severity).toBe('info')
    expect(card?.exact).toBe(false)
    expect(card?.evidence[0]).toEqual({ label: 'Planning age', value: '95' })
    expect(card?.action.kind).toBe('preview-scenario')

    expect(annuitizationHeadroom.screen(context({ planningAge: 94 }))).toBeNull()
  })

  it('reports the largest liquid account as the funding source', () => {
    const ctx = context({ liquid: 400_000 })
    ctx.plan.accounts = [
      cashAccount('small', 120_000),
      cashAccount('big', 400_000),
    ] as never
    const card = annuitizationHeadroom.screen(ctx)
    // The evidence value echoes the plan's own input, not a derived figure.
    expect(card?.evidence).toContainEqual({
      label: 'Largest liquid account balance (SPIA funding source)',
      value: '$400,000',
      year: 2026,
    })
  })

  it('holds the $100,000 liquid floor on both sides', () => {
    expect(annuitizationHeadroom.screen(context({ liquid: 100_000 }))?.id).toBe('annuitization-headroom')
    expect(annuitizationHeadroom.screen(context({ liquid: 99_999 }))).toBeNull()
  })

  it('stays silent when the household already holds lifetime income beyond Social Security', () => {
    expect(annuitizationHeadroom.screen(context({ extraAccounts: [ownedAnnuity] }))).toBeNull()
    expect(annuitizationHeadroom.screen(context({ extraAccounts: [pension()] }))).toBeNull()
  })

  it('still fires when the pension on the books is being taken as a lump sum', () => {
    // A pension elected as a lump sum stops being "pension income covering the
    // same ground", so the headroom is unused again.
    const withElection = pension({ lumpSumElection: { rolloverAccountId: 'ira' } })
    expect(annuitizationHeadroom.screen(context({ extraAccounts: [withElection] }))?.id).toBe(
      'annuitization-headroom',
    )
  })

  it('stays silent with no liquid account at all', () => {
    const ctx = context()
    ctx.plan.accounts = [] as never
    expect(annuitizationHeadroom.screen(ctx)).toBeNull()
  })

  it('stays silent when the household has no members to plan for', () => {
    expect(annuitizationHeadroom.screen(context({ noPeople: true }))).toBeNull()
  })

  it('evaluate() refuses an ineligible plan and mirrors the screened card otherwise', () => {
    expect(() => annuitizationHeadroom.evaluate!(context({ planningAge: 94 }))).toThrow(
      /not eligible/i,
    )
    const ctx = context()
    const card = annuitizationHeadroom.screen(ctx)!
    expect(annuitizationHeadroom.evaluate!(ctx)).toEqual({ action: card.action, impact: card.impact })
  })
})
