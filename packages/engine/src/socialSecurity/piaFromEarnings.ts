/**
 * PIA from covered earnings (retirement), using SSA wage indexing and bend points.
 * @see https://www.ssa.gov/oact/COLA/Benefits.html
 * @see DOCS/features/social-security.md
 */

import { socialSecurityDobParts } from './annualTiming.js'
import { effectiveBirthYear } from './nra.js'
import {
  awiForYear,
  awiForYearOrLatest,
  bendPointsForEligibilityYearOrLatest,
  COLA_PCT_BY_YEAR,
  LATEST_PIA_BEND_POINT_ELIGIBILITY_YEAR,
  wageBaseForYearOrLatest,
} from './ssaWageData.js'

export type PiaFromEarningsErrorCode =
  | 'eligibility_before_1979'
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
  earnings: readonly YearEarning[]
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
  /**
   * How many of `yearsUsedInAime` are $0: benefit computation years with no
   * indexed earnings, each one lowering the average. It counts the years this
   * computation averaged, so it follows its computation-year window.
   */
  zeroYearsInAime: number
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

/**
 * The first computation base year: 42 U.S.C. 415(b)(2)(B)(ii) counts "the
 * calendar years after 1950", and (iii) starts the elapsed years there too.
 */
export const FIRST_COMPUTATION_BASE_YEAR = 1951

function floorToDime(x: number): number {
  return Math.floor(x * 10 + 1e-9) / 10
}

/** Year of eligibility for retirement: calendar year worker attains age 62 (Jan 1 rule via effective birth year). */
export function eligibilityYearFromDobParts(y: number, m: number, d: number): number {
  return effectiveBirthYear(y, m, d) + 62
}

/**
 * PIA from AIME using eligibility-year bend points (monthly formula): 90% of
 * AIME up to the first bend point, plus 32% of AIME between the first and
 * second, plus 15% of AIME above the second, then floored to the dime.
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
  // 42 U.S.C. 415(e)(1): earnings above the year's contribution and benefit base
  // are not counted. The base is SSA's for every year from 1937, and the latest
  // published one for projected/future years SSA has not set yet (otherwise high
  // earners' projected years would inflate AIME past the taxable maximum).
  return Math.max(0, Math.min(amount, wageBaseForYearOrLatest(year)))
}

/**
 * Wage-index one year's capped covered earnings: AWI_indexing / AWI_year,
 * floored to a whole dollar. 20 CFR 404.211(d)(3) instead rounds to the nearer penny.
 */
function indexCoveredEarnings(
  cappedEarnings: number,
  yearAwi: number,
  indexingYearAwi: number,
): number {
  return Math.floor((cappedEarnings * indexingYearAwi) / yearAwi)
}

/**
 * Full earnings-history → AIME → PIA path for a retirement benefit illustration.
 */
export function computePiaFromEarnings(input: PiaFromEarningsInput): PiaFromEarningsResult | PiaFromEarningsError {
  return computeWithReplacedYear(input, null)
}

/**
 * The computation, with one base year's raw earnings optionally replaced after
 * the window, the projection and the indexing year are set from `input`, so a
 * replacement changes that year's earnings and nothing else.
 */
