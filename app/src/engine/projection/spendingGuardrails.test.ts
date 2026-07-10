import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'
import type { MarketSeries } from './types'
import { cashAccount, runPlan, singlePersonPlan, taxableAccount, validatePlan } from '../../testSupport/planFixtures'
import { HISTORICAL_YEARS } from '../montecarlo/historicalReturns'
import type { Plan } from '../model/plan'

const noTax = createFlatTaxCalculator(0)

/** A declining single-retiree plan: $300k cash losing 6%/yr, $30k target / $18k floor. */
function decliningPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
  const cash = cashAccount('cash', 300_000)
  cash.annualReturnPct = -6
  plan.accounts = [cash]
  plan.expenses.baseAnnual = 30_000
  plan.expenses.requiredAnnual = 18_000
  return plan
}

describe('withdrawal-rate spending guardrails', () => {
  it("preserves today's behavior when the policy is absent (required floor is inert)", () => {
    const withFloor = decliningPlan()
    const withoutFloor = decliningPlan()
    delete withoutFloor.expenses.requiredAnnual

    const a = runPlan(withFloor, noTax)
    const b = runPlan(withoutFloor, noTax)

    expect(a.depletionYear).toBe(b.depletionYear)
    expect(a.years.map((y) => Math.round(y.expenses.total))).toEqual(b.years.map((y) => Math.round(y.expenses.total)))
    for (const y of a.years) {
      expect(y.expenses.guardrailFactor).toBe(1)
      expect(y.guardrailAction).toBe('hold')
    }
  })

  it('keeps flexible-goal counters at zero when guardrails are absent', () => {
    const plan = decliningPlan()
    plan.expenses.oneTimeGoals = [{ id: 'car', label: 'Car', year: 2030, amount: 20_000 }]

    const result = runPlan(plan, noTax)
    const goalYear = result.years.find((y) => y.year === 2030)!

    expect(goalYear.expenses.oneTimeGoals).toBeGreaterThan(0)
    expect(goalYear.flexibleGoals).toEqual({
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    })
  })

  it('rations discretionary spending and protects the floor under guardrails', () => {
    const control = decliningPlan()
    const guarded = decliningPlan()
    guarded.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }

    const c = runPlan(control, noTax)
    const g = runPlan(guarded, noTax)

    const cutYears = g.years.filter((y) => y.guardrailAction === 'cut')
    expect(cutYears.length).toBeGreaterThan(0)
    for (const y of cutYears) expect(y.expenses.guardrailFactor).toBeLessThan(1)

    const spent = (p: typeof c) => p.years.reduce((s, y) => s + y.expenses.total, 0)
    expect(spent(g)).toBeLessThan(spent(c))

    const depletion = (p: typeof c) => p.depletionYear ?? Infinity
    expect(depletion(g)).toBeGreaterThan(depletion(c))

    for (const y of g.years) {
      expect(y.expenses.baseSpending).toBeGreaterThanOrEqual(18_000 - 0.01)
      expect(y.expenses.requiredSpending).toBeGreaterThanOrEqual(18_000 - 0.01)
    }
    const firstShortfallYear = g.depletionYear ?? Infinity
    for (const y of g.years) {
      if (y.year < firstShortfallYear) expect(y.requiredShortfall).toBe(0)
    }
  })

  it('records a target-lifestyle miss for the deliberate cut, distinct from required', () => {
    const guarded = decliningPlan()
    guarded.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    const g = runPlan(guarded, noTax)

    const cutYear = g.years.find((y) => y.guardrailAction === 'cut' && y.requiredShortfall === 0)!
    expect(cutYear).toBeDefined()
    expect(cutYear.targetShortfall).toBeGreaterThan(0)
    expect(cutYear.requiredShortfall).toBe(0)
    expect(cutYear.expenses.total).toBeLessThan(cutYear.expenses.targetSpending)
  })

  it('defers a movable goal while cutting and reports a shortfall if still unaffordable at latestYear', () => {
    const plan = decliningPlan()
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.expenses.oneTimeGoals = [
      {
        id: 'car',
        label: 'Car',
        year: 2030,
        amount: 20_000,
        classification: 'ideal',
        flexibility: 'movable',
        latestYear: 2036,
      },
    ]
    const g = runPlan(plan, noTax)
    const deferredSomewhere = g.years.some((y) => y.flexibleGoals.deferred > 0)
    const skippedAtWindowEnd = g.years.some((y) => y.year === 2036 && y.flexibleGoals.skipped > 0)
    expect(deferredSomewhere).toBe(true)
    expect(skippedAtWindowEnd).toBe(true)
    expect(g.years.filter((y) => y.year > 2036).every((y) => y.flexibleGoals.funded + y.flexibleGoals.skipped === 0)).toBe(true)
    const skipYear = g.years.find((y) => y.year === 2036)!
    expect(skipYear.idealShortfall).toBeGreaterThanOrEqual(20_000 - 0.01)
  })

  it('counts a skipped excess goal as an excess miss, not target lifestyle', () => {
    const plan = decliningPlan()
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.expenses.oneTimeGoals = [
      {
        id: 'lux-trip',
        label: 'Luxury trip',
        year: 2033,
        amount: 25_000,
        classification: 'excess',
        flexibility: 'skippable',
        latestYear: 2034,
      },
    ]
    const g = runPlan(plan, noTax)
    const skipYear = g.years.find((y) => y.flexibleGoals.skipped > 0)
    expect(skipYear).toBeDefined()
    // Target may also be short in a cut year, but the skipped excess goal is
    // reported separately in the excess layer instead of being hidden.
    expect(skipYear!.targetShortfall).toBeGreaterThanOrEqual(0)
    expect(skipYear!.excessShortfall).toBeGreaterThanOrEqual(25_000 - 0.01)
  })

  it('funds annual ideal/excess layers only after target is restored under guardrails', () => {
    const plan = decliningPlan()
    const strongCash = cashAccount('cash', 1_000_000)
    strongCash.annualReturnPct = 20
    plan.accounts = [strongCash]
    plan.expenses.idealAnnual = 5_000
    plan.expenses.excessAnnual = 5_000
    plan.expenses.spendingPolicy = {
      mode: 'withdrawalRateGuardrails',
      lowerGuardrailPct: 95,
      upperGuardrailPct: 200,
      adjustmentPct: 50,
      allowRaisesAboveTarget: true,
    }
    const result = runPlan(plan, noTax)
    const raiseYear = result.years.find((y) => y.guardrailAction === 'raise')
    expect(raiseYear).toBeDefined()
    expect(raiseYear!.expenses.total).toBeGreaterThan(raiseYear!.expenses.targetSpending)
    expect(raiseYear!.idealShortfall + raiseYear!.excessShortfall).toBeLessThan(
      raiseYear!.expenses.idealSpending + raiseYear!.expenses.excessSpending,
    )
  })
})

