/**
 * Annual parameter pack shape. One pack per tax year; values come from IRS,
 * SSA, CMS, and HHS releases each fall. Refreshing a year is a data-only PR.
 *
 * Sources and the meaning of each figure: DOCS/domain/domain-rules-reference.md.
 */

export type FilingStatus = 'single' | 'marriedFilingJointly'

/** One point on the TIPS par real-yield curve. */
export interface RealYieldCurvePoint {
  maturityYears: number
  /** Par real yield, percent per year (above inflation). */
  realYieldPct: number
}

/**
 * TIPS real-yield curve snapshot: the discount curve for ladder quotes and
 * essential-spending present values. Points sorted ascending by maturity;
 * the ladder engine interpolates linearly and holds the endpoints flat.
 */
export interface RealYieldCurve {
  /** Publication date of the yields (shown as "curve as of" in the UI). */
  asOfIso: string
  /** Human-readable provenance of the snapshot. */
  source: string
  points: RealYieldCurvePoint[]
}

/** Marginal bracket: `ratePct` applies to taxable income above `lowerBound`. */
export interface TaxBracket {
  lowerBound: number
  ratePct: number
}

export interface PerStatus<T> {
  single: T
  marriedFilingJointly: T
}

export interface IrmaaTier {
  /** Tier applies when MAGI (2-year lookback) exceeds this. */
  magiOver: PerStatus<number>
  /**
   * Statutory share of program cost (35/50/65/80/85). Standard premium is 25%,
   * so Part B total = partBStandardMonthly * applicablePct / 25.
   */
  applicablePct: number
  /** Published monthly Part D surcharge. null = not yet verified for this year. */
  partDSurchargeMonthly: number | null
}

export interface ParameterPack {
  year: number

  federalTax: {
    brackets: PerStatus<TaxBracket[]>
    standardDeduction: PerStatus<number>
    /** Additional standard deduction at 65+ (per qualifying person for MFJ). */
    age65Addition: PerStatus<number>
    /**
     * SALT (state + local + property tax) itemized-deduction cap. OBBBA raised it
     * to $40k for 2025 (+1%/yr through 2029, reverting to $10k in 2030). The
     * high-income (>$500k MAGI) phase-out toward a $10k floor is not modeled.
     */
    saltCap: number
    /**
     * Net capital loss deductible against ordinary income per year ($3,000;
     * $1,500 MFS — not modeled). Statutory, never indexed since 1978; the
     * remainder carries forward indefinitely.
     */
    capitalLossOrdinaryOffsetLimit: number
    /**
     * IRC §121 primary-residence gain exclusion caps ($250k single / $500k
     * joint). Statutory, unchanged since 1997 and never inflation-indexed —
     * do not apply limitScale/inflation projection to these.
     */
    section121Exclusion: PerStatus<number>
    /** OBBBA senior deduction (2025–2028): per person 65+, MAGI phase-out. */
    seniorDeduction: {
      amountPerPerson: number
      magiPhaseOutStart: PerStatus<number>
      phaseOutRatePct: number
      lastApplicableYear: number
    } | null
    /** Planning-grade individual AMT screen (Form 6251 thresholds). */
    amt: {
      exemption: PerStatus<number>
      exemptionPhaseOutStart: PerStatus<number>
      exemptionPhaseOutRatePct: number
      rate28StartsAbove: number
      rate26Pct: number
      rate28Pct: number
    }
  }

  capitalGains: {
    /** Taxable-income thresholds where the 15% and 20% LTCG rates begin. */
    rate15StartsAbove: PerStatus<number>
    rate20StartsAbove: PerStatus<number>
  }

  niit: {
    ratePct: number
    /** MAGI thresholds; statutorily unindexed. */
    magiThreshold: PerStatus<number>
  }

  /** Provisional-income thresholds for Social Security benefit taxation (unindexed). */
  ssBenefitTaxation: {
    tier50Start: PerStatus<number>
    tier85Start: PerStatus<number>
  }

