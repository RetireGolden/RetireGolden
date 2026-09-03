import { ledgerCentsToPlanDollars, planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { rothConversionRequestSchema, type RothConversionRequest } from '../actions/contract.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { retirementActionReadinessDiagnostic } from '../decisions/evaluateCandidate.js'
import type { ExactDecisionEvaluation } from '../decisions/types.js'
import type { Plan } from '../model/plan.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import {
  compareOptimizerExactLedgerResults,
  type OptimizerExactLedgerComparisonEvidence,
} from './optimizerExactLedgerComparison.js'
import type { RetirementActionReadinessVeto } from './optimizePlan.js'
import { deepFreeze } from '../actions/freeze.js'
import { asUnknownRecord, type UnknownRecord } from '../actions/plainData.js'

export interface OptimizerAllocatedCandidateComparisonEvidence {
  readonly winnerSource: 'candidate' | 'milp'
  readonly winnerCandidateId: string | null
  readonly winnerCandidateLabel: string | null
  readonly winnerConversions: readonly Readonly<{ year: number; amount: number }>[]
  readonly allocatedCandidateId: string
  readonly allocatedActionIds: readonly string[]
  readonly exactLedgerComparison: Readonly<OptimizerExactLedgerComparisonEvidence>
}

export interface OptimizerAllocatedCandidateComparisonInput {
  readonly plan: Readonly<Plan>
  readonly readinessVeto: Readonly<RetirementActionReadinessVeto>
  readonly allocatedEvaluation: Readonly<ExactDecisionEvaluation>
}


function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const objectValue = value as UnknownRecord
    return `{${Object.keys(objectValue)
      .filter((key) => objectValue[key] !== undefined)
      .sort(compareUtf16CodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
      .join(',')}}`
  }
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError('Comparison input is not canonical JSON data')
  return serialized
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function conversionCentsByYear(
  conversions: readonly Readonly<{ year: number; amount: number }>[],
): Map<number, number> | null {
  const byYear = new Map<number, number>()
  let priorYear = 0
  for (const conversion of conversions) {
    if (!Number.isSafeInteger(conversion.year) || conversion.year < 1 ||
        conversion.year <= priorYear || typeof conversion.amount !== 'number' ||
        !Number.isFinite(conversion.amount) || conversion.amount <= 0) return null
    const cents = planDollarsToLedgerCents(conversion.amount)
    if (cents <= 0 || ledgerCentsToPlanDollars(cents) !== conversion.amount) return null
    byYear.set(conversion.year, cents)
    priorYear = conversion.year
  }
  return byYear.size > 0 ? byYear : null
}

function sameYearCents(left: ReadonlyMap<number, number>, right: ReadonlyMap<number, number>): boolean {
  return left.size === right.size && [...left].every(([year, cents]) => right.get(year) === cents)
}

function allocatedRequests(
  plan: Readonly<Plan>,
  evaluation: Readonly<ExactDecisionEvaluation>,
): { requests: RothConversionRequest[]; actionIds: string[] } | null {
  const candidate = evaluation.candidate
  if (!nonBlank(candidate.id) || candidate.conversions !== undefined ||
      retirementActionReadinessDiagnostic(candidate, plan as Plan) !== null) return null
  const readiness = asUnknownRecord(candidate.retirementActionReadiness)
  const rawActionIds = readiness?.['actionRequestIds']
  if (readiness?.['state'] !== 'identityComplete' || !Array.isArray(rawActionIds) ||
      rawActionIds.length === 0 || rawActionIds.some((id) => !nonBlank(id))) return null
  const actionIds = [...rawActionIds] as string[]
  if (new Set(actionIds).size !== actionIds.length) return null

  const materialized = candidate.planPatch === undefined
    ? null
    : applyScenarioPatch(plan, candidate.planPatch)
  if (materialized === null || !materialized.ok) return null
  const requestedIds = new Set<string>(actionIds)
  const requests: RothConversionRequest[] = []
  for (const rawRequest of materialized.plan.strategies.retirementActions) {
    const parsed = rothConversionRequestSchema.safeParse(rawRequest)
    if (!parsed.success || !requestedIds.has(parsed.data.actionId)) continue
    requests.push(parsed.data)
  }
  if (requests.length !== actionIds.length ||
      new Set(requests.map((request) => request.actionId)).size !== actionIds.length) return null
  requests.sort((left, right) => compareUtf16CodeUnits(left.actionId, right.actionId))
  actionIds.sort(compareUtf16CodeUnits)
  return { requests, actionIds }
}

