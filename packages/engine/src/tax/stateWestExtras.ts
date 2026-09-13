/**
 * West / mountain leaf helpers: HI HOH brackets, ID retirement, MT LTCG,
 * OR credit, UT credits, VA military/SS, VT rates/minimum/retirement.
 */

import { stateParamsFor, type StateTaxParams } from '../params/state/index.js'
import {
  emptyLeafAdjustment,
  isMilitarySource,
  isRailroadSource,
  type StateFilingStatusExtended,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

/** Local bracket shape to avoid importing params cycle into fact module. */
export interface StateBracket {
  lowerBound: number
  ratePct: number
  baseTax?: number
}

function bracketTax(brackets: StateBracket[], taxable: number): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!
    const lower = bracket.lowerBound
    const upper = i + 1 < brackets.length ? brackets[i + 1]!.lowerBound : Infinity
    if (taxable <= lower) break
    const marginal = (Math.min(taxable, upper) - lower) * (bracket.ratePct / 100)
    if (bracket.baseTax !== undefined) tax = bracket.baseTax + marginal
    else tax += marginal
  }
  return tax
}

/** Hawaii published HOH schedule (must not reuse MFJ). */
export const HAWAII_HOH_BRACKETS_2026: StateBracket[] = [
  { lowerBound: 0, ratePct: 1.4 },
  { lowerBound: 14_400, ratePct: 3.2 },
  { lowerBound: 21_600, ratePct: 5.5 },
  { lowerBound: 28_800, ratePct: 6.4 },
  { lowerBound: 36_000, ratePct: 6.8 },
  { lowerBound: 54_000, ratePct: 7.2 },
  { lowerBound: 72_000, ratePct: 7.6 },
  { lowerBound: 187_500, ratePct: 7.9 },
  { lowerBound: 262_500, ratePct: 8.25 },
  { lowerBound: 337_500, ratePct: 9 },
  { lowerBound: 412_500, ratePct: 10 },
  { lowerBound: 487_500, ratePct: 11 },
]

export function hawaiiTaxForStatus(args: {
  filingStatus: StateFilingStatusExtended
  taxableIncome: number
  singleBrackets: StateBracket[]
  mfjBrackets: StateBracket[]
  hohBrackets?: StateBracket[]
}): number {
  if (args.filingStatus === 'headOfHousehold') {
    return bracketTax(args.hohBrackets ?? HAWAII_HOH_BRACKETS_2026, args.taxableIncome)
  }
  if (args.filingStatus === 'single' || args.filingStatus === 'marriedFilingSeparately') {
    return bracketTax(args.singleBrackets, args.taxableIncome)
  }
  return bracketTax(args.mfjBrackets, args.taxableIncome)
}

/** Idaho §63-3022A TY2026 caps derived from SSA maximum FRA benefit method. */
export const ID_CAP_SINGLE_2026 = 49_824
export const ID_CAP_JOINT_2026 = 74_736

export function idahoQualifiedRetirementDeduction(args: {
  filingStatus: StateFilingStatusExtended
  qualifyingFederallyIncludedBenefits: number
  householdGrossSocialSecurity: number
  householdGrossRailroadBenefits: number
  factsProveQualifyingPlan: boolean
  caps?: { single: number; joint: number }
}): StateLeafAdjustment {
  if (args.filingStatus === 'marriedFilingSeparately') return emptyLeafAdjustment()
  if (!args.factsProveQualifyingPlan) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'id-3022a-plan-unproven',
          ruleId: 'idaho-63-3022a-qualified-retirement',
          message: 'Idaho §63-3022A deduction withheld without qualifying plan/source proof.',
          missingFacts: ['sourceKind', 'planSystemCode'],
        },
      ],
    }
  }
  const caps = args.caps ?? { single: ID_CAP_SINGLE_2026, joint: ID_CAP_JOINT_2026 }
  const statusCap =
    args.filingStatus === 'marriedFilingJointly' || args.filingStatus === 'qualifyingSurvivingSpouse'
      ? caps.joint
      : caps.single
  const available = Math.max(
    0,
    statusCap - Math.max(0, args.householdGrossSocialSecurity) - Math.max(0, args.householdGrossRailroadBenefits),
  )
  const deduction = Math.min(available, Math.max(0, args.qualifyingFederallyIncludedBenefits))
  return { taxableIncomeDelta: deduction === 0 ? 0 : -deduction, taxCredit: 0, warnings: [] }
}

