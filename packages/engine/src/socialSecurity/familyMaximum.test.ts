import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  capAuxiliaryForFamilyMaximum,
  currentSpouseMonthlyUnderFamilyMaximum,
  disabilityFamilyMaximumAtStart,
  disabilityFamilyMaximumMonthly,
  familyMaximumEligibilityYear,
  familyMaximumEligibilityYearFromDobParts,
  familyMaximumMonthlyFromPia,
  workerFamilyMaximumMonthlyAt,
} from './familyMaximum.js'
import type { PiaFromEarningsResult } from './piaFromEarnings.js'

describe('family maximum bend point formula', () => {
  // 42 U.S.C. 403(a)(2) applies each rate only to the part of the PIA inside
  // its own band. The common shorthand -- that the family maximum is roughly
  // 150 to 188 percent of the PIA -- invites applying a single percentage to
  // the whole, which understates every record above the first bend point.
  //
  // 2025 family-maximum bend points 1,567 / 2,262 / 2,950, PIA 3,500:
  //   1.50 x 1,567             = 2,350.50
  //   2.72 x (2,262 - 1,567)   = 1,890.40
  //   1.34 x (2,950 - 2,262)   =   921.92
  //   1.75 x (3,500 - 2,950)   =   962.50
  //   total 6,125.32, decreased to the next lower dime = 6,125.30
  // A flat 150 percent on the whole PIA would give 5,250.
  describeRule('usc-42-403-a-2-family-maximum-formula', {
    readings: { marginalAcrossBendPoints: 6_125.3, flatOneHundredFiftyPercent: 5_250 },
    accepted: 'marginalAcrossBendPoints',
  }, ({ accepted, readings }) => {
    it('applies each rate only to the PIA inside its own band', () => {
      expect(familyMaximumMonthlyFromPia(3_500, 2025)).toBeCloseTo(accepted, 6)
      expect(familyMaximumMonthlyFromPia(3_500, 2025))
        .not.toBeCloseTo(readings.flatOneHundredFiftyPercent, 6)
    })
  })
})

describe('familyMaximumMonthlyFromPia', () => {
  it('matches the SSA 2026 retirement/survivor family maximum worksheet', () => {
    // 2026 bend points: 1,643 / 2,371 / 3,093.
    // 150% of 1,643 + 272% of 728 + 134% of 629 = 5,287.52, rounded down to dime.
    expect(familyMaximumMonthlyFromPia(3_000, 2026)).toBe(5_287.5)
  })

  it('uses the Jan 1 birth-year rule for eligibility', () => {
    expect(familyMaximumEligibilityYearFromDobParts(1964, 1, 1)).toBe(2025)
    expect(familyMaximumEligibilityYearFromDobParts(1964, 6, 15)).toBe(2026)
  })
})

