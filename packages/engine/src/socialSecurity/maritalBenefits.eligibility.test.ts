import { expect, it } from 'vitest'

import type { FormerSpouse } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { maritalBenefitFor, type MaritalBenefitContext } from './maritalBenefits.js'

/**
 * Eligibility-only fixtures for the living-divorced and ordinary-widow gates.
 * Pricing uses FRA so the half-PIA and unreduced-survivor amounts are 1,500
 * and 2,400; deceased claim age defaults to FRA so RIB-LIM and the survivor-FRA
 * cohort error are not in play. Worksheet-only facts that formerSpouseSchema
 * cannot carry (worker entitlement, years since divorce) are named in comments
 * and projected out of the input. Worksheet assumes fully insured, a valid
 * relationship, the application requirement met, own old-age benefit below the
 * deceased PIA (living-divorced: own PIA below half PIA), and no disabled-widow
 * or child exception.
 */

const ctx: MaritalBenefitContext = {
  claimantDob: { year: 1960, month: 6, day: 15 },
  claimantClaimAge: { years: 67, months: 0 },
  claimantAge: 67,
  year: 2027,
  claimantIsSingle: true,
}

const monthlyOf = (record: FormerSpouse, context: MaritalBenefitContext = ctx): number | null => {
  const monthly = maritalBenefitFor(record, context)?.monthly ?? null
  // Cent-precision normalization of this helper observation only, to strip
  // binary float noise (e.g. 1716.0000000000002). Not a new rounding law.
  return monthly === null ? null : Math.round(monthly * 100) / 100
}

describeRule('cfr-20-404-331-living-divorced-spouse-eligibility', {
  // Claimant born 1960-06-15, claims at FRA 67 in 2027, currently single.
  // Ex PIA 3,000, 10-year marriage. Spousal factor at FRA is 1.0, so a payable
  // divorced-spousal amount is 0.5 × 3,000 = 1,500.
  //
  // Vector:
  //   [0] ex born 1966-06-15 (calendar age 61 in 2027). Worksheet: already
  //       entitled to disability insurance benefits. 404.331 (a)–(e) pays
  //       because the worker is entitled; the engine's age-62 blanket rejects.
  //   [1] ex born 1965-06-15 (calendar age 62 in 2027). Worksheet: not entitled
  //       to old-age or disability benefits, divorced only 1 year. 404.331(f) /
  //       402(b)(4)(A) refuse; the engine sees age 62 and 10 years and pays.
  // The rejected reading requires both age 62 and two years divorced on every
  // path, so it refuses both cells.
  readings: {
    statutory: [1_500, null],
    engineCalendarAge62OmitsEntitlementAndDuration: [null, 1_500],
    alwaysRequireExAge62AndTwoYearsDivorced: [null, null],
  },
  accepted: 'statutory',
  produced: 'engineCalendarAge62OmitsEntitlementAndDuration',
}, ({ accepted, produced, readings }) => {
  it('pins the calendar-year age-62 blanket against worker entitlement and the two-year independently entitled path', () => {
    const divorced: FormerSpouse = {
      id: 'former',
      relationship: 'divorced',
      dob: '1965-06-15',
      piaMonthly: 3_000,
      marriageYears: 10,
      remarriedAtAge: null,
    }
    const amounts = [
      monthlyOf({ ...divorced, dob: '1966-06-15' }),
      monthlyOf(divorced),
    ]

    expect(amounts).toEqual(produced)
    expect(amounts).not.toEqual(accepted)
    expect(amounts).not.toEqual(readings.alwaysRequireExAge62AndTwoYearsDivorced)
  })
})