/** Montana LTCG schedule: 3.0% then 4.1%, ordinary income fills lower band first. */
export const MT_LTCG_LOWER_RATE = 0.03
export const MT_LTCG_UPPER_RATE = 0.041
export const MT_LTCG_THRESHOLD_SINGLE = 47_500
export const MT_LTCG_THRESHOLD_HOH = 71_250
export const MT_LTCG_THRESHOLD_JOINT = 95_000

export function montanaLtcgTax(args: {
  filingStatus: 'single' | 'marriedFilingJointly' | 'headOfHousehold' | 'marriedFilingSeparately'
  ordinaryTaxableIncome: number
  netTaxableLtcg: number
  config?: {
    lowerRate: number
    upperRate: number
    thresholdSingle: number
    thresholdHoh: number
    thresholdJoint: number
  }
}): number {
  const cfg = args.config ?? stateParamsFor('MT', 2026)?.montanaLtcg
  if (!cfg) throw new Error('Missing versioned Montana capital gains parameters')
  const threshold =
    args.filingStatus === 'marriedFilingJointly'
      ? cfg.thresholdJoint
      : args.filingStatus === 'headOfHousehold'
        ? cfg.thresholdHoh
        : cfg.thresholdSingle
  const lowerCapacity = Math.max(0, threshold - Math.max(0, args.ordinaryTaxableIncome))
  const gain = Math.max(0, args.netTaxableLtcg)
  const lowGain = Math.min(gain, lowerCapacity)
  const highGain = Math.max(0, gain - lowGain)
  return lowGain * cfg.lowerRate + highGain * cfg.upperRate
}

/** Oregon ORS 316.157 retirement income credit. */
export function oregonRetirementIncomeCredit(args: {
  recipientAgeYears: number
  qualifyingPension: number
  householdSocialSecurityAndTier1: number
  householdIncome: number
  joint: boolean
  precreditOregonTax: number
  config?: {
    rate: number
    pensionCeilingSingle: number
    pensionCeilingJoint: number
    incomeThresholdSingle: number
    incomeThresholdJoint: number
  }
}): StateLeafAdjustment {
  if (args.recipientAgeYears < 62) return emptyLeafAdjustment()
  const cfg = args.config ?? stateParamsFor('OR', 2026)?.oregonRetirementIncomeCredit
  if (!cfg) return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'or-credit-pack-missing', message: 'Oregon retirement credit requires the versioned parameter pack.', missingFacts: ['oregonRetirementIncomeCredit'] }] }

  const pensionCeiling = args.joint ? cfg.pensionCeilingJoint : cfg.pensionCeilingSingle
  const incomeThreshold = args.joint ? cfg.incomeThresholdJoint : cfg.incomeThresholdSingle
  const netPension = Math.min(
    Math.max(0, args.qualifyingPension),
    Math.max(
      0,
      pensionCeiling -
        Math.max(0, args.householdSocialSecurityAndTier1) -
        Math.max(0, args.householdIncome - incomeThreshold),
    ),
  )
  const credit = Math.min(Math.max(0, args.precreditOregonTax), cfg.rate * netPension)
  return { taxableIncomeDelta: 0, taxCredit: credit, warnings: [] }
}

/** Utah military retirement credit §59-10-1043 at the pack tax rate. */
export function utahMilitaryRetirementCredit(args: {
  federallyIncludedMilitaryRetirement: number
  taxRate: number
  /** Compatibility-only: liability belongs to return-level selection now. */
  precreditUtahTax?: number
}): StateLeafAdjustment {
  return { taxableIncomeDelta: 0, taxCredit: args.taxRate * Math.max(0, args.federallyIncludedMilitaryRetirement), warnings: [] }
}

/**
 * Utah Social Security credit: rate × federally included SS, capped at liability.
 * Mutual exclusion with military/retirement credits is handled by
 * `utahSelectNonrefundableCredit`.
 */
