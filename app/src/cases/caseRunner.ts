import { parseV2Backup } from '@retiregolden/planner-ui/data/v2Backup'
import {
  assetLocationGenerator,
  createDecisionContext,
  noConversionGenerator,
  runDecisionTournament,
  simpleRothConversionGenerator,
  socialSecurityClaimGenerator,
  withdrawalOrderGenerator,
  type CandidateGenerator,
  type DecisionTournamentResult,
} from '@retiregolden/engine/decisions'
import { migratePlanToCurrent } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'
import { LATEST_PACK_YEAR, PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS } from '@retiregolden/engine/params'
import { LATEST_STATE_PACK_YEAR } from '@retiregolden/engine/params/state'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { EXAMPLE_FIXED_YEAR } from '@retiregolden/planner-ui/planner/examples/buildContext'
import { EXAMPLE_PLANS } from '@retiregolden/planner-ui/planner/examples/registry'
import { stableStringify } from './stableJson'

export const CASE_MANIFEST_KIND = 'retiregolden.case-runner.manifest'
export const CASE_MANIFEST_VERSION = 1
export const CASE_ROUNDING = 'whole-dollar'

export interface CaseSource {
  type: 'example' | 'plan-file' | 'embedded-plan' | 'plan-scenario' | 'scenario-set'
  id?: string
  label?: string
  planId?: string
  scenarioId?: string
  scenarioName?: string
}

export interface CaseDefinition {
  id: string
  name: string
  plan: Plan
  source: CaseSource
}

export interface PlansFromJsonResult {
  plans: Plan[]
  warnings: string[]
}

export interface ScenarioSetScenario {
  id: string
  name: string
  patch: Record<string, unknown>
}

export interface ScenarioSet {
  id: string
  name: string
  scenarios: ScenarioSetScenario[]
}

export interface RunCasesOptions {
  caseSetName?: string
  startYear?: number
  includeDecisions?: boolean
  decisionGenerators?: CandidateGenerator[]
  decisionMaxCandidates?: number
}

export interface CaseMetrics {
  depletionYear: number | null
  endingAfterTaxEstate: number
  endingInvestable: number
  endingNetWorth: number
  lifetimeRothConversions: number
  lifetimeTaxesAndPenalties: number
  modeledYears: number
}

export interface CaseDecisionRow {
  candidateId: string
  category: string
  diagnostics: string[]
  label: string
  lossReason: string | null
  moneyLastsYearsDelta: number
  primaryValue: number
  recommendationState: string
  source: string
  deltas: {
    endingAfterTaxEstate: number
    endingNetWorth: number
    lifetimeTax: number
  }
}

export interface CaseDecisionSummary {
  policyId: string
  ranked: CaseDecisionRow[]
  simulationCount: number
  winner: null | {
    candidateId: string
    label: string
    primaryValue: number
    recommendationState: string
  }
}

export interface CaseRunResult {
  id: string
  name: string
  source: CaseSource
  startYear: number
  endYear: number
  metrics: CaseMetrics
  warnings: string[]
  decision?: CaseDecisionSummary
}

export interface CaseRunnerManifest {
  kind: typeof CASE_MANIFEST_KIND
  version: typeof CASE_MANIFEST_VERSION
  caseSet: string
  options: {
    decisionMaxCandidates: number | null
    federalParameterPackYear: number
    includeDecisions: boolean
    parameterDataAsOf: string
    parameterDataBasis: string
    rounding: typeof CASE_ROUNDING
    startYear: number
    stateParameterPackYear: number
    taxStack: 'federal-plus-modeled-state'
  }
  totals: {
    caseCount: number
    warningCount: number
  }
  cases: CaseRunResult[]
}

