import { describeRule } from '../../rules/describeRule.js'
import { describe, expect, it } from 'vitest'

import {
  evaluateInheritedRothDistributionTaxCharacter,
  inheritedRothFactsToOwnerRothBasis,
  resolveUniqueInheritedRothTaxCharacterPool,
  type InheritedRothTaxCharacterFacts,
} from './inheritedRothTaxCharacter.js'

function facts(
  overrides: Partial<InheritedRothTaxCharacterFacts> = {},
): InheritedRothTaxCharacterFacts {
  return {
    beneficiaryId: 'b1',
    decedentId: 'd1',
    decedentFirstRothContributionTaxYear: 2023,
    remainingRegularContributionBasis: 40_000,
    conversionLayers: [],
    priorDistributionsConsumedAmount: 0,
    basisAsOfDate: '2026-01-01',
    ...overrides,
  }
}

describeRule('treas-reg-1-408A-6-inherited-roth-nonqualified-earnings', { readings: { earningsOnly: 10000, allTaxFree: 0 }, accepted: 'earningsOnly' }, ({ accepted }) => {
  // 26 CFR 1.408A-6 A-4 / Pub 590-B: nonqualified earnings ordinary; death exception
  // removes the 10% additional tax.
  it('taxes only earnings on a nonqualified $50,000 distribution with $40,000 basis', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({ remainingRegularContributionBasis: 40_000 }),
      distributionCalendarYear: 2026, // first contribution 2023 → not yet 5 years
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result.status).toBe('characterized')
    if (result.status !== 'characterized') return
    expect(result.qualified).toBe(false)
    expect(result.ordinaryIncome).toBe(accepted)
    expect(result.earlyDistributionAdditionalTax).toBe(0)
    expect(result.remainingRegularContributionBasis).toBe(0)
  })

  it('produces $0 ordinary income once the inherited five-tax-year clock is met', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({
        decedentFirstRothContributionTaxYear: 2021,
        remainingRegularContributionBasis: 40_000,
      }),
      distributionCalendarYear: 2026, // 2021 + 5 = 2026 → qualified
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result.status).toBe('characterized')
    if (result.status !== 'characterized') return
    expect(result.qualified).toBe(true)
    expect(result.ordinaryIncome).toBe(0)
    // Basis is not consumed on a qualified distribution.
    expect(result.remainingRegularContributionBasis).toBe(40_000)
  })

  it('consumes conversion layers FIFO after regular basis', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({
        remainingRegularContributionBasis: 10_000,
        conversionLayers: [
          { conversionTaxYear: 2020, remainingAmount: 15_000, taxableAmount: 15_000 },
          { conversionTaxYear: 2022, remainingAmount: 20_000, taxableAmount: 12_000 },
        ],
      }),
      distributionCalendarYear: 2026,
      distributionAmount: 30_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result.status).toBe('characterized')
    if (result.status !== 'characterized') return
    expect(result.ordinaryIncome).toBe(0)
    expect(result.remainingRegularContributionBasis).toBe(0)
    // 10k regular + 15k 2020 layer + 5k of 2022 taxable conversion dollars.
    // Pub. 590-B ordering consumes the taxable portion of a conversion first.
    expect(result.conversionLayers).toEqual([
      { conversionTaxYear: 2022, remainingAmount: 15_000, taxableAmount: 7_000 },
    ])
  })

  it('consumes taxable conversion dollars first and preserves that remainder for spouse owner handoff', () => {
    // Pub. 590-B Ordering Rules worksheet: from a $10,000 conversion with
    // $6,000 taxable, a $4,000 distribution consumes taxable dollars first,
    // leaving $6,000 with $2,000 taxable—not a proportional $3,600 amount.
    const start = facts({
      remainingRegularContributionBasis: 0,
      conversionLayers: [
        { conversionTaxYear: 2020, remainingAmount: 10_000, taxableAmount: 6_000 },
      ],
    })
    const distributed = evaluateInheritedRothDistributionTaxCharacter({
      facts: start,
      distributionCalendarYear: 2026,
      distributionAmount: 4_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(distributed.status).toBe('characterized')
    if (distributed.status !== 'characterized') return
    expect(distributed.qualified).toBe(false)
    expect(distributed.ordinaryIncome).toBe(0)
    expect(distributed.conversionLayers).toEqual([
      { conversionTaxYear: 2020, remainingAmount: 6_000, taxableAmount: 2_000 },
    ])

    const handoff = evaluateInheritedRothDistributionTaxCharacter({
      facts: {
        ...start,
        remainingRegularContributionBasis: distributed.remainingRegularContributionBasis,
        conversionLayers: distributed.conversionLayers,
        priorDistributionsConsumedAmount: distributed.priorDistributionsConsumedAmount,
      },
      distributionCalendarYear: 2026,
      distributionAmount: 0,
      spouseOwnerTreatmentBegun: true,
    })
    expect(handoff.status).toBe('unsupported')
    if (handoff.status !== 'unsupported') return
    expect(handoff.reason).toBe('spouseOwnerTreatmentUsesOwnerRules')
    expect(handoff.ownerRothBasisHandoff).toEqual({
      contributionBasis: 0,
      conversionLayers: [{ year: 2020, amount: 6_000, taxableAmount: 2_000 }],
    })
  })

  it('fails closed on unknown clock or basis rather than silent tax-free', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({ decedentFirstRothContributionTaxYear: 'unknown' }),
      distributionCalendarYear: 2026,
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result.status).toBe('unsupported')
    if (result.status !== 'unsupported') return
    expect(result.reason).toBe('unknownClockOrBasis')
    expect(result.ordinaryIncome).toBeNull()
  })

  it('establishes zero ordinary income from a known completed clock without inventing unknown basis', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({
        decedentFirstRothContributionTaxYear: 2020,
        remainingRegularContributionBasis: 'unknown',
        conversionLayers: 'unknown',
      }),
      distributionCalendarYear: 2026,
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result.status).toBe('characterized')
    if (result.status !== 'characterized') return
    expect(result.qualified).toBe(true)
    expect(result.ordinaryIncome).toBe(0)
    expect(result.remainingRegularContributionBasis).toBe('unknown')
    expect(result.conversionLayers).toBe('unknown')
  })

  it('rejects invalid basis evidence rather than normalizing it', () => {
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: facts({ basisAsOfDate: '2026-02-31' }),
      distributionCalendarYear: 2026,
      distributionAmount: 1,
      spouseOwnerTreatmentBegun: false,
    })
    expect(result).toMatchObject({
      status: 'unsupported',
      reason: 'inconsistentOrNegativeBasis',
      ordinaryIncome: null,
    })
  })

  it('applies sequential depletion across two positive withdrawals from returned facts', () => {
    const start = facts({ remainingRegularContributionBasis: 40_000 })
    const first = evaluateInheritedRothDistributionTaxCharacter({
      facts: start,
      distributionCalendarYear: 2026,
      distributionAmount: 30_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(first.status).toBe('characterized')
    if (first.status !== 'characterized') return
    expect(first.ordinaryIncome).toBe(0)
    expect(first.remainingRegularContributionBasis).toBe(10_000)

    const second = evaluateInheritedRothDistributionTaxCharacter({
      facts: {
        ...start,
        remainingRegularContributionBasis: first.remainingRegularContributionBasis,
        conversionLayers: first.conversionLayers,
        priorDistributionsConsumedAmount: first.priorDistributionsConsumedAmount,
      },
      distributionCalendarYear: 2026,
      distributionAmount: 20_000,
      spouseOwnerTreatmentBegun: false,
    })
    expect(second.status).toBe('characterized')
    if (second.status !== 'characterized') return
    expect(second.ordinaryIncome).toBe(10_000)
    expect(second.remainingRegularContributionBasis).toBe(0)
    expect(second.priorDistributionsConsumedAmount).toBe(50_000)
  })

  it('hands remaining conversion layers to owner Roth basis on spouse owner treatment', () => {
    const start = facts({
      remainingRegularContributionBasis: 5_000,
      conversionLayers: [
        { conversionTaxYear: 2021, remainingAmount: 8_000, taxableAmount: 8_000 },
        { conversionTaxYear: 2024, remainingAmount: 3_000, taxableAmount: 1_500 },
      ],
    })
    const result = evaluateInheritedRothDistributionTaxCharacter({
      facts: start,
      distributionCalendarYear: 2026,
      distributionAmount: 0,
      spouseOwnerTreatmentBegun: true,
    })
    expect(result.status).toBe('unsupported')
    if (result.status !== 'unsupported') return
    expect(result.reason).toBe('spouseOwnerTreatmentUsesOwnerRules')
    expect(result.ownerRothBasisHandoff).toEqual({
      contributionBasis: 5_000,
      conversionLayers: [
        { year: 2021, amount: 8_000, taxableAmount: 8_000 },
        { year: 2024, amount: 3_000, taxableAmount: 1_500 },
      ],
    })

    const direct = inheritedRothFactsToOwnerRothBasis(start)
    expect(direct).toEqual(result.ownerRothBasisHandoff)
  })

  it('refuses unknown regular basis or conversion layers before owner-basis mapping', () => {
    expect(
      inheritedRothFactsToOwnerRothBasis(
        facts({ remainingRegularContributionBasis: 'unknown' }),
      ),
    ).toEqual({ status: 'unsupported', reason: 'unknownClockOrBasis' })
    expect(
      inheritedRothFactsToOwnerRothBasis(facts({ conversionLayers: 'unknown' })),
    ).toEqual({ status: 'unsupported', reason: 'unknownClockOrBasis' })
  })
})

