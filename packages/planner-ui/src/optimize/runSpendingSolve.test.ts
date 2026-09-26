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
} from '@retiregolden/engine/decisions'
import { noTraditionalPlan } from '@retiregolden/engine/testing/decisionFixtures'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { taxCalculatorFor } from '../planTaxCalculator'
import { runSpendingSolveRequest } from './runSpendingSolve'

describe('runSpendingSolveRequest', () => {
  it('matches a direct engine call and is deterministic across reruns', () => {
    const fixture = noTraditionalPlan()
    const plan = {
      ...fixture,
      assumptions: {
        ...fixture.assumptions,
        stateEffectiveTaxPct: 6.25,
        localIncomeTaxPct: 1.5,
      },
    }
    const first = runSpendingSolveRequest({ plan, startYear: 2026 })
    const second = runSpendingSolveRequest({ plan, startYear: 2026 })
    expect(second).toEqual(first)

    // Same tax stack the executor builds — the answers must agree exactly.
    // Construct this independently from the helper used by the executor, so
    // nonzero state and local override drift cannot agree by construction.
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

  it('answers a plan whose Marketplace credit is unpriced and carries the years and reasons', () => {
    // Pre-65 with the credit box on and no year contract, as the standard
    // editor saves it: every Marketplace year pays its full premium.
    const fixture = noTraditionalPlan()
    const plan = {
      ...fixture,
      household: { ...fixture.household, people: [{ ...fixture.household.people[0]!, dob: '1964-06-15' }] },
      expenses: {
        ...fixture.expenses,
        healthcare: { ...fixture.expenses.healthcare, pre65MonthlyPremiumPerPerson: 800, applyAcaCredit: true },
      },
    }
    const solved = runSpendingSolveRequest({ plan, startYear: 2026 })
    const direct = solveMaxSustainableSpending(
      createDecisionContext(plan, { startYear: 2026, taxCalculator: taxCalculatorFor(plan) }),
      { maxSimulations: SPENDING_SOLVER_UI_BUDGET },
    )

    expect(solved.maxBaseAnnual).not.toBeNull()
    expect(solved.maxBaseAnnual).toBe(direct.maxBaseAnnual)
    expect(solved.acaGrossPremiumYears.length).toBeGreaterThan(0)
    expect(solved.acaGrossPremiumYears).toEqual(direct.acaGrossPremiumYears)
    expect(solved.acaGrossPremiumReasons).toContain('missing-year-contract')
    expect(solved.acaGrossPremiumReasons).toEqual(direct.acaGrossPremiumReasons)
  })
})
