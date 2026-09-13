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
   * Broad foreign-exclusion addback excluded from AGI under Â§911 foreign earned
   * income and housing and Â§931/Â§933 possessions income (American Samoa, Guam,
   * the Northern Marianas, Puerto Rico). The engine carries one nonnegative
   * figure for all of them. It is not ordinary taxable income and never enters
   * the AGI line. When omitted, `computeFederalTax` defaults this broad addback
   * to zero for senior MAGI and Social Security provisional income. The NIIT
   * addback defaults to zero only when neither this field nor
   * `niitSection911A1NetAddback` is supplied. Supply this field
   * whenever the household claims Â§Â§911, 931, or 933 exclusions, not only when
   * Social Security is in play. IRC Â§86 puts a foreign-exclusion amount into
   * Social Security provisional income; Â§151(d)(5)(C)(iii)(II) uses this
   * broader addback for the senior-deduction phase-out; ACA household MAGI
   * carries a foreign addback too. This field does not certify eligibility for
   * exclusions under Â§Â§911, 931, or 933 or deductions allocable under
   * Â§911(d)(6). See irc-1411-d-modified-agi-foreign-exclusion-addback.
   */
  foreignExclusionAddback?: number
  /**
   * Optional Â§1411(d) net addback: Â§911(a)(1) excluded earned income less
   * Â§911(d)(6) allocable reductions, supplied as a characterized amount for the
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
  /**
   * Characterized retirement distributions for state limbs. Missing means
   * characterization unavailable (legacy private/public aggregates apply);
   * an empty array asserts no characterized events. Structurally mirrors
   * `tax/stateRetirementFacts.StateRetirementDistributionFact`.
   */
  stateRetirementDistributions?: readonly StateRetirementDistributionFactInput[]
  /** Optional household facts a jurisdiction may need; missing members are unknown. */
  stateHouseholdFacts?: StateHouseholdTaxFactsInput
  /**
   * Optional HSA account/year facts. Missing collection means unavailable;
   * empty array means known no HSA activity. Prefer `stateHsaAccountYearFacts`
   * (KnownMoney). Legacy `stateHsaYearFacts` remains for transitional callers.
   */
  stateHsaAccountYearFacts?: readonly StateHsaAccountYearFactsInput[]
  /** @deprecated Prefer stateHsaAccountYearFacts with KnownMoney members. */
  stateHsaYearFacts?: StateHsaYearFactsInput
  /**
   * Direct QCD events for the year. Pack policy is authoritative — never a
   * persisted Plan override. Missing collection means unavailable; empty means
   * no QCD events.
   */
  stateQcdEventFacts?: readonly StateQcdEventFactsInput[]
  /** @deprecated Prefer stateQcdEventFacts; pack policy overwrites any row policy. */
  stateQcdYearFacts?: readonly StateQcdYearFactsInput[]
  /** NJ GIT Worksheet C owner pools when reconstructing QCD / IRA taxable ratios. */
  stateNjIraOwnerPools?: readonly StateNjIraOwnerPoolFactsInput[]
}

/** Structural mirror of `tax/stateRetirementFacts.StateRetirementDistributionFact`. */
export interface StateRetirementDistributionFactInput {
  /** Same physical event ID links taxable character to its QCD gross ledger. */
  eventId?: string
  accountTaxTreatment?: 'traditional' | 'roth'
  earningsNotCoveredBySocialSecurity?: boolean
  grossDistribution?: number
  ownerPersonId: string
  /** Original source owner, distinct from the current recipient/payee. */
  sourceOwnerPersonId?: string
  accountId?: string
  sourceKind:
    | 'ordinaryPrivatePension'
    | 'ira'
    | 'employerPlan'
    | 'militaryRetirement'
    | 'militarySurvivor'
    | 'federalCivilService'
    | 'stateLocalPublic'
    | 'railroadTier1'
    | 'railroadTier2'
    | 'railroadRetirementAct'
    | 'governmentSurvivor'
    | 'unknownPublic'
    | 'unknownPrivate'
  federallyIncludedAmount: number
  recipientAgeYears: number
  recipientAgeKnown?: boolean
  /** Proven lower bound for an undated event occurring within this tax year. */
  minimumAgeAtDistributionYears?: number
  ageAtDistributionYears?: number
  cause: 'ordinary' | 'disability' | 'death' | 'earlyDistributionCode1' | 'unknown'
  earlyDistributionDisqualifier: 'true' | 'false' | 'unknown'
  planSystemCode?: string
  survivorIssuer?: 'dc' | 'federal' | 'other' | 'unknown'
  decedentWouldQualify?: boolean
  decedentAgeYears?: number
  survivorInsurableInterest?: boolean
  knownPreviouslyTaxedBasis?: number
  recipientDisabled?: boolean
  idahoEmploymentRequiresFederalReturn?: boolean
  survivorSpouse?: boolean
  publicPlanContributory?: boolean
  reciprocitySatisfied?: 'true' | 'false' | 'unknown'
  priorTaxState?: string
  qualifiedPlanType?: '401a' | '401k' | '403b' | '457b' | 'ira' | 'other' | 'unknown'
  deathOrDisabilitySurvivorUnder55?: boolean
  taxableSocialSecurityAllocated?: number
}

