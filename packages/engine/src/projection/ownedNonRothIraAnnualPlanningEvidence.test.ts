import { describe, expect, it } from 'vitest'

import type {
  CompletePlanOwnedNonRothIraAnnualBasisRecord,
} from '../actions/ownedNonRothIraAnnualPostCandidateEvidence.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import {
  buildAnnualRetirementPhysicalEventInventory,
  type BuildAnnualRetirementPhysicalEventInventoryInput,
  type ResolvedAnnualRetirementPhysicalEventRecord,
} from '../actions/annualRetirementPhysicalEventInventory.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import {
  preparePlanOwnedNonRothIraAnnualPhysicalTransaction,
} from '../actions/ownedNonRothIraAnnualPhysicalTransaction.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
import type { Plan } from '../model/plan.js'
import {
  couplePlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import {
  buildSimulatorOwnedNonRothIraAnnualObservation,
} from './ownedNonRothIraAnnualObservation.js'
import {
  buildSimulatorOwnedNonRothIraAnnualPlanningEvidence,
  type BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceInput,
  type CompleteSimulatorOwnedNonRothIraAnnualPlanningEvidence,
  type SimulatorOwnedNonRothIraAnnualPlanningAssumptions,
} from './ownedNonRothIraAnnualPlanningEvidence.js'

interface LegacySettledPlanningActivity {
  activityId: string
  actionId: string
  sourceAccountId: string
  activityKind:
    | 'distribution'
    | 'rothConversion'
    | 'ownedIraContribution'
    | 'ownedIraEmployerContribution'
    | 'qualifiedCharitableDistribution'
    | 'rollover'
    | 'repayment'
    | 'recharacterization'
    | 'oneTimeHsaFundingDistribution'
    | 'returnedContribution'
    | 'otherUnsupported'
  executionDate: string
  executionSequence: number
  grossAmount: number
  upstreamEvidenceId: string
}

interface LegacySettledActivityInventory {
  predicate: 'completeSimulatorOwnedNonRothIraSettledActivityInventory'
  planId: string
  ownerPersonId: string
  taxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionSettledActivityOnlyNotTaxReturnEvidence'
  inventoryStatus: 'completeIncludingExplicitEmpty'
  events: readonly Readonly<LegacySettledPlanningActivity>[]
  unresolvedActivityIds: readonly string[]
  upstreamEvidenceId: string
  evidenceId: string
}

type PlanningEvidenceAssignableToFilingRecord =
  CompleteSimulatorOwnedNonRothIraAnnualPlanningEvidence extends
    CompletePlanOwnedNonRothIraAnnualBasisRecord
    ? true
    : false

const planningEvidenceAssignableToFilingRecord:
  PlanningEvidenceAssignableToFilingRecord = false

const TAX_YEAR = 2030
const LEDGER_RUN_ID = 'planning-ledger-2030'

function plan(
  options: {
    openingBasisA?: number
    openingBasisB?: number
    includeSecondOwner?: boolean
  } = {},
): Plan {
  const value = couplePlan({
    p1Dob: '1960-01-01',
    p2Dob: '1962-01-01',
    p1PlanningAge: 100,
    p2PlanningAge: 100,
  })
  value.id = 'planning-plan'
  const first = traditionalAccount('ira-a', 100, 'p1')
  const second = traditionalAccount('ira-b', 50, 'p1')
  if (first.type !== 'traditional' || second.type !== 'traditional') {
    throw new Error('fixture drift')
  }
  first.nondeductibleBasis = options.openingBasisA ?? 30
  second.nondeductibleBasis = options.openingBasisB ?? 20
  second.contributionSchedule = [{
    annualAmount: 100,
    fromAge: null,
    toAge: null,
    escalationPct: 0,
  }]
  value.accounts = [
    first,
    second,
    traditionalAccount('employer-plan', 80, 'p1', 'employer'),
    ...(options.includeSecondOwner === false
      ? []
      : [traditionalAccount('other-owner-ira', 90, 'p2')]),
    {
      type: 'roth',
      id: 'roth-destination',
      name: 'Roth destination',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [
      {
        sourceAccountId: 'ira-a',
        subtype: 'traditional',
        evidenceId: 'classification-ira-a',
        provenance: { source: 'manual' },
      },
      {
        sourceAccountId: 'ira-b',
        subtype: 'sep',
        evidenceId: 'classification-ira-b',
        provenance: { source: 'manual' },
      },
    ],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return value
}

function planWithContribution(): Plan {
  const value = plan()
  const source = value.accounts.find((account) => account.id === 'ira-a')
  if (source?.type !== 'traditional') throw new Error('fixture drift')
  source.annualContribution = 100
  value.household.people[0]!.retirementAge = null
  value.incomes = [{
    type: 'wages',
    id: 'planning-wages',
    personId: 'p1',
    annualGross: 10_000,
    endAge: null,
    realGrowthPct: 0,
  }]
  return value
}

function contributionRecord(
  options: Partial<ResolvedAnnualRetirementPhysicalEventRecord> = {},
): ResolvedAnnualRetirementPhysicalEventRecord {
  return {
    recordStatus: 'resolved',
    planId: asPlanId('planning-plan'),
    taxYear: TAX_YEAR,
    ledgerRunId: LEDGER_RUN_ID,
    eventId: 'settled-personal-contribution',
    movementAuthorityId: 'settled-personal-contribution-authority',
    kind: 'ownedIraContribution',
    origin: 'contributionLedger',
    ownerPersonId: asPersonId('p1'),
    sourceAccountId: asAccountId('ira-a'),
    grossAmount: asPositiveUsdCents(1_000),
    executionDate: `${TAX_YEAR}-02-15`,
    executionSequence: 1,
    upstreamEvidenceId: 'settled-personal-contribution-upstream',
    ...options,
  }
}

function observation(
  value = plan(),
  options: {
    openingBasis?: number
    yearEndA?: number
    yearEndB?: number
    taxYear?: number
    ledgerRunId?: string
  } = {},
) {
  const taxYear = options.taxYear ?? TAX_YEAR
  const ledgerRunId = options.ledgerRunId ?? LEDGER_RUN_ID
  const result = buildSimulatorOwnedNonRothIraAnnualObservation({
    plan: value,
    ownerPersonId: 'p1',
    taxYear,
    ledgerRunId,
    observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth',
    startOfTaxYearIraBasis: options.openingBasis ?? 50,
    yearEndBalances: [
      { sourceAccountId: 'ira-a', balance: options.yearEndA ?? 60 },
      { sourceAccountId: 'ira-b', balance: options.yearEndB ?? 20 },
    ],
  })
  if (result.status !== 'annualObservationBuilt') {
    throw new Error(`observation fixture failed: ${JSON.stringify(result.issues)}`)
  }
  return result.observation
}

function rehashObservationDeadline(
  observed: ReturnType<typeof observation>,
  mutate: (deadline: Record<string, unknown>) => void,
): unknown {
  const draft = structuredClone(observed) as unknown as Record<string, unknown>
  const window = draft.projectionPostYearContributionWindow as
    Record<string, unknown>
  const deadline = window.deadlineObservation as Record<string, unknown>
  mutate(deadline)
  deadline.upstreamEvidenceId = deriveActionStructuralId(
    'simulator-owned-ira-contribution-deadline-upstream',
    [
      (draft.evidenceScope as Record<string, unknown>).evidenceId,
      draft.taxYear,
      deadline.deadlineDate,
    ],
  )
  delete deadline.evidenceId
  deadline.evidenceId = deriveActionStructuralId(
    'simulator-owned-ira-contribution-deadline',
    [deadline],
  )
  window.upstreamEvidenceId = deriveActionStructuralId(
    'simulator-owned-ira-post-year-contribution-window-upstream',
    [
      (draft.evidenceScope as Record<string, unknown>).evidenceId,
      deadline,
    ],
  )
  delete window.evidenceId
  window.evidenceId = deriveActionStructuralId(
    'simulator-owned-ira-post-year-contribution-window',
    [window],
  )
  delete draft.evidenceId
  draft.evidenceId = deriveActionStructuralId(
    'simulator-owned-ira-annual-observation',
    [draft],
  )
  return draft
}

function activity(
  activityId: string,
  activityKind: LegacySettledPlanningActivity['activityKind'],
  grossAmount: number,
  options: Partial<LegacySettledPlanningActivity> = {},
): LegacySettledPlanningActivity {
  return {
    activityId,
    actionId: `authority-${activityId}`,
    sourceAccountId: 'ira-a',
    activityKind,
    executionDate: `${TAX_YEAR}-06-15`,
    executionSequence: 1,
    grossAmount,
    upstreamEvidenceId: `upstream-${activityId}`,
    ...options,
  }
}

function inventory(
  events: readonly LegacySettledPlanningActivity[],
  options: Partial<LegacySettledActivityInventory> = {},
  observationEvidenceId = observation().evidenceId,
): LegacySettledActivityInventory {
  const canonicalEvents = events.map((event) => ({
    ...event,
    grossAmount: planDollarsToLedgerCents(event.grossAmount),
  })).sort((left, right) =>
    compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.activityId, right.activityId))
  const sourceRuntimeRecords = canonicalEvents.map((event) => {
    const runtimeKind = event.activityKind === 'distribution'
      ? 'legacyNeedBasedWithdrawal' as const
      : event.activityKind === 'rothConversion'
        ? 'legacyRothConversion' as const
        : event.activityKind === 'ownedIraContribution'
          ? 'ownedIraContribution' as const
          : event.activityKind === 'ownedIraEmployerContribution'
            ? 'ownedIraEmployerContribution' as const
            : event.activityKind === 'qualifiedCharitableDistribution'
              ? 'legacyQcd' as const
              : event.activityKind === 'rollover'
                ? 'rolloverInflow' as const
                : 'otherTraditionalTransfer' as const
    if (runtimeKind === 'legacyQcd' || runtimeKind === 'rolloverInflow' ||
        runtimeKind === 'otherTraditionalTransfer') {
      return {
        recordStatus: 'unresolved' as const,
        planId: 'planning-plan',
        taxYear: TAX_YEAR,
        ledgerRunId: LEDGER_RUN_ID,
        activityId: event.activityId,
        kind: runtimeKind,
        origin: runtimeKind === 'legacyQcd'
          ? 'legacyProjection' as const
          : 'transferLedger' as const,
        knownGrossAmount: event.grossAmount,
        ownerPersonId: null,
        sourceAccountId: null,
        executionDate: null,
        executionSequence: null,
        incompatibility: 'movementAuthorityUnavailable' as const,
        upstreamEvidenceId: event.upstreamEvidenceId,
      }
    }
    return {
      recordStatus: 'resolved' as const,
      planId: 'planning-plan',
      taxYear: TAX_YEAR,
      ledgerRunId: LEDGER_RUN_ID,
      eventId: event.activityId,
      movementAuthorityId: event.actionId,
      kind: runtimeKind,
      origin: runtimeKind === 'ownedIraContribution' ||
        runtimeKind === 'ownedIraEmployerContribution'
        ? 'contributionLedger' as const
        : 'legacyProjection' as const,
      ownerPersonId: 'p1',
      sourceAccountId: event.sourceAccountId,
      grossAmount: event.grossAmount,
      executionDate: event.executionDate,
      executionSequence: event.executionSequence,
      upstreamEvidenceId: event.upstreamEvidenceId,
    }
  }).sort((left, right) => compareUtf16CodeUnits(
    left.recordStatus === 'resolved' ? left.eventId : left.activityId,
    right.recordStatus === 'resolved' ? right.eventId : right.activityId,
  ))
  const sourceContext = {
    planId: 'planning-plan',
    taxYear: TAX_YEAR,
    ledgerRunId: LEDGER_RUN_ID,
  }
  const resolvedEventIds = sourceRuntimeRecords.flatMap((record) =>
    record.recordStatus === 'resolved' ? [record.eventId] : [])
  const unresolvedActivityIds = sourceRuntimeRecords.flatMap((record) =>
    record.recordStatus === 'unresolved' ? [record.activityId] : [])
  const sourceUpstreamEvidenceId = deriveActionStructuralId(
    'projection-annual-retirement-runtime-journal-upstream',
    [sourceContext, sourceRuntimeRecords],
  )
  const sourceRuntimeInventoryAttestation = {
    predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
    ...sourceContext,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    resolvedEventIds,
    unresolvedActivityIds,
    upstreamEvidenceId: sourceUpstreamEvidenceId,
    evidenceId: deriveActionStructuralId(
      'projection-annual-retirement-runtime-journal',
      [sourceContext, resolvedEventIds, unresolvedActivityIds,
        sourceUpstreamEvidenceId],
    ),
  }
  const upstreamEvidenceId = deriveActionStructuralId(
    'simulator-owned-ira-settled-activity-inventory-upstream',
    ['planning-plan', 'p1', TAX_YEAR, LEDGER_RUN_ID,
      observationEvidenceId, canonicalEvents],
  )
  const body = {
    predicate:
      'completeSimulatorOwnedNonRothIraSettledActivityInventory' as const,
    planId: 'planning-plan',
    ownerPersonId: 'p1',
    taxYear: TAX_YEAR,
    ledgerRunId: LEDGER_RUN_ID,
    evidenceScope:
      'projectionSettledActivityOnlyNotTaxReturnEvidence' as const,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    events: canonicalEvents,
    unresolvedActivityIds: [] as const,
    sourceRuntimeInventoryAttestation,
    sourceRuntimeRecords,
    upstreamEvidenceId,
  }
  return {
    ...body,
    events,
    evidenceId: deriveActionStructuralId(
      'simulator-owned-ira-settled-activity-inventory',
      [body],
    ),
    ...options,
  }
}

function physicalTransaction(
  value: Plan,
  events: readonly LegacySettledPlanningActivity[],
  taxYear = TAX_YEAR,
  ledgerRunId = LEDGER_RUN_ID,
  exact: {
    requestedCentsByActivityId?: Readonly<Record<string, number>>
    executedCentsByActivityId?: Readonly<Record<string, number>>
    openingCentsByAccountId?: Readonly<Record<string, number>>
    runtimeRecords?: BuildAnnualRetirementPhysicalEventInventoryInput[
      'runtimeRecords'
    ]
  } = {},
) {
  const supported = events.filter((event) =>
    event.activityKind === 'distribution' ||
    event.activityKind === 'rothConversion')
  const grouped = new Map<string,
    LegacySettledPlanningActivity[]>()
  for (const event of supported) {
    grouped.set(event.actionId, [
      ...(grouped.get(event.actionId) ?? []),
      event,
    ])
  }
  value.strategies.retirementActions = [...grouped.entries()].map(
    ([authorityId, allocations]) => {
      const first = allocations[0]!
      const requestedAmount = asPositiveUsdCents(allocations.reduce(
        (sum, allocation) =>
          sum + (exact.requestedCentsByActivityId?.[allocation.activityId] ??
            planDollarsToLedgerCents(allocation.grossAmount)),
        0,
      ))
      const common = {
        actionId: asActionId(authorityId),
        year: taxYear,
        executionDate: first.executionDate,
        executionSequence: first.executionSequence,
        requestedAmount,
        provenance: { source: 'manual' as const },
        personId: asPersonId('p1'),
        allocations: allocations.map((allocation) => ({
          allocationId: asAllocationId(allocation.activityId),
          sourceAccountId: asAccountId(allocation.sourceAccountId),
          requestedAmount: asPositiveUsdCents(
            exact.requestedCentsByActivityId?.[allocation.activityId] ??
              planDollarsToLedgerCents(allocation.grossAmount),
          ),
        })),
      }
      return first.activityKind === 'distribution'
        ? {
            ...common,
            kind: 'ordinaryWithdrawal' as const,
            purpose: { kind: 'spending' as const },
          }
        : {
            ...common,
            kind: 'rothConversion' as const,
            destinationRothAccountId: asAccountId('roth-destination'),
            taxFunding: { kind: 'noneExpected' as const },
          }
    },
  )
  const inventoryPart = {
    plan: value,
    taxYear,
    runtimeRecords: exact.runtimeRecords ?? [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
      planId: asPlanId(value.id),
      taxYear,
      ledgerRunId,
      inventoryStatus: 'completeIncludingExplicitEmpty' as const,
      resolvedEventIds: (exact.runtimeRecords ?? []).flatMap((record) =>
        record.recordStatus === 'resolved' ? [record.eventId] : []),
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory-evidence',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
  const openingBalances = ['ira-a', 'ira-b'].map((accountId) => ({
    accountId: asAccountId(accountId),
    openingBalance: asUsdCents(
      exact.openingCentsByAccountId?.[accountId] ??
        (accountId === 'ira-a' ? 10_000 : 5_000),
    ),
  }))
  const builtInventory = buildAnnualRetirementPhysicalEventInventory(
    inventoryPart,
  )
  if (builtInventory.status !== 'annualPhysicalEventInventoryBuilt') {
    throw new Error(`transaction inventory fixture failed: ${JSON.stringify(builtInventory.issues)}`)
  }
  const pool = builtInventory.ownedIraPools.find(
    (candidate) => candidate.ownerPersonId === 'p1',
  )!
  const running = new Map(openingBalances.map((entry) => [
    entry.accountId,
    entry.openingBalance,
  ]))
  const actualApplications: Array<{
    inventoryEventId: string
    sourceBalanceBefore: ReturnType<typeof asUsdCents>
    executedAmount: ReturnType<typeof asUsdCents>
    sourceBalanceAfter: ReturnType<typeof asUsdCents>
    stagingEvidenceId: string
  }> = []
  const settledContributionApplications: Array<{
    inventoryEventId: string
    sourceBalanceBefore: ReturnType<typeof asUsdCents>
    creditedAmount: ReturnType<typeof asUsdCents>
    sourceBalanceAfter: ReturnType<typeof asUsdCents>
    stagingEvidenceId: string
  }> = []
  for (const event of pool.events) {
    const sourceBalanceBefore = running.get(event.sourceAccountId)!
    if (event.kind === 'ownedIraContribution' ||
        event.kind === 'ownedIraEmployerContribution') {
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
    const executedAmount = asUsdCents(
      exact.executedCentsByActivityId?.[
        event.origin === 'planAction' ? event.allocationId : event.eventId
      ] ?? event.grossAmount,
    )
    const sourceBalanceAfter = asUsdCents(sourceBalanceBefore - executedAmount)
    running.set(event.sourceAccountId, sourceBalanceAfter)
    actualApplications.push({
      inventoryEventId: event.eventId,
      sourceBalanceBefore,
      executedAmount,
      sourceBalanceAfter,
      stagingEvidenceId: `staging-${event.eventId}`,
    })
  }
  const result = preparePlanOwnedNonRothIraAnnualPhysicalTransaction({
    ...inventoryPart,
    ownerPersonId: asPersonId('p1'),
    openingBalances,
    actualApplications,
    settledContributionApplications,
  })
  if (result.status !== 'unifiedAnnualPhysicalTransactionPrepared') {
    throw new Error(`transaction fixture failed: ${JSON.stringify(result.issues)}`)
  }
  return result
}

interface MutablePreparedTransactionShape extends Record<string, unknown> {
  planId: string
  ownerPersonId: string
  taxYear: number
  ledgerRunId: string
  inventory: Record<string, unknown> & {
    inventoryEvidenceId: string
    events: Array<Record<string, unknown>>
    ownedIraPools: Array<Record<string, unknown>>
    planOwnedIraActionIds: string[]
    compatibility: Record<string, unknown>
    runtimeInventoryEvidenceId: string
    runtimeInventoryUpstreamEvidenceId: string
  }
  applications: Array<Record<string, unknown>>
  settledContributionApplications: Array<Record<string, unknown>>
  sourceBalanceTransitions: Array<Record<string, unknown>>
  stagedDestinationCredits: Array<Record<string, unknown>>
  line7Entries: Array<Record<string, unknown>>
  line8Entries: Array<Record<string, unknown>>
  line7GrossAmount: number
  line8GrossAmount: number
  line8InventoryEvidence: Record<string, unknown>
  transactionEvidenceId: string
}

function rehashPreparedTransaction(
  transaction: ReturnType<typeof physicalTransaction>,
  mutate: (draft: MutablePreparedTransactionShape) => void,
): MutablePreparedTransactionShape {
  const draft = structuredClone(transaction) as unknown as
    MutablePreparedTransactionShape
  mutate(draft)

  const eventParts = draft.inventory.events.map((event) =>
    event.origin === 'planAction'
      ? [
          event.eventId,
          event.origin,
          event.kind,
          event.actionId,
          event.allocationId,
          event.sourceAccountKind,
          event.sourceInheritanceStatus,
          event.destinationRothAccountId,
          event.charity,
          event.ownerPersonId,
          event.sourceAccountId,
          event.grossAmount,
          event.eventDate,
          event.eventSequence,
          event.form8606Category,
        ]
      : [
          event.eventId,
          event.origin,
          event.kind,
          event.movementAuthorityId,
          event.ownerPersonId,
          event.sourceAccountId,
          event.grossAmount,
          event.eventDate,
          event.eventSequence,
          event.upstreamEvidenceId,
          event.form8606Category,
        ])
  draft.inventory.inventoryEvidenceId = deriveActionStructuralId(
    'annual-retirement-physical-event-inventory',
    [
      draft.planId,
      draft.taxYear,
      draft.ledgerRunId,
      draft.inventory.runtimeInventoryEvidenceId,
      draft.inventory.runtimeInventoryUpstreamEvidenceId,
      eventParts,
      draft.inventory.ownedIraPools.map((pool) => [
        pool.ownerPersonId,
        pool.sourceAccountIds,
        pool.grossAmount,
      ]),
      draft.inventory.planOwnedIraActionIds,
      draft.inventory.compatibility,
    ],
  )

  for (const application of draft.applications) {
    application.inventoryEvidenceId = draft.inventory.inventoryEvidenceId
    const applicationWithoutEvidence = {
      predicate: application.predicate,
      planId: draft.planId,
      ownerPersonId: draft.ownerPersonId,
      taxYear: draft.taxYear,
      ledgerRunId: draft.ledgerRunId,
      inventoryEvidenceId: application.inventoryEvidenceId,
      inventoryEventId: application.inventoryEventId,
      eventOrigin: application.eventOrigin,
      eventKind: application.eventKind,
      lineScope: application.lineScope,
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      scheduledDate: application.scheduledDate,
      scheduledSequence: application.scheduledSequence,
      requestedAmount: application.requestedAmount,
      sourceBalanceBefore: application.sourceBalanceBefore,
      executedAmount: application.executedAmount,
      unexecutedAmount: application.unexecutedAmount,
      sourceBalanceAfter: application.sourceBalanceAfter,
      stagingEvidenceId: application.stagingEvidenceId,
    }
    application.applicationEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-physical-application',
      [applicationWithoutEvidence],
    )
  }
  for (const contribution of draft.settledContributionApplications) {
    contribution.inventoryEvidenceId = draft.inventory.inventoryEvidenceId
    const contributionWithoutEvidence = Object.fromEntries(
      Object.entries(contribution).filter(([key]) =>
        key !== 'applicationEvidenceId'),
    )
    contribution.applicationEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-settled-contribution-application',
      [contributionWithoutEvidence],
    )
  }
  const positiveEntries = (scope: string) => draft.applications
    .filter((application) => application.lineScope === scope &&
      Number(application.executedAmount) > 0)
    .map((application) => ({
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      scheduledDate: application.scheduledDate,
      scheduledSequence: application.scheduledSequence,
      grossAmount: application.executedAmount,
    }))
  draft.line7Entries = positiveEntries('form8606Line7Distributions')
  draft.line8Entries = positiveEntries('form8606Line8NetConversions')
  draft.line7GrossAmount = draft.line7Entries.reduce(
    (sum, entry) => sum + Number(entry.grossAmount),
    0,
  )
  draft.line8GrossAmount = draft.line8Entries.reduce(
    (sum, entry) => sum + Number(entry.grossAmount),
    0,
  )

  for (const transition of draft.sourceBalanceTransitions) {
    const sourceApplications = draft.applications.filter((application) =>
      application.sourceAccountId === transition.sourceAccountId)
    const sourceContributions = draft.settledContributionApplications.filter(
      (contribution) =>
        contribution.sourceAccountId === transition.sourceAccountId,
    )
    transition.inventoryEvidenceId = draft.inventory.inventoryEvidenceId
    transition.settledContributionAmount = sourceContributions.reduce(
      (sum, contribution) => sum + Number(contribution.creditedAmount),
      0,
    )
    transition.requestedAmount = sourceApplications.reduce(
      (sum, application) => sum + Number(application.requestedAmount),
      0,
    )
    transition.executedAmount = sourceApplications.reduce(
      (sum, application) => sum + Number(application.executedAmount),
      0,
    )
    transition.unexecutedAmount = sourceApplications.reduce(
      (sum, application) => sum + Number(application.unexecutedAmount),
      0,
    )
    const sourceChain = draft.inventory.events.flatMap((event) => {
      if (event.sourceAccountId !== transition.sourceAccountId) return []
      const contribution = sourceContributions.find((candidate) =>
        candidate.inventoryEventId === event.eventId)
      if (contribution !== undefined) return [contribution]
      const application = sourceApplications.find((candidate) =>
        candidate.inventoryEventId === event.eventId)
      return application === undefined ? [] : [application]
    })
    transition.detachedClosingBalance = sourceChain.length === 0
      ? transition.openingBalance
      : sourceChain.at(-1)!.sourceBalanceAfter
    transition.upstreamEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-source-balance-upstream',
      [
        draft.inventory.inventoryEvidenceId,
        transition.sourceAccountId,
        transition.openingBalance,
        sourceChain.map((application) =>
          application.predicate ===
              'ownedNonRothIraSettledAnnualContributionApplication'
            ? [
                application.inventoryEventId,
                application.inventoryEventUpstreamEvidenceId,
                application.stagingEvidenceId,
                application.applicationEvidenceId,
                application.sourceBalanceBefore,
                application.creditedAmount,
                application.sourceBalanceAfter,
              ]
            : [
                application.inventoryEventId,
                application.stagingEvidenceId,
                application.applicationEvidenceId,
                application.sourceBalanceBefore,
                application.executedAmount,
                application.sourceBalanceAfter,
              ]),
      ],
    )
    const transitionWithoutEvidence = Object.fromEntries(
      Object.entries(transition).filter(([key]) => key !== 'evidenceId'),
    )
    transition.evidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-source-balance-transition',
      [transitionWithoutEvidence],
    )
  }
  for (const credit of draft.stagedDestinationCredits) {
    const application = draft.applications.find((candidate) =>
      candidate.inventoryEventId === credit.inventoryEventId)!
    Object.assign(credit, {
      planId: draft.planId,
      ownerPersonId: draft.ownerPersonId,
      taxYear: draft.taxYear,
      ledgerRunId: draft.ledgerRunId,
      inventoryEvidenceId: draft.inventory.inventoryEvidenceId,
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      destinationRothAccountId: application.destinationRothAccountId,
      stagedCreditAmount: application.executedAmount,
      upstreamEvidenceId: application.stagingEvidenceId,
    })
    const creditWithoutEvidence = Object.fromEntries(
      Object.entries(credit).filter(([key]) => key !== 'evidenceId'),
    )
    credit.evidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-roth-destination-credit',
      [creditWithoutEvidence],
    )
    application.destinationCreditEvidenceId = credit.evidenceId
  }
  const line8UpstreamEvidenceId = deriveActionStructuralId(
    'owned-ira-unified-line8-inventory-upstream',
    [
      draft.inventory.inventoryEvidenceId,
      draft.ownerPersonId,
      draft.applications
        .filter((application) =>
          application.lineScope === 'form8606Line8NetConversions')
        .map((application) => application.applicationEvidenceId),
    ],
  )
  const line8WithoutEvidence = {
    predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory',
    planId: draft.planId,
    ownerPersonId: draft.ownerPersonId,
    taxYear: draft.taxYear,
    ledgerRunId: draft.ledgerRunId,
    inventoryStatus: 'completeIncludingExplicitEmpty',
    entries: draft.line8Entries,
    upstreamEvidenceId: line8UpstreamEvidenceId,
  }
  draft.line8InventoryEvidence = {
    ...line8WithoutEvidence,
    evidenceId: deriveActionStructuralId(
      'owned-ira-unified-line8-inventory',
      [line8WithoutEvidence],
    ),
  }
  const transactionWithoutEvidence = {
    planId: draft.planId,
    ownerPersonId: draft.ownerPersonId,
    taxYear: draft.taxYear,
    ledgerRunId: draft.ledgerRunId,
    inventoryEvidenceId: draft.inventory.inventoryEvidenceId,
    applications: draft.applications,
    settledContributionApplications: draft.settledContributionApplications,
    sourceBalanceTransitions: draft.sourceBalanceTransitions,
    stagedDestinationCredits: draft.stagedDestinationCredits,
    line7Entries: draft.line7Entries,
    line8Entries: draft.line8Entries,
    line7GrossAmount: draft.line7GrossAmount,
    line8GrossAmount: draft.line8GrossAmount,
    line8InventoryEvidence: draft.line8InventoryEvidence,
  }
  draft.transactionEvidenceId = deriveActionStructuralId(
    'owned-ira-unified-annual-physical-transaction',
    [transactionWithoutEvidence],
  )
  return draft
}

