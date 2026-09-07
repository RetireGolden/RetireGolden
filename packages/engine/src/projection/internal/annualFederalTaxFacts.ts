import type { AcaYearContract } from '../../model/plan.js'
import type {
  AnnualFederalTaxFacts,
  BroadAnnualAmount,
  FactSourceQuality,
  NiitAnnualAmount,
} from '../../model/annualFederalTaxFacts.js'
import {
  acaCompatibilitySourceQuality,
  acaLegacyForeignExclusionSourceKind,
  broadSourceQuality,
  niitSourceQuality,
} from '../../model/annualFederalTaxFacts.js'

export type FederalTaxSupport = 'characterized' | 'approximate' | 'nonActionable'

export type RawGeneralState = 'known' | 'notApplicable' | 'unknown' | 'missing'
export type RawAcaCompatibilityState =
  | 'known'
  | 'notApplicable'
  | 'unknown'
  | 'missing'
  | 'ineligible'
export type RawNiitState = 'known' | 'notApplicable' | 'unknown' | 'missing'

export type BroadTreatment =
  | 'generalKnown'
  | 'generalNotApplicable'
  | 'activeAcaKnown'
  | 'activeAcaNotApplicable'
  | 'generalAndAcaAgree'
  | 'generalAndAcaConflictSourceLocal'
  | 'explicitUnknownFallback'
  | 'legacyZeroFallback'

export type NiitTreatment =
  | 'exactProvided'
  | 'notApplicable'
  | 'explicitUnknownFallback'
  | 'legacyBroadFallback'
  | 'legacyZeroFallback'

export type BroadSupportCode = 'broad-determinate-source-conflict'
export type NiitSupportCode = 'niit-fallback-used-general-broad'

export interface SafeFactSource {
  readonly role: 'general' | 'aca' | 'niit'
  readonly sourceKind: string
  readonly quality: FactSourceQuality
}

export interface AnnualFederalTaxFactsBroadResolution {
  readonly rawGeneralState: RawGeneralState
  readonly rawGeneralAmount: number | null
  readonly rawAcaCompatibilityState: RawAcaCompatibilityState
  readonly rawAcaCompatibilityAmount: number | null
  readonly generalFederalAmount: number
  readonly acaHouseholdMagiAmount: number
  readonly broadTreatment: BroadTreatment
  readonly broadSupport: FederalTaxSupport
  readonly broadSupportCodes: readonly BroadSupportCode[]
  readonly quality: FactSourceQuality
  readonly sources: readonly SafeFactSource[]
}

export interface AnnualFederalTaxFactsNiitResolution {
  readonly rawState: RawNiitState
  readonly resolvedAmount: number
  readonly niitTreatment: NiitTreatment
  readonly niitSupport: FederalTaxSupport
  readonly niitSupportCodes: readonly NiitSupportCode[]
  readonly quality: FactSourceQuality
  readonly sources: readonly SafeFactSource[]
}

export interface AnnualFederalTaxFactsResolution {
  readonly year: number
  readonly broad: AnnualFederalTaxFactsBroadResolution
  readonly niit: AnnualFederalTaxFactsNiitResolution
  readonly federalTaxSupport: FederalTaxSupport
  readonly federalTaxSupportCodes: readonly string[]
}

export interface ResolveAnnualFederalTaxFactsInput {
  readonly annualFederalTaxFacts: AnnualFederalTaxFacts
  readonly year: number
  readonly acaContract: AcaYearContract | undefined
  readonly acaGeneralTaxCompatibilityEligible: boolean
}

const SUPPORT_SEVERITY: Readonly<Record<FederalTaxSupport, number>> = Object.freeze({
  characterized: 0,
  approximate: 1,
  nonActionable: 2,
})

function worseSupport(
  left: FederalTaxSupport,
  right: FederalTaxSupport,
): FederalTaxSupport {
  return SUPPORT_SEVERITY[left] >= SUPPORT_SEVERITY[right] ? left : right
}

function sortUniqueCodes<T extends string>(codes: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(codes)].sort())
}

