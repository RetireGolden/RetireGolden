import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import { couplePlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import type { YearResult } from './types.js'

/**
 * The aggregate Roth-conversion strategy is bound by the owner of the dollars.
 *
 * IRC 408A(e)(1)(B)(i) admits a rollover from an individual retirement plan as
 * a qualified rollover contribution only on the section 408(d)(3) terms, and
 * 408(d)(3)(A) requires both that the amount be paid out to the individual for
 * whose benefit the account is maintained and that it be paid into an account
 * for the benefit of that same individual; 408A(d)(3)(B) imposes the identity
 * requirement on conversions directly. One spouse's traditional dollars can
 * never become the other spouse's Roth dollars.
 */

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function ira(
  id: string,
  balance: number,
  ownerPersonId: string,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function roth(id: string, ownerPersonId: string): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    kind: 'ira',
    balance: 0,
    annualReturnPct: 0,
    annualContribution: 0,
  }
}

function household(): Plan {
  const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
  plan.id = 'cross-owner-conversion'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  return plan
}

function run(plan: Plan): {
  warnings: readonly string[]
  year: Readonly<YearResult>
} {
  const result = simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: noTax,
  })
  return { warnings: result.warnings, year: result.years[0]! }
}

const SKIPPED_WARNING =
  'Robin has no Roth account, so Robin’s share of the Roth conversion was skipped — ' +
  'a conversion has to land in the same person’s own Roth. ' +
  'Opening a Roth IRA for Robin would let that share convert.'

describe('aggregate Roth conversion owner boundary', () => {
  it('leaves the spouse without a Roth entirely unconverted, and says so', () => {
    // Pat holds the household's only Roth. Robin's IRA is first in Plan order,
    // so the undiscriminating drain loop would have reached it before Pat's
    // and credited Robin's dollars to Pat's Roth.
    const plan = household()
    plan.accounts = [
      ira('robin-ira', 100_000, 'p2'),
      ira('pat-ira', 100_000, 'p1'),
      roth('pat-roth', 'p1'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 40_000 }],
    }

    const { warnings, year } = run(plan)

    // Equal balances, so Robin's half of the 40,000 is trimmed and Pat's
    // 20,000 converts. Robin's IRA is untouched; Pat's is down by exactly the
    // converted amount and Pat's Roth up by it.
    expect(year.rothConversion).toBe(20_000)
    expect(year.balances['robin-ira']).toBe(100_000)
    expect(year.balances['pat-ira']).toBe(80_000)
    expect(year.balances['pat-roth']).toBe(20_000)
    expect(year.magi).toBe(20_000)
    expect(warnings).toContain(SKIPPED_WARNING)
  })

  it('converts nothing at all when only the spouse without a Roth holds a balance', () => {
    // The discriminating case: there is no pair of accounts a conversion could
    // legally run between, so the answer is nothing rather than less.
    const plan = household()
    plan.accounts = [
      ira('robin-ira', 100_000, 'p2'),
      roth('pat-roth', 'p1'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 40_000 }],
    }

    const { warnings, year } = run(plan)

    expect(year.rothConversion).toBe(0)
    expect(year.balances['robin-ira']).toBe(100_000)
    expect(year.balances['pat-roth']).toBe(0)
    expect(year.magi).toBe(0)
    expect(warnings).toContain(SKIPPED_WARNING)
  })

  it('splits the household target by gross convertible balance when both own a Roth', () => {
    // Give Robin a Roth and the trimmed slice converts, into Robin's own
    // account. Unequal balances, so the split is 3:1 and the whole 40,000
    // moves — nothing about the owner boundary reduces a household that can
    // satisfy it.
    const plan = household()
    plan.accounts = [
      ira('robin-ira', 30_000, 'p2'),
      ira('pat-ira', 90_000, 'p1'),
      roth('pat-roth', 'p1'),
      roth('robin-roth', 'p2'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 40_000 }],
    }

    const { warnings, year } = run(plan)

    expect(year.rothConversion).toBe(40_000)
    expect(year.balances['robin-ira']).toBe(20_000)
    expect(year.balances['robin-roth']).toBe(10_000)
    expect(year.balances['pat-ira']).toBe(60_000)
    expect(year.balances['pat-roth']).toBe(30_000)
    expect(warnings).not.toContain(SKIPPED_WARNING)
  })

  it('weights each owner by the balance left after their own RMD', () => {
    // Treas. Reg. 1.408A-4 A-6(b) requires the forced distribution to precede
    // the conversion, so the weight is read after the RMD block. Pat is 73 and
    // Robin is 71: Pat's 400,000 is reduced by a 15,094.34 RMD before the
    // split, Robin's 400,000 is not. Equal opening balances therefore do not
    // split equally.
    const plan = couplePlan({
      p1Dob: '1953-01-01', p2Dob: '1955-01-01',
      p1PlanningAge: 74, p2PlanningAge: 72,
    })
    plan.id = 'cross-owner-conversion-rmd'
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      ira('pat-ira', 400_000, 'p1'),
      ira('robin-ira', 400_000, 'p2'),
      roth('pat-roth', 'p1'),
      roth('robin-roth', 'p2'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 100_000 }],
    }

    const { year } = run(plan)

    // 400,000 / 26.5 = 15,094.34 (Uniform Lifetime at 73).
    expect(year.rmd).toBeCloseTo(15_094.34, 2)
    const patWeight = 400_000 - year.rmd
    const patShare = 100_000 * patWeight / (patWeight + 400_000)
    expect(year.rothConversion).toBeCloseTo(100_000, 6)
    expect(year.balances['pat-roth']).toBeCloseTo(patShare, 2)
    expect(year.balances['robin-roth']).toBeCloseTo(100_000 - patShare, 2)
    // A pre-RMD weight would have split the 100,000 exactly in half. It does
    // not, which is what makes the snapshot point load-bearing rather than
    // incidental.
    expect(year.balances['pat-roth']).toBeLessThan(50_000)
  })

  it('allocates the split in exact cents with no residue', () => {
    // Three-way weights that do not divide evenly. The parts must still sum to
    // the requested amount to the cent.
    const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
    plan.id = 'cross-owner-conversion-cents'
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      ira('pat-ira', 10_000, 'p1'),
      ira('robin-ira', 20_000, 'p2'),
      roth('pat-roth', 'p1'),
      roth('robin-roth', 'p2'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 1_000.01 }],
    }

    const { year } = run(plan)

    const pat = year.balances['pat-roth']!
    const robin = year.balances['robin-roth']!
    expect(pat + robin).toBeCloseTo(1_000.01, 10)
    // 100,001 cents at 1:2 is 33,333⅔ and 66,667⅓. The odd cent goes to the
    // larger exact remainder, which is Pat's two-thirds, so Pat rounds up and
    // Robin down — and the two still add to the whole.
    expect(pat).toBeCloseTo(333.34, 10)
    expect(robin).toBeCloseTo(666.67, 10)
  })
})
