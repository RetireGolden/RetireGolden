import { describe, expect, it } from 'vitest'

import type {
  PlanOwnedNonRothIraApplicableYearEndBalance,
} from '../actions/ownedNonRothIraAnnualPostCandidateEvidence.js'
import type { Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  buildSimulatorOwnedNonRothIraAnnualObservation,
  type BuildSimulatorOwnedNonRothIraAnnualObservationInput,
  type SimulatorOwnedNonRothIraYearEndApplicableBalanceObservation,
} from './ownedNonRothIraAnnualObservation.js'

type ProjectionBalanceAssignableToFilingGrade =
  SimulatorOwnedNonRothIraYearEndApplicableBalanceObservation extends
    PlanOwnedNonRothIraApplicableYearEndBalance
    ? true
    : false

const projectionBalanceAssignableToFilingGrade:
  ProjectionBalanceAssignableToFilingGrade = false

function plan(): Plan {
  const value = couplePlan({
    p1Dob: '1950-01-01',
    p2Dob: '1952-01-01',
    p1PlanningAge: 100,
    p2PlanningAge: 100,
  })
  const inherited = traditionalAccount('inherited-ira', 500, 'p1')
  if (inherited.type !== 'traditional') throw new Error('fixture drift')
  inherited.inherited = {
    ownerDeathYear: 2028,
    decedentHadStartedRmds: true,
  }
  value.id = 'annual-observation-plan'
  value.accounts = [
    traditionalAccount('ira-requested', 100, 'p1'),
    traditionalAccount('ira-zero-sibling', 200, 'p1'),
    traditionalAccount('ira-other-owner', 300, 'p2'),
    traditionalAccount('employer-plan', 400, 'p1', 'employer'),
    inherited,
  ]
  return value
}

function input(
  taxYear = 2030,
): BuildSimulatorOwnedNonRothIraAnnualObservationInput {
  return {
    plan: plan(),
    ownerPersonId: 'p1',
    taxYear,
    ledgerRunId: `ledger-${taxYear}`,
    observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth',
    startOfTaxYearIraBasis: 123.455,
    yearEndBalances: [
      { sourceAccountId: 'ira-requested', balance: 90.005 },
      { sourceAccountId: 'ira-zero-sibling', balance: 0 },
    ],
  }
}

function built(
  value = input(),
): Extract<
  ReturnType<typeof buildSimulatorOwnedNonRothIraAnnualObservation>,
  { status: 'annualObservationBuilt' }
> {
  const result = buildSimulatorOwnedNonRothIraAnnualObservation(value)
  if (result.status !== 'annualObservationBuilt') {
    throw new Error(`fixture failed: ${JSON.stringify(result.issues)}`)
  }
  return result
}

function containsProperty(value: unknown, property: string): boolean {
  if (value === null || typeof value !== 'object') return false
  if (Object.prototype.hasOwnProperty.call(value, property)) return true
  return Object.values(value as Record<string, unknown>).some((child) =>
    containsProperty(child, property))
}

