import { describe, expect, it } from 'vitest'

import {
  assertSsdiMedicareContinuationNotDeterminedFromCashBenefitFacts,
  ssdiFirstPayableMonthIndex,
  ssdiMonthlyBenefit,
  ssdiMonthsInYear,
  ssdiSchedule,
  ssdiSuspendedBySga,
  inSsdiWindow,
  SGA_ANNUAL_MONTHS,
} from './disability.js'

/** `year * 12 + (month - 1)`, the month index the helpers return. */
const monthIndex = (year: number, month: number) => year * 12 + (month - 1)

describe('ssdiFirstPayableMonthIndex (42 U.S.C. 423(c)(2), POMS DI 10105.070)', () => {
  // Born 1970, onsetAge 60: the onset year is 2030. An onset after the 1st of
  // month M makes M+1 to M+5 the waiting period and M+6 the first payable
  // month (the independent check's month-by-month enumeration).
  it('pays from the sixth month after the onset month', () => {
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 1 })).toBe(monthIndex(2030, 7))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 3 })).toBe(monthIndex(2030, 9))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 6 })).toBe(monthIndex(2030, 12))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 7 })).toBe(monthIndex(2031, 1))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 10 })).toBe(monthIndex(2031, 4))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: 12 })).toBe(monthIndex(2031, 6))
  })

  it('reads a blank month as January 1: waiting January to May, first payable June', () => {
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60 })).toBe(monthIndex(2030, 6))
    expect(ssdiFirstPayableMonthIndex(1970, { onsetAge: 60, onsetMonth: undefined })).toBe(monthIndex(2030, 6))
  })
})

describe('ssdiSchedule and ssdiMonthsInYear', () => {
  const dob = { year: 1970, month: 6, day: 15 }

  it('ends disability with the month before the FRA month (June 2037 for a 1970-06-15 birth)', () => {
    const schedule = ssdiSchedule(dob, { onsetAge: 60, onsetMonth: 3 })!
    expect(schedule.fraMonthIndex).toBe(monthIndex(2037, 6))
    expect(ssdiMonthsInYear(schedule, 2029)).toEqual({ disability: 0, retirement: 0 })
    expect(ssdiMonthsInYear(schedule, 2030)).toEqual({ disability: 4, retirement: 0 })
    expect(ssdiMonthsInYear(schedule, 2031)).toEqual({ disability: 12, retirement: 0 })
    expect(ssdiMonthsInYear(schedule, 2037)).toEqual({ disability: 5, retirement: 7 })
    expect(ssdiMonthsInYear(schedule, 2038)).toEqual({ disability: 0, retirement: 12 })
  })

  it('pays one disability month when the waiting period ends the month before FRA (November 2036 onset)', () => {
    const schedule = ssdiSchedule(dob, { onsetAge: 66, onsetMonth: 11 })!
    expect(schedule.firstPayableMonthIndex).toBe(monthIndex(2037, 5))
    expect(ssdiMonthsInYear(schedule, 2036)).toEqual({ disability: 0, retirement: 0 })
    expect(ssdiMonthsInYear(schedule, 2037)).toEqual({ disability: 1, retirement: 7 })
  })

  it('has no schedule when the first payable month is the FRA month or later (December 2036 onset)', () => {
    expect(ssdiSchedule(dob, { onsetAge: 66, onsetMonth: 12 })).toBeNull()
    expect(ssdiSchedule(dob, { onsetAge: 67 })).toBeNull()
    expect(ssdiSchedule(dob, { onsetAge: 70 })).toBeNull()
  })

  it('places FRA by month for a 66y10m cohort (born 1959-06-15: April 2026)', () => {
    const schedule = ssdiSchedule({ year: 1959, month: 6, day: 15 }, { onsetAge: 58 })!
    expect(schedule.fraMonthIndex).toBe(monthIndex(2026, 4))
    expect(ssdiMonthsInYear(schedule, 2025)).toEqual({ disability: 12, retirement: 0 })
    expect(ssdiMonthsInYear(schedule, 2026)).toEqual({ disability: 3, retirement: 9 })
  })

  it('uses the day-before-birthday rule for a birthday on the 1st (born 1970-07-01 attains 67 in June 2037)', () => {
    const schedule = ssdiSchedule({ year: 1970, month: 7, day: 1 }, { onsetAge: 60 })!
    expect(schedule.fraMonthIndex).toBe(monthIndex(2037, 6))
  })
})

