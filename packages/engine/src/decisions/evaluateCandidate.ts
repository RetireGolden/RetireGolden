/**
 * Shared exact-ledger candidate evaluator (ledger-native decision engine,
 * Phase 1).
 *
 * One evaluation = one deterministic `simulatePlan` run of the candidate plan,
 * compared against a shared baseline run. All recommendation surfaces (Roth &
 * Tax Optimizer validation, tournaments, Insights previews, local search) go
 * through here so income, capital gains, Social Security taxability, ACA,
 * IRMAA, RMD, and inherited-IRA effects are priced by the ledger exactly once
 * — never re-derived in candidate logic.
 */

import type { Plan } from '../model/plan.js'
import {
  decodeScenarioPointer,
  isScenarioPatchEnvelope,
  parseScenarioPatch,
} from '../scenarios/contract.js'
import { canonicalScenarioJson } from '../scenarios/patch.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import { summarizeProjection, type ProjectionSummary } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import type { ProjectionResult } from '../projection/types.js'
import { isLegacyAggregateDecisionCalculation } from '../projection/internal/legacyAggregateDecisionCalculation.js'
import { inspectCompleteRetirementActionCandidateSchedule } from './retirementActionCandidateSchedule.js'
import type {
  ConversionExecution,
  DecisionCandidate,
  DecisionContext,
  DecisionRecommendationState,
  ExactDecisionEvaluation,
} from './types.js'

const RETIREMENT_ACTION_STRATEGY_KEYS = [
  'retirementActions',
  'rothConversion',
  'withdrawalOrder',
  'qcdAnnual',
] as const
const AGGREGATE_RETIREMENT_ACTION_STRATEGY_KEYS = new Set([
  'rothConversion',
  'withdrawalOrder',
  'qcdAnnual',
])
const IDENTITY_COMPLETE_RETIREMENT_ACTION_KINDS = new Set([
  'ordinaryWithdrawal',
  'rothConversion',
  'qcd',
])

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function strictNoAggregateConversionSentinel(value: unknown): boolean {
  const strategy = objectRecord(value)
  return strategy !== null &&
    Object.keys(strategy).length === 1 &&
    strategy['mode'] === 'none'
}

interface RetirementActionPatchInspection {
  changesRetirementActions: boolean
  hasAggregateStrategy: boolean
  retirementActionRequests: unknown
}

function strategyExecutionValue(key: string, value: unknown): unknown {
  if (key !== 'rothConversion') return value
  const strategy = objectRecord(value)
  if (strategy === null || !Object.prototype.hasOwnProperty.call(strategy, 'optimizedAtIso')) {
    return value
  }
  const execution = { ...strategy }
  delete execution['optimizedAtIso']
  return execution
}

function strategyValueChanged(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  key: string,
): boolean {
  const hasBefore = before !== null && Object.prototype.hasOwnProperty.call(before, key)
  const hasAfter = after !== null && Object.prototype.hasOwnProperty.call(after, key)
  if (hasBefore !== hasAfter) return true
  if (!hasBefore) return false
  return canonicalScenarioJson(strategyExecutionValue(key, before![key])) !==
    canonicalScenarioJson(strategyExecutionValue(key, after![key]))
}

