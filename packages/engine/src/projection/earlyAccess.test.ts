/**
 * Engine tests for penalty-free early access (roadmap V8, §4):
 *   - Rule of 55: no 10% penalty on an employer plan separated from at 55+.
 *   - 72(t) SEPP: a forced, penalty-free, taxable distribution in the window.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

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
    // Single Life Table entry at 56 is 30.6 years (Treas. Reg. 1.401(a)(9)-9(b)),
    // one of the three tables IRS Notice 2022-6 section 3.02(a) permits. This
    // previously read the SSA period table's 25.815 years, which is not among
    // them and sized the payment about 19 percent too high.
    expect(y2026.sepp).toBeCloseTo(500_000 / 30.6, 6)
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

  /**
   * Same household, but the account earns 5% so every year's balance is a
   * different number. That is what lets a fixture see WHICH balance the
   * amortization method was calculated from, and whether it was recalculated.
   */
  function growingSeppPlan(): Plan {
    const plan = seppPlan('amortization')
    plan.assumptions.defaultReturnPct = 5
    return plan
  }

  describeRule('notice-2022-6-3-02-d-account-balance-valuation-window', {
    // The account balance, in dollars, that the first fixed-amortization
    // payment was calculated from. Recovered from the payment by dividing out
    // the level-payment factor for a 30.6-year Single Life divisor at 5%, so
    // the fixture reads a balance rather than restating a payment.
    //
    // Section 3.02(d) treats the balance as reasonably determined if it is "the
    // account balance on any date within the period that begins on December 31
    // of the year prior to the date of the first distribution and ends on the
    // date of the first distribution". The projection's start-of-year balance
    // is the prior December 31 balance, captured before any of the year's
    // flows, so it opens that window exactly: $500,000.
    //
    // The rejected reading moves the valuation one year down the window's own
    // wording — December 31 OF the first distribution year rather than of the
    // year prior — which is a date after the window has closed. On these facts
    // that is $525,000 after a year of 5% growth, and it would size every
    // payment in the series 5% high.
    readings: {
      decemberThirtyFirstBeforeTheFirstDistribution: 500_000,
      decemberThirtyFirstAfterTheFirstDistributionYear: 525_000,
    },
    accepted: 'decemberThirtyFirstBeforeTheFirstDistribution',
  }, ({ accepted, readings }) => {
    it('amortizes the balance at the opening of the valuation window', () => {
      const y2026 = run(growingSeppPlan()).years.find((y) => y.year === 2026)!
      const levelPaymentFactor = 0.05 / (1 - Math.pow(1.05, -30.6))
      const balanceAmortized = Math.round(y2026.sepp / levelPaymentFactor)
      expect(balanceAmortized).toBe(accepted)
      expect(balanceAmortized).not.toBe(readings.decemberThirtyFirstAfterTheFirstDistributionYear)
    })
  })

  describeRule('notice-2022-6-3-01-b-level-amortization', {
    note: 'projection: the payment is fixed for the whole series',
    // The 2027 payment, in dollars and cents, for a series that began in 2026.
    //
    // Section 3.01(b): "once the account balance, the number of years from the
    // chosen life expectancy table, and the resulting annual payment are
    // determined for the first distribution year, the annual payment is the
    // same amount in each succeeding distribution year." So the 2026 figure —
    // 500,000 x 0.05 / (1 - 1.05^-30.6) = 32,245.68 — has to reappear unchanged.
    //
    // The rejected reading is the redetermination that section 3.01(a) gives to
    // the required minimum distribution method and pointedly withholds from
    // this one: a new balance and a new divisor every year. Shown here on the
    // first year's balance at the age-57 divisor of 29.8, which is 32,622.01 —
    // and against the actual 2027 balance it would differ again.
    readings: {
      sameAmountInEachSucceedingYear: 32_245.68,
      redeterminedLikeTheRequiredMinimumDistributionMethod: 32_622.01,
    },
    accepted: 'sameAmountInEachSucceedingYear',
  }, ({ accepted, readings }) => {
    it('repeats the first distribution year’s payment unchanged', () => {
      const years = run(growingSeppPlan()).years
      const y2026 = years.find((y) => y.year === 2026)!
      const y2027 = years.find((y) => y.year === 2027)!
      const y2028 = years.find((y) => y.year === 2028)!
      expect(Math.round(y2027.sepp * 100) / 100).toBe(accepted)
      expect(Math.round(y2027.sepp * 100) / 100)
        .not.toBe(readings.redeterminedLikeTheRequiredMinimumDistributionMethod)
      expect(y2027.sepp).toBe(y2026.sepp)
      expect(y2028.sepp).toBe(y2026.sepp)
    })
  })
})

