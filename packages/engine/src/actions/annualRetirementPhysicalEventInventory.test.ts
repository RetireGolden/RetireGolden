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
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
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
  const employer = plan.accounts.find((account) => account.id === employerId)
  if (employer?.type !== 'traditional') throw new Error('fixture drift')
  employer.employerMatch = { matchPct: 50, capPctOfPay: 6 }
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

function unresolved(
  overrides: Partial<UnresolvedAnnualRetirementPhysicalActivityRecord> = {},
): UnresolvedAnnualRetirementPhysicalActivityRecord {
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
    ...overrides,
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
      sourceAccountKind: 'ira',
      sourceInheritanceStatus: 'owned',
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

  it('binds Plan-event IDs to owner and source-account classification', () => {
    const originalPlan = basePlan()
    const originalResult = built(input(originalPlan))

    const changedOwnerPlan = basePlan()
    const person = changedOwnerPlan.household.people[0]!
    changedOwnerPlan.household.people.push({
      ...person,
      id: spousePersonId,
    })
    const changedOwnerAction =
      changedOwnerPlan.strategies.retirementActions[0]
    const changedOwnerAccount = changedOwnerPlan.accounts.find(
      (account) => account.id === ownedIraId,
    )
    if (changedOwnerAction?.kind !== 'ordinaryWithdrawal' ||
      changedOwnerAccount?.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    changedOwnerAction.personId = spousePersonId
    changedOwnerAccount.ownerPersonId = spousePersonId
    const changedOwnerResult = built(input(changedOwnerPlan))
    expect(changedOwnerResult.events[0]!.eventId).not.toBe(
      originalResult.events[0]!.eventId,
    )

    const changedClassPlan = basePlan()
    const changedClassAccount = changedClassPlan.accounts.find(
      (account) => account.id === ownedIraId,
    )
    if (changedClassAccount?.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    changedClassAccount.kind = 'employer'
    const changedClassResult = built(input(changedClassPlan))
    expect(changedClassResult.events[0]).toMatchObject({
      sourceAccountKind: 'employer',
      sourceInheritanceStatus: 'owned',
      form8606Category: 'nonForm8606OrForeignPoolEvent',
    })
    expect(changedClassResult.events[0]!.eventId).not.toBe(
      originalResult.events[0]!.eventId,
    )
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
    ['ownedIraContribution', ownedIraId, 0],
    ['ownedIraEmployerContribution', siblingIraId, 1],
    ['employerPlanEmployeeContribution', employerId, 2],
    ['employerPlanEmployerMatch', employerId, 2],
  ] as const)(
    'inventories explicit %s inflows and prevents standalone execution',
    (kind, sourceAccountId, sourceBalanceIndex) => {
      const plan = basePlan()
      const owner = plan.household.people[0]!
      owner.dob = '1970-01-01'
      owner.retirementAge = null
      plan.incomes = [{
        type: 'wages',
        id: 'owner-current-wages',
        personId: ownerPersonId,
        annualGross: 100_000,
        endAge: null,
        realGrowthPct: 0,
      }]
      const employer = plan.accounts.find(
        (account) => account.id === employerId,
      )
      if (employer?.type !== 'traditional') throw new Error('fixture drift')
      employer.annualContribution = 10_000
      const ownedIra = plan.accounts.find(
        (account) => account.id === ownedIraId,
      )
      if (ownedIra?.type !== 'traditional') throw new Error('fixture drift')
      ownedIra.annualContribution = 7_000
      plan.retirementActionEligibilityFacts = {
        iraClassifications: [{
          sourceAccountId: siblingIraId,
          subtype: 'sep',
          evidenceId: 'sibling-sep-classification',
          provenance: { source: 'manual' },
        }],
        sepSimpleActivities: [{
          sourceAccountId: siblingIraId,
          actionTaxYear: 2030,
          planYearEndDate: '2030-12-31',
          employerContributionMadeForPlanYear: true,
          evidenceId: 'sibling-sep-activity',
          provenance: { source: 'manual' },
        }],
        deductibleIraContributions: [],
      }
      const result = built(input(plan, [resolved({
        kind,
        origin: 'contributionLedger',
        sourceAccountId,
        sourceBalanceIndex,
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

  it('requires a structurally possible current-year owned-IRA contribution', () => {
    expect(issueKinds(input(basePlan(), [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
    })]))).toContain('sourceKindMismatch')

    const legacyWithoutWages = basePlan()
    legacyWithoutWages.household.people[0]!.dob = '1970-01-01'
    const legacyIra = legacyWithoutWages.accounts.find(
      (account) => account.id === ownedIraId,
    )
    if (legacyIra?.type !== 'traditional') throw new Error('fixture drift')
    legacyIra.annualContribution = 7_000
    expect(issueKinds(input(legacyWithoutWages, [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
    })]))).toContain('sourceKindMismatch')

    const scheduled = basePlan()
    scheduled.household.people[0]!.dob = '1970-01-01'
    const scheduledIra = scheduled.accounts.find(
      (account) => account.id === ownedIraId,
    )
    if (scheduledIra?.type !== 'traditional') throw new Error('fixture drift')
    scheduledIra.contributionSchedule = [{
      annualAmount: 7_000,
      fromAge: 60,
      toAge: 60,
      escalationPct: 0,
    }]
    expect(buildAnnualRetirementPhysicalEventInventory(input(
      scheduled,
      [resolved({
        kind: 'ownedIraContribution',
        origin: 'contributionLedger',
        sourceBalanceIndex: 0,
      })],
    )).status).toBe('annualPhysicalEventInventoryBuilt')

    scheduled.household.people[0]!.longevity.planningAge = 60
    scheduled.household.people[0]!.dob = '1969-01-01'
    scheduledIra.contributionSchedule = [{
      annualAmount: 7_000,
      fromAge: 61,
      toAge: 61,
      escalationPct: 0,
    }]
    expect(issueKinds(input(scheduled, [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
    })]))).toContain('sourceKindMismatch')
  })

  it('validates positional IRA and employer inflows against their exact physical rows', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1970-01-01'
    plan.strategies.retirementActions = []
    plan.incomes = [{
      type: 'wages',
      id: 'owner-current-wages',
      personId: ownerPersonId,
      annualGross: 100_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const firstIra = traditionalAccount(ownedIraId, 0, ownerPersonId)
    const selectedIra = traditionalAccount(ownedIraId, 0, ownerPersonId)
    const firstEmployer = traditionalAccount(employerId, 0, ownerPersonId, 'employer')
    const selectedEmployer = traditionalAccount(employerId, 0, ownerPersonId, 'employer')
    if (firstIra.type !== 'traditional' || selectedIra.type !== 'traditional' ||
        firstEmployer.type !== 'traditional' || selectedEmployer.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    firstIra.annualContribution = 3_000
    selectedIra.annualContribution = 0
    firstEmployer.annualContribution = 10_000
    firstEmployer.employerMatch = { matchPct: 50, capPctOfPay: 6 }
    selectedEmployer.annualContribution = 0
    plan.accounts = [firstIra, selectedIra, firstEmployer, selectedEmployer]

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan, [
      resolved({
        eventId: 'physical-ira-contribution',
        movementAuthorityId: 'physical-ira-contribution-authority',
        upstreamEvidenceId: 'physical-ira-contribution-upstream',
        kind: 'ownedIraContribution',
        origin: 'contributionLedger',
        sourceAccountId: ownedIraId,
        sourceBalanceIndex: 0,
      }),
      resolved({
        eventId: 'physical-employer-contribution',
        movementAuthorityId: 'physical-employer-contribution-authority',
        upstreamEvidenceId: 'physical-employer-contribution-upstream',
        kind: 'employerPlanEmployeeContribution',
        origin: 'contributionLedger',
        sourceAccountId: employerId,
        sourceBalanceIndex: 2,
        executionSequence: 11,
      }),
      resolved({
        eventId: 'physical-employer-match',
        movementAuthorityId: 'physical-employer-match-authority',
        upstreamEvidenceId: 'physical-employer-match-upstream',
        kind: 'employerPlanEmployerMatch',
        origin: 'contributionLedger',
        sourceAccountId: employerId,
        sourceBalanceIndex: 2,
        executionSequence: 12,
      }),
    ]))

    expect(result.status).toBe('annualPhysicalEventInventoryBuilt')
    expect(result.issues.map((item) => item.kind)).not.toContain('sourceKindMismatch')
    expect(result.issues.map((item) => item.kind)).not.toContain('sourceForeignToPlan')
  })

  it('fails closed when a positional runtime source does not match its physical row', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []
    const result = buildAnnualRetirementPhysicalEventInventory(input(plan, [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
      sourceAccountId: ownedIraId,
      sourceBalanceIndex: 2,
    })]))

    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues.map((item) => item.kind)).toContain('sourceForeignToPlan')
  })

  it('requires a physical index for a positional event even when its source ID is unique', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []
    const account = traditionalAccount(ownedIraId, 1_000, ownerPersonId)
    if (account.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    account.annualContribution = 3_000
    plan.accounts = [account]

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan, [resolved({
      kind: 'ownedIraContribution',
      origin: 'contributionLedger',
      sourceAccountId: ownedIraId,
    })]))

    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues.map((item) => item.kind)).toContain('runtimeRecordBindingMismatch')
  })

  it('rejects a physical index on an ID-grouped runtime event', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []
    plan.accounts = [
      traditionalAccount(ownedIraId, 1_000, ownerPersonId),
      traditionalAccount(ownedIraId, 2_000, ownerPersonId),
    ]

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan, [resolved({
      kind: 'ownedIraRmd',
      origin: 'rmdEngine',
      sourceAccountId: ownedIraId,
      sourceBalanceIndex: 0,
    })]))

    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues.map((item) => item.kind)).toContain('runtimeRecordBindingMismatch')
  })

  it('classifies a non-balance Plan source as the wrong kind rather than foreign', () => {
    const plan = basePlan()
    plan.accounts.push({
      type: 'property',
      id: 'property-source',
      name: 'Property source',
      ownerPersonId,
      annualReturnPct: 0,
      value: 100_000,
      plannedSaleYear: null,
      expectedNetProceeds: null,
    })
    const result = buildAnnualRetirementPhysicalEventInventory(input(plan, [resolved({
      sourceAccountId: asAccountId('property-source'),
    })]))

    expect(result.issues.map((item) => item.kind)).toContain('sourceKindMismatch')
    expect(result.issues.map((item) => item.kind)).not.toContain('sourceForeignToPlan')
  })

  it('rejects owned-IRA contributions on S2 accounts past the election year', () => {
    // Post-flip the account is owned for RMD/Form 8606, but contributions stay
    // blocked on any account with an inherited block (WS5 residual).
    const plan = basePlan()
    plan.household.people[0]!.dob = '1950-01-01'
    plan.incomes = [{
      type: 'wages',
      id: 'owner-current-wages',
      personId: ownerPersonId,
      annualGross: 100_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const inheritedAccount = plan.accounts.find((account) => account.id === inheritedId)
    if (inheritedAccount?.type !== 'traditional' || inheritedAccount.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedAccount.annualContribution = 7_000
    inheritedAccount.inherited = {
      ownerDeathYear: 2020,
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'surviving-spouse',
        beneficiaryBirthYear: 1950,
        soleBeneficiary: true,
        ownerBirthYear: 1945,
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
        treatAsOwnElectionYear: 2035,
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    }
    expect(issueKinds({
      ...input(plan, [resolved({
        kind: 'ownedIraContribution',
        origin: 'contributionLedger',
        sourceAccountId: inheritedId,
        taxYear: 2036,
      })]),
      taxYear: 2036,
      runtimeInventoryAttestation: {
        ...input(plan).runtimeInventoryAttestation!,
        taxYear: 2036,
      },
    })).toContain('sourceKindMismatch')
  })

  it.each([
    'employerPlanEmployeeContribution',
    'employerPlanEmployerMatch',
  ] as const)(
    'requires positive current-year employee-contribution prerequisites for %s',
    (kind) => {
      const noContribution = basePlan()
      noContribution.household.people[0]!.dob = '1970-01-01'
      noContribution.incomes = [{
        type: 'wages',
        id: 'owner-current-wages',
        personId: ownerPersonId,
        annualGross: 100_000,
        endAge: null,
        realGrowthPct: 0,
      }]
      expect(issueKinds(input(noContribution, [resolved({
        kind,
        origin: 'contributionLedger',
        sourceAccountId: employerId,
      })]))).toContain('sourceKindMismatch')

      const noWages = basePlan()
      noWages.household.people[0]!.dob = '1970-01-01'
      const employer = noWages.accounts.find(
        (account) => account.id === employerId,
      )
      if (employer?.type !== 'traditional') throw new Error('fixture drift')
      employer.annualContribution = 10_000
      expect(issueKinds(input(noWages, [resolved({
        kind,
        origin: 'contributionLedger',
        sourceAccountId: employerId,
      })]))).toContain('sourceKindMismatch')
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

  it.each([
    ['missing', []],
    ['explicitly absent', [{
      sourceAccountId: siblingIraId,
      actionTaxYear: 2030,
      planYearEndDate: '2030-12-31',
      employerContributionMadeForPlanYear: false,
      evidenceId: 'sibling-sep-no-employer-contribution',
      provenance: { source: 'manual' as const },
    }]],
    ['wrong-year', [{
      sourceAccountId: siblingIraId,
      actionTaxYear: 2029,
      planYearEndDate: '2029-12-31',
      employerContributionMadeForPlanYear: true,
      evidenceId: 'sibling-sep-prior-year-employer-contribution',
      provenance: { source: 'manual' as const },
    }]],
  ])(
    'rejects a SEP/SIMPLE employer contribution when current-year evidence is %s',
    (_label, sepSimpleActivities) => {
      const plan = basePlan()
      plan.retirementActionEligibilityFacts = {
        iraClassifications: [{
          sourceAccountId: siblingIraId,
          subtype: 'sep',
          evidenceId: 'sibling-sep-classification',
          provenance: { source: 'manual' },
        }],
        sepSimpleActivities,
        deductibleIraContributions: [],
      }
      expect(issueKinds(input(plan, [resolved({
        kind: 'ownedIraEmployerContribution',
        origin: 'contributionLedger',
        sourceAccountId: siblingIraId,
      })]))).toContain('sourceKindMismatch')
    },
  )

  it('accepts inherited RMD activity from any inherited traditional account kind', () => {
    const plan = basePlan()
    const employer = plan.accounts.find((account) => account.id === employerId)
    if (employer?.type !== 'traditional') throw new Error('fixture drift')
    employer.inherited = {
      ownerDeathYear: 2028,
      decedentHadStartedRmds: true,
    }
    expect(buildAnnualRetirementPhysicalEventInventory(input(plan, [resolved({
      kind: 'inheritedIraRmd',
      sourceAccountId: employerId,
    })])).status).toBe('annualPhysicalEventInventoryBuilt')
    expect(issueKinds(input(plan, [resolved({
      kind: 'employerPlanRmd',
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
    expect(result.events[0]).toMatchObject({
      destinationRothAccountId: rothId,
      charity: null,
    })
    expect(result.events[1]).toMatchObject({
      destinationRothAccountId: null,
      charity: {
        designationId: 'charity-one',
        name: 'Public Charity',
      },
    })
  })

  it('binds conversion destinations and QCD charity designations into event evidence', () => {
    const conversionPlan = basePlan()
    const alternateRothId = asAccountId('roth-alternate')
    conversionPlan.accounts.push({
      type: 'roth',
      id: alternateRothId,
      name: 'Alternate Roth',
      ownerPersonId,
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    })
    conversionPlan.strategies.retirementActions = [{
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
    }]
    const alternateDestinationPlan = structuredClone(conversionPlan)
    const alternateConversion =
      alternateDestinationPlan.strategies.retirementActions[0]
    if (alternateConversion?.kind !== 'rothConversion') {
      throw new Error('fixture drift')
    }
    alternateConversion.destinationRothAccountId = alternateRothId

    const originalConversion = built(input(conversionPlan))
    const alternateConversionResult = built(input(alternateDestinationPlan))
    expect(alternateConversionResult.events[0]!.eventId).not.toBe(
      originalConversion.events[0]!.eventId,
    )
    expect(alternateConversionResult.inventoryEvidenceId).not.toBe(
      originalConversion.inventoryEvidenceId,
    )

    const qcdPlan = basePlan()
    qcdPlan.strategies.retirementActions = [{
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
    }]
    const changedCharityPlan = structuredClone(qcdPlan)
    const changedQcd = changedCharityPlan.strategies.retirementActions[0]
    if (changedQcd?.kind !== 'qcd') throw new Error('fixture drift')
    changedQcd.charity.name = 'Other Public Charity'

    const originalQcd = built(input(qcdPlan))
    const changedQcdResult = built(input(changedCharityPlan))
    expect(changedQcdResult.events[0]!.eventId).not.toBe(
      originalQcd.events[0]!.eventId,
    )
    expect(changedQcdResult.inventoryEvidenceId).not.toBe(
      originalQcd.inventoryEvidenceId,
    )
    const originalQcdEvent = originalQcd.events[0]!
    if (originalQcdEvent.origin !== 'planAction') {
      throw new Error('fixture drift')
    }
    expect(Object.isFrozen(originalQcdEvent.charity)).toBe(true)
    expect(originalQcdEvent.charity).not.toBe(
      qcdPlan.strategies.retirementActions[0]!.kind === 'qcd'
        ? qcdPlan.strategies.retirementActions[0]!.charity
        : null,
    )
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

  it('scopes allocation identifiers to their owning action', () => {
    const plan = basePlan()
    const firstAction = plan.strategies.retirementActions[0]
    if (firstAction?.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    plan.strategies.retirementActions.push({
      ...firstAction,
      actionId: asActionId('withdrawal-plan-two'),
      executionDate: '2030-06-16',
    })

    const result = built(input(plan))
    expect(result.events).toHaveLength(2)
    expect(result.events.map((event) =>
      event.origin === 'planAction' ? event.allocationId : null
    )).toEqual([
      'withdrawal-plan-allocation',
      'withdrawal-plan-allocation',
    ])
  })

  it('indexes compatible duplicate unreferenced Plan accounts as one logical identity', () => {
    const plan = basePlan()
    const sibling = plan.accounts.find(
      (account) => account.id === siblingIraId,
    )
    if (sibling === undefined) throw new Error('fixture drift')
    plan.accounts.push({ ...sibling })

    const result = built(input(plan))
    expect(result.issues).toEqual([])
  })

  it('rejects duplicate unreferenced household person identifiers before indexing', () => {
    const plan = basePlan()
    plan.strategies.retirementActions = []
    const person = plan.household.people[0]!
    plan.household.people.push({ ...person })

    const result = buildAnnualRetirementPhysicalEventInventory(input(plan))
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'identifierCollision',
      recordId: ownerPersonId,
    }))
  })

  it.each([
    ['employerPlanRmd', 'rmdEngine', employerId],
    ['inheritedIraRmd', 'rmdEngine', inheritedId],
    ['legacyNeedBasedWithdrawal', 'legacyProjection', ownedIraId],
    ['legacyRothConversion', 'legacyProjection', employerId],
  ] as const)(
    'accepts exact %s runtime records from compatible sources',
    (kind, origin, sourceAccountId) => {
      const plan = basePlan()
      if (kind === 'legacyRothConversion') {
        plan.strategies.rothConversion = {
          mode: 'manual',
          conversions: [{ year: 2030, amount: 100 }],
        }
      }
      const record = resolved({ kind, origin, sourceAccountId })
      expect(
        buildAnnualRetirementPhysicalEventInventory(
          input(plan, [record]),
        ).status,
      ).toBe('annualPhysicalEventInventoryBuilt')
    },
  )

  it.each([
    ['ownedIraRmd', ownedIraId],
    ['employerPlanRmd', employerId],
  ] as const)(
    'requires the owner to have reached the RMD start age for %s',
    (kind, sourceAccountId) => {
      const tooYoung = basePlan()
      tooYoung.household.people[0]!.dob = '1958-01-01'
      expect(issueKinds(input(tooYoung, [resolved({
        kind,
        sourceAccountId,
      })]))).toContain('sourceKindMismatch')

      const eligible = basePlan()
      eligible.household.people[0]!.dob = '1957-01-01'
      expect(buildAnnualRetirementPhysicalEventInventory(input(
        eligible,
        [resolved({ kind, sourceAccountId })],
      )).status).toBe('annualPhysicalEventInventoryBuilt')
    },
  )

  it.each([
    ['ownedIraRmd', ownedIraId],
    ['employerPlanRmd', employerId],
    ['inheritedIraRmd', inheritedId],
  ] as const)(
    'requires the owner to be modeled alive for %s',
    (kind, sourceAccountId) => {
      const afterDeath = basePlan()
      afterDeath.household.people[0]!.longevity.planningAge = 79
      expect(issueKinds(input(afterDeath, [resolved({
        kind,
        sourceAccountId,
      })]))).toContain('sourceKindMismatch')

      const lastAliveYear = basePlan()
      lastAliveYear.household.people[0]!.longevity.planningAge = 80
      expect(buildAnnualRetirementPhysicalEventInventory(input(
        lastAliveYear,
        [resolved({ kind, sourceAccountId })],
      )).status).toBe('annualPhysicalEventInventoryBuilt')
    },
  )

  it.each([
    ['legacyQcd', 'legacyProjection'],
    ['annuityFundingTransfer', 'transferLedger'],
    ['rolloverInflow', 'transferLedger'],
    ['otherTraditionalTransfer', 'transferLedger'],
  ] as const)(
    'keeps %s unresolved until producer and endpoint evidence are modeled',
    (kind, origin) => {
      const activity = unresolved({
        activityId: `${kind}-unresolved`,
        kind,
        origin,
        incompatibility: 'movementAuthorityUnavailable',
        upstreamEvidenceId: `${kind}-upstream`,
      })
      expect(issueKinds(input(basePlan(), [activity]))).toContain(
        'unresolvedRuntimeActivity',
      )

      const impossibleResolved = {
        ...resolved({
          origin,
          sourceAccountId: ownedIraId,
        }),
        kind,
      } as unknown as ResolvedAnnualRetirementPhysicalEventRecord
      expect(issueKinds(input(basePlan(), [impossibleResolved]))).toContain(
        'runtimeRecordInvalid',
      )
    },
  )

  it('requires automatic SEPP records to name a non-inherited account with an election', () => {
    expect(issueKinds(input(basePlan(), [resolved({
      kind: 'automaticSeppDistribution',
      origin: 'seppEngine',
    })]))).toContain('sourceKindMismatch')

    const inheritedPlan = basePlan()
    const inherited = inheritedPlan.accounts.find(
      (account) => account.id === inheritedId,
    )
    if (inherited?.type !== 'traditional') throw new Error('fixture drift')
    inherited.sepp = { startAge: 58, method: 'rmd' }
    expect(issueKinds(input(inheritedPlan, [resolved({
      kind: 'automaticSeppDistribution',
      origin: 'seppEngine',
      sourceAccountId: inheritedId,
    })]))).toContain('sourceKindMismatch')

    for (const [dob, expectedStatus] of [
      ['1973-01-01', 'annualPhysicalEventInventoryIncomplete'],
      ['1972-01-01', 'annualPhysicalEventInventoryBuilt'],
      ['1968-01-01', 'annualPhysicalEventInventoryBuilt'],
      ['1967-01-01', 'annualPhysicalEventInventoryIncomplete'],
    ] as const) {
      const electedPlan = basePlan()
      electedPlan.household.people[0]!.dob = dob
      const elected = electedPlan.accounts.find(
        (account) => account.id === ownedIraId,
      )
      if (elected?.type !== 'traditional') throw new Error('fixture drift')
      elected.sepp = { startAge: 58, method: 'rmd' }
      expect(buildAnnualRetirementPhysicalEventInventory(input(
        electedPlan,
        [resolved({
          kind: 'automaticSeppDistribution',
          origin: 'seppEngine',
        })],
      )).status).toBe(expectedStatus)
    }
  })

  it('accepts an employer-plan SEPP only once the series begins after separation', () => {
    // IRC 72(t)(3)(B): "Paragraph (2)(A)(iv) shall not apply to any amount paid
    // from a trust described in section 401(a) ... unless the series of payments
    // begins after the employee separates from service." It does not reach
    // IRAs, which is why the loop above needs no retirement age at all.
    //
    // Two readings on identical facts: a participant aged 58 in the 2030 tax
    // year who elected a SEPP on their 401(k) at 58 but works to 65 either has
    // no exception (the statute) or draws penalty-free while still employed
    // (the reading that ignores 72(t)(3)(B)). The projection orders calendar
    // years rather than days, so the separation year itself counts as
    // separated — irc-72-t-3-B-sepp-separation-annual-proxy.
    //
    // The fractional rows are the same convention the simulator applies and are
    // here so the inventory cannot drift off it: the wage model pays while
    // attained age is BELOW the retirement age, so the first separated year is
    // the attained age the retirement age rounds UP to. At 57.5 that is 58, and
    // a series begun at 58 is accepted; at 58.5 and at 58.2 it is 59, and the
    // same series is not. 58.2 is carried as well as 58.5 because rounding to
    // nearest agrees with rounding up at .5 and disagrees at .2 — both it and
    // rounding down would separate this participant in a year the plan still
    // pays them wages.
    for (const [retirementAge, expectedStatus] of [
      [65, 'annualPhysicalEventInventoryIncomplete'],
      [59, 'annualPhysicalEventInventoryIncomplete'],
      [58.5, 'annualPhysicalEventInventoryIncomplete'],
      [58.2, 'annualPhysicalEventInventoryIncomplete'],
      [58, 'annualPhysicalEventInventoryBuilt'],
      [57.5, 'annualPhysicalEventInventoryBuilt'],
      [50, 'annualPhysicalEventInventoryBuilt'],
      [null, 'annualPhysicalEventInventoryIncomplete'],
    ] as const) {
      const electedPlan = basePlan()
      electedPlan.household.people[0]!.dob = '1972-01-01' // age 58 in 2030
      electedPlan.household.people[0]!.retirementAge = retirementAge
      const elected = electedPlan.accounts.find(
        (account) => account.id === employerId,
      )
      if (elected?.type !== 'traditional') throw new Error('fixture drift')
      elected.sepp = { startAge: 58, method: 'rmd' }
      expect(buildAnnualRetirementPhysicalEventInventory(input(
        electedPlan,
        [resolved({
          kind: 'automaticSeppDistribution',
          origin: 'seppEngine',
          sourceAccountId: employerId,
        })],
      )).status, `retirementAge ${String(retirementAge)}`).toBe(expectedStatus)
    }
  })

  it('accepts inherited RMD records only in a structurally required year', () => {
    const beforeDeath = basePlan()
    const inheritedBeforeDeath = beforeDeath.accounts.find(
      (account) => account.id === inheritedId,
    )
    if (inheritedBeforeDeath?.type !== 'traditional' ||
      inheritedBeforeDeath.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedBeforeDeath.inherited.ownerDeathYear = 2030
    expect(issueKinds(input(beforeDeath, [resolved({
      kind: 'inheritedIraRmd',
      sourceAccountId: inheritedId,
    })]))).toContain('sourceKindMismatch')

    const optionalWindow = basePlan()
    const inheritedOptional = optionalWindow.accounts.find(
      (account) => account.id === inheritedId,
    )
    if (inheritedOptional?.type !== 'traditional' ||
      inheritedOptional.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedOptional.inherited.ownerDeathYear = 2028
    inheritedOptional.inherited.decedentHadStartedRmds = false
    expect(issueKinds(input(optionalWindow, [resolved({
      kind: 'inheritedIraRmd',
      sourceAccountId: inheritedId,
    })]))).toContain('sourceKindMismatch')

    const deadlineYear = basePlan()
    const inheritedDeadline = deadlineYear.accounts.find(
      (account) => account.id === inheritedId,
    )
    if (inheritedDeadline?.type !== 'traditional' ||
      inheritedDeadline.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedDeadline.inherited.ownerDeathYear = 2020
    inheritedDeadline.inherited.decedentHadStartedRmds = false
    expect(buildAnnualRetirementPhysicalEventInventory(input(
      deadlineYear,
      [resolved({
        kind: 'inheritedIraRmd',
        sourceAccountId: inheritedId,
      })],
    )).status).toBe('annualPhysicalEventInventoryBuilt')
  })

  it('rejects inherited RMD records in notice-waived annual years', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1980-01-01'
    const inheritedAccount = plan.accounts.find((account) => account.id === inheritedId)
    if (inheritedAccount?.type !== 'traditional' || inheritedAccount.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedAccount.inherited = {
      ownerDeathYear: 2020,
      decedentHadStartedRmds: true,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        beneficiaryBirthYear: 1980,
        ownerBirthYear: 1945,
        soleBeneficiary: true,
        edbCategory: 'none',
        ownerYearOfDeathRmdSatisfied: true,
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    }
    const taxYear = 2023
    const base = input(plan, [resolved({
      kind: 'inheritedIraRmd',
      sourceAccountId: inheritedId,
      taxYear,
    })])
    expect(issueKinds({
      ...base,
      taxYear,
      runtimeInventoryAttestation: {
        ...base.runtimeInventoryAttestation!,
        taxYear,
      },
    })).toContain('sourceKindMismatch')
  })

  it('accepts legacy-formula inherited RMD events when the S2 synthetic schedule refuses', () => {
    // Mirror of simulate's synthetic-S0 refusal fallback: primary S2 is valid,
    // but the pre-election S0 window refuses (born-1959 contested applicable
    // age). The ledger emits legacy-formula forced amounts; inventory must
    // accept those years under the same structural rule.
    const plan = basePlan()
    const inheritedAccount = plan.accounts.find((account) => account.id === inheritedId)
    if (inheritedAccount?.type !== 'traditional' || inheritedAccount.inherited === undefined) {
      throw new Error('fixture drift')
    }
    inheritedAccount.inherited = {
      ownerDeathYear: 2020,
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'surviving-spouse',
        beneficiaryBirthYear: 1950,
        soleBeneficiary: true,
        ownerBirthYear: 1959,
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
        treatAsOwnElectionYear: 2035,
        provenance: { source: 'test', asOf: '2026-01-01' },
      },
    }
    // Pre-election year with yearsSinceDeath >= 1 and decedentHadStartedRmds
    // false: legacy formula requires yearsSinceDeath >= 10 for a force — use a
    // post-RBD death so yearsSinceDeath >= 1 qualifies under the legacy rule.
    inheritedAccount.inherited.decedentHadStartedRmds = true
    expect(buildAnnualRetirementPhysicalEventInventory(input(
      plan,
      [resolved({
        kind: 'inheritedIraRmd',
        sourceAccountId: inheritedId,
        taxYear: 2030,
      })],
    )).status).toBe('annualPhysicalEventInventoryBuilt')
  })

  it('rejects inherited sources for legacy Roth conversions', () => {
    const plan = basePlan()
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2030, amount: 100 }],
    }
    expect(issueKinds(input(plan, [resolved({
      kind: 'legacyRothConversion',
      origin: 'legacyProjection',
      sourceAccountId: inheritedId,
    })]))).toContain('sourceKindMismatch')
  })

  it.each([
    ['disabled strategy', (plan: Plan) => {
      plan.strategies.rothConversion = { mode: 'none' }
    }],
    ['zero current-year manual schedule', (plan: Plan) => {
      plan.strategies.rothConversion = {
        mode: 'manual',
        conversions: [{ year: 2030, amount: 0 }],
      }
    }],
    ['foreign-year optimized schedule', (plan: Plan) => {
      plan.strategies.rothConversion = {
        mode: 'optimized',
        conversions: [{ year: 2029, amount: 100 }],
      }
    }],
    ['out-of-window fill target', (plan: Plan) => {
      plan.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: 'fixedMagi',
        targetValue: 100_000,
        startYear: 2028,
        endYear: 2029,
      }
    }],
    ['missing Roth destination', (plan: Plan) => {
      plan.strategies.rothConversion = {
        mode: 'manual',
        conversions: [{ year: 2030, amount: 100 }],
      }
      plan.accounts = plan.accounts.filter((account) => account.type !== 'roth')
    }],
  ] as const)(
    'rejects a legacy Roth conversion with %s',
    (_label, arrange) => {
      const plan = basePlan()
      arrange(plan)
      expect(issueKinds(input(plan, [resolved({
        kind: 'legacyRothConversion',
        origin: 'legacyProjection',
        sourceAccountId: ownedIraId,
      })]))).toContain('sourceKindMismatch')
    },
  )

  // A fractional IRMAA tier used to reach this layer and be turned away here as
  // a source-kind mismatch. Since #495 decision D6 the plan schema itself
  // refuses a tier that is not a whole number inside the published table
  // (plan.ts, `an IRMAA tier target must be a whole number from 1 to 5`), so
  // the inventory now sees an unparseable plan and never gets to the mismatch.
  it('turns away a fractional IRMAA tier as an invalid plan, before any source matching', () => {
    const plan = basePlan()
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'irmaaTier',
      targetValue: 1.5,
      startYear: 2030,
      endYear: 2030,
    }
    expect(issueKinds(input(plan, [resolved({
      kind: 'legacyRothConversion',
      origin: 'legacyProjection',
      sourceAccountId: ownedIraId,
    })]))).toContain('planInvalid')
  })

  it('requires employer-match records to name an account with match configuration', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1970-01-01'
    plan.incomes = [{
      type: 'wages',
      id: 'owner-current-wages',
      personId: ownerPersonId,
      annualGross: 100_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const employer = plan.accounts.find(
      (account) => account.id === employerId,
    )
    if (employer?.type !== 'traditional') throw new Error('fixture drift')
    employer.annualContribution = 10_000
    delete employer.employerMatch

    expect(issueKinds(input(plan, [resolved({
      kind: 'employerPlanEmployerMatch',
      origin: 'contributionLedger',
      sourceAccountId: employerId,
    })]))).toContain('sourceKindMismatch')

    employer.employerMatch = { matchPct: 0, capPctOfPay: 6 }
    expect(issueKinds(input(plan, [resolved({
      kind: 'employerPlanEmployerMatch',
      origin: 'contributionLedger',
      sourceAccountId: employerId,
    })]))).toContain('sourceKindMismatch')
  })

  it('excludes taxable-side TIPS funding from this traditional-account inventory', () => {
    const tipsRecord = {
      ...resolved({
        origin: 'transferLedger',
        sourceAccountId: employerId,
      }),
      kind: 'tipsFundingTransfer',
    } as unknown as ResolvedAnnualRetirementPhysicalEventRecord

    expect(issueKinds(input(basePlan(), [tipsRecord]))).toContain(
      'runtimeRecordInvalid',
    )
  })

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
    expect(issueKinds(value)).toContain('runtimeInventoryOmission')

    const unexpected = input()
    unexpected.runtimeInventoryAttestation = {
      ...unexpected.runtimeInventoryAttestation,
      resolvedEventIds: ['missing-runtime-event'],
    }
    expect(issueKinds(unexpected)).toContain('runtimeInventoryUnexpectedRecord')

    const repeated = input(basePlan(), [resolved()])
    repeated.runtimeInventoryAttestation = {
      ...repeated.runtimeInventoryAttestation,
      resolvedEventIds: ['runtime-rmd-event', 'runtime-rmd-event'],
    }
    const repeatedKinds = issueKinds(repeated)
    expect(repeatedKinds).toContain('runtimeInventoryUnexpectedRecord')
    expect(repeatedKinds).not.toContain('runtimeInventoryOmission')
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
      kind: 'employerPlanRmd',
      origin: 'rmdEngine',
      sourceAccountId: employerId,
      grossAmount: asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
      executionDate: '2030-01-01',
      executionSequence: 1,
    })
    const second = resolved({
      eventId: 'huge-two',
      movementAuthorityId: 'huge-authority-two',
      upstreamEvidenceId: 'huge-upstream-two',
      kind: 'employerPlanRmd',
      origin: 'rmdEngine',
      sourceAccountId: employerId,
      grossAmount: asPositiveUsdCents(1),
      executionDate: '2030-01-02',
      executionSequence: 1,
    })
    const overflowPlan = basePlan()
    overflowPlan.strategies.retirementActions = []
    expect(issueKinds(input(overflowPlan, [first, second]))).toContain(
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
      activityId: 'invalid-runtime-activity',
      eventId: 'unrelated-resolved-event',
      ownerPersonId: ownerPersonId,
    } as unknown as UnresolvedAnnualRetirementPhysicalActivityRecord]
    const invalidRecordResult = buildAnnualRetirementPhysicalEventInventory(
      invalidRecord,
    )
    expect(invalidRecordResult.issues).toContainEqual(expect.objectContaining({
      kind: 'runtimeRecordInvalid',
      recordId: 'invalid-runtime-activity',
    }))
  })

  it.each([
    ['Plan', (plan: Plan) => {
      plan.id = ' '
    }],
    ['action', (plan: Plan) => {
      const action = plan.strategies.retirementActions[0]!
      action.actionId = ' ' as typeof action.actionId
    }],
    ['allocation', (plan: Plan) => {
      const action = plan.strategies.retirementActions[0]
      if (action?.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
      const allocation = action.allocations[0]!
      allocation.allocationId = ' ' as typeof allocation.allocationId
    }],
  ])('returns planInvalid instead of throwing for a blank %s ID', (_label, mutate) => {
    const value = input()
    const plan = value.plan as Plan
    mutate(plan)
    const result = buildAnnualRetirementPhysicalEventInventory(value)
    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: 'planInvalid',
    }))
  })
})
