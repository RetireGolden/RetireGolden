import { describe, expect, it } from 'vitest'

import { couplePlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { widowsPenalty } from './widowsPenalty.js'

/**
 * Engine-local coverage for the widow's-penalty detector.
 *
 * The module states its gate: it "screens trad-heavy MFJ couples without
 * conversions", quantifies the jump "on the plan's own first single-FILED
 * survivor year", narrates rather than prices the qualifying-surviving-spouse
 * interlude ("QSS interlude years keep the joint tables and are narrated, not
 * priced"), and "flags survivor-year IRMAA tiers with an SSA-44 pointer when
 * the plan isn't modeling the relief".
 *
 * Each of those clauses gets a fixture, including both sides of the $50,000
 * traditional-balance gate the screen ships with. No dollar figure of the
 * bracket jump itself is asserted: that number is `computeFederalTax` priced
 * twice, and its correctness belongs to the federal-tax oracle suites. What is
 * asserted here is which year the jump is measured in, and that the QSS
 * interlude is not the year that gets priced.
 */
const START_YEAR = 2026

interface YearSpec {
  year: number
  alive: number
  filingStatus: string
  magi?: number
  irmaaTier?: number
}

function projectionYear(spec: YearSpec): unknown {
  const people = [
    { personId: 'p1', alive: true, ageAttained: spec.year - 1960 },
    { personId: 'p2', alive: spec.alive === 2, ageAttained: spec.year - 1958 },
  ]
  return {
    year: spec.year,
    filingStatus: spec.filingStatus,
    magi: spec.magi ?? 0,
    irmaaTier: spec.irmaaTier ?? 0,
    people,
    balances: { trad: 600_000 },
  }
}

/** Death projected in 2027; the survivor files Single from 2028 by default. */
const DEFAULT_YEARS: YearSpec[] = [
  { year: 2026, alive: 2, filingStatus: 'marriedFilingJointly' },
  { year: 2027, alive: 2, filingStatus: 'marriedFilingJointly' },
  { year: 2028, alive: 1, filingStatus: 'single', magi: 120_000 },
  { year: 2029, alive: 1, filingStatus: 'single', magi: 120_000 },
]

function context(
  opts: {
    years?: YearSpec[]
    tradBalance?: number
    filingStatus?: string
    conversionMode?: string
    ssa44SurvivorYears?: boolean
  } = {},
): DetectorContext {
  const plan = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1958-01-01' })
  plan.accounts = [traditionalAccount('trad', 600_000, 'p1')] as never
  if (opts.filingStatus !== undefined) plan.household.filingStatus = opts.filingStatus as never
  if (opts.conversionMode !== undefined) {
    plan.strategies.rothConversion = { mode: opts.conversionMode } as never
  }
  if (opts.ssa44SurvivorYears !== undefined) {
    plan.expenses.healthcare = {
      ...plan.expenses.healthcare,
      ssa44: { survivorYears: opts.ssa44SurvivorYears },
    } as never
  }
  const years = (opts.years ?? DEFAULT_YEARS).map((spec) => {
    const row = projectionYear(spec) as { balances: Record<string, number> }
    if (opts.tradBalance !== undefined) row.balances = { trad: opts.tradBalance }
    return row
  })
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result: { years },
      deflate: (_year: number, amount: number) => amount,
    },
  } as unknown as DetectorContext
}