function provenanceMatchesWinner(
  veto: Readonly<RetirementActionReadinessVeto>,
  evaluation: Readonly<ExactDecisionEvaluation>,
  requests: readonly Readonly<RothConversionRequest>[],
): boolean {
  if (veto.vetoedWinnerSource === 'candidate') {
    return nonBlank(veto.vetoedCandidateId) && nonBlank(veto.vetoedCandidateLabel) &&
      evaluation.candidate.source !== 'milp' && requests.every((request) =>
        request.provenance.source === 'generator' &&
        request.provenance.sourceId === veto.vetoedCandidateId)
  }
  return veto.vetoedCandidateId === null && veto.vetoedCandidateLabel === null &&
    evaluation.candidate.source === 'milp' && requests.every((request) =>
      request.provenance.source === 'optimizer' &&
      request.provenance.sourceId === evaluation.candidate.id)
}

function requestCentsByYear(
  requests: readonly Readonly<RothConversionRequest>[],
): Map<number, number> | null {
  const byYear = new Map<number, number>()
  for (const request of requests) {
    const next = (byYear.get(request.year) ?? 0) + request.requestedAmount
    if (!Number.isSafeInteger(next) || next > Number.MAX_SAFE_INTEGER) return null
    byYear.set(request.year, next)
  }
  return byYear
}

function committedExecutionCentsByYear(
  evaluation: Readonly<ExactDecisionEvaluation>,
  requests: readonly Readonly<RothConversionRequest>[],
): Map<number, number> | null {
  const requestById = new Map<string, Readonly<RothConversionRequest>>(
    requests.map((request) => [request.actionId, request]),
  )
  const records = new Map<string, UnknownRecord[]>()
  for (const year of evaluation.candidateResult.years) {
    for (const rawExecution of [
      year.retirementActionExecution,
      year.rothConversionActionExecution,
    ]) {
      const execution = asUnknownRecord(rawExecution)
      if (execution === null) continue
      const evidence = execution['evidence']
      if (!Array.isArray(evidence)) continue
      for (const rawEvidence of evidence) {
        const entry = asUnknownRecord(rawEvidence)
        const actionId = entry?.['actionId']
        if (entry === null || !nonBlank(actionId) || !requestById.has(actionId)) continue
        const matches = records.get(actionId) ?? []
        matches.push({
          ...entry,
          __committed: execution['committed'],
          __publicationYear: year.year,
        })
        records.set(actionId, matches)
      }
    }
  }

  const byYear = new Map<number, number>()
  for (const request of requests) {
    const matches = records.get(request.actionId) ?? []
    if (matches.length !== 1) return null
    const entry = matches[0]!
    const parsedRequest = rothConversionRequestSchema.safeParse(entry['request'])
    if (entry['__committed'] !== true || entry['__publicationYear'] !== request.year ||
        entry['kind'] !== 'rothConversion' || entry['year'] !== request.year ||
        entry['readiness'] !== 'actionable' ||
        entry['outcome'] !== 'executed' || entry['requestedAmount'] !== request.requestedAmount ||
        entry['executedAmount'] !== request.requestedAmount || entry['unexecutedAmount'] !== 0 ||
        !parsedRequest.success || canonicalJson(parsedRequest.data) !== canonicalJson(request)) return null
    const next = (byYear.get(request.year) ?? 0) + request.requestedAmount
    if (!Number.isSafeInteger(next) || next > Number.MAX_SAFE_INTEGER) return null
    byYear.set(request.year, next)
  }
  return byYear
}

