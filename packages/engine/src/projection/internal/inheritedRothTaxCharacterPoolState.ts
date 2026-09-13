/**
 * Attempt-scoped mutable inherited-Roth tax-character pools.
 *
 * Keyed by (beneficiaryPersonId, decedentId). Clone for counterfactuals;
 * commit depletion exactly once when the balance operation commits. Own-Roth
 * clocks never mix into these pools.
 */
import type { Plan } from '../../model/plan.js'
import {
  evaluateInheritedRothDistributionTaxCharacter,
  type InheritedRothConversionLayer,
  type InheritedRothTaxCharacterFacts,
  type InheritedRothTaxCharacterResult,
} from './inheritedRothTaxCharacter.js'

export type InheritedRothPoolKey = string

export function inheritedRothPoolKey(
  beneficiaryPersonId: string,
  decedentId: string,
): InheritedRothPoolKey {
  return `${beneficiaryPersonId}\0${decedentId}`
}

export interface MutableInheritedRothTaxCharacterPool {
  beneficiaryPersonId: string
  decedentId: string
  firstRothContributionTaxYear: number
  remainingRegularContributionBasis: number | 'unknown'
  conversionLayers: InheritedRothConversionLayer[] | 'unknown'
  priorDistributionsConsumedAmount: number
  basisAsOfDate: string
}

export function initializeInheritedRothPoolState(
  plan: Readonly<Plan>,
): Map<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool> {
  const pools = new Map<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool>()
  for (const pool of plan.inheritedRothTaxCharacterPools) {
    const key = inheritedRothPoolKey(pool.beneficiaryPersonId, pool.decedentId)
    if (pools.has(key)) {
      throw new Error(
        `duplicate inherited Roth tax-character pool for ${key}`,
      )
    }
    pools.set(key, {
      beneficiaryPersonId: pool.beneficiaryPersonId,
      decedentId: pool.decedentId,
      firstRothContributionTaxYear: pool.firstRothContributionTaxYear,
      remainingRegularContributionBasis: pool.remainingRegularContributionBasis,
      conversionLayers: pool.conversionLayers === 'unknown'
        ? 'unknown'
        : pool.conversionLayers.map((layer) => ({ ...layer })),
      priorDistributionsConsumedAmount: pool.priorDistributionsConsumedAmount,
      basisAsOfDate: pool.provenance.asOf,
    })
  }
  return pools
}

export function cloneInheritedRothPoolState(
  source: ReadonlyMap<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool>,
): Map<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool> {
  const clone = new Map<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool>()
  for (const [key, pool] of source) {
    clone.set(key, {
      beneficiaryPersonId: pool.beneficiaryPersonId,
      decedentId: pool.decedentId,
      firstRothContributionTaxYear: pool.firstRothContributionTaxYear,
      remainingRegularContributionBasis: pool.remainingRegularContributionBasis,
      conversionLayers: pool.conversionLayers === 'unknown'
        ? 'unknown'
        : pool.conversionLayers.map((layer) => ({ ...layer })),
      priorDistributionsConsumedAmount: pool.priorDistributionsConsumedAmount,
      basisAsOfDate: pool.basisAsOfDate,
    })
  }
  return clone
}

function toFacts(
  pool: Readonly<MutableInheritedRothTaxCharacterPool>,
): InheritedRothTaxCharacterFacts {
  return {
    beneficiaryId: pool.beneficiaryPersonId,
    decedentId: pool.decedentId,
    decedentFirstRothContributionTaxYear: pool.firstRothContributionTaxYear,
    remainingRegularContributionBasis: pool.remainingRegularContributionBasis,
    conversionLayers: pool.conversionLayers,
    priorDistributionsConsumedAmount: pool.priorDistributionsConsumedAmount,
    basisAsOfDate: pool.basisAsOfDate,
  }
}

/**
 * Characterize a distribution against the live pool. When `commit` is true,
 * write remaining layers back once. Counterfactual probes pass commit=false.
 */
export function applyInheritedRothDistributionToPool(input: {
  readonly pools: Map<InheritedRothPoolKey, MutableInheritedRothTaxCharacterPool>
  readonly beneficiaryPersonId: string
  readonly decedentId: string
  readonly distributionCalendarYear: number
  readonly distributionAmount: number
  readonly spouseOwnerTreatmentBegun: boolean
  readonly commit: boolean
}): InheritedRothTaxCharacterResult {
  const key = inheritedRothPoolKey(input.beneficiaryPersonId, input.decedentId)
  const pool = input.pools.get(key)
  if (pool === undefined) {
    return {
      status: 'unsupported',
      reason: 'unknownClockOrBasis',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: null,
    }
  }
  const result = evaluateInheritedRothDistributionTaxCharacter({
    facts: toFacts(pool),
    distributionCalendarYear: input.distributionCalendarYear,
    distributionAmount: input.distributionAmount,
    spouseOwnerTreatmentBegun: input.spouseOwnerTreatmentBegun,
  })
  if (input.commit && result.status === 'characterized') {
    pool.remainingRegularContributionBasis = result.remainingRegularContributionBasis
    pool.conversionLayers = result.conversionLayers === 'unknown'
      ? 'unknown'
      : result.conversionLayers.map((layer) => ({ ...layer }))
    pool.priorDistributionsConsumedAmount = result.priorDistributionsConsumedAmount
  }
  return result
}

/** A verified legacy decedent clock can establish qualified treatment without
 * any ordering-basis facts. Only the qualified leaf arm is accepted here;
 * nonqualified withdrawals still require the shared decedent pool. */
export function characterizeLegacyQualifiedInheritedRoth(input: {
  firstContributionYear: number | undefined; evidenceAsOfDate: string | undefined;
  distributionYear: number; distributionAmount: number;
}): { ordinaryIncome: 0; status: 'characterized' } | null {
  if (input.firstContributionYear === undefined || input.evidenceAsOfDate === undefined) return null
  const result = evaluateInheritedRothDistributionTaxCharacter({
    facts: {
      // Identity is immaterial to this non-depleting qualified-clock branch.
      beneficiaryId: '', decedentId: '',
      decedentFirstRothContributionTaxYear: input.firstContributionYear,
      remainingRegularContributionBasis: 'unknown', conversionLayers: 'unknown',
      priorDistributionsConsumedAmount: 0, basisAsOfDate: input.evidenceAsOfDate,
    },
    distributionCalendarYear: input.distributionYear, distributionAmount: input.distributionAmount,
    spouseOwnerTreatmentBegun: false,
  })
  return result.status === 'characterized' && result.qualified
    ? { ordinaryIncome: 0, status: 'characterized' } : null
}