function computeWithReplacedYear(
  input: PiaFromEarningsInput,
  replaced: { readonly year: number; readonly amount: number } | null,
): PiaFromEarningsResult | PiaFromEarningsError {
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
  // Elapsed-year span: 1951, or the year the worker turns 22 if later, through the
  // year before 62 (42 U.S.C. 415(b)(2)(B)(iii)); not the computation-base years
  // through the year before first entitlement (a registered approximation).
  const firstBaseYear = Math.max(effBirth + 22, FIRST_COMPUTATION_BASE_YEAR)
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
    if (replaced !== null && year === replaced.year) raw = replaced.amount
    const capped = capEarnings(year, raw)
    const wageIndexed = year <= eligibilityYear - 2
    let indexedAnnual = capped
    if (wageIndexed) {
      const awiY = awiForYearOrLatest(year)
      indexedAnnual = indexCoveredEarnings(capped, awiY, indexingAwi)
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

  // 42 U.S.C. 415(b)(2)(A): the computation years are the elapsed years less
  // five, the years with the largest indexed earnings. Elapsed years number at
  // most 40 (age 22 through 61), so at most 35 remain, and fewer when they start
  // at 1951.
  annualIndexedList.sort((a, b) => a - b)
  const afterDropout = annualIndexedList.slice(5)
  if (afterDropout.length === 0) {
    return {
      code: 'no_computation_years',
      message: 'Not enough covered earnings years in the base period after dropout (need at least one year).',
    }
  }

  afterDropout.sort((a, b) => b - a)
  const top = afterDropout
  const computationYearCount = afterDropout.length
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
    zeroYearsInAime: top.filter((value) => value === 0).length,
    projectedYearCount,
    aime,
    piaMonthly: pia,
    usesStandInForFutureTables,
  }
}

export interface PiaWithCostOfLivingIncreases {
  /** The PIA after every increase from the eligibility year through `throughYear`. */
  readonly piaMonthly: number
  /** Years in that span whose increase SSA has not announced; the stand-in rate was used for them. */
  readonly standInYears: readonly number[]
}

/**
 * The PIA raised by the cost-of-living increases since eligibility: 42 U.S.C.
 * 415(i)(2)(A)(iii) raises the PIA of a person who becomes eligible in a year
 * with an increase "by the amount of that increase and subsequent applicable
 * increases", whatever the time of entitlement, and (ii) floors each increased
 * amount to a multiple of $0.10. So the PIA an earnings history gives for the
 * eligibility year `eligibilityYear` is multiplied, year by year from that year
 * through `throughYear`, by one plus that year's increase (`COLA_PCT_BY_YEAR`),
 * flooring to the dime after each step. A year SSA has not announced uses
 * `standInPct` and is reported. Pass `throughYear` = the projection's first year
 * less one to get the PIA in the first year's dollars; an eligibility year at or
 * after it leaves the PIA unchanged.
 */
export function piaWithCostOfLivingIncreases(
  piaMonthly: number,
  eligibilityYear: number,
  throughYear: number,
  standInPct: number,
): PiaWithCostOfLivingIncreases {
  let pia = piaMonthly
  const standInYears: number[] = []
  for (let year = eligibilityYear; year <= throughYear; year++) {
    const published = COLA_PCT_BY_YEAR[year]
    if (published === undefined) standInYears.push(year)
    pia = floorToDime(pia * (1 + (published ?? standInPct) / 100))
  }
  return { piaMonthly: pia, standInYears }
}

/**
 * The yearly increase a projection assumes for Social Security, used for a year
 * between the last announced cost-of-living increase and the projection's first
 * year: the plan's fixed COLA, or its inflation rate when the COLA matches
 * inflation.
 */
