import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { spendingGuardrails } from './spendingGuardrails.js'

/**
 * Engine-local coverage for the spending-guardrails detector.
 *
 * The module states its gates in the code it guards: "Any active guardrail
 * policy (withdrawal-rate or risk-based) means the plan already has dynamic
 * spending rules — nothing to recommend", and the screen constant carries its
 * own sentence: "below this first-year investable balance a guardrail policy
 * has too little portfolio to steer, so the card only fires on a plan that
 * already depletes" ($100,000). Both sides of that balance gate are fixtured,
 * as is the depletion escape hatch that overrides it.
 *
 * The floor dollars and the guardrail policy itself come from the shared
 * `probabilityBandSpendingGuardrailGenerator`, which owns that arithmetic and
 * its own tests; this suite asserts which plan shapes reach the card and that
 * the evidence labels the floor honestly when the user never supplied one.
 */
const START_YEAR = 2026

function context(
  opts: {
    investableTotal?: number
    depletionYear?: number | null
    spendingPolicyMode?: string
    requiredAnnual?: number
    baseAnnual?: number
    noYears?: boolean
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.baseAnnual = opts.baseAnnual ?? 60_000
  if (opts.requiredAnnual !== undefined) plan.expenses.requiredAnnual = opts.requiredAnnual
  if (opts.spendingPolicyMode !== undefined) {
    plan.expenses.spendingPolicy = { mode: opts.spendingPolicyMode } as never
  }
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result: {
        years: opts.noYears === true
          ? []
          : [{ year: START_YEAR, investableTotal: opts.investableTotal ?? 800_000 }],
      },
      summary: { depletionYear: opts.depletionYear ?? null },
      deflate: (_year: number, amount: number) => amount,
    },
  } as unknown as DetectorContext
}

describe('spendingGuardrails', () => {
  it('fires on a fixed-spending plan with a portfolio to steer', () => {
    const card = spendingGuardrails.screen(context())
    expect(card?.id).toBe('spending-guardrails')
    expect(card?.category).toBe('sequence-risk')
    expect(card?.severity).toBe('info')
    expect(card?.plannerRoute).toBe('spending')
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(card.action.scenarioName).toBe('Dynamic spending guardrails')
    const patch = card.action.patch as { expenses: { spendingPolicy: { mode: string } } }
    expect(patch.expenses.spendingPolicy.mode).toBe('withdrawalRateGuardrails')
    expect(card.evidence).toContainEqual({
      label: 'Investable assets',
      value: '$800,000',
      year: START_YEAR,
    })
  })

  it('labels a scenario-generated floor as illustrative, and a user floor as required', () => {
    // The user never said what "essential" means, so the card must not present
    // the generator's 80%-of-base stand-in as the household's own number.
    const generated = spendingGuardrails.screen(context())
    expect(generated?.evidence[0]?.label).toBe(
      'Illustrative spending floor (80% of base spending, scenario-generated)',
    )
    const declared = spendingGuardrails.screen(context({ requiredAnnual: 40_000 }))
    expect(declared?.evidence[0]).toEqual({
      label: 'Required spending floor',
      value: '$40,000',
      year: START_YEAR,
    })
  })

  it('raises severity and reports the depletion year when the plan runs dry', () => {
    const card = spendingGuardrails.screen(context({ depletionYear: 2050 }))
    expect(card?.severity).toBe('attention')
    expect(card?.evidence).toContainEqual({
      label: 'Projected depletion year',
      value: '2050',
      year: 2050,
    })
  })

  it('holds the $100,000 investable gate on both sides for a plan that never depletes', () => {
    expect(spendingGuardrails.screen(context({ investableTotal: 100_001 }))?.id).toBe('spending-guardrails')
    expect(spendingGuardrails.screen(context({ investableTotal: 100_000 }))).toBeNull()
  })

  it('still fires below that gate when the plan depletes', () => {
    // A depleting plan is exactly the one guardrails exist for, however small.
    expect(
      spendingGuardrails.screen(context({ investableTotal: 1_000, depletionYear: 2040 }))?.id,
    ).toBe('spending-guardrails')
  })

  it('stays silent when the plan already runs a dynamic spending policy', () => {
    expect(spendingGuardrails.screen(context({ spendingPolicyMode: 'withdrawalRateGuardrails' }))).toBeNull()
    expect(spendingGuardrails.screen(context({ spendingPolicyMode: 'abw' }))).toBeNull()
    expect(spendingGuardrails.screen(context({ spendingPolicyMode: 'fixedTarget' }))?.id).toBe(
      'spending-guardrails',
    )
  })

  it('stays silent when there is no first projection year and when there is no spending to steer', () => {
    expect(spendingGuardrails.screen(context({ noYears: true }))).toBeNull()
    // With no base spending the generator produces no candidate at all.
    expect(spendingGuardrails.screen(context({ baseAnnual: 0 }))).toBeNull()
  })

  it('evaluate() refuses an ineligible plan and keeps the screened success delta', () => {
    expect(() => spendingGuardrails.evaluate!(context({ noYears: true }))).toThrow(/not eligible/i)
    const ctx = context()
    const evaluated = spendingGuardrails.evaluate!(ctx)
    expect(evaluated.impact?.successRateDeltaPct).toBe(
      spendingGuardrails.screen(ctx)!.impact.successRateDeltaPct,
    )
  })
})
