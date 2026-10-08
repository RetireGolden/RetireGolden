/**
 * The sizes the pre-start records state, rerunnable from the repository
 * (decision D-2027-ROLLOVER, review L7 and H1, 2026-09-29).
 *
 * The records `income-annuity-annual` and
 * `income-tips-ladder-and-ladder-value-annual` register a limit of the
 * already-paid convention: a purchase dated before the start is not taken
 * from the funding balance, so a balance typed before the purchase counts the
 * premium twice. They state its size on the derivation's household, and the
 * independent review reproduced every figure to the cent from its own
 * fixtures; until now a non-author could rerun them only from staging. This
 * file holds them.
 *
 * The household is the review's rv02: the library's example couple saved as
 * the household's own plan on 2026-10-15, with one variant per case. Each
 * effect is the ending net worth with the event minus the same plan without
 * it, from a 2026 start (the event is in the projection) and a 2027 start
 * (it is dated before it).
 *
 * - U1 (the derivation's household): a $30,000 car and a $50,000 inheritance
 *   in 2026, a Roth window 2026-2030, a move to Florida in November 2026, and
 *   a $100,000 non-qualified annuity bought in 2026 from the brokerage paying
 *   $550 a month from 67. The annuity's effect: -$147,615.81 from 2026,
 *   +$455,159.49 from 2027.
 * - T1 (the check's TIPS case): a bridge ladder paying $30,000 a year in real
 *   terms from 2028 to 2031, bought in 2026 from the brokerage: -$14,871.56
 *   from 2026, +$702,077.94 from 2027.
 *
 * The 2027-start sizes moved when main's #761 (D-EXAMPLE-SOURCE-SWITCH)
 * merged: a plan saved from an example now prices its 2027 premium tax credit
 * from a 2027 start instead of refusing it as an example contract edited, so
 * the example couple's 2027 healthcare moves. The review measured +$454,836.90
 * and +$702,170.98 before it; the same test on main at 9676392f gives the
 * figures above, so the move is #761's, not this change's. The 2026-start
 * sizes are unchanged. All four moved again, by cents to a few dollars, with
 * the 2026-09-29 change to CMS's published IRMAA amounts: U1 was -$147,622.51
 * and +$455,165.79, T1 -$14,872.97 and +$702,077.21, and S1 below 6,371,676.29
 * and 5,661,788.00. U1's 2026 figure moved again on 2026-10-07, from
 * -$147,623.51: the household are Kentucky residents who move to Florida in
 * November, and Kentucky's part-year slice now takes the whole standard
 * deduction (2025 Form 740-NP Schedule A). The 2027-start figures do not
 * move: the move is before that start.
 * - S1 (review H1): the Home's sale dated 2026. From 2027 the ledger sells it
 *   in 2027 (propertySaleYear.ts), the same projection as a sale dated 2027
 *   apart from the warning that names it; before the rule it kept the house
 *   and dropped its costs, +$1,017,839 on ending net worth.
 * - D1 (review L4): the Mortgage's payoff dated 2026, paid in 2027 and named
 *   with the amount.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { projectPlan } from '../projection'
import { buildExampleCouple } from './examples/buildExampleCouple'

const BROKERAGE = 'example-couple--brokerage'
const HOME = 'example-couple--home'
const MORTGAGE = 'example-couple--mortgage'
const S1_ENDING_2026 = 6_371_674.18
const S1_ENDING_2027 = 5_661_785.81

type Variant = {
  car?: boolean
  inheritance?: boolean
  roth?: boolean
  annuity?: boolean
  move?: boolean
  tips?: boolean
  saleYear?: number
  payoffYear?: number
}

function valid(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function household(v: Variant): Plan {
  const plan = structuredClone(buildExampleCouple())
  plan.id = 'saved-couple'
  plan.name = 'Our plan'
  plan.origin = 'user'
  delete (plan as { exampleSourceId?: string }).exampleSourceId
  plan.createdAtIso = '2026-10-15T15:00:00.000Z'
  plan.updatedAtIso = '2026-10-15T15:00:00.000Z'
  const alex = plan.household.people[0]!.id
  if (v.car) plan.expenses.oneTimeGoals.push({ id: 'car', label: 'New car', year: 2026, amount: 30_000 })
  if (v.inheritance) {
    plan.incomes.push({
      type: 'oneTime', id: 'inh', label: 'Inheritance', year: 2026, inflationAdjusted: false, amount: 50_000, taxTreatment: 'none',
    })
  }
  if (v.roth) {
    plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: 2026, endYear: 2030 }
  }
  if (v.annuity) {
    plan.accounts.push({
      type: 'annuity', id: 'spia', name: 'Income annuity', ownerPersonId: alex, annualReturnPct: null,
      startAge: 67, monthlyAmount: 550, colaPct: 0, taxablePct: 0,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: BROKERAGE, taxQualification: 'nonQualified' },
    })
  }
  if (v.move) plan.household.stateMoves = [{ fromYear: 2026, fromMonth: 11, state: 'FL' }] as Plan['household']['stateMoves']
  if (v.tips) {
    plan.incomeFloor = {
      ladders: [{
        id: 'tips', name: 'SS bridge ladder', purpose: 'bridge', startYear: 2028, endYear: 2031, annualRealAmount: 30_000,
        purchase: { year: 2026, fundingAccountId: BROKERAGE },
      }],
    }
  }
  if (v.saleYear !== undefined) {
    const home = plan.accounts.find((account) => account.id === HOME)
    if (home?.type === 'property') home.plannedSaleYear = v.saleYear
  }
  if (v.payoffYear !== undefined) {
    const mortgage = plan.accounts.find((account) => account.id === MORTGAGE)
    if (mortgage?.type === 'debt') mortgage.payoffYear = v.payoffYear
  }
  return valid(plan)
}

const endingNetWorth = (v: Variant, startYear: number) => projectPlan(household(v), startYear).result.endingNetWorth
const effect = (v: Variant, base: Variant, startYear: number) => endingNetWorth(v, startYear) - endingNetWorth(base, startYear)

describe('the double count the already-paid convention allows, rerunnable here (review L7)', () => {
  const u1: Variant = { car: true, inheritance: true, roth: true, annuity: true, move: true }
  const u1WithoutAnnuity: Variant = { ...u1, annuity: false }

  it('U1: the annuity costs $147,615.81 from a 2026 start and gains $455,159.49 from a 2027 start', () => {
    expect(effect(u1, u1WithoutAnnuity, 2026)).toBeCloseTo(-147_615.81, 2)
    expect(effect(u1, u1WithoutAnnuity, 2027)).toBeCloseTo(455_159.49, 2)
  })

  it('T1: the TIPS ladder costs $14,871.56 from a 2026 start and gains $702,077.94 from a 2027 start', () => {
    expect(effect({ tips: true }, {}, 2026)).toBeCloseTo(-14_871.56, 2)
    expect(effect({ tips: true }, {}, 2027)).toBeCloseTo(702_077.94, 2)
  })
})

describe('a sale or payoff dated before the start runs in the first year (review H1, L4)', () => {
  const withoutWarnings = (v: Variant, startYear: number) => {
    const { result } = projectPlan(household(v), startYear)
    return JSON.stringify({ ...result, warnings: [] })
  }

  it('S1: a Home sale dated 2026 is sold in 2026 from a 2026 start and in 2027 from a 2027 start', () => {
    const from2026 = projectPlan(household({ saleYear: 2026 }), 2026).result
    expect(from2026.years[0]!.year).toBe(2026)
    expect(from2026.years[0]!.balances[HOME]).toBe(0)
    expect(from2026.warnings.some((warning) => warning.startsWith('The Home sale is dated'))).toBe(false)

    const from2027 = projectPlan(household({ saleYear: 2026 }), 2027).result
    expect(from2027.years[0]!.year).toBe(2027)
    expect(from2027.years[0]!.balances[HOME]).toBe(0)
    expect(from2027.years.every((year) => year.expenses.propertyCosts === 0)).toBe(true)
    expect(from2027.warnings).toContain(
      'The Home sale is dated 2026, before this plan starts in 2027, so the plan sells it in 2027. If it has already been sold, remove the Home and add the proceeds to an account.',
    )
    // The same projection as a sale dated in the first year, apart from the warning.
    expect(withoutWarnings({ saleYear: 2026 }, 2027)).toBe(withoutWarnings({ saleYear: 2027 }, 2027))
    // The review measured the half-booked ledger at $4,151,330 (the house kept,
    // its costs dropped); sold in 2027 the plan ends at the figure below.
    expect(from2026.endingNetWorth).toBeCloseTo(S1_ENDING_2026, 2)
    expect(from2027.endingNetWorth).toBeCloseTo(S1_ENDING_2027, 2)
  })

  it('D1: a Mortgage payoff dated 2026 is paid in 2027 and named with the amount', () => {
    const from2027 = projectPlan(household({ payoffYear: 2026 }), 2027).result
    expect(from2027.years[0]!.balances[MORTGAGE]).toBe(0)
    expect(withoutWarnings({ payoffYear: 2026 }, 2027)).toBe(withoutWarnings({ payoffYear: 2027 }, 2027))
    const warning = from2027.warnings.find((entry) => entry.startsWith('The Mortgage payoff is dated 2026'))
    expect(warning).toMatch(
      /^The Mortgage payoff is dated 2026, before this plan starts in 2027, so the plan pays it off in 2027: \$[\d,]+, its \$[\d,]+ balance with a year of interest\. If it was paid, set its balance to \$0\.$/,
    )
  })
})
