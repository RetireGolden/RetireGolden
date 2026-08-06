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
import { planSchema, type Account, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  ownedNonRothIraAnnualFilingSourceRecord,
  singlePersonPlan,
  taxableAccount,
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
    if (allocated.request.kind !== 'ordinaryWithdrawal') return
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

  it('normalizes explicit undefined optional fields before deriving review evidence', () => {
    const omittedPlan = basePlan()
    omittedPlan.strategies.retirementActions = [
      legacyWithdrawal(),
      action({
        actionId: 'preserved-action',
        kind: 'ordinaryWithdrawal',
        year: 2031,
        executionSequence: 1,
        requestedAmount: 10_000,
        provenance: { source: 'manual' },
        personId: 'p1',
        allocations: [{
          allocationId: 'preserved-allocation',
          sourceAccountId: 'cash-a',
          requestedAmount: 10_000,
        }],
        purpose: { kind: 'spending' },
      }),
    ]
    const undefinedPlan = structuredClone(omittedPlan)
    const undefinedPreserved = undefinedPlan.strategies.retirementActions[1]!
    Object.assign(undefinedPreserved, { executionDate: undefined })
    Object.assign(undefinedPreserved.provenance, { scenarioId: undefined })

    const omittedIntent = ordinaryIntent({
      provenance: { source: 'manual' },
      purpose: { kind: 'spending' },
    })
    const undefinedIntent = structuredClone(omittedIntent)
    Object.assign(undefinedIntent.provenance, { sourceId: undefined })
    Object.assign(undefinedIntent.purpose, { referenceId: undefined })

    const omitted = review(omittedPlan, 'legacy-withdrawal', omittedIntent)
    const explicitUndefined = review(
      undefinedPlan,
      'legacy-withdrawal',
      undefinedIntent,
    )

    expect(omitted.status).toBe('replacementReady')
    expect(explicitUndefined.status).toBe('replacementReady')
    if (omitted.status !== 'replacementReady' || explicitUndefined.status !== 'replacementReady') {
      return
    }
    expect(explicitUndefined.evidence.evidenceId).toBe(omitted.evidence.evidenceId)
  })

  it('normalizes forward-compatible Plan action fields through the persisted schema', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [
      {
        ...legacyWithdrawal(),
        futureTargetField: { retainedByFutureVersion: true },
      } as unknown as RetirementActionRequest,
      {
        ...legacyWithdrawal('preserved-action'),
        futurePreservedField: 'future-value',
      } as unknown as RetirementActionRequest,
    ]

    expect(planSchema.safeParse(plan).success).toBe(true)
    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    expect(result.status).toBe('replacementReady')
    if (result.status !== 'replacementReady') return
    expect(result.target).not.toHaveProperty('futureTargetField')
    expect(result.evidence.target.request).not.toHaveProperty('futureTargetField')
    expect(result.plan.strategies.retirementActions[1])
      .not.toHaveProperty('futurePreservedField')
  })

  it('binds selected person and account records into the review evidence ID', () => {
    const cashPlan = basePlan()
    cashPlan.strategies.retirementActions = [legacyWithdrawal()]
    const taxablePlan = structuredClone(cashPlan)
    taxablePlan.accounts[0] = {
      ...taxableAccount('cash-a', 1_000, 1_000),
      ownerPersonId: 'p1',
    }
    const changedPersonPlan = structuredClone(cashPlan)
    changedPersonPlan.household.people[0]!.name = 'Different Pat'

    const cash = review(cashPlan, 'legacy-withdrawal', ordinaryIntent())
    const taxable = review(taxablePlan, 'legacy-withdrawal', ordinaryIntent())
    const changedPerson = review(
      changedPersonPlan,
      'legacy-withdrawal',
      ordinaryIntent(),
    )

    expect(cash.status).toBe('replacementReady')
    expect(taxable.status).toBe('replacementReady')
    expect(changedPerson.status).toBe('replacementReady')
    if (
      cash.status !== 'replacementReady' ||
      taxable.status !== 'replacementReady' ||
      changedPerson.status !== 'replacementReady'
    ) return
    expect(taxable.replacement.actionId).toBe(cash.replacement.actionId)
    expect(changedPerson.replacement.actionId).toBe(cash.replacement.actionId)
    expect(taxable.evidence.evidenceId).not.toBe(cash.evidence.evidenceId)
    expect(changedPerson.evidence.evidenceId).not.toBe(cash.evidence.evidenceId)
  })

  it('binds target-referenced person, source, and destination records into evidence', () => {
    const plan = couplePlan({ p1PlanningAge: 100, p2PlanningAge: 100 })
    plan.accounts = [
      traditionalAccount('traditional-a', 1_000, 'p1'),
      ownedRoth('roth-a'),
      traditionalAccount('target-traditional', 1_000, 'p2'),
      ownedRoth('target-roth', 'p2'),
    ]
    plan.strategies.retirementActions = [action({
      actionId: 'manual-target',
      kind: 'rothConversion',
      year: 2030,
      executionDate: '2030-08-01',
      executionSequence: 1,
      requestedAmount: 20_000,
      provenance: { source: 'manual' },
      personId: 'p2',
      allocations: [{
        allocationId: 'target-allocation',
        sourceAccountId: 'target-traditional',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'target-roth',
      taxFunding: { kind: 'noneExpected' },
    })]
    const changedPersonPlan = structuredClone(plan)
    changedPersonPlan.household.people[1]!.name = 'Different Robin'
    const changedSourcePlan = structuredClone(plan)
    const targetSourceAccount = changedSourcePlan.accounts.find(
      (account) => account.id === 'target-traditional',
    )!
    if (targetSourceAccount.type !== 'traditional') {
      throw new Error('expected traditional source')
    }
    targetSourceAccount.balance = 2_000
    const changedDestinationPlan = structuredClone(plan)
    const targetDestinationAccount = changedDestinationPlan.accounts.find(
      (account) => account.id === 'target-roth',
    )!
    if (targetDestinationAccount.type !== 'roth') {
      throw new Error('expected Roth destination')
    }
    targetDestinationAccount.balance = 2_000

    const baseline = review(plan, 'manual-target', conversionIntent())
    const changedPerson = review(
      changedPersonPlan,
      'manual-target',
      conversionIntent(),
    )
    const changedSource = review(
      changedSourcePlan,
      'manual-target',
      conversionIntent(),
    )
    const changedDestination = review(
      changedDestinationPlan,
      'manual-target',
      conversionIntent(),
    )

    expect(baseline.status).toBe('replacementReady')
    expect(changedPerson.status).toBe('replacementReady')
    expect(changedSource.status).toBe('replacementReady')
    expect(changedDestination.status).toBe('replacementReady')
    if (
      baseline.status !== 'replacementReady' ||
      changedPerson.status !== 'replacementReady' ||
      changedSource.status !== 'replacementReady' ||
      changedDestination.status !== 'replacementReady'
    ) return
    expect(changedPerson.replacement.actionId).toBe(baseline.replacement.actionId)
    expect(changedSource.replacement.actionId).toBe(baseline.replacement.actionId)
    expect(changedDestination.replacement.actionId).toBe(baseline.replacement.actionId)
    expect(changedPerson.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
    expect(changedSource.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
    expect(changedDestination.evidence.evidenceId).not.toBe(baseline.evidence.evidenceId)
  })

  it('validates target ownership and Roth destination semantics before omission', () => {
    const crossOwnerPlan = couplePlan({ p1PlanningAge: 100, p2PlanningAge: 100 })
    crossOwnerPlan.accounts = [
      ownedCash('cash-a'),
      ownedCash('target-source', 'p2'),
      traditionalAccount('traditional-a', 1_000, 'p1'),
      ownedRoth('roth-a'),
    ]
    crossOwnerPlan.strategies.retirementActions = [action({
      actionId: 'cross-owner-target',
      kind: 'ordinaryWithdrawal',
      year: 2030,
      executionSequence: 1,
      requestedAmount: 10_000,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'cross-owner-allocation',
        sourceAccountId: 'target-source',
        requestedAmount: 10_000,
      }],
      purpose: { kind: 'spending' },
    })]

    const nonRothDestinationPlan = basePlan()
    nonRothDestinationPlan.accounts.push(
      traditionalAccount('non-roth-destination', 1_000, 'p1'),
    )
    nonRothDestinationPlan.strategies.retirementActions = [action({
      actionId: 'non-roth-destination-target',
      kind: 'rothConversion',
      year: 2030,
      executionSequence: 1,
      requestedAmount: 20_000,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'conversion-source-allocation',
        sourceAccountId: 'traditional-a',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'non-roth-destination',
      taxFunding: { kind: 'noneExpected' },
    })]

    const crossOwnerDestinationPlan = couplePlan({
      p1PlanningAge: 100,
      p2PlanningAge: 100,
    })
    crossOwnerDestinationPlan.accounts = [
      traditionalAccount('traditional-a', 1_000, 'p1'),
      ownedRoth('roth-a'),
      ownedRoth('target-roth', 'p2'),
    ]
    crossOwnerDestinationPlan.strategies.retirementActions = [action({
      actionId: 'cross-owner-destination-target',
      kind: 'rothConversion',
      year: 2030,
      executionSequence: 1,
      requestedAmount: 20_000,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'cross-owner-conversion-allocation',
        sourceAccountId: 'traditional-a',
        requestedAmount: 20_000,
      }],
      destinationRothAccountId: 'target-roth',
      taxFunding: { kind: 'noneExpected' },
    })]

    const crossOwner = review(
      crossOwnerPlan,
      'cross-owner-target',
      ordinaryIntent(),
    )
    const nonRothDestination = review(
      nonRothDestinationPlan,
      'non-roth-destination-target',
      conversionIntent(),
    )
    const crossOwnerDestination = review(
      crossOwnerDestinationPlan,
      'cross-owner-destination-target',
      conversionIntent(),
    )

    expect(crossOwner).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{ kind: 'invalidInput', field: 'target.allocations' }],
    })
    expect(nonRothDestination).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{ kind: 'invalidInput', field: 'target.destinationRothAccountId' }],
    })
    expect(crossOwnerDestination).toMatchObject({
      status: 'blocked',
      outcome: 'refused',
      issues: [{ kind: 'invalidInput', field: 'target.destinationRothAccountId' }],
    })
  })

  it('binds identity records referenced only by preserved actions into evidence', () => {
    const cashPlan = basePlan()
    cashPlan.accounts.push(ownedCash('preserved-source'))
    cashPlan.strategies.retirementActions = [
      legacyWithdrawal(),
      action({
        actionId: 'preserved-action',
        kind: 'ordinaryWithdrawal',
        year: 2031,
        executionSequence: 1,
        requestedAmount: 5_000,
        provenance: { source: 'manual' },
        personId: 'p1',
        allocations: [{
          allocationId: 'preserved-allocation',
          sourceAccountId: 'preserved-source',
          requestedAmount: 5_000,
        }],
        purpose: { kind: 'spending' },
      }),
    ]
    const taxablePlan = structuredClone(cashPlan)
    const preservedSourceIndex = taxablePlan.accounts.findIndex(
      (account) => account.id === 'preserved-source',
    )
    taxablePlan.accounts[preservedSourceIndex] = {
      ...taxableAccount('preserved-source', 1_000, 1_000),
      ownerPersonId: 'p1',
    }

    const cash = review(cashPlan, 'legacy-withdrawal', ordinaryIntent())
    const taxable = review(taxablePlan, 'legacy-withdrawal', ordinaryIntent())

    expect(cash.status).toBe('replacementReady')
    expect(taxable.status).toBe('replacementReady')
    if (cash.status !== 'replacementReady' || taxable.status !== 'replacementReady') return
    expect(taxable.replacement.actionId).toBe(cash.replacement.actionId)
    expect(taxable.evidence.preservedActionIds).toEqual(cash.evidence.preservedActionIds)
    expect(taxable.evidence.evidenceId).not.toBe(cash.evidence.evidenceId)
  })

  /**
   * Both QCD kinds leave this path unreplaced, and the published policy says
   * which of the two reasons applied. The aggregate kind has no allocator arm
   * to be handed to; the named kind has one and is authored through it, so it
   * never belongs here in the first place.
   */
  it.each([
    {
      kind: 'legacyAggregateQcd',
      policy: 'explicitManualReviewRequiredNoCanonicalAllocatorArm',
    },
    {
      kind: 'qcd',
      policy: 'explicitNoReplacementNamedQcdUsesCanonicalAllocatorArm',
    },
  ] as const)(
    'keeps $kind explicit, unsupported, and non-mutating, and publishes $policy',
    ({ kind, policy }) => {
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
          policy,
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
    if (allocated.request.kind !== 'ordinaryWithdrawal') return
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

  it('reserves annual filing-source identifiers through the arbiter for review evidence', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]
    const baseline = review(plan, 'legacy-withdrawal', ordinaryIntent())
    expect(baseline.status).toBe('replacementReady')
    if (baseline.status !== 'replacementReady') return
    const source = ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['traditional-a'])
    source.sourceRecordId = baseline.evidence.evidenceId
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [source],
    }
    expect(planSchema.safeParse(plan).success).toBe(true)

    expect(issueKinds(review(plan, 'legacy-withdrawal', ordinaryIntent()))).toEqual([
      'reviewEvidenceCollision',
    ])
  })

  it('refuses review against an annual filing-source root the arbiter rejects', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = [legacyWithdrawal()]
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['traditional-a'], 2030, 'first'),
        ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['traditional-a'], 2030, 'second'),
      ],
    }

    const result = review(plan, 'legacy-withdrawal', ordinaryIntent())

    // Refused on the duplicated root itself, not on the downstream Plan parse:
    // the same rejection the arbiter publishes, at the first consult of the root.
    expect(result).toMatchObject({ status: 'blocked', outcome: 'refused' })
    expect(issueKinds(result)).toEqual(['allocatorBlocked'])
    if (result.status === 'replacementReady') return
    expect(result.issues[0].detail).toContain('duplicateOwnerYearSource')
    expect(result.issues[0].allocatorIssue?.field).toBe(
      'plan.retirementActionAnnualTaxFacts.ownedNonRothIraAnnualFilingSourceRecords',
    )
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