function inspectRetirementActionPatch(
  planPatch: unknown,
  baseStrategies?: Plan['strategies'],
  materializedStrategies?: Plan['strategies'],
): RetirementActionPatchInspection {
  const patch = objectRecord(planPatch)
  if (patch === null) {
    return {
      changesRetirementActions: false,
      hasAggregateStrategy: false,
      retirementActionRequests: undefined,
    }
  }

  if (!isScenarioPatchEnvelope(patch)) {
    const strategies = objectRecord(patch['strategies'])
    const base = objectRecord(baseStrategies)
    const materialized = objectRecord(materializedStrategies)
    const finalStrategies = materialized ?? strategies
    const legacyValueChanged = (key: string): boolean =>
      strategies !== null &&
      Object.prototype.hasOwnProperty.call(strategies, key) &&
      (base === null || strategyValueChanged(base, finalStrategies, key))
    const retirementActionsChanged = legacyValueChanged('retirementActions')
    return {
      changesRetirementActions: RETIREMENT_ACTION_STRATEGY_KEYS.some(legacyValueChanged),
      hasAggregateStrategy: [...AGGREGATE_RETIREMENT_ACTION_STRATEGY_KEYS].some((key) =>
        legacyValueChanged(key) &&
        aggregateStrategyRequestsMovement(key, finalStrategies?.[key]),
      ),
      retirementActionRequests: retirementActionsChanged
        ? finalStrategies?.['retirementActions']
        : undefined,
    }
  }

  const parsed = parseScenarioPatch(patch)
  if (!parsed.ok) {
    return {
      changesRetirementActions: true,
      hasAggregateStrategy: false,
      retirementActionRequests: null,
    }
  }

  let changesRetirementActions = false
  let hasAggregateStrategy = false
  let retirementActionRequests: unknown
  for (const operation of parsed.patch.operations) {
    const segments = decodeScenarioPointer(operation.path)
    if (segments?.[0] !== 'strategies') continue

    if (segments.length === 1) {
      const beforeStrategies = operation.before.present
        ? objectRecord(operation.before.value)
        : null
      const afterStrategies = operation.op === 'set'
        ? objectRecord(operation.value)
        : null
      changesRetirementActions ||= RETIREMENT_ACTION_STRATEGY_KEYS.some((key) =>
        strategyValueChanged(beforeStrategies, afterStrategies, key),
      )
      hasAggregateStrategy ||= [...AGGREGATE_RETIREMENT_ACTION_STRATEGY_KEYS].some((key) =>
        strategyValueChanged(beforeStrategies, afterStrategies, key),
      )
      if (strategyValueChanged(beforeStrategies, afterStrategies, 'retirementActions')) {
        retirementActionRequests = afterStrategies?.['retirementActions']
      }
      continue
    }

    const strategyKey = segments[1]!
    if (!RETIREMENT_ACTION_STRATEGY_KEYS.includes(strategyKey as typeof RETIREMENT_ACTION_STRATEGY_KEYS[number])) {
      continue
    }
    // Optimizer provenance is display metadata. Setting or clearing it cannot
    // move retirement-account money and therefore must not demand execution
    // identities.
    if (
      strategyKey === 'rothConversion' &&
      segments.length === 3 &&
      segments[2] === 'optimizedAtIso'
    ) {
      continue
    }
    const beforePresent = operation.before.present
    const afterPresent = operation.op === 'set'
    const operationChanged =
      beforePresent !== afterPresent ||
      (beforePresent &&
        afterPresent &&
        canonicalScenarioJson(strategyExecutionValue(strategyKey, operation.before.value)) !==
          canonicalScenarioJson(strategyExecutionValue(strategyKey, operation.value)))
    if (!operationChanged) continue
    changesRetirementActions = true
    hasAggregateStrategy ||= AGGREGATE_RETIREMENT_ACTION_STRATEGY_KEYS.has(strategyKey)
    if (strategyKey === 'retirementActions') {
      retirementActionRequests = segments.length === 2 && operation.op === 'set'
        ? operation.value
        : null
    }
  }

  return {
    changesRetirementActions,
    hasAggregateStrategy,
    retirementActionRequests,
  }
}

function inspectCandidateRetirementActionPatch(
  candidate: DecisionCandidate,
  basePlan?: Plan,
): RetirementActionPatchInspection {
  const patch = objectRecord(candidate.planPatch)
  if (basePlan === undefined || patch === null) {
    return inspectRetirementActionPatch(candidate.planPatch, basePlan?.strategies)
  }
  // Classify the plan that applyScenarioPatch actually produced. Canonical
  // patches deliberately accept an operation idempotently when the current
  // value already equals its target, so trusting the document's stale
  // `before` snapshot would turn an applied no-op into a false readiness gate.
  const materialized = planForCandidate(basePlan, { planPatch: candidate.planPatch })
  if (!materialized.ok) {
    return {
      changesRetirementActions: true,
      hasAggregateStrategy: false,
      retirementActionRequests: null,
    }
  }
  return inspectRetirementActionPatch(
    { strategies: materialized.plan.strategies },
    basePlan.strategies,
    materialized.plan.strategies,
  )
}

