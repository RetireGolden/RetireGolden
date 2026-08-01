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
} from './decisionFixtures.js'
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
      rothCandidate({ planPatch: patch }),
      { candidateResult: ctx.baselineResult },
    )

    expect(evaluation.recommendationState).toBe('neutral')
    expect(evaluation.diagnostics).toEqual([])
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

  it('rejects incomplete or aggregate identity-complete evidence', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const incomplete = evaluateCandidate(
      ctx,
      rothCandidate({
        planPatch: { strategies: { retirementActions: [] } },
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
            retirementActions: [
              {
                actionId: 'legacy-aggregate-action',
                kind: 'legacyAggregateRothConversion',
                year: 2027,
                requestedAmount: 3_000_000,
                provenance: { source: 'migration', sourceId: 'legacy-readiness-test' },
              },
            ],
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
        planPatch: { strategies: { retirementActions: [] } },
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
        planPatch: { strategies: { retirementActions: [] } },
        retirementActionReadiness: hostileReadiness as never,
      }),
      { candidateResult: ctx.baselineResult },
    )
    expect(hostile.recommendationState).toBe('diagnostic')
    expect(hostile.diagnostics.join(' ')).toMatch(/incomplete readiness evidence/i)
  })

  it('accepts matching identity-bearing request evidence independent of account and evidence order', () => {
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
      const ctx = createDecisionContext(candidatePlan, simOptions())
      const evaluation = evaluateCandidate(
        ctx,
        rothCandidate({
          category: 'withdrawal',
          planPatch: { strategies: { retirementActions: candidateRequests } },
          retirementActionReadiness: { state: 'identityComplete', actionRequestIds: [...evidenceIds] },
        }),
      )
      expect(evaluation.recommendationState).not.toBe('diagnostic')
      expect(evaluation.diagnostics).toEqual([])
    }
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
    expect(evaluation.diagnostics.join(' ')).toMatch(/committed, actionable exact-ledger execution/i)
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
