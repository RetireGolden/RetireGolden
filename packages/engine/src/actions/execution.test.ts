import { describe, expect, expectTypeOf, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { couplePlan } from '../testing/planFixtures.js'
import type {
  NonpersistedActionPersonAliveEvidence,
  RetirementActionEligibilityRuntimeEvidence,
} from '../strategies/accountEligibility.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  type PersonId,
} from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  type PositiveUsdCents,
} from './money.js'
import type {
  OrdinaryWithdrawalRequest,
  RetirementActionRequest,
  SourceAllocationRequest,
  WithdrawalPurpose,
} from './contract.js'
import {
  executeCashOrdinaryWithdrawals,
  type AcceptedCashSourceEligibilityEvidence,
  type AccountOpeningBalanceSnapshot,
  type CashActionableExecutionDisposition,
  type CashPrincipalTaxCharacter,
  type CashSourcePenaltyCoverageEvidence,
  type ResolvedCashSourceAllocationExecutionEvidence,
} from './execution.js'

function cash(id: string, ownerPersonId: string | null = 'p1'): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: null,
    balance: 9_999_999.99,
    annualContribution: 0,
  }
}

function taxable(id: string, ownerPersonId = 'p1'): Account {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: null,
    balance: 1,
    costBasis: 1,
    annualContribution: 0,
  }
}

function planWith(...accounts: Account[]): Plan {
  const plan = couplePlan({ p1PlanningAge: 100, p2PlanningAge: 100 })
  plan.accounts = accounts
  return plan
}

function allocation(
  allocationId: string,
  sourceAccountId: string,
  requestedAmount: number,
): SourceAllocationRequest {
  return {
    allocationId: asAllocationId(allocationId),
    sourceAccountId: asAccountId(sourceAccountId),
    requestedAmount: asPositiveUsdCents(requestedAmount),
  }
}

function withdrawal({
  actionId,
  sequence,
  allocations,
  personId = 'p1',
  executionDate,
  year = 2030,
}: {
  actionId: string
  sequence: number
  allocations: SourceAllocationRequest[]
  personId?: string
  executionDate?: string
  year?: number
}): OrdinaryWithdrawalRequest {
  const requestedAmount = allocations.reduce(
    (total, item) => total + item.requestedAmount,
    0,
  )
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId(personId),
    year,
    ...(executionDate === undefined ? {} : { executionDate }),
    executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(requestedAmount),
    allocations,
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
}

function aliveEvidence(
  requests: readonly RetirementActionRequest[],
  alive = true,
): RetirementActionEligibilityRuntimeEvidence {
  return {
    personAliveEvidence: requests.flatMap(
      (request): NonpersistedActionPersonAliveEvidence[] => {
        if (
          request.kind === 'legacyAggregateWithdrawal' ||
          request.kind === 'legacyAggregateRothConversion' ||
          request.kind === 'legacyAggregateQcd'
        ) {
          return []
        }
        const personId =
          request.kind === 'qcd' ? request.donorPersonId : request.personId
        return [{
          evidenceId: `alive:${request.actionId}`,
          actionId: request.actionId,
          personId,
          actionYear: request.year,
          actionDate: request.executionDate ?? null,
          alive,
        }]
      },
    ),
  }
}

function balances(
  entries: readonly [string, number][],
): AccountOpeningBalanceSnapshot[] {
  return entries.map(([accountId, openingBalance]) => ({
    accountId: asAccountId(accountId),
    openingBalance: asUsdCents(openingBalance),
  }))
}

function run(
  plan: Plan,
  requests: readonly RetirementActionRequest[],
  openingBalances: readonly AccountOpeningBalanceSnapshot[],
  runtimeEvidence = aliveEvidence(requests),
) {
  return executeCashOrdinaryWithdrawals({
    year: 2030,
    plan,
    requests,
    openingBalances,
    runtimeEvidence,
  })
}

