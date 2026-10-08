/**
 * Midwest leaf helpers: IL exemption, KS named plans, MO retirement, WI SD/exemptions, WV limbs.
 * Legal dollars come from the versioned state parameter pack when supplied.
 */

import type { StateTaxParams } from '../params/state/types.js'
import { stateParamsFor } from '../params/state/index.js'
import {
  emptyLeafAdjustment,
  isMilitarySource,
  isRailroadSource,
  type StateFilingStatusExtended,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

/** @deprecated Prefer pack.illinoisPersonalExemption. */
export const IL_BASIC_ALLOWANCE = 2_925
export const IL_AGE65_ADDITION = 1_000
export const IL_AGI_CUTOFF_NONJOINT = 250_000
export const IL_AGI_CUTOFF_JOINT = 500_000

export function illinoisPersonalExemptionAllowance(args: {
  federalAgi: number
  joint: boolean
  eligibleTaxpayerCount: number | undefined
  eligibleDependentCount: number | undefined
  age65EligibleCount: number | undefined
  config?: StateTaxParams['illinoisPersonalExemption']
}): StateLeafAdjustment {
  const cfg = args.config ?? stateParamsFor('IL', 2026)?.illinoisPersonalExemption
  if (!cfg) throw new Error('Missing versioned Illinois exemption parameters')
  const cutoff = args.joint ? cfg.agiCutoffJoint : cfg.agiCutoffNonjoint
  if (args.federalAgi > cutoff) return emptyLeafAdjustment()
  if (
    args.eligibleTaxpayerCount === undefined ||
    args.eligibleDependentCount === undefined ||
    args.age65EligibleCount === undefined
  ) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'il-exemption-counts-unknown',
          ruleId: 'il-personal-exemption-allowance',
          message: 'Illinois personal exemption fails closed when household counts/ages are missing.',
          missingFacts: ['exemptionTaxpayerCount', 'exemptionDependentCount', 'age65EligibleCount'],
        },
      ],
    }
  }
  const allowance =
    cfg.basicAllowance * (args.eligibleTaxpayerCount + args.eligibleDependentCount) +
    cfg.age65Addition * args.age65EligibleCount
  return { taxableIncomeDelta: -allowance, taxCredit: 0, warnings: [] }
}

/** @deprecated Prefer pack.kansasNamedPlanCodes. */
export const KANSAS_NAMED_PLAN_CODES_2026: ReadonlySet<string> = new Set([
  'KPERS',
  'KP&F',
  'KSRS',
  'US-CSRS',
  'US-FERS',
  'US-MILITARY',
  'RRB',
])

/**
 * The source kinds a named Kansas system can pay: public, federal civil
 * service, military and government survivor benefits. K.S.A. 79-32,117 names
 * retirement systems, so a private pension or an IRA gets no named-plan
 * subtraction whatever code it carries. An employer plan is decided by its
 * plan type: see KANSAS_EMPLOYER_PLAN_TYPES_NO_NAMED_SYSTEM.
 */
const KANSAS_NAMED_PLAN_SOURCE_KINDS: readonly StateRetirementDistributionFact['sourceKind'][] = [
  'stateLocalPublic',
  'federalCivilService',
  'militaryRetirement',
  'militarySurvivor',
  'governmentSurvivor',
]

/**
 * Employer-plan types no named Kansas system pays. Washburn University's
 * retirement plan, 79-32,117(c)(xix), is a 403(b), so a 403(b) row, or one
 * whose type is other, unknown or not given, can be a named system and needs
 * its code.
 */
const KANSAS_EMPLOYER_PLAN_TYPES_NO_NAMED_SYSTEM: readonly NonNullable<StateRetirementDistributionFact['qualifiedPlanType']>[] = [
  '401k',
  '401a',
  '457b',
  'ira',
]

/**
 * The named systems an employer-plan row can be: Washburn's 403(b) only. The
 * other codes name pensions, which are entered as pensions; on an employer
 * plan they subtract nothing.
 */
const KANSAS_EMPLOYER_PLAN_NAMED_CODES: ReadonlySet<string> = new Set(['KS-WASHBURN'])

