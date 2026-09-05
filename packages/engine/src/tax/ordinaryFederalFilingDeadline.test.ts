import { describe, expect, it } from 'vitest'

import { ordinaryFederalFilingDeadline as modelOrdinaryFederalFilingDeadline } from '../model/retirementActionAnnualTaxFacts.js'
import { describeRule } from '../rules/describeRule.js'

import { ordinaryFederalFilingDeadline } from './ordinaryFederalFilingDeadline.js'

describeRule('irc-6072-a-7503-ordinary-federal-filing-deadline', {
  // Independent Gregorian derivation for filing season 2028 (tax year 2027):
  // 2028-04-15 is Saturday; 2028-04-16 is Sunday; Emancipation Day is therefore
  // observed Monday 2028-04-17; IRC 7503 + Notice 2011-17 put the deadline on
  // Tuesday 2028-04-18. A fixed-April-15 reading stays on Saturday; a
  // weekend-only skip (no D.C. holiday) would stop on Monday 2028-04-17.
  readings: {
    statuteWithHoliday: '2028-04-18',
    fixedApril15: '2028-04-15',
    weekendOnlySkip: '2028-04-17',
  },
  accepted: 'statuteWithHoliday',
}, ({ accepted, readings }) => {
  it('moves the 2027 tax-year deadline past the Monday-observed Emancipation Day', () => {
    expect(ordinaryFederalFilingDeadline(2027)).toBe(accepted)
    expect(ordinaryFederalFilingDeadline(2027)).not.toBe(readings.fixedApril15)
    expect(ordinaryFederalFilingDeadline(2027)).not.toBe(readings.weekendOnlySkip)
  })

  it('covers an ordinary weekday, Friday-observed Saturday holiday, Monday holiday, and the 2006 floor', () => {
    // 2027-04-15 is Thursday — no weekend or holiday bump.
    expect(ordinaryFederalFilingDeadline(2026)).toBe('2027-04-15')
    // 2022-04-16 is Saturday → observed Friday 04-15 → deadline Monday 04-18.
    expect(ordinaryFederalFilingDeadline(2021)).toBe('2022-04-18')
    // 2007-04-15 Sunday, 04-16 Monday holiday → deadline Tuesday 04-17.
    expect(ordinaryFederalFilingDeadline(2006)).toBe('2007-04-17')
  })
})

describe('ordinaryFederalFilingDeadline edges', () => {
  it('returns null outside the supported integer tax-year range', () => {
    expect(ordinaryFederalFilingDeadline(2005)).toBeNull()
    expect(ordinaryFederalFilingDeadline(9998)).not.toBeNull()
    expect(ordinaryFederalFilingDeadline(9999)).toBeNull()
    expect(ordinaryFederalFilingDeadline(2027.5)).toBeNull()
    expect(ordinaryFederalFilingDeadline(Number.NaN)).toBeNull()
    expect(ordinaryFederalFilingDeadline(Number.POSITIVE_INFINITY)).toBeNull()
    expect(ordinaryFederalFilingDeadline(Number.NEGATIVE_INFINITY)).toBeNull()
  })

  it('preserves the model re-export identity', () => {
    expect(modelOrdinaryFederalFilingDeadline).toBe(ordinaryFederalFilingDeadline)
  })
})
