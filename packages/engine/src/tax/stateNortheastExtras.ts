/**
 * Northeast / Mid-Atlantic leaf helpers: DE, DC, CT, NJ military, MA limbs.
 */

import {
  emptyLeafAdjustment,
  isMilitarySource,
  isRailroadSource,
  type StateFilingStatusExtended,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

/** Delaware under-60 greater-of ordinary vs military caps (pack-year dollars). */
export function delawareUnder60PensionDeduction(args: {
  recipientAgeYears: number
  ordinaryPensionIncluded: number
  militaryPensionIncluded: number
  earlyDistributionDisqualifier: 'true' | 'false' | 'unknown'
  ordinaryCap?: number
  militaryCap?: number
}): StateLeafAdjustment {
  if (args.recipientAgeYears >= 60) {
    // Age-60+ limb is separate; this helper covers the under-60 greater-of only.
    return emptyLeafAdjustment()
  }
  if (args.earlyDistributionDisqualifier === 'true') {
    return emptyLeafAdjustment()
  }
  if (args.earlyDistributionDisqualifier === 'unknown') {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        {
          code: 'de-pension-early-unknown',
          ruleId: 'de-early-distribution-gate',
          message:
            'Delaware pension exclusion incomplete: early-distribution disqualifier unknown; no silently known zero exclusion granted as exact.',
          missingFacts: ['earlyDistributionDisqualifier'],
        },
      ],
    }
  }
  const ordinaryCap = args.ordinaryCap ?? 2_000
  const militaryCap = args.militaryCap ?? 12_500
  const ordinary = Math.min(ordinaryCap, Math.max(0, args.ordinaryPensionIncluded))
  const military = Math.min(militaryCap, Math.max(0, args.militaryPensionIncluded))
  const deduction = Math.max(ordinary, military)
  return { taxableIncomeDelta: deduction === 0 ? 0 : -deduction, taxCredit: 0, warnings: [] }
}

/** DC Code government-survivor exclusion N(ii): DC/federal issuer, age 62+. */
export function dcGovernmentSurvivorExclusion(fact: StateRetirementDistributionFact): StateLeafAdjustment {
  if (fact.sourceKind !== 'governmentSurvivor') return emptyLeafAdjustment()
  if (fact.recipientAgeYears < 62) return emptyLeafAdjustment()
  if (fact.survivorIssuer !== 'dc' && fact.survivorIssuer !== 'federal') {
    if (fact.survivorIssuer === 'unknown' || fact.survivorIssuer === undefined) {
      return {
        taxableIncomeDelta: 0,
        taxCredit: 0,
        warnings: [
          {
            code: 'dc-survivor-issuer-unknown',
            ruleId: 'dc-government-survivor-n-ii',
            message: 'DC government-survivor exclusion withheld: issuer unknown.',
            missingFacts: ['survivorIssuer'],
          },
        ],
      }
    }
    return emptyLeafAdjustment()
  }
  return {
    taxableIncomeDelta: -Math.max(0, fact.federallyIncludedAmount),
    taxCredit: 0,
    warnings: [],
  }
}

/**
 * Connecticut WS personal exemption: discrete ceiling steps from the pack
 * schedule. steps = ceil(max(0, CT_AGI - start) / step); reduction = steps × per-step.
 */
