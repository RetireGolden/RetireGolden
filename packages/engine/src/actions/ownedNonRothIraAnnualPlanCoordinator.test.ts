import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import {
  cashAccount,
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
  coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate,
  type CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput,
} from './ownedNonRothIraAnnualPlanCoordinator.js'
import type {
  OwnedNonRothIraSeppPenaltyScheduleRouteInput,
} from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence,
} from './ownedNonRothIraSeppAnnualReconciliation.js'

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

function input(): CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput {
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

function issueKinds(
  result: ReturnType<
    typeof coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate
  >,
): string[] {
  return result.issues.map((issue) =>
    'kind' in issue ? String(issue.kind) : 'untypedIssue',
  )
}

function successful(
  value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput = input(),
) {
  const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)
  expect(result.status).toBe('annualEvidenceBound')
  if (result.status !== 'annualEvidenceBound') {
    throw new Error(`Expected bound evidence, received ${result.status}`)
  }
  return result
}

function classifyRequestedSourceAsSimple(
  value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput,
  participationStartDate?: string,
): void {
  const valuePlan = value.plan as Plan
  const classification = valuePlan.retirementActionEligibilityFacts!
    .iraClassifications.find(
      (item) => item.sourceAccountId === requestedSourceId,
    )!
  valuePlan.retirementActionEligibilityFacts!.iraClassifications = [
    {
      sourceAccountId: classification.sourceAccountId,
      subtype: 'simple',
      evidenceId: classification.evidenceId,
      provenance: classification.provenance,
      ...(participationStartDate === undefined
        ? {}
        : { simpleParticipationStartDate: participationStartDate }),
    },
    ...valuePlan.retirementActionEligibilityFacts!.iraClassifications.filter(
      (item) => item.sourceAccountId !== requestedSourceId,
    ),
  ]
}

function qualifiedSeppRoute(
  distributionDateEvidenceId: string,
  accountOwnershipEvidenceId: string,
  iraClassificationEvidenceId: string,
): OwnedNonRothIraSeppPenaltyScheduleRouteInput {
  const openingLineage = {
    predicate: 'ownedNonRothIraSeppAnnualOpeningState' as const,
    electionId: 'plan-sepp-election',
    scheduleId: 'plan-sepp-schedule',
    participantPersonId: ownerPersonId,
    sourceAccountId: requestedSourceId,
    taxYear: 2030,
    priorHistoryTerminalStateId: 'plan-sepp-prior-terminal',
    nextScheduledSequence: 1 as const,
    scheduledGrossAmount: 0 as const,
    actualQualifyingGrossAmount: 0 as const,
  }
  const openingStateEvidence = {
    ...openingLineage,
    openingStateEvidenceId:
      `owned-ira-sepp-annual-opening-state:${JSON.stringify([
        openingLineage,
      ])}`,
  }
  return {
    sourceAccountId: requestedSourceId,
    electionId: 'plan-sepp-election',
    scheduleId: 'plan-sepp-schedule',
    annualReconciliationInput: {
      sourceEvidence: {
        predicate: 'ownedNonRothIraSeppSource',
        sourceAccountId: requestedSourceId,
        ownerPersonId,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: 'traditional',
        accountOwnershipEvidenceId,
        iraClassificationEvidenceId,
        sourceEvidenceId: 'plan-sepp-source',
      },
      electionEvidence: {
        predicate: 'ownedNonRothIraSeppElection',
        electionId: 'plan-sepp-election',
        scheduleId: 'plan-sepp-schedule',
        participantPersonId: ownerPersonId,
        sourceAccountId: requestedSourceId,
        subtype: 'traditional',
        electionStartDate: '2030-01-01',
        method: 'fixedAmortization',
        electionEvidenceId: 'plan-sepp-election-evidence',
      },
      annualScheduleEvidence: {
        predicate: 'ownedNonRothIraSeppAnnualSchedule',
        electionId: 'plan-sepp-election',
        scheduleId: 'plan-sepp-schedule',
        participantPersonId: ownerPersonId,
        sourceAccountId: requestedSourceId,
        taxYear: 2030,
        annualScheduledGrossAmount: asUsdCents(10_000),
        annualScheduleEvidenceId: 'plan-sepp-annual-schedule',
      },
      noModificationEvidence: {
        predicate:
          'noDisqualifyingOwnedNonRothIraSeppModificationThroughDate',
        electionId: 'plan-sepp-election',
        scheduleId: 'plan-sepp-schedule',
        participantPersonId: ownerPersonId,
        sourceAccountId: requestedSourceId,
        throughDate: '2030-12-31',
        disqualifyingModification: 'none',
        noModificationEvidenceId: 'plan-sepp-no-modification',
      },
      openingStateEvidence,
      priorElectionHistoryEvidence:
        buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
          predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
          electionId: 'plan-sepp-election',
          scheduleId: 'plan-sepp-schedule',
          participantPersonId: ownerPersonId,
          sourceAccountId: requestedSourceId,
          historyThroughDate: '2029-12-31',
          terminalStateEvidenceId: 'plan-sepp-prior-terminal',
          usedDistributionEvidenceIds: [],
        }),
      payments: [{
        currentPaymentEvidence: {
          predicate: 'ownedNonRothIraSeppCurrentScheduledPayment',
          electionId: 'plan-sepp-election',
          scheduleId: 'plan-sepp-schedule',
          actionId,
          allocationId: asAllocationId('allocation-requested'),
          sourceAccountId: requestedSourceId,
          distributionDate: '2030-06-15',
          currentDistributionEvidenceId:
            distributionDateEvidenceId,
          paymentSequence: 1,
          previousScheduleStateId:
            openingStateEvidence.openingStateEvidenceId,
          currentScheduledGrossAmount: asUsdCents(10_000),
          paymentScheduleEvidenceId: 'plan-sepp-payment-schedule',
        },
      }],
    },
  }
}