/**
 * IRC 72(t)(3)(B): a series drawn from a 401(a) trust or a 72(e)(5)(D)(ii)
 * contract is excepted only if it "begins after the employee separates from
 * service"; the paragraph does not reach individual retirement accounts.
 *
 * Two readings were available and they disagree on the same facts. Under the
 * statute, a participant aged 56 who elected a SEPP on a 401(k) but plans to
 * work until 65 has no exception at all, so the projection should pay no
 * penalty-free SEPP from that account: $0. Under the reading the projection
 * previously took — the one 72(t)(3)(B) exists to rule out, that an employer
 * plan behaves like an IRA — the same participant draws the full
 * 500,000 / 30.6 = 16,339.87 a year penalty-free while still employed.
 *
 * Plain `it`s rather than a describeRule fixture because what the projection
 * implements is a proxy, registered as irc-72-t-3-B-sepp-separation-annual-proxy
 * and therefore out of scope: it orders calendar years, not days, and tests no
 * employer identity. The exact-date reading is covered where it lives, in
 * actions/traditionalEmployerPlanPenaltyPrerequisite.test.ts.
 */
describe('72(t)(3)(B) — employer-plan SEPP must begin after separation', () => {
  const SERIES_BEGINS_AFTER_SEPARATION = 500_000 / 30.6
  const NO_EXCEPTION_WITHOUT_SEPARATION = 0

  function employerSeppPlan(over: {
    kind: 'ira' | 'employer'
    retirementAge: number | null
  }): Plan {
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
    plan.expenses.baseAnnual = 5_000 // funded from cash, so nothing forces a draw
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.accounts = [
      { type: 'traditional', id: 'plan1', name: 'Plan', ownerPersonId: 'p1', annualReturnPct: null, kind: over.kind, balance: 500_000, annualContribution: 0, sepp: { startAge: 56, method: 'rmd' } } as Account,
      { type: 'cash', id: ids(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 200_000, annualContribution: 0 } as Account,
    ]
    return plan
  }

  function sepp2026(plan: Plan): number {
    return run(plan).years.find((y) => y.year === 2026)!.sepp
  }

  it('pays nothing from an employer plan while the participant is still working', () => {
    // Elects at 56, works to 65: the series would begin nine years before
    // separation, so 72(t)(2)(A)(iv) never applies to it.
    expect(sepp2026(employerSeppPlan({ kind: 'employer', retirementAge: 65 })))
      .toBe(NO_EXCEPTION_WITHOUT_SEPARATION)
  })

  it('pays from an employer plan once the series begins in a separated year', () => {
    expect(sepp2026(employerSeppPlan({ kind: 'employer', retirementAge: 56 })))
      .toBeCloseTo(SERIES_BEGINS_AFTER_SEPARATION, 6)
  })

  it('pays from an employer plan the participant left before electing', () => {
    expect(sepp2026(employerSeppPlan({ kind: 'employer', retirementAge: 50 })))
      .toBeCloseTo(SERIES_BEGINS_AFTER_SEPARATION, 6)
  })

  it('pays nothing from an employer plan when the plan states no retirement age', () => {
    // No retirement age is no separation, and the projection has no other fact
    // that could establish one.
    expect(sepp2026(employerSeppPlan({ kind: 'employer', retirementAge: null })))
      .toBe(NO_EXCEPTION_WITHOUT_SEPARATION)
  })

  it('still pays from an IRA during employment, because 72(t)(3)(B) does not reach IRAs', () => {
    expect(sepp2026(employerSeppPlan({ kind: 'ira', retirementAge: 65 })))
      .toBeCloseTo(SERIES_BEGINS_AFTER_SEPARATION, 6)
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
