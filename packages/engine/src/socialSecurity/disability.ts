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
