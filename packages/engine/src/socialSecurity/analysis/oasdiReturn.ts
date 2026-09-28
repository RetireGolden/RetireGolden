/**
 * "What you paid in and what you get back": the Social Security (OASDI) part
 * of the payroll tax, which FICA collects together with the Medicare (HI) part
 * this leaves out, over a person's earnings: what they paid in so far and what
 * their projected work will pay, restated in today's dollars, beside the
 * benefits they are paid (on their own record, or a former spouse's when
 * larger), and the ratio of the two. An illustration on the analysis page, not
 * a tax the projection charges: the ledger never taxes working years' wages
 * here.
 *
 * Paid in (owner decision R8): each year's covered earnings, capped at that
 * year's contribution and benefit base, at that year's effective statutory
 * rate (socialSecurity/oasdiTaxRates.ts, current law after its last year),
 * restated in the start year's dollars by the ratio of CPI-U annual averages
 * to the latest published year (socialSecurity/cpiU.ts) and then by the
 * plan's inflation assumption to the start year. Prices only: no interest is
 * credited. The years counted are the ones the PIA counts: the entered
 * history, and, when the PIA comes from that history, the years its earnings
 * projection fills (socialSecurity/piaFromEarnings.ts#computePiaFromEarnings,
 * at the base it caps them at), so the get-back's PIA and the paid-in cover
 * the same career.
 *
 * Get back: the expected present value of the person's benefits from the
 * start year (analysis/expectedValue.ts, at the stream's claim age with its
 * months and the former-spouse benefits the ledger would pay), plus the
 * benefits already received from the claim year to the year before the start,
 * at the start-year amount (a constant real amount, the same price-only basis
 * as paid-in).
 *
 * @see DOCS/calculations/social-security/oasdi-paid-in-today-dollars.md
 * @see DOCS/calculations/social-security/benefits-to-contributions-ratio.md
 */
import type { Plan } from '../../model/plan.js'
import { socialSecurityDobParts } from '../annualTiming.js'
import { CPI_U_ANNUAL_AVERAGE, CPI_U_LATEST_YEAR } from '../cpiU.js'
import { FIRST_OASDI_TAX_YEAR, OASDI_TAX_RATE_BY_YEAR, type OasdiTaxRates } from '../oasdiTaxRates.js'
import { resolveStreamPiaMonthly, type YearEarning } from '../piaFromEarnings.js'
import { wageBaseForYearOrLatest } from '../ssaWageData.js'
import {
  disabilityReplacesClaimAge,
  expectedPvSingle,
  singleBenefitInYear,
  socialSecurityClaimants,
  type ExpectedValueClaimant,
} from './expectedValue.js'

/** The first year self-employment income was taxed for Social Security. */
export const FIRST_SELF_EMPLOYMENT_TAX_YEAR = 1951

export interface OasdiPaidIn {
  /** Paid in so far: the person's OASDI tax (the employee's, or the self-employed total) on the entered years through the start year, in start-year dollars. */
  readonly paidInToday: number
  /** The employer's matching tax on those years, in start-year dollars; 0 when self-employed. */
  readonly employerToday: number
  /** The same two sums in the dollars actually withheld. */
  readonly paidInNominal: number
  readonly employerNominal: number
  /** What the projected work will pay: the person's tax on the projected years and the entered years after the start, in start-year dollars. */
  readonly projectedToday: number
  /** The employer's matching tax on the projected work, in start-year dollars; 0 when self-employed. */
  readonly projectedEmployerToday: number
  /** The years in `projectedToday`, in order. */
  readonly projectedYears: readonly number[]
  /** Years with earnings that were not counted: before 1937, or self-employed before 1951. */
  readonly excludedYears: readonly number[]
  /** The latest year with a published CPI-U annual average; later years use the plan's inflation. */
  readonly cpiLatestYear: number
}

