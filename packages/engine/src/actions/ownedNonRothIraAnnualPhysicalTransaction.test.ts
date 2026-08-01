import { describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type ResolvedAnnualRetirementPhysicalEventRecord,
} from './annualRetirementPhysicalEventInventory.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  preparePlanOwnedNonRothIraAnnualPhysicalTransaction,
  type PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
} from './ownedNonRothIraAnnualPhysicalTransaction.js'
import * as structuralId from './structuralId.js'

const ownerPersonId = asPersonId('owner')
const spousePersonId = asPersonId('spouse')
const firstIraId = asAccountId('traditional-a')
const secondIraId = asAccountId('traditional-b')
const unchangedIraId = asAccountId('traditional-unchanged')
const rothId = asAccountId('roth-destination')

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = asPlanId('unified-physical-plan')
  value.household.people[0]!.id = ownerPersonId
  value.accounts = [
    traditionalAccount(firstIraId, 300, ownerPersonId),
    traditionalAccount(secondIraId, 200, ownerPersonId),
    traditionalAccount(unchangedIraId, 100, ownerPersonId),
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
  value.strategies.retirementActions = [{
    actionId: asActionId('withdrawal'),
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-01',
    executionSequence: 10,
    requestedAmount: asPositiveUsdCents(5_000),
    provenance: { source: 'manual' },
    personId: ownerPersonId,
    allocations: [{
      allocationId: asAllocationId('withdrawal-a'),
      sourceAccountId: firstIraId,
      requestedAmount: asPositiveUsdCents(5_000),
    }],
    purpose: { kind: 'spending' },
  }, {
    actionId: asActionId('conversion'),
    kind: 'rothConversion',
    year: 2030,
    executionDate: '2030-09-01',
    executionSequence: 20,
    requestedAmount: asPositiveUsdCents(3_000),
    provenance: { source: 'manual' },
    personId: ownerPersonId,
    allocations: [{
      allocationId: asAllocationId('conversion-a'),
      sourceAccountId: firstIraId,
      requestedAmount: asPositiveUsdCents(2_000),
    }, {
      allocationId: asAllocationId('conversion-b'),
      sourceAccountId: secondIraId,
      requestedAmount: asPositiveUsdCents(1_000),
    }],
    destinationRothAccountId: rothId,
    taxFunding: { kind: 'noneExpected' },
  }]
  return value
}

function planWithIraContribution(): Plan {
  const value = plan()
  const contributionSource = value.accounts.find(
    (account) => account.id === firstIraId,
  )
  if (contributionSource?.type !== 'traditional') {
    throw new Error('Fixture drift')
  }
  contributionSource.annualContribution = 100
  value.household.people[0]!.retirementAge = null
  value.incomes = [{
    type: 'wages',
    id: 'wages',
    personId: ownerPersonId,
    annualGross: 10_000,
    endAge: null,
    realGrowthPct: 0,
  }]
  return value
}

function planWithSepEmployerContribution(): Plan {
  const value = plan()
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: firstIraId,
      subtype: 'sep',
      evidenceId: 'first-ira-sep-classification',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [{
      sourceAccountId: firstIraId,
      actionTaxYear: 2030,
      planYearEndDate: '2030-12-31',
      employerContributionMadeForPlanYear: true,
      evidenceId: 'first-ira-sep-activity',
      provenance: { source: 'manual' },
    }],
    deductibleIraContributions: [],
  }
  return value
}

function runtimeRecord(
  overrides: Partial<ResolvedAnnualRetirementPhysicalEventRecord> = {},
): ResolvedAnnualRetirementPhysicalEventRecord {
  return {
    recordStatus: 'resolved',
    planId: asPlanId('unified-physical-plan'),
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    eventId: 'runtime-rmd-event',
    movementAuthorityId: 'runtime-rmd-authority',
    kind: 'ownedIraRmd',
    origin: 'rmdEngine',
    ownerPersonId,
    sourceAccountId: firstIraId,
    grossAmount: asPositiveUsdCents(1_000),
    executionDate: '2030-03-01',
    executionSequence: 5,
    upstreamEvidenceId: 'runtime-rmd-upstream',
    ...overrides,
  }
}

