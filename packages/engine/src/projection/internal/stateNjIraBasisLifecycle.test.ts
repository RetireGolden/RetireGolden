import { describe, expect, it } from 'vitest'
import { applyAcceptedNjIraBasisToYearFacts, commitAcceptedNjIraBasis, njIraYearContributionAdditions, reconcileProjectedNjIraYearEnd, seedAcceptedNjIraBasisFromEvidence } from './stateNjIraBasisLifecycle.js'
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
  const projected = { ownerPersonId: 'p', december31IraValue: 190_000, allAnnualDistributions: 10_000,
    fullLiquidation: false, annualInputsComplete: true, unrecoveredNjTaxedContributions: { known: false as const },
    projectedLedger: { accounts: [{ accountId: 'ira', balance: 190_000, growthFactor: 1, treatedAsOwn: false }] } }
  it('fills a projected ledger pool from the prior-year carry, or drops it', () => {
    const snapshots = commitAcceptedNjIraBasis(2026, { amount: 0, status: 'complete', issues: [],
      njIraBasisPools: [{ ...annual, openingBasis: 50_000, basisConsumed: 0, closingBasis: 50_000 }] }, [])
    const added = [{ ownerPersonId: 'p', amount: { known: true as const, amount: 0 } }]
    expect(applyAcceptedNjIraBasisToYearFacts([projected], 2027, snapshots, added)?.[0]?.unrecoveredNjTaxedContributions)
      .toEqual({ known: true, amount: 50_000 })
    // No carry (Case A), a gap year, or an incomplete prior year: no pool, so
    // the QCD keeps nj-qcd-basis-unknown rather than a zero basis.
    expect(applyAcceptedNjIraBasisToYearFacts([projected], 2027, [], added)).toBeUndefined()
    expect(applyAcceptedNjIraBasisToYearFacts([projected], 2028, snapshots, added)).toBeUndefined()
    const incomplete = commitAcceptedNjIraBasis(2026, { amount: 0, status: 'complete', issues: [], njIraBasisPools: [annual, annual] }, [])
    expect(applyAcceptedNjIraBasisToYearFacts([projected], 2027, incomplete, added)).toBeUndefined()
    // An evidence pool beside a dropped projected one stays.
    const evidence = { ...projected, ownerPersonId: 'q', unrecoveredNjTaxedContributions: { known: true as const, amount: 1 } }
    delete (evidence as { projectedLedger?: unknown }).projectedLedger
    expect(applyAcceptedNjIraBasisToYearFacts([evidence, projected], 2027, [], added)).toEqual([evidence])
  })
  it('opens the carry from the filed Worksheet C of the year before the projection', () => {
    // Line 1 900, line 2 100, line 3 1,000, line 4b 100: line 8 = 100 x 100/1,000 = 10.
    const seeded = seedAcceptedNjIraBasisFromEvidence(2026, [{ ownerPersonId: 'p', december31IraValue: 900,
      allAnnualDistributions: 100, fullLiquidation: false, annualInputsComplete: true,
      unrecoveredNjTaxedContributions: { known: true, amount: 100 } }])
    expect(seeded).toEqual([{ state: 'NJ', ownerPersonId: 'p', status: 'complete', taxYear: 2026,
      openingBasis: 100, basisConsumed: 10, closingBasis: 90 }])
    expect(seedAcceptedNjIraBasisFromEvidence(2026, undefined)).toEqual([])
    expect(seedAcceptedNjIraBasisFromEvidence(2026, [{ ownerPersonId: 'p', december31IraValue: 900,
      allAnnualDistributions: 100, fullLiquidation: false, unrecoveredNjTaxedContributions: { known: false } }])[0]?.status)
      .toBe('incomplete')
  })
  it('holds a priced projected line 1 to the year-end ledger', () => {
    const result = { amount: 1, status: 'complete' as const, issues: [],
      njIraBasisPools: [{ state: 'NJ' as const, ownerPersonId: 'p', status: 'complete' as const, openingBasis: 50_000, basisConsumed: 2_500, closingBasis: 47_500 }] }
    const priced = [{ ...projected, unrecoveredNjTaxedContributions: { known: true as const, amount: 50_000 } }]
    expect(reconcileProjectedNjIraYearEnd(2027, result, priced, () => 190_000)).toBe(result)
    const off = reconcileProjectedNjIraYearEnd(2027, result, priced, () => 201_400)
    expect(off.status).toBe('incomplete')
    expect(off.issues.map((issue) => issue.code)).toEqual(['nj-ira-projected-year-end-mismatch'])
    expect(off.njIraBasisPools).toEqual([{ state: 'NJ', ownerPersonId: 'p', status: 'incomplete' }])
    expect(commitAcceptedNjIraBasis(2027, off, [])[0]?.status).toBe('incomplete')
  })
  it('adds modeled contributions, plus reported post-year ones, and keeps an omitted amount unknown', () => {
    const row = { taxYear: 2027, state: 'nj', ownerPersonId: 'p', postYearContributionsThroughFilingDeadline: 500 }
    const modeled = new Map([['p', 7_000], ['q', 1_000]])
    expect(njIraYearContributionAdditions([row], 2027, ['p', 'q', 'r'], modeled)).toEqual([
      { ownerPersonId: 'p', amount: { known: true, amount: 7_500 } },
      { ownerPersonId: 'q', amount: { known: true, amount: 1_000 } },
      { ownerPersonId: 'r', amount: { known: true, amount: 0 } },
    ])
    const missing = { taxYear: 2027, state: 'nj', ownerPersonId: 'p' }
    expect(njIraYearContributionAdditions([missing], 2027, ['p'], modeled)).toEqual([{ ownerPersonId: 'p', amount: { known: false } }])
  })
})
