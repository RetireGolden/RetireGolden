/**
 * Pins the three approximated AIME earnings-history records: initial-computation
 * base window, annual indexed-earnings penny rounding, and computation-year
 * count with the five-year dropout and 1951 floor.
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
    engineAlways35: [5322, 460],
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
  produced: 'engineAlways35',
  note: 'modern 35-year vs 1951-floor 34-year',
}, ({ accepted, produced, readings }) => {
  it('uses 35 computation years even when elapsed years start at the 1951 floor', () => {
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
    expect([modern, historical]).toEqual(produced)
    expect([modern, historical]).not.toEqual(accepted)
    expect([modern, historical]).not.toEqual(readings.noFiveYearDropout)
    expect([modern, historical]).not.toEqual(readings.firstFiveCalendarYearsDropped)
  })
})
