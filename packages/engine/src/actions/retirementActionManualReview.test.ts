import { describe, expect, it } from 'vitest'

import {
  retirementActionRequestSchema,
  type RetirementActionRequest,
} from './contract.js'
import {
  asAccountId,
  asActionId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents } from './money.js'
import {
  allocateRetirementActionCandidateIdentity,
  type OrdinaryWithdrawalCandidateIdentityIntent,
  type RothConversionCandidateIdentityIntent,
} from './retirementActionCandidateIdentityAllocator.js'
import {
  reviewAndReplaceRetirementActionManually,
  type RetirementActionManualReviewInput,
} from './retirementActionManualReview.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'

function ownedCash(id: string, ownerPersonId = 'p1'): Account {
  return { ...cashAccount(id, 1_000), ownerPersonId }
}

function ownedRoth(id: string, ownerPersonId = 'p1'): Account {
  return {
    id,
    name: id,
    type: 'roth',
    kind: 'ira',
    ownerPersonId,
    balance: 0,
    annualContribution: 0,
    annualReturnPct: 0,
  }
}

function basePlan(): Plan {
  const plan = singlePersonPlan({ planningAge: 100 })
  plan.accounts = [
    ownedCash('cash-a'),
    traditionalAccount('traditional-a', 1_000, 'p1'),
    ownedRoth('roth-a'),
  ]
  return plan
}

function action(value: unknown): RetirementActionRequest {
  return retirementActionRequestSchema.parse(value)
}

function legacyWithdrawal(actionId = 'legacy-withdrawal'): RetirementActionRequest {
  return action({
    actionId,
    kind: 'legacyAggregateWithdrawal',
    year: 2030,
    requestedAmount: 10_000,
    legacyCategory: 'cash',
    provenance: { source: 'migration', sourceId: 'v1-withdrawal' },
  })
}

function legacyConversion(actionId = 'legacy-conversion'): RetirementActionRequest {
  return action({
    actionId,
    kind: 'legacyAggregateRothConversion',
    year: 2030,
    requestedAmount: 20_000,
    provenance: { source: 'migration', sourceId: 'v1-conversion' },
  })
}

function ordinaryIntent(
  overrides: Partial<OrdinaryWithdrawalCandidateIdentityIntent> = {},
): OrdinaryWithdrawalCandidateIdentityIntent {
  return {
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(10_000),
    personId: asPersonId('p1'),
    provenance: { source: 'manual', sourceId: 'manual-review' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('cash-a'),
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
    ...overrides,
  }
}

function conversionIntent(
  overrides: Partial<RothConversionCandidateIdentityIntent> = {},
): RothConversionCandidateIdentityIntent {
  return {
    kind: 'rothConversion',
    year: 2030,
    executionDate: '2030-09-01',
    executionSequence: 2,
    requestedAmount: asPositiveUsdCents(20_000),
    personId: asPersonId('p1'),
    provenance: { source: 'manual', sourceId: 'manual-review' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('traditional-a'),
      requestedAmount: asPositiveUsdCents(20_000),
    }],
    destinationRothAccountId: asAccountId('roth-a'),
    taxFunding: { kind: 'noneExpected' },
    ...overrides,
  }
}

function review(
  plan: Plan,
  targetActionId: string,
  replacementIntent?: RetirementActionManualReviewInput['replacementIntent'],
) {
  return reviewAndReplaceRetirementActionManually({
    plan,
    targetActionId: asActionId(targetActionId),
    ...(replacementIntent === undefined ? {} : { replacementIntent }),
  })
}

function issueKinds(result: ReturnType<typeof review>): string[] {
  return result.status === 'replacementReady'
    ? []
    : result.issues.map((entry) => entry.kind)
}