describe('cash ordinary-withdrawal execution', () => {
  it('narrows the public actionable evidence contract to cash guarantees', () => {
    const request = withdrawal({
      actionId: 'typed',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    const evidence = run(
      planWith(cash('cash')),
      [request],
      balances([['cash', 1]]),
    ).evidence[0]!
    if (evidence.readiness !== 'actionable') throw new Error('expected actionable evidence')

    expectTypeOf(evidence.kind).toEqualTypeOf<'ordinaryWithdrawal'>()
    expectTypeOf(evidence.request).toEqualTypeOf<Readonly<OrdinaryWithdrawalRequest>>()
    expectTypeOf(evidence.personId).toEqualTypeOf<PersonId>()
    expectTypeOf(evidence.purpose).toEqualTypeOf<Readonly<WithdrawalPurpose>>()
    expectTypeOf(evidence.disposition).toEqualTypeOf<CashActionableExecutionDisposition>()
    expectTypeOf(evidence.disposition.executedAmount).toEqualTypeOf<PositiveUsdCents>()
    expectTypeOf(evidence.allocations).toEqualTypeOf<
      readonly [
        ResolvedCashSourceAllocationExecutionEvidence,
        ...ResolvedCashSourceAllocationExecutionEvidence[],
      ]
    >()
    expectTypeOf(evidence.acceptedSourceEligibility).toEqualTypeOf<
      readonly [
        AcceptedCashSourceEligibilityEvidence,
        ...AcceptedCashSourceEligibilityEvidence[],
      ]
    >()
    expectTypeOf(evidence.taxCharacter).toEqualTypeOf<
      readonly [CashPrincipalTaxCharacter, ...CashPrincipalTaxCharacter[]]
    >()
    expectTypeOf(evidence.penaltyCoverage).toEqualTypeOf<
      readonly [
        CashSourcePenaltyCoverageEvidence,
        ...CashSourcePenaltyCoverageEvidence[],
      ]
    >()
    if (evidence.disposition.outcome === 'executed') {
      expectTypeOf(evidence.disposition.reasons).toEqualTypeOf<readonly []>()
    } else {
      expectTypeOf(evidence.disposition.reasons[0]!.code).toEqualTypeOf<
        'source-balance-trimmed'
      >()
    }
  })

  it('is invariant to account, action, snapshot, and allocation array order', () => {
    const first = withdrawal({
      actionId: 'later-lexically',
      sequence: 1,
      executionDate: '2030-02-01',
      allocations: [
        allocation('β-allocation', 'cash-b', 40),
        allocation('a-allocation', 'cash-a', 60),
      ],
    })
    const second = withdrawal({
      actionId: 'earlier-lexically',
      sequence: 2,
      executionDate: '2030-02-01',
      allocations: [allocation('second', 'cash-a', 50)],
    })
    const forward = run(
      planWith(cash('cash-a'), cash('cash-b')),
      [first, second],
      balances([['cash-a', 100], ['cash-b', 100]]),
    )
    const permutedFirst = {
      ...first,
      allocations: [...first.allocations].reverse(),
    }
    const reversed = run(
      planWith(cash('cash-b'), cash('cash-a')),
      [second, permutedFirst],
      balances([['cash-b', 100], ['cash-a', 100]]),
    )
    expect(reversed).toEqual(forward)
    expect(forward.evidence[0]!.allocations.map((item) => item.allocationId)).toEqual([
      'a-allocation',
      'β-allocation',
    ])
  })

  it('uses sequence rather than lexical or non-ASCII action IDs for chronology', () => {
    const sequenceOne = withdrawal({
      actionId: '終',
      sequence: 1,
      executionDate: '2030-04-01',
      allocations: [allocation('one', 'cash', 80)],
    })
    const sequenceTwo = withdrawal({
      actionId: 'A',
      sequence: 2,
      executionDate: '2030-04-01',
      allocations: [allocation('two', 'cash', 80)],
    })
    const result = run(
      planWith(cash('cash')),
      [sequenceTwo, sequenceOne],
      balances([['cash', 100]]),
    )
    expect(result.evidence.map((item) => item.actionId)).toEqual(['終', 'A'])
    expect(result.evidence.map((item) => item.disposition.executedAmount)).toEqual([
      80,
      20,
    ])
    expect(result.evidence[1]!.disposition).toMatchObject({
      outcome: 'partial',
      reasons: [{ code: 'source-balance-trimmed' }],
    })
  })

  it.each([
    ['same-day', '2030-05-01'] as const,
    ['undated year-end', undefined] as const,
  ])('refuses duplicate %s sequence slots without movement', (_label, executionDate) => {
    const requests = ['one', 'two'].map((actionId) =>
      withdrawal({
        actionId,
        sequence: 1,
        executionDate,
        allocations: [allocation(`allocation-${actionId}`, 'cash', 50)],
      }),
    )
    const result = run(
      planWith(cash('cash')),
      requests,
      balances([['cash', 100]]),
    )
    expect(result.committed).toBe(false)
    expect(result.evidence).toEqual([])
    expect(result.balances[0]!.closingBalance).toBe(100)
    expect(result.scheduleIssues).toEqual([
      expect.objectContaining({
        kind: 'executionSequenceConflict',
        year: 2030,
        scheduledDate: executionDate ?? null,
        executionSequence: 1,
        collidingActionIds: ['one', 'two'],
        reason: expect.objectContaining({ code: 'action-sequence-conflict' }),
      }),
    ])
  })

  it('aborts the annual transaction when one schedule slot conflicts', () => {
    const requests = [
      withdrawal({
        actionId: 'independent',
        sequence: 1,
        executionDate: '2030-01-01',
        allocations: [allocation('independent-allocation', 'cash', 25)],
      }),
      withdrawal({
        actionId: 'collision-one',
        sequence: 1,
        executionDate: '2030-02-01',
        allocations: [allocation('collision-one-allocation', 'cash', 25)],
      }),
      withdrawal({
        actionId: 'collision-two',
        sequence: 1,
        executionDate: '2030-02-01',
        allocations: [allocation('collision-two-allocation', 'cash', 25)],
      }),
    ]
    const result = run(
      planWith(cash('cash')),
      requests,
      balances([['cash', 100]]),
    )
    expect(result).toMatchObject({
      committed: false,
      evidence: [],
      balances: [{ openingBalance: 100, closingBalance: 100 }],
    })
  })

  it('aborts before movement for duplicate action identity or another action year', () => {
    const duplicate = withdrawal({
      actionId: 'duplicate',
      sequence: 1,
      allocations: [allocation('allocation-one', 'cash', 10)],
    })
    const duplicateAgain = withdrawal({
      actionId: 'duplicate',
      sequence: 2,
      allocations: [allocation('allocation-two', 'cash', 10)],
    })
    const duplicateResult = run(
      planWith(cash('cash')),
      [duplicate, duplicateAgain],
      balances([['cash', 100]]),
      { personAliveEvidence: [] },
    )
    expect(duplicateResult).toMatchObject({
      committed: false,
      evidence: [],
      balances: [{ closingBalance: 100 }],
      scheduleIssues: [{ kind: 'duplicateActionId', actionId: 'duplicate' }],
    })

    const otherYear = withdrawal({
      actionId: 'other-year',
      sequence: 1,
      year: 2031,
      allocations: [allocation('allocation', 'cash', 10)],
    })
    const yearResult = run(
      planWith(cash('cash')),
      [otherYear],
      balances([['cash', 100]]),
    )
    expect(yearResult).toMatchObject({
      committed: false,
      evidence: [],
      balances: [{ closingBalance: 100 }],
      scheduleIssues: [{
        kind: 'actionYearMismatch',
        actionId: 'other-year',
        expectedYear: 2030,
        actualYear: 2031,
      }],
    })
  })

  it('orders a dated December 31 action before the separate undated year-end group', () => {
    const undated = withdrawal({
      actionId: 'undated',
      sequence: 1,
      allocations: [allocation('undated-allocation', 'cash', 80)],
    })
    const dated = withdrawal({
      actionId: 'dated',
      sequence: 1,
      executionDate: '2030-12-31',
      allocations: [allocation('dated-allocation', 'cash', 80)],
    })
    const result = run(
      planWith(cash('cash')),
      [undated, dated],
      balances([['cash', 100]]),
    )
    expect(result.committed).toBe(true)
    expect(result.evidence.map((item) => item.actionId)).toEqual(['dated', 'undated'])
    expect(result.evidence.map((item) => item.disposition.executedAmount)).toEqual([
      80,
      20,
    ])
  })

  it('commits prior independent actions when a later action becomes partial', () => {
    const requests = [
      withdrawal({
        actionId: 'first',
        sequence: 1,
        allocations: [allocation('first-allocation', 'cash', 80)],
      }),
      withdrawal({
        actionId: 'second',
        sequence: 2,
        allocations: [allocation('second-allocation', 'cash', 80)],
      }),
    ]
    const result = run(
      planWith(cash('cash')),
      requests,
      balances([['cash', 100]]),
    )
    expect(result.evidence.map((item) => item.disposition.executedAmount)).toEqual([
      80,
      20,
    ])
    expect(result.balances[0]!.closingBalance).toBe(0)
  })

  it('keeps an earlier commit when a later independent action is refused', () => {
    const requests = [
      withdrawal({
        actionId: 'first',
        sequence: 1,
        allocations: [allocation('first-allocation', 'cash-p1', 25)],
      }),
      withdrawal({
        actionId: 'second',
        sequence: 2,
        allocations: [allocation('second-allocation', 'cash-p2', 25)],
      }),
    ]
    const result = run(
      planWith(cash('cash-p1'), cash('cash-p2', 'p2')),
      requests,
      balances([['cash-p1', 25], ['cash-p2', 25]]),
    )
    expect(result.evidence.map((item) => item.disposition.outcome)).toEqual([
      'executed',
      'refused',
    ])
    expect(result.balances).toMatchObject([
      { accountId: 'cash-p1', closingBalance: 0 },
      { accountId: 'cash-p2', closingBalance: 25 },
    ])
  })

  it('partially executes a multi-allocation action with one zero source', () => {
    const request = withdrawal({
      actionId: 'multi',
      sequence: 1,
      allocations: [
        allocation('zero', 'cash-zero', 50),
        allocation('positive', 'cash-positive', 75),
      ],
    })
    const result = run(
      planWith(cash('cash-zero'), cash('cash-positive')),
      [request],
      balances([['cash-zero', 0], ['cash-positive', 75]]),
    )
    const evidence = result.evidence[0]!
    expect(evidence.disposition).toMatchObject({
      outcome: 'partial',
      executedAmount: 75,
      unexecutedAmount: 50,
      reasons: [{ code: 'source-balance-trimmed' }],
    })
    expect(evidence.taxCharacter).toHaveLength(1)
    expect(evidence.penalty).toEqual([])
    expect(evidence.readiness === 'actionable' && evidence.penaltyCoverage).toHaveLength(2)
    expect(
      evidence.readiness === 'actionable'
        ? evidence.penaltyCoverage.find((item) => item.allocationId === 'zero')
        : null,
    ).toMatchObject({
      executedAmount: 0,
      nonPenaltyRelevantCharacterAmount: 0,
      segments: [],
    })
  })

  it('refuses all-zero sources with empty movement evidence', () => {
    const request = withdrawal({
      actionId: 'empty',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    const result = run(
      planWith(cash('cash')),
      [request],
      balances([['cash', 0]]),
    )
    expect(result.evidence[0]).toMatchObject({
      readiness: 'nonActionable',
      executedDate: null,
      taxCharacter: [],
      penalty: [],
      disposition: {
        outcome: 'refused',
        executedAmount: 0,
        reasons: [{ code: 'source-balance-unavailable' }],
      },
    })
    expect(result.evidence[0]).not.toHaveProperty('penaltyCoverage')
  })

  it.each([
    ['cross-owner', planWith(cash('cash', 'p2')), 'p1', balances([['cash', 100]])],
    ['deceased', planWith(cash('cash')), 'p1', balances([['cash', 100]])],
    ['missing alive evidence', planWith(cash('cash')), 'p1', balances([['cash', 100]])],
    ['missing source', planWith(), 'p1', balances([['cash', 100]])],
    [
      'duplicate plan account identity',
      planWith(cash('cash'), cash('cash')),
      'p1',
      balances([['cash', 100]]),
    ],
    ['joint cash', planWith(cash('cash', null)), 'p1', balances([['cash', 100]])],
    ['missing snapshot', planWith(cash('cash')), 'p1', balances([])],
    [
      'duplicate snapshot',
      planWith(cash('cash')),
      'p1',
      balances([['cash', 100], ['cash', 100]]),
    ],
  ] as const)('moves zero for %s', (label, plan, personId, openingBalances) => {
    const request = withdrawal({
      actionId: label,
      sequence: 1,
      personId,
      allocations: [allocation('allocation', 'cash', 100)],
    })
    const runtime =
      label === 'deceased'
        ? aliveEvidence([request], false)
        : label === 'missing alive evidence'
          ? {}
          : aliveEvidence([request])
    const result = run(plan, [request], openingBalances, runtime)
    expect(result.evidence[0]!.disposition.executedAmount).toBe(0)
    expect(result.evidence[0]!.readiness).toBe('nonActionable')
    expect(result.balances[0]?.closingBalance ?? 0).toBe(
      result.balances[0]?.openingBalance ?? 0,
    )
  })

  it('atomically refuses mixed cash and noncash sources', () => {
    const request = withdrawal({
      actionId: 'mixed',
      sequence: 1,
      allocations: [
        allocation('cash-allocation', 'cash', 50),
        allocation('taxable-allocation', 'taxable', 50),
      ],
    })
    const result = run(
      planWith(cash('cash'), taxable('taxable')),
      [request],
      balances([['cash', 100], ['taxable', 100]]),
    )
    expect(result.evidence[0]!.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
    })
    expect(result.balances.map((item) => item.closingBalance)).toEqual([100, 100])
  })

  it.each([
    taxable('taxable'),
    {
      type: 'equityComp',
      id: 'equityComp',
      name: 'equityComp',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 1,
      costBasis: 1,
      annualContribution: 0,
      vestingMode: 'final',
      vestDate: null,
    },
    {
      type: 'traditional',
      id: 'traditional',
      name: 'traditional',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 1,
      annualContribution: 0,
    },
    {
      type: 'roth',
      id: 'roth',
      name: 'roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 1,
      annualContribution: 0,
    },
    {
      type: 'hsa',
      id: 'hsa',
      name: 'hsa',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 1,
      annualContribution: 0,
    },
  ] satisfies Account[])('moves zero from unsupported $type sources', (account) => {
    const request = withdrawal({
      actionId: account.type,
      sequence: 1,
      allocations: [allocation('allocation', account.id, 1)],
    })
    const result = run(
      planWith(account),
      [request],
      balances([[account.id, 1]]),
    )
    expect(result.evidence[0]!.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
    })
    expect(result.balances[0]!.closingBalance).toBe(1)
  })

  it('validates allocation invariants before staging', () => {
    const request = withdrawal({
      actionId: 'mismatch',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    request.requestedAmount = asPositiveUsdCents(2)
    const openingBalances = balances([['cash', 1]])
    expect(() => run(planWith(cash('cash')), [request], openingBalances)).toThrow()
    expect(openingBalances[0]!.openingBalance).toBe(1)
  })

  it('rejects unsafe cents before any staged movement', () => {
    const request = withdrawal({
      actionId: 'unsafe',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    const openingBalances = [{
      accountId: asAccountId('cash'),
      openingBalance: Number.MAX_SAFE_INTEGER + 1,
    }] as unknown as AccountOpeningBalanceSnapshot[]
    expect(() => run(planWith(cash('cash')), [request], openingBalances)).toThrow()
    expect(openingBalances[0]!.openingBalance).toBe(Number.MAX_SAFE_INTEGER + 1)
  })

  it('executes the safe maximum without overflow or floating conversion', () => {
    const request = withdrawal({
      actionId: 'safe-maximum',
      sequence: 1,
      allocations: [
        allocation('allocation', 'cash', Number.MAX_SAFE_INTEGER),
      ],
    })
    const result = run(
      planWith(cash('cash')),
      [request],
      balances([['cash', Number.MAX_SAFE_INTEGER]]),
    )
    expect(result.evidence[0]!.disposition).toMatchObject({
      outcome: 'executed',
      executedAmount: Number.MAX_SAFE_INTEGER,
      unexecutedAmount: 0,
    })
    expect(result.balances[0]!.closingBalance).toBe(0)
  })

  it.each(['2030-02-30', '2031-01-01'])(
    'refuses malformed or outside-year execution date %s',
    (executionDate) => {
      const request = withdrawal({
        actionId: executionDate,
        sequence: 1,
        executionDate,
        allocations: [allocation('allocation', 'cash', 10)],
      })
      const result = run(
        planWith(cash('cash')),
        [request],
        balances([['cash', 10]]),
      )
      expect(result.evidence[0]).toMatchObject({
        scheduledDate: executionDate,
        executedDate: null,
        disposition: { outcome: 'unsupported', executedAmount: 0 },
      })
      expect(result.balances[0]!.closingBalance).toBe(10)
    },
  )

  it('returns immutable snapshots detached from later input mutation', () => {
    const request = withdrawal({
      actionId: 'immutable',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 10)],
    })
    const openingBalances = balances([['cash', 10]])
    const result = run(planWith(cash('cash')), [request], openingBalances)
    request.provenance.sourceId = 'mutated'
    request.allocations[0]!.sourceAccountId = asAccountId('mutated')
    openingBalances[0]!.openingBalance = asUsdCents(999)

    expect(result.evidence[0]!.request).toMatchObject({
      actionId: 'immutable',
      provenance: { source: 'manual' },
      allocations: [{ sourceAccountId: 'cash' }],
    })
    expect(result.balances[0]).toEqual({
      accountId: 'cash',
      openingBalance: 10,
      closingBalance: 0,
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence[0]!.request)).toBe(true)
  })

  it('conserves every one-cent action and allocation exactly', () => {
    const request = withdrawal({
      actionId: 'one-cent',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    const result = run(
      planWith(cash('cash')),
      [request],
      balances([['cash', 1]]),
    )
    const evidence = result.evidence[0]!
    const source = evidence.allocations[0]!
    expect(
      evidence.disposition.executedAmount + evidence.disposition.unexecutedAmount,
    ).toBe(evidence.requestedAmount)
    expect(source.executedAmount + source.unexecutedAmount).toBe(source.requestedAmount)
    expect(source.balanceBefore! - source.executedAmount).toBe(source.balanceAfter)
    expect(evidence.taxCharacter).toEqual([
      {
        actionId: 'one-cent',
        allocationId: 'allocation',
        sourceAccountId: 'cash',
        sourceClass: 'cash',
        kind: 'cashPrincipal',
        amount: 1,
        characterEvidence: {
          rule: 'intrinsicCashPrincipal',
          allocationId: 'allocation',
          segmentAmount: 1,
        },
      },
    ])
    expect(
      evidence.readiness === 'actionable' ? evidence.acceptedSourceEligibility : [],
    ).toEqual([
      {
        predicate: 'isSpendableInYear',
        allocationId: 'allocation',
        sourceAccountId: 'cash',
        evaluationDate: '2030-12-31',
        sourceClass: 'cash',
        availabilityEvidence: { kind: 'intrinsicallySpendable' },
      },
    ])
    expect(evidence.readiness === 'actionable' ? evidence.penaltyCoverage : []).toEqual([
      {
        coverageEvidenceId: 'cash-penalty-coverage:["one-cent","allocation"]',
        actionId: 'one-cent',
        allocationId: 'allocation',
        sourceAccountId: 'cash',
        applicability: 'notApplicable',
        sourceClass: 'cash',
        reason: 'nonRetirementSource',
        executedAmount: 1,
        penaltyRelevantCharacterAmount: 0,
        nonPenaltyRelevantCharacterAmount: 1,
        coveredPenaltyExposureAmount: 0,
        coverageDifferenceAmount: 0,
        segments: [],
      },
    ])
  })

  it('cannot execute a Plan-linked conversion funding withdrawal from a subset call', () => {
    const request = withdrawal({
      actionId: 'tax-funding',
      sequence: 1,
      allocations: [allocation('funding-allocation', 'cash', 1_000)],
    })
    request.purpose = { kind: 'taxPayment', referenceId: 'conversion' }
    const conversion = {
      actionId: asActionId('conversion'),
      kind: 'rothConversion',
      personId: asPersonId('p1'),
      year: 2030,
      executionDate: '2030-12-31',
      executionSequence: 2,
      requestedAmount: asPositiveUsdCents(5_000),
      allocations: [allocation('conversion-allocation', 'traditional', 5_000)],
      destinationRothAccountId: asAccountId('roth'),
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: request.actionId,
      },
      provenance: { source: 'manual' },
    } satisfies RetirementActionRequest
    const plan = planWith(
      cash('cash'),
      {
        type: 'traditional',
        id: 'traditional',
        name: 'Traditional',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    )
    plan.strategies.retirementActions = [request, conversion]

    const result = run(plan, [request], balances([['cash', 1_000]]))

    expect(result.evidence[0]).toMatchObject({
      actionId: 'tax-funding',
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'conversion-tax-funding-evidence-unsupported' }],
      },
    })
    expect(result.balances[0]!.closingBalance).toBe(1_000)
  })

  it('moves zero for unsupported conversion, QCD, and legacy request kinds', () => {
    const ordinary = withdrawal({
      actionId: 'base',
      sequence: 1,
      executionDate: '2030-01-01',
      allocations: [allocation('allocation', 'cash', 10)],
    })
    const unsupported = [
      {
        actionId: asActionId('conversion'),
        kind: 'rothConversion',
        personId: ordinary.personId,
        year: ordinary.year,
        executionDate: ordinary.executionDate,
        executionSequence: ordinary.executionSequence,
        requestedAmount: ordinary.requestedAmount,
        allocations: ordinary.allocations,
        destinationRothAccountId: asAccountId('roth'),
        taxFunding: { kind: 'noneExpected' },
        provenance: ordinary.provenance,
      },
      {
        actionId: asActionId('qcd'),
        kind: 'qcd',
        donorPersonId: asPersonId('p1'),
        year: 2030,
        executionDate: '2030-01-02',
        executionSequence: 2,
        requestedAmount: asPositiveUsdCents(10),
        allocation: allocation('qcd-allocation', 'cash', 10),
        charity: {
          designationId: 'charity',
          name: 'Charity',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
        provenance: { source: 'manual' },
      },
      {
        actionId: asActionId('legacy'),
        kind: 'legacyAggregateWithdrawal',
        year: 2030,
        requestedAmount: asPositiveUsdCents(10),
        legacyCategory: 'cash',
        provenance: { source: 'migration' },
      },
    ] satisfies RetirementActionRequest[]
    const result = run(
      planWith(cash('cash')),
      unsupported,
      balances([['cash', 10]]),
      aliveEvidence(unsupported),
    )
    expect(result.evidence.every((item) => item.readiness === 'nonActionable')).toBe(true)
    expect(result.evidence.every((item) => item.disposition.executedAmount === 0)).toBe(true)
    expect(result.balances[0]!.closingBalance).toBe(10)
  })
})
