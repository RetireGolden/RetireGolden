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
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { makeMaximizeSustainableSpending } from './objectives.js'
import {
  initialWithdrawalRatePct,
  roundSolvedSpending,
  solveMaxSustainableSpending,
  type SustainableSpendingOptions,
} from './spendingSolver.js'
import { isExactAnswerDiagnostic } from './spendingSolverDiagnostics.js'
import { startingInvestableOf } from '../montecarlo/riskBasedGuardrails.js'

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
 * A single filer, 62 in 2026, on the Marketplace in every year of a
 * 2026-2028 plan, with $30,000 of wages and $300,000 of cash at zero return
 * and zero tax. 2026 and 2027 have published credit figures, so their credits
 * are priced; 2028 has none yet (the latest coverage-year block is 2027's), so
 * its credit is not (tax-year-parameters-unsupported) and the ledger budgets
 * its full premium.
 */
function marketplacePlan(contractYears: number[] = [2026, 2027, 2028]): Plan {
  const plan = singlePersonPlan({ dob: '1964-06-15', planningAge: 64 })
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
    // The fixture really has priced and unpriced Marketplace years.
    expect(ctx.baselineResult.years.map((year) => year.aca?.readiness)).toEqual(['actionable', 'actionable', 'nonActionable'])

    const solved = solveMaxSustainableSpending(ctx)

    expect(solved.maxBaseAnnual).not.toBeNull()
    expect(solved.converged).toBe(true)
    expect(solved.limitingConstraint).toBe('depletion')
    expect(solved.bestEvaluation!.recommendationState).not.toBe('diagnostic')
    expect(solved.bestEvaluation!.candidateResult.depletionYear).toBeNull()
    // The unpriced year budgets exactly its gross premium.
    const unpriced = solved.bestEvaluation!.candidateResult.years[2]!
    expect(unpriced.aca!.economicNetPremium).toBe(unpriced.aca!.grossEnrollmentPremium)
    expect(solved.acaGrossPremiumYears).toEqual([2028])
    expect(solved.acaGrossPremiumReasons).toEqual(['tax-year-parameters-unsupported'])
    // Fixed-target spending: a credit could only lower withdrawals.
    expect(solved.acaGrossPremiumDirection).toBe('conservative')
    // The disclosure is the last diagnostic, and it names the blocking codes.
    expect(solved.diagnostics.at(-1)).toBe(
      'The ACA premium tax credit is not priced in 2028 (tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, so a household that receives a credit there would likely be able to spend somewhat more than this answer.',
    )
  })

  it.each(['withdrawalRateGuardrails', 'riskBasedGuardrails'] as const)(
    'calls the direction uncertain under %s spending',
    (mode) => {
      const plan = validatePlan({
        ...marketplacePlan(),
        expenses: { ...marketplacePlan().expenses, spendingPolicy: { mode } },
      })
      const solved = solveMaxSustainableSpending(zeroTaxContext(plan))

      expect(solved.maxBaseAnnual).not.toBeNull()
      expect(solved.acaGrossPremiumDirection).toBe('uncertain')
      expect(solved.acaGrossPremiumReasons).toContain('guardrail-interaction-unsupported')
      expect(solved.diagnostics.at(-1)).toMatch(
        /the ledger budgets the full Marketplace premium in those years, and a credit there could move this answer up or down because the spending guardrails respond to healthcare costs\.$/,
      )
    },
  )

  it('overrides a JS caller that asks the probes to refuse unpriced ACA years', () => {
    const ctx = zeroTaxContext(marketplacePlan())
    const clean = solveMaxSustainableSpending(ctx)
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const asked = solveMaxSustainableSpending(ctx, {
        evaluation: { nonActionableAca: 'refuse' } as unknown as SustainableSpendingOptions['evaluation'],
      })
      expect(asked.maxBaseAnnual).toBe(clean.maxBaseAnnual)
      expect(spy.mock.calls.every((call) => call[2]?.nonActionableAca === 'disclose')).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('words the disclosure for a solve with no answer without calling an answer conservative', () => {
    const plan = marketplacePlan()
    // A one-time goal no base spending can fund: even zero depletes.
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Unfundable', year: 2026, amount: 5_000_000 }]
    const solved = solveMaxSustainableSpending(zeroTaxContext(validatePlan(plan)))

    expect(solved.maxBaseAnnual).toBeNull()
    expect(solved.acaGrossPremiumYears).toEqual([2028])
    expect(solved.diagnostics).toEqual([
      'Even zero base spending depletes the portfolio before the plan ends.',
      'The ACA premium tax credit is not priced in 2028 (tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, and a credit there would lower that cost.',
    ])
  })

  it('leaves the informational tax-exempt-interest codes out of the reasons', () => {
    const ctx = zeroTaxContext(marketplacePlan())
    const real = evaluation.evaluateCandidate
    const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((...args) => {
      const evaluated = real(...args)
      const years = evaluated.candidateResult.years.map((year) =>
        year.aca?.readiness === 'nonActionable'
          ? { ...year, aca: { ...year.aca, supportCodes: ['tax-exempt-interest-plan-derived' as const, ...year.aca.supportCodes] } }
          : year,
      )
      return { ...evaluated, candidateResult: { ...evaluated.candidateResult, years } }
    })
    try {
      const solved = solveMaxSustainableSpending(ctx)
      expect(solved.acaGrossPremiumReasons).toEqual(['tax-year-parameters-unsupported'])
      expect(solved.diagnostics.at(-1)).not.toContain('tax-exempt-interest')
    } finally {
      spy.mockRestore()
    }
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
    expect(on.acaGrossPremiumYears).toEqual([2026, 2027, 2028])
    // 2028 is also past the latest coverage year with published credit figures.
    expect(on.acaGrossPremiumReasons).toEqual(['missing-year-contract', 'tax-year-parameters-unsupported'])
    expect(off.acaGrossPremiumYears).toEqual([])
    expect(off.acaGrossPremiumReasons).toEqual([])
    expect(on.acaGrossPremiumDirection).toBe('conservative')
    expect(off.acaGrossPremiumDirection).toBeNull()
    // Two years and two codes merged across them: the sentence does not pin
    // both codes on both years.
    expect(on.diagnostics.at(-1)).toContain(
      'not priced in 2026, 2027, 2028 (in each of those years, at least one of these applies: missing-year-contract, tax-year-parameters-unsupported);',
    )
  })

  it('with no answer, reports the unpriced years of the probe the failure names, not the seed', () => {
    // Spending comes out of a traditional IRA, so MAGI follows spending: the
    // $40,000 seed prices 2026 and 2027, but the $0 floor probe leaves their
    // MAGI under the poverty line, where the credit is not priced. 2028 has no
    // published credit figures in either run. A $5,000,000 goal in 2028 makes
    // every level deplete.
    const plan = singlePersonPlan({ dob: '1964-06-15', planningAge: 64 })
    plan.accounts = [traditionalAccount('ira', 300_000)]
    plan.expenses.baseAnnual = 40_000
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 }
    setAcaYearContract(plan, { year: 2026 })
    setAcaYearContract(plan, { year: 2027 })
    setAcaYearContract(plan, { year: 2028 })
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Unfundable', year: 2028, amount: 5_000_000 }]
    const ctx = zeroTaxContext(validatePlan(plan))
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const solved = solveMaxSustainableSpending(ctx)
      const [seedRun, floorRun] = spy.mock.results.map((result) => result.value as ReturnType<typeof evaluateCandidate>)
      const unpricedIn = (run: ReturnType<typeof evaluateCandidate>) =>
        run.candidateResult.years.filter((year) => year.aca?.readiness === 'nonActionable').map((year) => year.year)
      expect(probedAmounts(spy)).toEqual([40_000, 0])
      expect(unpricedIn(seedRun!)).toEqual([2028])
      expect(unpricedIn(floorRun!)).toEqual([2026, 2027, 2028])

      expect(solved.maxBaseAnnual).toBeNull()
      expect(solved.diagnostics[0]).toBe('Even zero base spending depletes the portfolio before the plan ends.')
      expect(solved.acaGrossPremiumYears).toEqual([2026, 2027, 2028])
      expect(solved.acaGrossPremiumReasons).toContain('below-100-fpl-exception-unsupported')
    } finally {
      spy.mockRestore()
    }
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
    expect(solved.acaGrossPremiumDirection).toBeNull()
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
      expect(solved.diagnostics).toEqual(['Even the required spending floor ($20,000/yr) depletes the portfolio before the plan ends.'])
    } finally {
      spy.mockRestore()
    }
  })

  it('probes a fractional floor at its whole-dollar ceiling', () => {
    // A probe at $20,000 would sit below a $20,000.40 floor and fail the plan checks.
    const ctx = zeroTaxContext(fourYearFloorPlan(91_000, 30_000, 20_000.4))
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const solved = solveMaxSustainableSpending(ctx)
      expect(probedAmounts(spy).slice(0, 2)).toEqual([30_000, 20_001])
      expect(solved.maxBaseAnnual).not.toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('seeds a fractional baseline equal to its floor at the floor rounded up, never below it', () => {
    // round($34,000.40) = $34,000 would sit under the $34,000.40 floor and
    // come back as an invalid plan; the seed is $34,001.
    const spy = vi.spyOn(evaluation, 'evaluateCandidate')
    try {
      const fails = solveMaxSustainableSpending(zeroTaxContext(fourYearFloorPlan(91_000, 34_000.4, 34_000.4)))
      expect(probedAmounts(spy)).toEqual([34_001])
      expect(fails.simulationCount).toBe(1)
      expect(fails.diagnostics).toEqual(['Even the required spending floor ($34,001/yr) depletes the portfolio before the plan ends.'])
      spy.mockClear()

      const answers = solveMaxSustainableSpending(zeroTaxContext(fourYearFloorPlan(200_000, 34_000.4, 34_000.4)))
      expect(probedAmounts(spy)[0]).toBe(34_001)
      expect(answers.maxBaseAnnual).not.toBeNull()
      expect(answers.bestEvaluation!.recommendationState).not.toBe('diagnostic')
    } finally {
      spy.mockRestore()
    }
  })

  it('says zero spending depletes only when a probe at zero ran and depleted', () => {
    const floorFails = solveMaxSustainableSpending(zeroTaxContext(fourYearFloorPlan(50_000, 30_000, 20_000)))
    expect(floorFails.zeroSpendingDepletes).toBe(false)

    const plan = singlePersonPlan({ dob: '1969-06-15', planningAge: 60 })
    plan.accounts = [cashAccount('cash', 5_000)]
    plan.expenses.baseAnnual = 10_000
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Unfundable', year: 2026, amount: 60_000 }]
    const ctx = zeroTaxContext(validatePlan(plan))
    expect(solveMaxSustainableSpending(ctx).zeroSpendingDepletes).toBe(true)
    // A budget of one probe stops before zero is tried.
    const stopped = solveMaxSustainableSpending(ctx, { maxSimulations: 1 })
    expect(stopped.diagnostics[0]).toBe('Simulation budget exhausted before any feasible spending level was found.')
    expect(stopped.zeroSpendingDepletes).toBe(false)
  })

  it('stops after one probe when the seed is already at the floor and fails', () => {
    const solved = solveMaxSustainableSpending(zeroTaxContext(fourYearFloorPlan(50_000, 20_000, 20_000)))
    expect(solved.maxBaseAnnual).toBeNull()
    expect(solved.simulationCount).toBe(1)
    expect(solved.diagnostics).toEqual(['Even the required spending floor ($20,000/yr) depletes the portfolio before the plan ends.'])
  })

  it('names the ending-estate target, not depletion, when that is what the floor fails', () => {
    // 4 x $20,000 = $80,000 fits $91,000 but leaves $11,000, short of a $50,000 target.
    const solved = solveMaxSustainableSpending(zeroTaxContext(fourYearFloorPlan(91_000, 30_000, 20_000)), {
      estateFloorTodayDollars: 50_000,
    })
    expect(solved.maxBaseAnnual).toBeNull()
    expect(solved.limitingConstraint).toBe('estate-floor')
    expect(solved.diagnostics).toEqual([
      "Even the required spending floor ($20,000/yr) leaves an ending after-tax estate below the $50,000 target (today's dollars).",
    ])
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
    expect(solved.diagnostics).toEqual(['Even zero base spending depletes the portfolio before the plan ends.'])
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

/**
 * The published amount (owner decision R4, with the guardrail refinement of
 * 2026-09-27): the passing probe rounded down to a whole $100 when that level
 * is known to pass, else the probe itself. Feasibility is supplied by an
 * evaluation double on the real solver, as in the bisection evidence: every
 * probe runs the production search, and the double only answers which levels
 * pass.
 */
describe('solveMaxSustainableSpending publishes one amount (R4)', () => {
  function solveWith(plan: Plan, passes: (amount: number) => boolean, options: SustainableSpendingOptions = {}) {
    const ctx = evaluation.createDecisionContext(plan, simOptions())
    const reference = evaluation.evaluateCandidate(ctx, {
      id: 'r4-shape', source: 'search', category: 'spending', label: 'Shape', explanation: 'Schema scaffolding only',
    })
    const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
      const amount = (candidate.planPatch!['expenses'] as { baseAnnual: number }).baseAnnual
      return {
        ...reference,
        recommendationState: 'beneficial',
        candidateResult: { ...reference.candidateResult, depletionYear: passes(amount) ? null : 2030 },
        candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: 0 },
      }
    })
    try {
      return { result: solveMaxSustainableSpending(ctx, { resolutionDollars: 500, ...options }), probes: probedAmounts(spy) }
    } finally {
      spy.mockRestore()
    }
  }

  function planAt(baseAnnual: number, mode?: 'withdrawalRateGuardrails' | 'riskBasedGuardrails'): Plan {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = baseAnnual
    if (mode !== undefined) plan.expenses.spendingPolicy = { mode }
    return plan
  }

  const probeSequence = [40_000, 80_000, 60_000, 70_000, 65_000, 62_500, 63_750, 63_125, 62_813]

  it('publishes the probe rounded down to $100 at fixed-target spending, without another run', () => {
    const { result, probes } = solveWith(planAt(40_000), (amount) => amount <= 62_850)
    expect(probes).toEqual(probeSequence)
    expect(result.feasibleBaseAnnual).toBe(62_813)
    expect(result.maxBaseAnnual).toBe(62_800)
    expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
    expect(result.spendingSlackDollars).toBe(22_800)
    expect(result.simulationCount).toBe(9)
    expect(result.bestEvaluation).not.toBeNull()
  })

  it('runs the rounded amount once more under guardrails and publishes it when it passes', () => {
    for (const mode of ['withdrawalRateGuardrails', 'riskBasedGuardrails'] as const) {
      const { result, probes } = solveWith(planAt(40_000, mode), (amount) => amount <= 62_850)
      expect(probes).toEqual([...probeSequence, 62_800])
      expect(result.maxBaseAnnual).toBe(62_800)
      expect(result.feasibleBaseAnnual).toBe(62_813)
      expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
      expect(result.spendingSlackDollars).toBe(22_800)
      expect(result.simulationCount).toBe(10)
      expect(result.diagnostics).toEqual([])
    }
  })

  it('publishes the exact amount that passed, and says why, when the rounded amount fails under guardrails', () => {
    // A lower level failing where a higher one passed: what guardrails can do.
    const { result, probes } = solveWith(
      planAt(40_000, 'withdrawalRateGuardrails'),
      (amount) => amount <= 62_850 && amount !== 62_800,
    )
    expect(probes).toEqual([...probeSequence, 62_800])
    expect(result.maxBaseAnnual).toBe(62_813)
    expect(result.feasibleBaseAnnual).toBe(62_813)
    expect(result.maxBaseAnnualRounding).toBe('none')
    expect(result.spendingSlackDollars).toBe(22_813)
    expect(result.simulationCount).toBe(10)
    expect(result.diagnostics).toHaveLength(1)
    expect(isExactAnswerDiagnostic(result.diagnostics[0]!)).toBe(true)
    expect(result.diagnostics[0]).toContain('$62,800/yr')
    expect(result.diagnostics[0]).toContain('runs out of money')
  })

  it('runs nothing more under guardrails when the passing probe is already a whole $100', () => {
    const { result, probes } = solveWith(planAt(40_000, 'withdrawalRateGuardrails'), (amount) => amount <= 62_500)
    expect(result.feasibleBaseAnnual).toBe(62_500)
    expect(result.maxBaseAnnual).toBe(62_500)
    expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
    expect(result.simulationCount).toBe(probes.length)
    expect(probes.filter((amount) => amount === 62_500)).toHaveLength(1)
  })

  it('never publishes a rounded amount below the required spending floor', () => {
    // Seed 40,060 passes and every higher probe fails, so the answer is
    // 40,060; rounded down it would be 40,000, below the 40,050 floor the plan
    // checks require.
    const plan = planAt(40_060)
    plan.expenses.requiredAnnual = 40_050
    const { result, probes } = solveWith(plan, (amount) => amount <= 40_060)
    expect(result.feasibleBaseAnnual).toBe(40_060)
    expect(result.maxBaseAnnual).toBe(40_060)
    expect(result.maxBaseAnnualRounding).toBe('none')
    expect(result.spendingSlackDollars).toBe(0)
    expect(probes).not.toContain(40_000)
    expect(
      result.diagnostics.some((message) => isExactAnswerDiagnostic(message) && message.includes('required spending floor')),
    ).toBe(true)
  })

  it('publishes the withdrawal rate of the published amount over the solved plan balances', () => {
    const plan = planAt(40_000)
    const { result } = solveWith(plan, (amount) => amount <= 62_850)
    expect(result.initialWithdrawalRatePct).toBe((62_800 / startingInvestableOf(plan)) * 100)
  })

  it('checks the rounded amount under guardrails even when the search ends on its simulation budget', () => {
    // With a budget of 9 and a $100 resolution the ninth probe (62,813) spends
    // the budget while the bracket (62,813 to 63,125) is still open; the check
    // of 62,800 is a tenth run, outside the budget, whichever way it goes.
    const options = { maxSimulations: 9, resolutionDollars: 100 }
    for (const mode of ['withdrawalRateGuardrails', 'riskBasedGuardrails'] as const) {
      const passed = solveWith(planAt(40_000, mode), (amount) => amount <= 62_850, options)
      expect(passed.probes).toEqual([...probeSequence, 62_800])
      expect(passed.result.converged).toBe(false)
      expect(passed.result.simulationCount).toBe(10)
      expect(passed.result.maxBaseAnnual).toBe(62_800)
      expect(passed.result.maxBaseAnnualRounding).toBe('down-to-hundred')
      const failed = solveWith(planAt(40_000, mode), (amount) => amount <= 62_850 && amount !== 62_800, options)
      expect(failed.probes).toEqual([...probeSequence, 62_800])
      expect(failed.result.simulationCount).toBe(10)
      expect(failed.result.maxBaseAnnual).toBe(62_813)
      expect(failed.result.maxBaseAnnualRounding).toBe('none')
      expect(failed.result.diagnostics.some(isExactAnswerDiagnostic)).toBe(true)
    }
    // Fixed-target spending on the same budget publishes the rounded amount without a tenth run.
    const fixed = solveWith(planAt(40_000), (amount) => amount <= 62_850, options)
    expect(fixed.probes).toEqual(probeSequence)
    expect(fixed.result.simulationCount).toBe(9)
    expect(fixed.result.maxBaseAnnual).toBe(62_800)
  })

  it('publishes nulls with no answer', () => {
    const { result } = solveWith(planAt(40_000), () => false)
    expect(result.maxBaseAnnual).toBeNull()
    expect(result.feasibleBaseAnnual).toBeNull()
    expect(result.maxBaseAnnualRounding).toBeNull()
    expect(result.spendingSlackDollars).toBeNull()
    expect(result.initialWithdrawalRatePct).toBeNull()
  })
})

describe('roundSolvedSpending and initialWithdrawalRatePct', () => {
  it('rounds whole dollars down to $100 exactly and refuses what is not a spending amount', () => {
    for (let amount = 0; amount <= 200_000; amount++) {
      expect(roundSolvedSpending(amount)).toBe(amount - (amount % 100))
    }
    for (const amount of [2 ** 40 + 99, 2 ** 52 + 1, 2 ** 53 - 1]) {
      expect(roundSolvedSpending(amount)).toBe(amount - (amount % 100))
    }
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => roundSolvedSpending(bad)).toThrow(RangeError)
    }
  })

  it('is null without a positive balance and refuses what is not a rate input', () => {
    expect(initialWithdrawalRatePct(62_800, 0)).toBeNull()
    expect(initialWithdrawalRatePct(62_800, -5)).toBeNull()
    expect(() => initialWithdrawalRatePct(-1, 100)).toThrow(RangeError)
    expect(() => initialWithdrawalRatePct(Number.NaN, 100)).toThrow(RangeError)
    expect(() => initialWithdrawalRatePct(1, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('solveMaxSustainableSpending: what else it publishes about the answer', () => {
  function solveWith(
    plan: Plan,
    passes: (amount: number) => boolean,
    options: SustainableSpendingOptions = {},
  ) {
    const ctx = evaluation.createDecisionContext(plan, simOptions())
    const reference = evaluation.evaluateCandidate(ctx, {
      id: 'r4-shape', source: 'search', category: 'spending', label: 'Shape', explanation: 'Schema scaffolding only',
    })
    const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
      const amount = (candidate.planPatch!['expenses'] as { baseAnnual: number }).baseAnnual
      return {
        ...reference,
        recommendationState: 'beneficial',
        candidateResult: { ...reference.candidateResult, depletionYear: passes(amount) ? null : 2030 },
        candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: 0 },
      }
    })
    try {
      return { result: solveMaxSustainableSpending(ctx, { resolutionDollars: 500, ...options }), probes: probedAmounts(spy) }
    } finally {
      spy.mockRestore()
    }
  }

  function planAt(baseAnnual: number, requiredAnnual?: number, mode?: 'withdrawalRateGuardrails'): Plan {
    const plan = noTraditionalPlan()
    plan.expenses.baseAnnual = baseAnnual
    if (requiredAnnual !== undefined) plan.expenses.requiredAnnual = requiredAnnual
    if (mode !== undefined) plan.expenses.spendingPolicy = { mode }
    return plan
  }

  it("says whether today's base passes, from the first probe, whatever the published amount's sign of slack", () => {
    // A $72,030 base that passes and is the answer: published 72,000, slack −30, sustained.
    const held = solveWith(planAt(72_030), (amount) => amount <= 72_030)
    expect(held.result.maxBaseAnnual).toBe(72_000)
    expect(held.result.spendingSlackDollars).toBe(-30)
    expect(held.result.sustainsCurrentBase).toBe(true)
    // A base above the frontier: not sustained.
    const over = solveWith(planAt(72_030), (amount) => amount <= 60_000)
    expect(over.result.sustainsCurrentBase).toBe(false)
    // Amortized spending runs no probe: no verdict.
    const abwPlan = planAt(72_030)
    abwPlan.expenses.spendingPolicy = { mode: 'abw' }
    expect(solveWith(abwPlan, () => true).result.sustainsCurrentBase).toBeNull()
  })

  it('publishes a rounded amount equal to the required floor without another run, and reuses a probe already made', () => {
    // Seed 41,000 fails; the whole-hundred floor 40,000 passes; the search
    // ends at 40,032, which rounds down to exactly the floor.
    const passes = (amount: number) => amount <= 40_060
    for (const mode of [undefined, 'withdrawalRateGuardrails'] as const) {
      const { result, probes } = solveWith(planAt(41_000, 40_000, mode), passes, { resolutionDollars: 50 })
      expect(probes, String(mode)).toEqual([41_000, 40_000, 40_500, 40_250, 40_125, 40_063, 40_032])
      expect(result.feasibleBaseAnnual).toBe(40_032)
      expect(result.maxBaseAnnual).toBe(40_000)
      expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
      // Under guardrails the floor probe already ran at 40,000 and passed.
      expect(result.simulationCount).toBe(probes.length)
      expect(result.diagnostics.some(isExactAnswerDiagnostic)).toBe(false)
    }
  })

  it('takes the withdrawal rate over the plan it solved, with any base patch applied', () => {
    const plan = planAt(40_000)
    const patched = noTraditionalPlan()
    const cash = { ...patched.accounts[2]!, balance: 1_000_000 }
    const { result } = solveWith(plan, (amount) => amount <= 62_850, { basePatch: { accounts: [cash] } })
    expect(result.maxBaseAnnual).toBe(62_800)
    expect(result.initialWithdrawalRatePct).toBe((62_800 / 1_000_000) * 100)
    expect(result.initialWithdrawalRatePct).not.toBe((62_800 / startingInvestableOf(plan)) * 100)
  })
})
