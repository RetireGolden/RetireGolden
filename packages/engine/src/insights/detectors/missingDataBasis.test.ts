import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { missingDataBasis } from './missingDataBasis.js'

function context(): DetectorContext {
  const plan = singlePersonPlan({ retirementAge: null })
  plan.accounts = [
    { id: 'roth', name: 'Roth IRA', type: 'roth', balance: 125_000, contributionBasis: undefined },
    { id: 'trad', name: 'Traditional IRA', type: 'traditional', kind: 'ira', balance: 300_000, nondeductibleBasis: undefined },
    {
      id: 'home',
      name: 'Lake home',
      type: 'property',
      value: 500_000,
      plannedSaleYear: 2029,
      costBasis: undefined,
    },
  ] as never
  plan.incomes = [
    { id: 'wages', type: 'wages', personId: 'p1', annualGross: 100_000, endAge: null },
  ] as never
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: {
        years: [
          { year: 2026, people: [{ personId: 'p1', ageAttained: 60, alive: true }] },
          { year: 2029, people: [{ personId: 'p1', ageAttained: 63, alive: true }] },
        ],
      },
    },
  } as unknown as DetectorContext
}

describe('missing data basis detector', () => {
  it('lists each modeled default with the exact account balance or person age', () => {
    const card = missingDataBasis.screen(context())

    expect(card).toMatchObject({
      severity: 'info',
      confidence: 'high',
      evidence: [
        { label: 'Roth IRA balance (assumed seasoned contribution basis)', value: '$125,000' },
        { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
        { label: 'Lake home planned-sale value (legacy net-proceeds path)', value: '$500,000', year: 2029 },
        { label: 'Pat age at projection start (wages assumed to continue for life)', value: '60', year: 2026 },
      ],
    })
  })

  it('stays silent when bases, sale basis, and wage end age are all supplied', () => {
    const ctx = context()
    const [roth, traditional, property] = ctx.plan.accounts
    const rothAccount = roth as { contributionBasis?: number }
    const traditionalAccount = traditional as { nondeductibleBasis?: number }
    const propertyAccount = property as { costBasis?: number }
    const wages = ctx.plan.incomes[0] as { endAge: number | null }
    rothAccount.contributionBasis = 125_000
    traditionalAccount.nondeductibleBasis = 0
    propertyAccount.costBasis = 350_000
    wages.endAge = 65

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it.each([
    ['an employer traditional account', { id: 'employer', name: '401(k)', type: 'traditional', kind: 'employer', balance: 300_000 }],
    [
      'an inherited traditional IRA',
      {
        id: 'inherited-traditional',
        name: 'Inherited traditional IRA',
        type: 'traditional',
        kind: 'ira',
        balance: 300_000,
        inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
      },
    ],
    [
      'an inherited Roth account',
      {
        id: 'inherited-roth',
        name: 'Inherited Roth IRA',
        type: 'roth',
        kind: 'ira',
        balance: 125_000,
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'none',
            beneficiaryBirthYear: 1980,
            soleBeneficiary: true,
            provenance: { source: 'custodian statement', asOf: '2026-01-01' },
          },
        },
      },
    ],
  ] as const)('stays silent for %s without a modeled basis default', (_label, account) => {
    const ctx = context()
    ctx.plan.accounts = [account] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('uses the single real gap as the sole evidence entry', () => {
    const ctx = context()
    ctx.plan.accounts = [
      { id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA balance (assumed seasoned contribution basis)', value: '$125,000' },
    ])
  })

  it('cites expected net proceeds when the legacy sale path models them', () => {
    const ctx = context()
    const property = ctx.plan.accounts[2] as { expectedNetProceeds?: number }
    property.expectedNetProceeds = 450_000

    expect(missingDataBasis.screen(ctx)?.evidence).toContainEqual({
      label: 'Lake home expected net proceeds (legacy net-proceeds path)',
      value: '$450,000',
      year: 2029,
    })
  })

  it.each([2025, 2030])('stays silent for a sale outside the projection window (%i)', (plannedSaleYear) => {
    const ctx = context()
    ctx.plan.accounts = [{
      id: 'home',
      name: 'Lake home',
      type: 'property',
      value: 500_000,
      plannedSaleYear,
      costBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent for open-ended wages with no annual pay', () => {
    const ctx = context()
    ctx.plan.accounts = []
    const wages = ctx.plan.incomes[0] as { annualGross: number }
    wages.annualGross = 0

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })
})
