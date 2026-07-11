/**
 * Risk-based guardrail threshold solver tests: thresholds reproduce their
 * success band within tolerance, the search is seed-deterministic, adjustment
 * sizing restores the band midpoint, and always-safe plans report no
 * thresholds instead of inventing them.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { createFlatTaxCalculator } from '../projection/flatTax'
import { solveRiskBasedGuardrails, startingInvestableOf } from './riskBasedGuardrails'

let counter = 0
const testIds = () => `riskband-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 88, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.assumptions.heirTaxRatePct = 20
  plan.expenses.baseAnnual = 40_000
  plan.expenses.requiredAnnual = 24_000
  plan.accounts = [taxable(900_000)]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const opts = {
  startYear: 2026,
  taxCalculator: noTax,
  model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 14 } as const,
  pathCount: 80,
  seed: 123,
}

describe('solveRiskBasedGuardrails', () => {
  it('finds dollar thresholds that reproduce the success band within tolerance', () => {
    const solution = solveRiskBasedGuardrails(basePlan(), opts)

    expect(solution.lowerBandPct).toBe(70)
    expect(solution.upperBandPct).toBe(95)
    expect(solution.startingInvestable).toBe(900_000)
    expect(solution.lower).not.toBeNull()
    expect(solution.upper).not.toBeNull()
    expect(solution.lowerOutcome).toBe('solved')
    expect(solution.upperOutcome).toBe('solved')
    expect(solution.lower!.balanceFrac).toBeLessThan(solution.upper!.balanceFrac)
    expect(solution.lower!.balanceDollars).toBeCloseTo(solution.lower!.balanceFrac * 900_000, 6)

    // Success at each solved threshold sits at its band edge, within the
    // discreteness of 80 shared paths plus the bisection resolution.
    expect(solution.lower!.successAtThreshold).toBeGreaterThanOrEqual(0.7)
    expect(solution.lower!.successAtThreshold).toBeLessThanOrEqual(0.7 + 0.08)
    expect(solution.upper!.successAtThreshold).toBeGreaterThanOrEqual(0.95)
    expect(solution.upper!.successAtThreshold).toBeLessThanOrEqual(1)
  })

  it(
    'is deterministic for the same plan, seed, and model',
    () => {
      const a = solveRiskBasedGuardrails(basePlan(), opts)
      const b = solveRiskBasedGuardrails(basePlan(), opts)
      expect(b).toEqual(a)
    },
    10_000,
  )

  it('honors the band configured on the plan spending policy', () => {
    const plan = basePlan()
    plan.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      targetSuccessLowerPct: 60,
      targetSuccessUpperPct: 90,
    }
    const solution = solveRiskBasedGuardrails(plan, opts)
    expect(solution.lowerBandPct).toBe(60)
    expect(solution.upperBandPct).toBe(90)
  })

  it('sizes a spending cut that restores success to the band midpoint at the lower threshold', () => {
    const solution = solveRiskBasedGuardrails(basePlan(), opts)
    expect(solution.suggestedCut).not.toBeNull()
    const cut = solution.suggestedCut!
    expect(cut.spendingMultiplier).toBeGreaterThan(0)
    expect(cut.spendingMultiplier).toBeLessThan(1)
    expect(cut.monthlyDollars).toBeGreaterThan(0)
    expect(cut.annualDollars).toBeCloseTo(cut.monthlyDollars * 12, 6)
    // Midpoint of the 70–95 band is 82.5%; allow shared-path discreteness.
    expect(cut.successAfter).toBeGreaterThanOrEqual(0.825 - 0.05)
  })

  it('reports no thresholds when guaranteed income makes the plan safe at any balance', () => {
    const plan = basePlan()
    plan.incomes = [
      {
        type: 'recurring',
        id: testIds(),
        label: 'Pension-like income',
        annualAmount: 80_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: true,
        taxTreatment: 'ordinary',
      },
    ]
    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const solution = solveRiskBasedGuardrails(parsed.plan, opts)
    expect(solution.successAtCurrent).toBe(1)
    expect(solution.lower).toBeNull()
    expect(solution.upper).toBeNull()
    expect(solution.lowerOutcome).toBe('always-above-band')
    expect(solution.upperOutcome).toBe('always-above-band')
    expect(solution.suggestedCut).toBeNull()
  })

  it('distinguishes an underfunded plan (band unreachable) from an always-safe one', () => {
    const plan = basePlan()
    plan.accounts = [taxable(50_000)]
    plan.expenses.baseAnnual = 90_000
    plan.expenses.requiredAnnual = 54_000
    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const solution = solveRiskBasedGuardrails(parsed.plan, opts)
    // Even at 4x the current portfolio, success never reaches the band: the
    // missing thresholds mean "underfunded", never "safe".
    expect(solution.lower).toBeNull()
    expect(solution.upper).toBeNull()
    expect(solution.lowerOutcome).toBe('never-reaches-band')
    expect(solution.upperOutcome).toBe('never-reaches-band')
  })

  it('rejects an inverted success band instead of solving nonsense', () => {
    const plan = basePlan()
    plan.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      targetSuccessLowerPct: 90,
      targetSuccessUpperPct: 70,
    }
    expect(() => solveRiskBasedGuardrails(plan, opts)).toThrow(/inverted/)
  })

  it('sums only investable balances into the threshold base', () => {
    const plan = basePlan()
    expect(startingInvestableOf(plan)).toBe(900_000)
  })
})
