/**
 * ACA premium-tax-credit results and the support codes that say whether a
 * year is actionable.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
export type AcaSupportCode =
  | 'actionable'
  | 'missing-year-contract'
  | 'duplicate-year-contract'
  | 'tax-family-member-unknown'
  | 'tax-family-structure-unsupported'
  | 'covered-member-duplicate'
  | 'medicare-overlap-unsupported'
  | 'slcsp-benchmark-missing'
  | 'benchmark-only-coverage-unsupported'
  | 'example-contract-input-mismatch'
  | 'dependent-filing-status-unknown'
  | 'dependent-modeled-person-overlap'
  | 'tax-exempt-interest-unknown'
  /** Informational — ACA MAGI tax-exempt interest came from plan-generated income, not household attestation; does not block actionability. */
  | 'tax-exempt-interest-plan-derived'
  /** Informational — contract attests none while plan accounts generate exempt interest; engine uses generated figure; does not block actionability. */
  | 'tax-exempt-interest-contract-contradicted'
  | 'foreign-exclusion-addback-unknown'
  | 'coverage-eligibility-unsupported'
  | 'form-8814-unsupported'
  | 'special-allocation-unsupported'
  | 'mfs-exception-unsupported'
  | 'self-employed-deduction-unsupported'
  | 'other-material-facts-unsupported'
  | 'below-100-fpl-exception-unsupported'
  | 'tax-year-parameters-unsupported'
  /** Informational: the credit is priced on the coverage year's published ACA figures while that year's income-tax figures are projected from the latest pack, so the household's income (MAGI) rests on projected brackets; does not block actionability. */
  | 'income-tax-parameters-projected'
  | 'guardrail-interaction-unsupported'
  | 'hsa-cap-fixed-point-nonconvergent'
  | 'conflicting-cliff-fixed-points'
  | 'fixed-point-nonconvergent'

/**
 * The support codes that inform without blocking. A year whose only other
 * codes are these is priced and actionable, and they are published beside
 * 'actionable'. The ledger's readiness, the funding fixed point's pricing gate
 * and every reader that sorts a year's blocking codes from its notes share
 * this one set.
 */
export const INFORMATIONAL_ACA_SUPPORT_CODES: ReadonlySet<AcaSupportCode> = new Set<AcaSupportCode>([
  'tax-exempt-interest-plan-derived',
  'tax-exempt-interest-contract-contradicted',
  'income-tax-parameters-projected',
])

/** Whether a support code blocks pricing (every code but 'actionable' and the informational ones). */
export function isBlockingAcaSupportCode(code: AcaSupportCode): boolean {
  return code !== 'actionable' && !INFORMATIONAL_ACA_SUPPORT_CODES.has(code)
}

export interface YearAcaResult {
  readiness: 'actionable' | 'nonActionable'
  supportCodes: AcaSupportCode[]
  /** Final return-year ACA household MAGI; null when material facts are unsupported. */
  householdMagi: number | null
  /**
   * Always published. When the year is ACA-active with a contract, these are
   * the MAGI probe's parts, built before pricing is refused, so in a
   * non-actionable year (a coverage year with no published ACA figures, for
   * one: 2028 and later today) they are the inputs a credit would have been
   * priced on, not a household MAGI the engine vouches for, and householdMagi
   * is null beside them. A year whose ACA figures are published is priced even
   * when its income-tax figures are projected (2027 today, with the
   * informational income-tax-parameters-projected code). Without a probe they fall
   * back to the year's own federal AGI, untaxed Social Security, tax-exempt
   * interest and foreign-exclusion addback.
   */
  magiComponents: {
    federalAgi: number
    nontaxableSocialSecurity: number
    taxExemptInterest: number
    foreignExclusionAddback: number
    requiredFilerDependentMagi: number
  }
  fplRegion: 'contiguous' | 'alaska' | 'hawaii' | null
  /**
   * The poverty line for the contract's tax family and region, published
   * whenever there is a contract with a tax family and the coverage year has
   * its own published ACA figures (params/acaCoverageYears.ts), priced quote
   * or not, whether or not that year's income-tax figures are projected;
   * null without a contract, with an empty tax family, and in a coverage year
   * with no published ACA figures (2028 and later today), where no
   * inflation-scaled line is exposed as evidence.
   */
  federalPovertyLine: number | null
  /** MAGI as a percentage of the poverty line, from the priced quote; null when none is priced. */
  fplPct: number | null
  taxFamilySize: number | null
  taxFamilyMembers: Array<{
    personId: string
    relationship: 'primary' | 'spouse' | 'dependent'
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
    includedMagi: number
  }>
  coveredMembers: Array<{
    personId: string
    coveredMonths: number[]
    grossEnrollmentPremium: number
    applicableSlcspPremium: number
  }>
  /** Σ over the 12 months of every covered member's enrollment premium for the month. */
  grossEnrollmentPremium: number
  /**
   * Σ over the 12 months of each covered member's SLCSP benchmark premium,
   * counting a month only when that member's enrollment premium for it is
   * above 0; null without an ACA contract or when the example contract's
   * inputs mismatch.
   */
  applicableSlcspPremium: number | null
  /** Current-year planning result; not actual APTC cash/refund/balance-due reconciliation. */
  modeledAllowablePtc: number | null
  /**
   * The premium the plan pays after the credit: healthcare less healthcare
   * excluding enrollment, so the gross premium on a gross-premium fallback.
   */
  economicNetPremium: number
  aptcModeled: false
  form8962ReconciliationSupported: false
  cliffState: 'below-eligibility-floor' | 'below-cliff' | 'at-cliff' | 'above-cliff' | 'unsupported'
  /**
   * converged certifies a priced credit's fixed point (the year is
   * actionable, the solve converged and no fixed-point failure was raised);
   * it is false in a non-actionable year even when the funding solve
   * converged, which the absence of a fixed-point-nonconvergent code shows.
   * grossPremiumFallback is true exactly when the year is not actionable
   * and the gross premium is budgeted.
   */
  convergence: {
    converged: boolean
    iterations: number
    maxIterations: number
    residualDollars: number
    grossPremiumFallback: boolean
  }
}
