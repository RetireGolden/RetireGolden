/**
 * Entry-state helpers behind the Insurance and Income-floor chrome (#489,
 * #512, #517): a new schedule row or care event never duplicates the last
 * one, duplicates that do exist are named, and a derived panel can tell when
 * the entries it reads are the ones failing validation.
 */
import { describe, expect, it } from 'vitest'

import { permanentLifePolicySchema } from '@retiregolden/engine/model/plan'

import { createEmptyPlan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../../testSupport/samplePlan'
import { hasIssueAt, hasIssueUnder, parseIssue, sectionsWithIssues, withoutIssuesBeyond } from '../validationIssues'
import {
  appendScheduleRow,
  duplicateCareEvents,
  duplicateScheduleAges,
  formatAgeList,
  makeCareEvent,
  maxScheduleAge,
  nextCareStartAge,
  nextScheduleAge,
} from './sectionHelpers'

const MAX_SCHEDULE_AGE = maxScheduleAge()

describe('illustration schedule rows (#489)', () => {
  it('opens a new row one age past the latest row, from 65 on an empty schedule', () => {
    expect(nextScheduleAge([])).toBe(65)
    expect(nextScheduleAge([{ age: 65 }])).toBe(66)
    expect(nextScheduleAge([{ age: 70 }, { age: 65 }])).toBe(71)
  })

  it('once the latest row is the ceiling, fills the gaps between the rows and never goes below the earliest', () => {
    expect(nextScheduleAge([{ age: MAX_SCHEDULE_AGE - 1 }])).toBe(MAX_SCHEDULE_AGE)
    expect(nextScheduleAge([{ age: 65 }, { age: MAX_SCHEDULE_AGE }])).toBe(66)
    expect(nextScheduleAge([{ age: 65 }, { age: 66 }, { age: MAX_SCHEDULE_AGE }])).toBe(67)
    expect(nextScheduleAge([{ age: 65 }, { age: 67 }, { age: MAX_SCHEDULE_AGE }])).toBe(66)
    // No gap left: nothing to open (and no wrap to an age below 65).
    expect(nextScheduleAge([{ age: MAX_SCHEDULE_AGE }])).toBeNull()
    expect(nextScheduleAge([{ age: MAX_SCHEDULE_AGE - 1 }, { age: MAX_SCHEDULE_AGE }])).toBeNull()
    const full = Array.from({ length: MAX_SCHEDULE_AGE - 65 + 1 }, (_, i) => ({ age: 65 + i }))
    expect(nextScheduleAge(full)).toBeNull()
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

  it('appendScheduleRow is nextScheduleAge applied: one row at that age, or no change to make', () => {
    expect(appendScheduleRow([])).toEqual([{ age: 65, value: 0 }])
    expect(appendScheduleRow([{ age: 65, value: 1 }])).toEqual([{ age: 65, value: 1 }, { age: 66, value: 0 }])
    expect(appendScheduleRow([{ age: MAX_SCHEDULE_AGE, value: 0 }])).toBeNull()
  })

  it('lists ages in prose; an empty list is an empty string by contract', () => {
    expect(formatAgeList([])).toBe('')
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
    const second = makeCareEvent(plan)!
    expect(second.personId).toBe(partner!.id)
    expect(second.startAge).toBe(85)
    plan.careEvents.push(second)
    // The primary's existing event is at 88, so 85 is free for them.
    const third = makeCareEvent(plan)!
    expect(third.personId).toBe(primary!.id)
    expect(third.startAge).toBe(85)
    plan.careEvents.push(third)
    // Now 85 is taken: one past their latest (88).
    const fourth = makeCareEvent(plan)!
    expect(fourth.personId).toBe(primary!.id)
    expect(fourth.startAge).toBe(89)
    plan.careEvents.push(fourth)
    expect(duplicateCareEvents(plan)).toEqual([])
  })

  it('in a one-person household repeated adds never repeat a person + age pair', () => {
    const plan = createEmptyPlan({ newId: () => crypto.randomUUID() })
    expect(plan.household.people).toHaveLength(1)
    for (let i = 0; i < 4; i++) plan.careEvents.push(makeCareEvent(plan)!)
    expect(plan.careEvents.map((c) => c.startAge)).toEqual([85, 86, 87, 88])
    expect(duplicateCareEvents(plan)).toEqual([])
  })

  it('at the 110 ceiling the next age fills a gap, never a repeat, and is null when the span is full', () => {
    // Events at 85 and 110: one past the latest would pass the ceiling, so
    // the lowest unused age between them opens instead.
    expect(nextCareStartAge([85, 110])).toBe(86)
    expect(nextCareStartAge([85, 86, 110])).toBe(87)
    // Only a 110: 85 itself is free.
    expect(nextCareStartAge([110])).toBe(85)
    // Never below the earliest event.
    expect(nextCareStartAge([85, 100, 110])).toBe(86)
    expect(nextCareStartAge([100, 110])).toBe(85)
    // 85 through 110 all taken: nothing to open.
    const full = Array.from({ length: 110 - 85 + 1 }, (_, i) => 85 + i)
    expect(nextCareStartAge(full)).toBeNull()
    // A one-person plan at that point gets no event, and never a duplicate.
    const plan = createEmptyPlan({ newId: () => crypto.randomUUID() })
    const person = plan.household.people[0]!
    for (const startAge of full) plan.careEvents.push({ id: `c${startAge}`, personId: person.id, startAge, durationYears: 3, annualCost: 1 })
    expect(makeCareEvent(plan)).toBeNull()
    expect(duplicateCareEvents(plan)).toEqual([])
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

  it('drops issues whose list index the current list does not have, and nothing else', () => {
    const stale = [
      'incomeFloor.ladders.1.endYear: stale, from before ladder 0 was removed',
      'incomeFloor.ladders.0.endYear: current',
      'incomeFloor.ladders: list-level',
      'incomeFloor.ladders.x.endYear: not an index',
      'careEvents.5.durationYears: another list',
    ]
    expect(withoutIssuesBeyond(stale, ['incomeFloor', 'ladders'], 1)).toEqual([
      'incomeFloor.ladders.0.endYear: current',
      'incomeFloor.ladders: list-level',
      'incomeFloor.ladders.x.endYear: not an index',
      'careEvents.5.durationYears: another list',
    ])
    expect(withoutIssuesBeyond(stale, 'incomeFloor.ladders', 2)).toEqual(stale)
    expect(withoutIssuesBeyond(stale, 'incomeFloor.ladders', 0)).toHaveLength(3)
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
