/**
 * Engine tests for penalty-free early access (roadmap V8, §4):
 *   - Rule of 55: no 10% penalty on an employer plan separated from at 55+.
 *   - 72(t) SEPP: a forced, penalty-free, taxable distribution in the window.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'
import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'

let counter = 0
const ids = () => `ea-${++counter}`
const noTax = createFlatTaxCalculator(0)

/** Single filer who is 56 in 2026, with one traditional account and nothing else liquid. */
function pre60Plan(over: { kind: 'ira' | 'employer'; retirementAge: number }): Plan {
  const plan = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1970-03-15', // age 56 in 2026
    sex: 'average',
    retirementAge: over.retirementAge,
    longevity: { planningAge: 70, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  const trad: Account = { type: 'traditional', id: ids(), name: 'Plan', ownerPersonId: 'p1', annualReturnPct: null, kind: over.kind, balance: 500_000, annualContribution: 0 }
  plan.accounts = [trad]
  return plan
}

function run(plan: Plan) {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return simulatePlan(r.plan, { startYear: 2026, taxCalculator: noTax })
}

describe('Rule of 55', () => {
  it('waives the 10% penalty on an employer plan separated from at 55+', () => {
    const result = run(pre60Plan({ kind: 'employer', retirementAge: 56 }))
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.withdrawals.traditional).toBeCloseTo(40_000, 0) // funded the spend
    expect(y2026.penalties).toBe(0)
  })

  // Funding $40k of spend plus its own 10% penalty needs a $40,000/0.9 draw, so
  // the penalty is 40,000/9 ≈ $4,444 (the penalty is itself a cash cost).
  const PENALTY_ON_40K = 40_000 / 9

  it('still penalizes an IRA (Rule of 55 never applies to IRAs)', () => {
    const result = run(pre60Plan({ kind: 'ira', retirementAge: 56 }))
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.penalties).toBeCloseTo(PENALTY_ON_40K, 0)
  })

  it('still penalizes an employer plan separated from before 55', () => {
    const result = run(pre60Plan({ kind: 'employer', retirementAge: 53 }))
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.penalties).toBeCloseTo(PENALTY_ON_40K, 0)
  })

  it('charges no penalty once past 59½ regardless', () => {
    const result = run(pre60Plan({ kind: 'ira', retirementAge: 56 }))
    const y2030 = result.years.find((y) => y.year === 2030)! // age 60
    expect(y2030.penalties).toBe(0)
  })
})

describe('72(t) SEPP', () => {
  /** IRA so the Rule of 55 can't interfere; plenty of cash so spending never forces extra IRA draws. */
  function seppPlan(method: 'rmd' | 'amortization'): Plan {
    const plan = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1970-03-15', // age 56 in 2026
      sex: 'average',
      retirementAge: 56,
      longevity: { planningAge: 70, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 5_000 // small; funded from cash, never forces IRA draws
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [
      { type: 'traditional', id: 'ira1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 500_000, annualContribution: 0, sepp: { startAge: 56, method } } as Account,
      { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 200_000, annualContribution: 0 } as Account,
    ]
    return plan
  }

  it('takes a penalty-free forced distribution sized by the RMD method', () => {
    const result = run(seppPlan('rmd'))
    const y2026 = result.years.find((y) => y.year === 2026)!
    const le = baselineRemainingYears(56, 'average')
    expect(y2026.sepp).toBeCloseTo(500_000 / le, -1) // within ~$10 of balance ÷ life expectancy
    expect(y2026.penalties).toBe(0)
    expect(y2026.withdrawals.traditional).toBeCloseTo(y2026.sepp, 0)
  })

  it('amortization pays more than the RMD method', () => {
    const rmd = run(seppPlan('rmd')).years.find((y) => y.year === 2026)!.sepp
    const amort = run(seppPlan('amortization')).years.find((y) => y.year === 2026)!.sepp
    expect(amort).toBeGreaterThan(rmd)
    expect(amort).toBeGreaterThan(0)
  })

  it('stops after the longer of 5 years or 59½ (no SEPP at age 62)', () => {
    const result = run(seppPlan('rmd'))
    const y2032 = result.years.find((y) => y.year === 2032)! // age 62
    expect(y2032.sepp).toBe(0)
  })
})

describe('inherited IRA — SECURE Act 10-year rule', () => {
  /** Young beneficiary (age 50 in 2026) who inherited an IRA; owner died 2022. */
  function inheritedPlan(opts: { decedentHadStartedRmds: boolean; baseAnnual: number; withCash: boolean }): Plan {
    const plan = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1976-03-15', // age 50 in 2026
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = opts.baseAnnual
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [
      { type: 'traditional', id: 'inh1', name: 'Inherited IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0, inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: opts.decedentHadStartedRmds } } as Account,
      ...(opts.withCash ? [{ type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 200_000, annualContribution: 0 } as Account] : []),
    ]
    return plan
  }

  it('forces a penalty-free single-life RMD in the window when the decedent had started', () => {
    const result = run(inheritedPlan({ decedentHadStartedRmds: true, baseAnnual: 5_000, withCash: true }))
    const y2026 = result.years.find((y) => y.year === 2026)! // year 4 of the window
    expect(y2026.inheritedDistribution).toBeGreaterThan(0)
    expect(y2026.rmd).toBe(0) // not a normal (Uniform Lifetime) RMD — the beneficiary is only 50
    expect(y2026.penalties).toBe(0) // inherited distributions are never penalized
    expect(y2026.withdrawals.traditional).toBeGreaterThanOrEqual(y2026.inheritedDistribution - 1)
  })

  it('forces no annual distribution when the decedent had not started RMDs', () => {
    const result = run(inheritedPlan({ decedentHadStartedRmds: false, baseAnnual: 5_000, withCash: true }))
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.inheritedDistribution).toBe(0)
  })

  it('empties the account by the 10th year after death (2032)', () => {
    const result = run(inheritedPlan({ decedentHadStartedRmds: false, baseAnnual: 5_000, withCash: true }))
    const y2032 = result.years.find((y) => y.year === 2032)!
    expect(y2032.inheritedDistribution).toBeGreaterThan(0) // the final sweep
    expect(y2032.balances['inh1'] ?? 0).toBeCloseTo(0, 2)
  })

  it('does not penalize need-based withdrawals from an inherited account pre-59½', () => {
    // No cash, high spending: spending must come from the inherited IRA, but the
    // beneficiary is 50. Without the inherited carve-out this would be penalized.
    const result = run(inheritedPlan({ decedentHadStartedRmds: false, baseAnnual: 40_000, withCash: false }))
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.withdrawals.traditional).toBeGreaterThanOrEqual(40_000 - 1)
    expect(y2026.penalties).toBe(0)
  })
})
