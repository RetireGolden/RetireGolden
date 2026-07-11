/**
 * Official SSA series for wage indexing, bend points, family maximum bend
 * points, and taxable maximum.
 * @see https://www.ssa.gov/oact/COLA/awiseries.html
 * @see https://www.ssa.gov/oact/COLA/bendpoints.html
 * @see https://www.ssa.gov/oact/COLA/cbb.html
 */

/** National average wage index (AWI), dollars. */
export const AWI_BY_YEAR: Readonly<Record<number, number>> = {
  1951: 2799.16,
  1952: 2973.32,
  1953: 3139.44,
  1954: 3155.64,
  1955: 3301.44,
  1956: 3532.36,
  1957: 3641.72,
  1958: 3673.8,
  1959: 3855.8,
  1960: 4007.12,
  1961: 4086.76,
  1962: 4291.4,
  1963: 4396.64,
  1964: 4576.32,
  1965: 4658.72,
  1966: 4938.36,
  1967: 5213.44,
  1968: 5571.76,
  1969: 5893.76,
  1970: 6186.24,
  1971: 6497.08,
  1972: 7133.8,
  1973: 7580.16,
  1974: 8030.76,
  1975: 8630.92,
  1976: 9226.48,
  1977: 9779.44,
  1978: 10556.03,
  1979: 11479.46,
  1980: 12513.46,
  1981: 13773.1,
  1982: 14531.34,
  1983: 15239.24,
  1984: 16135.07,
  1985: 16822.51,
  1986: 17321.82,
  1987: 18426.51,
  1988: 19334.04,
  1989: 20099.55,
  1990: 21027.98,
  1991: 21811.6,
  1992: 22935.42,
  1993: 23132.67,
  1994: 23753.53,
  1995: 24705.66,
  1996: 25913.9,
  1997: 27426.0,
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
  2018: 52145.8,
  2019: 54099.99,
  2020: 55628.6,
  2021: 60575.07,
  2022: 63795.13,
  2023: 66621.8,
  2024: 69846.57,
} as const

/** PIA formula bend points by year of eligibility (attain age 62 / disability / death). */
export const PIA_BEND_POINTS: Readonly<Record<number, { first: number; second: number }>> = {
  1979: { first: 180, second: 1085 },
  1980: { first: 194, second: 1171 },
  1981: { first: 211, second: 1274 },
  1982: { first: 230, second: 1388 },
  1983: { first: 254, second: 1528 },
  1984: { first: 267, second: 1612 },
  1985: { first: 280, second: 1691 },
  1986: { first: 297, second: 1790 },
  1987: { first: 310, second: 1866 },
  1988: { first: 319, second: 1922 },
  1989: { first: 339, second: 2044 },
  1990: { first: 356, second: 2145 },
  1991: { first: 370, second: 2230 },
  1992: { first: 387, second: 2333 },
  1993: { first: 401, second: 2420 },
  1994: { first: 422, second: 2545 },
  1995: { first: 426, second: 2567 },
  1996: { first: 437, second: 2635 },
  1997: { first: 455, second: 2741 },
  1998: { first: 477, second: 2875 },
  1999: { first: 505, second: 3043 },
  2000: { first: 531, second: 3202 },
  2001: { first: 561, second: 3381 },
  2002: { first: 592, second: 3567 },
  2003: { first: 606, second: 3653 },
  2004: { first: 612, second: 3689 },
  2005: { first: 627, second: 3779 },
  2006: { first: 656, second: 3955 },
  2007: { first: 680, second: 4100 },
  2008: { first: 711, second: 4288 },
  2009: { first: 744, second: 4483 },
  2010: { first: 761, second: 4586 },
  2011: { first: 749, second: 4517 },
  2012: { first: 767, second: 4624 },
  2013: { first: 791, second: 4768 },
  2014: { first: 816, second: 4917 },
  2015: { first: 826, second: 4980 },
  2016: { first: 856, second: 5157 },
  2017: { first: 885, second: 5336 },
  2018: { first: 895, second: 5397 },
  2019: { first: 926, second: 5583 },
  2020: { first: 960, second: 5785 },
  2021: { first: 996, second: 6002 },
  2022: { first: 1024, second: 6172 },
  2023: { first: 1115, second: 6721 },
  2024: { first: 1174, second: 7078 },
  2025: { first: 1226, second: 7391 },
  2026: { first: 1286, second: 7749 },
} as const