describe('risk-based spending guardrails (ledger)', () => {
  it('is inert without solved thresholds — identical to fixed target', () => {
    const control = decliningPlan()
    const riskPlan = decliningPlan()
    riskPlan.expenses.spendingPolicy = { mode: 'riskBasedGuardrails' }

    const c = runPlan(control, noTax)
    const r = runPlan(riskPlan, noTax)

    expect(r.depletionYear).toBe(c.depletionYear)
    expect(r.years.map((y) => y.expenses.total)).toEqual(c.years.map((y) => y.expenses.total))
    for (const y of r.years) {
      expect(y.expenses.guardrailFactor).toBe(1)
      expect(y.guardrailAction).toBe('hold')
    }
  })

  it('cuts below the lower dollar threshold and protects the required floor', () => {
    const control = decliningPlan()
    const guarded = decliningPlan()
    guarded.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      lowerBalanceThresholdPct: 80,
      upperBalanceThresholdPct: 200,
    }

    const c = runPlan(control, noTax)
    const g = runPlan(guarded, noTax)

    const cutYears = g.years.filter((y) => y.guardrailAction === 'cut')
    expect(cutYears.length).toBeGreaterThan(0)
    for (const y of cutYears) expect(y.expenses.guardrailFactor).toBeLessThan(1)

    const spent = (p: typeof c) => p.years.reduce((s, y) => s + y.expenses.total, 0)
    expect(spent(g)).toBeLessThan(spent(c))

    const depletion = (p: typeof c) => p.depletionYear ?? Infinity
    expect(depletion(g)).toBeGreaterThan(depletion(c))

    for (const y of g.years) {
      expect(y.expenses.baseSpending).toBeGreaterThanOrEqual(18_000 - 0.01)
      expect(y.expenses.requiredSpending).toBeGreaterThanOrEqual(18_000 - 0.01)
    }
  })

  it('raises into upside layers when the balance clears the upper threshold', () => {
    const plan = decliningPlan()
    const strongCash = cashAccount('cash', 300_000)
    strongCash.annualReturnPct = 15
    plan.accounts = [strongCash]
    plan.expenses.idealAnnual = 5_000
    plan.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      lowerBalanceThresholdPct: 60,
      upperBalanceThresholdPct: 120,
      adjustmentPct: 50,
      allowRaisesAboveTarget: true,
    }
    const result = runPlan(plan, noTax)
    const raiseYear = result.years.find((y) => y.guardrailAction === 'raise')
    expect(raiseYear).toBeDefined()
    expect(raiseYear!.expenses.total).toBeGreaterThan(raiseYear!.expenses.targetSpending)
  })
})