describe('ssdiMonthlyBenefit', () => {
  it('returns the PIA with no early-retirement reduction', () => {
    expect(ssdiMonthlyBenefit(2_000)).toBe(2_000)
  })

  it('is the full PIA even for an onset well before 62 (the SSDI difference)', () => {
    // Early retirement at 55 would reduce ~30%; SSDI pays the full PIA.
    expect(ssdiMonthlyBenefit(2_000)).toBe(2_000)
    expect(ssdiMonthlyBenefit(2_000)).toBeGreaterThan(2_000 * 0.70)
  })

  it('floors at zero for a negative PIA input', () => {
    expect(ssdiMonthlyBenefit(-1)).toBe(0)
  })
})

describe('ssdiSuspendedBySga', () => {
  const sgaMonthly = 1_690 // 2026 non-blind monthly SGA, 90 FR 49047
  const annual = sgaMonthly * SGA_ANNUAL_MONTHS // 20,280

  it('does not suspend when wages are at or below the annual SGA limit', () => {
    expect(ssdiSuspendedBySga(0, annual)).toBe(false)
    expect(ssdiSuspendedBySga(annual, annual)).toBe(false)
  })

  it('suspends when wages exceed the annual SGA limit', () => {
    expect(ssdiSuspendedBySga(annual + 1, annual)).toBe(true)
    expect(ssdiSuspendedBySga(60_000, annual)).toBe(true)
  })
})

describe('inSsdiWindow', () => {
  it('is false in a year that pays no disability month (before onset, or in the waiting period)', () => {
    expect(inSsdiWindow({ disability: 0, retirement: 0 })).toBe(false)
  })

  it('is true in a year that pays only disability months (the SSDI window, pre-conversion)', () => {
    expect(inSsdiWindow({ disability: 4, retirement: 0 })).toBe(true)
    expect(inSsdiWindow({ disability: 12, retirement: 0 })).toBe(true)
  })

  it('is false from the year that holds the FRA month (SSDI has converted to retirement)', () => {
    expect(inSsdiWindow({ disability: 5, retirement: 7 })).toBe(false)
    expect(inSsdiWindow({ disability: 0, retirement: 12 })).toBe(false)
  })
})

describe('assertSsdiMedicareContinuationNotDeterminedFromCashBenefitFacts', () => {
  // SSA Red Book / DI 28055.001: at least 93 months after TWP — cash-benefit
  // EPE (36 months) is distinct and must not be added to another 93.
  it('does not produce a Part A interval from onset age and SGA suspension', () => {
    const boundary = assertSsdiMedicareContinuationNotDeterminedFromCashBenefitFacts({
      onsetAge: 58,
      ssdiCashBenefitSuspendedBySga: true,
    })
    expect(boundary.status).toBe('notAMedicareContinuationDetermination')
    expect(boundary.partAEntitlementMonths).toBeNull()
    expect(boundary.authorityMinimumMonthsAfterTwp).toBe(93)
    expect(boundary.missingFacts).toEqual([
      'trialWorkPeriodEndDate',
      'entitlementTerminationDate',
      'continuingImpairmentAfterTermination',
      'substantialGainfulActivityCounterfactual',
      'medicarePartAEntitlementInterval',
    ])
  })

  it('keeps the cash-benefit SGA enforcer registered as a negative control', () => {
    const sgaMonthly = 1_690
    const annual = sgaMonthly * SGA_ANNUAL_MONTHS
    expect(ssdiSuspendedBySga(annual + 1, annual)).toBe(true)
  })
})
