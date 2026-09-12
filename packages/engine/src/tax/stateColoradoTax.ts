/**
 * Colorado state-tax limbs:
 * - §39-22-104(4)(f)/(f.5) age 55–64 Social Security AGI override and shared pension/SS cap
 * - §39-22-104(3)(p.7) TY2026 high-AGI federal deduction addback
 */

import { stateParamsFor, type StateTaxParams } from '../params/state/index.js'
import {
  emptyLeafAdjustment,
  isRailroadSource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

export const CO_SS_AGI_SINGLE = 75_000
export const CO_SS_AGI_JOINT = 95_000
export const CO_CAP_55_64 = 20_000
export const CO_CAP_65_PLUS = 24_000
export const CO_HIGH_AGI_TRIGGER = 300_000
export const CO_HIGH_AGI_RETAIN_SINGLE = 1_000
export const CO_HIGH_AGI_RETAIN_JOINT = 2_000
export const CO_FLAT_RATE = 0.044

export interface ColoradoRecipientSsPension {
  ownerPersonId: string
  ageYears: number
  taxableSocialSecurityAllocated: number
  qualifyingPensionAnnuity: number
  deathOrDisabilitySurvivorUnder55?: boolean
}

/**
 * Per-recipient Colorado SS/pension subtraction with statutory ordering:
 * taxable SS first (subject to age-55-64 AGI override), then pension from remaining cap.
 * RRB stays outside the shared cap (caller routes separately).
 */
export function coloradoSsPensionSubtraction(args: {
  filingStatus: 'single' | 'marriedFilingJointly'
  federalAgi: number
  recipients: readonly ColoradoRecipientSsPension[]
  config?: StateTaxParams['coloradoRetirement']
}): StateLeafAdjustment {
  const config = args.config ?? stateParamsFor('CO', 2026)?.coloradoRetirement
  if (!config) return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'co-retirement-pack-missing', message: 'Colorado retirement subtraction requires the versioned parameter pack.', missingFacts: ['coloradoRetirement'] }] }
  const threshold = args.filingStatus === 'marriedFilingJointly' ? config.ssAgiJoint : config.ssAgiNonjoint
  const underSsOverride = args.federalAgi <= threshold
  let total = 0

  for (const r of args.recipients) {
    let cap = r.ageYears >= 65 ? config.age65Cap : r.ageYears >= 55 || r.deathOrDisabilitySurvivorUnder55 ? config.age55Cap : 0
    const ss = Math.max(0, r.taxableSocialSecurityAllocated)
    const pension = Math.max(0, r.qualifyingPensionAnnuity)

    if (r.ageYears >= 65 || (r.ageYears >= 55 && underSsOverride)) cap = Math.max(cap, ss)

    if (cap <= 0) {
      // Under-55 without survivor qualification: no special SS override and no pension cap.
      continue
    }

    // Age 65+ Social Security is fully subtracted. Pension uses only any
    // remaining retirement subtraction room; a $30,000 SS amount is never
    // truncated to the pension ceiling.
    const ssUsed = r.ageYears >= 65 ? ss : Math.min(ss, cap)
    const remaining = Math.max(0, cap - ssUsed)
    total += ssUsed + Math.min(pension, remaining)
  }

  return { taxableIncomeDelta: -total, taxCredit: 0, warnings: [] }
}

/** Full RRB subtraction outside the shared pension/SS cap. */
export function coloradoRailroadSubtraction(facts: readonly StateRetirementDistributionFact[]): number {
  let total = 0
  for (const fact of facts) {
    if (isRailroadSource(fact.sourceKind)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}

/**
 * §39-22-104(3)(p.7): when federal AGI >= $300,000, add back federal deduction
 * used above $1,000 single / $2,000 joint.
 */
export function coloradoHighAgiFederalDeductionAddback(args: {
  federalAgi: number
  federalDeductionUsed: number
  joint: boolean
  config?: StateTaxParams['highAgiFederalDeductionAddback']
}): StateLeafAdjustment {
  const config = args.config ?? stateParamsFor('CO', 2026)?.highAgiFederalDeductionAddback
  if (!config) throw new Error('Missing versioned Colorado deduction addback parameters')
  if (args.federalAgi < config.agiTrigger) return emptyLeafAdjustment()
  const retain = args.joint ? config.retainJoint : config.retainSingle
  const addback = Math.max(0, args.federalDeductionUsed - retain)
  return { taxableIncomeDelta: addback, taxCredit: 0, warnings: [] }
}

/** Tax on Colorado taxable income at the flat 4.4% rate. */
export function coloradoFlatTax(taxableIncome: number): number {
  return Math.max(0, taxableIncome) * CO_FLAT_RATE
}

export function coloradoMissingRecipientWarning(): StateTaxExactnessWarning {
  return {
    code: 'co-ss-pension-facts-missing',
    ruleId: 'co-ss-pension-shared-cap',
    message:
      'Colorado SS/pension shared-cap limbs require per-recipient age and source facts; aggregate buckets alone are incomplete.',
    missingFacts: ['characterizedRetirementDistributions', 'federalAgi'],
  }
}
