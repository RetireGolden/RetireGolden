/**
 * Comparing a user plan with a library example (decision D-2027-ROLLOVER):
 * they would run from different start years, so the comparison picks one and
 * the page says so. Two examples run from EXAMPLE_FIXED_YEAR, the year their
 * copy is written for; anything with a user plan in it runs from the clock's
 * year, and an example (or a plan saved from one) says it then differs from
 * its example page.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { compareStartYear } from '../startYear'
import { compareExampleNote } from './compareExampleNote'

const example = { origin: 'example' } as const
const user = { origin: 'user' } as const
const jan2027 = new Date(2027, 0, 15, 12)
const sep2026 = new Date(2026, 8, 28, 12)

describe('the start year two compared plans run from', () => {
  it('two examples run from 2026 in any year', () => {
    expect(compareStartYear(example, example, jan2027)).toBe(2026)
    expect(compareStartYear(example, example, sep2026)).toBe(2026)
  })

  it('anything with a user plan runs from the clock’s year', () => {
    expect(compareStartYear(user, example, jan2027)).toBe(2027)
    expect(compareStartYear(example, user, jan2027)).toBe(2027)
    expect(compareStartYear(user, user, jan2027)).toBe(2027)
  })
})

describe('what the page says under the table', () => {
  const plan = (fields: Partial<Plan>): Plan => ({ id: 'p', name: 'Our plan', origin: 'user', ...fields }) as Plan

  it('says nothing while the comparison runs from 2026', () => {
    expect(compareExampleNote(plan({ origin: 'example', exampleSourceId: 'example-couple' }), 2026)).toBeNull()
  })

  it('names an example running from a later year', () => {
    expect(compareExampleNote(plan({ origin: 'example', exampleSourceId: 'example-couple' }), 2027)).toBe(
      'Example couple is an example set in 2026. Here it runs from 2027, like your plan, so its figures differ from its example page.',
    )
  })

  it('names a plan saved from an example', () => {
    expect(compareExampleNote(plan({ origin: 'user', exampleSourceId: 'example-couple' }), 2027)).toBe(
      'Our plan was saved from the example Example couple, which is set in 2026. It runs from 2027, so its figures differ from the example page.',
    )
  })

  it('says nothing of a plan that was never an example', () => {
    expect(compareExampleNote(plan({ origin: 'user' }), 2027)).toBeNull()
  })
})
