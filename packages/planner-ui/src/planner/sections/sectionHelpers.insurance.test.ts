/**
 * Entry-state helpers behind the Insurance and Income-floor chrome (#489,
 * #512, #517): a new schedule row or care event never duplicates the last
 * one, duplicates that do exist are named, and a derived panel can tell when
 * the entries it reads are the ones failing validation.
 */
import { describe, expect, it } from 'vitest'

import { permanentLifePolicySchema } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../../testSupport/samplePlan'
import { hasIssueAt, hasIssueUnder, parseIssue, sectionsWithIssues } from '../validationIssues'
import {
  MAX_SCHEDULE_AGE,
  duplicateCareEvents,
  duplicateScheduleAges,
  formatAgeList,
  makeCareEvent,
  nextScheduleAge,
} from './sectionHelpers'

describe('illustration schedule rows (#489)', () => {
  it('opens a new row one age past the latest row, from 65 on an empty schedule', () => {
    expect(nextScheduleAge([])).toBe(65)
    expect(nextScheduleAge([{ age: 65 }])).toBe(66)
    expect(nextScheduleAge([{ age: 70 }, { age: 65 }])).toBe(71)
  })

  it('has nothing to open once the schedule reaches the schema ceiling', () => {
    expect(nextScheduleAge([{ age: MAX_SCHEDULE_AGE }])).toBeNull()
    expect(nextScheduleAge([{ age: 65 }, { age: MAX_SCHEDULE_AGE }])).toBeNull()
    expect(nextScheduleAge([{ age: MAX_SCHEDULE_AGE - 1 }])).toBe(MAX_SCHEDULE_AGE)
  })

  it('reads the ceiling off the engine schema, which admits it and refuses the next age', () => {
    // Oracle: the schema itself, not the constant.
    const scheduleRow = { age: MAX_SCHEDULE_AGE, value: 0 }
    const policy = { ...createSamplePlan().insurance.find((i) => i.kind === 'permanentLife')!, cashValueMode: 'schedule' as const }
    expect(permanentLifePolicySchema.safeParse({ ...policy, cashValueSchedule: [scheduleRow] }).success).toBe(true)
    expect(permanentLifePolicySchema.safeParse({ ...policy, cashValueSchedule: [{ ...scheduleRow, age: MAX_SCHEDULE_AGE + 1 }] }).success).toBe(false)
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

describe('validation issues (#512, #517)', () => {
  const issues = [
    'incomeFloor.ladders.10.endYear: a ladder must end in or after its first payout year',
    'careEvents.1.durationYears: Invalid input',
    'insurance: at least one policy is malformed',
    '(root): something plan-wide',
  ]

  it('parses path segments and the message', () => {
    expect(parseIssue(issues[0]!)).toEqual({
      path: ['incomeFloor', 'ladders', '10', 'endYear'],
      message: 'a ladder must end in or after its first payout year',
    })
    expect(parseIssue(issues[3]!)).toEqual({ path: [], message: 'something plan-wide' })
    expect(parseIssue('no separator here')).toEqual({ path: [], message: 'no separator here' })
  })

  it('matches whole segments, so ladder 1 is not covered by an issue on ladder 10', () => {
    expect(hasIssueUnder(issues, 'incomeFloor')).toBe(true)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.10')).toBe(true)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.1')).toBe(false)
    expect(hasIssueUnder(issues, ['incomeFloor', 'ladders', '1'])).toBe(false)
    expect(hasIssueUnder(issues, 'incomeFloor.ladders.10.endYear')).toBe(true)
    expect(hasIssueUnder(issues, 'income')).toBe(false)
    expect(hasIssueUnder(issues, 'careEvents')).toBe(true)
    expect(hasIssueUnder(issues, 'careEvents.0')).toBe(false)
  })

  it('matches an issue reported on the path itself, exactly or as a prefix, and takes several paths', () => {
    expect(hasIssueUnder(issues, 'insurance')).toBe(true)
    expect(hasIssueUnder(issues, 'expenses', 'insurance')).toBe(true)
    expect(hasIssueUnder([], 'insurance')).toBe(false)
    expect(hasIssueAt(issues, 'insurance')).toBe(true)
    expect(hasIssueAt(issues, 'careEvents')).toBe(false)
    expect(hasIssueAt(issues, ['careEvents', '1', 'durationYears'])).toBe(true)
  })

  it('names the planner sections the failing entries live on, once each, in rail order', () => {
    expect(sectionsWithIssues(issues)).toEqual([
      { segment: 'insurance', title: 'Insurance' },
      { segment: 'income-floor', title: 'Income floor' },
    ])
    expect(sectionsWithIssues(['expenses.baseAnnual: x', 'household.filingStatus: y', 'careEvents.0.personId: z'])).toEqual([
      { segment: 'household', title: 'Household' },
      { segment: 'insurance', title: 'Insurance' },
      { segment: 'spending', title: 'Spending' },
    ])
    expect(sectionsWithIssues(['(root): x', 'updatedAtIso: y'])).toEqual([])
  })
})
