import type { LifeTableEdition, Sex } from './types.js'

/**
 * SSA's period life table, Table 4C6 of the Office of the Chief Actuary, as the
 * engine carries it: the death probability q(x) and the life expectancy e(x) at
 * each exact age x from 0 to 119, for men and for women, as printed.
 *
 * The file name carries no edition: a yearly refresh replaces the columns and
 * the source record below, not the import path. The literal types of the
 * source record make the provenance part of the type, so a refresh that
 * forgets a field does not compile. The number-of-lives columns SSA also
 * prints are not carried: nothing reads them.
 *
 * Readers: montecarlo/deathProbability.ts#annualMortality reads q (the engine's one
 * death probability, record mortality-published-death-probability), and
 * #baselineRemainingYears reads e (the longevity questionnaire's baseline).
 * Record ssa-period-life-table; its worksheet transcribes every row, and
 * ssaPeriodLifeTable.evidence.test.ts compares the columns with it cell by
 * cell and rebuilds `columnsSha256` from the numbers.
 */

export interface PeriodLifeTableColumns {
  /** SSA's "Probability of dying within one year" at exact age x, index x = 0..119, as printed (six decimals). */
  readonly q: readonly number[]
  /** SSA's period life expectancy at exact age x, index x = 0..119, as printed (two decimals). */
  readonly e: readonly number[]
}

export interface PeriodLifeTableSource {
  readonly publisher: 'Social Security Administration, Office of the Chief Actuary'
  readonly table: 'Actuarial Life Table (Table 4C6)'
  readonly caption: 'Period Life Table, 2023, as used in the 2026 Trustees Report'
  readonly periodYear: 2023
  readonly trusteesReportYear: 2026
  readonly url: 'https://www.ssa.gov/oact/STATS/table4c6.html'
  /** The day the columns were read from the live page. */
  readonly readOn: '2026-09-27'
  /** ssa.gov refuses non-browser clients; the page was read in a browser, cell by cell. */
  readonly readHow: 'browser, table cells'
  /**
   * An Internet Archive capture of the same page, from which anyone can re-read
   * the table and rebuild `columnsSha256` (`…/20260922113934id_/…` serves the
   * capture's own bytes, without the archive's banner). No hash of the capture
   * file is carried: the page as the archive renders it carries a per-fetch
   * footer, so a hash of it cannot be recomputed, and a hash of the raw bytes
   * would say nothing about the numbers that `columnsSha256` does not.
   */
  readonly archive: {
    readonly url: 'https://web.archive.org/web/20260922113934/https://www.ssa.gov/oact/STATS/table4c6.html'
    readonly capturedAt: '2026-09-22T11:39:34Z'
  }
  /**
   * SHA-256 of the canonical five-column text, the table's one hash: the line `age,qM,eM,qF,eF`, then
   * one line per age x = 0..119 with x, the male q to six decimals, the male e
   * to two, the female q to six and the female e to two, comma-separated, every
   * line newline-terminated. Rebuildable from the arrays with toFixed(6) and
   * toFixed(2), which give back the printed strings.
   */
  readonly columnsSha256: '32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c'
  readonly rows: 120
}

export interface PeriodLifeTable {
  readonly source: PeriodLifeTableSource
  readonly male: PeriodLifeTableColumns
  readonly female: PeriodLifeTableColumns
}

