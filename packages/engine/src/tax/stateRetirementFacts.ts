/**
 * Characterized retirement / state-special tax facts for state leaf helpers.
 *
 * Production Plan and projection adapters are integrator-owned. These types are
 * the state-runtime contract: helpers accept them directly and never invent
 * source identity from aggregate private/public buckets.
 *
 * Naming note: the integration shared-contract proposal uses `StateIncomeKind`
 * / `StateIncomeComponent`. `mapStateIncomeComponent` below is the adapter from
 * those proposal names into this leaf vocabulary (`ownerPersonId` means the
 * current recipient for age and per-person limits).
 */

/** Shared-contract proposal income kinds (integrator Plan emission). */
export type StateIncomeKind =
  | 'privatePension'
  | 'ira'
  | 'qualifiedPlan401'
  | 'plan403b'
  | 'plan457b'
  | 'federalCivilService'
  | 'publicContributory'
  | 'publicNoncontributory'
  | 'militaryRetirement'
  | 'militarySurvivor'
  | 'governmentSurvivor'
  | 'railroadTier1'
  | 'railroadTier2'
  | 'railroadLumpSum'
  | 'railroadRetirementAct'
  | 'other'

/**
 * Known money versus unavailable. Missing/unknown must never become a silent
 * known-zero in contribution, wage-inclusion, or basis paths.
 */
export type KnownMoney = { known: true; amount: number } | { known: false }

export function knownMoney(amount: number): KnownMoney {
  return { known: true, amount }
}

export function unknownMoney(): KnownMoney {
  return { known: false }
}

export function isKnownMoney(value: KnownMoney | undefined): value is { known: true; amount: number } {
  return value !== undefined && value.known === true && Number.isFinite(value.amount)
}

export interface StateIncomeComponent {
  id: string
  ownerId: string
  recipient: 'primary' | 'spouse'
  amount: number
  federalIncludedAmount: number
  recipientAgeAtDistribution?: number
  ageAtYearEnd?: number
  kind: StateIncomeKind
  planSystemCode?: string
  distributionReason?: 'normal' | 'early' | 'disability' | 'death' | 'survivor'
  isPeriodic?: boolean
  decedentWouldQualify?: boolean
  survivorInsurableInterest?: boolean
  /** Government survivor issuer required for the District N(ii) exclusion. */
  survivorIssuer?: 'dc' | 'federal' | 'other' | 'unknown'
  jurisdictionalFacts?: {
    earlyDistributionCode?: string
    previouslyTaxedBasis?: number
    priorTaxState?: string
    disabilityCertified?: boolean
    reciprocitySatisfied?: boolean
    /** Exact plan identity; generic employer plan is deliberately insufficient for UT §401(a). */
    qualifiedPlanType?: '401a' | '401k' | '403b' | '457b' | 'ira' | 'other' | 'unknown'
    /** Massachusetts public pension source characterization. */
    publicPlanContributory?: boolean
    /** WV/CO source-specific survivor and public-system evidence. */
    deathOrDisabilitySurvivorUnder55?: boolean
  }
}

export type StateRetirementSourceKind =
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

export type StateRetirementCause = 'ordinary' | 'disability' | 'death' | 'earlyDistributionCode1' | 'unknown'

export type TriState = 'true' | 'false' | 'unknown'

export interface StateRetirementDistributionFact {
  eventId?: string
  accountId?: string
  accountTaxTreatment?: 'traditional' | 'roth'
  earningsNotCoveredBySocialSecurity?: boolean
  grossDistribution?: number
  idahoEmploymentRequiresFederalReturn?: boolean
  ownerPersonId: string
  sourceKind: StateRetirementSourceKind
  /** Federally included taxable amount for the year. */
  federallyIncludedAmount: number
  /** Recipient age at year end. */
  recipientAgeYears: number
  /** `false` prevents a missing age being interpreted as a known age zero. */
  recipientAgeKnown?: boolean
  /** Fractional age at distribution when a statute uses distribution age (AR 59½). */
  ageAtDistributionYears?: number
  minimumAgeAtDistributionYears?: number
  cause: StateRetirementCause
  earlyDistributionDisqualifier: TriState
  planSystemCode?: string
  survivorIssuer?: 'dc' | 'federal' | 'other' | 'unknown'
  decedentWouldQualify?: boolean
  survivorInsurableInterest?: boolean
  knownPreviouslyTaxedBasis?: number
  recipientDisabled?: boolean
  survivorSpouse?: boolean
  decedentAgeYears?: number
  publicPlanContributory?: boolean
  reciprocitySatisfied?: TriState
  priorTaxState?: string
  qualifiedPlanType?: '401a' | '401k' | '403b' | '457b' | 'ira' | 'other' | 'unknown'
  deathOrDisabilitySurvivorUnder55?: boolean
  /** Characterized share of federally taxable Social Security for state per-recipient caps. */
  taxableSocialSecurityAllocated?: number
}

