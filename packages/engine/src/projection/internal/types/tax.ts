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
 * QSS uses the joint tax tables, deduction, and AMT exemption. IRMAA is the
 * exception: SSA's threshold tables group qualifying surviving spouses with
 * single/HOH filers (POMS HI 01101.020), so the Medicare premium calculation
 * maps QSS to `single` instead of using this helper.
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
   * Income excluded from AGI under the foreign and possessions exclusions —
   * §911 foreign earned income and housing, and §931/§933 possessions income
   * (American Samoa, Guam, the Northern Marianas, Puerto Rico), which is not
   * "foreign earned" in the §911 sense but is excluded all the same. The engine
   * carries one figure for all of them.
   *
   * It is not ordinary taxable income and never enters the AGI line, but three
   * separate definitions reach past AGI to pick it back up: IRC §86 puts it
   * into Social Security provisional income, §1411(d) and
   * §151(d)(5)(C)(iii)(II) put it into the modified AGI that prices the NIIT
   * threshold and the senior-deduction phase-out, and ACA household MAGI
   * carries it too. Omitting it therefore understates tax and overstates the
   * senior deduction at once — supply it whenever the household claims any of
   * those exclusions, not only when Social Security is in play.
   */
  foreignExclusionAddback?: number
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
 * Pluggable tax computation. V1 ships a flat placeholder; the real federal
 * engine (roadmap V2) implements the same interface.
 */
export interface TaxCalculator {
  compute(input: TaxYearInput): number
}