/**
 * The 2007-retiree fixture (risk-based-guardrails plan, step 2 acceptance):
 * replay the realized 2007+ market sequence against the same household under
 * both guardrail modes. Guyton–Klinger's withdrawal-rate trigger stacks cuts
 * through 2008–09 while the rate stays above the band; the risk-based dollar
 * threshold (set well below the starting balance, where the plan's success
 * probability would actually leave the band) tolerates the drawdown and cuts
 * far less — the published case-study delta the methodology page cites.
 */
describe('2007 retiree: withdrawal-rate vs risk-based delta', () => {
  function market2007(projectionYears: number): MarketSeries {
    const start = HISTORICAL_YEARS.findIndex((y) => y.year === 2007)
    expect(start).toBeGreaterThan(-1)
    const returnShockPct: number[] = []
    const inflationPct: number[] = []
    for (let i = 0; i < projectionYears; i++) {
      const sample = HISTORICAL_YEARS[start + (i % (HISTORICAL_YEARS.length - start))]!
      returnShockPct.push(sample.stocksPct * 0.6 + sample.bondsPct * 0.4)
      inflationPct.push(sample.inflationPct)
    }
    return { returnShockPct, inflationPct }
  }

  function retiree2007(): Plan {
    const plan = singlePersonPlan({ dob: '1942-01-01', planningAge: 82 })
    // The market series carries the whole return: the account's own expected
    // return is zero, so the shock equals the realized 60/40 year.
    const brokerage = taxableAccount('brokerage', 1_000_000, 1_000_000)
    brokerage.annualReturnPct = 0
    plan.accounts = [brokerage]
    plan.expenses.baseAnnual = 45_000
    plan.expenses.requiredAnnual = 27_000
    return plan
  }

  function run2007(plan: Plan) {
    const market = market2007(18)
    return simulatePlan(validatePlan(plan), { startYear: 2007, taxCalculator: noTax, market })
  }

  it('forces far deeper cuts under withdrawal-rate guardrails than risk-based thresholds', () => {
    const gkPlan = retiree2007()
    gkPlan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }

    const riskPlan = retiree2007()
    riskPlan.expenses.spendingPolicy = {
      mode: 'riskBasedGuardrails',
      // Representative solved band edges: success leaves the 70–95 band only
      // when the real balance is far below (or well above) the starting level.
      lowerBalanceThresholdPct: 55,
      upperBalanceThresholdPct: 160,
    }

    const gk = run2007(gkPlan)
    const risk = run2007(riskPlan)

    const maxCut = (r: typeof gk) => Math.max(...r.years.map((y) => 1 - y.expenses.guardrailFactor))
    const cutYears = (r: typeof gk) => r.years.filter((y) => y.expenses.guardrailFactor < 1 - 1e-9).length

    // Both modes protect the essential floor for the whole horizon.
    expect(gk.depletionYear).toBeNull()
    expect(risk.depletionYear).toBeNull()
    for (const y of [...gk.years, ...risk.years]) expect(y.requiredShortfall).toBe(0)

    // The 2008–09 drawdown pushes the withdrawal rate over the band and stacks
    // cuts; the dollar threshold tolerates it. This is the case-study delta.
    expect(maxCut(gk)).toBeGreaterThan(maxCut(risk) + 0.1)
    expect(cutYears(gk)).toBeGreaterThan(cutYears(risk))

    const spent = (r: typeof gk) => r.years.reduce((s, y) => s + y.expenses.total, 0)
    expect(spent(risk)).toBeGreaterThan(spent(gk))
  })
})
