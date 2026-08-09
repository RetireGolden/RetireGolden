import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import { createActionReason } from '../actions/reasons.js'
import { maximizeAfterTaxEstate } from '../decisions/objectives.js'
import type { RankedDecision } from '../decisions/tournament.js'
import {
  PARAMETER_DATA_AS_OF,
  PARAMETER_DATA_BASIS,
} from '../params/index.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { TAX_RULE_REGISTRY } from '../rules/taxRuleRegistry.js'
import {
  cashAccount,
  couplePlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { ENGINE_VERSION } from '../version.js'
import { compareScenarioPlans } from './comparison.js'
import {
  buildTaxStrategyEvaluation,
  canonicalTaxStrategyEvaluationJson,
  CURRENT_TAX_STRATEGY_EVALUATION_VERSION,
  isTaxStrategyEvaluationDocument,
  parseTaxStrategyEvaluation,
  TAX_STRATEGY_EVALUATION_KIND,
  taxStrategyEvaluationHash,
  type TaxStrategyEvaluation,
  type TaxStrategyLimitationRef,
} from './taxStrategyEvaluation.js'
import {
  assertTaxStrategyEvaluationLimitations,
  validateTaxStrategyEvaluationLimitations,
} from './taxStrategyEvaluationRegistryCheck.js'

const noTax = createFlatTaxCalculator(0)

/** Real approximated PAB-AMT registry record used as a limitation example. */
const PAB_AMT_RULE_ID = 'irc-57-a-5-private-activity-bond-interest-amt-preference' as const

const pabAmtLimitation: TaxStrategyLimitationRef = {
  ruleId: PAB_AMT_RULE_ID,
  classification: 'approximated',
  errorDirection: 'understatesTax',
  note: 'Private-activity-bond AMT preference is not issue-level modelled.',
}

function coupleWithCash() {
  const plan = couplePlan({
    p1Dob: '1960-01-01',
    p2Dob: '1962-01-01',
    p1PlanningAge: 75,
    p2PlanningAge: 75,
    p1RetirementAge: 65,
    p2RetirementAge: 65,
  })
  plan.accounts = [
    cashAccount('cash', 600_000),
  ]
  plan.accounts[0]!.ownerPersonId = 'p1'
  plan.expenses.baseAnnual = 40_000
  return validatePlan(plan)
}

function ordinaryWithdrawalAction(
  actionId: string,
  allocationId: string,
  year: number,
  cents: number,
  executionSequence = 1,
  executionDate?: string,
) {
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal' as const,
    personId: asPersonId('p1'),
    year,
    ...(executionDate === undefined ? {} : { executionDate }),
    executionSequence,
    requestedAmount: asPositiveUsdCents(cents),
    allocations: [{
      allocationId: asAllocationId(allocationId),
      sourceAccountId: asAccountId('cash'),
      requestedAmount: asPositiveUsdCents(cents),
    }],
    purpose: { kind: 'spending' as const },
    provenance: { source: 'manual' as const },
  }
}

function actionBearingComparison() {
  const baseline = coupleWithCash()
  baseline.strategies.retirementActions = [
    ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2030, 12_345),
  ]
  const proposal = structuredClone(baseline)
  proposal.strategies.retirementActions = [
    ordinaryWithdrawalAction('shared-action', 'shared-allocation', 2031, 12_345),
  ]
  return compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
    startYear: 2026,
    taxCalculatorForPlan: () => noTax,
  })
}

function refusedActionComparison() {
  const baseline = coupleWithCash()
  const scheduled = (
    actionId: string,
    allocationId: string,
    executionDate: string,
    executionSequence: number,
  ) => ordinaryWithdrawalAction(actionId, allocationId, 2030, 100, executionSequence, executionDate)
  baseline.strategies.retirementActions = [
    scheduled('collision-b', 'allocation-b', '2030-06-01', 1),
    scheduled('independent', 'allocation-independent', '2030-07-01', 1),
    scheduled('collision-a', 'allocation-a', '2030-06-01', 1),
  ]
  // Proposal keeps the same schedule so proposal-side rows are non-null and refused.
  const proposal = structuredClone(baseline)
  return compareScenarioPlans(validatePlan(baseline), validatePlan(proposal), {
    startYear: 2026,
    taxCalculatorForPlan: () => noTax,
  })
}

function mockRanked(
  id: string,
  label: string,
  primaryValue: number,
  eligible: boolean,
  lossReason: string | null,
): RankedDecision {
  return {
    primaryValue,
    eligible,
    lossReason,
    constraintViolations: eligible ? [] : ['mock violation'],
    evaluation: {
      candidate: {
        id,
        source: 'heuristic',
        category: 'tax-cliff',
        label,
        explanation: 'test alternative',
      },
      baselineSummary: {} as RankedDecision['evaluation']['baselineSummary'],
      candidateSummary: {} as RankedDecision['evaluation']['candidateSummary'],
      candidateResult: {} as RankedDecision['evaluation']['candidateResult'],
      deltas: {
        endingAfterTaxEstate: 1_000,
        endingNetWorth: 500,
        lifetimeTax: -200,
        moneyLastsYears: 0,
      },
      conversionExecution: null,
      traditionalDepletionYear: null,
      diagnostics: [],
      recommendationState: eligible ? 'beneficial' : 'rejected',
    },
  }
}