function preservedConversionRequests(
  plan: Readonly<Plan>,
  allocatedActionIds: ReadonlySet<string>,
): RothConversionRequest[] | null {
  const requests: RothConversionRequest[] = []
  const seenActionIds = new Set<string>()
  for (const rawRequest of plan.strategies.retirementActions) {
    if (asUnknownRecord(rawRequest)?.['kind'] !== 'rothConversion') continue
    const parsed = rothConversionRequestSchema.safeParse(rawRequest)
    if (!parsed.success || allocatedActionIds.has(parsed.data.actionId) ||
        seenActionIds.has(parsed.data.actionId)) return null
    seenActionIds.add(parsed.data.actionId)
    requests.push(parsed.data)
  }
  return requests
}

function publishedExecutionCentsByYear(
  result: Readonly<ExactDecisionEvaluation['candidateResult']>,
  requests: readonly Readonly<RothConversionRequest>[],
): Map<number, number> | null {
  const activeYears = new Set(result.years.map((year) => year.year))
  const requestById = new Map<string, Readonly<RothConversionRequest>>(
    requests
      .filter((request) => activeYears.has(request.year))
      .map((request) => [request.actionId, request]),
  )
  const seen = new Set<string>()
  const byYear = new Map<number, number>()
  for (const year of result.years) {
    const publication = asUnknownRecord(year.retirementActionPublication)
    if (publication !== null && publication['taxYear'] !== year.year) return null
    const records = publication?.['records']
    if (!Array.isArray(records)) continue
    for (const rawRecord of records) {
      const entry = asUnknownRecord(rawRecord)
      const actionId = entry?.['actionId']
      if (entry === null || !nonBlank(actionId)) continue
      const request = requestById.get(actionId)
      if (request === undefined) continue
      const parsedRequest = rothConversionRequestSchema.safeParse(entry['request'])
      const executedAmount = entry['executedAmount']
      if (seen.has(actionId) || entry['kind'] !== 'rothConversion' ||
          entry['year'] !== request.year || year.year !== request.year ||
          !parsedRequest.success || canonicalJson(parsedRequest.data) !== canonicalJson(request) ||
          !Number.isSafeInteger(executedAmount) || (executedAmount as number) < 0 ||
          (executedAmount as number) > request.requestedAmount) return null
      seen.add(actionId)
      if ((executedAmount as number) === 0) continue
      const next = (byYear.get(request.year) ?? 0) + (executedAmount as number)
      if (!Number.isSafeInteger(next) || next > Number.MAX_SAFE_INTEGER) return null
      byYear.set(request.year, next)
    }
  }
  return seen.size === requestById.size ? byYear : null
}

function subtractYearCents(
  total: ReadonlyMap<number, number>,
  preserved: ReadonlyMap<number, number>,
): Map<number, number> | null {
  const residual = new Map(total)
  for (const [year, cents] of preserved) {
    const next = (residual.get(year) ?? 0) - cents
    if (!Number.isSafeInteger(next) || next < 0) return null
    if (next === 0) residual.delete(year)
    else residual.set(year, next)
  }
  return residual
}

function resultConversionCentsByYear(
  result: Readonly<ExactDecisionEvaluation['candidateResult']>,
): Map<number, number> | null {
  const byYear = new Map<number, number>()
  for (const year of result.years) {
    if (typeof year.rothConversion !== 'number' || !Number.isFinite(year.rothConversion) ||
        year.rothConversion < 0) return null
    if (year.rothConversion <= 1) continue
    const cents = planDollarsToLedgerCents(year.rothConversion)
    byYear.set(year.year, cents)
  }
  return byYear
}

function acaEvidenceIsActionable(
  result: Readonly<ExactDecisionEvaluation['candidateResult']>,
): boolean {
  return result.years.every((year) => {
    if (year.aca === undefined) return true
    return asUnknownRecord(year.aca)?.['readiness'] === 'actionable'
  })
}

