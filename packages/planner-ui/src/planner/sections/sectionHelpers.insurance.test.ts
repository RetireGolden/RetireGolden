/**
 * Entry-state helpers behind the Insurance and Income-floor chrome (#489,
 * #512, #517): a new schedule row or care event never duplicates the last
 * one, duplicates that do exist are named, and a derived panel can tell when
 * the entries it reads are the ones failing validation.
 */
import { describe, expect, it } from 'vitest'

import { createSamplePlan } from '../../testSupport/samplePlan'
import {
  duplicateCareEvents,
  duplicateScheduleAges,
  formatAgeList,
  hasIssueUnder,
  makeCareEvent,
  nextScheduleAge,
} from './sectionHelpers'

describe('illustration schedule rows (#489)', () => {
  it('opens a new row one age past the latest row, from 65 on an empty schedule, capped at 120', () => {
    expect(nextScheduleAge([])).toBe(65)
    expect(nextScheduleAge([{ age: 65 }])).toBe(66)
    expect(nextScheduleAge([{ age: 70 }, { age: 65 }])).toBe(71)
    expect(nextScheduleAge([{ age: 120 }])).toBe(120)
  })

  it('names each repeated age once, ascending', () => {
    expect(duplicateScheduleAges([{ age: 65 }, { age: 66 }])).toEqual([])
    expect(duplicateScheduleAges([{ age: 65 }, { age: 65 }])).toEqual([65])
    expect(duplicateScheduleAges([{ age: 70 }, { age: 65 }, { age: 70 }, { age: 65 }, { age: 70 }])).toEqual([65, 70])
  })

  it('lists ages in prose', () => {
    expect(formatAgeList([65])).toBe('65')
    expect(formatAgeList([65, 70])).toBe('65 and 70')
    expect(formatAgeList([65, 70, 75])).toBe('65, 70, and 75')
  })
})

describe('care events (#489)', () => {
  it('a new event goes to the first person without one, then falls back to the first person', () => {
    const plan = createSamplePlan()
    const [primary, partner] = plan.household.people
    expect(plan.careEvents.map((c) => c.personId)).toEqual([primary!.id])
    const second = makeCareEvent(plan)
    expect(second.personId).toBe(partner!.id)
    plan.careEvents.push(second)
    expect(makeCareEvent(plan).personId).toBe(primary!.id)
  })

  it('reports a repeated person + start age once, by name', () => {
    const plan = createSamplePlan()
    expect(duplicateCareEvents(plan)).toEqual([])
    const first = plan.careEvents[0]!
    plan.careEvents.push({ ...first, id: 'dupe-1' }, { ...first, id: 'dupe-2' })
    const primaryName = plan.household.people[0]!.name
    expect(duplicateCareEvents(plan)).toEqual([{ name: primaryName, startAge: first.startAge }])
    // A different start age for the same person is a second episode, not a duplicate.
    plan.careEvents.push({ ...first, id: 'later', startAge: first.startAge + 5 })
    expect(duplicateCareEvents(plan)).toHaveLength(1)
  })
})

describe('hasIssueUnder (#512, #517)', () => {
  const issues = [
    'incomeFloor.ladders.0.endYear: a ladder must end in or after its first payout year',
    'careEvents.1.durationYears: Invalid input',
    'insurance: at least one policy is malformed',
  ]

  it('matches a path prefix at a segment boundary only', () => {
    expect(hasIssueUnder(issues, 'incomeFloor')).toBe(true)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.0')).toBe(true)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.1')).toBe(false)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.0.endYear')).toBe(true)
    expect(hasIssueUnder(issues, 'income')).toBe(false)
    expect(hasIssueUnder(issues, 'careEvents')).toBe(true)
    expect(hasIssueUnder(issues, 'careEvents.0')).toBe(false)
  })

  it('matches an issue reported on the path itself and takes several paths', () => {
    expect(hasIssueUnder(issues, 'insurance')).toBe(true)
    expect(hasIssueUnder(issues, 'expenses', 'insurance')).toBe(true)
    expect(hasIssueUnder([], 'insurance')).toBe(false)
  })
})