describe('taxStrategyEvaluation', () => {
  it('builds a real evaluation that mirrors proposal actionRows and stamps provenance', () => {
    const comparison = actionBearingComparison()
    expect(comparison.actionRows.length).toBeGreaterThan(0)
    expect(comparison.actionRows.every((row) => row.proposal !== null)).toBe(true)

    const constraints = ['shortens money-lasts by 1 year(s)']
    const alternatives = [
      mockRanked('alt-b', 'B alternative', 50, false, 'trails winner'),
      mockRanked('alt-a', 'A alternative', 100, true, null),
    ]
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      constraints,
      alternatives,
      limitations: [pabAmtLimitation],
      actionLimitations: () => [pabAmtLimitation],
    })

    expect(evaluation.kind).toBe(TAX_STRATEGY_EVALUATION_KIND)
    expect(evaluation.version).toBe(CURRENT_TAX_STRATEGY_EVALUATION_VERSION)
    expect(evaluation.comparison).toBe(comparison)
    expect(evaluation.objective).toEqual({
      policyId: maximizeAfterTaxEstate.id,
      label: maximizeAfterTaxEstate.label,
      primaryMetricLabel: maximizeAfterTaxEstate.primaryMetricLabel,
    })
    expect(evaluation.constraints).toEqual(constraints)
    expect(evaluation.limitations).toEqual([pabAmtLimitation])
    expect(evaluation.alternatives).toEqual([
      {
        candidateId: 'alt-b',
        label: 'B alternative',
        source: 'heuristic',
        category: 'tax-cliff',
        recommendationState: 'rejected',
        primaryValue: 50,
        eligible: false,
        lossReason: 'trails winner',
        deltas: {
          endingAfterTaxEstate: 1_000,
          endingNetWorth: 500,
          lifetimeTax: -200,
          moneyLastsYears: 0,
        },
      },
      {
        candidateId: 'alt-a',
        label: 'A alternative',
        source: 'heuristic',
        category: 'tax-cliff',
        recommendationState: 'beneficial',
        primaryValue: 100,
        eligible: true,
        lossReason: null,
        deltas: {
          endingAfterTaxEstate: 1_000,
          endingNetWorth: 500,
          lifetimeTax: -200,
          moneyLastsYears: 0,
        },
      },
    ])

    expect(evaluation.provenance.startYear).toBe(comparison.provenance.startYear)
    expect(evaluation.provenance.baselineSnapshotHash).toBe(
      comparison.provenance.baselineSnapshotHash,
    )
    expect(evaluation.provenance.proposalSnapshotHash).toBe(
      comparison.provenance.proposalSnapshotHash,
    )
    expect(evaluation.provenance.engineVersion).toBe(ENGINE_VERSION)
    expect(evaluation.provenance.parameterBasis.dataAsOf).toBe(PARAMETER_DATA_AS_OF)
    expect(evaluation.provenance.parameterBasis.basis).toBe(PARAMETER_DATA_BASIS)
    expect(evaluation.provenance.parameterBasis.standInYears.length).toBeGreaterThan(0)
    expect(evaluation.confidence).toEqual({ basis: 'exactLedger', stochastic: null })

    const proposalRows = comparison.actionRows
      .map((row) => row.proposal)
      .filter((row): row is NonNullable<typeof row> => row !== null)
    expect(evaluation.actions).toHaveLength(proposalRows.length)
    for (let index = 0; index < proposalRows.length; index++) {
      const source = proposalRows[index]!
      const action = evaluation.actions[index]!
      expect(action.actionId).toBe(source.actionId)
      expect(action.kind).toBe(source.kind)
      expect(action.year).toBe(source.year)
      expect(action.personId).toBe(source.personId)
      expect(action.destinationAccountId).toBe(source.destinationAccountId)
      expect(action.charityDesignationId).toBe(source.charityDesignationId)
      expect(action.requestedAmountCents).toBe(source.requestedAmountCents)
      expect(action.executedAmountCents).toBe(source.executedAmountCents)
      expect(action.unexecutedAmountCents).toBe(source.unexecutedAmountCents)
      expect(action.readiness).toBe(source.readiness)
      expect(action.outcome).toBe(source.outcome)
      expect(action.sourceAllocations).toEqual(source.sourceAllocations)
      expect(action.reasons).toEqual(source.reasons)
      expect(action.limitations).toEqual([pabAmtLimitation])
    }

    expect(isTaxStrategyEvaluationDocument(evaluation)).toBe(true)
  })

  it('is deterministic for identical inputs and preserves action order under reordering of alternatives/limitations', () => {
    const comparison = actionBearingComparison()
    const build = (alternatives: RankedDecision[], limitations: TaxStrategyLimitationRef[]) =>
      buildTaxStrategyEvaluation({
        comparison,
        objective: maximizeAfterTaxEstate,
        alternatives,
        limitations,
        actionLimitations: () => limitations,
      })

    const alternativesA = [
      mockRanked('alt-b', 'B', 1, false, 'loss'),
      mockRanked('alt-a', 'A', 2, true, null),
    ]
    const alternativesB = [...alternativesA].reverse()
    const limitationsA = [pabAmtLimitation, {
      ruleId: 'irc-170-b-1-I-half-percent-floor' as TaxStrategyLimitationRef['ruleId'],
      classification: 'settled' as const,
      errorDirection: null,
      note: null,
    }]
    const limitationsB = [...limitationsA].reverse()

    const first = build(alternativesA, limitationsA)
    const second = build(alternativesA, limitationsA)
    expect(canonicalTaxStrategyEvaluationJson(first)).toBe(
      canonicalTaxStrategyEvaluationJson(second),
    )
    expect(taxStrategyEvaluationHash(first)).toBe(taxStrategyEvaluationHash(second))
    expect(taxStrategyEvaluationHash(first)).toMatch(/^fnv1a64:[0-9a-f]{16}$/)

    const reordered = build(alternativesB, limitationsB)
    expect(reordered.actions.map((action) => action.actionId)).toEqual(
      first.actions.map((action) => action.actionId),
    )
    // Canonical JSON sorts object keys (spot-check).
    const canonical = canonicalTaxStrategyEvaluationJson(first)
    expect(canonical.indexOf('"kind"')).toBeLessThan(canonical.indexOf('"version"'))
    expect(canonical).toContain('"actions"')
    expect(canonical).toBe(canonicalTaxStrategyEvaluationJson(parseTaxStrategyEvaluation(
      JSON.parse(JSON.stringify(first)) as unknown,
    )))
  })

  it('fail-closes on readiness upgrades, money movement on refusal, extra keys, and closed action kinds', () => {
    const comparison = refusedActionComparison()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    const nonActionable = evaluation.actions.find((action) => action.readiness === 'nonActionable')
    expect(nonActionable).toBeDefined()

    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const tamperedReadiness = asRecord(evaluation)
    const actionsReadiness = tamperedReadiness['actions'] as Array<Record<string, unknown>>
    const target = actionsReadiness.find((action) => action['readiness'] === 'nonActionable')!
    target['readiness'] = 'actionable'
    // Keep refusal outcome/reasons/zero movement — still must fail.
    expect(() => parseTaxStrategyEvaluation(tamperedReadiness)).toThrow()

    const tamperedExecuted = asRecord(evaluation)
    const actionsExecuted = tamperedExecuted['actions'] as Array<Record<string, unknown>>
    const refused = actionsExecuted.find((action) => action['readiness'] === 'nonActionable')!
    refused['executedAmountCents'] = 1
    refused['unexecutedAmountCents'] = (refused['requestedAmountCents'] as number) - 1
    expect(() => parseTaxStrategyEvaluation(tamperedExecuted)).toThrow()

    const tamperedExtraKey = asRecord(evaluation)
    tamperedExtraKey['implementationReady'] = true
    expect(() => parseTaxStrategyEvaluation(tamperedExtraKey)).toThrow()

    const tamperedActionExtra = asRecord(evaluation)
    const firstAction = (tamperedActionExtra['actions'] as Array<Record<string, unknown>>)[0]!
    firstAction['implementationReady'] = true
    expect(() => parseTaxStrategyEvaluation(tamperedActionExtra)).toThrow()

    const tamperedKind = asRecord(evaluation)
    const kindAction = (tamperedKind['actions'] as Array<Record<string, unknown>>)[0]!
    kindAction['kind'] = 'dafContribution'
    expect(() => parseTaxStrategyEvaluation(tamperedKind)).toThrow()

    // Approximated limitation without errorDirection, and settled with one set.
    const badApprox = asRecord(evaluation)
    badApprox['limitations'] = [{
      ruleId: PAB_AMT_RULE_ID,
      classification: 'approximated',
      errorDirection: null,
      note: null,
    }]
    expect(() => parseTaxStrategyEvaluation(badApprox)).toThrow()

    const badSettled = asRecord(evaluation)
    badSettled['limitations'] = [{
      ruleId: 'irc-170-b-1-I-half-percent-floor',
      classification: 'settled',
      errorDirection: 'understatesTax',
      note: null,
    }]
    expect(() => parseTaxStrategyEvaluation(badSettled)).toThrow()

    // Wrong kind/version literals.
    const badKind = asRecord(evaluation)
    badKind['kind'] = 'retiregolden.other'
    expect(() => parseTaxStrategyEvaluation(badKind)).toThrow()
    const badVersion = asRecord(evaluation)
    badVersion['version'] = 2
    expect(() => parseTaxStrategyEvaluation(badVersion)).toThrow()

    // Unknown objective policy.
    const badPolicy = asRecord(evaluation)
    ;(badPolicy['objective'] as Record<string, unknown>)['policyId'] = 'invented-policy'
    expect(() => parseTaxStrategyEvaluation(badPolicy)).toThrow()

    // Wrong delta convention.
    const badDelta = asRecord(evaluation)
    ;((badDelta['comparison'] as Record<string, unknown>)['moneyBasis'] as Record<string, unknown>)[
      'deltaConvention'
    ] = 'baseline-minus-proposal'
    expect(() => parseTaxStrategyEvaluation(badDelta)).toThrow()

    expect(isTaxStrategyEvaluationDocument(tamperedReadiness)).toBe(false)
  })

  it('has no builder path that upgrades nonActionable readiness or drops reasons', () => {
    const comparison = refusedActionComparison()
    const proposalRows = comparison.actionRows
      .map((row) => row.proposal)
      .filter((row): row is NonNullable<typeof row> => row !== null)
    expect(proposalRows.some((row) => row.readiness === 'nonActionable')).toBe(true)

    const optionCombos: Array<Parameters<typeof buildTaxStrategyEvaluation>[0]> = [
      { comparison, objective: maximizeAfterTaxEstate },
      {
        comparison,
        objective: maximizeAfterTaxEstate,
        constraints: ['irrelevant'],
        alternatives: [mockRanked('x', 'X', 0, true, null)],
        limitations: [pabAmtLimitation],
        actionLimitations: () => [pabAmtLimitation],
      },
      {
        comparison,
        objective: maximizeAfterTaxEstate,
        constraints: [],
        alternatives: [],
        limitations: [],
        actionLimitations: () => [],
      },
    ]

    for (const options of optionCombos) {
      const evaluation = buildTaxStrategyEvaluation(options)
      for (const source of proposalRows) {
        const action = evaluation.actions.find((entry) => entry.actionId === source.actionId)
        expect(action).toBeDefined()
        expect(action!.readiness).toBe(source.readiness)
        expect(action!.outcome).toBe(source.outcome)
        expect(action!.reasons).toEqual(source.reasons)
        expect(action!.executedAmountCents).toBe(source.executedAmountCents)
        expect(action!.unexecutedAmountCents).toBe(source.unexecutedAmountCents)
        if (source.readiness === 'nonActionable') {
          expect(action!.readiness).toBe('nonActionable')
          expect(action!.reasons.length).toBeGreaterThan(0)
          expect(action!.executedAmountCents).toBe(0)
        }
      }
    }
  })

  it('validates sample limitation refs against TAX_RULE_REGISTRY (test-only runtime import)', () => {
    const registryRecord = TAX_RULE_REGISTRY[PAB_AMT_RULE_ID]
    expect(registryRecord.classification).toBe('approximated')
    expect(registryRecord.errorDirection).toBe('understatesTax')
    expect(pabAmtLimitation.classification).toBe(registryRecord.classification)
    expect(pabAmtLimitation.errorDirection).toBe(registryRecord.errorDirection)

    const comparison = actionBearingComparison()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      limitations: [pabAmtLimitation],
    })
    const ref = evaluation.limitations[0]!
    const matched = TAX_RULE_REGISTRY[ref.ruleId as typeof PAB_AMT_RULE_ID]
    expect(matched.classification).toBe(ref.classification)
    expect(matched.errorDirection).toBe(ref.errorDirection)
  })

  it('reconciles comparison reference and action amounts to source rows only', () => {
    const comparison = actionBearingComparison()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      alternatives: [mockRanked('alt', 'Alt', 10, true, null)],
    })

    expect(evaluation.comparison).toBe(comparison)
    expect(evaluation.comparison).toEqual(comparison)

    for (const action of evaluation.actions) {
      const source = comparison.actionRows.find((row) => row.actionId === action.actionId)?.proposal
      expect(source).toBeDefined()
      expect(action.requestedAmountCents).toBe(source!.requestedAmountCents)
      expect(action.executedAmountCents).toBe(source!.executedAmountCents)
      expect(action.unexecutedAmountCents).toBe(source!.unexecutedAmountCents)
      for (let index = 0; index < action.sourceAllocations.length; index++) {
        expect(action.sourceAllocations[index]!.requestedAmountCents).toBe(
          source!.sourceAllocations[index]!.requestedAmountCents,
        )
        expect(action.sourceAllocations[index]!.executedAmountCents).toBe(
          source!.sourceAllocations[index]!.executedAmountCents,
        )
      }
    }

    // Alternative deltas are copied, not recomputed.
    expect(evaluation.alternatives[0]!.deltas).toEqual({
      endingAfterTaxEstate: 1_000,
      endingNetWorth: 500,
      lifetimeTax: -200,
      moneyLastsYears: 0,
    })
  })

  it('copies stochastic confidence provenance when the comparison includes risk', () => {
    const baseline = coupleWithCash()
    const proposal = structuredClone(baseline)
    proposal.expenses.baseAnnual += 5_000
    const comparison = compareScenarioPlans(baseline, validatePlan(proposal), {
      startYear: 2026,
      taxCalculatorForPlan: () => noTax,
      stochastic: {
        model: { type: 'lognormal', inflationMeanPct: 0 },
        pathCount: 8,
        seed: 731,
      },
    })
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
    })
    expect(evaluation.confidence.basis).toBe('exactLedger')
    expect(evaluation.confidence.stochastic).toEqual({
      pathCount: 8,
      seed: 731,
      model: expect.stringContaining('lognormal'),
    })
  })

  it('rejects disposition amount tampers and accepts a conserved partial action', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const nonActionableIndex = evaluation.actions.findIndex(
      (action) => action.readiness === 'nonActionable',
    )
    expect(nonActionableIndex).toBeGreaterThanOrEqual(0)
    const proposalIndex = evaluation.comparison.actionRows.findIndex(
      (row) => row.proposal?.actionId === evaluation.actions[nonActionableIndex]!.actionId,
    )
    expect(proposalIndex).toBeGreaterThanOrEqual(0)

    // Coordinated readiness/outcome/reasons upgrade with zero movement.
    const coordinatedZero = asRecord(evaluation)
    const zeroAction = (coordinatedZero['actions'] as Array<Record<string, unknown>>)[
      nonActionableIndex
    ]!
    const requested = zeroAction['requestedAmountCents'] as number
    zeroAction['readiness'] = 'actionable'
    zeroAction['outcome'] = 'executed'
    zeroAction['reasons'] = []
    zeroAction['executedAmountCents'] = 0
    zeroAction['unexecutedAmountCents'] = requested
    const zeroProposal = (
      (coordinatedZero['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalIndex]!['proposal'] as Record<string, unknown>
    zeroProposal['readiness'] = 'actionable'
    zeroProposal['outcome'] = 'executed'
    zeroProposal['reasons'] = []
    zeroProposal['executedAmountCents'] = 0
    zeroProposal['unexecutedAmountCents'] = requested
    expect(() => parseTaxStrategyEvaluation(coordinatedZero)).toThrow()

    // Non-conserving executed=1 / unexecuted=requested.
    const nonConserve = asRecord(evaluation)
    const nonConserveAction = (nonConserve['actions'] as Array<Record<string, unknown>>)[
      nonActionableIndex
    ]!
    const nonConserveRequested = nonConserveAction['requestedAmountCents'] as number
    nonConserveAction['readiness'] = 'actionable'
    nonConserveAction['outcome'] = 'executed'
    nonConserveAction['reasons'] = []
    nonConserveAction['executedAmountCents'] = 1
    nonConserveAction['unexecutedAmountCents'] = nonConserveRequested
    const nonConserveProposal = (
      (nonConserve['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalIndex]!['proposal'] as Record<string, unknown>
    nonConserveProposal['readiness'] = 'actionable'
    nonConserveProposal['outcome'] = 'executed'
    nonConserveProposal['reasons'] = []
    nonConserveProposal['executedAmountCents'] = 1
    nonConserveProposal['unexecutedAmountCents'] = nonConserveRequested
    expect(() => parseTaxStrategyEvaluation(nonConserve)).toThrow()

    // outcome 'executed' with executed = requested - 1 (even if conserved).
    const shortExecuted = asRecord(evaluation)
    const shortAction = (shortExecuted['actions'] as Array<Record<string, unknown>>)[
      nonActionableIndex
    ]!
    const shortRequested = shortAction['requestedAmountCents'] as number
    expect(shortRequested).toBeGreaterThan(1)
    shortAction['readiness'] = 'actionable'
    shortAction['outcome'] = 'executed'
    shortAction['reasons'] = []
    shortAction['executedAmountCents'] = shortRequested - 1
    shortAction['unexecutedAmountCents'] = 1
    const shortProposal = (
      (shortExecuted['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalIndex]!['proposal'] as Record<string, unknown>
    shortProposal['readiness'] = 'actionable'
    shortProposal['outcome'] = 'executed'
    shortProposal['reasons'] = []
    shortProposal['executedAmountCents'] = shortRequested - 1
    shortProposal['unexecutedAmountCents'] = 1
    expect(() => parseTaxStrategyEvaluation(shortExecuted)).toThrow()

    // Legitimate partial: both sides non-zero, conserved, mirrored in comparison.
    const partialDoc = asRecord(evaluation)
    const partialAction = (partialDoc['actions'] as Array<Record<string, unknown>>)[
      nonActionableIndex
    ]!
    const partialRequested = partialAction['requestedAmountCents'] as number
    const partialExecuted = Math.max(1, Math.floor(partialRequested / 2))
    const partialUnexecuted = partialRequested - partialExecuted
    expect(partialUnexecuted).toBeGreaterThan(0)
    partialAction['readiness'] = 'actionable'
    partialAction['outcome'] = 'partial'
    const partialTrimReason = createActionReason('source-balance-trimmed', {
      accountId: asAccountId('cash'),
      allocationId: asAllocationId('shared-allocation'),
    })
    partialAction['reasons'] = [partialTrimReason]
    partialAction['executedAmountCents'] = partialExecuted
    partialAction['unexecutedAmountCents'] = partialUnexecuted
    const partialAllocations = partialAction['sourceAllocations'] as Array<Record<string, unknown>>
    if (partialAllocations.length > 0) {
      const only = partialAllocations[0]!
      only['executedAmountCents'] = partialExecuted
      only['unexecutedAmountCents'] = partialUnexecuted
      only['resolution'] = 'resolved'
    }
    const partialProposal = (
      (partialDoc['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalIndex]!['proposal'] as Record<string, unknown>
    partialProposal['readiness'] = 'actionable'
    partialProposal['outcome'] = 'partial'
    partialProposal['reasons'] = [partialTrimReason]
    partialProposal['executedAmountCents'] = partialExecuted
    partialProposal['unexecutedAmountCents'] = partialUnexecuted
    const proposalAllocations = partialProposal['sourceAllocations'] as Array<Record<string, unknown>>
    if (proposalAllocations.length > 0) {
      const only = proposalAllocations[0]!
      only['executedAmountCents'] = partialExecuted
      only['unexecutedAmountCents'] = partialUnexecuted
      only['resolution'] = 'resolved'
    }
    expect(() => parseTaxStrategyEvaluation(partialDoc)).not.toThrow()
    expect(isTaxStrategyEvaluationDocument(partialDoc)).toBe(true)
  })

  it('rejects comparison.actionRows tampers that diverge from evaluation.actions', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const proposalBearingIndex = evaluation.comparison.actionRows.findIndex(
      (row) => row.proposal !== null,
    )
    expect(proposalBearingIndex).toBeGreaterThanOrEqual(0)

    const kindTamper = asRecord(evaluation)
    const kindRow = (
      (kindTamper['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    ;(kindRow['proposal'] as Record<string, unknown>)['kind'] = 'dafContribution'
    expect(() => parseTaxStrategyEvaluation(kindTamper)).toThrow()

    const readinessTamper = asRecord(evaluation)
    const readinessRow = (
      (readinessTamper['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    const proposal = readinessRow['proposal'] as Record<string, unknown>
    expect(proposal['readiness']).toBe('nonActionable')
    proposal['readiness'] = 'actionable'
    proposal['outcome'] = 'executed'
    // Keep amounts at zero/full-unexecuted so only comparison evidence is forged.
    expect(() => parseTaxStrategyEvaluation(readinessTamper)).toThrow()
  })

  it('rejects a comparison missing required sections or carrying non-finite metrics', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const missingHeadline = asRecord(evaluation)
    delete (missingHeadline['comparison'] as Record<string, unknown>)['headline']
    expect(() => parseTaxStrategyEvaluation(missingHeadline)).toThrow()

    const infiniteMetric = asRecord(evaluation)
    const headline = (infiniteMetric['comparison'] as Record<string, unknown>)[
      'headline'
    ] as Record<string, unknown>
    const endingNetWorth = headline['endingNetWorth'] as Record<string, unknown>
    endingNetWorth['proposal'] = Number.POSITIVE_INFINITY
    expect(() => parseTaxStrategyEvaluation(infiniteMetric)).toThrow()
    // Parse never accepts the document, so canonical serialization never sees it.
    expect(isTaxStrategyEvaluationDocument(infiniteMetric)).toBe(false)
  })

  it('passes the actionLimitations hook a frozen copy that cannot rewrite evaluation or comparison', () => {
    const comparison = refusedActionComparison()
    const before = structuredClone(comparison.actionRows)
    let hookSawFrozen = false

    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      actionLimitations: (row) => {
        hookSawFrozen = Object.isFrozen(row)
        const mutable = row as unknown as {
          readiness: string
          outcome: string
          executedAmountCents: number
          reasons: unknown[]
        }
        try {
          mutable.readiness = 'actionable'
          mutable.outcome = 'executed'
          mutable.executedAmountCents = 99
          mutable.reasons.length = 0
        } catch {
          // Strict-mode freeze throws; either way the live comparison must stay intact.
        }
        return [pabAmtLimitation]
      },
    })

    expect(hookSawFrozen).toBe(true)
    expect(evaluation.comparison).toBe(comparison)
    expect(evaluation.comparison.actionRows).toEqual(before)
    for (const action of evaluation.actions) {
      const source = comparison.actionRows.find((row) => row.actionId === action.actionId)?.proposal
      expect(source).toBeDefined()
      expect(action.readiness).toBe(source!.readiness)
      expect(action.outcome).toBe(source!.outcome)
      expect(action.executedAmountCents).toBe(source!.executedAmountCents)
      expect(action.reasons).toEqual(source!.reasons)
      expect(action.limitations).toEqual([pabAmtLimitation])
    }
  })

  it('registry checker accepts shipped PAB-AMT refs and rejects unknown or misclassified ones', () => {
    const comparison = actionBearingComparison()
    const evaluation = buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      limitations: [pabAmtLimitation],
      actionLimitations: () => [pabAmtLimitation],
    })

    expect(validateTaxStrategyEvaluationLimitations(evaluation)).toEqual([])
    expect(() => assertTaxStrategyEvaluationLimitations(evaluation)).not.toThrow()

    const unknownRule = parseTaxStrategyEvaluation(
      JSON.parse(
        JSON.stringify({
          ...evaluation,
          limitations: [{
            ruleId: 'not-a-shipped-rule',
            classification: 'approximated',
            errorDirection: 'understatesTax',
            note: null,
          }],
        }),
      ),
    )
    const unknownIssues = validateTaxStrategyEvaluationLimitations(unknownRule)
    expect(unknownIssues.length).toBeGreaterThan(0)
    expect(unknownIssues.some((issue) => issue.ruleId === 'not-a-shipped-rule')).toBe(true)

    const misclassified = parseTaxStrategyEvaluation(
      JSON.parse(
        JSON.stringify({
          ...evaluation,
          limitations: [{
            ruleId: PAB_AMT_RULE_ID,
            classification: 'settled',
            errorDirection: null,
            note: null,
          }],
        }),
      ),
    )
    const misclassifiedIssues = validateTaxStrategyEvaluationLimitations(misclassified)
    expect(misclassifiedIssues.length).toBeGreaterThan(0)
    expect(
      misclassifiedIssues.some(
        (issue) =>
          issue.ruleId === PAB_AMT_RULE_ID &&
          (issue.path.includes('classification') || issue.path.includes('errorDirection')),
      ),
    ).toBe(true)
    expect(() => assertTaxStrategyEvaluationLimitations(misclassified)).toThrow()
  })

  it('rejects reason-outcome swaps on evaluation actions and comparison actionRows', () => {
    const refusedEvaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const executedEvaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const refusedIndex = refusedEvaluation.actions.findIndex(
      (action) => action.outcome === 'refused' && action.reasons.length > 0,
    )
    expect(refusedIndex).toBeGreaterThanOrEqual(0)
    const refusedAction = refusedEvaluation.actions[refusedIndex]!
    expect(refusedAction.readiness).toBe('nonActionable')
    expect(refusedAction.executedAmountCents).toBe(0)
    expect(refusedAction.unexecutedAmountCents).toBe(refusedAction.requestedAmountCents)

    const adjustedReason = createActionReason('qcd-person-limit-trimmed', {})
    expect(adjustedReason.outcome).toBe('adjusted')
    const refusedReasonSwap = asRecord(refusedEvaluation)
    const refusedActionTamper = (refusedReasonSwap['actions'] as Array<Record<string, unknown>>)[
      refusedIndex
    ]!
    refusedActionTamper['reasons'] = [adjustedReason]
    expect(() => parseTaxStrategyEvaluation(refusedReasonSwap)).toThrow()

    const executedIndex = executedEvaluation.actions.findIndex(
      (action) => action.outcome === 'executed',
    )
    expect(executedIndex).toBeGreaterThanOrEqual(0)
    const refusedReason = createActionReason('source-account-not-found', {
      accountId: asAccountId('cash'),
    })
    expect(refusedReason.outcome).toBe('refused')
    const executedReasonSwap = asRecord(executedEvaluation)
    const executedActionTamper = (executedReasonSwap['actions'] as Array<Record<string, unknown>>)[
      executedIndex
    ]!
    executedActionTamper['reasons'] = [refusedReason]
    expect(() => parseTaxStrategyEvaluation(executedReasonSwap)).toThrow()

    const comparison = refusedActionComparison()
    const comparisonRecord = JSON.parse(JSON.stringify(comparison)) as Record<string, unknown>
    const actionRows = comparisonRecord['actionRows'] as Array<Record<string, unknown>>
    const refusedRow = actionRows.find((row) => {
      const proposal = row['proposal'] as Record<string, unknown> | null | undefined
      return proposal !== null && proposal !== undefined && proposal['outcome'] === 'refused'
    })!
    const proposal = refusedRow['proposal'] as Record<string, unknown>
    proposal['reasons'] = [adjustedReason]
    expect(() => buildTaxStrategyEvaluation({
      comparison: comparisonRecord as unknown as typeof comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()
  })

  it('rejects reconciliation tampers on identities, sourceAllocations, and reasons', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    const actionIndex = 0

    const personIdTamper = asRecord(evaluation)
    const personIdAction = (personIdTamper['actions'] as Array<Record<string, unknown>>)[actionIndex]!
    personIdAction['personId'] = null
    expect(() => parseTaxStrategyEvaluation(personIdTamper)).toThrow()

    const sourceAccountTamper = asRecord(evaluation)
    const sourceAction = (sourceAccountTamper['actions'] as Array<Record<string, unknown>>)[actionIndex]!
    const sourceAllocations = sourceAction['sourceAllocations'] as Array<Record<string, unknown>>
    expect(sourceAllocations.length).toBeGreaterThan(0)
    sourceAllocations[0]!['sourceAccountId'] = asAccountId('missing-account')
    expect(() => parseTaxStrategyEvaluation(sourceAccountTamper)).toThrow()

    const refusedEvaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const reasonBearingIndex = refusedEvaluation.actions.findIndex(
      (action) => action.reasons.length > 0,
    )
    expect(reasonBearingIndex).toBeGreaterThanOrEqual(0)
    expect(refusedEvaluation.actions[reasonBearingIndex]!.reasons.length).toBeGreaterThan(0)
    const reasonDropTamper = asRecord(refusedEvaluation)
    const reasonAction = (reasonDropTamper['actions'] as Array<Record<string, unknown>>)[
      reasonBearingIndex
    ]!
    reasonAction['reasons'] = []
    expect(() => parseTaxStrategyEvaluation(reasonDropTamper)).toThrow()
  })

  it('rejects partial actions without a physical trim reason and non-conserving comparison rows', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    const partialIndex = evaluation.actions.findIndex((action) => action.readiness === 'nonActionable')
    expect(partialIndex).toBeGreaterThanOrEqual(0)

    const emptyPartialReasons = asRecord(evaluation)
    const emptyPartialAction = (emptyPartialReasons['actions'] as Array<Record<string, unknown>>)[
      partialIndex
    ]!
    const requested = emptyPartialAction['requestedAmountCents'] as number
    const executed = Math.max(1, Math.floor(requested / 2))
    emptyPartialAction['readiness'] = 'actionable'
    emptyPartialAction['outcome'] = 'partial'
    emptyPartialAction['reasons'] = []
    emptyPartialAction['executedAmountCents'] = executed
    emptyPartialAction['unexecutedAmountCents'] = requested - executed
    expect(() => parseTaxStrategyEvaluation(emptyPartialReasons)).toThrow()

    const wrongFirstReason = asRecord(evaluation)
    const wrongReasonAction = (wrongFirstReason['actions'] as Array<Record<string, unknown>>)[
      partialIndex
    ]!
    const wrongRequested = wrongReasonAction['requestedAmountCents'] as number
    const wrongExecuted = Math.max(1, Math.floor(wrongRequested / 2))
    wrongReasonAction['readiness'] = 'actionable'
    wrongReasonAction['outcome'] = 'partial'
    wrongReasonAction['reasons'] = [createActionReason('source-account-not-found', {
      accountId: asAccountId('cash'),
    })]
    wrongReasonAction['executedAmountCents'] = wrongExecuted
    wrongReasonAction['unexecutedAmountCents'] = wrongRequested - wrongExecuted
    expect(() => parseTaxStrategyEvaluation(wrongFirstReason)).toThrow()

    const comparison = refusedActionComparison()
    const comparisonRecord = JSON.parse(JSON.stringify(comparison)) as Record<string, unknown>
    const actionRows = comparisonRecord['actionRows'] as Array<Record<string, unknown>>
    const baselineRow = actionRows.find((row) => row['baseline'] !== null)!
    const baseline = baselineRow['baseline'] as Record<string, unknown>
    baseline['executedAmountCents'] = 1
    baseline['unexecutedAmountCents'] = baseline['requestedAmountCents'] as number
    expect(() => buildTaxStrategyEvaluation({
      comparison: comparisonRecord as unknown as typeof comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const actionIdMismatch = JSON.parse(JSON.stringify(comparison)) as Record<string, unknown>
    const mismatchRows = actionIdMismatch['actionRows'] as Array<Record<string, unknown>>
    const mismatchRow = mismatchRows.find((row) => row['proposal'] !== null)!
    ;(mismatchRow['proposal'] as Record<string, unknown>)['actionId'] = asActionId('forged-id')
    expect(() => buildTaxStrategyEvaluation({
      comparison: actionIdMismatch as unknown as typeof comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()
  })

  it('rejects headline and risk objects missing required one-level keys', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const emptyHeadline = asRecord(evaluation)
    ;(emptyHeadline['comparison'] as Record<string, unknown>)['headline'] = {}
    expect(() => parseTaxStrategyEvaluation(emptyHeadline)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: (emptyHeadline['comparison'] as typeof evaluation.comparison),
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const emptyRisk = asRecord(evaluation)
    ;(emptyRisk['comparison'] as Record<string, unknown>)['risk'] = {}
    expect(() => parseTaxStrategyEvaluation(emptyRisk)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: (emptyRisk['comparison'] as typeof evaluation.comparison),
      objective: maximizeAfterTaxEstate,
    })).toThrow()
  })

  it('throws when actionLimitations mutates a later comparison proposal row', () => {
    const comparison = refusedActionComparison()
    const laterProposalIndex = comparison.actionRows.findIndex(
      (row, index) => index > 0 && row.proposal !== null,
    )
    expect(laterProposalIndex).toBeGreaterThan(0)

    let hookCalls = 0
    expect(() => buildTaxStrategyEvaluation({
      comparison,
      objective: maximizeAfterTaxEstate,
      actionLimitations: () => {
        hookCalls += 1
        if (hookCalls === 1) {
          const proposal = comparison.actionRows[laterProposalIndex]!.proposal!
          const mutable = proposal as unknown as {
            readiness: 'actionable' | 'nonActionable'
            outcome: 'executed' | 'partial' | 'refused' | 'unsupported'
            executedAmountCents: number
            unexecutedAmountCents: number
            reasons: unknown[]
          }
          mutable.readiness = 'actionable'
          mutable.outcome = 'executed'
          mutable.executedAmountCents = proposal.requestedAmountCents
          mutable.unexecutedAmountCents = 0
          mutable.reasons = []
        }
        return []
      },
    })).toThrow()
  })

  it('rejects round-2 structural tamper on comparison sides, allocations, confidence, and duplicates', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const stochasticEvaluation = buildTaxStrategyEvaluation({
      comparison: (() => {
        const baseline = coupleWithCash()
        const proposal = structuredClone(baseline)
        proposal.expenses.baseAnnual += 5_000
        return compareScenarioPlans(baseline, validatePlan(proposal), {
          startYear: 2026,
          taxCalculatorForPlan: () => noTax,
          stochastic: {
            model: { type: 'lognormal', inflationMeanPct: 0 },
            pathCount: 8,
            seed: 731,
          },
        })
      })(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const proposalBearingIndex = evaluation.comparison.actionRows.findIndex(
      (row) => row.proposal !== null,
    )
    expect(proposalBearingIndex).toBeGreaterThanOrEqual(0)

    const missingReasons = asRecord(evaluation)
    const missingReasonsRow = (
      (missingReasons['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    const missingReasonsProposal = missingReasonsRow['proposal'] as Record<string, unknown>
    delete missingReasonsProposal['reasons']
    expect(() => parseTaxStrategyEvaluation(missingReasons)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingReasons['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const missingProposal = asRecord(evaluation)
    const missingProposalRow = (
      (missingProposal['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    delete missingProposalRow['proposal']
    expect(() => parseTaxStrategyEvaluation(missingProposal)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingProposal['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const missingSourceAllocations = asRecord(evaluation)
    const missingAllocRow = (
      (missingSourceAllocations['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    delete (missingAllocRow['proposal'] as Record<string, unknown>)['sourceAllocations']
    expect(() => parseTaxStrategyEvaluation(missingSourceAllocations)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingSourceAllocations['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const actionableUnresolved = asRecord(evaluation)
    const unresolvedAction = (actionableUnresolved['actions'] as Array<Record<string, unknown>>)[0]!
    const unresolvedAllocations = unresolvedAction['sourceAllocations'] as Array<Record<string, unknown>>
    expect(unresolvedAllocations.length).toBeGreaterThan(0)
    unresolvedAction['readiness'] = 'actionable'
    unresolvedAction['outcome'] = 'executed'
    unresolvedAction['reasons'] = []
    unresolvedAllocations[0]!['resolution'] = 'unresolved'
    const unresolvedProposal = (
      (actionableUnresolved['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    unresolvedProposal['readiness'] = 'actionable'
    unresolvedProposal['outcome'] = 'executed'
    unresolvedProposal['reasons'] = []
    const unresolvedProposalAllocations = unresolvedProposal['sourceAllocations'] as Array<
      Record<string, unknown>
    >
    unresolvedProposalAllocations[0]!['resolution'] = 'unresolved'
    expect(() => parseTaxStrategyEvaluation(actionableUnresolved)).toThrow()

    const unresolvedWithExecuted = asRecord(evaluation)
    const executedAllocAction = (unresolvedWithExecuted['actions'] as Array<Record<string, unknown>>)[0]!
    const executedAllocations = executedAllocAction['sourceAllocations'] as Array<Record<string, unknown>>
    executedAllocAction['readiness'] = 'nonActionable'
    executedAllocAction['outcome'] = 'refused'
    executedAllocAction['executedAmountCents'] = 0
    executedAllocations[0]!['resolution'] = 'unresolved'
    executedAllocations[0]!['executedAmountCents'] = 1
    executedAllocations[0]!['unexecutedAmountCents'] =
      (executedAllocations[0]!['requestedAmountCents'] as number) - 1
    const executedAllocProposal = (
      (unresolvedWithExecuted['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    executedAllocProposal['readiness'] = 'nonActionable'
    executedAllocProposal['outcome'] = 'refused'
    executedAllocProposal['executedAmountCents'] = 0
    const executedAllocProposalAllocations = executedAllocProposal['sourceAllocations'] as Array<
      Record<string, unknown>
    >
    executedAllocProposalAllocations[0]!['resolution'] = 'unresolved'
    executedAllocProposalAllocations[0]!['executedAmountCents'] = 1
    executedAllocProposalAllocations[0]!['unexecutedAmountCents'] =
      (executedAllocProposalAllocations[0]!['requestedAmountCents'] as number) - 1
    expect(() => parseTaxStrategyEvaluation(unresolvedWithExecuted)).toThrow()

    const stochasticOnNullRisk = asRecord(evaluation)
    stochasticOnNullRisk['confidence'] = {
      basis: 'exactLedger',
      stochastic: { pathCount: 1, seed: 0, model: '{}' },
    }
    expect(() => parseTaxStrategyEvaluation(stochasticOnNullRisk)).toThrow()

    const mismatchedSeed = asRecord(stochasticEvaluation)
    ;(mismatchedSeed['confidence'] as Record<string, unknown>)['stochastic'] = {
      pathCount: stochasticEvaluation.confidence.stochastic!.pathCount,
      seed: stochasticEvaluation.confidence.stochastic!.seed + 1,
      model: stochasticEvaluation.confidence.stochastic!.model,
    }
    expect(() => parseTaxStrategyEvaluation(mismatchedSeed)).toThrow()

    const missingDiagnostics = asRecord(evaluation)
    const diagnosticsRow = (
      (missingDiagnostics['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    delete diagnosticsRow['proposalScheduleDiagnostics']
    expect(() => parseTaxStrategyEvaluation(missingDiagnostics)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingDiagnostics['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const duplicateActions = asRecord(evaluation)
    const actions = duplicateActions['actions'] as Array<Record<string, unknown>>
    expect(actions.length).toBeGreaterThan(0)
    actions.push(structuredClone(actions[0]!))
    expect(() => parseTaxStrategyEvaluation(duplicateActions)).toThrow()

    const duplicateRows = asRecord(evaluation)
    const actionRows = (duplicateRows['comparison'] as Record<string, unknown>)['actionRows'] as Array<
      Record<string, unknown>
    >
    expect(actionRows.length).toBeGreaterThan(0)
    actionRows.push(structuredClone(actionRows[0]!))
    expect(() => parseTaxStrategyEvaluation(duplicateRows)).toThrow()
  })

  it('rejects round-3 structural tamper on risk metrics, diagnostics, allocations, sides, identities, rows, and plain objects', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const stochasticEvaluation = buildTaxStrategyEvaluation({
      comparison: (() => {
        const baseline = coupleWithCash()
        const proposal = structuredClone(baseline)
        proposal.expenses.baseAnnual += 5_000
        return compareScenarioPlans(baseline, validatePlan(proposal), {
          startYear: 2026,
          taxCalculatorForPlan: () => noTax,
          stochastic: {
            model: { type: 'lognormal', inflationMeanPct: 0 },
            pathCount: 8,
            seed: 731,
          },
        })
      })(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const missingSuccessRate = asRecord(stochasticEvaluation)
    delete ((missingSuccessRate['comparison'] as Record<string, unknown>)['risk'] as Record<
      string,
      unknown
    >)['successRate']
    expect(() => parseTaxStrategyEvaluation(missingSuccessRate)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingSuccessRate['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const proposalBearingIndex = evaluation.comparison.actionRows.findIndex(
      (row) => row.proposal !== null,
    )
    expect(proposalBearingIndex).toBeGreaterThanOrEqual(0)

    const nullDiagnostic = asRecord(evaluation)
    const nullDiagnosticRow = (
      (nullDiagnostic['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    nullDiagnosticRow['proposalScheduleDiagnostics'] = [null]
    expect(() => parseTaxStrategyEvaluation(nullDiagnostic)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: nullDiagnostic['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const emptyDiagnostic = asRecord(evaluation)
    const emptyDiagnosticRow = (
      (emptyDiagnostic['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    emptyDiagnosticRow['baselineScheduleDiagnostics'] = [{}]
    expect(() => parseTaxStrategyEvaluation(emptyDiagnostic)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: emptyDiagnostic['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const inflatedRequested = asRecord(evaluation)
    const inflatedAction = (inflatedRequested['actions'] as Array<Record<string, unknown>>)[0]!
    const inflatedAllocations = inflatedAction['sourceAllocations'] as Array<Record<string, unknown>>
    expect(inflatedAllocations.length).toBeGreaterThan(0)
    inflatedAllocations[0]!['requestedAmountCents'] =
      (inflatedAllocations[0]!['requestedAmountCents'] as number) + 1
    const inflatedProposal = (
      (inflatedRequested['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    const inflatedProposalAllocations = inflatedProposal['sourceAllocations'] as Array<
      Record<string, unknown>
    >
    inflatedProposalAllocations[0]!['requestedAmountCents'] =
      (inflatedProposalAllocations[0]!['requestedAmountCents'] as number) + 1
    expect(() => parseTaxStrategyEvaluation(inflatedRequested)).toThrow()

    const refusedEvaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const baselineRefusedIndex = refusedEvaluation.comparison.actionRows.findIndex(
      (row) => row.baseline?.outcome === 'refused',
    )
    expect(baselineRefusedIndex).toBeGreaterThanOrEqual(0)
    const baselineExecutedTamper = asRecord(refusedEvaluation)
    const baselineExecutedRow = (
      (baselineExecutedTamper['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[baselineRefusedIndex]!
    const baselineRefused = baselineExecutedRow['baseline'] as Record<string, unknown>
    baselineRefused['executedAmountCents'] = 1
    baselineRefused['unexecutedAmountCents'] =
      (baselineRefused['requestedAmountCents'] as number) - 1
    expect(() => parseTaxStrategyEvaluation(baselineExecutedTamper)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: baselineExecutedTamper['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const rothKindTamper = asRecord(evaluation)
    const rothAction = (rothKindTamper['actions'] as Array<Record<string, unknown>>)[0]!
    rothAction['kind'] = 'rothConversion'
    rothAction['destinationAccountId'] = null
    const rothProposal = (
      (rothKindTamper['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    rothProposal['kind'] = 'rothConversion'
    rothProposal['destinationAccountId'] = null
    expect(() => parseTaxStrategyEvaluation(rothKindTamper)).toThrow()

    const qcdKindTamper = asRecord(evaluation)
    const qcdAction = (qcdKindTamper['actions'] as Array<Record<string, unknown>>)[0]!
    qcdAction['kind'] = 'qcd'
    qcdAction['charityDesignationId'] = null
    const qcdProposal = (
      (qcdKindTamper['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    qcdProposal['kind'] = 'qcd'
    qcdProposal['charityDesignationId'] = null
    expect(() => parseTaxStrategyEvaluation(qcdKindTamper)).toThrow()

    const emptyRow = asRecord(evaluation)
    const emptyRowEntry = (
      (emptyRow['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!
    emptyRowEntry['baseline'] = null
    emptyRowEntry['proposal'] = null
    emptyRowEntry['baselineScheduleDiagnostics'] = []
    emptyRowEntry['proposalScheduleDiagnostics'] = []
    expect(() => parseTaxStrategyEvaluation(emptyRow)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: emptyRow['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const dateSpending = asRecord(evaluation)
    ;(dateSpending['comparison'] as Record<string, unknown>)['spending'] = new Date('2030-01-01')
    expect(() => parseTaxStrategyEvaluation(dateSpending)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: dateSpending['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()
    expect(isTaxStrategyEvaluationDocument(dateSpending)).toBe(false)
  })

  it('rejects round-4 structural tamper on diagnostics, allocations, reasons, money, annual, spending capacity, qcd, standInYears, and side year', () => {
    const evaluation = buildTaxStrategyEvaluation({
      comparison: actionBearingComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const refusedEvaluation = buildTaxStrategyEvaluation({
      comparison: refusedActionComparison(),
      objective: maximizeAfterTaxEstate,
    })
    const asRecord = (value: TaxStrategyEvaluation): Record<string, unknown> =>
      JSON.parse(JSON.stringify(value)) as Record<string, unknown>

    const proposalBearingIndex = evaluation.comparison.actionRows.findIndex(
      (row) => row.proposal !== null,
    )
    expect(proposalBearingIndex).toBeGreaterThanOrEqual(0)

    const diagnosticMismatch = asRecord(refusedEvaluation)
    const diagnosticRow = (
      (diagnosticMismatch['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    ).find((row) => (row['baselineScheduleDiagnostics'] as unknown[]).length > 0)!
    const diagnostics = diagnosticRow['baselineScheduleDiagnostics'] as Array<Record<string, unknown>>
    expect(diagnostics.length).toBeGreaterThan(0)
    diagnostics[0]!['actionId'] = asActionId('forged-diagnostic-action')
    expect(() => parseTaxStrategyEvaluation(diagnosticMismatch)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: diagnosticMismatch['comparison'] as typeof refusedEvaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const duplicateAllocation = asRecord(evaluation)
    const duplicateAction = (duplicateAllocation['actions'] as Array<Record<string, unknown>>)[0]!
    const duplicateAllocations = duplicateAction['sourceAllocations'] as Array<Record<string, unknown>>
    expect(duplicateAllocations.length).toBeGreaterThan(0)
    duplicateAllocations.push(structuredClone(duplicateAllocations[0]!))
    expect(() => parseTaxStrategyEvaluation(duplicateAllocation)).toThrow()

    const invalidReasonPersonId = asRecord(refusedEvaluation)
    const reasonBearingIndex = refusedEvaluation.actions.findIndex(
      (action) => action.reasons.length > 0,
    )
    expect(reasonBearingIndex).toBeGreaterThanOrEqual(0)
    const reasonAction = (invalidReasonPersonId['actions'] as Array<Record<string, unknown>>)[
      reasonBearingIndex
    ]!
    const reasons = reasonAction['reasons'] as Array<Record<string, unknown>>
    reasons[0]!['personId'] = {}
    expect(() => parseTaxStrategyEvaluation(invalidReasonPersonId)).toThrow()

    const negativeBaselineCents = asRecord(refusedEvaluation)
    const negativeRow = (
      (negativeBaselineCents['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    ).find((row) => row['baseline'] !== null)!
    const negativeBaseline = negativeRow['baseline'] as Record<string, unknown>
    negativeBaseline['requestedAmountCents'] = -1
    expect(() => parseTaxStrategyEvaluation(negativeBaselineCents)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: negativeBaselineCents['comparison'] as typeof refusedEvaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const missingAnnualValues = asRecord(evaluation)
    const annualRows = (missingAnnualValues['comparison'] as Record<string, unknown>)['annual'] as Array<
      Record<string, unknown>
    >
    expect(annualRows.length).toBeGreaterThan(0)
    delete annualRows[0]!['values']
    expect(() => parseTaxStrategyEvaluation(missingAnnualValues)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingAnnualValues['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const emptySpendingCapacity = asRecord(evaluation)
    ;(emptySpendingCapacity['comparison'] as Record<string, unknown>)['spendingCapacity'] = {}
    expect(() => parseTaxStrategyEvaluation(emptySpendingCapacity)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: emptySpendingCapacity['comparison'] as typeof evaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()

    const twoAllocationQcd = asRecord(evaluation)
    const qcdAction = (twoAllocationQcd['actions'] as Array<Record<string, unknown>>)[0]!
    qcdAction['kind'] = 'qcd'
    qcdAction['destinationAccountId'] = null
    qcdAction['charityDesignationId'] = 'charity-designation'
    const qcdAllocations = qcdAction['sourceAllocations'] as Array<Record<string, unknown>>
    qcdAllocations.push(structuredClone(qcdAllocations[0]!))
    const qcdProposal = (
      (twoAllocationQcd['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    )[proposalBearingIndex]!['proposal'] as Record<string, unknown>
    qcdProposal['kind'] = 'qcd'
    qcdProposal['destinationAccountId'] = null
    qcdProposal['charityDesignationId'] = 'charity-designation'
    const qcdProposalAllocations = qcdProposal['sourceAllocations'] as Array<Record<string, unknown>>
    qcdProposalAllocations.push(structuredClone(qcdProposalAllocations[0]!))
    expect(() => parseTaxStrategyEvaluation(twoAllocationQcd)).toThrow()

    const emptiedStandInYears = asRecord(evaluation)
    ;(emptiedStandInYears['provenance'] as Record<string, unknown>)['parameterBasis'] = {
      ...(evaluation.provenance.parameterBasis as object),
      standInYears: [],
    }
    expect(() => parseTaxStrategyEvaluation(emptiedStandInYears)).toThrow()

    const missingBaselineYear = asRecord(refusedEvaluation)
    const missingYearRow = (
      (missingBaselineYear['comparison'] as Record<string, unknown>)['actionRows'] as Array<
        Record<string, unknown>
      >
    ).find((row) => row['baseline'] !== null)!
    delete (missingYearRow['baseline'] as Record<string, unknown>)['year']
    expect(() => parseTaxStrategyEvaluation(missingBaselineYear)).toThrow()
    expect(() => buildTaxStrategyEvaluation({
      comparison: missingBaselineYear['comparison'] as typeof refusedEvaluation.comparison,
      objective: maximizeAfterTaxEstate,
    })).toThrow()
  })
})