function sortUniqueSupportCodes(
  broadCodes: readonly BroadSupportCode[],
  niitCodes: readonly NiitSupportCode[],
): readonly string[] {
  return Object.freeze(
    [...new Set([...broadCodes, ...niitCodes])].sort(),
  )
}

function freezeResolution(
  resolution: AnnualFederalTaxFactsResolution,
): AnnualFederalTaxFactsResolution {
  return Object.freeze({
    ...resolution,
    broad: Object.freeze({
      ...resolution.broad,
      broadSupportCodes: Object.freeze([...resolution.broad.broadSupportCodes]),
      sources: Object.freeze([...resolution.broad.sources]),
    }),
    niit: Object.freeze({
      ...resolution.niit,
      niitSupportCodes: Object.freeze([...resolution.niit.niitSupportCodes]),
      sources: Object.freeze([...resolution.niit.sources]),
    }),
    federalTaxSupportCodes: Object.freeze([...resolution.federalTaxSupportCodes]),
  })
}

function generalRow(
  facts: AnnualFederalTaxFacts,
  year: number,
): AnnualFederalTaxFacts['foreignIncomeAdjustments'][number] | undefined {
  return facts.foreignIncomeAdjustments.find((row) => row.year === year)
}

function generalAmountValue(amount: BroadAnnualAmount | undefined): number | null {
  if (amount === undefined) return null
  return amount.state === 'known' ? amount.amount : null
}

function acaAmountValue(
  contract: AcaYearContract | undefined,
): { state: RawAcaCompatibilityState; amount: number | null } {
  if (contract === undefined) {
    return { state: 'missing', amount: null }
  }
  const addback = contract.foreignExclusionAddback
  if (addback.state === 'known') {
    return { state: 'known', amount: addback.amount }
  }
  if (addback.state === 'notApplicable') {
    return { state: 'notApplicable', amount: null }
  }
  return { state: 'unknown', amount: null }
}

function isDeterminateGeneralState(state: RawGeneralState): boolean {
  return state === 'known' || state === 'notApplicable'
}

function isDeterminateAcaState(state: RawAcaCompatibilityState): boolean {
  return state === 'known' || state === 'notApplicable'
}

function generalNumericValue(amount: BroadAnnualAmount): number {
  switch (amount.state) {
    case 'known':
      return amount.amount
    case 'notApplicable':
    case 'unknown':
      return 0
  }
}

function acaNumericValue(state: RawAcaCompatibilityState, amount: number | null): number {
  if (state === 'known') return amount ?? 0
  return 0
}

function safeGeneralSource(amount: BroadAnnualAmount): SafeFactSource {
  return Object.freeze({
    role: 'general',
    sourceKind: amount.provenance.sourceKind,
    quality: broadSourceQuality(amount),
  })
}

function safeAcaSource(contract: AcaYearContract): SafeFactSource {
  const addback = contract.foreignExclusionAddback
  if (addback.state === 'known' || addback.state === 'notApplicable') {
    return Object.freeze({
      role: 'aca',
      sourceKind: acaLegacyForeignExclusionSourceKind,
      quality: acaCompatibilitySourceQuality(addback.state),
    })
  }
  return Object.freeze({
    role: 'aca',
    sourceKind: 'unresolvedSource',
    quality: 'unresolved',
  })
}

function safeNiitSource(amount: NiitAnnualAmount): SafeFactSource {
  return Object.freeze({
    role: 'niit',
    sourceKind: amount.provenance.sourceKind,
    quality: niitSourceQuality(amount),
  })
}