export interface OasdiPaidInOptions {
  readonly selfEmployed: boolean
  readonly startYear: number
  /** The plan's yearly inflation, percent, used from the latest CPI-U year to the start year. */
  readonly inflationPct: number
  /**
   * The years the PIA computation's earnings projection fills, with the
   * earnings it assumes for each; counted in `projectedToday`. None when the
   * PIA does not come from a projected history.
   */
  readonly projectedEarnings?: readonly YearEarning[]
}

/** The rates for a year: SSA's table, current law (the latest row) after it, and none before 1937. */
function ratesForYear(year: number): OasdiTaxRates | undefined {
  if (year < FIRST_OASDI_TAX_YEAR) return undefined
  const latest = Math.max(...Object.keys(OASDI_TAX_RATE_BY_YEAR).map(Number))
  return OASDI_TAX_RATE_BY_YEAR[year] ?? OASDI_TAX_RATE_BY_YEAR[latest]
}

/**
 * The factor that brings a dollar of `year` to `startYear`: CPI(L)/CPI(year)
 * × (1 + i)^(startYear − L) for a year with a published average (L the latest),
 * and (1 + i)^(startYear − year) for a later one.
 */
export function todayDollarFactor(year: number, startYear: number, inflationPct: number): number {
  if (year <= CPI_U_LATEST_YEAR) {
    return (CPI_U_ANNUAL_AVERAGE[CPI_U_LATEST_YEAR]! / CPI_U_ANNUAL_AVERAGE[year]!) * Math.pow(1 + inflationPct / 100, startYear - CPI_U_LATEST_YEAR)
  }
  return Math.pow(1 + inflationPct / 100, startYear - year)
}

/** Earnings rows added by calendar year, positive amounts only. */
function totalsByYear(rows: readonly YearEarning[]): Map<number, number> {
  const byYear = new Map<number, number>()
  for (const row of rows) {
    if (row.amount > 0) byYear.set(row.year, (byYear.get(row.year) ?? 0) + row.amount)
  }
  return byYear
}

/**
 * OASDI tax paid over an earnings history and the projected work. Rows for one
 * year are added first; each year's total is capped at that year's base
 * (#wageBaseForYearOrLatest, the latest published base for a year SSA has not
 * set, as the PIA computation caps it), taxed at that year's effective rate
 * (the employee's, or the self-employed rate; current law after the table),
 * and restated by #todayDollarFactor. An entered year through `startYear` is
 * paid in so far; the projected years and an entered year after `startYear`
 * are the projected work, each restated from the start year at the latest (a
 * factor of 1 after it), since the PIA computation counts a later year's
 * earnings at their face amount, on the latest published base and wage index.
 * A year before 1937, or self-employed before 1951, is named in
 * `excludedYears` and not counted. Nothing is rounded.
 */
export function oasdiPaidIn(earnings: readonly YearEarning[], options: OasdiPaidInOptions): OasdiPaidIn {
  const entered = totalsByYear(earnings)
  const projected = totalsByYear(options.projectedEarnings ?? [])
  let paidInToday = 0
  let employerToday = 0
  let paidInNominal = 0
  let employerNominal = 0
  let projectedToday = 0
  let projectedEmployerToday = 0
  const projectedYears: number[] = []
  const excludedYears: number[] = []
  const years = [...new Set([...entered.keys(), ...projected.keys()])].sort((a, b) => a - b)
  for (const year of years) {
    const rates = ratesForYear(year)
    const personRate = rates === undefined ? null : options.selfEmployed ? rates.selfEmployed : rates.employee
    if (rates === undefined || personRate === null) {
      excludedYears.push(year)
      continue
    }
    const factor = todayDollarFactor(Math.min(year, options.startYear), options.startYear, options.inflationPct)
    const taxOn = (amount: number, rate: number): number => (Math.min(amount, wageBaseForYearOrLatest(year)) * rate) / 100
    const enteredAmount = entered.get(year)
    if (enteredAmount !== undefined && year <= options.startYear) {
      const tax = taxOn(enteredAmount, personRate)
      paidInNominal += tax
      paidInToday += tax * factor
      if (!options.selfEmployed) {
        const employerTax = taxOn(enteredAmount, rates.employer)
        employerNominal += employerTax
        employerToday += employerTax * factor
      }
      continue
    }
    // A projected year, or an entered year after the start: the entered amount wins when both name the year.
    const amount = enteredAmount ?? projected.get(year)!
    projectedYears.push(year)
    projectedToday += taxOn(amount, personRate) * factor
    if (!options.selfEmployed) projectedEmployerToday += taxOn(amount, rates.employer) * factor
  }
  return {
    paidInToday,
    employerToday,
    paidInNominal,
    employerNominal,
    projectedToday,
    projectedEmployerToday,
    projectedYears,
    excludedYears,
    cpiLatestYear: CPI_U_LATEST_YEAR,
  }
}