export interface ProjectedCase {
  result: ProjectionResult
  summary: ProjectionSummary
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function roundDollars(value: number): number {
  return Math.round(value)
}

function taxCalculatorFor(plan: Plan) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

function metricsFrom(summary: ProjectionSummary, result: ProjectionResult): CaseMetrics {
  return {
    depletionYear: summary.depletionYear,
    endingAfterTaxEstate: roundDollars(summary.endingAfterTaxEstate),
    endingInvestable: roundDollars(summary.endingInvestable),
    endingNetWorth: roundDollars(summary.endingNetWorth),
    lifetimeRothConversions: roundDollars(summary.lifetimeRothConversions),
    lifetimeTaxesAndPenalties: roundDollars(summary.lifetimeTaxesAndPenalties),
    modeledYears: result.years.length,
  }
}

function defaultDecisionGenerators(): CandidateGenerator[] {
  return [
    simpleRothConversionGenerator,
    noConversionGenerator,
    withdrawalOrderGenerator,
    socialSecurityClaimGenerator,
    assetLocationGenerator,
  ]
}

function summarizeDecision(tournament: DecisionTournamentResult): CaseDecisionSummary {
  return {
    policyId: tournament.policyId,
    simulationCount: tournament.simulationCount,
    winner: tournament.winner
      ? {
          candidateId: tournament.winner.evaluation.candidate.id,
          label: tournament.winner.evaluation.candidate.label,
          primaryValue: roundDollars(tournament.winner.primaryValue),
          recommendationState: tournament.winner.evaluation.recommendationState,
        }
      : null,
    ranked: tournament.ranked.map((row) => ({
      candidateId: row.evaluation.candidate.id,
      category: row.evaluation.candidate.category,
      diagnostics: [...row.evaluation.diagnostics].sort(),
      label: row.evaluation.candidate.label,
      lossReason: row.lossReason,
      moneyLastsYearsDelta: row.evaluation.deltas.moneyLastsYears,
      primaryValue: roundDollars(row.primaryValue),
      recommendationState: row.evaluation.recommendationState,
      source: row.evaluation.candidate.source,
      deltas: {
        endingAfterTaxEstate: roundDollars(row.evaluation.deltas.endingAfterTaxEstate),
        endingNetWorth: roundDollars(row.evaluation.deltas.endingNetWorth),
        lifetimeTax: roundDollars(row.evaluation.deltas.lifetimeTax),
      },
    })),
  }
}

export function defaultExampleCases(): CaseDefinition[] {
  return EXAMPLE_PLANS.map((example) => ({
    id: `example:${example.id}`,
    name: example.title,
    plan: example.build(),
    source: { type: 'example', id: example.id, label: example.title },
  }))
}

export function caseDefinitionsFromPlans(
  plans: Plan[],
  source: Omit<CaseSource, 'planId'>,
  options: { includePlanScenarios?: boolean } = {},
): CaseDefinition[] {
  const cases: CaseDefinition[] = []
  for (const plan of plans) {
    const planSlug = slugPart(plan.id || plan.name)
    const baseId = `${source.type === 'example' ? 'example' : 'plan'}:${planSlug}`
    cases.push({
      id: baseId,
      name: plan.name,
      plan,
      source: { ...source, planId: plan.id },
    })

    if (!options.includePlanScenarios) continue
    for (const scenario of plan.scenarios) {
      const applied = applyScenarioPatch(plan, scenario.patch)
      if (!applied.ok) {
        throw new Error(`Scenario "${scenario.name}" on plan "${plan.name}" is invalid: ${applied.issues.join('; ')}`)
      }
      cases.push({
        id: `${baseId}/scenario:${slugPart(scenario.id)}`,
        name: `${plan.name} - ${scenario.name}`,
        plan: applied.plan,
        source: {
          type: 'plan-scenario',
          label: source.label,
          planId: plan.id,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
        },
      })
    }
  }
  return cases
}

export function appendScenarioSetCases(cases: CaseDefinition[], scenarioSet: ScenarioSet): CaseDefinition[] {
  const expanded = [...cases]
  for (const base of cases) {
    for (const scenario of scenarioSet.scenarios) {
      const applied = applyScenarioPatch(base.plan, scenario.patch)
      if (!applied.ok) {
        throw new Error(
          `Scenario-set "${scenarioSet.name}" scenario "${scenario.name}" is invalid for "${base.name}": ${applied.issues.join('; ')}`,
        )
      }
      expanded.push({
        id: `${base.id}/scenario-set:${slugPart(scenarioSet.id)}:${slugPart(scenario.id)}`,
        name: `${base.name} - ${scenario.name}`,
        plan: applied.plan,
        source: {
          type: 'scenario-set',
          id: scenarioSet.id,
          label: scenarioSet.name,
          planId: base.plan.id,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
        },
      })
    }
  }
  return expanded
}

export function plansFromJsonInput(json: string, sourceLabel = 'input'): PlansFromJsonResult {
  const backup = parseV2Backup(json)
  if (backup.ok) return { plans: backup.plans, warnings: backup.warnings }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error(`${sourceLabel} is not valid JSON`)
  }

  const candidates =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object' && raw !== null && Array.isArray((raw as { plans?: unknown }).plans)
        ? (raw as { plans: unknown[] }).plans
        : [raw]

  const plans: Plan[] = []
  const warnings: string[] = []
  candidates.forEach((candidate, index) => {
    const migrated = migratePlanToCurrent(candidate)
    if (migrated.ok) {
      plans.push(migrated.plan)
    } else {
      warnings.push(`${sourceLabel} plan ${index + 1}: skipped (${migrated.reason})`)
    }
  })
  if (plans.length === 0) throw new Error(`${sourceLabel} did not contain any valid plans`)
  return { plans, warnings }
}