describe('widowsPenalty', () => {
  it('fires for a trad-heavy MFJ couple with a survivor year in the projection', () => {
    const card = widowsPenalty.screen(context())
    expect(card?.id).toBe('widows-penalty-roth')
    expect(card?.category).toBe('social-security')
    expect(card?.severity).toBe('attention')
    expect(card?.confidence).toBe('high')
    expect(card?.evidence).toContainEqual({
      label: 'Traditional account balance',
      value: '$600,000',
      year: START_YEAR,
    })
    expect(card?.evidence).toContainEqual({ label: 'Last joint-filing year', value: '2027', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'First survivor year', value: '2028', year: 2028 })
    // The preview converts through the last joint year, which is the window
    // the card exists to point at.
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    const patch = card.action.patch as {
      strategies: { rothConversion: { startYear: number; endYear: number } }
    }
    expect(patch.strategies.rothConversion).toMatchObject({ startYear: START_YEAR, endYear: 2027 })
  })

  it('prices the jump in the first Single-filed year, not the QSS interlude', () => {
    // A qualifying surviving spouse keeps the joint tables, so those years have
    // no bracket jump to price; the card narrates the interlude and measures
    // the jump in the first year that truly files Single.
    const card = widowsPenalty.screen(
      context({
        years: [
          { year: 2026, alive: 2, filingStatus: 'marriedFilingJointly' },
          { year: 2027, alive: 2, filingStatus: 'marriedFilingJointly' },
          { year: 2028, alive: 1, filingStatus: 'qualifyingSurvivingSpouse', magi: 120_000 },
          { year: 2029, alive: 1, filingStatus: 'qualifyingSurvivingSpouse', magi: 120_000 },
          { year: 2030, alive: 1, filingStatus: 'single', magi: 120_000 },
        ],
      }),
    )
    expect(card?.rationale).toContain('qualifying surviving spouse (joint tables) through 2029')
    expect(card?.rationale).toContain('then as Single from 2030')
    expect(card?.evidence.find((e) => e.label === 'Estimated survivor bracket jump')?.year).toBe(2030)
  })

  it('falls back to the generic bracket narration when the jump is negligible', () => {
    const card = widowsPenalty.screen(
      context({
        years: DEFAULT_YEARS.map((spec) => ({ ...spec, magi: 0 })),
      }),
    )
    expect(card?.rationale).toContain('Single filing cuts tax bracket ceilings in half')
    expect(card?.evidence.map((e) => e.label)).not.toContain('Estimated survivor bracket jump')
  })

  it('points at Form SSA-44 only when a survivor year lands in an IRMAA tier the plan is not relieving', () => {
    const flagged = widowsPenalty.screen(
      context({
        years: DEFAULT_YEARS.map((spec) => (spec.year >= 2028 ? { ...spec, irmaaTier: 2 } : spec)),
      }),
    )
    expect(flagged?.rationale).toContain('Form SSA-44')
    expect(flagged?.rationale).toContain('2028 and 2029')

    const alreadyModeled = widowsPenalty.screen(
      context({
        years: DEFAULT_YEARS.map((spec) => (spec.year >= 2028 ? { ...spec, irmaaTier: 2 } : spec)),
        ssa44SurvivorYears: true,
      }),
    )
    expect(alreadyModeled?.rationale).not.toContain('Form SSA-44')

    // No surcharge tier in the two-year window, nothing to redetermine.
    expect(widowsPenalty.screen(context())?.rationale).not.toContain('Form SSA-44')
  })

  it('stays silent for a household that does not file jointly', () => {
    expect(widowsPenalty.screen(context({ filingStatus: 'single' }))).toBeNull()
  })

  it('stays silent when the plan already converts', () => {
    expect(widowsPenalty.screen(context({ conversionMode: 'fillToTarget' }))).toBeNull()
  })

  it('holds the $50,000 traditional-balance gate on both sides', () => {
    expect(widowsPenalty.screen(context({ tradBalance: 50_000 }))?.id).toBe('widows-penalty-roth')
    expect(widowsPenalty.screen(context({ tradBalance: 49_999 }))).toBeNull()
  })

  it('stays silent when no survivor year is projected, and when there are no years at all', () => {
    expect(
      widowsPenalty.screen(
        context({
          years: [
            { year: 2026, alive: 2, filingStatus: 'marriedFilingJointly' },
            { year: 2027, alive: 2, filingStatus: 'marriedFilingJointly' },
          ],
        }),
      ),
    ).toBeNull()
    expect(widowsPenalty.screen(context({ years: [] }))).toBeNull()
  })

  it('stays silent when the survivor year is the first projected year, leaving no joint window', () => {
    // Nothing to convert during: the conversion window the card previews would
    // end before the projection starts.
    expect(
      widowsPenalty.screen(
        context({
          years: [
            { year: 2026, alive: 1, filingStatus: 'single', magi: 120_000 },
            { year: 2027, alive: 1, filingStatus: 'single', magi: 120_000 },
          ],
        }),
      ),
    ).toBeNull()
  })

  it('evaluate() refuses an ineligible plan and mirrors the screened card otherwise', () => {
    expect(() => widowsPenalty.evaluate!(context({ filingStatus: 'single' }))).toThrow(/not eligible/i)
    const ctx = context()
    const card = widowsPenalty.screen(ctx)!
    expect(widowsPenalty.evaluate!(ctx)).toEqual({ action: card.action, impact: card.impact })
  })
})