/**
 * K.S.A. 79-32,117 named-plan subtraction for one characterized row. Railroad
 * Retirement Act annuities come off in full. A row of a kind no named system
 * pays (a private pension, an IRA, or a 401(k), 401(a) or 457(b) employer
 * plan) returns nothing and is not flagged, because no plan code could change
 * that. A public row without a code, a public row of unknown kind, and an
 * employer-plan row that could be Washburn's 403(b) with no code and a
 * nonzero amount are incomplete, with the warning code ks-plan-code-unknown.
 * An employer-plan row coded KS-WASHBURN is subtracted; any other code on one
 * subtracts nothing. A `militaryRetirement` row needs no code: the source
 * already names the system 79-32,117(c)(vii) names, service in the armed
 * forces, so it is read as US-MILITARY.
 */
export function kansasNamedPlanExclusion(
  fact: StateRetirementDistributionFact,
  namedCodes: ReadonlySet<string> | readonly string[] = KANSAS_NAMED_PLAN_CODES_2026,
): StateLeafAdjustment {
  const amount = Math.max(0, fact.federallyIncludedAmount)
  const codes = namedCodes instanceof Set ? namedCodes : new Set(namedCodes)
  if (isRailroadSource(fact.sourceKind)) {
    return { taxableIncomeDelta: amount === 0 ? 0 : -amount, taxCredit: 0, warnings: [] }
  }
  if (fact.sourceKind === 'employerPlan') {
    if (fact.qualifiedPlanType !== undefined && KANSAS_EMPLOYER_PLAN_TYPES_NO_NAMED_SYSTEM.includes(fact.qualifiedPlanType)) {
      return emptyLeafAdjustment()
    }
    if (amount === 0) return emptyLeafAdjustment()
  } else if (fact.sourceKind !== 'unknownPublic' && !KANSAS_NAMED_PLAN_SOURCE_KINDS.includes(fact.sourceKind)) {
    return emptyLeafAdjustment()
  }
  const planSystemCode = fact.planSystemCode ?? (fact.sourceKind === 'militaryRetirement' ? 'US-MILITARY' : undefined)
  if (fact.sourceKind === 'unknownPublic' || !planSystemCode) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [kansasPlanCodeWarning(fact)] }
  }
  if (!codes.has(planSystemCode)) {
    return emptyLeafAdjustment()
  }
  if (fact.sourceKind === 'employerPlan' && !KANSAS_EMPLOYER_PLAN_NAMED_CODES.has(planSystemCode)) {
    return emptyLeafAdjustment()
  }
  return { taxableIncomeDelta: amount === 0 ? 0 : -amount, taxCredit: 0, warnings: [] }
}

/**
 * ks-plan-code-unknown, listing the facts that clear it for this row. A
 * public row of unknown kind needs its source characterized (and its code,
 * when it has none); a declared 403(b) needs only its code; an employer plan
 * of other, unknown or undeclared type clears with a code or with a plan type
 * no named system pays; any other public row needs its code.
 */
function kansasPlanCodeWarning(fact: StateRetirementDistributionFact): StateTaxExactnessWarning {
  const warning = (message: string, missingFacts: string[]): StateTaxExactnessWarning => ({
    code: 'ks-plan-code-unknown',
    ruleId: 'ks-stat-79-32-117-public-pension-exclusion',
    message,
    missingFacts,
  })
  if (fact.sourceKind === 'unknownPublic') {
    return warning(
      'Kansas named-plan exclusion fails closed for a public pension of unknown source; the source decides whether a named system can pay it.',
      fact.planSystemCode ? ['sourceKind'] : ['sourceKind', 'planSystemCode'],
    )
  }
  if (fact.sourceKind === 'employerPlan') {
    return fact.qualifiedPlanType === '403b'
      ? warning('Kansas named-plan exclusion fails closed for a 403(b), which may be Washburn University\'s plan, without a statutory planSystemCode.', ['planSystemCode'])
      : warning('Kansas named-plan exclusion fails closed for an employer plan that may be Washburn University\'s 403(b) without a statutory planSystemCode or a 401(k), 401(a) or 457(b) plan type.', ['planSystemCode', 'qualifiedPlanType'])
  }
  return warning('Kansas named-plan exclusion fails closed without a statutory planSystemCode.', ['planSystemCode'])
}

/** @deprecated Prefer pack.missouriRetirement. */
export const MO_PUBLIC_MAX_SS_BENEFIT_2026 = 48_967
export const MO_PRIVATE_CAP = 6_000

