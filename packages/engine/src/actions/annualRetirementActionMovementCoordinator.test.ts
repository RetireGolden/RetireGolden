import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type ResolvedAnnualRetirementPhysicalEventRecord,
  type UnresolvedAnnualRetirementPhysicalActivityRecord,
} from './annualRetirementPhysicalEventInventory.js'
import {
  coordinateAnnualRetirementActionMovement,
} from './annualRetirementActionMovementCoordinator.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'

const ownerPersonId = asPersonId('p1')
const ownedIraId = asAccountId('ira-owned')
const siblingIraId = asAccountId('ira-sibling')
const employerId = asAccountId('plan-employer')
const inheritedId = asAccountId('ira-inherited')
const rothId = asAccountId('roth-destination')
const cashId = asAccountId('cash-source')

function withdrawal(
  actionId: string,
  allocationId: string,
  sourceAccountId: string,
  executionSequence: number,
  executionDate = '2030-06-15',
) {
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal' as const,
    year: 2030,
    executionDate,
    executionSequence,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'manual' as const },
    personId: ownerPersonId,
    allocations: [{
      allocationId: asAllocationId(allocationId),
      sourceAccountId: asAccountId(sourceAccountId),
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' as const },
  }
}

function basePlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  plan.id = asPlanId('plan-annual-movement')
  plan.accounts = [
    traditionalAccount(ownedIraId, 1_000, ownerPersonId),
    traditionalAccount(siblingIraId, 500, ownerPersonId),
    traditionalAccount(employerId, 2_000, ownerPersonId, 'employer'),
    {
      type: 'traditional',
      id: inheritedId,
      name: 'Inherited IRA',
      ownerPersonId,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 700,
      annualContribution: 0,
      inherited: {
        ownerDeathYear: 2028,
        decedentHadStartedRmds: true,
      },
    },
    {
      type: 'roth',
      id: rothId,
      name: 'Roth destination',
      ownerPersonId,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
    cashAccount(cashId, 100),
  ]
  plan.strategies.retirementActions = [
    withdrawal('withdrawal-ten', 'allocation-ten', ownedIraId, 10),
    withdrawal('withdrawal-two', 'allocation-two', siblingIraId, 2),
  ]
  return plan
}

function resolved(
  overrides: Partial<ResolvedAnnualRetirementPhysicalEventRecord> = {},
): ResolvedAnnualRetirementPhysicalEventRecord {
  return {
    recordStatus: 'resolved',
    planId: asPlanId('plan-annual-movement'),
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    eventId: 'runtime-rmd-event',
    movementAuthorityId: 'runtime-rmd-authority',
    kind: 'ownedIraRmd',
    origin: 'rmdEngine',
    ownerPersonId,
    sourceAccountId: ownedIraId,
    grossAmount: asPositiveUsdCents(5_000),
    executionDate: '2030-03-01',
    executionSequence: 1,
    upstreamEvidenceId: 'runtime-rmd-upstream',
    ...overrides,
  }
}

function unresolved(): UnresolvedAnnualRetirementPhysicalActivityRecord {
  return {
    recordStatus: 'unresolved',
    planId: asPlanId('plan-annual-movement'),
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
  }
}

