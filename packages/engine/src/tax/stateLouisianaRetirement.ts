/**
 * Louisiana retirement exclusions:
 * - La. R.S. 47:44.1(A) age-65 annual retirement exemption (TY2026 indexed $12,324)
 * - La. R.S. 47:44.2 federal civil-service / railroad only (not all public)
 */

import {
  emptyLeafAdjustment,
  isRailroadSource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

/** TY2026: $12,000 × (1 + 0.027 Dec-2024→Dec-2025 CPI-U) = $12,324. */
export const LA_RETIREMENT_EXEMPTION_TY2026 = 12_324

/**
 * §47:44.2 exclusion: federal civil-service and qualifying RRB only.
 * Municipal / state-local public pensions receive $0 under this section.
 */
export function louisianaFederalRailroadExclusion(
  facts: readonly StateRetirementDistributionFact[],
): StateLeafAdjustment {
  let total = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    const amount = Math.max(0, fact.federallyIncludedAmount)
    if (fact.sourceKind === 'federalCivilService' || isRailroadSource(fact.sourceKind)) {
      total += amount
      continue
    }
    if (fact.sourceKind === 'unknownPublic') {
      warnings.push({
        code: 'la-44-2-unknown-public',
        ruleId: 'la-rs-47-44-2-social-security-federal-retirement',
        message:
          'Louisiana §47:44.2 exclusion withheld: unknown public source is not treated as federal civil-service or railroad.',
        missingFacts: ['sourceKind'],
      })
    }
  }
  return { taxableIncomeDelta: -total, taxCredit: 0, warnings }
}

/**
 * §47:44.1(A) age-65 retirement exemption, per eligible recipient.
 * Applies to qualifying retirement income that is not already excluded under §44.2.
 */
export function louisianaAge65RetirementExemption(args: {
  facts: readonly StateRetirementDistributionFact[]
  capPerPerson?: number
}): StateLeafAdjustment {
  const cap = args.capPerPerson ?? LA_RETIREMENT_EXEMPTION_TY2026
  const byOwner = new Map<string, number>()
  const warnings: StateTaxExactnessWarning[] = []

  for (const fact of args.facts) {
    if (fact.recipientAgeKnown === false) {
      warnings.push({ code: 'la-retirement-age-unknown', ruleId: 'la-rs-47-44-1-retirement-exemption', message: 'Louisiana age-65 exemption requires known recipient age.', missingFacts: ['recipientAgeYears'] })
      continue
    }
    if (fact.sourceKind === 'federalCivilService' || isRailroadSource(fact.sourceKind)) {
      continue // already fully excluded under §44.2
    }
    if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
      warnings.push({
        code: 'la-44-1-unknown-source',
        ruleId: 'la-rs-47-44-1-retirement-exemption',
        message: 'Louisiana age-65 retirement exemption withheld for unknown source identity.',
        missingFacts: ['sourceKind'],
      })
      continue
    }
    if (fact.recipientAgeYears < 65) continue
    const amount = Math.max(0, fact.federallyIncludedAmount)
    byOwner.set(fact.ownerPersonId, (byOwner.get(fact.ownerPersonId) ?? 0) + amount)
  }

  let exclusion = 0
  for (const amount of byOwner.values()) {
    exclusion += Math.min(amount, cap)
  }
  return { taxableIncomeDelta: -exclusion, taxCredit: 0, warnings }
}

/** Legacy coarse path: age-gated capped exclusion without source typing. */
export function louisianaLegacyAge65Cap(args: {
  retirementIncome: number
  agesAlive: number[]
  capPerPerson: number
}): number {
  const eligible = args.agesAlive.filter((a) => a >= 65).length
  if (eligible === 0) return 0
  return Math.min(Math.max(0, args.retirementIncome), args.capPerPerson * eligible)
}

export function louisianaEmptyWhenNoFacts(): StateLeafAdjustment {
  return emptyLeafAdjustment()
}
