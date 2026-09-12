/**
 * Social Security disability (SSDI) — the pure helper behind the `disability`
 * input on a Social Security stream. Cited in DOCS/domain/domain-rules-reference.md
 * §4 (SSDI); illustrative, not a filing tool.
 *
 * The defining rule: **SSDI pays the worker's full PIA with no early-retirement
 * reduction** (unlike early *retirement* claiming), starting at a disability-onset
 * age. At FRA it **converts to the retirement benefit at the same dollar amount**
 * (the PIA — continuous, no jump), so the PIA persists from onset through life and
 * the recipient earns no delayed-retirement credits (the benefit is already being
 * paid). Pre-FRA, earnings above **Substantial Gainful Activity (SGA)** suspend
 * SSDI (SSA replaces the retirement earnings test with SGA for disabled workers).
 *
 * Documented simplifications: a true disability computation can use a different
 * indexing year and computation-year count, and the disability freeze excludes
 * qualifying years (computation-base years wholly within an established period,
 * and elapsed years wholly or partly within it) unless counting them yields a
 * higher PIA — see 20 CFR 404.211. The planner does not adjudicate disability,
 * insured status, or the established period; `onsetAge` only switches the SSDI
 * payment path. The earnings→PIA helper keeps ordinary retirement indexing and
 * year selection (the freeze is not recomputed). Other documented limitations
 * include trial-work/EPE, the Medicare waiting period, expedited reinstatement,
 * and SSDI auxiliary/family benefit calculations; see domain §4 for their
 * individual dispositions.
 */

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
 * Whether a person is in the SSDI window (onset ≤ age < FRA). Pre-FRA, SSDI
 * applies and SGA (not the retirement earnings test) gates it. At/after FRA the
 * benefit has converted to retirement (still the PIA) and no earnings test applies.
 */
export function inSsdiWindow(ageAttained: number, onsetAge: number, fraYears: number): boolean {
  return ageAttained >= onsetAge && ageAttained < fraYears
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
