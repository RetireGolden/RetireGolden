/**
 * Pins the two approximated AIME earnings-history records (initial-computation
 * base window and annual indexed-earnings penny rounding), the computation-year
 * count with the five-year dropout and 1951 floor, settled on 2026-09-27
 * (decision D-SS-LAW-2), and the disability computation, settled in the
 * calculation validation round of 2026-11-23.
 *
 * Official AWI figures are frozen from SSA's National Average Wage Index series
 * (https://www.ssa.gov/oact/cola/AWI.html, retrieved 2026-09-04), not imported
 * from the engine table. Authority and competing-reading AIMEs are derived from
 * those frozen values on the identical earnings; produced pins are the scout-
 * observed engine AIMEs.
 */
import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  type PiaFromEarningsResult,
  type YearEarning,
} from '../../socialSecurity/piaFromEarnings.js'

/** Official SSA AWI dollars, two-decimal series as published. */
const AWI = {
  1979: 11479.46,
  1980: 12513.46,
  1981: 13773.10,
  1982: 14531.34,
  1983: 15239.24,
  1984: 16135.07,
  1985: 16822.51,
  1986: 17321.82,
  1987: 18426.51,
  1988: 19334.04,
  1989: 20099.55,
  1990: 21027.98,
  1991: 21811.60,
  1992: 22935.42,
  1993: 23132.67,
  1994: 23753.53,
  1995: 24705.66,
  1996: 25913.90,
  1997: 27426.00,
  1998: 28861.44,
  1999: 30469.84,
  2000: 32154.82,
  2001: 32921.92,
  2002: 33252.09,
  2003: 34064.95,
  2004: 35648.55,
  2005: 36952.94,
  2006: 38651.41,
  2007: 40405.48,
  2008: 41334.97,
  2009: 40711.61,
  2010: 41673.83,
  2011: 42979.61,
  2012: 44321.67,
  2013: 44888.16,
  2014: 46481.52,
  2015: 48098.63,
  2016: 48642.15,
  2017: 50321.89,
  2018: 52145.80,
  2019: 54099.99,
  2020: 55628.60,
  2021: 60575.07,
  2022: 63795.13,
  2023: 66621.80,
  2024: 69846.57,
} as const

const INDEXING_2022_CENTS = 6_379_513 // $63,795.13
const AWI_2023_CENTS = 6_662_180 // $66,621.80
const PRE_ENTITLEMENT_2024_CENTS = 4_200_000 // $42,000.00
const CENTS_2023_NOMINAL = 4488 // $44.88

const MODERN_DOB = { dobYear: 1962, dobMonth: 6, dobDay: 15 } as const
const HISTORICAL_DOB = { dobYear: 1928, dobMonth: 6, dobDay: 15 } as const

function aimeFromCents(sumCents: number, computationYears: number): number {
  return Math.floor(sumCents / (100 * 12 * computationYears))
}

function nearerPennyCents(earnings: number, yearAwi: number, indexingAwi: number): number {
  if (earnings === yearAwi) return Math.round(indexingAwi * 100)
  return Math.round((earnings * indexingAwi * 100) / yearAwi)
}

function awiEarnings(years: readonly number[]): YearEarning[] {
  return years.map((year) => {
    const amount = AWI[year as keyof typeof AWI]
    if (amount === undefined) throw new Error(`frozen AWI missing ${year}`)
    return { year, amount }
  })
}

function aimeOf(
  input: Parameters<typeof computePiaFromEarnings>[0],
): number {
  const result = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(result)) throw new Error(`expected PIA result, received ${result.code}`)
  return result.aime
}

function aimeOfReportedEarnings(
  dob: { dobYear: number; dobMonth: number; dobDay: number },
  earnings: YearEarning[],
  projection?: Parameters<typeof piaInputFromEarnings>[4],
): number {
  const result = computePiaFromEarnings(
    piaInputFromEarnings(dob.dobYear, dob.dobMonth, dob.dobDay, earnings, projection),
  )
  if (isPiaFromEarningsError(result)) throw new Error(`expected PIA result, received ${result.code}`)
  return result.aime
}

const COMMON_2013_2022 = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022] as const
const TEN_INDEXED_CENTS = 10 * INDEXING_2022_CENTS
const ELEVEN_INDEXED_CENTS = 11 * INDEXING_2022_CENTS