describe('Plan-owned non-Roth IRA annual coordinator', () => {
  it('binds one requested account to the complete two-account pool with explicit empty line 8', () => {
    const result = successful()
    expect(result.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome)
      .toBe('age59HalfReached')
    expect(result.annualEvidence.characterization.annualBasisEvidence.poolMembers
      .map((member) => member.sourceAccountId))
      .toEqual([requestedSourceId, siblingSourceId])
    expect(result.annualEvidence.characterization.line8AllocationEvidence.allocations)
      .toEqual([])
    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
  })

  it('fail-closes when the unrequested sibling lacks its Plan classification', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.retirementActionEligibilityFacts!.iraClassifications =
      valuePlan.retirementActionEligibilityFacts!.iraClassifications.filter(
        (classification) => classification.sourceAccountId !== siblingSourceId,
      )

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('iraClassificationMissing')
    expect(result.movementCandidate).toBeNull()
  })

  it.each([
    {
      name: 'missing',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.openingBalanceEvidence = value.openingBalanceEvidence.slice(1)
      },
      issue: 'openingBalanceEvidenceMissing',
    },
    {
      name: 'duplicate',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        const first = value.openingBalanceEvidence[0]!
        value.openingBalanceEvidence = [
          ...value.openingBalanceEvidence,
          {
            ...first,
            evidenceId: 'opening-duplicate',
            upstreamEvidenceId: 'opening-duplicate-upstream',
          },
        ]
      },
      issue: 'openingBalanceEvidenceDuplicate',
    },
    {
      name: 'extra',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        const first = value.openingBalanceEvidence[0]!
        value.openingBalanceEvidence = [
          ...value.openingBalanceEvidence,
          {
            ...first,
            sourceAccountId: asAccountId('foreign-ira'),
            evidenceId: 'opening-foreign',
            upstreamEvidenceId: 'opening-foreign-upstream',
          },
        ]
      },
      issue: 'openingBalanceEvidenceForeign',
    },
    {
      name: 'wrong phase/date',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        const first = value.openingBalanceEvidence[0]!
        value.openingBalanceEvidence = [
          { ...first, asOfDate: '2030-01-02' },
          ...value.openingBalanceEvidence.slice(1),
        ]
      },
      issue: 'openingBalanceEvidenceBindingMismatch',
    },
  ])('returns typed inventory issues for $name opening snapshot evidence', ({ alter, issue }) => {
    const value = input()
    alter(value)

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain(issue)
    expect(result.movementCandidate).toBeNull()
  })

  it('rejects a Plan action that atomically mixes an owned IRA and another source', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.accounts.push(cashAccount('cash-source', 100))
    const request = valuePlan.strategies.retirementActions[0]!
    if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    request.requestedAmount = asPositiveUsdCents(15_000)
    request.allocations.push({
      allocationId: asAllocationId('allocation-cash'),
      sourceAccountId: asAccountId('cash-source'),
      requestedAmount: asPositiveUsdCents(5_000),
    })

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('mixedSourceAction')
    expect(result.movementCandidate).toBeNull()
  })

  it('returns a typed issue when the Plan action predates its owner', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '2031-01-01'

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('planActionDateBeforeOwnerBirth')
    expect(result.movementCandidate).toBeNull()
  })

  it('does not infer pre-birth chronology from a malformed action date', () => {
    const value = input()
    const request = (value.plan as Plan).strategies.retirementActions[0]!
    if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    request.executionDate = ''
    value.personAliveEvidence = [{
      ...value.personAliveEvidence[0]!,
      actionDate: '',
    }]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('physicalEligibilityBlocked')
    expect(issueKinds(result)).not.toContain('planActionDateBeforeOwnerBirth')
    expect(result.movement).toBe('notCommitted')
  })

  it('treats an undated action as year-end for an owner born during the year', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '2030-06-01'
    const request = valuePlan.strategies.retirementActions[0]!
    if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    delete request.executionDate
    value.personAliveEvidence = [{
      ...value.personAliveEvidence[0]!,
      actionDate: null,
    }]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('scheduleInvalid')
    expect(issueKinds(result)).not.toContain('planActionDateBeforeOwnerBirth')
    expect(result.movement).toBe('notCommitted')
  })

  it('blocks an undated action when the owner is born after the action year', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '2031-01-01'
    const request = valuePlan.strategies.retirementActions[0]!
    if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    delete request.executionDate
    value.personAliveEvidence = [{
      ...value.personAliveEvidence[0]!,
      actionDate: null,
    }]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('planActionDateBeforeOwnerBirth')
    expect(result.movementCandidate).toBeNull()
  })

  it.each([
    {
      name: 'missing year-end sibling',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.slice(0, 1)
      },
      issue: 'yearEndBalanceEvidenceMissing',
    },
    {
      name: 'reused evidence ID',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.map(
          (evidence, index) => index === 0
            ? { ...evidence, evidenceId: value.openingBalanceEvidence[0]!.evidenceId }
            : evidence,
        )
      },
      issue: 'evidenceIdReused',
    },
    {
      name: 'foreign line-8 source',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [{
            actionId: asActionId('conversion-2030'),
            allocationId: asAllocationId('conversion-allocation'),
            sourceAccountId: asAccountId('foreign-ira'),
            scheduledDate: '2030-07-01',
            scheduledSequence: 1,
            grossAmount: asUsdCents(1_000),
          }],
        }
      },
      issue: 'line8EntryForeign',
    },
    {
      name: 'invalid line-8 sequence',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [{
            actionId: asActionId('conversion-2030'),
            allocationId: asAllocationId('conversion-allocation'),
            sourceAccountId: requestedSourceId,
            scheduledDate: '2030-07-01',
            scheduledSequence: 0,
            grossAmount: asUsdCents(1_000),
          }],
        }
      },
      issue: 'line8InventoryEvidenceBindingMismatch',
    },
    {
      name: 'different line-8 actions share one schedule position',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [
            {
              actionId: asActionId('conversion-one'),
              allocationId: asAllocationId('conversion-one-allocation'),
              sourceAccountId: requestedSourceId,
              scheduledDate: '2030-07-01',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
            {
              actionId: asActionId('conversion-two'),
              allocationId: asAllocationId('conversion-two-allocation'),
              sourceAccountId: siblingSourceId,
              scheduledDate: '2030-07-01',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
          ],
        }
      },
      issue: 'line8InventoryEvidenceBindingMismatch',
    },
    {
      name: 'one line-8 action spans different schedule positions',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [
            {
              actionId: asActionId('conversion-one'),
              allocationId: asAllocationId('conversion-one-first'),
              sourceAccountId: requestedSourceId,
              scheduledDate: '2030-07-01',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
            {
              actionId: asActionId('conversion-one'),
              allocationId: asAllocationId('conversion-one-second'),
              sourceAccountId: siblingSourceId,
              scheduledDate: '2030-07-02',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
          ],
        }
      },
      issue: 'line8InventoryEvidenceBindingMismatch',
    },
    {
      name: 'line-8 action reuses a line-7 action identity',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [{
            actionId,
            allocationId: asAllocationId('conversion-allocation'),
            sourceAccountId: siblingSourceId,
            scheduledDate: '2030-07-01',
            scheduledSequence: 1,
            grossAmount: asUsdCents(1_000),
          }],
        }
      },
      issue: 'annualActivityConflict',
    },
    {
      name: 'line-8 action shares a line-7 schedule position',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [{
            actionId: asActionId('conversion-one'),
            allocationId: asAllocationId('conversion-allocation'),
            sourceAccountId: siblingSourceId,
            scheduledDate: '2030-06-15',
            scheduledSequence: 1,
            grossAmount: asUsdCents(1_000),
          }],
        }
      },
      issue: 'annualActivityConflict',
    },
    {
      name: 'one line-8 action allocates one source twice',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          entries: [
            {
              actionId: asActionId('conversion-one'),
              allocationId: asAllocationId('conversion-first'),
              sourceAccountId: requestedSourceId,
              scheduledDate: '2030-07-01',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
            {
              actionId: asActionId('conversion-one'),
              allocationId: asAllocationId('conversion-second'),
              sourceAccountId: requestedSourceId,
              scheduledDate: '2030-07-01',
              scheduledSequence: 1,
              grossAmount: asUsdCents(500),
            },
          ],
        }
      },
      issue: 'annualActivityConflict',
    },
    {
      name: 'different ledger run',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.line8InventoryEvidence = {
          ...value.line8InventoryEvidence,
          ledgerRunId: 'different-ledger-run',
        }
      },
      issue: 'ledgerRunMismatch',
    },
  ])('fail-closes for $name', ({ alter, issue }) => {
    const value = input()
    alter(value)

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain(issue)
    expect(result.movementCandidate).toBeNull()
  })

  it('fail-closes when the complete pool aggregate exceeds safe cents', () => {
    const value = input()
    value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.map(
      (evidence) => ({
        ...evidence,
        yearEndApplicableBalanceAmount:
          asUsdCents(Number.MAX_SAFE_INTEGER),
      }),
    )

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('aggregateAmountOverflow')
    expect(result.movementCandidate).toBeNull()
  })

  it('fail-closes when the annual basis denominator exceeds safe cents', () => {
    const value = input()
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      outstandingRolloverAmount:
        asUsdCents(Number.MAX_SAFE_INTEGER),
    }

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('aggregateAmountOverflow')
    expect(result.movementCandidate).toBeNull()
  })

  it('fail-closes when the Plan owner age-59½ date is unrepresentable', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '9999-01-01'

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('penaltyAgeThresholdInvalid')
    expect(result.movementCandidate).toBeNull()
  })

  it.each([
    {
      name: 'post-year exclusions exceed nondeductible contributions',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.annualBasisEvidence = {
          ...value.annualBasisEvidence,
          postYearNondeductibleContributionExcludedAmount:
            asUsdCents(1),
        }
      },
    },
    {
      name: 'rollover repayment exceeds year-end value plus rollovers',
      alter: (value: CoordinatePlanOwnedNonRothIraAnnualWithdrawalCandidateInput) => {
        value.annualBasisEvidence = {
          ...value.annualBasisEvidence,
          rolloverRepaymentAdjustmentAmount: asUsdCents(90_001),
        }
      },
    },
  ])('returns a typed issue when $name', ({ alter }) => {
    const value = input()
    alter(value)

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('annualBasisEvidenceInvalid')
    expect(result.movementCandidate).toBeNull()
  })

  it.each([
    {
      name: 'missing',
      evidence: [],
    },
    {
      name: 'false',
      evidence: [{
        evidenceId: 'alive-action',
        actionId,
        personId: ownerPersonId,
        actionYear: 2030,
        actionDate: '2030-06-15',
        alive: false,
      }],
    },
    {
      name: 'foreign',
      evidence: [{
        evidenceId: 'alive-foreign',
        actionId: asActionId('foreign-action'),
        personId: ownerPersonId,
        actionYear: 2030,
        actionDate: '2030-06-15',
        alive: true,
      }],
    },
    {
      name: 'stale date',
      evidence: [{
        evidenceId: 'alive-action',
        actionId,
        personId: ownerPersonId,
        actionYear: 2030,
        actionDate: '2030-06-14',
        alive: true,
      }],
    },
  ])('blocks physical eligibility for $name alive evidence', ({ evidence }) => {
    const value = input()
    value.personAliveEvidence = evidence

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('physicalEligibilityBlocked')
    expect(result.movementCandidate).toBeNull()
    expect(result.sourceInventoryEvidenceId).toBeNull()
  })

  it('canonicalizes Plan/account/classification/snapshot permutations byte-identically', () => {
    const forwardInput = input()
    const forwardPlan = forwardInput.plan as Plan
    const forwardAction = forwardPlan.strategies.retirementActions[0]!
    if (forwardAction.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    forwardAction.allocations = [
      {
        allocationId: asAllocationId('allocation-b'),
        sourceAccountId: siblingSourceId,
        requestedAmount: asPositiveUsdCents(6_000),
      },
      {
        allocationId: asAllocationId('allocation-a'),
        sourceAccountId: requestedSourceId,
        requestedAmount: asPositiveUsdCents(4_000),
      },
    ]
    forwardInput.openingBalanceEvidence = forwardInput.openingBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === siblingSourceId
        ? { ...evidence, openingBalanceAmount: asUsdCents(10_000) }
        : evidence,
    )
    forwardInput.yearEndBalanceEvidence = forwardInput.yearEndBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === siblingSourceId
        ? { ...evidence, yearEndApplicableBalanceAmount: asUsdCents(4_000) }
        : evidence,
    )
    const reversedInput = clone(forwardInput)
    const reversedPlan = reversedInput.plan as Plan
    reversedPlan.accounts.reverse()
    reversedPlan.retirementActionEligibilityFacts!.iraClassifications.reverse()
    reversedPlan.strategies.retirementActions.reverse()
    const reversedAction = reversedPlan.strategies.retirementActions[0]!
    if (reversedAction.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    reversedAction.allocations.reverse()
    reversedInput.openingBalanceEvidence = [
      ...reversedInput.openingBalanceEvidence,
    ].reverse()
    reversedInput.yearEndBalanceEvidence = [
      ...reversedInput.yearEndBalanceEvidence,
    ].reverse()
    const originalAlive = reversedInput.personAliveEvidence[0]!
    const reorderedAliveWithIgnoredMetadata = {
      alive: originalAlive.alive,
      actionDate: originalAlive.actionDate,
      actionYear: originalAlive.actionYear,
      personId: originalAlive.personId,
      actionId: originalAlive.actionId,
      evidenceId: originalAlive.evidenceId,
      callerMetadata: 'not part of the evidence contract',
    }
    reversedInput.personAliveEvidence = [reorderedAliveWithIgnoredMetadata]

    expect(successful(reversedInput)).toEqual(successful(forwardInput))
  })

  it('uses semantic fixed-width IDs, binds material lineage, and ignores Plan display metadata', () => {
    const baseline = successful()
    expect(baseline.sourceInventoryEvidenceId)
      .toMatch(/^owned-ira-plan-source-inventory:[0-9a-f]{64}$/)
    expect(baseline.physicalEligibilityEvidenceId)
      .toMatch(/^owned-ira-plan-physical-eligibility:[0-9a-f]{64}$/)
    expect(baseline.planOwnedIraCandidateEvidenceId)
      .toMatch(/^owned-ira-plan-annual-candidate:[0-9a-f]{64}$/)

    const snapshotChanged = input()
    snapshotChanged.openingBalanceEvidence = snapshotChanged.openingBalanceEvidence.map(
      (evidence, index) => index === 0
        ? { ...evidence, openingBalanceAmount: asUsdCents(100_001) }
        : evidence,
    )
    const snapshotResult = successful(snapshotChanged)
    expect(snapshotResult.sourceInventoryEvidenceId)
      .not.toBe(baseline.sourceInventoryEvidenceId)
    expect(snapshotResult.physicalEligibilityEvidenceId)
      .toBe(baseline.physicalEligibilityEvidenceId)
    expect(snapshotResult.planOwnedIraCandidateEvidenceId)
      .not.toBe(baseline.planOwnedIraCandidateEvidenceId)

    const aliveChanged = input()
    aliveChanged.personAliveEvidence = [{
      ...aliveChanged.personAliveEvidence[0]!,
      evidenceId: 'alive-action-reissued',
    }]
    const aliveResult = successful(aliveChanged)
    expect(aliveResult.sourceInventoryEvidenceId)
      .toBe(baseline.sourceInventoryEvidenceId)
    expect(aliveResult.physicalEligibilityEvidenceId)
      .not.toBe(baseline.physicalEligibilityEvidenceId)
    expect(aliveResult.planOwnedIraCandidateEvidenceId)
      .not.toBe(baseline.planOwnedIraCandidateEvidenceId)

    const metadataChanged = input()
    const metadataPlan = metadataChanged.plan as Plan
    metadataPlan.name = 'Completely different display name'
    metadataPlan.updatedAtIso = '2040-05-06T12:30:00.000Z'
    const metadataAccount = metadataPlan.accounts[0]!
    if (metadataAccount.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    metadataAccount.balance = 9_999_999
    const metadataResult = successful(metadataChanged)
    expect({
      source: metadataResult.sourceInventoryEvidenceId,
      physical: metadataResult.physicalEligibilityEvidenceId,
      outer: metadataResult.planOwnedIraCandidateEvidenceId,
    }).toEqual({
      source: baseline.sourceInventoryEvidenceId,
      physical: baseline.physicalEligibilityEvidenceId,
      outer: baseline.planOwnedIraCandidateEvidenceId,
    })
  })

  it('deep-freezes detached outputs without freezing caller inputs', () => {
    const value = input()
    const result = successful(value)
    const before = JSON.stringify(result)

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.annualEvidence)).toBe(true)
    expect(Object.isFrozen(result.annualEvidence.characterization.annualBasisEvidence.poolMembers))
      .toBe(true)
    expect(Object.isFrozen(value)).toBe(false)
    expect(Object.isFrozen(value.openingBalanceEvidence)).toBe(false)

    ;(value.plan as Plan).name = 'mutated after coordination'
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence) => ({ ...evidence, openingBalanceAmount: asUsdCents(777) }),
    )
    expect(JSON.stringify(result)).toBe(before)
  })

  it('requires the annual line-7 record to name the exact canonical Plan action set', () => {
    const value = input()
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      includedPlanActionIds: [asActionId('different-action')],
    }

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('line7ActionSetMismatch')
  })

  it('canonicalizes schema-valid explicit undefined optionals before hashing', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    const classification = valuePlan.retirementActionEligibilityFacts!
      .iraClassifications[0]!
    classification.provenance.sourceId = undefined
    const request = valuePlan.strategies.retirementActions[0]!
    request.provenance.sourceId = undefined
    request.provenance.scenarioId = undefined
    if (request.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    request.purpose.referenceId = undefined

    expect(successful(value)).toEqual(successful())
  })

  it('rejects caller penalty evidence IDs that collide with another evidence kind', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
    value.qualifiedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: ownerPersonId,
      disabilityQualificationDate: '2029-01-01',
      evaluationDate: '2030-06-15',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: value.openingBalanceEvidence[0]!.evidenceId,
    }]

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('evidenceIdReused')
  })

  it('rejects caller evidence IDs that collide with generated wrapper evidence', () => {
    const baseline = successful()
    const generatedOwnershipId =
      baseline.annualEvidence.characterization.annualBasisEvidence
        .poolMembers.find(
          (member) => member.sourceAccountId === requestedSourceId,
        )!.accountOwnershipEvidenceId
    const value = input()
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === requestedSourceId
        ? { ...evidence, evidenceId: generatedOwnershipId }
        : evidence,
    )

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('evidenceIdReused')
    expect(result.movementCandidate).toBeNull()
  })

  it('rejects caller evidence IDs that replay an inner finalization ID', () => {
    const baseline = successful()
    const value = input()
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === siblingSourceId
        ? {
            ...evidence,
            evidenceId:
              baseline.annualEvidence.finalizationEvidenceId,
          }
        : evidence,
    )

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('evidenceIdReused')
    expect(result.movementCandidate).toBeNull()
  })

  it('returns a typed issue when a genuinely required SIMPLE start date is absent', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '1980-01-01'
    classifyRequestedSourceAsSimple(value)

    const result = coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('simpleParticipationEvidenceMissing')
    expect(result.movementCandidate).toBeNull()
  })

  it.each([
    ['initial two-year', '2029-01-01', 4],
    ['standard after two years', '2020-01-01', 10],
  ] as const)(
    'derives the %s SIMPLE rate from the Plan participation date',
    (_name, participationStartDate, denominator) => {
      const value = input()
      ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
      classifyRequestedSourceAsSimple(value, participationStartDate)

      const result =
        coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

      expect(result.status).toBe('annualEvidenceBlocked')
      if (result.status !== 'annualEvidenceBlocked') return
      expect(result.issues[0]?.prerequisite).toMatchObject({
        subtype: 'simple',
        rateEvidence: {
          kind: 'simpleIraParticipationRate',
          denominator,
        },
      })
    },
  )

  it.each([
    ['before the owner birth date', '1979-12-31'],
    ['after the distribution date', '2030-06-16'],
  ] as const)(
    'returns a typed issue for a SIMPLE start date %s',
    (_name, participationStartDate) => {
      const value = input()
      ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
      classifyRequestedSourceAsSimple(value, participationStartDate)

      const result =
        coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

      expect(result.status).toBe('sourceInventoryIncomplete')
      expect(issueKinds(result)).toContain(
        'simpleParticipationEvidenceInvalid',
      )
      expect(result.movementCandidate).toBeNull()
    },
  )

  it('attributes an invalid SIMPLE date only to the offending source', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '1980-01-01'
    classifyRequestedSourceAsSimple(value, '2020-01-01')
    const siblingClassification =
      valuePlan.retirementActionEligibilityFacts!.iraClassifications.find(
        (classification) =>
          classification.sourceAccountId === siblingSourceId,
      )!
    valuePlan.retirementActionEligibilityFacts!.iraClassifications = [
      ...valuePlan.retirementActionEligibilityFacts!.iraClassifications.filter(
        (classification) =>
          classification.sourceAccountId !== siblingSourceId,
      ),
      {
        sourceAccountId: siblingSourceId,
        subtype: 'simple',
        evidenceId: siblingClassification.evidenceId,
        provenance: siblingClassification.provenance,
        simpleParticipationStartDate: '1979-12-31',
      },
    ]
    const siblingActionId = asActionId('withdrawal-sibling-2030')
    valuePlan.strategies.retirementActions.push({
      actionId: siblingActionId,
      kind: 'ordinaryWithdrawal',
      personId: ownerPersonId,
      year: 2030,
      executionDate: '2030-07-15',
      executionSequence: 2,
      requestedAmount: asPositiveUsdCents(10_000),
      allocations: [{
        allocationId: asAllocationId('allocation-sibling'),
        sourceAccountId: siblingSourceId,
        requestedAmount: asPositiveUsdCents(10_000),
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === siblingSourceId
        ? { ...evidence, openingBalanceAmount: asUsdCents(10_000) }
        : evidence,
    )
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      includedPlanActionIds: [actionId, siblingActionId],
    }
    value.personAliveEvidence = [
      ...value.personAliveEvidence,
      {
        evidenceId: 'alive-sibling-action',
        actionId: siblingActionId,
        personId: ownerPersonId,
        actionYear: 2030,
        actionDate: '2030-07-15',
        alive: true,
      },
    ]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    if (result.status !== 'sourceInventoryIncomplete') return
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: 'simpleParticipationEvidenceInvalid',
        sourceAccountId: siblingSourceId,
      }),
    ])
    expect(result.movementCandidate).toBeNull()
  })

  it('preserves disability precedence without requiring a SIMPLE participation date', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
    classifyRequestedSourceAsSimple(value)
    value.qualifiedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: ownerPersonId,
      disabilityQualificationDate: '2029-01-01',
      evaluationDate: '2030-06-15',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'qualified-disability',
    }]

    const result = successful(value)

    expect(result.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome)
      .toBe('disabilityQualified')
  })

  it('fail-closes irrelevant caller disability evidence after age 59½', () => {
    const value = input()
    value.qualifiedDisabilityEvidence = [{
      kind: 'disability',
      disabledPersonId: ownerPersonId,
      disabilityQualificationDate: '2029-01-01',
      evaluationDate: '2030-06-15',
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId: 'irrelevant-qualified-disability',
    }]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('penaltyEvidenceInvalid')
    expect(result.movementCandidate).toBeNull()
  })

  it('preserves a complete qualified-SEPP route and its repeated state references', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
    const pending =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)
    expect(pending.status).toBe('annualEvidenceBlocked')
    if (pending.status !== 'annualEvidenceBlocked') return
    const coverage = pending.issues[0]!.prerequisite.characterCoverage
    value.iraSeppScheduleRoutes = [qualifiedSeppRoute(
      coverage.sourceEvidenceIds.distributionDateEvidenceId,
      coverage.sourceEvidenceIds.accountOwnershipEvidenceId,
      coverage.sourceEvidenceIds.iraClassificationEvidenceId,
    )]

    const result = successful(value)

    expect(result.annualEvidence.penaltyPrerequisites.evaluations[0]?.outcome)
      .toBe('iraSeppQualified')
    expect(
      result.annualEvidence.penaltyPrerequisites
        .iraSeppScheduleReconciliations[0]?.reconciliation.status,
    ).toBe('reconciled')
  })

  it('rejects a nested SEPP lifetime evidence ID that reuses an outer ID', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
    const pending =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)
    expect(pending.status).toBe('annualEvidenceBlocked')
    if (pending.status !== 'annualEvidenceBlocked') return
    const coverage = pending.issues[0]!.prerequisite.characterCoverage
    const route = qualifiedSeppRoute(
      coverage.sourceEvidenceIds.distributionDateEvidenceId,
      coverage.sourceEvidenceIds.accountOwnershipEvidenceId,
      coverage.sourceEvidenceIds.iraClassificationEvidenceId,
    )
    value.iraSeppScheduleRoutes = [{
      ...route,
      annualReconciliationInput: {
        ...route.annualReconciliationInput,
        priorElectionHistoryEvidence:
          buildOwnedNonRothIraSeppCompletePriorElectionHistoryEvidence({
            predicate: 'completeOwnedNonRothIraSeppPriorElectionHistory',
            electionId: 'plan-sepp-election',
            scheduleId: 'plan-sepp-schedule',
            participantPersonId: ownerPersonId,
            sourceAccountId: requestedSourceId,
            historyThroughDate: '2029-12-31',
            terminalStateEvidenceId: 'plan-sepp-prior-terminal',
            usedDistributionEvidenceIds: [
              value.openingBalanceEvidence[0]!.evidenceId,
            ],
          }),
      },
    }]

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('evidenceIdReused')
    expect(result.movementCandidate).toBeNull()
  })

  it('claims qualified SEPP coverage IDs even when another source remains blocked', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.household.people[0]!.dob = '1980-01-01'
    const siblingActionId = asActionId('withdrawal-sibling-2030')
    valuePlan.strategies.retirementActions.push({
      actionId: siblingActionId,
      kind: 'ordinaryWithdrawal',
      personId: ownerPersonId,
      year: 2030,
      executionDate: '2030-07-15',
      executionSequence: 2,
      requestedAmount: asPositiveUsdCents(10_000),
      allocations: [{
        allocationId: asAllocationId('allocation-sibling'),
        sourceAccountId: siblingSourceId,
        requestedAmount: asPositiveUsdCents(10_000),
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })
    value.openingBalanceEvidence = value.openingBalanceEvidence.map(
      (evidence) => evidence.sourceAccountId === siblingSourceId
        ? { ...evidence, openingBalanceAmount: asUsdCents(10_000) }
        : evidence,
    )
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      includedPlanActionIds: [actionId, siblingActionId],
    }
    value.personAliveEvidence = [
      ...value.personAliveEvidence,
      {
        evidenceId: 'alive-sibling-action',
        actionId: siblingActionId,
        personId: ownerPersonId,
        actionYear: 2030,
        actionDate: '2030-07-15',
        alive: true,
      },
    ]
    const pending =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)
    expect(pending.status).toBe('annualEvidenceBlocked')
    if (pending.status !== 'annualEvidenceBlocked') return
    const requestedCoverage = pending.issues.find(
      (issue) => issue.sourceAccountId === requestedSourceId,
    )!.prerequisite.characterCoverage
    value.iraSeppScheduleRoutes = [qualifiedSeppRoute(
      requestedCoverage.sourceEvidenceIds.distributionDateEvidenceId,
      requestedCoverage.sourceEvidenceIds.accountOwnershipEvidenceId,
      requestedCoverage.sourceEvidenceIds.iraClassificationEvidenceId,
    )]
    const baseline =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(value)
    expect(baseline.status).toBe('annualEvidenceBlocked')
    if (baseline.status !== 'annualEvidenceBlocked') return
    const reconciliation =
      baseline.iraSeppScheduleReconciliations[0]?.reconciliation
    expect(reconciliation?.status).toBe('reconciled')
    if (reconciliation?.status !== 'reconciled') return
    const qualifiedCoverageId =
      reconciliation.evidence.distributionInventory
        .characterCoverages[0]!.evidenceId
    const colliding = clone(value)
    colliding.openingBalanceEvidence =
      colliding.openingBalanceEvidence.map((evidence) =>
        evidence.sourceAccountId === siblingSourceId
          ? { ...evidence, evidenceId: qualifiedCoverageId }
          : evidence,
      )

    const result =
      coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate(colliding)

    expect(result.status).toBe('sourceInventoryIncomplete')
    expect(issueKinds(result)).toContain('evidenceIdReused')
    expect(result.movementCandidate).toBeNull()
  })

  it('preserves all-basis-return precedence without requiring a SIMPLE participation date', () => {
    const value = input()
    ;(value.plan as Plan).household.people[0]!.dob = '1980-01-01'
    classifyRequestedSourceAsSimple(value)
    value.yearEndBalanceEvidence = value.yearEndBalanceEvidence.map(
      (evidence) => ({
        ...evidence,
        yearEndApplicableBalanceAmount: asUsdCents(0),
      }),
    )
    value.annualBasisEvidence = {
      ...value.annualBasisEvidence,
      openingBasisAmount: asUsdCents(10_000),
    }

    const result = successful(value)

    expect(result.annualEvidence.penaltyPrerequisites.evaluations).toEqual([])
    expect(result.annualEvidence.penaltyPrerequisites.coverage).toEqual([
      expect.objectContaining({
        executedAmount: 10_000,
        basisReturnExcludedAmount: 10_000,
        ordinaryIncomeExposureAmount: 0,
      }),
    ])
  })

  it('does not require SIMPLE participation evidence after the Plan owner reaches age 59½', () => {
    const value = input()
    classifyRequestedSourceAsSimple(value)

    expect(successful(value).annualEvidence.penaltyPrerequisites.evaluations[0]
      ?.outcome).toBe('age59HalfReached')
  })
})
