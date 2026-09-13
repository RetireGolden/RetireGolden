import { describe, expect, it } from 'vitest'
import { deriveAnnualStateRailroadBenefits } from './annualStateRailroadFacts.js'
import type { AnnualPensionDistributionCharacterization } from './stateRetirementFactsAdapter.js'
import type { StateRetirementDistributionFactInput } from '../types.js'

describe('actual railroad benefit ledger', () => {
  it('uses paid railroad gross independent of cash-flow records and preserves payee', () => {
    const result = deriveAnnualStateRailroadBenefits({ characterizedRetirementDistributions: [{
      accountId: 'rrb', ownerPersonId: 'survivor', sourceOwnerPersonId: 'decedent',
      source: 'railroadTier2', federallyIncludedAmount: 5000,
    } as AnnualPensionDistributionCharacterization] })
    expect(result).toEqual([{ ownerPersonId: 'survivor', kind: 'tier2', grossAmount: 5000, federallyIncludedAmount: 5000 }])
    expect(deriveAnnualStateRailroadBenefits({ characterizedRetirementDistributions: [] })).toEqual([])
  })
  it('keeps additional railroad events with unavailable gross incomplete', () => {
    expect(deriveAnnualStateRailroadBenefits({ characterizedRetirementDistributions: [] }, [{
      ownerPersonId: 'p', sourceKind: 'railroadTier1', federallyIncludedAmount: 100,
    } as StateRetirementDistributionFactInput])).toBeUndefined()
  })
})
