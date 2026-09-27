import { describe, expect, it } from 'vitest'

import {
  COLA_PCT_BY_YEAR,
  FIRST_WAGE_BASE_YEAR,
  LATEST_PUBLISHED_COLA_YEAR,
  LATEST_PUBLISHED_WAGE_BASE_YEAR,
  WAGE_BASE_BY_YEAR,
  wageBaseForYearOrLatest,
} from './ssaWageData.js'

// Every row of the two SSA series the engine carries, transcribed from the
// pages as read on 2026-09-27: the contribution and benefit base
// (ssa.gov/oact/cola/cbb.html, 1937-2026) and the cost-of-living adjustments
// (ssa.gov/oact/cola/colaseries.html, 1975-2025, by the year of the December
// increase; 1999 is the corrected 2.5 of P.L. 106-554). A changed, missing or
// extra row fails here. Adding a year's row (the 2026 COLA, announced in
// October 2026, or the 2027 base) means adding it here from the same page.

/** [first year, last year, base] for each run of years with one base. */
const SSA_CONTRIBUTION_AND_BENEFIT_BASE: readonly (readonly [number, number, number])[] = [
  [1937, 1950, 3_000],
  [1951, 1954, 3_600],
  [1955, 1958, 4_200],
  [1959, 1965, 4_800],
  [1966, 1967, 6_600],
  [1968, 1971, 7_800],
  [1972, 1972, 9_000],
  [1973, 1973, 10_800],
  [1974, 1974, 13_200],
  [1975, 1975, 14_100],
  [1976, 1976, 15_300],
  [1977, 1977, 16_500],
  [1978, 1978, 17_700],
  [1979, 1979, 22_900],
  [1980, 1980, 25_900],
  [1981, 1981, 29_700],
  [1982, 1982, 32_400],
  [1983, 1983, 35_700],
  [1984, 1984, 37_800],
  [1985, 1985, 39_600],
  [1986, 1986, 42_000],
  [1987, 1987, 43_800],
  [1988, 1988, 45_000],
  [1989, 1989, 48_000],
  [1990, 1990, 51_300],
  [1991, 1991, 53_400],
  [1992, 1992, 55_500],
  [1993, 1993, 57_600],
  [1994, 1994, 60_600],
  [1995, 1995, 61_200],
  [1996, 1996, 62_700],
  [1997, 1997, 65_400],
  [1998, 1998, 68_400],
  [1999, 1999, 72_600],
  [2000, 2000, 76_200],
  [2001, 2001, 80_400],
  [2002, 2002, 84_900],
  [2003, 2003, 87_000],
  [2004, 2004, 87_900],
  [2005, 2005, 90_000],
  [2006, 2006, 94_200],
  [2007, 2007, 97_500],
  [2008, 2008, 102_000],
  [2009, 2011, 106_800],
  [2012, 2012, 110_100],
  [2013, 2013, 113_700],
  [2014, 2014, 117_000],
  [2015, 2016, 118_500],
  [2017, 2017, 127_200],
  [2018, 2018, 128_400],
  [2019, 2019, 132_900],
  [2020, 2020, 137_700],
  [2021, 2021, 142_800],
  [2022, 2022, 147_000],
  [2023, 2023, 160_200],
  [2024, 2024, 168_600],
  [2025, 2025, 176_100],
  [2026, 2026, 184_500],
]

const SSA_COLA_PCT: Readonly<Record<number, number>> = {
  1975: 8, 1976: 6.4, 1977: 5.9, 1978: 6.5, 1979: 9.9, 1980: 14.3,
  1981: 11.2, 1982: 7.4, 1983: 3.5, 1984: 3.5, 1985: 3.1, 1986: 1.3,
  1987: 4.2, 1988: 4, 1989: 4.7, 1990: 5.4, 1991: 3.7, 1992: 3,
  1993: 2.6, 1994: 2.8, 1995: 2.6, 1996: 2.9, 1997: 2.1, 1998: 1.3,
  1999: 2.5, 2000: 3.5, 2001: 2.6, 2002: 1.4, 2003: 2.1, 2004: 2.7,
  2005: 4.1, 2006: 3.3, 2007: 2.3, 2008: 5.8, 2009: 0, 2010: 0,
  2011: 3.6, 2012: 1.7, 2013: 1.5, 2014: 1.7, 2015: 0, 2016: 0.3,
  2017: 2, 2018: 2.8, 2019: 1.6, 2020: 1.3, 2021: 5.9, 2022: 8.7,
  2023: 3.2, 2024: 2.5, 2025: 2.8,
}

function expandedBases(): Record<number, number> {
  const out: Record<number, number> = {}
  for (const [first, last, base] of SSA_CONTRIBUTION_AND_BENEFIT_BASE) {
    for (let year = first; year <= last; year++) out[year] = base
  }
  return out
}

describe('SSA data tables', () => {
  it('carries every contribution and benefit base from 1937 through 2026, and no other year', () => {
    expect({ ...WAGE_BASE_BY_YEAR }).toEqual(expandedBases())
    expect(Object.keys(WAGE_BASE_BY_YEAR)).toHaveLength(90)
    expect(LATEST_PUBLISHED_WAGE_BASE_YEAR).toBe(2026)
  })

  it('carries every cost-of-living adjustment from 1975 through 2025, and no other year', () => {
    expect({ ...COLA_PCT_BY_YEAR }).toEqual(SSA_COLA_PCT)
    expect(Object.keys(COLA_PCT_BY_YEAR)).toHaveLength(51)
    expect(LATEST_PUBLISHED_COLA_YEAR).toBe(2025)
  })

  it('reads the $3,000 base for 1937-1950 and no base before 1937', () => {
    expect(FIRST_WAGE_BASE_YEAR).toBe(1937)
    expect(wageBaseForYearOrLatest(1936)).toBe(0)
    expect(wageBaseForYearOrLatest(1900)).toBe(0)
    for (let year = 1937; year <= 1950; year++) expect(wageBaseForYearOrLatest(year), String(year)).toBe(3_000)
    expect(wageBaseForYearOrLatest(1951)).toBe(3_600)
  })

  it('reads the latest base for a year SSA has not published', () => {
    expect(wageBaseForYearOrLatest(2027)).toBe(WAGE_BASE_BY_YEAR[2026])
    expect(wageBaseForYearOrLatest(2040)).toBe(WAGE_BASE_BY_YEAR[2026])
  })
})
