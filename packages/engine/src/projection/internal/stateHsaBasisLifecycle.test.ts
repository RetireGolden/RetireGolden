import { describe, expect, it } from 'vitest'
import { combineTaxCalculators } from '../../tax/federalTax.js'
import { applyAcceptedHsaBasisToYearFacts, commitAcceptedHsaBasis } from './stateHsaBasisLifecycle.js'
import type { StateHsaAccountYearFactsInput } from '../types.js'

describe('accepted HSA basis lifecycle', () => {
  it('uses accepted closing instead of stale next-year evidence and isolates states', () => {
    const snapshots = commitAcceptedHsaBasis(2026, { amount: 0, status: 'complete', issues: [], hsaBasisPools: [{
      state: 'CA', accountId: 'hsa', ownerPersonId: 'p', status: 'complete',
      openingBasis: 100, basisAdded: 20, basisConsumed: 30, closingBasis: 90,
    }] }, [])
    const facts = [{ accountId: 'hsa', ownerPersonId: 'p', stateBasisBeforeYear: { known: true, amount: 100 } }] as StateHsaAccountYearFactsInput[]
    expect(applyAcceptedHsaBasisToYearFacts(facts, 'CA', 2027, snapshots)?.[0]?.stateBasisBeforeYear).toEqual({ known: true, amount: 90 })
    expect(applyAcceptedHsaBasisToYearFacts(facts, 'NJ', 2027, snapshots)?.[0]?.stateBasisBeforeYear).toEqual({ known: true, amount: 100 })
    expect(facts[0]?.stateBasisBeforeYear).toEqual({ known: true, amount: 100 })
    expect(applyAcceptedHsaBasisToYearFacts(facts, 'CA', 2028, snapshots)?.[0]?.stateBasisBeforeYear).toEqual({ known: false })
  })

  it('does not double-consume duplicate result rows or fabricate a missing closing', () => {
    const pool = { state: 'NJ', accountId: 'hsa', ownerPersonId: 'p', status: 'complete' as const,
      openingBasis: 100, basisAdded: 0, basisConsumed: 10, closingBasis: 90 }
    const snapshots = commitAcceptedHsaBasis(2026, { amount: 0, status: 'complete', issues: [], hsaBasisPools: [pool, pool] }, [])
    expect(snapshots[0]).toMatchObject({ status: 'incomplete' })
    expect(snapshots[0]?.closingBasis).toBeUndefined()
  })
})


it('preserves state basis transitions through the combined calculator', () => {
  const pools = [{ state: 'CA', accountId: 'hsa', ownerPersonId: 'p', status: 'complete' as const,
    openingBasis: 100, basisAdded: 0, basisConsumed: 10, closingBasis: 90 }]
  const calculator = combineTaxCalculators({ compute: () => 10 }, {
    compute: () => 20, computeResult: () => ({ amount: 20, status: 'complete', issues: [], hsaBasisPools: pools }),
  })
  const result = calculator.computeResult!({ year: 2026, filingStatus: 'single', ordinaryIncome: 0,
    capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0 })
  expect(result.amount).toBe(30)
  expect(result.hsaBasisPools).toEqual(pools)
})
