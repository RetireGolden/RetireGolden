/**
 * Social Security disability (SSDI) — the pure helper behind the `disability`
 * input on a Social Security stream. Cited in DOCS/domain/domain-rules-reference.md
 * §4 (SSDI); illustrative, not a filing tool.
 *
 * The defining rule: **SSDI pays the worker's full PIA with no early-retirement
 * reduction** (unlike early *retirement* claiming), starting with the first month
 * after a five-month waiting period (42 U.S.C. 423(a)(1), (c)(2)). Entitlement
 * ends the month before the month the worker attains full retirement age, when it
 * **converts to the retirement benefit at the same dollar amount** (42 U.S.C.
 * 402(a)(3); 20 CFR 404.316(b)(2)), so the PIA persists through life and the
 * recipient earns no delayed-retirement credits (the benefit is already being
 * paid). Pre-FRA, earnings above **Substantial Gainful Activity (SGA)** suspend
 * SSDI (SSA replaces the retirement earnings test with SGA for disabled workers).
 *
 * Documented simplifications: a true disability computation can use a different
 * indexing year and computation-year count, and the disability freeze excludes
 * qualifying years (computation-base years wholly within an established period,
 * and elapsed years wholly or partly within it) unless counting them yields a
 * higher PIA — see 20 CFR 404.211. The planner does not adjudicate disability,
 * insured status, or the established period; `onsetAge` and `onsetMonth` only
 * place the SSDI payment path. The earnings→PIA helper keeps ordinary retirement
 * indexing and year selection (the freeze is not recomputed). The waiting period
 * is always applied (no re-entitlement within five years, no ALS exception), and
 * the application is taken as timely (423(b) retroactivity and the 17-month
 * limit of 20 CFR 404.315(a)(4) never bind). Other documented limitations
 * include trial-work/EPE, the Medicare waiting period, expedited reinstatement,
 * and SSDI auxiliary/family benefit calculations; see domain §4 for their
 * individual dispositions.
 */
import {
  attainedAgeZeroMonthIndex,
  effectiveBirthYear,
  fraForBirthYear,
  fraTotalMonths,
  type DobParts,
} from './nra.js'

/**
 * Full calendar months of disability before the first payable month: the
 * waiting period of 42 U.S.C. 423(c)(2), "the earliest period of five
 * consecutive calendar months ... throughout which the individual ... has been
 * under a disability".
 */
export const SSDI_WAITING_PERIOD_MONTHS = 5

/** The two disability facts a stream carries (`incomes[].disability`). */
export interface SsdiOnset {
  /** Age attained in the calendar year the disability began. */
  readonly onsetAge: number
  /** Calendar month (1 to 12) it began, read as after the 1st; omitted reads as January 1. */
  readonly onsetMonth?: number | undefined
}

/**
 * The first month a disability benefit is payable, as `year * 12 + (month - 1)`.
 *
 * A month counts toward the waiting period only when the worker is disabled
 * throughout it, that is, the onset is on or before its first day (POMS DI
 * 10105.070). The onset year is the birth year plus `onsetAge`, the engine's
 * attained-age year. A given month is read as an onset after the 1st, so the
 * waiting period is the next five months and the sixth month after the onset
 * month is the first payable one; an onset on the 1st would be paid one month
 * sooner (a stated limit). A blank month reads as January 1: waiting January to
 * May, first payable June, the earliest the statute allows in that year.
 */
export function ssdiFirstPayableMonthIndex(birthYear: number, onset: SsdiOnset): number {
  const onsetYearStart = (birthYear + onset.onsetAge) * 12
  return onset.onsetMonth === undefined
    ? onsetYearStart + SSDI_WAITING_PERIOD_MONTHS
    : onsetYearStart + (onset.onsetMonth - 1) + SSDI_WAITING_PERIOD_MONTHS + 1
}

/** When a worker's disability benefit runs, as month indexes (`year * 12 + (month - 1)`). */
export interface SsdiSchedule {
  /** First month the disability benefit is payable. */
  readonly firstPayableMonthIndex: number
  /**
   * The month the worker attains full retirement age (the day-before-birthday
   * rule). Disability entitlement ends with the month before it, and the same
   * PIA is paid as the old-age benefit from it on (42 U.S.C. 423(a)(1), 402(a)(3)).
   */
  readonly fraMonthIndex: number
}

/**
 * The disability schedule for a worker, or null when no disability month is
 * payable: the first payable month is at or after the month the worker attains
 * full retirement age, so 423(a)(1) entitlement, which ends with the month
 * before that one, never begins, and the stream is an ordinary retirement claim.
 */