export function utahSocialSecurityCredit(args: {
  socialSecurityIncludedInUtahTaxableIncome: number | undefined
  utahMagi: number | undefined
  filingStatus: StateFilingStatusExtended | undefined
  config?: {
    taxRate: number
    phaseoutRate: number
    socialSecurityThresholds: Record<StateFilingStatusExtended, number>
  }
  /** Deprecated pre-2026 shape; insufficient for an exact statutory result. */
  federallyIncludedSocialSecurity?: number
  precreditUtahTax?: number
  taxRate?: number
}): StateLeafAdjustment {
  if (!args.config) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-ss-credit-pack-missing', ruleId: 'ut-59-10-1042-social-security-credit', message: 'Utah Social Security credit requires the versioned 2026 statutory pack and MAGI facts.', missingFacts: ['utahRetirementCredits', 'utahMagi'] }] }
  }
  if (args.socialSecurityIncludedInUtahTaxableIncome === undefined || args.utahMagi === undefined || !args.filingStatus) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-ss-credit-incomplete', ruleId: 'ut-59-10-1042-social-security-credit', message: 'Utah Social Security credit requires Utah taxable SS, statutory MAGI, and filing status.', missingFacts: ['socialSecurityIncludedInUtahTaxableIncome', 'utahMagi', 'stateFilingStatus'] }] }
  }
  const threshold = args.config.socialSecurityThresholds[args.filingStatus]
  const raw = args.config.taxRate * Math.max(0, args.socialSecurityIncludedInUtahTaxableIncome)
  const phaseout = args.config.phaseoutRate * Math.max(0, args.utahMagi - threshold)
  return { taxableIncomeDelta: 0, taxCredit: Math.max(0, raw - phaseout), warnings: [] }
}

/** Utah §59-10-1019 general retirement credit, one MAGI phaseout per return. */
export function utahRetirementCredit(args: {
  claimantDatesOfBirth: readonly string[] | undefined
  utahMagi: number | undefined
  filingStatus: StateFilingStatusExtended | undefined
  config?: {
    phaseoutRate: number
    retirementThresholds: Record<StateFilingStatusExtended, number>
    retirementCreditPerEligibleClaimant: number
    latestEligibleBirthDate: string
  }
  /** Deprecated pre-2026 shape; retained solely so old callers receive a typed incomplete result. */
  qualifyingRetirementIncluded?: number
  recipientAgeYears?: number
  minAge?: number
  precreditUtahTax?: number
  taxRate?: number
}): StateLeafAdjustment {
  if (!args.config) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-retirement-credit-pack-missing', ruleId: 'ut-59-10-1019-general-retirement-credit', message: 'Utah retirement credit requires the versioned 2026 statutory pack and exact birth-date facts.', missingFacts: ['utahRetirementCredits', 'claimantDatesOfBirth'] }] }
  }
  if (args.claimantDatesOfBirth === undefined || args.utahMagi === undefined || !args.filingStatus) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-retirement-credit-incomplete', ruleId: 'ut-59-10-1019-general-retirement-credit', message: 'Utah general retirement credit requires exact claimant dates of birth, statutory MAGI, and filing status.', missingFacts: ['claimantDatesOfBirth', 'utahMagi', 'stateFilingStatus'] }] }
  }
  if (args.claimantDatesOfBirth.some((dob) => !/^\d{4}-\d{2}-\d{2}$/.test(dob))) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-retirement-credit-dob-inexact', ruleId: 'ut-59-10-1019-general-retirement-credit', message: 'Utah retirement-credit cohort eligibility requires exact ISO birth dates.', missingFacts: ['claimantDatesOfBirth'] }] }
  }
  const config = args.config
  const eligible = args.claimantDatesOfBirth.filter((dob) => dob <= config.latestEligibleBirthDate).length
  const raw = config.retirementCreditPerEligibleClaimant * eligible
  const phaseout = config.phaseoutRate * Math.max(0, args.utahMagi - config.retirementThresholds[args.filingStatus])
  return { taxableIncomeDelta: 0, taxCredit: Math.max(0, raw - phaseout), warnings: [] }
}

