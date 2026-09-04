import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import {
  allocateRetirementActionCandidateIdentity,
  type OrdinaryWithdrawalCandidateIdentityIntent,
  type RothConversionCandidateIdentityIntent,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import {
  createDecisionContext,
  planForCandidate,
  retirementActionReadinessDiagnostic,
} from './evaluateCandidate.js'
import { simpleRothConversionGenerator } from './generators.js'
import {
  adaptFillTargetRothConversionGeneratorCandidate,
} from './rothConversionCandidateAdapter.js'
import { runDecisionTournament } from './tournament.js'
import type {
  CurrentRetirementActionCandidateRequest,
} from './retirementActionCandidateSchedule.js'
import type { DecisionCandidate } from './types.js'

function ownedRoth(id: string, ownerPersonId = 'p1'): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function planWithConversionAccounts(): Plan {
  const plan = singlePersonPlan({ planningAge: 95 })
  plan.accounts = [
    { ...cashAccount('cash-a', 100_000), ownerPersonId: 'p1' },
    traditionalAccount('trad-a', 500_000),
    ownedRoth('roth-a'),
  ]
  return plan
}

function exploratoryCandidate(
  plan: Plan,
  withMetadata = false,
): DecisionCandidate {
  const candidate = simpleRothConversionGenerator
    .generate(createDecisionContext(plan, simOptions()))
    .find((entry) => entry.id === 'bracket-12')
  if (candidate === undefined) throw new Error('expected bracket-12 candidate')
  return withMetadata
    ? {
        ...candidate,
        metadata: {
          decisionRule: 'fill-target-materialization',
          exactLedgerRunId: 'ledger-run-a',
        },
      }
    : candidate
}

function conversionIntent(
  candidateId = 'bracket-12',
  overrides: Partial<RothConversionCandidateIdentityIntent> = {},
): RothConversionCandidateIdentityIntent {
  return {
    kind: 'rothConversion',
    year: 2027,
    executionDate: '2027-09-15',
    executionSequence: 2,
    requestedAmount: asPositiveUsdCents(5_000_00),
    personId: asPersonId('p1'),
    provenance: {
      source: 'generator',
      sourceId: candidateId,
      scenarioId: 'scenario-a',
    },
    sourceAllocations: [{
      sourceAccountId: asAccountId('trad-a'),
      requestedAmount: asPositiveUsdCents(5_000_00),
    }],
    destinationRothAccountId: asAccountId('roth-a'),
    taxFunding: { kind: 'noneExpected' },
    ...overrides,
  }
}

function currentOrdinaryIntent(): OrdinaryWithdrawalCandidateIdentityIntent {
  return {
    kind: 'ordinaryWithdrawal',
    year: 2026,
    executionDate: '2026-06-15',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(1_000_00),
    personId: asPersonId('p1'),
    provenance: { source: 'manual' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('cash-a'),
      requestedAmount: asPositiveUsdCents(1_000_00),
    }],
    purpose: { kind: 'spending' },
  }
}

function candidateSchedule(
  result: ReturnType<typeof adaptFillTargetRothConversionGeneratorCandidate>,
): CurrentRetirementActionCandidateRequest[] {
  expect(result.status).toBe('adapted')
  if (result.status !== 'adapted') throw new Error('expected adapted candidate')
  const strategies = result.candidate.planPatch?.['strategies'] as {
    retirementActions: CurrentRetirementActionCandidateRequest[]
  }
  return strategies.retirementActions
}

