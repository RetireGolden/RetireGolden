import { describe, expect, it, vi } from 'vitest'

import {
  buildAnnualRetirementPhysicalEventInventory,
  type AnnualRetirementRuntimeInventoryRecord,
} from '../actions/annualRetirementPhysicalEventInventory.js'
import { asAccountId, asActionId, asAllocationId, asPersonId, asPlanId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import * as structuralId from '../actions/structuralId.js'
import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  beginSimulatorAnnualRetirementRuntimeJournal,
  forkSimulatorAnnualRetirementRuntimeJournal,
  recordSimulatorAnnualRetirementRuntimeOccurrence,
  sealSimulatorAnnualRetirementRuntimeJournal,
  type SimulatorAnnualRetirementRuntimeOccurrence,
} from './annualRetirementRuntimeJournal.js'

const planId = asPlanId('plan-runtime-journal')
const ownerPersonId = asPersonId('owner')
const sourceAccountId = asAccountId('owned-ira')

const context = {
  planId,
  taxYear: 2030,
  ledgerRunId: 'ledger-2030',
}

function occurrence(
  overrides: Partial<SimulatorAnnualRetirementRuntimeOccurrence> = {},
): SimulatorAnnualRetirementRuntimeOccurrence {
  return {
    producerOccurrenceKey: 'rmd:owned-ira',
    kind: 'ownedIraRmd',
    grossAmountPlanDollars: 12.34,
    ownerPersonId,
    sourceAccountId,
    executionDate: null,
    executionSequence: null,
    movementAuthorityId: null,
    ...overrides,
  }
}

function sealed(...occurrences: SimulatorAnnualRetirementRuntimeOccurrence[]) {
  let journal = beginSimulatorAnnualRetirementRuntimeJournal(context)
  for (const item of occurrences) {
    journal = recordSimulatorAnnualRetirementRuntimeOccurrence(journal, item)
  }
  const result = sealSimulatorAnnualRetirementRuntimeJournal(journal)
  expect(result.status).toBe('runtimeJournalSealed')
  if (result.status !== 'runtimeJournalSealed') throw new Error('fixture blocked')
  return result
}

function basePlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  plan.id = planId
  plan.household.people[0]!.id = ownerPersonId
  plan.accounts = [traditionalAccount(sourceAccountId, 1_000, ownerPersonId)]
  plan.strategies.retirementActions = [{
    actionId: asActionId('withdrawal'),
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 20,
    requestedAmount: asPositiveUsdCents(1_000),
    provenance: { source: 'manual' },
    personId: ownerPersonId,
    allocations: [{
      allocationId: asAllocationId('allocation'),
      sourceAccountId,
      requestedAmount: asPositiveUsdCents(1_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return plan
}

describe('simulator annual retirement runtime journal', () => {
  it('seals an immutable explicit-empty inventory', () => {
    const result = sealed()

    expect(result.runtimeRecords).toEqual([])
    expect(result.runtimeInventoryAttestation).toMatchObject({
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      resolvedEventIds: [],
      unresolvedActivityIds: [],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.runtimeInventoryAttestation)).toBe(true)
  })

  it.each([
    ['ownedIraRmd', 'rmdEngine'],
    ['employerPlanRmd', 'rmdEngine'],
    ['inheritedIraRmd', 'rmdEngine'],
    ['automaticSeppDistribution', 'seppEngine'],
    ['legacyNeedBasedWithdrawal', 'legacyProjection'],
    ['legacyRothConversion', 'legacyProjection'],
    ['ownedIraContribution', 'contributionLedger'],
    ['ownedIraEmployerContribution', 'contributionLedger'],
    ['employerPlanEmployeeContribution', 'contributionLedger'],
    ['employerPlanEmployerMatch', 'contributionLedger'],
    ['namedQcd', 'charitableDistributionLedger'],
    ['namedRothConversion', 'transferLedger'],
    ['annuityFundingTransfer', 'transferLedger'],
    ['rolloverInflow', 'transferLedger'],
    ['otherTraditionalTransfer', 'transferLedger'],
  ] as const)(
    'derives %s origin and leaves missing chronology unresolved',
    (kind, origin) => {
      const result = sealed(occurrence({ kind }))
      expect(result.runtimeRecords).toHaveLength(1)
      expect(result.runtimeRecords[0]).toMatchObject({
        recordStatus: 'unresolved',
        kind,
        origin,
        knownGrossAmount: 1_234,
        ownerPersonId: null,
        sourceAccountId: null,
        executionDate: null,
        executionSequence: null,
        incompatibility: 'executionChronologyUnavailable',
      })
    },
  )

  it('preserves an aggregate legacy QCD without inventing identity or December 31', () => {
    const result = sealed(occurrence({
      producerOccurrenceKey: 'legacy-qcd',
      kind: 'legacyQcd',
      ownerPersonId: null,
      sourceAccountId: null,
    }))

    expect(result.runtimeRecords[0]).toMatchObject({
      recordStatus: 'unresolved',
      kind: 'legacyQcd',
      origin: 'legacyProjection',
      ownerPersonId: null,
      sourceAccountId: null,
      executionDate: null,
      executionSequence: null,
      incompatibility: 'legacyAggregateIdentityUnavailable',
    })
  })

  // The journal and the inventory classify origins separately and the
  // inventory checks the journal's answer against its own, so the pair has to
  // agree on where a named gift comes from. It is not a transfer: IRC
  // 408(d)(8)(B)(i) has the custodian pay the donee organization directly, so
  // there is no household account on the far side of the movement, and calling
  // it one would have been the quietest way to be wrong -- a mis-origined
  // record reconciles everywhere else.
  it('agrees with the inventory that a named gift is not a household transfer', () => {
    const journal = sealed(occurrence({
      producerOccurrenceKey: 'named-qcd',
      kind: 'namedQcd',
    }))
    const record = journal.runtimeRecords[0]!
    expect(record.origin).toBe('charitableDistributionLedger')

    const build = (
      records: readonly Readonly<AnnualRetirementRuntimeInventoryRecord>[],
    ) => buildAnnualRetirementPhysicalEventInventory({
      plan: basePlan(),
      taxYear: context.taxYear,
      runtimeRecords: records,
      runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
    })

    expect(build(journal.runtimeRecords).issues.map((item) => item.kind))
      .not.toContain('runtimeEventOriginMismatch')
    expect(build([{ ...record, origin: 'transferLedger' }])
      .issues.map((item) => item.kind))
      .toContain('runtimeEventOriginMismatch')
  })

  it('resolves only a supported occurrence with explicit physical chronology and authority', () => {
    const result = sealed(occurrence({
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'rmd-movement',
    }))

    expect(result.runtimeRecords[0]).toMatchObject({
      recordStatus: 'resolved',
      kind: 'ownedIraRmd',
      origin: 'rmdEngine',
      ownerPersonId,
      sourceAccountId,
      grossAmount: 1_234,
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'rmd-movement',
    })
  })

  it('carries the canonical positional contribution source into a resolved record', () => {
    const result = sealed(occurrence({
      producerOccurrenceKey: JSON.stringify([
        'ownedIraContribution', sourceAccountId, 3,
      ]),
      kind: 'ownedIraContribution',
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'contribution-movement',
    }))

    expect(result.runtimeRecords[0]).toMatchObject({
      recordStatus: 'resolved',
      kind: 'ownedIraContribution',
      sourceAccountId,
      sourceBalanceIndex: 3,
    })
  })

  it('keeps contract-excluded transfer kinds unresolved even if every fact is supplied', () => {
    const result = sealed(occurrence({
      kind: 'annuityFundingTransfer',
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'annuity-movement',
    }))

    expect(result.runtimeRecords[0]).toMatchObject({
      recordStatus: 'unresolved',
      incompatibility: 'movementAuthorityUnavailable',
    })
  })

  it('uses exact decimal half-up Plan-dollar adaptation once', () => {
    const result = sealed(occurrence({ grossAmountPlanDollars: 12.345 }))
    expect(result.runtimeRecords[0]).toMatchObject({ knownGrossAmount: 1_235 })
  })

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    -0,
    90_071_992_547_410,
    0.001,
  ])('blocks rather than omitting an unrepresentable physical amount %s', (amount) => {
    const start = beginSimulatorAnnualRetirementRuntimeJournal(context)
    const journal = recordSimulatorAnnualRetirementRuntimeOccurrence(
      start,
      occurrence({ grossAmountPlanDollars: amount }),
    )
    const result = sealSimulatorAnnualRetirementRuntimeJournal(journal)

    expect(result).toMatchObject({
      status: 'runtimeJournalBlocked',
      runtimeRecords: null,
      runtimeInventoryAttestation: null,
      issues: [{ kind: 'occurrenceAmountUnrepresentable' }],
    })
  })

  it('taints duplicate producer keys so a partial attestation cannot be sealed', () => {
    const start = beginSimulatorAnnualRetirementRuntimeJournal(context)
    const once = recordSimulatorAnnualRetirementRuntimeOccurrence(start, occurrence())
    const duplicate = recordSimulatorAnnualRetirementRuntimeOccurrence(
      once,
      occurrence({ grossAmountPlanDollars: 99 }),
    )

    expect(sealSimulatorAnnualRetirementRuntimeJournal(duplicate)).toMatchObject({
      status: 'runtimeJournalBlocked',
      issues: [{ kind: 'duplicateOccurrence' }],
    })
  })

  it('canonicalizes equivalent occurrence permutations to identical output', () => {
    const first = occurrence({ producerOccurrenceKey: 'first' })
    const second = occurrence({
      producerOccurrenceKey: 'second',
      kind: 'automaticSeppDistribution',
      grossAmountPlanDollars: 4.56,
    })

    expect(sealed(first, second)).toEqual(sealed(second, first))
  })

  it('forks an immutable pre-pass prefix into isolated attempt tails', () => {
    const empty = beginSimulatorAnnualRetirementRuntimeJournal(context)
    const prefix = recordSimulatorAnnualRetirementRuntimeOccurrence(
      empty,
      occurrence({
        producerOccurrenceKey: 'contribution-prefix',
        kind: 'ownedIraContribution',
      }),
    )
    const firstAttempt = recordSimulatorAnnualRetirementRuntimeOccurrence(
      forkSimulatorAnnualRetirementRuntimeJournal(prefix),
      occurrence({ producerOccurrenceKey: 'rmd-attempt-1' }),
    )
    const secondAttempt = recordSimulatorAnnualRetirementRuntimeOccurrence(
      forkSimulatorAnnualRetirementRuntimeJournal(prefix),
      occurrence({ producerOccurrenceKey: 'rmd-attempt-2' }),
    )

    expect(prefix.entries).toHaveLength(1)
    expect(firstAttempt.entries).toHaveLength(2)
    expect(secondAttempt.entries).toHaveLength(2)
    expect(firstAttempt.entries[1]!.producerOccurrenceKey).toBe('rmd-attempt-1')
    expect(secondAttempt.entries[1]!.producerOccurrenceKey).toBe('rmd-attempt-2')
    expect(Object.isFrozen(prefix.entries)).toBe(true)
  })

  it('detects derived identifier collisions and suppresses attestation', () => {
    vi.spyOn(structuralId, 'deriveActionStructuralId').mockReturnValue('collision')
    const start = beginSimulatorAnnualRetirementRuntimeJournal(context)
    const journal = recordSimulatorAnnualRetirementRuntimeOccurrence(start, occurrence())

    expect(sealSimulatorAnnualRetirementRuntimeJournal(journal)).toMatchObject({
      status: 'runtimeJournalBlocked',
      issues: [{ kind: 'identifierCollision' }],
    })
    vi.restoreAllMocks()
  })

  it('rejects a movement authority that collides with a derived journal identifier', () => {
    const start = beginSimulatorAnnualRetirementRuntimeJournal(context)
    const first = recordSimulatorAnnualRetirementRuntimeOccurrence(
      start,
      occurrence({
        executionDate: '2030-03-01',
        executionSequence: 10,
        movementAuthorityId: 'first-movement',
      }),
    )
    const firstRecord = first.entries[0]!.record
    expect(firstRecord.recordStatus).toBe('resolved')
    if (firstRecord.recordStatus !== 'resolved') return

    const collided = recordSimulatorAnnualRetirementRuntimeOccurrence(
      first,
      occurrence({
        producerOccurrenceKey: 'second',
        executionDate: '2030-04-01',
        executionSequence: 20,
        movementAuthorityId: firstRecord.eventId,
      }),
    )

    expect(sealSimulatorAnnualRetirementRuntimeJournal(collided)).toMatchObject({
      status: 'runtimeJournalBlocked',
      issues: [{ kind: 'identifierCollision' }],
    })
  })

  it('permits one movement authority to bind distinct source rows', () => {
    const first = occurrence({
      producerOccurrenceKey: 'rmd:first-source',
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'shared-movement',
    })
    const second = occurrence({
      producerOccurrenceKey: 'rmd:second-source',
      sourceAccountId: asAccountId('owned-ira-2'),
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'shared-movement',
    })

    expect(sealed(first, second).runtimeRecords).toHaveLength(2)
  })

  it('feeds exact unresolved activity into the existing fail-closed inventory', () => {
    const journal = sealed(occurrence())
    const result = buildAnnualRetirementPhysicalEventInventory({
      plan: basePlan(),
      taxYear: context.taxYear,
      runtimeRecords: journal.runtimeRecords,
      runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
    })

    expect(result.status).toBe('annualPhysicalEventInventoryIncomplete')
    expect(result.issues.map((item) => item.kind)).toContain(
      'unresolvedRuntimeActivity',
    )
  })

  it('does not let resolved runtime activity enable standalone execution', () => {
    const journal = sealed(occurrence({
      executionDate: '2030-03-01',
      executionSequence: 10,
      movementAuthorityId: 'rmd-movement',
    }))
    const result = buildAnnualRetirementPhysicalEventInventory({
      plan: basePlan(),
      taxYear: context.taxYear,
      runtimeRecords: journal.runtimeRecords,
      runtimeInventoryAttestation: journal.runtimeInventoryAttestation,
    })

    expect(result.status).toBe('annualPhysicalEventInventoryBuilt')
    if (result.status !== 'annualPhysicalEventInventoryBuilt') return
    expect(result.compatibility).toEqual({
      status: 'requiresUnifiedAnnualLedger',
      reasons: ['runtimePhysicalActivityPresent'],
    })
  })
})