describeRule('usc-42-415-b-2-b-ii-iii-initial-computation-base-window', {
  readings: {
    statuteIncludesAge21AndPreEntitlementAge62: [
      aimeFromCents(ELEVEN_INDEXED_CENTS, 35),
      aimeFromCents(TEN_INDEXED_CENTS + PRE_ENTITLEMENT_2024_CENTS, 35),
      aimeFromCents(TEN_INDEXED_CENTS + PRE_ENTITLEMENT_2024_CENTS, 35),
    ],
    engineAge22ThroughYearBefore62: [1518, 1518, 1518],
    lowerBoundaryAge21Only: [
      aimeFromCents(ELEVEN_INDEXED_CENTS, 35),
      aimeFromCents(TEN_INDEXED_CENTS, 35),
      aimeFromCents(TEN_INDEXED_CENTS, 35),
    ],
  },
  accepted: 'statuteIncludesAge21AndPreEntitlementAge62',
  produced: 'engineAge22ThroughYearBefore62',
  note: 'three cells: age-21, explicit 2024, projected 2024 via throughAge63',
}, ({ accepted, produced, readings }) => {
  it('omits age-21 and age-62 pre-entitlement years; three cells pin input clamp and compute loop independently', () => {
    const common = awiEarnings(COMMON_2013_2022)
    // Cell 1: age-21 year (1983) in reported earnings.
    const withAge21 = aimeOfReportedEarnings(MODERN_DOB, [
      ...common,
      { year: 1983, amount: AWI[1983] },
    ])
    // Cell 2: explicit 2024 earnings pin piaInputFromEarnings lastEarningsYear clamp.
    const withAge62 = aimeOfReportedEarnings(MODERN_DOB, [
      ...common,
      { year: 2024, amount: 42_000 },
    ])
    // Cell 3: zero 2023, projection through age 63 (only 2024) pins computePiaFromEarnings loop upper bound.
    const withProjectedAge62 = aimeOfReportedEarnings(
      MODERN_DOB,
      [...common, { year: 2023, amount: 0 }],
      { assumedAnnualEarnings: 42_000, throughAge: 63 },
    )
    expect([withAge21, withAge62, withProjectedAge62]).toEqual(produced)
    expect([withAge21, withAge62, withProjectedAge62]).not.toEqual(accepted)
    expect([withAge21, withAge62, withProjectedAge62]).not.toEqual(readings.lowerBoundaryAge21Only)
  })
})

const INDEXED_2020_CENTS = nearerPennyCents(AWI[2020], AWI[2020], AWI[2022])

describeRule('cfr-20-404-211-d-3-indexed-earnings-nearer-penny', {
  readings: {
    nearerPennyThenDollarFloor: aimeFromCents(INDEXED_2020_CENTS + CENTS_2023_NOMINAL, 35),
    annualWholeDollarFloor: 151,
    noWageIndexing: aimeFromCents(Math.round(AWI[2020] * 100) + CENTS_2023_NOMINAL, 35),
  },
  accepted: 'nearerPennyThenDollarFloor',
  produced: 'annualWholeDollarFloor',
  note: '2020 AWI year plus 2023 cents',
}, ({ accepted, produced, readings }) => {
  it('floors the indexed 2020 year to a whole dollar and drops AIME from 152 to 151', () => {
    const aime = aimeOf({
      ...MODERN_DOB,
      earnings: [
        { year: 2020, amount: AWI[2020] },
        { year: 2023, amount: 44.88 },
      ],
      lastEarningsYear: 2023,
    })
    expect(aime).toBe(produced)
    expect(aime).not.toBe(accepted)
    expect(aime).not.toBe(readings.noWageIndexing)
  })
})

const MODERN_ZERO_YEARS = new Set([1984, 1992, 2000, 2008, 2016])
const MODERN_POSITIVE_INDEXED = 34
const MODERN_AUTHORITY_SUM_CENTS = MODERN_POSITIVE_INDEXED * INDEXING_2022_CENTS + AWI_2023_CENTS
const HISTORICAL_YEARS = [1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988] as const
const HISTORICAL_SUM_CENTS = HISTORICAL_YEARS.reduce(
  (sum, year) => sum + nearerPennyCents(AWI[year], AWI[year], AWI[1988]),
  0,
)
const FIRST5_MODERN_INDEXED = 30
const FIRST5_MODERN_SUM_CENTS = FIRST5_MODERN_INDEXED * INDEXING_2022_CENTS + AWI_2023_CENTS

function modernCountEarnings(): YearEarning[] {
  const rows: YearEarning[] = []
  for (let year = 1984; year <= 2023; year++) {
    if (MODERN_ZERO_YEARS.has(year)) continue
    const amount = AWI[year as keyof typeof AWI]
    if (amount === undefined) throw new Error(`frozen AWI missing ${year}`)
    rows.push({ year, amount })
  }
  return rows
}

