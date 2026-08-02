import { describe, expect, it } from 'vitest'
import type {
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import { prepareBeneficiaryTraditionalIraResidualRmdAllocation } from
  './beneficiaryTraditionalIraResidualRmdAllocation.js'
import type { BeneficiaryTraditionalIraResidualRmdScheduleEvidence } from
  './beneficiaryTraditionalIraResidualRmdMovementCandidate.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction,
  type PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput,
} from './beneficiaryTraditionalIraResidualRmdPhysicalTransaction.js'
import { asAccountId, asPersonId } from './identity.js'
import { asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

const beneficiaryPersonId = asPersonId('beneficiary')
const decedentPersonId = asPersonId('decedent')

function rmd(
  remaining: number,
  finalAnnualEvidenceId = 'annual:final',
  coordinatorEvidenceId = 'coordinator',
): BeneficiaryTraditionalIraDetachedRmdTransition {
  const withoutId = {
    predicate: 'beneficiaryTraditionalIraDetachedRmdTransition' as const,
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    rmdPoolId: 'pool:beneficiary:decedent',
    rmdRequiredAmount: asUsdCents(remaining),
    initialRmdSatisfiedAmount: asUsdCents(0),
    rmdSatisfiedByTransaction: asUsdCents(0),
    finalRmdSatisfiedAmount: asUsdCents(0),
    finalRmdRemainingAmount: asUsdCents(remaining),
    applicationEvidenceIds: [],
    finalAnnualEvidenceId,
    coordinatorEvidenceId,
  }
  return {
    ...withoutId,
    transitionEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-detached-rmd-transition',
      [withoutId],
    ),
  }
}

function source(
  id: string,
  balance: number,
  finalAnnualEvidenceId = 'annual:final',
  coordinatorEvidenceId = 'coordinator',
): BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  const withoutId = {
    predicate:
      'beneficiaryTraditionalIraDetachedSourceBalanceTransition' as const,
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    sourceAccountId: asAccountId(id),
    annualOpeningBalanceAmount: asUsdCents(balance),
    totalExecutedAmount: asUsdCents(0),
    annualFinalBalanceAmount: asUsdCents(balance),
    applicationEvidenceIds: [],
    finalAnnualEvidenceId,
    coordinatorEvidenceId,
  }
  return {
    ...withoutId,
    transitionEvidenceId: deriveActionStructuralId(
      'beneficiary-ira-detached-source-balance-transition',
      [withoutId],
    ),
  }
}

function input(
  remaining = 5_000,
  sources: readonly BeneficiaryTraditionalIraDetachedSourceBalanceTransition[] = [
    source('account:b', 5_000),
    source('account:a', 2_000),
    source('account:c', 7_000),
  ],
): PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput {
  const allocationInput = {
    rmdTransition: rmd(remaining),
    sourceBalanceTransitions: [...sources],
  }
  const allocation = prepareBeneficiaryTraditionalIraResidualRmdAllocation(
    allocationInput,
  )
  if (allocation.status !== 'residualRmdAllocationPrepared') {
    throw new Error('test fixture failed to prepare residual allocation')
  }
  let scheduleEvidence:
    BeneficiaryTraditionalIraResidualRmdScheduleEvidence | null = null
  if (allocation.residualRmdAllocatedAmount > 0) {
    const withoutId = {
      predicate:
        'beneficiaryTraditionalIraResidualRmdScheduleEvidence' as const,
      beneficiaryPersonId,
      decedentPersonId,
      taxYear: 2026,
      rmdPoolId: 'pool:beneficiary:decedent',
      residualAllocationEvidenceId: allocation.allocationEvidenceId,
      finalAnnualEvidenceId: allocationInput.rmdTransition
        .finalAnnualEvidenceId,
      coordinatorEvidenceId: allocationInput.rmdTransition
        .coordinatorEvidenceId,
      predecessorApplications: [],
      executionDate: '2026-10-15',
      executionSequence: 7,
    }
    scheduleEvidence = {
      ...withoutId,
      scheduleEvidenceId: deriveActionStructuralId(
        'beneficiary-ira-residual-rmd-schedule-evidence',
        [withoutId],
      ),
    }
  }
  return { movementInput: { allocationInput, scheduleEvidence } }
}