  contributionLimits: {
    employee401k: number
    catchUp50: number
    /** SECURE 2.0 ages 60–63 "super" catch-up (replaces catchUp50). */
    superCatchUp60to63: number
    /** Prior-year FICA wages above this force catch-ups to be Roth. */
    rothCatchUpWageThreshold: number
    ira: number
    iraCatchUp50: number
    hsaSelfOnly: number
    hsaFamily: number
    hsaCatchUp55: number
    /** IRS Section 415(c)(1)(A) defined contribution total additions limit. */
    section415cLimit: number
  }

  rmd: {
    /** IRS Uniform Lifetime Table (Pub 590-B, 2022+): age -> divisor. */
    uniformLifetimeTable: Record<number, number>
    /** Annual QCD exclusion limit. */
    qcdAnnualLimit: number
  }

  /** Fixed-annuity purchase planning parameters (guaranteed-income depth). */
  annuities: {
    /**
     * QLAC (Qualified Longevity Annuity Contract) maximum premium that a
     * qualified purchase may exclude from the owner's RMD balances. SECURE 2.0
     * removed the 25%-of-balance limit, leaving a flat, inflation-indexed dollar
     * cap. Premium above the cap is not QLAC-eligible.
     */
    qlacPremiumCap: number
    /**
     * IRS Pub 939 Table V (ordinary life annuity, one life) expected-return
     * multiples: age at the annuity starting date → remaining life expectancy
     * in years. Used to derive the non-qualified exclusion ratio
     * (investment-in-contract ÷ expected return). Ages between table entries
     * interpolate linearly; ages outside the table clamp to the endpoints.
     */
    expectedReturnMultiples: Record<number, number>
  }

  /** HECM (reverse mortgage) planning parameters (annuity-pension-and-home-equity decisions). */
  hecm: {
    /**
     * Published principal-limit factors (percent of home value available as
     * the initial principal limit) by age of the youngest borrower, at the
     * expected rate below. Used only as the planning default when the user
     * has not entered a lender-quoted line size; ages between entries
     * interpolate linearly and ages outside clamp to the endpoints.
     */
    principalLimitFactorPctByAge: Record<number, number>
    /** Expected interest rate the factor table was published at (context for the UI). */
    plfExpectedRatePct: number
    /** Planning default for line/loan growth (note rate + annual MIP). */
    defaultGrowthRatePct: number
  }

  medicare: {
    partBStandardMonthly: number
    /** Ascending by threshold. */
    irmaaTiers: IrmaaTier[]
  }

  socialSecurity: {
    colaPct: number
    taxableWageBase: number
    /** Annual exempt amounts for the retirement earnings test. */
    earningsTestBelowFraAnnual: number
    earningsTestFraYearAnnual: number
    /**
     * Substantial Gainful Activity (SGA) monthly earnings limit for SSDI: wages
     * above this generally stop disability benefits. (Statutorily blind SGA is
     * higher; not modeled.) @see DOCS/domain/domain-rules-reference.md §4 SSDI
     */
    sgaMonthlyNonBlind: number
    /**
     * Employee-side OASDI payroll-tax rate (%). The employer pays the same again;
     * the self-employed pay double (12.4%). Used only for the "what you paid in
     * vs. what you get back" education readout (no working-years tax is modeled in
     * the projection). Statutory since 1990; applied uniformly over the career
     * (historical rate drift pre-1990 is a documented simplification).
     */
    oasdiEmployeeRatePct: number
  }

  /** HHS poverty guideline (48 contiguous states) used for ACA in this coverage year. */
  federalPovertyLine: {
    firstPerson: number
    perAdditionalPerson: number
  }

  /** ACA premium-tax-credit scale (post-2025: enhanced credits expired, 400% FPL cliff restored). */
  aca: {
    /**
     * Expected-contribution percentage of MAGI, piecewise-linear between
     * breakpoints sorted by fplPct. Income above maxFplPctForCredit gets no
     * credit at all (the cliff).
     */
    applicablePctBreakpoints: Array<{ fplPct: number; applicablePct: number }>
    maxFplPctForCredit: number
  }
}
