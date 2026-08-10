import { describe, expect, it } from 'vitest'

import { couplePlan, singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { missingDataBasis } from './missingDataBasis.js'

function context(): DetectorContext {
  const plan = singlePersonPlan({ retirementAge: null })
  plan.accounts = [
    { id: 'roth', name: 'Roth IRA', type: 'roth', balance: 125_000, contributionBasis: undefined },
    { id: 'trad', name: 'Traditional IRA', type: 'traditional', kind: 'ira', ownerPersonId: 'p1', balance: 300_000, nondeductibleBasis: undefined },
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
          {
            year: 2026,
            people: [{ personId: 'p1', ageAttained: 60, alive: true }],
            ownedTraditionalIraAggregateActivity: [
              { ownerPersonId: 'p1', distributions: 1, conversions: 0 },
            ],
            ownedRothIraPoolActivity: [],
            employerRothAccountActivity: [],
            qualifiedAnnuityPayments: [],
          },
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
        { label: 'Traditional IRA owned-IRA distributions (projection)', value: '$1', year: 2026 },
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

  it('stays silent for an untouched traditional IRA', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      qualifiedAnnuityPayments?: unknown[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 0, conversions: 0 },
    ]
    year.qualifiedAnnuityPayments = []
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it.each([
    ['a traditional withdrawal', { distributions: 1, conversions: 0 }],
    ['a Roth conversion', { distributions: 0, conversions: 1 }],
  ])('flags a traditional IRA with %s while its owner is alive', (_label, activity) => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
    }
    year.ownedTraditionalIraAggregateActivity = [{ ownerPersonId: 'p1', ...activity }]
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    const activityLabel = activity.distributions > 0
      ? 'Traditional IRA owned-IRA distributions (projection)'
      : 'Traditional IRA owned-IRA conversions (projection)'
    const activityValue = activity.distributions > 0
      ? usd(activity.distributions)
      : usd(activity.conversions)
    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: activityLabel, value: activityValue, year: 2026 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
    ])
  })

  it('cites the first decisive year amount for traditional-IRA distributions, not a horizon sum', () => {
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 60, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          { ownerPersonId: 'p1', distributions: 0, conversions: 0 },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
      {
        year: 2027,
        people: [{ personId: 'p1', ageAttained: 61, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          { ownerPersonId: 'p1', distributions: 4_000, conversions: 0 },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
      {
        year: 2028,
        people: [{ personId: 'p1', ageAttained: 62, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          { ownerPersonId: 'p1', distributions: 6_000, conversions: 0 },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
    ] as never
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA owned-IRA distributions (projection)', value: '$4,000', year: 2027 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
    ])
  })

  it('flags an owned IRA when only published owned-IRA activity is present (inherited pools no longer silence)', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 1, conversions: 0 },
    ]
    ctx.plan.accounts = [
      ctx.plan.accounts[1]!,
      {
        id: 'inherited-traditional',
        name: 'Inherited traditional IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA owned-IRA distributions (projection)', value: '$1', year: 2026 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
    ])
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

  it('uses the single real gap as the sole account evidence', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 1, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$1', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
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

  it('cites property value alongside zero expected net proceeds when value is positive', () => {
    const ctx = context()
    const property = ctx.plan.accounts[2] as { expectedNetProceeds?: number; value: number }
    property.expectedNetProceeds = 0

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual(
      expect.arrayContaining([
        {
          label: 'Lake home expected net proceeds (legacy net-proceeds path)',
          value: '$0',
          year: 2029,
        },
        {
          label: 'Lake home property value',
          value: '$500,000',
          year: 2029,
        },
      ]),
    )
  })

  it('formats sub-dollar decisive Roth withdrawals with cents', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 0.4, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$0.40', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
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

  it('flags positive open-ended wages after a zero-gross open-ended wage stream', () => {
    const ctx = context()
    ctx.plan.accounts = []
    ctx.plan.incomes = [
      { id: 'zero-wages', type: 'wages', personId: 'p1', annualGross: 0, endAge: null },
      { id: 'positive-wages', type: 'wages', personId: 'p1', annualGross: 100_000, endAge: null },
    ] as never

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Pat age at projection start (wages assumed to continue for life)', value: '60', year: 2026 },
    ])
  })

  it('stays silent for a planned sale of a zero-value property', () => {
    const ctx = context()
    ctx.plan.accounts = [{
      id: 'home',
      name: 'Lake home',
      type: 'property',
      value: 0,
      plannedSaleYear: 2029,
      costBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent for a Roth account owned by someone age 60 or older', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    ctx.plan.accounts = [{
      id: 'roth',
      name: 'Roth IRA',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 125_000,
      contributionBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags a Roth account owned by someone under age 60', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 1, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth',
      name: 'Roth IRA',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 125_000,
      contributionBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$1', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('stays silent for an under-60 Roth owner without a modeled pre-60 Roth withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth',
      name: 'Roth IRA',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 125_000,
      contributionBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent for open-ended wages of a person dead at projection start', () => {
    const ctx = context()
    ctx.plan.accounts = []
    ctx.projection.result.years[0]!.people[0]!.alive = false

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags each under-60 Roth owner from their published pool activity (no multi-owner silence)', () => {
    const plan = couplePlan({ p1Dob: '1970-01-01', p2Dob: '1970-01-01' })
    plan.accounts = [
      {
        id: 'roth-p1',
        name: 'Pat Roth IRA',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 125_000,
        contributionBasis: undefined,
      },
      {
        id: 'roth-p2',
        name: 'Robin Roth IRA',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p2',
        balance: 80_000,
        contributionBasis: undefined,
      },
    ] as never
    plan.incomes = []
    const ctx = {
      plan,
      params: { year: 2026 },
      projection: {
        startYear: 2026,
        result: {
          years: [
            {
              year: 2026,
              people: [
                { personId: 'p1', ageAttained: 56, alive: true },
                { personId: 'p2', ageAttained: 56, alive: true },
              ],
              ownedRothIraPoolActivity: [
                { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
                { ownerPersonId: 'p2', withdrawals: 0, creditedContributions: 0 },
              ],
              employerRothAccountActivity: [],
              ownedTraditionalIraAggregateActivity: [],
              qualifiedAnnuityPayments: [],
            },
          ],
        },
      },
    } as unknown as DetectorContext

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Pat Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Pat Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('stays silent when a 60-or-older spouse also owns a Roth account with no under-60 pool draw', () => {
    const plan = couplePlan({ p1Dob: '1970-01-01', p2Dob: '1950-01-01' })
    plan.accounts = [
      { id: 'roth-p1', name: 'Pat Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000, contributionBasis: undefined },
      { id: 'roth-p2', name: 'Robin Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p2', balance: 80_000, contributionBasis: undefined },
    ] as never
    plan.incomes = []
    const ctx = {
      plan,
      params: { year: 2026 },
      projection: {
        startYear: 2026,
        result: {
          years: [{
            year: 2026,
            people: [
              { personId: 'p1', ageAttained: 56, alive: true },
              { personId: 'p2', ageAttained: 76, alive: true },
            ],
            // Withdrawals on the older spouse's pool do not count as pre-qualified
            // for the under-60 owner; Pat's pool has no draw.
            ownedRothIraPoolActivity: [
              { ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 0 },
              { ownerPersonId: 'p2', withdrawals: 5_000, creditedContributions: 0 },
            ],
            employerRothAccountActivity: [],
            ownedTraditionalIraAggregateActivity: [],
            qualifiedAnnuityPayments: [],
          }],
        },
      },
    } as unknown as DetectorContext

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags owned Roth from published pool activity even when an inherited Roth also exists', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      {
        id: 'roth',
        name: 'Roth IRA',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 125_000,
        contributionBasis: undefined,
      },
      {
        id: 'inherited-roth',
        name: 'Inherited Roth IRA',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
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
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('attributes employer and owned Roth from their separate published activity channels', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      employerRothAccountActivity?: {
        accountId: string
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.employerRothAccountActivity = [
      { accountId: 'employer-roth', ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      {
        id: 'roth',
        name: 'Roth IRA',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 125_000,
        contributionBasis: undefined,
      },
      {
        id: 'employer-roth',
        name: 'Roth 401(k)',
        type: 'roth',
        kind: 'employer',
        ownerPersonId: 'p1',
        balance: 50_000,
        contributionBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('stays silent when another Roth IRA in the owner pool supplies enough basis', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'missing-basis', name: 'Missing-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000 },
      { id: 'supplied-basis', name: 'Supplied-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 10_000, contributionBasis: 5_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags a missing Roth IRA basis when the owner pool supplied basis is insufficient', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'missing-basis', name: 'Missing-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000 },
      { id: 'supplied-basis', name: 'Supplied-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 10_000, contributionBasis: 4_999 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Missing-basis Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Missing-basis Roth IRA known contribution basis', value: '$4,999', year: 2026 },
    ])
  })

  it('stays silent when published credited contributions cover a pre-60 withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 5_000 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent when seasoned conversion principal covers a pre-60 withdrawal', () => {
    // splitRothWithdrawal: year - conversionYear >= 5 is seasoned (tax- and penalty-free).
    // Conversion in 2021 is seasoned by 2026 (2026 - 2021 = 5); covers the draw without
    // contribution basis.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2021,
        people: [{ personId: 'p1', ageAttained: 54, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 5_000,
            conversionYear: 2021,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 5_000,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags when unseasoned conversion principal does not free-cover a pre-60 withdrawal', () => {
    // Conversion in 2022 is still unseasoned in 2026 (2026 - 2022 = 4 < 5).
    // Fully taxable (default when taxable split is absent) — not free cover.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2022,
        people: [{ personId: 'p1', ageAttained: 55, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 5_000,
            conversionYear: 2022,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 5_000,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('stays silent when unseasoned nontaxable conversion principal covers a pre-60 withdrawal', () => {
    // Nondeductible IRA basis rolled into Roth: principal is conversion layer but
    // taxableAmount is 0 — free cover even while unseasoned (no recapture).
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2022,
        people: [{ personId: 'p1', ageAttained: 55, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 5_000,
            creditedConversionTaxableAmount: 0,
            conversionYear: 2022,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 5_000,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            creditedConversionTaxableAmount: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags when unseasoned taxable conversion principal does not free-cover a pre-60 withdrawal', () => {
    // Fully taxable unseasoned conversion: recapture applies to whole layer —
    // not free cover for the basis-sufficiency walk.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2022,
        people: [{ personId: 'p1', ageAttained: 55, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 5_000,
            creditedConversionTaxableAmount: 5_000,
            conversionYear: 2022,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 5_000,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            creditedConversionTaxableAmount: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('does not treat mixed unseasoned nontaxable share as free cover ($100 / $40 taxable)', () => {
    // splitRothWithdrawal: taxableTake = take * taxable/amount — nontaxable is not
    // independently withdrawable. Mixed unseasoned free cover is $0; a $50 draw
    // has recapture exposure and must flag (suppression cannot use the $60 nontaxable
    // share as if it could be taken alone).
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2024,
        people: [{ personId: 'p1', ageAttained: 54, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 100,
            creditedConversionTaxableAmount: 40,
            conversionYear: 2024,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 56, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 50,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            creditedConversionTaxableAmount: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$50', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('still free-covers a draw from contributions without tapping a mixed unseasoned layer', () => {
    // Contributions $50 free-cover the draw; mixed unseasoned layer is unused.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2024,
        people: [{ personId: 'p1', ageAttained: 54, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 100,
            creditedConversionTaxableAmount: 40,
            conversionYear: 2024,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 56, alive: true }],
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: 'p1',
            withdrawals: 50,
            creditedContributions: 50,
            creditedConversionPrincipal: 0,
            creditedConversionTaxableAmount: 0,
            conversionYear: null,
          },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent for a missing-basis traditional IRA when other owned IRAs already make Form 8606 fully nontaxable', () => {
    // Other IRA supplies $200k basis against a $150k aggregate pool (basis ≥ pool,
    // e.g. after losses). openIraProRataYear → nontaxableFraction 1; extra basis
    // on the missing account cannot change tax character.
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      balances?: Record<string, number>
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 5_000, conversions: 0 },
    ]
    // Published transaction-year pool still at or below known basis.
    year.balances = { 'trad-basis': 100_000, 'trad-missing': 50_000 }
    ctx.plan.accounts = [
      {
        id: 'trad-basis',
        name: 'Basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 100_000,
        nondeductibleBasis: 200_000,
      },
      {
        id: 'trad-missing',
        name: 'Missing-basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        nondeductibleBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags when opening-pool saturation would skip but published transaction-year pool exceeds known basis', () => {
    // Opening: $200k basis vs $150k pool → would look fully nontaxable. Growth
    // lifts the transaction-year pool to $250k, so missing basis can still matter.
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      balances?: Record<string, number>
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 5_000, conversions: 0 },
    ]
    year.balances = { 'trad-basis': 180_000, 'trad-missing': 70_000 }
    ctx.plan.accounts = [
      {
        id: 'trad-basis',
        name: 'Basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 100_000,
        nondeductibleBasis: 200_000,
      },
      {
        id: 'trad-missing',
        name: 'Missing-basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        nondeductibleBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Missing-basis IRA owned-IRA distributions (projection)', value: '$5,000', year: 2026 },
      { label: 'Missing-basis IRA balance (assumed zero after-tax basis)', value: '$50,000' },
    ])
  })

  it('still flags a missing-basis traditional IRA when other owned basis does not reach 100% nontaxable', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 5_000, conversions: 0 },
    ]
    ctx.plan.accounts = [
      {
        id: 'trad-basis',
        name: 'Basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 100_000,
        nondeductibleBasis: 40_000,
      },
      {
        id: 'trad-missing',
        name: 'Missing-basis IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        nondeductibleBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Missing-basis IRA owned-IRA distributions (projection)', value: '$5,000', year: 2026 },
      { label: 'Missing-basis IRA balance (assumed zero after-tax basis)', value: '$50,000' },
    ])
  })

  it('stays silent for an employer Roth when published conversion principal free-covers a pre-60 withdrawal', () => {
    // Seasoned conversion credit on the employer account (same walk as owned pool).
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2021,
        people: [{ personId: 'p1', ageAttained: 54, alive: true }],
        employerRothAccountActivity: [
          {
            accountId: 'roth-401k',
            ownerPersonId: 'p1',
            withdrawals: 0,
            creditedContributions: 0,
            creditedConversionPrincipal: 5_000,
            creditedConversionTaxableAmount: 5_000,
            conversionYear: 2021,
          },
        ],
        ownedRothIraPoolActivity: [],
        ownedTraditionalIraAggregateActivity: [],
      },
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        employerRothAccountActivity: [
          {
            accountId: 'roth-401k',
            ownerPersonId: 'p1',
            withdrawals: 5_000,
            creditedContributions: 0,
            creditedConversionPrincipal: 0,
            creditedConversionTaxableAmount: 0,
            conversionYear: null,
          },
        ],
        ownedRothIraPoolActivity: [],
        ownedTraditionalIraAggregateActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth-401k', name: 'Roth 401(k)', type: 'roth', kind: 'employer', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('does not count a limit-clipped published credit as its scheduled amount', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 4_999 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$4,999', year: 2026 },
    ])
  })

  it('flags a missing Roth IRA basis when published credits do not cover a pre-60 withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 4_999 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$4,999', year: 2026 },
    ])
  })

  it('flags a traditional IRA with payments from its qualified annuity via published payments', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      qualifiedAnnuityPayments?: { annuityAccountId: string; payment: number; fundingOwnerPersonId: string }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 0, conversions: 0 },
    ]
    year.qualifiedAnnuityPayments = [
      { annuityAccountId: 'annuity', payment: 1_200, fundingOwnerPersonId: 'p1' },
    ]
    ctx.plan.accounts = [
      { id: 'trad', name: 'Traditional IRA', type: 'traditional', kind: 'ira', ownerPersonId: 'p1', balance: 300_000 },
      {
        id: 'annuity', name: 'IRA annuity', type: 'annuity', ownerPersonId: 'p1', startAge: 60,
        monthlyAmount: 100, colaPct: 0, taxablePct: 100,
        purchase: { year: 2026, premium: 25_000, fundingAccountId: 'trad', taxQualification: 'qualified' },
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA IRA-funded annuity payments (projection)', value: '$1,200', year: 2026 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
    ])
  })

  it('stays silent for a qualified IRA annuity without modeled payments', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      qualifiedAnnuityPayments?: unknown[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 0, conversions: 0 },
    ]
    year.qualifiedAnnuityPayments = []
    ctx.plan.accounts = [
      { id: 'trad', name: 'Traditional IRA', type: 'traditional', kind: 'ira', ownerPersonId: 'p1', balance: 300_000 },
      {
        id: 'annuity', name: 'IRA annuity', type: 'annuity', ownerPersonId: 'p1', startAge: 60,
        monthlyAmount: 100, colaPct: 0, taxablePct: 100,
        purchase: { year: 2026, premium: 25_000, fundingAccountId: 'trad', taxQualification: 'qualified' },
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('resolves a null Roth owner to the primary person via published activity', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'primary-roth', name: 'Primary Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: null, balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Primary Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Primary Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('flags a sole employer Roth with omitted basis before age 60', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      employerRothAccountActivity?: {
        accountId: string
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
    }
    year.employerRothAccountActivity = [
      { accountId: 'roth-401k', ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
    ]
    year.ownedRothIraPoolActivity = []
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'roth-401k', name: 'Roth 401(k)', type: 'roth', kind: 'employer', ownerPersonId: 'p1', balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth 401(k) pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth 401(k) known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('stays silent for a sole employer Roth whose published credited contributions cover its own withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      employerRothAccountActivity?: {
        accountId: string
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
    }
    year.employerRothAccountActivity = [
      { accountId: 'roth-401k', ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 5_000 },
    ]
    year.ownedRothIraPoolActivity = []
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth-401k', name: 'Roth 401(k)', type: 'roth', kind: 'employer', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('does not let a later-year credit retroactively cover an earlier pre-60 withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 58, alive: true }],
        ownedRothIraPoolActivity: [
          { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
      {
        year: 2027,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        ownedRothIraPoolActivity: [
          { ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 5_000 },
        ],
        ownedTraditionalIraAggregateActivity: [],
        employerRothAccountActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('does not let a later employer Roth credit retroactively cover an earlier pre-60 withdrawal', () => {
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 58, alive: true }],
        employerRothAccountActivity: [
          { accountId: 'roth-401k', ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
        ],
        ownedRothIraPoolActivity: [],
        ownedTraditionalIraAggregateActivity: [],
      },
      {
        year: 2027,
        people: [{ personId: 'p1', ageAttained: 59, alive: true }],
        employerRothAccountActivity: [
          { accountId: 'roth-401k', ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 5_000 },
        ],
        ownedRothIraPoolActivity: [],
        ownedTraditionalIraAggregateActivity: [],
      },
    ] as never
    ctx.plan.accounts = [{
      id: 'roth-401k', name: 'Roth 401(k)', type: 'roth', kind: 'employer', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth 401(k) pre-qualified-age withdrawals', value: '$5,000', year: 2026 },
      { label: 'Roth 401(k) known contribution basis', value: '$0', year: 2026 },
    ])
  })

  it('flags IRA-funded annuity payments after the funding owner dies (surviving-spouse contract)', () => {
    // Alive-guard must not skip published qualifiedAnnuityPayments: the sim still
    // attributes post-death payments to the deceased funding owner's Form 8606 pool.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 70, alive: false }],
        ownedTraditionalIraAggregateActivity: [],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [
          { annuityAccountId: 'annuity', payment: 1_200, fundingOwnerPersonId: 'p1' },
        ],
      },
    ] as never
    ctx.plan.accounts = [
      { id: 'trad', name: 'Traditional IRA', type: 'traditional', kind: 'ira', ownerPersonId: 'p1', balance: 300_000 },
      {
        id: 'annuity', name: 'IRA annuity', type: 'annuity', ownerPersonId: 'p1', startAge: 60,
        monthlyAmount: 100, colaPct: 0, taxablePct: 100,
        purchase: { year: 2020, premium: 25_000, fundingAccountId: 'trad', taxQualification: 'qualified' },
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA IRA-funded annuity payments (projection)', value: '$1,200', year: 2026 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$300,000' },
    ])
  })

  it('flags a zero-balance Roth when owner-pool activity shows an under-age withdrawal exceeding known basis', () => {
    // Market balance can be $0 while missing contributionBasis still matters once
    // modeled credits/growth fund a pre-60 withdrawal.
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 55
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: { ownerPersonId: string; withdrawals: number; creditedContributions: number }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 3_000, creditedContributions: 2_000 },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth',
      name: 'Roth IRA',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 0,
      contributionBasis: undefined,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool pre-qualified-age withdrawals', value: '$3,000', year: 2026 },
      { label: 'Roth IRA known contribution basis', value: '$2,000', year: 2026 },
    ])
  })

  it('flags a zero-balance funding IRA when published contract payments attribute to its owner', () => {
    // Pre-projection annuity fully funded from the IRA: balance is $0 but Form 8606
    // basis still feeds contract payments published under fundingOwnerPersonId.
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: { ownerPersonId: string; distributions: number; conversions: number }[]
      qualifiedAnnuityPayments?: { annuityAccountId: string; payment: number; fundingOwnerPersonId: string }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      { ownerPersonId: 'p1', distributions: 0, conversions: 0 },
    ]
    year.qualifiedAnnuityPayments = [
      { annuityAccountId: 'annuity', payment: 1_200, fundingOwnerPersonId: 'p1' },
    ]
    ctx.plan.accounts = [
      {
        id: 'trad',
        name: 'Traditional IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 0,
        nondeductibleBasis: undefined,
      },
      {
        id: 'annuity', name: 'IRA annuity', type: 'annuity', ownerPersonId: 'p1', startAge: 60,
        monthlyAmount: 100, colaPct: 0, taxablePct: 100,
        purchase: { year: 2020, premium: 200_000, fundingAccountId: 'trad', taxQualification: 'qualified' },
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA IRA-funded annuity payments (projection)', value: '$1,200', year: 2026 },
      { label: 'Traditional IRA balance (assumed zero after-tax basis)', value: '$0' },
    ])
  })
})

function usd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}