describeRule('cfr-20-404-335-ordinary-widow-eligibility', {
  // Same claimant DOB 1960-06-15. Direct helper call, so the age-60 gate is
  // reachable; a whole-plan claimAge is clamped to 62–70 and is outside this
  // fixture (not a claim that the whole Plan can price 59/60).
  //
  // Cells [0]–[3] evaluate at age 67 in 2027 (past survivor FRA so the
  // unreduced ordinary-widow amount is 2,400); deceased treated as claimed at
  // FRA. Cells [4]–[5] drive the min-60 gate with claimantAge equal to
  // claimantClaimAge so the claim-age guard passes and age 59 is refused by
  // isWidowEligible: age 59 / year 2019 / claimAge 59, then age 60 / year 2020
  // / claimAge 60; deceased DOB 1950-06-15 (worker FRA 66, default FRA claim).
  // Authority: non-disabled ordinary widow at 59 is null; at 60 the amount is
  // 2,400 × (1 − 0.285) = 1,716.
  //
  // Vector:
  //   [0] 9-month ordinary marriage, no remarriage, currently single → 2,400.
  //   [1] 8-month marriage, no duration exception → null.
  //   [2] 9-month, remarried at 59, now currently single → authority 2,400
  //       (currently unmarried after the intervening marriage ended); engine
  //       null (unconditional historical remarriage-before-60 refusal).
  //   [3] 9-month, remarried at 60, still married → 2,400 (404.335(e)(1)).
  //   [4] 9-month, no remarriage, claimant age 59 → null (ordinary 404.335(c)).
  //   [5] 9-month, no remarriage, claimant age 60 → 1,716.
  //   [6] 9-month, remarriedAtAge null, claimantIsSingle false → null (404.335(e):
  //       worksheet current marriage entered before 60 and still in effect; no
  //       exception). Worksheet current pre-60 marriage is projected out —
  //       remarriedAtAge null itself does not prove timing — so the engine pays
  //       2,400.
  // The rejected 10-year reading applies the surviving-divorced duration to
  // this ordinary-widow path, so every cell is null. The rejected worker-62
  // reading imports the old-age minimum onto the survivor path, so the new
  // age-59 and age-60 cells are both null and the original four statutory
  // cells are unchanged.
  readings: {
    statutoryOrdinaryWidow: [2_400, null, 2_400, 2_400, null, 1_716, null],
    engineIgnoresClaimantIsSingleAndUnconditionalPre60Remarriage: [2_400, null, null, 2_400, null, 1_716, 2_400],
    survivingDivorcedTenYearDuration: [null, null, null, null, null, null, null],
    importingWorkerOldAgeMinimum62: [2_400, null, 2_400, 2_400, null, null, null],
  },
  accepted: 'statutoryOrdinaryWidow',
  produced: 'engineIgnoresClaimantIsSingleAndUnconditionalPre60Remarriage',
}, ({ accepted, produced, readings }) => {
  it('pins the ordinary nine-month widow path, including currently-single after a pre-60 intervening marriage and coupled null remarriage timing', () => {
    const widow: FormerSpouse = {
      id: 'former',
      relationship: 'deceased',
      dob: '1960-06-15',
      piaMonthly: 2_400,
      marriageYears: 0.75,
      remarriedAtAge: null,
    }
    const widowAgeGate: FormerSpouse = {
      ...widow,
      dob: '1950-06-15',
    }
    const at59: MaritalBenefitContext = {
      claimantDob: { year: 1960, month: 6, day: 15 },
      claimantClaimAge: { years: 59, months: 0 },
      claimantAge: 59,
      year: 2019,
      claimantIsSingle: true,
    }
    const at60: MaritalBenefitContext = {
      ...at59,
      claimantClaimAge: { years: 60, months: 0 },
      claimantAge: 60,
      year: 2020,
    }
    const amounts = [
      monthlyOf(widow),
      monthlyOf({ ...widow, marriageYears: 8 / 12 }),
      monthlyOf({ ...widow, remarriedAtAge: 59 }),
      monthlyOf({ ...widow, remarriedAtAge: 60 }, { ...ctx, claimantIsSingle: false }),
      monthlyOf(widowAgeGate, at59),
      monthlyOf(widowAgeGate, at60),
      monthlyOf(widow, { ...ctx, claimantIsSingle: false }),
    ]

    expect(amounts).toEqual(produced)
    expect(amounts).not.toEqual(accepted)
    expect(amounts).not.toEqual(readings.survivingDivorcedTenYearDuration)
    expect(amounts).not.toEqual(readings.importingWorkerOldAgeMinimum62)
  })
})
