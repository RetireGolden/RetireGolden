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
  executeOrdinaryWithdrawals,
  type AcceptedCashSourceEligibilityEvidence,
  type AcceptedOrdinaryWithdrawalSourceEligibilityEvidence,
  type AccountOpeningBalanceSnapshot,
  type CashActionableExecutionDisposition,
  type CashPrincipalTaxCharacter,
  type CashSourcePenaltyCoverageEvidence,
  type ExecuteCashOrdinaryWithdrawalsResult,
  type NonRetirementSourcePenaltyCoverageEvidence,
  type OrdinaryWithdrawalActionableExecutionDisposition,
  type OrdinaryWithdrawalTaxCharacter,
  type ResolvedCashSourceAllocationExecutionEvidence,
  type ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence,
  type TaxableAccountOpeningSnapshot,
} from './execution.js'
import { describeRule } from '../rules/describeRule.js'

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

function taxable(id: string, ownerPersonId: string | null = 'p1'): Account {
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

function equityComp(
  id: string,
  {
    ownerPersonId = 'p1',
    vestingMode = 'final',
    vestDate = null,
  }: {
    ownerPersonId?: string | null
    vestingMode?: 'final' | 'cliff'
    vestDate?: string | null
  } = {},
): Account {
  return {
    type: 'equityComp',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: null,
    balance: 1,
    costBasis: 0,
    annualContribution: 0,
    vestingMode,
    vestDate,
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

function taxableSnapshot(
  accountId: string,
  openingCostBasis: number,
  {
    ownerPersonId = 'p1',
    taxYear = 2030,
    taxUnitMemberPersonIds = ['p1', 'p2'],
  }: {
    ownerPersonId?: string
    taxYear?: number
    taxUnitMemberPersonIds?: string[]
  } = {},
): TaxableAccountOpeningSnapshot {
  return {
    accountId: asAccountId(accountId),
    openingCostBasis: asUsdCents(openingCostBasis),
    ownership: {
      accountOwnerPersonIds: [asPersonId(ownerPersonId)],
      accountOwnershipEvidenceId: `ownership:${accountId}:${ownerPersonId}`,
      beneficialOwnershipShare: {
        representation: 'exactRational',
        numerator: 1,
        denominator: 1,
        intermediateArithmetic: 'bigintRational',
      },
      attributionEvidenceId: `attribution:${accountId}:${ownerPersonId}`,
    },
    taxUnit: {
      taxUnitId: `tax-unit:${taxYear}`,
      taxUnitMemberPersonIds: taxUnitMemberPersonIds.map(asPersonId) as [
        PersonId,
        ...PersonId[],
      ],
      federalFilingStatus: 'marriedFilingJointly',
      stateFilingStatusId: `state-status:${taxYear}`,
      taxUnitEvidenceId: `tax-unit-evidence:${taxYear}`,
      taxYear,
    },
  }
}

function run(
  plan: Plan,
  requests: readonly RetirementActionRequest[],
  openingBalances: readonly AccountOpeningBalanceSnapshot[],
  runtimeEvidence = aliveEvidence(requests),
  taxableAccountSnapshots: readonly TaxableAccountOpeningSnapshot[] = [],
) {
  return executeOrdinaryWithdrawals({
    year: 2030,
    plan,
    requests,
    openingBalances,
    taxableAccountSnapshots,
    runtimeEvidence,
  })
}

describe('ordinary-withdrawal execution', () => {
  it('retains the original narrow cash-only compile-time contract', () => {
    const request = withdrawal({
      actionId: 'cash-compatibility-contract',
      sequence: 1,
      allocations: [allocation('allocation', 'cash', 1)],
    })
    const result = executeCashOrdinaryWithdrawals({
      year: 2030,
      plan: planWith(cash('cash')),
      requests: [request],
      openingBalances: balances([['cash', 1]]),
      runtimeEvidence: aliveEvidence([request]),
    })
    const evidence = result.evidence[0]!

    expectTypeOf(result).toEqualTypeOf<ExecuteCashOrdinaryWithdrawalsResult>()
    if (evidence.readiness !== 'actionable') {
      throw new Error('expected actionable cash compatibility evidence')
    }
    expectTypeOf(evidence.disposition).toEqualTypeOf<CashActionableExecutionDisposition>()
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
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('keeps the compatibility executor cash-only at runtime', () => {
    const cashRequest = withdrawal({
      actionId: 'cash-supported',
      sequence: 1,
      allocations: [allocation('cash-allocation', 'cash', 25)],
    })
    const equityRequest = withdrawal({
      actionId: 'equity-unsupported',
      sequence: 2,
      allocations: [allocation('equity-allocation', 'equity', 25)],
    })
    const result = executeCashOrdinaryWithdrawals({
      year: 2030,
      plan: planWith(cash('cash'), equityComp('equity')),
      requests: [cashRequest, equityRequest],
      openingBalances: balances([['cash', 50], ['equity', 50]]),
      runtimeEvidence: aliveEvidence([cashRequest, equityRequest]),
    })

    expect(result.evidence[0]).toMatchObject({
      actionId: 'cash-supported',
      disposition: { outcome: 'executed', executedAmount: 25 },
    })
    expect(result.evidence[1]).toMatchObject({
      actionId: 'equity-unsupported',
      readiness: 'nonActionable',
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'withdrawal-source-type-unsupported' }],
      },
    })
    expect(result.balances).toMatchObject([
      { accountId: 'cash', openingBalance: 50, closingBalance: 25 },
      { accountId: 'equity', openingBalance: 50, closingBalance: 50 },
    ])
  })

  it('keeps mixed cash and noncash compatibility requests atomic', () => {
    const request = withdrawal({
      actionId: 'mixed-unsupported',
      sequence: 1,
      allocations: [
        allocation('cash-allocation', 'cash', 25),
        allocation('equity-allocation', 'equity', 25),
      ],
    })
    const result = executeCashOrdinaryWithdrawals({
      year: 2030,
      plan: planWith(cash('cash'), equityComp('equity')),
      requests: [request],
      openingBalances: balances([['cash', 50], ['equity', 50]]),
      runtimeEvidence: aliveEvidence([request]),
    })

    expect(result.evidence[0]).toMatchObject({
      readiness: 'nonActionable',
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'withdrawal-source-type-unsupported' }],
      },
    })
    expect(result.balances).toMatchObject([
      { accountId: 'cash', openingBalance: 50, closingBalance: 50 },
      { accountId: 'equity', openingBalance: 50, closingBalance: 50 },
    ])
  })

  it('narrows the public actionable evidence contract to supported-source guarantees', () => {
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
    expectTypeOf(evidence.disposition).toEqualTypeOf<OrdinaryWithdrawalActionableExecutionDisposition>()
    expectTypeOf(evidence.disposition.executedAmount).toEqualTypeOf<PositiveUsdCents>()
    expectTypeOf(evidence.allocations).toEqualTypeOf<
      readonly [
        ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence,
        ...ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence[],
      ]
    >()
    expectTypeOf(evidence.acceptedSourceEligibility).toEqualTypeOf<
      readonly [
        AcceptedOrdinaryWithdrawalSourceEligibilityEvidence,
        ...AcceptedOrdinaryWithdrawalSourceEligibilityEvidence[],
      ]
    >()
    expectTypeOf(evidence.taxCharacter).toEqualTypeOf<
      readonly [OrdinaryWithdrawalTaxCharacter, ...OrdinaryWithdrawalTaxCharacter[]]
    >()
    expectTypeOf(evidence.penaltyCoverage).toEqualTypeOf<
      readonly [
        NonRetirementSourcePenaltyCoverageEvidence,
        ...NonRetirementSourcePenaltyCoverageEvidence[],
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

  it('executes final equity compensation with explicit already-vested evidence', () => {
    const request = withdrawal({
      actionId: 'final-equity',
      sequence: 1,
      allocations: [allocation('equity-allocation', 'equity', 75)],
    })

    const result = run(
      planWith(equityComp('equity')),
      [request],
      balances([['equity', 100]]),
    )
    const evidence = result.evidence[0]!

    expect(evidence).toMatchObject({
      readiness: 'actionable',
      disposition: { outcome: 'executed', executedAmount: 75 },
      acceptedSourceEligibility: [{
        sourceClass: 'equityCompensation',
        availabilityEvidence: {
          kind: 'alreadyVested',
          vestingMode: 'final',
          vestedOnEvaluationDate: true,
        },
        characterEvidence: {
          rule: 'fullyTaxableCompensationAtExecution',
          executedAmount: 75,
          ordinaryIncomeAmount: 75,
        },
      }],
      taxCharacter: [{
        sourceClass: 'equityCompensation',
        kind: 'ordinaryIncome',
        amount: 75,
        characterEvidence: {
          rule: 'fullyTaxableCompensationAtExecution',
          segmentAmount: 75,
        },
      }],
      penalty: [],
      penaltyCoverage: [{
        sourceClass: 'equityCompensation',
        applicability: 'notApplicable',
        reason: 'nonRetirementSource',
        executedAmount: 75,
        nonPenaltyRelevantCharacterAmount: 75,
        coveredPenaltyExposureAmount: 0,
      }],
    })
    const accepted =
      evidence.readiness === 'actionable'
        ? evidence.acceptedSourceEligibility[0]
        : undefined
    expect(
      accepted?.sourceClass === 'equityCompensation'
        ? accepted.availabilityEvidence
        : undefined,
    ).not.toHaveProperty('vestingDate')
    expect(result.balances[0]?.closingBalance).toBe(25)
  })

  it('uses the exact cliff vesting boundary and never invents a vest date', () => {
    const account = equityComp('equity', {
      vestingMode: 'cliff',
      vestDate: '2030-06-15',
    })
    const before = withdrawal({
      actionId: 'before-vest',
      sequence: 1,
      executionDate: '2030-06-14',
      allocations: [allocation('before-allocation', 'equity', 50)],
    })
    const onDate = withdrawal({
      actionId: 'on-vest',
      sequence: 1,
      executionDate: '2030-06-15',
      allocations: [allocation('on-allocation', 'equity', 50)],
    })
    const undated = withdrawal({
      actionId: 'undated-cliff',
      sequence: 1,
      allocations: [allocation('undated-allocation', 'equity', 50)],
    })

    const refused = run(
      planWith(account),
      [before],
      balances([['equity', 100]]),
    )
    expect(refused.evidence[0]).toMatchObject({
      disposition: {
        outcome: 'refused',
        executedAmount: 0,
        reasons: [{ code: 'withdrawal-source-not-spendable' }],
      },
    })
    const accepted = run(
      planWith(account),
      [onDate],
      balances([['equity', 100]]),
    ).evidence[0]
    expect(accepted).toMatchObject({
      disposition: { outcome: 'executed', executedAmount: 50 },
      acceptedSourceEligibility: [{
        availabilityEvidence: {
          kind: 'vested',
          vestingMode: 'cliff',
          vestingDate: '2030-06-15',
          vestedOnEvaluationDate: true,
        },
      }],
    })
    const missingDate = run(
      planWith(account),
      [undated],
      balances([['equity', 100]]),
    )
    expect(missingDate.evidence[0]).toMatchObject({
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'required-facts-missing' }],
      },
    })
  })

  it('executes a mixed cash and equity action atomically with zero-allocation evidence', () => {
    const request = withdrawal({
      actionId: 'mixed-supported',
      sequence: 1,
      allocations: [
        allocation('zero-equity', 'equity', 50),
        allocation('funded-cash', 'cash', 50),
      ],
    })
    const result = run(
      planWith(equityComp('equity'), cash('cash')),
      [request],
      balances([['equity', 0], ['cash', 50]]),
    )
    const evidence = result.evidence[0]!

    expect(evidence.disposition).toMatchObject({
      outcome: 'partial',
      executedAmount: 50,
      unexecutedAmount: 50,
      reasons: [{ code: 'source-balance-trimmed' }],
    })
    expect(evidence.taxCharacter).toEqual([
      expect.objectContaining({
        allocationId: 'funded-cash',
        sourceClass: 'cash',
        amount: 50,
      }),
    ])
    expect(
      evidence.readiness === 'actionable'
        ? evidence.acceptedSourceEligibility.find(
            (item) => item.allocationId === 'zero-equity',
          )
        : undefined,
    ).toMatchObject({
      sourceClass: 'equityCompensation',
      characterEvidence: { executedAmount: 0, ordinaryIncomeAmount: 0 },
    })
    expect(
      evidence.readiness === 'actionable' ? evidence.penaltyCoverage : [],
    ).toHaveLength(2)
    expect(result.balances).toMatchObject([
      { accountId: 'cash', closingBalance: 0 },
      { accountId: 'equity', closingBalance: 0 },
    ])
  })

  it('characterizes only the executed portion of a partial equity withdrawal', () => {
    const request = withdrawal({
      actionId: 'partial-equity',
      sequence: 1,
      allocations: [allocation('equity-allocation', 'equity', 50)],
    })
    const evidence = run(
      planWith(equityComp('equity')),
      [request],
      balances([['equity', 25]]),
    ).evidence[0]!

    expect(evidence).toMatchObject({
      disposition: {
        outcome: 'partial',
        executedAmount: 25,
        unexecutedAmount: 25,
      },
      acceptedSourceEligibility: [{
        characterEvidence: {
          executedAmount: 25,
          ordinaryIncomeAmount: 25,
        },
      }],
      taxCharacter: [{ amount: 25, characterEvidence: { segmentAmount: 25 } }],
      penaltyCoverage: [{ executedAmount: 25 }],
    })
  })

  it('keeps mixed-source execution invariant to every input array order', () => {
    const request = withdrawal({
      actionId: 'mixed-order',
      sequence: 1,
      allocations: [
        allocation('equity-allocation', 'equity', 40),
        allocation('cash-allocation', 'cash', 60),
      ],
    })
    const forward = run(
      planWith(cash('cash'), equityComp('equity')),
      [request],
      balances([['cash', 60], ['equity', 40]]),
    )
    const reversedRequest = {
      ...request,
      allocations: [...request.allocations].reverse(),
    }
    const reversed = run(
      planWith(equityComp('equity'), cash('cash')),
      [reversedRequest],
      balances([['equity', 40], ['cash', 60]]),
    )

    expect(reversed).toEqual(forward)
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
    expect(result.requests.map((request) => request.actionId)).toEqual([
      'independent',
      'collision-one',
      'collision-two',
    ])
    expect(Object.isFrozen(result.requests)).toBe(true)
    expect(Object.isFrozen(result.requests[0])).toBe(true)
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
        coverageEvidenceId: 'cash-penalty-coverage:6b604ae40975807b6233' +
          '12d52bb5715a9b4f544fe16f2a2de826653437db68d6',
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

  describe('individually owned taxable sources', () => {
    it('atomically moves balance and basis and emits gain character', () => {
      const request = withdrawal({
        actionId: 'taxable-gain',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', 5_000)],
      })
      const result = run(
        planWith(taxable('taxable')),
        [request],
        balances([['taxable', 10_000]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', 4_000)],
      )

      expect(result.evidence[0]).toMatchObject({
        disposition: { outcome: 'executed', executedAmount: 5_000 },
        acceptedSourceEligibility: [{
          sourceClass: 'taxable',
          basisEvidence: {
            method: 'planningAggregateBasisRatio',
            basisRecoveredAmount: 2_000,
            realizedCapitalGainOrLossAmount: 3_000,
          },
        }],
        taxCharacter: [
          {
            actionId: 'taxable-gain',
            allocationId: 'taxable-allocation',
            kind: 'basisReturn',
            amount: 2_000,
          },
          {
            actionId: 'taxable-gain',
            allocationId: 'taxable-allocation',
            kind: 'capitalGain',
            amount: 3_000,
          },
        ],
        penaltyCoverage: [{
          sourceClass: 'taxable',
          applicability: 'notApplicable',
          reason: 'nonRetirementSource',
          executedAmount: 5_000,
          coveredPenaltyExposureAmount: 0,
        }],
      })
      expect(result.balances).toMatchObject([
        { accountId: 'taxable', openingBalance: 10_000, closingBalance: 5_000 },
      ])
      expect(result.taxableBases).toMatchObject([
        {
          accountId: 'taxable',
          openingCostBasis: 4_000,
          closingCostBasis: 2_000,
        },
      ])
    })

    it('supports basis above value and closes a full loss-position sale exactly', () => {
      const request = withdrawal({
        actionId: 'taxable-loss',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', 10_000)],
      })
      const result = run(
        planWith(taxable('taxable')),
        [request],
        balances([['taxable', 10_000]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', 15_000)],
      )

      expect(result.evidence[0]).toMatchObject({
        taxCharacter: [
          { kind: 'basisReturn', amount: 15_000 },
          { kind: 'capitalLoss', amount: 5_000 },
        ],
      })
      expect(result.balances[0]?.closingBalance).toBe(0)
      expect(result.taxableBases[0]?.closingCostBasis).toBe(0)
    })

    it('uses staged balance and basis for sequential actions on one source', () => {
      const requests = [
        withdrawal({
          actionId: 'taxable-first',
          sequence: 1,
          allocations: [allocation('first-allocation', 'taxable', 2_500)],
        }),
        withdrawal({
          actionId: 'taxable-second',
          sequence: 2,
          allocations: [allocation('second-allocation', 'taxable', 2_500)],
        }),
      ]
      const result = run(
        planWith(taxable('taxable')),
        requests,
        balances([['taxable', 10_000]]),
        aliveEvidence(requests),
        [taxableSnapshot('taxable', 4_000)],
      )

      expect(result.evidence.map((item) =>
        item.readiness === 'actionable'
          ? item.acceptedSourceEligibility[0]
          : null,
      )).toMatchObject([
        {
          basisEvidence: {
            preExecutionFairMarketValue: 10_000,
            remainingCostBasisBeforeExecution: 4_000,
            basisRecoveredAmount: 1_000,
          },
        },
        {
          basisEvidence: {
            preExecutionFairMarketValue: 7_500,
            remainingCostBasisBeforeExecution: 3_000,
            basisRecoveredAmount: 1_000,
          },
        },
      ])
      expect(result.balances[0]?.closingBalance).toBe(5_000)
      expect(result.taxableBases[0]?.closingCostBasis).toBe(2_000)
    })

    it('accepts a depleted taxable sibling only through the zero/no-ratio arm', () => {
      const requests = [
        withdrawal({
          actionId: 'deplete-taxable',
          sequence: 1,
          allocations: [allocation('deplete-allocation', 'taxable', 100)],
        }),
        withdrawal({
          actionId: 'mixed-after-depletion',
          sequence: 2,
          allocations: [
            allocation('cash-allocation', 'cash', 50),
            allocation('taxable-zero-allocation', 'taxable', 50),
          ],
        }),
      ]
      const result = run(
        planWith(cash('cash'), taxable('taxable')),
        requests,
        balances([['cash', 50], ['taxable', 100]]),
        aliveEvidence(requests),
        [taxableSnapshot('taxable', 40)],
      )
      const second = result.evidence[1]
      if (second?.readiness !== 'actionable') {
        throw new Error('expected mixed partial action')
      }

      expect(second.disposition).toMatchObject({
        outcome: 'partial',
        executedAmount: 50,
      })
      expect(second.acceptedSourceEligibility).toContainEqual(
        expect.objectContaining({
          allocationId: 'taxable-zero-allocation',
          sourceClass: 'taxable',
          basisEvidence: expect.objectContaining({
            method: 'notApplicableZeroExecution',
            preExecutionFairMarketValue: 0,
            remainingCostBasisBeforeExecution: 0,
            executedAmount: 0,
            ratio: {
              representation: 'notApplicableZeroDenominator',
              numeratorMinorUnits: 0,
              denominatorMinorUnits: 0,
              intermediateArithmetic: 'none',
            },
          }),
        }),
      )
      expect(
        second.taxCharacter.some(
          (character) => character.allocationId === 'taxable-zero-allocation',
        ),
      ).toBe(false)
      expect(result.balances).toMatchObject([
        { accountId: 'cash', closingBalance: 0 },
        { accountId: 'taxable', closingBalance: 0 },
      ])
      expect(result.taxableBases[0]?.closingCostBasis).toBe(0)
    })

    it('keeps an all-zero taxable action nonactionable', () => {
      const request = withdrawal({
        actionId: 'all-zero',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', 100)],
      })
      const result = run(
        planWith(taxable('taxable')),
        [request],
        balances([['taxable', 0]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', 0)],
      )

      expect(result.evidence[0]).toMatchObject({
        readiness: 'nonActionable',
        disposition: {
          outcome: 'refused',
          executedAmount: 0,
          reasons: [{ code: 'source-balance-unavailable' }],
        },
        taxCharacter: [],
      })
    })

    it.each([
      ['missing', []],
      [
        'duplicate',
        [taxableSnapshot('taxable', 4_000), taxableSnapshot('taxable', 4_000)],
      ],
      ['wrong owner', [taxableSnapshot('taxable', 4_000, { ownerPersonId: 'p2' })]],
      [
        'wrong tax unit',
        [
          taxableSnapshot('taxable', 4_000, {
            taxUnitMemberPersonIds: ['p2'],
          }),
        ],
      ],
      ['wrong year', [taxableSnapshot('taxable', 4_000, { taxYear: 2029 })]],
    ])('fails a mixed action atomically for %s taxable evidence', (_label, snapshots) => {
      const request = withdrawal({
        actionId: 'mixed-invalid-taxable',
        sequence: 1,
        allocations: [
          allocation('cash-allocation', 'cash', 100),
          allocation('taxable-allocation', 'taxable', 100),
        ],
      })
      const result = run(
        planWith(cash('cash'), taxable('taxable')),
        [request],
        balances([['cash', 100], ['taxable', 100]]),
        aliveEvidence([request]),
        snapshots,
      )

      expect(result.evidence[0]).toMatchObject({
        readiness: 'nonActionable',
        disposition: {
          outcome: 'unsupported',
          executedAmount: 0,
          reasons: [{ code: 'withdrawal-taxable-basis-unsupported' }],
        },
      })
      expect(result.balances.map((item) => item.closingBalance)).toEqual([
        100,
        100,
      ])
      expect(
        result.taxableBases.every(
          (item) => item.closingCostBasis === item.openingCostBasis,
        ),
      ).toBe(true)
    })

    it('fails stale positive basis at zero FMV closed', () => {
      const request = withdrawal({
        actionId: 'stale-basis',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', 100)],
      })
      const result = run(
        planWith(taxable('taxable')),
        [request],
        balances([['taxable', 0]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', 1)],
      )

      expect(result.evidence[0]).toMatchObject({
        disposition: {
          outcome: 'unsupported',
          reasons: [{ code: 'withdrawal-taxable-basis-unsupported' }],
        },
      })
      expect(result.taxableBases[0]?.closingCostBasis).toBe(1)
    })

    it.each([
      { label: 'half-cent tie', balance: 2, basis: 1, executed: 1 },
      { label: 'repeating ratio', balance: 3, basis: 1, executed: 2 },
      {
        label: 'large bigint intermediate',
        balance: Number.MAX_SAFE_INTEGER,
        basis: Number.MAX_SAFE_INTEGER - 2,
        executed: 4_503_599_627_370_496,
      },
    ])('inherits exact classifier arithmetic for $label', ({
      balance,
      basis,
      executed,
    }) => {
      const request = withdrawal({
        actionId: 'exact-arithmetic',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', executed)],
      })
      const result = run(
        planWith(taxable('taxable')),
        [request],
        balances([['taxable', balance]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', basis)],
      )
      const accepted = result.evidence[0]?.readiness === 'actionable'
        ? result.evidence[0].acceptedSourceEligibility[0]
        : null
      if (accepted?.sourceClass !== 'taxable') {
        throw new Error('expected accepted taxable character')
      }
      const recovered =
        (BigInt(executed) * BigInt(basis)) / BigInt(balance) +
        (((BigInt(executed) * BigInt(basis)) % BigInt(balance)) * 2n >=
        BigInt(balance)
          ? 1n
          : 0n)

      expect(accepted.basisEvidence).toMatchObject({
        method: 'planningAggregateBasisRatio',
        basisRecoveredAmount: Number(recovered),
        realizedCapitalGainOrLossAmount: Number(BigInt(executed) - recovered),
      })
      expect(result.taxableBases[0]?.closingCostBasis).toBe(
        Number(BigInt(basis) - recovered),
      )
    })

    it('keeps joint taxable sources unsupported and unmoved', () => {
      const request = withdrawal({
        actionId: 'joint-taxable',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'taxable', 100)],
      })
      const result = run(
        planWith(taxable('taxable', null)),
        [request],
        balances([['taxable', 100]]),
        aliveEvidence([request]),
        [taxableSnapshot('taxable', 40)],
      )

      expect(result.evidence[0]).toMatchObject({
        readiness: 'nonActionable',
        disposition: {
          executedAmount: 0,
          reasons: [{ code: 'joint-source-acting-person-mismatch' }],
        },
      })
      expect(result.balances[0]?.closingBalance).toBe(100)
      expect(result.taxableBases[0]?.closingCostBasis).toBe(40)
    })

    it('is invariant to plan, balance, and taxable-snapshot permutations', () => {
      const request = withdrawal({
        actionId: 'permutation',
        sequence: 1,
        allocations: [
          allocation('b-allocation', 'b-taxable', 300),
          allocation('a-allocation', 'a-taxable', 200),
        ],
      })
      const execute = (reverse: boolean) => run(
        planWith(
          ...(reverse
            ? [taxable('b-taxable'), taxable('a-taxable')]
            : [taxable('a-taxable'), taxable('b-taxable')]),
        ),
        [request],
        balances(
          reverse
            ? [['b-taxable', 1_000], ['a-taxable', 1_000]]
            : [['a-taxable', 1_000], ['b-taxable', 1_000]],
        ),
        aliveEvidence([request]),
        reverse
          ? [taxableSnapshot('b-taxable', 500), taxableSnapshot('a-taxable', 250)]
          : [taxableSnapshot('a-taxable', 250), taxableSnapshot('b-taxable', 500)],
      )
      const forward = execute(false)
      const reversed = execute(true)

      expect(reversed.evidence).toEqual(forward.evidence)
      expect(reversed.balances).toEqual(forward.balances)
      expect(reversed.taxableBases).toEqual(forward.taxableBases)
    })

    it('returns detached, deeply frozen, deterministically sorted basis evidence', () => {
      const request = withdrawal({
        actionId: 'immutable-taxable',
        sequence: 1,
        allocations: [allocation('taxable-allocation', 'b-taxable', 100)],
      })
      const snapshotB = taxableSnapshot('b-taxable', 40)
      const snapshotA = taxableSnapshot('a-taxable', 25)
      const result = run(
        planWith(taxable('a-taxable'), taxable('b-taxable')),
        [request],
        balances([['b-taxable', 100], ['a-taxable', 100]]),
        aliveEvidence([request]),
        [snapshotB, snapshotA],
      )
      ;(
        snapshotB.taxUnit.taxUnitMemberPersonIds as unknown as PersonId[]
      )[0] = asPersonId('changed')

      expect(result.taxableBases.map((item) => item.accountId)).toEqual([
        'a-taxable',
        'b-taxable',
      ])
      expect(result.taxableBases[1]?.taxUnit.taxUnitMemberPersonIds[0]).toBe('p1')
      expect(Object.isFrozen(result.taxableBases)).toBe(true)
      expect(Object.isFrozen(result.taxableBases[1]?.ownership)).toBe(true)
      expect(Object.isFrozen(result.taxableBases[1]?.taxUnit)).toBe(true)
    })
  })
})

// Observed produced pin (fixture run 2026-08-26): the executor classifies the
// whole $75 execution as ordinary income.
const producedSection83OrdinaryAtExecution = 75

describeRule('irc-83-a-equity-compensation-execution-character', {
  readings: {
    // Section 83(a) includes compensation at the earlier transferability/no-
    // forfeiture year. This final account has the executor's own alreadyVested
    // evidence before its 2030 execution, so its section 83 compensation at
    // execution is $0. The $75 sale may have other character, but it is not a
    // fresh section 83(a) compensation inclusion.
    statuteHasNoNewSection83CompensationAtExecution: 0,
    engineClassifiesTheWholeExecutionAsOrdinary:
      producedSection83OrdinaryAtExecution,
  },
  accepted: 'statuteHasNoNewSection83CompensationAtExecution',
  produced: 'engineClassifiesTheWholeExecutionAsOrdinary',
  note: 'already-vested equity execution',
}, ({ accepted, produced }) => {
  it('classifies an already-vested equity execution as ordinary income anyway', () => {
    const request = withdrawal({
      actionId: 'section-83-timing',
      sequence: 1,
      executionDate: '2030-06-15',
      allocations: [allocation('section-83-allocation', 'equity', 75)],
    })
    const result = run(
      planWith(equityComp('equity')),
      [request],
      balances([['equity', 100]]),
    )
    const evidence = result.evidence[0]!
    if (evidence.readiness !== 'actionable') throw new Error('expected actionable equity execution')
    const character = evidence.taxCharacter[0]
    if (character?.kind !== 'ordinaryIncome') throw new Error('expected ordinary-income character')

    expect(character.amount).toBe(produced)
    expect(character.amount).not.toBe(accepted)
  })
})

// Zero-basis cliff vesting $100 in the execution year; only $75 is executed.
// Section 83(a) includes the excess of FMV over amount paid when the property
// first becomes transferable / free of substantial risk of forfeiture — the
// full vested $100 — while the executor reports ordinary income only on the
// executed $75.
// Observed produced pin (fixture run 2026-08-26): executor reports ordinary
// income only on the executed $75 of a same-year $100 cliff vest.
const producedSection83PartialCliffOrdinary = 75

describeRule('irc-83-a-equity-compensation-execution-character', {
  readings: {
    statuteIncludesFullVestedValueAtCliff: 100,
    engineReportsOrdinaryOnlyOnExecutedAmount: producedSection83PartialCliffOrdinary,
  },
  accepted: 'statuteIncludesFullVestedValueAtCliff',
  produced: 'engineReportsOrdinaryOnlyOnExecutedAmount',
  note: 'partial-execution cliff vest',
}, ({ accepted, produced }) => {
  it('reports ordinary income only on the executed part of a same-year cliff vest', () => {
    const request = withdrawal({
      actionId: 'section-83-partial-cliff',
      sequence: 1,
      executionDate: '2030-06-15',
      allocations: [allocation('partial-cliff-allocation', 'equity', 75)],
    })
    const result = run(
      planWith(equityComp('equity', {
        vestingMode: 'cliff',
        vestDate: '2030-06-15',
      })),
      [request],
      balances([['equity', 100]]),
    )
    const evidence = result.evidence[0]!
    if (evidence.readiness !== 'actionable') throw new Error('expected actionable equity execution')
    const character = evidence.taxCharacter[0]
    if (character?.kind !== 'ordinaryIncome') throw new Error('expected ordinary-income character')

    expect(character.amount).toBe(produced)
    expect(character.amount).not.toBe(accepted)
  })
})

// Wire-format pin, not a statutory-reading fixture: this exercises the
// hardened structural minter's output shape for equity-execution evidence,
// not any section 83(a) cliff-vesting question, so it sits on a plain
// describe rather than nested inside describeRule('irc-83-a-equity-
// compensation-execution-character', ...) above. describeRule registers
// every it() in its callback as coverage for the named rule, and this test
// does not exercise the same-year cliff vest that rule discriminates.
describe('equity execution evidence IDs', () => {
  it('mints its four evidence IDs with the hardened structural minter', () => {
    const equity = run(
      planWith(equityComp('equity')),
      [withdrawal({
        actionId: 'final-equity',
        sequence: 1,
        allocations: [allocation('equity-allocation', 'equity', 75)],
      })],
      balances([['equity', 100]]),
    )
    const equityEvidence = equity.evidence[0]!
    if (equityEvidence.readiness !== 'actionable') {
      throw new Error('expected actionable equity execution')
    }
    const accepted = equityEvidence.acceptedSourceEligibility[0]
    if (accepted?.sourceClass !== 'equityCompensation') {
      throw new Error('expected equity-compensation eligibility')
    }

    expect(accepted.availabilityEvidence.vestingEvidenceId).toBe(
      'equity-compensation-vesting:0bd5d5ce62e8196ea84ce998a2e4610a' +
        'cc6d73fe3d2103b5c045ba489b972a85',
    )
    expect(accepted.characterEvidence.characterEvidenceId).toBe(
      'equity-compensation-character:f816dd96bad720faef35e5ff041bef24' +
        '07eba041c9298788dcedf9932dbf0135',
    )

    const depletionRequests = [
      withdrawal({
        actionId: 'deplete-taxable',
        sequence: 1,
        allocations: [allocation('deplete-allocation', 'taxable', 100)],
      }),
      withdrawal({
        actionId: 'mixed-after-depletion',
        sequence: 2,
        allocations: [
          allocation('cash-allocation', 'cash', 50),
          allocation('taxable-zero-allocation', 'taxable', 50),
        ],
      }),
    ]
    const depleted = run(
      planWith(cash('cash'), taxable('taxable')),
      depletionRequests,
      balances([['cash', 50], ['taxable', 100]]),
      aliveEvidence(depletionRequests),
      [taxableSnapshot('taxable', 40)],
    )
    const second = depleted.evidence[1]
    if (second?.readiness !== 'actionable') {
      throw new Error('expected mixed partial action')
    }
    const zeroArm = second.acceptedSourceEligibility.find(
      (item) => item.allocationId === 'taxable-zero-allocation',
    )
    const cashArm = second.penaltyCoverage.find(
      (item) => item.allocationId === 'cash-allocation',
    )

    expect(
      zeroArm?.sourceClass === 'taxable'
        ? zeroArm.basisEvidence.basisEvidenceId
        : undefined,
    ).toBe(
      'taxable-basis-zero:e07b0612394a9ab8be0eee979a0beb2c' +
        '9907e91edc2bca325db590a775b3d18c',
    )
    expect(cashArm?.coverageEvidenceId).toBe(
      'cash-penalty-coverage:ef11650009513afc4aae3f5e87df2fde' +
        'b20c158e460991b7ee5b02887903699d',
    )
  })
})
