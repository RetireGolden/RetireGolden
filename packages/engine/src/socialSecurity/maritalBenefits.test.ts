import { describe, expect, it } from 'vitest'

import type { FormerSpouse } from '../model/plan.js'
import { bestMaritalBenefit, maritalBenefitFor, type MaritalBenefitContext } from './maritalBenefits.js'

const divorced: FormerSpouse = {
  id: 'x1',
  relationship: 'divorced',
  dob: '1958-03-10',
  piaMonthly: 3_000,
  marriageYears: 12,
  remarriedAtAge: null,
}
const deceased: FormerSpouse = {
  id: 'x2',
  relationship: 'deceased',
  dob: '1956-05-01',
  piaMonthly: 2_400,
  marriageYears: 20,
  remarriedAtAge: null,
}

// Claimant born 1960-06-15; claims at 67 (their FRA), single, evaluated in 2030 (age 70).
const baseCtx: MaritalBenefitContext = {
  claimantDob: { year: 1960, month: 6, day: 15 },
  claimantClaimAge: { years: 67, months: 0 },
  claimantOwnPiaMonthly: 0,
  claimantOwnActualMonthly: 0,
  claimantAge: 70,
  year: 2030,
  claimantIsSingle: true,
}

describe('divorced-spousal eligibility', () => {
  it('pays 50% of the ex PIA (full at/after FRA) when all gates pass', () => {
    const c = maritalBenefitFor(divorced, baseCtx)
    expect(c).toEqual({ kind: 'divorcedSpousal', monthly: 1_500 })
  })

  it('requires a 10-year marriage', () => {
    expect(maritalBenefitFor({ ...divorced, marriageYears: 9 }, baseCtx)).toBeNull()
  })

  it('requires the claimant to be currently unmarried', () => {
    expect(maritalBenefitFor(divorced, { ...baseCtx, claimantIsSingle: false })).toBeNull()
  })

  it('requires the ex to be at least 62', () => {
    // Ex born 1958 is 62 in 2020; evaluate in 2019 → ex only 61.
    expect(maritalBenefitFor(divorced, { ...baseCtx, year: 2019 })).toBeNull()
  })

  it('reduces the spousal amount for an early claim', () => {
    const early = maritalBenefitFor(divorced, { ...baseCtx, claimantClaimAge: { years: 62, months: 0 }, claimantAge: 62 })!
    expect(early.monthly).toBeGreaterThan(0)
    expect(early.monthly).toBeLessThan(1_500)
  })

  it('is withheld until the claimant reaches their claim age', () => {
    expect(maritalBenefitFor(divorced, { ...baseCtx, claimantAge: 66 })).toBeNull()
  })
})

describe('survivor eligibility', () => {
  it('pays 100% of the deceased PIA at the survivor FRA when the deceased claimed at FRA (default)', () => {
    // No deceasedClaimAge ⇒ deceased treated as having claimed at FRA (factor 1);
    // claimant is past their survivor FRA ⇒ no widow reduction ⇒ 100% of PIA.
    const c = maritalBenefitFor(deceased, baseCtx)
    expect(c).toEqual({ kind: 'survivor', monthly: 2_400 })
  })

  it('floors the survivor at 82.5% of PIA (RIB-LIM) when the deceased claimed early', () => {
    // Deceased ex born 1954 (FRA 66), PIA 2,400, claimed at 62 → actual = 70% = 1,680.
    // RIB-LIM widow's-limit floor = 82.5% × 2,400 = 1,980 > 1,680, so the survivor
    // (at FRA) gets 1,980 — more than the deceased's reduced benefit, less than 100%.
    const earlyClaimer: FormerSpouse = {
      ...deceased,
      dob: '1954-01-01',
      deceasedClaimAge: { years: 62, months: 0 },
    }
    const c = maritalBenefitFor(earlyClaimer, baseCtx)!
    expect(c.monthly).toBeCloseTo(0.825 * 2_400, 6)
    expect(c.monthly).toBeGreaterThan(2_400 * 0.70) // above the deceased's reduced benefit
    expect(c.monthly).toBeLessThan(2_400) // below 100% of PIA
  })

  it('reduces the survivor for an early-claim widow(er) before survivor FRA', () => {
    // Claimant claims at 62; survivor FRA for born 1960 is 66y8m (800 months).
    // Deceased claimed at FRA ⇒ base = 2,400. Widow reduction at 62 (744 months):
    // frac = (744-720)/(800-720) = 0.3 ⇒ factor = 1 - 0.285×(1-0.3) = 0.8005.
    const c = maritalBenefitFor(deceased, {
      ...baseCtx,
      claimantClaimAge: { years: 62, months: 0 },
      claimantOwnPiaMonthly: 0,
      claimantOwnActualMonthly: 0,
      claimantAge: 62,
    })!
    expect(c.monthly).toBeCloseTo(2_400 * (1 - 0.285 * 0.7), 5)
    expect(c.monthly).toBeLessThan(2_400)
  })

  it('passes the deceased delayed credits through (no RIB-LIM floor)', () => {
    // Deceased ex born 1960 (FRA 67), delayed to 70 ⇒ 36 DRC months × 2/3% = +24%.
    // Actual = 124% of PIA; base = max(124%, 82.5%) = 124% (RIB-LIM floor doesn't bind).
    const delayer: FormerSpouse = {
      ...deceased,
      dob: '1960-01-02',
      deceasedClaimAge: { years: 70, months: 0 },
    }
    const c = maritalBenefitFor(delayer, baseCtx)!
    expect(c.monthly).toBeCloseTo(2_400 * 1.24, 5)
  })

  it('does not require the claimant to be single (remarriage rules govern instead)', () => {
    expect(maritalBenefitFor(deceased, { ...baseCtx, claimantIsSingle: false })).not.toBeNull()
  })

  it('requires at least a 9-month marriage', () => {
    expect(maritalBenefitFor({ ...deceased, marriageYears: 0.5 }, baseCtx)).toBeNull()
  })

  it('forfeits survivor when the claimant remarried before 60', () => {
    expect(maritalBenefitFor({ ...deceased, remarriedAtAge: 55 }, baseCtx)).toBeNull()
  })

  it('preserves survivor when the claimant remarried at or after 60', () => {
    expect(maritalBenefitFor({ ...deceased, remarriedAtAge: 61 }, baseCtx)).not.toBeNull()
  })
})