export function scenarioSetFromJson(json: string, sourceLabel = 'scenario set'): ScenarioSet {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error(`${sourceLabel} is not valid JSON`)
  }
  if (typeof raw !== 'object' || raw === null) throw new Error(`${sourceLabel} must be an object`)
  const obj = raw as { id?: unknown; name?: unknown; scenarios?: unknown }
  const scenariosRaw = obj.scenarios
  if (!Array.isArray(scenariosRaw) || scenariosRaw.length === 0) {
    throw new Error(`${sourceLabel} must contain a non-empty scenarios array`)
  }
  const scenarios = scenariosRaw.map((item, index): ScenarioSetScenario => {
    if (typeof item !== 'object' || item === null) throw new Error(`${sourceLabel} scenario ${index + 1} must be an object`)
    const scenario = item as { id?: unknown; name?: unknown; patch?: unknown }
    if (typeof scenario.id !== 'string' || scenario.id.length === 0) {
      throw new Error(`${sourceLabel} scenario ${index + 1} must have an id`)
    }
    if (typeof scenario.name !== 'string' || scenario.name.length === 0) {
      throw new Error(`${sourceLabel} scenario ${index + 1} must have a name`)
    }
    if (typeof scenario.patch !== 'object' || scenario.patch === null || Array.isArray(scenario.patch)) {
      throw new Error(`${sourceLabel} scenario ${index + 1} must have an object patch`)
    }
    return {
      id: scenario.id,
      name: scenario.name,
      patch: scenario.patch as Record<string, unknown>,
    }
  })
  const id = typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : slugPart(sourceLabel)
  const name = typeof obj.name === 'string' && obj.name.length > 0 ? obj.name : sourceLabel
  return { id, name, scenarios }
}

/**
 * Guarantee globally-unique case ids. Imported plan files (or directory entries)
 * can contain the same plan id, which would otherwise collide: the diff keys cases
 * by id and report filenames derive from the id, so a duplicate would silently mask
 * one case during diffing and overwrite one HTML report. Deterministically suffix
 * repeats by encounter order so the manifest stays stable for a given input set.
 */
export function dedupeCaseDefinitionIds(cases: CaseDefinition[]): CaseDefinition[] {
  const seen = new Map<string, number>()
  return cases.map((definition) => {
    const count = seen.get(definition.id) ?? 0
    seen.set(definition.id, count + 1)
    if (count === 0) return definition
    return { ...definition, id: `${definition.id}~${count + 1}` }
  })
}

// Only label the manifest as the bundled example library when every case actually
// came from it; imported plans/scenario sets get a neutral label so diffing and
// regression workflows are not misled into comparing them against the examples.
function defaultCaseSetName(caseDefinitions: CaseDefinition[]): string {
  if (caseDefinitions.length > 0 && caseDefinitions.every((c) => c.source.type === 'example')) {
    return 'default-example-library'
  }
  return 'imported-plans'
}

export function runCases(caseDefinitions: CaseDefinition[], options: RunCasesOptions = {}): CaseRunnerManifest {
  const startYear = options.startYear ?? EXAMPLE_FIXED_YEAR
  const includeDecisions = options.includeDecisions ?? false
  const decisionGenerators = options.decisionGenerators ?? defaultDecisionGenerators()
  const decisionMaxCandidates = options.decisionMaxCandidates ?? 32
  const cases: CaseRunResult[] = caseDefinitions.map((definition) => {
    const simulateOptions = { startYear, taxCalculator: taxCalculatorFor(definition.plan) }
    const { result, summary } = projectCase(definition, startYear)
    const ctx = includeDecisions ? createDecisionContext(definition.plan, simulateOptions, { result, summary }) : null
    const decision = ctx
      ? summarizeDecision(runDecisionTournament(ctx, decisionGenerators, { maxCandidates: decisionMaxCandidates }))
      : undefined

    return {
      id: definition.id,
      name: definition.name,
      source: definition.source,
      startYear,
      endYear: result.endYear,
      metrics: metricsFrom(summary, result),
      warnings: [...result.warnings].sort(),
      ...(decision ? { decision } : {}),
    }
  })

  return {
    kind: CASE_MANIFEST_KIND,
    version: CASE_MANIFEST_VERSION,
    caseSet: options.caseSetName ?? defaultCaseSetName(caseDefinitions),
    options: {
      decisionMaxCandidates: includeDecisions ? decisionMaxCandidates : null,
      federalParameterPackYear: LATEST_PACK_YEAR,
      includeDecisions,
      parameterDataAsOf: PARAMETER_DATA_AS_OF,
      parameterDataBasis: PARAMETER_DATA_BASIS,
      rounding: CASE_ROUNDING,
      startYear,
      stateParameterPackYear: LATEST_STATE_PACK_YEAR,
      taxStack: 'federal-plus-modeled-state',
    },
    totals: {
      caseCount: cases.length,
      warningCount: cases.reduce((sum, row) => sum + row.warnings.length, 0),
    },
    cases,
  }
}

export function projectCase(definition: CaseDefinition, startYear = EXAMPLE_FIXED_YEAR): ProjectedCase {
  const result = simulatePlan(definition.plan, { startYear, taxCalculator: taxCalculatorFor(definition.plan) })
  return {
    result,
    summary: summarizeProjection(definition.plan, result),
  }
}

export function stableCaseManifestJson(manifest: CaseRunnerManifest): string {
  return stableStringify(manifest)
}
