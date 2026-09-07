import { describe, expect, it } from 'vitest'

import { acaYearContractSchema } from '../../model/plan.js'
import type { AcaYearContract, AnnualFederalTaxFacts } from '../../model/plan.js'
import { acaLegacyForeignExclusionSourceKind } from '../../model/annualFederalTaxFacts.js'
import { resolveAnnualFederalTaxFacts } from './annualFederalTaxFacts.js'

const emptyFacts: AnnualFederalTaxFacts = { foreignIncomeAdjustments: [] }

function broadKnown(amount: number) {
  return {
    state: 'known' as const,
    amount,
    provenance: {
      sourceKind: 'foreignExclusionAggregateWorkpaper' as const,
      acquisition: 'manual' as const,
    },
  }
}

function niitKnown(amount: number) {
  return {
    state: 'known' as const,
    amount,
    provenance: {
      sourceKind: 'form8960Line13AllocationWorksheet' as const,
      acquisition: 'manual' as const,
    },
  }
}

const unresolvedProvenance = {
  sourceKind: 'unresolvedSource' as const,
  acquisition: 'manual' as const,
}

function broadUnknown() {
  return {
    state: 'unknown' as const,
    amount: null,
    provenance: unresolvedProvenance,
  }
}

function niitUnknown() {
  return {
    state: 'unknown' as const,
    amount: null,
    provenance: unresolvedProvenance,
  }
}

function acaContractBase() {
  return {
    year: 2026,
    fplRegion: 'contiguous' as const,
    taxFamilyMembers: [{
      personId: 'p1',
      relationship: 'primary' as const,
      requiredToFile: 'required' as const,
      magi: 0,
    }],
    coveredMembers: [{
      personId: 'p1',
      enrollmentPremiumByMonth: new Array<number>(12).fill(100),
      slcspBenchmarkPremiumByMonth: new Array<number>(12).fill(101),
    }],
    taxExemptInterest: { state: 'notApplicable' as const, amount: null },
    assertions: {
      coverageEligibility: 'supported' as const,
      form8814: 'notApplicable' as const,
      specialAllocation: 'notApplicable' as const,
      marriedFilingSeparatelyException: 'notApplicable' as const,
      selfEmployedHealthInsuranceDeduction: 'notApplicable' as const,
      otherMaterialFacts: 'none' as const,
    },
  }
}

function acaContract(amount: number): AcaYearContract {
  return acaYearContractSchema.parse({
    ...acaContractBase(),
    foreignExclusionAddback: { state: 'known', amount },
  })
}

function acaContractNotApplicable(): AcaYearContract {
  return acaYearContractSchema.parse({
    ...acaContractBase(),
    foreignExclusionAddback: { state: 'notApplicable', amount: null },
  })
}

function acaContractUnknown(): AcaYearContract {
  return acaYearContractSchema.parse({
    ...acaContractBase(),
    foreignExclusionAddback: { state: 'unknown', amount: null },
  })
}

function resolve(
  facts: AnnualFederalTaxFacts,
  options: {
    year?: number
    acaContract?: AcaYearContract
    acaGeneralTaxCompatibilityEligible?: boolean
  } = {},
) {
  return resolveAnnualFederalTaxFacts({
    annualFederalTaxFacts: facts,
    year: options.year ?? 2026,
    acaContract: options.acaContract,
    acaGeneralTaxCompatibilityEligible: options.acaGeneralTaxCompatibilityEligible ?? false,
  })
}

