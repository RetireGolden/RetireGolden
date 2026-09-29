/**
 * One default Monte Carlo seed for every plan, and the headline options the
 * engine publishes for every host (decision D-MC-DEFAULT-SEED, 2026-09-28).
 */
import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../testing/planFixtures.js'
import { buildLognormalModelConfigForPlan } from './marketModels.js'
import { HEADLINE_MONTE_CARLO_PATH_COUNT, HEADLINE_MONTE_CARLO_RETURN_VOL_PCT, headlineMonteCarloOptions } from './headline.js'
import { guardrailThresholdSeedBasis } from './riskBasedGuardrails.js'
import { DEFAULT_MONTE_CARLO_SEED } from './rng.js'

describe('DEFAULT_MONTE_CARLO_SEED', () => {
  it('is 0x5eeded, 6,221,293: 5 x 16^5 + 14 x 16^4 + 14 x 16^3 + 13 x 16^2 + 14 x 16 + 13', () => {
    expect(DEFAULT_MONTE_CARLO_SEED).toBe(5 * 1_048_576 + 14 * 65_536 + 14 * 4_096 + 13 * 256 + 14 * 16 + 13)
    expect(DEFAULT_MONTE_CARLO_SEED).toBe(6_221_293)
  })
})

describe('headlineMonteCarloOptions', () => {
  it('publishes the default seed, 1,000 paths and the plan\'s lognormal model at 12 percent', () => {
    const plan = singlePersonPlan()
    plan.assumptions.inflationPct = 2.5
    expect(HEADLINE_MONTE_CARLO_PATH_COUNT).toBe(1_000)
    expect(HEADLINE_MONTE_CARLO_RETURN_VOL_PCT).toBe(12)
    expect(headlineMonteCarloOptions(plan, 2026)).toStrictEqual({
      startYear: 2026,
      pathCount: 1_000,
      seed: 6_221_293,
      model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 },
    })
    expect(headlineMonteCarloOptions(plan, 2027, 10_000).pathCount).toBe(10_000)
  })

  it('carries the per-class shocks of a plan with allocated accounts', () => {
    // Review finding M3 (S03): the published model is the plan's own
    // lognormal model, so an allocated plan's class volatilities ride with it.
    const plan = singlePersonPlan()
    plan.accounts = [
      {
        type: 'taxable',
        id: 'brokerage',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 500_000,
        costBasis: 350_000,
        annualContribution: 0,
        allocation: { mode: 'static', rebalancing: 'annual', weights: { usStocks: 60, intlStocks: 0, bonds: 40, cash: 0 } },
      },
    ]
    const options = headlineMonteCarloOptions(plan, 2026)
    expect(options.model).toStrictEqual(buildLognormalModelConfigForPlan(plan, 12))
    expect(options.model.classShocks?.volatilityPctByClass).toBeDefined()
  })

  it('gives a plan and its copy under another id the same options', () => {
    const plan = singlePersonPlan()
    const copy = { ...structuredClone(plan), id: 'a-copy-with-a-new-id' }
    expect(headlineMonteCarloOptions(copy, 2026)).toStrictEqual(headlineMonteCarloOptions(plan, 2026))
  })
})

describe('guardrailThresholdSeedBasis', () => {
  function riskBased(extra: Record<string, number>) {
    const plan = singlePersonPlan()
    plan.expenses.spendingPolicy = { mode: 'riskBasedGuardrails', ...extra }
    return plan
  }

  it('says which draw solved the saved thresholds', () => {
    // No threshold saved, or another policy: nothing to say.
    expect(guardrailThresholdSeedBasis(riskBased({}))).toBeNull()
    expect(guardrailThresholdSeedBasis(singlePersonPlan())).toBeNull()
    // Saved before v6: no stored seed, so the plan-id seed solved them.
    expect(guardrailThresholdSeedBasis(riskBased({ lowerBalanceThresholdPct: 80 }))).toStrictEqual({ basis: 'plan-id' })
    expect(guardrailThresholdSeedBasis(riskBased({ upperBalanceThresholdPct: 150, balanceThresholdSeed: 6_221_293 }))).toStrictEqual({ basis: 'default' })
    expect(guardrailThresholdSeedBasis(riskBased({ lowerBalanceThresholdPct: 80, balanceThresholdSeed: 42 }))).toStrictEqual({ basis: 'other', seed: 42 })
  })
})
