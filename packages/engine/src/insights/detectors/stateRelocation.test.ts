import { describe, expect, it } from 'vitest'

import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { stateRelocation } from './stateRelocation.js'

/**
 * Engine-local coverage for the state-relocation detector, driven from the
 * conditions its header states: "`screen()` keeps its original cheap
 * conditions: a taxed state, no planned moves", and the in-body policy note
 * that "Unknown states price as $0 state tax in the ledger; stay silent rather
 * than assert an income tax the engine does not charge".
 *
 * No dollar figure is asserted: `screen()` publishes none, and the lifetime
 * drag it can quantify is `evaluate()`'s job against the relocation sweep.
 */
function context(opts: { state?: string; overridePct?: number; moves?: unknown[] } = {}): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01', state: opts.state ?? 'KY' })
  plan.assumptions.stateEffectiveTaxPct = opts.overridePct ?? 0
  plan.accounts = [cashAccount('cash', 200_000)] as never
  if (opts.moves !== undefined) plan.household.stateMoves = opts.moves as never
  return {
    plan,
    params: { year: 2026 },
    projection: { startYear: 2026, result: { years: [] } },
  } as unknown as DetectorContext
}

describe('stateRelocation', () => {
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
})