describeRule('usc-42-415-b-2-a-i-computation-years-five-year-dropout', {
  readings: {
    elapsedMinusFiveWith1951Floor: [
      aimeFromCents(MODERN_AUTHORITY_SUM_CENTS, 35),
      aimeFromCents(HISTORICAL_SUM_CENTS, 34),
    ],
    always35YearsWithoutThe1951Floor: [5322, 460],
    noFiveYearDropout: [
      aimeFromCents(MODERN_AUTHORITY_SUM_CENTS, 40),
      aimeFromCents(HISTORICAL_SUM_CENTS, 39),
    ],
    firstFiveCalendarYearsDropped: [
      aimeFromCents(FIRST5_MODERN_SUM_CENTS, 35),
      aimeFromCents(HISTORICAL_SUM_CENTS, 34),
    ],
  },
  accepted: 'elapsedMinusFiveWith1951Floor',
  note: 'modern 35-year vs 1951-floor 34-year',
}, ({ accepted, readings }) => {
  it('uses the elapsed years less five, 34 when elapsed years start at the 1951 floor', () => {
    const modern = aimeOf({
      ...MODERN_DOB,
      earnings: modernCountEarnings(),
      lastEarningsYear: 2023,
    })
    const historical = aimeOf({
      ...HISTORICAL_DOB,
      earnings: awiEarnings(HISTORICAL_YEARS),
      lastEarningsYear: 1988,
    })
    expect([modern, historical]).toEqual(accepted)
    expect([modern, historical]).not.toEqual(readings.always35YearsWithoutThe1951Floor)
    expect([modern, historical]).not.toEqual(readings.noFiveYearDropout)
    expect([modern, historical]).not.toEqual(readings.firstFiveCalendarYearsDropped)
  })
})

// SSA PIA formula bend points by year of eligibility, as published
// (https://www.ssa.gov/oact/cola/bendpoints.html), frozen here rather than
// imported from the engine table.
const BEND_POINTS = {
  1987: { first: 310, second: 1_866 },
  2009: { first: 744, second: 4_483 },
  2019: { first: 926, second: 5_583 },
  2026: { first: 1_286, second: 7_749 },
} as const

/** 42 U.S.C. 415(a)(1)(A): 90/32/15 percent of a whole-dollar AIME, in cents, floored to the dime. */
function piaCentsFromAime(aime: number, bendPoints: { first: number; second: number }): number {
  const cents =
    90 * Math.min(aime, bendPoints.first) +
    32 * Math.max(0, Math.min(aime, bendPoints.second) - bendPoints.first) +
    15 * Math.max(0, aime - bendPoints.second)
  return Math.floor(cents / 10) * 10
}

function disabilityResult(
  input: Parameters<typeof computePiaFromEarnings>[0],
): PiaFromEarningsResult {
  const result = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(result)) throw new Error(`expected PIA result, received ${result.code}`)
  return result
}

const DISABILITY_DOB = { dobYear: 1964, dobMonth: 6, dobDay: 15 } as const
const DISABILITY_EARNINGS_YEARS = Array.from({ length: 33 }, (_, index) => 1986 + index)
const DISABILITY_INDEXED_2017_CENTS = nearerPennyCents(AWI[2017], AWI[2017], AWI[2017])
const DISABILITY_2018_NOMINAL_CENTS = Math.round(AWI[2018] * 100)
const DISABILITY_ACCEPTED_SUM_CENTS = 27 * DISABILITY_INDEXED_2017_CENTS + DISABILITY_2018_NOMINAL_CENTS
const DISABILITY_WRONG35_SUM_CENTS = 32 * DISABILITY_INDEXED_2017_CENTS + DISABILITY_2018_NOMINAL_CENTS
const DISABILITY_COMPUTATION_YEARS = 28
const RETIREMENT_INDEXED_2024_CENTS = nearerPennyCents(AWI[2017], AWI[2017], AWI[2024])

