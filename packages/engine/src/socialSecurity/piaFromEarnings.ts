/**
 * PIA from covered earnings (retirement), using SSA wage indexing and bend points.
 * @see https://www.ssa.gov/oact/COLA/Benefits.html
 * @see DOCS/features/social-security.md
 */

import { effectiveBirthYear } from './nra.js'
import {
  awiForYear,
  awiForYearOrLatest,
  bendPointsForEligibilityYearOrLatest,
  LATEST_PIA_BEND_POINT_ELIGIBILITY_YEAR,
  wageBaseForYearOrLatest,
} from './ssaWageData.js'

export type PiaFromEarningsErrorCode =
  | 'eligibility_before_1979'
  | 'missing_awi'
  | 'missing_bend_points'
  | 'no_computation_years'
  | 'last_earnings_year_out_of_range'

export interface PiaFromEarningsError {
  code: PiaFromEarningsErrorCode
  message: string
}

export interface YearEarning {
  year: number
  /** Taxed Social Security earnings for that calendar year (before wage-base cap). */
  amount: number
}

/**
 * Optional projection of future covered earnings. Without it, every base year
 * after `lastEarningsYear` is treated as zero — which understates the PIA for
 * someone who is still working but will retire a few years out. With it, those
 * years are filled at an assumed wage up to a retirement age.
 */
export interface EarningsProjection {
  /** Covered earnings to assume for each projected year; null = reuse the last reported year's amount. */
  assumedAnnualEarnings: number | null
  /** Project covered earnings through the worker's last full working year before this age. */
  throughAge: number
}

export interface PiaFromEarningsInput {
  dobYear: number
  dobMonth: number
  dobDay: number
  /** Calendar years and covered earnings; years outside the base window are ignored. */
  earnings: YearEarning[]
  /** Last calendar year with covered earnings; later base years are treated as zero (unless projected). */
  lastEarningsYear: number
  /** Optional: fill base years after `lastEarningsYear` with assumed earnings instead of zero. */
  projection?: EarningsProjection | null
}

export interface IndexedYearDetail {
  year: number
  rawEarnings: number
  cappedEarnings: number
  indexedAnnual: number
  wageIndexed: boolean
  /** True when this year's earnings were filled in by the future-earnings projection (not reported). */
  projected: boolean
}

export interface PiaFromEarningsResult {
  eligibilityYear: number
  firstBaseYear: number
  lastBaseYear: number
  indexingYearAwi: number
  indexedYears: IndexedYearDetail[]
  /** After dropout / top-35 selection, in eligibility-year dollars (indexed or nominal per rules). */
  yearsUsedInAime: number[]
  computationYearCount: number
  /** How many base years were filled by the future-earnings projection. */
  projectedYearCount: number
  aime: number
  /** Monthly PIA at full retirement age before COLA (rounded down to next lower $0.10). */
  piaMonthly: number
  /**
   * True when eligibility or some indexed earnings year is beyond published SSA tables in this app;
   * latest bend points and/or AWI are used as a rough stand-in (SSA will apply official values later).
   */
  usesStandInForFutureTables: boolean
}

function floorToDime(x: number): number {
  return Math.floor(x * 10 + 1e-9) / 10
}

/** Year of eligibility for retirement: calendar year worker attains age 62 (Jan 1 rule via effective birth year). */
export function eligibilityYearFromDobParts(y: number, m: number, d: number): number {
  return effectiveBirthYear(y, m, d) + 62
}

/**
 * PIA from AIME using eligibility-year bend points (monthly formula).
 * @see https://www.ssa.gov/oact/COLA/piaformula.html
 */
export function piaMonthlyFromAime(aime: number, eligibilityYear: number): number {
  const bp = bendPointsForEligibilityYearOrLatest(eligibilityYear)
  const b1 = bp.first
  const b2 = bp.second
  let pia =
    0.9 * Math.min(aime, b1) +
    0.32 * Math.max(0, Math.min(aime, b2) - b1) +
    0.15 * Math.max(0, aime - b2)
  pia = floorToDime(pia)
  return pia
}

function capEarnings(year: number, amount: number): number {
  // Cap at the year's taxable maximum, falling back to the latest published wage
  // base for projected/future years SSA has not set yet (otherwise high earners'
  // projected years would inflate AIME past the Social Security taxable maximum).
  return Math.max(0, Math.min(amount, wageBaseForYearOrLatest(year)))
}

/**
 * Full earnings-history → AIME → PIA path for a retirement benefit illustration.
 */
