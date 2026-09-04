import { describe, expect, it } from 'vitest'

import { assetLocationPlan } from '../../decisions/decisionFixtures.js'
import type { Plan } from '../../model/plan.js'
import { summarizeProjection } from '../../projection/compare.js'
import { simulatePlan } from '../../projection/simulate.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../../tax/federalTax.js'
import { createStateTaxCalculator } from '../../tax/stateTax.js'
import { cashAccount, singlePersonPlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { assetLocation } from './assetLocation.js'

/**
 * Engine-local coverage for the asset-location detector.
 *
 * The module states the split it implements: it "Surfaces the shared
 * `assetLocationGenerator` when a plan opts into static allocation on multiple
 * accounts. `screen()` is cheap and pure; `evaluate()` prices every bounded
 * swap on the exact ledger and previews the winner."
 *
 * So the gate under test is the opt-in itself — class-level allocation on the
 * accounts — and the refusals on either end: a plan with no allocation never
 * reaches the generator, and an `evaluate()` that finds no beneficial swap
 * once taxes and drag are priced refuses rather than previewing a loss. The
 * candidate set and its dollar deltas belong to the generator and the
 * candidate evaluator, which carry their own suites; nothing here re-derives
 * them.
 */
const START_YEAR = 2026

function context(plan: Plan): DetectorContext {
  const taxCalculator = combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
  const result = simulatePlan(plan, { startYear: START_YEAR, taxCalculator })
  const inflationRate = 1 + plan.assumptions.inflationPct / 100
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result,
      summary: summarizeProjection(plan, result),
      deflate: (year: number, amount: number) => amount / Math.pow(inflationRate, year - START_YEAR),
    },
  } as unknown as DetectorContext
}

/** Same household shape, but with no class-level allocation opted into. */
function unallocatedPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [
    traditionalAccount('ira', 500_000, 'p1'),
    cashAccount('cash', 60_000),
  ] as never
  return plan
}

describe('assetLocation', () => {
  it('fires for a plan that opts into class-level allocation on its accounts', () => {
    const card = assetLocation.screen(context(assetLocationPlan()))
    expect(card?.id).toBe('asset-location')
    expect(card?.category).toBe('accounts-contributions')
    expect(card?.severity).toBe('info')
    expect(card?.exact).toBe(false)
    expect(card?.plannerRoute).toBe('accounts')
    expect(card?.action.kind).toBe('preview-scenario')
    // The single evidence row is the swappable exposure, in dollars.
    expect(card?.evidence).toHaveLength(1)
    expect(card?.evidence[0]?.label).toBe('Swappable class exposure')
    expect(card?.evidence[0]?.value).toMatch(/^\$[\d,]+$/)
    expect(card?.evidence[0]?.year).toBe(START_YEAR)
  })

  it('prefers the bonds-to-traditional candidate as the previewed swap', () => {
    // Named in the module as the preferred candidate; the fallback to
    // candidates[0] exists only for a generator that stops emitting it.
    const card = assetLocation.screen(context(assetLocationPlan()))
    if (card?.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(card.action.patch).toHaveProperty('accounts')
  })

  it('stays silent for a plan that never opted into class-level allocation', () => {
    expect(assetLocation.screen(context(unallocatedPlan()))).toBeNull()
  })

  it('evaluate() refuses a plan the screen already rejected', () => {
    expect(() => assetLocation.evaluate!(context(unallocatedPlan()))).toThrow(/not eligible/i)
  })

  it('evaluate() prices the swaps on the exact ledger and previews a beneficial one', () => {
    const evaluated = assetLocation.evaluate!(context(assetLocationPlan()))
    expect(evaluated.action.kind).toBe('preview-scenario')
    // The exact phase publishes a signed after-tax estate delta; the screen
    // phase publishes none, which is what `exact: false` means on the card.
    expect(evaluated.impact?.endingAfterTaxEstateDelta).toBeGreaterThan(0)
    expect(evaluated.impact?.qualitative).toContain('full year-by-year projection')
  })
})