// 2019 disability worksheet (42 U.S.C. 415(b)(2)(A)(ii), (b)(2)(B)(iii),
// (b)(3)(A); 20 CFR 404.211(d)(1), (e)(1), (e)(3)): worker born 1964-06-15
// (attains 62 in 2026) whose disability began in 2019 (age 55); earnings for
// 1986–2018 equal each year's published AWI, none after. The plan's
// disability runs from onset to conversion at full retirement age, so it is
// the period of disability: the year of eligibility is 2019, the indexing
// year 2017 (second year before 2019), and the elapsed years are 1986 (age
// 22) through 2018, 33 of them, since 2019 on lies within the period. The 32
// years through 2017 index to 50,321.89 each; 2018 stays at its nominal
// 52,145.80. Dropout min(floor(33 / 5), 5) = 5 leaves 28 computation years,
// 336 months:
//   accepted: floor((27 × 50,321.89 + 52,145.80) / 336) = floor(4,198.92) = 4,198;
//   2017 index but the ordinary 35-year divisor:
//     floor((32 × 50,321.89 + 52,145.80) / 420) = floor(3,958.20) = 3,958;
//   old engine (onset ignored): 2024 index (69,846.57), window 1986–2025,
//     35 of 40 years, the 33 earnings years each 69,846.57:
//     floor(33 × 69,846.57 / 420) = floor(5,487.94) = 5,487.
// PIA on the 2019 bend points (926, 5,583): 0.9 × 926 + 0.32 × (4,198 − 926)
// = 833.40 + 1,047.04 = 1,880.44 → 1,880.40. The old engine priced 5,487 on
// the 2026 bend points (1,286, 7,749): 1,157.40 + 0.32 × 4,201 = 2,501.72 → 2,501.70.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    disabilityBenchmarkAndComputationYears: aimeFromCents(
      DISABILITY_ACCEPTED_SUM_CENTS,
      DISABILITY_COMPUTATION_YEARS,
    ),
    disabilityIndexButOrdinary35YearDivisor: aimeFromCents(DISABILITY_WRONG35_SUM_CENTS, 35),
    retirementEligibilityProxy: aimeFromCents(33 * RETIREMENT_INDEXED_2024_CENTS, 35),
  },
  accepted: 'disabilityBenchmarkAndComputationYears',
  note: '2019 onset at 55; unit AIME',
}, ({ accepted, readings }) => {
  it('indexes to 2017 and averages 28 years for a disability that began in 2019', () => {
    expect([accepted, readings.disabilityIndexButOrdinary35YearDivisor, readings.retirementEligibilityProxy])
      .toEqual([4_198, 3_958, 5_487])
    const result = disabilityResult({
      ...DISABILITY_DOB,
      earnings: awiEarnings(DISABILITY_EARNINGS_YEARS),
      lastEarningsYear: 2025,
      disabilityOnsetYear: 2019,
    })
    expect(result.eligibilityYear).toBe(2019)
    expect(result.lastBaseYear).toBe(2018)
    expect(result.disabilityComputation).toBe(true)
    expect(result.computationYearCount).toBe(DISABILITY_COMPUTATION_YEARS)
    expect(result.aime).toBe(accepted)
    expect(result.aime).not.toBe(readings.disabilityIndexButOrdinary35YearDivisor)
    expect(result.aime).not.toBe(readings.retirementEligibilityProxy)
    expect(Math.round(result.piaMonthly * 100)).toBe(piaCentsFromAime(accepted, BEND_POINTS[2019]))
    expect(Math.round(result.piaMonthly * 100)).toBe(188_040)
  })

  it('keeps the ordinary computation without an onset, and for an onset in the year of 62', () => {
    const base = { ...DISABILITY_DOB, earnings: awiEarnings(DISABILITY_EARNINGS_YEARS), lastEarningsYear: 2025 }
    for (const disabilityOnsetYear of [null, 2026]) {
      const result = disabilityResult({ ...base, disabilityOnsetYear })
      expect(result.eligibilityYear).toBe(2026)
      expect(result.disabilityComputation).toBe(false)
      expect(result.aime).toBe(readings.retirementEligibilityProxy)
      expect(Math.round(result.piaMonthly * 100)).toBe(piaCentsFromAime(5_487, BEND_POINTS[2026]))
    }
  })
})