export interface StateHouseholdTaxFactsInput {
  /** Actual people included on the current state return; excludes deceased nonclaimants. */
  claimantPersonIds?: readonly string[]
  recipientSocialSecurity?: readonly { ownerPersonId: string; ageYears?: number; grossSocialSecurity: number; federallyIncludedSocialSecurity?: number; grossRailroadTier1: number; federallyIncludedRailroadTier1?: number }[]
  stateFilingStatus?:
    | 'single'
    | 'marriedFilingJointly'
    | 'marriedFilingSeparately'
    | 'headOfHousehold'
    | 'qualifyingSurvivingSpouse'
  federalAgi?: number
  connecticutAgi?: number
  federalDeductionUsed?: number
  federalTaxableIncome?: number
  exemptionTaxpayerCount?: number
  exemptionDependentCount?: number
  age65EligibleCount?: number
  section63fQualificationCount?: number
  federalExemptionCount?: { known: true; value: number } | { known: false }
  zeroFederalExemptionReason?: 'irc151d2' | 'other' | 'unknown'
  survivingSpouseQualification?: { deathYear: number; remarried: boolean }
  householdGrossSocialSecurity?: number
  householdGrossRailroadBenefits?: number
  federallyIncludedSocialSecurity?: number
  federallyIncludedRailroadTier1?: number
  precreditStateTax?: number
  utahCreditElection?: 'retirement' | 'socialSecurityAndMilitary' | 'auto'
  claimantDatesOfBirth?: readonly string[]
  interestExcludedFromFederalAgi?: number
  utahSection59_10_114Additions?: number
  socialSecurityIncludedInUtahTaxableIncome?: number
  railroadRetirementActBenefitsPaid?: number
  railroadRetirementActBenefitsIncludedInFederalAgi?: number
  railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome?: number
  utahCreditApportionment?: number
  iowaTestNetIncome?: number
  iowaCombinedSpouseTestNetIncome?: number
  iowaSpouseTaxableIncome?: number
  iowaSpouseNolCarryElection?: boolean
  iowaClaimedAsDependent?: boolean
  iowaClaimantTestNetIncome?: number
  iowaClaimantJointThreshold?: boolean
  iowaSeniorForThreshold?: boolean
  missouriIncome?: number
  oregonHouseholdIncome?: number
  claimedAsDependent?: boolean
  montanaNetTaxableLtcg?: number
  vermontUsObligationAdjustment?: number
  wisconsinIncomeForStandardDeduction?: number
  vermontRetirementElection?: 'civilService' | 'socialSecurity'
  ownerStateTaxFacts?: readonly {
    ownerPersonId: string
    recipientAgeYears?: number
    remainingScIncome?: number
    westVirginiaEligibleAge65OrDisabled?: boolean
    westVirginiaSurvivorEligible?: boolean
    westVirginiaRemainingFederalAgiIncome?: number
    westVirginiaPriorNamedModifications?: number
  }[]
}

/** Known money versus unavailable — unknown must never become silent known-zero. */
export type KnownMoneyInput = { known: true; amount: number } | { known: false }

export interface StateHsaAccountYearFactsInput {
  accountId: string
  ownerPersonId: string
  federalHsaDeduction: KnownMoneyInput
  employerContributionExcludedFederally: KnownMoneyInput
  employerContributionAlreadyInStateWages: KnownMoneyInput
  interest: KnownMoneyInput
  dividends: KnownMoneyInput
  realizedGains: KnownMoneyInput
  unrealizedAppreciation: KnownMoneyInput
  qualifiedCashWithdrawals: KnownMoneyInput
  nonqualifiedCashWithdrawals?: KnownMoneyInput
  nonqualifiedDistributionFederalAmount: KnownMoneyInput
  stateBasisBeforeYear: KnownMoneyInput
  documentedOtherStateTaxed401aBasis?: KnownMoneyInput
  /** NJ lot-level asset dispositions; cash withdrawal is not a second income event. */
  njAssetDispositions?: ReadonlyArray<{ proceeds: number; njLotBasis: number }>
  californiaAssetDispositions?: ReadonlyArray<{ proceeds: number; californiaLotBasis: number }>
  annualActivityComplete?: boolean
}

/** @deprecated Prefer StateHsaAccountYearFactsInput. */
export interface StateHsaYearFactsInput {
  federalHsaDeduction: number
  employerContributionExcludedFederally: number
  employerContributionAlreadyInStateWages?: number
  interest: number
  dividends: number
  realizedGains: number
  unrealizedAppreciation: number
  qualifiedCashWithdrawals: number
  nonqualifiedDistributionFederalAmount?: number
  stateBasisBeforeYear: number
  documentedOtherStateTaxed401aBasis?: number
  njAssetDispositions?: ReadonlyArray<{ proceeds: number; njLotBasis: number }>
}

export type StateDirectQcdPolicyInput =
  | { kind: 'conforms'; citation: string }
  | { kind: 'conformsWithAdoptedCap'; annualCap: number; citation: string }
  | { kind: 'noGeneralFederalExclusion'; citation: string }
  | { kind: 'unknown' }

