import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type ResolvedAnnualRetirementPhysicalEventRecord,
  type UnresolvedAnnualRetirementPhysicalActivityRecord,
} from './annualRetirementPhysicalEventInventory.js'

const ownerPersonId = asPersonId('p1')
const spousePersonId = asPersonId('p2')
const ownedIraId = asAccountId('ira-owned')
const siblingIraId = asAccountId('ira-sibling')
const employerId = asAccountId('plan-employer')
const inheritedId = asAccountId('ira-inherited')
const rothId = asAccountId('roth-destination')

function basePlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01' })
  plan.id = asPlanId('plan-annual-inventory')
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
  ]
  plan.strategies.retirementActions = [{
    actionId: asActionId('withdrawal-plan'),
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 20,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'manual' },
    personId: ownerPersonId,
    allocations: [{
      allocationId: asAllocationId('withdrawal-plan-allocation'),
      sourceAccountId: ownedIraId,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return plan
}

function resolved(
  overrides: Partial<ResolvedAnnualRetirementPhysicalEventRecord> = {},
): ResolvedAnnualRetirementPhysicalEventRecord {
  return {
    recordStatus: 'resolved',
    planId: asPlanId('plan-annual-inventory'),
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
    executionSequence: 10,
    upstreamEvidenceId: 'runtime-rmd-upstream',
    ...overrides,
  }
}

function unresolved(): UnresolvedAnnualRetirementPhysicalActivityRecord {
  return {
    recordStatus: 'unresolved',
    planId: asPlanId('plan-annual-inventory'),
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
  runtimeRecords: BuildAnnualRetirementPhysicalEventInventoryInput['runtimeRecords'] = [],
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

function built(
  value: BuildAnnualRetirementPhysicalEventInventoryInput = input(),
) {
  const result = buildAnnualRetirementPhysicalEventInventory(value)
  expect(result.status).toBe('annualPhysicalEventInventoryBuilt')
  if (result.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error(`Expected built inventory, got ${result.status}`)
  }
  return result
}

function issueKinds(
  value: BuildAnnualRetirementPhysicalEventInventoryInput,
): string[] {
  return buildAnnualRetirementPhysicalEventInventory(value).issues.map(
    (issue) => issue.kind,
  )
}

describe('buildAnnualRetirementPhysicalEventInventory', () => {
  it('derives an isolated Plan-owned IRA batch and proves standalone compatibility', () => {
    const result = built()

    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
    expect(result.planOwnedIraActionIds).toEqual(['withdrawal-plan'])
    expect(result.compatibility).toEqual({
      status: 'standaloneOwnedIraExecutorCompatible',
      ownerPersonId,
      planOwnedIraActionIds: ['withdrawal-plan'],
    })
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      origin: 'planAction',
      actionId: 'withdrawal-plan',
      allocationId: 'withdrawal-plan-allocation',
      sourceAccountId: ownedIraId,
      grossAmount: 10_000,
      eventDate: '2030-06-15',
      eventSequence: 20,
      form8606Category: 'line7DistributionCandidate',
    })
    expect(result.events[0]!.eventId).toMatch(
      /^annual-retirement-plan-event:[0-9a-f]{64}$/,
    )
    expect(result.inventoryEvidenceId).toMatch(
      /^annual-retirement-physical-event-inventory:[0-9a-f]{64}$/,
    )
    expect(result.runtimeInventoryUpstreamEvidenceId).toBe(
      'runtime-inventory-upstream',
    )
    expect(result.ownedIraPools).toHaveLength(1)
    expect(result.ownedIraPools[0]).toMatchObject({
      ownerPersonId,
      sourceAccountIds: [ownedIraId, siblingIraId],
      grossAmount: 10_000,
    })
    expect(
      result.ownedIraPools[0]!.line7DistributionCandidate.grossAmount,
    ).toBe(10_000)
  })

  it('binds runtime inventory upstream lineage into the result and structural ID', () => {
    const original = input()
    const changed = input()
    changed.runtimeInventoryAttestation = {
      ...changed.runtimeInventoryAttestation,
      upstreamEvidenceId: 'runtime-inventory-upstream-rebuilt',
    }

    const originalResult = built(original)
    const changedResult = built(changed)
    expect(changedResult.runtimeInventoryUpstreamEvidenceId).toBe(
      'runtime-inventory-upstream-rebuilt',
    )
    expect(changedResult.inventoryEvidenceId).not.toBe(
      originalResult.inventoryEvidenceId,
    )

    const collision = input(basePlan(), [resolved({
      eventId: 'runtime-inventory-upstream',
    })])
    expect(issueKinds(collision)).toContain('identifierCollision')
  })

  it('globally orders Plan and runtime events and requires a unified ledger', () => {
    const result = built(input(basePlan(), [resolved()]))

    expect(result.events.map((event) => event.eventId)).toEqual([
      'runtime-rmd-event',
      expect.stringMatching(/^annual-retirement-plan-event:/),
    ])
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['runtimePhysicalActivityPresent'],
    })
    expect(result.ownedIraPools[0]!.grossAmount).toBe(15_000)
    expect(
      result.ownedIraPools[0]!.line7DistributionCandidate.events,
    ).toHaveLength(2)
  })

  it('permits one runtime movement authority to span multiple source events', () => {
    const first = resolved()
    const second = resolved({
      eventId: 'runtime-rmd-sibling-event',
      sourceAccountId: siblingIraId,
      upstreamEvidenceId: 'runtime-rmd-sibling-upstream',
    })

    const result = built(input(basePlan(), [second, first]))
    expect(result.events.slice(0, 2).map((event) => event.eventId)).toEqual([
      'runtime-rmd-event',
      'runtime-rmd-sibling-event',
    ])
    expect(result.ownedIraPools[0]!.grossAmount).toBe(20_000)

    const reusedUpstream = {
      ...second,
      upstreamEvidenceId: first.upstreamEvidenceId,
    }
    expect(issueKinds(input(basePlan(), [first, reusedUpstream]))).toContain(
      'identifierCollision',
    )
  })

  it.each([
    ['owner', { ownerPersonId: spousePersonId }],
    ['kind/origin', {
      kind: 'automaticSeppDistribution' as const,
      origin: 'seppEngine' as const,
    }],
    ['origin', { origin: 'transferLedger' as const }],
    ['date', { executionDate: '2030-03-02' }],
    ['sequence', { executionSequence: 11 }],
  ])(
    'rejects movement-authority reuse with a different %s binding',
    (_label, bindingOverride) => {
      const second = resolved({
        eventId: 'runtime-authority-conflict-event',
        sourceAccountId: siblingIraId,
        upstreamEvidenceId: 'runtime-authority-conflict-upstream',
        ...bindingOverride,
      })
      expect(issueKinds(input(basePlan(), [resolved(), second]))).toContain(
        'movementAuthorityBindingMismatch',
      )
    },
  )

  it('rejects duplicate source members under one movement authority', () => {
    const duplicateSource = resolved({
      eventId: 'runtime-duplicate-source-event',
      upstreamEvidenceId: 'runtime-duplicate-source-upstream',
    })
    expect(issueKinds(
      input(basePlan(), [resolved(), duplicateSource]),
    )).toContain('movementAuthorityBindingMismatch')
  })

  it.each([
    ['ownedIraContribution', ownedIraId],
    ['ownedIraEmployerContribution', siblingIraId],
    ['employerPlanEmployeeContribution', employerId],
    ['employerPlanEmployerMatch', employerId],
  ] as const)(
    'inventories explicit %s inflows and prevents standalone execution',
    (kind, sourceAccountId) => {
      const plan = basePlan()
      plan.retirementActionEligibilityFacts = {
        iraClassifications: [{
          sourceAccountId: siblingIraId,
          subtype: 'sep',
          evidenceId: 'sibling-sep-classification',
          provenance: { source: 'manual' },
        }],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      }
      const result = built(input(plan, [resolved({
        kind,
        origin: 'contributionLedger',
        sourceAccountId,
      })]))

      expect(result.compatibility).toEqual({
        status: 'requiresUnifiedAnnualLedger',
        reasons: ['runtimePhysicalActivityPresent'],
      })
      expect(result.events[0]).toMatchObject({
        kind,
        origin: 'contributionLedger',
        form8606Category: 'nonForm8606OrForeignPoolEvent',
      })
    },
  )

  it('rejects contribution and employer-match inflows from the wrong source class', () => {
    expect(issueKinds(input(basePlan(), [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
      sourceAccountId: employerId,
    })]))).toContain('sourceKindMismatch')
    expect(issueKinds(input(basePlan(), [resolved({
      kind: 'ownedIraEmployerContribution',
      origin: 'contributionLedger',
      sourceAccountId: ownedIraId,
    })]))).toContain('sourceKindMismatch')
    expect(issueKinds(input(basePlan(), [resolved({
      kind: 'employerPlanEmployerMatch',
      origin: 'contributionLedger',
      sourceAccountId: ownedIraId,
    })]))).toContain('sourceKindMismatch')
  })

  it('requires inherited RMD activity to come from an inherited IRA', () => {
    const plan = basePlan()
    const employer = plan.accounts.find((account) => account.id === employerId)
    if (employer?.type !== 'traditional') throw new Error('fixture drift')
    employer.inherited = {
      ownerDeathYear: 2028,
      decedentHadStartedRmds: true,
    }
    expect(issueKinds(input(plan, [resolved({
      kind: 'inheritedIraRmd',
      sourceAccountId: employerId,
    })]))).toContain('sourceKindMismatch')
  })

  it('classifies Plan conversion, QCD, and foreign-pool events provisionally', () => {
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
      {
        actionId: asActionId('employer-withdrawal'),
        kind: 'ordinaryWithdrawal',
        year: 2030,
        executionDate: '2030-05-03',
        executionSequence: 1,
        requestedAmount: asPositiveUsdCents(2_000),
        provenance: { source: 'manual' },
        personId: ownerPersonId,
        allocations: [{
          allocationId: asAllocationId('employer-allocation'),
          sourceAccountId: employerId,
          requestedAmount: asPositiveUsdCents(2_000),
        }],
        purpose: { kind: 'spending' },
      },
    ]

    const result = built(input(plan))
    expect(result.events.map((event) => event.form8606Category)).toEqual([
      'line8ConversionCandidate',
      'qcdCandidateAwaitingAnnualQcdStage',
      'nonForm8606OrForeignPoolEvent',
    ])
    expect(result.planOwnedIraActionIds).toEqual([
      'conversion-plan',
      'qcd-plan',
    ])
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: [
        'planConversionOrQcdPresent',
        'nonOwnedIraPlanActionPresent',
      ],
    })
  })

  it('expands every source allocation but permits one action to share its chronology slot', () => {
    const plan = basePlan()
    const action = plan.strategies.retirementActions[0]
    if (action?.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    action.requestedAmount = asPositiveUsdCents(15_000)
    action.allocations.push({
      allocationId: asAllocationId('withdrawal-sibling-allocation'),
      sourceAccountId: siblingIraId,
      requestedAmount: asPositiveUsdCents(5_000),
    })

    const result = built(input(plan))
    expect(result.events).toHaveLength(2)
    expect(result.ownedIraPools[0]!.grossAmount).toBe(15_000)
    expect(result.planOwnedIraActionIds).toEqual(['withdrawal-plan'])
  })

  it.each([
    ['employerPlanRmd', 'rmdEngine', employerId],
    ['inheritedIraRmd', 'rmdEngine', inheritedId],
    ['automaticSeppDistribution', 'seppEngine', ownedIraId],
    ['legacyNeedBasedWithdrawal', 'legacyProjection', ownedIraId],
    ['legacyRothConversion', 'legacyProjection', employerId],
    ['legacyQcd', 'legacyProjection', inheritedId],
    ['annuityFundingTransfer', 'transferLedger', ownedIraId],
    ['tipsFundingTransfer', 'transferLedger', employerId],
    ['rolloverInflow', 'transferLedger', ownedIraId],
    ['otherTraditionalTransfer', 'transferLedger', inheritedId],
  ] as const)(
    'accepts exact %s runtime records from compatible sources',
    (kind, origin, sourceAccountId) => {
      const record = resolved({ kind, origin, sourceAccountId })
      expect(
        buildAnnualRetirementPhysicalEventInventory(
          input(basePlan(), [record]),
        ).status,
      ).toBe('annualPhysicalEventInventoryBuilt')
    },
  )

  it('fails closed on unresolved activity without fabricating owner, source, or date', () => {
    const result = buildAnnualRetirementPhysicalEventInventory(
      input(basePlan(), [unresolved()]),
    )

    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.compatibility.status).toBe('inventoryIncomplete')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'unresolvedRuntimeActivity',
      recordId: 'legacy-unresolved',
    }))
    expect(result.events).toBeNull()
  })

  it('requires the attestation to cover the exact record sets', () => {
    const value = input(basePlan(), [resolved()])
    value.runtimeInventoryAttestation = {
      ...value.runtimeInventoryAttestation,
      resolvedEventIds: [],
    }
    expect(issueKinds(value)).toContain('runtimeInventoryUnexpectedRecord')

    const omitted = input()
    omitted.runtimeInventoryAttestation = {
      ...omitted.runtimeInventoryAttestation,
      resolvedEventIds: ['missing-runtime-event'],
    }
    expect(issueKinds(omitted)).toContain('runtimeInventoryOmission')
  })

  it('distinguishes invalid attestation shape from a valid wrong binding', () => {
    const invalid = input()
    invalid.runtimeInventoryAttestation = {
      ...invalid.runtimeInventoryAttestation,
      ledgerRunId: ' ',
    }
    expect(issueKinds(invalid)).toEqual(['attestationInvalid'])

    const wrongBinding = input()
    wrongBinding.runtimeInventoryAttestation = {
      ...wrongBinding.runtimeInventoryAttestation,
      planId: asPlanId('different-plan'),
    }
    expect(issueKinds(wrongBinding)).toEqual(['attestationBindingMismatch'])
  })

  it('fails closed on foreign bindings, wrong account classes, and wrong origins', () => {
    const wrongOwner = input(basePlan(), [resolved({
      ownerPersonId: spousePersonId,
    })])
    expect(issueKinds(wrongOwner)).toContain('ownerForeignToPlan')

    const wrongSource = input(basePlan(), [resolved({
      sourceAccountId: asAccountId('foreign-source'),
    })])
    expect(issueKinds(wrongSource)).toContain('sourceForeignToPlan')

    const wrongClass = input(basePlan(), [resolved({
      kind: 'employerPlanRmd',
      sourceAccountId: ownedIraId,
    })])
    expect(issueKinds(wrongClass)).toContain('sourceKindMismatch')

    const wrongOrigin = input(basePlan(), [resolved({
      origin: 'transferLedger',
    })])
    expect(issueKinds(wrongOrigin)).toContain('runtimeEventOriginMismatch')
  })

  it('does not invent a December 31 date for an undated Plan action', () => {
    const plan = basePlan()
    const action = plan.strategies.retirementActions[0]
    if (action?.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    delete action.executionDate

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan))
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'planActionExecutionDateMissing',
      actionId: 'withdrawal-plan',
    }))
  })

  it('does not silently omit identity-free legacy Plan actions', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [{
      actionId: asActionId('legacy-withdrawal-plan'),
      kind: 'legacyAggregateWithdrawal',
      year: 2030,
      requestedAmount: asPositiveUsdCents(5_000),
      provenance: { source: 'migration' },
      legacyCategory: 'traditional',
    }]

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan))
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'legacyPlanActionUnresolved',
      actionId: 'legacy-withdrawal-plan',
    }))
  })

  it('rejects invalid dates and chronology slots shared by different authorities', () => {
    const invalidDate = input(basePlan(), [resolved({
      executionDate: '2030-02-30',
    })])
    expect(
      buildAnnualRetirementPhysicalEventInventory(invalidDate).status,
    ).toBe('annualPhysicalEventChronologyInvalid')

    const conflict = input(basePlan(), [resolved({
      executionDate: '2030-06-15',
      executionSequence: 20,
    })])
    const result = buildAnnualRetirementPhysicalEventInventory(conflict)
    expect(result.status).toBe('annualPhysicalEventChronologyInvalid')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'chronologyConflict',
    }))
  })

  it('rejects cross-kind identifier collisions and aggregate overflow', () => {
    const collision = input(basePlan(), [resolved({
      eventId: 'runtime-inventory-evidence',
    })])
    expect(issueKinds(collision)).toContain('identifierCollision')

    const first = resolved({
      eventId: 'huge-one',
      movementAuthorityId: 'huge-authority-one',
      upstreamEvidenceId: 'huge-upstream-one',
      grossAmount: asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
      executionDate: '2030-01-01',
      executionSequence: 1,
    })
    const second = resolved({
      eventId: 'huge-two',
      movementAuthorityId: 'huge-authority-two',
      upstreamEvidenceId: 'huge-upstream-two',
      grossAmount: asPositiveUsdCents(1),
      executionDate: '2030-01-02',
      executionSequence: 1,
    })
    expect(issueKinds(input(basePlan(), [first, second]))).toContain(
      'aggregateAmountOverflow',
    )
  })

  it('is permutation-invariant and deep-detached/frozen', () => {
    const one = resolved({
      eventId: 'runtime-one',
      movementAuthorityId: 'authority-one',
      upstreamEvidenceId: 'upstream-one',
      executionDate: '2030-01-02',
    })
    const two = resolved({
      eventId: 'runtime-two',
      movementAuthorityId: 'authority-two',
      upstreamEvidenceId: 'upstream-two',
      executionDate: '2030-01-01',
    })
    const forward = input(basePlan(), [one, two])
    const reverse = input(basePlan(), [two, one])
    reverse.runtimeInventoryAttestation = {
      ...reverse.runtimeInventoryAttestation,
      resolvedEventIds: ['runtime-two', 'runtime-one'],
    }
    const forwardResult = built(forward)
    const reverseResult = built(reverse)

    expect(reverseResult).toEqual(forwardResult)
    expect(Object.isFrozen(forwardResult)).toBe(true)
    expect(Object.isFrozen(forwardResult.events)).toBe(true)
    expect(Object.isFrozen(forwardResult.ownedIraPools[0])).toBe(true)

    one.grossAmount = asPositiveUsdCents(999)
    ;(forward.plan as Plan).strategies.retirementActions = []
    expect(forwardResult.events.map((event) => event.grossAmount)).toEqual([
      5_000,
      5_000,
      10_000,
    ])
  })

  it('canonicalizes invalid and unresolved diagnostics across record permutations', () => {
    const collisionOne = resolved({
      eventId: 'collision-a',
      movementAuthorityId: 'collision-authority-a',
      upstreamEvidenceId: 'shared-collision-upstream',
      executionDate: '2030-01-01',
    })
    const collisionTwo = resolved({
      eventId: 'collision-b',
      movementAuthorityId: 'collision-authority-b',
      upstreamEvidenceId: 'shared-collision-upstream',
      executionDate: '2030-01-02',
    })
    const collisionForward = buildAnnualRetirementPhysicalEventInventory(
      input(basePlan(), [collisionOne, collisionTwo]),
    )
    const collisionReverse = buildAnnualRetirementPhysicalEventInventory(
      input(basePlan(), [collisionTwo, collisionOne]),
    )
    expect(collisionReverse).toEqual(collisionForward)
    expect(collisionForward.issues).toContainEqual(expect.objectContaining({
      kind: 'identifierCollision',
      recordId: 'collision-b',
    }))

    const unresolvedOne = unresolved()
    const unresolvedTwo: UnresolvedAnnualRetirementPhysicalActivityRecord = {
      ...unresolved(),
      activityId: 'another-unresolved',
      kind: 'legacyRothConversion',
      knownGrossAmount: asUsdCents(1_500),
      incompatibility: 'sourceAllocationUnavailable',
      upstreamEvidenceId: 'another-unresolved-upstream',
    }
    const unresolvedForward = buildAnnualRetirementPhysicalEventInventory(
      input(basePlan(), [unresolvedOne, unresolvedTwo]),
    )
    const unresolvedReverse = buildAnnualRetirementPhysicalEventInventory(
      input(basePlan(), [unresolvedTwo, unresolvedOne]),
    )
    expect(unresolvedReverse).toEqual(unresolvedForward)
  })

  it('lets validated Plan ownership reject ownerless and mismatched sources', () => {
    const ownerless = basePlan()
    const ownerlessAccount = ownerless.accounts.find(
      (account) => account.id === ownedIraId,
    )
    if (ownerlessAccount?.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    ownerlessAccount.ownerPersonId = null
    const ownerlessResult = buildAnnualRetirementPhysicalEventInventory(
      input(ownerless),
    )
    expect(ownerlessResult.status).toBe(
      'annualPhysicalEventInventoryIncomplete',
    )
    expect(ownerlessResult.issues.some((candidate) =>
      candidate.kind === 'planInvalid' &&
      candidate.detail.includes('must have an individual owner'),
    )).toBe(true)

    const mismatched = basePlan()
    mismatched.household.people.push({
      ...mismatched.household.people[0]!,
      id: spousePersonId,
      name: 'Spouse',
    })
    const action = mismatched.strategies.retirementActions[0]
    if (action?.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    action.personId = spousePersonId
    const mismatchedResult = buildAnnualRetirementPhysicalEventInventory(
      input(mismatched),
    )
    expect(mismatchedResult.status).toBe(
      'annualPhysicalEventInventoryIncomplete',
    )
    expect(mismatchedResult.issues.some((candidate) =>
      candidate.kind === 'planInvalid' &&
      candidate.detail.includes('owned by a different person'),
    )).toBe(true)
  })

  it('returns typed invalid-plan and invalid-runtime-record failures', () => {
    const invalidPlan = input()
    invalidPlan.plan = { broken: true }
    expect(issueKinds(invalidPlan)).toContain('planInvalid')

    const invalidRecord = input()
    invalidRecord.runtimeRecords = [{
      recordStatus: 'unresolved',
      ownerPersonId: ownerPersonId,
    } as unknown as UnresolvedAnnualRetirementPhysicalActivityRecord]
    expect(issueKinds(invalidRecord)).toContain('runtimeRecordInvalid')
  })
})