// 2009 disability dropout worksheet (42 U.S.C. 415(b)(2)(A)(ii); 20 CFR
// 404.211(e)(3)): the same worker with a disability that began in 2009 (age
// 45) and earnings equal to each year's AWI for 1991–2008 only. Year of
// eligibility 2009, indexing year 2007 (AWI 40,405.48); 1991–2007 index to
// 40,405.48, 2008 stays at its nominal 41,334.97. Elapsed years 1986–2008
// number 23, so the disability dropout is floor(23 / 5) = 4 and 19 years are
// averaged: 2008, the seventeen 2007-dollar years and one $0 year.
//   accepted: floor((17 × 40,405.48 + 41,334.97) / 228) = floor(3,193.98) = 3,193;
//   ordinary five-year dropout (18 years): floor(728,228.13 / 216) = 3,371;
//   old engine (onset ignored): 18 years at the 2024 index over 35:
//     floor(18 × 69,846.57 / 420) = floor(2,993.42) = 2,993.
// PIA on the 2009 bend points (744, 4,483): 669.60 + 0.32 × 2,449 = 1,453.28
// → 1,453.20; on the 2026 bend points the same AIME would give 1,767.60.
const YOUNG_ONSET_EARNINGS_YEARS = Array.from({ length: 18 }, (_, index) => 1991 + index)
const YOUNG_ONSET_SUM_CENTS =
  17 * nearerPennyCents(AWI[2007], AWI[2007], AWI[2007]) + Math.round(AWI[2008] * 100)

describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    oneDropoutYearPerFiveElapsed: aimeFromCents(YOUNG_ONSET_SUM_CENTS, 19),
    ordinaryFiveYearDropout: aimeFromCents(YOUNG_ONSET_SUM_CENTS, 18),
    retirementEligibilityProxy: aimeFromCents(18 * nearerPennyCents(AWI[2007], AWI[2007], AWI[2024]), 35),
  },
  accepted: 'oneDropoutYearPerFiveElapsed',
  note: '2009 onset at 45; disability dropout',
}, ({ accepted, readings }) => {
  it('drops four of 23 elapsed years and prices the PIA on the 2009 bend points', () => {
    expect([accepted, readings.ordinaryFiveYearDropout, readings.retirementEligibilityProxy])
      .toEqual([3_193, 3_371, 2_993])
    const result = disabilityResult({
      ...DISABILITY_DOB,
      earnings: awiEarnings(YOUNG_ONSET_EARNINGS_YEARS),
      lastEarningsYear: 2008,
      disabilityOnsetYear: 2009,
    })
    expect(result.computationYearCount).toBe(19)
    expect(result.zeroYearsInAime).toBe(1)
    expect(result.aime).toBe(accepted)
    expect(result.aime).not.toBe(readings.ordinaryFiveYearDropout)
    expect(result.aime).not.toBe(readings.retirementEligibilityProxy)
    expect(Math.round(result.piaMonthly * 100)).toBe(piaCentsFromAime(accepted, BEND_POINTS[2009]))
    expect(Math.round(result.piaMonthly * 100)).toBe(145_320)
    expect(Math.round(result.piaMonthly * 100)).not.toBe(piaCentsFromAime(accepted, BEND_POINTS[2026]))
  })
})

// Two-computation-year minimum (42 U.S.C. 415(b)(2)(A); 20 CFR 404.211(e)(3),
// "which may not be fewer than 2"): a disability beginning in 1987 for the
// same worker leaves one elapsed year (1986), a dropout of floor(1 / 5) = 0,
// and one year, raised to two. Year of eligibility 1987, indexing year 1985,
// so 1986's 20,000 is used at its nominal amount:
//   accepted: floor(20,000 / 24) = 833;
//   one computation year: floor(20,000 / 12) = 1,666;
//   old engine (onset ignored): 20,000 × 69,846.57 / 17,321.82 = 80,646.38
//     over 35 years, floor(80,646.38 / 420) = 192.
// PIA on the 1987 bend points (310, 1,866): 279.00 + 0.32 × 523 = 446.36 → 446.30.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    atLeastTwoComputationYears: aimeFromCents(2_000_000, 2),
    oneComputationYear: aimeFromCents(2_000_000, 1),
    retirementEligibilityProxy: aimeFromCents(nearerPennyCents(20_000, AWI[1986], AWI[2024]), 35),
  },
  accepted: 'atLeastTwoComputationYears',
  note: 'two computation year minimum',
}, ({ accepted, readings }) => {
  it('averages a single elapsed year over two computation years', () => {
    expect([accepted, readings.oneComputationYear, readings.retirementEligibilityProxy]).toEqual([833, 1_666, 192])
    const result = disabilityResult({
      ...DISABILITY_DOB,
      earnings: [{ year: 1986, amount: 20_000 }],
      lastEarningsYear: 1986,
      disabilityOnsetYear: 1987,
    })
    expect(result.computationYearCount).toBe(2)
    expect(result.aime).toBe(accepted)
    expect(result.aime).not.toBe(readings.oneComputationYear)
    expect(Math.round(result.piaMonthly * 100)).toBe(piaCentsFromAime(accepted, BEND_POINTS[1987]))
    expect(Math.round(result.piaMonthly * 100)).toBe(44_630)
  })
})