/** Retirement/survivor family-maximum formula bend points by year of eligibility. */
export const FAMILY_MAXIMUM_BEND_POINTS: Readonly<Record<number, { first: number; second: number; third: number }>> = {
  1979: { first: 230, second: 332, third: 433 },
  1980: { first: 248, second: 358, third: 467 },
  1981: { first: 270, second: 390, third: 508 },
  1982: { first: 294, second: 425, third: 554 },
  1983: { first: 324, second: 468, third: 610 },
  1984: { first: 342, second: 493, third: 643 },
  1985: { first: 358, second: 517, third: 675 },
  1986: { first: 379, second: 548, third: 714 },
  1987: { first: 396, second: 571, third: 745 },
  1988: { first: 407, second: 588, third: 767 },
  1989: { first: 433, second: 626, third: 816 },
  1990: { first: 455, second: 656, third: 856 },
  1991: { first: 473, second: 682, third: 890 },
  1992: { first: 495, second: 714, third: 931 },
  1993: { first: 513, second: 740, third: 966 },
  1994: { first: 539, second: 779, third: 1016 },
  1995: { first: 544, second: 785, third: 1024 },
  1996: { first: 559, second: 806, third: 1052 },
  1997: { first: 581, second: 839, third: 1094 },
  1998: { first: 609, second: 880, third: 1147 },
  1999: { first: 645, second: 931, third: 1214 },
  2000: { first: 679, second: 980, third: 1278 },
  2001: { first: 717, second: 1034, third: 1349 },
  2002: { first: 756, second: 1092, third: 1424 },
  2003: { first: 774, second: 1118, third: 1458 },
  2004: { first: 782, second: 1129, third: 1472 },
  2005: { first: 801, second: 1156, third: 1508 },
  2006: { first: 838, second: 1210, third: 1578 },
  2007: { first: 869, second: 1255, third: 1636 },
  2008: { first: 909, second: 1312, third: 1711 },
  2009: { first: 950, second: 1372, third: 1789 },
  2010: { first: 972, second: 1403, third: 1830 },
  2011: { first: 957, second: 1382, third: 1803 },
  2012: { first: 980, second: 1415, third: 1845 },
  2013: { first: 1011, second: 1459, third: 1903 },
  2014: { first: 1042, second: 1505, third: 1962 },
  2015: { first: 1056, second: 1524, third: 1987 },
  2016: { first: 1093, second: 1578, third: 2058 },
  2017: { first: 1131, second: 1633, third: 2130 },
  2018: { first: 1144, second: 1651, third: 2154 },
  2019: { first: 1184, second: 1708, third: 2228 },
  2020: { first: 1226, second: 1770, third: 2309 },
  2021: { first: 1272, second: 1837, third: 2395 },
  2022: { first: 1308, second: 1889, third: 2463 },
  2023: { first: 1425, second: 2056, third: 2682 },
  2024: { first: 1500, second: 2166, third: 2825 },
  2025: { first: 1567, second: 2262, third: 2950 },
  2026: { first: 1643, second: 2371, third: 3093 },
} as const

/** OASDI contribution & benefit base (taxable maximum), dollars. */
export const WAGE_BASE_BY_YEAR: Readonly<Record<number, number>> = {
  1979: 22900,
  1980: 25900,
  1981: 29700,
  1982: 32400,
  1983: 35700,
  1984: 37800,
  1985: 39600,
  1986: 42000,
  1987: 43800,
  1988: 45000,
  1989: 48000,
  1990: 51300,
  1991: 53400,
  1992: 55500,
  1993: 57600,
  1994: 60600,
  1995: 61200,
  1996: 62700,
  1997: 65400,
  1998: 68400,
  1999: 72600,
  2000: 76200,
  2001: 80400,
  2002: 84900,
  2003: 87000,
  2004: 87900,
  2005: 90000,
  2006: 94200,
  2007: 97500,
  2008: 102000,
  2009: 106800,
  2010: 106800,
  2011: 106800,
  2012: 110100,
  2013: 113700,
  2014: 117000,
  2015: 118500,
  2016: 118500,
  2017: 127200,
  2018: 128400,
  2019: 132900,
  2020: 137700,
  2021: 142800,
  2022: 147000,
  2023: 160200,
  2024: 168600,
  2025: 176100,
  2026: 184500,
} as const

