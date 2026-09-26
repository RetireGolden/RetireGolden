/**
 * Sustainable-spending solver tests (planning-depth roadmap §4 acceptance
 * criteria): stable answers under fixed assumptions, estate-floor
 * monotonicity, and exact-ledger (never approximated) feasibility.
 */

import { describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import { simOptions, noTraditionalPlan } from '../testing/decisionFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { makeMaximizeSustainableSpending } from './objectives.js'
import { solveMaxSustainableSpending, type SustainableSpendingOptions } from './spendingSolver.js'

describe('solveMaxSustainableSpending', () => {
  it('returns a stable spending amount under fixed assumptions', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const first = solveMaxSustainableSpending(ctx)
    const second = solveMaxSustainableSpending(ctx)

    expect(first.converged).toBe(true)
    expect(first.maxBaseAnnual).not.toBeNull()
    // Deterministic: identical inputs ⇒ identical probes and answer.
    expect(second.maxBaseAnnual).toBe(first.maxBaseAnnual)
    expect(second.simulationCount).toBe(first.simulationCount)

    // ~$700k of flat-return assets over an 18-year horizon: the answer must
    // beat the current $30k spending and stay in a plausible band.
    expect(first.maxBaseAnnual!).toBeGreaterThan(30_000)
    expect(first.maxBaseAnnual!).toBeLessThan(60_000)
    expect(first.spendingSlackDollars!).toBe(first.maxBaseAnnual! - 30_000)

    // The answer is priced by the exact ledger and never depletes.
    expect(first.bestEvaluation!.candidateResult.depletionYear).toBeNull()
  })

  it('increasing the required estate floor lowers or preserves recommended spending', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const noFloor = solveMaxSustainableSpending(ctx)
    const withFloor = solveMaxSustainableSpending(ctx, { estateFloorTodayDollars: 250_000 })

    expect(withFloor.maxBaseAnnual!).toBeLessThanOrEqual(noFloor.maxBaseAnnual!)
    // Fixture inflation is 0%, so today's-dollar floor == nominal floor here.
    expect(withFloor.bestEvaluation!.candidateSummary.endingAfterTaxEstate).toBeGreaterThanOrEqual(250_000)
  })

  it('enforces the estate floor in real terms under inflation', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const inflationPct = 3
    const floorToday = 200_000
    const result = solveMaxSustainableSpending(ctx, {
      basePatch: { assumptions: { inflationPct } },
      estateFloorTodayDollars: floorToday,
    })

    // The floor is a today's-dollars bequest target: the nominal ending estate
    // must clear the floor inflated to the plan's end year, not the raw floor.
    const candidateResult = result.bestEvaluation!.candidateResult
    const years = candidateResult.endYear - candidateResult.years[0].year
    const nominalFloor = floorToday * Math.pow(1 + inflationPct / 100, years)
    expect(nominalFloor).toBeGreaterThan(floorToday)
    expect(result.bestEvaluation!.candidateSummary.endingAfterTaxEstate).toBeGreaterThanOrEqual(nominalFloor)
  })

  it('solves downward when current spending is unsustainable and reports negative slack', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const result = solveMaxSustainableSpending(ctx, { basePatch: { expenses: { baseAnnual: 100_000 } } })

    // $100k/yr from ~$700k depletes well before the horizon; the solver must
    // come back with a smaller feasible level, not fail.
    expect(result.maxBaseAnnual).not.toBeNull()
    expect(result.maxBaseAnnual!).toBeLessThan(100_000)
    expect(result.bestEvaluation!.candidateResult.depletionYear).toBeNull()
    // Slack is measured against the patched current spending, so it reports
    // overspending (negative), not headroom against the plan's original $30k.
    expect(result.spendingSlackDollars!).toBe(result.maxBaseAnnual! - 100_000)
    expect(result.spendingSlackDollars!).toBeLessThan(0)
  })

  it('ignores a cached candidateResult smuggled through evaluation options', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const clean = solveMaxSustainableSpending(ctx)
    // A cached projection would make every probe look exactly as feasible as
    // the baseline; the solver must strip it and simulate each probe.
    const poisoned = solveMaxSustainableSpending(ctx, {
      evaluation: { candidateResult: ctx.baselineResult } as unknown as SustainableSpendingOptions['evaluation'],
    })

    expect(poisoned.maxBaseAnnual).toBe(clean.maxBaseAnnual)
    expect(poisoned.simulationCount).toBe(clean.simulationCount)
  })

  it('reports which constraint binds the answer', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    // No floor: the next-higher spending level fails by running out of money.
    const noFloor = solveMaxSustainableSpending(ctx)
    expect(noFloor.limitingConstraint).toBe('depletion')
    // A floor near the fixture's asset base binds before depletion does.
    const floored = solveMaxSustainableSpending(ctx, { estateFloorTodayDollars: 400_000 })
    expect(floored.limitingConstraint).toBe('estate-floor')
    expect(floored.maxBaseAnnual!).toBeLessThan(noFloor.maxBaseAnnual!)
  })

  it('stops at the deterministic simulation budget', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const budget = 5
    const first = solveMaxSustainableSpending(ctx, { maxSimulations: budget })
    const second = solveMaxSustainableSpending(ctx, { maxSimulations: budget })

    expect(first.simulationCount).toBeLessThanOrEqual(budget)
    expect(second.maxBaseAnnual).toBe(first.maxBaseAnnual)
    expect(second.simulationCount).toBe(first.simulationCount)
    // A truncated run still reports a feasible lower bound, flagged as such.
    if (!first.converged && first.maxBaseAnnual !== null) {
      expect(first.diagnostics.length).toBeGreaterThan(0)
    }
  })
})