describe('resolveUniqueInheritedRothTaxCharacterPool', () => {
  it('accepts exactly one pool for a beneficiary/decedent key', () => {
    const resolved = resolveUniqueInheritedRothTaxCharacterPool([
      facts({ remainingRegularContributionBasis: 40_000 }),
    ])
    expect(resolved.status).toBe('ok')
    if (resolved.status !== 'ok') return
    expect(resolved.facts.remainingRegularContributionBasis).toBe(40_000)
  })

  it('rejects duplicate same-key snapshots instead of summing them', () => {
    expect(
      resolveUniqueInheritedRothTaxCharacterPool([
        facts({ remainingRegularContributionBasis: 25_000 }),
        facts({ remainingRegularContributionBasis: 15_000 }),
      ]),
    ).toEqual({ status: 'unsupported', reason: 'duplicateBeneficiaryDecedentPool' })
  })

  it('rejects mixed as-of dates and conflicting first-contribution years', () => {
    expect(
      resolveUniqueInheritedRothTaxCharacterPool([
        facts({ basisAsOfDate: '2026-01-01' }),
        facts({ basisAsOfDate: '2026-06-01' }),
      ]),
    ).toEqual({ status: 'unsupported', reason: 'conflictingClockOrAsOf' })

    expect(
      resolveUniqueInheritedRothTaxCharacterPool([
        facts({ decedentFirstRothContributionTaxYear: 2020 }),
        facts({ decedentFirstRothContributionTaxYear: 2021 }),
      ]),
    ).toEqual({ status: 'unsupported', reason: 'conflictingClockOrAsOf' })
  })

  it('rejects other-decedent or other-beneficiary mixes', () => {
    expect(
      resolveUniqueInheritedRothTaxCharacterPool([
        facts({ decedentId: 'd1' }),
        facts({ decedentId: 'd2' }),
      ]),
    ).toEqual({ status: 'unsupported', reason: 'crossDecedentOrBeneficiaryMix' })
  })
})