describe('capAuxiliaryForFamilyMaximum', () => {
  // 20 CFR 404.404: the auxiliaries are reduced so that the total paid in a
  // month, "including an amount equal to the primary insurance amount" of the
  // worker, does not exceed the family maximum; POMS RS 00615.756 B.1: "Deduct
  // PIA from maximum." The worker's own benefit is not reduced and is not what
  // is counted: delayed credits or an early-claim reduction change what the
  // worker is paid, not the room.
  //
  // The slice 4 review's case (F3): the worker, born 1964-01-15, attains 62 in
  // 2026, so the 2026 bend points apply; a PIA of 1,000 is below the first
  // (1,643), so the family maximum is 1.50 x 1,000 = 1,500.0. He claims at 70:
  // 36 months after his FRA of 67 at 2/3 of 1 percent a month, 1,240. The
  // spouse, born 1964-06-15 with a PIA of 100, claims at her FRA of 67, so her
  // excess, half the worker's PIA less her own, is 500 - 100 = 400, unreduced.
  //   regulation: room 1,500 - 1,000 = 500, so the 400 is paid in full
  //   the worker's benefit counted instead: room 1,500 - 1,240 = 260
  describeRule('cfr-20-404-404-family-maximum-counts-the-worker-pia', {
    readings: { regulation: 400, workerBenefitWithDelayedCredits: 260 },
    accepted: 'regulation',
  }, ({ accepted, readings }) => {
    const worker = { workerPiaMonthly: 1_000, workerDob: { year: 1964, month: 1, day: 15 } }

    it('counts the worker\'s PIA against the family maximum, not the benefit raised by delayed credits', () => {
      expect(familyMaximumEligibilityYearFromDobParts(1964, 1, 15)).toBe(2026)
      expect(familyMaximumMonthlyFromPia(1_000, 2026)).toBe(1_500)
      const paid = capAuxiliaryForFamilyMaximum({ ...worker, auxiliaryMonthly: 500 - 100 })
      expect(paid).toBe(accepted)
      expect(paid).not.toBe(readings.workerBenefitWithDelayedCredits)
    })

    it('holds an auxiliary total above the room to the room', () => {
      // The helper takes no claim: the room is 1,500 - 1,000 = 500 however the
      // worker claims. An auxiliary total of 600 (more than one auxiliary would
      // be needed to reach it) is held to 500. A real early claim through the
      // projection is in simulate.social-security.test.ts.
      expect(capAuxiliaryForFamilyMaximum({ ...worker, auxiliaryMonthly: 600 })).toBe(500)
    })

    it('leaves a single spouse room for half the PIA under the retirement and survivor maximum, less the dime rounding', () => {
      // That maximum is at least 150 percent of the PIA before 42 U.S.C.
      // 403(a)(1) decreases it "to the next lower multiple of $0.10", so the
      // room is at least half the PIA less under ten cents (2026: 1.50 x 3,000
      // = 4,500 against 5,287.50). The disability maximum can be lower
      // (usc-42-403-a-6-ssdi-family-maximum, below).
      for (const pia of [500, 1_000, 1_000.1, 1_643, 2_000, 3_000, 4_000]) {
        const room = familyMaximumMonthlyFromPia(pia, 2026) - pia
        expect(room).toBeGreaterThan(0.5 * pia - 0.1)
      }
      for (const pia of [500, 1_000, 1_643, 2_000, 3_000, 4_000]) {
        expect(capAuxiliaryForFamilyMaximum({ workerPiaMonthly: pia, workerDob: worker.workerDob, auxiliaryMonthly: 0.5 * pia })).toBe(0.5 * pia)
      }
      // A PIA of 1,000.10: 1.50 x 1,000.10 = 1,500.15, floored to 1,500.10, so
      // the room is 500.00 and a spouse with no own PIA, whose original benefit
      // is 500.05, is held to 500.00.
      expect(familyMaximumMonthlyFromPia(1_000.1, 2026)).toBe(1_500.1)
      expect(capAuxiliaryForFamilyMaximum({ workerPiaMonthly: 1_000.1, workerDob: worker.workerDob, auxiliaryMonthly: 0.5 * 1_000.1 })).toBeCloseTo(500, 9)
    })
  })

  // 20 CFR 404.410(b): the spouse's benefits "before any reduction ... are
  // reduced first (if necessary) for the family maximum" and "then reduced
  // based on the number of months of entitlement"; POMS RS 00615.010 reduces
  // "the spouse's benefit (adjusted for the maximum if necessary)"; and 20 CFR
  // 404.403(a)(5) Example 1 takes the dual-entitlement reduction from the
  // "Wife's benefit, reduced for maximum". So half the worker's PIA meets the
  // room first, and the spouse's own PIA and the age reduction come after.
  //
  // The orders differ only when the room is below half the PIA, and for one
  // spouse that takes a lower maximum than the retirement one: an SSDI
  // worker's. 20 CFR 404.403(d-1) makes it the smaller of 85 percent of the
  // AIME (not less than the PIA) and 150 percent of the PIA. These cases pass
  // the disability maximum in, as the ledger does through
  // workerFamilyMaximumMonthlyAt (usc-42-403-a-6-ssdi-family-maximum).
  //
  // The check's case: PIA 1,000 and a disability maximum of 1,300 (85 percent
  // of an AIME of about 1,529), so the room is 300; the spouse's own PIA is 100
  // and she is at FRA. Regulation: min(500, 300) = 300, less her 100 = 200.
  // Capping after the subtraction: min(500 - 100, 300) = 300.
  describeRule('cfr-20-404-404-family-maximum-counts-the-worker-pia', {
    readings: { regulation: 200, maximumAfterTheOwnBenefit: 300 },
    accepted: 'regulation',
    note: 'the maximum on the original benefit, before the own benefit and the age reduction',
  }, ({ accepted, readings }) => {
    const spouse = { ownPiaMonthly: 100, ownActualMonthly: 100 }

    it('holds half the PIA to the room before the own PIA is subtracted', () => {
      const total = currentSpouseMonthlyUnderFamilyMaximum({
        workerPiaMonthly: 1_000,
        workerDob: { year: 1966, month: 3, day: 15 },
        familyMaximumMonthly: 1_300,
        ...spouse,
        spouseFactor: 1,
      })
      expect(total - spouse.ownActualMonthly).toBeCloseTo(accepted, 9)
      expect(total - spouse.ownActualMonthly).not.toBeCloseTo(readings.maximumAfterTheOwnBenefit, 2)
    })

    it('does the same for an SSDI worker whose numbers come from one AIME, and reduces for age after the maximum', () => {
      // An AIME of 2,000 with 2026 PIA bend points 1,286 and 7,749: 0.90 x
      // 1,286 + 0.32 x 714 = 1,157.40 + 228.48 = 1,385.88, floored to the dime,
      // 1,385.80. Disability maximum: 85 percent of the AIME, 1,700.00, is above
      // the PIA and below 150 percent of it (2,078.70), so 1,700.00; room
      // 1,700.00 - 1,385.80 = 314.20. The spouse (own PIA 100) at FRA:
      // regulation min(692.90, 314.20) - 100 = 214.20; capping after the
      // subtraction, min(592.90, 314.20) = 314.20. With a spouse factor of
      // 0.75 the regulation reduces the 214.20 to 160.65, where capping last
      // would give min(0.75 x 592.90 = 444.675, 314.20) = 314.20.
      const pia = Math.floor((0.9 * 1_286 + 0.32 * (2_000 - 1_286)) * 10 + 1e-9) / 10
      const disabilityMaximum = Math.floor(Math.min(Math.max(0.85 * 2_000, pia), 1.5 * pia) * 10 + 1e-9) / 10
      expect(pia).toBeCloseTo(1_385.8, 9)
      expect(disabilityMaximum).toBeCloseTo(1_700, 9)
      const excess = (spouseFactor: number) => currentSpouseMonthlyUnderFamilyMaximum({
        workerPiaMonthly: pia,
        workerDob: { year: 1966, month: 3, day: 15 },
        familyMaximumMonthly: disabilityMaximum,
        ...spouse,
        spouseFactor,
      }) - spouse.ownActualMonthly
      expect(excess(1)).toBeCloseTo(214.2, 9)
      expect(excess(0.75)).toBeCloseTo(160.65, 9)
    })

    it('matches the old order whenever the room holds half the PIA, as under the retirement maximum', () => {
      // Retirement maximum, PIA 1,000 (room 500): 500 - 100 = 400 either way.
      const total = currentSpouseMonthlyUnderFamilyMaximum({
        workerPiaMonthly: 1_000,
        workerDob: { year: 1964, month: 1, day: 15 },
        ...spouse,
        spouseFactor: 1,
      })
      expect(total - spouse.ownActualMonthly).toBeCloseTo(400, 9)
    })
  })

  it('leaves an auxiliary unchanged when the worker record has enough room', () => {
    expect(
      capAuxiliaryForFamilyMaximum({
        workerPiaMonthly: 4_000,
        workerDob: { year: 1960, month: 6, day: 15 },
        auxiliaryMonthly: 2_000,
      }),
    ).toBe(2_000)
  })
})

