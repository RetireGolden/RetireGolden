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
              {
                ownerPersonId: 'p1',
                distributions: 1,
                conversions: 0,
                assumedBasisConsequential: {
                  distributions: 1,
                  conversions: 0,
                  annuityPayments: 0,
                },
              },
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
        { label: 'Traditional IRA taxable character from assumed-zero basis (distributions)', value: '$1', year: 2026 },
        { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
        { label: 'Lake home opening property value (legacy net-proceeds path)', value: '$500,000', year: 2026 },
        { label: 'Pat age at projection start (wages assumed to continue for life)', value: '60', year: 2026 },
        { label: 'Pat continuing open-ended wages (no retirement age; assumed for life)', value: '$100,000', year: 2026 },
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

  it('stays silent for an untouched traditional IRA (no published verdict)', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: unknown
      }[]
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
  ])('flags a traditional IRA with published verdict for %s', (_label, activity) => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.ownedTraditionalIraAggregateActivity = [{
      ownerPersonId: 'p1',
      ...activity,
      assumedBasisConsequential: {
        distributions: activity.distributions,
        conversions: activity.conversions,
        annuityPayments: 0,
      },
    }]
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    const activityLabel = activity.distributions > 0
      ? 'Traditional IRA taxable character from assumed-zero basis (distributions)'
      : 'Traditional IRA taxable character from assumed-zero basis (conversions)'
    const activityValue = activity.distributions > 0
      ? `$${activity.distributions}`
      : `$${activity.conversions}`
    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: activityLabel, value: activityValue, year: 2026 },
      { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
    ])
  })

  it('cites the first decisive year with a published verdict, not a later year', () => {
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
          {
            ownerPersonId: 'p1',
            distributions: 4_000,
            conversions: 0,
            assumedBasisConsequential: {
              distributions: 4_000,
              conversions: 0,
              annuityPayments: 0,
            },
          },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
      {
        year: 2028,
        people: [{ personId: 'p1', ageAttained: 62, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          {
            ownerPersonId: 'p1',
            distributions: 6_000,
            conversions: 0,
            assumedBasisConsequential: {
              distributions: 6_000,
              conversions: 0,
              annuityPayments: 0,
            },
          },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
    ] as never
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA taxable character from assumed-zero basis (distributions)', value: '$4,000', year: 2027 },
      // Opening balance is the plan figure — stamp with projection start, not the trigger year.
      { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
    ])
  })

  it('skips a sub-cent traditional verdict year and fires on a later material year', () => {
    // Positive sub-cent residue must not emit and must not stop the owner scan.
    const ctx = context()
    ctx.projection.result.years = [
      {
        year: 2026,
        people: [{ personId: 'p1', ageAttained: 60, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          {
            ownerPersonId: 'p1',
            distributions: 0.004,
            conversions: 0,
            assumedBasisConsequential: {
              distributions: 0.004,
              conversions: 0,
              annuityPayments: 0,
            },
          },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
      {
        year: 2027,
        people: [{ personId: 'p1', ageAttained: 61, alive: true }],
        ownedTraditionalIraAggregateActivity: [
          {
            ownerPersonId: 'p1',
            distributions: 4_000,
            conversions: 0,
            assumedBasisConsequential: {
              distributions: 4_000,
              conversions: 0,
              annuityPayments: 0,
            },
          },
        ],
        ownedRothIraPoolActivity: [],
        employerRothAccountActivity: [],
        qualifiedAnnuityPayments: [],
      },
    ] as never
    ctx.plan.accounts = [ctx.plan.accounts[1]!]
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Traditional IRA taxable character from assumed-zero basis (distributions)', value: '$4,000', year: 2027 },
      { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
    ])
  })

  it('flags an owned IRA from published verdict even when an inherited IRA also exists', () => {
    const ctx = context()
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
      { label: 'Traditional IRA taxable character from assumed-zero basis (distributions)', value: '$1', year: 2026 },
      { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
    ])
  })

  it('stays silent for a treat-as-own traditional IRA with omitted basis (seed path ignores it)', () => {
    // Per-year aggregation (isAggregatedIraThisYear) joins treat-as-own into the
    // Form 8606 denominator and can publish an assumed-zero verdict, but the
    // basis SEED sites that consume nondeductibleBasis into iraBasisByOwner
    // (simulate.ts static isAggregatedIra opener; contiguousReplay pools(plan)
    // without tax year) never include treat-as-own. Requesting the field would
    // ask for data that cannot affect the projection — suppress until seeding
    // covers treat-as-own.
    const ctx = context()
    ctx.plan.accounts = [
      {
        id: 'tao-ira',
        name: 'Treat-as-own IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 300_000,
        // nondeductibleBasis omitted
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'surviving-spouse',
            beneficiaryBirthYear: 1960,
            soleBeneficiary: true,
            ownerBirthYear: 1945,
            election: 'treat-as-own',
            spouseUnlimitedWithdrawalRight: true,
            treatAsOwnElectionYear: 2026,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
    ] as never
    ctx.plan.incomes = []
    // Verdict present (post-election aggregate) must not surface the card.
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: {
          distributions: 1,
          conversions: 0,
          annuityPayments: 0,
        },
      },
    ]

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('stays silent for a genuinely inherited traditional IRA even when a verdict is present for the owner', () => {
    // Permanent inherited regime never joins the owned Form 8606 pool; do not
    // flag omitted basis on remain-beneficiary / non-spouse inherited IRAs.
    const ctx = context()
    ctx.plan.accounts = [
      {
        id: 'inherited-traditional',
        name: 'Inherited traditional IRA',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 300_000,
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
    // Verdict would only exist if some other owned IRA joined; keep it so the
    // test proves the inherited account itself is never named.
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: {
          distributions: 1,
          conversions: 0,
          annuityPayments: 0,
        },
      },
    ]

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

  it('uses the single real Roth gap as the sole account evidence', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 1,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 1 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$1', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
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

  it('pins two-row property evidence for positive expected net proceeds with opening value', () => {
    // Standalone property gap (no other gaps): positive proceeds must still
    // emit the opening property value as the second fact — not a one-row card.
    const ctx = context()
    ctx.plan.accounts = [{
      id: 'home',
      name: 'Lake home',
      type: 'property',
      value: 500_000,
      plannedSaleYear: 2029,
      costBasis: undefined,
      expectedNetProceeds: 450_000,
    }] as never
    ctx.plan.incomes = []
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
      employerRothAccountActivity?: unknown[]
    }
    year.ownedTraditionalIraAggregateActivity = []
    year.ownedRothIraPoolActivity = []
    year.employerRothAccountActivity = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      {
        label: 'Lake home expected net proceeds (legacy net-proceeds path)',
        value: '$450,000',
        year: 2029,
      },
      {
        label: 'Lake home opening property value (legacy net-proceeds path)',
        value: '$500,000',
        year: 2026,
      },
    ])
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
          // Opening value (same label/year stamp as the omitted-proceeds branch).
          label: 'Lake home opening property value (legacy net-proceeds path)',
          value: '$500,000',
          year: 2026,
        },
      ]),
    )
  })

  it('stays silent for a consequential Roth spill below half a cent', () => {
    // Spill > 0 but < 0.005 rounds to $0 evidence — must not fire.
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 0.004 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('fires for a consequential Roth spill at the half-cent visible threshold', () => {
    // 0.005 rounds to $0.01 — guaranteed nonzero rendered amount.
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 0.005 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      {
        label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover',
        value: '$0.01',
        year: 2026,
      },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('formats sub-dollar decisive Roth withdrawals with cents', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 0.4 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$0.40', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('formats non-integral decisive amounts at or above $0.50 with cents', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 0.6 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [{
      id: 'roth', name: 'Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000,
    }] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$0.60', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
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

  it('keeps the fifth evidence value exact and moves overflow into the label', () => {
    // Three owners × (taxable character + opening balance) = 6 gaps → cap 5.
    // Overflow must not corrupt the fifth value (GOVERNANCE exactness).
    const ctx = context()
    ctx.plan.accounts = [
      { id: 't1', name: 'IRA A', type: 'traditional', kind: 'ira', ownerPersonId: 'p1', balance: 100_000 },
      { id: 't2', name: 'IRA B', type: 'traditional', kind: 'ira', ownerPersonId: 'p2', balance: 125_000 },
      { id: 't3', name: 'IRA C', type: 'traditional', kind: 'ira', ownerPersonId: 'p3', balance: 150_000 },
    ] as never
    ctx.plan.incomes = []
    const year = ctx.projection.result.years[0] as {
      people: { personId: string; ageAttained: number; alive: boolean }[]
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.people = [
      { personId: 'p1', ageAttained: 60, alive: true },
      { personId: 'p2', ageAttained: 60, alive: true },
      { personId: 'p3', ageAttained: 60, alive: true },
    ]
    year.ownedTraditionalIraAggregateActivity = ['p1', 'p2', 'p3'].map((ownerPersonId) => ({
      ownerPersonId,
      distributions: 1,
      conversions: 0,
      assumedBasisConsequential: {
        distributions: 1,
        conversions: 0,
        annuityPayments: 0,
      },
    }))

    const card = missingDataBasis.screen(ctx)
    expect(card).not.toBeNull()
    expect(card!.evidence).toHaveLength(5)
    const last = card!.evidence[4]!
    // Fifth row is owner p3's taxable-character gap; value stays the exact figure.
    expect(last.value).toBe('$1')
    expect(last.value).not.toMatch(/\+.*more/)
    expect(last.label).toMatch(/\.\.\.\(1 more not shown\)$/)
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
      { label: 'Pat continuing open-ended wages (no retirement age; assumed for life)', value: '$100,000', year: 2026 },
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
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
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

  it('flags a Roth account under 60 when the published verdict is true', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 1,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 1 },
      },
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
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$1', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('stays silent for an under-60 Roth owner without a published verdict', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      { ownerPersonId: 'p1', withdrawals: 5_000, creditedContributions: 0 },
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

  it('flags each under-60 Roth owner from their published pool verdict', () => {
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
                {
                  ownerPersonId: 'p1',
                  withdrawals: 5_000,
                  creditedContributions: 0,
                  assumedBasisConsequential: { withdrawal: 5_000 },
                },
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
      { label: 'Pat Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      { label: 'Pat Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('stays silent when no under-60 pool has a published verdict', () => {
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
            ownedRothIraPoolActivity: [
              { ownerPersonId: 'p1', withdrawals: 0, creditedContributions: 0 },
              {
                ownerPersonId: 'p2',
                withdrawals: 5_000,
                creditedContributions: 0,
                assumedBasisConsequential: { withdrawal: 5_000 },
              },
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

  it('flags owned Roth from published verdict even when an inherited Roth also exists', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
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
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('attributes employer and owned Roth from their separate published verdict channels', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      employerRothAccountActivity?: {
        accountId: string
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
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
      { label: 'Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      { label: 'Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('stays silent when the owner-pool has no published verdict (supplied pool basis covered the draw)', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
      }[]
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

  it('flags a missing Roth IRA basis when the published pool verdict is true', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'missing-basis', name: 'Missing-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 125_000 },
      { id: 'supplied-basis', name: 'Supplied-basis Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: 'p1', balance: 10_000, contributionBasis: 4_999 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Missing-basis Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      { label: 'Missing-basis Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('stays silent when Form 8606 activity has no published verdict (saturated / non-binding)', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
      }[]
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

  it('flags when the published Form 8606 verdict is true for a missing-basis IRA', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      {
        ownerPersonId: 'p1',
        distributions: 5_000,
        conversions: 0,
        assumedBasisConsequential: {
          distributions: 5_000,
          conversions: 0,
          annuityPayments: 0,
        },
      },
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
      { label: 'Missing-basis IRA taxable character from assumed-zero basis (distributions)', value: '$5,000', year: 2026 },
      { label: 'Missing-basis IRA opening balance (assumed zero after-tax basis)', value: '$50,000', year: 2026 },
    ])
  })

  it('emits the owned-Roth owner-pool aggregate once when two Roth IRAs omit basis', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      {
        id: 'roth-a',
        name: 'Roth A',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 100_000,
        contributionBasis: undefined,
      },
      {
        id: 'roth-b',
        name: 'Roth B',
        type: 'roth',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        contributionBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      {
        label:
          'Roth A, Roth B owner-pool basis-sensitive spill past known contributions and free conversion cover',
        value: '$5,000',
        year: 2026,
      },
      {
        label: 'Roth A, Roth B opening balance (assumed contribution basis)',
        value: '$150,000',
        year: 2026,
      },
    ])
  })

  it('emits the traditional owner-pool aggregate once when two owned IRAs omit basis', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      {
        ownerPersonId: 'p1',
        distributions: 5_000,
        conversions: 0,
        assumedBasisConsequential: {
          distributions: 5_000,
          conversions: 0,
          annuityPayments: 0,
        },
      },
    ]
    ctx.plan.accounts = [
      {
        id: 'trad-a',
        name: 'IRA A',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 100_000,
        nondeductibleBasis: undefined,
      },
      {
        id: 'trad-b',
        name: 'IRA B',
        type: 'traditional',
        kind: 'ira',
        ownerPersonId: 'p1',
        balance: 50_000,
        nondeductibleBasis: undefined,
      },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'IRA A, IRA B taxable character from assumed-zero basis (distributions)', value: '$5,000', year: 2026 },
      { label: 'IRA A, IRA B opening balance (assumed zero after-tax basis)', value: '$150,000', year: 2026 },
    ])
  })

  it('flags a traditional IRA with published annuity-payment verdict', () => {
    const ctx = context()
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: {
        ownerPersonId: string
        distributions: number
        conversions: number
        assumedBasisConsequential?: {
          distributions: number
          conversions: number
          annuityPayments: number
        }
      }[]
      qualifiedAnnuityPayments?: { annuityAccountId: string; payment: number; fundingOwnerPersonId: string }[]
    }
    year.ownedTraditionalIraAggregateActivity = [
      {
        ownerPersonId: 'p1',
        distributions: 0,
        conversions: 0,
        assumedBasisConsequential: {
          distributions: 0,
          conversions: 0,
          annuityPayments: 1_200,
        },
      },
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
      { label: 'Traditional IRA taxable character from assumed-zero basis (IRA-funded annuity payments)', value: '$1,200', year: 2026 },
      { label: 'Traditional IRA opening balance (assumed zero after-tax basis)', value: '$300,000', year: 2026 },
    ])
  })

  it('resolves a null Roth owner to the primary person via published activity', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      ownedRothIraPoolActivity?: {
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
    }
    year.ownedRothIraPoolActivity = [
      {
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
    ]
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'primary-roth', name: 'Primary Roth IRA', type: 'roth', kind: 'ira', ownerPersonId: null, balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Primary Roth IRA owner-pool basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      { label: 'Primary Roth IRA opening balance (assumed contribution basis)', value: '$125,000', year: 2026 },
    ])
  })

  it('flags a sole employer Roth with published verdict before age 60', () => {
    const ctx = context()
    ctx.projection.result.years[0]!.people[0]!.ageAttained = 59
    const year = ctx.projection.result.years[0] as {
      employerRothAccountActivity?: {
        accountId: string
        ownerPersonId: string
        withdrawals: number
        creditedContributions: number
        assumedBasisConsequential?: { withdrawal: number }
      }[]
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
    }
    year.employerRothAccountActivity = [
      {
        accountId: 'roth-401k',
        ownerPersonId: 'p1',
        withdrawals: 5_000,
        creditedContributions: 0,
        assumedBasisConsequential: { withdrawal: 5_000 },
      },
    ]
    year.ownedRothIraPoolActivity = []
    year.ownedTraditionalIraAggregateActivity = []
    ctx.plan.accounts = [
      { id: 'roth-401k', name: 'Roth 401(k)', type: 'roth', kind: 'employer', ownerPersonId: 'p1', balance: 125_000 },
    ] as never
    ctx.plan.incomes = []

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      { label: 'Roth 401(k) basis-sensitive spill past known contributions and free conversion cover', value: '$5,000', year: 2026 },
      {
        label:
          "Roth 401(k) opening balance (modeled as contribution basis under the engine's simplified ordering)",
        value: '$125,000',
        year: 2026,
      },
    ])
  })

  it('stays silent for a sole employer Roth without a published verdict', () => {
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

  it('suppresses a primary-residence gap when zero-basis gain is fully under §121', () => {
    // Max gain = sale-year value at zero basis. With no recapture/selling costs
    // and expectedNetProceeds unset, a fully-excluded gain cannot change tax
    // when basis is supplied — conservative suppress (propertySaleTax).
    const ctx = context()
    ctx.plan.assumptions.inflationPct = 0
    ctx.plan.accounts = [{
      id: 'home',
      name: 'Primary home',
      type: 'property',
      value: 200_000, // < $250k single §121
      plannedSaleYear: 2029,
      costBasis: undefined,
      primaryResidence: true,
    }] as never
    ctx.plan.incomes = []
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
      employerRothAccountActivity?: unknown[]
    }
    year.ownedTraditionalIraAggregateActivity = []
    year.ownedRothIraPoolActivity = []
    year.employerRothAccountActivity = []
    ctx.params = {
      year: 2026,
      federalTax: {
        section121Exclusion: { single: 250_000, marriedFilingJointly: 500_000 },
      },
    } as never

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('still flags a primary-residence gap when zero-basis gain can exceed §121', () => {
    // Opposite bound: sale-year value above the filing-status exclusion means
    // supplied basis can change capital-gain tax — do not suppress.
    const ctx = context()
    ctx.plan.assumptions.inflationPct = 0
    ctx.plan.accounts = [{
      id: 'home',
      name: 'Primary home',
      type: 'property',
      value: 400_000, // > $250k single §121
      plannedSaleYear: 2029,
      costBasis: undefined,
      primaryResidence: true,
    }] as never
    ctx.plan.incomes = []
    const year = ctx.projection.result.years[0] as {
      ownedTraditionalIraAggregateActivity?: unknown[]
      ownedRothIraPoolActivity?: unknown[]
      employerRothAccountActivity?: unknown[]
    }
    year.ownedTraditionalIraAggregateActivity = []
    year.ownedRothIraPoolActivity = []
    year.employerRothAccountActivity = []
    ctx.params = {
      year: 2026,
      federalTax: {
        section121Exclusion: { single: 250_000, marriedFilingJointly: 500_000 },
      },
    } as never

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      {
        label: 'Primary home opening property value (legacy net-proceeds path)',
        value: '$400,000',
        year: 2026,
      },
    ])
  })

  it('suppresses a between-bounds primary-residence gap under sale-year joint §121', () => {
    // $400k is above single ($250k) but at-or-under joint ($500k). When the
    // sale year still files jointly, zero-basis gain is fully excluded.
    const plan = couplePlan()
    plan.assumptions.inflationPct = 0
    plan.accounts = [{
      id: 'home',
      name: 'Primary home',
      type: 'property',
      value: 400_000,
      plannedSaleYear: 2029,
      costBasis: undefined,
      primaryResidence: true,
    }] as never
    plan.incomes = []
    const ctx = {
      plan,
      params: {
        year: 2026,
        federalTax: {
          section121Exclusion: { single: 250_000, marriedFilingJointly: 500_000 },
        },
      },
      projection: {
        startYear: 2026,
        result: {
          years: [
            {
              year: 2026,
              people: [
                { personId: 'p1', ageAttained: 60, alive: true },
                { personId: 'p2', ageAttained: 60, alive: true },
              ],
              filingStatus: 'marriedFilingJointly',
              ownedTraditionalIraAggregateActivity: [],
              ownedRothIraPoolActivity: [],
              employerRothAccountActivity: [],
            },
            {
              year: 2029,
              people: [
                { personId: 'p1', ageAttained: 63, alive: true },
                { personId: 'p2', ageAttained: 63, alive: true },
              ],
              filingStatus: 'marriedFilingJointly',
            },
          ],
        },
      },
    } as unknown as DetectorContext

    expect(missingDataBasis.screen(ctx)).toBeNull()
  })

  it('flags a between-bounds primary-residence gap when the sale year is single after a death', () => {
    // Same $400k home: plan opened joint ($500k exclusion would suppress), but
    // a pre-sale death makes the sale year single ($250k). Zero-basis gain then
    // exceeds §121, so omitted basis is consequential — must fire.
    const plan = couplePlan()
    plan.assumptions.inflationPct = 0
    plan.accounts = [{
      id: 'home',
      name: 'Primary home',
      type: 'property',
      value: 400_000,
      plannedSaleYear: 2029,
      costBasis: undefined,
      primaryResidence: true,
    }] as never
    plan.incomes = []
    const ctx = {
      plan,
      params: {
        year: 2026,
        federalTax: {
          section121Exclusion: { single: 250_000, marriedFilingJointly: 500_000 },
        },
      },
      projection: {
        startYear: 2026,
        result: {
          years: [
            {
              year: 2026,
              people: [
                { personId: 'p1', ageAttained: 60, alive: true },
                { personId: 'p2', ageAttained: 60, alive: true },
              ],
              filingStatus: 'marriedFilingJointly',
              ownedTraditionalIraAggregateActivity: [],
              ownedRothIraPoolActivity: [],
              employerRothAccountActivity: [],
            },
            {
              year: 2029,
              people: [
                { personId: 'p1', ageAttained: 63, alive: true },
                { personId: 'p2', ageAttained: 63, alive: false },
              ],
              filingStatus: 'single',
            },
          ],
        },
      },
    } as unknown as DetectorContext

    expect(missingDataBasis.screen(ctx)?.evidence).toEqual([
      {
        label: 'Primary home opening property value (legacy net-proceeds path)',
        value: '$400,000',
        year: 2026,
      },
    ])
  })
})
