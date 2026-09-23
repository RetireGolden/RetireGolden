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
  | 'guardrail-interaction-unsupported'
  | 'hsa-cap-fixed-point-nonconvergent'
  | 'conflicting-cliff-fixed-points'
  | 'fixed-point-nonconvergent'

export interface YearAcaResult {
  readiness: 'actionable' | 'nonActionable'
  supportCodes: AcaSupportCode[]
  /** Final return-year ACA household MAGI; null when material facts are unsupported. */
  householdMagi: number | null
  /**
   * The MAGI probe's parts, published whenever the year is ACA-active with a
   * contract, before pricing is refused: in a non-actionable year (a stand-in
   * tax year, for one) they are the inputs a credit would have been priced
   * on, not a household MAGI the engine vouches for, and householdMagi is
   * null beside them.
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
   * The poverty line the credit is priced on; null without a priced quote
   * and in a stand-in tax year, where no inflation-scaled line is exposed as
   * evidence (the guidelines for that coverage year are not published).
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
