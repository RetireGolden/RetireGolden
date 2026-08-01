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
        originalPlanIndex: 0,
      },
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

  it('distinguishes missing and duplicated targets without selecting by array order', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      legacyWithdrawal('duplicate'),
      legacyWithdrawal('duplicate'),
    ]

    expect(issueKinds(review(plan, 'missing', ordinaryIntent()))).toEqual(['targetMissing'])
    expect(issueKinds(review(plan, 'duplicate', ordinaryIntent()))).toEqual(['targetAmbiguous'])
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

  it('blocks generator/optimizer targets instead of relabeling them manual', () => {
    const plan = basePlan()
    const allocated = allocateRetirementActionCandidateIdentity(plan, {
      ...ordinaryIntent(),
      provenance: { source: 'generator', sourceId: 'generated' },
    })
    expect(allocated.status).toBe('allocated')
    if (allocated.status !== 'allocated') return
    plan.strategies.retirementActions = [allocated.request]

    expect(issueKinds(review(plan, allocated.request.actionId, ordinaryIntent()))).toEqual([
      'targetProvenanceUnsupported',
    ])
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
