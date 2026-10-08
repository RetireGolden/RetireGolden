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

// [stocksPct, bondsPct, inflationPct], one row per year from FIRST_HISTORICAL_YEAR.
// prettier-ignore
const HISTORICAL_YEAR_ROWS: readonly (readonly [number, number, number])[] = [
  [43.8, 0.8, -1.2],
  [-8.3, 4.2, 0.6],
  [-25.1, 4.5, -6.4],
  [-43.8, -2.6, -9.3],
  [-8.6, 8.8, -10.3],
  [50.0, 1.9, 0.8],
  [-1.2, 8.0, 1.5],
  [46.7, 4.5, 3.0],
  [31.9, 5.0, 1.4],
  [-35.3, 1.4, 2.9],
  [29.3, 4.2, -2.8],
  [-1.1, 4.4, 0.0],
  [-10.7, 5.4, 0.7],
  [-12.8, -2.0, 9.9],
  [19.2, 2.3, 9.0],
  [25.1, 2.5, 3.0],
  [19.0, 2.6, 2.3],
  [35.8, 3.8, 2.2],
  [-8.4, 3.1, 18.1],
  [5.2, 0.9, 8.8],
  [5.7, 2.0, 3.0],
  [18.3, 4.7, -2.1],
  [30.8, 0.4, 5.9],
  [23.7, -0.3, 6.0],
  [18.2, 2.3, 0.8],
  [-1.2, 4.1, 0.7],
  [52.6, 3.3, -0.7],
  [32.6, -1.3, 0.4],
  [7.4, -2.3, 3.0],
  [-10.5, 6.8, 2.9],
  [43.7, -2.1, 1.8],
  [12.1, -2.6, 1.7],
  [0.3, 11.6, 1.4],
  [26.6, 2.1, 0.7],
  [-8.8, 5.7, 1.3],
  [22.6, 1.7, 1.6],
  [16.4, 3.7, 1.0],
  [12.4, 0.7, 1.9],
  [-10.0, 2.9, 3.5],
  [23.8, -1.6, 3.0],
  [10.8, 3.3, 4.7],
  [-8.2, -5.0, 6.2],
  [3.6, 16.8, 5.6],
  [14.2, 9.8, 3.3],
  [18.8, 2.8, 3.4],
  [-14.3, 3.7, 8.7],
  [-25.9, 2.0, 12.3],
  [37.0, 3.6, 6.9],
  [23.8, 16.0, 4.9],
  [-7.0, 1.3, 6.7],
  [6.5, -0.8, 9.0],
  [18.5, 0.7, 13.3],
  [31.7, -3.0, 12.5],
  [-4.7, 8.2, 8.9],
  [20.4, 32.8, 3.8],
  [22.3, 3.2, 3.8],
  [6.1, 13.7, 3.9],
  [31.2, 25.7, 3.8],
  [18.5, 24.3, 1.1],
  [5.8, -5.0, 4.4],
  [16.5, 8.2, 4.4],
  [31.5, 17.7, 4.6],
  [-3.1, 6.2, 6.1],
  [30.2, 15.0, 3.1],
  [7.5, 9.4, 2.9],
  [10.0, 14.2, 2.7],
  [1.3, -8.0, 2.7],
  [37.2, 23.5, 2.5],
  [22.7, 1.4, 3.3],
  [33.1, 9.9, 1.7],
  [28.3, 14.9, 1.6],
  [20.9, -8.3, 2.7],
  [-9.0, 16.7, 3.4],
  [-11.9, 5.6, 1.6],
  [-22.0, 15.1, 2.4],
  [28.4, 0.4, 1.9],
  [10.7, 4.5, 3.3],
  [4.8, 2.9, 3.4],
  [15.6, 2.0, 2.5],
  [5.5, 10.2, 4.1],
  [-36.6, 20.1, 0.1],
  [25.9, -11.1, 2.7],
  [14.8, 8.5, 1.5],
  [2.1, 16.0, 3.0],
  [15.9, 3.0, 1.7],
  [32.2, -9.1, 1.5],
  [13.5, 10.7, 0.8],
  [1.4, 1.3, 0.7],
  [11.8, 0.7, 2.1],
  [21.6, 2.8, 2.1],
  [-4.2, 0.0, 1.9],
  [31.2, 9.6, 2.3],
  [18.0, 11.3, 1.4],
  [28.5, -4.4, 7.0],
  [-18.0, -17.8, 6.5],
  [26.1, 3.9, 3.4],
]

/** The first year of HISTORICAL_YEAR_ROWS; each later row is the next calendar year. */
const FIRST_HISTORICAL_YEAR = 1928

/**
 * One row per year, decoded once at load. Rows ship as [stocksPct, bondsPct,
 * inflationPct] from 1928 to keep the planner's bundles small; the decoded
 * objects are the same values, keys and order as the table they replaced
 * (historicalReturns.packed.test.ts pins them).
 */
export const HISTORICAL_YEARS: readonly HistoricalYear[] = HISTORICAL_YEAR_ROWS.map(
  ([stocksPct, bondsPct, inflationPct], index) => ({ year: FIRST_HISTORICAL_YEAR + index, stocksPct, bondsPct, inflationPct }),
)

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
