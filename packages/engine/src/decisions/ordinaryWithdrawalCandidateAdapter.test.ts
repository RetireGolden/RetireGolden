import { describe, expect, it } from 'vitest'

import type {
  QualifiedCharitableDistributionRequest,
  RetirementActionRequest,
} from '../actions/contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import {
  allocateRetirementActionCandidateIdentity,
  type OrdinaryWithdrawalCandidateIdentityIntent,
  type RothConversionCandidateIdentityIntent,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { simOptions } from '../testing/decisionFixtures.js'
import {
  createDecisionContext,
  evaluateCandidate,
  planForCandidate,
} from './evaluateCandidate.js'
import {
  adaptOrdinaryWithdrawalGeneratorCandidate,
  type OrdinaryWithdrawalGeneratorCandidateDescriptor,
} from './ordinaryWithdrawalCandidateAdapter.js'

function ownedCash(id: string, ownerPersonId = 'p1'): Account {
  return { ...cashAccount(id, 100_000), ownerPersonId }
}

function ownedRoth(id: string, ownerPersonId = 'p1'): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance: 100_000,
    annualContribution: 0,
  }
}

const descriptorMetadata = {
  decisionRule: 'explicit-source-withdrawal',
  alternativesRetained: ['cash-a', 'cash-b'],
}

function descriptor(): OrdinaryWithdrawalGeneratorCandidateDescriptor {
  return {
    id: 'ordinary-withdrawal-candidate',
    source: 'heuristic',
    label: 'Fund spending from named cash',
    explanation: 'Uses the exact source identities supplied by the generator.',
    metadata: descriptorMetadata,
  }
}

function intent(
  overrides: Partial<OrdinaryWithdrawalCandidateIdentityIntent> = {},
): OrdinaryWithdrawalCandidateIdentityIntent {
  return {
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 3,
    requestedAmount: asPositiveUsdCents(12_345),
    personId: asPersonId('p1'),
    provenance: {
      source: 'generator',
      sourceId: 'ordinary-withdrawal-candidate',
      scenarioId: 'scenario-a',
    },
    sourceAllocations: [{
      sourceAccountId: asAccountId('cash-a'),
      requestedAmount: asPositiveUsdCents(12_345),
    }],
    purpose: { kind: 'goal', referenceId: 'goal-a' },
    ...overrides,
  }
}

function conversionIntent(): RothConversionCandidateIdentityIntent {
  return {
    kind: 'rothConversion',
    year: 2029,
    executionDate: '2029-09-01',
    executionSequence: 2,
    requestedAmount: asPositiveUsdCents(50_000),
    personId: asPersonId('p1'),
    provenance: { source: 'optimizer', sourceId: 'current-conversion' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('trad-a'),
      requestedAmount: asPositiveUsdCents(50_000),
    }],
    destinationRothAccountId: asAccountId('roth-a'),
    taxFunding: { kind: 'noneExpected' },
  }
}