describe('simulator owned non-Roth IRA annual observation', () => {
  it('keeps projection balances structurally distinct from filing-grade balances', () => {
    expect(projectionBalanceAssignableToFilingGrade).toBe(false)
  })

  it('builds complete immutable owner-wide December 31 evidence at the sealed boundary', () => {
    const result = built()
    expect(result).toMatchObject({
      status: 'annualObservationBuilt',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      issues: [],
      observation: {
        predicate: 'completeSimulatorOwnedNonRothIraAnnualObservation',
        planId: 'annual-observation-plan',
        ownerPersonId: 'p1',
        taxYear: 2030,
        ledgerRunId: 'ledger-2030',
        observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth',
        asOfDate: '2030-12-31',
        aggregateYearEndApplicableBalanceAmount: 9_001,
        startOfTaxYearBasisObservation: {
          predicate:
            'simulatorOwnedNonRothIraStartOfTaxYearBasisObservation',
          evidenceScope:
            'projectionModelOnlyNotRealWorldFilingCompleteness',
          basisStatus: 'callerSuppliedStartOfTaxYearBasisObserved',
          startOfTaxYearIraBasisAmount: 12_346,
          rolloverFactsStatus: 'notRepresentedByProjection',
        },
        evidenceScope: {
          scope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
          postYearContributionBoundary:
            'projectionModelHasNoPostDecember31PriorYearContributionDesignation',
          rolloverBoundary:
            'projectionModelDoesNotRepresentOutstandingRolloverOrRepaymentAdjustment',
        },
        projectionPostYearContributionWindow: {
          predicate:
            'simulatorOwnedNonRothIraProjectionPostYearContributionWindow',
          evidenceScope:
            'projectionModelOnlyNotRealWorldFilingCompleteness',
          inventoryStatus: 'explicitlyEmptyWithinProjectionModelOnly',
          realWorldFilingCompleteness: 'notEstablished',
          contributions: [],
          deadlineObservation: {
            predicate: 'simulatorOwnedNonRothIraOrdinaryDeadlineObservation',
            evidenceScope:
              'projectionModelOnlyNotAuthoritativeFilingEvidence',
            deadlineStatus: 'modeledOrdinaryFederalDeadlineCalculated',
            deadlineDate: '2031-04-15',
          },
        },
      },
    })
    expect(
      result.observation.yearEndApplicableBalances.map((entry) => ({
        sourceAccountId: entry.sourceAccountId,
        amount: entry.yearEndApplicableBalanceAmount,
        predicate: entry.predicate,
        evidenceScope: entry.evidenceScope,
        phase: entry.ledgerPhase,
        asOfDate: entry.asOfDate,
      })),
    ).toEqual([
      {
        sourceAccountId: 'ira-requested',
        amount: 9_001,
        predicate:
          'simulatorOwnedNonRothIraYearEndApplicableBalanceObservation',
        evidenceScope:
          'projectionModelOnlyNotRealWorldFilingCompleteness',
        phase:
          'projectionModelDecember31AfterAllAnnualTransactionsAndGrowth',
        asOfDate: '2030-12-31',
      },
      {
        sourceAccountId: 'ira-zero-sibling',
        amount: 0,
        predicate:
          'simulatorOwnedNonRothIraYearEndApplicableBalanceObservation',
        evidenceScope:
          'projectionModelOnlyNotRealWorldFilingCompleteness',
        phase:
          'projectionModelDecember31AfterAllAnnualTransactionsAndGrowth',
        asOfDate: '2030-12-31',
      },
    ])
    expect(containsProperty(result.observation, 'executionDate')).toBe(false)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.observation)).toBe(true)
    expect(Object.isFrozen(result.observation.yearEndApplicableBalances)).toBe(true)
    expect(Object.isFrozen(result.observation.yearEndApplicableBalances[0])).toBe(true)
    expect(
      Object.isFrozen(
        result.observation.projectionPostYearContributionWindow,
      ),
    ).toBe(true)
    expect(Object.isFrozen(result.observation.evidenceScope)).toBe(true)
  })

  it('is invariant to supplied balance and Plan account order and derives stable IDs', () => {
    const forward = input()
    const reversed = structuredClone(forward)
    ;(reversed.plan as Plan).accounts.reverse()
    ;(reversed.yearEndBalances as Array<unknown>).reverse()

    expect(built(reversed)).toEqual(built(forward))
  })

  it('detaches every result value from later caller mutation', () => {
    const value = input()
    const result = built(value)
    ;(value.yearEndBalances[0] as { balance: number }).balance = 1
    ;(value.plan as Plan).accounts[0]!.name = 'mutated'

    expect(
      result.observation.yearEndApplicableBalances.find(
        (entry) => entry.sourceAccountId === 'ira-requested',
      )?.yearEndApplicableBalanceAmount,
    ).toBe(9_001)
  })

  it('reads each caller-controlled binding once before validation and evidence derivation', () => {
    const source = input()
    const reads = new Map<string, number>()
    const once = <T>(key: string, first: T, later: T): (() => T) => () => {
      const count = (reads.get(key) ?? 0) + 1
      reads.set(key, count)
      return count === 1 ? first : later
    }
    const stateful = {} as BuildSimulatorOwnedNonRothIraAnnualObservationInput
    Object.defineProperties(stateful, {
      plan: { enumerable: true, get: once('plan', source.plan, null) },
      ownerPersonId: { enumerable: true, get: once('owner', 'p1', 'p2') },
      taxYear: { enumerable: true, get: once('year', 2030, 2031) },
      ledgerRunId: {
        enumerable: true,
        get: once('ledger', 'stateful-ledger', 'different-ledger'),
      },
      observationBoundary: {
        enumerable: true,
        get: once(
          'boundary',
          'sealedAfterAllAnnualTransactionsAndGrowth',
          'before-growth',
        ),
      },
      startOfTaxYearIraBasis: {
        enumerable: true,
        get: once('basis', 123.455, 0),
      },
      yearEndBalances: {
        enumerable: true,
        get: once('balances', source.yearEndBalances, []),
      },
    })
    const result = built(stateful)
    expect(result.observation).toMatchObject({
      ownerPersonId: 'p1',
      taxYear: 2030,
      ledgerRunId: 'stateful-ledger',
      asOfDate: '2030-12-31',
      startOfTaxYearBasisObservation: {
        startOfTaxYearIraBasisAmount: 12_346,
      },
    })
    expect([...reads.values()]).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it.each([
    [2006, '2007-04-17'],
    [2021, '2022-04-18'],
    [2022, '2023-04-18'],
    [2023, '2024-04-15'],
    [2026, '2027-04-15'],
    [2027, '2028-04-18'],
  ] as const)(
    'computes the ordinary %s filing deadline as %s',
    (taxYear, expected) => {
      expect(
        built(input(taxYear)).observation.projectionPostYearContributionWindow
          .deadlineObservation.deadlineDate,
      ).toBe(expected)
    },
  )

  it('fails closed for tax year 9999 instead of constructing year 10000 evidence', () => {
    const result = buildSimulatorOwnedNonRothIraAnnualObservation(input(9999))
    expect(result).toMatchObject({
      status: 'annualObservationBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      observation: null,
      issues: [{ kind: 'filingDeadlineUnsupported' }],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.issues)).toBe(true)
  })

  it('fails closed before the supported modern federal filing-calendar regime', () => {
    expect(buildSimulatorOwnedNonRothIraAnnualObservation(input(2005)))
      .toMatchObject({
        status: 'annualObservationBlocked',
        observation: null,
        issues: [{ kind: 'filingDeadlineUnsupported' }],
      })
  })

  it.each([
    ['missing sibling', [{ sourceAccountId: 'ira-requested', balance: 90 }], 'yearEndBalanceMissing'],
    [
      'duplicate source',
      [
        { sourceAccountId: 'ira-requested', balance: 90 },
        { sourceAccountId: 'ira-requested', balance: 80 },
        { sourceAccountId: 'ira-zero-sibling', balance: 0 },
      ],
      'yearEndBalanceDuplicate',
    ],
    [
      'other owner',
      [
        { sourceAccountId: 'ira-requested', balance: 90 },
        { sourceAccountId: 'ira-zero-sibling', balance: 0 },
        { sourceAccountId: 'ira-other-owner', balance: 70 },
      ],
      'yearEndBalanceForeign',
    ],
    [
      'employer plan',
      [
        { sourceAccountId: 'ira-requested', balance: 90 },
        { sourceAccountId: 'ira-zero-sibling', balance: 0 },
        { sourceAccountId: 'employer-plan', balance: 70 },
      ],
      'yearEndBalanceForeign',
    ],
    [
      'inherited IRA',
      [
        { sourceAccountId: 'ira-requested', balance: 90 },
        { sourceAccountId: 'ira-zero-sibling', balance: 0 },
        { sourceAccountId: 'inherited-ira', balance: 70 },
      ],
      'yearEndBalanceForeign',
    ],
  ] as const)('rejects %s coverage', (_label, balances, issueKind) => {
    const value = input()
    value.yearEndBalances = balances
    const result = buildSimulatorOwnedNonRothIraAnnualObservation(value)
    expect(result.status).toBe('annualObservationBlocked')
    expect(result.issues.map((issue) => issue.kind)).toContain(issueKind)
  })

  it('fails closed when individually valid exact-cent balances overflow in aggregate', () => {
    const value = input()
    value.yearEndBalances = [
      { sourceAccountId: 'ira-requested', balance: 50_000_000_000_000 },
      { sourceAccountId: 'ira-zero-sibling', balance: 50_000_000_000_000 },
    ]
    expect(buildSimulatorOwnedNonRothIraAnnualObservation(value)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{ kind: 'yearEndBalanceAggregateOverflow' }],
    })
  })

  it.each([
    ['negative basis', { startOfTaxYearIraBasis: -1 }, 'startOfTaxYearBasisInvalid'],
    ['infinite basis', { startOfTaxYearIraBasis: Number.POSITIVE_INFINITY }, 'startOfTaxYearBasisInvalid'],
    [
      'negative balance',
      {
        yearEndBalances: [
          { sourceAccountId: 'ira-requested', balance: -1 },
          { sourceAccountId: 'ira-zero-sibling', balance: 0 },
        ],
      },
      'yearEndBalanceInvalid',
    ],
    ['invalid year', { taxYear: 0 }, 'taxYearInvalid'],
    ['blank ledger', { ledgerRunId: '  ' }, 'ledgerRunInvalid'],
    ['foreign owner', { ownerPersonId: 'not-in-plan' }, 'ownerNotFound'],
    [
      'unsealed boundary',
      { observationBoundary: 'before-growth' },
      'observationBoundaryInvalid',
    ],
  ] as const)('fails closed for %s', (_label, patch, issueKind) => {
    const value = Object.assign(input(), patch) as BuildSimulatorOwnedNonRothIraAnnualObservationInput
    const result = buildSimulatorOwnedNonRothIraAnnualObservation(value)
    expect(result.status).toBe('annualObservationBlocked')
    expect(result.issues.map((issue) => issue.kind)).toContain(issueKind)
  })

  it('rejects an empty owned-IRA pool and invalid Plans', () => {
    const noPool = input()
    ;(noPool.plan as Plan).accounts = []
    expect(buildSimulatorOwnedNonRothIraAnnualObservation(noPool)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{ kind: 'ownedIraPoolEmpty' }],
    })
    expect(buildSimulatorOwnedNonRothIraAnnualObservation({
      ...input(),
      plan: { id: 'not-a-plan' },
    })).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{ kind: 'planInvalid' }],
    })
  })

  it('turns malformed runtime input into a frozen fail-closed result', () => {
    const result = buildSimulatorOwnedNonRothIraAnnualObservation({
      ...input(),
      yearEndBalances: null,
    } as unknown as BuildSimulatorOwnedNonRothIraAnnualObservationInput)
    expect(result).toMatchObject({
      status: 'annualObservationBlocked',
      observation: null,
      issues: [{ kind: 'observationConstructionInvalid' }],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.issues[0])).toBe(true)
  })

  it('does not let an uninspectable hostile thrown value escape fail-closed handling', () => {
    const hostile = new Proxy({}, {
      getPrototypeOf: () => {
        throw new Error('prototype trap')
      },
      get: () => {
        throw new Error('property trap')
      },
    })
    const value = {} as BuildSimulatorOwnedNonRothIraAnnualObservationInput
    Object.defineProperty(value, 'plan', {
      get: () => {
        throw hostile
      },
    })

    expect(() => buildSimulatorOwnedNonRothIraAnnualObservation(value))
      .not.toThrow()
    expect(buildSimulatorOwnedNonRothIraAnnualObservation(value)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{
        kind: 'observationConstructionInvalid',
        detail:
          'Annual observation construction failed closed: uninspectable error',
      }],
    })
  })

  it('rejects a ledger-run ID that collides with Plan identity', () => {
    const value = input()
    value.ledgerRunId = (value.plan as Plan).id
    expect(buildSimulatorOwnedNonRothIraAnnualObservation(value)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{
        kind: 'identifierCollision',
        identifier: 'annual-observation-plan',
      }],
    })
  })

  it('rejects cross-role Plan identity collisions before emitting evidence', () => {
    const value = input()
    ;(value.plan as Plan).id = 'ira-requested'

    expect(buildSimulatorOwnedNonRothIraAnnualObservation(value)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{
        kind: 'identifierCollision',
        identifier: 'ira-requested',
      }],
    })
  })

  it('rejects ambiguous unrequested sibling account identities', () => {
    const value = input()
    ;(value.plan as Plan).accounts.push(
      traditionalAccount('ira-zero-sibling', 300, 'p1'),
    )
    value.yearEndBalances = [
      { sourceAccountId: 'ira-requested', balance: 90 },
      { sourceAccountId: 'ira-zero-sibling', balance: 0 },
    ]

    expect(buildSimulatorOwnedNonRothIraAnnualObservation(value)).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{
        kind: 'identifierCollision',
        identifier: 'ira-zero-sibling',
      }],
    })
  })

  it('rejects an ambiguous selected owner identity', () => {
    const valuePlan = singlePersonPlan()
    valuePlan.id = 'ambiguous-owner-plan'
    valuePlan.household.filingStatus = 'marriedFilingJointly'
    valuePlan.household.people.push({
      ...structuredClone(valuePlan.household.people[0]!),
      name: 'Duplicate Pat',
    })
    valuePlan.accounts = [traditionalAccount('only-ira', 0, 'p1')]

    expect(buildSimulatorOwnedNonRothIraAnnualObservation({
      ...input(),
      plan: valuePlan,
      ledgerRunId: 'ambiguous-owner-ledger',
      yearEndBalances: [{ sourceAccountId: 'only-ira', balance: 0 }],
    })).toMatchObject({
      status: 'annualObservationBlocked',
      issues: [{
        kind: 'identifierCollision',
        identifier: 'p1',
      }],
    })
  })

  it('supports a single-person Plan and retains zero balances', () => {
    const valuePlan = singlePersonPlan()
    valuePlan.id = 'single-plan'
    valuePlan.accounts = [traditionalAccount('only-ira', 0, 'p1')]
    const result = built({
      ...input(),
      plan: valuePlan,
      ledgerRunId: 'single-ledger',
      yearEndBalances: [{ sourceAccountId: 'only-ira', balance: 0 }],
    })
    expect(result.observation.yearEndApplicableBalances).toHaveLength(1)
    expect(result.observation.aggregateYearEndApplicableBalanceAmount).toBe(0)
  })
})