export function computePiaFromEarnings(input: PiaFromEarningsInput): PiaFromEarningsResult | PiaFromEarningsError {
  const { dobYear, dobMonth, dobDay, earnings, lastEarningsYear, projection } = input
  const eligibilityYear = eligibilityYearFromDobParts(dobYear, dobMonth, dobDay)

  if (eligibilityYear < 1979) {
    return {
      code: 'eligibility_before_1979',
      message:
        'This tool uses the modern PIA formula (1979+). For birth dates implying eligibility before 1979, enter PIA manually in quick mode.',
    }
  }

  const effBirth = effectiveBirthYear(dobYear, dobMonth, dobDay)
  const firstBaseYear = effBirth + 22
  const lastBaseYear = eligibilityYear - 1

  if (lastEarningsYear < firstBaseYear || lastEarningsYear > lastBaseYear) {
    return {
      code: 'last_earnings_year_out_of_range',
      message: `Last earnings year must be between ${firstBaseYear} and ${lastBaseYear} for this date of birth.`,
    }
  }

  const awiNumYear = eligibilityYear - 2
  let usesStandInForFutureTables = eligibilityYear > LATEST_PIA_BEND_POINT_ELIGIBILITY_YEAR
  if (awiForYear(awiNumYear) === undefined) usesStandInForFutureTables = true
  if (!usesStandInForFutureTables) {
    for (let y = firstBaseYear; y <= lastBaseYear && y <= eligibilityYear - 2; y++) {
      if (awiForYear(y) === undefined) {
        usesStandInForFutureTables = true
        break
      }
    }
  }

  const indexingAwi = awiForYearOrLatest(awiNumYear)

  const byYear = new Map<number, number>()
  for (const row of earnings) {
    if (!Number.isFinite(row.year) || !Number.isFinite(row.amount)) continue
    const y = Math.trunc(row.year)
    const prev = byYear.get(y) ?? 0
    byYear.set(y, prev + Math.max(0, row.amount))
  }

  // Future-earnings projection: fill base years after the last reported year up
  // to the worker's last full working year before `throughAge` (effBirth + age).
  const projectionThroughYear = projection ? effBirth + projection.throughAge - 1 : lastEarningsYear
  const projectedAmount = projection
    ? (projection.assumedAnnualEarnings ?? byYear.get(lastEarningsYear) ?? 0)
    : 0

  const indexedDetails: IndexedYearDetail[] = []
  const annualIndexedList: number[] = []
  let projectedYearCount = 0

  for (let year = firstBaseYear; year <= lastBaseYear; year++) {
    let raw: number
    let projected = false
    if (year <= lastEarningsYear) {
      raw = byYear.get(year) ?? 0
    } else if (projection && year <= projectionThroughYear) {
      raw = projectedAmount
      projected = true
      projectedYearCount++
    } else {
      raw = 0
    }
    const capped = capEarnings(year, raw)
    const wageIndexed = year <= eligibilityYear - 2
    let indexedAnnual = capped
    if (wageIndexed) {
      const awiY = awiForYearOrLatest(year)
      indexedAnnual = Math.floor((capped * indexingAwi) / awiY)
    }
    indexedDetails.push({
      year,
      rawEarnings: raw,
      cappedEarnings: capped,
      indexedAnnual,
      wageIndexed,
      projected,
    })
    annualIndexedList.push(indexedAnnual)
  }

  annualIndexedList.sort((a, b) => a - b)
  const afterDropout = annualIndexedList.slice(5)
  if (afterDropout.length === 0) {
    return {
      code: 'no_computation_years',
      message: 'Not enough covered earnings years in the base period after dropout (need at least one year).',
    }
  }

  afterDropout.sort((a, b) => b - a)
  const top = afterDropout.slice(0, 35)
  const computationYearCount = Math.min(35, afterDropout.length)
  const sumTop = top.reduce((s, v) => s + v, 0)
  const divisorMonths = 12 * computationYearCount
  const aime = Math.floor(sumTop / divisorMonths)

  const pia = piaMonthlyFromAime(aime, eligibilityYear)

  return {
    eligibilityYear,
    firstBaseYear,
    lastBaseYear,
    indexingYearAwi: indexingAwi,
    indexedYears: indexedDetails,
    yearsUsedInAime: top,
    computationYearCount,
    projectedYearCount,
    aime,
    piaMonthly: pia,
    usesStandInForFutureTables,
  }
}

export function isPiaFromEarningsError(
  x: PiaFromEarningsResult | PiaFromEarningsError,
): x is PiaFromEarningsError {
  return 'code' in x
}

/**
 * Assemble a {@link PiaFromEarningsInput} from a person's date of birth and an
 * earnings history, clamping `lastEarningsYear` into the AIME base window. Shared
 * by the projection engine and the planner UI so the windowing logic lives in
 * one place. Assumes `earnings` is non-empty (callers guard).
 */
export function piaInputFromEarnings(
  dobYear: number,
  dobMonth: number,
  dobDay: number,
  earnings: YearEarning[],
  projection?: EarningsProjection | null,
): PiaFromEarningsInput {
  const effBirth = effectiveBirthYear(dobYear, dobMonth, dobDay)
  const firstBaseYear = effBirth + 22
  const lastBaseYear = effBirth + 61
  const lastEarningsYear = Math.min(Math.max(...earnings.map((e) => e.year), firstBaseYear), lastBaseYear)
  return { dobYear, dobMonth, dobDay, earnings, lastEarningsYear, projection: projection ?? null }
}

/**
 * Resolve the plan's stored earnings-projection settings into an engine
 * {@link EarningsProjection}, defaulting `throughAge` to the person's retirement
 * age. Returns null when no projection is configured or no age is available.
 */
export function resolveEarningsProjection(
  stored: { assumedAnnualEarnings: number | null; throughAge: number | null } | null | undefined,
  retirementAge: number | null,
): EarningsProjection | null {
  if (!stored) return null
  const throughAge = stored.throughAge ?? retirementAge
  if (throughAge === null) return null
  return { assumedAnnualEarnings: stored.assumedAnnualEarnings, throughAge }
}

/** Parse "YYYY amount" lines (whitespace-separated). */
export function parseEarningsLines(text: string): { rows: YearEarning[]; errors: string[] } {
  const rows: YearEarning[] = []
  const errors: string[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[\s,]+/).filter(Boolean)
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: need year and amount (e.g. "1995 42000").`)
      continue
    }
    const y = Number.parseInt(parts[0]!, 10)
    const amt = Number.parseFloat(parts[1]!)
    if (!Number.isFinite(y) || y < 1951 || y > 2100) {
      errors.push(`Line ${i + 1}: invalid year.`)
      continue
    }
    if (!Number.isFinite(amt) || amt < 0) {
      errors.push(`Line ${i + 1}: invalid amount.`)
      continue
    }
    rows.push({ year: y, amount: amt })
  }
  return { rows, errors }
}