export function connecticutPersonalExemption(args: {
  filingStatus: StateFilingStatusExtended
  connecticutAgi: number
  schedule?: Record<
    StateFilingStatusExtended,
    { maximum: number; phaseoutStart: number; phaseoutStep: number; reductionPerStep: number }
  >
}): number {
  const schedule =
    args.schedule ??
    ({
      single: { maximum: 15_000, phaseoutStart: 30_000, phaseoutStep: 1_000, reductionPerStep: 1_000 },
      marriedFilingSeparately: {
        maximum: 12_000,
        phaseoutStart: 24_000,
        phaseoutStep: 1_000,
        reductionPerStep: 1_000,
      },
      headOfHousehold: { maximum: 19_000, phaseoutStart: 38_000, phaseoutStep: 1_000, reductionPerStep: 1_000 },
      marriedFilingJointly: {
        maximum: 24_000,
        phaseoutStart: 48_000,
        phaseoutStep: 1_000,
        reductionPerStep: 1_000,
      },
      qualifyingSurvivingSpouse: {
        maximum: 24_000,
        phaseoutStart: 48_000,
        phaseoutStep: 1_000,
        reductionPerStep: 1_000,
      },
    } as const)
  const row = schedule[args.filingStatus]
  if (args.connecticutAgi <= row.phaseoutStart) return row.maximum
  const over = args.connecticutAgi - row.phaseoutStart
  const steps = Math.ceil(over / row.phaseoutStep)
  return Math.max(0, row.maximum - steps * row.reductionPerStep)
}

/** N.J.S.A. 54A:6-26 military pension full exemption. */
export function newJerseyMilitaryExemption(facts: readonly StateRetirementDistributionFact[]): StateLeafAdjustment {
  let total = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    if (isMilitarySource(fact.sourceKind)) {
      total += Math.max(0, fact.federallyIncludedAmount)
      continue
    }
    if (fact.sourceKind === 'unknownPublic') {
      warnings.push({
        code: 'nj-military-unknown-public',
        ruleId: 'njsa-54a-6-26-military-pension',
        message:
          'New Jersey military pension exemption withheld: unknown public source is not treated as DFAS military.',
        missingFacts: ['sourceKind'],
      })
    }
  }
  return { taxableIncomeDelta: -total, taxCredit: 0, warnings }
}

/** Massachusetts Part B rate + 4% surtax threshold (pack-year). */
export const MA_SURTAX_THRESHOLD = 1_107_750
export const MA_BASE_RATE = 0.05
export const MA_SURTAX_RATE = 0.04

export function massachusettsTaxOnTaxableIncome(
  taxableIncome: number,
  config?: { baseRate: number; surtaxRate: number; surtaxThreshold: number },
): number {
  const baseRate = config?.baseRate ?? MA_BASE_RATE
  const surtaxRate = config?.surtaxRate ?? MA_SURTAX_RATE
  const threshold = config?.surtaxThreshold ?? MA_SURTAX_THRESHOLD
  const base = Math.max(0, taxableIncome) * baseRate
  const excess = Math.max(0, taxableIncome - threshold)
  return base + excess * surtaxRate
}

export function massachusettsPersonalExemption(args: {
  filingStatus: StateFilingStatusExtended
  age65EligibleCount: number
  config?: {
    personalExemptionSingle: number
    personalExemptionJoint: number
    personalExemptionHoh: number
    ageBlindAddition: number
  }
}): number {
  const cfg = args.config ?? {
    personalExemptionSingle: 4_400,
    personalExemptionJoint: 8_800,
    personalExemptionHoh: 6_800,
    ageBlindAddition: 700,
  }
  const base =
    args.filingStatus === 'marriedFilingJointly' || args.filingStatus === 'qualifyingSurvivingSpouse'
      ? cfg.personalExemptionJoint
      : args.filingStatus === 'headOfHousehold'
        ? cfg.personalExemptionHoh
        : cfg.personalExemptionSingle
  return base + cfg.ageBlindAddition * Math.max(0, args.age65EligibleCount)
}

