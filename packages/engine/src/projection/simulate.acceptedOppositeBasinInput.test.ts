/** Boundary regression, not an ACA dollar oracle.
 * Production candidates retain every real field; only fixed-point control
 * values are replaced to force a later discarded low-basin diagnostic probe.
 * The actual fixed-point selector, withdrawal effects and simulate publication
 * still execute. No accepted tax input is injected into the publication seam.
 */
import { describe, expect, it, vi } from 'vitest'
import type { AnnualFundingCandidateEvaluationInput, AnnualFundingCandidateEvaluationResult, AnnualFundingCandidateWithdrawalPlan } from './internal/annualFundingCandidateEvaluation.js'
import type { AnnualFundingFixedPointInput, AnnualFundingFixedPointResult } from './internal/annualFundingFixedPoint.js'
type Evaluation = AnnualFundingCandidateEvaluationResult<AnnualFundingCandidateWithdrawalPlan>
const recorder = vi.hoisted(() => ({
  probes: [] as Evaluation[],
  solves: [] as { result: AnnualFundingFixedPointResult<Evaluation>; lastProbe: Evaluation }[],
}))
vi.mock('./internal/annualFundingCandidateEvaluation.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualFundingCandidateEvaluation.js')>()
  return { ...original, annualFundingCandidateEvaluation(input: AnnualFundingCandidateEvaluationInput<AnnualFundingCandidateWithdrawalPlan>): Evaluation {
    const natural = original.annualFundingCandidateEvaluation(input)
    const low = input.request.need < 90
    const evaluation: Evaluation = {
      ...natural, requiredNeed: low ? 80 : 100, healthcare: low ? 100 : 120,
      acaSupportCodes: [],
      acaQuote: {
        fplPct: low ? 300 : 500, expectedContribution: 0,
        credit: low ? 20 : 0, netAnnualPremium: low ? 100 : 120,
        grossEnrollmentPremium: 120, applicableSlcspPremium: 120,
        modeledAllowablePtc: low ? 20 : 0, economicNetPremium: low ? 100 : 120,
        overCliff: !low, belowEligibilityFloor: false,
      },
    }
    recorder.probes.push(evaluation)
    return evaluation
  } }
})
vi.mock('./internal/annualFundingFixedPoint.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualFundingFixedPoint.js')>()
  return { ...original, annualFundingFixedPoint(input: AnnualFundingFixedPointInput<Evaluation>) {
    // Same deterministic basin shape as annualFundingFixedPoint.test: high
    // root100; diagnostic starts at100-20=80 and finds a subsidized low root.
    const result = original.annualFundingFixedPoint({
      ...input, spendingUsesBeforeTax: 120, baseCashInflows: 20,
      currentHealthcare: 0, coordinatedHecmCapacity: 0, acaActive: true,
      acaGrossEnrollmentPremium: 20, acaInitialSupportCodeCount: 0,
    })
    const lastProbe = recorder.probes.at(-1)
    if (lastProbe === undefined) throw new Error('Expected real funding candidates')
    recorder.solves.push({ result, lastProbe })
    return result
  } }
})
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

describe('accepted opposite ACA basin tax-input publication boundary', () => {
  it('publishes the accepted gross-basin input by identity after the last discarded subsidized probe', () => {
    recorder.probes.length = 0
    recorder.solves.length = 0
    const plan = singlePersonPlan({ dob: '1976-01-01', planningAge: 60, retirementAge: null })
    const cash = cashAccount('cash', 1000)
    cash.annualReturnPct = 0
    plan.accounts = [cash]
    plan.incomes = []
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    const projection = simulatePlan(validatePlan(plan), {
      startYear: 2026, horizonEndYear: 2026, taxCalculator: { compute: () => 0 },
    })
    const solve = recorder.solves.at(-1)
    if (solve === undefined) throw new Error('Expected actual fixed-point solve')
    expect(solve.result.acaConflictingCliffBasins).toBe(true)
    expect(solve.result.evaluation.requiredNeed).toBe(100)
    expect(solve.result.evaluation.acaQuote?.overCliff).toBe(true)
    expect(solve.lastProbe.requiredNeed).toBe(80)
    expect(solve.lastProbe.acaQuote?.overCliff).toBe(false)
    expect(solve.lastProbe).not.toBe(solve.result.evaluation)
    expect(solve.lastProbe.taxInput).not.toBe(solve.result.evaluation.taxInput)
    expect(projection.years[0]?.acceptedTaxInput).toBe(solve.result.evaluation.taxInput)
    expect(projection.years[0]?.acceptedTaxInput).not.toBe(solve.lastProbe.taxInput)
    expect(projection.warnings.some((warning) => warning.includes('conflicting subsidized and gross-premium fixed points'))).toBe(true)
  })
})