/**
 * Utah nonrefundable credit mutual exclusion: military credit cannot be claimed
 * with the ordinary retirement credit. Default selects the larger current-year
 * lawful credit unless an explicit election is supplied.
 */
export function utahSelectNonrefundableCredit(args: {
  militaryCredit: number
  retirementCredit: number
  socialSecurityCredit?: number
  retirementComplete?: boolean
  socialSecurityAndMilitaryComplete?: boolean
  election?: 'retirement' | 'socialSecurityAndMilitary' | 'auto' | 'military' | 'larger'
  apportionment?: number
  precreditUtahTax: number
}): StateLeafAdjustment {
  const needsRetirement = args.election !== 'socialSecurityAndMilitary' && args.election !== 'military'
  const needsSsMilitary = args.election !== 'retirement'
  if ((needsRetirement && args.retirementComplete === false) || (needsSsMilitary && args.socialSecurityAndMilitaryComplete === false)) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ut-credit-election-incomplete', message: 'Utah credit election requires complete facts for every compared alternative; an unavailable credit is not zero.', missingFacts: [ ...(needsRetirement && args.retirementComplete === false ? ['retirementCreditAlternative'] : []), ...(needsSsMilitary && args.socialSecurityAndMilitaryComplete === false ? ['socialSecurityAndMilitaryAlternative'] : []) ] }] }
  }
  const liability = Math.max(0, args.precreditUtahTax)
  const retirement = Math.max(0, args.retirementCredit)
  const ssAndMilitary = Math.max(0, args.socialSecurityCredit ?? 0) + Math.max(0, args.militaryCredit)
  const chosen = args.election === 'retirement'
    ? retirement
    : args.election === 'socialSecurityAndMilitary' || args.election === 'military'
      ? ssAndMilitary
      : Math.max(retirement, ssAndMilitary)
  const apportionment = args.apportionment === undefined ? 1 : Math.max(0, Math.min(1, args.apportionment))
  const total = Math.min(liability, chosen * apportionment)
  return { taxableIncomeDelta: 0, taxCredit: total, warnings: [] }
}

/** Utah Railroad Retirement subtraction of federally included Tier I/II. */
export function utahRailroadSubtraction(facts: readonly StateRetirementDistributionFact[]): StateLeafAdjustment {
  let total = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
      warnings.push({ code: 'ut-rrb-source-unknown', ruleId: 'ut-code-59-10-114-2-d-railroad-benefits', message: 'Unclassified retirement income cannot establish Railroad Retirement Act eligibility.', missingFacts: ['sourceKind'] })
      continue
    }
    if (!isRailroadSource(fact.sourceKind)) continue
    if (!Number.isFinite(fact.federallyIncludedAmount) || fact.federallyIncludedAmount < 0 || (fact.grossDistribution !== undefined && fact.federallyIncludedAmount > fact.grossDistribution)) {
      warnings.push({ code: 'ut-rrb-inclusion-inconsistent', ruleId: 'ut-code-59-10-114-2-d-railroad-benefits', message: 'Included Railroad Retirement Act benefits must be known and no larger than benefits paid.', missingFacts: ['federallyIncludedAmount', 'grossDistribution'] })
      continue
    }
    total += fact.federallyIncludedAmount
  }
  return { taxableIncomeDelta: total === 0 ? 0 : -total, taxCredit: 0, warnings }
}

/** Utah prior-taxed §401(a) subtraction. */
export function utahPriorTaxed401aSubtraction(args: {
  qualifiedPlanType?: StateRetirementDistributionFact['qualifiedPlanType']
  sourceKind?: StateRetirementDistributionFact['sourceKind']
  federallyIncluded: number
  documentedRemainingOtherStateTaxedContribution: number | undefined
}): StateLeafAdjustment {
  if (args.qualifiedPlanType !== '401a') {
    return emptyLeafAdjustment()
  }
  if (args.documentedRemainingOtherStateTaxedContribution === undefined) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'ut-401a-basis-unknown',
          ruleId: 'utah-prior-taxed-401a',
          message: 'Utah prior-taxed §401(a) subtraction fails closed without contribution tax-history.',
          missingFacts: ['documentedOtherStateTaxed401aBasis'],
        },
      ],
    }
  }
  const sub = Math.min(
    Math.max(0, args.federallyIncluded),
    Math.max(0, args.documentedRemainingOtherStateTaxedContribution),
  )
  return { taxableIncomeDelta: -sub, taxCredit: 0, warnings: [] }
}

