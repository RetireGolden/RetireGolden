/**
 * Inherited Roth IRA distribution tax character — Treas. Reg. 1.408A-6.
 *
 * Qualified status is independent of the RMD schedule. Nonqualified
 * distributions consume remaining basis in the prescribed order (regular
 * contributions, then conversion layers FIFO) and put only earnings into
 * ordinary income; the death-distribution exception removes the ordinary
 * early-distribution additional tax. An unknown clock fails closed; unknown
 * basis also fails closed before qualification, but a known completed clock
 * can establish zero ordinary income without inventing a basis balance.
 *
 * One tax-character pool per (beneficiary, decedent). Duplicate or mixed
 * snapshots are refused — never summed. Basis depletion is applied once per
 * ordered consumption call; callers must persist the returned remaining
 * facts across mandatory and voluntary draws. Spouse owner-treatment
 * transfers remaining layers into owner Roth basis shape.
 */

import type { RothBasisState, RothConversionLayer } from '../../strategies/rothBasis.js'
import { parseCivilIsoDate } from '../../actions/civilDate.js'

export type InheritedRothKnownOrUnknownNumber = number | 'unknown'

/** One conversion vintage; FIFO consumption order is oldest first. */
export interface InheritedRothConversionLayer {
  readonly conversionTaxYear: number
  readonly remainingAmount: number
  /** Portion of remainingAmount that was taxable at conversion. */
  readonly taxableAmount: number
}

export interface InheritedRothTaxCharacterFacts {
  readonly beneficiaryId: string
  readonly decedentId: string
  /** Decedent's first Roth contribution tax year (inherited five-tax-year clock). */
  readonly decedentFirstRothContributionTaxYear: InheritedRothKnownOrUnknownNumber
  readonly remainingRegularContributionBasis: InheritedRothKnownOrUnknownNumber
  /**
   * Ordered conversion layers (oldest first). `'unknown'` when conversion
   * evidence is missing; an empty array is known-zero conversion basis.
   */
  readonly conversionLayers: readonly InheritedRothConversionLayer[] | 'unknown'
  /**
   * Evidence that supplied remaining bases are already net of prior
   * distributions. Must not be subtracted again by the consumer.
   */
  readonly priorDistributionsConsumedAmount: number
  readonly basisAsOfDate: string
}

export interface EvaluateInheritedRothDistributionTaxCharacterInput {
  readonly facts: Readonly<InheritedRothTaxCharacterFacts>
  readonly distributionCalendarYear: number
  readonly distributionAmount: number
  /**
   * When true, the spouse has elected owner treatment and must follow owner
   * Roth rules instead of beneficiary character.
   */
  readonly spouseOwnerTreatmentBegun: boolean
}

export type InheritedRothTaxCharacterResult =
  | {
      readonly status: 'unsupported'
      readonly reason:
        | 'spouseOwnerTreatmentUsesOwnerRules'
        | 'unknownClockOrBasis'
        | 'inconsistentOrNegativeBasis'
      readonly ordinaryIncome: null
      readonly earlyDistributionAdditionalTax: null
      /** Populated when spouse owner treatment begins and layers can transfer. */
      readonly ownerRothBasisHandoff: RothBasisState | null
    }
  | {
      readonly status: 'characterized'
      readonly qualified: true
      /** A completed inherited Roth clock establishes zero ordinary income even when basis is unknown. */
      readonly ordinaryIncome: 0
      /** Death exception: always 0 for beneficiary nonqualified earnings. */
      readonly earlyDistributionAdditionalTax: 0
      /** Qualified distributions do not consume or manufacture unknown basis evidence. */
      readonly remainingRegularContributionBasis: InheritedRothKnownOrUnknownNumber
      readonly conversionLayers: readonly InheritedRothConversionLayer[] | 'unknown'
      readonly priorDistributionsConsumedAmount: number
      readonly ownerRothBasisHandoff: null
    }
  | {
      readonly status: 'characterized'
      readonly qualified: false
      readonly ordinaryIncome: number
      /** Death exception: always 0 for beneficiary nonqualified earnings. */
      readonly earlyDistributionAdditionalTax: 0
      readonly remainingRegularContributionBasis: number
      readonly conversionLayers: readonly InheritedRothConversionLayer[]
      readonly priorDistributionsConsumedAmount: number
      readonly ownerRothBasisHandoff: null
    }