function conversionScheduleRequestsMovement(value: unknown): boolean {
  if (!Array.isArray(value)) return true
  for (const conversion of value) {
    const record = objectRecord(conversion)
    const year = record?.['year']
    const amount = record?.['amount']
    if (
      typeof year !== 'number' ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2200 ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return true
    }
    if (amount > 0) return true
  }
  return false
}

function rothStrategyRequestsMovement(value: unknown): boolean {
  const strategy = objectRecord(value)
  if (strictNoAggregateConversionSentinel(strategy)) return false
  if (strategy?.['mode'] === 'manual' || strategy?.['mode'] === 'optimized') {
    return conversionScheduleRequestsMovement(strategy['conversions'])
  }
  return true
}

function explicitRothConversionSentinelDiagnostic(
  candidate: DecisionCandidate,
  basePlan: Plan | undefined,
  patchInspection: RetirementActionPatchInspection,
): string | null {
  const materialized = basePlan === undefined ? null : planForCandidate(basePlan, candidate)
  if (materialized !== null && !materialized.ok) {
    return 'Identity-complete Roth conversion requests require the strict no-aggregate-conversion sentinel so the aggregate strategy cannot execute alongside the explicit schedule.'
  }
  const requests = materialized?.plan.strategies.retirementActions ??
    patchInspection.retirementActionRequests
  const schedule = inspectCompleteRetirementActionCandidateSchedule(requests)
  if (!schedule.ok || !schedule.actions.some((action) => action.kind === 'rothConversion')) {
    return null
  }

  const finalRothStrategy = materialized?.plan.strategies.rothConversion ??
    objectRecord(objectRecord(candidate.planPatch)?.['strategies'])?.['rothConversion']
  return strictNoAggregateConversionSentinel(finalRothStrategy)
    ? null
    : 'Identity-complete Roth conversion requests require the strict no-aggregate-conversion sentinel so the aggregate strategy cannot execute alongside the explicit schedule.'
}

function qcdStrategyRequestsMovement(value: unknown): boolean {
  // Missing/zero aggregate QCD configuration cancels future movement. Any
  // positive or malformed value remains gated until it is replaced by
  // identity-complete action requests.
  if (value === undefined || value === 0) return false
  return true
}

function aggregateStrategyRequestsMovement(key: string, value: unknown): boolean {
  if (key === 'rothConversion') return rothStrategyRequestsMovement(value)
  if (key === 'qcdAnnual') return qcdStrategyRequestsMovement(value)
  // A changed withdrawal order can redirect account movement even though it
  // does not carry a dollar amount of its own.
  return true
}

function retirementActionRequestsOnlyRemoved(before: unknown, after: unknown): boolean {
  if (!Array.isArray(before) || !Array.isArray(after)) return false
  const beforeById = new Map<string, string>()
  for (const request of before) {
    const actionId = objectRecord(request)?.['actionId']
    if (typeof actionId !== 'string' || actionId.trim().length === 0 || beforeById.has(actionId)) {
      return false
    }
    beforeById.set(actionId, canonicalScenarioJson(request))
  }
  const finalIds = new Set<string>()
  for (const request of after) {
    const actionId = objectRecord(request)?.['actionId']
    if (
      typeof actionId !== 'string' ||
      actionId.trim().length === 0 ||
      finalIds.has(actionId) ||
      beforeById.get(actionId) !== canonicalScenarioJson(request)
    ) {
      return false
    }
    finalIds.add(actionId)
  }
  return true
}

function candidateOnlyRemovesRetirementActions(
  candidate: DecisionCandidate,
  basePlan: Plan,
): boolean {
  if (
    candidate.conversions !== undefined &&
    conversionScheduleRequestsMovement(candidate.conversions)
  ) {
    return false
  }
  const materialized = planForCandidate(basePlan, candidate)
  if (!materialized.ok) return false

  const before = objectRecord(basePlan.strategies)
  const after = objectRecord(materialized.plan.strategies)
  if (strategyValueChanged(before, after, 'withdrawalOrder')) return false
  if (
    strategyValueChanged(before, after, 'qcdAnnual') &&
    qcdStrategyRequestsMovement(materialized.plan.strategies.qcdAnnual)
  ) return false
  if (
    strategyValueChanged(before, after, 'rothConversion') &&
    rothStrategyRequestsMovement(materialized.plan.strategies.rothConversion)
  ) return false
  if (
    strategyValueChanged(before, after, 'retirementActions') &&
    !retirementActionRequestsOnlyRemoved(
      basePlan.strategies.retirementActions,
      materialized.plan.strategies.retirementActions,
    )
  ) return false
  return true
}

