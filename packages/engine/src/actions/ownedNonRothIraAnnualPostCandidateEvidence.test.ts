import { describe, expect, it } from 'vitest'

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
import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import {
  stageOwnedNonRothIraOrdinaryWithdrawalMovements,
  type StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput,
} from './ownedNonRothIraMovementCandidate.js'
import { deriveActionStructuralId } from './structuralId.js'
import {
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'

const owner = asPersonId('p1')
const siblingOwner = asPersonId('p2')
const planId = asPlanId('post-candidate-plan')
const requestedIra = asAccountId('ira-requested')
const siblingIra = asAccountId('ira-unrequested')
const employer = asAccountId('employer-plan')
const inherited = asAccountId('inherited-ira')

type MutableObject<T> = { -readonly [Key in keyof T]: T[Key] }

type ImmutableInput =
  BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput

type MutableInput = MutableObject<
  Omit<
    ImmutableInput,
    | 'inventoryInput'
    | 'movementInput'
    | 'postCandidateSnapshot'
    | 'annualBasisRecord'
    | 'postYearContributionWindow'
  >
> & {
  inventoryInput: MutableObject<ImmutableInput['inventoryInput']>
  movementInput: MutableObject<ImmutableInput['movementInput']>
  postCandidateSnapshot: MutableObject<ImmutableInput['postCandidateSnapshot']>
  annualBasisRecord: MutableObject<ImmutableInput['annualBasisRecord']>
  postYearContributionWindow: MutableObject<
    ImmutableInput['postYearContributionWindow']
  >
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.accounts = [
    traditionalAccount(requestedIra, 100, owner),
    traditionalAccount(siblingIra, 200, owner),
    traditionalAccount(employer, 300, owner, 'employer'),
    {
      type: 'traditional',
      id: inherited,
      name: 'Inherited IRA',
      ownerPersonId: owner,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 400,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2028, decedentHadStartedRmds: true },
    },
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [
      {
        sourceAccountId: requestedIra,
        subtype: 'traditional',
        evidenceId: 'classification-requested',
        provenance: { source: 'manual' },
      },
      {
        sourceAccountId: siblingIra,
        subtype: 'sep',
        evidenceId: 'classification-sibling',
        provenance: { source: 'manual' },
      },
    ],
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
      sourceAccountId: requestedIra,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return value
}

function base(opening = 10_000): MutableInput {
  const valuePlan = plan()
  const inventoryInput = {
    plan: valuePlan,
    taxYear: 2030,
    runtimeRecords: [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty' as const,
      resolvedEventIds: [],
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
  const ownership = deriveActionStructuralId('owned-ira-plan-account-ownership', [
    planId, owner, requestedIra, 'traditional', 'ira', 'owned',
  ])
  const request = valuePlan.strategies.retirementActions[0]!
  if (request.kind !== 'ordinaryWithdrawal') throw new Error('fixture action drift')
  const movementInput: StageOwnedNonRothIraOrdinaryWithdrawalMovementsInput = {
    ownerPersonId: owner,
    taxYear: 2030,
    requests: [request],
    openingBalances: [{ accountId: requestedIra, openingBalance: asUsdCents(opening) }],
    sourceEvidence: [{
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource' as const,
      sourceAccountId: requestedIra,
      ownerPersonId: owner,
      accountType: 'traditional' as const,
      accountKind: 'ira' as const,
      inheritanceStatus: 'owned' as const,
      subtype: 'traditional' as const,
      accountOwnershipEvidenceId: ownership,
      iraClassificationEvidenceId: 'classification-requested',
    }],
  }
  const candidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  if (candidate.status !== 'movementCandidateStaged') throw new Error('fixture schedule invalid')
  // Inventory ID is deterministic, but obtain it from the dedicated builder's
  // dependency to keep this fixture independent of hash details.
  const builtInventory = buildAnnualRetirementPhysicalEventInventory(inventoryInput)
  if (builtInventory.status !== 'annualPhysicalEventInventoryBuilt') throw new Error('fixture inventory invalid')
  const result: BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput = {
    inventoryInput,
    movementInput,
    movementCandidate: candidate,
    postCandidateSnapshot: {
      predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryEvidenceId: builtInventory.inventoryEvidenceId,
      movementCandidateId: candidate.movementCandidateId,
      applicationStatus: 'canonicalMovementCandidateAppliedExactlyOnce',
      allocationApplications: candidate.actions.flatMap((action) =>
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
          applicationEvidenceId: `application-${action.actionId}-${allocation.allocationId}`,
          upstreamEvidenceId: `application-${action.actionId}-${allocation.allocationId}-upstream`,
        }))),
      candidateBalances: candidate.candidateBalances.map((balance) => ({
        ...balance,
        evidenceId: `candidate-balance-${balance.sourceAccountId}`,
        upstreamEvidenceId: `candidate-balance-${balance.sourceAccountId}-upstream`,
      })),
      yearEndApplicableBalances: [
        yearEnd(requestedIra, 0, 'requested'),
        yearEnd(siblingIra, 20_000, 'sibling'),
      ],
      evidenceId: 'post-candidate-snapshot',
      upstreamEvidenceId: 'post-candidate-snapshot-upstream',
    },
    annualBasisRecord: {
      predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete',
      openingBasisAmount: asUsdCents(4_000),
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
      evidenceId: 'annual-basis-record',
      upstreamEvidenceId: 'annual-basis-record-upstream',
    },
    postYearContributionWindow: {
      predicate: 'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      deadlineEvidence: {
        predicate: 'federalIraContributionDeadlineForTaxYear',
        designatedTaxYear: 2030,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished',
        deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
        calendarAdjustmentStatus: 'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
        deadlineDate: '2031-04-15',
        evidenceId: 'contribution-deadline',
        upstreamEvidenceId: 'contribution-deadline-upstream',
      },
      contributions: [{
        contributionId: 'post-year-contribution',
        planId,
        ownerPersonId: owner,
        sourceAccountId: siblingIra,
        designatedTaxYear: 2030,
        contributionDate: '2031-02-01',
        nondeductibleContributionAmount: asPositiveUsdCents(2_500),
        evidenceId: 'post-year-contribution-evidence',
        upstreamEvidenceId: 'post-year-contribution-upstream',
      }],
      evidenceId: 'contribution-window',
      upstreamEvidenceId: 'contribution-window-upstream',
    },
  }
  return structuredClone(result) as unknown as MutableInput
}