function qcdRequest(): QualifiedCharitableDistributionRequest {
  return {
    actionId: asActionId('current-qcd'),
    kind: 'qcd',
    year: 2029,
    executionDate: '2029-10-01',
    executionSequence: 4,
    requestedAmount: asPositiveUsdCents(25_000),
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('current-qcd-allocation'),
      sourceAccountId: asAccountId('trad-a'),
      requestedAmount: asPositiveUsdCents(25_000),
    },
    charity: {
      designationId: 'charity-a',
      name: 'Eligible Charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function candidateSchedule(result: ReturnType<typeof adaptOrdinaryWithdrawalGeneratorCandidate>) {
  expect(result.status).toBe('adapted')
  if (result.status !== 'adapted') throw new Error('expected adapted candidate')
  const strategies = result.candidate.planPatch?.['strategies'] as {
    retirementActions: RetirementActionRequest[]
  }
  return strategies.retirementActions
}

describe('ordinary-withdrawal candidate adapter', () => {
  it('builds one exact identity-complete candidate without changing aggregate strategy arms', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const inputDescriptor = descriptor()
    const inputIntent = intent()

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      inputDescriptor,
      inputIntent,
    )

    expect(result.status).toBe('adapted')
    if (result.status !== 'adapted') return
    expect(result.candidate).toMatchObject({
      id: inputDescriptor.id,
      source: inputDescriptor.source,
      category: 'withdrawal',
      label: inputDescriptor.label,
      explanation: inputDescriptor.explanation,
      retirementActionReadiness: { state: 'identityComplete' },
    })
    expect(result.candidate.metadata).toEqual(descriptorMetadata)
    expect(result.candidate.metadata).not.toBe(descriptorMetadata)
    expect(result.candidate.conversions).toBeUndefined()
    const patchStrategies = result.candidate.planPatch?.['strategies'] as Record<string, unknown>
    expect(Object.keys(patchStrategies)).toEqual(['retirementActions'])
    expect(patchStrategies['withdrawalOrder']).toBeUndefined()

    const request = candidateSchedule(result)[0]!
    expect(request).toMatchObject({
      kind: 'ordinaryWithdrawal',
      year: 2030,
      executionDate: '2030-06-15',
      executionSequence: 3,
      requestedAmount: 12_345,
      personId: 'p1',
      provenance: inputIntent.provenance,
      purpose: inputIntent.purpose,
    })
    expect(result.identityEvidence).toMatchObject({
      policy: 'explicitStablePlanIdsOnly',
      personId: 'p1',
      sourceAccountIds: ['cash-a'],
    })
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [request.actionId],
    })
  })

  it('keeps multi-source identities stable across account and intent permutations', () => {
    const plan = couplePlan()
    plan.accounts = [
      ownedCash('cash-b'),
      ownedCash('cash-a'),
      ownedCash('cash-p2', 'p2'),
    ]
    const multiSource = intent({
      requestedAmount: asPositiveUsdCents(12_345),
      sourceAllocations: [
        {
          sourceAccountId: asAccountId('cash-b'),
          requestedAmount: asPositiveUsdCents(2_345),
        },
        {
          sourceAccountId: asAccountId('cash-a'),
          requestedAmount: asPositiveUsdCents(10_000),
        },
      ],
    })
    const permuted: Plan = {
      ...plan,
      household: {
        ...plan.household,
        people: [...plan.household.people].reverse(),
      },
      accounts: [...plan.accounts].reverse(),
    }

    const first = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      multiSource,
    )
    const second = adaptOrdinaryWithdrawalGeneratorCandidate(
      permuted,
      descriptor(),
      {
        ...multiSource,
        sourceAllocations: [...multiSource.sourceAllocations].reverse(),
      },
    )

    expect(second).toEqual(first)
    const request = candidateSchedule(first)[0]!
    if (request.kind !== 'ordinaryWithdrawal') throw new Error('expected withdrawal')
    expect(request.requestedAmount).toBe(12_345)
    expect(request.allocations.reduce(
      (total, allocation) => total + allocation.requestedAmount,
      0,
    )).toBe(12_345)
    expect(request.allocations.map((allocation) => allocation.sourceAccountId).sort())
      .toEqual(['cash-a', 'cash-b'])
  })

  it('byte-preserves every current-kind request and certifies only the appended request', () => {
    const plan = singlePersonPlan({ planningAge: 90 })
    plan.accounts = [
      ownedCash('cash-current'),
      ownedCash('cash-a'),
      traditionalAccount('trad-a', 100_000),
      ownedRoth('roth-a'),
    ]
    const currentOrdinary = allocateRetirementActionCandidateIdentity(plan, intent({
      year: 2028,
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(10_000),
      sourceAllocations: [{
        sourceAccountId: asAccountId('cash-current'),
        requestedAmount: asPositiveUsdCents(10_000),
      }],
      provenance: { source: 'manual' },
      purpose: { kind: 'spending' },
    }))
    const currentConversion = allocateRetirementActionCandidateIdentity(
      plan,
      conversionIntent(),
    )
    expect(currentOrdinary.status).toBe('allocated')
    expect(currentConversion.status).toBe('allocated')
    if (currentOrdinary.status !== 'allocated' || currentConversion.status !== 'allocated') return
    plan.strategies.retirementActions = [
      currentOrdinary.request,
      currentConversion.request,
      qcdRequest(),
    ]
    const scheduleBefore = plan.strategies.retirementActions
    const bytesBefore = JSON.stringify(scheduleBefore)

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      intent(),
    )

    const patched = candidateSchedule(result)
    expect(patched).not.toBe(scheduleBefore)
    expect(JSON.stringify(patched.slice(0, -1))).toBe(bytesBefore)
    expect(patched.slice(0, -1)).toEqual(scheduleBefore)
    patched.slice(0, -1).forEach((action, index) => {
      expect(action).not.toBe(scheduleBefore[index])
    })
    if (result.status !== 'adapted') return
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [patched.at(-1)!.actionId],
    })
    expect(patched.map((action) => action.kind)).toEqual([
      'ordinaryWithdrawal',
      'rothConversion',
      'qcd',
      'ordinaryWithdrawal',
    ])

    const evaluation = evaluateCandidate(
      createDecisionContext(plan, simOptions()),
      result.candidate,
    )
    expect(
      evaluation.recommendationState,
      evaluation.diagnostics.join('\n'),
    ).not.toBe('diagnostic')
    expect(evaluation.diagnostics).toEqual([])
    expect(evaluation.candidateResult.years.flatMap((year) =>
      year.retirementActionExecution?.evidence ?? []).map((evidence) =>
      evidence.actionId)).toContain(patched.at(-1)!.actionId)
  })

  it.each([
    ['null descriptor', null],
    ['array descriptor', []],
    ['blank ID', { ...descriptor(), id: ' ' }],
    ['unsupported source', { ...descriptor(), source: 'runtime-hostile' }],
    ['blank label', { ...descriptor(), label: '' }],
    ['blank explanation', { ...descriptor(), explanation: '\t' }],
    ['null metadata', { ...descriptor(), metadata: null }],
    ['array metadata', { ...descriptor(), metadata: [] }],
    ['non-record metadata', { ...descriptor(), metadata: new Map() }],
    ['unexpected field', { ...descriptor(), ignored: true }],
  ])('blocks a malformed runtime %s', (_label, malformedDescriptor) => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      malformedDescriptor as never,
      intent(),
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'invalidAdapterInput',
        field: '$',
      }],
    })
  })

  it('blocks a preserved legacy aggregate arm instead of dropping or certifying it', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    plan.strategies.retirementActions = [{
      actionId: asActionId('legacy-withdrawal'),
      kind: 'legacyAggregateWithdrawal',
      year: 2030,
      requestedAmount: asPositiveUsdCents(12_345),
      provenance: { source: 'migration', sourceId: 'legacy-import' },
      legacyCategory: 'cash',
    }]
    const before = structuredClone(plan.strategies.retirementActions)

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      intent(),
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'nonCurrentRetirementActionSchedule',
        field: 'plan.strategies.retirementActions.0',
        reason: null,
      }],
    })
    expect(plan.strategies.retirementActions).toEqual(before)
  })

  it.each([
    ['non-array', null],
    ['null request', [null]],
    ['missing action ID', [{ kind: 'ordinaryWithdrawal' }]],
  ])('fails closed for a runtime-hostile %s schedule', (_label, retirementActions) => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    ;(plan.strategies as { retirementActions: unknown }).retirementActions =
      retirementActions

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      intent(),
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{ kind: 'invalidRetirementActionSchedule' }],
    })
  })

  it('blocks duplicate IDs in an otherwise current-kind schedule', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const current = allocateRetirementActionCandidateIdentity(plan, intent({
      year: 2028,
      provenance: { source: 'manual' },
      purpose: { kind: 'spending' },
    }))
    expect(current.status).toBe('allocated')
    if (current.status !== 'allocated') return
    plan.strategies.retirementActions = [current.request, current.request]

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      intent(),
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'invalidRetirementActionSchedule',
        field: 'plan.strategies.retirementActions.1.actionId',
      }],
    })
  })

  it('snapshots stateful schedule, descriptor, and intent getters once before adapting', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-current'), ownedCash('cash-a')]
    const current = allocateRetirementActionCandidateIdentity(plan, intent({
      year: 2028,
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(10_000),
      sourceAllocations: [{
        sourceAccountId: asAccountId('cash-current'),
        requestedAmount: asPositiveUsdCents(10_000),
      }],
      provenance: { source: 'manual' },
      purpose: { kind: 'spending' },
    }))
    expect(current.status).toBe('allocated')
    if (current.status !== 'allocated') return

    const { actionId: stableActionId, ...actionRest } = current.request
    let actionIdReads = 0
    const accessorAction = Object.defineProperty(
      { ...actionRest },
      'actionId',
      {
        enumerable: true,
        get() {
          actionIdReads += 1
          return actionIdReads === 1
            ? stableActionId
            : asActionId('changed-action-id')
        },
      },
    ) as RetirementActionRequest
    const expectedScheduleBytes = JSON.stringify([{
      ...actionRest,
      actionId: stableActionId,
    }])
    let scheduleReads = 0
    Object.defineProperty(plan.strategies, 'retirementActions', {
      enumerable: true,
      get() {
        scheduleReads += 1
        return scheduleReads === 1
          ? [accessorAction]
          : [{
              actionId: asActionId('late-legacy-action'),
              kind: 'legacyAggregateWithdrawal' as const,
              year: 2030,
              requestedAmount: asPositiveUsdCents(1),
              provenance: { source: 'migration' as const },
              legacyCategory: 'cash',
            }]
      },
    })

    const stableDescriptor = descriptor()
    const { label: stableLabel, ...descriptorRest } = stableDescriptor
    let labelReads = 0
    const accessorDescriptor = Object.defineProperty(
      { ...descriptorRest },
      'label',
      {
        enumerable: true,
        get() {
          labelReads += 1
          return labelReads === 1 ? stableLabel : 'Changed label'
        },
      },
    ) as OrdinaryWithdrawalGeneratorCandidateDescriptor

    const stableIntent = intent()
    const { requestedAmount: stableRequestedAmount, ...intentRest } = stableIntent
    let requestedAmountReads = 0
    const accessorIntent = Object.defineProperty(
      { ...intentRest },
      'requestedAmount',
      {
        enumerable: true,
        get() {
          requestedAmountReads += 1
          return requestedAmountReads === 1
            ? stableRequestedAmount
            : asPositiveUsdCents(stableRequestedAmount + 1)
        },
      },
    ) as OrdinaryWithdrawalCandidateIdentityIntent

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      accessorDescriptor,
      accessorIntent,
    )

    expect(result.status).toBe('adapted')
    expect(scheduleReads).toBe(1)
    expect(actionIdReads).toBe(1)
    expect(labelReads).toBe(1)
    expect(requestedAmountReads).toBe(1)
    if (result.status !== 'adapted') return
    const patched = candidateSchedule(result)
    expect(JSON.stringify(patched.slice(0, -1))).toBe(expectedScheduleBytes)
    expect(patched[0]!.actionId).toBe(stableActionId)
    expect(result.candidate.label).toBe(stableLabel)
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [patched.at(-1)!.actionId],
    })
  })

  it('fails closed when a hostile proxy cannot cross the data snapshot boundary', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const hostileDescriptor = new Proxy(descriptor(), {
      ownKeys() {
        throw new Error('hostile descriptor')
      },
    })

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      hostileDescriptor,
      intent(),
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'invalidAdapterInput',
        field: '$',
      }],
    })
  })

  it('propagates allocator blocks with a null candidate and never chooses another account', () => {
    const plan = couplePlan()
    plan.accounts = [ownedCash('cash-p1'), ownedCash('cash-p2', 'p2')]
    const crossOwnerIntent = intent({
      sourceAllocations: [{
        sourceAccountId: asAccountId('cash-p2'),
        requestedAmount: asPositiveUsdCents(12_345),
      }],
    })
    const allocatorResult = allocateRetirementActionCandidateIdentity(
      plan,
      crossOwnerIntent,
    )

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      crossOwnerIntent,
    )

    expect(allocatorResult.status).toBe('blocked')
    expect(result.status).toBe('blocked')
    if (allocatorResult.status !== 'blocked' || result.status !== 'blocked') return
    expect(result.candidate).toBeNull()
    expect(result.issues).toEqual(allocatorResult.issues)
    expect(result.issues.map((issue) => issue.reason?.code))
      .toContain('source-owner-mismatch')
  })

  it('classifies a non-withdrawal allocator result as an adapter contract breach', () => {
    const plan = singlePersonPlan()
    plan.accounts = [
      traditionalAccount('trad-a', 100_000),
      ownedRoth('roth-a'),
    ]

    const result = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      descriptor(),
      conversionIntent() as never,
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'invalidAdapterInput',
        field: '$',
        reason: null,
        detail: expect.stringMatching(/non-withdrawal allocator result/i),
      }],
    })
  })

  it('is mutation-free and repeatable, and its sole patch materializes through planForCandidate', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const inputDescriptor = descriptor()
    const inputIntent = intent()
    const planBefore = structuredClone(plan)
    const descriptorBefore = structuredClone(inputDescriptor)
    const intentBefore = structuredClone(inputIntent)

    const first = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      inputDescriptor,
      inputIntent,
    )
    const second = adaptOrdinaryWithdrawalGeneratorCandidate(
      plan,
      inputDescriptor,
      inputIntent,
    )

    expect(second).toEqual(first)
    expect(plan).toEqual(planBefore)
    expect(inputDescriptor).toEqual(descriptorBefore)
    expect(inputIntent).toEqual(intentBefore)
    if (first.status !== 'adapted') throw new Error('expected adapted candidate')
    const built = planForCandidate(plan, first.candidate)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.plan.strategies.withdrawalOrder).toEqual(
      plan.strategies.withdrawalOrder,
    )
    expect(built.plan.strategies.retirementActions).toEqual(
      candidateSchedule(first),
    )
  })
})