describe('family maximum eligibility year after a disability', () => {
  // 42 U.S.C. 403(a)(2)(D): the year a worker attains 62 is not his year of
  // eligibility for the family maximum when he was entitled to disability
  // benefits in any of the 12 months before; the year of eligibility for that
  // disability benefit is (20 CFR 404.403(a)(2)). A worker born 1970-06-15
  // with a PIA of 2,000 whose disability began in 2025 draws disability
  // benefits until his FRA in June 2037, so from the conversion his maximum
  // is on the 2025 bend points, 1,567 / 2,262 / 2,950 (ssa.gov/oact/cola/familymax.html):
  //   1.50 x 1,567 = 2,350.50; 2.72 x (2,000 - 1,567) = 1,177.76;
  //   3,528.26, decreased to the next lower dime, 3,528.20.
  // The contrary reading takes the year he attains 62, 2032, which falls back
  // to the latest table on file (2026: 1,643 / 2,371 / 3,093):
  //   1.50 x 1,643 = 2,464.50; 2.72 x (2,000 - 1,643) = 971.04;
  //   3,435.54, decreased to 3,435.50.
  // 20 CFR 404.403(g)(3) computes the maximum after the conversion without
  // regard to the disability maximum, so in his FRA month (June 2037) the
  // retirement and survivor maximum on the 2025 bend points governs.
  const dob = { year: 1970, month: 6, day: 15 }
  const fraMonthIndex = 2037 * 12 + 5
  const disability = { onsetYear: 2025, firstPayableMonthIndex: 2025 * 12 + 5, fraMonthIndex, disabilityMaximumMonthly: 2_400 }

  describeRule('usc-42-403-a-2-D-family-maximum-eligibility-after-disability', {
    readings: { statute: 3_528.2, yearOfAttainingSixtyTwo: 3_435.5 },
    accepted: 'statute',
    note: 'a worker disabled in 2025, after his disability benefit converts',
  }, ({ accepted, readings }) => {
    it('prices the maximum after the conversion on the year of his disability', () => {
      expect(familyMaximumEligibilityYearFromDobParts(1970, 6, 15)).toBe(2032)
      expect(familyMaximumEligibilityYear(dob, 2025)).toBe(2025)
      const atConversion = workerFamilyMaximumMonthlyAt({ piaMonthly: 2_000, dob, disability }, fraMonthIndex)
      expect(atConversion).toBe(accepted)
      expect(atConversion).not.toBe(readings.yearOfAttainingSixtyTwo)
      expect(familyMaximumMonthlyFromPia(2_000, 2032)).toBe(readings.yearOfAttainingSixtyTwo)
    })

    it('keeps the year of attaining 62 for a worker with no disability, or one that began after it', () => {
      // 20 CFR 404.403(a)(2): the year of attaining 62 or of the beginning of
      // the disability, "whichever is earlier". Born 1960-06-15, he attains 62
      // in 2022; a disability that began in 2024, at 64, leaves 2022.
      expect(familyMaximumEligibilityYear(dob, null)).toBe(2032)
      expect(familyMaximumEligibilityYear({ year: 1960, month: 6, day: 15 }, 2024)).toBe(2022)
      expect(workerFamilyMaximumMonthlyAt({ piaMonthly: 2_000, dob, disability: null }, fraMonthIndex)).toBe(readings.yearOfAttainingSixtyTwo)
    })

    it('moves no single-spouse figure: the room above the PIA holds half the PIA on either year', () => {
      const cap = (familyMaximumMonthly: number) => capAuxiliaryForFamilyMaximum({
        workerPiaMonthly: 2_000,
        workerDob: dob,
        familyMaximumMonthly,
        auxiliaryMonthly: 1_000,
      })
      expect(cap(accepted)).toBe(1_000)
      expect(cap(readings.yearOfAttainingSixtyTwo)).toBe(1_000)
    })
  })

  it('applies the disability maximum from the first disability month to the month before FRA', () => {
    // 42 U.S.C. 423(a)(1): entitlement ends with the month before the month
    // he attains retirement age; 403(a)(6) governs only while he is entitled.
    const worker = { piaMonthly: 2_000, dob, disability }
    expect(workerFamilyMaximumMonthlyAt(worker, disability.firstPayableMonthIndex)).toBe(2_400)
    expect(workerFamilyMaximumMonthlyAt(worker, fraMonthIndex - 1)).toBe(2_400)
    expect(workerFamilyMaximumMonthlyAt(worker, fraMonthIndex)).toBe(3_528.2)
  })
})