export function missouriPrivatePensionDeduction(args: {
  filingStatus: StateFilingStatusExtended
  missouriIncome: number
  privatePension: number
  config?: StateTaxParams['missouriRetirement']
}): number {
  const cfg = args.config ?? stateParamsFor('MO', 2026)?.missouriRetirement
  if (!cfg) throw new Error('Missing versioned Missouri retirement parameters')
  const threshold =
    args.filingStatus === 'marriedFilingJointly' || args.filingStatus === 'qualifyingSurvivingSpouse'
      ? cfg.privatePhaseoutJoint
      : args.filingStatus === 'marriedFilingSeparately'
        ? cfg.privatePhaseoutMfs
        : cfg.privatePhaseoutSingle
  const base = Math.min(cfg.privateCap, Math.max(0, args.privatePension))
  if (args.missouriIncome <= threshold) return base
  return Math.max(0, base - (args.missouriIncome - threshold))
}

export function missouriPublicPensionDeduction(args: {
  publicPension: number
  socialSecuritySubtraction: number
  config?: StateTaxParams['missouriRetirement']
}): number {
  const maxSs = args.config?.publicMaxSocialSecurityBenefit ?? MO_PUBLIC_MAX_SS_BENEFIT_2026
  const cap = Math.max(0, maxSs - Math.max(0, args.socialSecuritySubtraction))
  return Math.min(Math.max(0, args.publicPension), cap)
}

/**
 * RSMo 143.121.3(12): one hundred percent of retirement benefits received as a
 * result of the taxpayer's own service in the armed forces, and the Railroad
 * Retirement Act annuities. A Survivor Benefit Plan annuity is not received
 * for the recipient's own service; it is a public pension under 143.124.5.
 */
export function missouriMilitaryAndRailroad(facts: readonly StateRetirementDistributionFact[]): number {
  let total = 0
  for (const fact of facts) {
    if (fact.sourceKind === 'militaryRetirement' || isRailroadSource(fact.sourceKind)) {
      total += Math.max(0, fact.federallyIncludedAmount)
    }
  }
  return total
}

/** TY2026 Form 1-ES page 2 default schedule when pack config is absent. */
export const WI_STANDARD_DEDUCTION_2026 = {
  single: {
    maximum: 13_960,
    fullThrough: 20_119,
    phaseStart: 20_120,
    phaseRate: 0.12,
    zeroAt: 136_453,
  },
  marriedFilingJointly: {
    maximum: 25_840,
    fullThrough: 29_039,
    phaseStart: 29_040,
    phaseRate: 0.19778,
    zeroAt: 159_690,
  },
  marriedFilingSeparately: {
    maximum: 12_280,
    fullThrough: 13_779,
    phaseStart: 13_780,
    phaseRate: 0.19778,
    zeroAt: 75_869,
  },
  headOfHousehold: {
    maximum: 18_030,
    fullThrough: 20_119,
    phaseStart: 20_120,
    phaseRate: 0.22515,
    secondSegmentStart: 58_827,
    zeroAt: 136_453,
  },
  exemptionPerPerson: 700,
  age65Addition: 250,
} as const

function wiSingleFormula(
  income: number,
  cfg: { maximum: number; fullThrough: number; phaseStart: number; phaseRate: number; zeroAt: number },
): number {
  if (income <= cfg.fullThrough) return cfg.maximum
  if (income >= cfg.zeroAt) return 0
  // Excess over phaseStart (Form 1-ES: income OVER the phase-start dollar).
  return Math.max(0, cfg.maximum - cfg.phaseRate * (income - cfg.phaseStart))
}

/**
 * Wisconsin TY2026 standard-deduction phase-down from Form 1-ES instructions
 * page 2. HOH uses a two-segment formula; after secondSegmentStart it follows
 * the single formula through the shared zero point.
 */
export function wisconsinStandardDeduction(args: {
  filingStatus: StateFilingStatusExtended
  wisconsinIncome: number
  config?: StateTaxParams['wisconsinStandardDeduction']
}): number {
  const income = Math.max(0, args.wisconsinIncome)
  const cfg = args.config ?? stateParamsFor('WI', 2026)?.wisconsinStandardDeduction
  if (!cfg) throw new Error('Missing versioned Wisconsin deduction parameters')

  if (args.filingStatus === 'single') {
    return wiSingleFormula(income, cfg.single)
  }

  if (args.filingStatus === 'marriedFilingJointly' || args.filingStatus === 'qualifyingSurvivingSpouse') {
    const row = cfg.marriedFilingJointly
    if (income <= row.fullThrough) return row.maximum
    if (income >= row.zeroAt) return 0
    return Math.max(0, row.maximum - row.phaseRate * (income - row.phaseStart))
  }

  if (args.filingStatus === 'marriedFilingSeparately') {
    const row = cfg.marriedFilingSeparately
    if (income <= row.fullThrough) return row.maximum
    if (income >= row.zeroAt) return 0
    return Math.max(0, row.maximum - row.phaseRate * (income - row.phaseStart))
  }

  // Head of household: first segment at HOH rate through secondSegmentStart,
  // then the single formula through the shared zeroAt.
  const hoh = cfg.headOfHousehold
  if (income <= hoh.fullThrough) return hoh.maximum
  if (income >= hoh.zeroAt) return 0
  if (income < hoh.secondSegmentStart) {
    return Math.max(0, hoh.maximum - hoh.phaseRate * (income - hoh.phaseStart))
  }
  return wiSingleFormula(income, cfg.single)
}

