/**
 * The conversion optimizer's first solve on every library example, run the
 * way RetireGolden-MCP's run_optimizer runs it: `optimizePlan(plan, {
 * startYear, taxCalculator })` with the federal-plus-state calculator stack,
 * whose `schedule` the tool returns whole (decision
 * D-OPTIMIZER-SOLVER-OUTPUT). The engine cannot import the example library,
 * so this guard lives here.
 *
 * It pins three things and no figure:
 * - each example's solve status (rmd-irmaa is the one that stops at the node
 *   limit, deterministically, where it used to stop at a machine-dependent
 *   time limit);
 * - what a solve with no solution publishes: null figures, an empty schedule,
 *   and the plan's own projection's depletion year beside them;
 * - the rule, observed on these examples and not assumed by the engine's
 *   code, that a first solve has no solution exactly when the projection
 *   depletes.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { optimizePlan } from '@retiregolden/engine/projection/optimizePlan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { EXAMPLE_FIXED_YEAR } from './buildContext'
import { EXAMPLE_PLANS } from './registry'

/** RetireGolden-MCP's taxCalc (src/adapter.ts): federal plus the plan's state. */
function options(plan: Plan) {
  return {
    startYear: EXAMPLE_FIXED_YEAR,
    taxCalculator: combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({
        overridePct: plan.assumptions.stateEffectiveTaxPct,
        localPct: plan.assumptions.localIncomeTaxPct,
      }),
    ),
  }
}

const EXPECTED_STATUS: Record<string, OptimizedSchedule['status']> = {
  'example-couple': 'optimal',
  'under-saved-single': 'infeasible',
  'bracket-fill-roth': 'optimal',
  'early-retiree-aca': 'optimal',
  'rmd-irmaa': 'node-limit',
  'inherited-ira-beneficiary': 'infeasible',
  'survivor-years': 'infeasible',
  'moving-state-tax': 'optimal',
  'ltc-shock': 'infeasible',
  'early-career-match': 'optimal',
  'aggressive-saver': 'optimal',
  'coast-fire': 'optimal',
  'barista-fire': 'optimal',
  'bridge-early-retirement': 'optimal',
  'lean-fat-fire': 'optimal',
  'hsa-stealth-retirement': 'optimal',
  'salary-growth-escalation': 'optimal',
  'guardrails-flex-goals': 'infeasible',
  'annuity-purchases-estate': 'optimal',
  'glidepath-allocation': 'optimal',
  'hsa-property-depth': 'infeasible',
  'fixed-target-spending': 'infeasible',
  'no-annuity-brokerage': 'optimal',
  'static-allocation-control': 'optimal',
  'brokerage-no-hsa': 'infeasible',
  'all-401k-no-bridge': 'infeasible',
  'brokerage-bridge-401k': 'infeasible',
  'no-head-start-grad': 'optimal',
  'trump-account-head-start': 'optimal',
}

describe("the optimizer's first solve on each library example, as RetireGolden-MCP runs it", () => {
  it('covers every example in the library', () => {
    expect(EXAMPLE_PLANS.map((example) => example.id).sort()).toEqual(Object.keys(EXPECTED_STATUS).sort())
  })

  for (const example of EXAMPLE_PLANS) {
    it(
      `${example.id}: ${EXPECTED_STATUS[example.id] ?? 'unlisted'}`,
      async () => {
        const plan = example.build()
        const { schedule } = await optimizePlan(plan, options(plan))
        const projection = simulatePlan(plan, options(plan))
        expect(schedule.status).toBe(EXPECTED_STATUS[example.id])

        const noSolution = schedule.endingAfterTax === null
        // The rule: no solution exactly when the projection depletes.
        expect(noSolution, `projection depletes in ${projection.depletionYear}`).toBe(projection.depletionYear !== null)
        if (noSolution) {
          expect(schedule.lifetimeTax).toBeNull()
          expect(schedule.schedule).toEqual([])
          expect(schedule.conversions).toEqual([])
          expect(schedule.conversionTotal).toBe(0)
          expect(schedule.projectionDepletionYear).toBe(projection.depletionYear)
        } else {
          expect(schedule.lifetimeTax).not.toBeNull()
          expect(schedule.schedule).toHaveLength(projection.years.length)
          expect('projectionDepletionYear' in schedule).toBe(false)
        }
      },
      // rmd-irmaa's solve runs to its 5,000-node limit, about 8 s here; the
      // cap leaves room for a slower runner without letting a hang through.
      300_000,
    )
  }
})