export interface StateQcdEventFactsInput {
  transferDate?: string
  transactionKind?: 'directQcd' | 'splitInterest' | 'other' | 'unknown'
  stateAllocation?: readonly { state: string; fraction: number }[]
  eventId: string
  accountId: string
  ownerPersonId: string
  grossIraDistribution: number
  directCharityTransfer: number
  federalExcludedAmount: number
  federalTaxableAmount: number
  federalBasisAllocated: number
  residency: 'fullYearResident' | 'fullYearNonresident' | 'partYear' | 'unknown'
  splitInterest: boolean
  priorAnnualQcdAmountUsed?: number
  otherwiseTaxableAmount?: number
  directTransfer?: boolean
  kansasCoveredCharitableCreditClaimed?: boolean
}

export interface StateNjIraOwnerPoolFactsInput {
  ownerPersonId: string
  /** False means at least one annual denominator/distribution component is unavailable. */
  annualInputsComplete?: boolean
  december31IraValue: number
  allAnnualDistributions: number
  unrecoveredNjTaxedContributions: KnownMoneyInput
  exemptObligationIncome?: number
  fullLiquidation: boolean
}

/** @deprecated Prefer StateQcdEventFactsInput + StateNjIraOwnerPoolFactsInput. */
export interface StateQcdYearFactsInput {
  ownerPersonId: string
  grossIraDistribution: number
  directCharityTransfer: number
  federalExcludedAmount: number
  federalTaxableAmount: number
  federalBasisAllocated: number
  stateBasisFactsKnown: boolean
  stateBasisRecovery: number
  residency: 'fullYearResident' | 'fullYearNonresident' | 'partYear' | 'unknown'
  policy: StateDirectQcdPolicyInput
  splitInterest: boolean
  december31IraValue?: number
  allAnnualDistributions?: number
  unrecoveredNjTaxedContributions?: number
  fullLiquidation?: boolean
  priorAnnualQcdAmountUsed?: number
}

export type TaxComputationIssueCode =
  | 'missing-state-filing-status'
  | 'missing-personal-exemption-facts'
  | 'unknown-retirement-source-or-eligibility'
  | 'missing-hsa-activity-or-basis'
  | 'missing-ira-basis'
  | 'unallocated-part-year-event'
  | 'unknown-state-qcd-policy'
  | 'unsupported-state-qcd-transaction'
  | 'inconsistent-state-basis'
  | 'incomplete-state-facts'

export interface TaxComputationIssue {
  code: TaxComputationIssueCode | string
  state?: string
  year?: number
  path?: string
  message: string
  missingFacts?: readonly string[]
  ruleId?: string
}

/**
 * Richer tax result. `amount` remains the legacy numeric view. Incomplete
 * means established facts were applied fail-closed; it must not be ranked as
 * exact by relocation/optimizer presentation.
 */
export interface StateHsaBasisPoolComputationResult {
  state: string
  accountId: string
  ownerPersonId: string
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisAdded?: number
  basisConsumed?: number
  closingBasis?: number
}

export interface StateNjIraBasisPoolComputationResult {
  state: 'NJ'
  ownerPersonId: string
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisConsumed?: number
  closingBasis?: number
}

export interface StatePensionBasisPoolComputationResult {
  state: string
  accountId: string
  ownerPersonId: string
  kind: 'pension' | 'eligiblePlan' | 'otherState401a'
  status: 'complete' | 'incomplete'
  openingBasis?: number
  basisConsumed?: number
  closingBasis?: number
}

export interface TaxComputationResult {
  amount: number
  status: 'complete' | 'incomplete'
  issues: readonly TaxComputationIssue[]
  hsaBasisPools?: readonly StateHsaBasisPoolComputationResult[]
  njIraBasisPools?: readonly StateNjIraBasisPoolComputationResult[]
  pensionBasisPools?: readonly StatePensionBasisPoolComputationResult[]
}

/**
 * Pluggable tax computation, supplied by the caller — this package exports the
 * pieces but no composed default. RetireGolden builds one by combining
 * createFederalTaxCalculator() with createStateTaxCalculator() through
 * combineTaxCalculators(); test suites inject deterministic doubles through the
 * same interface.
 *
 * `compute` stays the numeric compatibility path for injected doubles.
 * Optional `computeResult` carries exactness/status when a calculator provides it.
 */
export interface TaxCalculator {
  /** Return the exact enriched input used for calculation and accepted-year replay. */
  prepareInput?(input: TaxYearInput): TaxYearInput
  compute(input: TaxYearInput): number
  computeResult?(input: TaxYearInput): TaxComputationResult
}

/** Normalize a calculator call to a TaxComputationResult without inventing completeness. */
export function normalizeTaxComputation(
  calculator: TaxCalculator,
  input: TaxYearInput,
): TaxComputationResult {
  if (calculator.computeResult !== undefined) {
    return calculator.computeResult(input)
  }
  return {
    amount: calculator.compute(input),
    status: 'complete',
    issues: [],
  }
}
