import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { ordinaryFederalFilingDeadline } from '../tax/ordinaryFederalFilingDeadline.js'

import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import { buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput } from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import { stageOwnedNonRothIraOrdinaryWithdrawalMovements } from './ownedNonRothIraMovementCandidate.js'
import { deriveActionStructuralId } from './structuralId.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

/** Independent worksheet: owned 100c year-end, inherited 80c sibling in Plan only. */
const OWNED_YEAR_END_BALANCE = 100
const INHERITED_IRA_YEAR_END_BALANCE = 80
const OWNED_POOL_BASIS = 50
const LINE7_DISTRIBUTION = 10
const OWNED_OPENING_BEFORE_DISTRIBUTION = OWNED_YEAR_END_BALANCE + LINE7_DISTRIBUTION
const OWNED_POOL_DENOMINATOR = OWNED_YEAR_END_BALANCE + LINE7_DISTRIBUTION
const REJECTED_INHERITED_INCLUSION_DENOMINATOR =
  OWNED_YEAR_END_BALANCE + INHERITED_IRA_YEAR_END_BALANCE + LINE7_DISTRIBUTION
const TAX_YEAR = 2030

function classifyOwnedPoolWithInheritedSiblingViaProductionPath() {
  const ownerPersonId = asPersonId('p1')
  const ownedIraId = asAccountId('owned-ira')
  const inheritedIraId = asAccountId('inherited-ira')
  const actionId = asActionId('owned-withdrawal')
  const allocationId = asAllocationId('owned-withdrawal-allocation')
  const planId = asPlanId('owned-pool-inherited-sibling-plan')

  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  plan.id = planId
  const inheritedAccount = traditionalAccount(
    inheritedIraId,
    INHERITED_IRA_YEAR_END_BALANCE,
    ownerPersonId,
  )
  if (inheritedAccount.type !== 'traditional') {
    throw new Error('fixture drift: inherited account must be traditional')
  }
  inheritedAccount.inherited = {
    ownerDeathYear: 2028,
    decedentHadStartedRmds: true,
  }
  plan.accounts = [
    traditionalAccount(ownedIraId, OWNED_OPENING_BEFORE_DISTRIBUTION, ownerPersonId),
    inheritedAccount,
  ]
  plan.strategies.retirementActions = [{
    actionId,
    kind: 'ordinaryWithdrawal',
    personId: ownerPersonId,
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-06-01`,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(LINE7_DISTRIBUTION),
    provenance: { source: 'manual' },
    allocations: [{
      allocationId,
      sourceAccountId: ownedIraId,
      requestedAmount: asPositiveUsdCents(LINE7_DISTRIBUTION),
    }],
    purpose: { kind: 'spending' },
  }]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: ownedIraId,
      subtype: 'traditional',
      evidenceId: 'classification-owned-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }

  const ledgerRunId = `ledger-${TAX_YEAR}`
  const inventoryInput = {
    plan,
    taxYear: TAX_YEAR,
    runtimeRecords: [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
      planId,
      taxYear: TAX_YEAR,
      ledgerRunId,
      inventoryStatus: 'completeIncludingExplicitEmpty' as const,
      resolvedEventIds: [],
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
  const builtInventory = buildAnnualRetirementPhysicalEventInventory(inventoryInput)
  if (builtInventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error(`inventory failed: ${JSON.stringify(builtInventory.issues)}`)
  }
  const ownedPool = builtInventory.ownedIraPools.find(
    (pool) => pool.ownerPersonId === ownerPersonId,
  )
  if (ownedPool === undefined) {
    throw new Error('annual inventory did not build an owned IRA pool')
  }

  const ownershipEvidenceId = deriveActionStructuralId(
    'owned-ira-plan-account-ownership',
    [planId, ownerPersonId, ownedIraId, 'traditional', 'ira', 'owned'],
  )
  const withdrawal = plan.strategies.retirementActions[0]!
  if (withdrawal.kind !== 'ordinaryWithdrawal') {
    throw new Error('fixture drift: expected ordinary withdrawal action')
  }
  const movementInput = {
    ownerPersonId,
    taxYear: TAX_YEAR,
    requests: [withdrawal],
    openingBalances: [{
      accountId: ownedIraId,
      openingBalance: asUsdCents(OWNED_OPENING_BEFORE_DISTRIBUTION),
    }],
    sourceEvidence: [{
      predicate: 'ownedNonRothIraOrdinaryWithdrawalMovementSource' as const,
      sourceAccountId: ownedIraId,
      ownerPersonId,
      accountType: 'traditional' as const,
      accountKind: 'ira' as const,
      inheritanceStatus: 'owned' as const,
      subtype: 'traditional' as const,
      accountOwnershipEvidenceId: ownershipEvidenceId,
      iraClassificationEvidenceId: 'classification-owned-ira',
    }],
  }
  const movementCandidate = stageOwnedNonRothIraOrdinaryWithdrawalMovements(movementInput)
  if (movementCandidate.status !== 'movementCandidateStaged') {
    throw new Error(`movement staging failed: ${movementCandidate.status}`)
  }

  const deadlineDate = ordinaryFederalFilingDeadline(TAX_YEAR) ?? `${TAX_YEAR + 1}-04-15`
  const postCandidateInput = {
    inventoryInput,
    movementInput,
    movementCandidate,
    postCandidateSnapshot: {
      predicate: 'completePlanOwnedNonRothIraPostCandidateSnapshot' as const,
      planId,
      ownerPersonId,
      taxYear: TAX_YEAR,
      ledgerRunId,
      inventoryEvidenceId: builtInventory.inventoryEvidenceId,
      movementCandidateId: movementCandidate.movementCandidateId,
      applicationStatus: 'canonicalMovementCandidateAppliedExactlyOnce' as const,
      allocationApplications: movementCandidate.actions.flatMap((action) =>
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
      candidateBalances: movementCandidate.candidateBalances.map((balance) => ({
        ...balance,
        evidenceId: `candidate-balance-${balance.sourceAccountId}`,
        upstreamEvidenceId: `candidate-balance-${balance.sourceAccountId}-upstream`,
      })),
      yearEndApplicableBalances: [{
        predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
        planId,
        ownerPersonId,
        sourceAccountId: ownedIraId,
        taxYear: TAX_YEAR,
        ledgerRunId,
        ledgerPhase: 'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
        asOfDate: `${TAX_YEAR}-12-31`,
        yearEndApplicableBalanceAmount: asUsdCents(OWNED_YEAR_END_BALANCE),
        evidenceId: 'year-end-owned',
        upstreamEvidenceId: 'year-end-owned-upstream',
      }],
      evidenceId: 'post-candidate-snapshot',
      upstreamEvidenceId: 'post-candidate-snapshot-upstream',
    },
    annualBasisRecord: {
      predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord' as const,
      planId,
      ownerPersonId,
      taxYear: TAX_YEAR,
      ledgerRunId,
      recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete' as const,
      openingBasisAmount: asUsdCents(OWNED_POOL_BASIS),
      outstandingRolloverAmount: 0 as const,
      rolloverRepaymentAdjustmentAmount: 0 as const,
      evidenceId: 'annual-basis-record',
      upstreamEvidenceId: 'annual-basis-record-upstream',
    },
    postYearContributionWindow: {
      predicate: 'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow' as const,
      planId,
      ownerPersonId,
      taxYear: TAX_YEAR,
      ledgerRunId,
      inventoryStatus: 'completeIncludingExplicitEmpty' as const,
      deadlineEvidence: {
        predicate: 'federalIraContributionDeadlineForTaxYear' as const,
        designatedTaxYear: TAX_YEAR,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished' as const,
        deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief' as const,
        calendarAdjustmentStatus: 'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied' as const,
        deadlineDate,
        evidenceId: 'contribution-deadline',
        upstreamEvidenceId: 'contribution-deadline-upstream',
      },
      contributions: [],
      evidenceId: 'contribution-window',
      upstreamEvidenceId: 'contribution-window-upstream',
    },
  }

  const built = buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput(
    postCandidateInput,
  )
  if (built.status !== 'postCandidateClassificationInputBuilt') {
    throw new Error(
      `post-candidate classification input failed: ${built.status} ${JSON.stringify(built.issues)}`,
    )
  }

  return {
    plan,
    ownedIraId,
    inheritedIraId,
    ownedPoolSourceAccountIds: ownedPool.sourceAccountIds,
    classification: classifyOwnedNonRothIraAnnualWithdrawals(built.classificationInput),
  }
}

function member(
  suffix: string,
  subtype: 'traditional' | 'sep' | 'simple',
): OwnedNonRothIraPoolMemberEvidence {
  return {
    sourceAccountId: asAccountId(`ira-${suffix}`),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype,
    yearEndApplicableBalanceAmount: asUsdCents(1),
    iraClassificationEvidenceId: `classification-${suffix}`,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
  }
}

function activity(
  suffix: string,
  sourceAccountId: string,
  grossAmount = 1,
  scheduledDate: string | null = '2030-06-01',
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(sourceAccountId),
    scheduledDate,
    scheduledSequence: 1,
    grossAmount: asUsdCents(grossAmount),
  }
}

function input(
  overrides: Partial<ClassifyOwnedNonRothIraAnnualWithdrawalsInput> = {},
): ClassifyOwnedNonRothIraAnnualWithdrawalsInput {
  return {
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [
        asAccountId('ira-traditional'),
        asAccountId('ira-sep'),
        asAccountId('ira-simple'),
      ],
      yearEndApplicablePoolBalanceAmount: asUsdCents(3),
      evidenceId: 'complete-pool-evidence',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear: 2030,
    poolMembers: [
      member('traditional', 'traditional'),
      member('sep', 'sep'),
      member('simple', 'simple'),
    ],
    annualFacts: {
      openingBasisAmount: asUsdCents(3),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(3),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(3),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: [
      activity('traditional', 'ira-traditional', 1, '2030-01-01'),
      activity('sep', 'ira-sep', 1, '2030-02-01'),
      activity('simple', 'ira-simple', 1, null),
    ],
    line8Conversions: [],
    ...overrides,
  }
}

describe('classifyOwnedNonRothIraAnnualWithdrawals', () => {
  it('uses one owner-wide ratio across traditional, SEP, and SIMPLE IRAs', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(input())

    expect(result.annualBasisEvidence.annualBasisRatio).toEqual({
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: 3,
      denominatorMinorUnits: 6,
      intermediateArithmetic: 'bigintRational',
    })
    expect(result.line7AllocationEvidence.annualNontaxableBasisAmount).toBe(2)
    expect(result.withdrawals.map((item) => item.subtype)).toEqual([
      'traditional',
      'sep',
      'simple',
    ])
    expect(result.withdrawals.map((item) => item.basisRecoveredAmount)).toEqual([
      1, 1, 0,
    ])
    expect(result.withdrawals[0]?.taxCharacter.map((item) => item.kind)).toEqual([
      'basisReturn',
    ])
    expect(result.withdrawals[2]?.taxCharacter.map((item) => item.kind)).toEqual([
      'ordinaryIncome',
    ])
  })

  // IRC 408(d)(2)(A) treats all of an owner traditional, SEP and SIMPLE IRAs as
  // one contract and (B) all of a year distributions as one distribution, so
  // there is a single annual fraction over the pooled denominator. Computing
  // per account would give the traditional account its own 110c denominator
  // (its 100c year-end balance plus its 10c distribution) instead of the
  // pooled 220c.
  describeRule('irc-408-d-2-annual-pro-rata-basis', {
    readings: {
      aggregatedOneContract: {
        multiOwnedDenominator: 220,
        ownedWithInheritedDenominator: 110,
      },
      perAccountSeparately: {
        multiOwnedDenominator: 110,
        ownedWithInheritedDenominator: 110,
      },
      rejectedIncludesInheritedIraBalance: {
        multiOwnedDenominator: 220,
        ownedWithInheritedDenominator: 190,
      },
    },
    accepted: 'aggregatedOneContract',
  }, ({ accepted, readings }) => {
    it('derives one annual denominator across every owned non-Roth IRA', () => {
      const result = classifyOwnedNonRothIraAnnualWithdrawals(input({
        poolMembers: [
          { ...member('traditional', 'traditional'), yearEndApplicableBalanceAmount: asUsdCents(100) },
          { ...member('sep', 'sep'), yearEndApplicableBalanceAmount: asUsdCents(50) },
          { ...member('simple', 'simple'), yearEndApplicableBalanceAmount: asUsdCents(50) },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(100),
          taxYearNondeductibleContributionAmount: asUsdCents(20),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(5),
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
          outstandingRolloverAmount: asUsdCents(10),
          rolloverRepaymentAdjustmentAmount: asUsdCents(5),
          form8606Line7DistributionAmount: asUsdCents(10),
          form8606Line8NetConversionAmount: asUsdCents(5),
        },
        line7Distributions: [activity('traditional', 'ira-traditional', 10)],
        line8Conversions: [activity('conversion', 'ira-sep', 5, '2030-07-01')],
      }))
      expect(result.annualBasisEvidence.annualBasisDenominatorAmount)
        .toBe(accepted.multiOwnedDenominator)
      expect(result.annualBasisEvidence.annualBasisDenominatorAmount)
        .not.toBe(readings.perAccountSeparately.multiOwnedDenominator)
    })

    // Pub. 590-B: a beneficiary cannot combine inherited-IRA basis with an owned
    // pool. Worksheet: owned traditional IRA (100c year-end) plus a separate
    // inherited IRA (80c) in Plan data that must stay out of the owned
    // §408(d)(2) aggregate. A 10c distribution yields denominator 110c; wrongly
    // sweeping the inherited 80c into the owner pool would yield 190c. With
    // 50c basis, nearest-cent half-up on 50/110 × 10 recovers 5c of basis
    // (not 3c on the rejected 50/190 × 10 reading).
    it('keeps an inherited IRA balance out of the owned annual denominator', () => {
      const {
        plan,
        ownedIraId,
        inheritedIraId,
        ownedPoolSourceAccountIds,
        classification: result,
      } = classifyOwnedPoolWithInheritedSiblingViaProductionPath()

      const inheritedInPlan = plan.accounts.find(
        (account) => account.id === inheritedIraId,
      )
      if (inheritedInPlan === undefined || inheritedInPlan.type !== 'traditional') {
        throw new Error('fixture drift: inherited IRA must be a traditional account')
      }
      expect(inheritedInPlan.inherited).toBeDefined()
      expect(ownedPoolSourceAccountIds).toEqual([ownedIraId])
      expect(result.annualBasisEvidence.poolMembers.map((item) => item.sourceAccountId))
        .toEqual([ownedIraId])
      expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(OWNED_POOL_BASIS)
      expect(result.annualBasisEvidence.annualBasisDenominatorAmount)
        .toBe(OWNED_POOL_DENOMINATOR)
      expect(result.annualBasisEvidence.annualBasisDenominatorAmount)
        .toBe(accepted.ownedWithInheritedDenominator)
      expect(result.annualBasisEvidence.annualBasisDenominatorAmount)
        .not.toBe(readings.rejectedIncludesInheritedIraBalance.ownedWithInheritedDenominator)
      expect(readings.rejectedIncludesInheritedIraBalance.ownedWithInheritedDenominator)
        .toBe(REJECTED_INHERITED_INCLUSION_DENOMINATOR)
      expect(result.line7AllocationEvidence.annualNontaxableBasisAmount).toBe(5)
      expect(result.line7AllocationEvidence.annualTaxableAmount).toBe(5)
      expect(result.withdrawals[0]).toMatchObject({
        executedAmount: LINE7_DISTRIBUTION,
        basisRecoveredAmount: 5,
        ordinaryIncomeAmount: 5,
      })
      expect(result.withdrawals[0]?.basisRecoveredAmount).not.toBe(3)
      expect(result.withdrawals[0]?.ordinaryIncomeAmount).not.toBe(7)
    })
  })

  // Independent Form 8606 worksheet: $10,000 opening basis plus $5,000 of
  // tax-year nondeductible contributions of which $2,000 is made in the
  // following calendar year. Line 4 removes that $2,000 from current-year
  // distribution recovery, leaving a $13,000 numerator over a $20,000
  // denominator ($10,000 year-end value plus a $10,000 distribution), so the
  // distribution returns $6,500 of basis. Dropping every contribution from the
  // numerator would return $5,000; including the whole $5,000 would return
  // $7,500.
  describeRule('form-8606-line-4-post-year-contribution-exclusion', {
    note: 'following-calendar-year contribution window',
    readings: {
      form8606Line4ExcludesPostYearOnly: 6_500,
      rejectedDropAllContributions: 5_000,
    },
    accepted: 'form8606Line4ExcludesPostYearOnly',
  }, ({ accepted, readings }) => {
    it('removes the line-4 amount before characterizing a positive distribution', () => {
      const result = classifyOwnedNonRothIraAnnualWithdrawals(input({
        poolMembers: [
          { ...member('traditional', 'traditional'), yearEndApplicableBalanceAmount: asUsdCents(10_000) },
          { ...member('sep', 'sep'), yearEndApplicableBalanceAmount: asUsdCents(0) },
          { ...member('simple', 'simple'), yearEndApplicableBalanceAmount: asUsdCents(0) },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(10_000),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(10_000),
          taxYearNondeductibleContributionAmount: asUsdCents(5_000),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(2_000),
          yearEndApplicablePoolBalanceAmount: asUsdCents(10_000),
          outstandingRolloverAmount: asUsdCents(0),
          rolloverRepaymentAdjustmentAmount: asUsdCents(0),
          form8606Line7DistributionAmount: asUsdCents(10_000),
          form8606Line8NetConversionAmount: asUsdCents(0),
        },
        line7Distributions: [
          activity('post-year-window', 'ira-traditional', 10_000),
        ],
        line8Conversions: [],
      }))

      expect(result.withdrawals[0]?.basisRecoveredAmount).toBe(accepted)
      expect(result.withdrawals[0]?.basisRecoveredAmount)
        .not.toBe(readings.rejectedDropAllContributions)
      // Include-everything (opening + full $5,000 contributions) would recover
      // $7,500; that reading is not among the registered pair but must not be
      // produced either.
      expect(result.withdrawals[0]?.basisRecoveredAmount).not.toBe(7_500)
      expect(result.withdrawals[0]).toMatchObject({
        executedAmount: 10_000,
        ordinaryIncomeAmount: 3_500,
      })
    })
  })

  // Staging of line 7 vs line 8 is owned by the physical-transaction producer
  // (see ownedNonRothIraAnnualPhysicalTransaction.test.ts). The classifier
  // here only allocates from already-split inputs.

  it('derives the complete Form 8606 numerator, line 6, and denominator', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(100),
          },
          {
            ...member('sep', 'sep'),
            yearEndApplicableBalanceAmount: asUsdCents(50),
          },
          {
            ...member('simple', 'simple'),
            yearEndApplicableBalanceAmount: asUsdCents(50),
          },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(100),
          taxYearNondeductibleContributionAmount: asUsdCents(20),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(5),
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
          outstandingRolloverAmount: asUsdCents(10),
          rolloverRepaymentAdjustmentAmount: asUsdCents(5),
          form8606Line7DistributionAmount: asUsdCents(10),
          form8606Line8NetConversionAmount: asUsdCents(5),
        },
        line7Distributions: [
          activity('traditional', 'ira-traditional', 10),
        ],
        line8Conversions: [
          activity('conversion', 'ira-sep', 5, '2030-07-01'),
        ],
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(115)
    expect(
      result.annualBasisEvidence.line6AdjustedYearEndAndRolloverAmount,
    ).toBe(205)
    expect(result.annualBasisEvidence.annualBasisDenominatorAmount).toBe(220)
    expect(result.annualBasisEvidence.annualBasisRatio).toMatchObject({
      numeratorMinorUnits: 115,
      denominatorMinorUnits: 220,
    })
    expect(result.line7AllocationEvidence.annualNontaxableBasisAmount).toBe(5)
    expect(result.line8AllocationEvidence.annualNontaxableBasisAmount).toBe(3)
  })

  it('caps the basis numerator at the denominator', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        annualFacts: {
          ...input().annualFacts,
          openingBasisAmount: asUsdCents(100),
        },
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(100)
    expect(result.annualBasisEvidence.annualBasisRatio).toMatchObject({
      numeratorMinorUnits: 6,
      denominatorMinorUnits: 6,
    })
    expect(result.withdrawals.every((item) => item.ordinaryIncomeAmount === 0)).toBe(
      true,
    )
  })

  it('preserves unused basis in the zero-denominator no-character arm', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: input().poolMembers.map((poolMember) => ({
          ...poolMember,
          yearEndApplicableBalanceAmount: asUsdCents(0),
        })),
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(100),
          taxYearNondeductibleContributionAmount: asUsdCents(0),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
          yearEndApplicablePoolBalanceAmount: asUsdCents(0),
          outstandingRolloverAmount: asUsdCents(0),
          rolloverRepaymentAdjustmentAmount: asUsdCents(0),
          form8606Line7DistributionAmount: asUsdCents(0),
          form8606Line8NetConversionAmount: asUsdCents(0),
        },
        line7Distributions: [],
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(100)
    expect(result.annualBasisEvidence.annualBasisRatio.representation).toBe(
      'notApplicableZeroDenominator',
    )
    expect(result.withdrawals).toEqual([])
  })

  it('fails closed when independent line rounding would recover basis twice', () => {
    expect(() =>
      classifyOwnedNonRothIraAnnualWithdrawals(
        input({
          poolMembers: input().poolMembers.map((poolMember) => ({
            ...poolMember,
            yearEndApplicableBalanceAmount: asUsdCents(0),
          })),
          completePoolEvidence: {
            ...input().completePoolEvidence,
            yearEndApplicablePoolBalanceAmount: asUsdCents(0),
          },
          annualFacts: {
            openingBasisAmount: asUsdCents(1),
            taxYearNondeductibleContributionAmount: asUsdCents(0),
            postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
            yearEndApplicablePoolBalanceAmount: asUsdCents(0),
            outstandingRolloverAmount: asUsdCents(0),
            rolloverRepaymentAdjustmentAmount: asUsdCents(0),
            form8606Line7DistributionAmount: asUsdCents(1),
            form8606Line8NetConversionAmount: asUsdCents(1),
          },
          line7Distributions: [
            activity('distribution', 'ira-traditional', 1, '2030-06-01'),
          ],
          line8Conversions: [
            activity('conversion', 'ira-sep', 1, '2030-07-01'),
          ],
        }),
      ),
    ).toThrow('cannot recover more than annual IRA basis')
  })

  it('range-checks the adjusted line-6 result after bigint subtraction', () => {
    const maximum = Number.MAX_SAFE_INTEGER
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(maximum),
          },
          {
            ...member('sep', 'sep'),
            yearEndApplicableBalanceAmount: asUsdCents(0),
          },
          {
            ...member('simple', 'simple'),
            yearEndApplicableBalanceAmount: asUsdCents(0),
          },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(maximum),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(0),
          taxYearNondeductibleContributionAmount: asUsdCents(0),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
          yearEndApplicablePoolBalanceAmount: asUsdCents(maximum),
          outstandingRolloverAmount: asUsdCents(1),
          rolloverRepaymentAdjustmentAmount: asUsdCents(1),
          form8606Line7DistributionAmount: asUsdCents(0),
          form8606Line8NetConversionAmount: asUsdCents(0),
        },
        line7Distributions: [],
      }),
    )

    expect(
      result.annualBasisEvidence.line6AdjustedYearEndAndRolloverAmount,
    ).toBe(maximum)
  })

  it('omits zero line-7 activity and emits only positive character segments', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        annualFacts: {
          ...input().annualFacts,
          form8606Line7DistributionAmount: asUsdCents(1),
        },
        line7Distributions: [
          activity('zero', 'ira-traditional', 0, '2030-01-01'),
          activity('positive', 'ira-simple', 1, '2030-02-01'),
        ],
      }),
    )

    expect(result.withdrawals).toHaveLength(1)
    expect(result.withdrawals[0]?.actionId).toBe('action-positive')
    expect(
      result.withdrawals[0]?.taxCharacter.every((item) => item.amount > 0),
    ).toBe(true)
  })

  it('canonicalizes pool and activity input order with stable evidence IDs', () => {
    const source = input()
    const reversed = input({
      poolMembers: [...source.poolMembers].reverse(),
      line7Distributions: [...source.line7Distributions].reverse(),
    })
    const first = classifyOwnedNonRothIraAnnualWithdrawals(source)
    const second = classifyOwnedNonRothIraAnnualWithdrawals(reversed)

    expect(first).toEqual(second)
    expect(first.annualBasisEvidence.basisEvidenceId).toBe(
      second.annualBasisEvidence.basisEvidenceId,
    )
  })

  it('binds every character to the shared basis and line-7 evidence', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(input())
    const character = result.withdrawals[0]?.taxCharacter[0]

    expect(character?.characterEvidence.basisEvidenceId).toBe(
      result.annualBasisEvidence.basisEvidenceId,
    )
    expect(character?.characterEvidence.allocationEvidenceId).toBe(
      result.line7AllocationEvidence.allocationEvidenceId,
    )
    expect(character?.characterEvidence.segmentAmount).toBe(character?.amount)
  })

  it('changes evidence identity when a complete annual fact changes', () => {
    const baseline = classifyOwnedNonRothIraAnnualWithdrawals(input())
    const changed = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(2),
          },
          member('sep', 'sep'),
          member('simple', 'simple'),
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(4),
        },
        annualFacts: {
          ...input().annualFacts,
          yearEndApplicablePoolBalanceAmount: asUsdCents(4),
        },
      }),
    )

    expect(changed.annualBasisEvidence.basisEvidenceId).not.toBe(
      baseline.annualBasisEvidence.basisEvidenceId,
    )
    expect(changed.line7AllocationEvidence.allocationEvidenceId).not.toBe(
      baseline.line7AllocationEvidence.allocationEvidenceId,
    )
  })

  it('deep-freezes detached annual evidence and character', () => {
    const source = input()
    const result = classifyOwnedNonRothIraAnnualWithdrawals(source)
    ;(source.poolMembers[0] as OwnedNonRothIraPoolMemberEvidence).subtype = 'simple'

    expect(
      result.annualBasisEvidence.poolMembers.find(
        (item) => item.sourceAccountId === 'ira-traditional',
      )?.subtype,
    ).toBe('traditional')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.annualBasisEvidence)).toBe(true)
    expect(Object.isFrozen(result.withdrawals[0]?.taxCharacter)).toBe(true)
  })

  it.each([
    {
      name: 'excluded contributions above current contributions',
      change: {
        annualFacts: {
          ...input().annualFacts,
          postYearNondeductibleContributionExcludedAmount: asUsdCents(1),
        },
      },
      message: 'cannot exceed',
    },
    {
      name: 'rollover repayment above available line-6 amounts',
      change: {
        annualFacts: {
          ...input().annualFacts,
          rolloverRepaymentAdjustmentAmount: asUsdCents(4),
        },
      },
      message: 'repayment adjustment',
    },
    {
      name: 'incomplete line-7 activity',
      change: {
        line7Distributions: [activity('short', 'ira-traditional', 2)],
      },
      message: 'line-7 activity',
    },
    {
      name: 'foreign activity source',
      change: {
        line7Distributions: [activity('foreign', 'ira-foreign', 3)],
      },
      message: 'owner-wide pool',
    },
    {
      name: 'omitted sibling from authoritative pool',
      change: {
        poolMembers: [
          member('traditional', 'traditional'),
          member('sep', 'sep'),
        ],
      },
      message: 'account set',
    },
    {
      name: 'member balances below authoritative aggregate',
      change: {
        poolMembers: input().poolMembers.map((poolMember) => ({
          ...poolMember,
          yearEndApplicableBalanceAmount: asUsdCents(0),
        })),
      },
      message: 'authoritative aggregate',
    },
    {
      name: 'duplicate pool account',
      change: {
        poolMembers: [
          member('traditional', 'traditional'),
          member('traditional', 'traditional'),
        ],
      },
      message: 'account IDs',
    },
    {
      name: 'mismatched pool owner',
      change: {
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            ownerPersonId: asPersonId('someone-else'),
          },
        ],
      },
      message: 'share its owner',
    },
    {
      name: 'allocation repeated across line 7 and line 8',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line8NetConversionAmount: asUsdCents(1),
        },
        line8Conversions: [input().line7Distributions[0]!],
      },
      message: 'both annual line ledgers',
    },
    {
      name: 'one action repeats a source account',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line7DistributionAmount: asUsdCents(2),
        },
        line7Distributions: [
          activity('first', 'ira-traditional', 1),
          {
            ...activity('second', 'ira-traditional', 1),
            actionId: asActionId('action-first'),
          },
        ],
      },
      message: 'same source account',
    },
    {
      name: 'one action split across line 7 and line 8',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line8NetConversionAmount: asUsdCents(1),
        },
        line8Conversions: [
          {
            ...activity('conversion', 'ira-sep', 1),
            actionId: input().line7Distributions[0]!.actionId,
          },
        ],
      },
      message: 'both annual line scopes',
    },
  ])('rejects $name', ({ change, message }) => {
    expect(() =>
      classifyOwnedNonRothIraAnnualWithdrawals(input(change)),
    ).toThrow(message)
  })

  it('mints the annual basis evidence ID with the hardened structural minter', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(input())

    expect(result.annualBasisEvidence.basisEvidenceId).toBe(
      'owned-non-roth-ira-annual-basis:8ff6726c40841c1d40180a2fe9daba7e' +
        'cd8530c7868cb0b933220d8bf10c019d',
    )
    expect(
      classifyOwnedNonRothIraAnnualWithdrawals(input())
        .annualBasisEvidence.basisEvidenceId,
    ).toBe(result.annualBasisEvidence.basisEvidenceId)
    expect(
      classifyOwnedNonRothIraAnnualWithdrawals(input({
        annualBasisRecordEvidenceId: 'annual-basis-record-2',
      })).annualBasisEvidence.basisEvidenceId,
    ).not.toBe(result.annualBasisEvidence.basisEvidenceId)
  })
})
