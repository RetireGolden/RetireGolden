import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'

vi.mock('../../projection/relocation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../projection/relocation.js')>()
  return {
    ...original,
    compareRelocationCandidates: vi.fn(original.compareRelocationCandidates),
  }
})

import { compareRelocationCandidates } from '../../projection/relocation.js'
import { stateRelocation } from './stateRelocation.js'

/**
 * Engine-local coverage for the state-relocation detector, driven from the
 * conditions its header states: "`screen()` keeps its original cheap
 * conditions: a taxed state, no planned moves", and the in-body policy note
 * that "Unknown states price as $0 state tax in the ledger; stay silent rather
 * than assert an income tax the engine does not charge".
 *
 * `evaluate()` coverage stubs only the relocation-compare producer; savings
 * are hand-summed from the controlled per-year state-tax rows and inflation
 * deflator, not recomputed from state statutes.
 */
const START_YEAR = 2026

const mockedCompare = vi.mocked(compareRelocationCandidates)

function context(
  opts: {
    state?: string
    overridePct?: number
    moves?: unknown[]
    deflate?: (year: number, amount: number) => number
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', state: opts.state ?? 'KY' })
  plan.assumptions.stateEffectiveTaxPct = opts.overridePct ?? 0
  plan.accounts = [cashAccount('cash', 200_000)] as never
  if (opts.moves !== undefined) plan.household.stateMoves = opts.moves as never
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result: { years: [] },
      deflate: opts.deflate ?? ((_year: number, amount: number) => amount),
    },
  } as unknown as DetectorContext
}

