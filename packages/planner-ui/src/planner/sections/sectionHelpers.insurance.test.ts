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
  it('opens a new row one age past the latest row, from 65 on an empty schedule', () => {
    expect(nextScheduleAge([])).toBe(65)
    expect(nextScheduleAge([{ age: 65 }])).toBe(66)
    expect(nextScheduleAge([{ age: 70 }, { age: 65 }])).toBe(71)
  })

  it('never opens a repeat: past the schema cap it takes the lowest free age, and null once every age is taken', () => {
    expect(nextScheduleAge([{ age: 120 }])).toBe(0)
    expect(nextScheduleAge([{ age: 120 }, { age: 0 }])).toBe(1)
    expect(nextScheduleAge([{ age: 120 }, { age: 0 }, { age: 1 }, { age: 3 }])).toBe(2)
    const full = Array.from({ length: 121 }, (_, age) => ({ age }))
    expect(nextScheduleAge(full)).toBeNull()
    expect(nextScheduleAge(full.filter((row) => row.age !== 77))).toBe(77)
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

  it('reports a repeated person + start age once, by person id, with how many events share it', () => {
    const plan = createSamplePlan()
    expect(duplicateCareEvents(plan)).toEqual([])
    const first = plan.careEvents[0]!
    const primary = plan.household.people[0]!
    plan.careEvents.push({ ...first, id: 'dupe-1' })
    expect(duplicateCareEvents(plan)).toEqual([{ personId: primary.id, name: primary.name, startAge: first.startAge, count: 2 }])
    plan.careEvents.push({ ...first, id: 'dupe-2' })
    expect(duplicateCareEvents(plan)[0]!.count).toBe(3)
    // A different start age for the same person is a second episode, not a duplicate.
    plan.careEvents.push({ ...first, id: 'later', startAge: first.startAge + 5 })
    expect(duplicateCareEvents(plan)).toHaveLength(1)
  })

  it('keeps two same-named people apart', () => {
    const plan = createSamplePlan()
    const [primary, partner] = plan.household.people
    partner!.name = primary!.name
    const first = plan.careEvents[0]!
    plan.careEvents.push({ ...first, id: 'p-dupe' }, { ...first, id: 'q-1', personId: partner!.id }, { ...first, id: 'q-2', personId: partner!.id })
    const groups = duplicateCareEvents(plan)
    expect(groups.map((g) => g.personId)).toEqual([primary!.id, partner!.id])
    expect(new Set(groups.map((g) => `${g.personId}@${g.startAge}`)).size).toBe(2)
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