describe('disability family maximum (42 U.S.C. 403(a)(6); 20 CFR 404.403(d-1))', () => {
  // The smaller of 85 percent of the AIME (or 100 percent of the PIA, if
  // larger) and 150 percent of the PIA. Each arm can govern:
  //   AIME 500, PIA 450: max(425, 450) = 450 against 675, so 450 (the PIA).
  //   AIME 2,328, PIA 1,490.80: 1,978.80 against 2,236.20, so 1,978.80.
  //   AIME 2,000, PIA 1,000: 1,700 against 1,500, so 1,500 (the ceiling).
  // Neither the statute nor the regulation rounds it, so 85 percent of an odd
  // AIME keeps its cents: AIME 2,161, PIA 1,437.40: 1,836.85.
  // With the AIME unknown (an entered PIA) the engine takes the ceiling,
  // 1.50 x 450 = 675, where the statute, with an AIME of 500, gives 450.
  describeRule('usc-42-403-a-6-ssdi-family-maximum', {
    readings: { disabilityMaximum: 450, ceilingWithoutAime: 675 },
    accepted: 'disabilityMaximum',
    produced: 'ceilingWithoutAime',
    note: 'the ceiling an entered PIA gets, the AIME behind it unknown',
  }, ({ accepted, produced }) => {
    it('gives each arm of the formula, and the ceiling only when the AIME is unknown', () => {
      expect(disabilityFamilyMaximumMonthly(450, 500)).toBe(accepted)
      expect(disabilityFamilyMaximumMonthly(1_490.8, 2_328)).toBeCloseTo(1_978.8, 9)
      expect(disabilityFamilyMaximumMonthly(1_000, 2_000)).toBe(1_500)
      expect(disabilityFamilyMaximumMonthly(1_437.4, 2_161)).toBeCloseTo(1_836.85, 9)
      expect(disabilityFamilyMaximumMonthly(0, 2_000)).toBe(0)
      // An entered PIA of 450 with no AIME: the 150 percent ceiling.
      expect(disabilityFamilyMaximumMonthly(450, null)).toBe(produced)
      expect(disabilityFamilyMaximumMonthly(450, null)).not.toBe(accepted)
    })
  })

  it('raises an earnings-derived disability maximum by each cost-of-living increase, to the dime', () => {
    // 42 U.S.C. 415(i)(2)(A)(ii) increases "the amount of total monthly
    // benefits based on any primary insurance amount" with the PIA, and "any
    // amount so increased that is not a multiple of $0.10 shall be decreased
    // to the next lower multiple of $0.10". Eligibility 2024, first projected
    // year 2026: the increases of December 2024 (2.5 percent) and December 2025
    // (2.8 percent), SSA's published COLAs.
    //   AIME 2,000, PIA 1,385.80: 85% = 1,700.00, below 150% (2,078.70).
    //   1,700.00 x 1.025 = 1,742.50; x 1.028 = 1,791.29, to the dime 1,791.20.
    //   (The PIA the same way: 1,385.80 x 1.025 = 1,420.44 -> 1,420.40;
    //   x 1.028 = 1,460.17 -> 1,460.10.)
    const detail = { aime: 2_000, piaMonthly: 1_385.8, eligibilityYear: 2024 } as PiaFromEarningsResult
    const resolved = { status: 'fromEarnings' as const, piaMonthly: 1_460.1, detail, standInColaYears: [] }
    expect(disabilityFamilyMaximumAtStart(resolved, { startYear: 2026, colaAssumptionPct: 0 })).toBeCloseTo(1_791.2, 9)
    expect(disabilityFamilyMaximumAtStart({ status: 'entered', piaMonthly: 1_460.1 }, { startYear: 2026, colaAssumptionPct: 0 })).toBeNull()
  })
})
