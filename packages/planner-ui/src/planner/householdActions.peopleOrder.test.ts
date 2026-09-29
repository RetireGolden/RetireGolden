/**
 * Adding or removing a partner never lets list order decide whose age a
 * plan's spending phases or joint contribution schedules follow (schema v7,
 * decision D-PEOPLE-ORDER): they stay on the person already there, and a
 * removed partner's are re-pointed to the one who remains.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { addPartner, removePartner } from './householdActions'
import { nameContributionSchedulePerson } from './eligibilityFactActions'
import { createSamplePlan } from '../testSupport/samplePlan'

function single(): Plan {
  const plan = createSamplePlan()
  removePartner(plan, plan.household.people[1]!.id)
  const brokerage = plan.accounts.find((a) => a.type === 'taxable')!
  if (brokerage.type === 'taxable') {
    brokerage.contributionSchedule = [{ annualAmount: 5_000, fromAge: 60, toAge: 65, escalationPct: 0 }]
    delete brokerage.contributionScheduleAgeOf
  }
  return plan
}

const partner = { id: 'new-partner', name: 'Partner', dob: '1965-01-01', sex: 'average' as const, retirementAge: 65, longevity: { planningAge: 95, source: 'manual' as const } }

describe('partners and named people (D-PEOPLE-ORDER)', () => {
  it('adding a partner keeps the phases and a joint schedule on the person already there, and the plan parses', () => {
    const plan = single()
    const existing = plan.household.people[0]!.id
    addPartner(plan, partner)
    expect(plan.household.people.map((p) => p.id)).toEqual([existing, 'new-partner'])
    expect(plan.expenses.phasesAgeOf).toBe(existing)
    const brokerage = plan.accounts.find((a) => a.type === 'taxable')!
    expect(brokerage.type === 'taxable' && brokerage.contributionScheduleAgeOf).toBe(existing)
    const parsed = parsePlan(plan)
    expect(parsed.ok ? [] : parsed.issues).toEqual([])
  })

  it('adding a partner to a one-person plan whose phases name no one names the person already there (review L4, J07)', () => {
    // A one-person plan may leave its phases unnamed (the only person's age);
    // a couple may not. Without the name, the new couple's plan is refused.
    const plan = single()
    const existing = plan.household.people[0]!.id
    plan.expenses.phases = [{ fromAge: 75, multiplier: 0.8 }]
    delete plan.expenses.phasesAgeOf
    expect(parsePlan(plan).ok).toBe(true)
    addPartner(plan, partner)
    expect(plan.expenses.phasesAgeOf).toBe(existing)
    const parsed = parsePlan(plan)
    expect(parsed.ok ? [] : parsed.issues).toEqual([])
  })

  it('removing a partner re-points the phases and schedules to the person who remains', () => {
    const plan = createSamplePlan()
    const [alex, sam] = plan.household.people
    plan.expenses.phasesAgeOf = sam!.id
    const brokerage = plan.accounts.find((a) => a.type === 'taxable')!
    if (brokerage.type === 'taxable') {
      brokerage.contributionSchedule = [{ annualAmount: 5_000, fromAge: 60, toAge: 65, escalationPct: 0 }]
      brokerage.contributionScheduleAgeOf = sam!.id
    }
    removePartner(plan, sam!.id)
    expect(plan.expenses.phasesAgeOf).toBe(alex!.id)
    expect(brokerage.type === 'taxable' && brokerage.contributionScheduleAgeOf).toBe(alex!.id)
    const parsed = parsePlan(plan)
    expect(parsed.ok ? [] : parsed.issues).toEqual([])
  })

  it('removing a partner clears a schedule person on an account with an owner, and re-points a joint one (review of #765, issue 15)', () => {
    // A hand-edited plan: Sam's own brokerage also names Sam for its
    // schedule, which the schema refuses on an owned account. The removal
    // moves the account to Alex and clears the name; the joint cash
    // account's schedule is re-pointed to Alex.
    const plan = createSamplePlan()
    const [alex, sam] = plan.household.people
    const brokerage = plan.accounts.find((a) => a.type === 'taxable')!
    const cash = plan.accounts.find((a) => a.type === 'cash')!
    if (brokerage.type !== 'taxable' || cash.type !== 'cash') throw new Error('expected a brokerage and a cash account')
    const schedule = [{ annualAmount: 5_000, fromAge: 60, toAge: 65, escalationPct: 0 }]
    brokerage.ownerPersonId = sam!.id
    brokerage.contributionSchedule = schedule
    brokerage.contributionScheduleAgeOf = sam!.id
    cash.ownerPersonId = null
    cash.contributionSchedule = schedule
    cash.contributionScheduleAgeOf = sam!.id
    removePartner(plan, sam!.id)
    const [owned, joint] = [plan.accounts.find((a) => a.id === brokerage.id)!, plan.accounts.find((a) => a.id === cash.id)!]
    expect(owned.ownerPersonId).toBe(alex!.id)
    expect('contributionScheduleAgeOf' in owned).toBe(false)
    expect(joint.type === 'cash' && joint.contributionScheduleAgeOf).toBe(alex!.id)
    const parsed = parsePlan(plan)
    expect(parsed.ok ? [] : parsed.issues).toEqual([])
  })

  it('keeps a schedule person in step with the owner field', () => {
    const plan = createSamplePlan()
    const brokerage = plan.accounts.find((a) => a.type === 'taxable')!
    if (brokerage.type !== 'taxable') throw new Error('expected a brokerage')
    brokerage.contributionSchedule = [{ annualAmount: 5_000, fromAge: 60, toAge: 65, escalationPct: 0 }]
    nameContributionSchedulePerson(plan, brokerage)
    expect(brokerage.contributionScheduleAgeOf).toBe(plan.household.people[0]!.id)
    brokerage.ownerPersonId = plan.household.people[1]!.id
    nameContributionSchedulePerson(plan, brokerage)
    expect(brokerage.contributionScheduleAgeOf).toBeUndefined()
  })
})
