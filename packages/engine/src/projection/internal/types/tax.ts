/**
 * Filing status as the projection carries it, and the annual tax-calculator
 * input contract.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type { FilingStatus } from '../../../params/types.js'

export type ProjectedFilingStatus = FilingStatus | 'qualifyingSurvivingSpouse'

/**
 * For federal law, QSS uses the joint tax tables, standard deduction, and AMT
 * exemption. State parameter selection reuses this mapping wholesale. Delaware's
 * `de-pit-est-2026-qss-standard-deduction-joint-mapper` discloses the QSS-to-joint
 * standard-deduction approximation; other states require jurisdiction-specific
 * authority before assuming a different mapping. IRMAA is the named
 * federal exception: SSA's threshold tables group qualifying surviving spouses with
 * single/HOH filers (POMS HI 01101.020), so the Medicare premium calculation maps
 * QSS to `single` instead of using this helper.
 */
export function taxParameterFilingStatus(status: ProjectedFilingStatus): FilingStatus {
  return status === 'single' ? 'single' : 'marriedFilingJointly'
}

export interface TaxYearInput {
  year: number
  filingStatus: ProjectedFilingStatus
  /** Wages, traditional withdrawals, pension/annuity taxable parts, taxable recurring/one-time income. */
  ordinaryIncome: number
  /** Signed realized long-term capital result; losses are negative. */
  capitalGains: number
  /** Raw signed capital result before federal carryforward netting; used by nonconforming states. */
  realizedCapitalGainsBeforeCarryforward?: number
  /** Taxable interest generated in taxable brokerage accounts (already included in ordinaryIncome). */
  taxableInterestIncome?: number
  /**
   * Federally tax-exempt interest. Not ordinary income, but included in Social
   * Security provisional income and program-specific ACA household MAGI. May be
   * contract-supplied (ACA attestation) or account-generated from taxable
   * brokerage `taxExemptInterestYieldPct`.
   */
  taxExemptInterest?: number
  /**
   * Broad foreign-exclusion addback excluded from AGI under §911 foreign earned
   * income and housing and §931/§933 possessions income (American Samoa, Guam,
   * the Northern Marianas, Puerto Rico). The engine carries one nonnegative
   * figure for all of them. It is not ordinary taxable income and never enters
   * the AGI line. When omitted, `computeFederalTax` defaults this broad addback
   * to zero for senior MAGI and Social Security provisional income. The NIIT
   * addback defaults to zero only when neither this field nor
   * `niitSection911A1NetAddback` is supplied. Supply this field
   * whenever the household claims §§911, 931, or 933 exclusions, not only when
   * Social Security is in play. IRC §86 puts a foreign-exclusion amount into
   * Social Security provisional income; §151(d)(5)(C)(iii)(II) uses this
   * broader addback for the senior-deduction phase-out; ACA household MAGI
   * carries a foreign addback too. This field does not certify eligibility for
   * exclusions under §§911, 931, or 933 or deductions allocable under
   * §911(d)(6). See irc-1411-d-modified-agi-foreign-exclusion-addback.
   */
  foreignExclusionAddback?: number
  /**
   * Optional §1411(d) net addback: §911(a)(1) excluded earned income less
   * §911(d)(6) allocable reductions, supplied as a characterized amount for the
   * NIIT threshold leg only. When omitted, `computeFederalTax` reuses
   * `foreignExclusionAddback` as a compatibility approximation. An explicit
   * zero is honored and does not fall back. The calculator accepts the amount;
   * it does not determine exclusion eligibility or gross/net certification.
   */
  niitSection911A1NetAddback?: number
  /**
   * Interest on U.S. government obligations (TIPS ladder coupons + inflation
   * accretion), already included in ordinaryIncome AND taxableInterestIncome.
   * Federal tax applies in full (incl. NIIT); every state exempts it, so the
   * state calculator subtracts it from state taxable income.
   */
  usGovernmentInterest?: number
  /** Non-qualified dividends generated in taxable brokerage accounts (already included in ordinaryIncome). */
  ordinaryDividends?: number
  /** Qualified dividends taxed at preferential federal rates but included in AGI/MAGI. */
  qualifiedDividends?: number
  /** Gross Social Security benefits received. */
  ssBenefits: number
  /** Living household members aged 65+ this year (drives age-based deductions). */
  peopleAged65Plus: number
  /** State of residence this year (two-letter code); drives state tax. */
  state?: string
  /** Part-year state residency allocation for the tax year. */
  stateResidency?: { state: string; months: number }[]
  /**
   * Portion of ordinaryIncome that is retirement income (pension + annuity
   * taxable part + traditional/RMD distributions, excluding Roth conversions),
   * for state retirement-income exclusions. Federal tax ignores this.
   */
  retirementIncome?: number
  /**
   * Private retirement income eligible for the state's private retirement rule.
   * Replaces retirementIncome; the legacy field remains accepted by calculators.
   */
  privateRetirementIncome?: number
  /** Public civil/military pension income eligible for the state's public pension rule. */
  publicPensionIncome?: number
  /** Ages of living household members this year, for age-based state exclusions. */
  agesAlive?: number[]
  /**
   * Itemized-deduction components in nominal dollars (roadmap V8). When present,
   * federal tax uses the greater of the standard deduction and the itemized
   * total. SALT is the user's estimated deductible state/local/property tax
   * (kept as an input to avoid a circular dependency on the computed state tax).
   */
  itemizedDeductions?: {
    stateAndLocalTaxes: number
    mortgageInterest: number
    charitable: number
  }
  /**
   * Advanced calculator-only AMT preference/adjustment items. Projection does
   * not populate this from Plan fields today; the federal tax calculator already
   * derives standard-deduction and itemized-SALT add-backs from normal inputs.
   */
  amtPreferenceItems?: number
  /**
   * Cumulative general-inflation factor from the parameter pack's year to this
   * one, used to project the annually-indexed federal figures (rate brackets,
   * standard deduction, capital-gain breakpoints, AMT amounts) onto a year the
   * pack only stands in for. 1 -- the default -- means "use the pack as
   * published", which is right for a year that has its own pack.
   *
   * The projection is nominal, so omitting this measures inflated income
   * against frozen thresholds and invents bracket creep the statute does not
   * create. Unindexed figures (sections 86, 1411, 121, 1211(b), 151(d)(5)(C),
   * and the 164(b)(7) SALT schedule) ignore it by construction.
   */
  inflationScale?: number
}

/**
 * Pluggable tax computation, supplied by the caller — this package exports the
 * pieces but no composed default. RetireGolden builds one by combining
 * createFederalTaxCalculator() with createStateTaxCalculator() through
 * combineTaxCalculators(); test suites inject deterministic doubles through the
 * same interface.
 */
export interface TaxCalculator {
  compute(input: TaxYearInput): number
}
