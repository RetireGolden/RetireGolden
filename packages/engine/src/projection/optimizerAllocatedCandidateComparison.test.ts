import { describe, expect, it } from 'vitest'

import { asAccountId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import type { RothConversionCandidateIdentityIntent } from '../actions/retirementActionCandidateIdentityAllocator.js'
import { createDecisionContext, evaluateCandidate } from '../decisions/evaluateCandidate.js'
import { simOptions } from '../decisions/decisionFixtures.js'
import { simpleRothConversionGenerator } from '../decisions/generators.js'
import { adaptFillTargetRothConversionGeneratorCandidate } from '../decisions/rothConversionCandidateAdapter.js'
import type { ExactDecisionEvaluation } from '../decisions/types.js'
import type { Account, Plan } from '../model/plan.js'
import { cashAccount, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  compareOptimizerAllocatedCandidate,
  type OptimizerAllocatedCandidateComparisonInput,
} from './optimizerAllocatedCandidateComparison.js'
import type { RetirementActionReadinessVeto } from './optimizePlan.js'
import type { ProjectionResult } from './types.js'

function ownedRoth(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function conversionPlan(): Plan {
  const plan = singlePersonPlan({ planningAge: 95 })
  plan.accounts = [
    { ...cashAccount('cash-a', 100_000), ownerPersonId: 'p1' },
    traditionalAccount('trad-a', 500_000),
    ownedRoth('roth-a'),
  ]
  return plan
}

function bridgeFixture(): OptimizerAllocatedCandidateComparisonInput {
  const plan = conversionPlan()
  const ctx = createDecisionContext(plan, simOptions())
  const exploratory = simpleRothConversionGenerator.generate(ctx)
    .find((candidate) => candidate.id === 'bracket-12')!
  const intent: RothConversionCandidateIdentityIntent = {
    kind: 'rothConversion',
    year: 2027,
    executionDate: '2027-09-15',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(5_000_00),
    personId: asPersonId('p1'),
    provenance: { source: 'generator', sourceId: exploratory.id },
    sourceAllocations: [{
      sourceAccountId: asAccountId('trad-a'),
      requestedAmount: asPositiveUsdCents(5_000_00),
    }],
    destinationRothAccountId: asAccountId('roth-a'),
    taxFunding: { kind: 'noneExpected' },
  }
  const adapted = adaptFillTargetRothConversionGeneratorCandidate(
    plan,
    exploratory,
    [intent],
  )
  if (adapted.status !== 'adapted') throw new Error('expected adapted candidate')
  const strategies = adapted.candidate.planPatch?.['strategies'] as {
    retirementActions: Array<{ actionId: string; requestedAmount: number }>
  }
  const request = strategies.retirementActions.at(-1)!

  const aggregateResult = structuredClone(ctx.baselineResult)
  const aggregateYear = aggregateResult.years.find((year) => year.year === 2027)!
  aggregateYear.rothConversion = 5_000
  const allocatedResult = structuredClone(aggregateResult) as ProjectionResult
  const allocatedYear = allocatedResult.years.find((year) => year.year === 2027)!
  ;(allocatedYear as unknown as Record<string, unknown>)['rothConversionActionExecution'] = {
    committed: true,
    requests: [structuredClone(strategies.retirementActions.at(-1))],
    scheduleIssues: [],
    balances: [],
    evidence: [{
      actionId: request.actionId,
      kind: 'rothConversion',
      request: structuredClone(strategies.retirementActions.at(-1)),
      year: 2027,
      readiness: 'actionable',
      outcome: 'executed',
      requestedAmount: request.requestedAmount,
      executedAmount: request.requestedAmount,
      unexecutedAmount: 0,
    }],
  }
  const evaluation = {
    candidate: adapted.candidate,
    candidateResult: allocatedResult,
    recommendationState: 'beneficial',
  } as unknown as ExactDecisionEvaluation
  const readinessVeto = {
    reason: 'identityIncomplete',
    vetoedWinnerSource: 'candidate',
    vetoedCandidateId: exploratory.id,
    vetoedCandidateLabel: exploratory.label,
    vetoedConversions: [{ year: 2027, amount: 5_000 }],
    vetoedValidation: { recommendationState: 'identityIncomplete' },
    vetoedResult: aggregateResult,
  } as RetirementActionReadinessVeto
  return { plan, readinessVeto, allocatedEvaluation: evaluation }
}

describe('compareOptimizerAllocatedCandidate', () => {
  it('binds an identity-complete committed candidate only through exact ledger equality', () => {
    const input = bridgeFixture()
    const evidence = compareOptimizerAllocatedCandidate(input)

    expect(evidence).toMatchObject({
      winnerSource: 'candidate',
      winnerCandidateId: 'bracket-12',
      winnerConversions: [{ year: 2027, amount: 5_000 }],
      allocatedCandidateId: input.allocatedEvaluation.candidate.id,
      allocatedActionIds:
        input.allocatedEvaluation.candidate.retirementActionReadiness?.state === 'identityComplete'
          ? input.allocatedEvaluation.candidate.retirementActionReadiness.actionRequestIds
          : [],
      exactLedgerComparison: {
        currencyMinorUnit: 0.01,
        quantization: 'nearestCentHalfUp',
        equality: 'exactMinorUnitByRequiredKey',
      },
    })
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence?.exactLedgerComparison.entries)).toBe(true)
  })

  it.each([
    ['diagnostic evaluation', (input: OptimizerAllocatedCandidateComparisonInput) => {
      ;(input.allocatedEvaluation as ExactDecisionEvaluation).recommendationState = 'diagnostic'
    }],
    ['unknown runtime recommendation state', (input: OptimizerAllocatedCandidateComparisonInput) => {
      ;(input.allocatedEvaluation as unknown as { recommendationState: string })
        .recommendationState = 'apparently-safe'
    }],
    ['caller-hidden non-actionable ACA evidence', (input: OptimizerAllocatedCandidateComparisonInput) => {
      input.allocatedEvaluation.candidateResult.years[0]!.aca = {
        readiness: 'nonActionable',
        supportCodes: ['other-material-facts-unsupported'],
      } as never
    }],
    ['uncommitted execution', (input: OptimizerAllocatedCandidateComparisonInput) => {
      const year = input.allocatedEvaluation.candidateResult.years.find((entry) => entry.year === 2027)!
      ;(year.rothConversionActionExecution as unknown as { committed: boolean }).committed = false
    }],
    ['non-actionable execution', (input: OptimizerAllocatedCandidateComparisonInput) => {
      const year = input.allocatedEvaluation.candidateResult.years.find((entry) => entry.year === 2027)!
      const execution = year.rothConversionActionExecution as unknown as { evidence: Array<{ readiness: string }> }
      execution.evidence[0]!.readiness = 'nonActionable'
    }],
    ['execution evidence in the wrong year', (input: OptimizerAllocatedCandidateComparisonInput) => {
      const year = input.allocatedEvaluation.candidateResult.years.find((entry) => entry.year === 2027)!
      const execution = year.rothConversionActionExecution as unknown as { evidence: Array<{ year: number }> }
      execution.evidence[0]!.year = 2028
    }],
    ['duplicate cross-executor execution evidence', (input: OptimizerAllocatedCandidateComparisonInput) => {
      const year = input.allocatedEvaluation.candidateResult.years.find((entry) => entry.year === 2027)!
      const conversion = year.rothConversionActionExecution as unknown as Record<string, unknown>
      ;(year as unknown as Record<string, unknown>)['retirementActionExecution'] =
        structuredClone(conversion)
    }],
    ['over-requested allocation', (input: OptimizerAllocatedCandidateComparisonInput) => {
      input.readinessVeto.vetoedConversions[0]!.amount = 4_999
    }],
    ['foreign winner provenance', (input: OptimizerAllocatedCandidateComparisonInput) => {
      ;(input.readinessVeto as { vetoedCandidateId: string | null }).vetoedCandidateId = 'bracket-10'
    }],
    ['winner result with a different conversion schedule', (input: OptimizerAllocatedCandidateComparisonInput) => {
      const year = input.readinessVeto.vetoedResult.years.find((entry) => entry.year === 2027)!
      year.rothConversion = 4_999
    }],
    ['unknown runtime winner source', (input: OptimizerAllocatedCandidateComparisonInput) => {
      ;(input.readinessVeto as unknown as { vetoedWinnerSource: string })
        .vetoedWinnerSource = 'detector'
    }],
    ['unequal exact ledger', (input: OptimizerAllocatedCandidateComparisonInput) => {
      input.allocatedEvaluation.candidateResult.years[0]!.tax += 0.01
    }],
  ] as const)('fails closed for %s', (_label, mutate) => {
    const input = bridgeFixture()
    mutate(input)
    expect(compareOptimizerAllocatedCandidate(input)).toBeNull()
  })

  it('keeps the current zero-movement conversion implementation behind the veto', () => {
    const input = bridgeFixture()
    const ctx = createDecisionContext(input.plan as Plan, simOptions())
    const actual = evaluateCandidate(ctx, input.allocatedEvaluation.candidate)

    expect(actual.recommendationState).toBe('diagnostic')
    expect(compareOptimizerAllocatedCandidate({
      ...input,
      allocatedEvaluation: actual,
    })).toBeNull()
  })
})