function yearEnd(sourceAccountId: typeof requestedIra, amount: number, suffix: string) {
  return {
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId,
    ownerPersonId: owner,
    sourceAccountId,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    ledgerPhase: 'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
    asOfDate: '2030-12-31',
    yearEndApplicableBalanceAmount: asUsdCents(amount),
    evidenceId: `year-end-${suffix}`,
    upstreamEvidenceId: `year-end-${suffix}-upstream`,
  }
}

function clone(): MutableInput {
  return structuredClone(base())
}

function refreshInventoryAndCandidate(value: MutableInput): void {
  const inventory = buildAnnualRetirementPhysicalEventInventory(value.inventoryInput)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error('refreshed fixture inventory invalid')
  }
  const candidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(
    value.movementInput,
  )
  if (candidate.status !== 'movementCandidateStaged') {
    throw new Error('refreshed fixture candidate invalid')
  }
  value.movementCandidate = candidate
  value.postCandidateSnapshot.inventoryEvidenceId = inventory.inventoryEvidenceId
  value.postCandidateSnapshot.movementCandidateId = candidate.movementCandidateId
  value.postCandidateSnapshot.allocationApplications = candidate.actions.flatMap(
    (action) => action.allocations.map((allocation) => ({
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
      applicationEvidenceId: `application-${action.actionId}-${allocation.allocationId}`,
      upstreamEvidenceId: `application-${action.actionId}-${allocation.allocationId}-upstream`,
    })),
  )
  value.postCandidateSnapshot.candidateBalances = candidate.candidateBalances.map(
    (balance) => ({
      ...balance,
      evidenceId: `candidate-balance-${balance.sourceAccountId}`,
      upstreamEvidenceId: `candidate-balance-${balance.sourceAccountId}-upstream`,
    }),
  )
}

function reverseKeys<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).reverse()) as T
}

function status(value: BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput): string {
  return buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(value).status
}