/** Whether the candidate's concrete change can cause retirement-account movement. */
export function candidateChangesRetirementActions(candidate: DecisionCandidate, basePlan?: Plan): boolean {
  try {
    // Readiness is evidence about a concrete retirement-action change, not a
    // plan mutation of its own. An idempotent retirementActions patch may
    // legitimately retain its evidence while an unrelated edit is evaluated.
    if (
      candidate.conversions !== undefined &&
      conversionScheduleRequestsMovement(candidate.conversions)
    ) return true
    if (basePlan !== undefined && candidateOnlyRemovesRetirementActions(candidate, basePlan)) {
      return false
    }
    return inspectCandidateRetirementActionPatch(candidate, basePlan).changesRetirementActions
  } catch {
    // A hostile or malformed runtime candidate must be gated, never trusted.
    return true
  }
}

function patchedRetirementActionIds(candidate: DecisionCandidate, basePlan?: Plan): string[] | null {
  const patchedRequests = inspectCandidateRetirementActionPatch(
    candidate,
    basePlan,
  ).retirementActionRequests
  if (!Array.isArray(patchedRequests)) return null
  const materialized = basePlan === undefined ? null : planForCandidate(basePlan, candidate)
  if (materialized !== null && !materialized.ok) return null
  const requests = materialized?.plan.strategies.retirementActions ?? patchedRequests

  const baseRequestsById = new Map<string, string>()
  for (const request of basePlan?.strategies.retirementActions ?? []) {
    const requestRecord = objectRecord(request)
    const actionId = requestRecord?.['actionId']
    if (typeof actionId !== 'string' || actionId.trim().length === 0 ||
        baseRequestsById.has(actionId)) return null
    baseRequestsById.set(actionId, canonicalScenarioJson(request))
  }

  const ids: string[] = []
  const finalIds = new Set<string>()
  for (const request of requests) {
    const requestRecord = objectRecord(request)
    const actionId = requestRecord?.['actionId']
    if (typeof actionId !== 'string' || actionId.trim().length === 0 ||
        finalIds.has(actionId)) return null
    finalIds.add(actionId)
    if (baseRequestsById.get(actionId) === canonicalScenarioJson(request)) continue
    if (!IDENTITY_COMPLETE_RETIREMENT_ACTION_KINDS.has(String(requestRecord?.['kind']))) return null
    ids.push(actionId)
  }
  return ids
}

function sameUniqueStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length || new Set(left).size !== left.length || new Set(right).size !== right.length) {
    return false
  }
  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}

/**
 * Return the fail-closed diagnostic for retirement-action readiness, or null
 * when the candidate carries complete identity-bearing request evidence.
 */
function inspectRetirementActionReadiness(candidate: DecisionCandidate, basePlan?: Plan): string | null {
  if (!candidateChangesRetirementActions(candidate, basePlan)) return null

  const readiness = candidate.retirementActionReadiness
  if (!readiness) {
    return 'Retirement-action candidate is untagged; identity-complete owner, source, and destination evidence is required before it can be recommended.'
  }
  const readinessRecord = objectRecord(readiness)
  if (readinessRecord?.['state'] === 'exploratoryNonActionable') {
    const rawReason = readinessRecord['reason']
    const reason = typeof rawReason === 'string' ? rawReason.trim() : ''
    return reason.length > 0
      ? `Retirement-action candidate is exploratory and non-actionable: ${reason}`
      : 'Retirement-action candidate has incomplete exploratory readiness evidence and cannot be recommended.'
  }
  if (readinessRecord?.['state'] !== 'identityComplete') {
    return 'Retirement-action candidate has incomplete readiness evidence and cannot be recommended.'
  }

  if (
    candidate.conversions !== undefined &&
    conversionScheduleRequestsMovement(candidate.conversions)
  ) {
    return 'Identity-complete retirement-action evidence cannot certify an aggregate conversion schedule.'
  }
  const patchInspection = inspectCandidateRetirementActionPatch(candidate, basePlan)
  if (patchInspection.hasAggregateStrategy) {
    return 'Identity-complete retirement-action evidence cannot certify an aggregate withdrawal or QCD strategy and permits aggregate conversion only as the strict no-aggregate-conversion sentinel alongside a complete request schedule.'
  }

  const conversionSentinelDiagnostic = explicitRothConversionSentinelDiagnostic(
    candidate,
    basePlan,
    patchInspection,
  )
  if (conversionSentinelDiagnostic !== null) return conversionSentinelDiagnostic

  const patchedIds = patchedRetirementActionIds(candidate, basePlan)
  const evidenceIds = readinessRecord['actionRequestIds']
  if (
    patchedIds === null ||
    patchedIds.length === 0 ||
    !Array.isArray(evidenceIds) ||
    evidenceIds.length === 0 ||
    evidenceIds.some((id) => typeof id !== 'string' || id.trim().length === 0) ||
    !sameUniqueStringSet(patchedIds, evidenceIds)
  ) {
    return 'Retirement-action identity evidence is incomplete or does not exactly match the candidate request IDs.'
  }
  return null
}