function contributionRecord(
  overrides: Partial<ResolvedAnnualRetirementPhysicalEventRecord> = {},
): ResolvedAnnualRetirementPhysicalEventRecord {
  return runtimeRecord({
    eventId: 'runtime-contribution',
    movementAuthorityId: 'runtime-contribution-authority',
    kind: 'ownedIraContribution',
    origin: 'contributionLedger',
    upstreamEvidenceId: 'runtime-contribution-upstream',
    ...overrides,
  })
}

function inventoryInput(
  valuePlan: Plan,
  runtimeRecords:
    BuildAnnualRetirementPhysicalEventInventoryInput['runtimeRecords'] = [],
): BuildAnnualRetirementPhysicalEventInventoryInput {
  return {
    plan: valuePlan,
    taxYear: 2030,
    runtimeRecords,
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      planId: asPlanId(valuePlan.id),
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

function input(
  valuePlan: Plan = plan(),
  runtimeRecords:
    BuildAnnualRetirementPhysicalEventInventoryInput['runtimeRecords'] = [],
  executionByAllocation: Readonly<Record<string, number>> = {
    'withdrawal-a': 4_000,
    'conversion-a': 2_000,
    'conversion-b': 0,
  },
): PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput {
  const inventoryPart = inventoryInput(valuePlan, runtimeRecords)
  const inventory = buildAnnualRetirementPhysicalEventInventory(inventoryPart)
  if (inventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error(
      `Fixture inventory failed: ${inventory.status} ${JSON.stringify(inventory.issues)}`,
    )
  }
  const pool = inventory.ownedIraPools.find(
    (candidate) => candidate.ownerPersonId === ownerPersonId,
  )
  if (pool === undefined) throw new Error('Fixture owner pool missing')
  const openingBalances = pool.sourceAccountIds.map((accountId) => ({
    accountId,
    openingBalance: asUsdCents(
      accountId === firstIraId
        ? 30_000
        : accountId === secondIraId
          ? 20_000
          : 10_000,
    ),
  }))
  const running = new Map(openingBalances.map((opening) => [
    opening.accountId,
    opening.openingBalance,
  ]))
  const actualApplications: Array<
    PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput[
      'actualApplications'
    ][number]
  > = []
  const settledContributionApplications: Array<
    PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput[
      'settledContributionApplications'
    ][number]
  > = []
  for (const event of pool.events) {
    if (
      event.kind === 'ownedIraContribution' ||
      event.kind === 'ownedIraEmployerContribution'
    ) {
      const sourceBalanceBefore = running.get(event.sourceAccountId)!
      const creditedAmount = asUsdCents(event.grossAmount)
      const sourceBalanceAfter = asUsdCents(
        sourceBalanceBefore + creditedAmount,
      )
      running.set(event.sourceAccountId, sourceBalanceAfter)
      settledContributionApplications.push({
        inventoryEventId: event.eventId,
        sourceBalanceBefore,
        creditedAmount,
        sourceBalanceAfter,
        stagingEvidenceId: `staging-${event.eventId}`,
      })
      continue
    }
    if (
      event.form8606Category === 'line7DistributionCandidate' ||
      event.form8606Category === 'line8ConversionCandidate'
    ) {
      const sourceBalanceBefore = running.get(event.sourceAccountId)!
      const executed = event.origin === 'planAction'
        ? executionByAllocation[event.allocationId] ?? Number(event.grossAmount)
        : Number(event.grossAmount)
      const executedAmount = asUsdCents(executed)
      const sourceBalanceAfter = asUsdCents(
        sourceBalanceBefore - executedAmount,
      )
      running.set(event.sourceAccountId, sourceBalanceAfter)
      actualApplications.push({
        inventoryEventId: event.eventId,
        sourceBalanceBefore,
        executedAmount,
        sourceBalanceAfter,
        stagingEvidenceId: `staging-${event.eventId}`,
      })
    }
  }
  return {
    ...inventoryPart,
    ownerPersonId,
    openingBalances,
    actualApplications,
    settledContributionApplications,
  }
}

function prepared(
  value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput = input(),
) {
  const result = preparePlanOwnedNonRothIraAnnualPhysicalTransaction(value)
  expect(result.status).toBe('unifiedAnnualPhysicalTransactionPrepared')
  if (result.status !== 'unifiedAnnualPhysicalTransactionPrepared') {
    throw new Error(`Expected prepared transaction, got ${result.status}`)
  }
  return result
}

function issueKinds(
  value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
): string[] {
  return preparePlanOwnedNonRothIraAnnualPhysicalTransaction(value).issues.map(
    (candidate) => candidate.kind,
  )
}

describe('preparePlanOwnedNonRothIraAnnualPhysicalTransaction', () => {
  it('rejoins same-owner withdrawals and conversions from actual staging facts', () => {
    const result = prepared()

    expect(result).toMatchObject({
      movement: 'notCommitted',
      actionability: 'notEstablished',
      transactionStatus: 'appliedToDetachedSnapshotOnly',
      line7GrossAmount: 4_000,
      line8GrossAmount: 2_000,
    })
    expect(result.applications).toHaveLength(3)
    expect(result.settledContributionApplications).toEqual([])
    expect(result.applications.map((application) => ({
      allocationId: application.allocationId,
      lineScope: application.lineScope,
      requestedAmount: application.requestedAmount,
      executedAmount: application.executedAmount,
      unexecutedAmount: application.unexecutedAmount,
    }))).toEqual([{
      allocationId: 'withdrawal-a',
      lineScope: 'form8606Line7Distributions',
      requestedAmount: 5_000,
      executedAmount: 4_000,
      unexecutedAmount: 1_000,
    }, {
      allocationId: 'conversion-a',
      lineScope: 'form8606Line8NetConversions',
      requestedAmount: 2_000,
      executedAmount: 2_000,
      unexecutedAmount: 0,
    }, {
      allocationId: 'conversion-b',
      lineScope: 'form8606Line8NetConversions',
      requestedAmount: 1_000,
      executedAmount: 0,
      unexecutedAmount: 1_000,
    }])
    expect(result.line7Entries).toEqual([expect.objectContaining({
      actionId: 'withdrawal',
      allocationId: 'withdrawal-a',
      grossAmount: 4_000,
    })])
    expect(result.line8Entries).toEqual([expect.objectContaining({
      actionId: 'conversion',
      allocationId: 'conversion-a',
      grossAmount: 2_000,
    })])
    expect(result.line8InventoryEvidence).toMatchObject({
      predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      entries: result.line8Entries,
    })
  })

  it('preserves zero conversion lineage without creating an allocator entry', () => {
    const result = prepared()
    expect(result.stagedDestinationCredits).toHaveLength(2)
    expect(result.stagedDestinationCredits.map((credit) => ({
      allocationId: credit.allocationId,
      destinationRothAccountId: credit.destinationRothAccountId,
      stagedCreditAmount: credit.stagedCreditAmount,
      creditStatus: credit.creditStatus,
    }))).toEqual([{
      allocationId: 'conversion-a',
      destinationRothAccountId: rothId,
      stagedCreditAmount: 2_000,
      creditStatus: 'detachedCandidateNotCommitted',
    }, {
      allocationId: 'conversion-b',
      destinationRothAccountId: rothId,
      stagedCreditAmount: 0,
      creditStatus: 'detachedCandidateNotCommitted',
    }])
    expect(result.line8Entries.map((entry) => entry.allocationId))
      .not.toContain('conversion-b')
  })

  it('publishes transitions for every pool sibling, including unchanged accounts', () => {
    const result = prepared()
    expect(result.sourceBalanceTransitions).toEqual([
      expect.objectContaining({
        sourceAccountId: firstIraId,
        openingBalance: 30_000,
        settledContributionAmount: 0,
        requestedAmount: 7_000,
        executedAmount: 6_000,
        unexecutedAmount: 1_000,
        detachedClosingBalance: 24_000,
      }),
      expect.objectContaining({
        sourceAccountId: secondIraId,
        openingBalance: 20_000,
        settledContributionAmount: 0,
        requestedAmount: 1_000,
        executedAmount: 0,
        unexecutedAmount: 1_000,
        detachedClosingBalance: 20_000,
      }),
      expect.objectContaining({
        sourceAccountId: unchangedIraId,
        openingBalance: 10_000,
        settledContributionAmount: 0,
        requestedAmount: 0,
        executedAmount: 0,
        unexecutedAmount: 0,
        detachedClosingBalance: 10_000,
      }),
    ])
    expect(result.sourceBalanceTransitions.every((transition) =>
      transition.upstreamEvidenceId.startsWith(
        'owned-ira-unified-annual-source-balance-upstream:',
      ) && transition.upstreamEvidenceId !== result.inventory.inventoryEvidenceId,
    )).toBe(true)
  })

  it('retains every application in an all-zero Plan batch', () => {
    const result = prepared(input(plan(), [], {
      'withdrawal-a': 0,
      'conversion-a': 0,
      'conversion-b': 0,
    }))
    expect(result.applications).toHaveLength(3)
    expect(result.applications.every((application) =>
      application.executedAmount === 0,
    )).toBe(true)
    expect(result.line7Entries).toEqual([])
    expect(result.line8Entries).toEqual([])
    expect(result.line7GrossAmount).toBe(0)
    expect(result.line8GrossAmount).toBe(0)
    expect(result.line8InventoryEvidence.entries).toEqual([])
  })

  it('is invariant to opening-balance and application input permutations', () => {
    const canonical = input()
    const permuted = {
      ...canonical,
      openingBalances: [...canonical.openingBalances].reverse(),
      actualApplications: [...canonical.actualApplications].reverse(),
    }
    expect(prepared(permuted)).toEqual(prepared(canonical))
  })

  it('derives runtime line-7 allocator identities and requires exact runtime gross', () => {
    const runtime = runtimeRecord()
    const value = input(plan(), [runtime])
    const result = prepared(value)
    const runtimeApplication = result.applications[0]!
    expect(runtimeApplication).toMatchObject({
      inventoryEventId: 'runtime-rmd-event',
      eventOrigin: 'rmdEngine',
      lineScope: 'form8606Line7Distributions',
      requestedAmount: 1_000,
      executedAmount: 1_000,
    })
    expect(runtimeApplication.actionId).toMatch(
      /^owned-ira-unified-runtime-action:/,
    )
    expect(runtimeApplication.allocationId).toMatch(
      /^owned-ira-unified-runtime-allocation:/,
    )

    const mismatched = input(plan(), [runtime])
    mismatched.actualApplications = [{
      ...mismatched.actualApplications[0]!,
      executedAmount: asUsdCents(999),
      sourceBalanceAfter: asUsdCents(29_001),
    }, ...mismatched.actualApplications.slice(1)]
    expect(issueKinds(mismatched)).toContain('runtimeExecutionMismatch')
  })

  it('preserves one runtime authority across multiple source allocations', () => {
    const first = runtimeRecord()
    const second = runtimeRecord({
      eventId: 'runtime-rmd-second-source',
      sourceAccountId: secondIraId,
      upstreamEvidenceId: 'runtime-rmd-second-upstream',
    })
    const result = prepared(input(plan(), [second, first]))
    const runtimeApplications = result.applications.filter(
      (application) => application.eventOrigin === 'rmdEngine',
    )
    expect(runtimeApplications).toHaveLength(2)
    expect(new Set(runtimeApplications.map((application) =>
      application.actionId,
    )).size).toBe(1)
    expect(new Set(runtimeApplications.map((application) =>
      application.allocationId,
    )).size).toBe(2)
  })

  it('keeps runtime allocator identities stable across unrelated inventory lineage', () => {
    const firstInput = input(plan(), [runtimeRecord()])
    const secondInput = input(plan(), [runtimeRecord()])
    secondInput.runtimeInventoryAttestation = {
      ...secondInput.runtimeInventoryAttestation,
      upstreamEvidenceId: 'runtime-inventory-upstream-unrelated-change',
    }
    const firstResult = prepared(firstInput)
    const secondResult = prepared(secondInput)
    const firstRuntime = firstResult.applications.find(
      (application) => application.eventOrigin === 'rmdEngine',
    )!
    const secondRuntime = secondResult.applications.find(
      (application) => application.eventOrigin === 'rmdEngine',
    )!
    expect(secondResult.inventory.inventoryEvidenceId).not.toBe(
      firstResult.inventory.inventoryEvidenceId,
    )
    expect(secondRuntime.actionId).toBe(firstRuntime.actionId)
    expect(secondRuntime.allocationId).toBe(firstRuntime.allocationId)
  })

  it('blocks a legacy runtime conversion whose inventory has no destination', () => {
    const valuePlan = plan()
    valuePlan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2030, amount: 10 }],
    }
    const legacyConversion = runtimeRecord({
      eventId: 'runtime-conversion',
      movementAuthorityId: 'runtime-conversion-authority',
      kind: 'legacyRothConversion',
      origin: 'legacyProjection',
      upstreamEvidenceId: 'runtime-conversion-upstream',
    })
    expect(issueKinds(input(valuePlan, [legacyConversion])))
      .toContain('destinationLineageIncomplete')
  })

  it('passes an invalid cross-owner conversion destination through inventory validation', () => {
    const valuePlan = plan()
    valuePlan.household.people.push({
      ...valuePlan.household.people[0]!,
      id: spousePersonId,
    })
    const destination = valuePlan.accounts.find(
      (account) => account.id === rothId,
    )
    if (destination?.type !== 'roth') throw new Error('Fixture drift')
    destination.ownerPersonId = spousePersonId
    valuePlan.household.filingStatus = 'marriedFilingJointly'
    const base = inventoryInput(valuePlan)
    const result = preparePlanOwnedNonRothIraAnnualPhysicalTransaction({
      ...base,
      ownerPersonId,
      openingBalances: [],
      actualApplications: [],
      settledContributionApplications: [],
    })
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'planInvalid' }),
    ]))
  })

  it('requires the QCD stage', () => {
    const qcdPlan = plan()
    qcdPlan.strategies.retirementActions.push({
      actionId: asActionId('qcd'),
      kind: 'qcd',
      year: 2030,
      executionDate: '2030-04-01',
      executionSequence: 2,
      requestedAmount: asPositiveUsdCents(500),
      provenance: { source: 'manual' },
      donorPersonId: ownerPersonId,
      allocation: {
        allocationId: asAllocationId('qcd-a'),
        sourceAccountId: firstIraId,
        requestedAmount: asPositiveUsdCents(500),
      },
      charity: {
        designationId: 'charity',
        name: 'Public Charity',
        designationKind: 'eligiblePublicCharity',
        directFromCustodianAttested: true,
        eligibleOrganizationAttested: true,
        notDonorAdvisedFundOrSupportingOrganizationAttested: true,
        notSplitInterestEntityAttested: true,
        entireDistributionOtherwiseDeductibleAttested: true,
      },
    })
    expect(issueKinds(input(qcdPlan))).toContain('qcdStageRequired')

    const qcdAndContributionPlan = planWithIraContribution()
    qcdAndContributionPlan.strategies.retirementActions.push(
      qcdPlan.strategies.retirementActions.at(-1)!,
    )
    expect(issueKinds(input(
      qcdAndContributionPlan,
      [contributionRecord()],
    ))).toContain('qcdStageRequired')
  })

  it('settles owned-IRA contribution inflows without creating allocator entries', () => {
    const result = prepared(input(
      planWithIraContribution(),
      [contributionRecord()],
    ))
    expect(result.settledContributionApplications).toEqual([
      expect.objectContaining({
        predicate: 'ownedNonRothIraSettledAnnualContributionApplication',
        inventoryEventId: 'runtime-contribution',
        eventOrigin: 'contributionLedger',
        eventKind: 'ownedIraContribution',
        movementAuthorityId: 'runtime-contribution-authority',
        sourceAccountId: firstIraId,
        scheduledDate: '2030-03-01',
        scheduledSequence: 5,
        inventoriedAmount: 1_000,
        sourceBalanceBefore: 30_000,
        creditedAmount: 1_000,
        sourceBalanceAfter: 31_000,
        inventoryEventUpstreamEvidenceId: 'runtime-contribution-upstream',
      }),
    ])
    expect(result.settledContributionApplications[0]!.applicationEvidenceId)
      .toMatch(/^owned-ira-unified-annual-settled-contribution-application:/)
    expect(result.sourceBalanceTransitions[0]).toMatchObject({
      sourceAccountId: firstIraId,
      openingBalance: 30_000,
      settledContributionAmount: 1_000,
      requestedAmount: 7_000,
      executedAmount: 6_000,
      detachedClosingBalance: 25_000,
    })
    expect(result.applications).toHaveLength(3)
    expect(result.line7Entries).toHaveLength(1)
    expect(result.line8Entries).toHaveLength(1)
  })

  it('settles a SEP/SIMPLE employer contribution through the same inflow boundary', () => {
    const result = prepared(input(planWithSepEmployerContribution(), [
      contributionRecord({
        kind: 'ownedIraEmployerContribution',
        eventId: 'runtime-employer-contribution',
        movementAuthorityId: 'runtime-employer-contribution-authority',
        upstreamEvidenceId: 'runtime-employer-contribution-upstream',
      }),
    ]))
    expect(result.settledContributionApplications).toEqual([
      expect.objectContaining({
        inventoryEventId: 'runtime-employer-contribution',
        eventKind: 'ownedIraEmployerContribution',
        creditedAmount: 1_000,
      }),
    ])
  })

  it('weaves contribution inflows and debits in canonical inventory chronology', () => {
    const valuePlan = planWithIraContribution()
    const records = [
      contributionRecord(),
      contributionRecord({
        eventId: 'runtime-contribution-after-withdrawal',
        movementAuthorityId: 'runtime-contribution-after-withdrawal-authority',
        grossAmount: asPositiveUsdCents(500),
        executionDate: '2030-07-01',
        executionSequence: 15,
        upstreamEvidenceId: 'runtime-contribution-after-withdrawal-upstream',
      }),
    ]
    const canonical = input(valuePlan, records)
    const result = prepared(canonical)
    expect(result.settledContributionApplications.map((application) => ({
      inventoryEventId: application.inventoryEventId,
      sourceBalanceBefore: application.sourceBalanceBefore,
      creditedAmount: application.creditedAmount,
      sourceBalanceAfter: application.sourceBalanceAfter,
    }))).toEqual([{
      inventoryEventId: 'runtime-contribution',
      sourceBalanceBefore: 30_000,
      creditedAmount: 1_000,
      sourceBalanceAfter: 31_000,
    }, {
      inventoryEventId: 'runtime-contribution-after-withdrawal',
      sourceBalanceBefore: 27_000,
      creditedAmount: 500,
      sourceBalanceAfter: 27_500,
    }])
    expect(result.sourceBalanceTransitions[0]).toMatchObject({
      settledContributionAmount: 1_500,
      executedAmount: 6_000,
      detachedClosingBalance: 25_500,
    })

    const permuted = {
      ...canonical,
      openingBalances: [...canonical.openingBalances].reverse(),
      actualApplications: [...canonical.actualApplications].reverse(),
      settledContributionApplications: [
        ...canonical.settledContributionApplications,
      ].reverse(),
    }
    expect(prepared(permuted)).toEqual(result)
    expect(prepared(input(valuePlan, [...records].reverse()))).toEqual(result)
  })

  it.each([
    ['missing', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = []
    }, 'contributionApplicationMissing'],
    ['duplicate', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [
        ...value.settledContributionApplications,
        value.settledContributionApplications[0]!,
      ]
    }, 'contributionApplicationDuplicate'],
    ['foreign', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [{
        ...value.settledContributionApplications[0]!,
        inventoryEventId: value.actualApplications[0]!.inventoryEventId,
        stagingEvidenceId: 'foreign-contribution-staging',
      }]
    }, 'contributionApplicationForeign'],
  ] as const)(
    'rejects %s settled contribution event coverage',
    (_label, mutate, kind) => {
      const value = input(planWithIraContribution(), [contributionRecord()])
      mutate(value)
      expect(issueKinds(value)).toContain(kind)
    },
  )

  it('rejects a contribution event smuggled into line-7/line-8 applications', () => {
    const value = input(planWithIraContribution(), [contributionRecord()])
    const contribution = value.settledContributionApplications[0]!
    value.actualApplications = [{
      inventoryEventId: contribution.inventoryEventId,
      sourceBalanceBefore: contribution.sourceBalanceBefore,
      executedAmount: asUsdCents(0),
      sourceBalanceAfter: contribution.sourceBalanceBefore,
      stagingEvidenceId: 'wrong-role-contribution-staging',
    }, ...value.actualApplications]
    expect(issueKinds(value)).toContain('actualApplicationForeign')
  })

  it.each([
    ['wrong before', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [{
        ...value.settledContributionApplications[0]!,
        sourceBalanceBefore: asUsdCents(29_999),
        sourceBalanceAfter: asUsdCents(30_999),
      }]
    }, 'sourceBalanceMismatch'],
    ['wrong credit', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [{
        ...value.settledContributionApplications[0]!,
        creditedAmount: asUsdCents(999),
        sourceBalanceAfter: asUsdCents(30_999),
      }]
    }, 'contributionCreditMismatch'],
    ['zero credit', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [{
        ...value.settledContributionApplications[0]!,
        creditedAmount: asUsdCents(0),
        sourceBalanceAfter: asUsdCents(30_000),
      }]
    }, 'contributionCreditMismatch'],
    ['wrong after', (
      value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    ) => {
      value.settledContributionApplications = [{
        ...value.settledContributionApplications[0]!,
        sourceBalanceAfter: asUsdCents(30_999),
      }]
    }, 'sourceArithmeticMismatch'],
  ] as const)(
    'rejects settled contribution %s staging arithmetic',
    (_label, mutate, kind) => {
      const value = input(planWithIraContribution(), [contributionRecord()])
      mutate(value)
      expect(issueKinds(value)).toContain(kind)
    },
  )

  it('rejects malformed and colliding settled contribution evidence', () => {
    const malformed = input(planWithIraContribution(), [contributionRecord()])
    Object.assign(malformed.settledContributionApplications[0] as object, {
      sourceAccountId: secondIraId,
    })
    expect(issueKinds(malformed)).toContain('contributionApplicationInvalid')

    const unsafe = input(planWithIraContribution(), [contributionRecord()])
    unsafe.settledContributionApplications = [{
      ...unsafe.settledContributionApplications[0]!,
      creditedAmount: Number.MAX_SAFE_INTEGER + 1 as never,
    }]
    expect(issueKinds(unsafe)).toContain('contributionApplicationInvalid')

    const crossRole = input(planWithIraContribution(), [contributionRecord()])
    crossRole.settledContributionApplications = [{
      ...crossRole.settledContributionApplications[0]!,
      stagingEvidenceId: firstIraId,
    }]
    expect(issueKinds(crossRole)).toContain('identifierCollision')

    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId')
      .mockImplementation((prefix, parts) =>
        prefix ===
          'owned-ira-unified-annual-settled-contribution-application'
          ? firstIraId
          : original(prefix, parts))
    try {
      expect(issueKinds(input(
        planWithIraContribution(),
        [contributionRecord()],
      ))).toContain('identifierCollision')
    } finally {
      spy.mockRestore()
    }
  })

  it.each([
    ['missing', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = value.actualApplications.slice(1)
    }, 'actualApplicationMissing'],
    ['duplicate', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = [
        ...value.actualApplications,
        value.actualApplications[0]!,
      ]
    }, 'actualApplicationDuplicate'],
    ['foreign', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = [{
        ...value.actualApplications[0]!,
        inventoryEventId: 'foreign-event',
        stagingEvidenceId: 'foreign-staging',
      }, ...value.actualApplications.slice(1)]
    }, 'actualApplicationForeign'],
  ] as const)('rejects %s actual event coverage', (_label, mutate, kind) => {
    const value = input()
    mutate(value)
    expect(issueKinds(value)).toContain(kind)
  })

  it('rejects caller attempts to substitute inventory-derived identity or scope', () => {
    const value = input()
    Object.assign(value.actualApplications[0] as object, {
      sourceAccountId: secondIraId,
      lineScope: 'form8606Line8NetConversions',
      actionId: asActionId('substituted-action'),
      scheduledDate: '2030-12-31',
      destinationRothAccountId: secondIraId,
    })
    expect(issueKinds(value)).toContain('actualApplicationInvalid')
  })

  it.each([
    ['wrong before', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = [{
        ...value.actualApplications[0]!,
        sourceBalanceBefore: asUsdCents(29_999),
      }, ...value.actualApplications.slice(1)]
    }, 'sourceBalanceMismatch'],
    ['wrong after', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = [{
        ...value.actualApplications[0]!,
        sourceBalanceAfter: asUsdCents(25_999),
      }, ...value.actualApplications.slice(1)]
    }, 'sourceArithmeticMismatch'],
    ['over request', (value: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput) => {
      value.actualApplications = [{
        ...value.actualApplications[0]!,
        executedAmount: asUsdCents(5_001),
        sourceBalanceAfter: asUsdCents(24_999),
      }, ...value.actualApplications.slice(1)]
    }, 'executionExceedsRequested'],
  ] as const)('rejects %s staging arithmetic', (_label, mutate, kind) => {
    const value = input()
    mutate(value)
    expect(issueKinds(value)).toContain(kind)
  })

  it('requires exact complete opening balances including unchanged siblings', () => {
    const missing = input()
    missing.openingBalances = missing.openingBalances.filter(
      (opening) => opening.accountId !== unchangedIraId,
    )
    expect(issueKinds(missing)).toContain('openingBalanceMissing')

    const duplicate = input()
    duplicate.openingBalances = [
      ...duplicate.openingBalances,
      duplicate.openingBalances[0]!,
    ]
    expect(issueKinds(duplicate)).toContain('openingBalanceDuplicate')

    const foreign = input()
    foreign.openingBalances = [...foreign.openingBalances, {
      accountId: rothId,
      openingBalance: asUsdCents(0),
    }]
    expect(issueKinds(foreign)).toContain('openingBalanceForeign')
  })

  it('rejects unsafe cents, cross-role evidence IDs, and derived ID collisions', () => {
    const unsafe = input()
    unsafe.actualApplications = [{
      ...unsafe.actualApplications[0]!,
      executedAmount: Number.MAX_SAFE_INTEGER + 1 as never,
    }, ...unsafe.actualApplications.slice(1)]
    expect(issueKinds(unsafe)).toContain('actualApplicationInvalid')

    const crossRole = input()
    crossRole.actualApplications = [{
      ...crossRole.actualApplications[0]!,
      stagingEvidenceId: firstIraId,
    }, ...crossRole.actualApplications.slice(1)]
    expect(issueKinds(crossRole)).toContain('identifierCollision')

    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId')
      .mockImplementation((prefix, parts) =>
        prefix === 'owned-ira-unified-annual-physical-transaction'
          ? firstIraId
          : original(prefix, parts))
    try {
      expect(issueKinds(input())).toContain('identifierCollision')
    } finally {
      spy.mockRestore()
    }
  })

  it('fails closed on hostile getters', () => {
    const value = input()
    Object.defineProperty(value, 'actualApplications', {
      get(): never {
        throw new Error('hostile getter')
      },
    })
    expect(preparePlanOwnedNonRothIraAnnualPhysicalTransaction(value))
      .toMatchObject({
        status: 'unifiedAnnualPhysicalTransactionBlocked',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        transactionEvidenceId: null,
        inventory: null,
        issues: [{ kind: 'hostileInput' }],
      })
  })

  it('fails closed on hostile settled contribution getters', () => {
    const value = input(planWithIraContribution(), [contributionRecord()])
    Object.defineProperty(value, 'settledContributionApplications', {
      get(): never {
        throw new Error('hostile getter')
      },
    })
    expect(preparePlanOwnedNonRothIraAnnualPhysicalTransaction(value))
      .toMatchObject({
        status: 'unifiedAnnualPhysicalTransactionBlocked',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        transactionEvidenceId: null,
        inventory: null,
        issues: [{ kind: 'hostileInput' }],
      })
  })

  it('fails closed on hostile settled contribution application fields', () => {
    const value = input(planWithIraContribution(), [contributionRecord()])
    Object.defineProperty(value.settledContributionApplications[0],
      'creditedAmount', {
        get(): never {
          throw new Error('hostile getter')
        },
      })
    expect(preparePlanOwnedNonRothIraAnnualPhysicalTransaction(value))
      .toMatchObject({
        status: 'unifiedAnnualPhysicalTransactionBlocked',
        movement: 'notCommitted',
        actionability: 'notEstablished',
        transactionEvidenceId: null,
        inventory: null,
        issues: [{ kind: 'hostileInput' }],
      })
  })

  it('returns detached immutable evidence without mutating inputs', () => {
    const value = input()
    const before = JSON.stringify(value)
    const result = prepared(value)
    expect(JSON.stringify(value)).toBe(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.applications)).toBe(true)
    expect(Object.isFrozen(result.applications[0])).toBe(true)
    expect(Object.isFrozen(result.stagedDestinationCredits[0])).toBe(true)
    expect(Object.isFrozen(result.sourceBalanceTransitions[0])).toBe(true)

    const contributionResult = prepared(input(
      planWithIraContribution(),
      [contributionRecord()],
    ))
    expect(Object.isFrozen(
      contributionResult.settledContributionApplications,
    )).toBe(true)
    expect(Object.isFrozen(
      contributionResult.settledContributionApplications[0],
    )).toBe(true)
  })
})
