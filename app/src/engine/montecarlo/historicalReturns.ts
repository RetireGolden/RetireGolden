/**
 * Annual US market history for the bootstrap return models (roadmap V4).
 *
 * Values are approximate (≈0.1–0.5pp), transcribed from the public Damodaran
 * (NYU Stern) "Historical Returns on Stocks, Bonds and Bills" dataset, which
 * itself derives from Shiller's annual series: S&P 500 total return, 10-year
 * Treasury total return, and calendar-year CPI inflation. Bootstrap sampling
 * cares about the joint distribution and sequencing of these series, not
 * basis-point precision. Refresh alongside the annual parameter-pack
 * workstream (see DOCS/maintenance-schedule.md, standing workstreams).
 *
 * Source: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html
 */

export interface HistoricalYear {
  year: number
  /** S&P 500 total return, percent. */
  stocksPct: number
  /** 10-year US Treasury total return, percent. */
  bondsPct: number
  /** CPI-U calendar-year inflation, percent. */
  inflationPct: number
}

// prettier-ignore
export const HISTORICAL_YEARS: readonly HistoricalYear[] = [
  { year: 1928, stocksPct: 43.8, bondsPct: 0.8, inflationPct: -1.2 },
  { year: 1929, stocksPct: -8.3, bondsPct: 4.2, inflationPct: 0.6 },
  { year: 1930, stocksPct: -25.1, bondsPct: 4.5, inflationPct: -6.4 },
  { year: 1931, stocksPct: -43.8, bondsPct: -2.6, inflationPct: -9.3 },
  { year: 1932, stocksPct: -8.6, bondsPct: 8.8, inflationPct: -10.3 },
  { year: 1933, stocksPct: 50.0, bondsPct: 1.9, inflationPct: 0.8 },
  { year: 1934, stocksPct: -1.2, bondsPct: 8.0, inflationPct: 1.5 },
  { year: 1935, stocksPct: 46.7, bondsPct: 4.5, inflationPct: 3.0 },
  { year: 1936, stocksPct: 31.9, bondsPct: 5.0, inflationPct: 1.4 },
  { year: 1937, stocksPct: -35.3, bondsPct: 1.4, inflationPct: 2.9 },
  { year: 1938, stocksPct: 29.3, bondsPct: 4.2, inflationPct: -2.8 },
  { year: 1939, stocksPct: -1.1, bondsPct: 4.4, inflationPct: 0.0 },
  { year: 1940, stocksPct: -10.7, bondsPct: 5.4, inflationPct: 0.7 },
  { year: 1941, stocksPct: -12.8, bondsPct: -2.0, inflationPct: 9.9 },
  { year: 1942, stocksPct: 19.2, bondsPct: 2.3, inflationPct: 9.0 },
  { year: 1943, stocksPct: 25.1, bondsPct: 2.5, inflationPct: 3.0 },
  { year: 1944, stocksPct: 19.0, bondsPct: 2.6, inflationPct: 2.3 },
  { year: 1945, stocksPct: 35.8, bondsPct: 3.8, inflationPct: 2.2 },
  { year: 1946, stocksPct: -8.4, bondsPct: 3.1, inflationPct: 18.1 },
  { year: 1947, stocksPct: 5.2, bondsPct: 0.9, inflationPct: 8.8 },
  { year: 1948, stocksPct: 5.7, bondsPct: 2.0, inflationPct: 3.0 },
  { year: 1949, stocksPct: 18.3, bondsPct: 4.7, inflationPct: -2.1 },
  { year: 1950, stocksPct: 30.8, bondsPct: 0.4, inflationPct: 5.9 },
  { year: 1951, stocksPct: 23.7, bondsPct: -0.3, inflationPct: 6.0 },
  { year: 1952, stocksPct: 18.2, bondsPct: 2.3, inflationPct: 0.8 },
  { year: 1953, stocksPct: -1.2, bondsPct: 4.1, inflationPct: 0.7 },
  { year: 1954, stocksPct: 52.6, bondsPct: 3.3, inflationPct: -0.7 },
  { year: 1955, stocksPct: 32.6, bondsPct: -1.3, inflationPct: 0.4 },
  { year: 1956, stocksPct: 7.4, bondsPct: -2.3, inflationPct: 3.0 },
  { year: 1957, stocksPct: -10.5, bondsPct: 6.8, inflationPct: 2.9 },
  { year: 1958, stocksPct: 43.7, bondsPct: -2.1, inflationPct: 1.8 },
  { year: 1959, stocksPct: 12.1, bondsPct: -2.6, inflationPct: 1.7 },
  { year: 1960, stocksPct: 0.3, bondsPct: 11.6, inflationPct: 1.4 },
  { year: 1961, stocksPct: 26.6, bondsPct: 2.1, inflationPct: 0.7 },
  { year: 1962, stocksPct: -8.8, bondsPct: 5.7, inflationPct: 1.3 },
  { year: 1963, stocksPct: 22.6, bondsPct: 1.7, inflationPct: 1.6 },
  { year: 1964, stocksPct: 16.4, bondsPct: 3.7, inflationPct: 1.0 },
  { year: 1965, stocksPct: 12.4, bondsPct: 0.7, inflationPct: 1.9 },
  { year: 1966, stocksPct: -10.0, bondsPct: 2.9, inflationPct: 3.5 },
  { year: 1967, stocksPct: 23.8, bondsPct: -1.6, inflationPct: 3.0 },
  { year: 1968, stocksPct: 10.8, bondsPct: 3.3, inflationPct: 4.7 },
  { year: 1969, stocksPct: -8.2, bondsPct: -5.0, inflationPct: 6.2 },
  { year: 1970, stocksPct: 3.6, bondsPct: 16.8, inflationPct: 5.6 },
  { year: 1971, stocksPct: 14.2, bondsPct: 9.8, inflationPct: 3.3 },
  { year: 1972, stocksPct: 18.8, bondsPct: 2.8, inflationPct: 3.4 },
  { year: 1973, stocksPct: -14.3, bondsPct: 3.7, inflationPct: 8.7 },
  { year: 1974, stocksPct: -25.9, bondsPct: 2.0, inflationPct: 12.3 },
  { year: 1975, stocksPct: 37.0, bondsPct: 3.6, inflationPct: 6.9 },
  { year: 1976, stocksPct: 23.8, bondsPct: 16.0, inflationPct: 4.9 },
  { year: 1977, stocksPct: -7.0, bondsPct: 1.3, inflationPct: 6.7 },
  { year: 1978, stocksPct: 6.5, bondsPct: -0.8, inflationPct: 9.0 },
  { year: 1979, stocksPct: 18.5, bondsPct: 0.7, inflationPct: 13.3 },
  { year: 1980, stocksPct: 31.7, bondsPct: -3.0, inflationPct: 12.5 },
  { year: 1981, stocksPct: -4.7, bondsPct: 8.2, inflationPct: 8.9 },
  { year: 1982, stocksPct: 20.4, bondsPct: 32.8, inflationPct: 3.8 },
  { year: 1983, stocksPct: 22.3, bondsPct: 3.2, inflationPct: 3.8 },
  { year: 1984, stocksPct: 6.1, bondsPct: 13.7, inflationPct: 3.9 },
  { year: 1985, stocksPct: 31.2, bondsPct: 25.7, inflationPct: 3.8 },
  { year: 1986, stocksPct: 18.5, bondsPct: 24.3, inflationPct: 1.1 },
  { year: 1987, stocksPct: 5.8, bondsPct: -5.0, inflationPct: 4.4 },
  { year: 1988, stocksPct: 16.5, bondsPct: 8.2, inflationPct: 4.4 },
  { year: 1989, stocksPct: 31.5, bondsPct: 17.7, inflationPct: 4.6 },
  { year: 1990, stocksPct: -3.1, bondsPct: 6.2, inflationPct: 6.1 },
  { year: 1991, stocksPct: 30.2, bondsPct: 15.0, inflationPct: 3.1 },
  { year: 1992, stocksPct: 7.5, bondsPct: 9.4, inflationPct: 2.9 },
  { year: 1993, stocksPct: 10.0, bondsPct: 14.2, inflationPct: 2.7 },
  { year: 1994, stocksPct: 1.3, bondsPct: -8.0, inflationPct: 2.7 },
  { year: 1995, stocksPct: 37.2, bondsPct: 23.5, inflationPct: 2.5 },
  { year: 1996, stocksPct: 22.7, bondsPct: 1.4, inflationPct: 3.3 },
  { year: 1997, stocksPct: 33.1, bondsPct: 9.9, inflationPct: 1.7 },
  { year: 1998, stocksPct: 28.3, bondsPct: 14.9, inflationPct: 1.6 },
  { year: 1999, stocksPct: 20.9, bondsPct: -8.3, inflationPct: 2.7 },
  { year: 2000, stocksPct: -9.0, bondsPct: 16.7, inflationPct: 3.4 },
  { year: 2001, stocksPct: -11.9, bondsPct: 5.6, inflationPct: 1.6 },
  { year: 2002, stocksPct: -22.0, bondsPct: 15.1, inflationPct: 2.4 },
  { year: 2003, stocksPct: 28.4, bondsPct: 0.4, inflationPct: 1.9 },
  { year: 2004, stocksPct: 10.7, bondsPct: 4.5, inflationPct: 3.3 },
  { year: 2005, stocksPct: 4.8, bondsPct: 2.9, inflationPct: 3.4 },
  { year: 2006, stocksPct: 15.6, bondsPct: 2.0, inflationPct: 2.5 },
  { year: 2007, stocksPct: 5.5, bondsPct: 10.2, inflationPct: 4.1 },
  { year: 2008, stocksPct: -36.6, bondsPct: 20.1, inflationPct: 0.1 },
  { year: 2009, stocksPct: 25.9, bondsPct: -11.1, inflationPct: 2.7 },
  { year: 2010, stocksPct: 14.8, bondsPct: 8.5, inflationPct: 1.5 },
  { year: 2011, stocksPct: 2.1, bondsPct: 16.0, inflationPct: 3.0 },
  { year: 2012, stocksPct: 15.9, bondsPct: 3.0, inflationPct: 1.7 },
  { year: 2013, stocksPct: 32.2, bondsPct: -9.1, inflationPct: 1.5 },
  { year: 2014, stocksPct: 13.5, bondsPct: 10.7, inflationPct: 0.8 },
  { year: 2015, stocksPct: 1.4, bondsPct: 1.3, inflationPct: 0.7 },
  { year: 2016, stocksPct: 11.8, bondsPct: 0.7, inflationPct: 2.1 },
  { year: 2017, stocksPct: 21.6, bondsPct: 2.8, inflationPct: 2.1 },
  { year: 2018, stocksPct: -4.2, bondsPct: 0.0, inflationPct: 1.9 },
  { year: 2019, stocksPct: 31.2, bondsPct: 9.6, inflationPct: 2.3 },
  { year: 2020, stocksPct: 18.0, bondsPct: 11.3, inflationPct: 1.4 },
  { year: 2021, stocksPct: 28.5, bondsPct: -4.4, inflationPct: 7.0 },
  { year: 2022, stocksPct: -18.0, bondsPct: -17.8, inflationPct: 6.5 },
  { year: 2023, stocksPct: 26.1, bondsPct: 3.9, inflationPct: 3.4 },
]

/** Blended nominal portfolio return for one historical year. */
export function portfolioReturnPct(year: HistoricalYear, equityWeightPct: number): number {
  const w = equityWeightPct / 100
  return year.stocksPct * w + year.bondsPct * (1 - w)
}

/** Mean blended return across the dataset (centers bootstrap shocks at zero). */
export function meanPortfolioReturnPct(equityWeightPct: number): number {
  let sum = 0
  for (const y of HISTORICAL_YEARS) sum += portfolioReturnPct(y, equityWeightPct)
  return sum / HISTORICAL_YEARS.length
}
