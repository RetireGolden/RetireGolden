/**
 * The independent reviewer's surviving-spouse case (review M2): example-couple
 * with Alex's planning age 68 (Alex dies after 2030) and a qualified purchase
 * in 2032 of $120,000 from Alex's 401(k), $1,500 a month from Sam's 70th year.
 * The base build accepted it named for Sam and paid Sam $18,000 a year from
 * 2034 (ending net worth $4,751,515). Head 41e6df50 refused it, and its
 * remedy (naming Alex) and its v6 repair both spent the premium on a contract
 * that paid $0. Now: accepted named for Sam, the same figures as the base, a
 * v6 file loads unchanged, and naming Alex is refused in plain words.
 */
import { describe, expect, it } from 'vitest'

import { migratePlanToCurrent } from '@retiregolden/engine/model/migrations'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'

const EC = 'example-couple'

function doc(owner: string): Plan {
  const plan = structuredClone(appExamplePlanById(EC))
  plan.household.people.find((p) => p.id === `${EC}--alex`)!.longevity.planningAge = 68
  plan.accounts.push({
    type: 'annuity', id: 'after-death', name: 'Annuity bought after Alex', ownerPersonId: owner, annualReturnPct: null, startAge: 70, monthlyAmount: 1_500, colaPct: 0, taxablePct: 100,
    purchase: { year: 2032, premium: 120_000, fundingAccountId: `${EC}--401k`, taxQualification: 'qualified' },
  })
  return plan
}

describe('a surviving spouse buys from the dead owner’s 401(k) (review M2)', () => {
  it('accepts it named for Sam and pays Sam $18,000 a year from 2034, the base build’s figures', () => {
    const parsed = parsePlan(doc(`${EC}--sam`))
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const view = projectPlan(parsed.plan, EXAMPLE_FIXED_YEAR)
    expect(view.result.years.find((y) => y.year === 2034)!.incomes.annuity).toBe(18_000)
    expect(Math.round(view.summary.endingNetWorth)).toBe(4_751_515)
  })

  it('loads a v6 file of that shape without renaming it to the dead owner', () => {
    const stored = JSON.parse(JSON.stringify(doc(`${EC}--sam`))) as Record<string, unknown>
    stored['schemaVersion'] = 6
    const loaded = migratePlanToCurrent(stored)
    if (!loaded.ok) throw new Error(JSON.stringify(loaded))
    expect(loaded.plan.accounts.find((a) => a.id === 'after-death')!.ownerPersonId).toBe(`${EC}--sam`)
    expect(loaded.repairs.some((r) => 'accountId' in r && r.accountId === 'after-death')).toBe(false)
  })

  it('refuses it named for Alex, who has died by 2032, in plain words', () => {
    const parsed = parsePlan(doc(`${EC}--alex`))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.issues.join('; ')).toContain("Alex's planning age ends in 2030, so an annuity bought in 2032 on Alex's life would never pay: name a person who is alive in 2032, or buy it in 2030 or earlier")
    }
  })
})