export function wisconsinPersonalExemption(args: {
  eligibleTaxpayerCount: number | undefined
  eligibleDependentCount: number | undefined
  age65EligibleCount: number | undefined
  claimedAsDependent: boolean
  config?: StateTaxParams['wisconsinStandardDeduction']
}): StateLeafAdjustment {
  if (args.claimedAsDependent) return emptyLeafAdjustment()
  if (
    args.eligibleTaxpayerCount === undefined ||
    args.eligibleDependentCount === undefined ||
    args.age65EligibleCount === undefined
  ) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'wi-exemption-counts-unknown',
          ruleId: 'wi-personal-exemptions',
          message: 'Wisconsin personal exemption fails closed when household counts are missing.',
          missingFacts: ['exemptionTaxpayerCount', 'exemptionDependentCount', 'age65EligibleCount'],
        },
      ],
    }
  }
  const per = args.config?.exemptionPerPerson ?? WI_STANDARD_DEDUCTION_2026.exemptionPerPerson
  const ageAdd = args.config?.age65Addition ?? WI_STANDARD_DEDUCTION_2026.age65Addition
  const amount = per * (args.eligibleTaxpayerCount + args.eligibleDependentCount) + ageAdd * args.age65EligibleCount
  return { taxableIncomeDelta: amount === 0 ? 0 : -amount, taxCredit: 0, warnings: [] }
}

/** @deprecated Prefer pack.westVirginiaExemptions. */
export const WV_DEFAULTS = {
  perExemption: 2_000,
  zeroExemptionIrc151d2: 500,
  survivingSpouseAdditional: 2_000,
  age65ResidualCap: 8_000,
  namedPublicCombinedCapPerPerson: 2_000,
} as const

/** West Virginia §11-21-16 exemptions. */
export function westVirginiaExemptions(args: {
  federalExemptionCount: { known: true; value: number } | { known: false } | undefined
  zeroFederalExemptionReason?: 'irc151d2' | 'other' | 'unknown'
  survivingSpouse?: { deathYear: number; taxYear: number; remarried: boolean }
  config?: StateTaxParams['westVirginiaExemptions']
}): StateLeafAdjustment {
  const cfg = args.config ?? stateParamsFor('WV', 2026)?.westVirginiaExemptions
  if (!cfg) throw new Error('Missing versioned West Virginia exemption parameters')
  if (!args.federalExemptionCount || args.federalExemptionCount.known === false) {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'wv-exemption-count-unknown',
          ruleId: 'wv-11-21-16-exemptions',
          message: 'West Virginia exemptions incomplete without a known federal exemption count.',
          missingFacts: ['federalExemptionCount'],
        },
      ],
    }
  }
  let amount = 0
  if (args.federalExemptionCount.value === 0) {
    if (args.zeroFederalExemptionReason === 'irc151d2') amount = cfg.zeroExemptionIrc151d2
    else if (args.zeroFederalExemptionReason === 'unknown' || args.zeroFederalExemptionReason === undefined) {
      return {
        taxableIncomeDelta: 0,
        taxCredit: 0,
        warnings: [
          {
            code: 'wv-zero-exemption-reason-unknown',
            ruleId: 'wv-11-21-16-exemptions',
            message: 'WV $500 zero-exemption branch requires IRC §151(d)(2) reason; unknown must not become $500.',
            missingFacts: ['zeroFederalExemptionReason'],
          },
        ],
      }
    }
  } else {
    amount = cfg.perExemption * args.federalExemptionCount.value
  }
  if (
    args.survivingSpouse &&
    !args.survivingSpouse.remarried &&
    args.survivingSpouse.taxYear - args.survivingSpouse.deathYear >= 1 &&
    args.survivingSpouse.taxYear - args.survivingSpouse.deathYear <= 2
  ) {
    amount += cfg.survivingSpouseAdditional
  }
  return { taxableIncomeDelta: amount === 0 ? 0 : -amount, taxCredit: 0, warnings: [] }
}

