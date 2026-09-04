/**
 * Shared exact-ledger evaluator tests (decision engine Phase 1). The theme of
 * every case: candidate logic never re-prices tax effects — ordinary income,
 * capital gains basis, Social Security taxability, contributions, and
 * inherited-IRA rules are all priced by running the candidate through the
 * exact ledger.
 */

import { describe, expect, it } from 'vitest'

import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import { createScenarioPatch } from '../scenarios/patch.js'
import {
  accumulatorPlan,
  inheritedOnlyPlan,
  mixedTraditionalPlan,
  oneTimeIncomePlan,
  simOptions,
  ssTaxabilityPlan,
  taxableBridgePlan,
  tradHeavyPlan,
} from '../testing/decisionFixtures.js'
import { createDecisionContext, evaluateCandidate, planForCandidate } from './evaluateCandidate.js'
import type { DecisionCandidate } from './types.js'

function rothCandidate(overrides: Partial<DecisionCandidate>): DecisionCandidate {
  return {
    id: 'test-candidate',
    source: 'heuristic',
    category: 'roth',
    label: 'Test candidate',
    explanation: 'test',
    ...overrides,
  }
}

function canonicalPatchFor(basePlan: ReturnType<typeof tradHeavyPlan>, editedPlan: ReturnType<typeof tradHeavyPlan>) {
  const result = createScenarioPatch(basePlan, editedPlan, {
    title: 'Decision readiness test',
    rationale: null,
    createdAtIso: '2026-01-01T00:00:00.000Z',
    actor: { kind: 'system', id: 'decision-readiness-test' },
  })
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.patch
}