/**
 * A single filer, 62 in 2026, on the Marketplace in both years of a
 * 2026-2027 plan, with $30,000 of wages and $300,000 of cash at zero return
 * and zero tax. 2026 has a parameter pack, so its credit is priced; 2027 rides
 * the 2026 pack as a stand-in, so its credit is not
 * (tax-year-parameters-unsupported) and the ledger budgets its full premium.
 */
function marketplacePlan(contractYears: number[] = [2026, 2027]): Plan {
  const plan = singlePersonPlan({ dob: '1964-06-15', planningAge: 63 })
  plan.accounts = [cashAccount('cash', 300_000)]
  plan.incomes = [recurringOrdinaryIncome('wages', 30_000, 2026)]
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
  for (const year of contractYears) setAcaYearContract(plan, { year })
  return validatePlan(plan)
}

function zeroTaxContext(plan: Plan) {
  return createDecisionContext(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
}

/**
 * Four zero-return years (2026-2029) on one cash account, no income, no tax:
 * a base spending level S is feasible exactly when 4S fits the balance.
 */
function fourYearFloorPlan(openingBalance: number, baseAnnual: number, requiredAnnual: number): Plan {
  const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
  plan.accounts = [cashAccount('cash', openingBalance)]
  plan.expenses.baseAnnual = baseAnnual
  plan.expenses.requiredAnnual = requiredAnnual
  return validatePlan(plan)
}

function probedAmounts(spy: { mock: { calls: unknown[][] } }): number[] {
  return spy.mock.calls.map(
    (call) => ((call[1] as { planPatch: { expenses: { baseAnnual: number } } }).planPatch.expenses.baseAnnual),
  )
}

describe('solveMaxSustainableSpending with an unpriced ACA credit', () => {
  it('answers on the gross-premium ledger and names the unpriced year and its reason', () => {
    const plan = marketplacePlan()
    const ctx = zeroTaxContext(plan)
    // The fixture really has one priced and one unpriced Marketplace year.
    expect(ctx.baselineResult.years.map((year) => year.aca?.readiness)).toEqual(['actionable', 'nonActionable'])

    const solved = solveMaxSustainableSpending(ctx)

    expect(solved.maxBaseAnnual).not.toBeNull()
    expect(solved.converged).toBe(true)
    expect(solved.limitingConstraint).toBe('depletion')
    expect(solved.bestEvaluation!.recommendationState).not.toBe('diagnostic')
    expect(solved.bestEvaluation!.candidateResult.depletionYear).toBeNull()
    // The unpriced year budgets exactly its gross premium.
    const unpriced = solved.bestEvaluation!.candidateResult.years[1]!
    expect(unpriced.aca!.economicNetPremium).toBe(unpriced.aca!.grossEnrollmentPremium)
    expect(solved.acaGrossPremiumYears).toEqual([2027])
    expect(solved.acaGrossPremiumReasons).toContain('tax-year-parameters-unsupported')
    expect(solved.diagnostics).toContain(
      'The ACA premium tax credit is not priced in 2027; the ledger budgets the full Marketplace premium in those years, so a credit there would lower that cost.',
    )
  })

  it('solves exactly as with the credit box off when every Marketplace year is unpriced', () => {
    // No year contract at all, as the standard editor saves a plan: every
    // Marketplace year is missing-year-contract and budgets its gross premium.
    const creditOn = marketplacePlan([])
    const creditOff = validatePlan({
      ...creditOn,
      expenses: { ...creditOn.expenses, healthcare: { ...creditOn.expenses.healthcare, applyAcaCredit: false } },
    })

    const on = solveMaxSustainableSpending(zeroTaxContext(creditOn))
    const off = solveMaxSustainableSpending(zeroTaxContext(creditOff))

    expect(on.maxBaseAnnual).not.toBeNull()
    expect(on.maxBaseAnnual).toBe(off.maxBaseAnnual)
    expect(on.simulationCount).toBe(off.simulationCount)
    expect(on.acaGrossPremiumYears).toEqual([2026, 2027])
    // 2027 is also past the latest parameter pack.
    expect(on.acaGrossPremiumReasons).toEqual(['missing-year-contract', 'tax-year-parameters-unsupported'])
    expect(off.acaGrossPremiumYears).toEqual([])
    expect(off.acaGrossPremiumReasons).toEqual([])
  })

  it('still bails out on an invalid basePatch with its plan-check diagnostic', () => {
    const ctx = zeroTaxContext(marketplacePlan())
    const solved = solveMaxSustainableSpending(ctx, { basePatch: { expenses: { requiredAnnual: 50_000 } } })

    expect(solved.maxBaseAnnual).toBeNull()
    expect(solved.limitingConstraint).toBeNull()
    expect(solved.simulationCount).toBe(1)
    expect(solved.diagnostics.join(' ')).toContain('required annual spending cannot exceed baseline (target) annual spending')
    // A diagnostic run is no basis for the disclosure.
    expect(solved.acaGrossPremiumYears).toEqual([])
    expect(solved.acaGrossPremiumReasons).toEqual([])
  })
})

describe('solveMaxSustainableSpending with a required spending floor', () => {
  it('probes the floor, never below it, and names the floor when it fails', () => {
    // 4 x $20,000 floor = $80,000 > $50,000: even the floor depletes.
    const ctx = zeroTaxContext(fourYearFloorPlan(50_000, 30_000, 20_000))
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const solved = solveMaxSustainableSpending(ctx)
      expect(probedAmounts(spy)).toEqual([30_000, 20_000])
      expect(solved.maxBaseAnnual).toBeNull()
      expect(solved.limitingConstraint).toBe('depletion')
      expect(solved.simulationCount).toBe(2)
      expect(solved.diagnostics).toEqual([
        'Even the required spending floor ($20,000/yr) depletes the portfolio or breaks the estate floor.',
      ])
    } finally {
      spy.mockRestore()
    }
  })

  it('bisects between the floor and the seed when the floor is feasible', () => {
    // 4 x $20,000 = $80,000 fits $91,000; 4 x $30,000 does not. Frontier $22,750.
    const ctx = zeroTaxContext(fourYearFloorPlan(91_000, 30_000, 20_000))
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const solved = solveMaxSustainableSpending(ctx)
      const probes = probedAmounts(spy)
      expect(probes.slice(0, 2)).toEqual([30_000, 20_000])
      expect(Math.min(...probes)).toBe(20_000)
      expect(solved.maxBaseAnnual).toBe(22_500)
      expect(solved.converged).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('names zero spending when the plan has no floor', () => {
    const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
    plan.accounts = [cashAccount('cash', 5_000)]
    plan.expenses.baseAnnual = 10_000
    // An uninflated goal the balance cannot fund at any base spending.
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Unfundable', year: 2026, amount: 60_000 }]
    const solved = solveMaxSustainableSpending(zeroTaxContext(validatePlan(plan)))

    expect(solved.maxBaseAnnual).toBeNull()
    expect(solved.diagnostics).toEqual(['Even zero base spending depletes the portfolio or breaks the estate floor.'])
  })
})

describe('maximizeSustainableSpending policy', () => {
  it('ranks higher feasible spending above lower and disqualifies depleting candidates', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const policy = makeMaximizeSustainableSpending()

    const spendingCandidate = (baseAnnual: number) => ({
      id: `spend-${baseAnnual}`,
      source: 'heuristic' as const,
      category: 'spending' as const,
      label: `Spend $${baseAnnual}`,
      explanation: 'test',
      planPatch: { expenses: { baseAnnual } },
    })

    const modest = evaluateCandidate(ctx, spendingCandidate(32_000))
    const richer = evaluateCandidate(ctx, spendingCandidate(36_000))
    const tooMuch = evaluateCandidate(ctx, spendingCandidate(90_000))

    expect(policy.constraintViolations(modest, ctx)).toEqual([])
    expect(policy.constraintViolations(richer, ctx)).toEqual([])
    expect(policy.primaryMetric(richer, ctx)).toBeGreaterThan(policy.primaryMetric(modest, ctx))
    // $90k/yr depletes the fixture before the horizon ⇒ hard disqualification.
    expect(policy.constraintViolations(tooMuch, ctx).some((v) => v.includes('depletes'))).toBe(true)
  })

  it('enforces the estate floor as a hard constraint', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const floored = makeMaximizeSustainableSpending(600_000)
    const evaluation = evaluateCandidate(ctx, {
      id: 'spend-36k',
      source: 'heuristic',
      category: 'spending',
      label: 'Spend $36k',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 36_000 } },
    })

    expect(floored.constraintViolations(evaluation, ctx).some((v) => v.includes('floor'))).toBe(true)
  })
})