export function retirementActionReadinessDiagnostic(candidate: DecisionCandidate, basePlan?: Plan): string | null {
  try {
    return inspectRetirementActionReadiness(candidate, basePlan)
  } catch {
    return 'Retirement-action candidate has incomplete readiness evidence and cannot be recommended.'
  }
}

function inspectRetirementActionExecution(
  candidate: DecisionCandidate,
  candidateResult: ProjectionResult,
  basePlan: Plan,
): string | null {
  const patchedIds = patchedRetirementActionIds(candidate, basePlan)
  if (patchedIds === null || patchedIds.length === 0) {
    return 'Retirement-action execution evidence is incomplete or does not exactly match the candidate request IDs.'
  }

  const requestedIds = new Set(patchedIds)
  const evidenceById = new Map<
    string,
    Array<{ committed: boolean; readiness: unknown; reasonCodes: readonly string[] }>
  >()
  for (const year of candidateResult.years) {
    for (const rawExecution of [
      year.retirementActionExecution,
      year.rothConversionActionExecution,
    ]) {
      const execution = objectRecord(rawExecution)
      const evidence = execution?.['evidence']
      if (!Array.isArray(evidence)) continue

      for (const entry of evidence) {
        const evidenceRecord = objectRecord(entry)
        if (evidenceRecord === null) continue
        const actionId = evidenceRecord['actionId']
        if (typeof actionId !== 'string' || !requestedIds.has(actionId)) continue
        const dispositionRecord = objectRecord(evidenceRecord['disposition'])
        const rawReasons = Array.isArray(evidenceRecord['reasons'])
          ? evidenceRecord['reasons']
          : Array.isArray(dispositionRecord?.['reasons'])
            ? dispositionRecord['reasons']
            : []
        const reasonCodes = [...new Set(rawReasons.flatMap((reason) => {
              const code = objectRecord(reason)?.['code']
              return typeof code === 'string' ? [code] : []
            }))].sort()
        const records = evidenceById.get(actionId) ?? []
        records.push({
          committed: execution?.['committed'] === true,
          readiness: evidenceRecord?.['readiness'],
          reasonCodes,
        })
        evidenceById.set(actionId, records)
      }
    }
  }

  for (const actionId of patchedIds) {
    const records = evidenceById.get(actionId) ?? []
    if (records.length !== 1) {
      return `Retirement-action request ${actionId} does not have exactly one matching committed, actionable exact-ledger execution record.`
    }
    const record = records[0]!
    if (!record.committed || record.readiness !== 'actionable') {
      const blockingReasons = record.reasonCodes.length > 0
        ? ` Blocking reasons: ${record.reasonCodes.join(', ')}.`
        : ''
      return `Retirement-action request ${actionId} does not have matching committed, actionable exact-ledger execution evidence.${blockingReasons}`
    }
  }
  return null
}

function retirementActionExecutionDiagnostic(
  candidate: DecisionCandidate,
  candidateResult: ProjectionResult,
  basePlan: Plan,
): string | null {
  try {
    return inspectRetirementActionExecution(candidate, candidateResult, basePlan)
  } catch {
    return 'Retirement-action execution evidence is incomplete and cannot support a recommendation.'
  }
}