/** The 2023 period table, as used in the 2026 Trustees Report. */
export const SSA_PERIOD_LIFE_TABLE: PeriodLifeTable = {
  source: {
    publisher: 'Social Security Administration, Office of the Chief Actuary',
    table: 'Actuarial Life Table (Table 4C6)',
    caption: 'Period Life Table, 2023, as used in the 2026 Trustees Report',
    periodYear: 2023,
    trusteesReportYear: 2026,
    url: 'https://www.ssa.gov/oact/STATS/table4c6.html',
    readOn: '2026-09-27',
    readHow: 'browser, table cells',
    archive: {
      url: 'https://web.archive.org/web/20260922113934/https://www.ssa.gov/oact/STATS/table4c6.html',
      capturedAt: '2026-09-22T11:39:34Z',
    },
    columnsSha256: '32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c',
    rows: 120,
  },
  male: {
    q: [
      /* 0 */ 0.006015, 0.000479, 0.000320, 0.000249, 0.000194, 0.000159, 0.000137, 0.000125, 0.000120, 0.000120,
      /* 10 */ 0.000125, 0.000140, 0.000173, 0.000233, 0.000327, 0.000463, 0.000634, 0.000819, 0.000999, 0.001138,
      /* 20 */ 0.001235, 0.001315, 0.001378, 0.001439, 0.001509, 0.001595, 0.001685, 0.001783, 0.001876, 0.001970,
      /* 30 */ 0.002085, 0.002202, 0.002308, 0.002407, 0.002490, 0.002577, 0.002665, 0.002764, 0.002864, 0.002987,
      /* 40 */ 0.003115, 0.003253, 0.003419, 0.003600, 0.003777, 0.003931, 0.004073, 0.004245, 0.004477, 0.004795,
      /* 50 */ 0.005126, 0.005496, 0.005917, 0.006404, 0.006923, 0.007491, 0.008173, 0.008938, 0.009714, 0.010494,
      /* 60 */ 0.011337, 0.012232, 0.013196, 0.014229, 0.015316, 0.016455, 0.017574, 0.018735, 0.019981, 0.021366,
      /* 70 */ 0.022903, 0.024615, 0.026504, 0.028648, 0.031071, 0.033802, 0.037010, 0.041158, 0.045461, 0.050346,
      /* 80 */ 0.055633, 0.061757, 0.068358, 0.075420, 0.083364, 0.092680, 0.103459, 0.115502, 0.129018, 0.143810,
      /* 90 */ 0.159458, 0.176551, 0.195360, 0.216286, 0.238799, 0.262268, 0.286291, 0.310944, 0.332325, 0.349036,
      /* 100 */ 0.366568, 0.384960, 0.404252, 0.424488, 0.445712, 0.467998, 0.491398, 0.515968, 0.541766, 0.568854,
      /* 110 */ 0.597297, 0.627162, 0.658520, 0.691446, 0.726018, 0.762319, 0.800435, 0.840457, 0.882480, 0.926604,
    ],
    e: [
      /* 0 */ 75.79, 75.25, 74.28, 73.31, 72.33, 71.34, 70.35, 69.36, 68.37, 67.38,
      /* 10 */ 66.39, 65.39, 64.40, 63.41, 62.43, 61.45, 60.48, 59.51, 58.56, 57.62,
      /* 20 */ 56.69, 55.76, 54.83, 53.90, 52.98, 52.06, 51.14, 50.23, 49.32, 48.41,
      /* 30 */ 47.50, 46.60, 45.70, 44.81, 43.91, 43.02, 42.13, 41.24, 40.36, 39.47,
      /* 40 */ 38.59, 37.71, 36.83, 35.95, 35.08, 34.21, 33.34, 32.48, 31.62, 30.76,
      /* 50 */ 29.90, 29.05, 28.21, 27.38, 26.55, 25.73, 24.92, 24.12, 23.34, 22.56,
      /* 60 */ 21.79, 21.04, 20.29, 19.56, 18.83, 18.12, 17.41, 16.71, 16.02, 15.34,
      /* 70 */ 14.66, 14.00, 13.34, 12.69, 12.05, 11.42, 10.80, 10.19, 9.61, 9.04,
      /* 80 */ 8.50, 7.97, 7.46, 6.97, 6.50, 6.04, 5.61, 5.20, 4.81, 4.45,
      /* 90 */ 4.11, 3.80, 3.50, 3.23, 2.99, 2.77, 2.58, 2.41, 2.27, 2.15,
      /* 100 */ 2.04, 1.93, 1.83, 1.72, 1.63, 1.54, 1.45, 1.36, 1.28, 1.20,
      /* 110 */ 1.13, 1.05, 0.98, 0.92, 0.85, 0.79, 0.74, 0.68, 0.63, 0.58,
    ],
  },
  female: {
    q: [
      /* 0 */ 0.005125, 0.000392, 0.000229, 0.000188, 0.000155, 0.000133, 0.000115, 0.000105, 0.000100, 0.000098,
      /* 10 */ 0.000101, 0.000111, 0.000126, 0.000152, 0.000188, 0.000229, 0.000273, 0.000323, 0.000372, 0.000410,
      /* 20 */ 0.000441, 0.000476, 0.000513, 0.000546, 0.000582, 0.000609, 0.000641, 0.000683, 0.000740, 0.000808,
      /* 30 */ 0.000878, 0.000947, 0.001018, 0.001089, 0.001154, 0.001209, 0.001263, 0.001347, 0.001438, 0.001533,
      /* 40 */ 0.001643, 0.001742, 0.001845, 0.001954, 0.002075, 0.002187, 0.002306, 0.002438, 0.002595, 0.002791,
      /* 50 */ 0.003030, 0.003288, 0.003554, 0.003847, 0.004172, 0.004532, 0.004923, 0.005365, 0.005815, 0.006333,
      /* 60 */ 0.006923, 0.007555, 0.008220, 0.008881, 0.009514, 0.010188, 0.010880, 0.011659, 0.012543, 0.013581,
      /* 70 */ 0.014769, 0.016153, 0.017705, 0.019495, 0.021533, 0.023846, 0.026458, 0.029700, 0.033135, 0.036982,
      /* 80 */ 0.041183, 0.045959, 0.051282, 0.057262, 0.064107, 0.071752, 0.080490, 0.090566, 0.102204, 0.115178,
      /* 90 */ 0.129176, 0.144229, 0.160353, 0.177635, 0.196502, 0.216846, 0.238750, 0.261359, 0.283899, 0.306491,
      /* 100 */ 0.329680, 0.353333, 0.377300, 0.401416, 0.425501, 0.451031, 0.478092, 0.506778, 0.537185, 0.568854,
      /* 110 */ 0.597297, 0.627162, 0.658520, 0.691446, 0.726018, 0.762319, 0.800435, 0.840457, 0.882480, 0.926604,
    ],
    e: [
      /* 0 */ 81.06, 80.48, 79.51, 78.53, 77.54, 76.55, 75.56, 74.57, 73.58, 72.59,
      /* 10 */ 71.59, 70.60, 69.61, 68.62, 67.63, 66.64, 65.66, 64.67, 63.69, 62.72,
      /* 20 */ 61.74, 60.77, 59.80, 58.83, 57.86, 56.90, 55.93, 54.97, 54.00, 53.04,
      /* 30 */ 52.08, 51.13, 50.18, 49.23, 48.28, 47.34, 46.39, 45.45, 44.51, 43.58,
      /* 40 */ 42.64, 41.71, 40.78, 39.86, 38.93, 38.01, 37.10, 36.18, 35.27, 34.36,
      /* 50 */ 33.45, 32.55, 31.66, 30.77, 29.89, 29.01, 28.14, 27.28, 26.42, 25.57,
      /* 60 */ 24.73, 23.90, 23.08, 22.27, 21.46, 20.66, 19.87, 19.08, 18.30, 17.53,
      /* 70 */ 16.76, 16.01, 15.26, 14.53, 13.81, 13.10, 12.41, 11.73, 11.08, 10.44,
      /* 80 */ 9.82, 9.22, 8.64, 8.08, 7.54, 7.02, 6.53, 6.05, 5.61, 5.19,
      /* 90 */ 4.80, 4.44, 4.10, 3.79, 3.50, 3.23, 2.99, 2.77, 2.57, 2.39,
      /* 100 */ 2.23, 2.08, 1.94, 1.82, 1.70, 1.59, 1.48, 1.38, 1.29, 1.20,
      /* 110 */ 1.13, 1.05, 0.98, 0.92, 0.85, 0.79, 0.74, 0.68, 0.63, 0.58,
    ],
  },
}

