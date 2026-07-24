import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from '../projection/flatTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { compareScenarioPlans, compareScenarioSpendingCapacityResults } from './comparison.js'
import { scenarioPlanSnapshotHash } from './patch.js'

const noTax = createFlatTaxCalculator(0)
const stochastic = {
  model: { type: 'lognormal' as const, inflationMeanPct: 0 },
  pathCount: 16,
  seed: 731,
}

function comparisonPlan() {
  const plan = singlePersonPlan({
    dob: '1960-01-01',
    planningAge: 75,
    retirementAge: 65,
  })
  plan.accounts = [cashAccount('cash', 600_000)]
  plan.incomes = [recurringOrdinaryIncome('income', 35_000)]
  plan.expenses.baseAnnual = 45_000
  return validatePlan(plan)
}

function allDeltas(value: unknown): number[] {
  if (Array.isArray(value)) return value.flatMap(allDeltas)
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'delta' && typeof child === 'number' ? [child] : allDeltas(child),
  )
}

describe('compareScenarioPlans', () => {
  it('gives an identical deep-cloned plan exact +0 deltas without NaN and does not mutate either input', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    const beforeBaseline = structuredClone(baseline)
    const beforeProposal = structuredClone(proposal)

    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic,
    })

    const deltas = allDeltas(result)
    expect(deltas.length).toBeGreaterThan(30)
    for (const delta of deltas) {
      expect(Number.isNaN(delta)).toBe(false)
      expect(delta).toBe(0)
      expect(Object.is(delta, -0)).toBe(false)
    }
    expect(baseline).toEqual(beforeBaseline)
    expect(proposal).toEqual(beforeProposal)
    expect(result.provenance.baselineSnapshotHash).toBe(scenarioPlanSnapshotHash(baseline))
    expect(result.provenance.proposalSnapshotHash).toBe(scenarioPlanSnapshotHash(proposal))
    expect(result.moneyBasis.deltaConvention).toBe('proposal-minus-baseline')
  })

  it('is byte-stable for repeated same-seed shared-path comparisons', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 10_000
    const options = { startYear: 2026, taxCalculatorForPlan: () => noTax, stochastic }
    expect(compareScenarioPlans(baseline, proposal, options).risk).toEqual(
      compareScenarioPlans(baseline, proposal, options).risk,
    )
  })

  it('aggregates deterministic income, spending, withdrawals, and annual ledger rows consistently', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 5_000
    const result = compareScenarioPlans(baseline, proposal, {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })

    expect(result.income.total.baseline).toBe(
      result.annual.reduce((total, row) => total + (row.values.income.baseline ?? 0), 0),
    )
    expect(result.spending.intended.proposal).toBe(
      result.annual.reduce((total, row) => total + (row.values.spendingIntended.proposal ?? 0), 0),
    )
    expect(result.withdrawals.total.proposal).toBe(
      result.annual.reduce((total, row) => total + (row.values.withdrawals.proposal ?? 0), 0),
    )
    expect(result.spending.intended.delta).toBeGreaterThan(0)
  })

  it('aligns annual rows by calendar year and uses null when only one horizon contains a year', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.household.people[0]!.longevity.planningAge = 70
    const result = compareScenarioPlans(baseline, validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
    })
    const last = result.annual.at(-1)!
    expect(last.year).toBe(2035)
    expect(last.values.netWorth.baseline).not.toBeNull()
    expect(last.values.netWorth.proposal).toBeNull()
    expect(last.values.netWorth.delta).toBeNull()
    expect(result.headline.depletionYear).toEqual({ baseline: null, proposal: null, delta: null })
    expect(result.headline.projectionEndYear.delta).toBe(-5)
  })

  it('uses each plan tax calculator and exposes ledger-native IRMAA surcharge dollars', () => {
    const baseline = comparisonPlan()
    baseline.assumptions.stateEffectiveTaxPct = 0
    baseline.assumptions.recentAnnualMagi = 50_000
    const proposal = structuredClone(baseline)
    proposal.assumptions.stateEffectiveTaxPct = 10
    proposal.assumptions.recentAnnualMagi = 200_000
    const seenRates: number[] = []

    const result = compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan(plan) {
        seenRates.push(plan.assumptions.stateEffectiveTaxPct)
        return createFlatTaxCalculator(plan.assumptions.stateEffectiveTaxPct)
      },
    })

    expect(seenRates).toEqual([0, 10])
    expect(result.headline.lifetimeTaxesAndPenalties.delta).toBeGreaterThan(0)
    expect(result.irmaa.surcharge.baseline).toBe(0)
    expect(result.irmaa.surcharge.proposal).toBeGreaterThan(0)
    expect(result.irmaa.surcharge.delta).toBeGreaterThan(0)
  })

  it('reports shared-path risk provenance, aligned depletion curves, and optional spending capacity', () => {
    const baseline = comparisonPlan()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual = 100_000
    const result = compareScenarioPlans(baseline, validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic,
      spendingCapacity: { maxSimulations: 8, resolutionDollars: 5_000 },
    })

    expect(result.risk?.provenance).toMatchObject({ seed: 731, pathCount: 16, stochasticLongevity: false })
    expect(result.risk?.successRate.proposal).toBeLessThanOrEqual(result.risk!.successRate.baseline)
    for (const row of result.risk!.depletionProbabilityByYear) {
      expect(row.cumulativeProbability.baseline).toBeGreaterThanOrEqual(0)
      expect(row.cumulativeProbability.proposal).toBeGreaterThanOrEqual(0)
    }
    expect(result.spendingCapacity).not.toBeNull()
    expect(result.spendingCapacity!.maxBaseAnnual.baseline).not.toBeNull()
    expect(result.moneyBasis.spendingCapacity).toBe('today')
  })

  it('normalizes identical spending-capacity deltas to exact +0', () => {
    const baseline = comparisonPlan()
    const result = compareScenarioPlans(baseline, structuredClone(baseline), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      spendingCapacity: { maxSimulations: 8, resolutionDollars: 5_000 },
    })
    expect(result.spendingCapacity?.maxBaseAnnual.delta).toBe(0)
    expect(Object.is(result.spendingCapacity?.maxBaseAnnual.delta, -0)).toBe(false)
    expect(result.spendingCapacity?.spendingSlack.delta).toBe(0)
    expect(Object.is(result.spendingCapacity?.spendingSlack.delta, -0)).toBe(false)
  })

  it('compares worker-compatible capacity results without hiding non-convergence metadata', () => {
    const result = compareScenarioSpendingCapacityResults(
      {
        maxBaseAnnual: 50_000,
        spendingSlackDollars: 5_000,
        converged: false,
        simulationCount: 8,
        limitingConstraint: 'depletion',
        diagnostics: ['Feasible lower bound only.'],
      },
      {
        maxBaseAnnual: 55_000,
        spendingSlackDollars: 10_000,
        converged: true,
        simulationCount: 7,
        limitingConstraint: 'estate-floor',
        diagnostics: [],
      },
    )
    expect(result.maxBaseAnnual.delta).toBe(5_000)
    expect(result.baselineConverged).toBe(false)
    expect(result.baselineDiagnostics).toEqual(['Feasible lower bound only.'])
    expect(result.proposalConverged).toBe(true)
  })

  it('rejects invalid stochastic options before running simulations', () => {
    const plan = comparisonPlan()
    expect(() =>
      compareScenarioPlans(plan, plan, {
        startYear: 2026,
        taxCalculatorForPlan: () => noTax,
        stochastic: { ...stochastic, pathCount: 0 },
      }),
    ).toThrow('pathCount')
  })
})