function assumptions(
  options: {
    openingBasis?: number
    openingSource?: SimulatorOwnedNonRothIraAnnualPlanningAssumptions['openingBasis']
    designations?: SimulatorOwnedNonRothIraAnnualPlanningAssumptions['settledContributionDesignations']
    postYear?: SimulatorOwnedNonRothIraAnnualPlanningAssumptions['postYearPriorTaxYearContributions']
    taxYear?: number
  } = {},
): SimulatorOwnedNonRothIraAnnualPlanningAssumptions {
  const taxYear = options.taxYear ?? TAX_YEAR
  return {
    predicate: 'explicitSimulatorOwnedNonRothIraAnnualPlanningAssumptions',
    poolScope:
      'validatedPlanContainsCompleteOwnedNonRothIraPoolForProjection',
    realWorldAccountCompleteness: 'notEstablished',
    openingBasis: options.openingSource ?? {
      source: 'planAccountPlanningSeed',
      asOfDate: `${taxYear}-01-01`,
      amount: options.openingBasis ?? 50,
    },
    rolloverAssumption: {
      status: 'assumedNoOutstandingRolloverOrRepaymentAdjustment',
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
    },
    settledContributionDesignations: options.designations ?? [],
    postYearWindowStatus: 'completeExplicitProjectionAssumption',
    postYearPriorTaxYearContributions: options.postYear ?? [
      {
        sourceAccountId: 'ira-b',
        designatedTaxYear: taxYear,
        contributionDate: `${taxYear + 1}-02-01`,
        nondeductibleContributionAmount: 7,
      },
    ],
  }
}

