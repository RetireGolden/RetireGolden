import { describe, expect, it } from 'vitest'
import { applyAcceptedPensionBasisToYearFacts, commitAcceptedPensionBasis, type AcceptedStatePensionBasisSnapshot, type PensionBasisSettledYear } from './statePensionBasisLifecycle.js'
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
  it('carries a complete closing through a settled year with no distribution, and only that', () => {
    const empty = { amount: 0, status: 'complete' as const, issues: [] }
    const idle = (state = 'MA', extra: Partial<PensionBasisSettledYear> = {}): PensionBasisSettledYear =>
      ({ state, distributions: [], ...extra })
    const y2026 = commitAcceptedPensionBasis(2026, { ...empty, pensionBasisPools: [pool] }, [], idle())
    const y2027 = commitAcceptedPensionBasis(2027, empty, y2026, idle())
    expect(y2027.find((row) => row.taxYear === 2027)).toEqual({ ...pool, openingBasis: 40, basisConsumed: 0, closingBasis: 40, taxYear: 2027 })
    expect(applyAcceptedPensionBasisToYearFacts([fact], 'MA', 2028, y2027)?.[0]?.knownPreviouslyTaxedBasis).toBe(40)
    // A distribution from another account does not stop the carry.
    expect(commitAcceptedPensionBasis(2027, empty, y2026, idle('MA', { distributions: [{ ...fact, accountId: 'other' }] }))
      .some((row) => row.taxYear === 2027)).toBe(true)
    // A year this year's own transition covers is not overwritten by the carry.
    const drawn = commitAcceptedPensionBasis(2027, { ...empty, pensionBasisPools: [{ ...pool, openingBasis: 40, basisConsumed: 40, closingBasis: 0 }] }, y2026, idle())
    expect(drawn.filter((row) => row.taxYear === 2027)).toEqual([{ ...pool, openingBasis: 40, basisConsumed: 40, closingBasis: 0, taxYear: 2027 }])
    const gap = (snapshots: readonly AcceptedStatePensionBasisSnapshot[], year: number) => !snapshots.some((row) => row.taxYear === year)
    // These years still leave a gap, read next year as unknown basis:
    // - a distribution from the account whose transition is missing (e.g. a calculator that returns no pools);
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026, idle('MA', { distributions: [fact] })), 2027)).toBe(true)
    // - unknown distribution facts, or no settled-year context at all;
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026, idle('MA', { distributions: undefined })), 2027)).toBe(true)
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026), 2027)).toBe(true)
    // - a recorded basis addition this lifecycle does not price;
    const addition = { taxYear: 2027, state: 'MA', accountId: 'pension', ownerPersonId: 'p', kind: 'pension' as const,
      additions: 1_000, provenance: { source: 'user', asOf: '2026-01-01' } }
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026, idle('MA', { basisPoolEvidence: [addition] })), 2027)).toBe(true)
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026, idle('MA', { basisPoolEvidence: [{ ...addition, additions: 0 }] })), 2027)).toBe(false)
    // - a year resident elsewhere, an incomplete closing, or a skipped year.
    expect(gap(commitAcceptedPensionBasis(2027, empty, y2026, idle('NH')), 2027)).toBe(true)
    const incomplete = commitAcceptedPensionBasis(2026, { ...empty, pensionBasisPools: [pool, pool] }, [], idle())
    expect(gap(commitAcceptedPensionBasis(2027, empty, incomplete, idle()), 2027)).toBe(true)
    expect(gap(commitAcceptedPensionBasis(2028, empty, y2026, idle()), 2028)).toBe(true)
  })
  it('forwards pension transitions through combined calculators', () => {
    const combined = combineTaxCalculators({ compute: () => 0, computeResult: () => ({ amount: 0,
      status: 'complete', issues: [], pensionBasisPools: [pool] }) })
    expect(combined.computeResult!({ year: 2026, filingStatus: 'single', ordinaryIncome: 0,
      capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0 }).pensionBasisPools).toEqual([pool])
  })
})
