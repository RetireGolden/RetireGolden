import { describe, expect, it } from 'vitest'

import type {
  OrdinaryWithdrawalExecutionEvidence,
  OrdinaryWithdrawalExecutionScheduleIssue,
} from '../actions/execution.js'
import { asAccountId, asActionId, asAllocationId } from '../actions/identity.js'
import { asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { RetirementActionRequest } from '../actions/contract.js'
import {
  ordinaryWithdrawalPublicationSource,
  publishAnnualRetirementActions,
} from '../actions/annualRetirementActionPublication.js'
import { createActionReason, type ActionReason } from '../actions/reasons.js'
import type { YearResult } from '../projection/types.js'
import {
  compareScenarioActionRows,
  normalizeScenarioActionScheduleDiagnostics,
  normalizeScenarioActionRows,
} from './actionRows.js'

type EvidenceInput = Readonly<{
  actionId: string
  kind?: string
  year?: number
  personId?: string | null
  request?: Readonly<Record<string, unknown>>
  requestedAmountCents?: number
  executedAmountCents?: number
  outcome?: 'executed' | 'partial' | 'refused' | 'unsupported'
  allocations?: readonly Readonly<{
    allocationId: string
    sourceAccountId: string
    requestedAmountCents: number
    executedAmountCents: number
  }>[]
  reasons?: readonly Readonly<ActionReason>[]
}>

function executionEvidence(input: EvidenceInput): OrdinaryWithdrawalExecutionEvidence {
  const requestedAmount = input.requestedAmountCents ?? 10_000
  const executedAmount = input.executedAmountCents ?? requestedAmount
  const outcome = input.outcome ?? 'executed'
  const readiness = outcome === 'executed' || outcome === 'partial'
    ? 'actionable'
    : 'nonActionable'
  const kind = input.kind ?? 'ordinaryWithdrawal'
  const personId = input.personId === undefined ? 'person-1' : input.personId
  const requestedAllocations = (input.allocations ?? []).map((allocation) => ({
    allocationId: allocation.allocationId,
    sourceAccountId: allocation.sourceAccountId,
    requestedAmount: allocation.requestedAmountCents,
  }))
  const request = input.request ?? {
    actionId: input.actionId,
    kind,
    year: input.year ?? 2030,
    executionSequence: 1,
    requestedAmount,
    provenance: { source: 'manual' },
    ...(kind === 'ordinaryWithdrawal'
      ? { personId, allocations: requestedAllocations, purpose: { kind: 'spending' } }
      : {}),
  }

  return {
    request,
    actionId: input.actionId,
    kind,
    personId,
    year: input.year ?? 2030,
    scheduledDate: null,
    scheduledSequence: 1,
    requestedAmount,
    provenance: { source: 'manual' },
    purpose: null,
    allocations: (input.allocations ?? []).map((allocation) => ({
      allocationId: allocation.allocationId,
      sourceAccountId: allocation.sourceAccountId,
      requestedAmount: allocation.requestedAmountCents,
      balanceBefore: null,
      executedAmount: allocation.executedAmountCents,
      unexecutedAmount:
        allocation.requestedAmountCents - allocation.executedAmountCents,
      balanceAfter: null,
      resolution: 'unresolved',
      ownerPersonIds: null,
      actingPersonId: null,
    })),
    readiness,
    executedDate: readiness === 'actionable' ? '2030-12-31' : null,
    executedSequence: readiness === 'actionable' ? 1 : null,
    disposition: {
      outcome,
      readiness,
      requestedAmount,
      executedAmount,
      unexecutedAmount: requestedAmount - executedAmount,
      reasons: input.reasons ?? [],
    },
    taxCharacter: [],
    penalty: [],
  } as unknown as OrdinaryWithdrawalExecutionEvidence
}

function yearResult(
  year: number,
  evidence: readonly OrdinaryWithdrawalExecutionEvidence[],
  scheduleIssues: NonNullable<YearResult['retirementActionExecution']>['scheduleIssues'] = [],
  requests: readonly Readonly<RetirementActionRequest>[] = [],
): YearResult {
  return {
    year,
    retirementActionExecution: {
      committed: scheduleIssues.length === 0,
      requests,
      scheduleIssues,
      balances: [],
      taxableBases: [],
      evidence,
    },
  } as unknown as YearResult
}

describe('normalizeScenarioActionRows', () => {
  it('normalizes ordinary execution cents and identities independent of evidence order', () => {
    const actionA = executionEvidence({
      actionId: 'action-a',
      requestedAmountCents: 12_345,
      executedAmountCents: 12_345,
      allocations: [
        {
          allocationId: 'allocation-z',
          sourceAccountId: 'source-z',
          requestedAmountCents: 10_000,
          executedAmountCents: 10_000,
        },
        {
          allocationId: 'allocation-a',
          sourceAccountId: 'source-a',
          requestedAmountCents: 2_345,
          executedAmountCents: 2_345,
        },
      ],
    })
    const actionB = executionEvidence({ actionId: 'action-b' })

    const forward = normalizeScenarioActionRows([yearResult(2030, [actionB, actionA])])
    const reversed = normalizeScenarioActionRows([
      yearResult(2030, [
        actionA,
        actionB,
      ]),
    ])

    expect(forward).toEqual(reversed)
    expect(forward.map((row) => row.actionId)).toEqual(['action-a', 'action-b'])
    expect(forward[0]).toMatchObject({
      personId: 'person-1',
      requestedAmountCents: 12_345,
      executedAmountCents: 12_345,
      unexecutedAmountCents: 0,
      readiness: 'actionable',
      outcome: 'executed',
    })
    expect(forward[0]?.sourceAllocations).toEqual([
      {
        allocationId: 'allocation-z',
        sourceAccountId: 'source-z',
        resolution: 'unresolved',
        requestedAmountCents: 10_000,
        executedAmountCents: 10_000,
        unexecutedAmountCents: 0,
      },
      {
        allocationId: 'allocation-a',
        sourceAccountId: 'source-a',
        resolution: 'unresolved',
        requestedAmountCents: 2_345,
        executedAmountCents: 2_345,
        unexecutedAmountCents: 0,
      },
    ])
    expect(forward[0]?.sourceAllocations).not.toBe(actionA.allocations)
  })

  it('reads rows and schedule diagnostics from the canonical annual publication', () => {
    const action = executionEvidence({
      actionId: 'published-action',
      allocations: [{
        allocationId: 'published-allocation',
        sourceAccountId: 'published-source',
        requestedAmountCents: 10_000,
        executedAmountCents: 0,
      }],
    })
    const peer = executionEvidence({
      actionId: 'published-peer',
      allocations: [{
        allocationId: 'peer-allocation',
        sourceAccountId: 'peer-source',
        requestedAmountCents: 10_000,
        executedAmountCents: 0,
      }],
    })
    const conflict: OrdinaryWithdrawalExecutionScheduleIssue = {
      kind: 'executionSequenceConflict',
      year: 2030,
      scheduledDate: null,
      executionSequence: 1,
      collidingActionIds: [
        asActionId('published-action'),
        asActionId('published-peer'),
      ],
      reason: createActionReason('action-sequence-conflict'),
    }
    const legacyYear = yearResult(
      2030,
      [],
      [conflict],
      [action.request, peer.request],
    )
    const execution = legacyYear.retirementActionExecution!
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: execution.requests,
      sources: [ordinaryWithdrawalPublicationSource(execution)],
    })
    const yearWithoutLegacy = structuredClone(legacyYear)
    delete yearWithoutLegacy.retirementActionExecution
    const publishedYear = {
      ...yearWithoutLegacy,
      retirementActionPublication: publication,
    } as YearResult

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [],
      sources: [],
    }))
      .toBeUndefined()
    expect(normalizeScenarioActionRows([publishedYear]))
      .toEqual(normalizeScenarioActionRows([legacyYear]))
    expect(normalizeScenarioActionScheduleDiagnostics([publishedYear]))
      .toEqual(normalizeScenarioActionScheduleDiagnostics([legacyYear]))

    const canonicalSupersetYear = {
      ...legacyYear,
      retirementActionExecution: {
        ...execution,
        requests: [action.request],
      },
      retirementActionPublication: publication,
    } as YearResult
    expect(normalizeScenarioActionRows([canonicalSupersetYear])).toHaveLength(2)

    expect(() => normalizeScenarioActionRows([{
      ...publishedYear,
      year: 2031,
    }])).toThrow(/different annual result/i)

    const staleLegacyYear = {
      ...legacyYear,
      retirementActionExecution: {
        ...execution,
        requests: [{
          ...action.request,
          requestedAmount: asPositiveUsdCents(10_001),
        }],
      },
      retirementActionPublication: publication,
    } as YearResult
    expect(() => normalizeScenarioActionRows([staleLegacyYear]))
      .toThrow(/does not cover the legacy/i)

    const staleScheduleYear = {
      ...legacyYear,
      retirementActionExecution: {
        ...execution,
        scheduleIssues: [{
          ...conflict,
          executionSequence: 2,
        }],
      },
      retirementActionPublication: publication,
    } as YearResult
    expect(() => normalizeScenarioActionRows([staleScheduleYear]))
      .toThrow(/does not cover the legacy/i)

    const executedRaw = executionEvidence({
      actionId: 'stale-execution',
      allocations: [{
        allocationId: 'stale-allocation',
        sourceAccountId: 'stale-source',
        requestedAmountCents: 10_000,
        executedAmountCents: 10_000,
      }],
    })
    const executed = {
      ...executedRaw,
      allocations: executedRaw.allocations.map((allocation) => ({
        ...allocation,
        resolution: 'resolved' as const,
      })),
    } as unknown as OrdinaryWithdrawalExecutionEvidence
    const executedYear = yearResult(2030, [executed], [], [executed.request])
    const executedPublication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: executedYear.retirementActionExecution!.requests,
      sources: [ordinaryWithdrawalPublicationSource(
        executedYear.retirementActionExecution!,
      )],
    })
    const staleEvidence = {
      ...executed,
      allocations: executed.allocations.map((allocation) => ({
        ...allocation,
        executedAmount: asUsdCents(9_000),
        unexecutedAmount: asUsdCents(1_000),
      })),
      disposition: {
        outcome: 'partial' as const,
        readiness: 'actionable' as const,
        requestedAmount: asPositiveUsdCents(10_000),
        executedAmount: asUsdCents(9_000),
        unexecutedAmount: asUsdCents(1_000),
        reasons: [createActionReason('source-balance-trimmed', {
          accountId: asAccountId('stale-source'),
          allocationId: asAllocationId('stale-allocation'),
        })],
      },
    } as unknown as OrdinaryWithdrawalExecutionEvidence
    expect(() => normalizeScenarioActionRows([{
      ...executedYear,
      retirementActionExecution: {
        ...executedYear.retirementActionExecution!,
        evidence: [staleEvidence],
      },
      retirementActionPublication: executedPublication,
    }])).toThrow(/does not cover the legacy/i)
  })

  it('preserves exact partial cents and complete trim reason objects without aliasing', () => {
    const reason = createActionReason('source-balance-trimmed', {
      accountId: asAccountId('source-a'),
      allocationId: asAllocationId('allocation-a'),
    })
    const evidence = executionEvidence({
      actionId: 'partial-action',
      requestedAmountCents: 10_001,
      executedAmountCents: 7_777,
      outcome: 'partial',
      reasons: [reason],
    })

    const row = normalizeScenarioActionRows([yearResult(2030, [evidence])])[0]!
    expect(row).toMatchObject({
      requestedAmountCents: 10_001,
      executedAmountCents: 7_777,
      unexecutedAmountCents: 2_224,
      readiness: 'actionable',
      outcome: 'partial',
    })
    expect(row.reasons).toEqual([reason])
    expect(row.reasons[0]).not.toBe(reason)
  })

  it.each([
    {
      outcome: 'refused' as const,
      reason: createActionReason('source-account-not-found', {
        accountId: asAccountId('missing'),
      }),
    },
    {
      outcome: 'unsupported' as const,
      reason: createActionReason('withdrawal-aggregate-unallocated'),
    },
  ])('preserves complete $outcome diagnostics', ({ outcome, reason }) => {
    const row = normalizeScenarioActionRows([
      yearResult(2030, [executionEvidence({
        actionId: `${outcome}-action`,
        outcome,
        executedAmountCents: 0,
        reasons: [reason],
      })]),
    ])[0]!

    expect(row.readiness).toBe('nonActionable')
    expect(row.outcome).toBe(outcome)
    expect(row.reasons).toEqual([reason])
  })

  it('extracts conversion destination and QCD donor/charity identities even while non-actionable', () => {
    const conversion = executionEvidence({
      actionId: 'conversion',
      kind: 'rothConversion',
      personId: 'person-converting',
      outcome: 'unsupported',
      executedAmountCents: 0,
      reasons: [createActionReason('conversion-aggregate-unallocated')],
      allocations: [{
        allocationId: 'conversion-allocation',
        sourceAccountId: 'conversion-source',
        requestedAmountCents: 10_000,
        executedAmountCents: 0,
      }],
      request: {
        actionId: 'conversion',
        kind: 'rothConversion',
        year: 2030,
        executionSequence: 1,
        requestedAmount: 10_000,
        provenance: { source: 'manual' },
        personId: 'person-converting',
        allocations: [],
        destinationRothAccountId: 'roth-destination',
        taxFunding: { kind: 'noneExpected' },
      },
    })
    const qcd = executionEvidence({
      actionId: 'qcd',
      kind: 'qcd',
      personId: 'person-donor',
      outcome: 'unsupported',
      executedAmountCents: 0,
      reasons: [createActionReason('qcd-aggregate-unallocated')],
      allocations: [{
        allocationId: 'qcd-allocation',
        sourceAccountId: 'qcd-source',
        requestedAmountCents: 10_000,
        executedAmountCents: 0,
      }],
      request: {
        actionId: 'qcd',
        kind: 'qcd',
        year: 2030,
        executionSequence: 2,
        requestedAmount: 10_000,
        provenance: { source: 'manual' },
        donorPersonId: 'person-donor',
        allocation: {
          allocationId: 'qcd-allocation',
          sourceAccountId: 'qcd-source',
          requestedAmount: 10_000,
        },
        charity: {
          designationId: 'charity-designation',
          name: 'Charity',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
      },
    })

    const rows = normalizeScenarioActionRows([yearResult(2030, [qcd, conversion])])
    expect(rows[0]).toMatchObject({
      actionId: 'conversion',
      personId: 'person-converting',
      destinationAccountId: 'roth-destination',
      charityDesignationId: null,
      sourceAllocations: [expect.objectContaining({
        allocationId: 'conversion-allocation',
        sourceAccountId: 'conversion-source',
      })],
    })
    expect(rows[1]).toMatchObject({
      actionId: 'qcd',
      personId: 'person-donor',
      destinationAccountId: null,
      charityDesignationId: 'charity-designation',
      sourceAllocations: [expect.objectContaining({
        allocationId: 'qcd-allocation',
        sourceAccountId: 'qcd-source',
      })],
    })
  })

  it('represents legacy evidence without inventing person, source, or destination identity', () => {
    const legacy = executionEvidence({
      actionId: 'legacy',
      kind: 'legacyAggregateWithdrawal',
      personId: null,
      outcome: 'unsupported',
      executedAmountCents: 0,
      reasons: [createActionReason('withdrawal-aggregate-unallocated')],
      request: {
        actionId: 'legacy',
        kind: 'legacyAggregateWithdrawal',
        year: 2030,
        requestedAmount: 10_000,
        legacyCategory: 'traditional',
        provenance: { source: 'migration' },
      },
    })

    expect(normalizeScenarioActionRows([yearResult(2030, [legacy])])[0]).toMatchObject({
      personId: null,
      destinationAccountId: null,
      charityDesignationId: null,
      sourceAllocations: [],
    })
  })

  it('fails closed instead of overwriting duplicate action IDs', () => {
    const duplicate = executionEvidence({ actionId: 'duplicate' })
    expect(() => normalizeScenarioActionRows([
      yearResult(2030, [duplicate]),
      yearResult(2031, [{ ...duplicate, year: 2031 }]),
    ])).toThrow('Duplicate retirement-action execution evidence')
  })

  it('fails closed when a schedule-aborted request has no published typed refusal reason', () => {
    const request: RetirementActionRequest = {
      actionId: asActionId('wrong-year'),
      kind: 'ordinaryWithdrawal',
      personId: asPersonId('person-1'),
      year: 2031,
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(100),
      allocations: [{
        allocationId: asAllocationId('wrong-year-allocation'),
        sourceAccountId: asAccountId('cash'),
        requestedAmount: asPositiveUsdCents(100),
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    }
    const mismatch: OrdinaryWithdrawalExecutionScheduleIssue = {
      kind: 'actionYearMismatch',
      actionId: request.actionId,
      expectedYear: 2030,
      actualYear: 2031,
    }

    expect(() => normalizeScenarioActionRows([
      yearResult(2030, [], [mismatch], [request]),
    ])).toThrow(
      'Cannot normalize schedule-aborted retirement action: actionYearMismatch has no published typed refusal reason',
    )
  })
})

describe('compareScenarioActionRows', () => {
  it('aligns by action ID rather than position and preserves one-sided/year-changed rows', () => {
    const baseline = [yearResult(2030, [
      executionEvidence({ actionId: 'shared', year: 2030 }),
      executionEvidence({ actionId: 'baseline-only', year: 2030 }),
    ])]
    const proposal = [yearResult(2031, [
      executionEvidence({ actionId: 'proposal-only', year: 2031 }),
      executionEvidence({ actionId: 'shared', year: 2031 }),
    ])]

    const rows = compareScenarioActionRows(baseline, proposal)
    expect(rows.map((row) => row.actionId)).toEqual([
      'baseline-only',
      'proposal-only',
      'shared',
    ])
    expect(rows[0]).toMatchObject({ baseline: { year: 2030 }, proposal: null })
    expect(rows[1]).toMatchObject({ baseline: null, proposal: { year: 2031 } })
    expect(rows[2]).toMatchObject({
      baseline: { actionId: 'shared', year: 2030 },
      proposal: { actionId: 'shared', year: 2031 },
    })
  })

  it('retains empty-evidence schedule collisions as one diagnostic per action', () => {
    const reason = createActionReason('action-sequence-conflict')
    const issue: OrdinaryWithdrawalExecutionScheduleIssue = {
      kind: 'executionSequenceConflict',
      year: 2030,
      scheduledDate: '2030-06-01',
      executionSequence: 1,
      collidingActionIds: [asActionId('action-b'), asActionId('action-a')],
      reason,
    }
    const request = (actionId: string, allocationId: string): RetirementActionRequest => ({
      actionId: asActionId(actionId),
      kind: 'ordinaryWithdrawal',
      personId: asPersonId('person-1'),
      year: 2030,
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(101),
      allocations: [{
        allocationId: asAllocationId(allocationId),
        sourceAccountId: asAccountId('cash'),
        requestedAmount: asPositiveUsdCents(101),
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })
    const years = [yearResult(2030, [], [issue], [
      request('action-b', 'allocation-b'),
      request('action-a', 'allocation-a'),
    ])]

    const diagnostics = normalizeScenarioActionScheduleDiagnostics(years)
    expect(diagnostics).toEqual([
      {
        kind: 'executionSequenceConflict',
        actionId: 'action-a',
        year: 2030,
        scheduledDate: '2030-06-01',
        executionSequence: 1,
        collidingActionIds: ['action-b', 'action-a'],
        reason,
      },
      {
        kind: 'executionSequenceConflict',
        actionId: 'action-b',
        year: 2030,
        scheduledDate: '2030-06-01',
        executionSequence: 1,
        collidingActionIds: ['action-b', 'action-a'],
        reason,
      },
    ])
    expect(diagnostics[0]?.kind).toBe('executionSequenceConflict')
    if (diagnostics[0]?.kind !== 'executionSequenceConflict') {
      throw new Error('expected executionSequenceConflict diagnostic')
    }
    expect(diagnostics[0].reason).not.toBe(reason)

    const compared = compareScenarioActionRows(years, [])
    expect(compared.map((row) => row.actionId)).toEqual(['action-a', 'action-b'])
    expect(compared[0]).toMatchObject({
      baseline: {
        actionId: 'action-a',
        personId: 'person-1',
        requestedAmountCents: 101,
        executedAmountCents: 0,
        unexecutedAmountCents: 101,
        outcome: 'refused',
        reasons: [{ code: 'action-sequence-conflict' }],
        sourceAllocations: [{
          allocationId: 'allocation-a',
          sourceAccountId: 'cash',
          resolution: 'unresolved',
          requestedAmountCents: 101,
          executedAmountCents: 0,
          unexecutedAmountCents: 101,
        }],
      },
      proposal: null,
      baselineScheduleDiagnostics: [{ actionId: 'action-a' }],
      proposalScheduleDiagnostics: [],
    })
    expect(() => normalizeScenarioActionRows([
      yearResult(2030, [], [issue], [
        request('action-a', 'allocation-a'),
        request('action-a', 'allocation-a-copy'),
      ]),
    ])).toThrow('Duplicate retirement-action published request')
  })
})
