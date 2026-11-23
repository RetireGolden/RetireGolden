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
import { describe, expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import {
  computePiaFromEarnings,
  disabilityComputationFacts,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  type PiaFromEarningsResult,
  type YearEarning,
} from '../../socialSecurity/piaFromEarnings.js'

/** Official SSA AWI dollars, two-decimal series as published. */
const AWI = {
  1978: 10556.03,
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
  1979: { first: 180, second: 1_085 },
  1980: { first: 194, second: 1_171 },
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
      disability: disabilityComputationFacts(1964, { onsetAge: 55 }),
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
    for (const disability of [null, disabilityComputationFacts(1964, { onsetAge: 62 })]) {
      const result = disabilityResult({ ...base, disability })
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
      disability: disabilityComputationFacts(1964, { onsetAge: 45 }),
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
      disability: disabilityComputationFacts(1964, { onsetAge: 23 }),
    })
    expect(result.computationYearCount).toBe(2)
    expect(result.aime).toBe(accepted)
    expect(result.aime).not.toBe(readings.oneComputationYear)
    expect(Math.round(result.piaMonthly * 100)).toBe(piaCentsFromAime(accepted, BEND_POINTS[1987]))
    expect(Math.round(result.piaMonthly * 100)).toBe(44_630)
  })
})

// Pre-July-1980 entitlement keeps the usual dropout (20 CFR 404.211(e)(3):
// "Where the worker is first entitled to disability insurance benefits (DIB)
// after June 1980, there is an exception to the usual 5 year dropout ...
// (For entitlement before July 1980, we use the usual dropout.)"). A worker
// born 1939-06-15 disabled from January 1979 (onsetAge 40, blank month read as
// January 1) is first entitled in June 1979. Year of eligibility 1979,
// indexing year 1977; elapsed years 1961 (age 22) through 1978, eighteen.
// Only 1978 has earnings, 10,000, after the indexing year so used nominally.
//   accepted, usual five-year dropout: 13 years, floor(10,000 / 156) = 64;
//   one-for-five dropout (floor(18 / 5) = 3): 15 years, floor(10,000 / 180) = 55;
//   old engine (onset ignored): eligibility 2001, 1999 index:
//     10,000 × 30,469.84 / 10,556.03 = 28,864.47, floor(28,864.47 / 420) = 68.
// PIA on the 1979 bend points (180, 1,085): 0.9 × 64 = 57.60 (55 would give 49.50).
// The boundary itself: the same worker disabled from 1980 (onsetAge 41) has 19
// elapsed years (1961-1979) and 1978's 10,000 at the 1978 index, factor 1.
// January (blank month) is first entitled in June 1980, the usual five:
// 14 years, floor(10,000 / 168) = 59; February is first entitled in August
// 1980, floor(19 / 5) = 3 dropped: 16 years, floor(10,000 / 192) = 52.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    usualDropoutBeforeJuly1980: aimeFromCents(1_000_000, 13),
    oneForFiveDropoutWhateverTheEntitlementMonth: aimeFromCents(1_000_000, 15),
    retirementEligibilityProxy: aimeFromCents(nearerPennyCents(10_000, AWI[1978], AWI[1999]), 35),
  },
  accepted: 'usualDropoutBeforeJuly1980',
  note: 'entitlement before July 1980',
}, ({ accepted, readings }) => {
  it('drops the usual five years for a 1979 onset and switches at the July 1980 entitlement month', () => {
    expect([accepted, readings.oneForFiveDropoutWhateverTheEntitlementMonth, readings.retirementEligibilityProxy])
      .toEqual([64, 55, 68])
    const born1939 = { dobYear: 1939, dobMonth: 6, dobDay: 15, earnings: [{ year: 1978, amount: 10_000 }], lastEarningsYear: 1978 }
    const onset1979 = disabilityResult({ ...born1939, disability: disabilityComputationFacts(1939, { onsetAge: 40 }) })
    expect([onset1979.eligibilityYear, onset1979.dropoutYearCount, onset1979.computationYearCount]).toEqual([1979, 5, 13])
    expect(onset1979.aime).toBe(accepted)
    expect(onset1979.aime).not.toBe(readings.oneForFiveDropoutWhateverTheEntitlementMonth)
    expect(Math.round(onset1979.piaMonthly * 100)).toBe(piaCentsFromAime(accepted, BEND_POINTS[1979]))
    expect(Math.round(onset1979.piaMonthly * 100)).toBe(5_760)

    const june1980 = disabilityResult({ ...born1939, disability: disabilityComputationFacts(1939, { onsetAge: 41 }) })
    const august1980 = disabilityResult({ ...born1939, disability: disabilityComputationFacts(1939, { onsetAge: 41, onsetMonth: 2 }) })
    expect([june1980.dropoutYearCount, june1980.aime]).toEqual([5, aimeFromCents(1_000_000, 14)])
    expect([august1980.dropoutYearCount, august1980.aime]).toEqual([3, aimeFromCents(1_000_000, 16)])
    expect([june1980.aime, august1980.aime]).toEqual([59, 52])
    expect(Math.round(august1980.piaMonthly * 100)).toBe(piaCentsFromAime(52, BEND_POINTS[1980]))
  })
})