export type StateFilingStatusExtended =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifyingSurvivingSpouse'

export interface StateHouseholdTaxFacts {
  recipientSocialSecurity?: readonly { ownerPersonId: string; ageYears?: number; grossSocialSecurity: number; federallyIncludedSocialSecurity?: number; grossRailroadTier1: number; federallyIncludedRailroadTier1?: number }[]
  stateFilingStatus?: StateFilingStatusExtended
  federalAgi?: number
  /** Connecticut AGI is a separate state worksheet line, never federal AGI by proxy. */
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
  /** Exact DOBs are necessary for Utah's 1952-12-31 cohort test. */
  claimantDatesOfBirth?: readonly string[]
  interestExcludedFromFederalAgi?: number
  utahSection59_10_114Additions?: number
  socialSecurityIncludedInUtahTaxableIncome?: number
  railroadRetirementActBenefitsPaid?: number
  railroadRetirementActBenefitsIncludedInFederalAgi?: number
  /** SS-equivalent RRA amount already removed by Utah Code §59-10-114(2)(d). */
  railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome?: number
  /** §59-10-1002.2 percentage, already characterized as 0..1. */
  utahCreditApportionment?: number
  /** Iowa statutory test-net-income when complete special-base facts exist. */
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
  /** Wisconsin: taxpayer claimed as a dependent elsewhere → no personal exemption. */
  claimedAsDependent?: boolean
  /** Montana net taxable long-term capital gain (after federal/state netting). */
  montanaNetTaxableLtcg?: number
  /** Vermont U.S.-obligation adjustment for §5822(a)(6) minimum tax. */
  vermontUsObligationAdjustment?: number
  /** Wisconsin income used for standard-deduction phase-down when distinct from taxable proxy. */
  wisconsinIncomeForStandardDeduction?: number
  /** Vermont §5830e election; SS and civil-service alternatives cannot be combined. */
  vermontRetirementElection?: 'civilService' | 'socialSecurity'
  /** Owner-attributed inputs for SC §1170(B) and WV §11-21-12(c)(9). */
  ownerStateTaxFacts?: ReadonlyArray<{
    ownerPersonId: string
    recipientAgeYears?: number
    remainingScIncome?: number
    westVirginiaEligibleAge65OrDisabled?: boolean
    westVirginiaSurvivorEligible?: boolean
    westVirginiaRemainingFederalAgiIncome?: number
    westVirginiaPriorNamedModifications?: number
  }>
}

/**
 * One HSA account / owner / year. Missing collection on options means
 * unavailable; empty array means known-no activity.
 */
export interface StateHsaAccountYearFacts {
  accountId: string
  ownerPersonId: string
  federalHsaDeduction: KnownMoney
  employerContributionExcludedFederally: KnownMoney
  /**
   * Portion of the employer/salary-reduction contribution already present in
   * the NJ (or other non-AGI) wage base. Unknown must not default to zero.
   */
  employerContributionAlreadyInStateWages: KnownMoney
  interest: KnownMoney
  dividends: KnownMoney
  realizedGains: KnownMoney
  /** CA may provide realized gains through state-basis lots instead of an aggregate. */
  californiaAssetDispositions?: ReadonlyArray<{ proceeds: number; californiaLotBasis: number }>
  unrealizedAppreciation: KnownMoney
  qualifiedCashWithdrawals: KnownMoney
  /**
   * Federally included nonqualified HSA distribution amount actually present in
   * the state starting ordinary-income base (CA Schedule CA line 8f).
   */
  nonqualifiedDistributionFederalAmount: KnownMoney
  /** Actual nonqualified cash removed from this state-basis pool. */
  nonqualifiedCashWithdrawals?: KnownMoney
  /** Opening state-keyed basis for the account/year. */
  stateBasisBeforeYear: KnownMoney
  /** Utah / cross-state previously taxed §401(a) contribution remainder (ledger). */
  documentedOtherStateTaxed401aBasis?: KnownMoney
  /**
   * NJ lot-level asset dispositions recognized this year. Gain =
   * max(0, proceeds − njLotBasis). Cash withdrawal is not a second income event.
   */
  njAssetDispositions?: ReadonlyArray<{ proceeds: number; njLotBasis: number }>
  /**
   * When true, annual category activity (interest/dividends/gains) is known
   * complete even if individual KnownMoney fields are zero. When false/omitted
   * and any required money fact is unknown, the leaf returns incomplete.
   */
  annualActivityComplete?: boolean
}