/** What the benefits return per dollar of tax paid in: get-back ÷ paid-in, both in today's dollars; null when nothing was paid in. */
export function benefitsToContributionsRatio(getBack: number, paidInToday: number): number | null {
  return paidInToday > 0 ? getBack / paidInToday : null
}

export interface OasdiReturn {
  readonly personId: string
  readonly paid: OasdiPaidIn
  /** Expected present value of the benefits from the start year on. */
  readonly getBackPv: number
  /** Benefits already received from the claim year to the year before the start, at the start-year amount. */
  readonly receivedBeforeStart: number
  /** (getBackPv + receivedBeforeStart) / (paid.paidInToday + paid.projectedToday), or null when nothing is paid in. */
  readonly ratio: number | null
}

export interface OasdiReturnOptions {
  readonly startYear: number
  readonly discountRate: number
  readonly selfEmployed: boolean
}

/**
 * The paid-in and get-back comparison for one person with an earnings history
 * and a PIA the projection can pay. Null otherwise, and null for a benefit the
 * ledger pays as a disability benefit from its onset
 * (#disabilityReplacesClaimAge), since its claim age would not start it.
 */
export function oasdiReturnForPerson(plan: Plan, personId: string, options: OasdiReturnOptions): OasdiReturn | null {
  const entry = socialSecurityClaimants(plan, options.startYear).find((claimant) => claimant.person.id === personId)
  if (!entry || !entry.stream.earnings || entry.stream.earnings.length === 0) return null
  if (disabilityReplacesClaimAge(entry.stream, entry.person)) return null
  const { y, m, d } = socialSecurityDobParts(entry.person)
  const claimant: ExpectedValueClaimant = {
    dob: { year: y, month: m, day: d },
    sex: entry.person.sex,
    piaMonthly: entry.piaMonthly,
    claimAge: entry.stream.claimAge,
    formerSpouses: entry.stream.formerSpouses ?? [],
  }
  const household = { single: plan.household.people.length === 1 }
  const getBackPv = expectedPvSingle(claimant, household, {
    startYear: options.startYear,
    discountRate: options.discountRate,
    assumptions: plan.assumptions,
  })
  let receivedBeforeStart = 0
  for (let year = y + entry.stream.claimAge.years; year < options.startYear; year++) {
    receivedBeforeStart += singleBenefitInYear(claimant, household, year)
  }
  const resolved = resolveStreamPiaMonthly(entry.stream, entry.person, null)
  const projectedEarnings =
    resolved.status === 'fromEarnings'
      ? resolved.detail.indexedYears.filter((row) => row.projected).map((row) => ({ year: row.year, amount: row.rawEarnings }))
      : []
  const paid = oasdiPaidIn(entry.stream.earnings, {
    selfEmployed: options.selfEmployed,
    startYear: options.startYear,
    inflationPct: plan.assumptions.inflationPct,
    projectedEarnings,
  })
  return {
    personId,
    paid,
    getBackPv,
    receivedBeforeStart,
    ratio: benefitsToContributionsRatio(getBackPv + receivedBeforeStart, paid.paidInToday + paid.projectedToday),
  }
}