describe('evaluateCandidate', () => {
  it('makes non-actionable ACA evidence diagnostic on either side of the comparison', () => {
    const plan = tradHeavyPlan()
    const opts = simOptions()
    const safeBaseline = simulatePlan(plan, opts)
    const unsafeCandidate = structuredClone(safeBaseline)
    unsafeCandidate.years[0]!.aca = { readiness: 'nonActionable' } as never
    const candidateSide = evaluateCandidate(
      createDecisionContext(plan, opts, { result: safeBaseline }),
      rothCandidate({}),
      { candidateResult: unsafeCandidate },
    )
    expect(candidateSide.recommendationState).toBe('diagnostic')
    expect(candidateSide.diagnostics.join(' ')).toContain('candidate')

    const unsafeBaseline = structuredClone(safeBaseline)
    unsafeBaseline.years[0]!.aca = { readiness: 'nonActionable' } as never
    const baselineSide = evaluateCandidate(
      createDecisionContext(plan, opts, { result: unsafeBaseline }),
      rothCandidate({}),
      { candidateResult: safeBaseline },
    )
    expect(baselineSide.recommendationState).toBe('diagnostic')
    expect(baselineSide.diagnostics.join(' ')).toContain('baseline')
  })

  it('prices untagged aggregate retirement-action patches but fails closed on recommendation', () => {
    const plan = tradHeavyPlan()
    const opts = simOptions()
    const ctx = createDecisionContext(plan, opts)
    const patch = {
      strategies: {
        rothConversion: {
          mode: 'fillToTarget',
          target: 'topOfBracket',
          targetValue: 12,
          startYear: ctx.baselineResult.startYear,
          endYear: ctx.baselineResult.endYear,
        },
      },
    }

    const evaluation = evaluateCandidate(ctx, rothCandidate({ planPatch: patch }))

    // The deltas must equal an independent exact simulate of the same patch.
    const built = planForCandidate(plan, { planPatch: patch })
    if (!built.ok) throw new Error(built.error)
    const expected = summarizeProjection(built.plan, simulatePlan(built.plan, opts))
    expect(evaluation.candidateSummary.endingAfterTaxEstate).toBeCloseTo(expected.endingAfterTaxEstate, 6)
    expect(evaluation.deltas.endingAfterTaxEstate).toBeCloseTo(
      expected.endingAfterTaxEstate - ctx.baselineSummary.endingAfterTaxEstate,
      6,
    )
    // The aggregate patch is still priced, but cannot become a recommendation
    // before owner/source/destination identity is supplied.
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics.join(' ')).toMatch(/untagged.*identity-complete/i)
    expect(evaluation.deltas.endingAfterTaxEstate).toBeGreaterThan(0)
  })

  it('keeps explicitly exploratory aggregate candidates non-actionable without suppressing exact deltas', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        conversions: [{ year: 2027, amount: 30_000 }],
        retirementActionReadiness: {
          state: 'exploratoryNonActionable',
          reason: 'The annual amount has not been allocated to an owner, source IRA, and Roth destination.',
        },
      }),
    )

    expect(evaluation.conversionExecution?.executedTotal).toBeGreaterThan(0)
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics.join(' ')).toContain('exploratory and non-actionable')
  })

  it('gates canonical scenario operations and aggregate QCD changes', () => {
    const plan = tradHeavyPlan()
    const edited = structuredClone(plan)
    edited.strategies.qcdAnnual = 1_000
    const patch = canonicalPatchFor(plan, edited)
    const ctx = createDecisionContext(plan, simOptions())

    const untagged = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: patch }),
      { candidateResult: ctx.baselineResult },
    )
    expect(untagged.recommendationState).toBe('diagnostic')
    expect(untagged.diagnostics.join(' ')).toMatch(/untagged.*identity-complete/i)

    const falselyCertified = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: patch,
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: ['pretend-qcd-action'],
        },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(falselyCertified.recommendationState).toBe('diagnostic')
    expect(falselyCertified.diagnostics.join(' ')).toMatch(/aggregate.*QCD/i)
  })

  it('does not gate a patch that only cancels a positive aggregate QCD strategy', () => {
    const plan = tradHeavyPlan()
    plan.strategies.qcdAnnual = 1_000
    const edited = structuredClone(plan)
    edited.strategies.qcdAnnual = 0
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: canonicalPatchFor(plan, edited) }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('neutral')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('does not treat an unrelated whole-strategies operation as an aggregate action change', () => {
    const plan = tradHeavyPlan()
    const edited = structuredClone(plan)
    edited.strategies.taxableSafetyNetFloor =
      (edited.strategies.taxableSafetyNetFloor ?? 0) + 1_000
    const seed = canonicalPatchFor(plan, edited)
    const wholeStrategiesPatch = {
      ...seed,
      operations: [{
        op: 'set',
        path: '/strategies',
        before: { present: true, value: plan.strategies },
        value: edited.strategies,
      }],
    } as never
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: wholeStrategiesPatch }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('neutral')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('does not gate a redundant nested retirement-strategy operation', () => {
    const plan = tradHeavyPlan()
    const edited = structuredClone(plan)
    edited.assumptions.inflationPct += 0.1
    const seed = canonicalPatchFor(plan, edited)
    const patch = {
      ...seed,
      operations: [
        ...seed.operations,
        {
          op: 'set',
          path: '/strategies/qcdAnnual',
          before: { present: true, value: plan.strategies.qcdAnnual },
          value: plan.strategies.qcdAnnual,
        },
      ],
    } as never
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: patch,
        // Evidence may survive candidate construction even when the canonical
        // action operation applies idempotently. It must not turn metadata
        // presence into a retirement-action change.
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: ['already-applied-qcd'],
        },
      }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('neutral')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('classifies an idempotently applied canonical strategy operation from the materialized plan', () => {
    const plan = tradHeavyPlan()
    plan.strategies.qcdAnnual = 1_000
    const edited = structuredClone(plan)
    edited.assumptions.inflationPct += 0.1
    const seed = canonicalPatchFor(plan, edited)
    const patch = {
      ...seed,
      operations: [
        ...seed.operations,
        {
          op: 'set',
          path: '/strategies/qcdAnnual',
          before: { present: true, value: 0 },
          value: 1_000,
        },
      ],
    } as never
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: patch }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('neutral')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('does not treat optimized-at provenance metadata as a retirement-action change', () => {
    const plan = tradHeavyPlan()
    plan.strategies.rothConversion = {
      mode: 'optimized',
      conversions: [{ year: 2027, amount: 20_000 }],
      optimizedAtIso: '2026-01-01T00:00:00.000Z',
    }
    const ctx = createDecisionContext(plan, simOptions())

    for (const optimizedAtIso of [undefined, '2026-02-01T00:00:00.000Z']) {
      const edited = structuredClone(plan)
      const editedStrategy = edited.strategies.rothConversion
      if (editedStrategy.mode !== 'optimized') throw new Error('expected optimized test strategy')
      if (optimizedAtIso === undefined) {
        delete editedStrategy.optimizedAtIso
      } else {
        editedStrategy.optimizedAtIso = optimizedAtIso
      }
      const canonicalPatch = canonicalPatchFor(plan, edited)
      const wholeStrategyPatch = {
        ...canonicalPatch,
        operations: [{
          op: 'set',
          path: '/strategies/rothConversion',
          before: { present: true, value: plan.strategies.rothConversion },
          value: editedStrategy,
        }],
      } as never

      for (const planPatch of [canonicalPatch, wholeStrategyPatch]) {
        const evaluation = evaluateCandidate(
          ctx,
          rothCandidate({ planPatch }),
          { candidateResult: ctx.baselineResult },
        )

        expect(evaluation.recommendationState).toBe('neutral')
        expect(evaluation.diagnostics).toEqual([])
      }
    }
  })

  it('does not gate a normalized legacy strategies override when only unrelated values change', () => {
    const plan = tradHeavyPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const edits = [
      {
        ...plan.strategies,
        taxableSafetyNetFloor: (plan.strategies.taxableSafetyNetFloor ?? 0) + 1_000,
      },
      {
        ...plan.strategies,
        itemizedDeductions: {
          stateAndLocalTaxes: 1_000,
          mortgageInterest: 0,
          charitable: 0,
        },
      },
    ]

    for (const strategies of edits) {
      const evaluation = evaluateCandidate(
        ctx,
        rothCandidate({ planPatch: { strategies } }),
        { candidateResult: ctx.baselineResult },
      )
      expect(evaluation.recommendationState).toBe('neutral')
      expect(evaluation.diagnostics).toEqual([])
    }
  })

  it('materializes partial legacy strategy overrides before deciding whether they change actions', () => {
    const plan = tradHeavyPlan()
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2035,
    }
    const ctx = createDecisionContext(plan, simOptions())
    const sameValue = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { rothConversion: { targetValue: 12 } } },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(sameValue.recommendationState).toBe('neutral')
    expect(sameValue.diagnostics).toEqual([])

    const changedValue = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { rothConversion: { targetValue: 22 } } },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(changedValue.recommendationState).toBe('diagnostic')
    expect(changedValue.diagnostics.join(' ')).toMatch(/identity-complete/i)
  })

  it('rejects incomplete or aggregate identity-complete evidence', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const legacyAggregateRequest = {
      actionId: 'legacy-aggregate-action',
      kind: 'legacyAggregateRothConversion',
      year: 2027,
      requestedAmount: 3_000_000,
      provenance: { source: 'migration', sourceId: 'legacy-readiness-test' },
    } as const
    const incomplete = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { retirementActions: [legacyAggregateRequest] } },
        retirementActionReadiness: { state: 'identityComplete', actionRequestIds: [] },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(incomplete.recommendationState).toBe('diagnostic')
    expect(incomplete.diagnostics.join(' ')).toMatch(/incomplete|does not exactly match/i)

    const aggregate = evaluateCandidate(
      ctx,
      rothCandidate({
        conversions: [{ year: 2027, amount: 30_000 }],
        retirementActionReadiness: { state: 'identityComplete', actionRequestIds: ['pretend-action'] },
      }),
    )
    expect(aggregate.recommendationState).toBe('diagnostic')
    expect(aggregate.diagnostics.join(' ')).toContain('cannot certify an aggregate conversion schedule')

    const legacyRequest = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: {
          strategies: {
            retirementActions: [legacyAggregateRequest],
          },
        },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: ['legacy-aggregate-action'],
        },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(legacyRequest.recommendationState).toBe('diagnostic')
    expect(legacyRequest.diagnostics.join(' ')).toMatch(/incomplete|does not exactly match/i)

    const malformed = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { retirementActions: [legacyAggregateRequest] } },
        retirementActionReadiness: { state: 'identityComplete' } as never,
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(malformed.recommendationState).toBe('diagnostic')
    expect(malformed.diagnostics.join(' ')).toMatch(/incomplete|does not exactly match/i)

    const hostileReadiness = new Proxy({}, {
      get: () => { throw new Error('hostile readiness') },
    })
    const hostile = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { retirementActions: [legacyAggregateRequest] } },
        retirementActionReadiness: hostileReadiness as never,
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(hostile.recommendationState).toBe('diagnostic')
    expect(hostile.diagnostics.join(' ')).toMatch(/incomplete readiness evidence/i)
  })

  it('accepts matching identity-bearing request evidence with absent, empty, or zero-only aggregate conversions', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    const sourceAccountId = sourceAccount.id
    const requests = [
      {
        actionId: 'decision-action-b',
        kind: 'ordinaryWithdrawal',
        year: 2027,
        executionSequence: 2,
        requestedAmount: 10_000,
        provenance: { source: 'generator', sourceId: 'readiness-test' },
        personId: 'p1',
        allocations: [
          { allocationId: 'decision-allocation-b', sourceAccountId, requestedAmount: 10_000 },
        ],
        purpose: { kind: 'spending' },
      },
      {
        actionId: 'decision-action-a',
        kind: 'ordinaryWithdrawal',
        year: 2026,
        executionSequence: 1,
        requestedAmount: 10_000,
        provenance: { source: 'generator', sourceId: 'readiness-test' },
        personId: 'p1',
        allocations: [
          { allocationId: 'decision-allocation-a', sourceAccountId, requestedAmount: 10_000 },
        ],
        purpose: { kind: 'spending' },
      },
    ]

    for (const [candidatePlan, candidateRequests, evidenceIds] of [
      [plan, requests, ['decision-action-a', 'decision-action-b']],
      [{ ...plan, accounts: [...plan.accounts].reverse() }, [...requests].reverse(), ['decision-action-b', 'decision-action-a']],
    ] as const) {
      for (const conversions of [
        undefined,
        [],
        [{ year: 2026, amount: 0 }],
      ] as const) {
        const ctx = createDecisionContext(candidatePlan, simOptions())
        const evaluation = evaluateCandidate(
          ctx,
          rothCandidate({
            category: 'withdrawal',
            conversions: conversions === undefined ? undefined : [...conversions],
            planPatch: { strategies: { retirementActions: candidateRequests } },
            retirementActionReadiness: { state: 'identityComplete', actionRequestIds: [...evidenceIds] },
          }),
        )
        expect(evaluation.recommendationState).not.toBe('diagnostic')
        expect(evaluation.diagnostics).toEqual([])
      }
    }
  })

  it('requires readiness and execution only for requests changed by the candidate', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    const existingRequest = {
      actionId: 'existing-historical-action',
      kind: 'ordinaryWithdrawal',
      year: 2020,
      executionSequence: 1,
      requestedAmount: 1_000,
      provenance: { source: 'manual', sourceId: 'historical-readiness-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'existing-historical-allocation',
        sourceAccountId: sourceAccount.id,
        requestedAmount: 1_000,
      }],
      purpose: { kind: 'spending' },
    } as const
    const appendedRequest = {
      actionId: 'new-actionable-action',
      kind: 'ordinaryWithdrawal',
      year: 2026,
      executionSequence: 2,
      requestedAmount: 5_000,
      provenance: { source: 'generator', sourceId: 'changed-readiness-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'new-actionable-allocation',
        sourceAccountId: sourceAccount.id,
        requestedAmount: 5_000,
      }],
      purpose: { kind: 'spending' },
    } as const
    plan.strategies.retirementActions = [existingRequest] as never
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: {
          strategies: {
            retirementActions: [existingRequest, appendedRequest],
          },
        },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: [appendedRequest.actionId],
        },
      }),
    )

    expect(evaluation.diagnostics).toEqual([])
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(evaluation.candidateResult.years.flatMap((year) =>
      year.retirementActionExecution?.evidence ?? []).map((evidence) =>
      evidence.actionId)).toContain(appendedRequest.actionId)
  })

  it('does not require readiness for an empty conversion schedule that requests no transfer', () => {
    const plan = tradHeavyPlan()
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2027, amount: 25_000 }],
    }
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ conversions: [] }),
    )

    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('does not let aggregate cancellations veto an identity-complete named action', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    plan.strategies.qcdAnnual = 1_000
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2027, amount: 25_000 }],
    }
    const request = {
      actionId: 'named-action-with-aggregate-cancellations',
      kind: 'ordinaryWithdrawal',
      year: 2026,
      executionSequence: 1,
      requestedAmount: 1_000,
      provenance: { source: 'generator', sourceId: 'aggregate-cancellation-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'named-action-allocation',
        sourceAccountId: sourceAccount.id,
        requestedAmount: 1_000,
      }],
      purpose: { kind: 'spending' },
    } as const
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: {
          strategies: {
            qcdAnnual: 0,
            rothConversion: { mode: 'none' },
            retirementActions: [request],
          },
        },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: [request.actionId],
        },
      }),
    )

    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('does not require readiness to cancel unchanged identity-bearing requests', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    const retainedRequest = {
      actionId: 'retained-action',
      kind: 'ordinaryWithdrawal',
      year: 2026,
      executionSequence: 1,
      requestedAmount: 1_000,
      provenance: { source: 'manual', sourceId: 'removal-readiness-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'retained-allocation',
        sourceAccountId: sourceAccount.id,
        requestedAmount: 1_000,
      }],
      purpose: { kind: 'spending' },
    } as const
    const removedRequest = {
      ...retainedRequest,
      actionId: 'removed-action',
      allocations: [{
        ...retainedRequest.allocations[0],
        allocationId: 'removed-allocation',
      }],
    } as const
    plan.strategies.retirementActions = [retainedRequest, removedRequest] as never
    const ctx = createDecisionContext(plan, simOptions())

    const removal = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: { strategies: { retirementActions: [retainedRequest] } },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(removal.recommendationState).not.toBe('diagnostic')
    expect(removal.diagnostics).toEqual([])

    const changed = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: {
          strategies: {
            retirementActions: [{
              ...retainedRequest,
              requestedAmount: 2_000,
              allocations: [{
                ...retainedRequest.allocations[0],
                requestedAmount: 2_000,
              }],
            }],
          },
        },
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(changed.recommendationState).toBe('diagnostic')
    expect(changed.diagnostics.join(' ')).toMatch(/identity-complete/i)
  })

  it('does not accept identity tags without matching execution evidence', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    const request = {
      actionId: 'tagged-but-unexecuted',
      kind: 'ordinaryWithdrawal',
      year: 2026,
      executionSequence: 1,
      requestedAmount: 5_000,
      provenance: { source: 'generator', sourceId: 'missing-execution-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'tagged-but-unexecuted-allocation',
        sourceAccountId: sourceAccount.id,
        requestedAmount: 5_000,
      }],
      purpose: { kind: 'spending' },
    }
    const ctx = createDecisionContext(plan, simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: { strategies: { retirementActions: [request] } },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: [request.actionId],
        },
      }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics.join(' ')).toMatch(/exactly one matching committed, actionable/i)
  })

  it('consumes named conversion execution evidence and its blocking reasons', () => {
    const plan = tradHeavyPlan()
    const source = plan.accounts.find((account) => account.type === 'traditional')!
    const destination = plan.accounts.find((account) => account.type === 'roth')!
    const request = {
      actionId: 'named-conversion-diagnostic',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2026,
      executionDate: '2026-12-15',
      executionSequence: 1,
      requestedAmount: 10_000,
      allocations: [{
        allocationId: 'named-conversion-diagnostic-allocation',
        sourceAccountId: source.id,
        requestedAmount: 10_000,
      }],
      destinationRothAccountId: destination.id,
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'generator', sourceId: 'conversion-diagnostic-test' },
    } as const
    const evaluation = evaluateCandidate(
      createDecisionContext(plan, simOptions()),
      rothCandidate({
        planPatch: { strategies: { retirementActions: [request] } },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: [request.actionId],
        },
      }),
    )

    const diagnostics = evaluation.diagnostics.join(' ')
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(diagnostics).toContain(request.actionId)
    // Not `conversion-basis-evidence-missing`: this fixture's owner has no
    // nondeductible basis, so the numerator is proven zero and that reason is
    // gone. What still blocks is the preflight's unstated IRA subtype.
    expect(diagnostics).toContain('conversion-ira-subtype-unknown')
    expect(diagnostics).not.toMatch(/exactly one matching/i)
    expect(evaluation.candidateResult.years.flatMap((year): readonly {
      actionId: string
    }[] => year.rothConversionActionExecution?.evidence ?? []).map((evidence) =>
      evidence.actionId)).toContain(request.actionId)
  })

  it('requires every certified request to have committed actionable exact-ledger evidence', () => {
    const plan = tradHeavyPlan()
    const ownedCash = plan.accounts.find((account) => account.type === 'cash')!
    ownedCash.ownerPersonId = 'p1'
    const jointCash = {
      ...ownedCash,
      id: 'joint-cash-for-readiness-test',
      name: 'Joint cash',
      ownerPersonId: null,
      balance: 20_000,
    } as typeof ownedCash
    plan.accounts.push(jointCash)
    const requests = [
      {
        actionId: 'actionable-owned-cash',
        kind: 'ordinaryWithdrawal',
        year: 2026,
        executionSequence: 1,
        requestedAmount: 5_000,
        provenance: { source: 'generator', sourceId: 'execution-readiness-test' },
        personId: 'p1',
        allocations: [{
          allocationId: 'actionable-owned-cash-allocation',
          sourceAccountId: ownedCash.id,
          requestedAmount: 5_000,
        }],
        purpose: { kind: 'spending' },
      },
      {
        actionId: 'non-actionable-joint-cash',
        kind: 'ordinaryWithdrawal',
        year: 2026,
        executionSequence: 2,
        requestedAmount: 5_000,
        provenance: { source: 'generator', sourceId: 'execution-readiness-test' },
        personId: 'p1',
        allocations: [{
          allocationId: 'non-actionable-joint-cash-allocation',
          sourceAccountId: jointCash.id,
          requestedAmount: 5_000,
        }],
        purpose: { kind: 'spending' },
      },
    ]
    const evaluation = evaluateCandidate(
      createDecisionContext(plan, simOptions()),
      rothCandidate({
        category: 'withdrawal',
        planPatch: { strategies: { retirementActions: requests } },
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: requests.map((request) => request.actionId),
        },
      }),
    )

    expect(evaluation.recommendationState).toBe('diagnostic')
    const diagnostics = evaluation.diagnostics.join(' ')
    expect(diagnostics).toMatch(/committed, actionable exact-ledger execution/i)
    expect(diagnostics).toContain('joint-source-acting-person-mismatch')
  })

  it('extracts matching request identities from a whole-strategies canonical operation', () => {
    const plan = tradHeavyPlan()
    const sourceAccount = plan.accounts.find((account) => account.type === 'cash')!
    sourceAccount.ownerPersonId = 'p1'
    const sourceAccountId = sourceAccount.id
    const edited = structuredClone(plan)
    edited.strategies.retirementActions = [{
      actionId: 'canonical-decision-action',
      kind: 'ordinaryWithdrawal',
      year: 2027,
      executionSequence: 1,
      requestedAmount: 10_000,
      provenance: { source: 'generator', sourceId: 'canonical-readiness-test' },
      personId: 'p1',
      allocations: [{
        allocationId: 'canonical-decision-allocation',
        sourceAccountId,
        requestedAmount: 10_000,
      }],
      purpose: { kind: 'spending' },
    }] as never
    const seed = canonicalPatchFor(plan, edited)
    const patch = {
      ...seed,
      operations: [{
        op: 'set',
        path: '/strategies',
        before: { present: true, value: plan.strategies },
        value: edited.strategies,
      }],
    } as never
    const ctx = createDecisionContext(plan, simOptions())

    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({
        category: 'withdrawal',
        planPatch: patch,
        retirementActionReadiness: {
          state: 'identityComplete',
          actionRequestIds: ['canonical-decision-action'],
        },
      }),
    )

    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(evaluation.diagnostics).toEqual([])
  })

  it('marks candidates with invalid patches diagnostic instead of recommending them', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ planPatch: { assumptions: { inflationPct: 'not-a-number' } } }),
    )
    expect(evaluation.recommendationState).toBe('diagnostic')
    expect(evaluation.diagnostics[0]).toMatch(/invalid/i)
    expect(evaluation.deltas.endingAfterTaxEstate).toBe(0)
  })

  it('evaluates roth schedule candidates through the exact ledger', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const evaluation = evaluateCandidate(
      ctx,
      rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }, { year: 2028, amount: 30_000 }] }),
    )
    expect(evaluation.conversionExecution).not.toBeNull()
    expect(evaluation.conversionExecution!.requestedTotal).toBe(60_000)
    // Plenty of traditional balance: the ledger executes the schedule in full.
    expect(evaluation.conversionExecution!.executedRatio).toBeCloseTo(1, 6)
    expect(evaluation.conversionExecution!.firstMateriallyUnexecutedYear).toBeNull()
    // The candidate run itself carries the conversions.
    const y2027 = evaluation.candidateResult.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBeCloseTo(30_000, 2)
  })

  it('respects inherited non-convertible traditional assets', () => {
    // Inherited-only: a requested schedule cannot execute at all → diagnostic.
    const inheritedCtx = createDecisionContext(inheritedOnlyPlan(), simOptions())
    const blocked = evaluateCandidate(
      inheritedCtx,
      rothCandidate({ conversions: [{ year: 2027, amount: 50_000 }] }),
    )
    expect(blocked.conversionExecution!.executedTotal).toBe(0)
    expect(blocked.recommendationState).toBe('diagnostic')

    // Mixed: execution is capped by the own balance, never the inherited one.
    const mixedCtx = createDecisionContext(mixedTraditionalPlan(), simOptions())
    const capped = evaluateCandidate(
      mixedCtx,
      rothCandidate({ conversions: [{ year: 2026, amount: 400_000 }] }),
    )
    expect(capped.conversionExecution!.executedTotal).toBeLessThanOrEqual(200_000 + 1)
    expect(capped.conversionExecution!.firstMateriallyUnexecutedYear).toBe(2026)
  })

  it('prices one-time taxable income in exact candidate evaluation', () => {
    const ctx = createDecisionContext(oneTimeIncomePlan(), simOptions())
    const quietYear = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }] }))
    const incomeYear = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2028, amount: 30_000 }] }))

    // 2028 carries an $80k ordinary payout, so the same conversion stacks into
    // higher brackets there — only the exact ledger prices that.
    const incomeYearRow = incomeYear.candidateResult.years.find((y) => y.year === 2028)!
    expect(incomeYearRow.incomes.oneTime).toBeGreaterThan(0)
    expect(incomeYear.deltas.lifetimeTax).toBeGreaterThan(quietYear.deltas.lifetimeTax + 1_000)
  })

  it('prices taxable brokerage gains from withdrawal source', () => {
    const opts = simOptions()
    const candidate = rothCandidate({ conversions: [{ year: 2027, amount: 40_000 }, { year: 2028, amount: 40_000 }] })

    const highBasis = evaluateCandidate(createDecisionContext(taxableBridgePlan('high'), opts), candidate)
    const lowBasis = evaluateCandidate(createDecisionContext(taxableBridgePlan('low'), opts), candidate)

    // Spending and conversion taxes are funded by selling brokerage shares;
    // the low-basis household realizes far more gains for the same candidate.
    const gains = (evaluation: typeof lowBasis) =>
      evaluation.candidateResult.years.reduce((sum, year) => sum + year.realizedGains, 0)
    expect(gains(lowBasis)).toBeGreaterThan(gains(highBasis) + 10_000)
    expect(lowBasis.candidateSummary.lifetimeTaxesAndPenalties).toBeGreaterThan(
      highBasis.candidateSummary.lifetimeTaxesAndPenalties,
    )
  })

  it('prices social security taxability feedback', () => {
    const ctx = createDecisionContext(ssTaxabilityPlan(), simOptions())
    // SS starts in 2034 (claim at 70). Same conversion before vs during
    // benefit years: converting on top of benefits drags SS into taxability.
    const beforeBenefits = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 30_000 }] }))
    const duringBenefits = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2036, amount: 30_000 }] }))

    const ssYear = duringBenefits.candidateResult.years.find((y) => y.year === 2036)!
    expect(ssYear.incomes.socialSecurity).toBeGreaterThan(0)
    expect(duringBenefits.deltas.lifetimeTax).toBeGreaterThan(beforeBenefits.deltas.lifetimeTax + 500)
  })

  it('preserves scheduled contributions in exact candidate evaluation', () => {
    const ctx = createDecisionContext(accumulatorPlan(), simOptions())
    const evaluation = evaluateCandidate(ctx, rothCandidate({ conversions: [{ year: 2027, amount: 20_000 }] }))

    const total = (years: typeof ctx.baselineResult.years, field: 'contributions' | 'employerMatch') =>
      years.reduce((sum, year) => sum + year[field], 0)
    // Future deposits (employee contributions and employer match) survive the
    // candidate evaluation as account assets, exactly as in the baseline.
    expect(total(evaluation.candidateResult.years, 'contributions')).toBeCloseTo(
      total(ctx.baselineResult.years, 'contributions'),
      2,
    )
    expect(total(evaluation.candidateResult.years, 'employerMatch')).toBeCloseTo(
      total(ctx.baselineResult.years, 'employerMatch'),
      2,
    )
    expect(total(evaluation.candidateResult.years, 'employerMatch')).toBeGreaterThan(0)
  })
})