describe('buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput', () => {
  it.each([
    ['full', 10_000, 10_000],
    ['partial', 4_000, 4_000],
    ['zero', 0, 0],
  ])('uses %s actual staged gross, not requested gross, for line 7', (_label, opening, expected) => {
    const result = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(base(opening))
    expect(result.status).toBe('postCandidateClassificationInputBuilt')
    if (result.status !== 'postCandidateClassificationInputBuilt') return
    expect(result.classificationInput.annualFacts).toMatchObject({
      openingBasisAmount: 4_000,
      taxYearNondeductibleContributionAmount: 2_500,
      postYearNondeductibleContributionExcludedAmount: 2_500,
      yearEndApplicablePoolBalanceAmount: 20_000,
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
      form8606Line7DistributionAmount: expected,
      form8606Line8NetConversionAmount: 0,
    })
    expect(result.reconciliationEvidence.form8606Line5BasisAmount).toBe(4_000)
    expect(result.reconciliationEvidence.form8606Line9DenominatorAmount).toBe(20_000 + expected)
    expect(result.classificationInput.line8Conversions).toEqual([])
    expect(result.movement).toBe('notCommitted')
    expect(result.actionability).toBe('notEstablished')
  })

  it('rejects forged candidates and Plan/request/source rejoin mismatches', () => {
    const forged = clone()
    forged.movementCandidate = {
      ...forged.movementCandidate,
      candidateBalances: [{
        ...forged.movementCandidate.candidateBalances[0]!,
        executedAmount: asUsdCents(1),
      }],
    } as unknown as MutableInput['movementCandidate']
    expect(status(forged)).toBe('movementCandidateMismatch')

    const request = clone()
    request.movementInput.requests = [{
      ...request.movementInput.requests[0]!,
      purpose: { kind: 'taxPayment' },
    }]
    expect(status(request)).toBe('movementInputMismatch')

    const source = clone()
    source.movementInput.sourceEvidence = [{
      ...source.movementInput.sourceEvidence[0]!,
      iraClassificationEvidenceId: 'forged-classification',
    }]
    expect(status(source)).toBe('movementInputMismatch')
  })

  it('requires exactly one classification for every owned IRA sibling, including unrequested accounts', () => {
    const missing = clone()
    const missingPlan = missing.inventoryInput.plan as Plan
    missingPlan.retirementActionEligibilityFacts!.iraClassifications =
      missingPlan.retirementActionEligibilityFacts!.iraClassifications.filter(
        (classification) => classification.sourceAccountId !== siblingIra,
      )
    expect(status(missing)).toBe('movementInputMismatch')

    const duplicate = clone()
    const duplicatePlan = duplicate.inventoryInput.plan as Plan
    duplicatePlan.retirementActionEligibilityFacts!.iraClassifications.push({
      sourceAccountId: siblingIra,
      subtype: 'traditional',
      evidenceId: 'classification-sibling-duplicate',
      provenance: { source: 'manual' },
    })
    expect(status(duplicate)).toBe('inventoryBlocked')
  })

  it('rejects snapshot binding, projection, completeness, and foreign-account failures', () => {
    const binding = clone()
    binding.postCandidateSnapshot = { ...binding.postCandidateSnapshot, ledgerRunId: 'foreign-ledger' }
    expect(status(binding)).toBe('snapshotMismatch')

    const projection = clone()
    projection.postCandidateSnapshot.allocationApplications = [{
      ...projection.postCandidateSnapshot.allocationApplications[0]!,
      executedAmount: asUsdCents(1),
    }]
    expect(status(projection)).toBe('snapshotMismatch')

    const missing = clone()
    missing.postCandidateSnapshot.yearEndApplicableBalances =
      missing.postCandidateSnapshot.yearEndApplicableBalances.slice(0, 1)
    expect(status(missing)).toBe('snapshotIncomplete')

    const foreign = clone()
    foreign.postCandidateSnapshot.yearEndApplicableBalances = [
      ...foreign.postCandidateSnapshot.yearEndApplicableBalances,
      yearEnd(employer, 1, 'employer'),
      yearEnd(inherited, 1, 'inherited'),
    ]
    expect(status(foreign)).toBe('snapshotIncomplete')

    const duplicate = clone()
    duplicate.postCandidateSnapshot.yearEndApplicableBalances = [
      ...duplicate.postCandidateSnapshot.yearEndApplicableBalances,
      { ...duplicate.postCandidateSnapshot.yearEndApplicableBalances[0]! },
    ]
    expect(status(duplicate)).toBe('snapshotIncomplete')
  })

  it('binds every applied-allocation and candidate-balance field to the canonical candidate', () => {
    const applicationMutations = [
      { scheduledDate: '2030-06-16' },
      { scheduledSequence: 11 },
      { requestedAmount: asUsdCents(9_999) },
      { balanceBefore: asUsdCents(9_999) },
      { executedAmount: asUsdCents(9_999) },
      { unexecutedAmount: asUsdCents(1) },
      { candidateBalanceAfter: asUsdCents(1) },
    ]
    for (const mutation of applicationMutations) {
      const value = clone()
      value.postCandidateSnapshot.allocationApplications = [{
        ...value.postCandidateSnapshot.allocationApplications[0]!,
        ...mutation,
      }]
      expect(status(value)).toBe('snapshotMismatch')
    }

    const candidateMutations = [
      { ownerPersonId: siblingOwner },
      { openingBalance: asUsdCents(9_999) },
      { requestedAmount: asUsdCents(9_999) },
      { executedAmount: asUsdCents(9_999) },
      { unexecutedAmount: asUsdCents(1) },
      { candidateClosingBalance: asUsdCents(1) },
    ]
    for (const mutation of candidateMutations) {
      const value = clone()
      value.postCandidateSnapshot.candidateBalances = [{
        ...value.postCandidateSnapshot.candidateBalances[0]!,
        ...mutation,
      }]
      expect(status(value)).toBe('snapshotMismatch')
    }
  })

  it('requires a complete, correctly dated, collision-safe post-year window', () => {
    const wrongYear = clone()
    wrongYear.postYearContributionWindow.contributions = [{
      ...wrongYear.postYearContributionWindow.contributions[0]!,
      designatedTaxYear: 2031,
    }]
    expect(status(wrongYear)).toBe('contributionWindowIncomplete')

    const beforeDec31 = clone()
    beforeDec31.postYearContributionWindow.contributions = [{
      ...beforeDec31.postYearContributionWindow.contributions[0]!,
      contributionDate: '2030-12-31',
    }]
    expect(status(beforeDec31)).toBe('contributionWindowIncomplete')

    const afterDeadline = clone()
    afterDeadline.postYearContributionWindow.contributions = [{
      ...afterDeadline.postYearContributionWindow.contributions[0]!,
      contributionDate: '2031-04-16',
    }]
    expect(status(afterDeadline)).toBe('contributionWindowIncomplete')

    const wrongDeadline = clone()
    wrongDeadline.postYearContributionWindow.deadlineEvidence = {
      ...wrongDeadline.postYearContributionWindow.deadlineEvidence,
      designatedTaxYear: 2029,
    }
    expect(status(wrongDeadline)).toBe('contributionWindowIncomplete')

    const arbitraryLaterDeadline = clone()
    arbitraryLaterDeadline.postYearContributionWindow.deadlineEvidence = {
      ...arbitraryLaterDeadline.postYearContributionWindow.deadlineEvidence,
      deadlineDate: '2031-12-31',
    }
    expect(status(arbitraryLaterDeadline)).toBe('contributionWindowIncomplete')

    const tooEarlyDeadline = clone()
    tooEarlyDeadline.postYearContributionWindow.deadlineEvidence = {
      ...tooEarlyDeadline.postYearContributionWindow.deadlineEvidence,
      deadlineDate: '2031-04-14',
    }
    expect(status(tooEarlyDeadline)).toBe('contributionWindowIncomplete')

    const malformedDeadline = clone()
    malformedDeadline.postYearContributionWindow.deadlineEvidence = {
      ...malformedDeadline.postYearContributionWindow.deadlineEvidence,
      deadlineDate: null as unknown as string,
    }
    expect(status(malformedDeadline)).toBe('contributionWindowIncomplete')

    const malformedContributionDate = clone()
    malformedContributionDate.postYearContributionWindow.contributions = [{
      ...malformedContributionDate.postYearContributionWindow.contributions[0]!,
      contributionDate: 20310201 as unknown as string,
    }]
    expect(status(malformedContributionDate)).toBe('contributionWindowIncomplete')

    const adjustedApril18 = clone()
    adjustedApril18.postYearContributionWindow.deadlineEvidence = {
      ...adjustedApril18.postYearContributionWindow.deadlineEvidence,
      deadlineDate: '2031-04-18',
    }
    adjustedApril18.postYearContributionWindow.contributions = [{
      ...adjustedApril18.postYearContributionWindow.contributions[0]!,
      contributionDate: '2031-04-18',
    }]
    expect(status(adjustedApril18)).toBe('postCandidateClassificationInputBuilt')

    const wrongDeadlineKind = clone()
    wrongDeadlineKind.postYearContributionWindow.deadlineEvidence = {
      ...wrongDeadlineKind.postYearContributionWindow.deadlineEvidence,
      deadlineKind: 'disasterReliefExtension' as 'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
    }
    expect(status(wrongDeadlineKind)).toBe('contributionWindowIncomplete')

    const foreign = clone()
    foreign.postYearContributionWindow.contributions = [{
      ...foreign.postYearContributionWindow.contributions[0]!,
      sourceAccountId: employer,
    }]
    expect(status(foreign)).toBe('contributionWindowIncomplete')

    const zeroRecord = clone()
    zeroRecord.postYearContributionWindow.contributions = [{
      ...zeroRecord.postYearContributionWindow.contributions[0]!,
      nondeductibleContributionAmount: asUsdCents(0) as typeof zeroRecord.postYearContributionWindow.contributions[number]['nondeductibleContributionAmount'],
    }]
    expect(status(zeroRecord)).toBe('contributionWindowIncomplete')

    const duplicate = clone()
    duplicate.postYearContributionWindow.contributions = [
      duplicate.postYearContributionWindow.contributions[0]!,
      { ...duplicate.postYearContributionWindow.contributions[0]! },
    ]
    expect(status(duplicate)).toBe('contributionWindowIncomplete')

    const explicitEmpty = clone()
    explicitEmpty.postYearContributionWindow.contributions = []
    const result = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(explicitEmpty)
    expect(result.status).toBe('postCandidateClassificationInputBuilt')
    if (result.status === 'postCandidateClassificationInputBuilt') {
      expect(result.classificationInput.annualFacts.taxYearNondeductibleContributionAmount).toBe(0)
      expect(result.classificationInput.annualFacts.postYearNondeductibleContributionExcludedAmount).toBe(0)
    }
  })

  it('requires exact opening basis and explicit zero rollover facts', () => {
    const nonzero = clone()
    nonzero.annualBasisRecord = {
      ...nonzero.annualBasisRecord,
      outstandingRolloverAmount: 1 as 0,
    }
    expect(status(nonzero)).toBe('annualBasisIncomplete')

    const invalid = clone()
    invalid.annualBasisRecord = {
      ...invalid.annualBasisRecord,
      openingBasisAmount: 1.5 as typeof invalid.annualBasisRecord.openingBasisAmount,
    }
    expect(status(invalid)).toBe('annualBasisIncomplete')
  })

  it('detects exact-cent overflow and supports a zero denominator', () => {
    const line6Overflow = clone()
    line6Overflow.postCandidateSnapshot.yearEndApplicableBalances = [
      yearEnd(requestedIra, Number.MAX_SAFE_INTEGER, 'requested-max'),
      yearEnd(siblingIra, 1, 'sibling-one'),
    ]
    expect(status(line6Overflow)).toBe('annualBasisArithmeticInvalid')

    const line1Overflow = clone()
    line1Overflow.postYearContributionWindow.contributions = [
      {
        ...line1Overflow.postYearContributionWindow.contributions[0]!,
        nondeductibleContributionAmount: asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
      },
      {
        ...line1Overflow.postYearContributionWindow.contributions[0]!,
        contributionId: 'post-year-contribution-two',
        contributionDate: '2031-02-02',
        nondeductibleContributionAmount: asPositiveUsdCents(1),
        evidenceId: 'post-year-contribution-two-evidence',
        upstreamEvidenceId: 'post-year-contribution-two-upstream',
      },
    ]
    expect(status(line1Overflow)).toBe('annualBasisArithmeticInvalid')

    const line9Overflow = clone()
    line9Overflow.postCandidateSnapshot.yearEndApplicableBalances = [
      yearEnd(requestedIra, Number.MAX_SAFE_INTEGER, 'requested-max'),
      yearEnd(siblingIra, 0, 'sibling-zero'),
    ]
    expect(status(line9Overflow)).toBe('annualBasisArithmeticInvalid')

    const zero = base(0)
    zero.postCandidateSnapshot.yearEndApplicableBalances = [
      yearEnd(requestedIra, 0, 'requested-zero'),
      yearEnd(siblingIra, 0, 'sibling-zero'),
    ]
    zero.annualBasisRecord = { ...zero.annualBasisRecord, openingBasisAmount: asUsdCents(0) }
    zero.postYearContributionWindow.contributions = []
    const result = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(zero)
    expect(result.status).toBe('postCandidateClassificationInputBuilt')
    if (result.status === 'postCandidateClassificationInputBuilt') {
      expect(result.reconciliationEvidence.form8606Line9DenominatorAmount).toBe(0)
    }
  })

  it.each([
    'ownedIraRmd',
    'ownedIraContribution',
  ] as const)('defers runtime %s activity to the unified ledger', (kind) => {
    const value = clone()
    if (kind === 'ownedIraContribution') {
      const account = (value.inventoryInput.plan as Plan).accounts.find(
        (candidate) => candidate.id === requestedIra,
      )
      if (account?.type !== 'traditional') throw new Error('fixture drift')
      account.contributionSchedule = [{
        annualAmount: 1,
        fromAge: 80,
        toAge: 80,
        escalationPct: 0,
      }]
    }
    value.inventoryInput.runtimeRecords = [{
      recordStatus: 'resolved',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      eventId: `runtime-${kind}`,
      movementAuthorityId: `authority-${kind}`,
      kind,
      origin: kind === 'ownedIraRmd' ? 'rmdEngine' : 'contributionLedger',
      ownerPersonId: owner,
      sourceAccountId: requestedIra,
      grossAmount: asPositiveUsdCents(1),
      executionDate: '2030-02-01',
      executionSequence: 1,
      upstreamEvidenceId: `runtime-${kind}-upstream`,
    }]
    value.inventoryInput.runtimeInventoryAttestation = {
      ...value.inventoryInput.runtimeInventoryAttestation,
      resolvedEventIds: [`runtime-${kind}`],
    }
    expect(status(value)).toBe('unifiedAnnualLedgerRequired')
  })

  it('requires transfer-only rollover activity to remain unresolved', () => {
    const value = clone()
    value.inventoryInput.runtimeRecords = [{
      recordStatus: 'unresolved',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      activityId: 'runtime-rolloverInflow',
      kind: 'rolloverInflow',
      origin: 'transferLedger',
      knownGrossAmount: asUsdCents(1),
      ownerPersonId: null,
      sourceAccountId: null,
      executionDate: null,
      executionSequence: null,
      incompatibility: 'movementAuthorityUnavailable',
      upstreamEvidenceId: 'runtime-rolloverInflow-upstream',
    }]
    value.inventoryInput.runtimeInventoryAttestation = {
      ...value.inventoryInput.runtimeInventoryAttestation,
      unresolvedActivityIds: ['runtime-rolloverInflow'],
    }
    expect(status(value)).toBe('inventoryBlocked')
  })

  it('returns every non-runtime standalone deferral reason from the rebuilt inventory', () => {
    const conversion = clone()
    const conversionPlan = conversion.inventoryInput.plan as Plan
    const rothId = asAccountId('roth-destination')
    conversionPlan.accounts.push({
      type: 'roth',
      id: rothId,
      name: 'Roth',
      ownerPersonId: owner,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    })
    conversionPlan.strategies.retirementActions.push({
      actionId: asActionId('conversion'),
      kind: 'rothConversion',
      year: 2030,
      executionDate: '2030-07-01',
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(1),
      provenance: { source: 'manual' },
      personId: owner,
      allocations: [{
        allocationId: asAllocationId('conversion-allocation'),
        sourceAccountId: requestedIra,
        requestedAmount: asPositiveUsdCents(1),
      }],
      destinationRothAccountId: rothId,
      taxFunding: { kind: 'noneExpected' },
    })
    const conversionResult = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(conversion)
    expect(conversionResult.status).toBe('unifiedAnnualLedgerRequired')
    if (conversionResult.status === 'unifiedAnnualLedgerRequired') {
      expect(conversionResult.reasons).toContain('planConversionOrQcdPresent')
    }

    const nonOwned = clone()
    const nonOwnedPlan = nonOwned.inventoryInput.plan as Plan
    nonOwnedPlan.strategies.retirementActions.push({
      actionId: asActionId('employer-withdrawal'),
      kind: 'ordinaryWithdrawal',
      year: 2030,
      executionDate: '2030-07-02',
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(1),
      provenance: { source: 'manual' },
      personId: owner,
      allocations: [{
        allocationId: asAllocationId('employer-withdrawal-allocation'),
        sourceAccountId: employer,
        requestedAmount: asPositiveUsdCents(1),
      }],
      purpose: { kind: 'spending' },
    })
    const nonOwnedResult = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(nonOwned)
    expect(nonOwnedResult.status).toBe('unifiedAnnualLedgerRequired')
    if (nonOwnedResult.status === 'unifiedAnnualLedgerRequired') {
      expect(nonOwnedResult.reasons).toContain('nonOwnedIraPlanActionPresent')
    }

    const multipleOwners = clone()
    const multipleOwnerPlan = multipleOwners.inventoryInput.plan as Plan
    const secondPerson = {
      ...multipleOwnerPlan.household.people[0]!,
      id: siblingOwner,
      name: 'Spouse',
    }
    multipleOwnerPlan.household.people.push(secondPerson)
    const secondIra = asAccountId('second-owner-ira')
    multipleOwnerPlan.accounts.push(traditionalAccount(secondIra, 1, siblingOwner))
    multipleOwnerPlan.retirementActionEligibilityFacts!.iraClassifications.push({
      sourceAccountId: secondIra,
      subtype: 'traditional',
      evidenceId: 'classification-second-owner',
      provenance: { source: 'manual' },
    })
    multipleOwnerPlan.strategies.retirementActions.push({
      actionId: asActionId('second-owner-withdrawal'),
      kind: 'ordinaryWithdrawal',
      year: 2030,
      executionDate: '2030-08-01',
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(1),
      provenance: { source: 'manual' },
      personId: siblingOwner,
      allocations: [{
        allocationId: asAllocationId('second-owner-allocation'),
        sourceAccountId: secondIra,
        requestedAmount: asPositiveUsdCents(1),
      }],
      purpose: { kind: 'spending' },
    })
    const multipleOwnerResult = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(multipleOwners)
    expect(multipleOwnerResult.status).toBe('unifiedAnnualLedgerRequired')
    if (multipleOwnerResult.status === 'unifiedAnnualLedgerRequired') {
      expect(multipleOwnerResult.reasons).toContain('multipleOwnedIraOwners')
    }

    const empty = clone()
    ;(empty.inventoryInput.plan as Plan).strategies.retirementActions = []
    const emptyResult = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(empty)
    expect(emptyResult.status).toBe('unifiedAnnualLedgerRequired')
    if (emptyResult.status === 'unifiedAnnualLedgerRequired') {
      expect(emptyResult.reasons).toContain('planOwnedIraActionBatchEmpty')
    }
  })

  it('is permutation invariant, detached, frozen, and emits no execution or character result', () => {
    const original = clone()
    const permuted = clone()
    permuted.postCandidateSnapshot.yearEndApplicableBalances =
      [...permuted.postCandidateSnapshot.yearEndApplicableBalances].reverse()
    permuted.postCandidateSnapshot.allocationApplications =
      [...permuted.postCandidateSnapshot.allocationApplications].reverse()
    permuted.postYearContributionWindow.contributions =
      [...permuted.postYearContributionWindow.contributions].reverse()
    permuted.postCandidateSnapshot.allocationApplications = permuted.postCandidateSnapshot
      .allocationApplications.map((application) => reverseKeys(application))
    permuted.postCandidateSnapshot.candidateBalances = permuted.postCandidateSnapshot
      .candidateBalances.map((balance) => reverseKeys(balance))
    permuted.movementCandidate = reverseKeys(permuted.movementCandidate)
    const first = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(original)
    const second = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(permuted)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.classificationInput)).toBe(true)
    original.annualBasisRecord.openingBasisAmount = asUsdCents(999)
    if (first.status === 'postCandidateClassificationInputBuilt') {
      expect(first.classificationInput.annualFacts.openingBasisAmount).toBe(4_000)
      expect(first).not.toHaveProperty('character')
      expect(first).not.toHaveProperty('penalty')
      expect(first).not.toHaveProperty('disposition')
      expect(first).not.toHaveProperty('committedBalances')
    }
  })

  it('allows action-scoped allocation IDs to repeat across distinct actions', () => {
    const value = clone()
    const first = value.movementInput.requests[0]!
    const second = {
      ...first,
      actionId: asActionId('withdrawal-two'),
      executionDate: '2030-07-15',
      executionSequence: 20,
      requestedAmount: asPositiveUsdCents(1_000),
      allocations: [{
        ...first.allocations[0]!,
        requestedAmount: asPositiveUsdCents(1_000),
      }],
    }
    const valuePlan = value.inventoryInput.plan as Plan
    valuePlan.strategies.retirementActions.push(second)
    value.movementInput.requests = [...value.movementInput.requests, second]
    refreshInventoryAndCandidate(value)

    expect(status(value)).toBe('postCandidateClassificationInputBuilt')
  })

  it('rejects caller IDs that collide with derived result IDs', () => {
    const original = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(base())
    expect(original.status).toBe('postCandidateClassificationInputBuilt')
    if (original.status !== 'postCandidateClassificationInputBuilt') return
    const collision = clone()
    collision.postYearContributionWindow.evidenceId =
      original.classificationInput.ownerWideNonRothIraPoolId
    expect(status(collision)).toBe('identifierCollision')
  })

  it('rejects cross-role reuse of Plan, action, allocation, classification, inventory, candidate, and application IDs', () => {
    const fixture = clone()
    const collisionTargets = [
      planId,
      owner,
      requestedIra,
      fixture.movementInput.requests[0]!.actionId,
      fixture.movementInput.requests[0]!.allocations[0]!.allocationId,
      'classification-requested',
      fixture.postCandidateSnapshot.inventoryEvidenceId,
      fixture.postCandidateSnapshot.movementCandidateId,
      fixture.postCandidateSnapshot.allocationApplications[0]!.applicationEvidenceId,
      fixture.postCandidateSnapshot.candidateBalances[0]!.evidenceId,
    ]
    for (const collisionTarget of collisionTargets) {
      const value = clone()
      value.postYearContributionWindow.evidenceId = collisionTarget
      expect(status(value)).toBe('identifierCollision')
    }
  })

  it('registers the annual ledger run and every rebuilt inventory event against cross-role reuse', () => {
    const ledgerCollision = clone()
    ledgerCollision.inventoryInput.runtimeInventoryAttestation = {
      ...ledgerCollision.inventoryInput.runtimeInventoryAttestation,
      ledgerRunId: planId,
    }
    ledgerCollision.postCandidateSnapshot = {
      ...ledgerCollision.postCandidateSnapshot,
      ledgerRunId: planId,
      yearEndApplicableBalances:
        ledgerCollision.postCandidateSnapshot.yearEndApplicableBalances.map(
          (balance) => ({ ...balance, ledgerRunId: planId }),
        ),
    }
    ledgerCollision.annualBasisRecord = {
      ...ledgerCollision.annualBasisRecord,
      ledgerRunId: planId,
    }
    ledgerCollision.postYearContributionWindow = {
      ...ledgerCollision.postYearContributionWindow,
      ledgerRunId: planId,
    }
    refreshInventoryAndCandidate(ledgerCollision)
    expect(status(ledgerCollision)).toBe('identifierCollision')

    const eventCollision = clone()
    const originalInventory = buildAnnualRetirementPhysicalEventInventory(
      eventCollision.inventoryInput,
    )
    if (originalInventory.status !== 'annualPhysicalEventInventoryBuilt') {
      throw new Error('fixture inventory invalid')
    }
    const eventId = originalInventory.events[0]!.eventId
    const eventPlan = eventCollision.inventoryInput.plan as Plan
    eventPlan.retirementActionEligibilityFacts!.iraClassifications[0] = {
      ...eventPlan.retirementActionEligibilityFacts!.iraClassifications[0]!,
      evidenceId: eventId,
    }
    eventCollision.movementInput.sourceEvidence = [{
      ...eventCollision.movementInput.sourceEvidence[0]!,
      iraClassificationEvidenceId: eventId,
    }]
    refreshInventoryAndCandidate(eventCollision)
    expect(status(eventCollision)).toBe('identifierCollision')
  })

  it('returns the inventory-blocked arm for incomplete physical inventory', () => {
    const value = clone()
    value.inventoryInput.runtimeInventoryAttestation = {
      ...value.inventoryInput.runtimeInventoryAttestation,
      inventoryStatus: 'missing' as 'completeIncludingExplicitEmpty',
    }
    expect(status(value)).toBe('inventoryBlocked')
  })
})