/** @deprecated Prefer StateHsaAccountYearFacts[]; retained for transitional callers. */
export interface StateHsaYearFacts {
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

export type StateDirectQcdPolicyKind =
  | 'conforms'
  | 'conformsWithAdoptedCap'
  | 'noGeneralFederalExclusion'
  | 'unknown'

export type StateDirectQcdPolicy =
  | {
      kind: 'conforms'
      citation: string
      effectiveTaxYears?: { from: number; to?: number }
      authoritySourceIds?: readonly string[]
      supportedTransactionKinds?: readonly string[]
      charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
    }
  | {
      kind: 'conformsWithAdoptedCap'
      annualCap: number
      citation: string
      adoptionCutoff?: string
      effectiveTaxYears?: { from: number; to?: number }
      authoritySourceIds?: readonly string[]
      supportedTransactionKinds?: readonly string[]
      charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
    }
  | {
      kind: 'noGeneralFederalExclusion'
      citation: string
      effectiveTaxYears?: { from: number; to?: number }
      authoritySourceIds?: readonly string[]
      supportedTransactionKinds?: readonly string[]
      charitableCreditAdjustment?: 'none' | 'coveredCreditAddback'
    }
  | { kind: 'unknown' }

/**
 * One direct-QCD event. Annual AR caps aggregate across events for the same
 * ownerPersonId. Policy is taken from the state pack, never from this row.
 */
export interface StateQcdEventFacts {
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
  /**
   * QCD amount already applied against this owner's adopted annual cap earlier
   * in the same tax year (other accounts/events not in this collection).
   */
  priorAnnualQcdAmountUsed?: number
  /** Otherwise-taxable amount eligible under adopted QCD rules; defaults to federalExcludedAmount. */
  otherwiseTaxableAmount?: number
  directTransfer: boolean
  /** Kansas covered charitable-credit modification for this same transfer. */
  kansasCoveredCharitableCreditClaimed?: boolean
}

/**
 * New Jersey GIT Worksheet C annual IRA owner pool. Reconstruct before applying
 * QCD / other distribution taxable ratios. Unknown unrecovered basis ⇒ incomplete.
 */
export interface StateNjIraOwnerPoolFacts {
  annualInputsComplete?: boolean
  ownerPersonId: string
  /**
   * December 31 IRA value including qualifying post-year contributions through
   * the ordinary filing deadline when the worksheet so provides.
   */
  december31IraValue: number
  /** Sum of all IRA distributions during the tax year (including QCD transfers). */
  allAnnualDistributions: number
  /** Unrecovered previously NJ-taxed contributions. Unknown ⇒ incomplete. */
  unrecoveredNjTaxedContributions: KnownMoney
  exemptObligationIncome?: number
  fullLiquidation: boolean
}

/** @deprecated Prefer StateQcdEventFacts[] + StateNjIraOwnerPoolFacts. */
export interface StateQcdYearFacts {
  ownerPersonId: string
  grossIraDistribution: number
  directCharityTransfer: number
  federalExcludedAmount: number
  federalTaxableAmount: number
  federalBasisAllocated: number
  stateBasisFactsKnown: boolean
  stateBasisRecovery: number
  residency: 'fullYearResident' | 'fullYearNonresident' | 'partYear' | 'unknown'
  /** Ignored when pack policy is present — pack is authoritative. */
  policy: StateDirectQcdPolicy
  splitInterest: boolean
  december31IraValue?: number
  allAnnualDistributions?: number
  unrecoveredNjTaxedContributions?: number
  fullLiquidation?: boolean
  priorAnnualQcdAmountUsed?: number
}

export interface StateTaxExactnessWarning {
  code: string
  ruleId?: string
  message: string
  missingFacts: string[]
}

export interface StateLeafAdjustment {
  /** Signed addition to state taxable income (negative = exclusion/subtraction). */
  taxableIncomeDelta: number
  /** Nonrefundable credit against computed state tax. */
  taxCredit: number
  warnings: StateTaxExactnessWarning[]
}

export function emptyLeafAdjustment(): StateLeafAdjustment {
  return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [] }
}

