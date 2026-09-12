import { describe, expect, it } from 'vitest'
import { applyAcceptedNjIraBasisToYearFacts, commitAcceptedNjIraBasis } from './stateNjIraBasisLifecycle.js'
import { combineTaxCalculators } from '../../tax/federalTax.js'

describe('NJ annual owner basis lifecycle', () => {
  const annual = { state: 'NJ' as const, ownerPersonId: 'p', status: 'complete' as const,
    openingBasis: 200, basisConsumed: 20, closingBasis: 180 }
  it('carries accepted annual remainder plus explicit new contributions once', () => {
    const snapshots = commitAcceptedNjIraBasis(2026, { amount: 0, status: 'complete', issues: [], njIraBasisPools: [annual] }, [])
    const facts = [{ ownerPersonId: 'p', december31IraValue: 900, allAnnualDistributions: 100,
      fullLiquidation: false, unrecoveredNjTaxedContributions: { known: true as const, amount: 200 } }]
    expect(applyAcceptedNjIraBasisToYearFacts(facts, 2027, snapshots, [{ ownerPersonId: 'p', amount: { known: true, amount: 30 } }])?.[0])
      .toMatchObject({ allAnnualDistributions: 100, unrecoveredNjTaxedContributions: { known: true, amount: 210 } })
    expect(applyAcceptedNjIraBasisToYearFacts(facts, 2027, snapshots)?.[0]?.unrecoveredNjTaxedContributions).toEqual({ known: false })
    expect(facts[0]?.unrecoveredNjTaxedContributions.amount).toBe(200)
    expect(commitAcceptedNjIraBasis(2026, { amount: 0, status: 'complete', issues: [], njIraBasisPools: [annual, annual] }, [])[0]?.status).toBe('incomplete')
  })
  it('preserves owner transitions through federal/state composition', () => {
    const combined = combineTaxCalculators({ compute: () => 1, computeResult: () => ({ amount: 1, status: 'complete', issues: [], njIraBasisPools: [annual] }) })
    expect(combined.computeResult!({ year: 2026, filingStatus: 'single', ordinaryIncome: 0,
      capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0 }).njIraBasisPools).toEqual([annual])
  })
})