/** Virginia military retirement subtraction per recipient (pack cap; TY2025+ $40,000). */
export function virginiaMilitarySubtraction(
  facts: readonly StateRetirementDistributionFact[],
  capPerPerson = 40_000,
): StateLeafAdjustment {
  const byOwner = new Map<string, number>()
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    if (!isMilitarySource(fact.sourceKind)) {
      if (fact.sourceKind === 'unknownPublic') {
        warnings.push({
          code: 'va-military-unknown-public',
          ruleId: 'va-58-1-322-02-18-military',
          message: 'Virginia military subtraction withheld for unknown public source.',
          missingFacts: ['sourceKind'],
        })
      }
      continue
    }
    byOwner.set(
      fact.ownerPersonId,
      (byOwner.get(fact.ownerPersonId) ?? 0) + Math.max(0, fact.federallyIncludedAmount),
    )
  }
  let total = 0
  for (const amount of byOwner.values()) total += Math.min(capPerPerson, amount)
  return { taxableIncomeDelta: total === 0 ? 0 : -total, taxCredit: 0, warnings }
}

/** Virginia §58.1-322.02(3) SS + Tier I subtraction. */
export function virginiaSsTier1Subtraction(args: {
  federallyIncludedSocialSecurity: number
  federallyIncludedRailroadTier1: number
}): number {
  return Math.max(0, args.federallyIncludedSocialSecurity) + Math.max(0, args.federallyIncludedRailroadTier1)
}

/** Virginia prior-state-taxed basis recovery under §58.1-322.02(11). */
export function virginiaPriorStateBasisSubtraction(args: {
  enumeratedPlan: boolean
  federallyIncluded: number
  knownPriorStateTaxedBasis: number | undefined
}): StateLeafAdjustment {
  if (!args.enumeratedPlan) return emptyLeafAdjustment()
  if (args.knownPriorStateTaxedBasis === undefined) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'va-prior-basis-unknown',
          ruleId: 'va-58-1-322-02-11',
          message: 'Virginia paragraph (11) subtraction is zero when prior-state basis is unknown.',
          missingFacts: ['knownPreviouslyTaxedBasis'],
        },
      ],
    }
  }
  const sub = Math.min(Math.max(0, args.federallyIncluded), Math.max(0, args.knownPriorStateTaxedBasis))
  return { taxableIncomeDelta: -sub, taxCredit: 0, warnings: [] }
}

/** Vermont TY2026 derived thresholds (Act 11 CPI method; see vt-supplement). */
export const VERMONT_TY2026 = {
  singleThresholds: [50_750, 122_850, 256_300],
  mfjThresholds: [84_700, 204_750, 312_050],
  mfsThresholds: [42_350, 102_375, 156_025],
  hohThresholds: [68_000, 175_500, 284_150],
  rates: [3.35, 6.6, 7.6, 8.75],
  standardDeduction: {
    single: 7_850,
    marriedFilingSeparately: 7_850,
    headOfHousehold: 11_800,
    marriedFilingJointly: 15_700,
    qualifyingSurvivingSpouse: 15_700,
  } as Record<StateFilingStatusExtended, number>,
  personalExemption: 5_400,
  additional63f: 1_300,
}

export function vermontBracketsFor(status: StateFilingStatusExtended): StateBracket[] {
  const t =
    status === 'headOfHousehold'
      ? VERMONT_TY2026.hohThresholds
      : status === 'marriedFilingSeparately'
        ? VERMONT_TY2026.mfsThresholds
        : status === 'single'
          ? VERMONT_TY2026.singleThresholds
          : VERMONT_TY2026.mfjThresholds
  const r = VERMONT_TY2026.rates
  return [
    { lowerBound: 0, ratePct: r[0]! },
    { lowerBound: t[0]!, ratePct: r[1]! },
    { lowerBound: t[1]!, ratePct: r[2]! },
    { lowerBound: t[2]!, ratePct: r[3]! },
  ]
}