function input(
  plan: Plan = basePlan(),
  runtimeRecords:
    BuildAnnualRetirementPhysicalEventInventoryInput['runtimeRecords'] = [],
): BuildAnnualRetirementPhysicalEventInventoryInput {
  return {
    plan,
    taxYear: 2030,
    runtimeRecords,
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      planId: asPlanId(plan.id),
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      resolvedEventIds: runtimeRecords.flatMap((record) =>
        record.recordStatus === 'resolved' ? [record.eventId] : [],
      ),
      unresolvedActivityIds: runtimeRecords.flatMap((record) =>
        record.recordStatus === 'unresolved' ? [record.activityId] : [],
      ),
      evidenceId: 'runtime-inventory-evidence',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
}

function coordinated(
  value: BuildAnnualRetirementPhysicalEventInventoryInput = input(),
) {
  const result = coordinateAnnualRetirementActionMovement(value)
  expect(result.status).toBe('annualRetirementActionMovementCoordinated')
  if (result.status !== 'annualRetirementActionMovementCoordinated') {
    throw new Error(`Expected coordinated result, got ${result.status}`)
  }
  return result
}

describe('coordinateAnnualRetirementActionMovement', () => {
  it('assigns and orders a standalone owned-IRA batch without moving it', () => {
    const plan = basePlan()
    const result = coordinated(input(plan))

    expect(result).toMatchObject({
      movement: 'notCommitted',
      actionability: 'notEstablished',
      planId: 'plan-annual-movement',
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      compatibility: {
        status: 'standaloneOwnedIraExecutorCompatible',
        ownerPersonId,
        planOwnedIraActionIds: ['withdrawal-ten', 'withdrawal-two'],
      },
    })
    expect(result.orderedEvents.map((event) => [
      event.actionId,
      event.eventSequence,
      event.executorSource,
    ])).toEqual([
      ['withdrawal-two', 2, 'ownedNonRothIraExecutor'],
      ['withdrawal-ten', 10, 'ownedNonRothIraExecutor'],
    ])
    expect(result.assignments).toEqual([
      expect.objectContaining({
        actionId: 'withdrawal-ten',
        executorSource: 'ownedNonRothIraExecutor',
        inventoryCoverage: 'complete',
      }),
      expect.objectContaining({
        actionId: 'withdrawal-two',
        executorSource: 'ownedNonRothIraExecutor',
        inventoryCoverage: 'complete',
      }),
    ])
    expect(result.uninventoriedActionIds).toEqual([])
    expect(result.firstSupportedBatch).toMatchObject({
      predicate: 'standaloneOwnedNonRothIraMovementBatch',
      executorSource: 'ownedNonRothIraExecutor',
      actionIds: ['withdrawal-ten', 'withdrawal-two'],
      eventIds: result.orderedEvents.map((event) => event.eventId),
    })
    expect(result.coordinatorEvidenceId).toMatch(
      /^annual-retirement-action-movement-coordinator:[0-9a-f]{64}$/,
    )
    expect(result.firstSupportedBatch?.evidenceId).toMatch(
      /^standalone-owned-non-roth-ira-movement-batch:[0-9a-f]{64}$/,
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.orderedEvents)).toBe(true)
    expect(Object.isFrozen(result.orderedEvents[0])).toBe(true)

    const permutedPlan = basePlan()
    permutedPlan.accounts.reverse()
    permutedPlan.strategies.retirementActions.reverse()
    expect(coordinated(input(permutedPlan))).toEqual(result)

    plan.strategies.retirementActions.length = 0
    plan.accounts.length = 0
    expect(result.assignments).toHaveLength(2)
    expect(result.orderedEvents).toHaveLength(2)
  })

  it('labels future conversion and QCD executors but exposes no movement batch', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      {
        actionId: asActionId('conversion-plan'),
        kind: 'rothConversion',
        year: 2030,
        executionDate: '2030-05-01',
        executionSequence: 1,
        requestedAmount: asPositiveUsdCents(4_000),
        provenance: { source: 'manual' },
        personId: ownerPersonId,
        allocations: [{
          allocationId: asAllocationId('conversion-allocation'),
          sourceAccountId: ownedIraId,
          requestedAmount: asPositiveUsdCents(4_000),
        }],
        destinationRothAccountId: rothId,
        taxFunding: { kind: 'noneExpected' },
      },
      {
        actionId: asActionId('qcd-plan'),
        kind: 'qcd',
        year: 2030,
        executionDate: '2030-05-02',
        executionSequence: 1,
        requestedAmount: asPositiveUsdCents(3_000),
        provenance: { source: 'manual' },
        donorPersonId: ownerPersonId,
        allocation: {
          allocationId: asAllocationId('qcd-allocation'),
          sourceAccountId: ownedIraId,
          requestedAmount: asPositiveUsdCents(3_000),
        },
        charity: {
          designationId: 'charity-one',
          name: 'Public Charity',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
      },
    ]

    const result = coordinated(input(plan))
    expect(result.assignments.map((assignment) => [
      assignment.actionId,
      assignment.executorSource,
    ])).toEqual([
      ['conversion-plan', 'rothConversionExecutor'],
      ['qcd-plan', 'qcdExecutor'],
    ])
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['planConversionOrQcdPresent'],
    })
    expect(result.firstSupportedBatch).toBeNull()
  })

  it('retains runtime events in chronology without assigning an executor', () => {
    const runtime = resolved()
    const result = coordinated(input(basePlan(), [runtime]))

    expect(result.orderedEvents[0]).toMatchObject({
      eventId: runtime.eventId,
      origin: 'rmdEngine',
      kind: 'ownedIraRmd',
      actionId: null,
      allocationId: null,
      executorSource: null,
    })
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['runtimePhysicalActivityPresent'],
    })
    expect(result.firstSupportedBatch).toBeNull()
  })

  it('never partially assigns employer, inherited, or mixed-source actions', () => {
    const plan = basePlan()
    const mixed = withdrawal(
      'mixed-withdrawal',
      'mixed-ira-allocation',
      ownedIraId,
      3,
    )
    mixed.requestedAmount = asPositiveUsdCents(20_000)
    mixed.allocations.push({
      allocationId: asAllocationId('mixed-cash-allocation'),
      sourceAccountId: cashId,
      requestedAmount: asPositiveUsdCents(10_000),
    })
    plan.strategies.retirementActions = [
      withdrawal(
        'employer-withdrawal',
        'employer-allocation',
        employerId,
        1,
      ),
      withdrawal(
        'inherited-withdrawal',
        'inherited-allocation',
        inheritedId,
        2,
      ),
      mixed,
    ]

    const result = coordinated(input(plan))
    expect(result.assignments.map((assignment) => [
      assignment.actionId,
      assignment.executorSource,
      assignment.inventoryEventIds.length,
    ])).toEqual([
      ['employer-withdrawal', null, 1],
      ['inherited-withdrawal', null, 1],
      ['mixed-withdrawal', null, 1],
    ])
    expect(result.orderedEvents.every((event) =>
      event.executorSource === null,
    )).toBe(true)
    expect(result.firstSupportedBatch).toBeNull()
  })

  it('assigns only the currently supported non-retirement ordinary sources', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      withdrawal('cash-withdrawal', 'cash-allocation', cashId, 1),
    ]

    const result = coordinated(input(plan))
    expect(result.orderedEvents).toEqual([])
    expect(result.assignments).toEqual([expect.objectContaining({
      actionId: 'cash-withdrawal',
      kind: 'ordinaryWithdrawal',
      executorSource: 'ordinaryWithdrawalExecutor',
      inventoryCoverage: 'absent',
      inventoryEventIds: [],
    })])
    expect(result.uninventoriedActionIds).toEqual(['cash-withdrawal'])
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['planOwnedIraActionBatchEmpty'],
    })
    expect(result.firstSupportedBatch).toBeNull()
  })

  it.each([
    ['the same chronology slot', '2030-06-15', 2],
    ['a distinct chronology slot', '2030-07-01', 1],
  ])(
    'withholds the owned-IRA batch when an assigned action is absent from %s',
    (_label, cashDate, cashSequence) => {
      const plan = basePlan()
      plan.strategies.retirementActions = [
        withdrawal(
          'ira-withdrawal',
          'ira-allocation',
          ownedIraId,
          2,
        ),
        withdrawal(
          'cash-withdrawal',
          'cash-allocation',
          cashId,
          cashSequence,
          cashDate,
        ),
      ]

      const result = coordinated(input(plan))
      expect(result.compatibility.status).toBe(
        'standaloneOwnedIraExecutorCompatible',
      )
      expect(result.assignments.map((assignment) => [
        assignment.actionId,
        assignment.executorSource,
        assignment.inventoryCoverage,
      ])).toEqual([
        ['cash-withdrawal', 'ordinaryWithdrawalExecutor', 'absent'],
        ['ira-withdrawal', 'ownedNonRothIraExecutor', 'complete'],
      ])
      expect(result.uninventoriedActionIds).toEqual(['cash-withdrawal'])
      expect(result.firstSupportedBatch).toBeNull()
      expect(result.orderedEvents).toHaveLength(1)
    },
  )

  it('rejects a derived evidence ID colliding with an unused Plan identifier', () => {
    const originalPlan = basePlan()
    const original = coordinated(input(originalPlan))
    const collidingPlan = basePlan()
    const unusedCash = collidingPlan.accounts.find(
      (account) => account.id === cashId,
    )
    if (unusedCash === undefined) throw new Error('fixture drift')
    unusedCash.id = asAccountId(original.coordinatorEvidenceId)

    const result = coordinateAnnualRetirementActionMovement(
      input(collidingPlan),
    )
    expect(result).toMatchObject({
      status: 'annualRetirementActionMovementCoordinationBlocked',
      movement: 'notCommitted',
      actionability: 'notEstablished',
      coordinatorEvidenceId: null,
      firstSupportedBatch: null,
      issues: [{
        kind: 'identifierCollision',
        detail: expect.stringContaining('coordinator evidence ID'),
      }],
    })
  })

  it('passes incomplete and chronology-invalid inventory failures through', () => {
    const incompleteInput = input(basePlan(), [unresolved()])
    expect(coordinateAnnualRetirementActionMovement(incompleteInput)).toEqual(
      buildAnnualRetirementPhysicalEventInventory(incompleteInput),
    )

    const collisionInput = input(basePlan(), [resolved({
      executionDate: '2030-06-15',
      executionSequence: 2,
    })])
    const upstream = buildAnnualRetirementPhysicalEventInventory(collisionInput)
    expect(upstream.status).toBe('annualPhysicalEventChronologyInvalid')
    expect(coordinateAnnualRetirementActionMovement(collisionInput)).toEqual(
      upstream,
    )
  })

  it('keeps an explicitly empty annual inventory visible and nonmoving', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []

    const result = coordinated(input(plan))
    expect(result.orderedEvents).toEqual([])
    expect(result.assignments).toEqual([])
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['planOwnedIraActionBatchEmpty'],
    })
    expect(result.firstSupportedBatch).toBeNull()
  })
})