function maxTableYear<T extends Record<number, unknown>>(table: T): number {
  let m = -Infinity
  for (const k of Object.keys(table)) {
    const y = Number(k)
    if (Number.isFinite(y) && y > m) m = y
  }
  return m
}

/** Latest calendar year for which `AWI_BY_YEAR` has an official value. */
export const LATEST_PUBLISHED_AWI_YEAR = maxTableYear(AWI_BY_YEAR)

/** Latest eligibility year for which `PIA_BEND_POINTS` has an official pair. */
export const LATEST_PIA_BEND_POINT_ELIGIBILITY_YEAR = maxTableYear(PIA_BEND_POINTS)

/** Latest eligibility year for which `FAMILY_MAXIMUM_BEND_POINTS` has an official triplet. */
export const LATEST_FAMILY_MAXIMUM_BEND_POINT_ELIGIBILITY_YEAR = maxTableYear(FAMILY_MAXIMUM_BEND_POINTS)

/** Latest calendar year for which `WAGE_BASE_BY_YEAR` has an official taxable maximum. */
export const LATEST_PUBLISHED_WAGE_BASE_YEAR = maxTableYear(WAGE_BASE_BY_YEAR)

export function awiForYear(year: number): number | undefined {
  return AWI_BY_YEAR[year]
}

/**
 * Published AWI, or the latest on file when the year is not yet released (illustrative only).
 */
export function awiForYearOrLatest(year: number): number {
  const v = AWI_BY_YEAR[year]
  if (v !== undefined && v > 0) return v
  return AWI_BY_YEAR[LATEST_PUBLISHED_AWI_YEAR]!
}

export function bendPointsForEligibilityYear(year: number): { first: number; second: number } | undefined {
  return PIA_BEND_POINTS[year]
}

/**
 * Official bend points for that eligibility year, or the latest on file when SSA has not yet
 * published figures (illustrative only).
 */
export function bendPointsForEligibilityYearOrLatest(eligibilityYear: number): {
  first: number
  second: number
} {
  const direct = PIA_BEND_POINTS[eligibilityYear]
  if (direct) return direct
  return PIA_BEND_POINTS[LATEST_PIA_BEND_POINT_ELIGIBILITY_YEAR]!
}

export function familyMaximumBendPointsForEligibilityYear(
  year: number,
): { first: number; second: number; third: number } | undefined {
  return FAMILY_MAXIMUM_BEND_POINTS[year]
}

/**
 * Official family-maximum bend points for that eligibility year, or the latest
 * on file when SSA has not yet published figures (illustrative only).
 */
export function familyMaximumBendPointsForEligibilityYearOrLatest(eligibilityYear: number): {
  first: number
  second: number
  third: number
} {
  const direct = FAMILY_MAXIMUM_BEND_POINTS[eligibilityYear]
  if (direct) return direct
  return FAMILY_MAXIMUM_BEND_POINTS[LATEST_FAMILY_MAXIMUM_BEND_POINT_ELIGIBILITY_YEAR]!
}

export function wageBaseForYear(year: number): number | undefined {
  return WAGE_BASE_BY_YEAR[year]
}

/**
 * Social Security taxable maximum (wage base) for a year, or the latest on file
 * when SSA has not yet published it (illustrative only). Used to cap projected
 * future earnings so they cannot exceed the taxable maximum.
 */
export function wageBaseForYearOrLatest(year: number): number {
  const v = WAGE_BASE_BY_YEAR[year]
  if (v !== undefined && v > 0) return v
  return WAGE_BASE_BY_YEAR[LATEST_PUBLISHED_WAGE_BASE_YEAR]!
}
