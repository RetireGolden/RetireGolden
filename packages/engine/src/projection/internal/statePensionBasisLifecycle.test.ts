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
    const snapshots = commitAcceptedPensionBasis(2026, 'MA', { amount: 0, status: 'complete', issues: [], pensionBasisPools: [pool] }, [])
    expect(applyAcceptedPensionBasisToYearFacts([fact, fact], 'MA', 2027, snapshots)?.map((row) => row.knownPreviouslyTaxedBasis)).toEqual([40, 40])
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'VA', 2027, snapshots)?.[0]?.knownPreviouslyTaxedBasis).toBe(100)
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'MA', 2028, snapshots)?.[0]?.knownPreviouslyTaxedBasis).toBeUndefined()
    expect(fact.knownPreviouslyTaxedBasis).toBe(100)
    expect(commitAcceptedPensionBasis(2026, 'MA', { amount: 0, status: 'complete', issues: [], pensionBasisPools: [pool, pool] }, [])[0]?.status).toBe('incomplete')
  })
  it('carries a complete closing through a settled year with no distribution, and only that', () => {
    const empty = { amount: 0, status: 'complete' as const, issues: [] }
    const y2026 = commitAcceptedPensionBasis(2026, 'MA', { ...empty, pensionBasisPools: [pool] }, [])
    const y2027 = commitAcceptedPensionBasis(2027, 'MA', empty, y2026)
    expect(y2027.find((row) => row.taxYear === 2027)).toEqual({ ...pool, openingBasis: 40, basisConsumed: 0, closingBasis: 40, taxYear: 2027 })
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'MA', 2028, y2027)?.[0]?.knownPreviouslyTaxedBasis).toBe(40)
    // A year this year's own transition covers is not overwritten by the carry.
    const drawn = commitAcceptedPensionBasis(2027, 'MA', { ...empty, pensionBasisPools: [{ ...pool, openingBasis: 40, basisConsumed: 40, closingBasis: 0 }] }, y2026)
    expect(drawn.filter((row) => row.taxYear === 2027)).toEqual([{ ...pool, openingBasis: 40, basisConsumed: 40, closingBasis: 0, taxYear: 2027 }])
    // A year resident elsewhere, an incomplete closing, or a skipped year still leaves a gap.
    expect(commitAcceptedPensionBasis(2027, 'NH', empty, y2026).some((row) => row.taxYear === 2027)).toBe(false)
    const incomplete = commitAcceptedPensionBasis(2026, 'MA', { ...empty, pensionBasisPools: [pool, pool] }, [])
    expect(commitAcceptedPensionBasis(2027, 'MA', empty, incomplete).some((row) => row.taxYear === 2027)).toBe(false)
    expect(commitAcceptedPensionBasis(2028, 'MA', empty, y2026).some((row) => row.taxYear === 2028)).toBe(false)
  })
  it('forwards pension transitions through combined calculators', () => {
    const combined = combineTaxCalculators({ compute: () => 0, computeResult: () => ({ amount: 0,
      status: 'complete', issues: [], pensionBasisPools: [pool] }) })
    expect(combined.computeResult!({ year: 2026, filingStatus: 'single', ordinaryIncome: 0,
      capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0 }).pensionBasisPools).toEqual([pool])
  })
})
