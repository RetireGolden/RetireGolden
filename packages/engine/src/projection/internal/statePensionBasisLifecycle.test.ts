import { describe, expect, it } from 'vitest'
import { applyAcceptedPensionBasisToYearFacts, commitAcceptedPensionBasis } from './statePensionBasisLifecycle.js'
import type { StateRetirementDistributionFactInput } from '../types.js'
import { combineTaxCalculators } from '../../tax/federalTax.js'

describe('accepted pension state basis', () => {
  const pool = { state: 'MA', accountId: 'pension', ownerPersonId: 'p', kind: 'pension' as const,
    status: 'complete' as const, openingBasis: 100, basisConsumed: 60, closingBasis: 40 }
  const fact: StateRetirementDistributionFactInput = { accountId: 'pension', ownerPersonId: 'p',
    sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: 80, recipientAgeYears: 70,
    cause: 'ordinary', earlyDistributionDisqualifier: 'false', knownPreviouslyTaxedBasis: 100 }
  it('carries once by account/state/owner and makes an intervening gap unknown', () => {
    const snapshots = commitAcceptedPensionBasis(2026, { amount: 0, status: 'complete', issues: [], pensionBasisPools: [pool] }, [])
    expect(applyAcceptedPensionBasisToYearFacts([fact, fact], 'MA', 2027, snapshots)?.map((row) => row.knownPreviouslyTaxedBasis)).toEqual([40, 40])
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'VA', 2027, snapshots)?.[0]?.knownPreviouslyTaxedBasis).toBe(100)
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'MA', 2028, snapshots)?.[0]?.knownPreviouslyTaxedBasis).toBeUndefined()
    expect(fact.knownPreviouslyTaxedBasis).toBe(100)
    expect(commitAcceptedPensionBasis(2026, { amount: 0, status: 'complete', issues: [], pensionBasisPools: [pool, pool] }, [])[0]?.status).toBe('incomplete')
  })
  it('forwards pension transitions through combined calculators', () => {
    const combined = combineTaxCalculators({ compute: () => 0, computeResult: () => ({ amount: 0,
      status: 'complete', issues: [], pensionBasisPools: [pool] }) })
    expect(combined.computeResult!({ year: 2026, filingStatus: 'single', ordinaryIncome: 0,
      capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0 }).pensionBasisPools).toEqual([pool])
  })
})