describe('bestMaritalBenefit', () => {
  it('returns the largest eligible benefit across records', () => {
    const best = bestMaritalBenefit([divorced, deceased], baseCtx)
    expect(best).toEqual({ kind: 'survivor', monthly: 2_400 })
  })

  it('returns null when nothing is eligible', () => {
    expect(bestMaritalBenefit([{ ...divorced, marriageYears: 1 }], { ...baseCtx, claimantIsSingle: true })).toBeNull()
    expect(bestMaritalBenefit(undefined, baseCtx)).toBeNull()
    expect(bestMaritalBenefit([], baseCtx)).toBeNull()
  })
})

describe('divorced-spousal earnings-test credit (402(q)(7))', () => {
  // Claimant born 1962-06-15 (FRA 67, 804 months), 800 PIA, claims at 64y0m
  // (768 months); her own benefit is taken as 693.33, already credited to 780
  // months. The ex, born 1955-01-10 with a 2,400 PIA, was 62 long before her
  // claim, so the divorced-spouse benefit starts at 768 months (factor 0.75).
  const ex: FormerSpouse = { ...divorced, dob: '1955-01-10', piaMonthly: 2_400 }
  const ctx: MaritalBenefitContext = {
    claimantDob: { year: 1962, month: 6, day: 15 },
    claimantClaimAge: { years: 64, months: 0 },
    claimantOwnPiaMonthly: 800,
    claimantOwnActualMonthly: 800 * (1 - (24 * 5) / 900),
    claimantAge: 67,
    year: 2029,
    claimantIsSingle: true,
  }
  const own = 800 * (1 - (24 * 5) / 900)

  it('credits the spouse months withheld from the year she reaches FRA: 780 months, 400 x 0.833333', () => {
    const c = maritalBenefitFor(ex, { ...ctx, claimantSpouseWithheldMonths: 12 })
    expect(c?.kind).toBe('divorcedSpousal')
    expect(c!.monthly).toBeCloseTo(own + 400 * (1 - (24 * 25) / 3600), 9)
    expect(c!.monthly).toBeCloseTo(1_026.67, 2)
  })

  it('credits nothing before that year, or when no spouse month was withheld: 400 x 0.75', () => {
    expect(maritalBenefitFor(ex, { ...ctx, claimantSpouseWithheldMonths: 12, claimantAge: 66, year: 2028 })!.monthly).toBeCloseTo(own + 300, 9)
    expect(maritalBenefitFor(ex, ctx)!.monthly).toBeCloseTo(own + 300, 9)
  })

  it('credits no further than FRA: 40 months take the spouse factor to 1, not past it', () => {
    expect(maritalBenefitFor(ex, { ...ctx, claimantSpouseWithheldMonths: 40 })!.monthly).toBeCloseTo(own + 400, 9)
  })
})
