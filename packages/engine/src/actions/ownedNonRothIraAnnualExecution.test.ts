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
  type ActionId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  executePlanOwnedNonRothIraAnnualWithdrawals,
  type ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput,
} from './ownedNonRothIraAnnualExecution.js'
import {
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
} from './ownedNonRothIraAnnualPlanCoordinator.js'

const ownerPersonId = asPersonId('p1')
const requestedSourceId = asAccountId('ira-requested')
const siblingSourceId = asAccountId('ira-sibling')
const actionId = asActionId('withdrawal-2030')

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01' })
  value.id = asPlanId('plan-owned-ira')
  value.accounts = [
    traditionalAccount(requestedSourceId, 1_000, ownerPersonId),
    traditionalAccount(siblingSourceId, 0, ownerPersonId),
  ]
  value.strategies.retirementActions = [{
    actionId,
    kind: 'ordinaryWithdrawal',
    personId: ownerPersonId,
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(10_000),
    allocations: [{
      allocationId: asAllocationId('allocation-requested'),
      sourceAccountId: requestedSourceId,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [
      {
        sourceAccountId: requestedSourceId,
        subtype: 'traditional',
        evidenceId: 'classification-requested',
        provenance: { source: 'manual' },
      },
      {
        sourceAccountId: siblingSourceId,
        subtype: 'sep',
        evidenceId: 'classification-sibling',
        provenance: { source: 'import', sourceId: 'classification-import' },
      },
    ],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return value
}

function input(): ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput {
  const value = plan()
  const openingBalanceEvidence = [
    [requestedSourceId, asUsdCents(100_000)],
    [siblingSourceId, asUsdCents(0)],
  ].map(([sourceAccountId, openingBalanceAmount], index) => ({
    predicate:
      'ownedNonRothIraOpeningBalanceBeforeCompleteAnnualPlanActionBatch' as const,
    planId: asPlanId(value.id),
    ownerPersonId,
    sourceAccountId: asAccountId(sourceAccountId),
    taxYear: 2030,
    ledgerPhase:
      'openingOfTaxYearBeforeCompleteAnnualOwnedIraActionBatch' as const,
    asOfDate: '2030-01-01',
    ledgerRunId: 'ledger-run-2030',
    openingBalanceAmount: asUsdCents(openingBalanceAmount),
    evidenceId: `opening-${index}`,
    upstreamEvidenceId: `opening-upstream-${index}`,
  }))
  const yearEndBalanceEvidence = [
    [requestedSourceId, asUsdCents(90_000)],
    [siblingSourceId, asUsdCents(0)],
  ].map(([sourceAccountId, yearEndApplicableBalanceAmount], index) => ({
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId: asPlanId(value.id),
    ownerPersonId,
    sourceAccountId: asAccountId(sourceAccountId),
    taxYear: 2030,
    ledgerPhase: 'form8606ApplicableTaxYearEnd' as const,
    asOfDate: '2030-12-31',
    ledgerRunId: 'ledger-run-2030',
    yearEndApplicableBalanceAmount: asUsdCents(yearEndApplicableBalanceAmount),
    evidenceId: `year-end-${index}`,
    upstreamEvidenceId: `year-end-upstream-${index}`,
  }))
  return {
    plan: value,
    ownerPersonId,
    taxYear: 2030,
    openingBalanceEvidence,
    yearEndBalanceEvidence,
    annualBasisEvidence: {
      predicate: 'completePlanOwnedNonRothIraAnnualBasisFacts',
      planId: asPlanId(value.id),
      ownerPersonId,
      taxYear: 2030,
      ledgerRunId: 'ledger-run-2030',
      line7InventoryStatus:
        'completePlanActionBatchWithNoOmittedOwnerIraLine7Activity',
      excludedLine7ActivityStatus:
        'noExternalRmdLegacyOrOtherNonQcdDistributions',
      includedPlanActionIds: [actionId],
      openingBasisAmount: asUsdCents(0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      evidenceId: 'annual-basis',
      upstreamEvidenceId: 'annual-basis-upstream',
    },
    line8InventoryEvidence: {
      predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory',
      planId: asPlanId(value.id),
      ownerPersonId,
      taxYear: 2030,
      ledgerRunId: 'ledger-run-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      entries: [],
      evidenceId: 'line8-inventory',
      upstreamEvidenceId: 'line8-inventory-upstream',
    },
    personAliveEvidence: [{
      evidenceId: 'alive-action',
      actionId,
      personId: ownerPersonId,
      actionYear: 2030,
      actionDate: '2030-06-15',
      alive: true,
    }],
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function committed(
  value: ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput = input(),
) {
  const result = executePlanOwnedNonRothIraAnnualWithdrawals(value)
  expect(result.status).toBe('annualWithdrawalCommitted')
  if (result.status !== 'annualWithdrawalCommitted') {
    throw new Error(`Expected committed withdrawal, received ${result.status}`)
  }
  return result
}

function addAction(
  value: ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput,
  id: string,
  date: string,
  sequence: number,
  requestedAmount: number,
): ActionId {
  const addedActionId = asActionId(id)
  const valuePlan = value.plan as Plan
  valuePlan.strategies.retirementActions.push({
    actionId: addedActionId,
    kind: 'ordinaryWithdrawal',
    personId: ownerPersonId,
    year: 2030,
    executionDate: date,
    executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(requestedAmount),
    allocations: [{
      allocationId: asAllocationId(`${id}-allocation`),
      sourceAccountId: requestedSourceId,
      requestedAmount: asPositiveUsdCents(requestedAmount),
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
  value.annualBasisEvidence = {
    ...value.annualBasisEvidence,
    includedPlanActionIds: [
      ...value.annualBasisEvidence.includedPlanActionIds,
      addedActionId,
    ],
  }
  value.personAliveEvidence = [
    ...value.personAliveEvidence,
    {
      evidenceId: `alive-${id}`,
      actionId: addedActionId,
      personId: ownerPersonId,
      actionYear: 2030,
      actionDate: date,
      alive: true,
    },
  ]
  return addedActionId
}

describe('Plan-owned non-Roth IRA annual execution', () => {
  it('commits exact balances and rejoins annual character and penalty evidence', () => {
    const value = input()
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      openingBasisAmount: asUsdCents(5_000),
    }

    const result = committed(value)

    expect(result.movement).toBe('committed')
    expect(result.actionability).toBe('established')
    expect(result.executionEvidenceId).toMatch(
      /^owned-ira-plan-annual-execution:[0-9a-f]{64}$/,
    )
    expect(result.balances).toEqual([
      {
        sourceAccountId: requestedSourceId,
        ownerPersonId,
        openingBalance: 100_000,
        requestedAmount: 10_000,
        executedAmount: 10_000,
        unexecutedAmount: 0,
        closingBalance: 90_000,
      },
    ])
    expect(result.actions[0]).toMatchObject({
      actionId,
      scheduledDate: '2030-06-15',
      scheduledSequence: 1,
      executedDate: '2030-06-15',
      executedSequence: 1,
      disposition: {
        outcome: 'executed',
        readiness: 'actionable',
        requestedAmount: 10_000,
        executedAmount: 10_000,
        unexecutedAmount: 0,
        reasons: [],
      },
    })
    expect(result.actions[0]?.taxCharacter.map((part) => part.kind))
      .toEqual(['basisReturn', 'ordinaryIncome'])
    expect(result.actions[0]?.penaltyCoverage).toHaveLength(1)
    expect(result.actions[0]?.penaltyEvaluations[0]?.outcome)
      .toBe('age59HalfReached')
    expect(result.sourceInventoryEvidenceId).toMatch(
      /^owned-ira-plan-source-inventory:/,
    )
    expect(result.physicalEligibilityEvidenceId).toMatch(
      /^owned-ira-plan-physical-eligibility:/,
    )
    expect(result.planOwnedIraCandidateEvidenceId).toMatch(
      /^owned-ira-plan-annual-candidate:/,
    )
    expect(result.bindingEvidence.bindingEvidenceId).toBeTruthy()
    expect(result.annualEvidence.finalizationEvidenceId).toBeTruthy()
  })

  it('uses normative full, partial, and refused dispositions within one bound batch', () => {
    const value = input()
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, openingBalanceAmount: asUsdCents(15_000) }
        : evidence,
    )
    value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, yearEndApplicableBalanceAmount: asUsdCents(0) }
        : evidence,
    )
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      openingBasisAmount: asUsdCents(3_000),
    }
    addAction(value, 'withdrawal-partial', '2030-07-15', 2, 10_000)
    addAction(value, 'withdrawal-zero', '2030-08-15', 3, 5_000)

    const result = committed(value)

    expect(result.actions.map((action) => ({
      outcome: action.disposition.outcome,
      executed: action.executedAmount,
      reason: action.disposition.reasons[0]?.code ?? null,
      executedDate: action.executedDate,
      executedSequence: action.executedSequence,
    }))).toEqual([
      {
        outcome: 'executed',
        executed: 10_000,
        reason: null,
        executedDate: '2030-06-15',
        executedSequence: 1,
      },
      {
        outcome: 'partial',
        executed: 5_000,
        reason: 'source-balance-trimmed',
        executedDate: '2030-07-15',
        executedSequence: 2,
      },
      {
        outcome: 'refused',
        executed: 0,
        reason: 'source-balance-unavailable',
        executedDate: null,
        executedSequence: null,
      },
    ])
    expect(result.actions[2]?.scheduledDate).toBe('2030-08-15')
    expect(result.actions[2]?.scheduledSequence).toBe(3)
    expect(result.actions[2]?.taxCharacter).toEqual([])
    expect(result.actions[2]?.penaltyCoverage).toEqual([])
    expect(result.actions[2]?.penaltyEvaluations).toEqual([])
    expect(result.balances[0]?.closingBalance).toBe(0)
  })

  it('commits a positive all-basis allocation with coverage and no penalty evaluation', () => {
    const value = input()
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      openingBasisAmount: asUsdCents(100_000),
    }

    const result = committed(value)

    expect(result.actions[0]?.taxCharacter.map((part) => part.kind))
      .toEqual(['basisReturn'])
    expect(result.actions[0]?.penaltyCoverage).toHaveLength(1)
    expect(result.actions[0]?.penaltyCoverage[0]?.ordinaryIncomeExposureAmount)
      .toBe(0)
    expect(result.actions[0]?.penaltyEvaluations).toEqual([])
  })

  it('establishes explicit refusals without claiming a commit for an all-zero batch', () => {
    const value = input()
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, openingBalanceAmount: asUsdCents(0) }
        : evidence,
    )
    value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, yearEndApplicableBalanceAmount: asUsdCents(0) }
        : evidence,
    )

    const result = executePlanOwnedNonRothIraAnnualWithdrawals(value)

    expect(result.status).toBe('noPositiveMovementRefused')
    if (result.status !== 'noPositiveMovementRefused') return
    expect(result.movement).toBe('noMovement')
    expect(result.actionability).toBe('established')
    expect(result.executionEvidenceId).toBeNull()
    expect(result.balances[0]).toMatchObject({
      openingBalance: 0,
      executedAmount: 0,
      closingBalance: 0,
    })
    expect(result.actions[0]).toMatchObject({
      scheduledDate: '2030-06-15',
      scheduledSequence: 1,
      executedDate: null,
      executedSequence: null,
      disposition: {
        outcome: 'refused',
        readiness: 'nonActionable',
        requestedAmount: 10_000,
        executedAmount: 0,
        unexecutedAmount: 10_000,
        reasons: [{ code: 'source-balance-unavailable' }],
      },
      taxCharacter: [],
      penaltyCoverage: [],
      penaltyEvaluations: [],
    })
  })

  it('returns coordinator blocking arms unchanged', () => {
    const value = input()
    value.openingBalanceEvidence = value.openingBalanceEvidence.slice(1)

    const coordinated =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(clone(value))
    const executed = executePlanOwnedNonRothIraAnnualWithdrawals(clone(value))

    expect(coordinated.status).toBe('sourceInventoryIncomplete')
    expect(executed).toEqual(coordinated)
    expect('executionEvidenceId' in executed).toBe(false)
  })

  it('returns physical-eligibility blocking unchanged', () => {
    const value = input()
    value.personAliveEvidence = value.personAliveEvidence.map((evidence) => ({
      ...evidence,
      alive: false,
    }))

    const coordinated =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(clone(value))
    const executed = executePlanOwnedNonRothIraAnnualWithdrawals(clone(value))

    expect(coordinated.status).toBe('physicalEligibilityBlocked')
    expect(executed).toEqual(coordinated)
  })

  it('returns an invalid annual schedule unchanged', () => {
    const value = input()
    addAction(value, 'withdrawal-conflict', '2030-06-15', 1, 1_000)

    const coordinated =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(clone(value))
    const executed = executePlanOwnedNonRothIraAnnualWithdrawals(clone(value))

    expect(coordinated.status).toBe('scheduleInvalid')
    expect(executed).toEqual(coordinated)
  })

  it('returns unresolved annual penalty evidence unchanged', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '1980-01-01'

    const coordinated =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(clone(value))
    const executed = executePlanOwnedNonRothIraAnnualWithdrawals(clone(value))

    expect(coordinated.status).toBe('annualEvidenceBlocked')
    expect(executed).toEqual(coordinated)
  })

  it('returns a typed fail-closed arm when the structural commit ID collides', () => {
    const baseline = committed()
    const value = input() as ExecutePlanOwnedNonRothIraAnnualWithdrawalsInput & {
      priorExecutionEvidenceId?: string
    }
    value.priorExecutionEvidenceId = baseline.executionEvidenceId

    const result = executePlanOwnedNonRothIraAnnualWithdrawals(value)

    expect(result.status).toBe('executionEvidenceIdCollision')
    if (result.status !== 'executionEvidenceIdCollision') return
    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
    expect(result.executionEvidenceId).toBeNull()
    expect(result.issues).toEqual([expect.objectContaining({
      kind: 'executionEvidenceIdCollision',
    })])
  })

  it('is deterministic, permutation invariant, detached, frozen, and input-pure', () => {
    const value = input()
    const snapshot = clone(value)
    const baseline = committed(value)
    const permuted = clone(snapshot)
    permuted.openingBalanceEvidence = [
      ...permuted.openingBalanceEvidence,
    ].reverse()
    permuted.yearEndBalanceEvidence = [
      ...permuted.yearEndBalanceEvidence,
    ].reverse()
    permuted.personAliveEvidence = [
      ...permuted.personAliveEvidence,
    ].reverse()
    const repeated = committed(permuted)

    expect(value).toEqual(snapshot)
    expect(repeated).toEqual(baseline)
    expect(repeated.executionEvidenceId).toBe(baseline.executionEvidenceId)
    expect(Object.isFrozen(baseline)).toBe(true)
    expect(Object.isFrozen(baseline.actions[0]?.allocations[0])).toBe(true)
    expect(Object.isFrozen(baseline.annualEvidence.penaltyPrerequisites))
      .toBe(true)

    const valuePlan = value.plan as Plan
    const firstAction = valuePlan.strategies.retirementActions[0]
    if (firstAction?.kind !== 'ordinaryWithdrawal') {
      throw new Error('Expected ordinary withdrawal fixture')
    }
    firstAction.executionDate = '2030-12-01'
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, openingBalanceAmount: asUsdCents(1) }
        : evidence,
    )
    expect(baseline.actions[0]?.scheduledDate).toBe('2030-06-15')
    expect(baseline.balances[0]?.openingBalance).toBe(100_000)
  })
})