export function massachusettsPrivateBasisTaxable(args: {
  federallyIncluded: number
  knownPreviouslyTaxedBasis: number | undefined
}): { taxable: number; warnings: StateTaxExactnessWarning[]; recovery: number } {
  if (args.knownPreviouslyTaxedBasis === undefined) {
    // Unknown basis ⇒ zero recovery (not an incomplete refusal for this limb).
    return {
      taxable: Math.max(0, args.federallyIncluded),
      recovery: 0,
      warnings: [
        {
          code: 'ma-basis-unknown',
          ruleId: 'ma-private-basis-recovery',
          message: 'Massachusetts private basis recovery is zero when basis is unknown.',
          missingFacts: ['knownPreviouslyTaxedBasis'],
        },
      ],
    }
  }
  const recovery = Math.min(Math.max(0, args.federallyIncluded), Math.max(0, args.knownPreviouslyTaxedBasis))
  return { taxable: Math.max(0, args.federallyIncluded) - recovery, recovery, warnings: [] }
}

export function massachusettsRailroadExclusion(facts: readonly StateRetirementDistributionFact[]): number {
  let total = 0
  for (const fact of facts) {
    if (isRailroadSource(fact.sourceKind)) total += Math.max(0, fact.federallyIncludedAmount)
  }
  return total
}

/**
 * Massachusetts private/public retirement adjustment: RRB full exclusion,
 * private basis recovery, and no invented reciprocity for out-of-state pensions.
 */
export function massachusettsRetirementAdjustment(
  facts: readonly StateRetirementDistributionFact[],
): StateLeafAdjustment {
  let delta = 0
  const warnings: StateTaxExactnessWarning[] = []
  const remainingBasis = new Map<string, number>()
  for (const fact of facts) {
    if (isRailroadSource(fact.sourceKind)) {
      delta -= Math.max(0, fact.federallyIncludedAmount)
      continue
    }
    if (
      fact.sourceKind === 'ordinaryPrivatePension' ||
      fact.sourceKind === 'ira' ||
      fact.sourceKind === 'employerPlan'
    ) {
      const basisKey = `${fact.ownerPersonId}:${fact.accountId ?? fact.planSystemCode ?? fact.qualifiedPlanType ?? fact.sourceKind}`
      const opening = remainingBasis.get(basisKey) ?? fact.knownPreviouslyTaxedBasis
      const part = massachusettsPrivateBasisTaxable({
        federallyIncluded: fact.federallyIncludedAmount,
        knownPreviouslyTaxedBasis: opening,
      })
      warnings.push(...part.warnings)
      delta -= part.recovery
      if (opening !== undefined) remainingBasis.set(basisKey, Math.max(0, opening - part.recovery))
      continue
    }
    if (isMilitarySource(fact.sourceKind)) {
      delta -= Math.max(0, fact.federallyIncludedAmount)
      continue
    }
    if (fact.sourceKind === 'stateLocalPublic' || fact.sourceKind === 'federalCivilService' || fact.sourceKind === 'governmentSurvivor') {
      const eligibleContributory = fact.publicPlanContributory === true && (fact.sourceKind === 'federalCivilService' || fact.priorTaxState === 'MA' || fact.reciprocitySatisfied === 'true')
      if (eligibleContributory) {
        delta -= Math.max(0, fact.federallyIncludedAmount)
      } else if (fact.publicPlanContributory === undefined || (fact.publicPlanContributory === true && fact.priorTaxState !== 'MA' && fact.reciprocitySatisfied !== 'false')) {
        warnings.push({
          code: 'ma-public-reciprocity-unknown',
          ruleId: 'ma-public-pension-reciprocity',
          message: 'Massachusetts public-pension exclusion withheld without proven contributory and reciprocity facts.',
          missingFacts: ['publicPlanContributory', 'reciprocitySatisfied'],
        })
      }
      continue
    }
    if (fact.sourceKind === 'unknownPublic') {
      warnings.push({
        code: 'ma-public-reciprocity-unknown',
        ruleId: 'ma-public-pension-reciprocity',
        message:
          'Massachusetts public-pension reciprocity/exclusion withheld without proven contributory/reciprocity facts.',
        missingFacts: ['reciprocitySatisfied', 'sourceKind'],
      })
    }
  }
  if (Object.is(delta, -0)) delta = 0
  return { taxableIncomeDelta: delta, taxCredit: 0, warnings }
}