describe('resolveAnnualFederalTaxFacts', () => {
  it('routes supplied broad and NIIT values independently per phase-one product policy', () => {
    // Public policy: 01-federal-income-tax-2026.md — phase-one routing only, not a
    // statutory oracle. Each leg keeps its own supplied amount when characterized.
    const separate = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(30_000),
        niitSection911A1NetAddback: niitKnown(20_000),
      }],
    })

    expect(separate.broad.generalFederalAmount).toBe(30_000)
    expect(separate.broad.acaHouseholdMagiAmount).toBe(30_000)
    expect(separate.niit.resolvedAmount).toBe(20_000)
    expect(separate.niit.niitSupportCodes).toEqual([])

    const narrowerNiit = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(30_000),
        niitSection911A1NetAddback: niitKnown(15_000),
      }],
    })

    expect(narrowerNiit.broad.generalFederalAmount).toBe(30_000)
    expect(narrowerNiit.niit.resolvedAmount).toBe(15_000)
  })

  it('uses missing and unknown fallbacks without reading ACA directly', () => {
    const missing = resolve(emptyFacts)
    expect(missing.broad.rawGeneralState).toBe('missing')
    expect(missing.broad.generalFederalAmount).toBe(0)
    expect(missing.broad.broadTreatment).toBe('legacyZeroFallback')
    expect(missing.broad.broadSupport).toBe('approximate')
    expect(missing.niit.resolvedAmount).toBe(0)
    expect(missing.niit.niitTreatment).toBe('legacyZeroFallback')
    expect(missing.niit.niitSupportCodes).toEqual(['niit-fallback-used-general-broad'])

    const unknown = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: {
          state: 'unknown',
          amount: null,
          provenance: {
            sourceKind: 'unresolvedSource',
            acquisition: 'manual',
          },
        },
        niitSection911A1NetAddback: {
          state: 'unknown',
          amount: null,
          provenance: {
            sourceKind: 'unresolvedSource',
            acquisition: 'manual',
          },
        },
      }],
    })
    expect(unknown.broad.broadTreatment).toBe('explicitUnknownFallback')
    expect(unknown.broad.broadSupport).toBe('nonActionable')
    expect(unknown.niit.resolvedAmount).toBe(0)
    expect(unknown.niit.niitSupport).toBe('nonActionable')
    expect(unknown.federalTaxSupport).toBe('nonActionable')
  })

  it('selects eligible ACA when general is unknown and retains raw general state', () => {
    const fromAcaKnown = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadUnknown(),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    }, {
      acaContract: acaContract(8_000),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(fromAcaKnown.broad.rawGeneralState).toBe('unknown')
    expect(fromAcaKnown.broad.broadTreatment).toBe('activeAcaKnown')
    expect(fromAcaKnown.broad.generalFederalAmount).toBe(8_000)
    expect(fromAcaKnown.broad.broadSupport).toBe('characterized')
    expect(fromAcaKnown.broad.sources).toEqual([{
      role: 'aca',
      sourceKind: acaLegacyForeignExclusionSourceKind,
      quality: 'legacyContract',
    }])

    const fromAcaNotApplicable = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadUnknown(),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    }, {
      acaContract: acaContractNotApplicable(),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(fromAcaNotApplicable.broad.rawGeneralState).toBe('unknown')
    expect(fromAcaNotApplicable.broad.broadTreatment).toBe('activeAcaNotApplicable')
    expect(fromAcaNotApplicable.broad.generalFederalAmount).toBe(0)
    expect(fromAcaNotApplicable.broad.broadSupport).toBe('characterized')

    const worseYearSupport = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadUnknown(),
        niitSection911A1NetAddback: niitUnknown(),
      }],
    }, {
      acaContract: acaContract(8_000),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(worseYearSupport.broad.broadSupport).toBe('characterized')
    expect(worseYearSupport.niit.niitSupport).toBe('nonActionable')
    expect(worseYearSupport.federalTaxSupport).toBe('nonActionable')
  })

  it('approximates zero when general is missing and eligible ACA addback is unknown', () => {
    const resolution = resolve(emptyFacts, {
      acaContract: acaContractUnknown(),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(resolution.broad.rawGeneralState).toBe('missing')
    expect(resolution.broad.rawAcaCompatibilityState).toBe('unknown')
    expect(resolution.broad.generalFederalAmount).toBe(0)
    expect(resolution.broad.broadTreatment).toBe('legacyZeroFallback')
    expect(resolution.broad.broadSupport).toBe('approximate')
    expect(resolution.broad.sources).toEqual([])
  })

  it('uses explicitUnknownFallback when general is unknown and eligible ACA addback is unknown', () => {
    const resolution = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadUnknown(),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    }, {
      acaContract: acaContractUnknown(),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(resolution.broad.rawGeneralState).toBe('unknown')
    expect(resolution.broad.rawAcaCompatibilityState).toBe('unknown')
    expect(resolution.broad.generalFederalAmount).toBe(0)
    expect(resolution.broad.broadTreatment).toBe('explicitUnknownFallback')
    expect(resolution.broad.broadSupport).toBe('nonActionable')
    expect(resolution.federalTaxSupport).toBe('nonActionable')
  })

  it('copies a positive broad amount into NIIT unknown fallback as nonActionable continuity', () => {
    const resolution = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(12_000),
        niitSection911A1NetAddback: niitUnknown(),
      }],
    })
    expect(resolution.niit.resolvedAmount).toBe(12_000)
    expect(resolution.niit.niitTreatment).toBe('explicitUnknownFallback')
    expect(resolution.niit.niitSupport).toBe('nonActionable')
    expect(resolution.niit.niitSupportCodes).toEqual(['niit-fallback-used-general-broad'])
  })

  it('uses eligible ACA known or notApplicable when general is missing', () => {
    const fromAcaKnown = resolve(emptyFacts, {
      acaContract: acaContract(8_000),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(fromAcaKnown.broad.broadTreatment).toBe('activeAcaKnown')
    expect(fromAcaKnown.broad.generalFederalAmount).toBe(8_000)
    expect(fromAcaKnown.broad.acaHouseholdMagiAmount).toBe(8_000)
    expect(fromAcaKnown.broad.sources).toEqual([{
      role: 'aca',
      sourceKind: acaLegacyForeignExclusionSourceKind,
      quality: 'legacyContract',
    }])

    const fromAcaNotApplicable = resolve(emptyFacts, {
      acaContract: acaContractNotApplicable(),
      acaGeneralTaxCompatibilityEligible: true,
    })
    expect(fromAcaNotApplicable.broad.broadTreatment).toBe('activeAcaNotApplicable')
    expect(fromAcaNotApplicable.broad.generalFederalAmount).toBe(0)
    expect(fromAcaNotApplicable.broad.sources).toEqual([{
      role: 'aca',
      sourceKind: acaLegacyForeignExclusionSourceKind,
      quality: 'legacyContract',
    }])
  })

  it('retains equal determinate general and ACA values with both sources', () => {
    const resolution = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(5_000),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    }, {
      acaContract: acaContract(5_000),
      acaGeneralTaxCompatibilityEligible: true,
    })

    expect(resolution.broad.broadTreatment).toBe('generalAndAcaAgree')
    expect(resolution.broad.generalFederalAmount).toBe(5_000)
    expect(resolution.broad.acaHouseholdMagiAmount).toBe(5_000)
    expect(resolution.broad.sources.map((source) => source.role).sort()).toEqual([
      'aca',
      'general',
    ])
  })

  it('keeps G=600, A=1000 source-local conflict with explicit NIIT unknown fallback 600', () => {
    const conflict = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(600),
        niitSection911A1NetAddback: niitUnknown(),
      }],
    }, {
      acaContract: acaContract(1_000),
      acaGeneralTaxCompatibilityEligible: true,
    })

    expect(conflict.broad.generalFederalAmount).toBe(600)
    expect(conflict.broad.acaHouseholdMagiAmount).toBe(1_000)
    expect(conflict.broad.broadTreatment).toBe('generalAndAcaConflictSourceLocal')
    expect(conflict.broad.broadSupport).toBe('nonActionable')
    expect(conflict.niit.rawState).toBe('unknown')
    expect(conflict.niit.resolvedAmount).toBe(600)
    expect(conflict.niit.niitTreatment).toBe('explicitUnknownFallback')
    expect(conflict.niit.niitSupport).toBe('nonActionable')
    expect(conflict.federalTaxSupport).toBe('nonActionable')
    expect(conflict.federalTaxSupportCodes).toEqual([
      'broad-determinate-source-conflict',
      'niit-fallback-used-general-broad',
    ])
    expect(conflict.broad.sources.every((source) => !('sourceLabel' in source))).toBe(true)
  })

  it('replaces only NIIT when known in the same conflict', () => {
    const conflictKnownNiit = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(600),
        niitSection911A1NetAddback: niitKnown(250),
      }],
    }, {
      acaContract: acaContract(1_000),
      acaGeneralTaxCompatibilityEligible: true,
    })

    expect(conflictKnownNiit.broad.generalFederalAmount).toBe(600)
    expect(conflictKnownNiit.broad.acaHouseholdMagiAmount).toBe(1_000)
    expect(conflictKnownNiit.niit.resolvedAmount).toBe(250)
    expect(conflictKnownNiit.niit.niitSupportCodes).toEqual([])
    expect(conflictKnownNiit.federalTaxSupportCodes).toEqual([
      'broad-determinate-source-conflict',
    ])
  })

  it('never treats ineligible ACA inputs as compatibility sources', () => {
    const contract = acaContract(9_000)
    const ineligible = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(9_000),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    }, {
      acaContract: contract,
      acaGeneralTaxCompatibilityEligible: false,
    })

    expect(ineligible.broad.rawAcaCompatibilityState).toBe('ineligible')
    expect(ineligible.broad.broadTreatment).toBe('generalKnown')
    expect(ineligible.broad.sources).toEqual([{
      role: 'general',
      sourceKind: 'foreignExclusionAggregateWorkpaper',
      quality: 'documented',
    }])
  })

  it('preserves raw known-zero, notApplicable, unknown, missing, and ineligible states', () => {
    const knownZero = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown(0),
        niitSection911A1NetAddback: niitKnown(0),
      }],
    })
    expect(knownZero.broad.rawGeneralState).toBe('known')
    expect(knownZero.broad.rawGeneralAmount).toBe(0)
    expect(knownZero.niit.rawState).toBe('known')

    const notApplicable = resolve({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: {
          state: 'notApplicable',
          amount: null,
          provenance: {
            sourceKind: 'userAttestation',
            acquisition: 'manual',
          },
        },
        niitSection911A1NetAddback: {
          state: 'notApplicable',
          amount: null,
          provenance: {
            sourceKind: 'userAttestation',
            acquisition: 'manual',
          },
        },
      }],
    })
    expect(notApplicable.broad.rawGeneralState).toBe('notApplicable')
    expect(notApplicable.niit.rawState).toBe('notApplicable')
    expect(notApplicable.niit.resolvedAmount).toBe(0)
  })
})