export function ssdiSchedule(dob: DobParts, onset: SsdiOnset): SsdiSchedule | null {
  const firstPayableMonthIndex = ssdiFirstPayableMonthIndex(dob.year, onset)
  const fra = fraForBirthYear(effectiveBirthYear(dob.year, dob.month, dob.day))
  const fraMonthIndex = attainedAgeZeroMonthIndex(dob) + fraTotalMonths(fra)
  return firstPayableMonthIndex < fraMonthIndex ? { firstPayableMonthIndex, fraMonthIndex } : null
}

/** Months a schedule pays in one calendar year, split at the full-retirement-age month. */
export interface SsdiYearMonths {
  /** Disability months: from the first payable month to the month before FRA. */
  readonly disability: number
  /** Months of the converted old-age benefit: from the FRA month on. */
  readonly retirement: number
}

/** The disability and converted-retirement months a schedule pays in `year`. */
export function ssdiMonthsInYear(schedule: SsdiSchedule, year: number): SsdiYearMonths {
  const yearStart = year * 12
  const yearEnd = yearStart + 12
  const disability = Math.max(
    0,
    Math.min(schedule.fraMonthIndex, yearEnd) - Math.max(schedule.firstPayableMonthIndex, yearStart),
  )
  const retirement = Math.max(0, yearEnd - Math.max(schedule.fraMonthIndex, yearStart))
  return { disability, retirement }
}

/** SSDI monthly benefit = the worker's full PIA (no early-retirement reduction). */
export function ssdiMonthlyBenefit(piaMonthly: number): number {
  return Math.max(0, piaMonthly)
}

/** Annual-approximation months used to convert the monthly SGA limit to a year. */
export const SGA_ANNUAL_MONTHS = 12

/**
 * SGA gate (annual approximation): wages above SGA × 12 suspend SSDI for the
 * year. The monthly SGA limit comes from the parameter pack
 * (`socialSecurity.sgaMonthlyNonBlind`); `annualSgaLimit` is that value scaled
 * to a year (×12 × inflation growth, supplied by the caller).
 */
export function ssdiSuspendedBySga(annualWages: number, annualSgaLimit: number): boolean {
  return annualWages > annualSgaLimit
}

/**
 * Whether the annual SGA test applies to a year the schedule pays: the year
 * pays disability months and no converted-retirement month. Pre-FRA, SSDI
 * applies and SGA (not the retirement earnings test) gates it. From the FRA
 * month the benefit has converted to retirement (still the PIA) and no earnings
 * test applies, so a year that holds the FRA month is not suspended as a whole.
 */
export function inSsdiWindow(months: SsdiYearMonths): boolean {
  return months.disability > 0 && months.retirement === 0
}

/**
 * Facts the Plan would need to determine disabled-worker Medicare Part A
 * continuation after trial work (42 U.S.C. 426(b); SSA DI 28055.001 / Red Book
 * “at least 93 consecutive months after the nine-month TWP”). Cash-benefit
 * TWP/EPE approximation remains separate — this boundary asserts the engine
 * does not produce a Part A entitlement interval from onset age / SGA alone.
 */
export const SSDI_MEDICARE_CONTINUATION_MISSING_FACTS = [
  'trialWorkPeriodEndDate',
  'entitlementTerminationDate',
  'continuingImpairmentAfterTermination',
  'substantialGainfulActivityCounterfactual',
  'medicarePartAEntitlementInterval',
] as const

export type SsdiMedicareContinuationBoundary =
  | {
      readonly status: 'notAMedicareContinuationDetermination'
      readonly missingFacts: typeof SSDI_MEDICARE_CONTINUATION_MISSING_FACTS
      readonly partAEntitlementMonths: null
      /**
       * SSA formulation: at least 93 consecutive months after the nine-month
       * TWP for qualifying continuing disability — not 36 months of EPE plus
       * another 93.
       */
      readonly authorityMinimumMonthsAfterTwp: 93
    }

/**
 * Boundary assertion for code-093/F-093-01: onset age and cash-benefit SGA
 * suspension do not produce a Part A entitlement interval.
 */
export function assertSsdiMedicareContinuationNotDeterminedFromCashBenefitFacts(input: {
  readonly onsetAge: number
  readonly ssdiCashBenefitSuspendedBySga: boolean
}): SsdiMedicareContinuationBoundary {
  // This deliberately does not derive Part A coverage from these cash-benefit
  // facts; the boundary exists specifically because they are insufficient.
  void input
  return {
    status: 'notAMedicareContinuationDetermination',
    missingFacts: SSDI_MEDICARE_CONTINUATION_MISSING_FACTS,
    partAEntitlementMonths: null,
    authorityMinimumMonthsAfterTwp: 93,
  }
}
