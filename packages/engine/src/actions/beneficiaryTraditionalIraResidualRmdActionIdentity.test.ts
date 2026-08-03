import { describe, expect, it } from 'vitest'
import type {
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import type { BeneficiaryTraditionalIraResidualRmdScheduleEvidence } from
  './beneficiaryTraditionalIraResidualRmdMovementCandidate.js'
import type { PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput } from
  './beneficiaryTraditionalIraResidualRmdPhysicalTransaction.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdActionIdentity,
  type PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput,
} from './beneficiaryTraditionalIraResidualRmdActionIdentity.js'
import { asAccountId, asPersonId } from './identity.js'
import { asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import type { Plan } from '../model/plan.js'
import { singlePersonPlan } from '../testing/planFixtures.js'

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')

function source(id: string, balance: number): BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  const withoutId = {
    predicate: 'beneficiaryTraditionalIraDetachedSourceBalanceTransition' as const,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    taxYear: 2026, sourceAccountId: asAccountId(id),
    annualOpeningBalanceAmount: asUsdCents(balance),
    totalExecutedAmount: asUsdCents(0),
    annualFinalBalanceAmount: asUsdCents(balance),
    applicationEvidenceIds: [], finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
  }
  return { ...withoutId, transitionEvidenceId: deriveActionStructuralId(
    'beneficiary-ira-detached-source-balance-transition', [withoutId],
  ) }
}

function rmd(remaining: number): BeneficiaryTraditionalIraDetachedRmdTransition {
  const withoutId = {
    predicate: 'beneficiaryTraditionalIraDetachedRmdTransition' as const,
    beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
    taxYear: 2026, rmdPoolId: 'pool',
    rmdRequiredAmount: asUsdCents(remaining),
    initialRmdSatisfiedAmount: asUsdCents(0),
    rmdSatisfiedByTransaction: asUsdCents(0),
    finalRmdSatisfiedAmount: asUsdCents(0),
    finalRmdRemainingAmount: asUsdCents(remaining),
    applicationEvidenceIds: [], finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
  }
  return { ...withoutId, transitionEvidenceId: deriveActionStructuralId(
    'beneficiary-ira-detached-rmd-transition', [withoutId],
  ) }
}

function physical(
  remaining = 5_000,
  sources = [source('account:b', 5_000), source('account:a', 2_000)],
): PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput {
  const allocationInput = { rmdTransition: rmd(remaining), sourceBalanceTransitions: sources }
  const allocation = prepareBeneficiaryTraditionalIraResidualRmdAllocation(allocationInput)
  if (allocation.status !== 'residualRmdAllocationPrepared') throw new Error('fixture')
  let scheduleEvidence: BeneficiaryTraditionalIraResidualRmdScheduleEvidence | null = null
  if (allocation.residualRmdAllocatedAmount > 0) {
    const withoutId = {
      predicate: 'beneficiaryTraditionalIraResidualRmdScheduleEvidence' as const,
      beneficiaryPersonId: beneficiary, decedentPersonId: decedent,
      taxYear: 2026, rmdPoolId: 'pool',
      residualAllocationEvidenceId: allocation.allocationEvidenceId,
      finalAnnualEvidenceId: 'annual:final', coordinatorEvidenceId: 'coordinator',
      predecessorApplications: [], executionDate: '2026-10-15',
      executionSequence: 7,
    }
    scheduleEvidence = { ...withoutId, scheduleEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-schedule-evidence', [withoutId],
    ) }
  }
  return { movementInput: { allocationInput, scheduleEvidence } }
}

interface FixtureInput {
  plan: Plan
  planSnapshotEvidenceId: string
  physicalTransactionInput: PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput
}

function input(
  physicalTransactionInput = physical(),
): FixtureInput {
  const plan = singlePersonPlan()
  plan.id = 'plan'
  plan.household.people[0]!.id = beneficiary
  plan.accounts = ['account:a', 'account:b'].map((id) => ({
    type: 'traditional' as const, id, name: id,
    ownerPersonId: beneficiary, annualReturnPct: 0, kind: 'ira' as const,
    balance: 10_000, annualContribution: 0,
    inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: true },
  }))
  return { plan, planSnapshotEvidenceId: 'plan-snapshot', physicalTransactionInput }
}

function prepare(
  value: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput> = input(),
) {
  return prepareBeneficiaryTraditionalIraResidualRmdActionIdentity(value)
}

