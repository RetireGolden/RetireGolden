import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from '../engine/projection/flatTax'
import type { FormerSpouse } from '../engine/model/plan'
import { expectMoney } from '../testSupport/money'
import { couplePlan, runPlan, socialSecurityIncome } from '../testSupport/planFixtures'
import { bestMaritalBenefit, maritalBenefitFor, type MaritalBenefitContext } from './maritalBenefits'

/**
 * Atomic oracle tests for the marital-history benefit menu and the projection
 * spousal top-up (Phase 1, calculation-test-plan.md).
 *
 * Rules (maritalBenefits.ts): divorced-spousal needs a >=10-year marriage, a
 * currently-single claimant, and an ex who has reached 62; it pays 50% of the
 * ex's PIA reduced for the claimant's own (early) claim age, no delayed credits.
 * Survivor needs a >=9-month marriage, claimant >=60, and no remarriage before 60;
 * it pays 100% of the deceased's PIA (v1 simplification, no widow reduction).
 * A marital benefit only starts once the claimant has reached their own claim age.
 */

// Claimant born 1960-06-15 (FRA 67), claims at 67, evaluated in 2027 at age 67, single.
const baseCtx: MaritalBenefitContext = {
  claimantDob: { year: 1960, month: 6, day: 15 },
  claimantClaimAge: { years: 67, months: 0 },
  claimantAge: 67,
  year: 2027,
  claimantIsSingle: true,
}

const divorced: FormerSpouse = {
  id: 'ex1',
  relationship: 'divorced',
  dob: '1958-03-10',
  piaMonthly: 3_000,
  marriageYears: 12,
  remarriedAtAge: null,
}

const deceased: FormerSpouse = {
  id: 'ex2',
  relationship: 'deceased',
  dob: '1956-05-01',
  piaMonthly: 2_400,
  marriageYears: 20,
  remarriedAtAge: null,
}

describe('marital-benefit menu golden worksheets', () => {
  it('grants divorced-spousal when every gate passes', () => {
    // Claim at FRA 67 -> spousal factor 1.0 -> 50% * 3,000 = 1,500.
    const c = maritalBenefitFor(divorced, baseCtx)
    expect(c?.kind).toBe('divorcedSpousal')
    expectMoney(c!.monthly, 1_500)

    // Claiming early reduces the spousal factor: at 62 (60 months early),
    // 36*(25/36)% + 24*(5/12)% = 25% + 10% = 35% reduction -> factor 0.65.
    // 50% * 3,000 * 0.65 = 975.
    const early = maritalBenefitFor(divorced, { ...baseCtx, claimantClaimAge: { years: 62, months: 0 }, claimantAge: 62, year: 2022 })
    expectMoney(early!.monthly, 975)
  })

  it('denies divorced-spousal when any single gate fails', () => {
    // Marriage under 10 years.
    expect(maritalBenefitFor({ ...divorced, marriageYears: 9 }, baseCtx)).toBeNull()
    // Claimant currently married.
    expect(maritalBenefitFor(divorced, { ...baseCtx, claimantIsSingle: false })).toBeNull()
    // Ex has not yet reached 62 (born 1970 -> age 57 in 2027).
    expect(maritalBenefitFor({ ...divorced, dob: '1970-01-01' }, baseCtx)).toBeNull()
    // Claimant has not yet reached their own claim age.
    expect(maritalBenefitFor(divorced, { ...baseCtx, claimantAge: 66 })).toBeNull()
  })

  it('preserves the survivor benefit when remarriage is at or after 60', () => {
    // No remarriage, or remarriage at/after 60 -> 100% of the deceased's PIA.
    expectMoney(maritalBenefitFor(deceased, baseCtx)!.monthly, 2_400)
    expectMoney(maritalBenefitFor({ ...deceased, remarriedAtAge: 60 }, baseCtx)!.monthly, 2_400)
    expectMoney(maritalBenefitFor({ ...deceased, remarriedAtAge: 61 }, baseCtx)!.monthly, 2_400)
  })

  it('forfeits the survivor benefit when remarriage is before 60', () => {
    expect(maritalBenefitFor({ ...deceased, remarriedAtAge: 59 }, baseCtx)).toBeNull()
    // Also gated by the >=9-month marriage minimum.
    expect(maritalBenefitFor({ ...deceased, marriageYears: 0.5 }, baseCtx)).toBeNull()
  })

  it('picks the largest eligible benefit across former spouses', () => {
    // Survivor 2,400 beats divorced-spousal 1,500.
    const best = bestMaritalBenefit([divorced, deceased], baseCtx)
    expect(best?.kind).toBe('survivor')
    expectMoney(best!.monthly, 2_400)
  })
})

describe('projection spousal top-up golden worksheet', () => {
  it('applies the spousal top-up only once the higher earner has also claimed', () => {
    // Low earner p1 (PIA 1,000, born 1962) claims 67 in 2029.
    // High earner p2 (PIA 3,000, born 1965) claims 67 in 2032.
    // Both claim at FRA, so own benefits are clean: 12,000 and 36,000.
    const plan = couplePlan({
      p1Dob: '1962-06-15',
      p2Dob: '1965-06-15',
      p1PlanningAge: 75,
      p2PlanningAge: 75,
      state: 'FL',
    })
    plan.incomes = [
      socialSecurityIncome('low', 1_000, 67, 'p1'),
      socialSecurityIncome('high', 3_000, 67, 'p2'),
    ]

    const result = runPlan(plan, createFlatTaxCalculator(0))
    const ssIn = (year: number) => result.years.find((y) => y.year === year)!.incomes.socialSecurity

    // 2031: p1 has claimed (age 69) but p2 has not (age 66) -> only p1's own 12,000.
    expectMoney(ssIn(2031), 12_000)

    // 2032: p2 claims at 67 -> p1 gets the spousal top-up (50% * 3,000 = 18,000,
    // factor 1.0 at p1's FRA claim) plus p2's own 36,000 = 54,000.
    expectMoney(ssIn(2032), 54_000)
  })
})
