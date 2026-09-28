/**
 * PR #759 review 5: a non-finite age (NaN, +Infinity or -Infinity) throws a
 * RangeError in each of the three functions that take an age as a plain
 * number, for every sex and multiplier, rather than returning a figure. No
 * caller passes such an age: ages come from whole birth years.
 */
import { describe, expect, it } from 'vitest'

import { jointLastSurvivorExpectancy, sampleDeathAge } from './mortality.js'
import { createRng } from './rng.js'
import { hazardForExpectancyMultiplier } from './survival.js'

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

describe('a non-finite age throws a RangeError', () => {
  it.each(NON_FINITE)('sampleDeathAge at %s', (age) => {
    for (const sex of ['male', 'female', 'average'] as const) {
      expect(() => sampleDeathAge(createRng(7), age, sex)).toThrow(RangeError)
    }
  })

  it.each(NON_FINITE)('jointLastSurvivorExpectancy with %s for either life', (age) => {
    expect(() => jointLastSurvivorExpectancy(age, 'male', 67, 'female')).toThrow(RangeError)
    expect(() => jointLastSurvivorExpectancy(70, 'male', age, 'female')).toThrow(RangeError)
    expect(() => jointLastSurvivorExpectancy(age, 'average', age, 'average')).toThrow(RangeError)
  })

  it.each(NON_FINITE)('hazardForExpectancyMultiplier at %s, for every multiplier, 1 included', (age) => {
    for (const m of [0.8, 1, 1.12]) {
      expect(() => hazardForExpectancyMultiplier(age, 'male', m), `m = ${m}`).toThrow(RangeError)
    }
  })

  it('leaves a finite age, fractional, negative or past the table, returning a figure', () => {
    expect(sampleDeathAge(createRng(7), 65.5, 'male')).toBeGreaterThanOrEqual(65)
    expect(sampleDeathAge(createRng(7), 200, 'female')).toBe(119)
    expect(Number.isFinite(jointLastSurvivorExpectancy(-3, 'male', 67, 'female'))).toBe(true)
    expect(Number.isFinite(jointLastSurvivorExpectancy(200, 'male', 67, 'female'))).toBe(true)
    expect(hazardForExpectancyMultiplier(65, 'male', 1)).toBe(1)
    expect(hazardForExpectancyMultiplier(-3, 'male', 0.8)).toBeGreaterThan(1)
  })
})
