/**
 * Every stored plan must still open (the independent review's N1). The parse
 * refuses an annuity bought for a person whose planning age has ended by its
 * purchase year, since it would never pay; a stored plan of that shape, which
 * the build before that refusal opened, is repaired at load instead:
 * - the other person, alive in the purchase year and the only one who could
 *   have bought it, becomes its annuitant;
 * - with nobody alive to buy it, the contract is removed and its premium stays
 *   in the account it was to come from;
 * and either way the notice says the figures change.
 *
 * The review's case: example-couple with Alex's planning age 68 (last year
 * alive 2030) and a non-qualified SPIA bought in 2032 from the joint brokerage,
 * named for Alex, stored as JSON. The build before the refusal opened it,
 * spent the $100,000 premium in 2032 and paid nothing (ending net worth
 * $3,817,914); the build with the refusal failed it with
 * invalid_after_migration.
 */
import { describe, expect, it } from 'vitest'

import { migratePlanToCurrent } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'

import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { planRepairMessage } from './planRepairCopy'

const EC = 'example-couple'

function stored(planningAges: { alex: number; sam?: number }, withSpia = true): Record<string, unknown> {
  const plan = structuredClone(appExamplePlanById(EC))
  plan.household.people.find((p) => p.id === `${EC}--alex`)!.longevity.planningAge = planningAges.alex
  if (planningAges.sam !== undefined) plan.household.people.find((p) => p.id === `${EC}--sam`)!.longevity.planningAge = planningAges.sam
  if (withSpia) {
    plan.accounts.push({
      type: 'annuity', id: 'late-spia', name: 'SPIA', ownerPersonId: `${EC}--alex`, annualReturnPct: null, startAge: 70, monthlyAmount: 600, colaPct: 0, taxablePct: 40,
      purchase: { year: 2032, premium: 100_000, fundingAccountId: `${EC}--brokerage`, taxQualification: 'nonQualified' },
    })
  }
  return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
}

function open(doc: Record<string, unknown>) {
  const loaded = migratePlanToCurrent(doc)
  if (!loaded.ok) throw new Error(`refused: ${JSON.stringify(loaded)}`)
  return loaded
}

const endingNetWorth = (plan: Plan) => projectPlan(plan, EXAMPLE_FIXED_YEAR).summary.endingNetWorth

describe('a stored annuity bought for a person already dead opens (review N1)', () => {
  it('names Sam, the only one alive to buy it in 2032, and says the figures change', () => {
    const loaded = open(stored({ alex: 68 }))
    const spia = loaded.plan.accounts.find((a) => a.id === 'late-spia')!
    expect(spia.ownerPersonId).toBe(`${EC}--sam`)
    const repair = loaded.repairs.find((r) => 'accountId' in r && r.accountId === 'late-spia')!
    expect(repair.kind).toBe('annuityOwnerNamedLivingPerson')
    expect(planRepairMessage(repair, loaded.plan)).toBe(
      "SPIA was bought in 2032 and named for Alex, whose planning age ends in 2030, so it would never have paid. Sam was the only one alive to buy it, so Sam is now its annuitant. It now pays on Sam's age and life, so your figures change. Open Accounts to check it.",
    )
    // It still costs its premium in 2032 and now pays Sam from 2034 (Sam turns 70).
    const years = projectPlan(loaded.plan, EXAMPLE_FIXED_YEAR).result.years
    expect(years.find((y) => y.year === 2033)!.incomes.annuity).toBe(0)
    expect(years.find((y) => y.year === 2034)!.incomes.annuity).toBe(7_200)
  })

  it('removes it when nobody is alive to buy it, and the premium stays in the brokerage', () => {
    const loaded = open(stored({ alex: 68, sam: 66 }))
    expect(loaded.plan.accounts.some((a) => a.id === 'late-spia')).toBe(false)
    const repair = loaded.repairs.find((r) => 'accountId' in r && r.accountId === 'late-spia')!
    expect(planRepairMessage(repair, loaded.plan)).toBe(
      "SPIA was to be bought in 2032 on Alex's life, but Alex's planning age ends in 2030, and no one in your household is alive in 2032 to buy it, so it would never have paid. It has been removed, and its premium stays in Joint brokerage, so your figures change. Open Accounts to add it again in a year when its annuitant is alive.",
    )
    expect(endingNetWorth(loaded.plan)).toBe(endingNetWorth(open(stored({ alex: 68, sam: 66 }, false)).plan))
  })
})