export interface EvaluateCandidateOptions {
  /** Dollars around zero treated as matching the baseline. */
  neutralToleranceDollars?: number
  /** Minimum total requested conversions before execution-ratio diagnostics matter. */
  minimumRequestedConversionDollars?: number
  /** Absolute shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallDollars?: number
  /** Percent shortfall before requested-vs-executed mismatch is material. */
  materialConversionShortfallPct?: number
  /**
   * Reuse an already-simulated candidate result instead of re-running the
   * ledger (e.g. the optimizer post-processor simulates schedules itself).
   * The caller is responsible for it matching the candidate exactly.
   */
  candidateResult?: ProjectionResult
}

export const DECISION_NEUTRAL_TOLERANCE_DOLLARS = 1
export const DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS = 1
export const DECISION_MATERIAL_SHORTFALL_DOLLARS = 1_000
export const DECISION_MATERIAL_SHORTFALL_PCT = 0.05

/** Years the money lasts: depletion year, or one past the horizon when it never depletes. */
export function lastsThroughYear(result: ProjectionResult): number {
  return result.depletionYear ?? result.endYear + 1
}

/** Build a fresh decision context, running the shared baseline once (or reusing a caller's run). */
export function createDecisionContext(
  plan: Plan,
  simulateOptions: DecisionContext['simulateOptions'],
  baseline?: { result: ProjectionResult; summary?: ProjectionSummary },
  taxCalculatorForPlan?: DecisionContext['taxCalculatorForPlan'],
): DecisionContext {
  const baselineResult = baseline?.result ?? simulatePlan(plan, simulateOptions)
  return {
    plan,
    baselineResult,
    baselineSummary: baseline?.summary ?? summarizeProjection(plan, baselineResult),
    simulateOptions,
    taxCalculatorForPlan,
  }
}

/**
 * Materialize the concrete plan a candidate describes: scenario patch first
 * (validated through the plan schema), then any explicit conversion schedule
 * installed as an `optimized` Roth strategy.
 */
export function planForCandidate(
  plan: Plan,
  candidate: Pick<DecisionCandidate, 'planPatch' | 'conversions'>,
): { ok: true; plan: Plan } | { ok: false; error: string } {
  let candidatePlan = plan
  if (candidate.planPatch) {
    const applied = applyScenarioPatch(plan, candidate.planPatch)
    if (!applied.ok) return { ok: false, error: `This candidate can't be applied to the plan: ${applied.issues.join('; ')}` }
    candidatePlan = applied.plan
  }
  if (candidate.conversions) {
    candidatePlan = {
      ...candidatePlan,
      strategies: {
        ...candidatePlan.strategies,
        rothConversion: { mode: 'optimized', conversions: candidate.conversions },
      },
    }
  }
  return { ok: true, plan: candidatePlan }
}

function aggregateByYear(conversions: Array<{ year: number; amount: number }>): Map<number, number> {
  const byYear = new Map<number, number>()
  for (const conversion of conversions) {
    byYear.set(conversion.year, (byYear.get(conversion.year) ?? 0) + conversion.amount)
  }
  return byYear
}

function buildConversionExecution(
  requested: Array<{ year: number; amount: number }>,
  candidateResult: ProjectionResult,
  options: Required<Pick<EvaluateCandidateOptions, 'materialConversionShortfallDollars' | 'materialConversionShortfallPct'>>,
): ConversionExecution {
  const requestedByYear = aggregateByYear(requested)
  const requestedTotal = requested.reduce((sum, conversion) => sum + conversion.amount, 0)
  const executedTotal = candidateResult.years.reduce((sum, year) => sum + year.rothConversion, 0)

  let firstMateriallyUnexecutedYear: number | null = null
  for (const year of [...requestedByYear.keys()].sort((a, b) => a - b)) {
    const requestedAmount = requestedByYear.get(year) ?? 0
    const executedAmount = candidateResult.years.find((y) => y.year === year)?.rothConversion ?? 0
    const materialShortfall = Math.max(
      options.materialConversionShortfallDollars,
      requestedAmount * options.materialConversionShortfallPct,
    )
    if (requestedAmount - executedAmount > materialShortfall) {
      firstMateriallyUnexecutedYear = year
      break
    }
  }

  return {
    requestedTotal,
    executedTotal,
    executedRatio: requestedTotal > 0 ? Math.min(1, executedTotal / requestedTotal) : 1,
    firstMateriallyUnexecutedYear,
    executedByYear: candidateResult.years
      .filter((year) => year.rothConversion > 1)
      .map((year) => ({ year: year.year, amount: Math.round(year.rothConversion * 100) / 100 })),
  }
}

