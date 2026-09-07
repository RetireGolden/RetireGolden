import { describe, expect, it } from 'vitest'

import {
  annualFederalTaxFactsSchema,
  broadAnnualAmountSchema,
  broadSourceQuality,
  niitAnnualAmountSchema,
  niitSourceQuality,
} from './annualFederalTaxFacts.js'

const broadKnown = {
  state: 'known' as const,
  amount: 30_000,
  provenance: {
    sourceKind: 'foreignExclusionAggregateWorkpaper' as const,
    acquisition: 'manual' as const,
  },
}

const niitKnown = {
  state: 'known' as const,
  amount: 20_000,
  provenance: {
    sourceKind: 'form8960Line13AllocationWorksheet' as const,
    acquisition: 'manual' as const,
  },
}

describe('annualFederalTaxFacts schema', () => {
  it('accepts known zero distinctly from notApplicable', () => {
    const knownZero = broadAnnualAmountSchema.parse({
      state: 'known',
      amount: 0,
      provenance: {
        sourceKind: 'planningEstimate',
        acquisition: 'manual',
      },
    })
    const notApplicable = broadAnnualAmountSchema.parse({
      state: 'notApplicable',
      amount: null,
      provenance: {
        sourceKind: 'userAttestation',
        acquisition: 'manual',
      },
    })

    expect(knownZero.state).toBe('known')
    expect(knownZero.amount).toBe(0)
    expect(notApplicable.state).toBe('notApplicable')
    expect(notApplicable.amount).toBeNull()
  })

  it('rejects malformed state, amount, and provenance combinations', () => {
    expect(() => broadAnnualAmountSchema.parse({
      state: 'known',
      amount: null,
      provenance: broadKnown.provenance,
    })).toThrow()
    expect(() => broadAnnualAmountSchema.parse({
      state: 'notApplicable',
      amount: 0,
      provenance: {
        sourceKind: 'userAttestation',
        acquisition: 'manual',
      },
    })).toThrow()
    expect(() => niitAnnualAmountSchema.parse({
      state: 'known',
      amount: 20_000,
      provenance: {
        sourceKind: 'foreignExclusionAggregateWorkpaper',
        acquisition: 'manual',
      },
    })).toThrow()
    expect(() => broadAnnualAmountSchema.parse({
      state: 'known',
      amount: -1,
      provenance: broadKnown.provenance,
    })).toThrow()
  })

  it('rejects duplicate years and accepts distinct broad and NIIT amounts', () => {
    const duplicate = annualFederalTaxFactsSchema.safeParse({
      foreignIncomeAdjustments: [
        { year: 2026, foreignExclusionAddback: broadKnown, niitSection911A1NetAddback: niitKnown },
        { year: 2026, foreignExclusionAddback: broadKnown, niitSection911A1NetAddback: niitKnown },
      ],
    })
    expect(duplicate.success).toBe(false)

    const parsed = annualFederalTaxFactsSchema.parse({
      foreignIncomeAdjustments: [{
        year: 2026,
        foreignExclusionAddback: broadKnown,
        niitSection911A1NetAddback: {
          state: 'known',
          amount: 15_000,
          provenance: niitKnown.provenance,
        },
      }],
    })
    expect(parsed.foreignIncomeAdjustments[0]!.foreignExclusionAddback.amount).toBe(30_000)
    expect(parsed.foreignIncomeAdjustments[0]!.niitSection911A1NetAddback.amount).toBe(15_000)
  })

  it('derives source-quality labels independently per field', () => {
    expect(broadSourceQuality(broadKnown)).toBe('documented')
    expect(niitSourceQuality({
      state: 'known',
      amount: 1,
      provenance: {
        sourceKind: 'planningEstimate',
        acquisition: 'import',
      },
    })).toBe('estimated')
    expect(broadSourceQuality({
      state: 'unknown',
      amount: null,
      provenance: {
        sourceKind: 'unresolvedSource',
        acquisition: 'manual',
      },
    })).toBe('unresolved')
  })
})
