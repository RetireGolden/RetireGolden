import { describe, expect, it } from 'vitest'

import { createEmptyPlan } from '../../model/plan.js'
import {
  applyInheritedRothDistributionToPool,
  cloneInheritedRothPoolState,
  initializeInheritedRothPoolState,
} from './inheritedRothTaxCharacterPoolState.js'

function planWithPool() {
  const plan = createEmptyPlan({
    newId: () => 'x',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  plan.household.people[0]!.id = 'ben'
  plan.accounts.push({
    type: 'roth',
    id: 'iroth',
    name: 'Inherited Roth',
    ownerPersonId: 'ben',
    annualReturnPct: null,
    kind: 'ira',
    balance: 50_000,
    annualContribution: 0,
    inherited: {
      ownerDeathYear: 2024,
      ownerDeathDate: '2024-06-01',
      decedentId: 'dec',
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'none',
        soleBeneficiary: true,
        provenance: { source: 'estate docs', asOf: '2024-07-01' },
      },
    },
  })
  plan.inheritedRothTaxCharacterPools = [
    {
      beneficiaryPersonId: 'ben',
      decedentId: 'dec',
      // 2023 + 5 = 2028, so 2026 distributions remain nonqualified.
      firstRothContributionTaxYear: 2023,
      remainingRegularContributionBasis: 40_000,
      conversionLayers: [],
      priorDistributionsConsumedAmount: 0,
      provenance: { source: '8606 history', asOf: '2024-07-01' },
    },
  ]
  return plan
}

describe('inheritedRothTaxCharacterPoolState', () => {
  it('does not deplete on counterfactual replay; commits once', () => {
    const pools = initializeInheritedRothPoolState(planWithPool())
    const probe = applyInheritedRothDistributionToPool({
      pools,
      beneficiaryPersonId: 'ben',
      decedentId: 'dec',
      distributionCalendarYear: 2026,
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
      commit: false,
    })
    expect(probe.status).toBe('characterized')
    if (probe.status !== 'characterized') return
    expect(probe.ordinaryIncome).toBe(10_000)
    expect(pools.get('ben\0dec')!.remainingRegularContributionBasis).toBe(40_000)

    const committed = applyInheritedRothDistributionToPool({
      pools,
      beneficiaryPersonId: 'ben',
      decedentId: 'dec',
      distributionCalendarYear: 2026,
      distributionAmount: 50_000,
      spouseOwnerTreatmentBegun: false,
      commit: true,
    })
    expect(committed.status).toBe('characterized')
    expect(pools.get('ben\0dec')!.remainingRegularContributionBasis).toBe(0)

    const clone = cloneInheritedRothPoolState(pools)
    expect(clone.get('ben\0dec')!.remainingRegularContributionBasis).toBe(0)
    clone.get('ben\0dec')!.remainingRegularContributionBasis = 99
    expect(pools.get('ben\0dec')!.remainingRegularContributionBasis).toBe(0)
  })
})