function resolveBroad(input: ResolveAnnualFederalTaxFactsInput): AnnualFederalTaxFactsBroadResolution {
  const row = generalRow(input.annualFederalTaxFacts, input.year)
  const generalFact = row?.foreignExclusionAddback
  const rawGeneralState: RawGeneralState = generalFact?.state ?? 'missing'
  const rawGeneralAmount = generalAmountValue(generalFact)

  const rawAcaCompatibilityState: RawAcaCompatibilityState =
    input.acaGeneralTaxCompatibilityEligible
      ? acaAmountValue(input.acaContract).state
      : 'ineligible'
  const rawAcaCompatibilityAmount = rawAcaCompatibilityState === 'known'
    ? acaAmountValue(input.acaContract).amount
    : null

  const generalDeterminate = isDeterminateGeneralState(rawGeneralState)
  const acaDeterminate = input.acaGeneralTaxCompatibilityEligible &&
    isDeterminateAcaState(rawAcaCompatibilityState)

  const generalValue = generalDeterminate && generalFact !== undefined
    ? generalNumericValue(generalFact)
    : null
  const acaValue = acaDeterminate
    ? acaNumericValue(rawAcaCompatibilityState, rawAcaCompatibilityAmount)
    : null

  if (
    generalDeterminate &&
    acaDeterminate &&
    generalValue !== acaValue
  ) {
    const sources: SafeFactSource[] = []
    if (generalFact !== undefined) sources.push(safeGeneralSource(generalFact))
    if (input.acaContract !== undefined) sources.push(safeAcaSource(input.acaContract))
    return {
      rawGeneralState,
      rawGeneralAmount,
      rawAcaCompatibilityState,
      rawAcaCompatibilityAmount,
      generalFederalAmount: generalValue!,
      acaHouseholdMagiAmount: acaValue!,
      broadTreatment: 'generalAndAcaConflictSourceLocal',
      broadSupport: 'nonActionable',
      broadSupportCodes: sortUniqueCodes(['broad-determinate-source-conflict']),
      quality: generalFact === undefined
        ? 'missing'
        : broadSourceQuality(generalFact),
      sources: Object.freeze(sources),
    }
  }

  if (generalDeterminate && acaDeterminate) {
    const amount = generalValue!
    const sources: SafeFactSource[] = []
    if (generalFact !== undefined) sources.push(safeGeneralSource(generalFact))
    if (input.acaContract !== undefined) sources.push(safeAcaSource(input.acaContract))
    return {
      rawGeneralState,
      rawGeneralAmount,
      rawAcaCompatibilityState,
      rawAcaCompatibilityAmount,
      generalFederalAmount: amount,
      acaHouseholdMagiAmount: amount,
      broadTreatment: 'generalAndAcaAgree',
      broadSupport: 'characterized',
      broadSupportCodes: Object.freeze([]),
      quality: broadSourceQuality(generalFact!),
      sources: Object.freeze(sources),
    }
  }

  if (generalDeterminate) {
    const amount = generalValue!
    const treatment = rawGeneralState === 'known' ? 'generalKnown' : 'generalNotApplicable'
    const sources = generalFact === undefined ? [] : [safeGeneralSource(generalFact)]
    return {
      rawGeneralState,
      rawGeneralAmount,
      rawAcaCompatibilityState,
      rawAcaCompatibilityAmount,
      generalFederalAmount: amount,
      acaHouseholdMagiAmount: amount,
      broadTreatment: treatment,
      broadSupport: 'characterized',
      broadSupportCodes: Object.freeze([]),
      quality: broadSourceQuality(generalFact!),
      sources: Object.freeze(sources),
    }
  }

  if (acaDeterminate) {
    const amount = acaValue!
    const treatment = rawAcaCompatibilityState === 'known'
      ? 'activeAcaKnown'
      : 'activeAcaNotApplicable'
    const sources = input.acaContract === undefined ? [] : [safeAcaSource(input.acaContract)]
    return {
      rawGeneralState,
      rawGeneralAmount,
      rawAcaCompatibilityState,
      rawAcaCompatibilityAmount,
      generalFederalAmount: amount,
      acaHouseholdMagiAmount: amount,
      broadTreatment: treatment,
      broadSupport: 'characterized',
      broadSupportCodes: Object.freeze([]),
      quality: 'legacyContract',
      sources: Object.freeze(sources),
    }
  }

  if (rawGeneralState === 'unknown') {
    return {
      rawGeneralState,
      rawGeneralAmount,
      rawAcaCompatibilityState,
      rawAcaCompatibilityAmount,
      generalFederalAmount: 0,
      acaHouseholdMagiAmount: 0,
      broadTreatment: 'explicitUnknownFallback',
      broadSupport: 'nonActionable',
      broadSupportCodes: Object.freeze([]),
      quality: generalFact === undefined ? 'missing' : 'unresolved',
      sources: generalFact === undefined ? Object.freeze([]) : Object.freeze([
        safeGeneralSource(generalFact),
      ]),
    }
  }

  return {
    rawGeneralState,
    rawGeneralAmount,
    rawAcaCompatibilityState,
    rawAcaCompatibilityAmount,
    generalFederalAmount: 0,
    acaHouseholdMagiAmount: 0,
    broadTreatment: 'legacyZeroFallback',
    broadSupport: 'approximate',
    broadSupportCodes: Object.freeze([]),
    quality: 'missing',
    sources: Object.freeze([]),
  }
}