/** First year the plan's own (non-inherited) traditional balance is exhausted, or null. */
export function findTraditionalDepletionYear(
  plan: Plan,
  result: ProjectionResult,
  toleranceDollars: number,
): number | null {
  const ownTraditionalIds = new Set(
    plan.accounts.filter((account) => account.type === 'traditional' && !account.inherited).map((account) => account.id),
  )
  if (ownTraditionalIds.size === 0) return null
  for (const year of result.years) {
    let balance = 0
    for (const accountId of ownTraditionalIds) balance += year.balances[accountId] ?? 0
    if (balance <= toleranceDollars) return year.year
  }
  return null
}

function classifyRecommendationState(args: {
  afterTaxEstateDelta: number
  conversionExecution: ConversionExecution | null
  neutralToleranceDollars: number
  minimumRequestedConversionDollars: number
  materialConversionShortfallDollars: number
  materialConversionShortfallPct: number
}): DecisionRecommendationState {
  if (args.afterTaxEstateDelta > args.neutralToleranceDollars) return 'beneficial'
  if (args.conversionExecution) {
    const { requestedTotal, executedTotal } = args.conversionExecution
    const materialShortfall = Math.max(
      args.materialConversionShortfallDollars,
      requestedTotal * args.materialConversionShortfallPct,
    )
    if (requestedTotal >= args.minimumRequestedConversionDollars && requestedTotal - executedTotal > materialShortfall) {
      return 'diagnostic'
    }
  }
  if (args.afterTaxEstateDelta < -args.neutralToleranceDollars) return 'rejected'
  return 'neutral'
}

/** Diagnostic-only evaluation for a candidate whose patch failed plan validation. */
function invalidCandidateEvaluation(
  ctx: DecisionContext,
  candidate: DecisionCandidate,
  error: string,
): ExactDecisionEvaluation {
  return {
    candidate,
    baselineSummary: ctx.baselineSummary,
    candidateSummary: ctx.baselineSummary,
    candidateResult: ctx.baselineResult,
    deltas: { endingAfterTaxEstate: 0, endingNetWorth: 0, lifetimeTax: 0, moneyLastsYears: 0 },
    conversionExecution: null,
    traditionalDepletionYear: null,
    diagnostics: [error],
    recommendationState: 'diagnostic',
  }
}

/**
 * Run one candidate through the exact ledger and compare it with the shared
 * baseline. Deterministic: same plan + candidate + options ⇒ same evaluation.
 */
