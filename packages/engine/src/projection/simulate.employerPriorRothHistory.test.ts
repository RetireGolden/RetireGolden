/** Production Plan-to-reconciliation tests. Observer runs the real phase.
 * Notice2025-67: 2026 base24500/catch-up8000. TD10033 1.414(v)-2(b)(1),
 * (d)(6): prior designated Roth offsets the annual Roth catch-up mandate.
 */
import { describe, expect, it, vi } from 'vitest'
import type { AnnualContributionReconciliationPhaseInput, AnnualContributionReconciliationPhaseResult } from './internal/annualContributionReconciliationPhase.js'
const observed = vi.hoisted(() => [] as {
  prior: AnnualContributionReconciliationPhaseInput['employerPriorElectiveByPlanKey']
  result: AnnualContributionReconciliationPhaseResult
}[])
vi.mock('./internal/annualContributionReconciliationPhase.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualContributionReconciliationPhase.js')>()
  return { ...original, annualContributionReconciliationPhase(input: AnnualContributionReconciliationPhaseInput) {
    const prior = new Map(input.employerPriorElectiveByPlanKey)
    const result = original.annualContributionReconciliationPhase(input)
    observed.push({ prior, result })
    return result
  } }
})
import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { basePlan, cash, wages, validate } from './simulate.test-support.js'
import { simulatePlan } from './simulate.js'
const groupKey = 'p1\0plan-a'
function planWithPrior(priorRoth: number | 'omitted'): Plan {
  const plan = basePlan()
  plan.household.people[0]!.dob = '1971-01-01' // Age55 uses ordinary8000 catch-up.
  plan.household.people[0]!.retirementAge = 70
  plan.expenses.baseAnnual = 0
  const employer = (type: 'traditional' | 'roth', amount: number): Account => ({
    type, id: type, name: type, kind: 'employer', ownerPersonId: 'p1',
    employerPlanId: 'plan-a', annualReturnPct: 0, balance: 0, annualContribution: amount,
    priorCalendarYearFicaWages: 200000,
  })
  plan.accounts = [cash(100000), employer('traditional', 32500 - (priorRoth === 'omitted' ? 0 : priorRoth)), employer('roth', 0)]
  plan.incomes = [wages(200000)]
  if (priorRoth !== 'omitted') plan.employerElectiveDeferralHistory = [{
    ownerPersonId: 'p1', employerPlanId: 'plan-a', contributionYear: 2026,
    totalElectiveDeferrals: priorRoth, designatedRothElectiveDeferrals: priorRoth,
    asOf: '2026-01-01', provenance: { source: 'Stipulated employer YTD payroll record' },
  }]
  return validate(plan)
}
function run(plan: Plan) {
  observed.length = 0
  const result = simulatePlan(plan, { startYear: 2026, horizonEndYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
  expect(observed.length).toBeGreaterThan(0)
  return result
}
describe('employer prior designated Roth production', () => {
  it('credits $4000 Plan payroll history so only $4000 additional Roth lands at the 2026 annual limit', () => {
    // 32500-24500 =8000 annual Roth obligation; prior4000 leaves4000.
    // Incremental28500 =24500 pretax+4000 Roth.
    const projection = run(planWithPrior(4000))
    for (const call of observed) {
      expect(call.prior?.get(groupKey)).toEqual({ status: 'known', totalElectiveDeferrals: 4000,
        designatedRothElectiveDeferrals: 4000, asOfDate: '2026-01-01' })
      expect(call.result.preTaxContributions).toBe(24500)
      expect(call.result.otherInflow).toBe(4000)
      expect(call.result.contributions).toBe(28500)
      expect(call.result.employerAllocationByGroupKey.get(groupKey)).toMatchObject({
        priorContributionsStatus: 'known', additionalRothCatchUpStillRequired: 0,
      })
    }
    expect(projection.years[0]?.contributions).toBe(28500)
  })
  it('distinguishes explicit known zero from omitted history while preserving the $8000 current Roth requirement', () => {
    run(planWithPrior(0))
    for (const call of observed) {
      expect(call.prior?.get(groupKey)?.status).toBe('known')
      expect(call.result.otherInflow).toBe(8000)
      expect(call.result.employerAllocationByGroupKey.get(groupKey)?.priorContributionsStatus).toBe('known')
    }
    run(planWithPrior('omitted'))
    for (const call of observed) {
      expect(call.prior?.has(groupKey)).toBe(false)
      expect(call.result.otherInflow).toBe(8000)
      // Explicit plan identity enters the evidence-aware path. Missing history
      // is unknown, not proof of zero, despite the conservative Roth allocation.
      expect(call.result.employerAllocationByGroupKey.get(groupKey)).toMatchObject({
        priorContributionsStatus: 'unknown', additionalRothCatchUpStillRequired: null,
      })
    }
  })
  it('keeps conflicting runtime snapshots unknown instead of certifying a zero unpaid mandate', () => {
    const plan = planWithPrior(0)
    // Import rejects duplicates; direct engine API also defends stale mixed
    // snapshots. This deliberately probes that existing defensive boundary.
    plan.employerElectiveDeferralHistory.push({ ...plan.employerElectiveDeferralHistory[0]!, asOf: '2026-02-01' })
    expect(parsePlan(plan).ok).toBe(false)
    const projection = run(plan)
    for (const call of observed) {
      expect(call.prior?.get(groupKey)).toEqual({ status: 'unknown' })
      expect(call.result.employerAllocationByGroupKey.get(groupKey)).toMatchObject({
        priorContributionsStatus: 'unknown', additionalRothCatchUpStillRequired: null,
      })
    }
    expect(projection.warnings.some((warning) => warning.includes('mixed snapshots'))).toBe(true)
  })
})