/**
 * The table's last row. The engine closes the table there: a life at 119 dies
 * during that year, although SSA prints q(119) = 0.926604 (record
 * mortality-published-death-probability). The Monte Carlo horizon and the
 * expected-value loops stop at it.
 */
export const LAST_TABLE_AGE = 119

/** The edition the engine carries, as a stored pick or saved questionnaire result records it. */
export const CURRENT_LIFE_TABLE_EDITION: LifeTableEdition = Object.freeze({
  periodYear: SSA_PERIOD_LIFE_TABLE.source.periodYear,
  trusteesReportYear: SSA_PERIOD_LIFE_TABLE.source.trusteesReportYear,
})

/**
 * The edition of a stored figure that names none. The field was added with the
 * 2023 table (2026-09-27); before that the engine carried the 2022 period table
 * of the 2025 Trustees Report, unchanged since its first commit, so every pick
 * and saved result without the field was made on it.
 */
export const LIFE_TABLE_EDITION_BEFORE_THE_FIELD: LifeTableEdition = Object.freeze({
  periodYear: 2022,
  trusteesReportYear: 2025,
})

/** An edition of SSA's period life table a stored figure can name, with SSA's page for it. */
export interface KnownLifeTableEdition {
  readonly edition: LifeTableEdition
  /** SSA's page for the edition: the live page for the one the engine carries, the page SSA keeps for an earlier one. */
  readonly url: string
}