describe('prepareBeneficiaryTraditionalIraResidualRmdActionIdentity', () => {
  it('allocates one canonical withdrawal from actual positive applications', () => {
    const result = prepare()
    expect(result).toMatchObject({
      status: 'residualRmdActionIdentityPrepared', movement: 'notCommitted',
      committed: false, actionability: 'notEstablished',
      request: {
        kind: 'ordinaryWithdrawal', year: 2026, executionDate: '2026-10-15',
        executionSequence: 7, requestedAmount: 5_000,
        personId: 'beneficiary',
        purpose: { kind: 'other' }, provenance: { source: 'generator' },
      },
    })
    if (result.status !== 'residualRmdActionIdentityPrepared') return
    expect(result.request.purpose.referenceId).toBe(
      result.physicalTransaction.transactionEvidenceId,
    )
    expect(result.request.provenance.sourceId).toBe(
      result.physicalTransaction.transactionEvidenceId,
    )
    expect(result.applicationBindings.map((binding) => ({
      source: binding.sourceAccountId, amount: binding.executedAmount,
      allocation: result.request.allocations.find((allocation) =>
        allocation.allocationId === binding.allocationId)?.requestedAmount,
      application: result.physicalTransaction.residualApplications.find((app) =>
        app.applicationEvidenceId === binding.applicationEvidenceId)?.executedAmount,
    }))).toEqual([
      { source: 'account:a', amount: 1_429, allocation: 1_429, application: 1_429 },
      { source: 'account:b', amount: 3_571, allocation: 3_571, application: 3_571 },
    ])
    expect(result.identityEvidenceId).toMatch(
      /^beneficiary-ira-residual-rmd-action-identity:[0-9a-f]{64}$/,
    )
  })

  it.each([
    [0, [source('account:a', 0)], 'requirementAlreadySatisfied'],
    [5_000, [source('account:a', 0)], 'noSourceCapacity'],
  ] as const)('creates no identity or zero event', (remaining, sources, reason) => {
    expect(prepare(input(physical(remaining, [...sources])))).toMatchObject({
      status: 'noResidualRmdActionIdentity', noIdentityReason: reason,
      request: null, applicationBindings: [], identityEvidenceId: null,
      physicalTransaction: { status: 'noResidualRmdPhysicalTransaction' },
    })
  })

  it('is order invariant, deterministic, exact, and deeply frozen', () => {
    const value = input()
    const before = structuredClone(value)
    const first = prepare(value)
    const repeated = prepare()
    const reversed = prepare(input(physical(5_000, [
      source('account:a', 2_000), source('account:b', 5_000),
    ])))
    expect(repeated).toEqual(first)
    expect(reversed).toEqual(first)
    expect(value).toEqual(before)
    expect(Object.isFrozen(first)).toBe(true)
    if (first.status !== 'residualRmdActionIdentityPrepared') return
    expect(Object.isFrozen(first.request.allocations)).toBe(true)
    expect(Object.isFrozen(first.applicationBindings[0])).toBe(true)
    expect(() => {
      ;(first.applicationBindings as unknown as unknown[]).push('hostile')
    }).toThrow()
  })

  it('rejects stale, hostile, unsafe, wrong-owner, wrong-kind, and collisions', () => {
    const stale = input()
    ;(stale.physicalTransactionInput.movementInput.scheduleEvidence as unknown as
      { scheduleEvidenceId: string }).scheduleEvidenceId = 'stale'
    expect(prepare(stale).status).toBe('unsupported')

    const hostile = input() as unknown as Record<string, unknown>
    hostile['extra'] = true
    expect(prepare(hostile as unknown as
      PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput).status)
      .toBe('unsupported')

    const unsafe = input()
    ;(unsafe.physicalTransactionInput.movementInput.allocationInput
      .rmdTransition as unknown as { rmdRequiredAmount: number })
      .rmdRequiredAmount = Number.MAX_SAFE_INTEGER + 1
    expect(prepare(unsafe).status).toBe('unsupported')

    for (const mutate of [
      (value: ReturnType<typeof input>) => { value.plan.accounts[0]!.ownerPersonId = 'other' },
      (value: ReturnType<typeof input>) => {
        ;(value.plan.accounts[0] as { kind: string }).kind = 'employer'
      },
      (value: ReturnType<typeof input>) => {
        Reflect.deleteProperty(value.plan.accounts[0]!, 'inherited')
      },
    ]) {
      const value = input()
      mutate(value)
      expect(prepare(value).status).toBe('unsupported')
    }

    const baseline = prepare()
    if (baseline.status !== 'residualRmdActionIdentityPrepared') return
    const collision = input()
    collision.planSnapshotEvidenceId = baseline.request.actionId
    expect(prepare(collision).status).toBe('unsupported')
  })

  it('rejects accessors without invoking them', () => {
    const value = input()
    let invoked = false
    Object.defineProperty(value, 'planSnapshotEvidenceId', {
      enumerable: true,
      get() { invoked = true; return 'snapshot' },
    })
    expect(prepare(value).status).toBe('unsupported')
    expect(invoked).toBe(false)
  })
})