function defaultEvents(
  taxYear = TAX_YEAR,
): LegacySettledPlanningActivity[] {
  return [
    activity('distribution', 'distribution', 30, {
      executionDate: `${taxYear}-03-01`,
    }),
    activity('conversion', 'rothConversion', 20, {
      sourceAccountId: 'ira-b',
      executionDate: `${taxYear}-09-01`,
      executionSequence: 2,
    }),
  ]
}

function input(options: {
  plan?: Plan
  annualObservation?: unknown
  events?: LegacySettledPlanningActivity[]
  transaction?: unknown
  inventory?: unknown
  assumptions?: unknown
  priorCarryforwardEvidence?: unknown
  priorPlanningEvidence?: unknown
  projectionStartTaxYear?: number
  taxYear?: number
  ledgerRunId?: string
} = {}): BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceInput {
  const value = options.plan ?? plan()
  const taxYear = options.taxYear ?? TAX_YEAR
  const ledgerRunId = options.ledgerRunId ?? LEDGER_RUN_ID
  const events = options.events ?? defaultEvents(taxYear)
  const annualPhysicalTransaction = options.transaction ?? options.inventory ??
    physicalTransaction(value, events, taxYear, ledgerRunId)
  const annualObservation = options.annualObservation ?? observation(value, {
    taxYear,
    ledgerRunId,
  })
  return {
    plan: value,
    ownerPersonId: 'p1',
    taxYear,
    projectionStartTaxYear: options.projectionStartTaxYear ?? taxYear,
    ledgerRunId,
    annualObservation,
    annualPhysicalTransaction,
    assumptions: options.assumptions ?? assumptions({ taxYear }),
    priorCarryforwardEvidence: options.priorCarryforwardEvidence,
    priorPlanningEvidence: options.priorPlanningEvidence,
  }
}