export function evaluateCandidate(
  ctx: DecisionContext,
  candidate: DecisionCandidate,
  options: EvaluateCandidateOptions = {},
): ExactDecisionEvaluation {
  const neutralToleranceDollars = options.neutralToleranceDollars ?? DECISION_NEUTRAL_TOLERANCE_DOLLARS
  const minimumRequestedConversionDollars =
    options.minimumRequestedConversionDollars ?? DECISION_MINIMUM_REQUESTED_CONVERSION_DOLLARS
  const materialConversionShortfallDollars =
    options.materialConversionShortfallDollars ?? DECISION_MATERIAL_SHORTFALL_DOLLARS
  const materialConversionShortfallPct =
    options.materialConversionShortfallPct ?? DECISION_MATERIAL_SHORTFALL_PCT

  const built = planForCandidate(ctx.plan, candidate)
  if (!built.ok) return invalidCandidateEvaluation(ctx, candidate, built.error)

  // A patch may change tax assumptions (e.g. a relocation candidate clearing
  // the flat state-rate override); when the context carries a per-plan tax
  // stack factory, price the candidate with its own stack.
  const candidateSimulateOptions = ctx.taxCalculatorForPlan
    ? { ...ctx.simulateOptions, taxCalculator: ctx.taxCalculatorForPlan(built.plan) }
    : ctx.simulateOptions
  const candidateResult = options.candidateResult ?? simulatePlan(built.plan, candidateSimulateOptions)
  const candidateSummary = summarizeProjection(built.plan, candidateResult)

  const conversionExecution = candidate.conversions
    ? buildConversionExecution(candidate.conversions, candidateResult, {
        materialConversionShortfallDollars,
        materialConversionShortfallPct,
      })
    : null

  const deltas = {
    endingAfterTaxEstate: candidateSummary.endingAfterTaxEstate - ctx.baselineSummary.endingAfterTaxEstate,
    endingNetWorth: candidateSummary.endingNetWorth - ctx.baselineSummary.endingNetWorth,
    lifetimeTax: candidateSummary.lifetimeTaxesAndPenalties - ctx.baselineSummary.lifetimeTaxesAndPenalties,
    moneyLastsYears: lastsThroughYear(candidateResult) - lastsThroughYear(ctx.baselineResult),
  }

  const diagnostics: string[] = []
  if (conversionExecution && conversionExecution.firstMateriallyUnexecutedYear !== null) {
    diagnostics.push(
      `Your plan could not execute the requested conversion in ${conversionExecution.firstMateriallyUnexecutedYear}: ` +
        `requested $${Math.round(conversionExecution.requestedTotal).toLocaleString()} in total, ` +
        `executed $${Math.round(conversionExecution.executedTotal).toLocaleString()}.`,
    )
  }
  if (deltas.moneyLastsYears < 0) {
    diagnostics.push(`Money lasts ${-deltas.moneyLastsYears} year(s) less than the baseline.`)
  }
  if (candidateResult.depletionYear !== null && ctx.baselineResult.depletionYear === null) {
    diagnostics.push(`Introduces portfolio depletion in ${candidateResult.depletionYear}.`)
  }
  const unsafeBaselineAcaYears = ctx.baselineResult.years
    .filter((year) => year.aca?.readiness === 'nonActionable')
    .map((year) => year.year)
  const unsafeCandidateAcaYears = candidateResult.years
    .filter((year) => year.aca?.readiness === 'nonActionable')
    .map((year) => year.year)
  if (unsafeBaselineAcaYears.length > 0) {
    diagnostics.push(
      `ACA exact-ledger evidence is non-actionable in the baseline for ${unsafeBaselineAcaYears.join(', ')}; no candidate can be applied as executable.`,
    )
  }
  if (unsafeCandidateAcaYears.length > 0) {
    diagnostics.push(
      `ACA exact-ledger evidence is non-actionable in the candidate for ${unsafeCandidateAcaYears.join(', ')}; this candidate cannot be applied as executable.`,
    )
  }
  const hasUnsafeAcaEvidence = unsafeBaselineAcaYears.length > 0 || unsafeCandidateAcaYears.length > 0
  const legacyAggregateCalculation = isLegacyAggregateDecisionCalculation(options)
  const retirementActionReadiness = legacyAggregateCalculation
    ? null
    : retirementActionReadinessDiagnostic(candidate, ctx.plan)
  const retirementActionDiagnostic =
    retirementActionReadiness ??
    (legacyAggregateCalculation || !candidateChangesRetirementActions(candidate, ctx.plan)
      ? null
      : retirementActionExecutionDiagnostic(candidate, candidateResult, ctx.plan))
  if (retirementActionDiagnostic) diagnostics.push(retirementActionDiagnostic)

  return {
    candidate,
    baselineSummary: ctx.baselineSummary,
    candidateSummary,
    candidateResult,
    deltas,
    conversionExecution,
    traditionalDepletionYear: findTraditionalDepletionYear(built.plan, candidateResult, neutralToleranceDollars),
    diagnostics,
    recommendationState:
      hasUnsafeAcaEvidence || retirementActionDiagnostic !== null
        ? 'diagnostic'
        : classifyRecommendationState({
            afterTaxEstateDelta: deltas.endingAfterTaxEstate,
            conversionExecution,
            neutralToleranceDollars,
            minimumRequestedConversionDollars,
            materialConversionShortfallDollars,
            materialConversionShortfallPct,
          }),
  }
}
