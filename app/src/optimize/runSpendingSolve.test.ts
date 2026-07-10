/**
 * "How much can I spend?" executor tests (sustainable-spending plan, Step 4
 * acceptance): the surface's result matches a direct engine call, is
 * deterministic across reruns, and enforces the plan's bequest target.
 */

import { describe, expect, it } from 'vitest'

import {
  createDecisionContext,
  solveMaxSustainableSpending,
  SPENDING_SOLVER_UI_BUDGET,
} from '../engine/decisions'
import { noTraditionalPlan } from '../engine/decisions/decisionFixtures'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'
import { runSpendingSolveRequest } from './runSpendingSolve'

describe('runSpendingSolveRequest', () => {
  it('matches a direct engine call and is deterministic across reruns', () => {
    const plan = noTraditionalPlan()
    const first = runSpendingSolveRequest({ plan, startYear: 2026 })
    const second = runSpendingSolveRequest({ plan, startYear: 2026 })
    expect(second).toEqual(first)

    // Same tax stack the executor builds — the answers must agree exactly.
    const taxCalculator = combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({
        overridePct: plan.assumptions.stateEffectiveTaxPct,
        localPct: plan.assumptions.localIncomeTaxPct,
      }),
    )
    const direct = solveMaxSustainableSpending(createDecisionContext(plan, { startYear: 2026, taxCalculator }), {
      maxSimulations: SPENDING_SOLVER_UI_BUDGET,
    })
    expect(first.maxBaseAnnual).toBe(direct.maxBaseAnnual)
    expect(first.simulationCount).toBe(direct.simulationCount)
    expect(first.currentBaseAnnual).toBe(plan.expenses.baseAnnual)
    expect(first.evidence).not.toBeNull()
    expect(first.evidence!.depletionYear).toBeNull()
  })

  it('enforces the plan bequest target as the estate floor', () => {
    const plan = noTraditionalPlan()
    const noTarget = runSpendingSolveRequest({ plan, startYear: 2026 })
    const withTarget = { ...plan, expenses: { ...plan.expenses, bequestTargetDollars: 300_000 } }
    const solved = runSpendingSolveRequest({ plan: withTarget, startYear: 2026 })

    expect(solved.estateFloorTodayDollars).toBe(300_000)
    expect(solved.maxBaseAnnual!).toBeLessThanOrEqual(noTarget.maxBaseAnnual!)
    expect(solved.limitingConstraint).toBe('estate-floor')
    // Fixture inflation is 0%, so the today's-dollar floor is the nominal floor.
    expect(solved.evidence!.endingAfterTaxEstate).toBeGreaterThanOrEqual(300_000)
  })
})