export function socialSecurityColaAssumptionPct(assumptions: {
  readonly inflationPct: number
  readonly ssCola: { readonly mode: 'matchInflation' } | { readonly mode: 'fixed'; readonly annualPct: number }
}): number {
  return assumptions.ssCola.mode === 'fixed' ? assumptions.ssCola.annualPct : assumptions.inflationPct
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
  earnings: readonly YearEarning[],
  projection?: EarningsProjection | null,
): PiaFromEarningsInput {
  const effBirth = effectiveBirthYear(dobYear, dobMonth, dobDay)
  const firstBaseYear = Math.max(effBirth + 22, FIRST_COMPUTATION_BASE_YEAR)
  const lastBaseYear = effBirth + 61
  // Same elapsed-year clamp computePiaFromEarnings iterates; years outside it are ignored.
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

/** A Social Security stream's PIA fields: an entered PIA, or an earnings history and its projection. */
export interface StreamPiaInput {
  readonly piaMonthly: number | null
  readonly earnings: readonly YearEarning[] | null
  readonly earningsProjection?: {
    readonly assumedAnnualEarnings: number | null
    readonly throughAge: number | null
  } | null
}

/** The stream owner's date of birth (ISO) and retirement age, which the earnings projection defaults to. */
export interface StreamPiaPerson {
  readonly dob: string
  readonly retirementAge: number | null
}

/**
 * The projection's first year and the yearly increase the plan assumes for a
 * cost-of-living increase SSA has not announced (#socialSecurityColaAssumptionPct).
 */
export interface PiaAsOf {
  readonly startYear: number
  readonly colaAssumptionPct: number
}

export type ResolvedStreamPia =
  | { readonly status: 'entered'; readonly piaMonthly: number }
  | {
      readonly status: 'fromEarnings'
      /** The PIA in the projection's first year: the eligibility-year PIA with the increases since (or that PIA itself when `asOf` is null). */
      readonly piaMonthly: number
      /** The computation from the earnings history; its `piaMonthly` is the eligibility-year PIA. */
      readonly detail: PiaFromEarningsResult
      /** Years whose cost-of-living increase SSA has not announced, priced at the plan's assumption. */
      readonly standInColaYears: readonly number[]
    }
  | { readonly status: 'noPiaNoEarnings' }
  | { readonly status: 'earningsError'; readonly error: PiaFromEarningsError }

/**
 * The earnings computation's input for a stream: its earnings history with its
 * projection (defaulting to the person's retirement age) and the person's date
 * of birth; null when the stream has no earnings history.
 */
export function streamPiaFromEarningsInput(stream: StreamPiaInput, person: StreamPiaPerson): PiaFromEarningsInput | null {
  if (!stream.earnings || stream.earnings.length === 0) return null
  const { y, m, d } = socialSecurityDobParts(person)
  const projection = resolveEarningsProjection(stream.earningsProjection, person.retirementAge)
  return piaInputFromEarnings(y, m, d, stream.earnings, projection)
}

/**
 * A Social Security stream's monthly PIA, resolved once for the ledger, the
 * claim-milestone insight and the Social Security pages: the entered PIA as
 * entered, or the PIA the earnings history gives (#computePiaFromEarnings, with
 * the stream's projection defaulting to the person's retirement age) raised by
 * every cost-of-living increase from the eligibility year through the year
 * before the projection starts (42 U.S.C. 415(i)(2)(A)(iii),
 * #piaWithCostOfLivingIncreases). With `asOf` null the eligibility-year PIA is
 * returned, for a caller that only asks whether a PIA resolves. Warnings about
 * stand-in tables are the caller's to raise, from the fields returned.
 */
export function resolveStreamPiaMonthly(
  stream: StreamPiaInput,
  person: StreamPiaPerson,
  asOf: PiaAsOf | null,
): ResolvedStreamPia {
  if (stream.piaMonthly !== null) return { status: 'entered', piaMonthly: stream.piaMonthly }
  const input = streamPiaFromEarningsInput(stream, person)
  if (input === null) return { status: 'noPiaNoEarnings' }
  const result = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(result)) return { status: 'earningsError', error: result }
  if (asOf === null) return { status: 'fromEarnings', piaMonthly: result.piaMonthly, detail: result, standInColaYears: [] }
  const atStart = piaWithCostOfLivingIncreases(result.piaMonthly, result.eligibilityYear, asOf.startYear - 1, asOf.colaAssumptionPct)
  return { status: 'fromEarnings', piaMonthly: atStart.piaMonthly, detail: result, standInColaYears: atStart.standInYears }
}

/** The bend-point tier the next dollar of AIME is credited at, and the eligibility year's two bend points. */
export interface BendTier {
  readonly label: '90%' | '32%' | '15%'
  readonly marginalRate: number
  readonly first: number
  readonly second: number
}

/**
 * Which bend-point tier the next dollar of AIME falls into for this
 * eligibility year: 90% below the first bend point, 32% from it to the second,
 * 15% from the second (the eligibility year's bend points, or the latest
 * published ones for a later year, as #piaMonthlyFromAime reads them).
 */