function resolveNiit(
  input: ResolveAnnualFederalTaxFactsInput,
  broad: AnnualFederalTaxFactsBroadResolution,
): AnnualFederalTaxFactsNiitResolution {
  const row = generalRow(input.annualFederalTaxFacts, input.year)
  const niitFact = row?.niitSection911A1NetAddback
  const rawState: RawNiitState = niitFact?.state ?? 'missing'

  if (rawState === 'known' && niitFact !== undefined && niitFact.state === 'known') {
    return {
      rawState,
      resolvedAmount: niitFact.amount,
      niitTreatment: 'exactProvided',
      niitSupport: 'characterized',
      niitSupportCodes: Object.freeze([]),
      quality: niitSourceQuality(niitFact),
      sources: Object.freeze([safeNiitSource(niitFact)]),
    }
  }

  if (rawState === 'notApplicable' && niitFact !== undefined && niitFact.state === 'notApplicable') {
    return {
      rawState,
      resolvedAmount: 0,
      niitTreatment: 'notApplicable',
      niitSupport: 'characterized',
      niitSupportCodes: Object.freeze([]),
      quality: niitSourceQuality(niitFact),
      sources: Object.freeze([safeNiitSource(niitFact)]),
    }
  }

  const fallbackAmount = Math.max(0, broad.generalFederalAmount)
  const fallbackCodes: NiitSupportCode[] = ['niit-fallback-used-general-broad']

  if (rawState === 'unknown') {
    return {
      rawState,
      resolvedAmount: fallbackAmount,
      niitTreatment: 'explicitUnknownFallback',
      niitSupport: 'nonActionable',
      niitSupportCodes: sortUniqueCodes(fallbackCodes),
      quality: niitFact === undefined ? 'missing' : 'unresolved',
      sources: niitFact === undefined ? Object.freeze([]) : Object.freeze([
        safeNiitSource(niitFact),
      ]),
    }
  }

  if (fallbackAmount > 0) {
    return {
      rawState,
      resolvedAmount: fallbackAmount,
      niitTreatment: 'legacyBroadFallback',
      niitSupport: 'approximate',
      niitSupportCodes: sortUniqueCodes(fallbackCodes),
      quality: 'missing',
      sources: Object.freeze([]),
    }
  }

  return {
    rawState,
    resolvedAmount: 0,
    niitTreatment: 'legacyZeroFallback',
    niitSupport: 'approximate',
    niitSupportCodes: sortUniqueCodes(['niit-fallback-used-general-broad']),
    quality: 'missing',
    sources: Object.freeze([]),
  }
}

export function resolveAnnualFederalTaxFacts(
  input: ResolveAnnualFederalTaxFactsInput,
): AnnualFederalTaxFactsResolution {
  const broad = resolveBroad(input)
  const niit = resolveNiit(input, broad)
  const federalTaxSupport = worseSupport(broad.broadSupport, niit.niitSupport)
  const federalTaxSupportCodes = sortUniqueSupportCodes(
    broad.broadSupportCodes,
    niit.niitSupportCodes,
  )

  return freezeResolution({
    year: input.year,
    broad,
    niit,
    federalTaxSupport,
    federalTaxSupportCodes,
  })
}
