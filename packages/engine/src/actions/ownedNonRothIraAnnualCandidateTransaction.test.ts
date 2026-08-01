import { describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  type PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput,
} from './ownedNonRothIraAnnualCandidateTransaction.js'
import * as structuralId from './structuralId.js'

const owner = asPersonId('p1')
const planId = asPlanId('candidate-transaction-plan')
const firstIra = asAccountId('ira-first')
const secondIra = asAccountId('ira-second')

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.accounts = [
    traditionalAccount(firstIra, 100, owner),
    traditionalAccount(secondIra, 200, owner),
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: firstIra,
      subtype: 'traditional',
      evidenceId: 'classification-first',
      provenance: { source: 'manual' },
    }, {
      sourceAccountId: secondIra,
      subtype: 'sep',
      evidenceId: 'classification-second',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [{
    actionId: asActionId('withdrawal'),
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 10,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'manual' },
    personId: owner,
    allocations: [{
      allocationId: asAllocationId('withdrawal-allocation'),
      sourceAccountId: firstIra,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return value
}

function input(
  opening = 10_000,
  valuePlan = plan(),
): PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput {
  return {
    plan: valuePlan,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    openingBalances: [{
      accountId: firstIra,
      openingBalance: asUsdCents(opening),
    }],
    runtimeRecords: [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      resolvedEventIds: [],
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
}

function prepared(
  value: PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput,
) {
  const result = preparePlanOwnedNonRothIraAnnualCandidateTransaction(value)
  expect(result.status).toBe('candidateTransactionPrepared')
  if (result.status !== 'candidateTransactionPrepared') {
    throw new Error(`fixture did not prepare: ${result.status}`)
  }
  return result
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).reverse().map(
    ([key, child]) => [key, reverseObjectKeys(child)],
  ))
}

describe('Plan-owned non-Roth IRA annual candidate transaction', () => {
  it.each([
    ['full', 10_000, 10_000, 0],
    ['partial', 4_000, 4_000, 0],
    ['zero', 0, 0, 0],
  ] as const)(
    'publishes an exact detached %s candidate',
    (_label, opening, executed, closing) => {
      const result = prepared(input(opening))
      expect(result).toMatchObject({
        movement: 'notCommitted',
        actionability: 'notEstablished',
        transactionStatus: 'appliedToDetachedSnapshotOnly',
        stagedProceeds: executed,
      })
      expect(result.allocationApplications[0]).toMatchObject({
        balanceBefore: opening,
        executedAmount: executed,
        candidateBalanceAfter: closing,
      })
      expect(result.sourceBalanceTransitions[0]).toMatchObject({
        openingBalance: opening,
        executedAmount: executed,
        candidateClosingBalance: closing,
      })
      expect(result).not.toHaveProperty('annualFinalization')
      expect(result).not.toHaveProperty('yearEndApplicableBalances')
      expect(result).not.toHaveProperty('taxCharacter')
      expect(result).not.toHaveProperty('penaltyEvaluations')
    },
  )

  it('orders multiple actions canonically and reconciles exact proceeds', () => {
    const valuePlan = plan()
    const first = valuePlan.strategies.retirementActions[0]!
    if (first.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    valuePlan.strategies.retirementActions = [{
      ...first,
      actionId: asActionId('withdrawal-later'),
      executionDate: '2030-04-01',
      executionSequence: 20,
      requestedAmount: asPositiveUsdCents(7_000),
      allocations: [{
        allocationId: asAllocationId('later-allocation'),
        sourceAccountId: secondIra,
        requestedAmount: asPositiveUsdCents(7_000),
      }],
    }, {
      ...first,
      actionId: asActionId('withdrawal-earlier'),
      executionDate: '2030-04-01',
      executionSequence: 5,
      requestedAmount: asPositiveUsdCents(5_000),
      allocations: [{
        allocationId: asAllocationId('earlier-allocation'),
        sourceAccountId: firstIra,
        requestedAmount: asPositiveUsdCents(5_000),
      }],
    }]
    const value = input(5_000, valuePlan)
    value.openingBalances = [{
      accountId: secondIra,
      openingBalance: asUsdCents(6_000),
    }, {
      accountId: firstIra,
      openingBalance: asUsdCents(5_000),
    }]
    const result = prepared(value)
    expect(result.movementCandidate.actions.map((action) => action.actionId))
      .toEqual(['withdrawal-earlier', 'withdrawal-later'])
    expect(result.allocationApplications.map((item) => item.executedAmount))
      .toEqual([5_000, 6_000])
    expect(result.stagedProceeds).toBe(11_000)
    expect(result.sourceBalanceTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceAccountId: firstIra,
          openingBalance: 5_000,
          candidateClosingBalance: 0,
        }),
        expect.objectContaining({
          sourceAccountId: secondIra,
          openingBalance: 6_000,
          candidateClosingBalance: 0,
        }),
      ]),
    )
    const permuted = structuredClone(value) as unknown as
      PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput
    ;(permuted.plan as Plan).strategies.retirementActions.reverse()
    permuted.openingBalances = [...permuted.openingBalances].reverse()
    expect(prepared(permuted)).toEqual(result)
  })

  it('is deterministic, order invariant, input-pure, and deeply frozen', () => {
    const baselineInput = input()
    const before = structuredClone(baselineInput)
    const baseline = prepared(baselineInput)
    expect(baselineInput).toEqual(before)

    const permuted = structuredClone(baselineInput) as unknown as
      PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput
    ;(permuted.plan as Plan).accounts.reverse()
    ;(permuted.plan as Plan).retirementActionEligibilityFacts!
      .iraClassifications.reverse()
    permuted.openingBalances = [...permuted.openingBalances].reverse()
    expect(prepared(permuted)).toEqual(baseline)
    const propertyPermuted = reverseObjectKeys(baselineInput) as
      PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput
    expect(prepared(propertyPermuted)).toEqual(baseline)
    expect(prepared(input()).transactionEvidenceId)
      .toBe(baseline.transactionEvidenceId)
    expect(Object.isFrozen(baseline)).toBe(true)
    expect(Object.isFrozen(baseline.allocationApplications)).toBe(true)
    expect(Object.isFrozen(baseline.allocationApplications[0])).toBe(true)
    expect(Object.isFrozen(baseline.sourceBalanceTransitions[0])).toBe(true)
  })

  it('passes runtime physical activity to the unified annual ledger', () => {
    const value = input()
    value.runtimeRecords = [{
      recordStatus: 'resolved',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      eventId: 'runtime-rmd',
      movementAuthorityId: 'runtime-rmd-authority',
      kind: 'ownedIraRmd',
      origin: 'rmdEngine',
      ownerPersonId: owner,
      sourceAccountId: firstIra,
      grossAmount: asPositiveUsdCents(1_000),
      executionDate: '2030-03-01',
      executionSequence: 1,
      upstreamEvidenceId: 'runtime-rmd-upstream',
    }]
    value.runtimeInventoryAttestation = {
      ...value.runtimeInventoryAttestation,
      resolvedEventIds: ['runtime-rmd'],
    }
    const result = preparePlanOwnedNonRothIraAnnualCandidateTransaction(value)
    expect(result).toMatchObject({
      status: 'requiresUnifiedAnnualLedger',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      transactionEvidenceId: null,
      compatibility: {
        reasons: ['runtimePhysicalActivityPresent'],
      },
    })
  })

  it('fails closed without a Plan-owned action batch', () => {
    const value = input()
    ;(value.plan as Plan).strategies.retirementActions = []
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(value))
      .toMatchObject({
        status: 'requiresUnifiedAnnualLedger',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        transactionEvidenceId: null,
        compatibility: { reasons: ['planOwnedIraActionBatchEmpty'] },
      })
  })

  it('passes unresolved runtime activity through fail-closed', () => {
    const value = input()
    value.runtimeRecords = [{
      recordStatus: 'unresolved',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      activityId: 'legacy-unresolved',
      kind: 'legacyNeedBasedWithdrawal',
      origin: 'legacyProjection',
      knownGrossAmount: asUsdCents(2_500),
      ownerPersonId: null,
      sourceAccountId: null,
      executionDate: null,
      executionSequence: null,
      incompatibility: 'legacyAggregateIdentityUnavailable',
      upstreamEvidenceId: 'legacy-unresolved-upstream',
    }]
    value.runtimeInventoryAttestation = {
      ...value.runtimeInventoryAttestation,
      unresolvedActivityIds: ['legacy-unresolved'],
    }
    const result = preparePlanOwnedNonRothIraAnnualCandidateTransaction(value)
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues.map((issue) => issue.kind)).toContain(
      'unresolvedRuntimeActivity',
    )
  })

  it('fails closed for missing, duplicate, and foreign opening balances', () => {
    const missing = input()
    missing.openingBalances = []
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(missing))
      .toMatchObject({
        status: 'candidateTransactionBlocked',
        issues: [{ kind: 'openingBalanceMissing' }],
      })

    const duplicate = input()
    duplicate.openingBalances = [
      ...duplicate.openingBalances,
      ...duplicate.openingBalances,
    ]
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(duplicate))
      .toMatchObject({ status: 'candidateTransactionBlocked' })
    const foreign = input()
    foreign.openingBalances = [...foreign.openingBalances, {
      accountId: secondIra,
      openingBalance: asUsdCents(1),
    }]
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(foreign))
      .toMatchObject({ status: 'candidateTransactionBlocked' })
  })

  it('fails closed for missing or duplicate IRA classification', () => {
    const missing = input()
    const missingFacts = (missing.plan as Plan)
      .retirementActionEligibilityFacts!
    missingFacts.iraClassifications =
      missingFacts.iraClassifications.slice(1)
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(missing))
      .toMatchObject({
        status: 'candidateTransactionBlocked',
        issues: [{ kind: 'iraClassificationMissing' }],
      })

    const duplicate = input()
    const duplicateFacts = (duplicate.plan as Plan)
      .retirementActionEligibilityFacts!
    const classification = duplicateFacts.iraClassifications[0]!
    duplicateFacts.iraClassifications = [
      classification,
      { ...classification, evidenceId: 'duplicate' },
    ]
    const duplicateResult =
      preparePlanOwnedNonRothIraAnnualCandidateTransaction(duplicate)
    expect(duplicateResult.status)
      .toBe('annualPhysicalEventInventoryIncomplete')
    expect(duplicateResult.issues.every((issue) => issue.kind === 'planInvalid'))
      .toBe(true)
  })

  it('passes conversion and non-owned sources to the unified ledger', () => {
    const valuePlan = plan()
    const employerId = asAccountId('employer-plan')
    valuePlan.accounts.push(
      traditionalAccount(employerId, 100, owner, 'employer'),
    )
    const base = valuePlan.strategies.retirementActions[0]!
    if (base.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    valuePlan.strategies.retirementActions.push({
      ...base,
      actionId: asActionId('employer-withdrawal'),
      executionDate: '2030-07-01',
      requestedAmount: asPositiveUsdCents(1_000),
      allocations: [{
        allocationId: asAllocationId('employer-allocation'),
        sourceAccountId: employerId,
        requestedAmount: asPositiveUsdCents(1_000),
      }],
    })
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(
      input(10_000, valuePlan),
    )).toMatchObject({
      status: 'requiresUnifiedAnnualLedger',
      compatibility: { reasons: ['nonOwnedIraPlanActionPresent'] },
    })
  })

  it('returns chronology failures without staging a transaction', () => {
    const valuePlan = plan()
    const base = valuePlan.strategies.retirementActions[0]!
    if (base.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    valuePlan.strategies.retirementActions.push({
      ...base,
      actionId: asActionId('colliding-withdrawal'),
      allocations: [{
        ...base.allocations[0]!,
        allocationId: asAllocationId('colliding-allocation'),
      }],
    })
    const result = preparePlanOwnedNonRothIraAnnualCandidateTransaction(
      input(20_000, valuePlan),
    )
    expect(result.status).toBe('annualPhysicalEventChronologyInvalid')
    expect(result).toMatchObject({
      movement: 'notCommitted',
      actionability: 'notEstablished',
      inventoryEvidenceId: null,
    })
  })

  it.each([
    ['inventory evidence', 'runtime-inventory'],
    ['unrequested Plan account', secondIra],
    ['unrequested classification evidence', 'classification-second'],
  ] as const)('rejects a transaction ID colliding with %s', (_label, target) => {
    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId')
      .mockImplementation((prefix, parts) =>
        prefix === 'owned-ira-plan-annual-candidate-transaction'
          ? target
          : original(prefix, parts))
    try {
      expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(input()))
        .toMatchObject({
          status: 'candidateTransactionBlocked',
          movement: 'notCommitted',
          transactionEvidenceId: null,
          issues: [{ kind: 'identifierCollision' }],
        })
    } finally {
      spy.mockRestore()
    }
  })

  it.each([
    ['unrequested Plan account', secondIra],
    ['unrequested classification evidence', 'classification-second'],
  ] as const)(
    'rejects runtime inventory evidence colliding with %s',
    (_label, target) => {
      const value = input()
      value.runtimeInventoryAttestation = {
        ...value.runtimeInventoryAttestation,
        evidenceId: target,
      }
      expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(value))
        .toMatchObject({
          status: 'candidateTransactionBlocked',
          movement: 'notCommitted',
          transactionEvidenceId: null,
          issues: [{ kind: 'identifierCollision' }],
        })
    },
  )

  it('rejects the inventory ledger-run ID colliding with Plan evidence', () => {
    const value = input()
    ;(value.plan as Plan).retirementActionEligibilityFacts!
      .iraClassifications[1]!.evidenceId = value.ledgerRunId
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(value))
      .toMatchObject({
        status: 'candidateTransactionBlocked',
        movement: 'notCommitted',
        transactionEvidenceId: null,
        issues: [{ kind: 'identifierCollision' }],
      })
  })

  it.each([
    'owned-ira-plan-account-ownership',
    'owned-ira-plan-detached-candidate-allocation-upstream',
    'owned-ira-plan-detached-candidate-allocation-application',
    'owned-ira-plan-detached-candidate-source-balance-upstream',
    'owned-ira-plan-detached-candidate-source-balance-transition',
  ])('protects derived %s IDs from complete Plan identifiers', (prefix) => {
    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId')
      .mockImplementation((candidatePrefix, parts) =>
        candidatePrefix === prefix
          ? 'classification-second'
          : original(candidatePrefix, parts))
    try {
      expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(input()))
        .toMatchObject({
          status: 'candidateTransactionBlocked',
          movement: 'notCommitted',
          transactionEvidenceId: null,
          issues: expect.arrayContaining([
            expect.objectContaining({ kind: 'identifierCollision' }),
          ]),
        })
    } finally {
      spy.mockRestore()
    }
  })

  it('protects the staged movement-candidate ID from complete Plan identifiers', () => {
    const baseline = prepared(input())
    const value = input()
    ;(value.plan as Plan).retirementActionEligibilityFacts!
      .iraClassifications[1]!.evidenceId =
        baseline.movementCandidate.movementCandidateId
    expect(preparePlanOwnedNonRothIraAnnualCandidateTransaction(value))
      .toMatchObject({
        status: 'candidateTransactionBlocked',
        movement: 'notCommitted',
        transactionEvidenceId: null,
        issues: [{ kind: 'identifierCollision' }],
      })
  })

  it('publishes projections structurally compatible with a later PR105 snapshot', () => {
    const result = prepared(input())
    const snapshotApplications = result.allocationApplications.map((item) => ({
      actionId: item.actionId,
      allocationId: item.allocationId,
      sourceAccountId: item.sourceAccountId,
      scheduledDate: item.scheduledDate,
      scheduledSequence: item.scheduledSequence,
      requestedAmount: item.requestedAmount,
      balanceBefore: item.balanceBefore,
      executedAmount: item.executedAmount,
      unexecutedAmount: item.unexecutedAmount,
      candidateBalanceAfter: item.candidateBalanceAfter,
      applicationEvidenceId: item.applicationEvidenceId,
      upstreamEvidenceId: item.upstreamEvidenceId,
    }))
    expect(snapshotApplications).toEqual(
      result.movementCandidate.actions.flatMap((action) =>
        action.allocations.map((allocation) => ({
          actionId: action.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          scheduledDate: action.executionDate,
          scheduledSequence: action.executionSequence,
          requestedAmount: allocation.requestedAmount,
          balanceBefore: allocation.balanceBefore,
          executedAmount: allocation.executedAmount,
          unexecutedAmount: allocation.unexecutedAmount,
          candidateBalanceAfter: allocation.candidateBalanceAfter,
          applicationEvidenceId:
            snapshotApplications.find((item) =>
              item.actionId === action.actionId &&
              item.allocationId === allocation.allocationId)!
              .applicationEvidenceId,
          upstreamEvidenceId:
            snapshotApplications.find((item) =>
              item.actionId === action.actionId &&
              item.allocationId === allocation.allocationId)!
              .upstreamEvidenceId,
        }))),
    )
    const snapshotBalances = result.sourceBalanceTransitions.map((item) => ({
      sourceAccountId: item.sourceAccountId,
      ownerPersonId: item.ownerPersonId,
      openingBalance: item.openingBalance,
      requestedAmount: item.requestedAmount,
      executedAmount: item.executedAmount,
      unexecutedAmount: item.unexecutedAmount,
      candidateClosingBalance: item.candidateClosingBalance,
      evidenceId: item.evidenceId,
      upstreamEvidenceId: item.upstreamEvidenceId,
    }))
    expect(snapshotBalances.map((item) => ({
      sourceAccountId: item.sourceAccountId,
      ownerPersonId: item.ownerPersonId,
      openingBalance: item.openingBalance,
      requestedAmount: item.requestedAmount,
      executedAmount: item.executedAmount,
      unexecutedAmount: item.unexecutedAmount,
      candidateClosingBalance: item.candidateClosingBalance,
    }))).toEqual(result.movementCandidate.candidateBalances)
    expect(snapshotBalances.every((item) =>
      item.evidenceId.length > 0 && item.upstreamEvidenceId.length > 0,
    )).toBe(true)
    expect(snapshotApplications.every((item) =>
      item.applicationEvidenceId.length > 0 &&
      item.upstreamEvidenceId.length > 0,
    )).toBe(true)
    expect(new Set([
      ...snapshotApplications.flatMap((item) => [
        item.applicationEvidenceId,
        item.upstreamEvidenceId,
      ]),
      ...snapshotBalances.flatMap((item) => [
        item.evidenceId,
        item.upstreamEvidenceId,
      ]),
    ]).size).toBe(
      snapshotApplications.length * 2 + snapshotBalances.length * 2,
    )
  })
})