describe('fill-target Roth conversion candidate adapter', () => {
  it('materializes exact dated identities, suppresses aggregate conversion, and preserves candidate provenance', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan, true)
    const first = conversionIntent(exploratory.id)
    const second = conversionIntent(exploratory.id, {
      year: 2028,
      executionDate: '2028-10-01',
      executionSequence: 3,
      requestedAmount: asPositiveUsdCents(7_500_00),
      sourceAllocations: [{
        sourceAccountId: asAccountId('trad-a'),
        requestedAmount: asPositiveUsdCents(7_500_00),
      }],
      taxFunding: {
        kind: 'externalCash',
        amount: asPositiveUsdCents(1_500_00),
        attested: true,
      },
    })

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [first, second],
    )

    expect(result.status).toBe('adapted')
    if (result.status !== 'adapted') return
    expect(result.candidate).toMatchObject({
      source: exploratory.source,
      category: exploratory.category,
      label: `Explicit schedule after exploring: ${exploratory.label}`,
      explanation:
        'Caller-supplied dated conversion requests adapted after exploring bracket-12; ' +
        'the fill-target strategy is context only and does not certify these amounts.',
      retirementActionReadiness: { state: 'identityComplete' },
    })
    expect(result.candidate.id).toMatch(/^retirement-action-fill-target-candidate:/)
    expect(result.candidate.id).not.toBe(exploratory.id)
    expect(result.candidate.metadata).toBeUndefined()
    expect(result.candidate.conversions).toBeUndefined()
    const strategies = result.candidate.planPatch?.['strategies'] as Record<string, unknown>
    expect(Object.keys(strategies)).toEqual(['rothConversion', 'retirementActions'])
    expect(strategies['rothConversion']).toEqual({ mode: 'none' })

    const requests = candidateSchedule(result)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({
      kind: 'rothConversion',
      year: 2027,
      executionDate: '2027-09-15',
      requestedAmount: 5_000_00,
      provenance: first.provenance,
      destinationRothAccountId: 'roth-a',
      taxFunding: { kind: 'noneExpected' },
    })
    expect(requests[1]).toMatchObject({
      kind: 'rothConversion',
      year: 2028,
      executionDate: '2028-10-01',
      requestedAmount: 7_500_00,
      provenance: second.provenance,
      taxFunding: { kind: 'externalCash', amount: 1_500_00, attested: true },
    })
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: requests.map((request) => request.actionId),
    })
    expect(result.identityEvidence).toHaveLength(2)
    expect(result.identityEvidence.map((evidence) => evidence.sourceAccountIds))
      .toEqual([['trad-a'], ['trad-a']])
    const exploratoryStrategies = exploratory.planPatch?.['strategies'] as Record<string, unknown>
    expect(result.exploratorySourceProvenance).toEqual({
      generatorId: 'roth-fill-to-target',
      exploratoryCandidateId: exploratory.id,
      source: 'heuristic',
      category: 'roth',
      relationship: 'callerSuppliedExplicitScheduleAfterExploration',
      strategyContext: exploratoryStrategies['rothConversion'],
      metadataContext: exploratory.metadata,
    })
    expect(retirementActionReadinessDiagnostic(result.candidate)).toBeNull()
  })

  it('canonically orders new requests while preserving the existing schedule prefix', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const later = conversionIntent(exploratory.id, {
      year: 2029,
      executionDate: '2029-10-01',
      executionSequence: 4,
    })
    const earlier = conversionIntent(exploratory.id, {
      year: 2027,
      executionDate: '2027-04-01',
      executionSequence: 2,
      requestedAmount: asPositiveUsdCents(6_000_00),
      sourceAllocations: [{
        sourceAccountId: asAccountId('trad-a'),
        requestedAmount: asPositiveUsdCents(6_000_00),
      }],
    })

    const forward = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [earlier, later],
    )
    const reversed = adaptFillTargetRothConversionGeneratorCandidate(
      { ...plan, accounts: [...plan.accounts].reverse() },
      exploratory,
      [later, earlier],
    )

    expect(reversed).toEqual(forward)
    expect(candidateSchedule(forward).map((action) => action.executionDate))
      .toEqual(['2027-04-01', '2029-10-01'])
  })

  it('derives one order-invariant candidate ID from the concrete action set', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const first = conversionIntent(exploratory.id)
    const second = conversionIntent(exploratory.id, {
      year: 2028,
      executionDate: '2028-10-01',
      executionSequence: 3,
      requestedAmount: asPositiveUsdCents(7_500_00),
      sourceAllocations: [{
        sourceAccountId: asAccountId('trad-a'),
        requestedAmount: asPositiveUsdCents(7_500_00),
      }],
    })

    const forward = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [first, second],
    )
    const reordered = adaptFillTargetRothConversionGeneratorCandidate(
      { ...plan, accounts: [...plan.accounts].reverse() },
      exploratory,
      [second, first],
    )
    const changedByOneCent = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id, {
        requestedAmount: asPositiveUsdCents(5_000_01),
        sourceAllocations: [{
          sourceAccountId: asAccountId('trad-a'),
          requestedAmount: asPositiveUsdCents(5_000_01),
        }],
      }), second],
    )

    expect(forward.status).toBe('adapted')
    expect(reordered.status).toBe('adapted')
    expect(changedByOneCent.status).toBe('adapted')
    if (
      forward.status !== 'adapted' ||
      reordered.status !== 'adapted' ||
      changedByOneCent.status !== 'adapted'
    ) return
    expect(reordered).toEqual(forward)
    expect(changedByOneCent.candidate.id).not.toBe(forward.candidate.id)
    expect(changedByOneCent.exploratorySourceProvenance)
      .toEqual(forward.exploratorySourceProvenance)
  })

  it('gives distinct adaptations deterministic tournament tie-break identities', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const first = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )
    const second = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id, {
        requestedAmount: asPositiveUsdCents(5_000_01),
        sourceAllocations: [{
          sourceAccountId: asAccountId('trad-a'),
          requestedAmount: asPositiveUsdCents(5_000_01),
        }],
      })],
    )
    expect(first.status).toBe('adapted')
    expect(second.status).toBe('adapted')
    if (first.status !== 'adapted' || second.status !== 'adapted') return

    const ctx = createDecisionContext(plan, simOptions())
    const rank = (candidates: DecisionCandidate[]) => runDecisionTournament(
      ctx,
      [{ id: 'adapted-fill-targets', generate: () => candidates }],
    ).ranked.map((row) => row.evaluation.candidate.id)
    const forward = rank([first.candidate, second.candidate])
    const reversed = rank([second.candidate, first.candidate])

    expect(new Set(forward).size).toBe(2)
    expect(reversed).toEqual(forward)
    expect(forward).toEqual([...forward].sort())
  })

  it('binds request provenance into deterministic tournament tie-break identities', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const first = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )
    const second = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id, {
        provenance: {
          source: 'generator',
          sourceId: exploratory.id,
          scenarioId: 'scenario-b',
        },
      })],
    )
    expect(first.status).toBe('adapted')
    expect(second.status).toBe('adapted')
    if (first.status !== 'adapted' || second.status !== 'adapted') return

    const firstAction = candidateSchedule(first)[0]!
    const secondAction = candidateSchedule(second)[0]!
    expect(secondAction.actionId).toBe(firstAction.actionId)
    expect(secondAction.provenance).not.toEqual(firstAction.provenance)
    expect(second.candidate.id).not.toBe(first.candidate.id)

    const ctx = createDecisionContext(plan, simOptions())
    const rank = (candidates: DecisionCandidate[]) => runDecisionTournament(
      ctx,
      [{ id: 'provenance-distinct-fill-targets', generate: () => candidates }],
    ).ranked.map((row) => row.evaluation.candidate.id)
    const forward = rank([first.candidate, second.candidate])
    const reversed = rank([second.candidate, first.candidate])

    expect(new Set(forward).size).toBe(2)
    expect(reversed).toEqual(forward)
    expect(forward).toEqual([...forward].sort())
  })

  it('preserves whole-horizon, windowed, IRMAA, and ACA generator provenance', () => {
    const plan = planWithConversionAccounts()
    const ctx = createDecisionContext(plan, simOptions())
    ctx.baselineResult.years[0]!.aca = { readiness: 'actionable' } as never
    const generated = simpleRothConversionGenerator.generate(ctx)
    const candidates = [
      generated.find((candidate) => candidate.id === 'bracket-12'),
      generated.find((candidate) => candidate.id.startsWith('bracket-12-until-')),
      generated.find((candidate) => candidate.id === 'irmaa-tier-1-cap'),
      generated.find((candidate) => candidate.id === 'aca-cliff-cap'),
    ]
    expect(candidates.every((candidate) => candidate !== undefined)).toBe(true)

    for (const candidate of candidates) {
      if (candidate === undefined) throw new Error('expected generator variant')
      const strategy = (candidate.planPatch?.['strategies'] as {
        rothConversion: { startYear: number }
      }).rothConversion
      const year = strategy.startYear
      const result = adaptFillTargetRothConversionGeneratorCandidate(
        plan,
        candidate,
        [conversionIntent(candidate.id, {
          year,
          executionDate: `${year}-09-15`,
        })],
      )

      expect(result.status).toBe('adapted')
      if (result.status !== 'adapted') continue
      expect(result.candidate).toMatchObject({
        category: candidate.category,
        label: `Explicit schedule after exploring: ${candidate.label}`,
      })
      expect(result.candidate.id).not.toBe(candidate.id)
      expect(result.exploratorySourceProvenance).toMatchObject({
        generatorId: 'roth-fill-to-target',
        exploratoryCandidateId: candidate.id,
        category: candidate.category,
        relationship: 'callerSuppliedExplicitScheduleAfterExploration',
        strategyContext: strategy,
      })
    }
  })

  it('byte-preserves the complete current schedule and certifies only the new request IDs', () => {
    const plan = planWithConversionAccounts()
    const current = allocateRetirementActionCandidateIdentity(
      plan,
      currentOrdinaryIntent(),
    )
    expect(current.status).toBe('allocated')
    if (current.status !== 'allocated') return
    plan.strategies.retirementActions = [current.request, {
      actionId: asActionId('current-qcd'),
      kind: 'qcd',
      year: 2026,
      executionDate: '2026-12-01',
      executionSequence: 4,
      requestedAmount: asPositiveUsdCents(2_000_00),
      provenance: { source: 'manual' },
      donorPersonId: asPersonId('p1'),
      allocation: {
        allocationId: asAllocationId('current-qcd-allocation'),
        sourceAccountId: asAccountId('trad-a'),
        requestedAmount: asPositiveUsdCents(2_000_00),
      },
      charity: {
        designationId: 'charity-a',
        name: 'Eligible Charity',
        designationKind: 'eligiblePublicCharity',
        directFromCustodianAttested: true,
        eligibleOrganizationAttested: true,
        notDonorAdvisedFundOrSupportingOrganizationAttested: true,
        notSplitInterestEntityAttested: true,
        entireDistributionOtherwiseDeductibleAttested: true,
      },
    }]
    const scheduleBefore = plan.strategies.retirementActions
    const bytesBefore = JSON.stringify(scheduleBefore)
    const exploratory = exploratoryCandidate(plan)

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )

    const patched = candidateSchedule(result)
    expect(JSON.stringify(patched.slice(0, -1))).toBe(bytesBefore)
    expect(patched[0]).toEqual(scheduleBefore[0])
    expect(patched[1]).toEqual(scheduleBefore[1])
    if (result.status !== 'adapted') return
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [patched.at(-1)!.actionId],
    })
    expect(retirementActionReadinessDiagnostic(result.candidate, plan)).toBeNull()
  })

  it('allocates against the rolling schedule and blocks a later deterministic identity collision', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const repeated = conversionIntent(exploratory.id)

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [repeated, repeated],
    )

    expect(result.status).toBe('blocked')
    if (result.status !== 'blocked') return
    expect(result.candidate).toBeNull()
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'generatedIdentityCollision',
        field: 'intents.1.actionId',
      }),
    ]))
  })

  it.each([
    ['missing date', { executionDate: undefined }, 'intents.0.executionDate'],
    ['invalid date', { executionDate: '2027-02-29' }, 'intents.0.executionDate'],
    ['date in another year', { executionDate: '2028-01-01' }, 'intents.0.executionDate'],
    ['year outside target window', { year: 1900, executionDate: '1900-01-01' }, 'intents.0.year'],
    ['wrong provenance source', { provenance: { source: 'optimizer', sourceId: 'bracket-12' } }, 'intents.0.provenance'],
    ['wrong provenance ID', { provenance: { source: 'generator', sourceId: 'bracket-22' } }, 'intents.0.provenance'],
    ['linked-withdrawal funding', { taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'withdrawal-a' } }, 'intents.0.taxFunding'],
    ['principal withholding', { taxFunding: { kind: 'conversionPrincipalWithholding', amount: 1_000 } }, 'intents.0.taxFunding'],
  ])('blocks %s without inferring replacement facts', (_label, override, field) => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id, override as Partial<RothConversionCandidateIdentityIntent>)],
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{ kind: 'invalidConversionIntent', field }],
    })
  })

  it.each([
    ['explicit conversions', (candidate: DecisionCandidate) => ({ ...candidate, conversions: [{ year: 2027, amount: 5_000 }] })],
    ['non-generator source', (candidate: DecisionCandidate) => ({ ...candidate, source: 'milp' as const })],
    ['extra strategy arm', (candidate: DecisionCandidate) => ({
      ...candidate,
      planPatch: {
        strategies: {
          ...(candidate.planPatch?.['strategies'] as object),
          qcdAnnual: 0,
        },
      },
    })],
    ['altered readiness reason', (candidate: DecisionCandidate) => ({
      ...candidate,
      retirementActionReadiness: {
        state: 'exploratoryNonActionable' as const,
        reason: 'trust me',
      },
    })],
    ['counterfeit display provenance', (candidate: DecisionCandidate) => ({
      ...candidate,
      label: '',
      explanation: '',
    })],
  ])('rejects a %s candidate rather than broadening the adapter seam', (_label, alter) => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      alter(exploratory),
      [conversionIntent(exploratory.id)],
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{ kind: 'invalidExploratoryCandidate' }],
    })
  })

  it('blocks legacy, duplicate, and runtime-hostile preserved schedules', () => {
    const cases: unknown[] = [
      null,
      [{ kind: 'rothConversion' }],
      [{
        actionId: 'legacy-conversion',
        kind: 'legacyAggregateRothConversion',
        year: 2026,
        requestedAmount: 500_000,
        provenance: { source: 'migration', sourceId: 'legacy-import' },
        legacyDestinationCategory: 'roth',
      }],
    ]
    for (const retirementActions of cases) {
      const plan = planWithConversionAccounts()
      ;(plan.strategies as { retirementActions: unknown }).retirementActions = retirementActions
      const exploratory = exploratoryCandidate({
        ...plan,
        strategies: { ...plan.strategies, retirementActions: [] },
      } as Plan)
      const result = adaptFillTargetRothConversionGeneratorCandidate(
        plan,
        exploratory,
        [conversionIntent(exploratory.id)],
      )
      expect(result).toMatchObject({ status: 'blocked', candidate: null })
    }

    const duplicatePlan = planWithConversionAccounts()
    const current = allocateRetirementActionCandidateIdentity(
      duplicatePlan,
      currentOrdinaryIntent(),
    )
    expect(current.status).toBe('allocated')
    if (current.status !== 'allocated') return
    duplicatePlan.strategies.retirementActions = [current.request, current.request]
    const exploratory = exploratoryCandidate({
      ...duplicatePlan,
      strategies: { ...duplicatePlan.strategies, retirementActions: [] },
    })
    const result = adaptFillTargetRothConversionGeneratorCandidate(
      duplicatePlan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )
    expect(result).toMatchObject({
      status: 'blocked',
      issues: [{
        kind: 'invalidRetirementActionSchedule',
        field: 'plan.strategies.retirementActions.1.actionId',
      }],
    })
  })

  it('is mutation-free and repeatable, and its candidate materializes with only the explicit conversion requests active', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan, true)
    const inputIntent = conversionIntent(exploratory.id)
    const planBefore = structuredClone(plan)
    const candidateBefore = structuredClone(exploratory)
    const intentBefore = structuredClone(inputIntent)

    const first = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [inputIntent],
    )
    const second = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [inputIntent],
    )

    expect(second).toEqual(first)
    expect(plan).toEqual(planBefore)
    expect(exploratory).toEqual(candidateBefore)
    expect(inputIntent).toEqual(intentBefore)
    if (first.status !== 'adapted') throw new Error('expected adapted candidate')
    const built = planForCandidate(plan, first.candidate)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.plan.strategies.rothConversion).toEqual({ mode: 'none' })
    expect(built.plan.strategies.retirementActions).toEqual(candidateSchedule(first))
    expect(built.plan.strategies.withdrawalOrder).toEqual(plan.strategies.withdrawalOrder)
  })

  it('blocks an exact date/sequence conflict instead of inventing a new slot', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const first = conversionIntent(exploratory.id)
    const conflicting = conversionIntent(exploratory.id, {
      requestedAmount: asPositiveUsdCents(6_000_00),
      sourceAllocations: [{
        sourceAccountId: asAccountId('trad-a'),
        requestedAmount: asPositiveUsdCents(6_000_00),
      }],
    })

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [first, conflicting],
    )

    expect(result).toMatchObject({
      status: 'blocked',
      candidate: null,
      issues: [{
        kind: 'invalidConversionIntent',
        field: 'plan.strategies.retirementActions.1.executionSequence',
      }],
    })
  })

  it('requires preserved conversions to be dated but keeps undated ordinary slots distinct from dated December 31', () => {
    const invalidPlan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(invalidPlan)
    const undatedConversion = allocateRetirementActionCandidateIdentity(
      invalidPlan,
      conversionIntent(exploratory.id, { executionDate: undefined }),
    )
    expect(undatedConversion.status).toBe('allocated')
    if (undatedConversion.status !== 'allocated') return
    invalidPlan.strategies.retirementActions = [undatedConversion.request]

    const blocked = adaptFillTargetRothConversionGeneratorCandidate(
      invalidPlan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )
    expect(blocked).toMatchObject({
      status: 'blocked',
      issues: [{
        kind: 'invalidRetirementActionSchedule',
        field: 'plan.strategies.retirementActions.0.executionDate',
      }],
    })

    const validPlan = planWithConversionAccounts()
    const validExploratory = exploratoryCandidate(validPlan)
    const undatedOrdinary = allocateRetirementActionCandidateIdentity(
      validPlan,
      {
        ...currentOrdinaryIntent(),
        year: 2027,
        executionDate: undefined,
        executionSequence: 2,
      },
    )
    expect(undatedOrdinary.status).toBe('allocated')
    if (undatedOrdinary.status !== 'allocated') return
    validPlan.strategies.retirementActions = [undatedOrdinary.request]

    const adapted = adaptFillTargetRothConversionGeneratorCandidate(
      validPlan,
      validExploratory,
      [conversionIntent(validExploratory.id, {
        executionDate: '2027-12-31',
        executionSequence: 2,
      })],
    )
    expect(adapted.status).toBe('adapted')
  })

  it('snapshots accessor-backed intents and preserved actions once before validation and allocation', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const current = allocateRetirementActionCandidateIdentity(
      plan,
      currentOrdinaryIntent(),
    )
    expect(current.status).toBe('allocated')
    if (current.status !== 'allocated') return

    let actionIdReads = 0
    const hostileCurrent = { ...current.request }
    Object.defineProperty(hostileCurrent, 'actionId', {
      enumerable: true,
      get: () => {
        actionIdReads += 1
        return actionIdReads === 1
          ? current.request.actionId
          : asActionId('changed-after-validation')
      },
    })
    plan.strategies.retirementActions = [hostileCurrent]

    const baseIntent = conversionIntent(exploratory.id)
    let provenanceReads = 0
    const hostileIntent = { ...baseIntent }
    Object.defineProperty(hostileIntent, 'provenance', {
      enumerable: true,
      get: () => {
        provenanceReads += 1
        return provenanceReads === 1
          ? baseIntent.provenance
          : { source: 'manual' as const }
      },
    })

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [hostileIntent],
    )

    expect(result.status).toBe('adapted')
    if (result.status !== 'adapted') return
    const schedule = candidateSchedule(result)
    expect(actionIdReads).toBe(1)
    expect(provenanceReads).toBe(1)
    expect(schedule[0]!.actionId).toBe(current.request.actionId)
    expect(schedule[1]!.provenance).toEqual(baseIntent.provenance)
    expect(result.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [schedule.at(-1)!.actionId],
    })
  })

  it('permits only a strict mode:none sentinel paired with a complete identity schedule', () => {
    const plan = planWithConversionAccounts()
    const exploratory = exploratoryCandidate(plan)
    const adapted = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      exploratory,
      [conversionIntent(exploratory.id)],
    )
    expect(adapted.status).toBe('adapted')
    if (adapted.status !== 'adapted') return

    const strategies = adapted.candidate.planPatch?.['strategies'] as Record<string, unknown>
    const extraSentinelKey: DecisionCandidate = {
      ...adapted.candidate,
      planPatch: {
        strategies: {
          ...strategies,
          rothConversion: { mode: 'none', conversions: [] },
        },
      },
    }
    const aggregateFill: DecisionCandidate = {
      ...adapted.candidate,
      planPatch: {
        strategies: {
          ...strategies,
          rothConversion: {
            mode: 'fillToTarget',
            target: 'topOfBracket',
            targetValue: 12,
            startYear: 2027,
            endYear: 2030,
          },
        },
      },
    }
    const emptySchedule: DecisionCandidate = {
      ...adapted.candidate,
      planPatch: {
        strategies: {
          rothConversion: { mode: 'none' },
          retirementActions: [],
        },
      },
      retirementActionReadiness: {
        state: 'identityComplete',
        actionRequestIds: [],
      },
    }
    const explicitConversionsWithoutSentinel: DecisionCandidate = {
      ...adapted.candidate,
      planPatch: {
        strategies: {
          retirementActions: candidateSchedule(adapted),
        },
      },
    }

    const ordinary = allocateRetirementActionCandidateIdentity(
      plan,
      currentOrdinaryIntent(),
    )
    expect(ordinary.status).toBe('allocated')
    if (ordinary.status !== 'allocated') return
    const ordinaryOnlyWithoutSentinel: DecisionCandidate = {
      ...adapted.candidate,
      category: 'withdrawal',
      planPatch: {
        strategies: { retirementActions: [ordinary.request] },
      },
      retirementActionReadiness: {
        state: 'identityComplete',
        actionRequestIds: [ordinary.request.actionId],
      },
    }

    expect(retirementActionReadinessDiagnostic(adapted.candidate)).toBeNull()
    expect(retirementActionReadinessDiagnostic(extraSentinelKey)).toContain('strict no-aggregate-conversion sentinel')
    expect(retirementActionReadinessDiagnostic(aggregateFill)).toContain('strict no-aggregate-conversion sentinel')
    expect(retirementActionReadinessDiagnostic(emptySchedule)).toContain('incomplete')
    expect(retirementActionReadinessDiagnostic(explicitConversionsWithoutSentinel)).toContain('require the strict')
    expect(retirementActionReadinessDiagnostic(ordinaryOnlyWithoutSentinel)).toBeNull()
  })

  it('does not accept a lookalike candidate generated outside the simple fill-target contract', () => {
    const unrelated = noTraditionalPlan()
    const exploratory = exploratoryCandidate(unrelated)
    const plan = planWithConversionAccounts()
    const lookalike = {
      ...exploratory,
      id: 'bracket-12-unbounded-copy',
    }

    const result = adaptFillTargetRothConversionGeneratorCandidate(
      plan,
      lookalike,
      [conversionIntent(lookalike.id)],
    )

    expect(result).toMatchObject({
      status: 'blocked',
      issues: [{ kind: 'invalidExploratoryCandidate' }],
    })
  })
})