// An onset before 1979 keeps the ordinary computation: the computation for a
// year of eligibility before 1979 is out of scope (the record's stated
// limit), and refusing it would leave the stream with no PIA at all. A worker
// born 1938-06-15 disabled from 1978 (onsetAge 40) is computed for 2000, the
// year of 62, with the 1998 index (28,861.44):
//   ordinary: 10,000 × 28,861.44 / 10,556.03 = 27,341.36, floor(27,341.36 / 420) = 65;
//   the refusal this replaces gave no AIME (eligibility_before_1979).
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    ordinaryComputationForPre1979Onset: aimeFromCents(nearerPennyCents(10_000, AWI[1978], AWI[1998]), 35),
    refusedAsEligibilityBefore1979: 'eligibility_before_1979',
  },
  accepted: 'ordinaryComputationForPre1979Onset',
  note: 'onset before 1979, out of scope',
}, ({ accepted, readings }) => {
  it('computes a pre-1979 onset as the ordinary age-62 computation rather than refusing it', () => {
    expect(accepted).toBe(65)
    const result = computePiaFromEarnings({
      dobYear: 1938, dobMonth: 6, dobDay: 15,
      earnings: [{ year: 1978, amount: 10_000 }],
      lastEarningsYear: 1978,
      disability: disabilityComputationFacts(1938, { onsetAge: 40 }),
    })
    if (isPiaFromEarningsError(result)) {
      expect(result.code).not.toBe(readings.refusedAsEligibilityBefore1979)
      throw new Error(`expected PIA result, received ${result.code}`)
    }
    expect([result.eligibilityYear, result.disabilityComputation, result.aime]).toEqual([2000, false, accepted])
  })
})

// Projected earnings before the onset count like reported ones. The window is
// the elapsed years, which end with the year before the onset (415(b)(2)(B)(iii);
// 20 CFR 404.211(e)(1)), and the projection fills window years after the last
// reported one; the plan's onset says the worker was not disabled before it.
// Same worker, onset 2019: reported AWI-level earnings 1986-2016 (31 years at
// the 2017 index, 50,321.89 each) and a projection of 60,000 through age 65,
// which fills 2017 (the indexing year, factor 1) and 2018 (nominal) and
// nothing from 2019 on. Top 28 of 33:
//   accepted: floor((2 × 60,000 + 26 × 50,321.89) / 336) = floor(4,251.10) = 4,251;
//   projection left out of the disability window (28 of the 31 reported):
//     floor(28 × 50,321.89 / 336) = floor(4,193.49) = 4,193.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    projectedYearsBeforeOnsetCount: aimeFromCents(2 * 6_000_000 + 26 * DISABILITY_INDEXED_2017_CENTS, 28),
    projectionIgnoredInDisabilityWindow: aimeFromCents(28 * DISABILITY_INDEXED_2017_CENTS, 28),
  },
  accepted: 'projectedYearsBeforeOnsetCount',
  note: 'projected earnings before the onset',
}, ({ accepted, readings }) => {
  it('fills 2017 and 2018 from the projection and stops at the onset year', () => {
    expect([accepted, readings.projectionIgnoredInDisabilityWindow]).toEqual([4_251, 4_193])
    const result = disabilityResult({
      ...DISABILITY_DOB,
      earnings: awiEarnings(DISABILITY_EARNINGS_YEARS.filter((year) => year <= 2016)),
      lastEarningsYear: 2016,
      projection: { assumedAnnualEarnings: 60_000, throughAge: 65 },
      disability: disabilityComputationFacts(1964, { onsetAge: 55 }),
    })
    expect(result.projectedYearCount).toBe(2)
    expect(result.indexedYears.filter((row) => row.projected).map((row) => row.year)).toEqual([2017, 2018])
    expect(result.aime).toBe(accepted)
    expect(result.aime).not.toBe(readings.projectionIgnoredInDisabilityWindow)
  })
})

// Characterization, not a statutory pin: a late-year onset. The plan reads
// onsetMonth 12 as an onset after December 1, so the waiting period begins in
// January 2020 and the first payable month is June 2020. The record leaves
// open whether the year of eligibility that prices the PIA is the onset year
// or the year the waiting period begins; the engine takes the onset year,
// 2019, so the result is the January-onset computation above (AIME 4,198 on
// the 2019 bend points), and only the first month of entitlement moves.
describe('usc-42-415-b-2-b-disability-freeze-aime-exclusion: December onset (characterization)', () => {
  it('keeps the onset year, 2019, as the year of eligibility for a December onset', () => {
    const facts = disabilityComputationFacts(1964, { onsetAge: 55, onsetMonth: 12 })
    expect(facts).toEqual({ onsetYear: 2019, firstEntitlementMonthIndex: 2020 * 12 + 5 })
    const result = disabilityResult({
      ...DISABILITY_DOB,
      earnings: awiEarnings(DISABILITY_EARNINGS_YEARS),
      lastEarningsYear: 2025,
      disability: facts,
    })
    expect([result.eligibilityYear, result.lastBaseYear, result.aime]).toEqual([2019, 2018, 4_198])
    expect(Math.round(result.piaMonthly * 100)).toBe(188_040)
  })
})
