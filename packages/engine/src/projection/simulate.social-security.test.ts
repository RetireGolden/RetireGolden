import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  formerSpouseSchema,
  parsePlan,
  socialSecurityIncomeSchema,
  type IncomeStream,
  type Plan,
} from '../model/plan.js'
import { year2026 } from '../params/data/year2026.js'
import { computePiaFromEarnings, isPiaFromEarningsError } from '../socialSecurity/piaFromEarnings.js'
import { AWI_BY_YEAR } from '../socialSecurity/ssaWageData.js'
import { simulatePlan } from './simulate.js'
import { ssdiNotPayableBeforeFraWarning } from './internal/annualSocialSecurity.js'
import { claimFactor } from '../socialSecurity/claimFactor.js'
import {
  basePlan,
  cash,
  noTax,
  socialSecurityIncomeIn,
  testIds,
  validate,
  wages,
} from './simulate.test-support.js'

describe('social security', () => {
  // Section 423(a)(2) starts this worker at their full PIA, not the 70-percent
  // retirement factor that would attach to an ordinary age-62 claim. The same
  // PIA carries through the FRA source conversion and the first post-FRA year
  // (no DRC): the worker is 60 in 2026, reaches FRA 67 in 2033, and is 68 in 2034.
  describeRule('usc-42-423-a-2-cfr-20-404-317-ssdi-full-pia-fra-conversion', {
    readings: {
      fullPiaThroughFirstPostFraYear: { beforeFra: 24_000, atFra: 24_000, firstPostFraYear: 24_000 },
      earlyRetirementFactorThroughFirstPostFraYear: { beforeFra: 16_800, atFra: 16_800, firstPostFraYear: 16_800 },
    },
    accepted: 'fullPiaThroughFirstPostFraYear',
    note: 'integer FRA 67 cohort',
  }, ({ accepted, readings }) => {
    it('pays the full PIA during SSDI, at FRA, and in the first post-FRA year', () => {
      const plan = basePlan()
      plan.incomes = [{
        type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
        disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
      }]
      plan.accounts = [cash(2_000_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const observed = {
        beforeFra: socialSecurityIncomeIn(result, 2026),
        atFra: socialSecurityIncomeIn(result, 2033),
        firstPostFraYear: socialSecurityIncomeIn(result, 2034),
      }

      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.earlyRetirementFactorThroughFirstPostFraYear)
    })
  })

  // Born 1959 → FRA 66y10m, attained in April 2026. The SSDI schedule places
  // FRA by month (disability months to March 2026, the converted benefit from
  // April). Observe the unreduced-amount path around that month; if the
  // cohort misbehaves, stop and print rather than pin settled.
  describeRule('usc-42-423-a-2-cfr-20-404-317-ssdi-full-pia-fra-conversion', {
    readings: {
      fullPiaAroundNonIntegerFra: { beforeFraYears: 24_000, atFraYears: 24_000, afterFraYears: 24_000 },
      earlyRetirementAroundNonIntegerFra: { beforeFraYears: 16_800, atFraYears: 16_800, afterFraYears: 16_800 },
    },
    accepted: 'fullPiaAroundNonIntegerFra',
    note: '1959 FRA 66y10m cohort',
  }, ({ accepted, readings }) => {
    it('observes the unreduced PIA for a 66y10m FRA cohort around fra.years', () => {
      const plan = basePlan()
      plan.household.people[0] = {
        id: 'p1', name: 'Pat', dob: '1959-06-15', sex: 'average',
        retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
      }
      plan.incomes = [{
        type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
        disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
      }]
      plan.accounts = [cash(2_000_000)]

      // Age 65 in 2024, age 66 (fra.years) in 2025, age 67 in 2026.
      const result = simulatePlan(validate(plan), { startYear: 2024, taxCalculator: noTax })
      const observed = {
        beforeFraYears: socialSecurityIncomeIn(result, 2024),
        atFraYears: socialSecurityIncomeIn(result, 2025),
        afterFraYears: socialSecurityIncomeIn(result, 2026),
      }

      // If this cohort misbehaves around the FRA month, print and stop rather
      // than pinning a settled identity that is not true.
      if (
        observed.beforeFraYears !== 24_000 ||
        observed.atFraYears !== 24_000 ||
        observed.afterFraYears !== 24_000
      ) {
        throw new Error(`1959 FRA 66y10m cohort misbehaved: ${JSON.stringify(observed)}`)
      }

      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.earlyRetirementAroundNonIntegerFra)
    })
  })

  // The independent check's worker (D-APPROX-FACTS): born 1970-06-15, so FRA
  // 67 is attained in June 2037; PIA 2,000, no COLA; onsetAge 60, so the onset
  // year is 2030. Onset after the 1st of month M: waiting M+1 to M+5, first
  // payable M+6 (42 U.S.C. 423(a)(1), (c)(2); POMS DI 10105.070).
  function ssdiWorkerPlan(disability: { onsetAge: number; onsetMonth?: number }, claimAgeYears = 62): Plan {
    const plan = basePlan()
    plan.household.people[0] = {
      id: 'p1', name: 'Pat', dob: '1970-06-15', sex: 'average',
      retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
    }
    plan.incomes = [{
      type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
      disability, claimAge: { years: claimAgeYears, months: 0 },
    }]
    plan.accounts = [cash(2_000_000)]
    return plan
  }
  const ssdiRun = (plan: Plan) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

  // A blank month reads as January 1 (waiting January to May, first payable
  // June: 7 months in 2030), the largest amount the statute allows for the
  // onset year. For a worker whose disability in fact began in mid-March 2030
  // the statute pays September to December, 8,000.
  describeRule('usc-42-423-c-2-ssdi-five-month-waiting-period', {
    readings: {
      marchOnsetStatute: 8_000,
      blankMonthReadAsJanuaryFirst: 14_000,
    },
    accepted: 'marchOnsetStatute',
    produced: 'blankMonthReadAsJanuaryFirst',
    note: 'blank onset month',
  }, ({ accepted, produced }) => {
    it('reads a blank onset month as January 1 and pays seven months in the onset year', () => {
      const observed = socialSecurityIncomeIn(ssdiRun(ssdiWorkerPlan({ onsetAge: 60 })), 2030)

      expect(observed).toBeCloseTo(produced, 6)
      expect(observed).not.toBeCloseTo(accepted, 6)
    })

    it('pays the statute amount once the month is given', () => {
      const result = ssdiRun(ssdiWorkerPlan({ onsetAge: 60, onsetMonth: 3 }))
      expect(socialSecurityIncomeIn(result, 2030)).toBeCloseTo(accepted, 6)
      expect(socialSecurityIncomeIn(result, 2031)).toBeCloseTo(24_000, 6)
    })
  })

  // The month is read as an onset after the 1st. An onset on July 1, 2030 has
  // July as its first waiting month and December 2030 as its first payable
  // month (2,000 in 2030); read as after the 1st, the waiting period is August
  // to December and nothing is paid until January 2031.
  describeRule('usc-42-423-c-2-ssdi-five-month-waiting-period', {
    readings: {
      julyFirstOnsetStatute: 2_000,
      monthReadAsAfterTheFirst: 0,
    },
    accepted: 'julyFirstOnsetStatute',
    produced: 'monthReadAsAfterTheFirst',
    note: 'onset on the 1st',
  }, ({ accepted, produced }) => {
    it('pays nothing in 2030 for a July onset, one month later than an onset on July 1 allows', () => {
      const observed = socialSecurityIncomeIn(ssdiRun(ssdiWorkerPlan({ onsetAge: 60, onsetMonth: 7 })), 2030)

      expect(observed).toBeCloseTo(produced, 6)
      expect(observed).not.toBeCloseTo(accepted, 6)
    })
  })

  // At the full-retirement-age edge the one-month limit decides whether there
  // is a disability benefit at all. An onset on December 1, 2036 has December
  // to April as its waiting period, May 2037 as its one disability month and
  // the automatic conversion from June (42 U.S.C. 402(a)(3)): 8 x 2,000 in 2037.
  // Read as after the 1st, the first payable month would be June 2037, the FRA
  // month itself, so there is no disability benefit and the claim at 70 governs.
  describeRule('usc-42-423-c-2-ssdi-five-month-waiting-period', {
    readings: {
      decemberFirstOnsetStatute: 16_000,
      noDisabilityBenefitClaimAtSeventy: 0,
    },
    accepted: 'decemberFirstOnsetStatute',
    produced: 'noDisabilityBenefitClaimAtSeventy',
    note: 'full retirement age edge',
  }, ({ accepted, produced }) => {
    it('falls through to the claim age, with a warning, when the first payable month is the FRA month', () => {
      const result = ssdiRun(ssdiWorkerPlan({ onsetAge: 66, onsetMonth: 12 }, 70))
      const observed = socialSecurityIncomeIn(result, 2037)

      expect(observed).toBeCloseTo(produced, 6)
      expect(observed).not.toBeCloseTo(accepted, 6)
      expect(result.warnings).toContain(ssdiNotPayableBeforeFraWarning('Pat'))
      // The engine's claim-year convention pays 12 months at 70 in 2040
      // (1.24 x 2,000 x 12); the statute starts in June 2040 (17,360).
      expect(socialSecurityIncomeIn(result, 2040)).toBeCloseTo(29_760, 6)
    })

    it('pays one disability month and converts at FRA for a November 2036 onset', () => {
      const result = ssdiRun(ssdiWorkerPlan({ onsetAge: 66, onsetMonth: 11 }, 70))
      const y2037 = result.years.find((row) => row.year === 2037)!
      expect(y2037.incomes.socialSecurity).toBeCloseTo(16_000, 6)
      expect(y2037.ssdiPaid).toBeCloseTo(2_000, 6)
      expect(result.warnings).not.toContain(ssdiNotPayableBeforeFraWarning('Pat'))
    })
  })

  it("names the person whose disability date leaves no disability month, so a couple's two streams are told apart", () => {
    // Pat's December 2036 onset leaves none (first payable June 2037, her FRA
    // month); Sam, born the same day, has a 2030 onset and is paid SSDI.
    const plan = ssdiWorkerPlan({ onsetAge: 66, onsetMonth: 12 }, 70)
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2', name: 'Sam', dob: '1970-06-15', sex: 'average',
      retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
    })
    plan.incomes.push({
      type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 2_000, earnings: null,
      disability: { onsetAge: 60, onsetMonth: 3 }, claimAge: { years: 62, months: 0 },
    })
    const result = ssdiRun(plan)
    expect(result.warnings).toContain(ssdiNotPayableBeforeFraWarning('Pat'))
    expect(result.warnings).not.toContain(ssdiNotPayableBeforeFraWarning('Sam'))
    expect(ssdiNotPayableBeforeFraWarning('Pat')).toBe(
      "The date Pat's disability began leaves no Social Security disability month before full retirement age (the first payment would fall at or after it), so Pat's benefit is priced as a retirement claim at the claim age.",
    )
  })

  // claimAge 62 precedes disability.onsetAge 65: engine suppresses pre-onset
  // reduced retirement and pays full PIA from onset (ignoring 402(q) carry-in).
  // The post-onset year observed is 2030, the first full year after the
  // waiting period of a 2029 onset.
  describeRule('usc-42-423-a-2-402-q-retirement-claim-before-disability-onset', {
    readings: {
      reducedRetirementThenQ2ReducedDib: { preOnsetYear: 16_800, postOnsetYear: 19_200 },
      suppressesPreOnsetAndPaysFullPiaFromOnset: { preOnsetYear: 0, postOnsetYear: 24_000 },
    },
    accepted: 'reducedRetirementThenQ2ReducedDib',
    produced: 'suppressesPreOnsetAndPaysFullPiaFromOnset',
  }, ({ accepted, produced }) => {
    it('pays nothing before onset and the full PIA afterward when claimAge precedes onsetAge', () => {
      const plan = basePlan()
      // Age 62 in 2026, onset at 65 → 2029, first full year 2030; FRA 67 in 2031.
      plan.household.people[0] = {
        id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'average',
        retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
      }
      plan.incomes = [{
        type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
        disability: { onsetAge: 65 }, claimAge: { years: 62, months: 0 },
      }]
      plan.accounts = [cash(2_000_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const observed = {
        preOnsetYear: socialSecurityIncomeIn(result, 2026),
        postOnsetYear: socialSecurityIncomeIn(result, 2030),
      }

      expect(observed).toEqual(produced)
      expect(observed).not.toEqual(accepted)
    })
  })

  // Section 403(a)(6) gives the DI household a maximum of
  // min(max(85% x 500 AIME, 100% x 450 PIA), 150% x 450 PIA) = 450/month.
  // A worker PIA of 450 plus a spouse auxiliary of 225 therefore caps at
  // 450/month = 5,400/year. The retirement/survivor first tier instead lets
  // the 675/month sum through: the household observably receives 8,100/year.
  describeRule('usc-42-403-a-6-ssdi-family-maximum', {
    readings: {
      disabilityAimeMaximum: 5_400,
      retirementSurvivorMaximum: 8_100,
    },
    accepted: 'disabilityAimeMaximum',
    produced: 'retirementSurvivorMaximum',
  }, ({ accepted, produced }) => {
    it('uses the retirement/survivor maximum for an SSDI worker and spouse', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Disabled worker', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
        { id: 'p2', name: 'Spouse', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
      ]
      plan.incomes = [
        {
          type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 450, earnings: null,
          disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
        },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
      ]
      plan.accounts = [cash(2_000_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const observed = socialSecurityIncomeIn(result, 2026)

      expect(observed).toBeCloseTo(produced, 6)
      expect(observed).not.toBeCloseTo(accepted, 6)
    })
  })

  // Section 402(c)(1) makes the spouse eligible on a living disabled worker's
  // record without waiting for the worker's ordinary claimAge, and section 425(a)
  // suspends auxiliaries when the worker's wages exceed annual SGA. The engine
  // gates the spouse on the worker claimAge and zeros only the worker on SGA.
  describeRule('usc-42-402-c-2-ssdi-spouse-auxiliary', {
    readings: {
      statute: { claimAgeGate: 36_000, suspension: 0 },
      currentEngine: { claimAgeGate: 24_000, suspension: 12_000 },
    },
    accepted: 'statute',
    produced: 'currentEngine',
  }, ({ accepted, produced, readings }) => {
    it('does not start the SSDI spouse auxiliary before the worker reaches claimAge', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        // Onset at 58 in 2025, so 2026 is a full year of disability benefits.
        { id: 'p1', name: 'Disabled worker', dob: '1967-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
        { id: 'p2', name: 'Eligible spouse', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
      ]
      plan.incomes = [
        {
          type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
          disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
        },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
      ]
      plan.accounts = [cash(2_000_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const observed = socialSecurityIncomeIn(result, 2026)

      expect(observed).toBeCloseTo(produced.claimAgeGate, 6)
      expect(observed).not.toBeCloseTo(accepted.claimAgeGate, 6)
      expect(observed).not.toBeCloseTo(readings.statute.suspension, 6)
    })

    it('zeros only the SSDI worker when wages exceed annual SGA, leaving the spouse paid', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Disabled worker', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
        { id: 'p2', name: 'Eligible spouse', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
      ]
      plan.incomes = [
        wages(20_281),
        {
          type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
          disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
        },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
      ]
      plan.accounts = [cash(2_000_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const observed = socialSecurityIncomeIn(result, 2026)

      expect(observed).toBeCloseTo(produced.suspension, 6)
      expect(observed).not.toBeCloseTo(accepted.suspension, 6)
      expect(observed).not.toBeCloseTo(readings.statute.claimAgeGate, 6)
    })
  })

  function annualSgaWorkIncentivePlan(): Plan {
    const plan = basePlan()
    plan.incomes = [
      wages(20_281),
      {
        type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null,
        disability: { onsetAge: 58 }, claimAge: { years: 62, months: 0 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    return plan
  }

  // Authority-side paired monthly limbs (same 20,281 annual wages): a first
  // January service month and a ninth December service month are both still
  // protected trial-work months, so the whole 2,000 × 12 benefit remains payable.
  describeRule('cfr-20-404-1592-trial-work-period', {
    readings: {
      protectedTrialWorkMonthsKeepFullBenefit: {
        firstServiceMonthJanuary: 24_000,
        ninthServiceMonthDecember: 24_000,
      },
      annualSgaSuspendsWholeBenefit: {
        firstServiceMonthJanuary: 0,
        ninthServiceMonthDecember: 0,
      },
    },
    accepted: 'protectedTrialWorkMonthsKeepFullBenefit',
    produced: 'annualSgaSuspendsWholeBenefit',
  }, ({ accepted, produced }) => {
    it('cannot distinguish protected first and ninth trial-work months from annual SGA', () => {
      const observed = socialSecurityIncomeIn(
        simulatePlan(validate(annualSgaWorkIncentivePlan()), { startYear: 2026, taxCalculator: noTax }),
        2026,
      )
      const annualProjection = {
        firstServiceMonthJanuary: observed,
        ninthServiceMonthDecember: observed,
      }

      expect(annualProjection).toEqual(produced)
      expect(annualProjection).not.toEqual(accepted)
    })
  })

  // Same annual wages after trial work: January-only SGA keeps 12 months payable
  // under the grace/restart rule; every-month SGA pays only three grace months.
  describeRule('cfr-20-404-1592a-extended-period-of-eligibility', {
    readings: {
      monthlyEpeGraceAndRestart: {
        januaryOnlySga: 24_000,
        everyMonthSga: 6_000,
      },
      annualSgaSuspendsWholeBenefit: {
        januaryOnlySga: 0,
        everyMonthSga: 0,
      },
    },
    accepted: 'monthlyEpeGraceAndRestart',
    produced: 'annualSgaSuspendsWholeBenefit',
  }, ({ accepted, produced }) => {
    it('cannot distinguish January-only EPE from every-month SGA on annual wages', () => {
      const observed = socialSecurityIncomeIn(
        simulatePlan(validate(annualSgaWorkIncentivePlan()), { startYear: 2026, taxCalculator: noTax }),
        2026,
      )
      const annualProjection = {
        januaryOnlySga: observed,
        everyMonthSga: observed,
      }

      expect(annualProjection).toEqual(produced)
      expect(annualProjection).not.toEqual(accepted)
    })
  })

  it('has no accepted DWB age-50, blind-SGA, or EXR state surface', () => {
    const streamFields = Object.keys(socialSecurityIncomeSchema.shape)
    expect(socialSecurityIncomeSchema.shape.claimAge.safeParse({ years: 50, months: 0 }).success).toBe(false)
    for (const absent of [
      'disabledWidowClaim',
      'disabledWidowDetermination',
      'blind',
      'blindnessDetermination',
      'priorDisabilityTermination',
      'expeditedReinstatementRequest',
      'currentImpairmentRelation',
    ] as const) {
      expect(streamFields.includes(absent)).toBe(false)
    }
    // Records name formerSpouseSchema (no death-date/prescribed-period anchor)
    // and the pack (no sgaMonthlyBlind), not trial-work/EPE counters.
    const formerFields = Object.keys(formerSpouseSchema.shape)
    expect(formerFields.includes('deathDate')).toBe(false)
    expect(formerFields.includes('prescribedPeriodStart')).toBe(false)
    expect(formerFields.includes('prescribedPeriodEnd')).toBe(false)

    const packSs = Object.keys(year2026.socialSecurity)
    expect(packSs.includes('sgaMonthlyNonBlind')).toBe(true)
    expect(packSs.includes('sgaMonthlyBlind')).toBe(false)
  })

  // Section 402(r)(2) bites when a claimant seeks spouse-only at claim age: they
  // are deemed to file for their own old-age benefit too. At 62 the two year-one
  // annual figures discriminate that direction:
  //
  //   own PIA 2,000 × 70% retirement factor × 12 = 16,800  (deemed own filed)
  //   spouse PIA 3,000 × 50% × 65% spousal factor × 12 = 11,700
  //
  // Rejected restricted-spousal reading: pay only the spousal amount (11,700)
  // and leave own unclaimed. Deemed reading: own is also filed, so the year-one
  // benefit is 16,800 (own exceeds spouse). Both workers have claimed, so
  // worker-filing eligibility and the family maximum are not this fixture's
  // question. A max(own, spouse) path with own already above spouse would not
  // discriminate spouse-deeming under (r)(1); this fixture targets (r)(2).
  describeRule('usc-42-402-r-1-2-deemed-filing-old-age-and-spousal', {
    readings: {
      deemedOwnAlsoFiled: 16_800,
      restrictedSpouseOnlyLeavesOwnUnclaimed: 11_700,
    },
    accepted: 'deemedOwnAlsoFiled',
  }, ({ accepted, readings }) => {
    it('deems own filed so year-one benefit is the own amount, not restricted spouse-only', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Lower', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
        { id: 'p2', name: 'Higher', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
      ]
      const lowerStreamId = testIds()
      plan.incomes = [
        { type: 'socialSecurity', id: lowerStreamId, personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
      ]
      plan.accounts = [cash(2_000_000)]

      const year = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years[0]!
      const lower = year.socialSecurityStreams?.find((stream) => stream.streamId === lowerStreamId)
      if (lower === undefined) throw new Error('expected lower current-spouse Social Security stream')

      expect(lower.source).toBe('own-retirement')
      expect(lower.annualAmount).toBeCloseTo(accepted, 6)
      expect(lower.annualAmount).not.toBeCloseTo(readings.restrictedSpouseOnlyLeavesOwnUnclaimed, 6)
    })

    it('exposes exactly one claimAge and no restricted-application vocabulary on the SS stream', () => {
      // Bind the schema vocabulary itself (plan.test.ts gate pattern): a
      // restricted spouse-only application cannot be expressed because the
      // stream carries one claimAge and none of the restricted-claim fields.
      const fields = Object.keys(socialSecurityIncomeSchema.shape)
      expect(fields.filter((name) => name === 'claimAge')).toHaveLength(1)
      expect('claimAge' in socialSecurityIncomeSchema.shape).toBe(true)
      for (const absent of [
        'restrictedApplication',
        'restrictedSpouseClaim',
        'spouseOnlyClaim',
        'ownClaimAge',
        'survivorClaimAge',
      ] as const) {
        expect(absent in socialSecurityIncomeSchema.shape).toBe(false)
      }
    })
  })

  // Section 402(q)(3)(B) reduces the unreduced spouse excess separately from
  // the claimant's own RIB, and section 402(k)(3)(A) leaves reduced own plus
  // that reduced excess. Both 1964-01-02 claim-age dates are 2026-01-02; the
  // full 2027 row removes first-year proration. The 2026 worker family maximum
  // for PIA 4,000 is 6,999.30, leaving 4,199.30 above the worker's 2,800 own
  // amount, so the 780 auxiliary is not capped.
  describeRule('usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement', {
    readings: {
      reducedOwnPlusReducedExcess: 16_080,
      maxReducedOwnOrReducedHalfPia: 15_600,
      reducedOwnPlusReducedHalfPia: 22_320,
    },
    accepted: 'reducedOwnPlusReducedExcess',
  }, ({ accepted, readings }) => {
    it('adds reduced own and the separately reduced spouse excess in the full year after simultaneous early claims', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Lower', dob: '1964-01-02', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'Worker', dob: '1964-01-02', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      ]
      const lowerStreamId = testIds()
      plan.incomes = [
        { type: 'socialSecurity', id: lowerStreamId, personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 62, months: 0 } },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 62, months: 0 } },
      ]
      plan.accounts = [cash(5_000_000)]
      plan.assumptions.ssCola = { mode: 'fixed', annualPct: 0 }
      plan.assumptions.ssHaircut = null

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const fullYear = result.years.find((year) => year.year === 2027)
      if (fullYear === undefined) throw new Error('expected full 2027 projection year')
      const lower = fullYear.socialSecurityStreams?.find((stream) => stream.streamId === lowerStreamId)
      if (lower === undefined) throw new Error('expected lower current-spouse Social Security stream')

      expect(lower.preWithholdingAnnual).toBeCloseTo(accepted, 6)
      expect(lower.preWithholdingAnnual).not.toBeCloseTo(readings.maxReducedOwnOrReducedHalfPia, 6)
      expect(lower.preWithholdingAnnual).not.toBeCloseTo(readings.reducedOwnPlusReducedHalfPia, 6)
    })
  })

  // A worker who files later starts the spouse benefit later. The claimant, born
  // 1964-03-10 with an 800 PIA, claims at 62 (560 a month); her husband, born
  // 1964-08-20 with a 2,400 PIA, claims at 70 in August 2034, when she is 845
  // months old and past her full retirement age of 804 months, so the excess is
  // unreduced: 560 + (1,200 - 800) = 960 a month, 11,520 in 2034. The rejected
  // reading, the engine's until 2026-09-27, paid the larger of her own 560 and
  // half his PIA reduced at her own claim age, 1,200 x 0.65 = 780 (9,360).
  describeRule('usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement', {
    note: 'a worker who files after the claimant',
    readings: {
      ownPlusExcessReducedAtTheSpouseStart: 11_520,
      largerOfOwnAndHalfReducedAtOwnClaim: 9_360,
    },
    accepted: 'ownPlusExcessReducedAtTheSpouseStart',
  }, ({ accepted, readings }) => {
    it('reduces the excess at the claimant’s age when the worker files, and adds it to her own benefit', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Lower', dob: '1964-03-10', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'Worker', dob: '1964-08-20', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      ]
      const lowerStreamId = testIds()
      plan.incomes = [
        { type: 'socialSecurity', id: lowerStreamId, personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 62, months: 0 } },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 2_400, earnings: null, claimAge: { years: 70, months: 0 } },
      ]
      plan.accounts = [cash(5_000_000)]

      const year = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years.find((row) => row.year === 2034)!
      const lower = year.socialSecurityStreams?.find((stream) => stream.streamId === lowerStreamId)
      if (lower === undefined) throw new Error('expected lower current-spouse Social Security stream')

      expect(lower.source).toBe('spousal')
      expect(lower.preWithholdingAnnual).toBeCloseTo(accepted, 6)
      expect(lower.preWithholdingAnnual).not.toBeCloseTo(readings.largerOfOwnAndHalfReducedAtOwnClaim, 6)
    })
  })

  // A divorced spouse is paid the same composition. The single claimant, born
  // 1964-06-15 with an 800 PIA, claims at 62 (560 a month); her ex, born
  // 1966-02-10 with a 2,000 PIA and married 12 years, attains 62 on February 9,
  // 2028 and is 62 throughout March 2028 (POMS RS 00202.005 B.2.a), when she is
  // 765 months old: 39 months early, spouse factor
  // 1 - (36 x 25/36 + 3 x 5/12)/100 = 0.7375. She is paid
  // 560 + (1,000 - 800) x 0.7375 = 707.50 a month, 8,490 in 2028, where the
  // larger of her own 560 and 1,000 x 0.65 gave 650 (7,800), and a start in
  // the attainment month itself (764 months) would give 706.67 (8,480).
  describeRule('usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement', {
    note: 'a divorced spouse',
    readings: {
      ownPlusExcessReducedWhenTheExIs62Throughout: 8_490,
      startInTheMonthTheExAttains62: 8_480,
      largerOfOwnAndHalfReducedAtOwnClaim: 7_800,
    },
    accepted: 'ownPlusExcessReducedWhenTheExIs62Throughout',
  }, ({ accepted, readings }) => {
    it('pays a divorced spouse her own benefit plus the excess reduced when the ex is first 62 throughout a month', () => {
      const plan = basePlan()
      plan.household.people = [
        { id: 'p1', name: 'Single', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      ]
      plan.incomes = [{
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [{ id: 'ex', relationship: 'divorced', dob: '1966-02-10', piaMonthly: 2_000, marriageYears: 12, remarriedAtAge: null }],
      }]
      plan.accounts = [cash(5_000_000)]

      const year = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years.find((row) => row.year === 2028)!
      expect(year.incomes.socialSecurity).toBeCloseTo(accepted, 6)
      expect(year.incomes.socialSecurity).not.toBeCloseTo(readings.largerOfOwnAndHalfReducedAtOwnClaim, 6)
      expect(year.incomes.socialSecurity).not.toBeCloseTo(readings.startInTheMonthTheExAttains62, 6)
    })
  })

  it('starts at the claim-age year with the claiming factor applied', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const beforeClaim = result.years.find((y) => y.year === 2035)! // age 69
    const atClaim = result.years.find((y) => y.year === 2036)! // age 70
    expect(beforeClaim.incomes.socialSecurity).toBe(0)
    // Born 1966 -> FRA 67 -> claiming at 70 = 36 months of DRC at 2/3%/mo = 1.24.
    expect(atClaim.incomes.socialSecurity).toBeCloseTo(2000 * 12 * 1.24, 6)
  })

  it('reduces early claims and prorates the first calendar year by claim months', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 62, months: 6 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const first = result.years.find((y) => y.year === 2028)! // age 62
    const second = result.years.find((y) => y.year === 2029)!
    // 54 months early: 36×5/9% + 18×5/12% = 27.5% reduction.
    const fullYear = 2000 * 12 * 0.725
    expect(second.incomes.socialSecurity).toBeCloseTo(fullYear, 6)
    expect(first.incomes.socialSecurity).toBeCloseTo(fullYear * (6 / 12), 6)
  })

  it('pays a divorced-spousal benefit when it beats the own benefit (single, 10-yr marriage)', () => {
    const plan = basePlan() // single, born 1966, FRA 67
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          { id: 'ex1', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 3_000, marriageYears: 12, remarriedAtAge: null },
        ],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const atClaim = result.years.find((y) => y.year === 2033)! // age 67, factor 1
    // max(own 1000×12, divorced-spousal 0.5×3000×12) = 18,000.
    expect(atClaim.incomes.socialSecurity).toBeCloseTo(18_000, 6)
  })

  it('does not pay divorced-spousal under a 10-year marriage', () => {
    const plan = basePlan()
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          { id: 'ex1', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 3_000, marriageYears: 9, remarriedAtAge: null },
        ],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2033)!.incomes.socialSecurity).toBeCloseTo(12_000, 6)
  })

  it('withholds surviving-divorced survivor benefit under ten years but pays it at ten years', () => {
    // Oracle: 404.336(a)(2) ten-year duration; claimant FRA 67 unreduced survivor
    // equals deceased PIA 2,400/mo when the deceased is treated as claimed at FRA.
    const makePlan = (marriageYears: number): Plan => {
      const plan = basePlan()
      plan.incomes = [
        {
          type: 'socialSecurity',
          id: testIds(),
          personId: 'p1',
          piaMonthly: 1_000,
          earnings: null,
          claimAge: { years: 67, months: 0 },
          formerSpouses: [
            {
              id: 'ex',
              relationship: 'surviving-divorced',
              dob: '1950-06-15',
              piaMonthly: 2_400,
              marriageYears,
              remarriedAtAge: null,
            },
          ],
        },
      ]
      plan.accounts = [cash(2_000_000)]
      return plan
    }

    const shortMarriage = simulatePlan(validate(makePlan(0.75)), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(shortMarriage).toBeCloseTo(12_000, 6)

    const tenYears = simulatePlan(validate(makePlan(10)), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(tenYears).toBeCloseTo(28_800, 6)
  })

  it('keeps the legacy deceased relationship on the ordinary-widow nine-month duration', () => {
    const plan = basePlan()
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          {
            id: 'ex',
            relationship: 'deceased',
            dob: '1950-06-15',
            piaMonthly: 2_400,
            marriageYears: 0.75,
            remarriedAtAge: null,
          },
        ],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const survivorIncome = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(survivorIncome).toBeCloseTo(28_800, 6)
  })

  it('pays survivor on a deceased former spouse but forfeits it after remarriage before 60', () => {
    const deceased = (remarriedAtAge: number | null): IncomeStream => ({
      type: 'socialSecurity',
      id: 'ss-surv',
      personId: 'p1',
      piaMonthly: 1_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
      formerSpouses: [{ id: 'late', relationship: 'deceased', dob: '1955-01-01', piaMonthly: 2_400, marriageYears: 20, remarriedAtAge }],
    })

    const preserved = basePlan()
    preserved.incomes = [deceased(null)]
    preserved.accounts = [cash(2_000_000)]
    const survivorIncome = simulatePlan(validate(preserved), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(survivorIncome).toBeCloseTo(28_800, 6) // 2400×12, beats own 12,000

    const forfeited = basePlan()
    forfeited.incomes = [deceased(55)]
    forfeited.accounts = [cash(2_000_000)]
    const ownOnly = simulatePlan(validate(forfeited), { startYear: 2026, taxCalculator: noTax }).years.find(
      (y) => y.year === 2033,
    )!.incomes.socialSecurity
    expect(ownOnly).toBeCloseTo(12_000, 6)
  })

  // 42 U.S.C. 403(f)(3): 50% above the lower exempt amount before FRA, 33 1/3%
  // above the higher exempt amount in the FRA-attainment year. Below FRA:
  //   (40,000 - 24,480) / 2 = 7,760
  // FRA year with wages above the higher exempt amount:
  //   (70,000 - 65,160) / 3 = 1,613.3333333333333
  // Flat /2 on the FRA-year excess would be 2,420; omitting the FRA-year rate is 0.
  describeRule('usc-42-403-f-3-retirement-earnings-test', {
    readings: {
      statutoryRates: { belowFra: 7_760, fraYear: 1_613.3333333333333 },
      fraYearTreatmentAppliedEarly: { belowFra: 0, fraYear: 1_613.3333333333333 },
      flatHalfRate: { belowFra: 7_760, fraYear: 2_420 },
      noFraYearWithholding: { belowFra: 7_760, fraYear: 0 },
    },
    accepted: 'statutoryRates',
  }, ({ accepted, readings }) => {
    it('withholds half the below-FRA excess and one-third of the FRA-year excess', () => {
      const belowFraPlan = basePlan()
      belowFraPlan.household.people[0]! = {
        ...belowFraPlan.household.people[0]!,
        dob: '1964-06-15', // 62 in 2026, FRA 67
        retirementAge: 68,
      }
      belowFraPlan.incomes = [
        wages(40_000),
        { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
      ]
      belowFraPlan.accounts = [cash(2_000_000)]

      const belowFraResult = simulatePlan(validate(belowFraPlan), { startYear: 2026, taxCalculator: noTax })
      const belowFraYear = belowFraResult.years.find((y) => y.year === 2026)!

      const fraYearPlan = basePlan()
      fraYearPlan.household.people[0]! = {
        ...fraYearPlan.household.people[0]!,
        dob: '1960-06-15', // 67 in 2027, FRA 67
        retirementAge: 68,
      }
      fraYearPlan.incomes = [
        wages(70_000),
        { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
      ]
      fraYearPlan.accounts = [cash(2_000_000)]

      const fraYearResult = simulatePlan(validate(fraYearPlan), { startYear: 2027, taxCalculator: noTax })
      const fraYearObserved = fraYearResult.years.find((y) => y.year === 2027)!

      const observed = {
        belowFra: belowFraYear.ssEarningsTestWithheld,
        fraYear: fraYearObserved.ssEarningsTestWithheld,
      }

      expect(observed.belowFra).toBeCloseTo(accepted.belowFra, 6)
      expect(observed.fraYear).toBeCloseTo(accepted.fraYear, 6)
      expect(observed).not.toEqual(readings.fraYearTreatmentAppliedEarly)
      expect(observed.fraYear).not.toBeCloseTo(readings.flatHalfRate.fraYear, 6)
      expect(observed.fraYear).not.toBeCloseTo(readings.noFraYearWithholding.fraYear, 6)
    })
  })

  it('withholds benefits under the earnings test while working before FRA', () => {
    const plan = basePlan()
    plan.household.people[0]! = {
      ...plan.household.people[0]!,
      dob: '1964-06-15', // 62 in 2026, FRA 67
      retirementAge: 68,
    }
    plan.incomes = [
      wages(60_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Claim at 62 -> 70% of PIA = 16,800/yr. Below FRA: withhold (60k−24,480)/2
    // = 17,760, which exceeds the benefit -> fully withheld.
    const age62 = result.years.find((y) => y.year === 2026)!
    expect(age62.incomes.socialSecurity).toBe(0)
    expect(age62.ssEarningsTestWithheld).toBeCloseTo(16_800, 6)

    const age66 = result.years.find((y) => y.year === 2030)!
    expect(age66.incomes.socialSecurity).toBe(0)

    // FRA year (67): exempt amount 65,160 > wages -> no withholding. All 60
    // months (62-66) were fully withheld, so the benefit is recomputed as if
    // claimed at FRA -> full PIA = 24,000.
    const age67 = result.years.find((y) => y.year === 2031)!
    expect(age67.incomes.socialSecurity).toBeCloseTo(24_000, 6)
    expect(age67.ssEarningsTestWithheld).toBe(0)

    expect(result.warnings.join(' ')).toContain('earnings test')
  })

  it('credits withheld earnings-test months back at full retirement age', () => {
    // Born 1964 (62 in 2026, FRA 67), claims at 62, high wages fully withhold the
    // benefit through 66 (60 months), then stops working at FRA.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 67 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 62-66: fully withheld.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBe(0)
    expect(result.years.find((y) => y.year === 2030)!.incomes.socialSecurity).toBe(0)
    // 67+: 60 withheld months credit the claim from 62 up to FRA -> full PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(24_000, 6)
    expect(result.years.find((y) => y.year === 2032)!.incomes.socialSecurity).toBeCloseTo(24_000, 6)
  })

  it('applies the earnings test to a marital-history benefit (not just own)', () => {
    // Single divorced person, 62, big wages: the divorced-spousal benefit beats
    // own but must also be withheld by the earnings test.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: 67 }
    plan.incomes = [
      wages(200_000),
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [{ id: 'ex', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 4_000, marriageYears: 15, remarriedAtAge: null }],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    // Divorced-spousal (~$15.6k) lifts the benefit, but high wages fully withhold it.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBe(0)
  })

  it('credits a mid-year first claim only for its payable months', () => {
    // Claim 62y6m, work (and be fully withheld) only the partial first year,
    // retiring at 63. Just 6 payable months are withheld, so the FRA credit moves
    // the claim from 62y6m to 63y0m (0.75 PIA), not 63y6m.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: 63 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 6 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    // 67+: credited claim 62y6m + 6mo = 63y0m -> 48 months early -> 0.75 × PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(18_000, 6)
  })

  it('credits only the months actually withheld (partial)', () => {
    // Works (and is withheld) only at 62-63, retiring at 64 -> 24 months credited,
    // so the FRA-recomputed claim age is 64, not 67.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 64 }
    plan.incomes = [
      wages(200_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 64-66 (before FRA, no wages): the original reduced 62 benefit, 0.70 × PIA.
    expect(result.years.find((y) => y.year === 2028)!.incomes.socialSecurity).toBeCloseTo(16_800, 6)
    // 67+: claim credited 62 -> 64 (24 months), 36 months early -> 0.80 × PIA.
    expect(result.years.find((y) => y.year === 2031)!.incomes.socialSecurity).toBeCloseTo(19_200, 6)
  })

  function partialDeductionArfIncomeAfterFra(): number {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 67 }
    plan.incomes = [
      // 28,480 - 24,480 = 4,000; the annual test withholds 2,000 dollars in
      // each below-FRA year the wages run (2026 through 2030).
      wages(28_480),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    // 2032 is the first full calendar year after the June-2031 FRA, so the
    // observable carries the ARF-adjusted rate without FRA-year proration.
    return socialSecurityIncomeIn(result, 2032)
  }

  // Each of the five below-FRA working years (2026-2030) carries a
  // 2,000-dollar annual deduction, charged 1,400 dollars to the first payable
  // month and 600 to the second. POMS credits both the full and the partial
  // work-deduction month — ten crediting months in all: the 60 reduction
  // months from a 62y0m claim shrink to 50, the reduction is
  // 36 x 5/9% + 14 x 5/12% = 25.8333%, and a post-FRA year pays
  // 24,000 x 0.7416667 = 17,800. The engine's annual ratio proxy instead
  // rounds (2,000 / benefit) x payable months to one crediting month per year.
  describeRule('poms-rs-00615-482-arf-crediting-months', {
    readings: {
      pomsCreditsFullAndPartialWorkDeductionMonths: 17_800,
      annualRatioRoundsToOneCreditingMonthPerYear: 17_300,
    },
    accepted: 'pomsCreditsFullAndPartialWorkDeductionMonths',
    produced: 'annualRatioRoundsToOneCreditingMonthPerYear',
  }, ({ accepted, produced }) => {
    it('rounds annual withholding to one ARF crediting month per year', () => {
      const postFraIncome = partialDeductionArfIncomeAfterFra()
      expect(postFraIncome).toBeCloseTo(produced, 6)
      expect(postFraIncome).not.toBeCloseTo(accepted, 6)
    })
  })

  // This independently pins the statute's charging order that supplies the
  // full/partial deduction months used by the preceding ARF fixture.
  describeRule('usc-42-403-f-1-earnings-test-month-charging', {
    readings: {
      firstThenSucceedingMonthCharging: 17_800,
      annualFractionRoundedToOneMonthPerYear: 17_300,
    },
    accepted: 'firstThenSucceedingMonthCharging',
    produced: 'annualFractionRoundedToOneMonthPerYear',
    note: 'shares the ARF observable',
  }, ({ accepted, produced }) => {
    it('collapses the charging sequence into the annual ratio', () => {
      const postFraIncome = partialDeductionArfIncomeAfterFra()
      expect(postFraIncome).toBeCloseTo(produced, 6)
      expect(postFraIncome).not.toBeCloseTo(accepted, 6)
    })
  })

  // One engine input: the Plan carries no service-month fact, so a single
  // annual wage projection stands against both authority limbs below. That
  // collapse is the approximation — not a birthday-relative stop encoded by
  // a fractional retirementAge.
  function graceYearAnnualIncome(): number {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-06-15', retirementAge: 67 }
    plan.incomes = [
      wages(60_000),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    })
    return socialSecurityIncomeIn(result, 2026)
  }

  // Authority-side paired monthly limbs (same 60,000 annual wages; the Plan
  // cannot say how they were distributed within 2026):
  //
  // - sixNonServiceMonthsAfterJune: 60,000 was earned January-June and the
  //   claimant neither worked nor rendered substantial service July-December;
  //   six × (2,000 × 70%) = 8,400 of monthly-test benefits are payable.
  // - serviceInAllTwelveMonths: the same annual wages are earned while service
  //   continues through December, so there is no non-service-month payment.
  //
  // produced applies the single observed annual figure to both limbs because
  // the annual test withholds the whole year: (60,000 - 24,480) / 2 exceeds
  // the year-one benefit.
  describeRule('cfr-20-404-435-grace-year-monthly-earnings-test', {
    readings: {
      monthlyTestDistinguishesServiceMonths: {
        sixNonServiceMonthsAfterJune: 8_400,
        serviceInAllTwelveMonths: 0,
      },
      annualProjectionIgnoresServiceMonthDistribution: {
        sixNonServiceMonthsAfterJune: 0,
        serviceInAllTwelveMonths: 0,
      },
    },
    accepted: 'monthlyTestDistinguishesServiceMonths',
    produced: 'annualProjectionIgnoresServiceMonthDistribution',
  }, ({ accepted, produced }) => {
    it('cannot preserve a grace-year non-service-month benefit from annual wages alone', () => {
      const observed = graceYearAnnualIncome()
      const annualProjection = {
        sixNonServiceMonthsAfterJune: observed,
        serviceInAllTwelveMonths: observed,
      }

      expect(annualProjection).toEqual(produced)
      expect(annualProjection).not.toEqual(accepted)
    })
  })

  it('does not accept a Social Security application withdrawal, repayment, or replacement claim', () => {
    // The SS stream itself has a single scalar claimAge rather than the facts
    // that section 404.640 joins together.
    const fields = Object.keys(socialSecurityIncomeSchema.shape)
    expect(fields.filter((name) => name === 'claimAge')).toHaveLength(1)
    for (const absent of [
      'firstEntitlementMonth',
      'withdrawalRequestMonth',
      'withdrawalApproval',
      'repaymentAmount',
      'priorWithdrawal',
      'replacementClaimAge',
    ] as const) {
      expect(absent in socialSecurityIncomeSchema.shape).toBe(false)
    }

    // model/plan.ts also rejects an attempt to place the missing transition in
    // retirementActions: there is no Social Security withdrawal action kind.
    const plan = basePlan()
    plan.strategies.retirementActions = [{
      actionId: testIds(),
      kind: 'socialSecurityApplicationWithdrawal',
      personId: 'p1',
      requestYear: 2026,
      repaymentAmount: 1,
    }] as never
    const parsed = parsePlan(plan)
    if (parsed.ok) throw new Error('expected an unsupported Social Security withdrawal action to be rejected')
    expect(parsed.ok).toBe(false)
    expect(
      parsed.issues.some(
        (issue) =>
          issue.includes('retirementActions')
          || issue.includes('socialSecurityApplicationWithdrawal'),
      ),
    ).toBe(true)
  })

  // Ten AWI-level covered years (2013-2022): each indexes to floor(AWI_2022) =
  // 63,795, giving ≥40 quarters (fully insured) with hand-derivable AIME.
  function insuredAwiEarningsBeforeClaim(): { year: number; amount: number }[] {
    return Array.from({ length: 10 }, (_, index) => {
      const year = 2013 + index
      const amount = AWI_BY_YEAR[year]
      if (amount === undefined) throw new Error(`expected published AWI for ${year}`)
      return { year, amount }
    })
  }

  function postFraRecomputationIncome(): number {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1962-06-15', retirementAge: 70 }
    plan.incomes = [
      // This 2030 wage is covered post-FRA work after the 2029 claim, not
      // an earnings-history input. The annual projection should recompute it
      // for January 2031, but the engine resolves PIA before this pass starts.
      wages(10_000),
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: null,
        earnings: insuredAwiEarningsBeforeClaim(),
        claimAge: { years: 67, months: 0 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2030,
      horizonEndYear: 2031,
      taxCalculator: noTax,
    })
    return socialSecurityIncomeIn(result, 2031)
  }

  // Worker born 1962-06-15 (eligibility 2024, indexing year 2022, FRA claim
  // 2029). Ten AWI-level years 2013-2022 end before the claim and supply ≥40
  // quarters. Each indexes to 63,795; after the five-year dropout the top-35
  // sum is 637,950 and AIME is floor(637,950 / 420) = 1,518. 2024 bend points
  // are 1,174 / 7,078, so second-band PIA is floorToDime(0.9×1,174 +
  // 0.32×(1,518−1,174)) = 1,166.60 and the FRA baseline year pays 13,999.20.
  // The 10,000-dollar 2030 entitlement-year wage replaces a zero in the
  // top-35 (post-age-60 years are not indexed): sum 647,950, AIME 1,542,
  // PIA floorToDime(0.9×1,174 + 0.32×(1,542−1,174)) = 1,174.30 (delta 7.70
  // ≥ $1). Both PIAs are raised by the published 2024 and 2025 cost-of-living
  // increases, 2.5% and 2.8% floored to the dime each time (415(i)(2)(A)), and
  // by the plan's zero inflation for the unannounced 2026-2029 increases:
  // 1,166.60 → 1,195.70 → 1,229.10 and 1,174.30 → 1,203.60 → 1,237.30. January
  // 2031 therefore pays 1,237.30×12 = 14,847.60. The engine resolves PIA once
  // pre-loop and ignores the post-claim wage, so it observably pays
  // 1,229.10×12 = 14,749.20.
  describeRule('usc-42-415-f-2-post-entitlement-pia-recomputation', {
    readings: {
      mandatoryHigherPiaFromPostFraEntitlementYearWages: 14_847.6,
      piaResolvedOnceBeforeProjection: 14_749.2,
    },
    accepted: 'mandatoryHigherPiaFromPostFraEntitlementYearWages',
    produced: 'piaResolvedOnceBeforeProjection',
  }, ({ accepted, produced }) => {
    it('does not recompute a higher PIA from post-FRA covered wages', () => {
      const recomputedYearIncome = postFraRecomputationIncome()
      expect(recomputedYearIncome).toBeCloseTo(produced, 6)
      expect(recomputedYearIncome).not.toBeCloseTo(accepted, 6)
    })
  })

  // In the survivor year p1's own benefit is 12,000 and the deceased worker's
  // survivor amount is 36,000. Section 402(k)(3)(A)'s offset leaves 36,000;
  // the rejected reading pays the two full amounts, 48,000. A second limb swaps
  // the PIAs so own is 36,000 and the deceased's survivor amount is 12,000: the
  // offset leaves own 36,000, not the sum 48,000 and not the smaller survivor
  // amount alone.
  describeRule('usc-42-402-k-3-a-survivor-own-dual-entitlement-offset', {
    readings: {
      statutoryHigherBenefitOnly: 36_000,
      bothOwnAndSurvivorPaid: 48_000,
      smallerSurvivorAlone: 12_000,
    },
    accepted: 'statutoryHigherBenefitOnly',
  }, ({ accepted, readings }) => {
    it('steps the survivor up to the deceased spouse’s larger benefit without adding both', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 75, source: 'manual' } },
      ]
      plan.incomes = [
        { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
      ]
      plan.accounts = [cash(5_000_000)]
      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

      // Both claimed at FRA (factor 1), COLA 0. Low earner's own is 12,000 but the
      // spousal top-up lifts it to 50% of the high PIA = 18,000; high earner 36,000.
      const bothAlive = result.years.find((y) => y.year === 2035)
      if (bothAlive === undefined) throw new Error('expected deceased worker’s last alive year')
      expect(bothAlive.incomes.socialSecurity).toBeCloseTo(54_000, 6)

      // p2 dies after 2035: p1 steps up to p2's 36,000 (survivor supersedes spousal).
      const survivorYear = result.years.find((y) => y.year === 2036)
      if (survivorYear === undefined) throw new Error('expected survivor year after p2’s death')
      expect(survivorYear.incomes.socialSecurity).toBeCloseTo(accepted, 6)
      expect(survivorYear.incomes.socialSecurity).not.toBeCloseTo(readings.bothOwnAndSurvivorPaid, 6)
    })

    it('keeps the survivor’s own larger benefit when the deceased’s amount is smaller', () => {
      // Own PIA 3,000 → 36,000/yr; deceased PIA 1,000 → 12,000/yr survivor amount.
      // Section 402(k)(3)(A) leaves 36,000; rejected readings pay 48,000 (sum) or
      // 12,000 (survivor alone).
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 75, source: 'manual' } },
      ]
      plan.incomes = [
        { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
        { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      ]
      plan.accounts = [cash(5_000_000)]
      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

      const survivorYear = result.years.find((y) => y.year === 2036)
      if (survivorYear === undefined) throw new Error('expected survivor year after p2’s death')
      expect(survivorYear.incomes.socialSecurity).toBeCloseTo(accepted, 6)
      expect(survivorYear.incomes.socialSecurity).not.toBeCloseTo(readings.bothOwnAndSurvivorPaid, 6)
      expect(survivorYear.incomes.socialSecurity).not.toBeCloseTo(readings.smallerSurvivorAlone, 6)
    })
  })

  it('floors the survivor step-up at 82.5% of PIA (RIB-LIM) when the deceased claimed early', () => {
    // Both born 1960 (survivor FRA 66y8m). p2 PIA 3,000 claimed at 62 (70% = 25,200/yr)
    // and dies at 67. p1 PIA 1,000 claims at 67 (FRA ⇒ no widow reduction). After p2
    // dies, p1 steps up to max(p2 actual, 82.5% × PIA) = 29,700 (the RIB-LIM floor
    // lifts the survivor above p2's reduced 25,200, but below 100% of PIA).
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // 2027: p2 (age 67) is dead; p1 (age 67) steps up to the RIB-LIM floor.
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(0.825 * 3_000 * 12, 6)
    expect(y2027.incomes.socialSecurity).toBeGreaterThan(3_000 * 0.70 * 12) // above p2's reduced benefit
    expect(y2027.incomes.socialSecurity).toBeLessThan(3_000 * 12) // below 100% of PIA
  })

  it('reduces the survivor step-up for an early-claim widow before survivor FRA, at her age when it is first paid', () => {
    // p1 born 1964-06-15 (survivor FRA 67 = 804 months), PIA 1,000, claims at 62.
    // p2 born 1960-06-15, PIA 3,000, claimed at 62, dies at 66 (December 2026,
    // the ledger's month of death). The widow benefit is first paid in January
    // 2027, when p1 is 751 months old (402(q)(6)(A)(iii)), not at her own claim
    // (744 months): factor = 1 - 0.285 × (804 - 751)/84 = 0.820179. The PIA
    // reduced for age, 3,000 × 0.820179 = 2,460.54, is below the RIB-LIM limit
    // max(2,100, 2,475) = 2,475, so it is paid (402(e)(2)(D) applies the limit
    // after the age reduction); payable = 2,460.54 × 12.
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2027 = result.years.find((y) => y.year === 2027)!
    const expectedSurvivor = 3_000 * (1 - (0.285 * (804 - 751)) / 84) * 12
    expect(y2027.incomes.socialSecurity).toBeCloseTo(expectedSurvivor, 4)
    expect(y2027.incomes.socialSecurity).toBeLessThan(0.825 * 3_000 * 12) // reduced below the FRA-claim amount
  })

  it('survivor step-up: deceased claimed at FRA ⇒ 100% of PIA at the survivor FRA', () => {
    // Feature-off-style default: deceased (p2) claimed at FRA and p1 is past survivor
    // FRA ⇒ no RIB-LIM floor binds and no widow reduction ⇒ p1 gets 100% of p2's PIA
    // (matches the pre-precision behaviour for the common at-FRA case).
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(3_000 * 12, 6)
  })

  it('SSDI pays the full PIA (no early reduction) before 62 and converts at FRA', () => {
    // Born 1960 (FRA 67); PIA 2,000; disability onset at 55 (well before 62). No
    // wages ⇒ no SGA suspension. SSDI = full PIA from onset, continuous through FRA.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 67 }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 66 (2026, SSDI window) and age 67 (2027, FRA conversion): full PIA.
    // FRA is attained in June 2027, so January to May are disability months
    // and June on is the converted old-age benefit (the same PIA).
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!
    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(y2026.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2026.ssdiPaid).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBeCloseTo(2_000 * 5, 6)
    expect(y2028.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2028.ssdiPaid).toBe(0)
  })

  it('SSDI is suspended when wages exceed Substantial Gainful Activity (SGA)', () => {
    // Same worker, now earning $60k (above the 2026 SGA × 12 = $19,440) through
    // 2027, the year she attains FRA (June), and retiring at 68. The annual SGA
    // test applies only to a year wholly in the disability window
    // (disability.ts#inSsdiWindow): 2027 holds the FRA month, from which the
    // benefit is the converted old-age benefit that SGA does not reach, and an
    // annual plan cannot place the year's wages in the five disability months,
    // so that year is paid in full though the wages continue.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 68 }
    plan.incomes = [
      wages(60_000),
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 66 (working, in window): SGA suspends SSDI. Age 67 (the FRA year,
    // still working): not suspended, five disability months and seven of the
    // converted benefit, as in the year without wages above.
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2026.incomes.socialSecurity).toBe(0)
    expect(y2026.ssdiPaid).toBe(0)
    expect(y2027.incomes.wages).toBeCloseTo(60_000, 6)
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBeCloseTo(2_000 * 5, 6)
    expect(result.warnings.join(' ')).toContain('SGA')
  })

  it('SSDI is off by default: a normal plan pays no SSDI anywhere (feature-off regression)', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.every((y) => y.ssdiPaid === 0)).toBe(true)
  })

  it('SSDI onset at/after FRA is ignored — falls through to normal retirement', () => {
    // Born 1960 (FRA 67); PIA 2,000; claimAge 67; disability onsetAge 70 (>= FRA).
    // SSDI can't start post-FRA, so the normal retirement path should apply: at 67
    // the person claims retirement (full PIA at FRA), NOT zero from 67–69.
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: 67 }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 70 },
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Age 67 (2027): the person claimed retirement at FRA → full PIA (not SSDI, not 0).
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.socialSecurity).toBeCloseTo(2_000 * 12, 6)
    expect(y2027.ssdiPaid).toBe(0)
    // The fall-through is said, not silent.
    expect(result.warnings).toContain(ssdiNotPayableBeforeFraWarning('Pat'))
  })

  it('tops the lower earner up to the spousal benefit while both are alive', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      // Low earner's own (800/mo) is below half the high PIA (4000/mo); both claim at FRA 67.
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Both at FRA (factor 1), COLA 0. Low own = 9,600; spousal = 50% × 48,000 = 24,000.
    // High = 48,000. Household = 24,000 + 48,000.
    const y2030 = result.years.find((y) => y.year === 2030)! // both 68
    expect(y2030.incomes.socialSecurity).toBeCloseTo(72_000, 6)
  })

  it('pays the spouse up to the family maximum less the worker\'s PIA, not less his benefit with delayed credits (20 CFR 404.404)', () => {
    // The slice 4 review's case (F3). The worker, born 1964-01-15, has a PIA
    // of 1,000 and claims at 70 in 2034: 1,000 x 1.24 = 1,240 a month. His
    // family maximum (eligibility year 2026) is 1.50 x 1,000 = 1,500. The
    // spouse, born 1964-06-15 with a PIA of 100, claims at her FRA of 67 in
    // 2031; once he files she is also paid the excess of half his PIA over
    // hers, 500 - 100 = 400, unreduced (she is past FRA by then). The room is
    // 1,500 - 1,000 = 500, so the 400 is paid in full: 100 + 400 = 500 a month.
    // 2035 (both paid all year): 12 x (1,240 + 500) = 20,880. Counting his
    // 1,240 instead leaves 260: 12 x (1,240 + 100 + 260) = 19,200.
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Worker', dob: '1964-01-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'Spouse', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 70, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 100, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2035 = result.years.find((y) => y.year === 2035)!
    expect(y2035.incomes.socialSecurity).toBeCloseTo(12 * (1_240 + 100 + 400), 6)
    expect(y2035.incomes.socialSecurity).not.toBeCloseTo(12 * (1_240 + 100 + 260), 0)
  })

  it('leaves the same room above the PIA when the worker claims early (20 CFR 404.404)', () => {
    // A real early claim. The worker, born 1964-01-15, has a PIA of 1,000.10
    // and claims at 62 in 2026: 70 percent, 700.07 a month. His family maximum
    // (eligibility 2026) is 1.50 x 1,000.10 = 1,500.15, floored to the dime,
    // 1,500.10, so the room above his PIA is 500.00. The spouse, born the same
    // day with no own PIA, claims at her FRA of 67 in 2031: her original
    // benefit, half his PIA, 500.05, is held to the 500.00 of room, unreduced.
    // 2032: 12 x (700.07 + 500.00) = 14,400.84. Counting his reduced 700.07
    // instead would leave 800.03 of room and pay her the whole 500.05:
    // 12 x (700.07 + 500.05) = 14,401.44.
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Worker', dob: '1964-01-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'Spouse', dob: '1964-01-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000.1, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2032 = result.years.find((y) => y.year === 2032)!
    expect(y2032.incomes.socialSecurity).toBeCloseTo(12 * (0.7 * 1_000.1 + 500), 6)
    expect(y2032.incomes.socialSecurity).not.toBeCloseTo(12 * (0.7 * 1_000.1 + 0.5 * 1_000.1), 2)
  })

  it('does not pay spousal before the higher earner has claimed', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Low earner claimed (67), high earner has not (claims 70). No spousal yet:
    // only the low earner's own 9,600.
    const y2030 = result.years.find((y) => y.year === 2030)! // both 68
    expect(y2030.incomes.socialSecurity).toBeCloseTo(9_600, 6)
  })

  it('prorates former-spouse marital benefits by the claim month in the first year', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1964-07-01', retirementAge: null }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 800,
        earnings: null,
        claimAge: { years: 62, months: 6 },
        formerSpouses: [{ id: 'ex', relationship: 'divorced', dob: '1958-01-01', piaMonthly: 4_000, marriageYears: 15, remarriedAtAge: null }],
      },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // Born 1964 -> FRA 67. At 62y6m (54 months early) her own 800 is paid at 72.5%
    // (580) and the excess of half the ex PIA over it, 2,000 - 800, at the spouse
    // factor 67.5% (810): 1,390 a month (402(q)(3)(B), (k)(3)(A)). Only the six
    // payable months after the claim month are paid in 2026.
    expect(result.years.find((y) => y.year === 2026)!.incomes.socialSecurity).toBeCloseTo((800 * 0.725 + (2_000 - 800) * 0.675) * 6, 6)
  })

  it('withholds current-spouse spousal benefits before FRA and credits them at FRA', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1964-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      wages(200_000, 'p1'),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const highAnnual = 4_000 * 12 * claimFactor(1959, 6, 15, { years: 62, months: 0 })

    // Low earner's spousal benefit beats their own benefit at 62, but their wages
    // fully withhold it. The household still receives the high earner's benefit.
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.socialSecurity).toBeCloseTo(highAnnual, 6)
    expect(y2026.ssEarningsTestWithheld).toBeGreaterThan(15_000)

    // At FRA, all 60 withheld months credit the low earner's spousal factor to 1.0.
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.incomes.socialSecurity).toBeCloseTo(highAnnual + 0.5 * 4_000 * 12, 6)
  })

  it('leaves a spouse uncapped by the family maximum when the worker delays: the room is above his PIA, not his benefit (20 CFR 404.404)', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1960-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 100, earnings: null, claimAge: { years: 70, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 1_000, earnings: null, claimAge: { years: 70, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    // PIA 1,000 is below the first 2022 family-max bend point, so MFB = 150% PIA
    // = 1,500. The worker delayed to 124% PIA (1,240), but the room the spouse
    // shares is the maximum less his PIA, 500 (20 CFR 404.404), which holds her
    // whole excess of 500 - 100 = 400. Her own 124/mo (100 PIA x 1.24 at 70) and
    // the combination: the larger of her own benefit and her own PIA plus the
    // excess, 100 + 400 = 500 (the DRCs sit inside the 500, POMS RS 00615.694),
    // so the household is 1,240 + 500 a month. Counting his 1,240 left only 260
    // of room and paid her 124 + 260 = 384.
    const y2030 = result.years.find((y) => y.year === 2030)!
    expect(y2030.incomes.socialSecurity).toBeCloseTo((1_240 + 500) * 12, 6)
    expect(y2030.incomes.socialSecurity).not.toBeCloseTo((1_240 + 124 + 260) * 12, 0)
  })

  it('prorates current-spouse spousal benefits by both claim months', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Low', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'High', dob: '1962-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
    ]
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 6 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 4_000, earnings: null, claimAge: { years: 67, months: 6 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const highHalfYear = 4_000 * claimFactor(1962, 6, 15, { years: 67, months: 6 }) * 6
    const lowSpousalHalfYear = 0.5 * 4_000 * 6
    expect(result.years.find((y) => y.year === 2029)!.incomes.socialSecurity).toBeCloseTo(
      highHalfYear + lowSpousalHalfYear,
      6,
    )
  })

  it('withholds current-spouse survivor benefits before FRA and credits them at survivor FRA', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      { id: 'p1', name: 'Survivor', dob: '1964-06-15', sex: 'average', retirementAge: 67, longevity: { planningAge: 95, source: 'manual' } },
      { id: 'p2', name: 'Deceased', dob: '1959-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 66, source: 'manual' } },
    ]
    plan.incomes = [
      wages(200_000, 'p1'),
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 1_000, earnings: null, claimAge: { years: 62, months: 0 } },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.socialSecurity).toBe(0)
    expect(y2026.ssEarningsTestWithheld).toBeGreaterThan(20_000)

    // The deceased claimed early, so RIB-LIM floors the survivor base at 82.5%
    // of PIA. Withheld months credit the survivor reduction away by FRA.
    const y2031 = result.years.find((y) => y.year === 2031)!
    expect(y2031.incomes.socialSecurity).toBeCloseTo(0.825 * 3_000 * 12, 6)
  })

  it('applies the trust-fund haircut from its start year', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    plan.assumptions.ssHaircut = { fromYear: 2034, cutPct: 19 }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2033 = result.years.find((y) => y.year === 2033)!
    const y2034 = result.years.find((y) => y.year === 2034)!
    expect(y2034.incomes.socialSecurity).toBeCloseTo(y2033.incomes.socialSecurity * 0.81, 6)
  })

  it('warns and skips when neither PIA nor earnings are provided', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: null, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.every((y) => y.incomes.socialSecurity === 0)).toBe(true)
    expect(result.warnings.join(' ')).toContain('no PIA')
  })

  it('derives PIA from an earnings history (AIME → bend points)', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1962-06-15' // eligibility 2024: published tables
    const earnings = []
    for (let y = 1984; y <= 2023; y++) earnings.push({ year: y, amount: 60_000 })
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const expected = computePiaFromEarnings({
      dobYear: 1962,
      dobMonth: 6,
      dobDay: 15,
      earnings,
      lastEarningsYear: 2023,
    })
    if (isPiaFromEarningsError(expected)) throw new Error(expected.code)
    expect(expected.piaMonthly).toBeGreaterThan(1_000)

    // The eligibility-year (2024) PIA is raised by the 2024 and 2025
    // cost-of-living increases, 2.5% and 2.8%, each floored to the dime
    // (42 U.S.C. 415(i)(2)(A)), to reach the 2026 start year's dollars.
    const floorToDime = (value: number): number => Math.floor(value * 10 + 1e-9) / 10
    const piaAtStart = floorToDime(floorToDime(expected.piaMonthly * 1.025) * 1.028)
    expect(piaAtStart).toBeGreaterThan(expected.piaMonthly)
    const claimYear = result.years.find((y) => y.year === 2029)! // age 67 = FRA: factor 1
    expect(claimYear.incomes.socialSecurity).toBeCloseTo(piaAtStart * 12, 6)
  })
})