describe('stateRelocation', () => {
  beforeEach(() => {
    mockedCompare.mockReset()
  })

  it('fires for a taxed state with no relocation modeled', () => {
    const card = stateRelocation.screen(context({ state: 'KY' }))
    expect(card?.id).toBe('state-relocation')
    expect(card?.category).toBe('longevity-insurance-geography')
    expect(card?.severity).toBe('info')
    expect(card?.plannerRoute).toBe('relocation')
    expect(card?.action.kind).toBe('preview-scenario')
    // Copy stays neutral: income tax is one factor, never a recommendation.
    expect(card?.rationale).toMatch(/nothing here says you should move/i)
    expect(card?.evidence.map((e) => e.label)).toEqual([
      'Current state',
      'KY top statutory income-tax rate',
    ])
  })

  it('stays silent in a state the engine models as levying no income tax', () => {
    expect(stateRelocation.screen(context({ state: 'TX' }))).toBeNull()
    expect(stateRelocation.screen(context({ state: 'WA' }))).toBeNull()
  })

  it('stays silent for an unmodeled state rather than asserting a tax the ledger never charges', () => {
    // The ledger prices an unknown state at $0; the detector must not claim an
    // income tax it does not model (GOVERNANCE false-positive policy).
    expect(stateRelocation.screen(context({ state: 'ZZ' }))).toBeNull()
  })

  it('fires on a modeled flat override even in an untaxed state, and names the override', () => {
    const card = stateRelocation.screen(context({ state: 'TX', overridePct: 5 }))
    expect(card?.id).toBe('state-relocation')
    expect(card?.evidence).toContainEqual({
      label: 'Modeled state income-tax override',
      value: '5.0%',
      year: 2026,
    })
    expect(card?.evidence[0]).toEqual({
      label: 'Current state',
      value: 'TX (5.0% modeled override)',
      year: 2026,
    })
  })

  it('formats a sub-tenth override to one significant figure', () => {
    const card = stateRelocation.screen(context({ state: 'TX', overridePct: 0.05 }))
    expect(card?.evidence).toContainEqual({
      label: 'Modeled state income-tax override',
      value: '0.05%',
      year: 2026,
    })
  })

  it('stays silent in Florida even with a modeled override', () => {
    // The destination the preview patch itself proposes: suggesting a move
    // away from FL to FL would be incoherent.
    expect(stateRelocation.screen(context({ state: 'FL', overridePct: 5 }))).toBeNull()
  })

  it('stays silent once the plan already models a move', () => {
    expect(
      stateRelocation.screen(context({ state: 'KY', moves: [{ year: 2030, state: 'FL' }] })),
    ).toBeNull()
    // An empty move list is not a modeled move.
    expect(stateRelocation.screen(context({ state: 'KY', moves: [] }))?.id).toBe('state-relocation')
  })

  it('evaluate() refuses an ineligible plan', () => {
    expect(() => stateRelocation.evaluate!(context({ state: 'TX' }))).toThrow(/not eligible/i)
  })

  it('evaluate() ranks by lifetime taxes but reports deflated state-tax savings', () => {
    // Worksheet (today's dollars) against the nominal winner FL:
    //   2026 delta: 3,000 - 5,000 = -2,000; deflator 1.0 -> -2,000
    //   2027 delta: 3,600 - 6,000 = -2,400; deflator 0.5 -> -1,200
    //   lifetimeStateTaxDeltaToday = -3,200; savings = max(0, 3,200) = 3,200
    // TX has lower state/local tax (5,500 vs 6,600; per-year 2,500/3,000 vs
    // 3,000/3,600) so deflated savings vs baseline would be 4,000, but nominal
    // lifetimeTaxesAndPenalties still picks FL (400k) over TX (450k).
    const baselineTaxes = [
      { year: 2026, tax: 5_000 },
      { year: 2027, tax: 6_000 },
    ]
    const flTaxes = [
      { year: 2026, tax: 3_000 },
      { year: 2027, tax: 3_600 },
    ]
    const txTaxes = [
      { year: 2026, tax: 2_500 },
      { year: 2027, tax: 3_000 },
    ]
    const flLifetimeStateLocalTax = 6_600
    const txLifetimeStateLocalTax = 5_500
    const flLifetimeTaxesAndPenalties = 400_000
    const txLifetimeTaxesAndPenalties = 450_000

    // Opposing rankings: TX wins on state/local tax, FL wins on nominal lifetime total.
    expect(txLifetimeStateLocalTax).toBeLessThan(flLifetimeStateLocalTax)
    expect(txTaxes[0]!.tax).toBeLessThan(flTaxes[0]!.tax)
    expect(txTaxes[1]!.tax).toBeLessThan(flTaxes[1]!.tax)
    expect(txLifetimeTaxesAndPenalties).toBeGreaterThan(flLifetimeTaxesAndPenalties)

    mockedCompare.mockReturnValue({
      startYear: START_YEAR,
      rows: [
        {
          id: 'baseline',
          label: 'Stay in KY',
          candidate: null,
          error: null,
          destinationState: 'KY',
          modeled: true,
          lifetimeStateLocalTax: 11_000,
          lifetimeTaxesAndPenalties: 500_000,
          endingAfterTaxEstate: 800_000,
          endingNetWorth: 800_000,
          depletionYear: null,
          endYear: START_YEAR + 30,
          successRate: null,
          drivers: null,
          stateTaxByYear: baselineTaxes,
          warnings: [],
        },
        {
          id: 'candidate-0',
          label: 'Move to FL',
          candidate: { state: 'FL', moveYear: START_YEAR },
          error: null,
          destinationState: 'FL',
          modeled: true,
          lifetimeStateLocalTax: flLifetimeStateLocalTax,
          lifetimeTaxesAndPenalties: flLifetimeTaxesAndPenalties,
          endingAfterTaxEstate: 850_000,
          endingNetWorth: 850_000,
          depletionYear: null,
          endYear: START_YEAR + 30,
          successRate: null,
          drivers: null,
          stateTaxByYear: flTaxes,
          warnings: [],
        },
        {
          id: 'candidate-1',
          label: 'Move to TX',
          candidate: { state: 'TX', moveYear: START_YEAR },
          error: null,
          destinationState: 'TX',
          modeled: true,
          lifetimeStateLocalTax: txLifetimeStateLocalTax,
          lifetimeTaxesAndPenalties: txLifetimeTaxesAndPenalties,
          endingAfterTaxEstate: 840_000,
          endingNetWorth: 840_000,
          depletionYear: null,
          endYear: START_YEAR + 30,
          successRate: null,
          drivers: null,
          stateTaxByYear: txTaxes,
          warnings: [],
        },
        {
          id: 'candidate-2',
          label: 'Move to WA',
          candidate: { state: 'WA', moveYear: START_YEAR },
          error: 'invalid candidate',
          destinationState: 'WA',
          modeled: false,
          lifetimeStateLocalTax: 0,
          lifetimeTaxesAndPenalties: 0,
          endingAfterTaxEstate: 0,
          endingNetWorth: 0,
          depletionYear: null,
          endYear: START_YEAR,
          successRate: null,
          drivers: null,
          stateTaxByYear: [],
          warnings: [],
        },
      ],
      monteCarlo: null,
    })

    const screenCard = stateRelocation.screen(context({ state: 'KY' }))
    const result = stateRelocation.evaluate!(
      context({
        state: 'KY',
        deflate: (year, amount) => (year === 2027 ? amount * 0.5 : amount),
      }),
    )

    expect(mockedCompare).toHaveBeenCalledOnce()
    expect(result.action.kind).toBe('preview-scenario')
    if (result.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    // FL is selected even though TX has lower state/local tax — selection follows
    // lifetimeTaxesAndPenalties, not deflated state-tax savings (TX would show ~$4,000).
    expect(result.action.scenarioName).toBe('Relocate to FL (illustrative)')
    if (!screenCard) throw new Error('expected screen card')
    if (screenCard.action.kind !== 'preview-scenario') throw new Error('expected screen preview scenario')
    expect(result.action.patch).toEqual(screenCard.action.patch)
    if (!result.impact) throw new Error('expected evaluate() to publish impact')
    expect(result.impact.qualitative).toContain('$3,200')
    expect(result.impact.qualitative).toContain('vs FL')
    expect(result.impact.qualitative).not.toContain('$4,000')
    expect(result.impact.qualitative).not.toBe(screenCard.impact.qualitative)
  })

  it('evaluate() clamps reported savings at zero when the best candidate costs more state tax', () => {
    mockedCompare.mockReturnValue({
      startYear: START_YEAR,
      rows: [
        {
          id: 'baseline',
          label: 'Stay in KY',
          candidate: null,
          error: null,
          destinationState: 'KY',
          modeled: true,
          lifetimeStateLocalTax: 5_000,
          lifetimeTaxesAndPenalties: 300_000,
          endingAfterTaxEstate: 700_000,
          endingNetWorth: 700_000,
          depletionYear: null,
          endYear: START_YEAR + 30,
          successRate: null,
          drivers: null,
          stateTaxByYear: [{ year: 2026, tax: 5_000 }],
          warnings: [],
        },
        {
          id: 'candidate-0',
          label: 'Move to FL',
          candidate: { state: 'FL', moveYear: START_YEAR },
          error: null,
          destinationState: 'FL',
          modeled: true,
          lifetimeStateLocalTax: 6_000,
          lifetimeTaxesAndPenalties: 250_000,
          endingAfterTaxEstate: 710_000,
          endingNetWorth: 710_000,
          depletionYear: null,
          endYear: START_YEAR + 30,
          successRate: null,
          drivers: null,
          stateTaxByYear: [{ year: 2026, tax: 6_000 }],
          warnings: [],
        },
      ],
      monteCarlo: null,
    })

    const result = stateRelocation.evaluate!(context({ state: 'KY' }))
    if (!result.impact) throw new Error('expected evaluate() to publish impact')
    expect(result.impact.qualitative).toContain('$0')
  })
})