export function vermontOrdinaryTax(status: StateFilingStatusExtended, taxableIncome: number): number {
  return bracketTax(vermontBracketsFor(status), taxableIncome)
}

/** §5822(a)(6) 3% federal-AGI minimum when AGI > $150,000. */
export function vermontMinimumTaxComparison(args: {
  config?: StateTaxParams['vermontExtras']
  ordinaryTax: number
  federalAgi: number | undefined
  usObligationAdjustment: number | undefined
}): StateLeafAdjustment & { tax: number } {
  if (args.federalAgi === undefined || args.usObligationAdjustment === undefined) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      tax: args.ordinaryTax,
      warnings: [
        {
          code: 'vt-minimum-tax-incomplete',
          ruleId: 'vt-5822-a-6-minimum-tax',
          message: 'Vermont 3% minimum-tax comparison incomplete without federal AGI and U.S.-obligation adjustment.',
          missingFacts: ['federalAgi', 'usObligationAdjustment'],
        },
      ],
    }
  }
  const config = args.config ?? stateParamsFor('VT', 2026)?.vermontExtras
  if (!config) return { taxableIncomeDelta: 0, taxCredit: 0, tax: args.ordinaryTax, warnings: [{ code: 'vt-minimum-tax-pack-missing', message: 'Vermont minimum-tax parameters unavailable.', missingFacts: ['vermontExtras'] }] }
  if (args.federalAgi <= config.minimumTaxAgiThreshold) {
    return { taxableIncomeDelta: 0, taxCredit: 0, tax: args.ordinaryTax, warnings: [] }
  }
  const minimum = config.minimumTaxRate * args.federalAgi - args.usObligationAdjustment
  return {
    taxableIncomeDelta: 0,
    taxCredit: 0,
    tax: Math.max(args.ordinaryTax, minimum),
    warnings: [],
  }
}

/**
 * Vermont §5830e civil-service / other contributory exclusion with continuous
 * AGI phaseout. Mutually exclusive with the SS/other §5830e(a)-(c) family;
 * military under (d) may coexist.
 */
export function vermontCivilServiceExclusion(args: {
  joint: boolean
  federalAgi: number
  includedAmount: number
  config?: {
    civilServiceCap: number
    civilServiceFullThroughNonjoint: number
    civilServiceZeroAtNonjoint: number
    civilServiceFullThroughJoint: number
    civilServiceZeroAtJoint: number
  }
}): number {
  const cfg = args.config ?? stateParamsFor('VT', 2026)?.vermontExtras
  if (!cfg) throw new Error('Missing versioned Vermont retirement parameters')
  const amount = Math.min(cfg.civilServiceCap, Math.max(0, args.includedAmount))
  const fullThrough = args.joint ? cfg.civilServiceFullThroughJoint : cfg.civilServiceFullThroughNonjoint
  const zeroAt = args.joint ? cfg.civilServiceZeroAtJoint : cfg.civilServiceZeroAtNonjoint
  if (args.federalAgi <= fullThrough) return amount
  if (args.federalAgi >= zeroAt) return 0
  const span = zeroAt - fullThrough
  const factor = (zeroAt - args.federalAgi) / span
  return amount * factor
}

export function vermontMilitaryExclusion(args: {
  federalAgi: number
  includedAmount: number
  config?: { militaryFullThrough: number; militaryZeroAt: number }
}): number {
  const fullThrough = args.config?.militaryFullThrough ?? 125_000
  const zeroAt = args.config?.militaryZeroAt ?? 175_000
  const included = Math.max(0, args.includedAmount)
  if (args.federalAgi <= fullThrough) return included
  if (args.federalAgi >= zeroAt) return 0
  const factor = (zeroAt - args.federalAgi) / (zeroAt - fullThrough)
  return included * factor
}

export function vermontRailroadExclusion(facts: readonly StateRetirementDistributionFact[]): number {
  let total = 0
  for (const fact of facts) {
    if (isRailroadSource(fact.sourceKind)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}

export function utahOrVirginiaMilitaryFromFacts(facts: readonly StateRetirementDistributionFact[]): number {
  let total = 0
  for (const fact of facts) {
    if (isMilitarySource(fact.sourceKind)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}