describe('manual retirement-action review and replacement', () => {
  it('replaces a migrated withdrawal from explicit manual identities without mutating input', () => {
    const plan = basePlan()
    const before = structuredClone(plan)
    plan.strategies.retirementActions = [legacyWithdrawal()]
    const scheduledBefore = structuredClone(plan.strategies.retirementActions)

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    expect(result.status).toBe('replacementReady')
    if (result.status !== 'replacementReady') return
    expect(result.target).toEqual(legacyWithdrawal())
    expect(result.replacement).toMatchObject({
      kind: 'ordinaryWithdrawal',
      year: 2030,
      requestedAmount: 10_000,
      personId: 'p1',
      provenance: { source: 'manual', sourceId: 'manual-review' },
      allocations: [{ sourceAccountId: 'cash-a', requestedAmount: 10_000 }],
    })
    expect(result.plan.strategies.retirementActions).toEqual([result.replacement])
    expect(result.evidence).toMatchObject({
      policy: 'explicitManualIntentOmitTargetThenCanonicalAllocate',
      targetOmittedBeforeAllocation: true,
      inferredFields: [],
      target: {
        actionId: 'legacy-withdrawal',
        kind: 'legacyAggregateWithdrawal',
        provenanceSource: 'migration',
        provenance: { source: 'migration', sourceId: 'v1-withdrawal' },
        originalPlanIndex: 0,
        request: legacyWithdrawal(),
      },
      replacementProvenance: { source: 'manual', sourceId: 'manual-review' },
      allocatorEvidence: { policy: 'explicitStablePlanIdsOnly' },
    })
    expect(plan.strategies.retirementActions).toEqual(scheduledBefore)
    expect({ ...plan, strategies: before.strategies }).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.plan)).toBe(true)
  })

  it('omits a manual target before canonical allocation so identical stable IDs can replace it', () => {
    const plan = basePlan()
    const intent = ordinaryIntent()
    const allocated = allocateRetirementActionCandidateIdentity(plan, intent)
    expect(allocated.status).toBe('allocated')
    if (allocated.status !== 'allocated') return
    plan.strategies.retirementActions = [allocated.request]

    const result = review(plan, allocated.request.actionId, intent)

    expect(result.status).toBe('replacementReady')
    if (result.status !== 'replacementReady') return
    expect(result.replacement.actionId).toBe(allocated.request.actionId)
    expect(result.replacement.allocations).toEqual(allocated.request.allocations)
    expect(result.evidence.targetOmittedBeforeAllocation).toBe(true)
    expect(result.evidence.target.request).toEqual(allocated.request)
  })

  it('replaces migrated conversion identity without choosing a source or destination', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyConversion()]

    const result = review(plan, 'legacy-conversion', conversionIntent())

    expect(result.status).toBe('replacementReady')
    if (result.status !== 'replacementReady') return
    expect(result.replacement).toMatchObject({
      kind: 'rothConversion',
      personId: 'p1',
      destinationRothAccountId: 'roth-a',
      allocations: [{ sourceAccountId: 'traditional-a' }],
    })
    expect(result.evidence.allocatorEvidence).toMatchObject({
      personId: 'p1',
      sourceAccountIds: ['traditional-a'],
      destinationRothAccountId: 'roth-a',
    })
  })

  it('binds complete replacement provenance into the review evidence ID', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]

    const baseline = review(plan, 'legacy-withdrawal', ordinaryIntent())
    const changedSource = review(plan, 'legacy-withdrawal', ordinaryIntent({
      provenance: { source: 'manual', sourceId: 'other-review' },
    }))
    const changedScenario = review(plan, 'legacy-withdrawal', ordinaryIntent({
      provenance: {
        source: 'manual',
        sourceId: 'manual-review',
        scenarioId: 'scenario-a',
      },
    }))

    expect(baseline.status).toBe('replacementReady')
    expect(changedSource.status).toBe('replacementReady')
    expect(changedScenario.status).toBe('replacementReady')
    if (
      baseline.status !== 'replacementReady' ||
      changedSource.status !== 'replacementReady' ||
      changedScenario.status !== 'replacementReady'
    ) return
    expect(changedSource.replacement.actionId).toBe(baseline.replacement.actionId)
    expect(changedScenario.replacement.actionId).toBe(baseline.replacement.actionId)
    expect(changedSource.evidence.replacementProvenance).toEqual({
      source: 'manual',
      sourceId: 'other-review',
    })
    expect(changedScenario.evidence.replacementProvenance).toEqual({
      source: 'manual',
      sourceId: 'manual-review',
      scenarioId: 'scenario-a',
    })
    expect(changedSource.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
    expect(changedScenario.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
  })

  it.each(['legacyAggregateQcd', 'qcd'] as const)(
    'keeps %s explicit, unsupported, and non-mutating until a canonical QCD allocator exists',
    (kind) => {
      const plan = basePlan()
      const qcd = kind === 'legacyAggregateQcd'
        ? action({
          actionId: 'qcd-target',
          kind,
          year: 2030,
          requestedAmount: 5_000,
          legacyField: 'qcdAnnual',
          provenance: { source: 'migration' },
        })
        : action({
          actionId: 'qcd-target',
          kind,
          year: 2030,
          executionDate: '2030-12-01',
          executionSequence: 1,
          requestedAmount: 5_000,
          donorPersonId: 'p1',
          allocation: {
            allocationId: 'qcd-allocation',
            sourceAccountId: 'traditional-a',
            requestedAmount: 5_000,
          },
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
        })
      plan.strategies.retirementActions = [qcd]
      const snapshot = structuredClone(plan)

      const result = review(plan, 'qcd-target')

      expect(result).toMatchObject({
        status: 'manualReviewRequired',
        outcome: 'unsupported',
        replacement: null,
        plan: null,
        evidence: {
          policy: 'explicitManualReviewRequiredNoCanonicalAllocatorArm',
          targetOmittedBeforeAllocation: false,
          inferredFields: [],
          unsupportedKind: kind,
        },
        issues: [{ kind: 'targetKindUnsupported' }],
      })
      expect(plan).toEqual(snapshot)
    },
  )

  it('reports an invalid Plan ID on the non-mutating QCD manual-review path', () => {
    const plan = basePlan()
    plan.id = '   '
    plan.strategies.retirementActions = [action({
      actionId: 'qcd-target',
      kind: 'legacyAggregateQcd',
      year: 2030,
      requestedAmount: 5_000,
      legacyField: 'qcdAnnual',
      provenance: { source: 'migration' },
    })]

    const result = review(plan, 'qcd-target')

    expect(result).toMatchObject({
      status: 'manualReviewRequired',
      outcome: 'unsupported',
      evidence: { planId: null },
      issues: [
        { kind: 'invalidInput', field: 'plan.id' },
        { kind: 'targetKindUnsupported', field: 'targetActionId' },
      ],
    })
  })

  it('distinguishes missing and duplicated targets without selecting by array order', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      legacyWithdrawal('duplicate'),
      legacyWithdrawal('duplicate'),
    ]

    expect(issueKinds(review(plan, 'missing', ordinaryIntent()))).toEqual(['targetMissing'])
    expect(issueKinds(review(plan, 'duplicate', ordinaryIntent()))).toEqual(['targetAmbiguous'])
  })

  it('rejects sparse retirement-action schedules without compacting empty slots', () => {
    const plan = basePlan()
    const sparseActions = new Array<RetirementActionRequest>(1_000_000)
    sparseActions[999_999] = legacyWithdrawal()
    plan.strategies.retirementActions = sparseActions

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      target: null,
      issues: [{
        kind: 'invalidInput',
        field: 'plan.strategies.retirementActions.0',
      }],
    })
  })

  it('requires manual provenance and preserves kind, year, and exact-cent amount', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]

    const provenance = review(plan, 'legacy-withdrawal', ordinaryIntent({
      provenance: { source: 'generator', sourceId: 'not-manual' },
    }))
    const mismatched = review(plan, 'legacy-withdrawal', conversionIntent({
      year: 2031,
      requestedAmount: asPositiveUsdCents(20_001),
      sourceAllocations: [{
        sourceAccountId: asAccountId('traditional-a'),
        requestedAmount: asPositiveUsdCents(20_001),
      }],
    }))

    expect(issueKinds(provenance)).toEqual(['replacementProvenanceInvalid'])
    expect(provenance).toMatchObject({ status: 'blocked', outcome: 'refused' })
    expect(issueKinds(mismatched)).toEqual([
      'replacementAmountMismatch',
      'replacementKindMismatch',
      'replacementYearMismatch',
    ])
  })

  it('does not copy legacy facts into a missing or incomplete replacement intent', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]

    expect(issueKinds(review(plan, 'legacy-withdrawal'))).toEqual(['replacementMissing'])
    const incomplete = reviewAndReplaceRetirementActionManually({
      plan,
      targetActionId: asActionId('legacy-withdrawal'),
      replacementIntent: {
        ...ordinaryIntent(),
        personId: '' as ReturnType<typeof asPersonId>,
      },
    })
    expect(incomplete.status).toBe('blocked')
    if (incomplete.status === 'blocked') {
      expect(incomplete.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'allocatorBlocked',
          allocatorIssue: expect.objectContaining({ kind: 'missingIdentity' }),
        }),
      ]))
    }
  })

  it('preserves refused allocator outcomes while propagating actual unsupported reasons', () => {
    const refusedPlan = basePlan()
    refusedPlan.strategies.retirementActions = [legacyWithdrawal()]
    const refused = review(refusedPlan, 'legacy-withdrawal', ordinaryIntent({
      sourceAllocations: [{
        sourceAccountId: asAccountId('cash-a'),
        requestedAmount: asPositiveUsdCents(9_999),
      }],
    }))

    expect(refused).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [expect.objectContaining({
        kind: 'allocatorBlocked',
        allocatorIssue: expect.objectContaining({
          reason: expect.objectContaining({
            code: 'allocation-total-mismatch',
            outcome: 'refused',
          }),
        }),
      })],
    })

    const unsupportedPlan = basePlan()
    unsupportedPlan.accounts.push({
      type: 'pension',
      id: 'pension-a',
      name: 'Pension A',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 0,
    })
    unsupportedPlan.strategies.retirementActions = [legacyWithdrawal()]
    const unsupported = review(unsupportedPlan, 'legacy-withdrawal', ordinaryIntent({
      sourceAllocations: [{
        sourceAccountId: asAccountId('pension-a'),
        requestedAmount: asPositiveUsdCents(10_000),
      }],
    }))

    expect(unsupported).toMatchObject({
      status: 'blocked',
      outcome: 'unsupported',
      issues: [expect.objectContaining({
        kind: 'allocatorBlocked',
        allocatorIssue: expect.objectContaining({
          reason: expect.objectContaining({
            code: 'withdrawal-source-type-unsupported',
            outcome: 'unsupported',
          }),
        }),
      })],
    })
  })

  it('blocks replacement of one side of a referenced conversion-funding group', () => {
    const plan = basePlan()
    const funding = action({
      actionId: 'funding-action',
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: 2030,
      executionDate: '2030-06-01',
      executionSequence: 1,
      requestedAmount: 10_000,
      allocations: [{
        allocationId: 'funding-allocation',
        sourceAccountId: 'cash-a',
        requestedAmount: 10_000,
      }],
      purpose: { kind: 'taxPayment', referenceId: 'conversion-action' },
      provenance: { source: 'manual' },
    })
    const conversion = action({
      actionId: 'conversion-action',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2030,
      executionDate: '2030-09-01',
      executionSequence: 2,
      requestedAmount: 20_000,
      allocations: [{
        allocationId: 'conversion-allocation',
        sourceAccountId: 'traditional-a',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'funding-action' },
      provenance: { source: 'manual' },
    })
    plan.strategies.retirementActions = [funding, conversion]

    expect(issueKinds(review(plan, 'funding-action', ordinaryIntent()))).toEqual([
      'dependentActionReference',
    ])
    expect(issueKinds(review(plan, 'conversion-action', conversionIntent()))).toEqual([
      'dependentActionReference',
    ])
  })

  it('does not treat non-tax purpose references as action dependencies', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      action({
        actionId: 'target-withdrawal',
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year: 2030,
        executionDate: '2030-06-01',
        executionSequence: 1,
        requestedAmount: 10_000,
        allocations: [{
          allocationId: 'target-allocation',
          sourceAccountId: 'cash-a',
          requestedAmount: 10_000,
        }],
        purpose: { kind: 'goal', referenceId: 'goal-a' },
        provenance: { source: 'manual' },
      }),
      action({
        actionId: 'preserved-withdrawal',
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year: 2031,
        executionDate: '2031-06-01',
        executionSequence: 1,
        requestedAmount: 10_000,
        allocations: [{
          allocationId: 'preserved-allocation',
          sourceAccountId: 'cash-a',
          requestedAmount: 10_000,
        }],
        purpose: { kind: 'goal', referenceId: 'target-withdrawal' },
        provenance: { source: 'manual' },
      }),
    ]

    expect(review(plan, 'target-withdrawal', ordinaryIntent()).status).toBe('replacementReady')
  })

  it.each([
    { label: 'missing', fundingAction: null },
    {
      label: 'non-reciprocal',
      fundingAction: action({
        actionId: 'funding-action',
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year: 2030,
        executionDate: '2030-06-01',
        executionSequence: 1,
        requestedAmount: 10_000,
        allocations: [{
          allocationId: 'funding-allocation',
          sourceAccountId: 'cash-a',
          requestedAmount: 10_000,
        }],
        purpose: { kind: 'spending' },
        provenance: { source: 'manual' },
      }),
    },
  ])('rejects a target with a $label outbound linked dependency', ({ fundingAction }) => {
    const plan = basePlan()
    const target = action({
      actionId: 'conversion-action',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2030,
      executionDate: '2030-09-01',
      executionSequence: 2,
      requestedAmount: 20_000,
      allocations: [{
        allocationId: 'conversion-allocation',
        sourceAccountId: 'traditional-a',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'funding-action' },
      provenance: { source: 'manual' },
    })
    plan.strategies.retirementActions = fundingAction === null
      ? [target]
      : [fundingAction, target]

    const result = review(plan, 'conversion-action', conversionIntent())

    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{
        kind: 'dependentActionReference',
        field: `plan.strategies.retirementActions.${fundingAction === null ? 0 : 1}`,
      }],
    })
  })

  it('rejects a one-sided replacement reference to a preserved action', () => {
    const plan = basePlan()
    const preservedConversion = action({
      actionId: 'preserved-conversion',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2030,
      executionDate: '2030-09-01',
      executionSequence: 2,
      requestedAmount: 20_000,
      allocations: [{
        allocationId: 'preserved-allocation',
        sourceAccountId: 'traditional-a',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    plan.strategies.retirementActions = [legacyWithdrawal(), preservedConversion]

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent({
      purpose: { kind: 'taxPayment', referenceId: 'preserved-conversion' },
    }))

    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{
        kind: 'dependentActionReference',
        field: 'replacementIntent.purpose.referenceId',
      }],
    })
  })

  it('blocks generator/optimizer targets instead of relabeling them manual', () => {
    const plan = basePlan()
    const allocated = allocateRetirementActionCandidateIdentity(plan, {
      ...ordinaryIntent(),
      provenance: { source: 'generator', sourceId: 'generated' },
    })
    expect(allocated.status).toBe('allocated')
    if (allocated.status !== 'allocated') return
    plan.strategies.retirementActions = [allocated.request]

    const result = review(plan, allocated.request.actionId, ordinaryIntent())
    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'unsupported',
      issues: [{ kind: 'targetProvenanceUnsupported' }],
    })
  })

  it('rejects cross-role reuse of a removed target identifier by the replacement', () => {
    const plan = basePlan()
    const allocated = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    expect(allocated.status).toBe('allocated')
    if (allocated.status !== 'allocated') return
    const generatedAllocationId = allocated.request.allocations[0]!.allocationId
    plan.strategies.retirementActions = [legacyWithdrawal(generatedAllocationId)]

    const result = review(plan, generatedAllocationId, ordinaryIntent())

    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{
        kind: 'replacementIdentityCollision',
        field: 'replacementIntent',
      }],
    })
  })

  it('fails closed when the deterministic review evidence identity is already reserved', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]
    const baseline = review(plan, 'legacy-withdrawal', ordinaryIntent())
    expect(baseline.status).toBe('replacementReady')
    if (baseline.status !== 'replacementReady') return
    plan.accounts.push(ownedCash(baseline.evidence.evidenceId))

    expect(issueKinds(review(plan, 'legacy-withdrawal', ordinaryIntent()))).toEqual([
      'reviewEvidenceCollision',
    ])
  })

  it('classifies a correctable replacement Plan validation failure as refused', () => {
    const plan = basePlan()
    plan.name = ''
    plan.strategies.retirementActions = [legacyWithdrawal()]

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    expect(result).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{ kind: 'replacementPlanInvalid', field: 'plan' }],
    })
  })

  it('binds target index and complete target/preserved evidence into the review ID', () => {
    const firstPlan = basePlan()
    firstPlan.strategies.retirementActions = [
      legacyWithdrawal(),
      legacyWithdrawal('preserved-action'),
    ]
    const movedPlan = structuredClone(firstPlan)
    movedPlan.strategies.retirementActions = [
      movedPlan.strategies.retirementActions[1]!,
      movedPlan.strategies.retirementActions[0]!,
    ]
    const changedProvenancePlan = structuredClone(firstPlan)
    changedProvenancePlan.strategies.retirementActions[0] = action({
      ...changedProvenancePlan.strategies.retirementActions[0],
      provenance: { source: 'migration', sourceId: 'different-import' },
    })
    const changedPreservedPlan = structuredClone(firstPlan)
    changedPreservedPlan.strategies.retirementActions[1] = action({
      ...changedPreservedPlan.strategies.retirementActions[1],
      requestedAmount: 10_001,
    })

    const first = review(firstPlan, 'legacy-withdrawal', ordinaryIntent())
    const moved = review(movedPlan, 'legacy-withdrawal', ordinaryIntent())
    const changedProvenance = review(
      changedProvenancePlan,
      'legacy-withdrawal',
      ordinaryIntent(),
    )
    const changedPreserved = review(
      changedPreservedPlan,
      'legacy-withdrawal',
      ordinaryIntent(),
    )

    expect(first.status).toBe('replacementReady')
    expect(moved.status).toBe('replacementReady')
    expect(changedProvenance.status).toBe('replacementReady')
    expect(changedPreserved.status).toBe('replacementReady')
    if (
      first.status !== 'replacementReady' ||
      moved.status !== 'replacementReady' ||
      changedProvenance.status !== 'replacementReady' ||
      changedPreserved.status !== 'replacementReady'
    ) return
    expect(first.evidence.target.originalPlanIndex).toBe(0)
    expect(moved.evidence.target.originalPlanIndex).toBe(1)
    expect(changedProvenance.evidence.target.provenance).toEqual({
      source: 'migration',
      sourceId: 'different-import',
    })
    expect(moved.evidence.replacementActionId).toBe(first.evidence.replacementActionId)
    expect(changedProvenance.evidence.replacementActionId)
      .toBe(first.evidence.replacementActionId)
    expect(moved.evidence.evidenceId).not.toBe(first.evidence.evidenceId)
    expect(changedProvenance.evidence.evidenceId).not.toBe(first.evidence.evidenceId)
    expect(changedPreserved.evidence.preservedActionIds)
      .toEqual(first.evidence.preservedActionIds)
    expect(changedPreserved.evidence.evidenceId).not.toBe(first.evidence.evidenceId)
  })

  it('publishes and binds every field of an already-manual target request', () => {
    const plan = basePlan()
    const allocated = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    expect(allocated.status).toBe('allocated')
    if (allocated.status !== 'allocated') return
    plan.strategies.retirementActions = [allocated.request]
    const changedTargetPlan = structuredClone(plan)
    changedTargetPlan.strategies.retirementActions[0] = action({
      ...changedTargetPlan.strategies.retirementActions[0],
      executionDate: '2030-06-16',
    })

    const baseline = review(plan, allocated.request.actionId, ordinaryIntent())
    const changedTarget = review(
      changedTargetPlan,
      allocated.request.actionId,
      ordinaryIntent(),
    )

    expect(baseline.status).toBe('replacementReady')
    expect(changedTarget.status).toBe('replacementReady')
    if (baseline.status !== 'replacementReady' || changedTarget.status !== 'replacementReady') {
      return
    }
    expect(changedTarget.target.actionId).toBe(baseline.target.actionId)
    expect(changedTarget.evidence.target.request).toMatchObject({
      executionDate: '2030-06-16',
    })
    expect(changedTarget.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
  })

  it('reports a nonblank stable Plan ID requirement deterministically', () => {
    const plan = basePlan()
    plan.id = '   '
    plan.strategies.retirementActions = [legacyWithdrawal()]

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    expect(result).toMatchObject({
      status: 'blocked',
      issues: [{
        kind: 'invalidInput',
        field: 'plan.id',
      }],
    })
  })

  it('fails closed for unexpected fields and hostile getters', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]
    const unexpected = {
      plan,
      targetActionId: asActionId('legacy-withdrawal'),
      replacementIntent: ordinaryIntent(),
      inferredSourceCategory: 'cash',
    } as unknown as RetirementActionManualReviewInput
    expect(issueKinds(reviewAndReplaceRetirementActionManually(unexpected))).toEqual([
      'invalidInput',
    ])

    const hostile = {
      plan,
      targetActionId: asActionId('legacy-withdrawal'),
      replacementIntent: ordinaryIntent(),
    }
    Object.defineProperty(hostile, 'targetActionId', {
      enumerable: true,
      get: () => { throw new Error('hostile getter') },
    })
    expect(reviewAndReplaceRetirementActionManually(hostile)).toMatchObject({
      status: 'blocked',
      issues: [{ kind: 'invalidInput', field: '$' }],
    })
  })
})