export function bendTierForAime(aime: number, eligibilityYear: number): BendTier {
  const bp = bendPointsForEligibilityYearOrLatest(eligibilityYear)
  if (aime < bp.first) return { label: '90%', marginalRate: 0.9, first: bp.first, second: bp.second }
  if (aime < bp.second) return { label: '32%', marginalRate: 0.32, first: bp.first, second: bp.second }
  return { label: '15%', marginalRate: 0.15, first: bp.first, second: bp.second }
}

/** What replacing one $0 year with a year of earnings adds to the PIA, recomputed exactly. */
export interface ZeroYearReplacement {
  /** The replaced year: the latest base year whose earnings, reported or projected, are $0. */
  readonly year: number
  /** The earnings put in that year, as raw covered earnings (the computation caps and indexes them). */
  readonly amount: number
  /** The eligibility-year PIA before and after, each floored to the dime. */
  readonly piaBefore: number
  readonly piaAfter: number
  /** piaAfter − piaBefore, a multiple of $0.10 (rounded to the dime against float error). */
  readonly gainMonthly: number
  /**
   * The gain in the projection's first year's dollars: each PIA raised by the
   * cost-of-living increases from the eligibility year through the year before
   * `asOf.startYear` (#piaWithCostOfLivingIncreases, as the resolved PIA is),
   * and the difference rounded to the dime. Equal to `gainMonthly` without
   * `asOf`, or when the eligibility year is the start year or later.
   */
  readonly startYearGainMonthly: number
}

/**
 * The PIA gain from replacing one $0 year: #computePiaFromEarnings re-run on
 * the same input with the latest base year whose earnings are $0 given
 * `amount` of covered earnings, the window, projection and indexing year
 * unchanged, so the amount is capped at that year's base, indexed only if the
 * year is at or before the indexing year, and the AIME and PIA floored as
 * always. The latest $0 year is chosen because an earlier one would be wage
 * indexed, describing earnings the worker cannot now go back and earn; for a
 * worker 62 or older in `asOf.startYear` every base year has passed, so the
 * replaced year is a past one too. With `asOf`, the gain is also given in the
 * start year's dollars (`startYearGainMonthly`). Null when the history does
 * not compute, when no averaged year is $0, or when `amount` is not a
 * positive number.
 */
export function zeroYearReplacementGain(
  input: PiaFromEarningsInput,
  amount: number,
  asOf: PiaAsOf | null = null,
): ZeroYearReplacement | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const before = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(before) || before.zeroYearsInAime === 0) return null
  let year: number | null = null
  for (const row of before.indexedYears) if (row.rawEarnings === 0) year = row.year
  if (year === null) return null
  const after = computeWithReplacedYear(input, { year, amount })
  if (isPiaFromEarningsError(after)) return null
  const atStart = (pia: number): number =>
    asOf === null ? pia : piaWithCostOfLivingIncreases(pia, before.eligibilityYear, asOf.startYear - 1, asOf.colaAssumptionPct).piaMonthly
  return {
    year,
    amount,
    piaBefore: before.piaMonthly,
    piaAfter: after.piaMonthly,
    gainMonthly: Math.round((after.piaMonthly - before.piaMonthly) * 10) / 10,
    startYearGainMonthly: Math.round((atStart(after.piaMonthly) - atStart(before.piaMonthly)) * 10) / 10,
  }
}

/**
 * The sample the explainer puts in a $0 year: the projection's assumed
 * earnings for its first projected year, or else the amount of the latest
 * reported year (the last row for that year). Null with no earnings.
 */
export function zeroYearSampleEarnings(input: PiaFromEarningsInput): number | null {
  const result = computePiaFromEarnings(input)
  if (!isPiaFromEarningsError(result)) {
    const projected = result.indexedYears.find((row) => row.projected)
    if (projected !== undefined) return projected.rawEarnings
  }
  if (input.earnings.length === 0) return null
  return input.earnings.reduce((latest, row) => (row.year >= latest.year ? row : latest)).amount
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