/**
 * Bind one identity-allocated optimizer candidate to the exact aggregate
 * winner that was withheld by the readiness veto. This function does not lift
 * the veto or simulate anything. It returns evidence only when identity,
 * provenance, requested and executed cents, committed/actionable execution,
 * and the canonical invariant-7 exact-ledger comparison all agree.
 */
export function compareOptimizerAllocatedCandidate(
  input: Readonly<OptimizerAllocatedCandidateComparisonInput>,
): Readonly<OptimizerAllocatedCandidateComparisonEvidence> | null {
  try {
    const snapshot = structuredClone(input) as OptimizerAllocatedCandidateComparisonInput
    const { plan, readinessVeto: veto, allocatedEvaluation: evaluation } = snapshot
    if (veto.reason !== 'identityIncomplete' ||
        (veto.vetoedWinnerSource !== 'candidate' && veto.vetoedWinnerSource !== 'milp') ||
        !['beneficial', 'neutral', 'rejected'].includes(evaluation.recommendationState) ||
        !acaEvidenceIsActionable(veto.vetoedResult) ||
        !acaEvidenceIsActionable(evaluation.candidateResult)) return null
    const winnerCents = conversionCentsByYear(veto.vetoedConversions)
    const allocated = allocatedRequests(plan, evaluation)
    if (winnerCents === null || allocated === null ||
        !provenanceMatchesWinner(veto, evaluation, allocated.requests)) return null
    const requestedCents = requestCentsByYear(allocated.requests)
    const executedCents = committedExecutionCentsByYear(evaluation, allocated.requests)
    const vetoedResultCents = resultConversionCentsByYear(veto.vetoedResult)
    const allocatedResultCents = resultConversionCentsByYear(evaluation.candidateResult)
    const allocatedActionIds = new Set(allocated.actionIds)
    const preservedRequests = preservedConversionRequests(plan, allocatedActionIds)
    const vetoedPreservedCents = preservedRequests === null
      ? null
      : publishedExecutionCentsByYear(veto.vetoedResult, preservedRequests)
    const allocatedPreservedCents = preservedRequests === null
      ? null
      : publishedExecutionCentsByYear(evaluation.candidateResult, preservedRequests)
    const vetoedIncrementCents = vetoedResultCents === null || vetoedPreservedCents === null
      ? null
      : subtractYearCents(vetoedResultCents, vetoedPreservedCents)
    const allocatedIncrementCents = allocatedResultCents === null || allocatedPreservedCents === null
      ? null
      : subtractYearCents(allocatedResultCents, allocatedPreservedCents)
    if (requestedCents === null || executedCents === null || vetoedResultCents === null ||
        allocatedResultCents === null || preservedRequests === null ||
        vetoedPreservedCents === null || allocatedPreservedCents === null ||
        vetoedIncrementCents === null || allocatedIncrementCents === null ||
        !sameYearCents(winnerCents, requestedCents) ||
        !sameYearCents(winnerCents, executedCents) ||
        !sameYearCents(winnerCents, vetoedIncrementCents) ||
        !sameYearCents(winnerCents, allocatedIncrementCents)) return null

    const exactLedgerComparison = compareOptimizerExactLedgerResults(
      veto.vetoedResult,
      evaluation.candidateResult,
      plan,
    )
    if (exactLedgerComparison === null) return null
    return deepFreeze({
      winnerSource: veto.vetoedWinnerSource,
      winnerCandidateId: veto.vetoedCandidateId,
      winnerCandidateLabel: veto.vetoedCandidateLabel,
      winnerConversions: veto.vetoedConversions.map((conversion) => ({ ...conversion })),
      allocatedCandidateId: evaluation.candidate.id,
      allocatedActionIds: [...allocated.actionIds],
      exactLedgerComparison,
    })
  } catch {
    return null
  }
}
