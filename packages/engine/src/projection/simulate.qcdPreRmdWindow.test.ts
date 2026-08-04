import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026

function ira(id: string, balance: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function employerPlan(id: string, balance: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'employer')
  if (account.type !== 'traditional') throw new Error('expected employer plan')
  return { ...account, annualReturnPct: 0 }
}

function run(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

/**
 * A 1956 birth year has an RMD applicable age of 75, so nothing in these plans
 * has an RMD in 2026. That is the whole point: before this window was modelled,
 * the QCD was gated on `rmdTotal > 0` and every one of these cases produced zero.
 */
function planFor(dob: string, qcdAnnual: number): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 90 })
  plan.id = `qcd-pre-rmd-${dob}`
  plan.accounts = [ira('ira', 500_000)]
  plan.strategies.qcdAnnual = qcdAnnual
  return plan
}

describe('QCD in the pre-RMD window', () => {
  // IRC 408(d)(8)(B)(ii) turns on having attained 70½, and 408(d)(8) requires no
  // RMD. Born 1956-03-01 reaches 70½ on 2026-09-01 -- inside the year they
  // attain 70 -- so 2026 is an eligible year even though no RMD exists until 75.
  it('allows a QCD once the donor attains 70½, with no RMD in sight', () => {
    const years = run(planFor('1956-03-01', 10_000))

    expect(years[0]!.qcd).toBe(10_000)
  })

  // Born 1956-09-01 reaches 70½ on 2027-03-01, so 2026 is not an eligible year.
  // This is the discriminating half: an "age attained >= 70" reading would let
  // it through, and an "age attained >= 71" reading would wrongly deny the
  // March birthday above.
  it('denies a QCD to a donor who is not yet 70½ that year', () => {
    const years = run(planFor('1956-09-01', 10_000))

    expect(years[0]!.qcd).toBe(0)
  })

  it('debits the IRA for a QCD taken with no RMD to route it through', () => {
    const withGift = run(planFor('1956-03-01', 10_000))
    const withoutGift = run(planFor('1956-03-01', 0))

    expect(withoutGift[0]!.investableTotal - withGift[0]!.investableTotal)
      .toBeCloseTo(10_000, 6)
  })

  it('keeps a pre-RMD QCD out of taxable ordinary income entirely', () => {
    // The distribution is excluded, and it never entered income to begin with,
    // so it must neither add to income nor be subtracted from it. A naive
    // decoupling that reused the RMD-offset path would show negative income
    // here, which is the phantom deduction this split exists to prevent.
    const withGift = run(planFor('1956-03-01', 10_000))
    const withoutGift = run(planFor('1956-03-01', 0))

    expect(withGift[0]!.magi).toBeCloseTo(withoutGift[0]!.magi, 6)
  })

  it('caps the gift at the indexed annual limit', () => {
    // Asserted exactly, not just "less than requested": a regression that
    // capped at some other smaller figure would satisfy an inequality. 111_000
    // is the 2026 pack's IRC 408(d)(8)(A) indexed limit, and TAX_YEAR is pinned
    // to 2026, so there is no inflation factor between them here.
    const years = run(planFor('1956-03-01', 10_000_000))

    expect(years[0]!.qcd).toBe(111_000)
  })

  it('caps the gift at the available IRA balance', () => {
    const plan = planFor('1956-03-01', 90_000)
    plan.accounts = [ira('ira', 25_000)]

    const years = run(plan)

    expect(years[0]!.qcd).toBe(25_000)
  })

  // IRC 408(d)(8)(B) reaches only "any distribution from an individual
  // retirement plan", so an employer-plan RMD can never back a QCD however
  // large it is. Born 1945 the donor is 81 in 2026 and the 401(k) has a real
  // RMD; with no IRA anywhere there is nothing eligible to give, and capping
  // the routed portion against the whole forced total would give 10,000.
  it('refuses to route a QCD out of an employer-plan RMD', () => {
    const plan = planFor('1945-03-01', 10_000)
    plan.accounts = [employerPlan('k401', 500_000)]

    const years = run(plan)

    expect(years[0]!.rmd).toBeGreaterThan(10_000)
    expect(years[0]!.qcd).toBe(0)
  })

  // With both kinds present the gift is still made in full, but only the
  // owned-IRA share of the RMD carries any of it out of income -- the rest
  // comes off the IRA balance directly and never entered income to be
  // subtracted from. The expected offset is derived rather than hard-coded:
  // it is exactly the RMD the same IRA produces standing alone.
  it('offsets income only by the owned-IRA share of the forced total', () => {
    const iraAlone = planFor('1945-03-01', 0)
    iraAlone.accounts = [ira('ira', 100_000)]
    const ownedIraRmd = run(iraAlone)[0]!.rmd

    const mixed = (qcdAnnual: number): Plan => {
      const plan = planFor('1945-03-01', qcdAnnual)
      plan.accounts = [ira('ira', 100_000), employerPlan('k401', 500_000)]
      return plan
    }
    const withGift = run(mixed(10_000))
    const withoutGift = run(mixed(0))

    expect(ownedIraRmd).toBeGreaterThan(0)
    expect(ownedIraRmd).toBeLessThan(10_000)
    expect(withGift[0]!.qcd).toBe(10_000)
    expect(withoutGift[0]!.magi - withGift[0]!.magi).toBeCloseTo(ownedIraRmd, 6)
  })
})