/**
 * The editions a stored figure can name, a closed set: the 2022 period table
 * of the 2025 Trustees Report, which the engine carried until 2026-09-27
 * (its page, `table4c6_2022_TR2025.html`, was read live that day by the
 * D-LIFE-TABLE-2023 derivation, its check and its review), and the table the
 * engine carries now. A yearly refresh adds the outgoing edition with its page.
 */
export const KNOWN_LIFE_TABLE_EDITIONS: readonly KnownLifeTableEdition[] = Object.freeze([
  Object.freeze({ edition: LIFE_TABLE_EDITION_BEFORE_THE_FIELD, url: 'https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html' }),
  Object.freeze({ edition: CURRENT_LIFE_TABLE_EDITION, url: SSA_PERIOD_LIFE_TABLE.source.url }),
])

/**
 * The known edition a stored figure was made on (a figure that names none was
 * made on the 2022 table), or null when it names an edition outside
 * #KNOWN_LIFE_TABLE_EDITIONS.
 */
export function knownLifeTableEdition(stored: LifeTableEdition | undefined): KnownLifeTableEdition | null {
  const edition = storedLifeTableEdition(stored)
  return (
    KNOWN_LIFE_TABLE_EDITIONS.find(
      (known) => known.edition.periodYear === edition.periodYear && known.edition.trusteesReportYear === edition.trusteesReportYear,
    ) ?? null
  )
}

/** The edition a stored figure was made on: its own field, or the 2022 table when it has none. */
export function storedLifeTableEdition(stored: LifeTableEdition | undefined): LifeTableEdition {
  return stored ?? LIFE_TABLE_EDITION_BEFORE_THE_FIELD
}

/** Whether a stored figure was made on the table the engine carries now. */
export function isCurrentLifeTableEdition(stored: LifeTableEdition | undefined): boolean {
  const edition = storedLifeTableEdition(stored)
  return (
    edition.periodYear === CURRENT_LIFE_TABLE_EDITION.periodYear &&
    edition.trusteesReportYear === CURRENT_LIFE_TABLE_EDITION.trusteesReportYear
  )
}

function at(column: readonly number[], age: number): number {
  const i = Math.round(age)
  if (i < 0) return column[0]!
  if (i >= column.length) return column[column.length - 1]!
  return column[i]!
}

/**
 * SSA's printed remaining life expectancy e(x) at an age (linear between
 * integer ages for a fractional age); 'average' is the mean of the male and
 * female values. The longevity questionnaire prints it as its baseline. The
 * survival curve's own expectancy differs from it by at most a few thousandths
 * of a year (record survival-hazard-from-expectancy-multiplier).
 */
export function baselineRemainingYears(age: number, sex: Sex): number {
  const male = SSA_PERIOD_LIFE_TABLE.male.e
  const female = SSA_PERIOD_LIFE_TABLE.female.e
  const a = Math.min(Math.max(age, 0), male.length - 1 - 1e-9)
  const lo = Math.floor(a)
  const hi = Math.ceil(a)
  const t = a - lo
  const m = at(male, lo) * (1 - t) + at(male, hi) * t
  const f = at(female, lo) * (1 - t) + at(female, hi) * t
  if (sex === 'male') return m
  if (sex === 'female') return f
  return (m + f) / 2
}