function built(value = input()) {
  const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(value)
  if (result.status !== 'annualPlanningEvidenceBuilt') {
    throw new Error(`planning fixture failed: ${JSON.stringify(result.issues)}`)
  }
  return result
}

function issueKinds(value: ReturnType<
  typeof buildSimulatorOwnedNonRothIraAnnualPlanningEvidence
>): string[] {
  return value.issues.map((entry) => entry.kind)
}

function previousPlanningEvidence(withPostYearContribution = false) {
  return built(input({
    events: [],
    assumptions: assumptions({
      designations: [],
      postYear: withPostYearContribution ? undefined : [],
    }),
  }))
}

function rehashEvidenceRecord(
  record: Record<string, unknown>,
  namespace: string,
): void {
  delete record.evidenceId
  record.evidenceId = deriveActionStructuralId(namespace, [record])
}

describe('simulator owned non-Roth IRA annual planning evidence', () => {
  it('is structurally unable to masquerade as a filing-grade annual record', () => {
    expect(planningEvidenceAssignableToFilingRecord).toBe(false)
    expect(built()).toMatchObject({
      status: 'annualPlanningEvidenceBuilt',
      movement: 'notCommitted',
      simulationActionability: 'established',
      realWorldActionability: 'notEstablished',
      planningEvidence: {
        predicate: 'completeSimulatorOwnedNonRothIraAnnualPlanningEvidence',
        evidenceScope: 'projectionPlanningEstimateOnlyNotTaxReturnEvidence',
        filingCompleteness: 'notEstablished',
        realWorldAccountCompleteness: 'notEstablished',
        taxReturnUse: 'prohibited',
      },
    })
  })

  it('allocates exact distribution and conversion character from the complete settled year', () => {
    const evidence = built().planningEvidence
    expect(evidence).toMatchObject({
      accountIds: ['ira-a', 'ira-b'],
      openingPlanningBasisAmount: 5_000,
      inYearNondeductibleContributionAmount: 0,
      postYearPriorTaxYearNondeductibleContributionAmount: 700,
      allocationBasisNumeratorAmount: 5_000,
      observedYearEndApplicablePoolBalanceAmount: 8_000,
      annualBasisDenominatorAmount: 13_000,
      annualBasisRatio: {
        representation: 'exactMinorUnitRational',
        numeratorMinorUnits: 5_000,
        denominatorMinorUnits: 13_000,
        intermediateArithmetic: 'bigintRational',
      },
      distributionAllocation: {
        calculationScope: 'projectionPlanningDistributions',
        annualGrossAmount: 3_000,
        annualBasisReturnAmount: 1_154,
        annualOrdinaryIncomeAmount: 1_846,
      },
      conversionAllocation: {
        calculationScope: 'projectionPlanningNetConversions',
        annualGrossAmount: 2_000,
        annualBasisReturnAmount: 769,
        annualOrdinaryIncomeAmount: 1_231,
      },
      nextYearOpeningPlanningBasisAmount: 3_777,
    })
    expect(evidence.distributionAllocation.allocations[0]).toMatchObject({
      grossAmount: 3_000,
      allocatedBasisAmount: 1_154,
      ordinaryIncomeAmount: 1_846,
    })
    expect(evidence.conversionAllocation.allocations[0]).toMatchObject({
      grossAmount: 2_000,
      allocatedBasisAmount: 769,
      ordinaryIncomeAmount: 1_231,
    })
  })

  it('uses actual partial and zero applications rather than requested gross', () => {
    const value = plan()
    const transaction = physicalTransaction(
      value,
      defaultEvents(),
      TAX_YEAR,
      LEDGER_RUN_ID,
      {
        executedCentsByActivityId: {
          distribution: 2_000,
          conversion: 0,
        },
      },
    )
    const evidence = built(input({ plan: value, transaction })).planningEvidence
    expect(transaction.applications.map((application) => ({
      allocationId: application.allocationId,
      requested: application.requestedAmount,
      executed: application.executedAmount,
      unexecuted: application.unexecutedAmount,
    }))).toEqual([
      { allocationId: 'distribution', requested: 3_000, executed: 2_000, unexecuted: 1_000 },
      { allocationId: 'conversion', requested: 2_000, executed: 0, unexecuted: 2_000 },
    ])
    expect(evidence).toMatchObject({
      annualBasisDenominatorAmount: 10_000,
      distributionAllocation: { annualGrossAmount: 2_000 },
      conversionAllocation: { annualGrossAmount: 0, allocations: [] },
    })
  })

  it('preserves exact high safe-integer cents without a dollars round-trip', () => {
    const exactGross = Number.MAX_SAFE_INTEGER - 1
    const value = plan({ openingBasisA: 0.01, openingBasisB: 0 })
    const events = [activity('high-exact', 'distribution', 1)]
    const transaction = physicalTransaction(
      value,
      events,
      TAX_YEAR,
      LEDGER_RUN_ID,
      {
        requestedCentsByActivityId: { 'high-exact': exactGross },
        executedCentsByActivityId: { 'high-exact': exactGross },
        openingCentsByAccountId: { 'ira-a': exactGross, 'ira-b': 0 },
      },
    )
    const evidence = built(input({
      plan: value,
      transaction,
      annualObservation: observation(value, {
        openingBasis: 0.01,
        yearEndA: 0,
        yearEndB: 0,
      }),
      assumptions: assumptions({
        openingBasis: 0.01,
        designations: [],
        postYear: [],
      }),
    })).planningEvidence
    expect(evidence.distributionAllocation).toMatchObject({
      annualGrossAmount: exactGross,
      annualBasisReturnAmount: 1,
      annualOrdinaryIncomeAmount: exactGross - 1,
    })
  })

  it('preserves post-year prior-tax-year contributions in carryforward, not the current ratio', () => {
    const withPostYear = built().planningEvidence
    const withoutPostYear = built(input({
      assumptions: assumptions({ postYear: [] }),
    })).planningEvidence
    expect(withPostYear.allocationBasisNumeratorAmount).toBe(
      withoutPostYear.allocationBasisNumeratorAmount,
    )
    expect(withPostYear.annualBasisRatio).toEqual(withoutPostYear.annualBasisRatio)
    expect(withPostYear.nextYearOpeningPlanningBasisAmount).toBe(
      withoutPostYear.nextYearOpeningPlanningBasisAmount + 700,
    )
  })

  it('accepts a mathematically canonical predecessor with nonempty annual allocations', () => {
    const previous = built(input({
      assumptions: assumptions({ postYear: [] }),
    }))
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = plan()
    const openingAmount =
      previous.carryforwardEvidence.openingPlanningBasisAmount / 100
    expect(built(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: openingAmount,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: openingAmount,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId:
            previous.carryforwardEvidence.evidenceId,
        },
        designations: [],
        postYear: [],
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    })).status).toBe('annualPlanningEvidenceBuilt')
  })

  it('rejects fully rehashed predecessor post-year assumptions after the ordinary deadline', () => {
    const previous = previousPlanningEvidence(true)
    const planning = structuredClone(previous.planningEvidence) as unknown as
      Record<string, unknown>
    const postYear = planning.postYearPriorTaxYearContributionAssumptions as
      Array<Record<string, unknown>>
    postYear[0]!.contributionDate = `${TAX_YEAR + 1}-04-16`
    rehashEvidenceRecord(
      planning,
      'simulator-owned-ira-annual-planning-evidence',
    )
    const carryforward = structuredClone(previous.carryforwardEvidence) as
      unknown as Record<string, unknown>
    carryforward.sourcePlanningEvidenceId = planning.evidenceId
    carryforward.postYearPriorTaxYearContributionAssumptions = postYear
    rehashEvidenceRecord(
      carryforward,
      'simulator-owned-ira-planning-carryforward-evidence',
    )
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = plan()
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: 57,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 57,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: String(carryforward.evidenceId),
        },
        designations: [],
        postYear: [],
      }),
      priorCarryforwardEvidence: carryforward,
      priorPlanningEvidence: planning,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(issueKinds(result)).toContain('openingBasisMismatch')
  })

  it('rejects a fully rehashed permutation of predecessor allocation chronology', () => {
    const previous = built(input({
      events: [
        activity('first-prior-distribution', 'distribution', 10, {
          executionDate: `${TAX_YEAR}-03-01`,
        }),
        activity('second-prior-distribution', 'distribution', 20, {
          executionDate: `${TAX_YEAR}-06-01`,
          executionSequence: 2,
        }),
      ],
      assumptions: assumptions({ postYear: [] }),
    }))
    const planning = structuredClone(previous.planningEvidence) as unknown as
      Record<string, unknown>
    const distribution = planning.distributionAllocation as
      Record<string, unknown>
    ;(distribution.allocations as unknown[]).reverse()
    rehashEvidenceRecord(
      distribution,
      'simulator-owned-ira-planning-allocation',
    )
    rehashEvidenceRecord(
      planning,
      'simulator-owned-ira-annual-planning-evidence',
    )
    const carryforward = structuredClone(previous.carryforwardEvidence) as
      unknown as Record<string, unknown>
    carryforward.sourcePlanningEvidenceId = planning.evidenceId
    rehashEvidenceRecord(
      carryforward,
      'simulator-owned-ira-planning-carryforward-evidence',
    )
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = plan()
    const openingAmount = Number(carryforward.openingPlanningBasisAmount) / 100
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: openingAmount,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: openingAmount,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: String(carryforward.evidenceId),
        },
        designations: [],
        postYear: [],
      }),
      priorCarryforwardEvidence: carryforward,
      priorPlanningEvidence: planning,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(issueKinds(result)).toContain('openingBasisMismatch')
  })

  it('blocks when a predecessor post-year contribution is absent from current physical inventory', () => {
    const previous = previousPlanningEvidence(true)
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = plan()
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: 57,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 57,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
        designations: [],
        postYear: [],
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(result.status).toBe('annualPlanningEvidenceBlocked')
    expect(issueKinds(result)).toContain('contributionDesignationIncomplete')
  })

  it('rejoins a prior-year-designated settled contribution to the exact predecessor carryforward assumption', () => {
    const previous = previousPlanningEvidence(true)
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = planWithContribution()
    const first = value.accounts.find((account) => account.id === 'ira-a')
    const second = value.accounts.find((account) => account.id === 'ira-b')
    if (first?.type !== 'traditional' || second?.type !== 'traditional') {
      throw new Error('fixture drift')
    }
    first.annualContribution = 0
    second.annualContribution = 100
    const priorYearContribution = contributionRecord({
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      eventId: 'prior-year-settled-contribution',
      movementAuthorityId: 'prior-year-settled-contribution-authority',
      sourceAccountId: asAccountId('ira-b'),
      grossAmount: asPositiveUsdCents(700),
      executionDate: `${nextTaxYear}-02-01`,
      upstreamEvidenceId: 'prior-year-settled-contribution-upstream',
    })
    const transaction = physicalTransaction(
      value,
      [],
      nextTaxYear,
      nextLedgerRunId,
      { runtimeRecords: [priorYearContribution] },
    )
    const result = built(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: 57,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      transaction,
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 57,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
        designations: [{
          activityId: 'prior-year-settled-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 7,
        }],
        postYear: [],
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(result.planningEvidence).toMatchObject({
      openingPlanningBasisAmount: 5_700,
      inYearNondeductibleContributionAmount: 0,
      allocationBasisNumeratorAmount: 5_700,
      nextYearOpeningPlanningBasisAmount: 5_700,
    })
  })

  it('does not require a positive predecessor basis assumption for a fully deductible prior-year contribution', () => {
    const previous = previousPlanningEvidence(false)
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = planWithContribution()
    const contribution = contributionRecord({
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      executionDate: `${nextTaxYear}-02-01`,
    })
    const transaction = physicalTransaction(
      value,
      [],
      nextTaxYear,
      nextLedgerRunId,
      { runtimeRecords: [contribution] },
    )
    const result = built(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: 50,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      transaction,
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 50,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 0,
        }],
        postYear: [],
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(result.planningEvidence).toMatchObject({
      openingPlanningBasisAmount: 5_000,
      inYearNondeductibleContributionAmount: 0,
      nextYearOpeningPlanningBasisAmount: 5_000,
    })
  })

  it('rejects current physical lineage that collides with predecessor planning lineage', () => {
    const previous = previousPlanningEvidence(false)
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = planWithContribution()
    const contribution = contributionRecord({
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      executionDate: `${nextTaxYear}-02-01`,
    })
    const canonical = physicalTransaction(
      value,
      [],
      nextTaxYear,
      nextLedgerRunId,
      { runtimeRecords: [contribution] },
    )
    const forged = rehashPreparedTransaction(canonical, (draft) => {
      draft.settledContributionApplications[0]!.stagingEvidenceId =
        previous.carryforwardEvidence.sourcePlanningEvidenceId
    })
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        openingBasis: 50,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      events: [],
      transaction: forged,
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 50,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: nextTaxYear,
          nondeductibleContributionAmount: 6,
        }],
        postYear: [],
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(issueKinds(result)).toContain('identifierCollision')
  })

  it('awards a residual basis cent by chronology, then stable activity ID', () => {
    const value = plan({ openingBasisA: 0.01, openingBasisB: 0 })
    const events = [
      activity('later', 'distribution', 0.01, {
        sourceAccountId: 'ira-b',
        executionDate: `${TAX_YEAR}-02-01`,
        executionSequence: 2,
      }),
      activity('earlier', 'distribution', 0.01, {
        executionDate: `${TAX_YEAR}-01-01`,
        executionSequence: 1,
      }),
    ]
    const result = built(input({
      plan: value,
      annualObservation: observation(value, {
        openingBasis: 0.01,
        yearEndA: 0,
        yearEndB: 0,
      }),
      events,
      assumptions: assumptions({
        openingBasis: 0.01,
        designations: [],
        postYear: [],
      }),
    }))
    expect(result.planningEvidence.distributionAllocation).toMatchObject({
      annualGrossAmount: 2,
      annualBasisReturnAmount: 1,
      annualOrdinaryIncomeAmount: 1,
    })
    expect(result.planningEvidence.distributionAllocation.allocations.map(
      (entry) => [entry.executionDate, entry.residualCentAwarded],
    )).toEqual([
      [`${TAX_YEAR}-01-01`, 1],
      [`${TAX_YEAR}-02-01`, 0],
    ])
  })

  it('awards residual basis by chronology rather than fractional remainder size', () => {
    const value = plan({ openingBasisA: 0.01, openingBasisB: 0 })
    const events = [
      activity('later-larger-remainder', 'distribution', 0.02, {
        sourceAccountId: 'ira-b',
        executionDate: `${TAX_YEAR}-02-01`,
        executionSequence: 2,
      }),
      activity('earlier-smaller-remainder', 'distribution', 0.01, {
        executionDate: `${TAX_YEAR}-01-01`,
        executionSequence: 1,
      }),
    ]
    const result = built(input({
      plan: value,
      annualObservation: observation(value, {
        openingBasis: 0.01,
        yearEndA: 0.01,
        yearEndB: 0,
      }),
      events,
      assumptions: assumptions({
        openingBasis: 0.01,
        designations: [],
        postYear: [],
      }),
    }))
    expect(result.planningEvidence.distributionAllocation).toMatchObject({
      annualGrossAmount: 3,
      annualBasisReturnAmount: 1,
      annualOrdinaryIncomeAmount: 2,
    })
    expect(result.planningEvidence.distributionAllocation.allocations.map(
      (entry) => [
        entry.executionDate,
        entry.grossAmount,
        entry.residualCentAwarded,
      ],
    )).toEqual([
      [`${TAX_YEAR}-01-01`, 1, 1],
      [`${TAX_YEAR}-02-01`, 2, 0],
    ])
  })

  it('is permutation-invariant for activity and assumption arrays', () => {
    const baseline = built().planningEvidence
    const permutedEvents = [...defaultEvents()].reverse()
    const baseAssumptions = assumptions()
    const permuted = built(input({
      events: permutedEvents,
      assumptions: {
        ...baseAssumptions,
        settledContributionDesignations: [
          ...baseAssumptions.settledContributionDesignations,
        ].reverse(),
        postYearPriorTaxYearContributions: [
          ...baseAssumptions.postYearPriorTaxYearContributions,
        ].reverse(),
      },
    })).planningEvidence
    expect(permuted).toEqual(baseline)
  })

  it('preserves positive basis on the literal zero-denominator arm', () => {
    const value = plan()
    const result = built(input({
      plan: value,
      annualObservation: observation(value, { yearEndA: 0, yearEndB: 0 }),
      events: [],
      assumptions: assumptions({ designations: [], postYear: [] }),
    }))
    expect(result.planningEvidence).toMatchObject({
      annualBasisDenominatorAmount: 0,
      annualBasisRatio: {
        representation: 'notApplicableZeroDenominator',
        numeratorMinorUnits: 0,
        denominatorMinorUnits: 0,
        intermediateArithmetic: 'notApplicable',
      },
      nextYearOpeningPlanningBasisAmount: 5_000,
      distributionAllocation: { allocations: [] },
      conversionAllocation: { allocations: [] },
    })
  })

  it('rounds once across scopes, then partitions the annual residual cent', () => {
    const value = plan({ openingBasisA: 0.01, openingBasisB: 0 })
    const events = [
      activity('one-distribution', 'distribution', 0.01),
      activity('one-conversion', 'rothConversion', 0.01, {
        sourceAccountId: 'ira-b',
        executionSequence: 2,
      }),
    ]
    const result = built(input({
      plan: value,
      annualObservation: observation(value, {
        openingBasis: 0.01,
        yearEndA: 0,
        yearEndB: 0,
      }),
      events,
      assumptions: assumptions({
        openingBasis: 0.01,
        designations: [],
        postYear: [],
      }),
    }))
    expect(result.planningEvidence.distributionAllocation).toMatchObject({
      annualBasisReturnAmount: 1,
      annualOrdinaryIncomeAmount: 0,
    })
    expect(result.planningEvidence.conversionAllocation).toMatchObject({
      annualBasisReturnAmount: 0,
      annualOrdinaryIncomeAmount: 1,
    })
    expect(result.planningEvidence.nextYearOpeningPlanningBasisAmount).toBe(0)
  })

  it('awards a combined-scope residual cent before partitioning by scope', () => {
    const value = plan({ openingBasisA: 0.01, openingBasisB: 0 })
    const events = [
      activity('later-distribution', 'distribution', 0.01, {
        executionDate: `${TAX_YEAR}-02-01`,
        executionSequence: 2,
      }),
      activity('earlier-conversion', 'rothConversion', 0.01, {
        sourceAccountId: 'ira-b',
        executionDate: `${TAX_YEAR}-01-01`,
        executionSequence: 1,
      }),
    ]
    const result = built(input({
      plan: value,
      annualObservation: observation(value, {
        openingBasis: 0.01,
        yearEndA: 0.01,
        yearEndB: 0.01,
      }),
      events,
      assumptions: assumptions({
        openingBasis: 0.01,
        designations: [],
        postYear: [],
      }),
    }))
    expect(result.planningEvidence.distributionAllocation).toMatchObject({
      annualBasisReturnAmount: 0,
      annualOrdinaryIncomeAmount: 1,
      allocations: [{
        executionDate: `${TAX_YEAR}-02-01`,
        residualCentAwarded: 0,
      }],
    })
    expect(result.planningEvidence.conversionAllocation).toMatchObject({
      annualBasisReturnAmount: 1,
      annualOrdinaryIncomeAmount: 0,
      allocations: [{
        executionDate: `${TAX_YEAR}-01-01`,
        residualCentAwarded: 1,
      }],
    })
  })

  it.each([
    'qualifiedCharitableDistribution',
    'rollover',
    'repayment',
    'recharacterization',
    'oneTimeHsaFundingDistribution',
    'returnedContribution',
    'otherUnsupported',
  ] as const)('refuses a bespoke %s activity inventory outside the canonical transaction seam', (activityKind) => {
    const events = [activity('unsupported', activityKind, 1)]
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      events,
      inventory: inventory(events),
      assumptions: assumptions({ designations: [], postYear: [] }),
    }))
    expect(result.status).toBe('annualPlanningEvidenceBlocked')
    expect(issueKinds(result)).toContain('activityInventoryInvalid')
    expect(result).toMatchObject({
      movement: 'notCommitted',
      simulationActionability: 'notEstablished',
      realWorldActionability: 'notEstablished',
      planningEvidence: null,
    })
  })

  it('requires every personal contribution designation to join a canonical settled application', () => {
    const unsourced = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      assumptions: assumptions({
        designations: [{
          activityId: 'unsourced-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 0,
        }],
      }),
    }))
    expect(issueKinds(unsourced)).toContain('contributionAssumptionInvalid')

    const value = planWithContribution()
    const transaction = physicalTransaction(value, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, {
        runtimeRecords: [contributionRecord()],
      })
    const missing = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction,
      assumptions: assumptions({ designations: [] }),
    }))
    expect(issueKinds(missing)).toContain('contributionDesignationIncomplete')
  })

  it('uses the designated nondeductible portion of a canonical settled personal contribution', () => {
    const value = planWithContribution()
    const transaction = physicalTransaction(value, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, {
        runtimeRecords: [contributionRecord()],
      })
    const result = built(input({
      plan: value,
      transaction,
      assumptions: assumptions({
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 6,
        }],
        postYear: [],
      }),
    }))
    expect(result.planningEvidence).toMatchObject({
      inYearNondeductibleContributionAmount: 600,
      allocationBasisNumeratorAmount: 5_600,
      annualBasisDenominatorAmount: 13_000,
      nextYearOpeningPlanningBasisAmount: 3_446,
    })
  })

  it('accepts a fully deductible personal contribution and a canonical SEP employer contribution without adding basis', () => {
    const personalPlan = planWithContribution()
    const personal = physicalTransaction(personalPlan, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, {
        runtimeRecords: [contributionRecord()],
      })
    expect(built(input({
      plan: personalPlan,
      transaction: personal,
      assumptions: assumptions({
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 0,
        }],
        postYear: [],
      }),
    })).planningEvidence.inYearNondeductibleContributionAmount).toBe(0)

    const employerPlan = plan()
    const classification = employerPlan.retirementActionEligibilityFacts!
      .iraClassifications.find((item) => item.sourceAccountId === 'ira-a')!
    classification.subtype = 'sep'
    employerPlan.retirementActionEligibilityFacts!.sepSimpleActivities = [{
      sourceAccountId: 'ira-a',
      actionTaxYear: TAX_YEAR,
      planYearEndDate: `${TAX_YEAR}-12-31`,
      employerContributionMadeForPlanYear: true,
      evidenceId: 'ira-a-sep-activity',
      provenance: { source: 'manual' },
    }]
    const employerRecord = contributionRecord({
      eventId: 'settled-employer-contribution',
      movementAuthorityId: 'settled-employer-contribution-authority',
      kind: 'ownedIraEmployerContribution',
      upstreamEvidenceId: 'settled-employer-contribution-upstream',
    })
    const employer = physicalTransaction(employerPlan, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, { runtimeRecords: [employerRecord] })
    expect(built(input({
      plan: employerPlan,
      transaction: employer,
      assumptions: assumptions({ designations: [], postYear: [] }),
    })).planningEvidence.inYearNondeductibleContributionAmount).toBe(0)
  })

  it('rejects settled contributions whose current Plan no longer supplies the producer eligibility facts', () => {
    const personalPlan = planWithContribution()
    const personal = physicalTransaction(personalPlan, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, {
        runtimeRecords: [contributionRecord()],
      })
    const personalSource = personalPlan.accounts.find(
      (account) => account.id === 'ira-a',
    )
    if (personalSource?.type !== 'traditional') throw new Error('fixture drift')
    personalSource.annualContribution = 0
    personalPlan.incomes = []
    const missingPersonalRoute =
      buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
        plan: personalPlan,
        transaction: personal,
        assumptions: assumptions({
          designations: [{
            activityId: 'settled-personal-contribution',
            designatedTaxYear: TAX_YEAR,
            nondeductibleContributionAmount: 6,
          }],
        }),
      }))
    expect(issueKinds(missingPersonalRoute)).toContain('activityUnsupported')

    const employerPlan = plan()
    const classification = employerPlan.retirementActionEligibilityFacts!
      .iraClassifications.find((item) => item.sourceAccountId === 'ira-a')!
    classification.subtype = 'sep'
    employerPlan.retirementActionEligibilityFacts!.sepSimpleActivities = [{
      sourceAccountId: 'ira-a',
      actionTaxYear: TAX_YEAR,
      planYearEndDate: `${TAX_YEAR}-12-31`,
      employerContributionMadeForPlanYear: true,
      evidenceId: 'ira-a-sep-activity',
      provenance: { source: 'manual' },
    }]
    const employerRecord = contributionRecord({
      eventId: 'settled-employer-contribution',
      movementAuthorityId: 'settled-employer-contribution-authority',
      kind: 'ownedIraEmployerContribution',
      upstreamEvidenceId: 'settled-employer-contribution-upstream',
    })
    const employer = physicalTransaction(employerPlan, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, { runtimeRecords: [employerRecord] })
    employerPlan.retirementActionEligibilityFacts!.sepSimpleActivities = []
    const missingEmployerFact =
      buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
        plan: employerPlan,
        transaction: employer,
        assumptions: assumptions({ designations: [], postYear: [] }),
      }))
    expect(issueKinds(missingEmployerFact)).toContain('activityUnsupported')
  })

  it('requires complete Plan IRA classifications', () => {
    const incomplete = plan()
    incomplete.retirementActionEligibilityFacts!.iraClassifications.pop()
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: incomplete,
    })))).toContain('assumptionsInvalid')
  })

  it.each([
    {
      name: 'foreign contribution source',
      postYear: [{
        sourceAccountId: 'other-owner-ira',
        designatedTaxYear: TAX_YEAR,
        contributionDate: `${TAX_YEAR + 1}-02-01`,
        nondeductibleContributionAmount: 1,
      }],
    },
    {
      name: 'wrong designated year',
      postYear: [{
        sourceAccountId: 'ira-a',
        designatedTaxYear: TAX_YEAR + 1,
        contributionDate: `${TAX_YEAR + 1}-02-01`,
        nondeductibleContributionAmount: 1,
      }],
    },
    {
      name: 'after modeled deadline',
      postYear: [{
        sourceAccountId: 'ira-a',
        designatedTaxYear: TAX_YEAR,
        contributionDate: `${TAX_YEAR + 1}-04-16`,
        nondeductibleContributionAmount: 1,
      }],
    },
    {
      name: 'zero serialized assumption',
      postYear: [{
        sourceAccountId: 'ira-a',
        designatedTaxYear: TAX_YEAR,
        contributionDate: `${TAX_YEAR + 1}-02-01`,
        nondeductibleContributionAmount: 0,
      }],
    },
  ])('rejects $name', ({ postYear }) => {
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      assumptions: assumptions({ postYear }),
    }))
    expect(issueKinds(result)).toContain('contributionAssumptionInvalid')
  })

  it('applies settled personal-contribution subtype and Plan-route eligibility to post-year assumptions', () => {
    const simplePlan = plan()
    simplePlan.retirementActionEligibilityFacts!.iraClassifications.find(
      (classification) => classification.sourceAccountId === 'ira-b',
    )!.subtype = 'simple'
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: simplePlan,
    })))).toContain('contributionAssumptionInvalid')

    const routeLessPlan = plan()
    const source = routeLessPlan.accounts.find(
      (account) => account.id === 'ira-b',
    )
    if (source?.type !== 'traditional') throw new Error('fixture drift')
    delete source.contributionSchedule
    source.annualContribution = 0
    routeLessPlan.incomes = []
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: routeLessPlan,
    })))).toContain('contributionAssumptionInvalid')
  })

  it('rejects nonzero, negative-zero, and incomplete rollover assumptions', () => {
    for (const rolloverAssumption of [
      {
        status: 'assumedNoOutstandingRolloverOrRepaymentAdjustment',
        outstandingRolloverAmount: 1,
        rolloverRepaymentAdjustmentAmount: 0,
      },
      {
        status: 'assumedNoOutstandingRolloverOrRepaymentAdjustment',
        outstandingRolloverAmount: -0,
        rolloverRepaymentAdjustmentAmount: 0,
      },
      {
        status: 'unknown',
        outstandingRolloverAmount: 0,
        rolloverRepaymentAdjustmentAmount: 0,
      },
    ]) {
      const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
        assumptions: { ...assumptions(), rolloverAssumption },
      }))
      expect(issueKinds(result)).toContain('rolloverAssumptionUnsupported')
    }
  })

  it('requires exact Plan-seed or immediately prior carryforward opening basis', () => {
    const badSeed = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      assumptions: assumptions({ openingBasis: 49 }),
    }))
    expect(issueKinds(badSeed)).toContain('openingBasisMismatch')

    const previous = previousPlanningEvidence()
    const nextTaxYear = TAX_YEAR + 1
    const nextLedgerRunId = `planning-ledger-${nextTaxYear}`
    const value = plan()
    const validContinuityInput = input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 50,
          priorTaxYear: TAX_YEAR,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    })
    const prior = built(validContinuityInput)
    expect(prior.status).toBe('annualPlanningEvidenceBuilt')

    const missingPriorPlanning =
      buildSimulatorOwnedNonRothIraAnnualPlanningEvidence({
        ...validContinuityInput,
        priorPlanningEvidence: undefined,
      })
    expect(issueKinds(missingPriorPlanning)).toContain('openingBasisMismatch')

    const forgedPriorPlanning = structuredClone(previous.planningEvidence) as
      unknown as Record<string, unknown>
    forgedPriorPlanning.nextYearOpeningPlanningBasisAmount = 5_001
    delete forgedPriorPlanning.evidenceId
    forgedPriorPlanning.evidenceId = deriveActionStructuralId(
      'simulator-owned-ira-annual-planning-evidence',
      [forgedPriorPlanning],
    )
    const rehashedPredecessor =
      buildSimulatorOwnedNonRothIraAnnualPlanningEvidence({
        ...validContinuityInput,
        priorPlanningEvidence: forgedPriorPlanning,
      })
    expect(issueKinds(rehashedPredecessor)).toContain('openingBasisMismatch')

    const pairedPlanning = structuredClone(previous.planningEvidence) as
      unknown as Record<string, unknown>
    pairedPlanning.nextYearOpeningPlanningBasisAmount = 5_001
    delete pairedPlanning.evidenceId
    pairedPlanning.evidenceId = deriveActionStructuralId(
      'simulator-owned-ira-annual-planning-evidence',
      [pairedPlanning],
    )
    const pairedCarryforward = structuredClone(
      previous.carryforwardEvidence,
    ) as unknown as Record<string, unknown>
    pairedCarryforward.sourcePlanningEvidenceId = pairedPlanning.evidenceId
    pairedCarryforward.openingPlanningBasisAmount = 5_001
    delete pairedCarryforward.evidenceId
    pairedCarryforward.evidenceId = deriveActionStructuralId(
      'simulator-owned-ira-planning-carryforward-evidence',
      [pairedCarryforward],
    )
    const pairedForgery =
      buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
        plan: value,
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
        annualObservation: observation(value, {
          openingBasis: 50.01,
          taxYear: nextTaxYear,
          ledgerRunId: nextLedgerRunId,
        }),
        assumptions: assumptions({
          taxYear: nextTaxYear,
          openingSource: {
            source: 'priorProjectionCarryforward',
            asOfDate: `${nextTaxYear}-01-01`,
            amount: 50.01,
            priorTaxYear: TAX_YEAR,
            priorCarryforwardEvidenceId: String(pairedCarryforward.evidenceId),
          },
        }),
        priorCarryforwardEvidence: pairedCarryforward,
        priorPlanningEvidence: pairedPlanning,
        projectionStartTaxYear: TAX_YEAR,
      }))
    expect(issueKinds(pairedForgery)).toContain('openingBasisMismatch')

    const stale = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      taxYear: nextTaxYear,
      ledgerRunId: nextLedgerRunId,
      annualObservation: observation(value, {
        taxYear: nextTaxYear,
        ledgerRunId: nextLedgerRunId,
      }),
      assumptions: assumptions({
        taxYear: nextTaxYear,
        openingSource: {
          source: 'priorProjectionCarryforward',
          asOfDate: `${nextTaxYear}-01-01`,
          amount: 50,
          priorTaxYear: TAX_YEAR - 1,
          priorCarryforwardEvidenceId: previous.carryforwardEvidence.evidenceId,
        },
      }),
      priorCarryforwardEvidence: previous.carryforwardEvidence,
      priorPlanningEvidence: previous.planningEvidence,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(issueKinds(stale)).toContain('openingBasisMismatch')

    const reset = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      taxYear: nextTaxYear,
      projectionStartTaxYear: TAX_YEAR,
    }))
    expect(issueKinds(reset)).toContain('openingBasisMismatch')
  })

  it('rejects bespoke incomplete, foreign, duplicate, and non-chronological activity inventories', () => {
    const unresolved = inventory(defaultEvents(), {
      unresolvedActivityIds: ['unresolved-runtime-flow'],
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      inventory: unresolved,
    })))).toContain('activityInventoryInvalid')

    const foreignEvents = [activity('foreign', 'distribution', 1, {
      sourceAccountId: 'other-owner-ira',
    })]
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      events: foreignEvents,
      inventory: inventory(foreignEvents),
      assumptions: assumptions({ designations: [], postYear: [] }),
    })))).toContain('activityInventoryInvalid')

    const duplicateEvents = [
      activity('duplicate', 'distribution', 1),
      activity('duplicate', 'distribution', 2, { sourceAccountId: 'ira-b' }),
    ]
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      events: duplicateEvents,
      inventory: inventory(duplicateEvents),
      assumptions: assumptions({ designations: [], postYear: [] }),
    })))).toContain('activityInventoryInvalid')

    const splitAuthority = [
      activity('first', 'distribution', 1, {
        actionId: 'shared-authority',
      }),
      activity('second', 'distribution', 1, {
        actionId: 'shared-authority',
        sourceAccountId: 'ira-b',
        executionDate: `${TAX_YEAR}-07-01`,
      }),
    ]
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      events: splitAuthority,
      inventory: inventory(splitAuthority),
      assumptions: assumptions({ designations: [], postYear: [] }),
    })))).toContain('activityInventoryInvalid')

    const sharedAuthority = [
      activity('shared-a', 'distribution', 1, {
        actionId: 'shared-valid-authority',
      }),
      activity('shared-b', 'distribution', 1, {
        actionId: 'shared-valid-authority',
        sourceAccountId: 'ira-b',
      }),
    ]
    expect(built(input({
      events: sharedAuthority,
      assumptions: assumptions({ designations: [], postYear: [] }),
    })).status).toBe('annualPlanningEvidenceBuilt')
  })

  it('rejects tampered observation and prepared-transaction identities', () => {
    const observed = observation()
    const tamperedObservation = {
      ...observed,
      aggregateYearEndApplicableBalanceAmount:
        observed.aggregateYearEndApplicableBalanceAmount + 1,
    }
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      annualObservation: tamperedObservation,
    })))).toContain('observationInvalid')

    const value = plan()
    const settled = physicalTransaction(value, defaultEvents())
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction: {
        ...settled,
        line7GrossAmount: settled.line7GrossAmount + 1,
      },
    })))).toContain('activityInventoryInvalid')
  })

  it.each([
    ['deadlineDate', `${TAX_YEAR + 1}-04-16`],
    ['deadlineKind', 'disasterReliefExtension'],
    ['calendarAdjustmentStatus', 'notApplied'],
  ])('rejects a fully rehashed modeled deadline with false %s', (field, value) => {
    const forged = rehashObservationDeadline(observation(), (deadline) => {
      deadline[field] = value
    })
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      annualObservation: forged,
    }))
    expect(issueKinds(result)).toContain('observationInvalid')
  })

  it('requires a prepared physical transaction to carry exactly no issues', () => {
    const settled = structuredClone(physicalTransaction(plan(), defaultEvents()))
    const forged = {
      ...settled,
      issues: [{ kind: 'inventedIssue', detail: 'not clean' }],
    }
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      transaction: forged,
    }))
    expect(issueKinds(result)).toContain('activityInventoryBindingMismatch')

    const malformed = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      transaction: { ...settled, issues: {} },
    }))
    expect(issueKinds(malformed)).toContain('activityInventoryInvalid')
  })

  it('rejects a semantically changed application even when every public ID is rehashed', () => {
    const value = plan()
    const settled = physicalTransaction(value, defaultEvents())
    const forged = rehashPreparedTransaction(settled, (draft) => {
      const line7 = draft.applications.find((application) =>
        application.lineScope === 'form8606Line7Distributions')!
      line7.eventKind = 'rothConversion'
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction: forged,
    })))).toContain('activityInventoryInvalid')
  })

  it('rejects a rehashed repeated-source application chain with invented before/after facts', () => {
    const value = plan()
    const events = [
      activity('first', 'distribution', 10, {
        executionDate: `${TAX_YEAR}-03-01`,
      }),
      activity('second', 'distribution', 10, {
        executionDate: `${TAX_YEAR}-06-01`,
      }),
    ]
    const settled = physicalTransaction(value, events)
    const forged = rehashPreparedTransaction(settled, (draft) => {
      const second = draft.applications.find((application) =>
        application.allocationId === 'second')!
      second.sourceBalanceBefore = Number(second.sourceBalanceBefore) - 500
      second.sourceBalanceAfter = Number(second.sourceBalanceBefore) -
        Number(second.executedAmount)
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      events,
      transaction: forged,
      assumptions: assumptions({ designations: [], postYear: [] }),
    })))).toContain('activityInventoryInvalid')
  })

  it('rejects rehashed settled-contribution lineage and mixed-chain tampering', () => {
    const value = planWithContribution()
    const settled = physicalTransaction(value, defaultEvents(),
      TAX_YEAR, LEDGER_RUN_ID, {
        runtimeRecords: [contributionRecord()],
      })
    const forgedLineage = rehashPreparedTransaction(settled, (draft) => {
      draft.settledContributionApplications[0]!
        .inventoryEventUpstreamEvidenceId = 'forged-contribution-upstream'
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction: forgedLineage,
      assumptions: assumptions({
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 6,
        }],
      }),
    })))).toContain('activityInventoryInvalid')

    const forgedChain = rehashPreparedTransaction(settled, (draft) => {
      const contribution = draft.settledContributionApplications[0]!
      contribution.sourceBalanceBefore =
        Number(contribution.sourceBalanceBefore) - 100
      contribution.sourceBalanceAfter = Number(contribution.sourceBalanceBefore) +
        Number(contribution.creditedAmount)
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction: forgedChain,
      assumptions: assumptions({
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 6,
        }],
      }),
    })))).toContain('activityInventoryInvalid')

    const forgedCollision = rehashPreparedTransaction(settled, (draft) => {
      draft.settledContributionApplications[0]!.stagingEvidenceId =
        'planning-wages'
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      transaction: forgedCollision,
      assumptions: assumptions({
        designations: [{
          activityId: 'settled-personal-contribution',
          designatedTaxYear: TAX_YEAR,
          nondeductibleContributionAmount: 6,
        }],
      }),
    })))).toContain('identifierCollision')
  })

  it('rejects a rehashed permutation of the canonical global and owner-pool chronology', () => {
    const value = plan()
    const events = [
      activity('first', 'distribution', 10, {
        executionDate: `${TAX_YEAR}-03-01`,
      }),
      activity('second', 'distribution', 10, {
        executionDate: `${TAX_YEAR}-06-01`,
      }),
    ]
    const settled = physicalTransaction(value, events)
    const forged = rehashPreparedTransaction(settled, (draft) => {
      draft.inventory.events.reverse()
      const pool = draft.inventory.ownedIraPools.find(
        (candidate) => candidate.ownerPersonId === 'p1',
      )!
      const poolEvents = pool.events as unknown[]
      poolEvents.reverse()
      const line7 = pool.line7DistributionCandidate as {
        events: unknown[]
      }
      line7.events.reverse()
    })
    expect(issueKinds(buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      events,
      transaction: forged,
      assumptions: assumptions({ designations: [], postYear: [] }),
    })))).toContain('activityChronologyInvalid')
  })

  it('refuses malformed bespoke inventories even when their identifiers mimic trusted roles', () => {
    const observed = observation()
    for (const events of [
      [activity('ira-a', 'distribution', 1)],
      [activity('event', 'distribution', 1, { actionId: 'planning-plan' })],
      [activity('event', 'distribution', 1, { upstreamEvidenceId: 'p1' })],
      [activity(observed.evidenceScope.evidenceId, 'distribution', 1)],
    ]) {
      const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
        events,
        inventory: inventory(events),
        assumptions: assumptions({ designations: [], postYear: [] }),
      }))
      expect(issueKinds(result)).toContain('activityInventoryInvalid')
    }
  })

  it('blocks safe-cent overflow in contribution carryforward assumptions', () => {
    const value = planWithContribution()
    const postYearOverflow = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(input({
      plan: value,
      assumptions: assumptions({
        postYear: [
          {
            sourceAccountId: 'ira-a',
            designatedTaxYear: TAX_YEAR,
            contributionDate: `${TAX_YEAR + 1}-02-01`,
            nondeductibleContributionAmount: 50_000_000_000_000,
          },
          {
            sourceAccountId: 'ira-b',
            designatedTaxYear: TAX_YEAR,
            contributionDate: `${TAX_YEAR + 1}-02-02`,
            nondeductibleContributionAmount: 50_000_000_000_000,
          },
        ],
      }),
    }))
    expect(issueKinds(postYearOverflow)).toContain('amountOverflow')

  })

  it('snapshots stateful getters once and freezes the entire result', () => {
    const baseline = input()
    let planReads = 0
    let assumptionsReads = 0
    const hostileInput = {
      get plan() {
        planReads += 1
        return baseline.plan
      },
      ownerPersonId: baseline.ownerPersonId,
      taxYear: baseline.taxYear,
      projectionStartTaxYear: baseline.projectionStartTaxYear,
      ledgerRunId: baseline.ledgerRunId,
      annualObservation: baseline.annualObservation,
      annualPhysicalTransaction: baseline.annualPhysicalTransaction,
      get assumptions() {
        assumptionsReads += 1
        return baseline.assumptions
      },
    }
    const result = built(hostileInput)
    expect(planReads).toBe(1)
    expect(assumptionsReads).toBe(1)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.planningEvidence)).toBe(true)
    expect(Object.isFrozen(result.planningEvidence.accountIds)).toBe(true)
    expect(Object.isFrozen(
      result.planningEvidence.distributionAllocation.allocations[0],
    )).toBe(true)
  })

  it('fails closed on hostile clone inputs without leaking partial evidence', () => {
    const hostile = input({ assumptions: new Proxy({}, {
      ownKeys() {
        throw new Error('hostile ownKeys')
      },
    }) })
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(hostile)
    expect(result).toMatchObject({
      status: 'annualPlanningEvidenceBlocked',
      movement: 'notCommitted',
      simulationActionability: 'notEstablished',
      planningEvidence: null,
    })
    expect(issueKinds(result)).toContain('inputInvalid')
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('fails closed when both a thrown value and its formatter are hostile', () => {
    const baseline = input()
    const hostileThrownValue = {
      toString() {
        throw new Error('hostile formatter')
      },
    }
    const hostileInput = {
      get plan(): unknown {
        throw hostileThrownValue
      },
      ownerPersonId: baseline.ownerPersonId,
      taxYear: baseline.taxYear,
      projectionStartTaxYear: baseline.projectionStartTaxYear,
      ledgerRunId: baseline.ledgerRunId,
      annualObservation: baseline.annualObservation,
      annualPhysicalTransaction: baseline.annualPhysicalTransaction,
      assumptions: baseline.assumptions,
    }
    const result = buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(
      hostileInput,
    )
    expect(result.status).toBe('annualPlanningEvidenceBlocked')
    expect(issueKinds(result)).toContain('inputInvalid')
    expect(result.issues[0]!.detail).toContain('unformattable error')
  })
})
