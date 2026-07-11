/**
 * Covers the optimize worker's shared runner (also the sync fallback used when
 * Worker is unavailable, e.g. here in vitest). Confirms it builds the standard
 * tax stack from the plan and returns a solved schedule — the seam the worker
 * and the UI both go through.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '@retiregolden/engine/model/plan'
import { socialSecurityIncome } from '@retiregolden/engine/testing/planFixtures'
import { runOptimizeRequest } from './runOptimize'

let counter = 0
const ids = () => `ro-${++counter}`

function plan(): Plan {
  const p = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 82, source: 'manual' },
  }
  p.assumptions.inflationPct = 0
  p.assumptions.defaultReturnPct = 4
  p.assumptions.stateEffectiveTaxPct = 0
  p.expenses.baseAnnual = 40_000
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.accounts = [
    { type: 'traditional', id: ids(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 } as Account,
    { type: 'roth', id: ids(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
    { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 120_000, annualContribution: 0 } as Account,
  ]
  const r = parsePlan(p)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

/** Younger retiree claiming SS at 62 — gives the claim grid real candidates (67, 70). */
function ssPlan(): Plan {
  const p = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 88, source: 'manual' },
  }
  p.assumptions.inflationPct = 0
  p.assumptions.defaultReturnPct = 4
  p.assumptions.stateEffectiveTaxPct = 0
  p.expenses.baseAnnual = 40_000
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.incomes = [socialSecurityIncome('ss', 2_400, 62)]
  p.accounts = [
    { type: 'traditional', id: ids(), name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 } as Account,
    { type: 'roth', id: ids(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
    { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 250_000, annualContribution: 0 } as Account,
  ]
  const r = parsePlan(p)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('runOptimizeRequest', () => {
  it('solves a plan and returns exact-ledger post-processing (sync fallback)', async () => {
    const result = await runOptimizeRequest({ plan: plan(), startYear: 2026, liquidationRatePct: 25 })
    const { schedule, postProcessed } = result

    expect(schedule.status).toBe('optimal')
    expect(schedule.conversions.reduce((a, c) => a + c.amount, 0)).toBeGreaterThan(0)
    expect(schedule.solveMs).toBeGreaterThanOrEqual(0)
    expect(postProcessed).not.toBeNull()
    expect(postProcessed?.rawSchedule).toEqual(schedule)
    expect(postProcessed?.cleanedSchedule.conversions.reduce((a, c) => a + c.amount, 0)).toBeGreaterThan(0)
    expect(postProcessed?.cleanedValidation.executedConversionRatio).toBeGreaterThan(0)
    expect(postProcessed?.cleanedExecutionByYear.length).toBeGreaterThan(0)
    expect(postProcessed).not.toHaveProperty('rawResult')
    expect(postProcessed).not.toHaveProperty('cleanedResult')

    // The tournament rides along and must be structured-clone safe: summaries
    // and schedules only, never a ProjectionResult.
    const { tournament } = result
    expect(tournament.candidates.length).toBeGreaterThan(0)
    expect(['milp', 'candidate', 'incumbent', 'none']).toContain(tournament.winnerSource)
    expect(Array.isArray(tournament.winnerConversions)).toBe(true)
    expect(tournament).not.toHaveProperty('result')
    expect(() => structuredClone(tournament)).not.toThrow()

    // Claim-age co-optimization is opt-in; a plain request reports null.
    expect(result.claimAge).toBeNull()
  })

  it('co-optimizes the SS claim age when requested and stays structured-clone safe', async () => {
    // Minimal per-run budgets: the claim grid re-runs the full optimize per
    // candidate, so this keeps the test to three cheap solves.
    const result = await runOptimizeRequest({
      plan: ssPlan(),
      startYear: 2026,
      liquidationRatePct: 25,
      coOptimizeClaimAge: true,
      searchSimulationBudget: 0,
      convergenceIterations: 1,
    })

    const claimAge = result.claimAge
    expect(claimAge).not.toBeNull()
    expect(claimAge!.enabled).toBe(true)
    // Current claim 62 → canonical candidates 67 and 70, plus the base run.
    expect(claimAge!.combinationsEvaluated).toBe(3)
    // The joint optimum can never lose to the current-claim floor it's gated on.
    expect(claimAge!.jointExactEstate).toBeGreaterThanOrEqual(claimAge!.currentClaimExactEstate)
    // Label and patch travel together: both null (current claim won) or both set.
    expect(claimAge!.winningClaimPatch === null).toBe(claimAge!.winningClaimLabel === null)
    if (claimAge!.winningClaimPatch) {
      const ss = claimAge!.winningClaimPatch.incomes.find(
        (s): s is Extract<IncomeStream, { type: 'socialSecurity' }> => s.type === 'socialSecurity',
      )
      expect(ss).toBeDefined()
      expect(ss!.claimAge.years).not.toBe(62)
    }
    // The whole result must survive the worker's structured-clone boundary.
    expect(() => structuredClone(result)).not.toThrow()
  })

  it('treats a non-positive search budget as search disabled', async () => {
    const result = await runOptimizeRequest({
      plan: plan(),
      startYear: 2026,
      liquidationRatePct: 25,
      searchSimulationBudget: 0,
    })
    // Zero budget must not spend even the seed evaluation.
    expect(result.tournament.searchSimulations).toBe(0)
    expect(result.tournament.searchRefined).toBe(false)
  })
})