/** WV c(9) residual after named prior modifications — per eligible owner. */
export function westVirginiaAge65Modification(args: {
  eligible: boolean
  remainingOwnerFederalAgiIncome: number
  priorNamedModifications: number
  config?: StateTaxParams['westVirginiaExemptions']
}): number {
  if (!args.eligible) return 0
  const cfg = args.config ?? stateParamsFor('WV', 2026)?.westVirginiaExemptions
  if (!cfg) throw new Error('Missing versioned West Virginia exemption parameters')
  const cap = cfg.age65ResidualCap
  const residual = Math.max(0, cap - Math.max(0, args.priorNamedModifications))
  return Math.min(residual, Math.max(0, args.remainingOwnerFederalAgiIncome))
}

/**
 * WV military full exclusion + per-owner combined PERS/Teachers/federal $2,000
 * cap + Tier I full protection. Caps are per recipient, not household-wide.
 */
export function westVirginiaPublicMilitary(
  facts: readonly StateRetirementDistributionFact[],
  config?: StateTaxParams['westVirginiaExemptions'],
): StateLeafAdjustment {
  const cfg = config ?? stateParamsFor('WV', 2026)?.westVirginiaExemptions
  if (!cfg) throw new Error('Missing versioned West Virginia exemption parameters')
  const combinedCapPerPerson = cfg.namedPublicCombinedCapPerPerson
  const warnings: StateTaxExactnessWarning[] = []
  const fullByOwner = new Map<string, number>()
  const namedByOwner = new Map<string, number>()

  for (const fact of facts) {
    const amount = Math.max(0, fact.federallyIncludedAmount)
    if (isMilitarySource(fact.sourceKind) || fact.sourceKind === 'railroadTier1' || fact.planSystemCode === 'WV-POLICE-FIRE') {
      fullByOwner.set(fact.ownerPersonId, (fullByOwner.get(fact.ownerPersonId) ?? 0) + amount)
      continue
    }
    if ((fact.sourceKind === 'unknownPublic' || (fact.sourceKind === 'federalCivilService' && !(config ?? stateParamsFor('WV', 2026)?.westVirginiaExemptions)?.qualifyingFederalSystemCodes?.includes(fact.planSystemCode ?? '')))) {
      warnings.push({
        code: 'wv-public-unknown',
        ruleId: 'wv-public-military-rrb',
        message: 'West Virginia public/military relief withheld for unknown public source.',
        missingFacts: ['sourceKind', 'planSystemCode'],
      })
      continue
    }
    if (
      (fact.planSystemCode === 'PERS' || fact.planSystemCode === 'WV-PERS') ||
      (fact.planSystemCode === 'TEACHERS' || fact.planSystemCode === 'WV-TEACHERS') ||
      fact.sourceKind === 'federalCivilService'
    ) {
      namedByOwner.set(fact.ownerPersonId, (namedByOwner.get(fact.ownerPersonId) ?? 0) + amount)
    }
  }

  let total = 0
  for (const amount of fullByOwner.values()) total += amount
  const owners = new Set([...fullByOwner.keys(), ...namedByOwner.keys()])
  for (const owner of owners) {
    const named = namedByOwner.get(owner) ?? 0
    total += Math.min(named, combinedCapPerPerson)
  }
  return { taxableIncomeDelta: total === 0 ? 0 : -total, taxCredit: 0, warnings }
}

/**
 * WV Social Security phase-in. TY2026+ full exclusion of federally included amount.
 * Historical 2024/2025 above-threshold fractions retained for year-parameter schedules.
 */
export function westVirginiaSocialSecuritySubtraction(args: {
  taxYear: number
  filingStatus: StateFilingStatusExtended
  federalAgi: number
  federallyIncludedSocialSecurity: number
  config?: StateTaxParams['westVirginiaSocialSecurity']
}): number {
  const included = Math.max(0, args.federallyIncludedSocialSecurity)
  const config = args.config ?? stateParamsFor('WV', 2026)?.westVirginiaSocialSecurity
  if (!config) return 0
  if (args.taxYear >= config.fullExclusionFrom) return included
  if (config.aboveThresholdFractionByYear[args.taxYear] === undefined) return 0
  const threshold = args.filingStatus === 'marriedFilingJointly' ? config.jointAgiThreshold : config.nonjointAgiThreshold
  if (args.federalAgi <= threshold) return included
  const fraction = config.aboveThresholdFractionByYear[args.taxYear]!
  return included * fraction
}