function isNonNegativeNumber(value: InheritedRothKnownOrUnknownNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function layersAreValid(
  layers: readonly InheritedRothConversionLayer[],
): boolean {
  let previousYear = Number.NEGATIVE_INFINITY
  for (const layer of layers) {
    if (
      !Number.isInteger(layer.conversionTaxYear) ||
      layer.conversionTaxYear < 0 ||
      !Number.isFinite(layer.remainingAmount) ||
      !Number.isFinite(layer.taxableAmount) ||
      layer.remainingAmount < 0 ||
      layer.taxableAmount < 0 ||
      layer.taxableAmount > layer.remainingAmount ||
      layer.conversionTaxYear < previousYear
    ) {
      return false
    }
    // Same-year layers must already be canonicalized by the caller/parser.
    if (layer.conversionTaxYear === previousYear) return false
    previousYear = layer.conversionTaxYear
  }
  return true
}

function consumeConversionLayersFifo(
  layers: readonly InheritedRothConversionLayer[],
  amount: number,
): {
  readonly remainingLayers: InheritedRothConversionLayer[]
  readonly consumed: number
} {
  let remaining = amount
  const out: InheritedRothConversionLayer[] = []
  for (const layer of layers) {
    if (remaining <= 0) {
      out.push(layer)
      continue
    }
    const take = Math.min(remaining, layer.remainingAmount)
    remaining -= take
    const left = layer.remainingAmount - take
    if (left > 0) {
      // Pub. 590-B Ordering Rules: taxable conversion dollars leave first,
      // followed by nontaxable dollars within the oldest conversion year.
      // The remainder is therefore never a pro rata taxable share.
      const taxableConsumed = Math.min(take, layer.taxableAmount)
      const taxableLeft = layer.taxableAmount - taxableConsumed
      out.push({
        conversionTaxYear: layer.conversionTaxYear,
        remainingAmount: left,
        taxableAmount: taxableLeft,
      })
    }
  }
  return { remainingLayers: out, consumed: amount - remaining }
}

/**
 * Transfer remaining inherited Roth basis into owner Roth basis state when a
 * surviving spouse begins owner treatment. Conversion vintages and taxable
 * shares are preserved for the owner five-year recapture rule.
 */
export function inheritedRothFactsToOwnerRothBasis(
  facts: Readonly<InheritedRothTaxCharacterFacts>,
): RothBasisState | { status: 'unsupported'; reason: string } {
  // Owner treatment cannot turn absent inherited basis evidence into an owner
  // basis pool. Narrow first so the validation/map paths are never handed an
  // unknown layer value.
  if (
    facts.decedentFirstRothContributionTaxYear === 'unknown' ||
    facts.remainingRegularContributionBasis === 'unknown' ||
    facts.conversionLayers === 'unknown'
  ) {
    return { status: 'unsupported', reason: 'unknownClockOrBasis' }
  }
  if (
    !Number.isInteger(facts.decedentFirstRothContributionTaxYear) ||
    facts.decedentFirstRothContributionTaxYear < 0 ||
    !isNonNegativeNumber(facts.remainingRegularContributionBasis) ||
    !layersAreValid(facts.conversionLayers) ||
    !Number.isFinite(facts.priorDistributionsConsumedAmount) ||
    facts.priorDistributionsConsumedAmount < 0 ||
    parseCivilIsoDate(facts.basisAsOfDate) === null
  ) {
    return { status: 'unsupported', reason: 'inconsistentOrNegativeBasis' }
  }
  const conversionLayers: RothConversionLayer[] = facts.conversionLayers.map((layer) => ({
    year: layer.conversionTaxYear,
    amount: layer.remainingAmount,
    taxableAmount: layer.taxableAmount,
  }))
  return {
    contributionBasis: facts.remainingRegularContributionBasis,
    conversionLayers,
  }
}

/**
 * Characterize one inherited Roth distribution against an explicit basis/clock
 * pool keyed by beneficiary + decedent.
 */
export function evaluateInheritedRothDistributionTaxCharacter(
  input: Readonly<EvaluateInheritedRothDistributionTaxCharacterInput>,
): InheritedRothTaxCharacterResult {
  if (input.spouseOwnerTreatmentBegun) {
    const handoff = inheritedRothFactsToOwnerRothBasis(input.facts)
    if ('status' in handoff) {
      return {
        status: 'unsupported',
        reason: handoff.reason === 'unknownClockOrBasis'
          ? 'unknownClockOrBasis'
          : 'inconsistentOrNegativeBasis',
        ordinaryIncome: null,
        earlyDistributionAdditionalTax: null,
        ownerRothBasisHandoff: null,
      }
    }
    return {
      status: 'unsupported',
      reason: 'spouseOwnerTreatmentUsesOwnerRules',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: handoff,
    }
  }

  const { facts } = input
  if (
    !Number.isInteger(input.distributionCalendarYear) ||
    input.distributionCalendarYear < 0 ||
    !Number.isFinite(input.distributionAmount) ||
    input.distributionAmount < 0 ||
    !Number.isFinite(facts.priorDistributionsConsumedAmount) ||
    facts.priorDistributionsConsumedAmount < 0 ||
    parseCivilIsoDate(facts.basisAsOfDate) === null ||
    (facts.remainingRegularContributionBasis !== 'unknown' &&
      !isNonNegativeNumber(facts.remainingRegularContributionBasis)) ||
    (facts.conversionLayers !== 'unknown' && !layersAreValid(facts.conversionLayers))
  ) {
    return {
      status: 'unsupported',
      reason: 'inconsistentOrNegativeBasis',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: null,
    }
  }

  if (facts.decedentFirstRothContributionTaxYear === 'unknown') {
    return {
      status: 'unsupported',
      reason: 'unknownClockOrBasis',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: null,
    }
  }

  if (!Number.isInteger(facts.decedentFirstRothContributionTaxYear) || facts.decedentFirstRothContributionTaxYear < 0) {
    return {
      status: 'unsupported',
      reason: 'inconsistentOrNegativeBasis',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: null,
    }
  }

  // Inherited five-tax-year clock: qualified once the distribution year is at
  // least five tax years after the decedent's first Roth contribution year.
  const qualified =
    input.distributionCalendarYear >= facts.decedentFirstRothContributionTaxYear + 5

  if (qualified) {
    return {
      status: 'characterized',
      qualified: true,
      ordinaryIncome: 0,
      earlyDistributionAdditionalTax: 0,
      remainingRegularContributionBasis: facts.remainingRegularContributionBasis,
      conversionLayers: facts.conversionLayers,
      priorDistributionsConsumedAmount:
        facts.priorDistributionsConsumedAmount + input.distributionAmount,
      ownerRothBasisHandoff: null,
    }
  }

  if (
    facts.remainingRegularContributionBasis === 'unknown' ||
    facts.conversionLayers === 'unknown'
  ) {
    return {
      status: 'unsupported',
      reason: 'unknownClockOrBasis',
      ordinaryIncome: null,
      earlyDistributionAdditionalTax: null,
      ownerRothBasisHandoff: null,
    }
  }

  let remaining = input.distributionAmount
  let regular = facts.remainingRegularContributionBasis

  const fromRegular = Math.min(remaining, regular)
  regular -= fromRegular
  remaining -= fromRegular

  const { remainingLayers, consumed: fromConversion } = consumeConversionLayersFifo(
    facts.conversionLayers,
    remaining,
  )
  remaining -= fromConversion

  // Only earnings (excess over remaining basis) are ordinary income.
  const ordinaryIncome = remaining

  return {
    status: 'characterized',
    qualified: false,
    ordinaryIncome,
    earlyDistributionAdditionalTax: 0,
    remainingRegularContributionBasis: regular,
    conversionLayers: remainingLayers,
    priorDistributionsConsumedAmount:
      facts.priorDistributionsConsumedAmount + input.distributionAmount,
    ownerRothBasisHandoff: null,
  }
}

export type ResolveInheritedRothPoolResult =
  | { readonly status: 'ok'; readonly facts: InheritedRothTaxCharacterFacts }
  | {
      readonly status: 'unsupported'
      readonly reason:
        | 'emptyPool'
        | 'duplicateBeneficiaryDecedentPool'
        | 'crossDecedentOrBeneficiaryMix'
        | 'conflictingClockOrAsOf'
        | 'mixedUnknownAndKnown'
    }

/**
 * Resolve the single inherited Roth tax-character pool for one
 * (beneficiary, decedent). The persisted contract is one pool key — never sum
 * duplicate snapshots or combine mixed as-of / first-contribution evidence.
 */
export function resolveUniqueInheritedRothTaxCharacterPool(
  pools: readonly Readonly<InheritedRothTaxCharacterFacts>[],
): ResolveInheritedRothPoolResult {
  if (pools.length === 0) {
    return { status: 'unsupported', reason: 'emptyPool' }
  }
  if (pools.length > 1) {
    const first = pools[0]!
    for (let i = 1; i < pools.length; i++) {
      const pool = pools[i]!
      if (
        pool.beneficiaryId !== first.beneficiaryId ||
        pool.decedentId !== first.decedentId
      ) {
        return { status: 'unsupported', reason: 'crossDecedentOrBeneficiaryMix' }
      }
      if (
        pool.basisAsOfDate !== first.basisAsOfDate ||
        pool.decedentFirstRothContributionTaxYear !==
          first.decedentFirstRothContributionTaxYear
      ) {
        return { status: 'unsupported', reason: 'conflictingClockOrAsOf' }
      }
    }
    return { status: 'unsupported', reason: 'duplicateBeneficiaryDecedentPool' }
  }
  return { status: 'ok', facts: pools[0]! }
}
