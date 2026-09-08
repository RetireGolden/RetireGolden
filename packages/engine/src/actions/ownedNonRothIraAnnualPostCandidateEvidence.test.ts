import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import {
  buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
  type BuildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  base,
  clone,
  employer,
  inherited,
  type MutableInput,
  owner,
  planId,
  refreshInventoryAndCandidate,
  requestedIra,
  siblingIra,
  siblingOwner,
  yearEnd,
} from '../testing/ownedNonRothIraPostCandidateFixture.js'
import { traditionalAccount } from '../testing/planFixtures.js'

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
    expect(status(adjustedApril18)).toBe('contributionWindowIncomplete')

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
      ...(kind === 'ownedIraContribution' ? { sourceBalanceIndex: 0 } : {}),
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

  it('registers non-balance account IDs against evidence reuse', () => {
    const value = clone()
    ;(value.inventoryInput.plan as Plan).accounts.push({
      type: 'property',
      id: 'property-collision',
      name: 'Property',
      ownerPersonId: owner,
      annualReturnPct: 0,
      value: 100_000,
      plannedSaleYear: null,
      expectedNetProceeds: null,
    })
    refreshInventoryAndCandidate(value)
    value.postYearContributionWindow.evidenceId = 'property-collision'

    expect(status(value)).toBe('identifierCollision')
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