export function mergeLeafAdjustments(parts: readonly StateLeafAdjustment[]): StateLeafAdjustment {
  let taxableIncomeDelta = 0
  let taxCredit = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const part of parts) {
    taxableIncomeDelta += part.taxableIncomeDelta
    taxCredit += part.taxCredit
    warnings.push(...part.warnings)
  }
  // Normalize negative zero from summing empty exclusions.
  if (Object.is(taxableIncomeDelta, -0)) taxableIncomeDelta = 0
  if (Object.is(taxCredit, -0)) taxCredit = 0
  return { taxableIncomeDelta, taxCredit, warnings }
}

export function isMilitarySource(kind: StateRetirementSourceKind): boolean {
  return kind === 'militaryRetirement' || kind === 'militarySurvivor'
}

export function isRailroadSource(kind: StateRetirementSourceKind): boolean {
  return kind === 'railroadTier1' || kind === 'railroadTier2' || kind === 'railroadRetirementAct'
}

export function sumIncluded(
  facts: readonly StateRetirementDistributionFact[],
  predicate: (f: StateRetirementDistributionFact) => boolean,
): number {
  let total = 0
  for (const fact of facts) {
    if (predicate(fact)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}

function mapIncomeKind(kind: StateIncomeKind): StateRetirementSourceKind {
  switch (kind) {
    case 'privatePension':
      return 'ordinaryPrivatePension'
    case 'ira':
      return 'ira'
    case 'qualifiedPlan401':
    case 'plan403b':
    case 'plan457b':
      return 'employerPlan'
    case 'federalCivilService':
      return 'federalCivilService'
    case 'publicContributory':
    case 'publicNoncontributory':
      return 'stateLocalPublic'
    case 'militaryRetirement':
      return 'militaryRetirement'
    case 'militarySurvivor':
      return 'militarySurvivor'
    case 'governmentSurvivor':
      return 'governmentSurvivor'
    case 'railroadTier1':
      return 'railroadTier1'
    case 'railroadTier2':
    case 'railroadLumpSum':
      return 'railroadTier2'
    case 'railroadRetirementAct':
      return 'railroadRetirementAct'
    case 'other':
      return 'unknownPublic'
  }
}

function mapCause(
  reason: StateIncomeComponent['distributionReason'],
  earlyCode: string | undefined,
): StateRetirementCause {
  if (earlyCode === '1') return 'earlyDistributionCode1'
  if (reason === 'disability') return 'disability'
  if (reason === 'death' || reason === 'survivor') return 'death'
  if (reason === 'early') return 'earlyDistributionCode1'
  if (reason === undefined) return 'unknown'
  return 'ordinary'
}

/**
 * Adapter from the shared-contract `StateIncomeComponent` into leaf facts.
 * `ownerPersonId` is the current recipient (payee) for age / per-person limits.
 */
export function mapStateIncomeComponent(component: StateIncomeComponent): StateRetirementDistributionFact {
  const earlyCode = component.jurisdictionalFacts?.earlyDistributionCode
  return {
    ownerPersonId: component.ownerId,
    sourceKind: mapIncomeKind(component.kind),
    federallyIncludedAmount: component.federalIncludedAmount,
    recipientAgeYears: component.ageAtYearEnd ?? component.recipientAgeAtDistribution ?? 0,
    recipientAgeKnown: component.ageAtYearEnd !== undefined || component.recipientAgeAtDistribution !== undefined,
    ageAtDistributionYears: component.recipientAgeAtDistribution,
    cause: mapCause(component.distributionReason, earlyCode),
    earlyDistributionDisqualifier:
      earlyCode === '1' || component.distributionReason === 'early'
        ? 'true'
        : earlyCode === '7' || component.distributionReason === 'normal'
          ? 'false'
          : 'unknown',
    planSystemCode: component.planSystemCode,
    survivorIssuer: component.survivorIssuer,
    decedentWouldQualify: component.decedentWouldQualify,
    survivorInsurableInterest: component.survivorInsurableInterest,
    knownPreviouslyTaxedBasis: component.jurisdictionalFacts?.previouslyTaxedBasis,
    recipientDisabled: component.jurisdictionalFacts?.disabilityCertified,
    survivorSpouse: component.distributionReason === 'survivor',
    publicPlanContributory: component.jurisdictionalFacts?.publicPlanContributory ?? (component.kind === 'publicContributory' ? true : component.kind === 'publicNoncontributory' ? false : undefined),
    reciprocitySatisfied: component.jurisdictionalFacts?.reciprocitySatisfied === undefined
      ? 'unknown'
      : component.jurisdictionalFacts.reciprocitySatisfied ? 'true' : 'false',
    priorTaxState: component.jurisdictionalFacts?.priorTaxState,
    qualifiedPlanType: component.jurisdictionalFacts?.qualifiedPlanType ?? (
      component.kind === 'qualifiedPlan401' ? '401k'
        : component.kind === 'plan403b' ? '403b'
          : component.kind === 'plan457b' ? '457b'
            : component.kind === 'ira' ? 'ira' : undefined
    ),
    deathOrDisabilitySurvivorUnder55: component.jurisdictionalFacts?.deathOrDisabilitySurvivorUnder55,
  }
}

export function mapStateIncomeComponents(
  components: readonly StateIncomeComponent[] | undefined,
): StateRetirementDistributionFact[] | undefined {
  if (components === undefined) return undefined
  return components.map(mapStateIncomeComponent)
}

/** Bridge legacy aggregate HSA facts into the account-row shape. */
export function legacyHsaToAccountFacts(
  facts: StateHsaYearFacts,
  ids: { accountId?: string; ownerPersonId?: string } = {},
): StateHsaAccountYearFacts {
  return {
    accountId: ids.accountId ?? 'legacy-hsa',
    ownerPersonId: ids.ownerPersonId ?? 'legacy-owner',
    federalHsaDeduction: knownMoney(facts.federalHsaDeduction),
    employerContributionExcludedFederally: knownMoney(facts.employerContributionExcludedFederally),
    employerContributionAlreadyInStateWages:
      facts.employerContributionAlreadyInStateWages === undefined
        ? (facts.employerContributionExcludedFederally === 0 ? knownMoney(0) : unknownMoney())
        : knownMoney(facts.employerContributionAlreadyInStateWages),
    interest: knownMoney(facts.interest),
    dividends: knownMoney(facts.dividends),
    realizedGains: knownMoney(facts.realizedGains),
    unrealizedAppreciation: knownMoney(facts.unrealizedAppreciation),
    qualifiedCashWithdrawals: knownMoney(facts.qualifiedCashWithdrawals),
    nonqualifiedDistributionFederalAmount:
      facts.nonqualifiedDistributionFederalAmount === undefined
        ? unknownMoney()
        : knownMoney(facts.nonqualifiedDistributionFederalAmount),
    nonqualifiedCashWithdrawals: unknownMoney(),
    stateBasisBeforeYear: knownMoney(facts.stateBasisBeforeYear),
    documentedOtherStateTaxed401aBasis:
      facts.documentedOtherStateTaxed401aBasis === undefined
        ? undefined
        : knownMoney(facts.documentedOtherStateTaxed401aBasis),
    njAssetDispositions: facts.njAssetDispositions,
    // A number-shaped legacy row cannot certify a complete annual ledger when
    // either historically optional category was omitted. Keep that uncertainty
    // visible rather than pairing `known: false` money with a complete flag.
    annualActivityComplete:
      (facts.employerContributionAlreadyInStateWages !== undefined || facts.employerContributionExcludedFederally === 0) &&
      facts.nonqualifiedDistributionFederalAmount !== undefined,
  }
}