function rederiveSource(
  value: BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
): void {
  const mutable = value as unknown as Record<string, unknown>
  const withoutId = { ...mutable }
  Reflect.deleteProperty(withoutId, 'transitionEvidenceId')
  mutable['transitionEvidenceId'] = deriveActionStructuralId(
    'beneficiary-ira-detached-source-balance-transition',
    [withoutId],
  )
}

describe('prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction', () => {
  it('applies a full candidate chain and publishes every source in stable order', () => {
    const result =
      prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(input())

    expect(result).toMatchObject({
      status: 'residualRmdPhysicalTransactionPrepared',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      transactionStatus: 'appliedToDetachedSnapshotOnly',
      residualRmdRequiredAmount: 5_000,
      residualRmdExecutedAmount: 5_000,
      residualRmdUnallocatedAmount: 0,
      residualDistributionProceedsAmount: 5_000,
    })
    if (result.status !== 'residualRmdPhysicalTransactionPrepared') return
    expect(result.residualApplications.map((entry) => ({
      sourceAccountId: entry.sourceAccountId,
      sourceBalanceBefore: entry.sourceBalanceBefore,
      executedAmount: entry.executedAmount,
      sourceBalanceAfter: entry.sourceBalanceAfter,
      residualRmdBefore: entry.residualRmdBefore,
      residualRmdAfter: entry.residualRmdAfter,
    }))).toEqual([
      {
        sourceAccountId: 'account:a',
        sourceBalanceBefore: 2_000,
        executedAmount: 2_000,
        sourceBalanceAfter: 0,
        residualRmdBefore: 5_000,
        residualRmdAfter: 3_000,
      },
      {
        sourceAccountId: 'account:b',
        sourceBalanceBefore: 5_000,
        executedAmount: 3_000,
        sourceBalanceAfter: 2_000,
        residualRmdBefore: 3_000,
        residualRmdAfter: 0,
      },
    ])
    expect(result.sourceBalanceTransitions.map((entry) => ({
      sourceAccountId: entry.sourceAccountId,
      residualRmdExecutedAmount: entry.residualRmdExecutedAmount,
      postResidualBalanceAmount: entry.postResidualBalanceAmount,
      applicationCount: entry.residualApplicationEvidenceIds.length,
    }))).toEqual([
      {
        sourceAccountId: 'account:a',
        residualRmdExecutedAmount: 2_000,
        postResidualBalanceAmount: 0,
        applicationCount: 1,
      },
      {
        sourceAccountId: 'account:b',
        residualRmdExecutedAmount: 3_000,
        postResidualBalanceAmount: 2_000,
        applicationCount: 1,
      },
      {
        sourceAccountId: 'account:c',
        residualRmdExecutedAmount: 0,
        postResidualBalanceAmount: 7_000,
        applicationCount: 0,
      },
    ])
    expect(result.rmdTransition).toMatchObject({
      rmdSatisfiedBeforeResidual: 0,
      rmdSatisfiedByResidualTransaction: 5_000,
      finalRmdSatisfiedAmount: 5_000,
      finalRmdRemainingAmount: 0,
    })
    expect(result.transactionEvidenceId).toMatch(
      /^beneficiary-ira-residual-rmd-physical-transaction:[0-9a-f]{64}$/,
    )
  })

  it('preserves an exact final shortfall after exhausting source capacity', () => {
    const result = prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
      input(8_000, [source('account:b', 3_000), source('account:a', 2_000)]),
    )

    expect(result).toMatchObject({
      status: 'residualRmdPhysicalTransactionPrepared',
      residualRmdRequiredAmount: 8_000,
      residualRmdExecutedAmount: 5_000,
      residualRmdUnallocatedAmount: 3_000,
      residualDistributionProceedsAmount: 5_000,
      rmdTransition: { finalRmdRemainingAmount: 3_000 },
    })
  })

  it.each([
    [0, 'requirementAlreadySatisfied', 0],
    [5_000, 'noSourceCapacity', 5_000],
  ] as const)(
    'creates no event for requirement %i with %s',
    (remaining, reason, unallocated) => {
      const result =
        prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
          input(remaining, [source('account:a', 0)]),
        )
      expect(result).toEqual(expect.objectContaining({
        status: 'noResidualRmdPhysicalTransaction',
        noTransactionReason: reason,
        transactionStatus: 'notCreated',
        residualRmdRequiredAmount: remaining,
        residualRmdExecutedAmount: 0,
        residualRmdUnallocatedAmount: unallocated,
        residualDistributionProceedsAmount: 0,
        residualApplications: [],
        sourceBalanceTransitions: [],
        rmdTransition: null,
        transactionEvidenceId: null,
      }))
    },
  )

  it('reruns raw lineage and rejects stale, forged, colliding, or unsafe cents', () => {
    const stale = structuredClone(input())
    ;(stale.movementInput.scheduleEvidence as unknown as
      Record<string, unknown>)['scheduleEvidenceId'] = 'forged'
    expect(prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(stale))
      .toMatchObject({ status: 'unsupported', transactionEvidenceId: null })

    const forged = structuredClone(input())
    ;(forged.movementInput.allocationInput
      .sourceBalanceTransitions[0] as unknown as
        Record<string, unknown>)['annualFinalBalanceAmount'] = asUsdCents(4_999)
    expect(prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(forged))
      .toMatchObject({ status: 'unsupported' })

    const collidingRmd = rmd(5_000, 'same-role-id', 'same-role-id')
    const collidingSource = source(
      'account:a',
      5_000,
      'same-role-id',
      'same-role-id',
    )
    const collision: PrepareBeneficiaryTraditionalIraResidualRmdPhysicalTransactionInput = {
      movementInput: {
        allocationInput: {
          rmdTransition: collidingRmd,
          sourceBalanceTransitions: [collidingSource],
        },
        scheduleEvidence: null,
      },
    }
    expect(prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
      collision,
    )).toMatchObject({ status: 'unsupported' })

    const overflow = structuredClone(input())
    const unsafeSource = overflow.movementInput.allocationInput
      .sourceBalanceTransitions[0]!
    ;(unsafeSource as unknown as Record<string, unknown>)[
      'annualOpeningBalanceAmount'
    ] = Number.MAX_SAFE_INTEGER + 1
    rederiveSource(unsafeSource)
    expect(prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(
      overflow,
    )).toMatchObject({ status: 'unsupported' })
  })

  it('is source-order invariant, reproducible, and deeply immutable', () => {
    const original = input()
    const reordered = input(
      5_000,
      [...original.movementInput.allocationInput.sourceBalanceTransitions]
        .reverse(),
    )
    const first =
      prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(original)
    const repeated =
      prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(input())
    const reversed =
      prepareBeneficiaryTraditionalIraResidualRmdPhysicalTransaction(reordered)

    expect(repeated).toEqual(first)
    expect(reversed).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    if (first.status !== 'residualRmdPhysicalTransactionPrepared') return
    expect(Object.isFrozen(first.residualApplications)).toBe(true)
    expect(Object.isFrozen(first.residualApplications[0])).toBe(true)
    expect(Object.isFrozen(first.sourceBalanceTransitions)).toBe(true)
    expect(Object.isFrozen(first.rmdTransition)).toBe(true)
    expect(() => {
      ;(first.residualApplications as unknown as unknown[]).push('hostile')
    }).toThrow()
  })
})
